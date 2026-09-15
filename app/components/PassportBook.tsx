"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  drawPage, drawBlankPage,
  BOOK_TILT_DEG, BOOK_FOV, BOOK_FIT_MARGIN, CLOSED_VIEW_W,
  PAGE_PAPER_HEX, PAGE_W, PAGE_H, type PageSpec,
} from "@/lib/passportPages";
import type { PassportData } from "@/lib/passport";

/**
 * 攤開的護照。
 *
 * 場景是三張固定的頁面加一張會動的活頁：
 *   leftPage                書脊左邊，永遠是空白內頁
 *   rightPage / rightUnder   書脊右邊，分別是 index（當前頁）與 index+1
 *   leaf                    正在被翻的那一張，繞書脊轉；正面是內容、背面是空白內頁
 *
 * 左頁留白，所以活頁的背面和左頁是同一張圖 —— 翻到 180 度時它正好蓋在左頁上，那一刻把它藏
 * 起來完全看不出來。背面若印著別的東西，翻完瞬間就會跳一下。
 *
 * index 的意思沒有變：它就是右邊那一頁。所以頁碼、上下頁按鈕、年度存圖都不用跟著改。
 */

const PH = 1;
const PW = (PAGE_W / PAGE_H) * PH;

/**
 * 整本歪一點，才不會像一張擺正的簡報。
 *
 * BOOK_TILT_DEG 是 CSS 慣例的角度（正值＝順時針），three 的 rotation.z 正向是逆時針，
 * 所以這裡要取負號，畫出來才和飛進來的那本同一個方向。
 */
const TILT_Z = THREE.MathUtils.degToRad(-BOOK_TILT_DEG);

const MAX_BEND = 0.17;
const TURN_MS = 780;

/** 版面比這個寬就攤開給滿；比這個窄（手機）只框住當前頁，左頁露一角 */
const SPREAD_ASPECT = 1.25;

/**
 * 攤開時鏡頭往右頁偏多少（以頁寬為單位）。
 *
 * 鏡頭往右＝畫面上的書往左。0.5 剛好是把正在讀的右頁擺正中間，左頁露一角。
 * 整本要再往左就把這個數字調大，往右就調小。
 */
const SPREAD_FOCUS_X = 0.46;

interface Props {
  pages: PageSpec[];
  data: PassportData;
  index: number;
  onIndexChange: (index: number, direction: number) => void;
  /** 第一張貼圖畫好、書真的出現在畫面上時才呼叫，讓外面把靜態封面收起來 */
  onReady?: () => void;
  /** 點在護照以外的地方 */
  onDismiss?: () => void;
  /** 翻成 true 時把書闔上（封面從左邊蓋回右邊），闔完呼叫 onClosed */
  closing?: boolean;
  onClosed?: () => void;
  className?: string;
}

function makePageMesh(side: -1 | 1): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(PW, PH, 1, 1);
  // 書脊在原點：右頁往 +x 長，左頁往 -x 長
  geo.translate((PW / 2) * side, 0, 0);
  return new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: PAGE_PAPER_HEX, roughness: 0.94, metalness: 0 })
  );
}

function setMap(mesh: THREE.Mesh, tex: THREE.Texture | null) {
  const mat = mesh.material as THREE.MeshStandardMaterial;
  if (mat.map === (tex ?? null)) return;
  mat.map = tex;
  mat.color.setHex(tex ? 0xffffff : PAGE_PAPER_HEX);
  mat.needsUpdate = true;
}

