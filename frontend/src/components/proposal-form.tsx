'use client';

import { ServiceNotice } from './service-notice';

export function ProposalForm() {
  return <form className="surface proposal-form" onSubmit={(event) => event.preventDefault()} aria-label="Đề xuất hoạt động">
    <fieldset><legend>Thông tin đơn vị</legend><p className="fieldset-description">Đơn vị đề xuất và thông tin để nhà trường liên hệ.</p><div className="form-grid">
      <div className="field"><label htmlFor="organizationName">Tên đơn vị <span aria-hidden="true">*</span></label><input id="organizationName" name="organizationName" maxLength={200} autoComplete="organization" placeholder="Ghi rõ tên đơn vị" required /></div>
      <div className="field"><label htmlFor="organizationType">Loại đơn vị</label><input id="organizationType" name="organizationType" maxLength={100} placeholder="Ví dụ: Doanh nghiệp, tổ chức xã hội" /></div>
      <div className="field"><label htmlFor="contactName">Người liên hệ</label><input id="contactName" name="contactName" maxLength={150} autoComplete="name" placeholder="Họ và tên người liên hệ" /></div>
      <div className="field"><label htmlFor="phone">Số điện thoại</label><input id="phone" name="phone" type="tel" maxLength={20} autoComplete="tel" placeholder="Số điện thoại liên hệ" /></div>
      <div className="field span-all"><label htmlFor="contactEmail">Email liên hệ</label><input id="contactEmail" name="contactEmail" type="email" maxLength={150} autoComplete="email" placeholder="Email để nhận thông tin phản hồi" /></div>
    </div></fieldset>
    <fieldset><legend>Nội dung hoạt động</legend><p className="fieldset-description">Giúp nhà trường hiểu rõ ý tưởng và kế hoạch của bạn.</p><div className="form-grid">
      <div className="field span-all"><label htmlFor="activityName">Tên hoạt động <span aria-hidden="true">*</span></label><input id="activityName" name="activityName" maxLength={255} placeholder="Điền vào tên hoạt động" required /></div>
      <div className="field span-all"><label htmlFor="description">Mô tả hoạt động</label><textarea id="description" name="description" rows={5} placeholder="Mục tiêu, nội dung chính, đối tượng tham gia và giá trị mang lại cho cộng đồng…" /></div>
      <div className="field span-all"><label htmlFor="location">Địa điểm dự kiến</label><textarea id="location" name="location" rows={2} placeholder="Địa điểm tổ chức hoạt động" /></div>
      <div className="field span-all"><label htmlFor="proposedAt">Thời gian dự kiến</label><input id="proposedAt" name="proposedAt" type="datetime-local" aria-describedby="time-hint" /><p className="field-hint" id="time-hint">Chọn thời gian trong tương lai, theo giờ Việt Nam (UTC+7).</p></div>
    </div></fieldset>
    <label className="checkbox-field"><input type="checkbox" name="confirmation" required /><span>Tôi xác nhận thông tin trong đề xuất là chính xác.</span></label>
    <ServiceNotice title="Chưa thể gửi đề xuất">Dịch vụ tiếp nhận hiện chưa khả dụng. Nội dung bạn nhập chưa được gửi hoặc lưu lại.</ServiceNotice>
    <div className="form-actions"><p className="field-hint" id="proposal-availability">Vui lòng quay lại khi dịch vụ sẵn sàng.</p><button className="button button-primary" type="submit" disabled aria-describedby="proposal-availability">Gửi đề xuất</button></div>
  </form>;
}
