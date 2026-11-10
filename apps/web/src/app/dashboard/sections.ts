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
const allStaff = ["ADMIN", "CANBOKHOA", "TRUONGKHOA", "GIANGVIEN", "PHONGKHCN", "HIEUTRUONG", "PHONGCTSV", "TRUONGBANHOCTHUAT"] as const;
const allUsers = [...allStaff, "SINHVIEN"] as const;

export const sections: DashboardSection[] = [
  { id: "overview", title: "Trang chủ", detail: "Theo dõi hoạt động học thuật của toàn khoa.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN", "PHONGCTSV"] },
  { id: "news", title: "Tin tức & thông báo", detail: "Xem tin tức và thông báo tổ chức cuộc thi, seminar học thuật.", roles: [...allUsers] },
  { id: "news-management", title: "QL Tin tức & thông báo", detail: "Soạn thảo bản tin mới, tạo thông báo và quản lý các bài đăng học thuật.", roles: [...allStaff], parentId: "news" },
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
  { id: "actual-expenses", title: "Kinh phí thực tế", detail: "Ghi nhận và theo dõi các khoản chi thực tế của hoạt động.", roles: [...staff, "TRUONGKHOA", "TRUONGBANHOCTHUAT"], parentId: "finance-management" },
  { id: "settlement-documents", title: "Danh sách hồ sơ quyết toán", detail: "Theo dõi hồ sơ, khoản chi và trạng thái quyết toán của các hoạt động được phân công.", roles: [...staff, "TRUONGKHOA", "TRUONGBANHOCTHUAT"], parentId: "finance-management" },
  { id: "plans", title: "Kế hoạch học thuật", detail: "Khoa CNTT tổng hợp đề xuất kèm bản chi phí cả năm; Trưởng khoa ký duyệt kế hoạch chung.", roles: ["ADMIN", "CANBOKHOA", "TRUONGKHOA", "GIANGVIEN", "PHONGKHCN", "HIEUTRUONG"] },
  { id: "detailed-plans", title: "Kế hoạch tổ chức", detail: "Bộ môn lập kế hoạch, thành lập các ban và phân công giảng viên; khoa và CTSV ký trước khi công bố.", roles: ["ADMIN", "CANBOKHOA", "TRUONGKHOA", "GIANGVIEN", "PHONGCTSV"] },
  { id: "detailed-plans-all", title: "Kế hoạch chi tiết Seminar và Cuộc thi", detail: "Lập kế hoạch tổ chức chi tiết cho các buổi seminar và cuộc thi học thuật, thành lập các ban và phân công giảng viên.", roles: ["ADMIN", "CANBOKHOA", "TRUONGKHOA", "GIANGVIEN", "PHONGCTSV"], parentId: "detailed-plans" },
  { id: "detailed-plans-assignment", title: "Phân công thực hiện", detail: "Lập các ban và phân công cán bộ, giảng viên thực hiện kế hoạch chi tiết.", roles: ["ADMIN", "CANBOKHOA", "TRUONGKHOA", "GIANGVIEN", "PHONGCTSV"], parentId: "detailed-plans" },
  { id: "competitions", title: "Tổ chức cuộc thi", detail: "Đăng ký từng vòng, phân công ra đề, nộp bài, chấm điểm và công bố trao giải.", roles: [...allUsers] },
  { id: "seminars", title: "Quản lý Seminar học thuật", detail: "Quản lý thông tin các buổi seminar học thuật, diễn giả, chương trình và tài liệu.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN", "TRUONGKHOA", "PHONGCTSV"] },
  { id: "registrations", title: "Đăng ký tham gia hoạt động", detail: "Theo dõi sinh viên đăng ký tham gia cuộc thi, seminar và các hoạt động học thuật.", roles: [...staff, "SINHVIEN"] },
  { id: "support", title: "Hỗ trợ & cổ vũ", detail: "Đăng ký tham dự, phân bổ hoạt động hỗ trợ và cổ vũ.", roles: [...staff, "SINHVIEN"] },
  { id: "training-points", title: "Quản lý điểm rèn luyện", detail: "Gửi thông báo theo nhóm và quản lý cộng/trừ điểm rèn luyện minh bạch.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN", "PHONGCTSV", "SINHVIEN"] },
  { id: "reports", title: "Thống kê & Biên bản báo cáo", detail: "Tổng hợp cuộc thi, seminar và chi phí thực tế theo năm học, bộ môn và toàn khoa.", roles: ["ADMIN", "CANBOKHOA", "GIANGVIEN", "PHONGCTSV"] },
  { id: "competition-management", title: "Đề tài & kết quả", detail: "Quản lý đề tài dự thi và kết quả các cuộc thi.", roles: [...allUsers] },
  { id: "topics", title: "Quản lý đề tài", detail: "Theo dõi đề tài dự thi, đội thực hiện và giảng viên hướng dẫn.", roles: [...allUsers], parentId: "competition-management" },
  { id: "results", title: "Kết quả cuộc thi", detail: "Lập, theo dõi và công bố kết quả, giải thưởng cuộc thi.", roles: [...allUsers], parentId: "competition-management" },
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
