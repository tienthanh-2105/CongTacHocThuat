"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { workflowRequest } from "@/services/workflow";
import s from "./dashboard.module.css";

type Row = Record<string, unknown>;
const value = (row: Row, ...keys: string[]) => {
  for (const key of keys) {
    const actual = Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    const result = actual ? row[actual] : undefined;
    if (result !== undefined && result !== null && result !== "") return result;
  }
  return undefined;
};
const text = (row: Row, ...keys: string[]) => {
  const result = value(row, ...keys);
  return result === undefined ? "—" : String(result);
};

function Input({ title, name, type = "text", required = false, maxLength, minLength }: {
  title: string; name: string; type?: string; required?: boolean; maxLength?: number; minLength?: number;
}) {
  return <label className={s.businessField}>
    <span>{title}</span>
    <input className={s.businessInput} name={name} type={type} required={required} maxLength={maxLength} minLength={minLength} />
  </label>;
}

export default function StudentProfilesPanel() {
  const [classes, setClasses] = useState<Row[]>([]);
  const [students, setStudents] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [accountMode, setAccountMode] = useState<"new" | "existing">("new");
  const [linkingProfile, setLinkingProfile] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [classRows, studentRows, accountRows] = await Promise.all([
        workflowRequest<unknown>("/admin/accounts/student-classes"),
        workflowRequest<unknown>("/admin/accounts/student-records"),
        workflowRequest<unknown>("/admin/accounts/unlinked-student-accounts"),
      ]);
      setClasses(Array.isArray(classRows) ? classRows as Row[] : []);
      setStudents(Array.isArray(studentRows) ? studentRows as Row[] : []);
      setAccounts(Array.isArray(accountRows) ? accountRows as Row[] : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được dữ liệu hồ sơ sinh viên.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const values = new FormData(formElement);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const common = {
        hoTen: String(values.get("hoTen") ?? "").trim(),
        maLop: Number(values.get("maLop")),
        email: String(values.get("email") ?? "").trim() || undefined,
        sdt: String(values.get("sdt") ?? "").trim() || undefined,
        ngaySinh: String(values.get("ngaySinh") ?? "") || undefined,
        gioiTinh: String(values.get("gioiTinh") ?? "") || undefined,
      };
      const result = accountMode === "new"
        ? await workflowRequest<Row>("/admin/accounts/student", {
            method: "POST",
            body: { ...common, password: String(values.get("password") ?? "") },
          })
        : await workflowRequest<Row>("/admin/accounts/student/with-account", {
            method: "POST",
            body: { ...common, maTK: Number(values.get("maTK")) },
          });
      formElement.reset();
      setAccountMode("new");
      const mssv = String(result.MSSV ?? result.TenDangNhap ?? "");
      setNotice(accountMode === "new"
        ? `Đã tạo hồ sơ và tài khoản. MSSV / tên đăng nhập: ${mssv}.`
        : `Đã tạo hồ sơ và liên kết tài khoản có sẵn. Tên đăng nhập đã đồng bộ thành ${mssv}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tạo được hồ sơ sinh viên.");
    } finally {
      setBusy(false);
    }
  }

  async function linkExistingProfile(event: FormEvent<HTMLFormElement>, maNgDung: string) {
    event.preventDefault();
    const selectedAccountId = new FormData(event.currentTarget).get("maTK");
    if (!selectedAccountId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await workflowRequest<Row>(`/admin/accounts/${String(selectedAccountId)}/profile`, {
        method: "PATCH",
        body: { maNgDung: Number(maNgDung) },
      });
      setNotice(`Đã liên kết hồ sơ. Tên đăng nhập đã đồng bộ thành ${String(result.TenDangNhap ?? result.MSSV ?? "MSSV")}.`);
      setLinkingProfile("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không liên kết được tài khoản với hồ sơ.");
    } finally {
      setBusy(false);
    }
  }

  return <div className={s.businessPanel}>
    {error && <p className={s.error} role="alert">{error}</p>}
    {notice && <p className={s.success} role="status">{notice}</p>}
    <section className={s.card}>
      <h2>Tạo hồ sơ sinh viên</h2>
      <p className={s.studentProfilesHint}>MSSV tự cấp gồm 10 chữ số theo khóa của lớp. Tên đăng nhập sẽ bằng MSSV; nếu đã có tài khoản, hãy chọn liên kết để không tạo tài khoản trùng.</p>
      {!classes.length && !loading && <p className={s.error}>Chưa có lớp trong dữ liệu. Hãy thêm lớp vào danh mục LOP trước khi tạo hồ sơ sinh viên.</p>}
      <form className={s.businessForm} onSubmit={createProfile}>
        <Input title="Họ và tên" name="hoTen" required maxLength={150} />
        <label className={s.businessField}>
          <span>Lớp</span>
          <select className={s.businessInput} name="maLop" required defaultValue="">
            <option value="">Chọn lớp</option>
            {classes.map((studentClass, index) => {
              const id = text(studentClass, "MaLop");
              return <option key={`class-${id === "—" ? index : id}`} value={id === "—" ? "" : id} disabled={id === "—"}>
                {text(studentClass, "TenLop")} · {text(studentClass, "KhoaHoc")} · {text(studentClass, "TenKhoa")}
              </option>;
            })}
          </select>
        </label>
        <label className={s.businessField}>
          <span>Xử lý tài khoản</span>
          <select className={s.businessInput} value={accountMode} onChange={(event) => setAccountMode(event.target.value as "new" | "existing")}>
            <option value="new">Tạo tài khoản mới cùng hồ sơ</option>
            <option value="existing">Liên kết tài khoản đã có</option>
          </select>
        </label>
        {accountMode === "new" ? <Input title="Mật khẩu đăng nhập (ít nhất 12 ký tự)" name="password" type="password" required minLength={12} maxLength={72} /> :
          <label className={s.businessField}>
            <span>Tài khoản chưa liên kết</span>
            <select className={s.businessInput} name="maTK" required defaultValue="">
              <option value="">Chọn tên đăng nhập · vai trò</option>
              {accounts.map((account, index) => {
                const id = text(account, "MaTK");
                return <option key={`account-${id === "—" ? index : id}`} value={id === "—" ? "" : id} disabled={id === "—"}>
                  {text(account, "TenDangNhap")} · {text(account, "TenVaiTro")}
                </option>;
              })}
            </select>
          </label>}
        <Input title="Email (không bắt buộc)" name="email" type="email" maxLength={150} />
        <Input title="Số điện thoại (không bắt buộc)" name="sdt" type="tel" maxLength={15} />
        <Input title="Ngày sinh (không bắt buộc)" name="ngaySinh" type="date" />
        <label className={s.businessField}>
          <span>Giới tính (không bắt buộc)</span>
          <select className={s.businessInput} name="gioiTinh" defaultValue="">
            <option value="">Chưa cập nhật</option>
            <option value="Nam">Nam</option>
            <option value="Nữ">Nữ</option>
            <option value="Khác">Khác</option>
          </select>
        </label>
        {accountMode === "existing" && !accounts.length && <p className={s.emptyMessage}>Không có tài khoản đang hoạt động chưa liên kết. Hãy tạo tài khoản mới hoặc kiểm tra danh sách tài khoản.</p>}
        <button className={s.primary} disabled={busy || loading || !classes.length || (accountMode === "existing" && !accounts.length)}>
          {busy ? "Đang lưu…" : accountMode === "new" ? "Tạo hồ sơ và tài khoản" : "Tạo hồ sơ và liên kết"}
        </button>
      </form>
    </section>

    <section className={s.card}>
      <h2>Danh sách hồ sơ sinh viên</h2>
      {loading ? <p className={s.emptyMessage}>Đang tải hồ sơ…</p> : !students.length ? <p className={s.emptyMessage}>Chưa có hồ sơ sinh viên.</p> :
        <div className={s.studentProfileList}>{students.map((student, index) => {
          const id = text(student, "MaSV");
          const maNgDung = text(student, "MaNgDung");
          const username = text(student, "TenDangNhap");
          return <article className={s.studentProfileItem} key={`student-${id === "—" ? index : id}`}>
            <div>
              <strong>{text(student, "HoTen")}</strong>
              <span>{text(student, "MSSV")} · {text(student, "TenLop")} · {text(student, "KhoaHoc")}</span>
              <small>{text(student, "Email")} · {text(student, "SDT")}</small>
            </div>
            <div className={s.studentProfileAccountActions}>
              <span className={username === "—" ? s.studentProfileUnlinked : s.studentProfileLinked}>
                {username === "—" ? "Chưa có tài khoản" : `Tài khoản: ${username}`}
              </span>
              {username === "—" && <button type="button" className={s.secondaryButton} disabled={busy || !accounts.length} onClick={() => setLinkingProfile((current) => current === maNgDung ? "" : maNgDung)}>
                Liên kết tài khoản có sẵn
              </button>}
            </div>
            {username === "—" && linkingProfile === maNgDung && <form className={s.accountInlineForm} onSubmit={(event) => void linkExistingProfile(event, maNgDung)}>
              {!accounts.length && <p className={s.emptyMessage}>Không có tài khoản chưa liên kết.</p>}
              <label className={s.businessField}>
                <span>Tài khoản chưa liên kết</span>
                <select className={s.businessInput} name="maTK" required defaultValue="">
                  <option value="">Chọn tên đăng nhập · vai trò</option>
                  {accounts.map((account, accountIndex) => {
                    const accountId = text(account, "MaTK");
                    return <option key={`link-account-${accountId === "—" ? accountIndex : accountId}`} value={accountId === "—" ? "" : accountId} disabled={accountId === "—"}>
                      {text(account, "TenDangNhap")} · {text(account, "TenVaiTro")}
                    </option>;
                  })}
                </select>
              </label>
              <button className={s.primary} disabled={busy || !accounts.length}>Liên kết</button>
            </form>}
          </article>;
        })}</div>}
    </section>
  </div>;
}
