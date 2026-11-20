# CM UTE — KIẾN TRÚC HỆ THỐNG QUẢN LÝ HOẠT ĐỘNG CỘNG ĐỒNG

> **Tài liệu:** `architecture.md`  
> **Trạng thái:** Kiến trúc mục tiêu phục vụ triển khai; các quyết định cần phê duyệt nghiệp vụ được đánh dấu rõ.  
> **Hệ thống:** Quản lý các hoạt động cộng đồng — Trường Đại học Sư phạm Kỹ thuật.  
> **Tech Stack:** Next.js (responsive web), NestJS (Modular Monolith), Prisma 7, MySQL 8/InnoDB, Redis, FaceIO, Email và Private File Storage.  
> **Phạm vi:** 11 module nghiệp vụ, đúng 17 bảng MySQL.  
> **Ngôn ngữ:** Diễn giải bằng tiếng Việt chuyên ngành CNTT; giữ nguyên identifiers, API contract, SQL, code và những thuật ngữ chuyên ngành thông dụng.

## 1. Quy ước nguồn chuẩn duy nhất và quyết định kiến trúc

**Tài liệu chuẩn duy nhất để phát triển nghiệp vụ và kiến trúc:** chính `docs/architecture.md` này. Nội dung ở các chương dưới đây bao gồm đặc tả chức năng, kiến trúc, hợp đồng dữ liệu SQL và các quy tắc triển khai. Các tài liệu tiền nhiệm đã được đối chiếu khi biên soạn nhưng **không phải dependency** của Agent khi coding.

**Thứ tự áp dụng khi có sai khác nội bộ:** (1) quyết định nghiệp vụ đã được xác nhận và các điều kiện chặn tại §1.2 / §18; (2) hợp đồng dữ liệu DDL nhúng tại §15 đối với cấu trúc vật lý; (3) đặc tả chức năng tại §14 đối với hành vi người dùng; (4) các chính sách kiến trúc §§2–13; (5) quy tắc API và nghiệm thu tại §§16–17. Khi mâu thuẫn vẫn tồn tại, không được tự chọn theo cảm tính: ghi nhận điểm xung đột và chỉ dừng phần phụ thuộc.

**Phân biệt ba mức độ:** `MUST` = bắt buộc triển khai; `DESIGN DECISION` = phương án kiến trúc trong tài liệu; `BLOCKED` = chưa có đủ quyết định nghiệp vụ, không được âm thầm hợp thức hóa. SQL DDL nhúng là **target contract**, không chứng minh cơ sở dữ liệu runtime đã khớp hoặc migration đã chạy.

### 1.1. Phạm vi hệ thống

- Website Next.js responsive và NestJS Modular Monolith, Prisma 7, MySQL 8/InnoDB, Redis, FaceIO, email, private storage.
- 11 module và 17 bảng được định nghĩa đầy đủ trong chính tài liệu này; không tự thêm bảng/cột/role/workflow.
- Ba mã vai trò lưu ở `vai_tro.ten_vai_tro`: `admin` (Admin), `staff` (Quản lý), `user` (Người dùng). `nguoi_dung.loai_nguoi_dung=student|staff` vẫn là loại người dùng độc lập; mã `staff` ở hai trường có nghĩa khác nhau.
- Không tạo tài khoản tự do; Admin cấp tài khoản. Không ngầm cấp quyền vận hành điểm danh cho Admin.

### 1.2. Nhật ký quyết định kiến trúc (ADR)

| ADR | Quyết định và cơ sở | Trạng thái |
|---|---|---|
| `ADR-01` — Quyền Trưởng BTC | Chỉ tài khoản **Quản lý `active`** được phân công `leader`; đây là trách nhiệm theo hoạt động, không phải vai trò hệ thống thứ tư. Phương án tạm định bảo thủ để tránh cấp quyền operator khi `AUTH-LEADER` chưa được duyệt; phải xin xác nhận nghiệp vụ cuối cùng trước khi triển khai guard. | **Tạm định — cần phê duyệt nghiệp vụ** |
| `ADR-02` — Vòng đời phân công | CM-007 thay thế nghiệp vụ CRUD phân công cũ của TX-04. Trong `draft`, dữ liệu phân công chỉ lưu frontend state/localStorage; khi publish, toàn bộ nhiệm vụ mới được insert atomically. Sau publish không sửa/hủy cấu trúc, người phụ trách hoặc thời gian; trạng thái tiến độ chỉ gồm `assigned`, `in_progress`, `pending_review`, `completed`. | Áp dụng |
| `ADR-03` — Thông báo | Có đúng 11 loại `NOTI-01/02/03/04/05/10/11/12/13/14/15`. Loại bỏ luồng `NOTI-07/08`. `NOTI-03` chỉ phát khi publish thành công. | Áp dụng |
| `ADR-04` — Schema vật lý | `bai_dang.thoi_gian_dang DATETIME NULL DEFAULT NULL` đã có trong DDL được cung cấp. Không tự tạo migration lặp; phải so sánh DB thực tế với DDL. `chi_tiet_hoat_dong` không có `id_nguoi_dung`. | Áp dụng |
| `ADR-05` — Chống tự duyệt | DDL tại §15 **không có** `CHECK (id_nguoi_duyet <> id_nguoi_nop)` dù có mô tả quy tắc này ở tầng ứng dụng. Backend bắt buộc kiểm tra trong transaction; không tuyên bố DB đã bảo vệ. Mọi thay đổi DDL phải được phê duyệt riêng. | Áp dụng |
| `ADR-06` — Metadata bài đăng | `bai_dang.noi_dung` lưu JSON envelope có version, HTML đã sanitize và `lastEditedAt` (UTC ISO hoặc `null`), không thêm cột. `thoi_gian_dang` giữ thời điểm công bố lần đầu. | Áp dụng — codec tại §10 |
| `ADR-07` — Tính nhất quán xuyên hệ | MySQL là nguồn sự thật nghiệp vụ/notification; Redis quản lý session, ticket và proof dùng một lần. Không giả định Distributed Transaction hay exactly-once giữa MySQL và Redis. Cần fail-closed và recovery có kiểm soát. | Áp dụng |
| `ADR-08` — Phụ thuộc module | Một ứng dụng Modular Monolith, dùng public port và application orchestration qua composition root. Không tạo vòng NestJS Dependency Injection, không dùng `forwardRef()` để che vòng, không thêm queue/event bus/outbox table. | Áp dụng |
| `ADR-09` — Thời gian nhiệm vụ nullable | Khi `thoi_gian_bat_dau` hoặc `thoi_gian_ket_thuc` là `NULL`, khoảng hiệu lực mặc định theo `[startAt,endAt)` của hoạt động để kiểm tra trùng lịch; hai mốc có giá trị phải hợp lệ và nằm trong khoảng hoạt động. Đây là **diễn giải kỹ thuật tạm định**, phải xin xác nhận nghiệp vụ trước khi triển khai phần kiểm tra lịch. | **Tạm định — cần kiểm chứng BR** |
| `ADR-10` — Scheduler và rà soát | API và Scheduler gọi chung application use case/state transition. Scheduler trễ không kéo dài deadline. Auto-finalize dựa trên dữ liệu đã commit; manual review phải kiểm snapshot để chống ghi đè dữ liệu mới. | Áp dụng |

**Nguyên tắc:** `ADR-01`, `ADR-09` và số lượng `leader` là các điểm chưa được chủ dự án xác nhận cuối cùng. Phải làm rõ trước khi code guard phụ thuộc; không tự coi lựa chọn thiết kế là yêu cầu đã phê duyệt.

### 1.3. Các ràng buộc kiến trúc bắt buộc

- Chỉ có ba vai trò tài khoản: `Admin`, `Quản lý`, `Người dùng cuối`; mỗi tài khoản tại một thời điểm có đúng một vai trò. Khoa là thông tin hồ sơ, không phải phạm vi phân quyền.
- Người dùng cuối `student` được đăng ký, điểm danh và nộp minh chứng; `staff` có thể nhận nhiệm vụ BTC loại `member`, không được đăng ký nhận điểm như sinh viên.
- Không có self-registration; Admin tạo/import tài khoản. Admin không mặc nhiên là operator điểm danh.
- Không tự thêm bảng, cột, UNIQUE, bộ đếm, lịch sử phân công/audit, outbox, session/proof table hoặc notification mới nếu chưa có phê duyệt thay đổi phạm vi.
- Không bắt buộc native app, WebSocket, Microservices hay Distributed Event Bus.
- Frontend không quyết định cuối cùng về quyền, thời gian nghiệp vụ, sức chứa, GPS, proof hoặc state transition.

## 2. Kiến trúc runtime và triển khai

```text
Browser (Next.js responsive web; cookie session; local assignment draft)
       |
       | HTTPS /api/v1 (same-site hoặc cross-origin có kiểm soát CSRF)
       v
NestJS HTTP API / Scheduler (cùng codebase)
       |-- Controllers + DTO + Guards
       |-- Application Use Cases / Transaction Coordinators
       |-- Domain Policies + State Transitions
       |-- Module-owned Repositories (Prisma)
       |          `--> MySQL 8 / InnoDB (17 tables; nguồn dữ liệu chính thức)
       |-- Redis Adapter --> Redis (sessions, preauth, proofs, rate limit)
       |-- FaceIO Adapter --> trusted FaceIO provider
       |-- Email Adapter --> SMTP/provider
       `-- Storage Adapter --> Private File Storage
```

- Backend triển khai như một ứng dụng thống nhất. Scheduler có thể cùng process hoặc trên worker được chỉ định, nhưng luôn dùng chung application use case. An toàn khi chạy nhiều instance dựa vào MySQL locks, không dựa vào mutex trong bộ nhớ của một process.
- Khi khởi động phải validate secrets, timezone kết nối MySQL, yêu cầu Redis, cấu hình storage, HTTPS/cookie, FaceIO và Email. Không commit secret vào repository.
- API prefix `/api/v1`; DTO JSON dùng `camelCase`; giữ nguyên tên bảng/cột tiếng Việt `snake_case` trong DB, ánh xạ Prisma bằng `@map`/`@@map` nếu cần. Error envelope: `{code,message,requestId,details?}`.
- Mọi instant lưu dưới dạng UTC trong MySQL `DATETIME`; đặt MySQL session `time_zone='+00:00'`, bao gồm giá trị `DEFAULT CURRENT_TIMESTAMP`. API trả ISO-8601 UTC có `Z`. BusinessClock dùng `Asia/Ho_Chi_Minh` để tính mốc nghiệp vụ. SQL `DATE` là ngày lịch, không phải instant.

## 3. Tổ chức mã nguồn và ranh giới module

```text
frontend/
  app/                       # routes, pages, layouts
  features/                  # UI theo chức năng
  shared/                    # API client, components, styles, localization
backend/
  prisma/
    schema.prisma
    migrations/
    seed.ts
  src/
    main.ts
    app.module.ts
    common/
      constants/             # statuses, roles, error codes
      clock/                 # BusinessClock
      authz/                 # guards, current principal, shared policies
      errors/                # error mapping, request ID
    infrastructure/
      database/              # Prisma Client, transaction runner
      redis/                 # atomic scripts, session/proof adapters
      faceio/
      email/
      storage/
      scheduler/
    modules/
      auth/
      users/
      activities/
      proposals/
      assignments/
      registrations/
      attendance/
      evidence/
      notifications/
      statistics/
      posts/
  test/
    unit/
    integration/
    concurrency/
```

Module chỉ tạo thành phần cần dùng: `controllers`, `dto`, `application`, `domain`, `repositories`, `tests`. Không tạo file rỗng hoặc abstraction không có nhu cầu thực tế. `common` chứa primitive dùng chung; `infrastructure` chứa adapter, không chứa Business Rule.

### 3.1. Quyền sở hữu dữ liệu — đúng 17 bảng

| Module | Bảng vật lý thuộc sở hữu |
|---|---|
| `users` | `khoa`, `vai_tro`, `nguoi_dung` |
| `auth` | `thong_tin_sinh_trac` |
| `posts` | `bai_dang` |
| `proposals` | `don_vi_ben_ngoai`, `de_xuat_hoat_dong` |
| `activities` | `hoat_dong`, `chi_tiet_hoat_dong` |
| `registrations` | `dang_ky_hoat_dong` |
| `assignments` | `phan_cong_nhiem_vu` |
| `attendance` | `phien_diem_danh`, `ket_qua_diem_danh` |
| `evidence` | `minh_chung_hoat_dong`, `diem_minh_chung` |
| `notifications` | `thong_bao`, `nguoi_nhan_thong_bao` |
| `statistics` | Không sở hữu bảng; chỉ sử dụng read-only query contract |

- Write Repository của module chỉ được thay đổi các bảng do module đó sở hữu. Use case liên module gọi public port của module sở hữu, truyền `TransactionContext` nếu đang trong cùng transaction.
- Transaction được điều phối tại use case khởi tạo: ví dụ publish thuộc `activities`, confirm thuộc `attendance`, finalize thuộc `activities`. Acquire lock theo thứ tự chung rồi gọi transaction participant; không mở Prisma transaction lồng nhau khi đã nhận `tx`.
- Tránh circular dependency bằng interface/token liên kết tại composition root, không inject hai chiều feature service. Có thể tách policy thành pure function. `statistics` được phép dùng read-only JOIN adapter có phạm vi rõ ràng, không được ghi chéo bảng.
- Endpoint public chỉ truy cập projection công khai; private file, notification và draft phải kiểm tra owner/role.

### 3.2. Hợp đồng phối hợp liên module

| Use case chủ | Thành phần tham gia và trách nhiệm |
|---|---|
| `activities.publish` | `users` kiểm quyền/khóa, `assignments` validate/insert, `registrations` kiểm xung đột, `notifications` append |
| `registrations.register` | `users` kiểm sinh viên active, `activities` kiểm trạng thái/sức chứa dưới lock, `assignments` kiểm BTC conflict, `registrations` insert |
| `attendance.confirm` | `auth` xác minh proof mới, `users` bảo mật, `activities` trạng thái, `registrations` bản ghi đã khóa, `attendance` insert kết quả |
| `activities.finalize` | `activities` trạng thái, `attendance` kết quả rà soát, `registrations` cập nhật, `notifications` append |
| `evidence.review` | `users` kiểm reviewer/owner, `evidence` trạng thái + điểm, `notifications` append |
| `auth.securityMutation` | `users` cập nhật MySQL có thẩm quyền, `auth` thu hồi Redis session và guard fencing |

## 4. Kiến trúc dữ liệu và các bất biến (Invariants)

### 4.1. Sự thật vật lý đối chiếu từ DDL tại §15

- DDL định nghĩa đúng **17 bảng** InnoDB; database dùng `utf8mb4_unicode_ci`.
- `nguoi_dung`: UNIQUE `ten_dang_nhap`, `email`; FK role/khoa; `mat_khau NOT NULL`. Cột `trang_thai` mặc định SQL là `active`, nhưng nghiệp vụ cấp tài khoản phải **ghi tường minh** `pending_activation`.
- `thong_tin_sinh_trac`: UNIQUE `id_nguoi_dung` và `id_khuon_mat`.
- `hoat_dong.id_de_xuat` nullable + UNIQUE; `chi_tiet_hoat_dong.id_hoat_dong` UNIQUE. Không được insert chi tiết khi thiếu hai mốc bắt buộc `thoi_gian_bat_dau`, `thoi_gian_ket_thuc`.
- `dang_ky_hoat_dong`: UNIQUE `(id_nguoi_dung,id_hoat_dong)`; `ket_qua_diem_danh`: UNIQUE `(id_phien_diem_danh,id_dang_ky)`; `diem_minh_chung`: UNIQUE `id_minh_chung`; `nguoi_nhan_thong_bao`: composite PRIMARY KEY `(id_thong_bao,id_nguoi_dung)`.
- `phan_cong_nhiem_vu` không có UNIQUE chống trùng lịch; `loai_nhiem_vu`, `thoi_gian_bat_dau`, `thoi_gian_ket_thuc` đều nullable.
- `phien_diem_danh` không có UNIQUE `(id_chi_tiet_hoat_dong,loai_diem_danh)`; nghiệp vụ GPS bắt buộc do backend bảo vệ dù SQL mặc định `yeu_cau_gps=FALSE`.
- `minh_chung_hoat_dong.don_vi_to_chuc` và `ngay_tham_gia` nullable ở SQL nhưng bắt buộc trong luồng nộp hồ sơ mới.
- `bai_dang.thoi_gian_dang` là `DATETIME NULL DEFAULT NULL`; `bai_dang.noi_dung` là `TEXT NOT NULL`; `de_xuat_hoat_dong.thoi_gian_du_kien` là `DATETIME NULL`.
- SQL **không có** self-review CHECK và UNIQUE cho identity `NOTI-15`; invariant phải được triển khai tại application layer theo lock protocol. FK có thể sinh implicit lock, bắt buộc kiểm tra bằng InnoDB thật.

