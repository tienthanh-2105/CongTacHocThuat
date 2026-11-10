"use client";
import OrganizationPanel from "./OrganizationPanel";
import StudentParticipationPanel from "./StudentParticipationPanel";
import TrainingPointsPanel from "./TrainingPointsPanel";
import NewsPanel from "./NewsPanel";
import SeminarPanel from "./SeminarPanel";
import SettlementPanel from "./SettlementPanel";
import SettlementDocumentsPanel from "./SettlementDocumentsPanel";
import { workflowRequest } from "@/services/workflow";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, logout, type AuthUser } from "@/services/auth";
import AccountPanel from "./AccountPanel";
import BusinessPanel from "./BusinessPanel";
import ReportsPanel from "./ReportsPanel";
import StudentProfilesPanel from "./StudentProfilesPanel";
import StaffProfilesPanel from "./StaffProfilesPanel";
import ClassesManagementPanel from "./ClassesManagementPanel";
import UsersManagementPanel from "./UsersManagementPanel";
import AcademicActivitiesPanel from "./AcademicActivitiesPanel";
import { sectionsForRoles, sections, type DashboardSection } from "./sections";
import s from "./dashboard.module.css";
import NoticeDialog from "./NoticeDialog";

// Giữ phiên người dùng trong client khi chuyển giữa các route dashboard. Nếu
// mỗi route lại kiểm tra /auth/me trước khi vẽ UI thì sidebar sẽ chớp màn hình.
let dashboardUserCache: AuthUser | null | undefined;
let dashboardUserRequest: Promise<AuthUser | null> | null = null;
import DepartmentPlansPanel from "./DepartmentPlansPanel";
import DepartmentAssignmentDetails from "./DepartmentAssignmentDetails";

type DashboardNotification = { MaThongBao: number; TieuDe: string; NoiDung: string; MaPhanCongDeXuat?: number | null; DocLuc?: string | null; MaHD?: number | null; Loai?: string | null };

function parseNotificationContent(raw?: string): {
  text: string;
  isPdf?: boolean;
  pdfData?: string;
  pdfName?: string;
  pdfSize?: number;
  image?: string;
} {
  if (!raw) return { text: "" };
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && (trimmed.includes('"pdfData"') || trimmed.includes('"image"') || trimmed.includes('"isPdf"'))) {
    try {
      const obj = JSON.parse(trimmed);
      return {
        text: obj.text || "",
        isPdf: Boolean(obj.isPdf || obj.pdfData),
        pdfData: obj.pdfData,
        pdfName: obj.pdfName || "thong-bao.pdf",
        pdfSize: obj.pdfSize,
        image: obj.image,
      };
    } catch {
      // not json
    }
  }
  return { text: raw };
}

function formatNotificationFileSize(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function HomeIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M2 10.6 11.3 2.7a1.1 1.1 0 0 1 1.4 0L17 6.3V3h3v5.9l2 1.7-1.5 1.8L12 5.2l-8.5 7.2L2 10.6Z" />
    <path d="m5 12.4 7-5.9 7 5.9V22h-5v-7h-4v7H5v-9.6Z" />
  </svg>;
}

function NewsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
    <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
  </svg>;
}
function Icon({ type = 0 }: { type?: number }) {
  const paths = [
    "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.9M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2",
    "M8 3h8v7a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4M12 14v6M8 21h8",
    "M5 3h14v18H5zM8 8h8M8 12h8M8 16h5",
    "M12 3v18M3 12h18",
  ];
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[type % paths.length]} />
    </svg>
  );
}
export default function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(() => dashboardUserCache ?? null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [notificationRows, setNotificationRows] = useState<DashboardNotification[]>([]);
  const unreadNotificationCount = notificationRows.filter((row) => !row.DocLuc).length;
  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [notificationDetail, setNotificationDetail] = useState<DashboardNotification | null>(null);
  const closeAssignment = useCallback(() => setAssignmentId(null), []);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [pendingPlanNotice, setPendingPlanNotice] = useState("");
  const hasShownLoginNotice = useRef(false);
  const [query, setQuery] = useState("");
  const headerRef = useRef<HTMLElement>(null);
  const [accountView, setAccountView] = useState<"info" | "password" | null>(null);
  const [openParentId, setOpenParentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expenseActivityId, setExpenseActivityId] = useState<number | null>(null);
  const [expenseActivityName, setExpenseActivityName] = useState("");
  const [routeExpenseActivity, setRouteExpenseActivity] = useState<{ id: number | null; name: string }>({ id: null, name: "" });
  const [reportActivity, setReportActivity] = useState<{ id: string; name: string; academicYear: string } | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    let loading = false;
    const refresh = async () => {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        const rows = await workflowRequest<DashboardNotification[]>("/notifications/mine");
        if (active) {
          setNotificationRows(rows);
          const isDean = user?.roles?.some((r) => ["TRUONGKHOA", "ADMIN"].includes(r.toUpperCase()))
            || Boolean(user?.position && /Trưởng khoa/i.test(user.position));
          if (isDean && !hasShownLoginNotice.current) {
            const unreadPlans = rows.filter((r) => !r.DocLuc && (r.Loai === "Kế hoạch chi tiết" || r.TieuDe?.toLowerCase().includes("chờ duyệt")));
            if (unreadPlans.length > 0) {
              hasShownLoginNotice.current = true;
              setPendingPlanNotice(
                unreadPlans.length === 1
                  ? `Có 1 kế hoạch chi tiết đang ở trạng thái "Chờ khoa xét duyệt": ${unreadPlans[0].TieuDe.replace(/^Kế hoạch chi tiết chờ duyệt:\s*/i, "")}.`
                  : `Có ${unreadPlans.length} kế hoạch chi tiết đang ở trạng thái "Chờ khoa xét duyệt" cần Trưởng khoa xét duyệt.`
              );
            }
          }
        }
      } catch { /* Opening the notification menu provides a retry and error message. */ }
      finally { loading = false; }
    };
    void refresh();
    const onRefresh = () => { void refresh(); };
    const timer = window.setInterval(onRefresh, 30000);
    window.addEventListener("focus", onRefresh);
    document.addEventListener("visibilitychange", onRefresh);
    window.addEventListener("academic-notifications-changed", onRefresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onRefresh);
      document.removeEventListener("visibilitychange", onRefresh);
      window.removeEventListener("academic-notifications-changed", onRefresh);
    };
  }, [user?.id]);
  async function openNotification(item: DashboardNotification) {
    try {
      await workflowRequest(`/notifications/${item.MaThongBao}/read`, { method: "PATCH" });
      setNotificationRows((rows) => rows.map((row) => row.MaThongBao === item.MaThongBao ? { ...row, DocLuc: row.DocLuc || new Date().toISOString() } : row));
      setNotifications(false);
      if (item.MaPhanCongDeXuat) setAssignmentId(item.MaPhanCongDeXuat);
      else setNotificationDetail(item);
    } catch { setNotificationError("Không mở được thông báo. Vui lòng thử lại."); }
  }
  useEffect(() => {
    let alive = true;
    const request = dashboardUserRequest ?? (dashboardUserRequest = getCurrentUser());
    request
      .then((value) => {
        dashboardUserCache = value;
        dashboardUserRequest = null;
        if (!alive) return;
        if (!value) router.replace("/login");
        else setUser(value);
      })
      .catch(() => {
        dashboardUserRequest = null;
        if (alive) setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
      });
    return () => {
      alive = false;
    };
  }, [router, attempt]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (pathname !== "/dashboard/expenses") { setRouteExpenseActivity({ id: null, name: "" }); return; }
      const params = new URLSearchParams(window.location.search);
      const activityId = Number(params.get("activityId"));
      setRouteExpenseActivity({ id: Number.isSafeInteger(activityId) && activityId > 0 ? activityId : null, name: params.get("activityName") ?? "" });
    });
    return () => { active = false; };
  }, [pathname]);
  useEffect(() => {
    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      router.replace("/dashboard/news");
      return;
    }
    const routeSection = pathname.startsWith("/dashboard/") ? pathname.slice("/dashboard/".length).split("/")[0] : "news";
    if (routeSection === "detailed-plans" || routeSection === "detailed-plans-seminar" || routeSection === "detailed-plans-competition") {
      router.replace("/dashboard/detailed-plans-all");
      return;
    }
    const targetSection = sections.find((s) => s.id === routeSection);
    const availableSections = user ? sectionsForRoles(user.roles) : sections;
    if (targetSection?.parentId) {
      setOpenParentId(targetSection.parentId);
    } else if (availableSections.some((s) => s.parentId === routeSection)) {
      setOpenParentId(routeSection);
    } else {
      setOpenParentId(null);
    }
  }, [pathname, router]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(false);
        setProfile(false);
        setNotifications(false);
        setNotificationDetail(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setProfile(false); setNotifications(false); setQuery("");
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  async function signOut() {
    setBusy(true);
    try {
      await logout();
      dashboardUserCache = null;
      dashboardUserRequest = null;
      setUser(null);
      router.replace("/login");
    } catch {
      setError("Không thể đăng xuất. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }
  function navigate(id: string, search = "") {
    if (id === "settlement-documents") {
      const params = new URLSearchParams(search);
      const activityId = params.get("activityId") ?? "";
      setReportActivity(activityId ? { id: activityId, name: params.get("activityName") ?? "", academicYear: params.get("academicYear") ?? "" } : null);
    } else setReportActivity(null);
    if (id !== "expenses") {
      setExpenseActivityId(null);
      setExpenseActivityName("");
      setRouteExpenseActivity({ id: null, name: "" });
    } else if (search) {
      const params = new URLSearchParams(search);
      const activityId = Number(params.get("activityId"));
      setRouteExpenseActivity({
        id: Number.isSafeInteger(activityId) && activityId > 0 ? activityId : null,
        name: params.get("activityName") ?? "",
      });
    } else {
      setExpenseActivityId(null);
      setExpenseActivityName("");
      setRouteExpenseActivity({ id: null, name: "" });
    }
    const targetSection = sections.find((s) => s.id === id);
    const availableSections = user ? sectionsForRoles(user.roles) : sections;
    if (targetSection?.parentId) {
      setOpenParentId(targetSection.parentId);
    } else if (availableSections.some((s) => s.parentId === id)) {
      setOpenParentId(id);
    } else {
      setOpenParentId(null);
    }
    setAccountView(null);
    if (sections.some((section) => section.id === id)) {
      const target = `/dashboard/${id}${search ? `?${search}` : ""}`;
      const current = `${pathname}${window.location.search}`;
      if (current !== target) router.push(target);
    }
    setMenu(false);
    setQuery("");
  }
  function openExpenses(activityId: number, activityName: string) {
    setExpenseActivityId(activityId);
    setExpenseActivityName(activityName);
    const search = new URLSearchParams({ activityId: String(activityId), activityName }).toString();
    navigate("expenses", search);
  }
  function handleSidebarClick(item: DashboardSection) {
    const hasChildren = visibleSections.some((sub) => sub.parentId === item.id);
    if (hasChildren) {
      if (item.id === "news") {
        setOpenParentId("news");
        navigate("news");
        return;
      }
      const isAlreadyOpen = openParentId === item.id;
      setOpenParentId(isAlreadyOpen ? null : item.id);
      if (!isAlreadyOpen && item.id === "detailed-plans" && selected.parentId !== "detailed-plans") {
        navigate("detailed-plans-all");
      }
    } else {
      navigate(item.id);
    }
  }
  if (!user)
    return (
      <main className={s.loading}>
        <div>
          <Icon type={2} />
          <h1>{error || "Đang kiểm tra phiên đăng nhập…"}</h1>
          {error && (
            <button
              onClick={() => {
                dashboardUserRequest = null;
                dashboardUserCache = undefined;
                setError("");
                setAttempt((a) => a + 1);
              }}
            >
              Thử lại
            </button>
          )}
        </div>
      </main>
    );
  const academicCoordinator = user.roles.some((role) => role.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toUpperCase() === "TRUONGBANHOCTHUAT")
    || (user.position ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toUpperCase().includes("TRUONGBANHOCTHUAT");
  const facultyDean = user.roles.some((role) => role.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toUpperCase() === "TRUONGKHOA")
    || (user.position ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toUpperCase().startsWith("TRUONGKHOA");
  const visibleSections = sectionsForRoles(user.roles).filter((section) =>
    (academicCoordinator || facultyDean || section.id !== "budget-estimates") &&
    (section.id !== "department-plans" ||
      (["Trưởng bộ môn", "Phụ trách bộ môn"].includes(user.position?.trim() ?? "") &&
        !user.roles.some((role) => ["TRUONGKHOA", "ADMIN"].includes(role.toUpperCase())) &&
        !/^(trưởng|phó)\s*(trưởng\s*)?khoa$/i.test(user.position?.trim() ?? "")))
  );
  const sidebarSections = visibleSections.filter((section) => !["support", "academic-steering", "academic-organizing", "academic-support"].includes(section.id));
  if (!visibleSections.length) {
    return <main className={s.loading}><div><Icon type={1} /><h1>Tài khoản chưa được cấp quyền sử dụng chức năng web.</h1><button disabled={busy} onClick={signOut}>Đăng xuất</button></div></main>;
  }
  const routeSection = pathname.startsWith("/dashboard/") ? pathname.slice("/dashboard/".length).split("/")[0] : "news";
  const activeSectionId = visibleSections.some((item) => item.id === routeSection)
    ? routeSection
    : visibleSections.some((item) => item.id === "news")
    ? "news"
    : visibleSections[0]?.id ?? "news";
  const selected = visibleSections.find((item) => item.id === activeSectionId)!;
  const matches = sidebarSections.filter((item) =>
    item.title.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")),
  );
  return (
    <div className={s.app}>
      {menu && (
        <button
          className={s.backdrop}
          aria-label="Đóng menu"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`${s.sidebar} ${menu ? s.open : ""}`}>
        <div className={s.brand}>
          <span>IT</span>
          <div>
            KHOA CNTT<small>Quản lý công tác học thuật</small>
          </div>
        </div>
        <nav aria-label="Chức năng hệ thống">
          {sidebarSections.map((item, index) => {
            const isSub = Boolean(item.parentId);
            if (isSub && item.parentId !== openParentId && item.parentId !== selected.parentId) {
              return null;
            }
            const hasChildren = visibleSections.some((sub) => sub.parentId === item.id);
            const isOpen = openParentId === item.id;
            return (
              <button
                key={item.id}
                data-section-id={item.id}
                data-section-parent={item.parentId}
                onClick={() => handleSidebarClick(item)}
                className={`${activeSectionId === item.id ? s.active : ""} ${isSub ? s.sidebarSubItem : ""}`}
                aria-current={activeSectionId === item.id ? "page" : undefined}
              >
                {item.id === "overview" ? (
                  <HomeIcon />
                ) : item.id === "news" ? (
                  <NewsIcon />
                ) : isSub ? null : (
                  <Icon type={index} />
                )}
                <span style={isSub ? { fontWeight: 700 } : undefined}>{item.title}</span>
                {hasChildren && (
                  <svg
                    style={{
                      marginLeft: "auto",
                      width: "14px",
                      height: "14px",
                      transition: "transform 0.2s ease",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      opacity: 0.65,
                      flexShrink: 0,
                    }}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </button>
            );
          })}
        </nav>
        <div className={s.sidebarFoot}>Nền tảng học thuật của khoa</div>
      </aside>
      <div className={s.workspace}>
        <header ref={headerRef} className={s.topbar}>
          <button
            className={s.menuButton}
            aria-label="Mở menu"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            ☰
          </button>
          <div className={s.search}>
            <label htmlFor="dashboard-search" className={s.srOnly}>Tìm kiếm chức năng</label>
            <input
              id="dashboard-search" type="search" autoComplete="off"
              placeholder="Tìm kiếm…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
            {query && (
              <div className={s.searchResults}>
                {matches.length ? (
                  matches.map((item) => (
                    <button key={item.id} onClick={() => navigate(item.id)}>
                      {item.title}
                    </button>
                  ))
                ) : (
                  <p>Không tìm thấy chức năng.</p>
                )}
              </div>
            )}
          </div>
          <div className={s.actions}><button className={s.homeLink} onClick={() => navigate("overview")}><HomeIcon />Trang chủ</button>
            <div className={s.popupWrap}>
              <button
                className={s.bell}
                aria-label={`Thông báo${unreadNotificationCount ? `, ${unreadNotificationCount} chưa đọc` : ""}`}
                aria-expanded={notifications}
                onClick={async () => {
                  setNotifications(!notifications);
                  if (!notifications) {
                    setNotificationLoading(true); setNotificationError("");
                    try { setNotificationRows(await workflowRequest<typeof notificationRows>("/notifications/mine")); }
                    catch { setNotificationError("Không tải được thông báo. Mở trang tin tức để thử lại."); }
                    finally { setNotificationLoading(false); }
                  }
                  setProfile(false);
                }}
              >
                <span className={s.bellIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                </svg>{unreadNotificationCount > 0 && <span className={s.notificationCount} aria-hidden="true">{unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}</span>}
                </span><span className={s.bellLabel}>Thông báo</span>
              </button>
              {notifications && (
                <div className={`${s.popup} ${s.notificationPopup}`}><strong>Thông báo</strong>{notificationLoading ? <p>Đang tải…</p> : notificationError ? <p role="alert">{notificationError}</p> : notificationRows.length ? <div className={s.notificationList}>{notificationRows.map(item => <button type="button" key={item.MaThongBao} className={!item.DocLuc ? s.notificationUnread : undefined} onClick={() => void openNotification(item)}><strong>{item.TieuDe}</strong><small>{item.DocLuc ? "Đã đọc" : "Chưa đọc"}{item.MaPhanCongDeXuat ? " · Xem phân công" : item.Loai === "Kế hoạch chi tiết" || item.MaHD ? " · Xem & Ký duyệt" : " · Xem chi tiết"}</small></button>)}</div> : <p>Chưa có thông báo.</p>}<button type="button" onClick={() => { navigate("news"); setNotifications(false); }}>Xem tin tức & thông báo</button></div>
              )}
            </div>
            <div className={s.popupWrap}>
              <button
                className={s.profile}
                aria-label="Tài khoản của tôi"
                aria-expanded={profile}
                onClick={() => {
                  setProfile(!profile);
                  setNotifications(false);
                }}
              >
                <span className={s.avatar}>
                  {(user.name || user.username).slice(0, 1).toUpperCase()}
                </span>
                <span>
                  {user.name || user.username}
                  <small>
                    {user.roles.includes("ADMIN")
                      ? "Quản trị viên"
                      : user.roles.includes("SINHVIEN")
                      ? "Sinh viên"
                      : user.roles.join(", ")}
                  </small>
                </span>
                <span>⌄</span>
              </button>
              {profile && (
                <div className={`${s.popup} ${s.accountMenu}`}>
                  <button onClick={() => { setAccountView("info"); setProfile(false); }}>Thông tin cá nhân</button>
                  <button onClick={() => { setAccountView("password"); setProfile(false); }}>Đổi mật khẩu</button>
                  <button disabled={busy} onClick={signOut}>
                    {busy ? "Đang đăng xuất…" : "Đăng xuất"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className={s.main}>
          {activeSectionId !== "users" && activeSectionId !== "staff-profiles" && activeSectionId !== "student-profiles" && activeSectionId !== "classes" && activeSectionId !== "plans" && !activeSectionId.startsWith("academic-") && !(activeSectionId === "training-points" && !user?.roles?.includes("SINHVIEN")) && activeSectionId !== "seminars" && activeSectionId !== "registrations" && activeSectionId !== "results" && accountView !== "info" && (
            <div className={s.heading}>
              <div>
                <h1>{selected.title}</h1>
                {!['expenses', 'budget-estimates', 'actual-expenses'].includes(selected.id) && <p>
                  {selected.id === "overview"
                    ? "Theo dõi hoạt động, mức độ tham gia và tiến độ học kỳ của toàn khoa."
                    : selected.detail}
                </p>}
              </div>
            </div>
          )}
          {accountView === "info" && (
            <div className={s.heading}>
              <div>
                <h1>Thông tin cá nhân</h1>
                <p>Xem thông tin tài khoản và phân quyền của bạn.</p>
              </div>
            </div>
          )}
          {error && <NoticeDialog message={error} kind="error" onClose={() => setError("")} />}
          {accountView === "password" && <AccountPanel view="password" user={user} onClose={() => setAccountView(null)} />}
          {accountView === "info" ? (
            <AccountPanel view="info" user={user} onClose={() => setAccountView(null)} />
          ) : activeSectionId === "reports" ? (
            <ReportsPanel />
          ) : activeSectionId === "users" ? (
            <UsersManagementPanel currentUserId={user.id} />
          ) : activeSectionId === "staff-profiles" ? (
            <StaffProfilesPanel />
          ) : activeSectionId === "department-plans" ? (
            <DepartmentPlansPanel mode="lecturer" />
          ) : activeSectionId === "student-profiles" ? (
            <StudentProfilesPanel />
          ) : activeSectionId === "classes" ? (
            <ClassesManagementPanel />
          ) : activeSectionId === "academic-activities" || activeSectionId === "academic-list" ? (
            <AcademicActivitiesPanel view="activities" user={user} onNavigateExpenses={openExpenses} onNavigateTab={(tab) => navigate(tab === "activities" ? "academic-activities" : tab === "steering" ? "academic-steering" : tab === "organizing" ? "academic-organizing" : "academic-support")} />
          ) : activeSectionId === "academic-steering" ? (
            <AcademicActivitiesPanel view="steering" user={user} onNavigateTab={(tab) => navigate(tab === "activities" ? "academic-activities" : tab === "steering" ? "academic-steering" : tab === "organizing" ? "academic-organizing" : "academic-support")} />
          ) : activeSectionId === "academic-organizing" ? (
            <AcademicActivitiesPanel view="organizing" user={user} onNavigateTab={(tab) => navigate(tab === "activities" ? "academic-activities" : tab === "steering" ? "academic-steering" : tab === "organizing" ? "academic-organizing" : "academic-support")} />
          ) : activeSectionId === "academic-support" ? (
            <AcademicActivitiesPanel view="support" user={user} onNavigateTab={(tab) => navigate(tab === "activities" ? "academic-activities" : tab === "steering" ? "academic-steering" : tab === "organizing" ? "academic-organizing" : "academic-support")} />
          ) : activeSectionId === "actual-expenses" ? (
            <SettlementPanel user={user} onOpenSettlementList={(activity) => navigate("settlement-documents", new URLSearchParams({ activityId: activity.id, activityName: activity.name, academicYear: activity.academicYear }).toString())} />
          ) : activeSectionId === "settlement-documents" ? (
            <SettlementDocumentsPanel initialActivity={reportActivity} />
          ) : activeSectionId === "seminars" ? (
            <SeminarPanel user={user} />
          ) : activeSectionId === "news" || activeSectionId === "news-management" ? (
            <NewsPanel key={activeSectionId} manage={activeSectionId === "news-management"} user={user} onNavigate={navigate} />
          ) : user.roles.includes("SINHVIEN") && ["registrations", "support", "training-points"].includes(activeSectionId) ? (
            <StudentParticipationPanel key={activeSectionId} section={activeSectionId} user={user} onNavigate={navigate} />
          ) : activeSectionId === "training-points" ? (
            <TrainingPointsPanel user={user} />
          ) : (
            ["detailed-plans", "detailed-plans-all", "detailed-plans-seminar", "detailed-plans-competition", "detailed-plans-assignment", "competitions", "topics", "results"].includes(activeSectionId) ? (
              <OrganizationPanel
                key={activeSectionId}
                detailed={["detailed-plans", "detailed-plans-all", "detailed-plans-seminar", "detailed-plans-competition", "detailed-plans-assignment"].includes(activeSectionId)}
                managementView={activeSectionId === "topics" ? "topics" : activeSectionId === "results" ? "results" : undefined}
                filterType={
                  activeSectionId === "detailed-plans-assignment" ? "Phân công thực hiện" :
                  undefined
                }
                user={user}
                onNavigateTab={(tab, activityId) => navigate(tab, activityId ? `activityId=${activityId}` : undefined)}
              />
            ) : (
              <BusinessPanel sectionId={activeSectionId} user={user} initialActivityId={routeExpenseActivity.id ?? expenseActivityId} initialActivityName={routeExpenseActivity.id ? routeExpenseActivity.name : expenseActivityName} />
            )
          )}
        </main>
      </div>
      {assignmentId !== null && <DepartmentAssignmentDetails key={assignmentId} id={assignmentId} onClose={closeAssignment} />}
      {notificationDetail && (() => {
        const parsed = parseNotificationContent(notificationDetail.NoiDung);
        const isPlan =
          notificationDetail.Loai === "Kế hoạch chi tiết" ||
          notificationDetail.TieuDe?.toLowerCase().includes("kế hoạch chi tiết");
        const hasPdf = Boolean(parsed.isPdf && parsed.pdfData);
        const hasImage = Boolean(parsed.image);

        return (
          <div className={s.modalOverlay} onClick={() => setNotificationDetail(null)}>
            <section
              className={`${s.modalCard} ${s.departmentAssignmentDialog}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="notification-detail-title"
              onClick={(event) => event.stopPropagation()}
              style={{
                width: hasPdf ? "min(920px, calc(100vw - 32px))" : "min(720px, calc(100vw - 32px))",
                maxHeight: "92vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRadius: "12px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
              }}
            >
              <div
                className={s.departmentAssignmentDialogHeading}
                style={{
                  padding: "18px 24px",
                  borderBottom: "1px solid #e2e8f0",
                  background: "#ffffff",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "16px",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <span style={{ fontSize: "24px", lineHeight: "1.2", marginTop: "2px" }}>
                    {hasPdf ? "📄" : "🔔"}
                  </span>
                  <div>
                    <h2
                      id="notification-detail-title"
                      style={{
                        fontSize: "18px",
                        fontWeight: 700,
                        lineHeight: 1.4,
                        color: "#0f172a",
                        margin: 0,
                      }}
                    >
                      {notificationDetail.TieuDe}
                    </h2>
                    {notificationDetail.Loai && (
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: "6px",
                          fontSize: "12px",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: "#f1f5f9",
                          color: "#475569",
                          fontWeight: 600,
                        }}
                      >
                        {notificationDetail.Loai}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className={s.modalCloseBtn}
                  aria-label="Đóng thông báo"
                  onClick={() => setNotificationDetail(null)}
                  style={{
                    fontSize: "24px",
                    lineHeight: "1",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                    padding: "4px 8px",
                  }}
                >
                  ×
                </button>
              </div>

              <div
                className={s.departmentAssignmentBody}
                style={{
                  padding: "20px 24px",
                  overflowY: "auto",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                {/* Text content */}
                {parsed.text ? (
                  <div
                    style={{
                      color: "#334155",
                      fontSize: "14px",
                      lineHeight: "1.65",
                      whiteSpace: "pre-line",
                      background: hasPdf ? "#f8fafc" : "transparent",
                      padding: hasPdf ? "12px 16px" : "0",
                      borderRadius: hasPdf ? "8px" : "0",
                      border: hasPdf ? "1px solid #e2e8f0" : "none",
                    }}
                  >
                    {parsed.text}
                  </div>
                ) : !hasPdf && !hasImage ? (
                  <p className={s.departmentAssignmentContent} style={{ color: "#64748b", fontStyle: "italic", margin: 0 }}>
                    Không có nội dung văn bản chi tiết.
                  </p>
                ) : null}

                {/* Attached image if present */}
                {hasImage && parsed.image && (
                  <div style={{ textAlign: "center", borderRadius: "8px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                    <img
                      src={parsed.image}
                      alt={notificationDetail.TieuDe}
                      style={{ maxWidth: "100%", maxHeight: "420px", display: "block", margin: "0 auto", objectFit: "contain" }}
                    />
                  </div>
                )}

                {/* Attached PDF document reader & downloader */}
                {hasPdf && parsed.pdfData && (
                  <div
                    style={{
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      overflow: "hidden",
                      background: "#ffffff",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    }}
                  >
                    {/* PDF Header / Download Bar */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "12px",
                        padding: "10px 16px",
                        background: "#f1f5f9",
                        borderBottom: "1px solid #cbd5e1",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "22px" }}>📄</span>
                        <div>
                          <strong style={{ color: "#0f172a", fontSize: "14px", display: "block" }}>
                            {parsed.pdfName || "tai-lieu.pdf"}
                          </strong>
                          <small style={{ color: "#64748b", fontSize: "12px" }}>
                            {formatNotificationFileSize(parsed.pdfSize) || "Tài liệu PDF đính kèm"}
                          </small>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <a
                          href={parsed.pdfData}
                          download={parsed.pdfName || "tai-lieu.pdf"}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 14px",
                            borderRadius: "6px",
                            background: "#dc2626",
                            color: "#ffffff",
                            textDecoration: "none",
                            fontWeight: 600,
                            fontSize: "13px",
                          }}
                        >
                          <span>📥</span>
                          <span>Tải về PDF</span>
                        </a>
                        <a
                          href={parsed.pdfData}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 14px",
                            borderRadius: "6px",
                            background: "#ffffff",
                            color: "#334155",
                            border: "1px solid #cbd5e1",
                            textDecoration: "none",
                            fontWeight: 600,
                            fontSize: "13px",
                          }}
                        >
                          <span>↗️</span>
                          <span>Mở toàn màn hình</span>
                        </a>
                      </div>
                    </div>

                    {/* Interactive PDF reader iframe */}
                    <iframe
                      src={parsed.pdfData}
                      style={{
                        width: "100%",
                        height: "540px",
                        border: "none",
                        display: "block",
                      }}
                      title={parsed.pdfName || "Tài liệu PDF"}
                    />
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: "14px 24px",
                  borderTop: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  flexWrap: "wrap",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    background: "#ffffff",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                  onClick={() => setNotificationDetail(null)}
                >
                  Đóng
                </button>

                <button
                  type="button"
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                  onClick={() => {
                    setNotificationDetail(null);
                    navigate("news");
                  }}
                >
                  Xem trong Tin tức & thông báo →
                </button>

                {isPlan && (
                  <button
                    type="button"
                    style={{
                      padding: "8px 18px",
                      borderRadius: "6px",
                      background: "#059669",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                    onClick={() => {
                      setNotificationDetail(null);
                      navigate("detailed-plans-all");
                    }}
                  >
                    Đi đến Kế hoạch chi tiết để Ký duyệt →
                  </button>
                )}
              </div>
            </section>
          </div>
        );
      })()}
      {pendingPlanNotice && <NoticeDialog title="Thông báo xét duyệt kế hoạch" message={pendingPlanNotice} kind="success" onClose={() => setPendingPlanNotice("")} />}
    </div>
  );
}
