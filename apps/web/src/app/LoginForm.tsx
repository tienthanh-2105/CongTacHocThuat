"use client";

import { useState, type FormEvent } from "react";
import { login } from "@/services/auth";
import { useRouter } from "next/navigation";
import AcademicIllustration from "@/components/AcademicIllustration";
import NoticeDialog from "./dashboard/NoticeDialog";

function BookMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 10c6-2 10-1 14 3 4-4 8-5 14-3v21c-6-2-10-1-14 3-4-4-8-5-14-3V10Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M20 13v21M11 17l5 1M11 22l5 1M24 18l5-1M24 23l5-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setHelp(false);
    setLoading(true);
    try {
      await login(username.trim(), password);
      setPassword("");
      router.replace("/dashboard");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Đăng nhập không thành công.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="login-page">
      <div className="heritage-pattern" aria-hidden="true" />
      <div className="login-shell">
        <section
          className="login-card"
          aria-label="Đăng nhập hệ thống học thuật"
        >
          <aside className="visual-panel">
            <div className="visual-heading">
              <h1>
                Nền tảng quản lý
                <br />
                hoạt động học thuật
              </h1>
              <p>
                Kết nối tri thức
                <br />
                Kiến tạo tương lai
              </p>
            </div>
            <AcademicIllustration />
            <p className="visual-caption">
              Cuộc thi · Seminar · Hoạt động sinh viên
            </p>
            <span className="glow glow-one" />
            <span className="glow glow-two" />
          </aside>
          <section className="form-panel">
            <div className="faculty-brand">
              <BookMark />
            </div>
            <div className="form-heading">
              <h2>
                Học Thuật
                <br />
                Khoa Công Nghệ Thông Tin
              </h2>
            </div>
            <form onSubmit={submit} className="login-form" aria-busy={loading}>
              <label htmlFor="username">Tên đăng nhập</label>
              <div className="input-wrap">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                </svg>
                <input
                  id="username"
                  name="username"
                  autoComplete="username"
                  placeholder="Nhập tên đăng nhập"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setError("");
                  }}
                  required
                  maxLength={100}
                  disabled={loading}
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
              <label htmlFor="password">Mật khẩu</label>
              <div className="input-wrap">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="5" y="10" width="14" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
                </svg>
                <input
                  id="password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="eye-button"
                  aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                    {!visible && <path d="m3 3 18 18" />}
                  </svg>
                </button>
              </div>
              {error && <NoticeDialog message={error} kind="error" onClose={() => setError("")} />}
              <button
                type="submit"
                className="submit-button"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" /> Đang đăng nhập…
                  </>
                ) : (
                  "Đăng nhập"
                )}
              </button>
              <button
                type="button"
                className="forgot-button"
                onClick={() => setHelp(!help)}
                aria-expanded={help}
              >
                Quên mật khẩu?
              </button>
              {help && <NoticeDialog message="Vui lòng liên hệ quản trị viên của khoa để được hỗ trợ cấp lại mật khẩu." kind="success" onClose={() => setHelp(false)} />}
            </form>
            <div className="secure-note">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m10 2 6 2v5c0 4-6 8-6 8S4 13 4 9V4l6-2Z" />
                <path d="m7 9 2 2 4-4" />
              </svg>
              Thông tin của bạn được bảo mật
            </div>
          </section>
        </section>
        <footer>
          © 2026 Hệ thống quản lý hoạt động học thuật
          <span>Đồng hành cùng tri thức và sáng tạo</span>
        </footer>
      </div>
    </main>
  );
}