### 4.2. Chính sách Prisma và migration

1. Tạo/kiểm tra Prisma models từ DDL, bảo toàn tên bảng/cột, FK action, index, native types, default và nullability. Các cột `trang_thai`, `loai_*` là `VARCHAR`, **không** tự chuyển thành MySQL `ENUM`.
2. Đối chiếu schema DB đang chạy với DDL tại §15 và lịch sử Prisma migration trước mọi thay đổi. Không dùng `db push` gây thay đổi ngoài phê duyệt, không tạo lại migration cho `thoi_gian_dang` đã đúng.
3. Seed đúng ba tên vai trò; lookup bằng `vai_tro.ten_vai_tro`, không hardcode ID số.
4. Điểm nội bộ được tính từ dữ liệu gốc, không tạo bảng điểm mới.
5. Giữ độ chính xác GPS `DECIMAL(10,7)` trước bước tính khoảng cách; validate vĩ độ `[-90,90]`, kinh độ `[-180,180]`, các giá trị phải hữu hạn.

### 4.3. Từ điển trạng thái (Status Dictionary)

| Thực thể | Literal hợp lệ ở Backend |
|---|---|
| Tài khoản | `pending_activation`, `pending_faceio`, `active`, `locked` |
| Loại người dùng | `student`, `staff` (`NULL` legacy không cấp quyền sinh viên) |
| Hoạt động | `draft`, `published`, `pending`, `progress`, `pending_issues`, `issues`, `pending_completed`, `completed`, `cancelled` |
| Loại nhiệm vụ | `leader`, `member` (`NULL` không bao giờ cấp quyền leader) |
| Trạng thái nhiệm vụ | `assigned`, `in_progress`, `pending_review`, `completed` (**không có** `cancelled`) |
| Đăng ký | `registered`, `completed`, `missed` (tự hủy = hard delete) |
| Phiên điểm danh | `scheduled`, `open`, `closed`, `manually_closed`, `scheduled_reopen`, `locked` |
| Loại điểm danh | `check_in`, `check_out` |
| Đề xuất / Minh chứng | `pending`, `approved`, `rejected` |
| Bài đăng | `draft`, `published`, `hidden` |
| Thông báo | `NOTI-01`, `NOTI-02`, `NOTI-03`, `NOTI-04`, `NOTI-05`, `NOTI-10`, `NOTI-11`, `NOTI-12`, `NOTI-13`, `NOTI-14`, `NOTI-15` |

Dùng một nguồn backend constants/validator thống nhất; frontend chỉ sử dụng đúng literal API. SQL cho phép `NULL` không có nghĩa nghiệp vụ cho phép `NULL` với dữ liệu mới. `don_vi_ben_ngoai.loai_don_vi` là chuỗi mô tả có kiểm tra độ dài, không phải enum đóng.

## 5. Phân quyền, xác thực và định danh

### 5.1. Chính sách truy cập

| Chức năng | Chủ thể có quyền | Điều kiện phải kiểm |
|---|---|---|
| Tạo/import/khóa/đổi vai trò tài khoản | `Admin` active | Không tự khóa/khóa Admin khác; kiểm quy tắc đổi vai trò |
| Tạo/sửa/công bố hoạt động | `Manager` active | State, phạm vi được phê duyệt và publish payload |
| Phân công `leader` khi publish | Ứng viên `Manager` active | `ADR-01` tạm định; phải có assignment đúng hoạt động |
| Thực hiện nhiệm vụ BTC | Tài khoản active được phân công | ID, người nhận, trạng thái, thời gian và điều kiện hoạt động |
| Duyệt nhiệm vụ BTC | `leader` là Manager active; Manager active khác khi leader bị `locked` | Ngoại lệ chỉ cho **duyệt nhiệm vụ**, không tự chuyển quyền operator |
| Điều hành phiên/rà soát điểm danh | `Manager` active hoặc `leader` active được ủy quyền | Operator policy và hoạt động hiện hành; không fallback tự động do leader bị khóa |
| Đăng ký/tự hủy/xác nhận điểm danh | End User `student` active | Đúng chủ thể, đăng ký, deadline, GPS/FaceIO proof |
| Nộp/rút minh chứng | End User `student` active | Owner và `pending` |
| Duyệt minh chứng | `Manager` active | Không tự duyệt, hồ sơ `pending` |
| Quản lý bài đăng | `Manager` active (bài của mình); `Admin` active (mọi bài) | Author, role, state |

Mọi đường ghi phải kiểm lại account state/role từ MySQL, không tin session snapshot. Chặn hạ `Manager→End User` nếu còn nhiệm vụ `leader` ở hoạt động chưa kết thúc `completed/cancelled/issues`. Admin vẫn có thể khóa leader; nhiệm vụ không bị xóa/chuyển người. Leader đã khóa không được điều hành điểm danh.

### 5.2. Vòng đời Authentication

```text
Admin provision → pending_activation
  → activation token + đặt mật khẩu → pending_faceio
  → FaceIO enrollment thành công → active
  → password login → preauth ngắn hạn → FaceIO verification
  → authenticated Redis session (mỗi thiết bị một SID)

Admin khóa tài khoản active → locked
Admin mở khóa → active (khi đáp ứng điều kiện credential/face)
```

- Hash mật khẩu bằng Argon2id; tài khoản mới có hash bí mật ngẫu nhiên không thể đăng nhập, tuyệt đối không dùng mật khẩu mặc định chung.
- TTL: activation **24 giờ**, reset password/FaceIO **30 phút**, preauth **5 phút**, session idle **30 phút**. Mỗi phiên đăng nhập mới bắt buộc mật khẩu và FaceIO.
- Sai mật khẩu 5 lần trong cửa sổ 15 phút → tạm chặn cấp phiên mới 15 phút bằng Redis; **không** chuyển tài khoản SQL thành `locked`.
- SID là giá trị opaque được tạo bằng CSPRNG, lưu trong cookie `HttpOnly`, `Secure` khi HTTPS, `SameSite` phù hợp và kiểm CSRF/Origin. Không lưu raw session secret trong localStorage/log.
- Chỉ user-initiated action hợp lệ mới refresh idle TTL; background request không làm mới. Guard kiểm Redis session và fingerprint/trạng thái hiện hành từ MySQL; Redis unavailable phải fail-closed.

### 5.3. Giao thức nhất quán bảo mật Redis–MySQL

**Không có atomic transaction xuyên MySQL và Redis.** Áp dụng giao thức dựa trên kiểm tra authoritative MySQL:

1. Trước cấp phiên, backend kiểm credential và FaceIO qua trusted adapter, sau đó cấp preauth ticket ngắn hạn trong Redis.
2. Khi login hoàn tất, đọc lại trạng thái bảo mật từ MySQL, đối chiếu HMAC fingerprint được tính từ password hash, role, trạng thái tài khoản và `id_khuon_mat`; consume preauth và tạo session/index atomically trong Redis. Session được cấp cạnh tranh với thay đổi bảo mật phải bị chặn ở guard kế tiếp nếu fingerprint khác.
3. Khi khóa tài khoản/đổi mật khẩu, role hoặc FaceIO: lock user row trong MySQL, commit thay đổi hợp lệ, sau đó thu hồi Redis sessions/preauth atomically. Guard vẫn phải kiểm dữ liệu hiện hành dù revoke chưa hoàn tất; Redis lỗi không được báo revoke thành công giả.
4. FaceIO enroll/reset chạy **ngoài transaction**; nếu provider hoặc SQL thất bại, không công bố đổi khuôn mặt thành công. Reset token dùng Redis claim lease với claim ID riêng; chỉ consume sau DB commit, retry phải kiểm trạng thái mới để tránh ghi lặp.
5. Request không xác minh được phiên/proof không được ghi nghiệp vụ. Cleanup Redis index/script phải idempotent, không cần bảng SQL mới.

**Giới hạn:** Một guard vừa đọc xong trước thay đổi bảo mật không tự tạo bảo đảm linearizability. Đường ghi nhạy cảm bắt buộc lock/read lại user **bên trong chính transaction ghi** để serialize với thao tác khóa/đổi role.

## 6. State Machine và quy tắc thời gian

### 6.1. Vòng đời hoạt động

```text
draft --publish--> published --00:00 local D-1--> pending --startAt--> progress
published|pending --cancel before startAt--> cancelled  (terminal)
progress --incident--> pending_issues --resume before endAt--> progress
pending_issues --end/close--> issues                 (terminal)
progress --end/valid early end--> pending_completed
pending_completed --review/finalize--> completed    (terminal)
```

- Publish cần `chi_tiet_hoat_dong` hợp lệ (start/end, địa điểm, tọa độ, kế hoạch), ít nhất một nhiệm vụ và đủ số lượng `leader` theo quyết định đã duyệt. **Số lượng leader/hoạt động chưa xác nhận nghiệp vụ** trước khi khóa guard.
- Draft chỉ bắt buộc tên; không insert `chi_tiet_hoat_dong` nếu thiếu hai thời gian `NOT NULL`.
- Sinh viên đăng ký/tự hủy chỉ khi `now < startOfLocalDay(D−1)` với D là ngày bắt đầu hoạt động, và trạng thái cho phép theo spec (`published`). Scheduler trễ không gia hạn.
- Sửa start sau publish: **cả** `oldStart-now >= 48h` và `newStart-now >= 48h` theo thời lượng thực. Nhiệm vụ BTC bất biến; nếu lịch mới xung đột khoảng nhiệm vụ thì từ chối, không tự sửa nhiệm vụ.
- Kết thúc sớm không ghi đè `chi_tiet_hoat_dong.thoi_gian_ket_thuc` cấu hình. Auto-finalize dựa trên ngày sau ngày kết thúc đã cấu hình. `cancelled/issues` không tự tính điểm nội bộ.

### 6.2. Trạng thái nghiệp vụ khác

| Thực thể | Transition hoặc thao tác cho phép |
|---|---|
| Nhiệm vụ | `assigned→in_progress→pending_review→completed`; `pending_review→in_progress` khi yêu cầu làm lại. Không hủy/sửa cấu trúc sau publish. |
| Đề xuất | `pending→approved` hoặc `pending→rejected`; mỗi đề xuất approved gắn tối đa một hoạt động qua UNIQUE `hoat_dong.id_de_xuat`. |
| Đăng ký | Insert `registered`; tự hủy = hard delete khi còn hạn; finalize `registered→completed/missed`. |
| Minh chứng | Tạo `pending`; owner sửa/rút khi pending; `pending→approved/rejected`; approve insert một `diem_minh_chung`. |
| Bài đăng | `draft→published↔hidden`; sửa theo quyền/role; publish lần đầu mới ghi thời gian; hard delete khi được phép. |

Mọi transition đều theo nguyên tắc: `current state + actor policy + backend now + input guards → next state + atomic writes`. Với state cũ hoặc transition không hợp lệ, trả `409 STATE_CONFLICT`; frontend không được tự thay đổi trạng thái chính thức.

### 6.3. Phiên điểm danh

- Mỗi `(chi_tiet_hoat_dong, check_in|check_out)` có tối đa **một phiên**, bảo vệ bằng parent row lock và re-query, không dựa vào UNIQUE chưa tồn tại.
- Check-in mở không sớm hơn `activityStart−2h`, đóng không muộn hơn `activityEnd`; Checkout mở không sớm hơn start và đóng không muộn hơn `activityEnd+2h`. Thời lượng phiên ≥5 phút, hai phiên không overlap.
- State: `scheduled→open→closed` theo thời gian; `open→manually_closed` khi operator đóng; `closed/manually_closed` có thể mở lại hợp lệ ngay hoặc `→scheduled_reopen→open`. Lần Checkout mở đầu tiên phải chuyển Check-in sang `locked` trong **cùng transaction**, ngăn mở lại.
- Không điểm danh trong sự cố hoặc khi phiên đã hết giờ, bất kể QR còn hiển thị hay Scheduler chậm.
- `pending_completed` có thể còn Checkout trong khung giờ được phép; không finalize khi Checkout hợp lệ đang `open`.

### 6.4. Các Scheduler Job

| Job | Mốc kích hoạt theo giờ Việt Nam | Use case dùng chung |
|---|---|---|
| `ActivityPendingJob` | 00:00 D−1 | `published→pending` |
| `ActivityStartJob` | `startAt` | `pending→progress` |
| `ActivityEndJob` | `endAt` đã cấu hình | Kết thúc hoạt động hoặc chuyển sự cố |
| `AttendanceOpenJob` | Start của phiên | Mở phiên `scheduled` hợp lệ |
| `AttendanceCloseJob` | End của phiên | Đóng phiên `open` hợp lệ |
| `ActivityFinalizeJob` | Kết thúc toàn bộ ngày D+1 theo lịch VN | Finalize kết quả đã commit một lần |
| `ActivityReminderJob` | 00:00 ngày diễn ra; catch-up trước start | Phát `NOTI-15` tối đa một lần/activity/ngày |

Scheduler chỉ tìm ứng viên; mọi quyết định phải recheck dưới DB lock. Có thể dùng một worker được chỉ định để đơn giản vận hành, nhưng khi chạy trùng/restart kết quả vẫn phải đúng. Mốc hết ngày D+1 được biểu diễn chính xác là **00:00 ngày D+2**, không phụ thuộc độ chính xác `23:59:59`.

## 7. Transaction, khóa dữ liệu và Idempotency

### 7.1. Thứ tự khóa toàn hệ thống (`CON-01`)

```text
nguoi_dung (ID tăng dần; tất cả user liên quan)
  → hoat_dong
  → chi_tiet_hoat_dong
  → phien_diem_danh (check_in trước check_out; ID tăng dần)
  → dang_ky_hoat_dong → ket_qua_diem_danh
  → proposal/evidence/post record thuộc module nguồn (khi cần)
  → thong_bao → nguoi_nhan_thong_bao
```

Với proposal/evidence/post không cần hoạt động, khóa user liên quan trước row nghiệp vụ. FK/UNIQUE có thể gây implicit lock; phải test trên MySQL InnoDB thật. Transaction dùng `READ COMMITTED` và `SELECT ... FOR UPDATE` qua Prisma `$queryRaw` tham số hóa; **luôn đọc lại sau lock**, không chỉ dựa trên preflight check.

Mọi luồng cạnh tranh cùng một invariant phải khóa cùng parent: user nộp cho evidence dedup, assignee user cho lịch giữa nhiều hoạt động, activity cho capacity và BTC/registration conflict, activity detail cho loại phiên điểm danh.

**Serialize lịch liên hoạt động:** sort và lock tất cả `nguoi_dung.id_nguoi_dung` liên quan trước khi đọc nhiệm vụ hiện hành. Mọi publish có cùng assignee phải đi qua cùng giao thức. Tính khoảng thời gian hiệu lực theo `ADR-09`; từ chối overlap khi `a.start < b.end && b.start < a.end` với half-open interval `[start,end)`. Cách này chống phantom concurrent insert **chỉ khi tất cả đường ghi đều tuân lock protocol**, cần kiểm chứng bằng race test.

### 7.2. Ma trận transaction

| TX | Use case | Lock và write set bắt buộc |
|---|---|---|
| `TX-PUBLISH` | Công bố draft | Khóa assignee user (và actor nếu cần) → activity → detail; recheck role/state/registration/lịch; insert assignments, đổi `published`, append đúng một `NOTI-03` và recipient distinct trong **cùng MySQL transaction**. |
| `TX-REG` | Đăng ký/tự hủy | Student user → activity → registration; kiểm deadline/state/capacity và BTC conflict; insert/hard delete đăng ký. |
| `TX-ATT-SESSION` | Tạo/mở/đóng phiên | Operator user → activity → detail → session hiện có; kiểm số lượng mỗi loại, khung giờ, overlap; Checkout mở lần đầu phải lock Check-in. |
| `TX-ATT-CONFIRM` | Xác nhận điểm danh | User → activity → detail → session → registration → result; kiểm proof fresh, state/time, Checkout cần Check-in; insert một kết quả. |
| `TX-REVIEW` | Rà soát thủ công | Operator user → activity → detail → sessions → registrations/results; kiểm snapshot; chỉ ghi thay đổi thực, không giả dữ liệu GPS/FaceIO. |
| `TX-FINALIZE` | Chốt kết quả | Operator user nếu manual → activity → detail → sessions → registrations/results; tính completed/missed, notification và chuyển completed atomically. |
| `TX-ACT-TRANSITION` | Hủy/sự cố/tiếp tục/kết thúc sớm/sửa | Actor user → activity → detail/sessions liên quan; recheck state/time và chỉ phát đúng notification cho transition thực. |
| `TX-PROPOSAL` | Duyệt/tạo hoạt động từ đề xuất | Manager user → proposal (+ activity khi cần); kiểm state và UNIQUE liên kết đề xuất approved. |
| `TX-EVIDENCE` | Nộp/sửa/rút/duyệt minh chứng | Submitter user (reviewer nếu cần) → evidence; kiểm trùng chuẩn hóa dưới submitter lock; approve insert điểm + notification. |
| `TX-POST` | Đăng/sửa/ẩn/xóa bài | Actor user → post; sanitize trước transaction; kiểm state/owner; cập nhật nội dung và metadata. |
| `TX-NOTI-REMINDER` | `NOTI-15` | Lock activity → tìm event cùng activity/type/day → insert event và recipient nếu chưa có. |

