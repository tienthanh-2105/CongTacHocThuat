"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { workflowRequest } from "@/services/workflow";
import type { AuthUser } from "@/services/auth";
import { canApproveSettlements, canManageActivities } from "./sections";
import s from "./dashboard.module.css";

type Row = Record<string, unknown>;
const label = (row: Row, ...keys: string[]) => {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null && row[key] !== "") return String(row[key]);
  return "—";
};
const readValue = (row: Row, ...keys: string[]) => {
  for (const key of keys) {
    const actualKey = Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    const value = actualKey ? row[actualKey] : undefined;
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};
const timestamp = (value: unknown) => {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== "string" && typeof value !== "number") return null;
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
};
const activityStart = (row: Row) => readValue(row, "TgBatDau", "thoiGianDuKien", "batDauLuc", "NgayBatDau");
const formatDateTime = (value: unknown) => {
  const valueTimestamp = timestamp(value);
  if (valueTimestamp === null) return null;
  const date = new Date(valueTimestamp);
  const day = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
  const time = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
  return `${day} · ${time}`;
};
function sortByActivityTime(items: Row[]) {
  const now = Date.now();
  return [...items].sort((left, right) => {
    const leftTime = timestamp(activityStart(left));
    const rightTime = timestamp(activityStart(right));
    if (leftTime === null) return rightTime === null ? 0 : 1;
    if (rightTime === null) return -1;
    const leftUpcoming = leftTime >= now;
    const rightUpcoming = rightTime >= now;
    if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
    return leftUpcoming ? leftTime - rightTime : rightTime - leftTime;
  });
}
function displayCode(row: Row, index: number) {
  const codes = [
    ["MaTK", "TK"], ["MaHD", "HD"], ["MaCThi", "CT"], ["MaCuocThi", "CT"], ["MaSeminar", "SEM"],
    ["MaKeHoach", "KH"], ["MaDK", "DK"], ["MaThongBao", "TB"], ["MaDiem", "DRL"],
    ["MaDiemRL", "DRL"], ["MaCP", "CP"], ["MaCho", "CH"],
  ] as const;
  for (const [field, prefix] of codes) {
    const value = readValue(row, field);
    if (value === undefined) continue;
    const raw = String(value).trim();
    const numeric = Number(raw);
    return `${prefix}-${Number.isFinite(numeric) ? String(Math.trunc(numeric)).padStart(4, "0") : raw}`;
  }
  return String(index + 1).padStart(4, "0");
}
const roleId = (role: Row) => role.MaVaiTro ?? role.maVaiTro ?? role.Id ?? role.id;
const roleCode = (role: Row) => label(role, "TenVaiTro", "tenVaiTro", "name").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const identifier = (row: Row, ...keys: string[]) => Number(row[keys.find((key) => row[key] !== undefined) ?? "id"] ?? 0);
const activityOptionId = (row: Row, sectionId: string) => {
  const keys = sectionId === "competitions" || sectionId === "results"
    ? ["MaCThi", "MaCuocThi", "ma_c_thi", "competitionId"]
    : ["MaHD", "MaHoatDong", "ma_hd", "activityId"];
  for (const key of keys) {
    const actualKey = Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    const value = actualKey ? row[actualKey] : undefined;
    if (typeof value === "string" || typeof value === "number") {
      const id = String(value).trim();
      if (id) return id;
    }
  }
  return null;
};
const inputClass = s.businessInput;

function Field({ title, name, type = "text", required = false, defaultValue, min, step, placeholder }: {
  title: string; name: string; type?: string; required?: boolean; defaultValue?: string; min?: string; step?: string; placeholder?: string;
}) {
  return <label className={s.businessField}><span>{title}</span><input className={inputClass} name={name} type={type} required={required} defaultValue={defaultValue} min={min} step={step} placeholder={placeholder} /></label>;
}

