'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './icon';

type Post = { id: number; title: string; html: string; author: string; publishedAt: string; editedAt: string | null };
const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
async function readFeed(signal: AbortSignal, cursor?: string): Promise<{ items: Post[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const response = await fetch(`/api/backend/posts/public?${params}`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error();
  return response.json();
}

export function NewsFeed() {
  const [items, setItems] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const load = useCallback(async (signal: AbortSignal, after?: string) => {
    try {
      const data = await readFeed(signal, after);
      if (signal.aborted) return;
      setError('');
      setItems((current) => after ? [...current, ...data.items.filter((item) => !current.some((old) => old.id === item.id))] : data.items);
      setCursor(data.nextCursor);
    } catch { if (!signal.aborted) setError('Không thể tải bài đăng. Vui lòng thử lại.'); }
    finally { if (!signal.aborted) setPending(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void readFeed(controller.signal).then((data) => {
      if (!controller.signal.aborted) { setItems(data.items); setCursor(data.nextCursor); setError(''); }
    }).catch(() => { if (!controller.signal.aborted) setError('Không thể tải bài đăng. Vui lòng thử lại.'); })
      .finally(() => { if (!controller.signal.aborted) setPending(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!cursor || pending || error || !sentinel.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect(); setPending(true);
        void load(new AbortController().signal, cursor);
      }
    }, { root: scroller.current });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [cursor, pending, error, load]);
  return <div className="news-feed" ref={scroller} role="region" aria-label="Danh sách tin tức" tabIndex={0}>
    {error && <div className="surface workspace-empty" role="alert"><p>{error}</p><button className="button button-outline" disabled={pending} onClick={() => { setPending(true); void load(new AbortController().signal, cursor ?? undefined); }}>Thử lại</button></div>}
    {items.map((item) => <article className="surface feed-post" key={item.id}><h3>{item.title}</h3><p className="field-hint">{item.author} · {item.editedAt ? 'Được chỉnh sửa lúc ' : 'Đăng lúc '}<time dateTime={item.editedAt ?? item.publishedAt}>{formatDate(item.editedAt ?? item.publishedAt)}</time></p><div className="post-content" dangerouslySetInnerHTML={{ __html: item.html }} /></article>)}
    {pending && <p role="status">Đang tải bài đăng…</p>}
    {!pending && !error && !items.length && <div className="surface workspace-empty"><h3>Chưa có bài đăng</h3></div>}
    {cursor && !error && <button className="button button-outline" disabled={pending} onClick={() => { setPending(true); void load(new AbortController().signal, cursor); }}>Xem thêm</button>}
    <div ref={sentinel} aria-hidden="true" />
    {!cursor && !pending && !error && items.length > 0 && <p className="field-hint">Bạn đã xem hết bài viết.</p>}
  </div>;
}

export function PublicActivities() {
  const [items, setItems] = useState<{ id: number; name: string; location: string | null; startAt: string | null }[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/backend/activities', { signal: controller.signal, cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error();
      setItems((await response.json()).items);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);
  if (failed) return <div className="surface workspace-empty" role="alert">Không thể tải hoạt động. Vui lòng tải lại trang.</div>;
  if (!items) return <p role="status">Đang tải hoạt động…</p>;
  return items.length ? <div className="workspace-card-grid">{items.map((item) => <article key={item.id} className="surface activity-card"><h3>{item.name}</h3><p>{item.startAt ? formatDate(item.startAt) : 'Chưa có lịch'}</p><p>{item.location}</p></article>)}</div> : <div className="surface workspace-empty"><Icon name="calendar" /><h3>Chưa có hoạt động công khai</h3></div>;
}