**Quy trình áp dụng:** thay thế đường CRUD phân công trước đây theo CM-007. Thay bằng `TX-PUBLISH`; không tạo assignment CRUD/cancel hoặc `NOTI-07/08`.

### 7.3. Retry và recovery

- Với DB deadlock/lock timeout, retry **chỉ phần transaction DB thuần** tối đa 3 lần, có backoff. Không gọi lại FaceIO, upload, email hoặc cấp proof bên trong vòng retry transaction.
- Nếu HTTP response mất sau commit, frontend GET dữ liệu chính thức (activity/registration/attendance) trước khi lặp lệnh có side effect. UNIQUE và state transition bảo vệ tác dụng nghiệp vụ; **không** hứa exactly-once tổng quát.
- Disable nút React/Next.js khi submit chỉ cải thiện UX, **không** thay thế concurrency control phía backend.
- Redis proof dùng lease `claimed`, chuyển `consumed` sau MySQL commit. Nếu SQL fail, chỉ release claim mình sở hữu sau khi kiểm kết quả đã commit hay chưa. Nếu không xác định được commit outcome thì **cấm tái sử dụng mù**, đọc lại DB và yêu cầu proof mới nếu cần.
- Không có outbox SQL: email sau commit theo **best effort** và có thể cần operator gửi lại. Notification nghiệp vụ phải INSERT bằng **chính transaction nguồn**, không dựa vào job hậu commit để ghi chuông bắt buộc.

## 8. Điểm danh: QR động + GPS + FaceIO mới

### 8.1. Ranh giới tin cậy (Trust Boundaries)

1. Operator chỉ yêu cầu QR khi phiên hợp lệ đang `open`. Server ký `{version,kid,attendanceSessionId,slot,nonce,exp,purpose}` bằng HMAC-SHA256, thay QR mỗi 30 giây và kiểm expiry. Chữ ký đúng **chưa đủ**: phải kiểm lại session/activity trong DB.
2. Student mở QR/deep link; `attendance/prepare` cấp proof xác nhận ngắn hạn, ràng buộc authenticated user/SID/session và QR, không nhận `userId` client làm chủ thể xác thực.
3. Browser Geolocation gửi tọa độ, accuracy và timestamp qua HTTPS. Backend kiểm vĩ/kinh độ, tuổi mẫu ≤120 giây, accuracy ≤100m, khoảng cách Haversine trong bán kính 30–300m (default 100m), `yeu_cau_gps=true`, sau đó cấp GPS proof có binding. **GPS trình duyệt có thể bị spoofing; xác minh dữ liệu báo cáo không đồng nghĩa chứng minh sự hiện diện vật lý tuyệt đối.**
4. FaceIO phải xác minh **mới cho mỗi lượt điểm danh**, độc lập với FaceIO khi login. Backend đối chiếu kết quả trusted provider với `thong_tin_sinh_trac.id_khuon_mat` hiện hành; cấp one-time FaceIO proof TTL ≤120 giây.
5. Sinh viên phải tự nhấn **Xác nhận**. Nếu thiếu GPS và/hoặc FaceIO, UI hiện cảnh báo riêng và không gửi confirm; backend vẫn tự từ chối proof thiếu/quá hạn.
6. `attendance/confirm` claim các proof, chạy `TX-ATT-CONFIRM` và commit result với UNIQUE `(id_phien_diem_danh,id_dang_ky)`. Checkout chỉ hợp lệ nếu đã có Check-in commit. Tại điểm quyết định cuối, session vẫn phải `open` và còn thời gian.

### 8.2. Rà soát thủ công và tính điểm

- Trong `pending_completed`, operator xem danh sách kết quả dựa trên version/snapshot hash; patch từ snapshot cũ trả `409 REVIEW_STALE`.
- Thêm lượt thủ công dùng thời gian backend thực, GPS có thể `NULL`; **không giả mạo bằng chứng QR/GPS/FaceIO**. Không cho Checkout nếu không có Check-in.
- Finalize chuyển registration thành `completed` nếu đủ lượt bắt buộc, ngược lại `missed`. Điểm nội bộ = tổng `hoat_dong.diem_hoat_dong` của registration completed thuộc activity completed. Điểm minh chứng ngoài = tổng `diem_minh_chung.so_diem` của hồ sơ approved. Không tạo bảng ledger điểm riêng.

## 9. Thông báo và bảo đảm phân phối

### 9.1. Danh mục 11 sự kiện chính thức

| Event | Thay đổi nguồn | Người nhận tại thời điểm phát |
|---|---|---|
| `NOTI-01` | Activity → `cancelled` | Người còn đăng ký ∪ BTC đã phân công, distinct; kèm lý do |
| `NOTI-02` | Tên/start/end/địa điểm thay đổi thực | Chỉ tên: registrants; đổi lịch/địa điểm: registrants ∪ BTC |
| `NOTI-03` | Publish draft thành công lần đầu | Distinct users từ assignments đã commit |
| `NOTI-04` | Minh chứng `approved` | Người nộp |
| `NOTI-05` | Minh chứng `rejected` | Người nộp |
| `NOTI-10` | Activity → `pending_issues` | Registrants còn tồn tại |
| `NOTI-11` | `pending_issues→progress` | Registrants còn tồn tại |
| `NOTI-12` | Activity → `issues` | Registrants còn tồn tại |
| `NOTI-13` | Activity completed, registration completed | Sinh viên hoàn thành; có điểm |
| `NOTI-14` | Activity completed, registration missed | Sinh viên không đủ lượt; không điểm |
| `NOTI-15` | Nhắc vào ngày diễn ra, trước startAt | Registrants hợp lệ đang tồn tại |

- Không tạo thông báo cho đăng ký/tự hủy, cập nhật tiến độ/duyệt nhiệm vụ, thao tác phiên điểm danh, bài đăng, hoặc `published→pending→progress` bình thường.
- Transaction nguồn insert **một** `thong_bao` cùng một `nguoi_nhan_thong_bao` cho mỗi recipient distinct. Composite PK của recipient chỉ chống trùng **trong một event**, không chống hai event giống nhau.
- Identity `NOTI-15` là `(activityId, NOTI-15, title='Nhắc hoạt động ngày YYYY-MM-DD')`. Bắt buộc `SELECT ... FOR UPDATE` activity, kiểm event cùng ngày VN, chỉ insert nếu chưa có, recipients không rỗng và `now < startAt`. Ngày A→B→A không gửi lại A. **Mọi producer** phải dùng cùng lock protocol. Vì SQL không có event UNIQUE, bảo đảm này chỉ đúng khi các writer tuân thủ giao thức, không phải invariant DB độc lập.
- Các event khác phải gắn với **state transition thực** đã serialize. No-op hoặc publish/finalize lặp không tạo thêm event; một chu kỳ sự cố/tiếp tục mới hợp lệ có thể tạo event mới.
- Notification là snapshot nội dung bất biến. `da_doc` chỉ `false→true`; `thoi_gian_doc` ghi lần đầu. Chuông hiển thị 5 mới nhất; danh sách dùng cursor `(thoi_gian_tao DESC,id_thong_bao DESC)`, 10 mục/lượt.

### 9.2. Ranh giới Email và File Storage

- Email kích hoạt/reset/kết quả đề xuất gửi qua adapter **ngoài MySQL transaction**. Lỗi gửi mail không rollback account/proposal đã commit. Không có outbox/history thì **không** bảo đảm tự động retry qua process crash; cần hỗ trợ gửi lại thủ công tại những luồng đặc tả yêu cầu.
- Upload private file mới **trước** DB mutation; nếu rollback thì cleanup file rác best effort; sau commit mới cleanup file cũ không còn tham chiếu. Dọn file rác phải kiểm DB để tránh xóa file còn được sử dụng. Validate file signature, MIME, extension và kích thước; không public trực tiếp private object.
- FaceIO enrollment/verification không giữ DB lock khi gọi provider. Provider thành công nhưng SQL fail **không** được báo nghiệp vụ thành công; `id_khuon_mat` cũ còn là dữ liệu chính thức cho đến commit hợp lệ.

## 10. Codec nội dung bài đăng (`ADR-06`)

`bai_dang.noi_dung TEXT NOT NULL` lưu **một JSON object có version** cho mọi bản ghi mới:

```json
{"v":1,"html":"<p>Sanitized content</p>","lastEditedAt":null}
```

- Serializer chỉ chấp nhận `v=1`, `html` là sanitized HTML và `lastEditedAt` là UTC ISO-8601 hoặc `null`; kiểm giới hạn **byte UTF-8** của MySQL `TEXT` (tối đa 65.535 byte lý thuyết, còn phụ thuộc giới hạn lưu trữ/encoding thực tế), từ chối dữ liệu vượt mức, không tự cắt.
- API nhận nội dung Rich Text do người dùng sửa; frontend không được tự ghi metadata `lastEditedAt`. Backend tự tính: tạo draft → `thoi_gian_dang=NULL`, `lastEditedAt=null`; publish lần đầu → `thoi_gian_dang=now UTC`, `lastEditedAt=null`. Sau publish, thay đổi thực ở title/HTML/ảnh → `lastEditedAt=now UTC`. Hide/republish/no-op không đổi timestamp công bố/chỉnh sửa.
- Bản ghi mới chỉ dùng codec mới; **không tạo fallback cho HTML legacy** theo quy tắc Agent tại §19. Nếu DB đang có bài cũ lưu HTML trực tiếp, phải kiểm kê và phê duyệt chuyển đổi dữ liệu một lần trước khi bật codec; không parse ngầm HTML tùy ý thành JSON.
- HTML output luôn sanitize bằng thư viện được duy trì và có test, dùng allowlist hẹp và link an toàn; không render HTML chưa sanitize.

## 11. HTTP/API Contract và quy tắc lỗi

### 11.1. Nhóm route

Toàn bộ route đặt dưới `/api/v1`. Trước khi triển khai **mỗi endpoint**, cần chốt HTTP method, DTO request/response và error contract trong OpenAPI. Bảng sau là **nhóm đường dẫn**, chưa phải OpenAPI contract hoàn chỉnh:

| Module | Route / chức năng |
|---|---|
| `auth` | `/auth/login/password`, `/auth/login/face`, `/auth/activate`, `/auth/password-reset`, `/auth/face-reset`, `/auth/session`, `/auth/logout`, `/auth/logout-all` |
| `users` | `/users`, `/users/import/preview`, `/users/import/commit`, `/users/:id/lock`, `/users/:id/role`, `/users/me` |
| `activities` | `/activities`, `/activities/:id`, `/activities/:id/publish`, `/activities/:id/cancel`, `/activities/:id/incident`, `/activities/:id/resume`, `/activities/:id/finalize` |
| `proposals` | `/proposals/public`, `/proposals`, `/proposals/:id/approve`, `/proposals/:id/reject`, `/proposals/:id/create-activity` |
| `assignments` | `/activities/:id/assignments` (GET sau publish), `/assignments/:id/progress`, `/assignments/:id/complete`, `/assignments/:id/review`; **không có route sửa draft assignment hoặc cancel** |
| `registrations` | `/activities/:id/registrations`, `/activities/:id/register`, `/activities/:id/unregister`, `/registrations/me` |
| `attendance` | `/activities/:id/attendance-sessions`, các route riêng `/attendance-sessions/:id/open`, `/close`, `/stop`, `/reopen`, `/qr`, cùng `/attendance/prepare`, `/attendance/gps-proof`, `/attendance/face-proof`, `/attendance/confirm`, `/activities/:id/attendance-review` |
| `evidence` | `/evidence`, `/evidence/:id`, `/evidence/:id/withdraw`, `/evidence/:id/approve`, `/evidence/:id/reject` |
| `notifications` | `/notifications`, `/notifications/unread-count`, `/notifications/:id/read`, `/notifications/read-all` |
| `statistics` | `/statistics/me`, `/statistics/my-assignments`, `/statistics/manager`, `/statistics/admin` |
| `posts` | `/posts/public`, `/posts`, `/posts/:id`, `/posts/:id/publish`, `/posts/:id/hide`, `/posts/:id/delete` |

**Ví dụ publish request** (request body cụ thể đã được đặc tả hiện hành xác định):

```http
POST /api/v1/activities/:id/publish
Content-Type: application/json

{"assignments":[{"userId":123,"taskName":"Điều phối","description":null,"taskType":"leader","startAt":null,"endAt":null}]}
```

Actor lấy từ session, không nhận từ body. Backend ánh xạ DTO sang các cột `phan_cong_nhiem_vu` sau khi validate dưới lock. Response chỉ được trả thành công sau commit và phải thể hiện activity/assignment IDs; schema response chi tiết cần chốt trong OpenAPI, không để frontend và backend tự suy diễn độc lập.

### 11.2. Validation và error semantics

- Dùng NestJS `ValidationPipe` với `whitelist`, `forbidNonWhitelisted`, `transform`. Kiểm unsigned ID range, pagination/filter limits, date, status literals, file và chiều dài thực theo SQL.
- Mã lỗi chuẩn: `400 VALIDATION_FAILED`; `401 AUTH_REQUIRED|SESSION_EXPIRED|PREAUTH_INVALID`; `403 FORBIDDEN|ACCOUNT_INACTIVE`; `404 RESOURCE_NOT_FOUND`; `409 STATE_CONFLICT|CAPACITY_FULL|DUPLICATE|REVIEW_STALE|DEADLINE_PASSED`; `422 PROOF_INVALID|GPS_OUT_OF_RANGE|CHECKIN_REQUIRED`; `429 RATE_LIMITED|LOGIN_TEMP_LOCKED`; `503 DEPENDENCY_UNAVAILABLE|TX_RETRY_EXHAUSTED`.
- Public `404` không lộ draft/hidden/private. Reset flow trả thông điệp trung tính, không tiết lộ email tồn tại. Không ghi raw credential, FaceIO artifacts hoặc proof vào API error/log.
- Thực hiện **contract-first theo từng lát cắt chức năng**: chốt method/DTO/role/state/error của một tính năng, implement và test end-to-end, sau đó mới phát triển tính năng tiếp theo. Không cần tạo abstraction OpenAPI quá rộng khi chưa có nghiệp vụ chạy được.

## 12. Bảo mật vận hành, kiểm thử và tiêu chí nghiệm thu

### 12.1. Security và Observability

- Bắt buộc HTTPS, secure cookie, CSRF/Origin validation, rate limit theo IP/account với login/activation/reset/đề xuất public/attendance confirm. Opaque secret có entropy CSPRNG ≥256-bit; HMAC-SHA256 và `kid` để hỗ trợ key rotation.
- Log gồm request ID, use case, actor/resource ID nếu phù hợp, transition, thời lượng, số lần retry và error code. Không log password/hash, cookie raw, FaceIO identity, QR/proof hoặc GPS chính xác theo mặc định.
- Metrics: auth failure, session revoke failure, Redis fail-closed, DB deadlock/retry, Scheduler lateness, orphan file, attendance proof rejection và số reminder duplicate được chặn.
- Không thêm bảng chỉ để lưu observability. Health probe không được refresh user session.

### 12.2. Kiểm thử tích hợp và cạnh tranh bắt buộc