function PasswordField({ title, name, required = false, minLength }: { title: string; name: string; required?: boolean; minLength?: number }) {
  const [visible, setVisible] = useState(false);
  const inputId = `password-${name}`;
  return <div className={s.businessField}>
    <label htmlFor={inputId}>{title}</label>
    <span className={s.passwordInputWrap}>
      <input id={inputId} className={inputClass} name={name} type={visible ? "text" : "password"} autoComplete="new-password" required={required} minLength={minLength} />
      <button
        type="button"
        className={s.passwordToggle}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {visible ? <><path d="m3 3 18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1-3 3.8M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7a10 10 0 0 0 4-.8" /></> : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
        </svg>
      </button>
    </span>
  </div>;
}

function AccountManagementList({
  accounts, roles, studentProfiles, profileLoadError, busy, currentUserId,
  onResetPassword, onChangeRole, onLinkProfile, onSetActive, onDeletePermanently,
}: {
  accounts: Row[];
  roles: Row[];
  studentProfiles: Row[];
  profileLoadError: string;
  busy: boolean;
  currentUserId: string;
  onResetPassword: (id: string, password: string) => Promise<unknown>;
  onChangeRole: (id: string, nextRoleId: number) => Promise<unknown>;
  onLinkProfile: (id: string, profileId: number) => Promise<unknown>;
  onSetActive: (id: string, username: string, active: boolean) => Promise<unknown>;
  onDeletePermanently: (id: string, username: string) => Promise<unknown>;
}) {
  const [action, setAction] = useState<{ id: string; type: "password" | "role" | "profile" } | null>(null);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi-VN");
  const filteredAccounts = accounts.filter((account) => {
    if (!normalizedSearch) return true;
    const searchableText = ["MaTK", "MaNgDung", "MSSV", "HoTen", "TenDangNhap", "TenVaiTro", "TrangThai", "Email"]
      .map((field) => readValue(account, field))
      .filter((value) => value !== undefined)
      .join(" ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("vi-VN");
    return searchableText.includes(normalizedSearch);
  });

  if (!accounts.length) return <p className={s.emptyMessage}>Không có tài khoản hoặc bạn chưa có quyền quản trị.</p>;

  return <>
    <div className={s.accountSearchBar}>
      <label className={s.accountSearchField}>
        <span>Tìm tài khoản</span>
        <input
          className={inputClass}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Mã tài khoản, họ tên, tên đăng nhập, vai trò..."
          aria-label="Tìm tài khoản theo mã, họ tên, tên đăng nhập, vai trò, trạng thái hoặc email"
        />
      </label>
      <small>{filteredAccounts.length}/{accounts.length} tài khoản</small>
    </div>
    {!filteredAccounts.length
      ? <p className={s.emptyMessage}>Không tìm thấy tài khoản phù hợp với “{search.trim()}”.</p>
      : <div className={s.accountManagementList}>{filteredAccounts.map((account, index) => {
    const rawId = readValue(account, "MaTK");
    const id = rawId == null ? "" : String(rawId);
    const username = label(account, "TenDangNhap", "username");
    const isActive = label(account, "TrangThai").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleUpperCase("vi-VN").replace(/[^A-Z0-9]/g, "") === "HOATDONG";
    const linked = readValue(account, "MaNgDung") != null;
    const isStudent = roleCode(account) === "SINHVIEN";
    const expandedAction = action?.id === id ? action.type : null;
    const toggleAction = (type: "password" | "role" | "profile") => {
      setPasswordMismatch(false);
      setAction((current) => current?.id === id && current.type === type ? null : { id, type });
    };

    return <article className={s.accountManagementRow} key={`account-${id || index}`}>
      <div className={s.accountManagementSummary}>
        <div className={s.accountManagementInfo}>
          <strong>{label(account, "HoTen", "TenDangNhap", "username")}</strong>
          <span>{username} · {label(account, "TenVaiTro")} · {label(account, "TrangThai")}</span>
          {label(account, "Email") !== "—" && <small>{label(account, "Email")}</small>}
        </div>
        <span className={s.accountManagementCode}>TK-{String(id || index + 1).padStart(4, "0")}</span>
      </div>

      <div className={s.accountManagementButtons}>
        <button type="button" className={s.secondaryButton} disabled={busy || !id || id === currentUserId} title={id === currentUserId ? "Dùng mục Tài khoản để đổi mật khẩu của bạn." : undefined} aria-expanded={expandedAction === "password"} onClick={() => toggleAction("password")}>Đổi mật khẩu</button>
        {!isStudent && <button type="button" className={s.secondaryButton} disabled={busy || !id} aria-expanded={expandedAction === "role"} onClick={() => toggleAction("role")}>Đổi vai trò</button>}
        {isStudent && !linked && <button type="button" className={s.secondaryButton} disabled={busy || !id} aria-expanded={expandedAction === "profile"} onClick={() => toggleAction("profile")}>Liên kết hồ sơ</button>}
        <button type="button" className={isActive ? s.dangerButton : s.secondaryButton} disabled={busy || !id || id === currentUserId} title={id === currentUserId ? "Không thể thay đổi trạng thái tài khoản đang đăng nhập." : undefined} onClick={async () => {
          const action = isActive ? "ngừng hoạt động" : "hoạt động lại";
          if (!window.confirm(`Bạn muốn ${action} tài khoản ${username}?`)) return;
          await onSetActive(id, username, !isActive);
        }}>{isActive ? "Ngừng tài khoản" : "Hoạt động lại"}</button>
        <button type="button" className={s.dangerButton} disabled={busy || !id || id === currentUserId} title={id === currentUserId ? "Không thể xóa tài khoản đang đăng nhập." : "Xóa tài khoản đăng nhập và thông báo; hồ sơ sinh viên vẫn được giữ."} onClick={async () => {
          if (!window.confirm(`XÓA VĨNH VIỄN tài khoản ${username}? Tài khoản đăng nhập và thông báo của tài khoản sẽ bị xóa; hồ sơ sinh viên vẫn được giữ. Nếu tài khoản đã được ghi vào lịch sử nghiệp vụ, hệ thống sẽ từ chối xóa để bảo toàn dữ liệu. Thao tác này không thể hoàn tác.`)) return;
          await onDeletePermanently(id, username);
        }}>Xóa tài khoản</button>
      </div>

      {expandedAction === "password" && <form className={s.accountInlineForm} onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const password = String(form.get(`newPassword-${id}`) ?? "");
        const confirmation = String(form.get(`confirmPassword-${id}`) ?? "");
        if (password !== confirmation) { setPasswordMismatch(true); return; }
        setPasswordMismatch(false);
        const result = await onResetPassword(id, password);
        if (result !== null) setAction(null);
      }}>
        <PasswordField title="Mật khẩu mới (ít nhất 12 ký tự)" name={`newPassword-${id}`} required minLength={12} />
        <PasswordField title="Nhập lại mật khẩu mới" name={`confirmPassword-${id}`} required minLength={12} />
        {passwordMismatch && <p className={s.error} role="alert">Hai mật khẩu nhập lại không khớp.</p>}
        <button className={s.primary} disabled={busy}>Lưu mật khẩu mới</button>
      </form>}

      {expandedAction === "role" && <form className={s.accountInlineForm} onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await onChangeRole(id, Number(form.get("roleId")));
        if (result !== null) setAction(null);
      }}>
        <label className={s.businessField}><span>Vai trò mới</span><select className={inputClass} name="roleId" required defaultValue={String(roleId(account) ?? "")}>
          <option value="">Chọn vai trò</option>
          {roles.filter((role) => roleCode(role) !== "SINHVIEN").map((role, roleIndex) => {
            const nextRoleId = roleId(role);
            return <option key={`account-role-${String(nextRoleId ?? roleIndex)}`} value={nextRoleId == null ? "" : String(nextRoleId)} disabled={nextRoleId == null}>{label(role, "TenVaiTro", "tenVaiTro", "name")}</option>;
          })}
        </select></label>
        <button className={s.primary} disabled={busy}>Lưu vai trò</button>
      </form>}

      {expandedAction === "profile" && <form className={s.accountInlineForm} onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await onLinkProfile(id, Number(form.get("maNgDung")));
        if (result !== null) setAction(null);
      }}>
        {(profileLoadError || !studentProfiles.length) && <p className={profileLoadError ? s.error : s.emptyMessage}>{profileLoadError || "Không có hồ sơ sinh viên chưa liên kết."}</p>}
        <label className={s.businessField}><span>Hồ sơ sinh viên · MSSV · tên · lớp</span><select className={inputClass} name="maNgDung" required defaultValue="">
          <option value="">Chọn hồ sơ chưa liên kết</option>
          {studentProfiles.map((profile, profileIndex) => {
            const profileId = readValue(profile, "MaNgDung");
            const mssv = String(readValue(profile, "MSSV") ?? "").trim() || "Chưa có MSSV · hệ thống sẽ cấp";
            return <option key={`student-profile-link-${String(profileId ?? profileIndex)}`} value={profileId == null ? "" : String(profileId)} disabled={profileId == null}>{mssv} · {label(profile, "HoTen")} · {label(profile, "TenLop")}</option>;
          })}
        </select></label>
        <button className={s.primary} disabled={busy || !studentProfiles.length}>Liên kết hồ sơ</button>
      </form>}
    </article>;
      })}</div>}
  </>;
}

