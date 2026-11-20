import type { Metadata } from 'next';
import { ProposalForm } from '@/components/proposal-form';
import { Icon } from '@/components/icon';
import { redirect } from 'next/navigation';
import { backendUrl, sessionHeaders } from '@/lib/backend';

export const metadata: Metadata = { title: 'Đề xuất hoạt động' };

export default async function ProposalsPage() {
  const headers = await sessionHeaders();
  if (headers.Cookie) {
    let status: number | undefined;
    try { status = (await fetch(backendUrl('auth/session'), { headers, cache: 'no-store', signal: AbortSignal.timeout(10000) })).status; } catch { /* Do not render a guest form when session verification is unavailable. */ }
    if (status === 200) redirect('/');
    if (status !== 401) return <div className="container proposals-page"><h1>Đề xuất hoạt động</h1><p role="alert">Không thể xác minh phiên truy cập. Vui lòng thử lại.</p></div>;
  }
  return <div className="container proposals-page"><div className="page-heading"><span className="eyebrow">Kết nối & hợp tác</span><h1>Cùng xây dựng hoạt động ý nghĩa</h1><p>Chia sẻ ý tưởng của đơn vị với nhà trường.</p></div>
    <div className="proposal-layout"><ProposalForm /><aside className="proposal-aside"><div className="aside-intro"><Icon name="people" /><h2>Mỗi kết nối<br />mở ra một cơ hội</h2><p>Chúng tôi mong muốn kết nối các đơn vị cùng chung tinh thần đóng góp cho cộng đồng.</p></div><div className="surface proposal-guide"><h2>Trước khi gửi đề xuất</h2><ul><li>Giới thiệu rõ đơn vị và người liên hệ.</li><li>Mô tả mục tiêu, nội dung và địa điểm dự kiến.</li><li>Chọn thời gian phù hợp để nhà trường xem xét.</li></ul><p>Đề xuất được tiếp nhận để xem xét, không đồng nghĩa với việc hoạt động đã được phê duyệt hay công bố.</p></div></aside></div>
  </div>;
}