export default function PassportBook({
  pages, data, index, onIndexChange, onReady, onDismiss, closing = false, onClosed, className,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const goToRef = useRef<((i: number) => void) | null>(null);
  const closeRef = useRef<(() => void) | null>(null);
  const stateRef = useRef({ index, count: pages.length, onIndexChange, onReady, onDismiss, onClosed });
  stateRef.current = { index, count: pages.length, onIndexChange, onReady, onDismiss, onClosed };

  useEffect(() => {
    const host = hostRef.current;
    if (!host || pages.length === 0) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(BOOK_FOV, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "pan-y";

    scene.add(new THREE.AmbientLight(0xffffff, 1.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(-1.4, 1.6, 2.4);
    scene.add(key);

    const root = new THREE.Group();
    root.rotation.z = TILT_Z;
    scene.add(root);

    // ── 空白內頁的貼圖：左頁與活頁背面共用 ──────────────
    const blankCanvas = document.createElement("canvas");
    drawBlankPage(blankCanvas);
    const blankTex = new THREE.CanvasTexture(blankCanvas);
    blankTex.colorSpace = THREE.SRGBColorSpace;

    // ── 固定的三頁 ──────────────────────────────────────
    const leftPage = makePageMesh(-1);
    const rightUnder = makePageMesh(1);
    const rightPage = makePageMesh(1);
    setMap(leftPage, blankTex);
    leftPage.position.z = 0.004;
    rightUnder.position.z = 0.001;
    rightPage.position.z = 0.004;
    root.add(leftPage, rightUnder, rightPage);

    /*
      書芯拆成左右兩半。整片的話，停在封面時左半邊會露出一塊深色的底 —— 那時候左邊根本還沒有
      東西，護照是闔著的。
    */
    function makeBlockHalf(side: -1 | 1): THREE.Mesh {
      const width = PW * 1.03;
      const geo = new THREE.BoxGeometry(width, PH * 1.04, 0.05);
      geo.translate((width / 2) * side, 0, 0);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: 0x140e22, roughness: 1 })
      );
      mesh.position.z = -0.03;
      return mesh;
    }
    const blockLeft = makeBlockHalf(-1);
    const blockRight = makeBlockHalf(1);
    root.add(blockLeft, blockRight);

    // ── 會動的那一張 ────────────────────────────────────
    const leafFrontGeo = new THREE.PlaneGeometry(PW, PH, 24, 1);
    leafFrontGeo.translate(PW / 2, 0, 0);

    const leafBackGeo = new THREE.PlaneGeometry(PW, PH, 24, 1);
    leafBackGeo.rotateY(Math.PI);
    leafBackGeo.translate(PW / 2, 0, 0);

    const leafMat = new THREE.MeshStandardMaterial({
      color: PAGE_PAPER_HEX, roughness: 0.94, metalness: 0,
    });
    // 背面就是空白內頁本身，和左頁同一張圖
    const leafBackMat = new THREE.MeshStandardMaterial({
      map: blankTex, roughness: 0.94, metalness: 0,
    });
    const leafFront = new THREE.Mesh(leafFrontGeo, leafMat);
    const leafBack = new THREE.Mesh(leafBackGeo, leafBackMat);
    const leaf = new THREE.Group();
    leaf.add(leafFront, leafBack);
    leaf.position.z = 0.008;
    leaf.visible = false;
    root.add(leaf);

    const leafBase = [
      Float32Array.from(leafFrontGeo.attributes.position.array as Float32Array),
      Float32Array.from(leafBackGeo.attributes.position.array as Float32Array),
    ];
    let leafBend = 0;

    function bendLeaf(amount: number) {
      if (amount === leafBend) return;
      leafBend = amount;
      [leafFrontGeo, leafBackGeo].forEach((geo, gi) => {
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        const base = leafBase[gi];
        for (let i = 0; i < arr.length; i += 3) {
          const x = base[i];
          const u = Math.min(1, Math.max(0, x / PW));
          arr[i + 2] = base[i + 2] + Math.sin(u * Math.PI) * amount;
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
      });
    }

    // ── 貼圖 ────────────────────────────────────────────
    const textures = new Map<string, THREE.Texture>();
    const rendering = new Set<string>();
    let disposed = false;
    let raf = 0;
    let readyFired = false;

    function texOf(i: number): THREE.Texture | null {
      const page = pages[i];
      return page ? textures.get(page.key) ?? null : null;
    }

    async function ensureTexture(i: number): Promise<void> {
      const page = pages[i];
      if (!page || textures.has(page.key) || rendering.has(page.key)) return;
      rendering.add(page.key);
      const canvas = document.createElement("canvas");
      await drawPage(canvas, page, data, i + 1);
      if (disposed) return;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      textures.set(page.key, tex);
      rendering.delete(page.key);
      applyTextures();
      draw();
      if (i === center && !readyFired) {
        readyFired = true;
        stateRef.current.onReady?.();
      }
    }

    /** 一張 1408×2000 的貼圖約 11MB VRAM，整本留著手機會爆 */
    function pruneTextures(centerIndex: number) {
      const keep = new Set(
        [-1, 0, 1, 2].map((d) => pages[centerIndex + d]?.key).filter(Boolean) as string[]
      );
      for (const [k, tex] of textures) {
        if (!keep.has(k)) { tex.dispose(); textures.delete(k); }
      }
    }

    // ── 狀態 ────────────────────────────────────────────
    let center = index;
    let dir = 0;
    let progress = 0;
    let animating = false;
    let pendingTarget: number | null = null;
    /** 闔書中：活頁載的是封面，而且左邊在封面掃過書脊之後要收掉 */
    let closingNow = false;

    function applyTextures() {
      setMap(rightPage, texOf(center));
      setMap(rightUnder, texOf(center + 1));
      /*
        左邊一律留白，出現與否看「有幾張紙真的躺在左邊」。

        往前翻時飛在空中的那張是從右邊來的，所以左邊躺著的還是 center 張；往後翻時飛的那張
        原本就躺在左邊，要扣掉。用 dir !== 0 一律當成有的話，從封面按下去的瞬間左邊會先冒出
        一張空白頁 —— 那時候什麼都還沒翻過去。
      */
      const restingLeft = center - (dir < 0 ? 1 : 0);
      // 闔書時封面掃過書脊之後，左邊就該是空的了 —— 書已經合上
      const openedLeft = closingNow ? progress < 0.5 : restingLeft >= 1;
      leftPage.visible = openedLeft;
      blockLeft.visible = openedLeft;
      rightPage.visible = dir <= 0;
      rightUnder.visible = center + 1 < pages.length;
      // 活頁載的是「正在離開原位」的那一頁：往前翻是當前頁，往後翻是左邊那頁。
      // 闔書時一律是封面 —— 蓋回來的就是封面本身
      const leafIndex = closingNow ? 0 : dir > 0 ? center : dir < 0 ? center - 1 : -1;
      const leafTex = leafIndex >= 0 ? texOf(leafIndex) : null;
      if (leafMat.map !== leafTex) {
        leafMat.map = leafTex;
        leafMat.color.setHex(leafTex ? 0xffffff : PAGE_PAPER_HEX);
        leafMat.needsUpdate = true;
      }
    }

    function syncPages() {
      applyTextures();
      for (const d of [0, 1, -1, 2]) void ensureTexture(center + d);
      pruneTextures(center);
    }

    function layout() {
      leaf.visible = dir !== 0 || closingNow;
      if (closingNow) {
        // 封面從左邊（180 度）蓋回右邊（0 度）
        leaf.rotation.y = -Math.PI * (1 - progress);
        bendLeaf(Math.sin(progress * Math.PI) * MAX_BEND);
        applyTextures();
        updateCamera();
        return;
      }
      if (dir !== 0) {
        // 往前翻：活頁從右邊 0 度轉到左邊 180 度。往後翻反過來
        const turned = dir > 0 ? progress : 1 - progress;
        leaf.rotation.y = -Math.PI * turned;
        bendLeaf(Math.sin(progress * Math.PI) * MAX_BEND);
      } else {
        leaf.rotation.y = 0;
        bendLeaf(0);
      }
      applyTextures();
      updateCamera();
    }

    // ── 相機 ────────────────────────────────────────────
    let viewW = 1, viewH = 1, viewX = 0;

    function updateCamera() {
      const w = host!.clientWidth, h = host!.clientHeight;
      if (!w || !h) return;
      const aspect = w / h;
      const spread = aspect >= SPREAD_ASPECT;

      /*
        封面那一頁左邊沒有東西，整本會看起來偏右，所以闔起來時把視野往右頁中心移 ——
        翻開第一張時鏡頭跟著滑回書脊，就有「打開」的感覺。
      */
      /*
        攤開時不框滿整整兩頁寬。

        整本是斜的，畫面要框的垂直範圍是「寬×sin + 高×cos」—— 框得越寬，連帶要框的高度也越高，
        頁面就被壓得越小。所以把框收到一頁又三成，中心往右頁偏：右頁完整看得到，左頁只露左邊
        三成。書還是攤開的（看得到對頁），但讀的那一頁大了一截。

        傾角收到 8 度之後，cos 那個常數項從 0.966 降到 0.990，框高的壓力小了很多 —— 所以框可以
        放寬回一頁又四成五，對頁露得更多，頁面反而還比 15 度那版大。
      */
      const closed = closingNow || (center === 0 && dir === 0);
      const targetX = closed ? PW / 2 : spread ? PW * SPREAD_FOCUS_X : PW * 0.42;
      const targetW = closed ? PW * CLOSED_VIEW_W : spread ? PW * 1.45 : PW * 1.4;

      viewX += (targetX - viewX) * 0.18;
      viewW += (targetW - viewW) * 0.18;
      viewH = PH;

      // 整本是斜的，可視範圍要用旋轉後的外接矩形算，否則角會被切掉
      const c = Math.abs(Math.cos(TILT_Z)), s = Math.abs(Math.sin(TILT_Z));
      const boxW = viewW * c + viewH * s;
      const boxH = viewW * s + viewH * c;

      const vFov = (camera.fov * Math.PI) / 180;
      const distH = boxH / 2 / Math.tan(vFov / 2);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const distW = boxW / 2 / Math.tan(hFov / 2);
      /*
        BOOK_FIT_MARGIN 是刻意讓外接矩形稍微溢出畫面。

        那個矩形的四個角就是紙的四個角，而紙緣有 4.8% 的留白、花邊壓在留白內側，所以切掉一點點
        角落是看不出來的 —— 完整框住整個旋轉後的矩形，等於為了四個空白的角把整頁縮小一成。

        闔起來與攤開走的是同一條框法（只有框多寬不同），所以翻開的瞬間頁面大小不會跳。
        飛進來的那本用 closedCoverHeight() 算出同樣的結果，兩邊接得上。
      */
      const dist = Math.max(distH, distW) * BOOK_FIT_MARGIN;

      camera.position.set(viewX, 0, dist);
      camera.lookAt(viewX, 0, 0);
      camera.updateProjectionMatrix();
    }

    function draw() { renderer.render(scene, camera); }

    // ── 動畫 ────────────────────────────────────────────
    function animateTo(targetProgress: number, onDone: () => void) {
      animating = true;
      const from = progress;
      const start = performance.now();
      const duration = TURN_MS * Math.max(0.35, Math.abs(targetProgress - from));
      cancelAnimationFrame(raf);
      const step = (now: number) => {
        if (disposed) return;
        const t = Math.min(1, (now - start) / duration);
        progress = from + (targetProgress - from) * (1 - Math.pow(1 - t, 3));
        layout();
        draw();
        if (t < 1) raf = requestAnimationFrame(step);
        else { animating = false; onDone(); }
      };
      raf = requestAnimationFrame(step);
    }

    /** 鏡頭是漸近的，翻完之後再多跑幾幀讓它滑到定位 */
    function settleCamera() {
      let frames = 0;
      const step = () => {
        if (disposed || frames++ > 40) return;
        updateCamera();
        draw();
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    function commitTurn(delta: number) {
      center += delta;
      dir = 0;
      progress = 0;
      syncPages();
      layout();
      draw();
      settleCamera();
      flushPending();
    }

    function flushPending() {
      if (pendingTarget === null) return;
      const target = pendingTarget;
      pendingTarget = null;
      if (target !== center) goTo(target);
    }

    function goTo(target: number) {
      if (target === center) return;
      if (animating) { pendingTarget = target; return; }
      if (Math.abs(target - center) > 1) {
        center = target;
        dir = 0;
        progress = 0;
        syncPages();
        layout();
        draw();
        settleCamera();
        return;
      }
      dir = target > center ? 1 : -1;
      progress = 0;
      syncPages();
      layout();
      animateTo(1, () => commitTurn(dir));
    }
    goToRef.current = goTo;

    /** 闔上：封面從左邊翻回右邊蓋住內頁，鏡頭同時收到闔起來的取景 */
    function startClose() {
      if (closingNow) return;
      // 已經停在封面就是闔著的，沒有東西可以闔
      if (center === 0 && !animating) {
        stateRef.current.onClosed?.();
        return;
      }
      cancelAnimationFrame(raf);
      animating = false;
      pendingTarget = null;
      closingNow = true;
      dir = 0;
      progress = 0;
      // 封面的貼圖可能早就被 prune 掉了，先確保它在
      void ensureTexture(0);
      layout();
      draw();
      animateTo(1, () => {
        stateRef.current.onClosed?.();
      });
    }
    closeRef.current = startClose;

    // ── 拖曳與點擊 ──────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    /**
     * 這一點打到護照的哪一邊，或根本沒打到。
     *
     * 用射線而不是「畫面左半右半」：整本是斜的，而且封面時左邊是空的 —— 用畫面切一半的話，
     * 點在護照旁邊的空白處會被當成翻頁。
     */
    function pickAt(clientX: number, clientY: number): "left" | "right" | null {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);

      const targets: THREE.Object3D[] = [];
      if (leftPage.visible) targets.push(leftPage);
      if (rightPage.visible) targets.push(rightPage);
      if (rightUnder.visible) targets.push(rightUnder);
      if (leaf.visible) targets.push(leafFront, leafBack);

      const hit = raycaster.intersectObjects(targets, false)[0];
      if (!hit) return null;
      // 換回 root 的局部座標，書脊在 x = 0
      return root.worldToLocal(hit.point.clone()).x < 0 ? "left" : "right";
    }

    let dragging = false;
    let dragStartX = 0;
    let dragDir = 0;

    function onPointerDown(e: PointerEvent) {
      if (animating) return;
      dragging = true;
      dragStartX = e.clientX;
      dragDir = 0;
      renderer.domElement.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      const width = renderer.domElement.clientWidth || 1;

      if (dragDir === 0) {
        if (Math.abs(dx) < 6) return;
        dragDir = dx < 0 ? 1 : -1;
        const { index: i, count } = stateRef.current;
        if ((dragDir > 0 && i >= count - 1) || (dragDir < 0 && i <= 0)) {
          dragDir = 0;
          dragging = false;
          return;
        }
        dir = dragDir;
        syncPages();
      }

      progress = Math.min(1, Math.max(0, (dragDir > 0 ? -dx : dx) / (width * 0.55)));
      layout();
      draw();
    }

    function onPointerUp(e: PointerEvent) {
      if (!dragging) return;
      dragging = false;

      if (dragDir === 0) {
        // 沒移動就是點擊：點在護照上翻頁，點在護照外離開
        const picked = pickAt(e.clientX, e.clientY);
        if (!picked) {
          stateRef.current.onDismiss?.();
          return;
        }
        const side = picked === "left" ? -1 : 1;
        const { index: i, count } = stateRef.current;
        const target = i + side;
        if (target >= 0 && target < count) stateRef.current.onIndexChange(target, side);
        return;
      }

      const delta = dragDir;
      dragDir = 0;
      if (progress > 0.35) {
        animateTo(1, () => {
          commitTurn(delta);
          stateRef.current.onIndexChange(stateRef.current.index + delta, delta);
        });
      } else {
        animateTo(0, () => { dir = 0; layout(); draw(); flushPending(); });
      }
    }

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);

    function resize() {
      const w = host!.clientWidth, h = host!.clientHeight;
      if (!w || !h) return;
      // updateStyle 要保持預設的 true：傳 false 是「CSS 尺寸我自己設」，沒設的話 canvas 會用
      // 內建尺寸（w × dpr）顯示，比容器大一倍而且背景緩衝被稀釋成 1x
      renderer.setSize(w, h);
      camera.aspect = w / h;
      updateCamera();
      draw();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(host);

    syncPages();
    layout();
    // 第一次不要從漸近值滑進來，直接到位
    for (let i = 0; i < 40; i++) updateCamera();
    resize();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      for (const mesh of [leftPage, rightPage, rightUnder, blockLeft, blockRight]) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      leafFrontGeo.dispose();
      leafBackGeo.dispose();
      leafMat.dispose();
      leafBackMat.dispose();
      blankTex.dispose();
      for (const tex of textures.values()) tex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      goToRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, data]);

  useEffect(() => {
    goToRef.current?.(index);
  }, [index]);

  useEffect(() => {
    if (closing) closeRef.current?.();
  }, [closing]);

  return <div ref={hostRef} className={className} />;
}
