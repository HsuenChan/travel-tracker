"use client";

/**
 * 路線檔案的各個分頁。
 *
 * 版面結構參考 demos/tw-canyoning-tabs，但配色沿用本專案（近黑底、翠綠強調），
 * 不把 demo 的深藍水藍搬過來 —— 這個彈窗是行程頁的一部分，換一套色會像是誤入別的網站。
 *
 * 這裡只負責「畫 route_profile」。高度圖與途經點留在 RouteProfileModal，
 * 因為那一頁要用到彈窗自己的圖表狀態與編輯模式。
 */

import { Image, Tooltip } from "antd";
import {
  InfoIcon, ClockIcon, MapIcon, TopoProfileIcon, PhotoIcon, AlertTriangleIcon,
  LocationIcon, MountainIcon, CarabinerIcon, CalendarIcon, LinkBrokenIcon, ArrowRightIcon,
} from "@/app/components/Icons";
import RouteTopoProfile, { type TopoWaypoint } from "@/app/components/RouteTopoProfile";
import {
  type Bilingual, type RouteProfile, type RouteGrading,
  pickText, secondaryText, hasText, routePhotos, renderableTopoPages, splitHazards,
} from "@/lib/routeProfile";

/* ------------------------------------------------------------------ 共用零件 */

/** demo 的 .sec-h：小標題配一條延伸到底的細線 */
export function SectionHeading({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[12px] font-medium text-zinc-300 mt-1 mb-2.5">
      {icon && <span className="text-emerald-400/90 flex shrink-0">{icon}</span>}
      <span className="shrink-0">{children}</span>
      <span className="flex-1 h-px bg-white/[0.07]" />
    </div>
  );
}

