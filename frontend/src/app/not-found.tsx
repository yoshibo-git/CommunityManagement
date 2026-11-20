import Link from 'next/link';

export default function NotFound() {
  return <div className="container not-found"><span className="eyebrow">Không tìm thấy trang</span><h1>Trang bạn tìm hiện không tồn tại</h1><p>Kiểm tra lại đường dẫn hoặc trở về trang chủ để tiếp tục khám phá.</p><Link href="/" className="button button-primary">Về trang chủ</Link></div>;
}
