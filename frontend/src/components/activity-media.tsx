'use client';

import { useRef, useState, type RefObject } from 'react';
import { Icon } from './icon';

export function ActivityImageDialog({ src, dialog, label = 'Ảnh minh họa hoạt động' }: { src?: string | null; dialog: RefObject<HTMLDialogElement | null>; label?: string }) {
  return <dialog ref={dialog} className="surface face-guide activity-lightbox" aria-label={label}>
    <div className="face-guide-actions"><button type="button" className="button button-outline" onClick={() => dialog.current?.close()}>Đóng</button></div>
    {/* eslint-disable-next-line @next/next/no-img-element -- Private images or local previews are loaded by the browser. */}
    {src && <img src={src} alt="Ảnh minh họa hoạt động" loading="lazy" />}
  </dialog>;
}

export function ActivityMedia({ src, preview = false }: { src?: string | null; preview?: boolean }) {
  const [failed, setFailed] = useState<string>();
  const dialog = useRef<HTMLDialogElement>(null);
  if (!src || src === failed) return preview ? null : <div className="activity-media" role="img" aria-label="Chưa có ảnh minh họa"><Icon name="calendar" /></div>;
  return <div className="activity-media">
    {/* eslint-disable-next-line @next/next/no-img-element -- Draft images require the browser session and previews use blob URLs. */}
    <img src={src} alt="Ảnh minh họa hoạt động" loading="lazy" onError={() => setFailed(src)} />
    {preview && <>
      <button type="button" className="button button-outline activity-media-view" aria-label="Xem ảnh minh họa" onClick={() => dialog.current?.showModal()}>Xem</button>
      <ActivityImageDialog src={src} dialog={dialog} />
    </>}
  </div>;
}
