# CM UTE — ĐẶC TẢ THIẾT KẾ GIAO DIỆN (UI DESIGN SYSTEM & INTERACTION)

> **Tệp đích:** `docs/ui-design.md`  
> **Ngôn ngữ hiển thị:** Tiếng Việt (`vi-VN`) trong toàn bộ giao diện dành cho người dùng.  
> **Phạm vi:** Website responsive cho hệ thống Quản lý các hoạt động cộng đồng UTE.  
> **Nguồn nghiệp vụ duy nhất:** `docs/architecture.md`; tài liệu này chỉ quyết định cách trình bày và tương tác, không sửa Business Rules, API, vai trò, dữ liệu hoặc State Machine.  
> **Tham chiếu thị giác:** [Cổng Quản lý đào tạo UTE](https://qldt.ute.udn.vn/) — cảm hứng về nhận diện cơ sở giáo dục, điều hướng rõ ràng, khu vực thông báo/tin tức và bố cục xanh–trắng. **Không sao chép giao diện, tài sản, logo hoặc khẳng định màu HEX ở đây là màu chính thức của trường.**  
> **Cách thực thi:** Sử dụng skill `ui-ux-promax` **đã cài sẵn** trong Codex theo cơ chế sẵn có; **không cài/thêm skill mới** và không để skill ghi đè các quy tắc trong tài liệu này.

## 1. Mục tiêu, thứ tự ưu tiên và giới hạn

1. Thiết kế giao diện **chuyên nghiệp, trang nhã, rõ ràng**, phù hợp cổng thông tin đại học; lấy **xanh dương và trắng** làm chủ đạo, ưu tiên tính sử dụng hơn hiệu ứng trang trí.
2. **Bố cục grid đồng đều**, khoảng cách nhất quán, các khu vực không đè, chèn ép, tràn hoặc che khuất nhau ở bất kỳ breakpoint nào.
3. Truy cập tốt trên desktop, tablet và mobile; nhất là những luồng trên điện thoại như đăng ký hoạt động, quét QR, GPS và FaceIO.
4. **Toàn bộ nhãn, menu, breadcrumb, placeholder, thông báo, modal, validation, empty/error state, tooltip, xác nhận, trạng thái và nội dung trợ giúp đều dùng tiếng Việt.** Chỉ giữ nguyên tên riêng, logo, mã định danh, định dạng kỹ thuật được quy định trong `architecture.md` và thuật ngữ công nghệ thực sự cần thiết. Không đưa literal DB như `pending_completed`, `check_out`, `NOTI-03` trực tiếp vào UI.
5. Không tạo chức năng mới hoặc cấp quyền dựa trên bố cục. `architecture.md` là nguồn chuẩn cao nhất về nghiệp vụ; các mục `BLOCKED` trong tài liệu đó tiếp tục bị chặn và không được giải quyết bằng giả định UI.
6. UI/UX và component có thể dùng thư viện đã tồn tại trong repo; không bắt buộc thêm Tailwind, shadcn/ui hay thư viện mới. Kiểm tra dependency và convention của frontend trước khi chọn cách triển khai.

**Ưu tiên khi xung đột:** `architecture.md` (nghiệp vụ, quyền, trạng thái, API) → `ui-design.md` (visual, layout, interaction) → lựa chọn mặc định của UI library/skill. Các giá trị thiết kế trong file này là **quy chuẩn đề xuất của sản phẩm CM UTE**, không phải đặc tả thương hiệu chính thức của UTE.

## 2. Định hướng hình ảnh từ cổng QLĐT UTE

- **Kế thừa tinh thần:** header nhận diện trường; điều hướng dễ tìm; thông báo/tin tức có cấu trúc; nội dung hành chính dễ quét; nền sáng, mảng xanh làm điểm nhấn.
- **Hiện đại hóa có kiểm soát:** giao diện quản lý dùng sidebar, page header, bảng và bộ lọc; giao diện người tham gia dùng card hoạt động, thông tin thời hạn, nút hành động dễ thấy. Không nhân bản trang chủ QLĐT vào mọi màn hình nghiệp vụ.
- **Không sao chép:** banner, ảnh, favicon, logo, mã màu chưa được cấp phép; khi có logo chính thức từ dự án thì dùng asset đó, còn chưa có thì hiển thị text nhận diện thay vì dựng logo giả.
- **Cảm giác mong muốn:** tin cậy, học thuật, sạch, nhất quán, tiết chế; tránh gradient đậm khắp trang, glassmorphism, màu neon, animation quá mức hoặc dashboard nhiều thẻ cạnh tranh chú ý.

## 3. Design Tokens

### 3.1. Màu sắc (đề xuất, chưa phải brand guideline chính thức)

| Token | HEX | Mục đích |
|---|---|---|
| `--color-primary-700` | `#115A98` | Header/điểm nhấn xanh đậm |
| `--color-primary-600` | `#176EB4` | Primary button, active navigation |
| `--color-primary-500` | `#2584C7` | Hover/selected phụ trợ |
| `--color-primary-100` | `#E5F2FC` | Nền nhấn nhẹ, chip chọn |
| `--color-primary-50` | `#F2F8FD` | Nền section/hover nhẹ |
| `--color-surface` | `#FFFFFF` | Card, form, modal |
| `--color-canvas` | `#F5F8FC` | Nền ứng dụng |
| `--color-text` | `#182B3D` | Nội dung chính |
| `--color-text-muted` | `#536577` | Nội dung phụ |
| `--color-border` | `#D8E2EC` | Border, divider |
| `--color-success` | `#177C55` | Thành công |
| `--color-warning` | `#A86508` | Cảnh báo |
| `--color-danger` | `#C33F43` | Lỗi, hành động nguy hiểm |
| `--color-focus` | `#176EB4` | Focus ring dễ nhận biết |

**Quy tắc màu:**
- Xanh đậm trên trắng cho tiêu đề, link và nút chính; chữ chính trên nền trắng. Không dùng text xanh nhạt trên trắng nếu không đạt độ tương phản.
- Màu trạng thái **không là tín hiệu duy nhất**: luôn có nhãn/icon ngữ nghĩa (ví dụ “Đã duyệt”, “Từ chối”).
- Không tô màu xanh cho tất cả các card; nên dùng bề mặt trắng, border nhẹ, chỉ nhấn những hành động quan trọng.
- Kiểm tra độ tương phản WCAG 2.2 AA: text thường ≥ 4.5:1; text lớn ≥ 3:1; icon/control thiết yếu ≥ 3:1. Nếu token đề xuất không đạt trên tổ hợp cụ thể, điều chỉnh sắc độ trước khi phát hành.

### 3.2. Chữ và kích thước

- Font ưu tiên: `Inter`, nếu chưa có trong repo dùng system font stack hỗ trợ tiếng Việt; **không tự tải font bên ngoài** khi chưa được phép. Stack: `Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`.
- Body mặc định `14–16px`, `line-height: 1.5–1.6`; không dùng text chính dưới `14px` trên desktop hoặc mobile.
- H1 trang `24–30px/1.25`, H2 `20–24px/1.3`, H3 `16–18px/1.4`; nhãn form `14px` với weight `500–600`; metadata `12–13px` chỉ cho chi tiết thứ yếu.
- Font weight nhất quán: `400` nội dung, `500` nhãn, `600` heading nhỏ, `700` heading trang.
- Ngày giờ UI: `HH:mm DD/MM/YYYY`, timezone `Asia/Ho_Chi_Minh`; ngày không có giờ: `DD/MM/YYYY`; số và điểm thể hiện rõ đơn vị.
- Tránh viết hoa toàn bộ tiêu đề bảng, nút và menu dài.

### 3.3. Spacing, radius, shadow, icon

- Thang spacing **4px**: `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64`.
- `--gap-xs: 8px`, `--gap-sm: 12px`, `--gap-md: 16px`, `--gap-lg: 24px`, `--gap-xl: 32px`.
- Radius: input/button `8px`, card `12px`, modal `16px`; tránh bo tròn quá lớn kiểu ứng dụng giải trí.
- Border `1px solid var(--color-border)`; shadow card nhẹ, tăng shadow chỉ cho dropdown/modal.
- Icon: một họ icon nhất quán có sẵn trong repo; kích thước thông thường `18–20px`, item điều hướng `20px`, không trộn nhiều bộ icon khác nhau.
- Chiều cao control thường `40–44px`; vùng chạm trên mobile **ít nhất 44×44px**; disabled vẫn có nhãn giải thích khi thao tác bị chặn.

## 4. Grid System — quy tắc bắt buộc

### 4.1. Container và breakpoint

| Viewport | Cột grid | Gutter ngoài | Khoảng cột | Cách dùng |
|---|---:|---:|---:|---|
| `< 640px` (mobile) | 4 | `16px` | `12px` | Một cột nội dung; card/form xếp dọc |
| `640–1023px` (tablet) | 8 | `24px` | `16px` | Form 1–2 cột khi đủ chỗ |
| `1024–1439px` (desktop) | 12 | `32px` | `20–24px` | Sidebar + content, 2–3 cột card |
| `≥ 1440px` (wide) | 12 | `40px` | `24px` | Nội dung giới hạn `max-width: 1440px` |

Các breakpoint là ngưỡng đề xuất; **ưu tiên container queries và kích thước nội dung thực tế** nếu widget/card vẫn bị chèn. Không cố nhồi số cột chỉ vì đã đạt breakpoint.

### 4.2. Ràng buộc chống đè và chèn ép

1. Mọi vùng chính dùng CSS Grid/Flexbox với `min-width: 0` cho grid children chứa text/table; đặt `box-sizing: border-box` toàn cục.
2. Dùng `grid-template-columns: repeat(n, minmax(0, 1fr))` cho cột đều, hoặc `repeat(auto-fit, minmax(min(100%, 260px), 1fr))` cho card responsive.
3. **Không dùng width cố định vượt viewport** cho card/form/modal; không dùng `position: absolute` để sắp xếp layout chính; không dùng negative margin để chữa lỗi grid.
4. Card trong cùng hàng có chiều cao cân bằng khi phù hợp; tiêu đề dài phải wrap/line-clamp có xem đầy đủ; nội dung không bị chồng nút.
5. **Sidebar không đè nội dung:** desktop vùng sidebar rộng khoảng `240–264px`, content dùng `minmax(0, 1fr)`; tablet/mobile chuyển sidebar thành drawer, không thu nhỏ cột form tới mức không sử dụng được.
6. Bảng nhiều cột được đặt trong **vùng cuộn ngang riêng** (`overflow-x: auto`) với nhãn, hành động và navigation vẫn dùng được. Không kéo toàn bộ viewport cuộn ngang.
7. Dropdown, date picker, modal tự điều chỉnh vị trí theo viewport; modal `max-width: min(560px, calc(100vw - 32px))`, `max-height: calc(100dvh - 32px)` và cuộn phần body.
8. Dùng `gap` giữa các phần tử; không chồng padding giữa section/card. Mỗi hàng field tính đủ khoảng cho label, hint và error; không đặt field error bằng absolute.
9. Form hai cột chỉ khi **mỗi cột ≥ 280px** thực tế; nếu không, về một cột. Textarea, map, file upload và bước FaceIO chiếm toàn hàng.
10. Kiểm tra tại các độ rộng `320, 375, 390, 768, 1024, 1280, 1440px` cùng text tiếng Việt dài, zoom 200%, và trạng thái lỗi có nhiều dòng. **Không có horizontal overflow toàn trang hoặc vùng click bị che.**

### 4.3. Pattern triển khai tham khảo (không áp đặt thư viện)

```css
:root {
  --content-max: 1440px;
  --page-gutter: clamp(16px, 3vw, 40px);
  --grid-gap: clamp(12px, 1.6vw, 24px);
}

*, *::before, *::after { box-sizing: border-box; }

.page-container {
  width: min(100% - 2 * var(--page-gutter), var(--content-max));
  margin-inline: auto;
}

.app-shell {
  display: grid;
  grid-template-columns: 256px minmax(0, 1fr);
  min-height: 100dvh;
}

.app-main, .grid-item { min-width: 0; }

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: var(--grid-gap);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 24px;
}

.table-scroll { max-width: 100%; overflow-x: auto; }

@media (max-width: 1023px) {
  .app-shell { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 639px) {
  .form-grid { grid-template-columns: minmax(0, 1fr); }
}
```

**Không sao chép nguyên CSS nếu CSS framework/component library đang có đã đáp ứng các nguyên tắc này.**

## 5. Layout dùng chung

### 5.1. Public Layout

- Header nhận diện bằng tên trường/tên hệ thống, khu vực navigation gọn; desktop menu ngang, mobile menu drawer.
- Nội dung canh giữa theo container và max-width; phần thông báo/tin tức tách rõ, không xếp banner che danh sách hoạt động.
- Footer nhẹ với thông tin chính thức **chỉ khi có dữ liệu được dự án cung cấp**, tránh tự điền địa chỉ, email hay số điện thoại vào sản phẩm.
- News Feed sử dụng một cột đọc dễ theo dõi; danh sách hoạt động dùng grid card đều; chi tiết hoạt động có content chính và sidebar tóm tắt/đăng ký trên desktop, **stack** trên mobile.
- Homepage chia Tin tức bên trái và Hoạt động bên phải thành hai cột bằng nhau, stack trên màn hình nhỏ; không có panel danh mục hoặc nhãn “Không gian cá nhân”/“Khám phá CM UTE”. Navigation gồm Trang chủ (`/`), Tin tức (`/#bang-tin`, vùng chứa cả tin tức và hoạt động), Liên hệ (`/#lien-he`, footer). Menu tài khoản có icon: Hồ sơ, Hoạt động với user/staff hoặc Quản lý tài khoản với admin, Đăng xuất. Tất cả màn dùng chung header/footer public; không có sidebar hệ thống riêng. Hoạt động user gồm ba mục Hoạt động/Kết quả tham gia/Minh chứng; staff gồm Hoạt động/Danh sách hoạt động đã công bố/Minh chứng để duyệt. Chức năng duyệt chưa có API hiển thị chưa khả dụng, không hiển thị minh chứng cá nhân như hàng đợi duyệt. Đề xuất chỉ dành cho khách. Menu hỗ trợ Escape, click ngoài, bàn phím và drawer mobile.

### 5.2. Authentication Layout

- Nền sáng, card form giới hạn khoảng `420–480px`; logo/tên hệ thống phía trên, form rõ ràng, không chia đôi màn hình nhỏ.
- Luồng kích hoạt, mật khẩu, FaceIO và phục hồi được trình bày **theo từng bước thực tế trong `architecture.md`**. Không thêm đăng ký tài khoản tự do hay xác thực thay thế.
- Camera có vùng preview linh hoạt, permission state, hướng dẫn rõ bằng tiếng Việt; không ẩn lỗi phía dưới màn hình.

### 5.3. Student / End User Layout

- Giao diện chính `/system` lấy danh tính từ phiên Redis. `user`/`staff` tiếp tục xem News Feed public với tên tài khoản và Đăng xuất; menu hệ thống theo quyền. Giai đoạn local tạm bỏ FaceIO khi đăng nhập bằng mật khẩu theo ngoại lệ đã phê duyệt trong architecture. Không có bộ chọn profile, banner kiểm thử hoặc nhãn dữ liệu mẫu; thao tác chưa có API phải vô hiệu hóa.

- Desktop: header + navigation gọn, content rộng, card hoạt động và phần thống kê rõ; mobile: navigation thu gọn/drawer, CTA chính dễ chạm.
- Các màn danh sách, chi tiết, hoạt động đã đăng ký, điểm danh, minh chứng, thông báo và điểm sử dụng cùng token, component, pattern phản hồi.
- `staff` không hiển thị những mục chỉ dành cho sinh viên nhận điểm; các chức năng nhiệm vụ BTC chỉ xuất hiện theo phân công hợp lệ.

### 5.4. Management Layout

- Chuông thông báo nằm ngay bên trái tài khoản ở header, chỉ hiện sau đăng nhập; đọc thông báo không tự đánh dấu đã đọc. Đăng xuất thành công chuyển về `/login`.
- Tab Hoạt động của staff chia Bản nháp và Sắp diễn ra; tab Danh sách hoạt động chứa tất cả trạng thái đã công bố. Chỉ bản nháp của chủ sở hữu có nút Chỉnh sửa. Tạo/sửa nháp dùng chung form và tab con Phân công, lưu tạm theo actor/activity trong localStorage; hiển thị Chưa lưu, cảnh báo rời trang và lỗi lưu trữ. Sau công bố, giao diện và API sửa nháp khóa chỉnh sửa. Công bố và tác vụ sự cố chưa được mở trong lát cắt này.
- Liên kết quay về Hoạt động dùng chung component: icon mũi tên trái, nhãn “Quay lại”, đặt phía trên tiêu đề ở cùng container. Menu/tab điều hướng giữ đúng nhãn chức năng và quyền truy cập.
- Biểu mẫu lịch dùng “Chọn vị trí” thay nhập kinh/vĩ độ. Leaflet 1.9.4 hiển thị nền OpenStreetMap và nút Ghim vị trí, không cần Google Maps key; click hoặc di chuyển bản đồ/GPS chỉ chọn tâm tạm, nhấn Ghim mới cập nhật tọa độ biểu mẫu. GPS chỉ xin quyền sau thao tác, không thay thế xác minh điểm danh. Lỗi tải, hết thời gian hoặc từ chối GPS phải có trạng thái rõ; giữ nguyên tọa độ đã lưu. Trạng thái chỉ xem khóa ghim, GPS và bỏ ghim. Tải bản đồ khi mở bộ chọn, giữ attribution hiển thị, dùng HTTPS và cache mặc định trình duyệt; không prefetch/offline tiles. Nguồn tile công cộng là best-effort, phải tuân Tile Usage Policy của OSM; có thể đổi nguồn/attribution qua cấu hình triển khai khi cần.
- Khi staff sửa trường Địa điểm, tìm bằng Photon sau 1 giây ngừng nhập (3–200 ký tự), tự mở bản đồ và chuyển tâm tới gợi ý đầu tiên; hiển thị tối đa 5 gợi ý để chọn lại. Chọn một gợi ý thay nội dung trường Địa điểm bằng địa chỉ của gợi ý và chuyển tâm bản đồ, không tự tìm lại địa chỉ vừa chọn. Chỉ ghim mới cập nhật tọa độ. Sửa địa điểm bỏ tọa độ đang ghim trong biểu mẫu để tránh lưu nhầm vị trí cũ; vẫn phải Lưu nháp để thay đổi database. Không tự tìm lại địa chỉ đã lưu khi mở biểu mẫu hoặc ở chế độ chỉ xem. Hủy truy vấn cũ, timeout 8 giây, cache tối đa 50 địa chỉ/5 phút trong trình duyệt; không có kết quả/lỗi phải hiển thị rõ và vẫn cho chọn trực tiếp. Photon public chỉ phù hợp mức dùng vừa phải, không có SLA; có thể đổi endpoint Photon qua cấu hình, không dùng Nominatim public để autocomplete.

- Sidebar desktop `240–264px`, header thanh công cụ, breadcrumb, page title và action ở góc trên phần nội dung; panel/filter chỉ mở rộng khi cần.
- Khu vực chính: `PageHeader → Toolbar/Filters → KPI nếu có → Table/Card → Pagination`.
- Form tạo hoạt động: tabs/section `Thông tin chung`, `Lịch & Địa điểm`, `Kế hoạch`, `Nhiệm vụ BTC`, `Xem trước`; không dùng tabs để che lỗi bắt buộc ở tab khác lúc publish.
- Trang điểm danh ưu tiên phân tách `Thiết lập phiên`, `Trạng thái phiên`, `QR`, `Danh sách kết quả` với grid không chồng nhau.

### 5.5. Admin Layout

- Dùng chung shell quản trị nhưng menu/chức năng đúng quyền Admin; quản lý tài khoản/import/role và thống kê theo `architecture.md`.
- **Không tự hiện mục vận hành check-in/checkout chỉ vì tài khoản là Admin.**

## 6. Navigation, Page Template và tên gọi

### 6.1. Quy tắc điều hướng

- Breadcrumb ở trang quản lý có từ hai cấp; chỉ trang có thật mới được đưa vào link.
- Active menu phản ánh route hiện tại; sidebar có nhóm nhưng không tạo menu dài hơn chức năng thật.
- Route không có quyền: màn “Bạn không có quyền truy cập” cùng lối quay lại an toàn; 404 không lộ dữ liệu draft/private.
- Mobile drawer tự đóng khi chọn mục; focus được đưa về nội dung mới; không làm mất dữ liệu form đang chỉnh sửa khi user chỉ mở menu.
- Nhãn tiếng Việt thống nhất: “Hoạt động”, “Hoạt động của tôi”, “Nhiệm vụ của tôi”, “Điểm danh”, “Minh chứng”, “Thống kê”, “Thông báo”, “Quản lý tài khoản”, “Bài đăng”, “Đăng xuất”. Chỉ hiển thị nhãn khi vai trò thực sự có quyền.

### 6.2. Các Page Template

| Mẫu | Thành phần | Dùng cho |
|---|---|---|
| `ListPage` | `PageHeader + Filters + Table/Cards + Pagination` | Account, activity, proposal, evidence, task |
| `DetailPage` | Title/status + metadata + sections + context actions | Chi tiết hoạt động, đề xuất, tài khoản |
| `FormPage` | Section heading + form grid + footer actions | Tạo/sửa hoạt động, minh chứng, bài đăng |
| `ReviewPage` | Summary + preview + decisions + confirm | Import, duyệt minh chứng, rà soát điểm danh |
| `WizardPage` | Step indicator + body + guarded next/confirm | Kích hoạt, FaceIO, QR/GPS/FaceIO |
| `FeedPage` | Search + single-column feed + load states | News Feed, thông báo |
| `AnalyticsPage` | KPI grid + filter + bảng/chart vừa đủ | Thống kê cá nhân/Quản lý/Admin |

## 7. Component Library và trạng thái

| Component | Quy tắc thể hiện |
|---|---|
| `Button` | `primary / secondary / outline / danger / text`; tối đa một primary CTA chính cho một vùng; loading khi submit; nhãn hành động cụ thể |
| `Input`, `Textarea` | Label bên trên, hint và error bên dưới, placeholder không thay label; chiều rộng theo grid |
| `Select`, `Combobox` | Searchable khi nhiều account; danh sách không vượt viewport; keyboard accessible; không khẳng định lựa chọn là quyền hợp lệ trước khi server kiểm |
| `DateTimePicker` | Hiển thị giờ VN, khóa giá trị sai bằng cả UI và server; khi thiếu thư viện tốt dùng native input có label rõ |
| `Card` | Border nhẹ, spacing đều, footer action riêng; tránh nhồi quá nhiều metadata |
| `Table` | Header rõ, alignment thống nhất, thao tác theo từng row, sort/filter có mô tả, scroll riêng trên mobile |
| `Tabs` | Tab list scroll ngang riêng khi cần, nhãn không cắt vô nghĩa, trạng thái hiện tại rõ |
| `Badge` | Nhãn trạng thái tiếng Việt + màu; không phân biệt chỉ bằng màu |
| `Modal/AlertDialog` | Tiêu đề + tóm tắt ảnh hưởng + nút “Hủy” và nút quyết định; focus trap, Escape nếu an toàn |
| `Toast/Alert` | Thông báo ngắn tiếng Việt, không tuyên bố thành công trước commit; lỗi quan trọng vẫn xuất hiện trong trang |
| `FileUpload` | Loại file, dung lượng, trạng thái upload, preview, lỗi theo field; không hiển thị đường dẫn private thật |
| `Skeleton/EmptyState` | Kích thước gần dữ liệu thật, mô tả rõ, chỉ đưa CTA khi được phép |
| `Pagination/InfiniteScroll` | Danh sách nghiệp vụ 10/trang theo `architecture.md`; News Feed/thông báo tải thêm và giữ dữ liệu cũ khi lỗi |
| `NotificationBell` | Badge chưa đọc, dropdown 5 item mới, xem tất cả 10 item đầu và tải thêm; không tự đánh dấu đọc khi chỉ mở |
| `Map/LocationInput` | Map có placeholder khi lỗi; luôn kèm trường tọa độ/địa chỉ cần thiết và trạng thái không được cấp quyền |
| `QR/CameraPreview` | Preview rõ, countdown và hướng dẫn quyền; đóng phiên phải ngừng thể hiện QR như đang hợp lệ |

**Trạng thái tương tác chuẩn:** `initial`, `loading`, `empty`, `ready`, `submitting`, `success`, `error`, `forbidden`, `expired`, `stale`. Mọi màn hình có dữ liệu bất đồng bộ phải xử lý ít nhất `loading`, `empty`, `error`, `ready`; các thao tác ghi phải phân biệt `submitting`, `success` sau phản hồi commit, và `stale/conflict` khi dữ liệu đổi.

## 8. Đặc tả màn hình theo mã nghiệp vụ của `architecture.md` §14

Bảng này xác định **bố cục và tương tác trực quan**, không định nghĩa lại quyền hoặc logic backend. Nếu trường dữ liệu/điều kiện mâu thuẫn, dùng đặc tả tương ứng ở §14.

| Màn hình | Grid/bố cục chính | Trọng tâm UX |
|---|---|---|
| `UI-ACC-01` Tạo/import tài khoản | Filter bar → table full width; import wizard preview bảng | Hiện lỗi theo dòng, kết quả nhập và trạng thái email riêng |
| `UI-ACC-02` Kích hoạt/FaceIO/login | Card đơn cột, step indicator | Tách password và FaceIO; camera/permission/error rõ |
| `UI-ACC-03` Phục hồi/Session/hồ sơ | Form một cột; hồ sơ chia nhóm khi đủ rộng | Thông báo trung tính khi khôi phục, xác nhận thao tác nhạy cảm |
| `UI-ACC-04` Khóa/đổi role | Account detail + các hành động phân quyền | Confirm modal, lý do bị chặn có thể hiểu được |
| `UI-ACT-01` Danh sách/chi tiết hoạt động | Card grid 1/2/3 cột; detail 8/4 ở desktop | Thông tin lịch, địa điểm, sức chứa và CTA dễ thấy |
| `UI-ACT-02` Tạo/sửa/import draft | Form grid tối đa 2 cột + section full row | Nút lưu nháp riêng publish, cảnh báo thay đổi chưa lưu chỉ khi rời trang; thao tác bản đồ, liên kết trong cùng trang và mở tab mới không hỏi xác nhận |
| `UI-ACT-03` Phân công BTC tạm | Các hàng nhiệm vụ có thể stack; Combobox | Cảnh báo dữ liệu chỉ lưu trên trình duyệt, validate từng row |
| `UI-ACT-04` Xem trước/publish | Preview sections + action bar rõ | Kiểm thông tin và lỗi trước công bố, giữ draft khi lỗi |
| `UI-ACT-05` Sửa/sự cố/hủy/kết thúc | Detail với status timeline và actions theo quyền | Hành động nguy hiểm dùng confirm, không ẩn lý do lỗi |
| `UI-ASG-01` Nhiệm vụ của tôi | List/table, task detail theo trạng thái | Các nút tiến độ/review xuất hiện đúng quyền |
| `UI-PRP-01` Đề xuất công khai | Form 1 cột, tối đa 2 cột với field ngắn | Nhãn đầy đủ, chống gửi lặp, trạng thái tiếp nhận |
| `UI-PRP-02` Duyệt đề xuất | Tabs trạng thái + table + detail side panel/page | Lý do từ chối bắt buộc, prefill activity không ngầm công bố |
| `UI-REG-01` Đăng ký | CTA trong detail; mobile CTA không che nội dung | Cập nhật deadline/capacity từ server; lỗi hết chỗ rõ |
| `UI-REG-02` Tự hủy/danh sách | List/table 10/trang, action theo row | Confirm tự hủy, không hiển thị hành động khi hết hạn |
| `UI-ATT-01` Điều hành phiên | Desktop 2 vùng `cấu hình/trạng thái` + `QR`; mobile stack | QR chỉ khi open, countdown 30 giây, thao tác phiên tách biệt |
| `UI-ATT-02` Sinh viên điểm danh | **Một cột tối đa ~560px**, các bước rõ ràng | QR → GPS → FaceIO → nút Xác nhận; cảnh báo đỏ theo số điều kiện thiếu; không tự submit |
| `UI-ATT-03` Rà soát/chốt | Bảng kết quả full width + sticky action footer có kiểm soát | Checkbox Check-in/Checkout; stale snapshot → yêu cầu tải lại |
| `UI-STA-01` Điểm/lịch sử cá nhân | KPI 2–3 card khi đủ rộng + list 10/trang | Tách điểm nội bộ và minh chứng, trạng thái chưa chốt |
| `UI-STA-02` Thống kê quản lý | KPI grid cân bằng + filters + table/chart | Trống/denominator 0 hiển thị “—”, không tạo ảo giác số liệu |
| `UI-EVD-01` Nộp minh chứng | Form rõ file preview; danh sách theo tabs | File 10 MB, sửa/rút khi pending, approved/rejected read-only |
| `UI-EVD-02` Duyệt minh chứng | List/detail split khi rộng, mobile stack | Preview file có quyền, điểm hoặc lý do reject trong modal |
| `UI-NOT-01` Chuông | Dropdown có scroll nội bộ; view riêng khi mobile | 5 mới nhất, 10 mỗi lượt, mark all có phản hồi |
| `UI-POST-01` Soạn bài | Editor một cột rộng tối đa ~920px | Preview riêng, upload ảnh 5 MB, trạng thái nháp/đăng/ẩn |
| `UI-POST-02` News Feed | **Một cột nội dung**, max-width ~820px | Rich Text dễ đọc, ảnh không méo, infinite scroll giữ item cũ |

### 8.1. Màn điểm danh — tiêu chí UX bắt buộc

1. Trước khi xác nhận, hiển thị các bước có thể hiểu được: “Mã QR”, “Vị trí”, “Khuôn mặt”, “Xác nhận”. Bước hoàn tất không đồng nghĩa đã điểm danh thành công.
2. Khi thiếu cả GPS và FaceIO: hiện **hai cảnh báo lỗi riêng màu đỏ**. Khi thiếu một: hiện **một cảnh báo tương ứng**. Nút “Xác nhận điểm danh” vẫn nhìn thấy; khi nhấn chưa đủ điều kiện thì không gửi HTTP confirm.
3. Countdown QR/phiên dùng thời gian do server xác nhận; không dùng thời gian máy người dùng để kết luận thành công.
4. Camera/QR view vừa viewport mobile, không có nút nổi che camera, cảnh báo hay xác nhận. Trình duyệt không cho phép camera/GPS: hướng dẫn người dùng cấp quyền hoặc thử lại, không cung cấp đường tắt xác minh.
5. Khi request timeout/mất response: hiển thị trạng thái “Đang kiểm tra kết quả” hoặc yêu cầu tải lại trạng thái, **không tự xác nhận thành công** và không gửi lặp mù.
6. Thành công chỉ sau backend commit và hiển thị đúng “Check-in thành công”/“Check-out thành công” (hoặc nhãn tiếng Việt hoàn toàn “Ghi nhận vào thành công”/“Ghi nhận ra thành công” nếu thống nhất trong sản phẩm).

### 8.2. Form phân công BTC — lưu tạm (CM-007)

- Hiển thị thông báo: **“Danh sách nhiệm vụ đang được lưu tạm trên trình duyệt này. Dữ liệu chỉ được gửi lên hệ thống khi công bố hoạt động.”**
- Mỗi nhiệm vụ là một section có tiêu đề, người phụ trách, loại nhiệm vụ, mô tả và khoảng giờ; desktop có thể chia cột nếu đủ rộng, mobile một cột.
- Xóa/sửa nhiệm vụ trước publish chỉ thay đổi local state/localStorage; không tạo màn chỉnh cấu trúc phân công sau publish.
- Khi xuất bản thành công xóa đúng local draft; khi lỗi giữ nguyên để chỉnh sửa. Đối tượng `leader` áp dụng verification gate của `architecture.md`, không tự mở quyền mới.

## 9. Interaction Rules, thông báo và khả năng phục hồi

- **Quy tắc submit:** chỉ một submit đang chạy trên cùng form, nhưng backend vẫn là nơi chống duplicate; không dùng optimistic success cho publish, duyệt, điểm danh, chốt hoạt động.
- **Form validation:** phản hồi sớm theo trường, error summary đầu form khi có nhiều lỗi; field lỗi có mô tả và focus khi submit thất bại; không chỉ đổi border đỏ.
- **Confirm modal:** dùng cho khóa tài khoản, thay role, hủy đăng ký/hoạt động, publish, duyệt/từ chối, kết thúc/chốt; văn bản nêu rõ đối tượng và hậu quả.
- **Search/filter:** nhập tìm kiếm có debounce hợp lý; filter thay đổi thì đưa pagination về trang 1; tổng số bản ghi lấy từ server; không tự lọc 10 item của trang rồi tuyên bố toàn bộ kết quả.
- **Save draft:** có trạng thái “Chưa lưu”; cảnh báo khi rời trang, reload hoặc đổi tab có nguy cơ mất dữ liệu; không tuyên bố đồng bộ cloud cho dữ liệu localStorage.
- **Stale/409:** đưa thông điệp “Dữ liệu đã thay đổi. Vui lòng tải lại trước khi tiếp tục.”; không tự ghi đè.
- **404/403/401:** từng trạng thái có nội dung phù hợp, không lộ dữ liệu cá nhân hay chi tiết private.
- **Success:** chỉ báo sau phản hồi chính thức; giữ thông tin chính để user hiểu thao tác đã hoàn tất.
- **Loading:** skeleton phù hợp bố cục, không layout shift lớn; nút có spinner và giữ kích thước.
- **Error:** retry ở vùng lỗi, giữ dữ liệu cũ khi infinite-scroll/page 2 thất bại.

### 9.1. Từ điển nhãn trạng thái UI

| Literal kỹ thuật | Nhãn tiếng Việt |
|---|---|
| `draft` | Bản nháp |
| `published` | Đã công bố (hoạt động) / Đã đăng (bài viết) |
| `pending` | Sắp diễn ra (hoạt động) / Chờ duyệt (đề xuất, minh chứng) |
| `progress` | Đang diễn ra |
| `pending_issues` | Đang xử lý sự cố |
| `issues` | Kết thúc do sự cố |
| `pending_completed` | Chờ rà soát hoàn tất |
| `completed` | Hoàn thành |
| `cancelled` | Đã hủy |
| `registered` | Đã đăng ký |
| `missed` | Không hoàn thành |
| `assigned` | Đã phân công |
| `in_progress` | Đang thực hiện |
| `pending_review` | Chờ xác nhận |
| `approved` | Đã duyệt |
| `rejected` | Từ chối |
| `hidden` | Đã ẩn |
| `open` | Đang mở |
| `closed` | Đã đóng |
| `manually_closed` | Đã đóng thủ công |
| `scheduled` | Đã lên lịch |
| `scheduled_reopen` | Đã lên lịch mở lại |
| `locked` | Đã khóa |

Nhãn có thể trùng giữa domain khác nhau nhưng **không thay đổi literal dữ liệu**. Với `active`, `pending_activation`, `pending_faceio`, `student`, `staff`, `leader`, `member`, hiển thị lần lượt là “Đang hoạt động”, “Chờ kích hoạt”, “Chờ đăng ký khuôn mặt”, “Sinh viên”, “Cán bộ/Giảng viên”, “Trưởng BTC”, “Thành viên BTC”; kiểm tra ngữ cảnh và chính sách trong `architecture.md`.

## 10. Responsive và Accessibility

- Mobile-first khi xây page mới; ưu tiên nội dung và hành động thiết yếu. Không giấu chức năng bắt buộc chỉ để giữ bố cục đẹp.
- Keyboard: Tab/Shift+Tab, Enter/Space, Escape hợp lệ; menu, combobox, tab, modal điều khiển được; focus ring rõ.
- Mọi input có `label`; field error có `aria-describedby`, error summary có `aria-live` phù hợp; thao tác nguy hiểm có tên accessible.
- Ảnh bài viết có alt từ nội dung; ảnh chỉ trang trí để alt rỗng; icon button có accessible name tiếng Việt.
- Không chỉ dựa vào hover; tooltip không chứa hướng dẫn duy nhất. Kích thước target tối thiểu 44×44px trên mobile.
- Hỗ trợ `prefers-reduced-motion`; animation ngắn ≤200ms, không cản thao tác. Không tạo auto carousel hoặc chuyển cảnh gây mất focus.
- Test text overflow cho họ tên dài, tên hoạt động dài, lý do từ chối dài, mã tài khoản và địa chỉ; dùng wrap an toàn, không cắt thông tin quan trọng.
- Tại zoom 200% và viewport nhỏ, không mất nút submit, alert, focus, hoặc nội dung modal.
- Khi bàn phím ảo mobile mở, form/camera không bị CTA fixed che; chỉ sử dụng sticky action bar khi đã tính safe-area và không che nội dung.

## 11. Cấu trúc frontend đề xuất (không bắt buộc tạo trước mọi file)

```text
frontend/
  src/
    app/                     # Next.js routes, route groups và layout thực tế
    components/
      ui/                    # Thành phần nền tái sử dụng
      shared/                # Header, sidebar, breadcrumb, page states
      features/              # Components theo chức năng
    features/                # Hooks/queries/form logic theo module UI, khi cần
    styles/                  # Design tokens/global styles
    lib/                     # Utilities đơn giản, không chứa nghiệp vụ server
```

- Không đổi cấu trúc project đang hoạt động chỉ để trùng sơ đồ. Tuân thủ Next.js App Router hoặc cấu trúc thực tế được dự án sử dụng.
- Không nhúng status/permission logic trùng nhau vào nhiều component; lấy từ `architecture.md` và API, ánh xạ nhãn ở một chỗ.
- Component UI **không quyết định quyền cuối cùng**; UI ẩn/disable theo quyền được trả về nhưng backend vẫn validate.
- Không tạo bộ component tự chế phức tạp khi thư viện hiện tại đáp ứng; tái sử dụng tokens và pattern trước khi thiết kế mới.

## 12. Quy trình dành cho Codex + skill `ui-ux-promax`

1. Đọc `docs/architecture.md` phần nghiệp vụ và màn hình tương ứng; xác định vai trò, trạng thái, trường dữ liệu, hành động được phép.
2. Đọc `docs/ui-design.md`, áp dụng tokens, grid, layout và interaction trong file này.
3. Kiểm tra code/frontend dependencies hiện tại; dùng skill **`ui-ux-promax` đã cài sẵn** để hỗ trợ lựa chọn bố cục, phân cấp nội dung và polish UI. **Không cài thêm skill hoặc sửa config skill khi chưa được yêu cầu.**
4. Triển khai một vertical slice hoạt động end-to-end; component cần đầy đủ loading, empty, error, success/forbidden/stale theo ngữ cảnh.
5. Kiểm tra desktop/mobile, keyboard/focus, text tiếng Việt dài, overflow, accessibility và tích hợp API. Nếu có xung đột giữa output của skill và `architecture.md`/tài liệu này thì ưu tiên tài liệu dự án.
6. Kết thúc công việc: liệt kê màn đã làm, các breakpoint đã kiểm, lệnh test thực tế đã chạy và giới hạn còn tồn tại. Không nói đã test nếu chưa chạy.

## 13. Checklist nghiệm thu UI (Definition of Done)

- [ ] Tất cả nội dung giao diện dành cho người dùng bằng **tiếng Việt**, không lộ status literal/technical error nội bộ.
- [ ] Tông xanh–trắng nhất quán, dễ đọc; không khẳng định token đề xuất là bộ nhận diện chính thức.
- [ ] Grid responsive, gutter/gap đều; không chồng lấn, chèn ép hoặc horizontal overflow toàn trang ở `320/375/390/768/1024/1280/1440px`.
- [ ] Form 2 cột chỉ khi đủ rộng, mobile stack 1 cột; table có scroll cục bộ; modal không tràn viewport.
- [ ] Mọi CTA, menu, màn và component đúng quyền/trạng thái trong `architecture.md`, không tự phát sinh chức năng.
- [ ] Có loading, empty, error, forbidden và xử lý stale/retry phù hợp từng màn.
- [ ] Confirm các hành động quan trọng; không tuyên bố thành công trước phản hồi backend.
- [ ] Luồng điểm danh giữ QR/GPS/FaceIO + nút xác nhận và cảnh báo thiếu điều kiện; không submit tự động.
- [ ] Keyboard/focus, contrast, accessible labels, target chạm mobile đạt yêu cầu.
- [ ] Dùng được trên trình duyệt desktop/mobile thực tế hoặc môi trường test phù hợp; các bước chưa kiểm thử được nêu rõ.

---

**Ghi chú bảo trì:** Khi bổ sung một màn hình mới, cập nhật mapping UI trong file này và nghiệp vụ tương ứng trong `architecture.md` nếu thực sự thay đổi. Không dùng UI file để thay đổi quy tắc nghiệp vụ, quyền, trạng thái hay database.
