export type RoleCode =
  | "ADMIN"
  | "CANBOKHOA"
  | "TRUONGKHOA"
  | "GIANGVIEN"
  | "SINHVIEN"
  | "PHONGKHCN"
  | "HIEUTRUONG"
  | "PHONGCTSV"
  | "TRUONGBANHOCTHUAT";

export type DashboardSection = {
  id: string;
  title: string;
  detail: string;
  roles: RoleCode[];
  parentId?: string;
};

const staff = ["ADMIN", "CANBOKHOA", "GIANGVIEN"] as const;
const managers = ["ADMIN", "CANBOKHOA", "GIANGVIEN"] as const;
const allStaff = ["ADMIN", "CANBOKHOA", "TRUONGKHOA", "GIANGVIEN", "PHONGKHCN", "HIEUTRUONG", "PHONGCTSV"] as const;
const allUsers = [...allStaff, "SINHVIEN"] as const;

export const sections: DashboardSection[] = [
  { id: "overview", title: "Trang chủ", detail: "Theo dõi hoạt động học thuật của toàn khoa.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN", "PHONGCTSV"] },
  { id: "users", title: "Tài khoản & phân quyền", detail: "Quản lý người dùng, vai trò và phạm vi truy cập dữ liệu.", roles: ["ADMIN"] },
  { id: "student-profiles", title: "Hồ sơ sinh viên", detail: "Quản lý danh sách sinh viên, lớp, mã số sinh viên và tài khoản liên kết.", roles: ["ADMIN"], parentId: "users" },
  { id: "staff-profiles", title: "Hồ sơ cán bộ", detail: "Quản lý danh sách cán bộ, giảng viên, học vị, chức vụ và phân công bộ môn.", roles: ["ADMIN"], parentId: "users" },
  { id: "classes", title: "Quản lý lớp", detail: "Quản lý danh sách các lớp học, khoa trực thuộc, khóa học và theo dõi sĩ số sinh viên.", roles: ["ADMIN", "CANBOKHOA"], parentId: "users" },
  { id: "academic-activities", title: "Hoạt động học thuật", detail: "Quản lý danh sách các hoạt động học thuật: cuộc thi, seminar, workshop, tọa đàm.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN", "PHONGCTSV"] },
  { id: "academic-list", title: "Danh sách hoạt động", detail: "Danh sách các cuộc thi, seminar, workshop và tọa đàm học thuật.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN", "PHONGCTSV"], parentId: "academic-activities" },
  { id: "academic-steering", title: "Ban chỉ đạo", detail: "Danh sách và phân công thành viên Ban chỉ đạo các hoạt động học thuật.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN"], parentId: "academic-activities" },
  { id: "academic-organizing", title: "Ban tổ chức", detail: "Danh sách và phân công thành viên Ban tổ chức các hoạt động học thuật.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN"], parentId: "academic-activities" },
  { id: "academic-support", title: "Ban hỗ trợ", detail: "Danh sách và phân công thành viên Ban hỗ trợ các hoạt động học thuật.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN"], parentId: "academic-activities" },
  { id: "department-plans", title: "Ban bộ môn", detail: "Danh sách thành viên Ban bộ môn và các cuộc thi, seminar học thuật chờ xem xét.", roles: ["GIANGVIEN", "CANBOKHOA"] },
  { id: "finance-management", title: "Quản lý kinh phí", detail: "Theo dõi dự trù, kinh phí hoạt động và chi phí thực tế.", roles: [...staff, "TRUONGKHOA", "TRUONGBANHOCTHUAT"] },
  { id: "expenses", title: "Kinh phí hoạt động", detail: "Theo dõi các khoản kinh phí theo từng hoạt động.", roles: [...staff, "TRUONGKHOA", "TRUONGBANHOCTHUAT"], parentId: "finance-management" },
  { id: "budget-estimates", title: "Dự trù kinh phí", detail: "Lập và theo dõi các khoản dự trù kinh phí.", roles: [...staff, "TRUONGKHOA", "TRUONGBANHOCTHUAT"], parentId: "finance-management" },
  { id: "actual-expenses", title: "Kinh phí thực tế", detail: "Theo dõi các khoản chi thực tế của hoạt động.", roles: [...staff, "TRUONGKHOA", "TRUONGBANHOCTHUAT"], parentId: "finance-management" },
  { id: "plans", title: "Kế hoạch học thuật", detail: "Khoa CNTT tổng hợp đề xuất kèm bản chi phí cả năm; Trưởng khoa ký duyệt kế hoạch chung.", roles: ["ADMIN", "CANBOKHOA", "TRUONGKHOA", "GIANGVIEN", "PHONGKHCN", "HIEUTRUONG"] },
  { id: "detailed-plans", title: "Kế hoạch tổ chức", detail: "Bộ môn lập chi tiết từ kế hoạch chung; Trưởng khoa và Phòng CTSV ký trước khi công bố.", roles: ["ADMIN", "CANBOKHOA", "TRUONGKHOA", "GIANGVIEN", "PHONGCTSV"] },
  { id: "competitions", title: "Tổ chức cuộc thi", detail: "Đăng ký từng vòng, phân công ra đề, nộp bài, chấm điểm và công bố trao giải.", roles: [...allUsers] },
  { id: "registrations", title: "Đăng ký dự thi", detail: "Quản lý thí sinh đăng ký theo cá nhân và đội nhóm.", roles: [...staff] },
  { id: "support", title: "Hỗ trợ & cổ vũ", detail: "Đăng ký tham dự, phân bổ hoạt động hỗ trợ và cổ vũ.", roles: [...staff] },
  { id: "attendance", title: "Điểm danh", detail: "Tạo mã QR cho hoạt động hoặc ghi nhận điểm danh theo danh sách ký tên.", roles: [...staff] },
  { id: "training-points", title: "Điểm rèn luyện", detail: "Ghi nhận điểm rèn luyện khi sinh viên dự thi, hỗ trợ và cổ vũ.", roles: ["ADMIN", "PHONGCTSV"] },
  { id: "results", title: "Đề tài & kết quả", detail: "Quản lý đề tài dự thi, kết quả cuộc thi và các đội đạt giải.", roles: [...allUsers] },
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