| ID | Kịch bản | Bất biến phải đạt |
|---|---|---|
| `ARCH-T01` | Hai sinh viên tranh chỗ cuối | Chỉ một đăng ký commit |
| `ARCH-T02` | Đăng ký chạy cùng publish phân công đúng user/activity | Không thể vừa là registrant vừa là BTC cùng hoạt động |
| `ARCH-T03` | Hai hoạt động publish nhiệm vụ trùng lịch cùng người | Một publish bị từ chối dưới user lock |
| `ARCH-T04` | Hạ role Manager đồng thời publish giao leader | Không commit leader không hợp lệ |
| `ARCH-T05` | Hai request publish cùng draft | Một commit, một `NOTI-03`, không nhân đôi nhiệm vụ |
| `ARCH-T06` | Hai operator tạo phiên cùng loại | Tối đa một phiên dưới activity/detail lock |
| `ARCH-T07` | Mở Checkout đồng thời mở lại Check-in | Lock atomic khiến Check-in không thể reopen |
| `ARCH-T08` | GPS/FaceIO thiếu hoặc hết hạn; QR screenshot từ xa | Không confirm thiếu proof fresh; GPS vẫn có giới hạn chống spoofing |
| `ARCH-T09` | Confirm chạy sát lúc phiên đóng | Commit chỉ khi phiên còn open/đúng giờ tại điểm quyết định |
| `ARCH-T10` | Redis claim thành công nhưng SQL rollback/unknown commit | Không double-spend, có DB recheck/proof mới an toàn |
| `ARCH-T11` | Manual finalize và Scheduler finalize đồng thời | Một completed transition, không nhân đôi điểm/NOTI |
| `ARCH-T12` | Hai Scheduler tạo `NOTI-15` cùng lúc | Một event dưới activity lock và identity cùng ngày |
| `ARCH-T13` | Dời ngày nhắc A→B→A | Ngày A không được nhắc lần thứ hai |
| `ARCH-T14` | Khóa tài khoản cạnh tranh login/reset | Session không hợp lệ không ghi nghiệp vụ nhạy cảm |
| `ARCH-T15` | Hai reviewer duyệt cùng hồ sơ hoặc nộp minh chứng trùng | Một kết quả/một điểm; không trùng pending/approved |
| `ARCH-T16` | Bài đăng publish→hide→republish→edit | Giữ thời gian publish ban đầu; cập nhật edit metadata khi sửa thật |
| `ARCH-T17` | Deadline D−1, ranh 48 giờ, chốt ngày kế tiếp | Đúng quy tắc ngày lịch VN và thời lượng thực |
| `ARCH-T18` | Mất HTTP response sau commit, retry deadlock | Không replay side effect mù; client đối chiếu state |

Dùng unit tests cho authorization/state machine; **transaction và race test bắt buộc chạy trên MySQL InnoDB thật**, không chỉ SQLite/mock. Session/proof test với Redis thật; E2E kiểm server clock, quyền camera/GPS và tình huống adapter thất bại. Kiểm chứng Prisma behavior thực tế trước khi dựa vào giả định raw SQL.

### 12.3. Definition of Done cho AI Coding Agent

Một tính năng chỉ hoàn tất khi: (1) truy vết được về §14 (đặc tả chức năng); (2) ánh xạ đúng DDL; (3) có OpenAPI method/DTO/error rõ ràng; (4) backend thực thi role/state/time policy; (5) có transaction/lock và recovery nếu cần; (6) UI responsive có loading/empty/error/forbidden/success; (7) đủ unit/integration/race tests liên quan; (8) không tự thêm bảng, role, notification, status hoặc route bị cấm; (9) không lộ secret/FaceIO/GPS proof trong log; (10) tính năng chạy end-to-end.

**Thứ tự triển khai khuyến nghị:** kiểm schema + Prisma/seed → clock/error/transaction/security căn bản → cấp tài khoản và login → activity draft + publish (assignments và NOTI-03) → registration → attendance sessions/proofs → finalize → proposals/evidence → reminders/statistics/posts. Mỗi lát cắt cần hoạt động được trước khi mở rộng tiếp.

**Giai đoạn đăng nhập local đã được phê duyệt (thay thế bản xem trước):** Khách xem News Feed công khai; `user`/`staff` dùng cùng News Feed với header đã đăng nhập. `AUTH_PASSWORD_ONLY=true` chỉ được bật ngoài production: `POST /api/v1/auth/login/password` xác thực mật khẩu Argon2id và cấp cookie phiên HttpOnly, SameSite=Lax, SID ngẫu nhiên lưu Redis, idle TTL 30 phút; không gọi FaceIO. Redis lỗi thì không cấp/duy trì quyền bằng fallback. `GET /auth/session` không gia hạn TTL; truy cập `/system` có hoạt động người dùng mới gia hạn. Mỗi request có quyền đọc kiểm tra lại trạng thái, role, credential fingerprint từ MySQL. `/system` lấy tài khoản từ phiên, không nhận lựa chọn profile hoặc role từ client. Seed local xóa đúng fixture cũ, tạo ba tài khoản `sinhvien1`, `canbo1`, `admin1` tương ứng `user`, `staff`, `admin`; mật khẩu lấy từ biến môi trường, không ghi đè tài khoản hiện có. `/preview/user` và API preview được loại bỏ. API nghiệp vụ chưa triển khai vẫn khóa thao tác; không giả lập thành công. Production tiếp tục yêu cầu giao thức FaceIO chính thức; ngoại lệ này không giải quyết các quyết định `BLOCKED`.

## 13. Giới hạn đã biết và điều kiện cần xác minh (Verification Gates)

| Gate | Nội dung cần xác minh / phê duyệt | Tác động |
|---|---|---|
| `VERIFY-BR-01` | Xin chủ dự án xác nhận `ADR-01` — `AUTH-LEADER` | Quyền làm `leader` còn xung đột, chưa thể coi là quyết định nghiệp vụ cuối |
| `VERIFY-BR-02` | Xác minh số lượng leader, cách hiểu thời gian nhiệm vụ nullable (`ADR-09`), ràng buộc sửa lịch và operator scope theo đặc tả nghiệp vụ | Tránh tự tạo thêm Business Rule |
| `VERIFY-DB-01` | So schema runtime, migrations và dữ liệu hiện hữu với DDL tại §15 | DDL file không chứng minh database đang chạy đã đúng; có thể cần chuyển đổi dữ liệu bài đăng |
| `VERIFY-API-01` | Chốt OpenAPI contract đầy đủ theo từng endpoint | Các tài liệu hiện tại chủ yếu định nghĩa nhóm route |
| `VERIFY-RACE-01` | Chạy concurrency/failure-injection tests với MySQL và Redis | Lock protocol mới là cam kết thiết kế, chưa phải kết quả kiểm chứng |
| `VERIFY-EMAIL-01` | Chấp nhận email best-effort không có outbox/history, hoặc phê duyệt thay đổi phạm vi | Không thể bảo đảm delivery qua crash với schema hiện tại |

**Quy tắc dừng:** AI Agent không được tự sửa schema vật lý hoặc tự coi business rule chưa kiểm chứng là đã phê duyệt. `ADR-01`, `ADR-09` là lựa chọn phục vụ phân tích, **không thay thế đặc tả nghiệp vụ**. Vẫn được triển khai các module không bị ảnh hưởng; chỉ dừng những endpoint phụ thuộc quyết định chưa xác nhận.

---

## 14. Đặc tả chức năng và hành vi giao diện (Functional Specification)

Các mục UI bên dưới là **hợp đồng hành vi** của hệ thống; kết hợp với §§5–13 để thực thi đúng quyền, transaction, bảo mật và kiểm thử. Các tên `UI-*`, `NOTI-*` dùng làm mã truy vết nội bộ của chính file này. Mọi đường ghi phải dùng backend validation và authoritative DB state; client validation chỉ để tăng trải nghiệm.

### 14.0. Quy chuẩn UI dùng chung

- Giao diện responsive: quản lý ưu tiên bảng/form ở desktop, một cột và tương tác chạm dễ dùng ở mobile; thông tin tiếng Việt, DB/API literals không dịch.
- UI states: `initial`, `loading`, `empty`, `ready`, `submitting`, `success`, `error`, `forbidden`, `expired`, `stale`; chỉ hiển thị `success` khi xác nhận commit thành công.
- Form có label, required indicator, lỗi theo field, accessibility `aria-live`, confirm các thao tác quan trọng; mặc định danh sách 10 mục/trang, News Feed/Notifications dùng infinite scroll.
- Bản tạm phân công chỉ lưu `cm:assignment-draft:{actorId}:{activityId}` (kèm payload version) trong localStorage và không được chứa password, session/token hay FaceIO/GPS/QR proof. Xóa bản tạm khi publish thành công; lỗi publish giữ lại để sửa. Trường hợp localStorage bị xóa hoặc dùng thiết bị khác, không giả vờ dữ liệu đã đồng bộ.
- Client không được suy ra quyền từ việc ẩn/hiện nút; backend quyết định và phải trả lỗi có cấu trúc.

### 14.1. Tổng quan luồng và bản đồ màn hình

#### 14.1.1. Navigation theo đối tượng

| Khu vực | Màn hình chính | Đối tượng |
|---|---|---|
| Public | News Feed, danh sách/chi tiết hoạt động công khai, biểu mẫu đề xuất đơn vị ngoài | Khách và người đã đăng nhập theo quyền đọc |
| Tài khoản | Login, kích hoạt, FaceIO enrollment, reset password/FaceIO, hồ sơ, đổi mật khẩu | Người có tài khoản; màn hình phục hồi có thể truy cập trước login |
| Sinh viên | Hoạt động của tôi, đăng ký/tự hủy, màn điểm danh, lịch sử/điểm, nộp minh chứng | End User `student` active |
| BTC | Nhiệm vụ của tôi, cập nhật tiến độ, báo hoàn thành | Người được phân công hợp lệ |
| Quản lý | Danh sách/tạo/sửa/publish hoạt động, đề xuất ngoài, bảng đăng ký, phiên điểm danh, rà soát, nhiệm vụ, duyệt minh chứng, thống kê, bài đăng | Quản lý active và operator theo quyền được xác định |
| Admin | Tài khoản, import người dùng, đổi vai trò/khóa, thống kê Admin, quản lý mọi bài | Admin active |
| Shared | Thông báo chuông, chi tiết thông báo, trang không có quyền/404 | Người đã đăng nhập |

#### 14.1.2. Luồng hoạt động cấp cao

1. Admin cấp tài khoản → người dùng kích hoạt mật khẩu → enroll FaceIO → login 2 bước.
2. Quản lý tạo activity `draft` (DB có thể chỉ lưu tên); chọn người BTC và chỉnh nhiệm vụ qua ComboBox trong localStorage; preview/import dữ liệu hoạt động và nhiệm vụ.
3. Publish nhận snapshot assignments → server xác minh → insert nhiệm vụ + update activity + tạo NOTI-03 atomically.
4. Sinh viên đủ điều kiện đăng ký đến cuối D−2; operator cấu hình/mở phiên Check-in/Checkout, sinh viên quét QR + GPS + FaceIO mới + bấm Xác nhận.
5. Operator rà soát kết quả sau hoạt động; finalize thành `completed` để kết quả đăng ký `completed`/`missed`, phát NOTI-13/14; `cancelled/issues` không tự cộng điểm.
6. Sinh viên theo dõi lịch sử, điểm; có thể nộp minh chứng hoạt động *ngoài hệ thống*; quản lý duyệt và ghi điểm minh chứng riêng.

---

### 14.2. Tài khoản, bảo mật và quyền (Nhóm 02–03)

#### 14.2.1. UI-ACC-01 — Tạo/import tài khoản (Admin)

**UI:** Tab `Tài khoản` có tìm theo mã/họ tên/email, lọc vai trò/trạng thái/loại người dùng/khoa, danh sách 10/trang; nút `Tạo tài khoản`, `Nhập Excel/PDF`, `Xem chi tiết`. Form gồm mã đăng nhập, họ tên, email, số điện thoại (nếu có), khoa, loại người dùng; không có form tự đăng ký hoặc nhập mật khẩu mặc định. Import theo hai bước: tải tệp → preview từng dòng (hợp lệ/lỗi, chỉnh trực tiếp) → `Xác nhận nhập`. Hiển thị kết quả theo số dòng thành công/lỗi và khả năng gửi lại email kích hoạt.

**Server-side:** Admin guard → parse/validate giới hạn tệp, định dạng, mã/email UNIQUE, loại người dùng và vai trò mặc định End User → transaction tạo tài khoản `pending_activation`, `mat_khau` là Argon2id hash của secret ngẫu nhiên không thể đăng nhập; không dựa `DEFAULT active` của SQL → email activation qua adapter sau DB commit với token opaque digest Redis TTL 24 giờ. Import phải tránh commit từng dòng khi đang ở chế độ yêu cầu sửa hết dòng lỗi. Gửi mail lỗi không xóa user; hỗ trợ gửi lại link; sửa email của pending_activation vô hiệu liên kết cũ.

**Biên/lỗi:** file sai định dạng; file rỗng; dòng thiếu mã/email; duplicate nội bộ file hoặc với DB; conflict do Admin khác tạo cùng user; email provider lỗi; Redis lỗi không thể cấp link; nhập quá kích thước; mất kết nối sau DB commit. Không báo hoàn tất gửi email nếu email thất bại.

#### 14.2.2. UI-ACC-02 — Kích hoạt, đăng ký FaceIO và đăng nhập

**UI:**
- `Kích hoạt tài khoản`: link một lần, form đặt/xác nhận mật khẩu; trạng thái link hết hạn/đã dùng có thông báo và hướng dẫn liên hệ Admin.
- `Đăng ký khuôn mặt`: hướng dẫn quyền camera, vùng khung mặt, trạng thái `Đang xác minh/Thử lại`; chỉ hiển thị hoàn tất sau provider/backend xác nhận.
- `Đăng nhập`: mã sinh viên/nhân sự + mật khẩu → bước FaceIO riêng; nút `Quên mật khẩu`, `Đặt lại FaceIO`; spinner và hướng dẫn camera khi bị từ chối.

**Server-side:** kiểm username/password bằng Argon2id, account `active`, giới hạn 5 lần sai/15 phút cho login mới → cấp pre-auth ticket opaque 5 phút trong Redis, không có quyền API nghiệp vụ → FaceIO verify qua trusted adapter → tiêu thụ ticket một lần, kiểm lại role/status/credential/FaceIO mới nhất → tạo session ID độc lập cho thiết bị, cập nhật Redis session/index atomically, idle TTL 30 phút. Mỗi lần login mới cần password + FaceIO; reload/truy cập trang trong session hợp lệ không yêu cầu FaceIO lại. Background request không refresh TTL.

**Biên/lỗi:** 5 lần sai, hết tạm khóa; camera bị chặn; provider từ chối/timeout; preauth expired/used/replayed; account bị khóa hoặc đổi mật khẩu/FaceIO khi ticket đang chờ; Redis outage; hai request cùng ticket; login cùng lúc với khóa tài khoản. Không có fallback cấp phiên không FaceIO.

#### 14.2.3. UI-ACC-03 — Phục hồi và quản lý Session

**UI:** `Quên mật khẩu` nhận email, luôn trả thông điệp trung tính; `Đặt lại mật khẩu` có password/confirm; `Đặt lại FaceIO` nhập email, sau link phải nhập mật khẩu hiện tại rồi đăng ký mặt mới. Hồ sơ cá nhân hiển thị các trường chính thức read-only, tự sửa số điện thoại; màn đổi mật khẩu và nút `Đăng xuất`, `Đăng xuất tất cả thiết bị`.

**Server-side:** token reset password/FaceIO TTL 30 phút, purpose- và user-bound, one-time; không tiết lộ email tồn tại. Reset/đổi mật khẩu giữ FaceIO nhưng thu hồi tất cả Session + preauth. Reset FaceIO chỉ cập nhật `thong_tin_sinh_trac.id_khuon_mat` sau đăng ký thành công, giữ face cũ nếu lỗi; thu hồi Session và buộc login lại. Logout all phải atomically xóa session keys + user index + preauth tickets trên Redis. Kiểm tra phiên thật ở Redis và trạng thái account hiện hành; không tin role cached.

**Biên/lỗi:** link hết hạn/đã sử dụng, hai tab cùng đổi password, liên kết gửi đến email cũ, SMTP/Redis lỗi, account đổi trạng thái giữa reset, reset FaceIO provider thành công nhưng SQL thất bại (không công bố thành công), session cũ còn ở thiết bị khác.

#### 14.2.4. UI-ACC-04 — Khóa, mở khóa và đổi vai trò

**UI:** trong chi tiết account, Admin thấy nút `Khóa tài khoản`/`Mở khóa`, `Thay đổi vai trò`, dialog xác nhận và thông báo lý do không hợp lệ. Không có xóa tài khoản, không cho Admin khóa chính mình/Admin khác hoặc tự tạo Admin qua UI.

