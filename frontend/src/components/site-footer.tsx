import { Icon } from './icon';

export function SiteFooter() {
  return (
    <footer id="lien-he" className="site-footer anchor-section">
      <div className="container footer-inner">
        <section aria-labelledby="footer-information">
          <h2 id="footer-information">Thông tin</h2>
          <address className="footer-contact">
            <p><Icon name="location" /><span>Cơ sở 1: 48 Cao Thắng, Hải Châu, Đà Nẵng</span></p>
            <p><Icon name="location" /><span>Cơ sở 2: Khu Đô thị đại học, Ngũ Hành Sơn, Đà Nẵng</span></p>
            <p><Icon name="phone" /><span>Điện thoại: 0236 3822 571</span></p>
            <p><Icon name="mail" /><span>Email: pdt@ute.udn.vn</span></p>
          </address>
        </section>
        <section aria-labelledby="footer-academic">
          <h2 id="footer-academic">Đơn vị chuyên môn</h2>
          <ul>
            <li>Khoa Cơ khí</li>
            <li>Khoa Điện - Điện tử</li>
            <li>Khoa Kỹ thuật Xây dựng</li>
            <li>Khoa Công nghệ Hóa học - Môi trường</li>
            <li>Khoa Sư phạm Công nghiệp</li>
            <li>Khoa Công nghệ Số</li>
          </ul>
        </section>
        <section aria-labelledby="footer-administration">
          <h2 id="footer-administration">Đơn vị chức năng</h2>
          <ul>
            <li>Phòng Tổ chức - Hành chính</li>
            <li>Phòng Đào tạo</li>
            <li>Phòng Công tác Sinh viên</li>
            <li>Phòng QLKH và HTQT</li>
            <li>Phòng Kế hoạch - Tài chính</li>
            <li>Phòng Khảo thí và Đảm bảo chất lượng giáo dục</li>
            <li>Phòng Cơ sở Vật chất</li>
          </ul>
        </section>
        <section aria-labelledby="footer-training">
          <h2 id="footer-training">Đào tạo</h2>
          <ul>
            <li>Chương trình đào tạo</li>
            <li>Quy định, quy chế</li>
            <li>Phương thức tuyển sinh</li>
            <li>Trường Đại học Sư phạm Kỹ thuật</li>
          </ul>
        </section>
      </div>
      <div className="footer-copyright"><div className="container">© Copyright All by Quoc Cuong 2026</div></div>
    </footer>
  );
}
