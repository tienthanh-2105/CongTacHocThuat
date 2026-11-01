"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { changePassword, type AuthUser } from "@/services/auth";
import s from "./dashboard.module.css";
import NoticeDialog from "./NoticeDialog";

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export default function AccountPanel({ view, user, onClose }: { view: "info" | "password"; user: AuthUser; onClose: () => void }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (view !== "password") return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; };
  }, [view]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = String(data.get("newPassword"));
    if (next !== data.get("confirmPassword")) { setError("Mật khẩu xác nhận chưa khớp."); return; }
    setBusy(true); setError("");
    try {
      await changePassword(String(data.get("currentPassword")), next);
      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đổi mật khẩu.");
    } finally { setBusy(false); }
  }

  if (view === "info") return <section className={`${s.card} ${s.accountPanel}`}>
    <div className={s.cardHeading}><h2>Thông tin cá nhân</h2><button className={s.textButton} onClick={onClose}>Đóng</button></div>
    <dl><dt>Họ và tên</dt><dd>{user.name || user.username}</dd><dt>Tên đăng nhập</dt><dd>{user.username}</dd><dt>Vai trò</dt><dd>{user.roles.includes("ADMIN") ? "Quản trị viên" : user.roles.join(", ")}</dd><dt>Chức vụ</dt><dd>{user.position || "Chưa cập nhật"}</dd><dt>Bộ môn phụ trách</dt><dd>{user.department || "Chưa phân công"}</dd></dl>
  </section>;

  return <dialog ref={dialogRef} className={s.passwordDialog} aria-label="Đổi mật khẩu" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); if (!busy && event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) onClose(); }}>
    <button type="button" className={s.dialogClose} aria-label="Đóng đổi mật khẩu" onClick={onClose} disabled={busy}>×</button>
    <form onSubmit={submit}>
      <label>
        <span>Mật khẩu cũ <em>(*)</em></span>
        <div className={s.inputWrap}>
          <input
            name="currentPassword"
            type={showOld ? "text" : "password"}
            placeholder="Nhập mật khẩu cũ"
            autoComplete="current-password"
            required
            disabled={busy}
          />
          <button
            type="button"
            className={s.eyeButton}
            aria-label={showOld ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            onClick={() => setShowOld(!showOld)}
            tabIndex={-1}
            disabled={busy}
          >
            <EyeIcon visible={showOld} />
          </button>
        </div>
      </label>

      <label>
        <span>Mật khẩu mới <em>(*)</em></span>
        <div className={s.inputWrap}>
          <input
            name="newPassword"
            type={showNew ? "text" : "password"}
            placeholder="Nhập mật khẩu mới"
            autoComplete="new-password"
            minLength={12}
            aria-describedby="password-hint"
            required
            disabled={busy}
          />
          <button
            type="button"
            className={s.eyeButton}
            aria-label={showNew ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            onClick={() => setShowNew(!showNew)}
            tabIndex={-1}
            disabled={busy}
          >
            <EyeIcon visible={showNew} />
          </button>
        </div>
      </label>

      <label>
        <span>Xác nhận mật khẩu <em>(*)</em></span>
        <div className={s.inputWrap}>
          <input
            name="confirmPassword"
            type={showConfirm ? "text" : "password"}
            placeholder="Xác nhận lại mật khẩu"
            autoComplete="new-password"
            minLength={12}
            required
            disabled={busy}
          />
          <button
            type="button"
            className={s.eyeButton}
            aria-label={showConfirm ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            onClick={() => setShowConfirm(!showConfirm)}
            tabIndex={-1}
            disabled={busy}
          >
            <EyeIcon visible={showConfirm} />
          </button>
        </div>
      </label>

      <small id="password-hint" className={s.passwordHint}>Tối thiểu 12 ký tự. Bạn cần đăng nhập lại sau khi đổi.</small>
      {error && <NoticeDialog message={error} kind="error" onClose={() => setError("")} />}
      <button className={s.dialogSave} disabled={busy}>{busy ? "Đang lưu…" : "Lưu"}</button>
    </form>
  </dialog>;
}