**Server-side:** khóa/mở khóa chỉ với Quản lý/End User; khóa ghi trạng thái và vô hiệu hóa quyền, thu hồi tất cả Session/preauth theo protocol Redis–MySQL fail-closed. **Khóa leader vẫn hợp lệ**, không sửa `phan_cong_nhiem_vu`; Quản lý active khác có quyền review nhiệm vụ theo ngoại lệ. Role change chỉ End User↔Manager, `student` không nâng Manager; **chặn hạ Manager khi còn leader ở bất kỳ activity chưa cuối `completed/cancelled/issues`**. Mọi thao tác quan trọng kiểm trong transaction dưới user lock; session cũ không tiếp tục dùng quyền.

**Biên/lỗi:** đồng thời đổi role và publish phân công; khóa leader đang review; Redis lỗi sau MySQL commit; người bị khóa vẫn gửi API với cookie cũ; hai Admin thao tác cùng tài khoản; Manager đang giữ leader cuối cùng. Không tự chuyển giao.

---

### 14.3. Tạo, quản lý và công bố hoạt động (Nhóm 01, 04; modules `activities`, `assignments`)

#### 14.3.1. UI-ACT-01 — Danh sách và chi tiết hoạt động

**UI:** Public có danh sách hoạt động công khai, tìm theo tên, lọc theo giai đoạn/điều kiện phù hợp, card tên, thời gian, địa điểm, số chỗ còn lại (nếu giới hạn), trạng thái đăng ký và nút xem chi tiết. Quản lý có danh sách riêng gồm cả `draft`, toolbar `Tạo hoạt động`, `Nhập từ Excel/PDF`; lọc/trang 10 mục, action theo trạng thái. Chi tiết gồm mô tả, lịch, địa điểm, GPS trên bản đồ nếu dữ liệu có, giới hạn, điểm, checkout bắt buộc, file kế hoạch, số đăng ký; BTC và danh sách nhiệm vụ **không công khai**.

**Server-side:** public query chỉ hoạt động công khai/hợp lệ theo các quy tắc trong tài liệu này, không lộ bản nháp; user management query có role guard. Lấy chỗ bằng số bản ghi đăng ký thực (không counter mới); trả trạng thái/cutoff tính từ BusinessClock. File private chỉ qua endpoint có quyền/đường dẫn ký nếu adapter hỗ trợ; không trả local filesystem path như URL tự do. Khi resource ẩn/chưa công bố, public nhận 404/403 phù hợp contract.

**Biên/lỗi:** địa điểm/giới hạn chưa cấu hình ở draft, link hoạt động đã hủy hoặc đổi trạng thái, load chậm, filter trang rỗng, URL file mất, quota hết chỗ giữa lúc render và đăng ký.

#### 14.3.2. UI-ACT-02 — Tạo/sửa draft và import

**Lát cắt hiện hành đã được phê duyệt:** seed ba hoạt động `draft`, tạo/sửa nháp thật và phân công tạm trong trình duyệt; Công bố giữ khóa đến khi chốt `AUTH-LEADER`, `LEADER-COUNT`, `TASK-TIME-NULL`. Staff dùng chung biểu mẫu tạo/sửa với các mục Thông tin chung, Lịch và địa điểm, Phân công; tải kế hoạch chưa khả dụng. `POST /api/v1/activities` tạo draft, `GET /api/v1/activities/:id/editor` đọc biểu mẫu của chủ sở hữu, `PATCH /api/v1/activities/:id` sửa draft với `revision` SHA-256 để phát hiện ghi đè. PATCH giữ trường bị bỏ qua; ngày null chỉ xóa chi tiết khi không mất phân công/phiên và dữ liệu lịch liên quan đã được bỏ rõ ràng. API khóa actor rồi activity, kiểm lại session credential fingerprint/role/state trong transaction; không ghi assignment từ DTO. API sửa nháp từ chối mọi trạng thái đã công bố hoặc đã diễn ra. `GET /api/v1/activities/assignees?search=` chỉ trả mã, tên đăng nhập, họ tên của account active để gợi ý tạm, không quyết định điều kiện publish.

**UI:** form nhiều phần hoặc tabs `Thông tin chung`, `Lịch & Địa điểm`, `Kế hoạch`, `Nhiệm vụ BTC`, `Xem trước`. Trường: tên hoạt động; mô tả; thời gian bắt đầu/kết thúc; địa điểm; vĩ độ/kinh độ và lựa chọn vị trí bản đồ; giới hạn đăng ký; điểm; bật Checkout; kế hoạch PDF/Excel hoặc liên kết đề xuất đã duyệt. Nút `Lưu nháp` chỉ yêu cầu tên; `Công bố` yêu cầu dữ liệu đầy đủ. Import Excel/PDF có preview/edit và validation trước khi lưu. Thông báo `Chưa lưu` khi rời trang có thay đổi.

**Server-side:** tạo activity `draft` trong `hoat_dong`, chi tiết `chi_tiet_hoat_dong` chỉ khi đủ trường tối thiểu cần tạo; không lưu assignment trong DB khi draft. Ghi `id_nguoi_tao` từ session; giữ `id_de_xuat`/`id_don_vi` hợp lệ. Upload ngoài transaction; kiểm MIME/extension/signature/path; rollback DB → cleanup file mới best effort. Chỉ Manager có quyền sửa draft; kiểm trạng thái tại điểm ghi. Dữ liệu datetime API UTC, hiện giờ VN ở UI; trích xuất import là preview không bypass validation.

**Biên/lỗi:** chỉ nhập tên vẫn lưu draft; thiếu ngày/location không cho publish; end<=start; GPS ngoài [-90,90]/[-180,180]; file không đọc được/nội dung nhập không tin cậy; hai tab cùng sửa draft làm ghi đè; người khác publish giữa lúc đang sửa; file tồn tại nhưng SQL rollback; đề xuất bị liên kết nơi khác.

#### 14.3.3. UI-ACT-03 — Thiết lập nhiệm vụ BTC trên frontend (CM-007)

**UI chính:** trong tab `Nhiệm vụ BTC`, mỗi hàng nhiệm vụ có `Tên nhiệm vụ`, `Mô tả`, `Loại` (`leader`/`member`), `Bắt đầu`, `Kết thúc`, Combobox `Người phụ trách` (tìm mã/họ tên, chọn từ account đã có), nút `Thêm nhiệm vụ`, `Xóa dòng`, `Đổi người`, `Lưu tạm`. Các thao tác này chỉ sửa state/localStorage theo actorId+activityId; xóa dòng nghĩa là xóa bản tạm, không phải trạng thái `cancelled`. Có thể import nhiệm vụ Excel/PDF vào preview; user kiểm trước khi gửi publish. UI cảnh báo ngay khi trùng khoảng giờ hoặc thiếu leader nhưng *cảnh báo client không quyết định*. Không hiển thị tab cho phép sửa cấu trúc sau publish.

**Server-side ở draft:** API tìm user/kiểm tra điều kiện gợi ý có thể đọc dữ liệu; **không** tạo/sửa/xóa bản ghi `phan_cong_nhiem_vu`. Mọi check ở client là provisional. Khi activity chưa có `activityId` (draft chưa lưu), dùng local draft key tạm rồi re-key khi tạo activity thành công. Frontend không được coi combobox đã chọn là account còn active.

**Biên/lỗi:** localStorage bị xóa, quota/storage disabled, tab khác ghi cùng key, account được chọn bị khóa/đổi role trước publish, người phụ trách trùng các activity khác, import hàng trùng, actor khác mở cùng draft ở máy khác. UI phải giải thích dữ liệu tạm chỉ tồn tại trong trình duyệt và không đồng bộ thiết bị. Không gửi mật khẩu/email/FaceIO trong payload assignment.

#### 14.3.4. UI-ACT-04 — Công bố hoạt động / Transaction publish

**UI:** `Xem trước công bố` hiển thị các trường hoạt động, danh sách nhiệm vụ tạm, người giữ leader, thời gian, cảnh báo lỗi từng hàng, nút `Công bố` + modal xác nhận. Khi submit hiện progress; thành công chuyển sang chi tiết published và xóa localStorage của đúng draft; thất bại giữ nguyên dữ liệu tạm để sửa. Không submit hàng loạt bằng thao tác tự động khi reload.

**Request mục tiêu (chưa thay cho OpenAPI contract):** `POST /api/v1/activities/:id/publish` với `{assignments:[{userId,taskName,description?,taskType,startAt?,endAt?},...]}`; server tự lấy activity từ DB và actor từ session. DTO phải đối chiếu với cột SQL (`ten_nhiem_vu`, `mo_ta_nhiem_vu`, `loai_nhiem_vu`, `thoi_gian_bat_dau`, `thoi_gian_ket_thuc`). Quy ước null thời gian nếu nghiệp vụ cho phép phải được validator thống nhất; việc chống overlap cho `NULL` không được suy diễn là không trùng.

**Server-side (một transaction MySQL):** (1) validate cấu trúc request/size/ID, xác định tất cả assignee ID; (2) khóa `nguoi_dung` liên quan theo ID tăng dần, rồi khóa `hoat_dong`, `chi_tiet_hoat_dong` theo CON-01; (3) kiểm actor Manager active, activity vẫn `draft`, đầy đủ kế hoạch/lịch/địa điểm/coordinates, ít nhất một nhiệm vụ và đúng số/điều kiện leader theo policy được chốt; (4) kiểm assignee hiện hành, quyền `leader/member`, không trùng lịch `[start,end)` trên các hoạt động, không BTC+registration cùng activity, không duplicate nhiệm vụ trái BR; (5) insert toàn bộ assignments `assigned`, update activity thành `published`; (6) tạo **một NOTI-03 cho hoạt động công bố** với recipients distinct từ assignments, insert `thong_bao`/`nguoi_nhan_thong_bao` trong cùng `tx`; (7) commit. *Không* gửi NOTI-07/08. Nếu một khâu lỗi, rollback toàn bộ.

**Biên/lỗi:** hai publish đồng thời cùng draft (một thành công); hai activity khác nhau publish cùng assignee trùng giờ (một bị từ chối); assignee bị khóa/đổi role giữa preview và commit; localStorage cũ sau publish; một người có nhiều nhiệm vụ chỉ nhận một recipient NOTI-03; HTTP response mất sau commit → GET trạng thái trước retry; DB deadlock → retry phần transaction an toàn; quá nhiều assignments/malformed dates; không đủ leader; email hay file upload không nằm trong publish transaction.

#### 14.3.5. UI-ACT-05 — Sửa hoạt động sau công bố, sự cố, hủy và kết thúc

**UI:** màn chỉnh sửa được phép thay thông tin hoạt động theo các quy tắc trong tài liệu này, nhưng phần `Nhiệm vụ BTC` chỉ đọc. Sửa tên/lịch/địa điểm có preview thông báo người liên quan; nút `Hủy hoạt động` yêu cầu lý do; nút `Báo sự cố`, `Tiếp tục`, `Kết thúc sớm`, `Xác nhận hoàn tất` xuất hiện theo trạng thái và quyền. Có màn `Rà soát điểm danh` trong nhánh hoàn thành bình thường.

**Server-side:** các transition của activity theo state machine 9 trạng thái; scheduler chuyển published→pending lúc 00:00 D−1 (VN), pending→progress theo mốc; sự cố `pending_issues`, `issues`, tiếp tục, kết thúc bình thường `pending_completed` rồi `completed` qua finalize. Sửa ngày/giờ start đã published phải thỏa **cả oldStart và newStart ≥ 48 giờ thực tính từ now**; thay đổi deadline đăng ký theo ngày mới. Nhiệm vụ BTC giữ bất biến ngay cả khi sửa lịch activity (chặn thao tác làm vi phạm quy tắc thời gian đã chốt, không tự chỉnh nhiệm vụ). Thông báo `NOTI-01/02/10/11/12` theo event thật và distinct recipients; cancelled/issues không tự cộng điểm; completed sau kiểm điểm danh phát NOTI-13/14.

**Biên/lỗi:** request sửa lịch 47h59m, activity đang pending/progress, đổi ngày làm deadline trước hiện tại, hai operator xử lý sự cố cạnh nhau, scheduler trễ, cancel khi có phiên đang open, QR đang hiển thị, duplicate finalize; notify chỉ sau commit, không đúp trên retry.

---

### 14.4. Quản lý nhiệm vụ đã công bố (module `assignments`)

#### 14.4.1. UI-ASG-01 — Nhiệm vụ của tôi / Quản lý nhiệm vụ

**UI:** danh sách `Nhiệm vụ của tôi` theo hoạt động, tên nhiệm vụ, hạn, trạng thái; tìm/lọc trạng thái và phân trang 10/trang. Màn chi tiết hiển thị mô tả, người được giao, thời gian bất biến, tiến độ và các nút hợp lệ `Bắt đầu`, `Báo hoàn thành`, `Xác nhận hoàn thành`, `Yêu cầu làm lại`. Không có nút `Hủy`, `Thay người`, `Xóa` hoặc sửa nội dung sau publish. Người được giao có thể tiếp tục xử lý theo hạn nhiệm vụ dù hoạt động đã kết thúc khi BR cho phép.

**Server-side:** các trạng thái duy nhất `assigned → in_progress → pending_review → completed`, `pending_review → in_progress` khi yêu cầu làm lại. Assignee active được cập nhật tiến độ và báo hoàn thành; leader có quyền review nếu đạt policy, và khi tài khoản leader bị Admin khóa, Quản lý active khác được review thay. Mọi transition lock/check state và quyền tại điểm ghi. `completed` không bị đảo theo activity; activity `cancelled/issues` không tự đổi assignment thành cancelled. Không có bảng lịch sử tiến độ; chỉ trạng thái hiện hành.

**Biên/lỗi:** hai reviewer cùng review, assignee nhấn hai lần, leader bị khóa khi review, deadline đã hết theo chính sách hiện hành, người không được phân công đoán ID, activity bị hủy trong khi assignment vẫn tồn tại, login session cũ sau khóa. Reject bằng 403/409; không đổi `id_nguoi_dung`.

---

### 14.5. Đề xuất hoạt động từ đơn vị bên ngoài (Nhóm 05, module `proposals`)

#### 14.5.1. UI-PRP-01 — Nộp đề xuất công khai

**UI:** biểu mẫu public gồm tên/loại đơn vị, người liên hệ, email, số điện thoại, tên hoạt động, mô tả, địa điểm, thời gian dự kiến (ngày giờ), xác nhận gửi; hiển thị lỗi inline và thông báo tiếp nhận. Không yêu cầu đăng nhập hoặc tự tạo tài khoản đơn vị. Chống spam/rate-limit ở gateway/application theo hạ tầng, không tự bổ sung bảng.

**Server-side:** validate các trường bắt buộc theo Nhóm 5, email/phone/time hợp lệ, dự kiến không trong quá khứ; chuẩn hóa tên đơn vị và tìm match đủ tin cậy, nếu có dùng `don_vi_ben_ngoai`, nếu chưa tạo mới; không gộp mơ hồ; insert `de_xuat_hoat_dong` ở `pending` trong transaction. Không tự tạo activity hoặc gửi NOTI tùy ý.

**Biên/lỗi:** thiếu thông tin; email sai; ngày giờ quá khứ; cùng tên đơn vị khác tổ chức; hai request đồng thời tạo tên giống nhau (không unique vật lý cho tên → serialize theo policy tương ứng hoặc chấp nhận yêu cầu review dữ liệu, không giả định UNIQUE); submit lặp; lộ dữ liệu đề xuất bằng URL; provider lỗi.

#### 14.5.2. UI-PRP-02 — Tiếp nhận, duyệt/từ chối và tạo activity

**UI:** Quản lý có tabs `Chờ duyệt`, `Đã duyệt`, `Từ chối` và chi tiết read-only; nút `Duyệt` hoặc `Từ chối` (bắt buộc nhập lý do). Với approved, nút `Tạo hoạt động` nếu chưa liên kết. Màn tạo activity prefill tên, mô tả, địa điểm và đơn vị; **thời gian dự kiến là tham khảo**, không tự biến thành start/end có hiệu lực. Xem và gửi lại email phản hồi qua chức năng được BR cho phép; không tạo history table.

