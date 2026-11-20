import { Icon } from '@/components/icon';
import { NewsFeed, PublicActivities } from '@/components/public-feed';

export default function HomePage() {
  return <>
    <section className="hero" aria-labelledby="home-title"><div className="container hero-grid">
      <div className="hero-copy"><span className="eyebrow light">Hệ thống hoạt động cộng đồng UTE</span><h1 id="home-title">Cùng hành động.<br />Cùng tạo nên giá trị.</h1><p>Cập nhật tin tức, tìm hiểu hoạt động và chung tay tham gia cùng nhà trường.</p></div>
      <div className="hero-community"><span className="community-symbol" aria-hidden="true"><Icon name="people" /></span><p>Kết nối sinh viên,<br /><strong>nhà trường và cộng đồng.</strong></p></div>
    </div></section>

    <div id="bang-tin" className="container home-content anchor-section">
      <section id="tin-tuc" className="news-section anchor-section" aria-labelledby="news-title"><div className="section-heading"><div><span className="eyebrow">Nhịp sống cộng đồng</span><h2 id="news-title">Tin tức</h2></div><Icon name="news" /></div><NewsFeed /></section>
      <section id="hoat-dong" className="activities-section anchor-section" aria-labelledby="activities-title"><div className="section-heading"><div><span className="eyebrow">Cơ hội để sẻ chia</span><h2 id="activities-title">Hoạt động cộng đồng</h2></div></div><PublicActivities /></section>
    </div>
  </>;
}
