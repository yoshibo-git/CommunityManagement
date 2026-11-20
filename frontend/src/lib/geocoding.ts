export type GeocodedPlace = { lat: number; lng: number; label: string };
const endpoint = process.env.NEXT_PUBLIC_GEOCODER_URL?.trim() || 'https://photon.komoot.io/api/';
const cache = new Map<string, { at: number; places: GeocodedPlace[] }>();
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function searchPlaces(query: string, signal: AbortSignal): Promise<GeocodedPlace[]> {
  const text = query.trim().normalize('NFC');
  if (text.length < 3 || text.length > 200) return [];
  const key = text.toLocaleLowerCase('vi');
  const saved = cache.get(key);
  if (saved && Date.now() - saved.at < 300000) return saved.places;
  const url = new URL(endpoint);
  if (url.protocol !== 'https:') throw new Error('Invalid geocoder configuration.');
  url.searchParams.set('q', text); url.searchParams.set('limit', '5');
  url.searchParams.set('lat', '16.06'); url.searchParams.set('lon', '108.22');
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin' });
  if (!response.ok) throw new Error('Geocoder unavailable.');
  const data = record(await response.json());
  if (!Array.isArray(data.features)) throw new Error('Invalid geocoder response.');
  const places: GeocodedPlace[] = [];
  for (const feature of data.features.slice(0, 5)) {
    const item = record(feature), geometry = record(item.geometry), properties = record(item.properties);
    if (geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) continue;
    const [lng, lat] = geometry.coordinates;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const textOf = (key: string) => typeof properties[key] === 'string' ? properties[key].trim().slice(0, 300) : '';
    const street = [textOf('housenumber'), textOf('street')].filter(Boolean).join(' ');
    const label = [...new Set([textOf('name'), street, textOf('district'), textOf('city'), textOf('state'), textOf('country')].filter(Boolean))].join(', ');
    if (label && !places.some((place) => place.lat === lat && place.lng === lng && place.label === label)) places.push({ lat, lng, label });
  }
  if (!signal.aborted) {
    if (cache.size >= 50) cache.clear();
    cache.set(key, { at: Date.now(), places });
  }
  return places;
}