export default function BusinessPanel({ sectionId, user, initialActivityId, initialActivityName }: { sectionId: string; user: AuthUser; initialActivityId?: number | null; initialActivityName?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [attendanceQr, setAttendanceQr] = useState<{ image: string; expiresAt: string; activityId: string } | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [selectedRegistrationId, setSelectedRegistrationId] = useState("");
  const [error, setError] = useState("");
  const [profileLoadError, setProfileLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [secondary, setSecondary] = useState<Row[]>([]);
  const [studentProfiles, setStudentProfiles] = useState<Row[]>([]);
  const [newAccountRoleId, setNewAccountRoleId] = useState("");
  const [approvedActivities, setApprovedActivities] = useState<Row[]>([]);
  const [selectedApprovedActivities, setSelectedApprovedActivities] = useState<string[]>([]);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadSequence.current;
    setError("");
    setProfileLoadError("");
    try {
      if (sectionId === "plans") {
        const value = await workflowRequest<unknown>("/plans");
        if (requestId === loadSequence.current) setRows(Array.isArray(value) ? value as Row[] : []);
      } else if (sectionId === "seminars") {
        const value = await workflowRequest<unknown>("/seminars");
        if (requestId === loadSequence.current) setRows(Array.isArray(value) ? value as Row[] : []);
      } else if (sectionId === "news") {
        const [inbox, reminders] = await Promise.all([
          workflowRequest<unknown>("/notifications/mine"),
          workflowRequest<unknown>("/notifications/my-reminders").catch(() => []),
        ]);
        if (requestId === loadSequence.current) setRows([...(Array.isArray(inbox) ? inbox : []), ...(Array.isArray(reminders) ? reminders : [])] as Row[]);
      } else if (sectionId === "users") {
        const [accounts, roles] = await Promise.all([
          workflowRequest<unknown>("/admin/accounts"),
          workflowRequest<unknown>("/admin/accounts/roles"),
        ]);
        const [profiles] = await Promise.all([
          workflowRequest<unknown>("/admin/accounts/student-profiles").catch(() => {
            if (requestId === loadSequence.current) setProfileLoadError("Không tải được danh sách hồ sơ. Hãy khởi động lại API rồi tải lại trang.");
            return [];
          }),
        ]);
        if (requestId === loadSequence.current) {
          setRows(Array.isArray(accounts) ? accounts as Row[] : []);
          setSecondary(Array.isArray(roles) ? roles as Row[] : []);
          setStudentProfiles(Array.isArray(profiles) ? profiles as Row[] : []);
        }
      } else {
        const value = sectionId === "expenses"
          ? await workflowRequest<unknown>("/academic-activities/budgets")
          : await workflowRequest<unknown>("/activities");
        let activities = Array.isArray(value) ? value as Row[] : [];
        if (sectionId === "competitions" || sectionId === "results") {
          activities = activities.filter((row) => activityOptionId(row, sectionId) !== null);
        }
        if (sectionId === "support" || sectionId === "registrations" || sectionId === "expenses" || sectionId === "training-points") {
          // These functions apply to all activities, not only competitions.
        }
        if (requestId === loadSequence.current) setRows(activities);
        if (sectionId === "reports" || sectionId === "overview") {
          const [report, points] = await Promise.all([
            workflowRequest<unknown>("/reports/summary").catch(() => []),
            workflowRequest<unknown>("/reports/training-points").catch(() => []),
          ]);
          if (requestId === loadSequence.current) {
            setRows(Array.isArray(report) ? report as Row[] : []);
            setSecondary(Array.isArray(points) ? points as Row[] : []);
          }
        }
      }
    } catch (cause) {
      if (requestId === loadSequence.current) {
        setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu.");
        setRows([]);
      }
    }
  }, [sectionId]);

  useEffect(() => {
    setDetail(null);
    setAttendanceQr(null);
    setSelectedId("");
    setSelectedRegistrationId("");
    setNotice("");
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => { active = false; };
  }, [load]);

  useEffect(() => {
    if (sectionId === "expenses" && initialActivityId) {
      const id = String(initialActivityId);
      setSelectedId(id);
      void workflowRequest<unknown>(`/settlements/${id}`).then((value) => setDetail(value && typeof value === "object" ? value as Row : null)).catch(() => undefined);
    }
  }, [sectionId, initialActivityId]);

  useEffect(() => {
    if (sectionId === "expenses" && initialActivityId) setBudgetDialogOpen(true);
  }, [sectionId, initialActivityId]);

  async function run(path: string, method: string, body?: unknown, message = "Đã lưu.") {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await workflowRequest<unknown>(path, { method, body });
      setDetail(result && typeof result === "object" ? result as Row : null);
      setNotice(message);
      await load();
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể thực hiện thao tác.");
      return null;
    } finally { setBusy(false); }
  }

  async function selected(pathPrefix: string) {
    if (!selectedId) { setError("Hãy chọn một hoạt động trước."); return; }
    try {
      const value = await workflowRequest<unknown>(`${pathPrefix}${selectedId}`);
      setDetail(value && typeof value === "object" ? value as Row : null);
      if (sectionId === "registrations" && Array.isArray(value)) {
        const firstRegistration = value.find((row) => readValue(row as Row, "MaDK") !== undefined) as Row | undefined;
        setSelectedRegistrationId(firstRegistration ? String(readValue(firstRegistration, "MaDK")) : "");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được chi tiết."); }
  }

  async function submit(event: FormEvent<HTMLFormElement>, action: (values: FormData) => Promise<unknown>) {
    event.preventDefault();
    await action(new FormData(event.currentTarget));
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const result = await run("/admin/accounts", "POST", {
      username: values.get("username"),
      password: values.get("password"),
      roleId: Number(values.get("roleId")),
    }, "Đã tạo tài khoản.");
    if (result) {
      form.reset();
      setNewAccountRoleId("");
    }
  }

  const activitySelect = sectionId !== "plans" && sectionId !== "seminars" && sectionId !== "news" && sectionId !== "reports" && sectionId !== "overview" && sectionId !== "expenses";
  const selectedActivity = rows.find((row) => activityOptionId(row, sectionId) === selectedId);
  const registrationRows = Array.isArray(detail) ? detail as Row[] : [];
  const registrationOptions = registrationRows.filter((row) => readValue(row, "MaDK") !== undefined);
  const seenActivityIds = new Set<string>();
  const activityOptions = rows.flatMap((row) => {
    const id = activityOptionId(row, sectionId);
    if (id === null || seenActivityIds.has(id)) return [];
    seenActivityIds.add(id);
    return [{ row, id }];
  });
  const displayRows = sectionId === "overview" ? sortByActivityTime(rows) : rows;
  const assignableRoles = secondary.filter((role) => roleCode(role) !== "SINHVIEN");
  const budgetGroups = Array.from(rows.reduce((groups, row) => {
    const id = String(readValue(row, "MaHD") ?? "");
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(row);
    return groups;
  }, new Map<string, Row[]>()));

  if (sectionId === "seminars" && !canManageActivities(user.roles)) {
    return <div className={s.businessPanel}>
      {error && <p className={s.error} role="alert">{error}</p>}
      {notice && <p className={s.success} role="status">{notice}</p>}
      <section className={s.card}>
        <h2>Seminar học thuật</h2>
        <Listing rows={rows} empty="Chưa có Seminar." onSelect={(row) => setSelectedId(String(row.MaSeminar))} />
        {selectedId && user.roles.includes("SINHVIEN") && <button className={s.primary} disabled={busy} onClick={() => void run(`/seminars/${selectedId}/register`, "POST", {}, "Đã gửi đăng ký tham gia seminar.")}>Đăng ký tham gia Seminar #{selectedId}</button>}
      </section>
    </div>;
  }

  return <div className={s.businessPanel}>
    {sectionId === "expenses" && <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}><button className={s.primary} onClick={() => setBudgetDialogOpen(true)}>＋ Tạo kinh phí hoạt động</button></div>}
    
    {error && <p className={s.error} role="alert">{error}</p>}
    {notice && <p className={s.success} role="status">{notice}</p>}
    {sectionId === "users" && <>
      <section className={s.card}><h2>Tạo tài khoản</h2><p className={s.studentProfilesHint}>Tài khoản Sinh viên được tạo mới hoặc liên kết tại mục Hồ sơ sinh viên.</p><form className={s.businessForm} onSubmit={createAccount}>
        <Field title="Tên đăng nhập" name="username" required/>
        <PasswordField title="Mật khẩu (tối thiểu 12 ký tự)" name="password" required minLength={12}/>
        <label className={s.businessField}><span>Vai trò</span><select className={inputClass} name="roleId" value={newAccountRoleId} onChange={(event)=>setNewAccountRoleId(event.target.value)} required><option value="">Chọn vai trò</option>{assignableRoles.map((role,index)=>{const id=roleId(role);return <option key={`role-create-${String(id ?? "missing")}-${index}`} value={id == null ? "" : String(id)} disabled={id == null}>{label(role,"TenVaiTro","tenVaiTro","name")}</option>})}</select></label>
        <button className={s.primary} disabled={busy}>{busy ? "Đang tạo…" : "Tạo tài khoản"}</button>
      </form></section>
      <section className={s.card}>
        <h2>Tài khoản hiện có</h2>
        <AccountManagementList
          accounts={rows}
          roles={secondary}
          studentProfiles={studentProfiles}
          profileLoadError={profileLoadError}
          busy={busy}
          currentUserId={user.id}
          onResetPassword={(id, password) => run(`/admin/accounts/${id}/password`, "PATCH", { password }, "Đã đổi mật khẩu; tài khoản đó cần đăng nhập lại.")}
          onChangeRole={(id, nextRoleId) => run(`/admin/accounts/${id}/role`, "PATCH", { roleId: nextRoleId }, "Đã cập nhật vai trò.")}
          onLinkProfile={(id, profileId) => run(`/admin/accounts/${id}/profile`, "PATCH", { maNgDung: profileId }, "Đã liên kết hồ sơ sinh viên.")}
          onSetActive={(id, _username, active) => run(`/admin/accounts/${id}/status`, "PATCH", { active }, active ? "Tài khoản đã được hoạt động lại." : "Tài khoản đã được ngừng hoạt động; lịch sử được giữ lại.")}
          onDeletePermanently={(id) => run(`/admin/accounts/${id}/permanent`, "DELETE", undefined, "Đã xóa vĩnh viễn tài khoản đăng nhập; hồ sơ và dữ liệu lịch sử được giữ lại.")}
        />
      </section>
    </>}

    {sectionId === "overview" && <>
      <section className={s.businessMetrics}>
        <article><span>Hoạt động</span><strong>{rows.length}</strong></article>
        <article><span>Lượt đăng ký</span><strong>{rows.reduce((sum, row) => sum + Number(row.SoLuotDangKy ?? 0), 0)}</strong></article>
        <article><span>Lượt tham dự</span><strong>{rows.reduce((sum, row) => sum + Number(row.SoLuotThamDu ?? 0), 0)}</strong></article>
        <article><span>Chi phí thực tế</span><strong>{rows.reduce((sum, row) => sum + Number(row.TongChiPhi ?? 0), 0).toLocaleString("vi-VN")} đ</strong></article>
      </section>
      <Listing rows={displayRows} empty="Chưa có hoạt động trong khoảng thời gian báo cáo." onSelect={(row) => setSelectedId(String(row.MaHD))} />
    </>}

    {sectionId === "plans" && <>
      <section className={s.card}>
        <h2>Tạo kế hoạch</h2>
        <form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run("/plans", "POST", { soKeHoach: v.get("soKeHoach"), tenKeHoach: v.get("tenKeHoach"), ngayBanHanh: v.get("ngayBanHanh") || undefined, namHoc: v.get("namHoc"), hocKy: v.get("hocKy"), canCu: v.get("canCu"), mucDich: v.get("mucDich"), yeuCau: v.get("yeuCau"), noiDung: v.get("noiDung"), maKhoa: Number(v.get("maKhoa")), maBM: v.get("maBM") ? Number(v.get("maBM")) : undefined }))}>
          <Field title="Số kế hoạch" name="soKeHoach" required /><Field title="Tên kế hoạch" name="tenKeHoach" required /><Field title="Ngày ban hành" name="ngayBanHanh" type="date" /><Field title="Năm học" name="namHoc" defaultValue="2026-2027" required /><Field title="Học kỳ" name="hocKy" defaultValue="HK1" /><Field title="Mã khoa" name="maKhoa" type="number" min="1" required /><Field title="Mã bộ môn (nếu có)" name="maBM" type="number" min="1" /><Field title="Căn cứ" name="canCu" /><Field title="Mục đích" name="mucDich" /><Field title="Yêu cầu" name="yeuCau" /><Field title="Nội dung" name="noiDung" />
          <button className={s.primary} disabled={busy}>Tạo bản nháp</button>
        </form>
      </section>
      <section className={s.card}>
        <h2>Kế hoạch đã lập</h2>{rows.length ? <div className={s.businessList}>{rows.map((row, index) => { const id = String(identifier(row, "MaKeHoach")); return <article key={`plan-${id}-${index}`}><div><strong>{label(row, "TenKeHoach")}</strong><span>{label(row, "SoKeHoach")} · {label(row, "NamHoc")} · {label(row, "TrangThai")}</span></div><div className={s.businessActions}><button type="button" className={s.secondaryButton} onClick={() => { setSelectedId(id); setSelectedApprovedActivities([]); void selected("/plans/"); void workflowRequest<Row[]>("/academic-activities").then((items) => setApprovedActivities(items.filter((item) => label(item, "TrangThai") === "Đã duyệt"))).catch(() => setApprovedActivities([])); }}>Xem</button><button type="button" className={s.secondaryButton} disabled={label(row, "TrangThai") === "Đã duyệt"} onClick={() => { setSelectedId(id); void selected("/plans/"); }}>Chỉnh sửa</button></div></article>; })}</div> : <p className={s.emptyMessage}>Chưa có kế hoạch.</p>}
        {detail && <><pre className={s.jsonDetail}>{JSON.stringify(detail, null, 2)}</pre>
          {approvedActivities.length > 0 && <div className={s.card} style={{ marginBottom: "16px", padding: "16px" }}><h3>Hoạt động đã được Trưởng khoa duyệt</h3>{approvedActivities.map((activity) => { const id = String(readValue(activity, "MaHD")); return <label key={id} style={{ display: "flex", gap: "10px", padding: "8px 0", alignItems: "center" }}><input type="checkbox" checked={selectedApprovedActivities.includes(id)} onChange={(e) => setSelectedApprovedActivities((current) => e.target.checked ? [...current, id] : current.filter((value) => value !== id))} /><span><strong>{label(activity, "TenHoatDong")}</strong> · {label(activity, "LoaiHoatDong")} · Mã HĐ {id}</span></label>; })}<button type="button" className={s.primary} disabled={busy || !selectedApprovedActivities.length} onClick={async () => { for (const id of selectedApprovedActivities) { const activity = approvedActivities.find((item) => String(readValue(item, "MaHD")) === id); if (activity) await run(`/plans/${selectedId}/activities`, "POST", { tenHoatDong: label(activity, "TenHoatDong"), noiDung: readValue(activity, "NoiDung"), thoiGianDuKien: readValue(activity, "TgDuKien") || undefined, diaDiem: readValue(activity, "DiaDiem"), doiTuong: readValue(activity, "DoiTuongThamDu"), chiTieu: readValue(activity, "SLSVDuKien") ? Number(readValue(activity, "SLSVDuKien")) : undefined, duToan: 0 }); } setSelectedApprovedActivities([]); await selected(`/plans/${selectedId}/`); }}>Thêm vào kế hoạch</button></div>}
          <form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run(`/plans/${selectedId}/activities`, "POST", { tenHoatDong: v.get("tenHoatDong"), noiDung: v.get("noiDung"), thoiGianDuKien: v.get("batDau") || undefined, thoiGianKetThuc: v.get("ketThuc") || undefined, hanDangKy: v.get("hanDangKy") || undefined, diaDiem: v.get("diaDiem"), doiTuong: v.get("doiTuong"), chiTieu: v.get("chiTieu") ? Number(v.get("chiTieu")) : undefined, nguoiPhuTrach: v.get("nguoiPhuTrach"), duToan: Number(v.get("duToan") || 0) }))}>
            <h3>Thêm hoạt động và dự toán</h3><Field title="Tên hoạt động" name="tenHoatDong" required /><Field title="Nội dung" name="noiDung" /><Field title="Bắt đầu" name="batDau" type="datetime-local" /><Field title="Kết thúc" name="ketThuc" type="datetime-local" /><Field title="Hạn đăng ký" name="hanDangKy" type="datetime-local" /><Field title="Địa điểm" name="diaDiem" /><Field title="Đối tượng" name="doiTuong" /><Field title="Chỉ tiêu" name="chiTieu" type="number" min="1" /><Field title="Người phụ trách" name="nguoiPhuTrach" /><Field title="Dự toán (đồng)" name="duToan" type="number" min="0" step="0.01" required /><button className={s.primary} disabled={busy}>Thêm hoạt động</button>
          </form>
          <div className={s.businessActions}><button className={s.primary} disabled={busy} onClick={() => void run(`/plans/${selectedId}/submit`, "POST", {})}>Trình duyệt</button><button className={s.secondaryButton} disabled={busy} onClick={() => void run(`/plans/${selectedId}/review`, "PATCH", { action: "approve" }, "Đã ghi nhận bước duyệt.")}>Duyệt bước hiện tại</button><button className={s.secondaryButton} disabled={busy} onClick={() => void run(`/plans/${selectedId}/review`, "PATCH", { action: "request_changes", ghiChu: "Vui lòng bổ sung thông tin." }, "Đã yêu cầu bổ sung.")}>Yêu cầu bổ sung</button></div>
          {Array.isArray(detail.hoatDong) && <div className={s.businessList}>{(detail.hoatDong as Row[]).map((row) => <article key={String(row.MaChiTiet)}><strong>{label(row, "TenHoatDong")}</strong><span>{label(row, "TrangThai")} · dự toán {label(row, "DuToan")}</span><button className={s.secondaryButton} onClick={() => void run(`/plans/details/${row.MaChiTiet}/publish`, "POST", {})}>Công bố hoạt động đã duyệt</button></article>)}</div>}
        </>}
      </section>
    </>}

    {activitySelect && <section className={s.card}>
      <h2>{sectionId === "competitions" || sectionId === "results" ? "Cuộc thi" : "Chọn hoạt động"}</h2>
      <div className={s.businessSelect}><select className={inputClass} value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setDetail(null); setAttendanceQr(null); setSelectedRegistrationId(""); }}><option value="">Chọn hoạt động</option>{activityOptions.map(({ row, id }) => {
        const start = formatDateTime(activityStart(row));
        const end = formatDateTime(readValue(row, "TgKetThuc", "thoiGianKetThuc", "ketThucLuc", "NgayKetThuc"));
        return <option key={`${sectionId}-${id}`} value={id}>{label(row, "TenHoatDong", "TenCuocThi")} · #{id}{start ? ` · ${start}` : ""}{end ? ` – ${end}` : ""}</option>;
      })}</select>
        {(sectionId === "registrations" || sectionId === "support") && <button className={s.secondaryButton} onClick={() => void selected(sectionId === "registrations" ? "/registrations/manage/" : "/registrations/support-assignments/")}>Tải dữ liệu</button>}
        {(sectionId === "expenses" || sectionId === "attendance") && <button className={s.secondaryButton} onClick={() => void selected(sectionId === "expenses" ? "/settlements/" : "/activities/")}>{sectionId === "expenses" ? "Tải quyết toán" : "Tải thông tin hoạt động"}</button>}
        {sectionId === "registrations" && <button className={s.secondaryButton} onClick={() => void selected(`/activities/${selectedId}/waitlist`)}>Tải danh sách chờ</button>}
        {(sectionId === "competitions" || sectionId === "results") && <button className={s.secondaryButton} onClick={() => void selected(`/competition-rounds/`)}>Xem vòng thi</button>}
      </div>
      {selectedActivity && <p>{label(selectedActivity, "TenHoatDong", "TenCuocThi")} · Bắt đầu: {formatDateTime(activityStart(selectedActivity)) ?? "Chưa cập nhật"} · Kết thúc: {formatDateTime(readValue(selectedActivity, "TgKetThuc", "thoiGianKetThuc", "ketThucLuc", "NgayKetThuc")) ?? "Chưa cập nhật"} · {label(selectedActivity, "DiaDiem")}</p>}
      {detail && <pre className={s.jsonDetail}>{JSON.stringify(detail, null, 2)}</pre>}
    </section>}

    {sectionId === "competitions" && selectedId && <section className={s.card}>
      <h2>Vòng thi và bài dự thi</h2>
      <form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run("/competition-rounds", "POST", { maCThi: Number(selectedId), tenVong: v.get("tenVong"), thuTu: Number(v.get("thuTu")), moTa: v.get("moTa"), batDauLuc: v.get("batDauLuc") || undefined, ketThucLuc: v.get("ketThucLuc") || undefined, hanNopBai: v.get("hanNopBai") || undefined }))}>
        <Field title="Tên vòng" name="tenVong" required /><Field title="Thứ tự" name="thuTu" type="number" min="1" required /><Field title="Mô tả" name="moTa" /><Field title="Bắt đầu" name="batDauLuc" type="datetime-local" /><Field title="Kết thúc" name="ketThucLuc" type="datetime-local" /><Field title="Hạn nộp bài" name="hanNopBai" type="datetime-local" /><button className={s.primary} disabled={busy}>Tạo vòng thi</button>
      </form>
      <form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run(`/competition-rounds/${v.get("maVong")}/submissions`, "GET"))}>
        <Field title="Mã vòng thi để xem bài nộp" name="maVong" type="number" min="1" required /><button className={s.secondaryButton}>Xem bài dự thi</button>
      </form>
      <form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run(`/submissions/${v.get("maBai")}/score`, "PATCH", { diem: Number(v.get("diem")), nhanXet: v.get("nhanXet") }))}>
        <Field title="Mã bài dự thi" name="maBai" type="number" min="1" required/><Field title="Điểm (0–100)" name="diem" type="number" min="0" step="0.01" required/><Field title="Nhận xét" name="nhanXet"/><button className={s.secondaryButton}>Lưu điểm chấm</button>
      </form>
    </section>}

    {sectionId === "registrations" && <section className={s.card}><h2>Danh sách đăng ký / hàng chờ</h2>{Array.isArray(detail) && <Listing rows={registrationRows} empty="Chưa có dữ liệu." onSelect={(row) => setSelectedRegistrationId(String(readValue(row, "MaDK") ?? ""))} />}<form className={s.businessForm} onSubmit={(e) => submit(e, async (v) => { const result = await run(`/registrations/${v.get("maDK")}/status`, "PATCH", { trangThai: v.get("trangThai") }); if (result) await selected("/registrations/manage/"); return result; })}><label className={s.businessField}><span>Mã đăng ký · sinh viên · trạng thái</span><select className={inputClass} name="maDK" value={selectedRegistrationId} onChange={(e) => setSelectedRegistrationId(e.target.value)} required disabled={!registrationOptions.length}><option value="">{registrationOptions.length ? "Chọn đơn đăng ký" : "Tải dữ liệu đăng ký để chọn"}</option>{registrationOptions.map((row, index) => { const id = String(readValue(row, "MaDK")); return <option key={`registration-${id}-${index}`} value={id}>{displayCode(row, index)} · {label(row, "MSSV")} · {label(row, "HoTen")} · {label(row, "TrangThai")}</option>; })}</select></label><label className={s.businessField}><span>Trạng thái</span><select className={inputClass} name="trangThai"><option>Đã xác nhận</option><option>Đã đăng ký</option><option>Từ chối</option><option>Đã hủy</option></select></label><button className={s.primary} disabled={busy || !registrationOptions.length || !selectedRegistrationId}>Cập nhật trạng thái</button></form>{selectedId && <button className={s.secondaryButton} disabled={busy} onClick={()=>void run(`/activities/${selectedId}/waitlist/promote-next`,"POST",{},"Đã tiếp nhận sinh viên đầu tiên trong hàng chờ.")}>Nhận sinh viên tiếp theo</button>}</section>}

    {sectionId === "attendance" && selectedId && <section className={s.card}><h2>Điểm danh: {label(selectedActivity??{},"TenHoatDong")}</h2><form className={s.businessForm} onSubmit={(e)=>submit(e,async(v)=>{setAttendanceQr(null);const activityId=selectedId;const expiresAt=new Date(String(v.get("expiresAt"))).toISOString();const result=await run(`/attendance/activities/${activityId}/qr`,"POST",{expiresAt},"Đã tạo mã QR điểm danh.");if(result&&typeof result==="object"&&!Array.isArray(result)){const response=result as Row;const token=readValue(response,"maQRCode","MaQRCode");if(token!==undefined){try{const image=await QRCode.toDataURL(String(token),{errorCorrectionLevel:"H",margin:2,width:320});setAttendanceQr({image,expiresAt:String(readValue(response,"TGHetHan","expiresAt")??expiresAt),activityId});}catch{setError("Đã tạo mã nhưng chưa thể tạo ảnh QR. Vui lòng thử lại.");}}else{setError("API chưa trả về mã QR để hiển thị.");}}return result;})}><Field title="Mã QR hết hạn lúc" name="expiresAt" type="datetime-local" required/><button className={s.primary} disabled={busy}>Tạo mã QR</button></form>{attendanceQr?.activityId===selectedId&&<div className={s.attendanceQr}><strong>Quét mã bằng ứng dụng di động để điểm danh</strong><img src={attendanceQr.image} alt="Mã QR điểm danh" width={320} height={320}/><span>Mã có hiệu lực đến {formatDateTime(attendanceQr.expiresAt)??attendanceQr.expiresAt}</span><a href={attendanceQr.image} download={`diem-danh-${selectedId}.png`}>Tải mã QR</a></div>}<form className={s.businessForm} onSubmit={(e)=>submit(e,(v)=>run("/attendance/manual","POST",{maDK:Number(v.get("maDK"))},"Đã điểm danh; khoản +5 DRL đang chờ Phòng CTSV xác nhận."))}><Field title="Mã đăng ký của sinh viên" name="maDK" type="number" min="1" required/><button className={s.secondaryButton} disabled={busy}>Ghi nhận theo danh sách ký tay</button></form>{detail && attendanceQr?.activityId!==selectedId && <pre className={s.jsonDetail}>{JSON.stringify(detail,null,2)}</pre>}</section>}

    {sectionId === "support" && selectedId && <section className={s.card}><h2>Phân chỉ tiêu theo lớp</h2><form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run("/registrations/support-assignment", "POST", { maHD: Number(selectedId), maLop: Number(v.get("maLop")), soLuong: Number(v.get("soLuong")), loaiPhanCong: v.get("loaiPhanCong"), nhiemVu: v.get("nhiemVu") }))}><Field title="Mã lớp" name="maLop" type="number" min="1" required /><Field title="Số lượng" name="soLuong" type="number" min="1" required /><label className={s.businessField}><span>Phân công</span><select className={inputClass} name="loaiPhanCong"><option>Cổ vũ</option><option>Hỗ trợ</option></select></label><Field title="Nhiệm vụ" name="nhiemVu" /><button className={s.primary}>Lưu phân bổ</button></form>{Array.isArray(detail) && <Listing rows={detail as Row[]} empty="Chưa phân bổ lớp." />}</section>}

    {sectionId === "training-points" && <section className={s.card}><h2>Điểm rèn luyện</h2><p>Thống kê khoản ghi nhận theo học kỳ/năm học.</p><button className={s.secondaryButton} onClick={async () => { try { const value=await workflowRequest<unknown>("/reports/training-points"); setDetail({ rows: value }); } catch(cause) {setError(cause instanceof Error?cause.message:"Không tải được báo cáo");} }}>Tải báo cáo điểm</button><form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run("/training-points", "POST", { maSV: Number(v.get("maSV")), maHD: Number(selectedId || v.get("maHD")), hocKy: v.get("hocKy"), namHoc: v.get("namHoc"), diem: Number(v.get("diem")), lyDo: v.get("lyDo") }))}><Field title="Mã sinh viên" name="maSV" type="number" min="1" required /><Field title="Mã hoạt động" name="maHD" type="number" min="1" required /><Field title="Học kỳ" name="hocKy" required /><Field title="Năm học" name="namHoc" required /><Field title="Điểm cộng/trừ" name="diem" type="number" required /><Field title="Lý do" name="lyDo" required /><button className={s.primary}>Ghi nhận chờ duyệt</button></form><form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run(`/training-points/${v.get("maDiem")}/approve`, "PATCH", {}))}><Field title="Mã khoản DRL cần duyệt" name="maDiem" type="number" min="1" required /><button className={s.secondaryButton}>Duyệt khoản DRL</button></form>{detail && <pre className={s.jsonDetail}>{JSON.stringify(detail,null,2)}</pre>}</section>}

    {sectionId === "results" && selectedId && <section className={s.card}><h2>Kết quả cuộc thi</h2><button className={s.secondaryButton} onClick={async()=>{const value=await workflowRequest<unknown>(`/competitions/${selectedId}/results`);setDetail({rows:value});}}>Tải kết quả đã công bố</button>{canManageActivities(user.roles) && <><form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run(`/competitions/${selectedId}/results`, "POST", { maDoi: v.get("maDoi") ? Number(v.get("maDoi")) : undefined, maDK: v.get("maDK") ? Number(v.get("maDK")) : undefined, maGT: v.get("maGT") ? Number(v.get("maGT")) : undefined, loaiKQ: v.get("loaiKQ"), xepHang: v.get("xepHang") ? Number(v.get("xepHang")) : undefined, diem: v.get("diem") ? Number(v.get("diem")) : undefined, ghiChu: v.get("ghiChu") }))}><Field title="Mã đội" name="maDoi" type="number" min="1" /><Field title="Mã đăng ký cá nhân" name="maDK" type="number" min="1" /><Field title="Mã giải" name="maGT" type="number" min="1" /><Field title="Loại kết quả" name="loaiKQ" /><Field title="Xếp hạng" name="xepHang" type="number" min="1" /><Field title="Điểm" name="diem" type="number" min="0" step="0.01" /><Field title="Ghi chú" name="ghiChu" /><button className={s.primary}>Tạo kết quả nháp</button></form><form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run(`/competitions/results/${v.get("maKQ")}/publish`, "PATCH", {}))}><Field title="Mã kết quả để công bố" name="maKQ" type="number" min="1" required /><button className={s.secondaryButton}>Công bố kết quả</button></form></>}</section>}

    {sectionId === "expenses" && <section className={s.card}><h2>Kinh phí hoạt động</h2>{budgetGroups.length ? <div className={s.businessList}>{budgetGroups.map(([activityId, items]) => { const total = items.reduce((sum, item) => sum + Number(readValue(item, "SoTien") ?? 0), 0); const first = items[0]; return <article key={activityId}><div><strong>{label(first, "TenHoatDong")}</strong><span>Mã HĐ: {activityId} · {items.length} nội dung · Tổng dự trù: {total.toLocaleString("vi-VN")} đồng</span><small>{items.map((item) => `${label(item, "NoiDung")} (${label(item, "SoTien")} đồng)`).join(" · ")}</small></div><button className={s.primary} disabled={busy} onClick={() => void run(`/academic-activities/${activityId}/submit`, "PATCH", undefined, "Đã gửi toàn bộ kinh phí của hoạt động lên khoa xét duyệt.")}>Gửi khoa xét duyệt</button></article>; })}</div> : <p className={s.emptyMessage}>Chưa có dữ liệu kinh phí hoạt động.</p>}</section>}

    {sectionId === "expenses" && budgetDialogOpen && <div className={s.modalOverlay} role="dialog" aria-modal="true"><div className={s.modalCard} style={{ maxWidth: "720px", width: "min(720px, calc(100vw - 32px))", maxHeight: "calc(100vh - 40px)", overflowY: "auto", borderRadius: "18px", boxShadow: "0 24px 70px rgba(15, 23, 42, .22)" }}><div className={s.modalHeader} style={{ padding: "20px 24px", background: "linear-gradient(135deg, #eff6ff, #ffffff)" }}><div><div style={{ color: "#2563eb", fontSize: "12px", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Dự trù ngân sách</div><h3 style={{ margin: "5px 0 0", fontSize: "20px", color: "#0f172a" }}>Tạo kinh phí hoạt động</h3></div><button type="button" className={s.modalCloseBtn} onClick={() => setBudgetDialogOpen(false)}>✕</button></div><form onSubmit={async (event) => { event.preventDefault(); if (!initialActivityId) { setError("Chưa xác định hoạt động cần tạo kinh phí."); return; } const form = new FormData(event.currentTarget); const result = await run(`/academic-activities/${initialActivityId}/budget`, "POST", { maHD: Number(form.get("maHD")), noiDung: form.get("noiDung"), soLuong: form.get("soLuong") ? Number(form.get("soLuong")) : undefined, donViTinh: form.get("donViTinh"), donGia: form.get("donGia") ? Number(form.get("donGia")) : undefined, soTien: Number(form.get("soTien")), thuyetMinh: form.get("thuyetMinh"), nguonKinhPhi: form.get("nguonKinhPhi"), ghiChu: form.get("ghiChu") }, "Đã tạo kinh phí hoạt động."); if (result) setBudgetDialogOpen(false); }}><div className={s.modalBody} style={{ padding: "22px 24px 8px" }}><div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "14px" }}><Field title="Mã HĐ" name="maHD" defaultValue={String(initialActivityId ?? "")} required /><Field title="Nội dung kinh phí (tên hoạt động học thuật)" name="noiDung" defaultValue={initialActivityName || ""} required /></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}><Field title="Số lượng" name="soLuong" type="number" min="0" step="0.01" /><Field title="Đơn vị tính" name="donViTinh" placeholder="bộ, người..." /><Field title="Đơn giá" name="donGia" type="number" min="0" step="0.01" /></div><Field title="Số tiền dự trù *" name="soTien" type="number" min="0" step="0.01" required /><Field title="Thuyết minh" name="thuyetMinh" placeholder="Giải thích cơ sở lập dự toán..." /><Field title="Nguồn kinh phí" name="nguonKinhPhi" defaultValue="Kinh phí học thuật" /><Field title="Ghi chú" name="ghiChu" /><button type="button" className={s.secondaryButton} onClick={() => undefined}>+ Thêm dòng</button></div><div className={s.modalFooter} style={{ padding: "16px 24px 20px", borderTop: "1px solid #eef2f7", background: "#fbfdff" }}><button type="button" className={s.secondaryButton} onClick={() => setBudgetDialogOpen(false)}>Hủy</button><button type="submit" className={s.primary} disabled={busy}>{busy ? "Đang lưu…" : "Lưu kinh phí"}</button></div></form></div></div>}

    {sectionId === "seminars" && <><section className={s.card}><h2>Tạo Seminar</h2><form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run("/seminars", "POST", { tenHoatDong:v.get("tenHoatDong"), chuDe:v.get("chuDe"), tgBatDau:v.get("tgBatDau"), tgKetThuc:v.get("tgKetThuc"), hanDangKy:v.get("hanDangKy")||undefined, diaDiem:v.get("diaDiem"), slToiDa:v.get("slToiDa")?Number(v.get("slToiDa")):undefined, noiDung:v.get("noiDung"), doiTuongTG:v.get("doiTuongTG"), dvChuTri:v.get("dvChuTri"), dvPhoiHop:v.get("dvPhoiHop"), dienGia:v.get("dienGia")?JSON.parse(String(v.get("dienGia"))):[], chuongTrinh:v.get("chuongTrinh")?JSON.parse(String(v.get("chuongTrinh"))):[]}))}><Field title="Tên hoạt động" name="tenHoatDong" required/><Field title="Chủ đề" name="chuDe" required/><Field title="Bắt đầu" name="tgBatDau" type="datetime-local" required/><Field title="Kết thúc" name="tgKetThuc" type="datetime-local" required/><Field title="Hạn đăng ký" name="hanDangKy" type="datetime-local"/><Field title="Địa điểm" name="diaDiem"/><Field title="Chỉ tiêu" name="slToiDa" type="number" min="1"/><Field title="Nội dung" name="noiDung"/><Field title="Đối tượng" name="doiTuongTG"/><Field title="Đơn vị chủ trì" name="dvChuTri"/><Field title="Đơn vị phối hợp" name="dvPhoiHop"/><Field title="Diễn giả (JSON mảng)" name="dienGia" defaultValue="[]"/><Field title="Chương trình (JSON mảng)" name="chuongTrinh" defaultValue="[]"/><button className={s.primary} disabled={busy}>Tạo và công bố Seminar</button></form></section><section className={s.card}><h2>Seminar đã lập</h2><Listing rows={rows} empty="Chưa có Seminar." onSelect={(row)=>setSelectedId(String(row.MaSeminar))}/>{selectedId && <><form className={s.businessForm} onSubmit={(e)=>submit(e,(v)=>run(`/seminars/${selectedId}/materials`,"POST",{tenTep:v.get("tenTep"),urlTep:v.get("urlTep"),loaiTep:v.get("loaiTep")}))}><h3>Thêm tài liệu cho Seminar #{selectedId}</h3><Field title="Tên tài liệu" name="tenTep" required/><Field title="URL tài liệu" name="urlTep" required/><Field title="Loại tài liệu" name="loaiTep"/><button className={s.primary}>Lưu tài liệu</button></form>{user.roles.includes("SINHVIEN") && <button className={s.secondaryButton} onClick={()=>void run(`/seminars/${selectedId}/register`,"POST",{},"Đã gửi đăng ký tham gia seminar.")}>Đăng ký seminar này</button>}</>}</section></>}

    {sectionId === "news" && <section className={s.card}><h2>Thông báo và nhắc lịch</h2><p>Dữ liệu nhắc lịch được tải khi mở mục này.</p><Listing rows={rows} empty="Chưa có thông báo hoặc nhắc lịch." /></section>}

    {sectionId === "reports" && <><section className={s.card}><h2>Báo cáo hoạt động</h2><Listing rows={rows} empty="Không có dữ liệu báo cáo." /></section><section className={s.card}><h2>Tổng hợp điểm rèn luyện</h2><Listing rows={secondary} empty="Không có dữ liệu điểm rèn luyện." /></section></>}
  </div>;
}