**Server-side:** Manager guard; lock proposal để ngăn duyệt/trùng; `pending→approved/rejected` duy nhất và ghi `id_nguoi_duyet`, lý do reject nếu có. Email kết quả gửi ngoài transaction sau commit, thất bại không đảo quyết định; retry gửi theo hạn chế hạ tầng. Tạo draft từ approved chỉ khi `hoat_dong.id_de_xuat` chưa được dùng (DB UNIQUE id_de_xuat), điền fields hợp lệ, không sửa proposal gốc, phần chi tiết chỉ tạo khi đủ data; các assignment tiếp tục ở localStorage đến publish.

**Biên/lỗi:** hai Manager duyệt đồng thời, approved đã liên kết activity, email gửi hỏng, input sửa sau duyệt trái policy, user thoát form chưa lưu, external unit gửi dữ liệu không đáng tin, đề xuất đã rejected vẫn gọi create.

---

### 14.6. Đăng ký và tự hủy (Nhóm 06, module `registrations`)

#### 14.6.1. UI-REG-01 — Đăng ký hoạt động

**UI:** Chi tiết public có nút `Đăng ký` chỉ hiện/khả dụng cho tài khoản `End User` loại `student` active trong thời hạn; hiển thị sức chứa, deadline D−2, trạng thái đang đăng ký/đã đăng ký. Nhấn `Đăng ký` → confirm khi cần → toast thành công/inline error. Không tạo thông báo chuông cho thao tác của chính mình.

**Server-side (TX-02):** lấy user từ Session; khóa user→activity theo CON-01; check `active`, role End User, `loai_nguoi_dung=student`, activity=`published`, backend now trước 00:00 D−1 địa phương, không có assignment BTC cùng hoạt động, không có đăng ký trùng; đếm lại số đăng ký hiện hữu dưới activity lock, so với `gioi_han_dang_ky`; insert `dang_ky_hoat_dong` trạng thái `registered`. UNIQUE `(id_nguoi_dung,id_hoat_dong)` bảo vệ đúp. Không có NOTI cho register.

**Biên/lỗi:** hai sinh viên tranh chỗ cuối; double click; hoạt động được hủy giữa lúc tải và gửi; mốc 23:59:59 D−2 → 00:00 D−1; BTC đã được publish cùng lúc; staff/Admin/Manager gọi API; response mất sau commit. 409 `CAPACITY_FULL/DUPLICATE/DEADLINE_PASSED`, 403 `FORBIDDEN`, 409 `STATE_CONFLICT`.

#### 14.6.2. UI-REG-02 — Tự hủy và danh sách đăng ký

**UI:** Trong `Hoạt động của tôi`, item `registered` có nút `Hủy đăng ký` trước deadline và modal xác nhận; sau hạn chỉ xem/trạng thái liên hệ nhà trường. Quản lý có bảng người đăng ký theo hoạt động, lọc/trang, không nút sửa điểm hoặc tự hủy thay sinh viên ngoài BR. Danh sách cá nhân 10/trang, lọc/tìm theo tên/trạng thái.

**Server-side:** self-unregister chỉ khi đúng owner, status/now hợp lệ, chưa điểm danh theo các quy tắc trong tài liệu này; hard-delete `dang_ky_hoat_dong`, không status `cancelled`, không tạo chuông. Có thể đăng ký lại nếu còn hạn/chỗ như mới. Khi completed activity, update registered→completed/missed qua finalize, giữ kết quả/check-in liên quan.

**Biên/lỗi:** double-unregister, delete sau hạn, session đổi vai trò, `ket_qua_diem_danh` đã tồn tại, nhấn hủy sát deadline, UI phản hồi lỗi sau DB commit. Lần tải lại phải phản ánh DB thực.

---

### 14.7. Điểm danh Check-in / Checkout (Nhóm 07, module `attendance`)

#### 14.7.1. UI-ATT-01 — Màn điều hành phiên

**UI:** hai tab `Check-in` và `Checkout`, mỗi tab có form thời gian bắt đầu/kết thúc, tọa độ phiên, bán kính GPS (30–300 m, default 100), trạng thái, đồng hồ server/countdown. Khung QR chỉ hiện khi session `open`, QR đổi sau 30s và hiển thị countdown. Nút `Mở`, `Chỉnh sửa`, `Dừng` + nút `Đóng` riêng góc QR khi open; thao tác chuyển trạng thái có modal xác nhận. Cho xem người đã điểm danh và sai lệch. Không có nút tạo QR cho sinh viên.

**Server-side (TX-01):** operator guard (Manager/leader hợp lệ theo policy) và khóa actor→activity→detail; activity đã công bố, cấu hình GPS đầy đủ (`yeu_cau_gps=true` bắt buộc), max 1 phiên `check_in` và 1 `check_out`, ≥5 phút, không overlap. Check-in bắt đầu sớm nhất 2h trước activity start, kết thúc không quá activity end; Checkout bắt đầu không trước start, kết thúc không quá 2h sau end. Khi mở Checkout lần đầu, Check-in phải không còn khả năng mở và chuyển `locked` atomically. Phiên có `scheduled`, `open`, `closed`, `manually_closed`, `scheduled_reopen`, `locked`. Scheduler tự mở/đóng hợp lệ, backend kiểm hạn tuyệt đối dù scheduler trễ.

**Biên/lỗi:** hai operator tạo cùng loại phiên; 4m59s, giao nhau đúng boundary; phiên mở sát endAt, endAt đã qua; Checkout khi Check-in open/scheduled_reopen; scheduler race với bấm Mở/Đóng; incident/cancel khi QR còn hiển thị; tọa độ invalid; backend fail sau confirm UI.

#### 14.7.2. UI-ATT-02 — Sinh viên quét QR và điểm danh

**UI:** từ camera/quét QR hoặc mở deep-link hợp lệ vào màn `Xác nhận điểm danh`; luôn có nút **Xác nhận**. Các bước biểu diễn rõ: QR hợp lệ, `Kiểm tra vị trí GPS`, `Xác thực FaceIO` mới, `Xác nhận`. Khi thiếu GPS và FaceIO hiển thị **hai cảnh báo đỏ**, thiếu một hiển thị **một cảnh báo đỏ**; nút vẫn nhìn thấy/có thể nhấn để hiện cảnh báo nhưng **không gửi confirm** khi còn thiếu. Sau khi đủ điều kiện và người dùng nhấn, chờ commit, hiển thị `Điểm danh thành công` cùng loại lượt. Nếu ngắt kết nối, query trạng thái trước khi thử lại.

**Server-side:** QR động ký HMAC `{version,kid,attendanceSessionId,slot,nonce,exp}`, slot 30 giây; validate server-side HMAC/expiry/activity/session open. Student registration `registered`, đúng actor. GPS qua browser geolocation: age ≤120s, accuracy ≤100m, geodesic distance ≤ radius 30–300m; backend có thể cấp short proof bound actor/SID/session; FaceIO verify **mới mỗi lượt** qua server-trusted adapter và so `thong_tin_sinh_trac.id_khuon_mat`; tạo face proof TTL ≤120s, one-use. Confirm yêu cầu `{attendanceSessionId,qrProof,gpsProof,faceProof,studentConfirmProof}`; proofs bound user/SID/session/action; claim proof Redis anti-replay, MySQL TX-05 khóa user→activity→detail→session→registration→result, kiểm now trong hạn, activity đủ điều kiện, qr/gps/face fresh, Checkout phải có Check-in. Insert một `ket_qua_diem_danh` UNIQUE `(id_phien_diem_danh,id_dang_ky)` rồi commit. GPS được browser báo cáo **không chống spoofing tuyệt đối**.

**Biên/lỗi:** QR hết hạn ngay trước submit, QR screenshot dùng tại nhà, QR từ phiên khác, thiếu GPS/camera permission, GPS accuracy 101m, age 121s, ngoài bán kính, FaceIO mismatch/timeout, lỗi Redis, hai người dùng dùng chung proof, confirm double-click, Checkout chưa Check-in, session đóng ngay sau xác minh, HTTP response mất sau commit. Không ghi nếu không bấm Xác nhận; không chấp nhận proof stale dù vừa thấy success ở UI.

#### 14.7.3. UI-ATT-03 — Sự cố, rà soát và chốt kết quả

**UI:** operator có danh sách toàn bộ đăng ký, cột Check-in/Checkout (nếu yêu cầu) dưới dạng checkbox khi ở `pending_completed`, hiển thị `Có mặt/Vắng`, nút `Lưu rà soát/Xác nhận hoàn tất`, cảnh báo khi Checkout được tick nhưng Check-in trống. Thao tác sửa chỉ lưu khi xác nhận; màn hiển thị snapshot version/đồng bộ với server. Hủy/sự cố có lý do/confirmation tương ứng; người dùng xem kết quả lịch sử sau chốt.

**Server-side:** rà soát chỉ khi activity ở trạng thái cho phép; server trả snapshot/hash và kết quả. POST patch phải kiểm hash không stale, quyền operator, dependency Checkout→Check-in; chỉ insert/delete `ket_qua_diem_danh` nếu thật sự đổi; lượt thêm thủ công dùng thời gian backend hiện tại, không giả mốc QR/GPS. Finalize TX-06 khóa activity/registrations cần thiết, quyết định completed khi đủ lượt bắt buộc, missed nếu thiếu; activity → `completed`, ghi điểm thông qua trạng thái registration, phát NOTI-13/14 cùng transaction. Scheduler finalize cùng use case, không logic riêng; cancelled/issues giữ registration `registered` và không cộng điểm.

**Biên/lỗi:** hai operator sửa cùng snapshot, manual finalize và scheduler chạy đồng thời, activity incident khi đang review, một người Checkout không Check-in, user đã có kết quả; double submit, không còn Session, scheduler trễ, NOTI-13/14 lặp. 409 `REVIEW_STALE/STATE_CONFLICT` khi snapshot cũ.

---

### 14.8. Lịch sử, thống kê, điểm (Nhóm 08, module `statistics`)

#### 14.8.1. UI-STA-01 — Hoạt động của tôi / Điểm của tôi

**UI:** `Hoạt động của tôi`: hoạt động, ngày, trạng thái, điểm (0 khi chưa đủ điều kiện), tìm theo tên/lọc trạng thái, 10/trang, sắp thời gian bắt đầu mới→cũ. `Thống kê của tôi`: tổng điểm nội bộ + minh chứng ngoài approved, một danh sách gộp ngày tham gia | tên hoạt động | trạng thái | điểm, 10/trang. `Lịch sử nhiệm vụ BTC`: hoạt động | nhiệm vụ | hạn | trạng thái, cho phép mở nhiệm vụ hiện hữu theo quyền.

**Server-side:** read facade qua registrations/activities/evidence/assignments; không trực tiếp ghi điểm. Điểm nội bộ chỉ `SUM(hoat_dong.diem_hoat_dong)` của registration `completed` trong activity `completed`; missed/cancelled/issues = 0. Điểm ngoài `SUM(diem_minh_chung.so_diem)` của minh chứng `approved`; không đếm một hồ sơ hai lần. Bản ghi tự hủy không còn. Filter/pagination ổn định; query total trên toàn bộ tập lọc, không tổng riêng 10 record hiện ở trang.

**Biên/lỗi:** chưa có hoạt động, chỉ có hồ sơ pending, minh chứng approved nhưng thiếu điểm (data anomaly), hoạt động issues, lịch sử task vẫn còn sau activity completed, mẫu số thống kê bằng 0, dữ liệu thay đổi giữa hai trang, scope tài khoản khác.

#### 14.8.2. UI-STA-02 — Thống kê Quản lý/Admin

**UI:** filter thời gian, trạng thái, loại hoạt động, thẻ KPI tổng hoạt động/đăng ký/completed/missed/tỉ lệ hoàn thành, bảng tổng hợp có phân trang. Quản lý xem toàn hệ thống, không lọc ngầm theo Khoa; Admin chỉ xem đúng phạm vi thống kê đã cho trong đặc tả chức năng tại §14.

**Server-side:** chỉ aggregate từ dữ liệu đã chốt; tỉ lệ hoàn thành = `completed/(completed+missed)` của registration thuộc activity completed; denominator 0 trả null/hiển thị `—`. Cẩn trọng timezone filter theo ngày hoạt động Việt Nam, SQL UTC range. Không thêm materialized table và không mutate nguồn.

**Biên/lỗi:** date range sai, empty results, denominator 0, thay ngày vào ranh giới UTC, lọc trang có 0 record nhưng total vẫn đúng, role không đủ quyền.

---

### 14.9. Minh chứng hoạt động ngoài hệ thống (Nhóm 09, module `evidence`)

#### 14.9.1. UI-EVD-01 — Sinh viên nộp/chỉnh sửa/rút minh chứng

**UI:** tabs `Chờ duyệt`, `Đã duyệt`, `Từ chối` và `Nộp minh chứng`. Form: tên hoạt động, mô tả, đơn vị tổ chức, ngày tham gia, một tệp JPG/JPEG/PNG/PDF ≤10MB; preview file và lỗi định dạng. Bản pending được `Sửa`/`Rút`, confirm khi rút. Approved/rejected read-only; rejected có thể nộp **hồ sơ mới** theo chính sách chống trùng.

**Server-side (TX-03):** chỉ End User `student` active, lấy id người nộp từ Session; validate required fields theo các quy tắc trong tài liệu này (kể cả cột SQL nullable `don_vi_to_chuc`, `ngay_tham_gia`), ngày tham gia không tương lai theo VN, file MIME/content thật, private storage. Chống trùng chuẩn hóa `(id_nguoi_nop, tên hoạt động, đơn vị, ngày)` trên pending/approved bằng user lock; exclude chính mình khi sửa. Insert pending; sửa/rút chỉ owner và pending. Rút hard delete + cleanup file; rejected được phép nộp hồ sơ mới khi không trùng hồ sơ pending/approved theo chính sách chống trùng.

**Biên/lỗi:** ngày tương lai, file quá 10MB/trùng/định dạng giả, cùng hồ sơ gửi ở hai tab, ảnh/file bị lỗi giữa upload và commit, rút trong lúc Manager duyệt, chỉnh pending sau chuyển approved, file private bị truy cập không quyền, provider storage unavailable.

#### 14.9.2. UI-EVD-02 — Quản lý duyệt/từ chối minh chứng

**UI:** tabs `Chờ duyệt`/`Đã xử lý`, bảng người nộp/tên/đơn vị/ngày/trạng thái và preview file; hai nút `Duyệt` (yêu cầu nhập số điểm nguyên dương) và `Từ chối` (yêu cầu lý do), modal xác nhận. Không tự cho người nộp duyệt chính họ.

**Server-side (TX-09):** Manager active, khóa reviewer user cần thiết và evidence, yêu cầu `pending`, `id_nguoi_duyet != id_nguoi_nop`; approve set `approved`, reviewer, insert một `diem_minh_chung` với điểm nguyên >0 (UNIQUE id_minh_chung), append NOTI-04 trong transaction. Reject set `rejected` + reason + reviewer, append NOTI-05, không thêm bản điểm. File không được sửa sau xử lý; email không thay cho NOTI.

**Biên/lỗi:** hai Manager cùng duyệt, self-review, điểm 0/âm/số thập phân, reject không lý do, file mất, DB unique collision, request duplicate after commit, session role vừa bị thu hồi.

---

### 14.10. Thông báo (Nhóm 10, module `notifications`)

#### 14.10.1. UI-NOT-01 — Chuông và danh sách thông báo

**UI:** chuông có số chưa đọc; mở dropdown xem **5 mới nhất**; `Xem tất cả` mở rộng trong dropdown, tải **10 đầu**, cuộn tới gần cuối tải tiếp 10; spinner `Đang tải...`, retry giữ các item cũ. Nhấn một item đánh dấu đã đọc rồi điều hướng; `Đánh dấu tất cả đã đọc` ở đầu dropdown cập nhật cả bản ghi chưa tải. Không đánh dấu đọc chỉ vì mở chuông/cuộn; không có `Đánh dấu chưa đọc`, không xóa thông báo.

**Server-side:** chỉ read/update các bản ghi `nguoi_nhan_thong_bao` của current user; `da_doc false→true`, ghi `thoi_gian_doc` lần đầu, nhấn lại không ghi đè thời gian; stable cursor `(thoi_gian_tao DESC,id_thong_bao DESC)`, snapshot nội dung không sửa khi activity đổi; click đích kiểm lại quyền/availability và fallback phù hợp. Unread count từ toàn bộ recipient rows, không chỉ mười mục đã tải.

**Biên/lỗi:** notification đích ẩn/xóa, mất quyền, hai thiết bị read cùng item, mark-all đồng thời fetch, page cursor stale, Redis/session expired, request read lại không đổi timestamp.

#### 14.10.2. NOTI Write Contract — 11 sự kiện đã chốt

