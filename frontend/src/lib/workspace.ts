export type SystemActivity = {
  id: number; name: string; status: string; ownerId?: number; description: string | null; startAt: string | null; endAt: string | null;
  location: string | null; requiresCheckout: boolean; capacity: number | null; registrations: number; points: number;
  registrationStatus: string | null; awardedPoints: number;
  sessions: { type: string; status: string; startAt: string; endAt: string }[];
  tasks: { id: number; name: string; status: string; startAt: string | null; endAt: string | null }[];
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
