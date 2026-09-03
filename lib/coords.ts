/**
 * Coordinate parsing for waypoint elevation lookup.
 *
 * Separate from lib/geocode.ts on purpose: that one resolves *place names* (Nominatim, with
 * caching) for the globe. This one only accepts explicit coordinates — see resolveCoords.
 */

export type Coords = [number, number];

export function extractFromGoogleUrl(url: string): Coords | null {
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return [parseFloat(atMatch[1]), parseFloat(atMatch[2])];

  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return [parseFloat(qMatch[1]), parseFloat(qMatch[2])];

  const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) return [parseFloat(llMatch[1]), parseFloat(llMatch[2])];

  const dataMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dataMatch) return [parseFloat(dataMatch[1]), parseFloat(dataMatch[2])];

  return null;
}

export function isGoogleMapsUrl(q: string): boolean {
  return /^https?:\/\/(maps\.google\.|www\.google\.com\/maps|goo\.gl\/maps|maps\.app\.goo\.gl)/.test(q);
}

/** Short links carry no coordinates until they are followed. */
export async function resolveGoogleUrl(q: string): Promise<Coords | null> {
  const direct = extractFromGoogleUrl(q);
  if (direct) return direct;

  if (/goo\.gl|maps\.app\.goo\.gl/.test(q)) {
    try {
      const res = await fetch(q, {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": "travel-tracker-app/1.0" },
      });
      if (res.url && res.url !== q) return extractFromGoogleUrl(res.url);
    } catch {
      return null;
    }
  }

  return null;
}

/** "-42.5123, 171.5432" / "-42.5123 171.5432" — rejects anything outside real lat/lng range. */
export function parseCoordPair(q: string): Coords | null {
  const m = q.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

/** Coordinates only — no place-name lookup. A guessed elevation is worse than a blank one. */
export async function resolveCoords(q: string): Promise<Coords | null> {
  const trimmed = q.trim();
  if (!trimmed) return null;
  const direct = parseCoordPair(trimmed);
  if (direct) return direct;
  if (isGoogleMapsUrl(trimmed)) return resolveGoogleUrl(trimmed);
  return null;
}