| Mã | Sự kiện thực sự | Recipient |
|---|---|---|
| `NOTI-01` | Activity → cancelled | Registrants còn tồn tại ∪ BTC đã công bố, distinct; có lý do |
| `NOTI-02` | Sửa tên/start/end/địa điểm thực sự ở trạng thái hợp lệ | Chỉ tên: registrants; đổi thời gian/địa điểm: registrants ∪ BTC; một event/save |
| `NOTI-03` | **Publish draft→published thành công** | Distinct user từ assignments được ghi chính thức |
| `NOTI-04` | Minh chứng approved | Người nộp |
| `NOTI-05` | Minh chứng rejected | Người nộp |
| `NOTI-10` | Activity → pending_issues | Registrants còn tồn tại |
| `NOTI-11` | pending_issues → progress | Registrants còn tồn tại |
| `NOTI-12` | Activity → issues | Registrants còn tồn tại |
| `NOTI-13` | Activity completed và registration completed | Người hoàn thành, có điểm |
| `NOTI-14` | Activity completed và registration missed | Người không đủ lượt, không điểm |
| `NOTI-15` | Nhắc ngày diễn ra theo REM-01…07 | Registrants hợp lệ |

**Không có** `NOTI-06/07/08/09`. Không tạo chuông cho register/unregister, cập nhật tiến độ nhiệm vụ, mở/đóng phiên, bài đăng, chuyển `published→pending→progress` thông thường. Mỗi event ghi một `thong_bao` và recipient rows trong transaction nghiệp vụ nguồn, không tạo NOTI khi no-op/failure; timestamp UTC. `NOTI-15` dùng scheduler transaction riêng với activity lock và identity `(activityId, NOTI-15, tieu_de='Nhắc hoạt động ngày YYYY-MM-DD')` theo ngày VN; không tạo lại ngày A nếu activity đổi ngày A→B→A, không gửi khi đã tới startAt. Không giả định PK recipient chống được hai event nguồn trùng nhau.

**Biên/lỗi:** publish hai lần, người nhận có nhiều nhiệm vụ, union BTC+registrant, scheduler đa instance, sự cố lặp nhiều lần hợp lệ, notification chứa link đã hết quyền, lost HTTP response, event snapshot không cập nhật lại khi activity đổi.

---

### 14.11. Bài đăng và News Feed (Nhóm 11, module `posts`)

#### 14.11.1. UI-POST-01 — Soạn và quản lý bài đăng

**UI:** Admin/Manager có màn danh sách 3 tabs `Đã đăng`, `Bản nháp`, `Đã ẩn`, tìm tiêu đề, 10/trang; Admin quản lý mọi bài, Manager chỉ bài mình. Editor gồm tiêu đề, Rich Text (bold/italic/list/line break/link) và tối đa một ảnh; nút `Xem trước` cạnh `Lưu nháp`/`Đăng bài`. Preview không ghi DB và quay lại giữ form. Hành động `Ẩn`, `Hiện lại`, `Xóa` có modal xác nhận; không có duyệt bài.

**Server-side (TX-10):** author ID từ session, role/owner guard, sanitize HTML allowlist chặn script/iframe/event handlers/XSS, ảnh JPG/JPEG/PNG/WEBP ≤5MB kiểm content thực. Draft bắt buộc title, `noi_dung` có thể rỗng, `thoi_gian_dang=NULL`; publish cần title và Rich Text còn văn bản hợp lệ sau sanitize; set `thoi_gian_dang` **một lần** khi publish đầu tiên; `published↔hidden` giữ nguyên mốc này. Khi thay thật tiêu đề/nội dung/ảnh ở bài từng công khai, cập nhật `lastEditedAt` metadata có cấu trúc bên trong `noi_dung`, không tạo cột mới; no-op/ẩn/hiện không làm mới mốc. Hard delete bản ghi và cleanup ảnh không còn tham chiếu.

**Biên/lỗi:** nội dung chỉ `<br>`/HTML rỗng, XSS link, file giả MIME, ảnh cũ cần cleanup sau commit, cùng bài hai editor ghi cạnh nhau, save no-op, sửa published thành HTML invalid phải giữ bản công khai cũ, hidden republish không đổi thoi_gian_dang, metadata parser gặp content legacy. **Codec đã được chốt tại §10 (`ADR-06`):** dùng JSON envelope `v=1`; nếu có dữ liệu bài viết kiểu cũ, cần kiểm kê và xử lý chuyển đổi trước khi triển khai, không tự thêm fallback.

#### 14.11.2. UI-POST-02 — News Feed công khai

**UI:** homepage chia Tin tức bên trái và Hoạt động bên phải thành hai cột bằng nhau, stack trên mobile. Tin tức không có ô tìm kiếm; danh sách cuộn với **10 bài tải đầu**, infinite scroll 10/lần. Bài hiện tên tác giả, tiêu đề, Rich Text trực tiếp, ảnh nếu có, một dòng thời gian (`Đăng lúc ...` hoặc `Được chỉnh sửa lúc ...`), `Xem thêm` inline; spinner `Đang tải...`, lỗi `Không thể tải bài viết – Thử lại`, cuối `Bạn đã xem hết bài viết`. Không có like/comment/share nội bộ; khách chưa login vẫn đọc published. Menu tài khoản gồm Hồ sơ, Hoạt động (user/staff) hoặc Quản lý tài khoản (admin), Đăng xuất. Các màn dùng chung header/footer public. User có ba mục Hoạt động/Kết quả tham gia/Minh chứng; staff có Hoạt động/Danh sách hoạt động đã công bố/Minh chứng để duyệt. API duyệt chưa được triển khai thì thao tác vẫn khóa, không giả lập danh sách hay kết quả. Liên kết và giao diện đề xuất chỉ dành cho khách, tài khoản đã đăng nhập mở `/proposals` được chuyển về `/`.

**Server-side:** public chỉ query `published`, sort `thoi_gian_dang DESC, id_bai_dang DESC` theo mốc publish lần đầu (không đẩy bài sửa/republish lên đầu), stable cursor; sanitize output, không lộ draft/hidden qua ID; URL trong bài dẫn tới đích và guard ở đích. Không cần realtime/WebSocket.

**Biên/lỗi:** bài bị ẩn sau khi tải page trước, feed đồng thời thêm bài mới, mạng đứt ở page 2, nội dung rất dài, ảnh không tồn tại, link hoạt động bị ẩn, nhiều bài có cùng timestamp.

---

## 15. Hợp đồng DDL vật lý đầy đủ (17 bảng)

Khối SQL sau đây được nhúng **nguyên vẹn về định nghĩa cấu trúc** từ DDL mục tiêu khi biên soạn file. Đây là nguồn chuẩn cho tên bảng/cột, `NOT NULL`, defaults, primary key, index, unique và foreign key; không coi comment là DB constraint. Các quy tắc ngoài khả năng biểu đạt của DDL được áp dụng tại application layer.

```sql
-- ============================================================
-- DATABASE: community_management
-- He thong quan ly cac hoat dong cong dong
-- Quy uoc: ten bang/cot dung snake_case; InnoDB; utf8mb4
-- ============================================================

CREATE DATABASE IF NOT EXISTS community_management
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE community_management;

-- ------------------------------------------------------------
-- 1. Danh muc khoa
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS khoa (
    id_khoa VARCHAR(20) NOT NULL,
    ten_khoa VARCHAR(150) NOT NULL,
    PRIMARY KEY (id_khoa)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2. Vai tro va nguoi dung
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vai_tro (
    id_vai_tro INT UNSIGNED NOT NULL AUTO_INCREMENT,
    ten_vai_tro VARCHAR(100) NOT NULL,
    mo_ta TEXT NULL,
    PRIMARY KEY (id_vai_tro),
    UNIQUE KEY uq_vai_tro_ten (ten_vai_tro)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nguoi_dung (
    id_nguoi_dung INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_vai_tro INT UNSIGNED NOT NULL,
    id_khoa VARCHAR(20) NULL,
    loai_nguoi_dung VARCHAR(30) NULL,
    ten_dang_nhap VARCHAR(100) NOT NULL,
    mat_khau VARCHAR(255) NOT NULL,
    ho_ten VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    so_dien_thoai VARCHAR(20) NULL,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'active',
    PRIMARY KEY (id_nguoi_dung),
    UNIQUE KEY uq_nguoi_dung_ten_dang_nhap (ten_dang_nhap),
    UNIQUE KEY uq_nguoi_dung_email (email),
    KEY idx_nguoi_dung_vai_tro (id_vai_tro),
    KEY idx_nguoi_dung_khoa (id_khoa),
    CONSTRAINT fk_nguoi_dung_vai_tro
        FOREIGN KEY (id_vai_tro) REFERENCES vai_tro (id_vai_tro)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_nguoi_dung_khoa
        FOREIGN KEY (id_khoa) REFERENCES khoa (id_khoa)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 3. Thong tin sinh trac (ma dinh danh FaceIO)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS thong_tin_sinh_trac (
    id_sinh_trac INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_nguoi_dung INT UNSIGNED NOT NULL,
    id_khuon_mat VARCHAR(255) NOT NULL,
    ngay_cap_nhat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_sinh_trac),
    UNIQUE KEY uq_sinh_trac_nguoi_dung (id_nguoi_dung),
    UNIQUE KEY uq_sinh_trac_khuon_mat (id_khuon_mat),
    CONSTRAINT fk_sinh_trac_nguoi_dung
        FOREIGN KEY (id_nguoi_dung) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 4. Bai dang
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bai_dang (
    id_bai_dang INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_nguoi_dang INT UNSIGNED NOT NULL,
    tieu_de VARCHAR(255) NOT NULL,
    thoi_gian_dang DATETIME NULL DEFAULT NULL,
    noi_dung TEXT NOT NULL,
    hinh_anh VARCHAR(500) NULL,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'draft',
    PRIMARY KEY (id_bai_dang),
    KEY idx_bai_dang_nguoi_dang (id_nguoi_dang),
    CONSTRAINT fk_bai_dang_nguoi_dang
        FOREIGN KEY (id_nguoi_dang) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5. Don vi ben ngoai va de xuat hoat dong
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS don_vi_ben_ngoai (
    id_don_vi INT UNSIGNED NOT NULL AUTO_INCREMENT,
    ten_don_vi VARCHAR(200) NOT NULL,
    loai_don_vi VARCHAR(100) NULL,
    PRIMARY KEY (id_don_vi)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS de_xuat_hoat_dong (
    id_de_xuat INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_don_vi INT UNSIGNED NOT NULL,
    ben_lien_he VARCHAR(150) NULL,
    email_lien_he VARCHAR(150) NULL,
    so_dien_thoai VARCHAR(20) NULL,
    ten_hoat_dong VARCHAR(255) NOT NULL,
    mo_ta TEXT NULL,
    dia_diem TEXT NULL,
    thoi_gian_du_kien DATETIME NULL,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'pending',
    id_nguoi_duyet INT UNSIGNED NULL,
    ly_do_tu_choi TEXT NULL,
    PRIMARY KEY (id_de_xuat),
    KEY idx_de_xuat_don_vi (id_don_vi),
    KEY idx_de_xuat_nguoi_duyet (id_nguoi_duyet),
    CONSTRAINT fk_de_xuat_don_vi
        FOREIGN KEY (id_don_vi) REFERENCES don_vi_ben_ngoai (id_don_vi)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_de_xuat_nguoi_duyet
        FOREIGN KEY (id_nguoi_duyet) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 6. Hoat dong va chi tiet hoat dong
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hoat_dong (
    id_hoat_dong INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_don_vi INT UNSIGNED NULL,
    id_de_xuat INT UNSIGNED NULL,
    id_nguoi_tao INT UNSIGNED NOT NULL,
    ten_hoat_dong VARCHAR(255) NOT NULL,
    mo_ta TEXT NULL,
    gioi_han_dang_ky INT UNSIGNED NULL,
    diem_hoat_dong INT NOT NULL DEFAULT 0,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'draft',
    ke_hoach_hoat_dong VARCHAR(500) NULL,
    PRIMARY KEY (id_hoat_dong),
    UNIQUE KEY uq_hoat_dong_de_xuat (id_de_xuat),
    KEY idx_hoat_dong_don_vi (id_don_vi),
    KEY idx_hoat_dong_nguoi_tao (id_nguoi_tao),
    CONSTRAINT fk_hoat_dong_don_vi
        FOREIGN KEY (id_don_vi) REFERENCES don_vi_ben_ngoai (id_don_vi)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_hoat_dong_de_xuat
        FOREIGN KEY (id_de_xuat) REFERENCES de_xuat_hoat_dong (id_de_xuat)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_hoat_dong_nguoi_tao
        FOREIGN KEY (id_nguoi_tao) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chi_tiet_hoat_dong (
    id_chi_tiet_hoat_dong INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_hoat_dong INT UNSIGNED NOT NULL,
    thoi_gian_bat_dau DATETIME NOT NULL,
    thoi_gian_ket_thuc DATETIME NOT NULL,
    dia_diem TEXT NULL,
    vi_do DECIMAL(10,7) NULL,
    kinh_do DECIMAL(10,7) NULL,
    yeu_cau_check_out BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id_chi_tiet_hoat_dong),
    UNIQUE KEY uq_chi_tiet_hoat_dong (id_hoat_dong),
    CONSTRAINT fk_chi_tiet_hoat_dong_hoat_dong
        FOREIGN KEY (id_hoat_dong) REFERENCES hoat_dong (id_hoat_dong)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 7. Dang ky hoat dong
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dang_ky_hoat_dong (
    id_dang_ky INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_nguoi_dung INT UNSIGNED NOT NULL,
    id_hoat_dong INT UNSIGNED NOT NULL,
    thoi_gian_dang_ky DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'registered',
    PRIMARY KEY (id_dang_ky),
    UNIQUE KEY uq_dang_ky_nguoi_dung_hoat_dong
        (id_nguoi_dung, id_hoat_dong),
    KEY idx_dang_ky_hoat_dong (id_hoat_dong),
    CONSTRAINT fk_dang_ky_nguoi_dung
        FOREIGN KEY (id_nguoi_dung) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_dang_ky_hoat_dong
        FOREIGN KEY (id_hoat_dong) REFERENCES hoat_dong (id_hoat_dong)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 8. Phan cong nhiem vu
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS phan_cong_nhiem_vu (
    id_phan_cong INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_chi_tiet_hoat_dong INT UNSIGNED NOT NULL,
    id_nguoi_dung INT UNSIGNED NOT NULL,
    ten_nhiem_vu VARCHAR(255) NOT NULL,
    mo_ta_nhiem_vu TEXT NULL,
    loai_nhiem_vu VARCHAR(100) NULL,
    thoi_gian_bat_dau DATETIME NULL,
    thoi_gian_ket_thuc DATETIME NULL,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'assigned',
    PRIMARY KEY (id_phan_cong),
    KEY idx_phan_cong_chi_tiet (id_chi_tiet_hoat_dong),
    KEY idx_phan_cong_nguoi_dung (id_nguoi_dung),
    CONSTRAINT fk_phan_cong_chi_tiet
        FOREIGN KEY (id_chi_tiet_hoat_dong)
        REFERENCES chi_tiet_hoat_dong (id_chi_tiet_hoat_dong)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_phan_cong_nguoi_dung
        FOREIGN KEY (id_nguoi_dung) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 9. Phien diem danh va ket qua diem danh
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS phien_diem_danh (
    id_phien_diem_danh INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_chi_tiet_hoat_dong INT UNSIGNED NOT NULL,
    loai_diem_danh VARCHAR(30) NOT NULL,
    thoi_gian_bat_dau DATETIME NOT NULL,
    thoi_gian_ket_thuc DATETIME NOT NULL,
    yeu_cau_gps BOOLEAN NOT NULL DEFAULT FALSE,
    vi_do DECIMAL(10,7) NULL,
    kinh_do DECIMAL(10,7) NULL,
    ban_kinh_cho_phep INT UNSIGNED NULL COMMENT 'Don vi: met',
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'scheduled',
    PRIMARY KEY (id_phien_diem_danh),
    KEY idx_phien_diem_danh_chi_tiet (id_chi_tiet_hoat_dong),
    CONSTRAINT fk_phien_diem_danh_chi_tiet
        FOREIGN KEY (id_chi_tiet_hoat_dong)
        REFERENCES chi_tiet_hoat_dong (id_chi_tiet_hoat_dong)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ket_qua_diem_danh (
    id_ket_qua INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_phien_diem_danh INT UNSIGNED NOT NULL,
    id_dang_ky INT UNSIGNED NOT NULL,
    thoi_gian_diem_danh DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vi_do DECIMAL(10,7) NULL,
    kinh_do DECIMAL(10,7) NULL,
    PRIMARY KEY (id_ket_qua),
    UNIQUE KEY uq_ket_qua_phien_dang_ky
        (id_phien_diem_danh, id_dang_ky),
    KEY idx_ket_qua_dang_ky (id_dang_ky),
    CONSTRAINT fk_ket_qua_phien_diem_danh
        FOREIGN KEY (id_phien_diem_danh)
        REFERENCES phien_diem_danh (id_phien_diem_danh)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_ket_qua_dang_ky
        FOREIGN KEY (id_dang_ky) REFERENCES dang_ky_hoat_dong (id_dang_ky)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 10. Minh chung hoat dong va diem minh chung
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS minh_chung_hoat_dong (
    id_minh_chung INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_nguoi_nop INT UNSIGNED NOT NULL,
    ten_hoat_dong VARCHAR(255) NOT NULL,
    mo_ta TEXT NULL,
    don_vi_to_chuc VARCHAR(200) NULL,
    ngay_tham_gia DATE NULL,
    tep_minh_chung VARCHAR(500) NOT NULL,
    ngay_nop DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'pending',
    id_nguoi_duyet INT UNSIGNED NULL,
    ly_do_tu_choi TEXT NULL,
    PRIMARY KEY (id_minh_chung),
    KEY idx_minh_chung_nguoi_nop (id_nguoi_nop),
    KEY idx_minh_chung_nguoi_duyet (id_nguoi_duyet),
    CONSTRAINT fk_minh_chung_nguoi_nop
        FOREIGN KEY (id_nguoi_nop) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_minh_chung_nguoi_duyet
        FOREIGN KEY (id_nguoi_duyet) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS diem_minh_chung (
    id_diem_minh_chung INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_minh_chung INT UNSIGNED NOT NULL,
    so_diem INT NOT NULL,
    ngay_cong_diem DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_diem_minh_chung),
    UNIQUE KEY uq_diem_minh_chung (id_minh_chung),
    CONSTRAINT fk_diem_minh_chung_minh_chung
        FOREIGN KEY (id_minh_chung)
        REFERENCES minh_chung_hoat_dong (id_minh_chung)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 11. Thong bao va nguoi nhan thong bao
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS thong_bao (
    id_thong_bao INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_hoat_dong INT UNSIGNED NULL,
    loai_thong_bao VARCHAR(50) NOT NULL,
    tieu_de VARCHAR(255) NOT NULL,
    noi_dung TEXT NOT NULL,
    thoi_gian_tao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_thong_bao),
    KEY idx_thong_bao_hoat_dong (id_hoat_dong),
    CONSTRAINT fk_thong_bao_hoat_dong
        FOREIGN KEY (id_hoat_dong) REFERENCES hoat_dong (id_hoat_dong)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nguoi_nhan_thong_bao (
    id_thong_bao INT UNSIGNED NOT NULL,
    id_nguoi_dung INT UNSIGNED NOT NULL,
    da_doc BOOLEAN NOT NULL DEFAULT FALSE,
    thoi_gian_doc DATETIME NULL,
    PRIMARY KEY (id_thong_bao, id_nguoi_dung),
    KEY idx_nguoi_nhan_thong_bao_nguoi_dung (id_nguoi_dung),
    CONSTRAINT fk_nguoi_nhan_thong_bao_thong_bao
        FOREIGN KEY (id_thong_bao) REFERENCES thong_bao (id_thong_bao)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_nguoi_nhan_thong_bao_nguoi_dung
        FOREIGN KEY (id_nguoi_dung) REFERENCES nguoi_dung (id_nguoi_dung)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;
```

