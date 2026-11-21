export type SystemActivity = {
  imageUrl?: string | null;
  locationNote?: string | null;
  id: number; name: string; status: string; ownerId?: number; description: string | null; startAt: string | null; endAt: string | null;
  location: string | null; requiresCheckout: boolean; capacity: number | null; registrations: number; points: number;
  registrationStatus: string | null; awardedPoints: number;
  sessions: { type: string; status: string; startAt: string; endAt: string }[];
  tasks: { id: number; name: string; status: string; startAt: string | null; endAt: string | null }[];
  assignments?: { id: number; name: string; type: string | null; assignee: string; status?: string }[];
};

export type WorkspaceData = {
  serverTime: string;
  user: { id: number; name: string; username: string; email: string; phone: string | null; faculty: string; role: 'user' | 'staff' | 'admin'; type: string | null };
  accounts: { id_nguoi_dung: number; ten_dang_nhap: string; ho_ten: string; email: string; trang_thai: string; vai_tro: { ten_vai_tro: string } }[];
  activities: SystemActivity[];
  notifications: { id: number; title: string; content: string; createdAt: string; read: boolean }[];
  evidence: { id: number; name: string; organization: string | null; date: string | null; status: string; reason: string | null; points: number }[];
};

export const workspaceViews = {
  accounts: 'Quản lý tài khoản',
  activities: 'Hoạt động',
  registrations: 'Kết quả tham gia',
  published: 'Danh sách hoạt động',
  evidenceReview: 'Minh chứng',
  attendance: 'Điểm danh',
  statistics: 'Thống kê của tôi',
  evidence: 'Minh chứng',
  tasks: 'Nhiệm vụ của tôi',
  profile: 'Hồ sơ cá nhân',
} as const;

export type WorkspaceView = keyof typeof workspaceViews;

const activityStatuses: Record<string, string> = {
  draft: 'Khởi tạo', published: 'Mở tiếp nhận đăng ký', pending: 'Ngừng tiếp nhận đăng ký',
  progress: 'Đang diễn ra', pending_issues: 'Tạm ngưng do sự cố', issues: 'Kết thúc do sự cố',
  pending_completed: 'Chờ xác nhận hoàn thành', completed: 'Hoàn tất', cancelled: 'Đã hủy bỏ',
};

export const activityStatusLabel = (status: string) => activityStatuses[status] ?? 'Chưa xác định';