function Listing({ rows, empty, onSelect }: { rows: Row[]; empty: string; onSelect?: (row: Row) => void }) {
  if (!rows.length) return <p className={s.emptyMessage}>{empty}</p>;
  return <div className={s.businessList}>{rows.map((row, index) => {
    const identifier = row.MaTK ?? row.MaThongBao ?? row.MaCho ?? row.MaKeHoach ?? row.MaSeminar ?? row.MaCThi ?? row.MaDK ?? row.MaCP ?? row.MaDiem ?? row.MaHD ?? index;
    const key = String(identifier);
    const start = formatDateTime(activityStart(row));
    const end = formatDateTime(readValue(row, "TgKetThuc", "thoiGianKetThuc", "ketThucLuc", "NgayKetThuc"));
    const sentAt = formatDateTime(readValue(row, "GuiLuc", "NgayTao"));
    const schedule = start
      ? `Bắt đầu: ${start}${end ? ` · Kết thúc: ${end}` : ""}`
      : sentAt ? `Gửi lúc: ${sentAt}` : label(row, "NamHoc", "MaHD");
    return <article key={`${key}:${index}`}>
      <button className={onSelect ? s.listSelect : s.listTitle} onClick={() => onSelect?.(row)} disabled={!onSelect}>{label(row,"TenKeHoach","TenHoatDong","TenCuocThi","ChuDe","TieuDe","MaDK","HoTen","TenDangNhap","username")}</button>
      <span>{label(row,"TrangThai","TenVaiTro","SoLuotDangKy","Loai","TenKhoa")} · {schedule}</span>
      {onSelect && <small>Mã: {displayCode(row, index)}</small>}
    </article>;
  })}</div>;
}






