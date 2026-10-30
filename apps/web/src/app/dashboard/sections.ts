export type RoleCode =
  | "ADMIN"
  | "CANBOKHOA"
  | "GIANGVIEN"
  | "SINHVIEN"
  | "PHONGKHCN"
  | "HIEUTRUONG"
  | "PHONGCTSV";

export type DashboardSection = {
  id: string;
  title: string;
  detail: string;
  roles: RoleCode[];
  parentId?: string;
};

const staff = ["ADMIN", "CANBOKHOA", "GIANGVIEN"] as const;
const managers = ["ADMIN", "CANBOKHOA", "GIANGVIEN"] as const;
const allStaff = ["ADMIN", "CANBOKHOA", "GIANGVIEN", "PHONGKHCN", "HIEUTRUONG", "PHONGCTSV"] as const;
const allUsers = [...allStaff, "SINHVIEN"] as const;

export const sections: DashboardSection[] = [
  { id: "overview", title: "Trang chủ", detail: "Theo dõi hoạt động học thuật của toàn khoa.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN", "PHONGCTSV"] },
  { id: "users", title: "Tài khoản & phân quyền", detail: "Quản lý người dùng, vai trò và phạm vi truy cập dữ liệu.", roles: ["ADMIN"] },
  { id: "student-profiles", title: "Hồ sơ sinh viên", detail: "Quản lý danh sách sinh viên, lớp, mã số sinh viên và tài khoản liên kết.", roles: ["ADMIN"], parentId: "users" },
  { id: "staff-profiles", title: "Hồ sơ cán bộ", detail: "Quản lý danh sách cán bộ, giảng viên, học vị, chức vụ và phân công bộ môn.", roles: ["ADMIN"], parentId: "users" },
  { id: "classes", title: "Quản lý lớp", detail: "Quản lý danh sách các lớp học, khoa trực thuộc, khóa học và theo dõi sĩ số sinh viên.", roles: ["ADMIN", "CANBOKHOA"], parentId: "users" },
  { id: "academic-activities", title: "Hoạt động học thuật", detail: "Quản lý danh sách các hoạt động học thuật: cuộc thi, seminar, workshop, tọa đàm.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN", "PHONGCTSV"] },
  { id: "academic-steering", title: "Ban chỉ đạo", detail: "Danh sách và phân công thành viên Ban chỉ đạo các hoạt động học thuật.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN"], parentId: "academic-activities" },
  { id: "academic-organizing", title: "Ban tổ chức", detail: "Danh sách và phân công thành viên Ban tổ chức các hoạt động học thuật.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN"], parentId: "academic-activities" },
  { id: "academic-support", title: "Ban hỗ trợ", detail: "Danh sách và phân công thành viên Ban hỗ trợ các hoạt động học thuật.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN"], parentId: "academic-activities" },
  { id: "plans", title: "Kế hoạch năm học", detail: "Lập kế hoạch và dự trù kinh phí theo bộ môn; duyệt và tổng hợp kế hoạch chung của khoa.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN"] },
  { id: "competitions", title: "Tổ chức cuộc thi", detail: "Lập kế hoạch chi tiết, thành lập các ban và phân công công việc cho giảng viên.", roles: [...staff] },
  { id: "registrations", title: "Đăng ký dự thi", detail: "Quản lý thí sinh đăng ký theo cá nhân và đội nhóm.", roles: [...staff] },
  { id: "support", title: "Hỗ trợ & cổ vũ", detail: "Đăng ký tham dự, phân bổ hoạt động hỗ trợ và cổ vũ.", roles: [...staff] },
  { id: "attendance", title: "Điểm danh", detail: "Tạo mã QR cho hoạt động hoặc ghi nhận điểm danh theo danh sách ký tên.", roles: [...staff] },
  { id: "training-points", title: "Điểm rèn luyện", detail: "Ghi nhận điểm rèn luyện khi sinh viên dự thi, hỗ trợ và cổ vũ.", roles: ["ADMIN", "PHONGCTSV"] },
  { id: "results", title: "Đề tài & kết quả", detail: "Quản lý đề tài dự thi, kết quả cuộc thi và các đội đạt giải.", roles: [...allUsers] },
  { id: "expenses", title: "Kinh phí hoạt động", detail: "Quản lý toàn bộ dự trù kinh phí của các hoạt động học thuật.", roles: [...staff] },
  { id: "seminars", title: "Seminar học thuật", detail: "Quản lý thông tin, thời gian, địa điểm và người tham dự seminar.", roles: [...allUsers] },
  { id: "news", title: "Tin tức & thông báo", detail: "Quản lý tin tức và thông báo tổ chức cuộc thi, seminar học thuật.", roles: [...allUsers] },
  { id: "reports", title: "Thống kê & báo cáo", detail: "Thống kê, lập biên bản và báo cáo hoạt động, chi phí trong năm theo bộ môn và khoa.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN", "PHONGCTSV"] },
];

export function sectionsForRoles(roles: string[]) {
  const granted = new Set(roles.map((role) => role.toUpperCase()));
  return sections.filter((section) => section.roles.some((role) => granted.has(role)));
}

export function canManageActivities(roles: string[]) {
  return roles.some((role) => managers.includes(role.toUpperCase() as (typeof managers)[number]));
}

export function canApproveSettlements(roles: string[]) {
  return roles.some((role) => ["ADMIN", "CANBOKHOA"].includes(role.toUpperCase()));
}