### 15.1. Các lưu ý bất biến giữa DDL và nghiệp vụ

- **Không có CHECK** `id_nguoi_duyet <> id_nguoi_nop` trong SQL: `TX-EVIDENCE` phải tự chặn self-review. Không suy đoán `CHECK` chỉ từ ghi chú.
- `phan_cong_nhiem_vu` không có UNIQUE lịch; `phien_diem_danh` không có UNIQUE cho `(id_chi_tiet_hoat_dong,loai_diem_danh)`; notification reminder không có UNIQUE key. Phải serialize bằng parent locks trong §§6–9.
- `chi_tiet_hoat_dong.thoi_gian_bat_dau` và `thoi_gian_ket_thuc` là NOT NULL: draft thiếu ngày chưa có child detail.
- `nguoi_dung.trang_thai DEFAULT 'active'` ở DDL không được dùng khi cấp tài khoản: luôn ghi rõ `pending_activation`.
- Các giá trị status/loại trong DB dùng `VARCHAR`; enum logic là validation của backend, không phải MySQL enum.
- Nếu DB runtime khác DDL mục tiêu, xác minh migration, backup và dữ liệu trước khi thay đổi. Không xoá dữ liệu có giá trị chỉ để bỏ backward compatibility.

## 16. Hợp đồng HTTP/API triển khai theo lát cắt

Các route tại §11.1 là nguồn route theo module. Bảng dưới đây **quy định phương thức API** ở mức kiến trúc; các method chưa được chỉ rõ trong đặc tả nguồn được chọn theo REST convention và phải cập nhật Swagger/OpenAPI cùng DTO thực tế khi implement từng vertical slice. Không tạo route giả `/.../`. Các trường request không được tự suy diễn từ tên endpoint nếu không có trong §14 hoặc DDL §15.

| Nhóm | HTTP method + path | Điều kiện trọng tâm / payload đã xác định |
|---|---|---|
| Auth | `POST /api/v1/auth/login/password` | `username`, `password` → preauth ticket; không tạo full session |
| Auth | `POST /api/v1/auth/login/face` | Preauth + FaceIO verified server-side → cookie session |
| Auth | `GET /api/v1/auth/session` | Current session, **không refresh TTL** do polling |
| Auth | `POST /api/v1/auth/logout` / `POST /api/v1/auth/logout-all` | Revoke session/index atomically trong Redis |
| Users | `GET /api/v1/users`; `POST /api/v1/users` | Admin, query filter/pagination; create pending activation |
| Users | `POST /api/v1/users/import/preview`; `POST /api/v1/users/import/commit` | Import preview/validate rồi commit |
| Users | `PATCH /api/v1/users/:id/role`; `POST /api/v1/users/:id/lock` | Admin, lock/role rules và security revoke |
| Activities | `GET /api/v1/activities`; `POST /api/v1/activities`; `GET /api/v1/activities/:id` | Public list giới hạn published hợp lệ, Manager draft/CRUD theo quyền |
| Activities | `POST /api/v1/activities/:id/publish` | Body `{assignments:[{userId,taskName,description?,taskType,startAt?,endAt?}]}`; assignment + status + NOTI-03 commit cùng TX |
| Activities | `POST /api/v1/activities/:id/cancel`; `/incident`; `/resume`; `/finalize` | Chỉ state transition hợp lệ, reason nơi cần |
| Assignments | `GET /api/v1/activities/:id/assignments` | Read-only sau publish; không CRUD/cancel cấu trúc |
| Assignments | `POST /api/v1/assignments/:id/progress`; `/complete`; `/review` | Assignee/reviewer policy; trạng thái tiến độ |
| Proposals | `POST /api/v1/proposals/public`; `GET /api/v1/proposals` | Public form; Manager review list |
| Proposals | `POST /api/v1/proposals/:id/approve`; `/reject`; `/create-activity` | Pending/approved state/one-linked-activity |
| Registrations | `POST /api/v1/activities/:id/register`; `/unregister` | Student active, cutoff D−2, capacity, no BTC conflict |
| Registrations | `GET /api/v1/registrations/me`; `GET /api/v1/activities/:id/registrations` | Self / Manager theo scope |
| Attendance | `POST /api/v1/activities/:id/attendance-sessions` | Operator cấu hình session, loại, time/GPS |
| Attendance | `POST /api/v1/attendance-sessions/:id/open`; `/close`; `/stop`; `/reopen` | Transition session và lock checkout policy |
| Attendance | `GET /api/v1/attendance-sessions/:id/qr` | Chỉ operator, session open, QR HMAC 30s |
| Attendance | `POST /api/v1/attendance/prepare`; `/gps-proof`; `/face-proof`; `/confirm` | QR/GPS/FaceIO proof một lần; confirm phải do student click |
| Attendance | `GET /api/v1/activities/:id/attendance-review`; `PATCH /api/v1/activities/:id/attendance-review` | Snapshot hash, patch check-in/out; 409 REVIEW_STALE |
| Evidence | `GET /api/v1/evidence`; `POST /api/v1/evidence`; `PATCH /api/v1/evidence/:id`; `POST /api/v1/evidence/:id/withdraw` | Student owner, pending, file ≤10MB |
| Evidence | `POST /api/v1/evidence/:id/approve`; `/reject` | Manager, không self-review, điểm integer >0/reason |
| Notifications | `GET /api/v1/notifications`; `/unread-count` | Current user, cursor; chỉ đọc recipient |
| Notifications | `POST /api/v1/notifications/:id/read`; `/read-all` | Mark read idempotent, không có mark unread |
| Statistics | `GET /api/v1/statistics/me`; `/my-assignments`; `/manager`; `/admin` | Read-only aggregate theo role |
| Posts | `GET /api/v1/posts/public`; `GET /api/v1/posts`; `POST /api/v1/posts`; `PATCH /api/v1/posts/:id` | Published feed / owner/Admin manage; sanitize Rich Text |
| Posts | `POST /api/v1/posts/:id/publish`; `/hide`; `DELETE /api/v1/posts/:id` | State/ownership; publish time immutable |

### 16.1. Common DTO, Response và pagination

```ts
// Shape logic; source of types thực tế do DTO/OpenAPI từng endpoint cung cấp.
type ApiError = { code: string; message: string; requestId: string; details?: unknown };
type PageQuery = { page?: number; pageSize?: number; search?: string };
type AttendanceConfirmRequest = {
  attendanceSessionId: number;
  qrProof: string;
  gpsProof: string;
  faceProof: string;
  studentConfirmProof: string;
};
type PublishRequest = {
  assignments: Array<{
    userId: number;
    taskName: string;
    description?: string | null;
    taskType: 'leader' | 'member';
    startAt?: string | null;
    endAt?: string | null;
  }>;
};
```

- JSON sử dụng `camelCase`; database vẫn giữ nguyên các cột `snake_case` theo §15.
- DateTime instant là ISO-8601 UTC có `Z`; `ngay_tham_gia` nhận ngày lịch `YYYY-MM-DD`.
- Collection dạng bảng mặc định `pageSize=10`; News Feed và notification dùng cursor `(timestamp DESC, id DESC)` và tải 10/lượt; backend whitelist/validate filters.
- Thành công chỉ trả sau commit; `GET` dùng để xác minh outcome khi mất response. Không tự retry request có tác dụng phụ nếu chưa biết kết quả.
- HTTP error codes, message và exception mapping theo §11.2, không expose internal exception/secret. DTO response của endpoint chưa có trường đầy đủ trong đầu vào phải được chốt trong quá trình triển khai lát cắt, không giả là tài liệu đã quy định sẵn.

### 16.2. Quy tắc sinh OpenAPI mà không tạo tài liệu nghiệp vụ thứ hai

Swagger/OpenAPI tự sinh từ Controller + DTO để frontend tích hợp và test, **không** được coi là nguồn nghiệp vụ thứ hai độc lập. Khi phát hiện khác biệt giữa code/OpenAPI và file này, sửa code hoặc cập nhật `architecture.md` bằng quyết định đã phê duyệt, không âm thầm để drift. Giữ source code nhỏ nhất có thể chạy end-to-end; không viết hàng loạt DTO giả khi chưa triển khai module.

## 17. Kiểm thử chấp nhận và Definition of Done thống nhất

- Bắt buộc giữ toàn bộ bộ `ARCH-T01`…`ARCH-T18` ở §12.2; bổ sung kiểm thử riêng cho các màn UI tại §14 tương ứng với `UI-*`.
- Integration tests trên MySQL InnoDB và Redis thật, kiểm deadlock, phantom/row locks, Redis outage và lost HTTP response. Không dùng SQLite/mock để khẳng định transaction correctness.
- E2E phải bao phủ luồng account activation → FaceIO enrollment → login; activity draft → publish + tasks + NOTI-03; register → QR/GPS/FaceIO confirm → review/finalize → statistics; proposals/evidence/posts theo scope.
- Acceptance criteria: đúng quyền/role/state/time, schema target, rollback nguyên tử ở MySQL, validate server-side, idempotency khi retry, private storage, logging không lộ secret, UI desktop/mobile có loading/empty/error/forbidden/success.

## 18. Quyết định chưa được xác nhận và điều kiện chặn triển khai

| ID | Tình trạng | Quy tắc Agent |
|---|---|---|
| `AUTH-LEADER` (`ADR-01`) | Chưa được phê duyệt dứt điểm liệu End User có thể làm Trưởng BTC | Chỉ dùng Manager active như **phương án tạm định để phân tích**. Không triển khai publish/attendance operator guard dựa vào giả định này cho tới khi chủ dự án chốt |
| `TASK-TIME-NULL` (`ADR-09`) | Null boundary của nhiệm vụ chưa được xác nhận về nghiệp vụ | Không triển khai thuật toán chống trùng final cho các khoảng NULL trước khi chốt semantics |
| `LEADER-COUNT` | Số lượng leader chính xác mỗi activity chưa được xác nhận từ nguồn nghiệp vụ độc lập | Không tự quy định `exactly one` khi validator publish chưa được phê duyệt |
| `API-DETAILS` | Một số request/response, parameter, error mapping per endpoint chưa hiện diện trong nguồn | Không suy diễn nghiệp vụ; chốt DTO khi triển khai lát cắt dựa trên §14–16 hoặc hỏi chủ dự án nếu phát sinh chức năng/quyền mới |
| `DB-RUNTIME` | DDL là mục tiêu; trạng thái DB đang chạy/migrations chưa được inspect trong gói nguồn | Trước migrate phải inspect DB runtime, snapshot/backup khi cần, không dùng db push tùy ý |
| `EMAIL-DELIVERY` | Không có outbox/history nên không bảo đảm email exactly-once/durable retry qua crash | Nêu rõ best-effort sau commit, expose resend thủ công theo quyền; muốn durable retry cần phê duyệt thay đổi phạm vi |

**Quy tắc làm việc:** Chỉ dừng endpoint trực tiếp phụ thuộc quyết định chưa chốt; module không liên quan vẫn triển khai theo vertical slice. Không tự cấp quyền mới, thay đổi schema hoặc biến sự thật thiếu căn cứ thành invariant bắt buộc.

## 19. Quy tắc dành cho AI Coding Agent (tóm tắt vận hành)

1. Đọc **chính file này** trước khi lập kế hoạch/code; không yêu cầu tài liệu đặc tả khác để hiểu các chức năng đã ghi tại đây. Đọc source code, Prisma schema và migrations runtime để xác định thực tế triển khai.
2. Giao tiếp và viết tài liệu giải thích bằng tiếng Việt chuyên ngành CNTT; giữ source code, identifiers, interface names, error codes, API contracts và technical terms bằng tiếng Anh khi phù hợp. Tên bảng/cột SQL phải giữ nguyên tiếng Việt không dấu `snake_case`.
3. Ưu tiên giải pháp đơn giản nhất đáp ứng đúng nghiệp vụ; sử dụng dependency hiện có trước, ưu tiên thư viện được bảo trì tốt; không tạo speculative abstraction/microservices/outbox hoặc compatibility fallback.
4. Mỗi lần làm một vertical slice hoàn chỉnh gồm DTO, guard/policy, application use case, repository, frontend UI và tests liên quan. Không đánh đổi một hệ thống đang chạy tốt để tạo kiến trúc dở dang.
5. Tuân module ownership, một transaction coordinator cho cross-module use case và lock order `CON-01`. Không giữ lock khi gọi provider; không khẳng định atomicity xuyên MySQL/Redis.
6. Không tự thay đổi 17 bảng, 3 role, các status literal, 11 notifications hay cơ chế localStorage assignment draft. Mọi thay đổi phạm vi cần được phê duyệt rõ.
7. Gặp vấn đề `BLOCKED` trong §18: báo đúng câu hỏi, không quyết định thay chủ dự án; tiếp tục các phần không phụ thuộc nếu có thể.
8. Mọi tính năng chỉ hoàn thành khi có test cho quyền, validation, state/time, transaction, race khi cần và trải nghiệm lỗi/resume trên frontend.
