'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker, Control, LeafletMouseEvent } from 'leaflet';
import { Icon } from './icon';
import { searchPlaces, type GeocodedPlace } from '@/lib/geocoding';

type Point = { lat: number; lng: number };
type Props = { latitude: number | null; longitude: number | null; disabled: boolean; searchQuery: string; onSelect: (label: string) => void; onChange: (point: Point | null) => void };
const tileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim() || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const attribution = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION?.trim() || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const validPoint = (lat: unknown, lng: unknown): boolean => typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export function LocationPicker(props: Props) {
  const [open, setOpen] = useState(false);
  const selected = validPoint(props.latitude, props.longitude);
  const query = props.searchQuery.trim();
  const [lookup, setLookup] = useState<{ query: string; places: GeocodedPlace[]; selected?: GeocodedPlace; error?: string }>({ query: '', places: [] });
  useEffect(() => {
    if (props.disabled || query.length < 3 || query.length > 200) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void searchPlaces(query, controller.signal).then((places) => {
        if (!controller.signal.aborted) setLookup({ query, places, selected: places[0] });
      }).catch(() => { if (!controller.signal.aborted) setLookup({ query, places: [], error: 'Không thể tìm địa điểm. Bạn có thể chọn trực tiếp trên bản đồ.' }); });
    }, 1000);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, props.disabled]);
  const searching = !props.disabled && query.length >= 3 && query.length <= 200;
  const result = lookup.query === query ? lookup : undefined;
  return <section className="field full-width location-picker" aria-label="Chọn vị trí">
    <span className="field-label">Chọn vị trí</span>
    {searching && !result && <p role="status">Đang tìm địa điểm…</p>}
    {query.length > 200 && <p role="alert">Địa chỉ tìm kiếm tối đa 200 ký tự. Bạn có thể chọn trực tiếp trên bản đồ.</p>}
    {searching && result?.error && <p role="alert">{result.error}</p>}
    {searching && result && !result.error && !result.places.length && <p role="status">Không tìm thấy địa điểm. Thêm quận, tỉnh/thành hoặc chọn trực tiếp trên bản đồ.</p>}
    {searching && !!result?.places.length && <><p className="field-hint">Địa điểm gợi ý: {result.selected?.label}. Nhấn Ghim vị trí để xác nhận tọa độ.</p><ul className="location-results" aria-label="Địa điểm tìm thấy">{result.places.map((place) => <li key={`${place.lat}:${place.lng}:${place.label}`}><button type="button" aria-pressed={result.selected === place} onClick={() => { setLookup({ ...result, selected: place }); props.onSelect(place.label); }}>{place.label}</button></li>)}</ul></>}
    {searching && <p className="field-hint">Tìm địa điểm: <a href="https://photon.komoot.io/" target="_blank" rel="noreferrer">Photon</a> · OpenStreetMap</p>}
    {!open && !selected && !searching && <button type="button" className="button button-outline" disabled={props.disabled} onClick={() => setOpen(true)}><Icon name="location" />Chọn vị trí trên bản đồ</button>}
    {(open || selected || searching) && <MapCanvas {...props} target={searching ? result?.selected : undefined} />}
  </section>;
}

