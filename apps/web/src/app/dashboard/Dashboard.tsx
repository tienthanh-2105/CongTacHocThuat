"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, logout, type AuthUser } from "@/services/auth";
import AccountPanel from "./AccountPanel";
import { sections } from "./sections";
import s from "./dashboard.module.css";

function HomeIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M2 10.6 11.3 2.7a1.1 1.1 0 0 1 1.4 0L17 6.3V3h3v5.9l2 1.7-1.5 1.8L12 5.2l-8.5 7.2L2 10.6Z" />
    <path d="m5 12.4 7-5.9 7 5.9V22h-5v-7h-4v7H5v-9.6Z" />
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
const activities = [
  [
    "Seminar: Generative AI trong giáo dục",
    "08:00 – 12:00",
    "186/220",
    "Đang mở",
  ],
  ["Olympic Tin học cấp khoa 2026", "07:30 – 18:10", "94/120", "Sắp diễn ra"],
  ["Workshop An toàn ứng dụng Web", "13:30 – 22:10", "64/100", "Đang mở"],
];
export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState("overview");
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [query, setQuery] = useState("");
  const headerRef = useRef<HTMLElement>(null);
  const [accountView, setAccountView] = useState<"info" | "password" | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    getCurrentUser()
      .then((value) => {
        if (!alive) return;
        if (!value) router.replace("/login");
        else setUser(value);
      })
      .catch(() => {
        if (alive) setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
      });
    return () => {
      alive = false;
    };
  }, [router, attempt]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(false);
        setProfile(false);
        setNotifications(false);
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
      setUser(null);
      router.replace("/login");
    } catch {
      setError("Không thể đăng xuất. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }
  function navigate(id: string) {
    setAccountView(null);
    setActive(id);
    setMenu(false);
    setQuery("");
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
                setError("");
                setAttempt(attempt + 1);
              }}
            >
              Thử lại
            </button>
          )}
        </div>
      </main>
    );
  const selected = sections.find((item) => item.id === active)!;
  const matches = sections.filter((item) =>
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
          {sections.map((item, index) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={active === item.id ? s.active : ""}
              aria-current={active === item.id ? "page" : undefined}
            >
              {item.id === "overview" ? <HomeIcon /> : <Icon type={index} />}
              {item.title}
            </button>
          ))}
        </nav>
        <div className={s.year}>
          <small>HỌC KỲ ĐANG ÁP DỤNG · MINH HỌA</small>
          <strong>Học kỳ 1 · 2026–2027</strong>
        </div>
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
                aria-label="Thông báo"
                aria-expanded={notifications}
                onClick={() => {
                  setNotifications(!notifications);
                  setProfile(false);
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                </svg><span className={s.bellLabel}>Thông báo</span>
              </button>
              {notifications && (
                <div className={s.popup}><strong>Thông báo</strong><p>Chưa kết nối dữ liệu thông báo.</p><button onClick={() => { navigate("news"); setNotifications(false); }}>Xem tin tức & thông báo</button></div>
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
          <div className={s.heading}>
            <div>
              <h1>
                {accountView === "info" ? "Thông tin cá nhân" : active === "overview" ? "Trang chủ" : selected.title}
              </h1>
              <p>
                {active === "overview"
                  ? "Theo dõi hoạt động, mức độ tham gia và tiến độ học kỳ của toàn khoa."
                  : selected.detail}
              </p>
            </div>
            {accountView !== "info" && active === "overview" && (
              <button
                className={s.primary}
                onClick={() => navigate("competitions")}
              >
                ＋ Tạo hoạt động
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
          {accountView === "password" && <AccountPanel view="password" user={user} onClose={() => setAccountView(null)} />}
          {accountView === "info" ? <AccountPanel view="info" user={user} onClose={() => setAccountView(null)} /> : active === "overview" ? (
            <>
              <div className={s.demo}>
                Dữ liệu minh họa{" "}
                <span>
                  Chưa kết nối API nghiệp vụ. Các số liệu dưới đây chỉ dùng để
                  xem trước giao diện.
                </span>
              </div>
              <div className={s.metrics}>
                {[
                  ["Hoạt động học kỳ", "24", "+4 so với kỳ trước"],
                  ["Sinh viên tham gia", "1.286", "82,4% toàn khoa"],
                  ["Đề tài dự thi", "38", "12 đề tài đã duyệt"],
                  ["Cần xử lý", "07", "3 kế hoạch quá hạn"],
                ].map((item, index) => (
                  <article key={item[0]} className={s.metric}>
                    <div>
                      {item[0]}
                      <span className={s.metricIcon} data-tone={index}>
                        <Icon type={index + 2} />
                      </span>
                    </div>
                    <strong>{item[1]}</strong>
                    <small data-tone={index}>{item[2]}</small>
                  </article>
                ))}
              </div>
              <div className={s.grid}>
                <section className={s.card}>
                  <div className={s.cardHeading}>
                    <div>
                      <h2>Lượt tham gia theo tháng</h2>
                      <p>Tổng lượt đăng ký và điểm danh thực tế · Minh họa</p>
                    </div>
                    <span className={s.growth}>+18,6%</span>
                  </div>
                  <div
                    className={s.chart}
                    role="img"
                    aria-label="Biểu đồ minh họa lượt tham gia từ tháng 3 đến tháng 9: 72, 104, 88, 123, 119, 156, 138 lượt"
                  >
                    {[72, 104, 88, 123, 119, 156, 138].map((value, index) => (
                      <div className={s.barColumn} key={index}>
                        <span>{value}</span>
                        <div
                          style={{ height: `${(value / 156) * 135}px` }}
                          className={index === 5 ? s.highlightBar : s.bar}
                        />
                        <small>T{index + 3}</small>
                      </div>
                    ))}
                  </div>
                </section>
                <section className={s.card}>
                  <h2>Tiến độ kế hoạch</h2>
                  <p>Theo từng bộ môn · Minh họa</p>
                  <div className={s.progressList}>
                    {[
                      ["Công nghệ phần mềm", 88],
                      ["Hệ thống thông tin", 72],
                      ["Khoa học máy tính", 64],
                      ["Mạng & truyền thông", 58],
                    ].map(([name, value]) => (
                      <div key={name}>
                        <div>
                          {name}
                          <strong>{value}%</strong>
                        </div>
                        <div className={s.track}>
                          <span style={{ width: `${value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className={s.card}>
                  <div className={s.cardHeading}>
                    <div>
                      <h2>Hoạt động sắp tới</h2>
                      <p>Lịch hoạt động minh họa</p>
                    </div>
                    <button
                      className={s.textButton}
                      onClick={() => navigate("competitions")}
                    >
                      Xem tất cả →
                    </button>
                  </div>
                  <div className={s.tableScroll}>
                    <table>
                      <thead>
                        <tr>
                          <th>HOẠT ĐỘNG</th>
                          <th>THỜI GIAN</th>
                          <th>ĐĂNG KÝ</th>
                          <th>TRẠNG THÁI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activities.map((row) => (
                          <tr key={row[0]}>
                            {row.map((cell, index) => (
                              <td key={index}>
                                {index === 3 ? (
                                  <span
                                    className={
                                      cell === "Đang mở" ? s.status : s.soon
                                    }
                                  >
                                    {cell}
                                  </span>
                                ) : (
                                  cell
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className={s.card}>
                  <h2>Việc cần làm</h2>
                  <p>Các đầu việc minh họa</p>
                  {[
                    ["Duyệt kế hoạch cuộc thi", "Kế hoạch năm học", "plans"],
                    [
                      "Phân công ban tổ chức",
                      "Tổ chức cuộc thi",
                      "competitions",
                    ],
                    [
                      "Kiểm tra hồ sơ quyết toán",
                      "Kinh phí & quyết toán",
                      "expenses",
                    ],
                  ].map((item, index) => (
                    <button
                      className={s.task}
                      key={item[0]}
                      onClick={() => navigate(item[2])}
                    >
                      <span className={s.taskIcon}>
                        <Icon type={index + 2} />
                      </span>
                      <span>
                        {item[0]}
                        <small>{item[1]}</small>
                      </span>
                      <span>›</span>
                    </button>
                  ))}
                </section>
              </div>
            </>
          ) : (
            <section className={`${s.card} ${s.empty}`}>
              <span className={s.emptyIcon}>
                <Icon type={sections.indexOf(selected)} />
              </span>
              <h2>{selected.title}</h2>
              <p>{selected.detail}</p>
              <span className={s.developing}>Đang phát triển</span>
              <p>
                Chức năng nghiệp vụ này chưa được triển khai và kết nối API.
              </p>
              <button
                className={s.primary}
                onClick={() => navigate("overview")}
              >
                Về trang chủ
              </button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
