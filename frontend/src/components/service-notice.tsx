import { Icon } from './icon';

export function ServiceNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="service-notice" role="status"><Icon name="info" /><div><strong>{title}</strong><p>{children}</p></div></div>;
}

export function ContentUnavailable({ kind }: { kind: 'news' | 'activities' }) {
  const news = kind === 'news';
  return <div className="content-unavailable" role="status">
    <span className="empty-icon"><Icon name={news ? 'news' : 'calendar'} /></span>
    <h3>{news ? 'Chưa thể tải tin tức' : 'Chưa thể tải hoạt động'}</h3>
    <p>{news ? 'Kênh tin tức hiện chưa khả dụng. Vui lòng quay lại sau để cập nhật thông tin từ nhà trường.' : 'Danh sách hoạt động công khai hiện chưa khả dụng. Vui lòng quay lại sau để khám phá và tham gia.'}</p>
    <span className="status-label">Tạm thời chưa khả dụng</span>
  </div>;
}