function MapCanvas({ latitude, longitude, disabled, onChange, target }: Props & { target?: GeocodedPlace }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const zoom = useRef<Control.Zoom | null>(null);
  const initial = useRef({ latitude, longitude });
  const locked = useRef(disabled);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    locked.current = disabled;
    const instance = map.current;
    if (!instance) return;
    for (const handler of [instance.dragging, instance.touchZoom, instance.doubleClickZoom, instance.boxZoom, instance.keyboard]) {
      if (disabled) handler.disable(); else handler.enable();
    }
    if (disabled) zoom.current?.remove(); else zoom.current?.addTo(instance);
  }, [disabled, ready]);
  useEffect(() => {
    let active = true;
    let failed = false;
    let instance: LeafletMap | undefined;
    const fail = () => { if (active) { failed = true; setReady(false); setError('Không thể tải bản đồ. Kiểm tra kết nối hoặc thử lại.'); } };
    const timeout = setTimeout(fail, 15000);
    void import('leaflet').then((L) => {
      if (!active || failed || !container.current) return;
      if (!tileUrl.startsWith('https://') || !['{z}', '{x}', '{y}'].every((token) => tileUrl.includes(token))) throw new Error('Invalid tile configuration.');
      const point = initial.current;
      const selected = validPoint(point.latitude, point.longitude);
      instance = L.map(container.current, { zoomControl: false, scrollWheelZoom: false, worldCopyJump: true,
        dragging: !locked.current, touchZoom: !locked.current, doubleClickZoom: !locked.current, boxZoom: !locked.current, keyboard: !locked.current,
      }).setView(selected ? [point.latitude!, point.longitude!] : [16.06, 108.22], selected ? 16 : 12);
      map.current = instance;
      zoom.current = L.control.zoom({ zoomInTitle: 'Phóng to', zoomOutTitle: 'Thu nhỏ' });
      if (!locked.current) zoom.current.addTo(instance);
      const icon = L.divIcon({ className: 'activity-map-marker', html: '<span></span>', iconSize: [28, 34], iconAnchor: [14, 34] });
      marker.current = L.marker([0, 0], { icon, interactive: false, keyboard: false, title: 'Vị trí hoạt động' });
      instance.on('click', (event: LeafletMouseEvent) => { if (!locked.current) instance?.panTo(event.latlng, { animate: false }); });
      const tiles = L.tileLayer(tileUrl, { maxZoom: 19, attribution, updateWhenIdle: true, referrerPolicy: 'strict-origin-when-cross-origin' });
      tiles.on('tileload', () => { if (active && !failed) { clearTimeout(timeout); setReady(true); setError(''); } });
      tiles.on('tileerror', fail);
      tiles.addTo(instance);
    }).catch(() => { clearTimeout(timeout); fail(); });
    return () => {
      active = false; clearTimeout(timeout); instance?.remove();
      map.current = null; marker.current = null; zoom.current = null;
    };
  }, [attempt]);
  useEffect(() => {
    if (!ready || !marker.current || !map.current) return;
    if (validPoint(latitude, longitude)) {
      marker.current.setLatLng([latitude!, longitude!]).addTo(map.current);
      map.current.panTo([latitude!, longitude!], { animate: false });
    } else marker.current.remove();
  }, [latitude, longitude, ready]);
  useEffect(() => {
    if (ready && !disabled && target) map.current?.setView([target.lat, target.lng], 16, { animate: false });
  }, [target, ready, disabled]);

  function locate() {
    if (!navigator.geolocation) { setError('Trình duyệt không hỗ trợ định vị. Bạn có thể chọn trực tiếp trên bản đồ.'); return; }
    setLocating(true); setMessage('');
    navigator.geolocation.getCurrentPosition((position) => {
      if (!map.current) return;
      setLocating(false);
      if (locked.current) return;
      if (!validPoint(position.coords.latitude, position.coords.longitude)) { setError('Không nhận được vị trí hợp lệ.'); return; }
      map.current.setView([position.coords.latitude, position.coords.longitude], 16, { animate: false });
      setError(''); setMessage('Đã tìm thấy vị trí hiện tại. Nhấn Ghim vị trí để xác nhận.');
    }, (failure) => {
      if (!map.current) return;
      setLocating(false); setError(failure.code === 1 ? 'Quyền định vị đã bị từ chối. Bạn có thể chọn trực tiếp trên bản đồ.' : 'Không thể lấy vị trí hiện tại. Hãy thử lại hoặc chọn trên bản đồ.');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }
  return <div className="map-picker">
    <div className="map-preview"><div ref={container} className="leaflet-map-canvas" role="region" aria-label="Bản đồ chọn vị trí hoạt động" />{ready && !disabled && <span className="map-center-target" aria-hidden="true" />}</div>
    {!ready && !error && <p role="status">Đang tải bản đồ…</p>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <p className="field-hint">{disabled ? 'Vị trí hoạt động chỉ được xem.' : 'Di chuyển bản đồ hoặc nhấn vào một điểm, rồi ghim để xác nhận vị trí.'}</p>
    <div className="activity-card-actions">
      <button type="button" className="button button-primary" disabled={disabled || !ready || locating} onClick={() => {
        const point = map.current?.getCenter().wrap();
        if (!point || !validPoint(point.lat, point.lng)) { setError('Vị trí không hợp lệ.'); return; }
        onChange({ lat: point.lat, lng: point.lng }); setError(''); setMessage('Đã ghim vị trí. Lưu nháp để ghi nhận thay đổi.');
      }}><Icon name="location" />Ghim vị trí</button>
      <button type="button" className="button button-outline" disabled={disabled || !ready || locating} onClick={locate}>{locating ? 'Đang định vị…' : 'Vị trí hiện tại'}</button>
      {validPoint(latitude, longitude) && <button type="button" className="text-button" disabled={disabled} onClick={() => { onChange(null); setMessage('Đã bỏ ghim. Lưu nháp để ghi nhận thay đổi.'); }}>Bỏ ghim</button>}
      {!ready && error && <button type="button" className="button button-outline" onClick={() => { setError(''); setAttempt((value) => value + 1); }}>Thử lại</button>}
    </div>
  </div>;
}