/** demo 的 .note：一段補充說明，不搶正文的視覺重量 */
export function Note({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  const styles = tone === "warn"
    ? "border-amber-500/25 bg-amber-500/[0.06] text-amber-200/90"
    : "border-white/[0.08] bg-white/[0.03] text-zinc-400";
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12px] leading-relaxed ${styles}`}>
      <span className="shrink-0 mt-0.5 opacity-80"><InfoIcon size={12} /></span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** 出處那一行。路線資料是別人整理的，畫面上要一直看得到來源 */
function Source({ children }: { children: React.ReactNode }) {
  return <p className="text-zinc-600 text-[11px] leading-relaxed m-0">{children}</p>;
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-emerald-300/90 hover:text-emerald-200 transition-colors break-all"
    >
      {children}
      <LinkBrokenIcon size={11} />
    </a>
  );
}

/**
 * demo 的 .rows：左欄標籤、右欄內容。
 * 手機寬度下標籤欄會壓到剩兩三個字一行，所以窄螢幕改成上下堆疊。
 */
function DataRows({ children }: { children: React.ReactNode }) {
  return <dl className="flex flex-col m-0">{children}</dl>;
}

function DataRow({
  label, icon, children, mono = false,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[84px_1fr] gap-1 sm:gap-3 py-2.5 border-b border-white/[0.05] last:border-b-0">
      <dt className="flex items-center gap-1.5 text-zinc-500 text-[12px]">
        {icon && <span className="text-emerald-400/70 flex shrink-0">{icon}</span>}
        {label}
      </dt>
      <dd className={`m-0 text-zinc-200 text-[13px] leading-relaxed min-w-0 break-words ${mono ? "tabular-nums" : ""}`}>
        {children}
      </dd>
    </div>
  );
}

/** 中文為主、英文為輔的一格；只有英文時就直接當主字顯示 */
function BilingualCell({ value }: { value: Bilingual }) {
  const main = pickText(value);
  const sub = secondaryText(value);
  if (!main) return null;
  return (
    <>
      <span>{main}</span>
      {sub && <span className="block text-zinc-500 text-[12px]">{sub}</span>}
    </>
  );
}

/* ------------------------------------------------------------------ 分級 */

const GRADE_CHIP = {
  v: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  a: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  c: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

const GRADE_HINT = "v 垂直技術 · a 水流難度 · 羅馬數字為投入度（脫離洪水與撤退所需時間）· 星等為推薦度";

/** demo 的 .p-grade：代號 + 三個色塊 + 星等 */
export function GradeChips({ grading }: { grading: RouteGrading }) {
  return (
    <Tooltip title={GRADE_HINT} placement="bottom" trigger={["hover", "click"]} styles={{ root: { maxWidth: 280 } }}>
      <span className="inline-flex items-center gap-1.5 flex-wrap cursor-help">
        {grading.v && <span className={`px-1.5 py-0.5 rounded-md border text-[11px] font-semibold tabular-nums ${GRADE_CHIP.v}`}>{grading.v}</span>}
        {grading.a && <span className={`px-1.5 py-0.5 rounded-md border text-[11px] font-semibold tabular-nums ${GRADE_CHIP.a}`}>{grading.a}</span>}
        {grading.commitment && <span className={`px-1.5 py-0.5 rounded-md border text-[11px] font-semibold ${GRADE_CHIP.c}`}>{grading.commitment}</span>}
        {grading.stars > 0 && (
          <span className="text-amber-400/90 text-[11px] tracking-tight" aria-label={`${grading.stars} 星`}>
            {"★".repeat(grading.stars)}
          </span>
        )}
        {/* 三個部分都解析不出來時至少把原字串顯示出來，不要整排消失 */}
        {!grading.v && !grading.a && !grading.commitment && grading.stars === 0 && (
          <span className="text-zinc-300 text-[12px]">{grading.raw}</span>
        )}
      </span>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ 快速資訊 */

export function QuickInfoPane({ profile }: { profile: RouteProfile }) {
  const d = profile.details;
  return (
    <div className="flex flex-col gap-3">
      <SectionHeading icon={<InfoIcon size={12} />}>快速資訊</SectionHeading>
      <DataRows>
        {hasText(profile.location) && (
          <DataRow label="地點" icon={<LocationIcon size={12} />}>
            <BilingualCell value={profile.location} />
          </DataRow>
        )}
        {hasText(profile.character) && (
          <DataRow label="性質" icon={<MountainIcon size={12} />}>
            <BilingualCell value={profile.character} />
          </DataRow>
        )}
        {hasText(d.rock) && <DataRow label="岩質"><BilingualCell value={d.rock} /></DataRow>}
        {hasText(d.catchment) && <DataRow label="集水區" mono><BilingualCell value={d.catchment} /></DataRow>}
        {hasText(d.anchors) && (
          <DataRow label="錨點" icon={<CarabinerIcon size={12} />}><BilingualCell value={d.anchors} /></DataRow>
        )}
        {hasText(profile.gear) && (
          <DataRow label="裝備" icon={<CarabinerIcon size={12} />}><BilingualCell value={profile.gear} /></DataRow>
        )}
        {hasText(d.water) && <DataRow label="水量"><BilingualCell value={d.water} /></DataRow>}
        {hasText(d.flood) && <DataRow label="洪水風險"><BilingualCell value={d.flood} /></DataRow>}
        {profile.times.max_drop && <DataRow label="最大落差" mono>{profile.times.max_drop}</DataRow>}
        {profile.elevation_m != null && <DataRow label="海拔" mono>{profile.elevation_m} m</DataRow>}
        {profile.gps && (
          <DataRow label="GPS" icon={<LocationIcon size={12} />} mono>
            <span className="text-[12px]">{profile.gps}</span>
          </DataRow>
        )}
        {profile.first_descent && (
          <DataRow label="首降" icon={<CalendarIcon size={12} />}>{profile.first_descent}</DataRow>
        )}
      </DataRows>
      {profile.source_url && (
        <Source>
          資料來源：KiwiCanyons · <ExternalLink href={profile.source_url}>路線頁</ExternalLink>
        </Source>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ 時間規劃 */

function TimeCard({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  const styles = total
    ? "border-emerald-500/25 bg-emerald-500/[0.08]"
    : "border-white/[0.07] bg-white/[0.03]";
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${styles}`}>
      <span className={total ? "text-emerald-300" : "text-emerald-400/70"}><ClockIcon size={14} /></span>
      <span className={`text-[12.5px] ${total ? "text-emerald-200 font-medium" : "text-zinc-400"}`}>{label}</span>
      <span className={`ml-auto tabular-nums text-right ${total ? "text-emerald-200 text-[15px] font-semibold" : "text-zinc-100 text-[13px]"}`}>
        {value}
      </span>
    </div>
  );
}

