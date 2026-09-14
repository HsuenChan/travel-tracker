"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export interface GlobePin {
  name: string;
  lat: number;
  lng: number;
}

/** 經緯度 → 球面座標（與首頁地球同一套慣例，經度 0 落在 +x） */
function toVector(lat: number, lng: number, r: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/** 牌面文字：three 沒有內建文字，用 canvas 畫成貼圖是最輕的做法（不必多裝字型套件） */
const SANS = '"LINE Seed TC", -apple-system, "PingFang TC", "Noto Sans TC", sans-serif';
/** 宋體：Mac 是 Songti TC、Windows 是新細明體，最後退回系統 serif */
const SONG = '"Songti TC", "Songti SC", "PMingLiU", "MingLiU", "Noto Serif TC", serif';

function makeLabelTexture(text: string, size = 46, color = "#f0e2c2", family = SANS, weight = 600) {
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 180;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, c.width / 2, c.height / 2, c.width * 0.84);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 箱殼的幾何：把正面的輪廓沿深度擠出。
 *
 * 不用 RoundedBoxGeometry —— 它會把十二條邊全部倒圓，包含兩半互相貼合的那一面，
 * 所以開盒的接縫會是弧形。這裡只在外側兩個轉角走曲線，開口那一邊保持直線，
 * 前後臉再給一點 bevel：外緣圓潤、開口俐落。
 */
function makeShell(w: number, h: number, depth: number, r: number, roundBottom: boolean) {
  const bevel = 0.045;
  const sw = w - bevel * 2;
  const sh = h - bevel * 2;
  const rr = Math.min(r, sh * 0.45);
  const shape = new THREE.Shape();
  if (roundBottom) {
    shape.moveTo(-sw / 2, sh / 2);
    shape.lineTo(sw / 2, sh / 2);
    shape.lineTo(sw / 2, -sh / 2 + rr);
    shape.quadraticCurveTo(sw / 2, -sh / 2, sw / 2 - rr, -sh / 2);
    shape.lineTo(-sw / 2 + rr, -sh / 2);
    shape.quadraticCurveTo(-sw / 2, -sh / 2, -sw / 2, -sh / 2 + rr);
  } else {
    shape.moveTo(-sw / 2, -sh / 2);
    shape.lineTo(sw / 2, -sh / 2);
    shape.lineTo(sw / 2, sh / 2 - rr);
    shape.quadraticCurveTo(sw / 2, sh / 2, sw / 2 - rr, sh / 2);
    shape.lineTo(-sw / 2 + rr, sh / 2);
    shape.quadraticCurveTo(-sw / 2, sh / 2, -sw / 2, sh / 2 - rr);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 12,
  });
  geo.center();
  return geo;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * 新增旅程的 3D 舞台：行李箱與地球活在同一個場景裡。
 *
 * 兩者原本各有一個 canvas，切換步驟時第一幕整個被卸載、第二幕重建，所以做不出
 * 「箱蓋掀開、地球從裡面升起來」這種連續的轉場。合併成一台相機、一個場景之後，
 * 進第二步就是一段運鏡：蓋子開 → 地球放大升出箱口 → 相機從看箱子推到看地球。
 *
 * 這是這一頁唯一一段被編排過的動作，刻意不再加第二段。
 */
export default function WizardStage({
  step,
  tripName,
  pins,
  people,
  currencies,
  pointerRef,
}: {
  /** 0 = 行李箱，1 = 地球，2 = 行李吊牌 */
  step: number;
  tripName?: string;
  pins: GlobePin[];
  people: string[];
  currencies: string[];
  pointerRef?: RefObject<{ x: number; y: number }>;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stepRef = useRef(step);
  stepRef.current = step;
  const pinsRef = useRef<GlobePin[]>(pins);
  pinsRef.current = pins;
  const peopleRef = useRef<string[]>(people);
  peopleRef.current = people;
  const currenciesRef = useRef<string[]>(currencies);
  currenciesRef.current = currencies;
  const nudgeRef = useRef(0);
  const prevName = useRef("");

  useEffect(() => {
    if (tripName && tripName !== prevName.current) {
      prevName.current = tripName;
      nudgeRef.current = 1;
    }
  }, [tripName]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const W = 3.2, H = 2.3, D = 1.32;
    const BOTTOM_H = H * 0.56;
    const LID_H = H * 0.44;
    const GLOBE_R = 1.02;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.35, 9.2);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearAlpha(0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    /* 光：主燈偏暖才吃得出黃銅，緣光維持 indigo 顧住品牌 */
    scene.add(new THREE.AmbientLight(0x7d59a0, 0.42));
    const key = new THREE.DirectionalLight(0xfff2e2, 2.05);
    key.position.set(-3.4, 5.2, 4.6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x818cf8, 1.7);
    rim.position.set(4.6, 1.2, -3.2);
    scene.add(rim);
    const warm = new THREE.PointLight(0xffd9a0, 20, 20);
    warm.position.set(2.4, -1.4, 3.6);
    scene.add(warm);

    const stage = new THREE.Group();
    scene.add(stage);

    /* 皮革的紋理：canvas 雜訊當 normal map，沒有它再深的顏色都還是塑膠 */
    const grainCanvas = document.createElement("canvas");
    grainCanvas.width = grainCanvas.height = 256;
    const gctx = grainCanvas.getContext("2d");
    if (gctx) {
      const img = gctx.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = 118 + Math.random() * 22;
        img.data[i] = n; img.data[i + 1] = n; img.data[i + 2] = 255; img.data[i + 3] = 255;
      }
      gctx.putImageData(img, 0, 0);
    }
    const grain = new THREE.CanvasTexture(grainCanvas);
    grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
    grain.repeat.set(5, 4);

    const leather = new THREE.MeshStandardMaterial({
      color: 0x6d2c38, roughness: 0.88, metalness: 0.06,
      normalMap: grain, normalScale: new THREE.Vector2(0.5, 0.5),
    });
    const strapMat = new THREE.MeshStandardMaterial({
      color: 0x3b1a22, roughness: 0.84, metalness: 0.08,
      normalMap: grain, normalScale: new THREE.Vector2(0.4, 0.4),
    });
    const brass = new THREE.MeshStandardMaterial({ color: 0xe0bd55, roughness: 0.3, metalness: 0.92 });
    /* 吊牌是米色卡紙（老式行李牌的顏色），跟酒紅皮箱才分得開 */
    const tagCard = new THREE.MeshStandardMaterial({ color: 0xe6d9be, roughness: 0.85, metalness: 0.02 });
    const tagStrapMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.8, metalness: 0.06 });
    const tagBrass = new THREE.MeshStandardMaterial({ color: 0xe0bd55, roughness: 0.3, metalness: 0.92 });
    /* 提把不跟著箱體淡出：吊牌是掛在它上面的，它要留著 */
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x3b1a22, roughness: 0.84, metalness: 0.08 });

    /* 箱內：不上紋理的深色，讓地球從暗處升起來 */
    const liningMat = new THREE.MeshStandardMaterial({ color: 0x2a1218, roughness: 1, metalness: 0 });

    /* 第三幕整個箱體要淡掉，所以這幾個材質都要能透明（提把與吊牌用自己的材質，不在內） */
    const fading = [leather, strapMat, brass, liningMat];
    fading.forEach((m) => { m.transparent = true; });

    const suitcase = new THREE.Group();
    stage.add(suitcase);

    /* ── 下半箱體 ──
       圓角收到 0.075（箱高的 3%）：硬殼皮箱是有稜有角的，先前 0.26 的大圓角讓它整個像枕頭。 */
    /*
      挖空的作法：外殼縮短 RIM，開口處補一圈由四根細條組成的箱緣（中間是空的），
      殼面因此退到箱緣之後 RIM 那麼深 —— 看進去就是凹槽，而不是一塊實心面。
      這樣不動外殼的輪廓與座標，只是加東西，不會像上次整組拆掉。
    */
    const RIM = 0.12;        // 箱緣高度（＝凹進去的深度）
    const RIM_T = 0.15;      // 箱緣厚度
    const openY = -H / 2 + BOTTOM_H;

    const bottom = new THREE.Mesh(makeShell(W, BOTTOM_H - RIM, D, 0.3, true), leather);
    bottom.position.y = -H / 2 + (BOTTOM_H - RIM) / 2;
    suitcase.add(bottom);

    /** 開口的一圈箱緣：四根細條，中間留空 */
    const addRim = (parent: THREE.Object3D, centerY: number, centerZ: number) => {
      const lr = new THREE.BoxGeometry(RIM_T, RIM, D);
      const fb = new THREE.BoxGeometry(W - RIM_T * 2, RIM, RIM_T);
      [-1, 1].forEach((sx) => {
        const bar = new THREE.Mesh(lr, leather);
        bar.position.set(sx * (W / 2 - RIM_T / 2), centerY, centerZ);
        parent.add(bar);
      });
      [-1, 1].forEach((sz) => {
        const bar = new THREE.Mesh(fb, leather);
        bar.position.set(0, centerY, centerZ + sz * (D / 2 - RIM_T / 2));
        parent.add(bar);
      });
    };
    addRim(suitcase, openY - RIM / 2, 0);

    /* 箱底的襯：貼在殼面上方 0.01，不與任何面共平面 */
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W - RIM_T * 2 - 0.04, 0.04, D - RIM_T * 2 - 0.04), liningMat);
    floor.position.y = openY - RIM + 0.03;
    suitcase.add(floor);



    /* 束帶：兩半都有，闔起來時對齊成一條完整的帶子 */
    const STRAP_X = [-0.86, 0.86];
    STRAP_X.forEach((x) => {
      const strap = new THREE.Mesh(new RoundedBoxGeometry(0.3, BOTTOM_H - 0.06, D + 0.05, 2, 0.035), strapMat);
      strap.position.set(x, -H / 2 + (BOTTOM_H - 0.06) / 2, 0);
      suitcase.add(strap);
      const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 10, 22), brass);
      buckle.position.set(x, bottom.position.y - 0.05, D / 2 + 0.05);
      suitcase.add(buckle);
    });

    /* 包角：縮到 0.16 並往內縮，坐在圓角的內側 —— 比圓角大的包角會把輪廓整個吃掉 */
    const cornerGeo = new RoundedBoxGeometry(0.16, 0.16, 0.16, 2, 0.03);
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
      const c = new THREE.Mesh(cornerGeo, brass);
      c.position.set(sx * (W / 2 - 0.26), -H / 2 + 0.26, sz * (D / 2 - 0.1));
      suitcase.add(c);
    }));

    /* 腳釘 */
    const studGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.1, 14);
    [[-W / 2 + 0.55, D / 2 - 0.3], [W / 2 - 0.55, D / 2 - 0.3], [-W / 2 + 0.55, -D / 2 + 0.3], [W / 2 - 0.55, -D / 2 + 0.3]].forEach(([x, z]) => {
      const stud = new THREE.Mesh(studGeo, brass);
      stud.position.set(x, -H / 2 - 0.03, z);
      suitcase.add(stud);
    });

    /* ── 上蓋 ── */
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, -H / 2 + BOTTOM_H, -D / 2);
    suitcase.add(lidPivot);

    const lid = new THREE.Mesh(makeShell(W, LID_H - RIM, D, 0.3, false), leather);
    lid.position.set(0, RIM + (LID_H - RIM) / 2, D / 2);
    lidPivot.add(lid);
    addRim(lidPivot, RIM / 2, D / 2);

    /* 蓋內的襯：同樣貼在殼面上、比凹槽小一圈，不與任何面共平面 */
    const lidFloor = new THREE.Mesh(
      new THREE.BoxGeometry(W - RIM_T * 2 - 0.04, 0.04, D - RIM_T * 2 - 0.04),
      liningMat
    );
    lidFloor.position.set(0, RIM + 0.01, D / 2);
    lidPivot.add(lidFloor);

    STRAP_X.forEach((x) => {
      const strap = new THREE.Mesh(new RoundedBoxGeometry(0.3, LID_H - 0.06, D + 0.05, 2, 0.035), strapMat);
      strap.position.set(x, 0.03 + (LID_H - 0.06) / 2, D / 2);
      lidPivot.add(strap);
    });

    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
      const c = new THREE.Mesh(cornerGeo, brass);
      c.position.set(sx * (W / 2 - 0.26), LID_H - 0.26, D / 2 + sz * (D / 2 - 0.1));
      lidPivot.add(c);
    }));

    /* 提把：短而粗，貼著箱體，兩側有黃銅底座 —— 先前那個大圓環像手提包 */
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.062, 12, 32, Math.PI), handleMat);
    handle.position.set(0, LID_H - 0.01, D / 2);
    lidPivot.add(handle);
    [-0.34, 0.34].forEach((x) => {
      const base = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.11, 0.26, 3, 0.03), brass);
      base.position.set(x, LID_H - 0.02, D / 2);
      lidPivot.add(base);
    });

    /* 鎖扣 */
    const lock = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.26, 0.1, 3, 0.035), brass);
    lock.position.set(0, 0.1, D + 0.02);
    lidPivot.add(lock);

    /* ── 地球：一開始縮在箱內 ── */
    const globeGroup = new THREE.Group();
    globeGroup.position.set(0, -H / 2 + BOTTOM_H * 0.5, 0);
    globeGroup.scale.setScalar(0.001);
    stage.add(globeGroup);

    const sphereMat = new THREE.MeshStandardMaterial({ color: 0x1b2447, roughness: 0.95, metalness: 0.05 });
    globeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R, 64, 48), sphereMat));
    new THREE.TextureLoader().load(
      "https://unpkg.com/three-globe/example/img/earth-night.jpg",
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; sphereMat.map = tex; sphereMat.color.set(0xffffff); sphereMat.needsUpdate = true; },
      undefined,
      () => { /* 載不到就維持深藍球 */ }
    );
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 1.05, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.14, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    globeGroup.add(atmosphere);

    const globeSpin = new THREE.Group();
    globeGroup.add(globeSpin);
    const pinGroup = new THREE.Group();
    globeSpin.add(pinGroup);
    // 球體本身不轉（貼圖沒有方向性差異），只轉標記與大氣層的參考框
    const pinCoreMat = new THREE.MeshBasicMaterial({ color: 0xf4f4f5 });
    const pinGlowMat = new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.55 });
    const coreGeo = new THREE.SphereGeometry(0.03, 12, 10);
    const glowGeo = new THREE.SphereGeometry(0.065, 12, 10);

    let targetRotY: number | null = null;
    let hold = false;
    let drawnKey = "";
    const syncPins = () => {
      const list = pinsRef.current;
      const key = list.map((p) => `${p.name}@${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join("|");
      if (key === drawnKey) return;
      drawnKey = key;
      pinGroup.clear();
      list.forEach((p) => {
        const pos = toVector(p.lat, p.lng, GLOBE_R);
        const core = new THREE.Mesh(coreGeo, pinCoreMat);
        core.position.copy(pos);
        pinGroup.add(core);
        const glow = new THREE.Mesh(glowGeo, pinGlowMat);
        glow.position.copy(pos);
        pinGroup.add(glow);
      });
      const last = list[list.length - 1];
      if (last) {
        const v = toVector(last.lat, last.lng, GLOBE_R);
        targetRotY = Math.PI / 2 - Math.atan2(v.z, v.x);
        hold = true;
      } else {
        hold = false;
      }
    };
    syncPins();

    /* ── 第三幕：掛在提把上的行李吊牌 ──
       吊牌是箱子的一部分（掛在提把的銅環上、垂在箱子正面前方），所以第三幕不是換場景，
       是把地球收回箱子、蓋子闔上，然後鏡頭推近到提把那一區。 */
    const tagsGroup = new THREE.Group();
    // 掛在提把的頂端（提把是半徑 0.56 的半圓，頂點約在箱頂 +0.52），牌子才會在把手上而不是垂到箱身
    tagsGroup.position.set(0, H / 2 + 0.52, 0);
    tagsGroup.scale.setScalar(0.001);
    suitcase.add(tagsGroup);

    /*
      牌型照經典行李吊牌：下方長方形牌身、上方收窄的梯形頸，孔開在頸部中央。
      用 Shape + ExtrudeGeometry 才做得出這個輪廓與那個洞。
    */
    const TAG_W = 0.46, BODY_H = 0.84, NECK_H = 0.2, NECK_W = 0.26;
    const tagShape = new THREE.Shape();
    tagShape.moveTo(-TAG_W / 2, -BODY_H / 2);
    tagShape.lineTo(TAG_W / 2, -BODY_H / 2);
    tagShape.lineTo(TAG_W / 2, BODY_H / 2);
    tagShape.lineTo(NECK_W / 2, BODY_H / 2 + NECK_H);
    tagShape.lineTo(-NECK_W / 2, BODY_H / 2 + NECK_H);
    tagShape.lineTo(-TAG_W / 2, BODY_H / 2);
    tagShape.closePath();
    /* 幾何置中後，頸部的孔會落在這個高度 */
    const holeLocalY = BODY_H / 2 + NECK_H * 0.55 - NECK_H / 2;
    const hole = new THREE.Path();
    hole.absarc(0, BODY_H / 2 + NECK_H * 0.55, 0.042, 0, Math.PI * 2, true);
    tagShape.holes.push(hole);
    const tagBodyGeo = new THREE.ExtrudeGeometry(tagShape, {
      depth: 0.04, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 10,
    });
    tagBodyGeo.center();

    const faceGeo = new THREE.PlaneGeometry(0.62, 0.3);   // 轉 90° 後變成直向的字
    const eyeletGeo = new THREE.TorusGeometry(0.05, 0.015, 8, 18);
    const strapGeo = new THREE.TorusGeometry(0.125, 0.022, 10, 22);

    interface Hanger {
      name: string;
      pivot: THREE.Group;
      phase: number;
      /** 0→1 的出場進度：新掛上的牌從畫面外盪進來 */
      age: number;
      targetX: number;
    }
    const hangers: Hanger[] = [];
    let tagKey = "";

    const disposeHanger = (h: Hanger) => {
      h.pivot.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const m = o.material as THREE.Material & { map?: THREE.Texture };
          if (m.map) m.map.dispose();
          m.dispose();
        }
      });
      tagsGroup.remove(h.pivot);
    };

    const makeHanger = (name: string, index: number): Hanger => {
      const pivot = new THREE.Group();
      pivot.userData.isHanger = true;
      tagsGroup.add(pivot);

      const strap = new THREE.Mesh(strapGeo, tagStrapMat);
      strap.rotation.y = Math.PI / 2;
      pivot.add(strap);

      /* 掛歪 30°：外面包一層繞「孔」旋轉的 group，牌子才是吊著歪、不是整個平移過去 */
      const swing = new THREE.Group();
      swing.rotation.z = -Math.PI / 6 + ((index % 3) - 1) * 0.055;
      pivot.add(swing);

      const tag = new THREE.Mesh(tagBodyGeo, tagCard);
      // 孔對齊皮帶環：牌身掛在環的正下方
      tag.position.set(0, -holeLocalY - 0.03, 0.02);
      swing.add(tag);

      const eyelet = new THREE.Mesh(eyeletGeo, tagBrass);
      eyelet.position.set(0, holeLocalY, 0.022);
      tag.add(eyelet);

      const face = new THREE.Mesh(
        faceGeo,
        new THREE.MeshBasicMaterial({ map: makeLabelTexture(name, 48, "#3a2a1c", SONG, 500), transparent: true })
      );
      face.rotation.z = Math.PI / 2;      // 直式牌子：字沿著長邊走
      face.position.set(0, -0.08, 0.045);
      tag.add(face);

      return { name, pivot, phase: index * 0.7, age: 0, targetX: 0 };
    };

    const buildTags = () => {
      const names = peopleRef.current.length ? peopleRef.current.slice(0, 10) : ["Solo"];
      const key = names.join("|");
      if (key === tagKey) return;
      tagKey = key;

      // 不整組重建：舊的留著（才不會全部重新出場），只拆掉被移除的、補上新加的
      for (let i = hangers.length - 1; i >= 0; i--) {
        if (!names.includes(hangers[i].name)) {
          disposeHanger(hangers[i]);
          hangers.splice(i, 1);
        }
      }
      names.forEach((name, i) => {
        if (!hangers.some((h) => h.name === name)) {
          const h = makeHanger(name, i);
          // 新牌從右外側盪進來
          h.pivot.position.set(1.5, 0.36, 0.1);
          hangers.push(h);
        }
      });
      // 位置重算：牌多了就沿提把讓開，舊牌用 lerp 滑過去
      // 人多就讓牌子互相疊著：間距隨人數收斂，總寬度不超過提把（約 1.05）
      const spread = Math.min(0.34, 1.05 / Math.max(1, hangers.length - 1));
      hangers.forEach((h, i) => {
        h.targetX = (i - (hangers.length - 1) / 2) * spread;
        h.phase = i * 0.7;
        h.pivot.position.z = 0.04 + i * 0.028;   // 前後錯開，疊起來才有層次也不會 z-fighting
      });
    };
    buildTags();

    /* ── 貨幣：像存錢筒一樣投進箱子 ── */
    const coinGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.028, 28);
    const coinFaceGeo = new THREE.PlaneGeometry(0.22, 0.22);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xd8b246, roughness: 0.28, metalness: 0.95 });
    const SLOT_Y = H / 2 - 0.1;   // 箱口：硬幣落到這裡就算投進去了

    interface Coin { group: THREE.Group; vy: number; done: number }
    const coins: Coin[] = [];
    let knownCodes: string[] = [];

    const dropCoin = (code: string) => {
      const group = new THREE.Group();
      const coin = new THREE.Mesh(coinGeo, coinMat);
      coin.rotation.x = Math.PI / 2;   // 幣面朝鏡頭
      group.add(coin);
      const face = new THREE.Mesh(
        coinFaceGeo,
        new THREE.MeshBasicMaterial({ map: makeLabelTexture(code, 84, "#5a4212"), transparent: true })
      );
      face.position.z = 0.018;
      group.add(face);
      group.position.set((Math.random() - 0.5) * 0.5, 2.9, D / 2 + 0.18);
      stage.add(group);
      coins.push({ group, vy: 0, done: 0 });
    };

    const syncCoins = () => {
      const codes = currenciesRef.current;
      codes.forEach((c) => { if (!knownCodes.includes(c)) dropCoin(c); });
      knownCodes = [...codes];
    };
    syncCoins();

    let caseBounce = 0;

    /* 地面投影 */
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext("2d");
    if (sctx) {
      const g = sctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(9,9,11,0.85)");
      g.addColorStop(1, "rgba(9,9,11,0)");
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, 128, 128);
    }
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 1.5, D * 3.4),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -H / 2 - 0.34;
    stage.add(shadow);

    /* 兩幕各自的相機距離，轉場時在兩者之間插值 */
    let dist0 = 9.2, dist1 = 9.2, dist2 = 9.2;
    const fitCamera = (w: number, h: number) => {
      const fovRad = (camera.fov * Math.PI) / 180;
      const solve = (objectH: number, targetPx: number, minW: number) => {
        let d = (objectH * (h / targetPx)) / (2 * Math.tan(fovRad / 2));
        const visibleW = 2 * d * Math.tan(fovRad / 2) * (w / h);
        if (visibleW < minW) d *= minW / visibleW;
        return d;
      };
      dist0 = solve(H, Math.min(Math.max(h * 0.38, 104), 300), W * 1.45);
      dist1 = solve(GLOBE_R * 2, Math.min(Math.max(h * 0.46, 118), 330), GLOBE_R * 2.6);
      // 第三幕只看提把與吊牌：約 1.45 單位高，佔面板 58%
      dist2 = solve(1.45, Math.min(Math.max(h * 0.58, 150), 420), 2.2);
    };

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      fitCamera(w, h);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let progress = 0;      // 0 = 箱子闔上，1 = 地球升起
    let frame = 0;
    let elapsed = 0;
    const clock = new THREE.Clock();

    const render = () => {
      frame = requestAnimationFrame(render);
      /*
        只呼叫 getDelta()，時間自己累加。
        three 的 getElapsedTime() 內部就會呼叫 getDelta()，兩個一起用的話後面拿到的 dt 幾乎是 0，
        任何用 dt 累積的東西（吊牌出場、硬幣落下、地球自轉）都會停住。
        順手夾住上限：分頁切回來時 dt 會是一大包，硬幣會直接穿過箱子。
      */
      const dt = Math.min(clock.getDelta(), 0.05);
      elapsed += dt;
      const t = elapsed;
      syncPins();

      buildTags();
      const target = Math.min(2, Math.max(0, stepRef.current));
      progress += (target - progress) * (reduced ? 1 : 0.055);
      const p = easeInOut(clamp01(progress));        // 箱子 → 地球
      const p2 = easeInOut(clamp01(progress - 1));   // 地球 → 吊牌

      /* 蓋子先開，地球後升 —— 兩段錯開才看得出因果 */
      const lidOpen = easeInOut(clamp01(progress / 0.65)) * (1 - easeInOut(clamp01((p2 - 0.25) / 0.5)));
      lidPivot.rotation.x = -1.92 * lidOpen;
      /* 第三幕的三拍：地球先沉回箱內（0–45%）→ 蓋子闔上（25–75%）→ 吊牌現身、鏡頭推近（55%–） */
      const packed = easeInOut(clamp01(p2 / 0.45));            // 地球收回去的程度
      const rise = easeInOut(clamp01((progress - 0.22) / 0.78)) * (1 - packed);
      globeGroup.scale.setScalar(Math.max(0.001, rise));
      globeGroup.position.y = THREE.MathUtils.lerp(-H / 2 + BOTTOM_H * 0.5, 0.55, rise);

      const tagIn = easeInOut(clamp01((p2 - 0.42) / 0.58));
      tagsGroup.scale.setScalar(Math.max(0.001, tagIn));

      suitcase.position.y = THREE.MathUtils.lerp(0, -1.15, p) * (1 - p2);
      shadow.position.y = THREE.MathUtils.lerp(-H / 2 - 0.34, -H / 2 - 1.45, p);
      shadow.scale.setScalar(THREE.MathUtils.lerp(1, 0.8, p));
      shadow.material.opacity = 1 - p2;
      // 箱體淡出，畫面只剩提把與吊牌；提把用自己的材質所以留著
      const caseAlpha = 1 - p2 * 0.7;
      fading.forEach((m) => { m.opacity = caseAlpha; });

      // 鏡頭推近提把：整個舞台上移，讓吊牌落在畫面中央
      stage.position.z = THREE.MathUtils.lerp(0, 0.35, p2);
      camera.position.z = THREE.MathUtils.lerp(THREE.MathUtils.lerp(dist0, dist1, p), dist2, p2);
      camera.position.y = THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.35, 0.1, p), 1.5, p2);

      /* 地球：選了目的地就轉過去並停住，沒選才慢慢自轉 */
      if (targetRotY !== null) {
        const diff = ((targetRotY - globeSpin.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
        globeSpin.rotation.y += diff * 0.055;
        if (Math.abs(diff) < 0.004) { globeSpin.rotation.y = targetRotY; targetRotY = null; }
      } else if (!hold && !reduced) {
        globeSpin.rotation.y += dt * 0.12;
      }

      /* 指標視差：整個舞台一起轉，箱子與地球才是同一個空間裡的東西 */
      /* 硬幣自由落體，掉到箱口就縮掉，順手讓箱子彈一下 */
      syncCoins();
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        if (c.done === 0) {
          c.vy -= 9.5 * dt;
          c.group.position.y += c.vy * dt;
          c.group.rotation.z += dt * 2.2;
          if (c.group.position.y <= SLOT_Y) { c.done = 0.0001; caseBounce = 1; }
        } else {
          c.done = Math.min(1, c.done + dt / 0.22);
          c.group.scale.setScalar(Math.max(0.001, 1 - c.done));
          c.group.position.y -= dt * 0.6;
          if (c.done >= 1) {
            c.group.traverse((o) => {
              if (o instanceof THREE.Mesh) {
                const m = o.material as THREE.Material & { map?: THREE.Texture };
                if (m.map) m.map.dispose();
              }
            });
            stage.remove(c.group);
            coins.splice(i, 1);
          }
        }
      }
      caseBounce = Math.max(0, caseBounce - dt * 3.2);
      suitcase.position.y += Math.sin(caseBounce * Math.PI) * -0.05;

      /*
        吊牌的位置更新不放在 reduced 區塊裡：那是版面，不是效果。
        開了「減少動態效果」時只是少了盪進來的過程，牌子仍然要待在該待的位置。
      */
      hangers.forEach((h) => {
        h.age = Math.min(1, h.age + (reduced ? 1 : dt / 0.6));
        const e = 1 - Math.pow(1 - h.age, 3);
        const tx = h.targetX + (1 - e) * 1.3;
        const ty = (1 - e) * 0.32;
        const k = reduced ? 1 : 0.18;
        h.pivot.position.x += (tx - h.pivot.position.x) * k;
        h.pivot.position.y += (ty - h.pivot.position.y) * k;
        const sway = reduced ? 0 : Math.sin(t * 1.4 + h.phase) * 0.05 * p2;
        h.pivot.rotation.z = sway + (1 - e) * 0.4;
      });

      const pt = pointerRef?.current ?? { x: 0, y: 0 };
      const targetY = (1 - p) * -0.42 + pt.x * 0.9;
      const targetX = 0.13 + pt.y * 0.5;
      stage.rotation.y += (targetY - stage.rotation.y) * 0.06;
      stage.rotation.x += (targetX - stage.rotation.x) * 0.06;

      if (!reduced) {
        stage.position.y = Math.sin(t * 1.1) * 0.1 * (1 - p * 0.5) * (1 - p2);
        // 吊牌各自擺盪，相位錯開才像一串牌被風吹到
      }

      /* 打了名字：箱子晃一下（只在第一幕） */
      if (nudgeRef.current > 0.001 && p < 0.2) {
        suitcase.rotation.z = Math.sin(t * 26) * 0.09 * nudgeRef.current;
        nudgeRef.current *= 0.93;
      } else {
        suitcase.rotation.z += (0 - suitcase.rotation.z) * 0.1;
      }

      renderer.render(scene, camera);
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material;
          (Array.isArray(m) ? m : [m]).forEach((mat) => mat.dispose());
        }
      });
      mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden />;
}
