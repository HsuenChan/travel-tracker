/** Shared normalisation for gear rows: the API, the closet and the CSV import all agree on it. */

export const GEAR_ROLES = ["base", "worn", "consumable"] as const;
export type GearRole = (typeof GEAR_ROLES)[number];

export const GEAR_SCOPES = ["personal", "group"] as const;
export type GearScope = (typeof GEAR_SCOPES)[number];

/** 只信任白名單。scope 決定 RLS 走哪條 policy，寫壞就會讓裝備對所有人隱形。 */
export function normalizeScope(scope: unknown): GearScope {
  return GEAR_SCOPES.includes(scope as GearScope) ? (scope as GearScope) : "personal";
}

/** Only trust the whitelist — an unknown role would corrupt the base-weight formula. */
export function normalizeRole(role: unknown): GearRole {
  return GEAR_ROLES.includes(role as GearRole) ? (role as GearRole) : "base";
}

/** Weight may be left blank (not weighed yet), but never negative or NaN. */
export function normalizeWeight(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function normalizeQty(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

const UNIT_TO_GRAM: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.349523125,
  ounce: 28.349523125,
  ounces: 28.349523125,
  lb: 453.59237,
  lbs: 453.59237,
  pound: 453.59237,
  pounds: 453.59237,
};

/** LighterPack stores a unit per row (oz is its default), so weights arrive mixed. */
export function toGrams(value: unknown, unit: unknown): number | null {
  const n = normalizeWeight(value);
  if (n === null) return null;
  const factor = UNIT_TO_GRAM[String(unit ?? "g").trim().toLowerCase()] ?? 1;
  return Math.round(n * factor * 100) / 100;
}

/**
 * Minimal RFC-4180 CSV reader: LighterPack quotes any description containing a comma,
 * and escapes a literal quote by doubling it.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      // Skip blank lines rather than emitting a one-empty-field row
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

export interface ParsedGearRow {
  name: string;
  notes: string | null;
  category: string | null;
  weight_g: number | null;
  qty: number;
  weight_role: GearRole;
}

/** LighterPack's flags are "1"/"" in an export but "true" when hand-edited. */
function isTruthyFlag(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v !== "" && v !== "0" && v !== "false" && v !== "no";
}

/**
 * Map a LighterPack CSV export to gear rows.
 * Columns are matched by header name, not position — the export's column order has changed
 * before, and a shifted column would silently swap weight and quantity.
 */
export function parseLighterPackCsv(text: string): { rows: ParsedGearRow[]; skipped: number } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], skipped: 0 };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const idx = {
    name: col("item name", "name", "item"),
    category: col("category", "categories"),
    desc: col("desc", "description"),
    qty: col("qty", "quantity"),
    weight: col("weight"),
    unit: col("unit", "units"),
    role: col("type"),
    worn: col("worn"),
    consumable: col("consumable", "consumables"),
  };
  if (idx.name < 0) return { rows: [], skipped: 0 };

  const at = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  const rows: ParsedGearRow[] = [];
  let skipped = 0;
  for (const r of table.slice(1)) {
    const name = at(r, idx.name);
    if (!name) { skipped++; continue; }
    const category = at(r, idx.category);
    const desc = at(r, idx.desc);
    const role: GearRole = isTruthyFlag(at(r, idx.consumable))
      ? "consumable"
      : isTruthyFlag(at(r, idx.worn))
        ? "worn"
        : "base";
    rows.push({
      name,
      notes: desc || null,
      category: category || null,
      weight_g: toGrams(at(r, idx.weight), at(r, idx.unit) || "oz"),
      qty: normalizeQty(at(r, idx.qty) || 1),
      weight_role: role,
    });
  }
  return { rows, skipped };
}

/** Accepts a full share link, a /csv/ link, or a bare list id. */
export function lighterPackListId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/lighterpack\.com\/(?:r|csv|e)\/([A-Za-z0-9_-]+)/i);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{4,32}$/.test(s)) return s;
  return null;
}