export function TimesPane({ profile }: { profile: RouteProfile }) {
  const t = profile.times;
  const cards = [
    { label: "進場", value: t.approach },
    { label: "下降", value: t.descent },
    { label: "回程", value: t.back },
  ].filter((c): c is { label: string; value: string } => Boolean(c.value));
  const sections = profile.route_sections.filter((s) => s.time);

  return (
    <div className="flex flex-col gap-3">
      <SectionHeading icon={<ClockIcon size={12} />}>時間規劃</SectionHeading>
      {(cards.length > 0 || t.total) && (
        <div className="flex flex-col gap-2">
          {cards.map((c) => <TimeCard key={c.label} label={c.label} value={c.value} />)}
          {t.total && <TimeCard label="總時" value={t.total} total />}
        </div>
      )}

      {sections.length > 0 && (
        <>
          <SectionHeading icon={<ArrowRightIcon size={12} />}>分段時間</SectionHeading>
          <div className="flex flex-col gap-2">
            {sections.map((s, i) => (
              <div key={i} className="flex items-baseline gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                <span className="text-zinc-200 text-[13px] font-medium shrink-0">{s.zh ?? s.name}</span>
                {s.zh && s.name && <span className="text-zinc-600 text-[11px] shrink-0">{s.name}</span>}
                <span className="ml-auto text-zinc-100 text-[12.5px] tabular-nums shrink-0">{s.time}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {t.ab_shuttle && <Note>接駁：{t.ab_shuttle}</Note>}
      {/*
        來源給的是區間字串（「4–7 hrs」），不是可相加的數字 —— 刻意不自己算總和，
        免得畫面上出現一個看起來精確、實際上是硬湊的數字。
      */}
      <Source>時間為來源記錄的參考值，實際會因水量、隊伍人數與勘查次數而變。</Source>
    </div>
  );
}

/* ------------------------------------------------------------------ 進場路線 */

export function ApproachPane({ profile }: { profile: RouteProfile }) {
  const freeform = pickText(profile.approach);
  return (
    <div className="flex flex-col gap-3">
      <SectionHeading icon={<MapIcon size={12} />}>進場路線</SectionHeading>
      {profile.approach_steps.length > 0 && (
        <ol className="flex flex-col gap-2 m-0 p-0 list-none">
          {profile.approach_steps.map((s, i) => (
            <li key={i} className="flex gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
              <span className="w-5 h-5 shrink-0 rounded-full bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 text-[11px] flex items-center justify-center tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="m-0 text-zinc-200 text-[13px] leading-relaxed break-words">{s.zh ?? s.en}</p>
                {s.zh && s.en && <p className="m-0 mt-0.5 text-zinc-500 text-[12px] leading-relaxed break-words">{s.en}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {freeform && <p className="m-0 text-zinc-300 text-[13px] leading-relaxed break-words">{freeform}</p>}
      {(profile.details.map_sheet || profile.gps) && (
        <DataRows>
          {profile.details.map_sheet && (
            <DataRow label="地圖幅" icon={<MapIcon size={12} />}>{profile.details.map_sheet}</DataRow>
          )}
          {profile.gps && (
            <DataRow label="GPS" icon={<LocationIcon size={12} />} mono>
              <span className="text-[12px]">{profile.gps}</span>
            </DataRow>
          )}
        </DataRows>
      )}
      <Note>進場的 GPS 與標記為近似值，林下地形會降低記錄精度；實際請以現場路條與地形判斷為準。</Note>
    </div>
  );
}

/* ------------------------------------------------------------------ 原始路線圖 */

/** CanyonTopo 圖例。這些代號在途經點名稱裡也會出現，放這裡當對照表 */
const TOPO_LEGEND = [
  ["R", "垂降"], ["J", "跳水"], ["S", "滑降"], ["DC", "下攀"],
  ["UC", "上攀"], ["HL", "繩橋"], ["TR", "右岸"], ["TL", "左岸"],
];

export function TopoPane({ profile, waypoints }: { profile: RouteProfile | null; waypoints: TopoWaypoint[] }) {
  const pages = renderableTopoPages(profile);
  // 有頁次但沒有圖：來源只給了相對路徑，檔案不在任何拿得到的地方
  const missing = (profile?.topo_pages.length ?? 0) - pages.length;
  const hasProfileDrawing = waypoints.some((w) => Number(w.drop_m ?? 0) > 0);

  return (
    <div className="flex flex-col gap-3">
      <SectionHeading icon={<TopoProfileIcon size={12} />}>路線圖</SectionHeading>

      {hasProfileDrawing ? (
        <RouteTopoProfile waypoints={waypoints} />
      ) : (
        <Note>
          這條路線還沒有建立障礙序列，所以畫不出縱剖面。
          {profile?.topo_url ? "先看下面的官方 topo PDF；" : ""}
          在「高度圖與途經點」分頁把垂降、跳水、滑降等點位與落差填進去，這張圖就會自動出現。
        </Note>
      )}

      <SectionHeading icon={<InfoIcon size={12} />}>圖例</SectionHeading>
      <div className="flex flex-wrap gap-1.5">
        {TOPO_LEGEND.map(([code, label]) => (
          <span key={code} className="inline-flex items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[11px]">
            <b className="text-emerald-300 font-semibold">{code}</b>
            <span className="text-zinc-500">{label}</span>
          </span>
        ))}
      </div>

      {pages.length > 0 && (
        <Image.PreviewGroup>
          <div className="flex flex-col gap-2">
            {pages.map((p, i) => (
              <figure key={i} className="m-0">
                <Image
                  src={p.asset as string}
                  alt={p.zh ?? p.en ?? `topo ${p.page ?? i + 1}`}
                  className="rounded-xl border border-white/[0.07]"
                  preview={{ mask: null }}
                />
                <figcaption className="mt-1 text-zinc-500 text-[11px]">
                  {p.page != null && <span className="tabular-nums">p.{p.page} </span>}
                  {p.zh ?? p.en}
                </figcaption>
              </figure>
            ))}
          </div>
        </Image.PreviewGroup>
      )}

      {profile?.topo_url && (
        <ExternalLink href={profile.topo_url}>官方 topo PDF</ExternalLink>
      )}

      {missing > 0 && (
        <Note>
          來源另外標了 {missing} 頁路線圖，但沒有提供可取得的圖檔
          {profile?.topo_url ? "，請看上面的官方 PDF" : ""}。
        </Note>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ 代表照片 */

export function PhotosPane({ profile }: { profile: RouteProfile }) {
  const photos = routePhotos(profile);
  return (
    <div className="flex flex-col gap-3">
      <SectionHeading icon={<PhotoIcon size={12} />}>代表照片 {photos.length}</SectionHeading>
      <Image.PreviewGroup>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((src) => (
            <div key={src} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-white/[0.07] bg-white/[0.03]">
              <Image
                src={src}
                alt=""
                rootClassName="!absolute !inset-0 !block"
                className="!w-full !h-full object-cover"
                preview={{ mask: null }}
              />
            </div>
          ))}
        </div>
      </Image.PreviewGroup>
      {profile.videos.length > 0 && (
        <>
          <SectionHeading icon={<PhotoIcon size={12} />}>影片</SectionHeading>
          <div className="flex flex-col gap-1.5">
            {profile.videos.map((v) => (
              <ExternalLink key={v.url} href={v.url}>{v.title ?? v.provider ?? v.url}</ExternalLink>
            ))}
          </div>
        </>
      )}
      <Source>照片版權屬原拍攝者，來源 KiwiCanyons。</Source>
    </div>
  );
}

/* ------------------------------------------------------------------ 風險注意 */

export function HazardsPane({ profile }: { profile: RouteProfile }) {
  const items = splitHazards(pickText(profile.hazards));
  const flood = pickText(profile.details.flood);
  /*
    來源寫成「等級；補充說明」（如「高；R3 後為無法撤退的窄峽」）。等級靠右當一眼可讀的結論，
    補充說明另起一行 —— 有些路線只寫了一整句描述而沒有等級，硬塞進右邊那一格會擠成一條爛版。
  */
  const [floodHead, ...floodRest] = (flood ?? "").split(/[；;]/);
  const floodIsLevel = floodHead.trim().length > 0 && floodHead.trim().length <= 6;
  const floodLevel = floodIsLevel ? floodHead.trim() : null;
  const floodNote = (floodIsLevel ? floodRest.join("；") : (flood ?? "")).trim() || null;

  return (
    <div className="flex flex-col gap-3">
      <SectionHeading icon={<AlertTriangleIcon size={12} />}>風險與注意事項</SectionHeading>

      {flood && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.07] px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-red-400 shrink-0"><AlertTriangleIcon size={14} /></span>
            <span className="text-red-200/90 text-[12.5px]">暴洪風險</span>
            {floodLevel && <span className="ml-auto text-red-100 text-[13px] font-medium">{floodLevel}</span>}
          </div>
          {floodNote && (
            <p className="m-0 mt-1.5 text-red-200/80 text-[12px] leading-relaxed break-words">{floodNote}</p>
          )}
        </div>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
              <span className="text-red-400/70 shrink-0 mt-0.5"><AlertTriangleIcon size={11} /></span>
              <span className="text-zinc-300 text-[12.5px] leading-relaxed min-w-0 break-words">{t}</span>
            </li>
          ))}
        </ul>
      )}

      {/* 隊伍回報常常比官方 topo 新，錨點鬆脫這種事只會出現在這裡 */}
      {profile.recent_updates.length > 0 && (
        <>
          <SectionHeading icon={<CalendarIcon size={12} />}>近期回報</SectionHeading>
          <div className="flex flex-col gap-2">
            {profile.recent_updates.map((u, i) => (
              <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
                <div className="flex items-baseline gap-2 text-[11px] text-zinc-500 mb-1">
                  {u.date && <span className="tabular-nums">{u.date}</span>}
                  {u.author && <span>{u.author}</span>}
                </div>
                <p className="m-0 text-zinc-200 text-[12.5px] leading-relaxed break-words">{u.zh ?? u.en}</p>
                {u.zh && u.en && <p className="m-0 mt-1 text-zinc-500 text-[12px] leading-relaxed break-words">{u.en}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {profile.note && (
        <Note tone="warn">{profile.note}</Note>
      )}
    </div>
  );
}
