/**
 * 點位類型。溪降那組對應紐西蘭 CanyonTopo 的圖例（R 垂降編號、J 跳水、S 滑降、SW 泳渡、
 * UC/DC 上下攀、dangerous hydraulic / undercut / sieve 等危險標記、Exits、flow gauge）。
 * 分組是因為攤平會有二十幾個選項，難找。
 *
 * 刻意不收進來的：TR/TL（左右岸）、SL（安全繩）、CW（溪行）—— 那些是路段的屬性或移動方式，
 * 不是一個點位，寫在該點的備註裡（編輯器有常用註記快捷鍵）。
 *
 * 放在 lib 是因為三個地方都要這份詞彙：編輯器的下拉選單、寫入時的白名單、匯出時的中文欄位。
 */
export const WAYPOINT_TYPE_GROUPS = [
  {
    label: "通用",
    options: [
      { value: "junction", label: "岔路" },
      { value: "hut", label: "山屋" },
      { value: "camp", label: "營地" },
      { value: "water", label: "水源" },
      { value: "other", label: "其他" },
    ],
  },
  {
    label: "登山",
    options: [
      { value: "trailhead", label: "登山口" },
      { value: "peak", label: "山頂" },
      { value: "pass", label: "鞍部" },
    ],
  },
  {
    label: "溪降",
    options: [
      { value: "put_in", label: "入溪點" },
      { value: "take_out", label: "出溪點" },
      { value: "rappel", label: "垂降點" },
      { value: "anchor", label: "固定點" },
      { value: "pool", label: "深潭" },
      { value: "jump", label: "跳水點" },
      { value: "slide", label: "滑降點" },
      { value: "swim", label: "泳渡段" },
      { value: "downclimb", label: "下攀" },
      { value: "upclimb", label: "上攀" },
      { value: "hazard", label: "危險點" },
      { value: "exit", label: "脫逃點" },
      { value: "gauge", label: "水位計" },
    ],
  },
];

export const WAYPOINT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  WAYPOINT_TYPE_GROUPS.flatMap((g) => g.options).map((t) => [t.value, t.label])
);

/** 寫入時的白名單：認不出來的值一律清成 null */
export const WAYPOINT_TYPES = Object.keys(WAYPOINT_TYPE_LABEL);
