"use client";

import { useEffect, useMemo, useState } from "react";
import { workflowRequest } from "@/services/workflow";
import s from "./dashboard.module.css";

type Row = Record<string, unknown>;
const read = (row: Row, key: string) => {
  const actual = Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
  return actual ? row[actual] : undefined;
};
const number = (row: Row, key: string) => {
  const result = Number(read(row, key) ?? 0);
  return Number.isFinite(result) ? result : 0;
};
const text = (row: Row, key: string, fallback = "—") => String(read(row, key) ?? fallback);
const money = (amount: number) => `${Math.round(amount).toLocaleString("vi-VN")} ₫`;
const escapeHtml = (input: unknown) => String(input ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const kindOf = (row: Row) => {
  const kind = text(row, "LoaiHoatDong", "Khác").toLocaleLowerCase("vi");
  return kind.includes("seminar") ? "Seminar" : kind.includes("cuộc thi") || kind.includes("cuoc thi") ? "Cuộc thi" : text(row, "LoaiHoatDong", "Khác");
};
const dateOf = (row: Row) => {
  const raw = read(row, "TgDuKien");
  if (!raw) return null;
  const date = new Date(String(raw));
  return Number.isNaN(date.getTime()) ? null : date;
};
const dateLabel = (row: Row) => {
  const date = dateOf(row);
  return date ? date.toLocaleDateString("vi-VN") : text(row, "TgDuKien");
};

export default function ReportsPanel() {
  const [activities, setActivities] = useState<Row[]>([]);
  const [year, setYear] = useState("all");
  const [department, setDepartment] = useState("all");
  const [kind, setKind] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    workflowRequest<Row[]>("/reports/summary")
      .then((rows) => { if (active) setActivities(Array.isArray(rows) ? rows : []); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được dữ liệu thống kê."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const years = useMemo(() => [...new Set(activities.map((row) => text(row, "NamHoc", "")).filter(Boolean))].sort((a, b) => b.localeCompare(a, "vi")), [activities]);
  const departments = useMemo(() => [...new Set(activities.map((row) => text(row, "TenBM", "")).filter((value) => value && value !== "—"))].sort((a, b) => a.localeCompare(b, "vi")), [activities]);
  const filtered = useMemo(() => activities.filter((row) =>
    (year === "all" || text(row, "NamHoc", "") === year) &&
    (department === "all" || text(row, "TenBM", "Chưa phân bộ môn") === department) &&
    (kind === "all" || kindOf(row) === kind)), [activities, year, department, kind]);
  const totals = useMemo(() => filtered.reduce<{ expenses: number; registrations: number; attendance: number; competitions: number; seminars: number }>((sum, row) => ({
    expenses: sum.expenses + number(row, "TongChiPhi"),
    registrations: sum.registrations + number(row, "SoLuotDangKy"),
    attendance: sum.attendance + number(row, "SoLuotThamDu"),
    competitions: sum.competitions + (kindOf(row) === "Cuộc thi" ? 1 : 0),
    seminars: sum.seminars + (kindOf(row) === "Seminar" ? 1 : 0),
  }), { expenses: 0, registrations: 0, attendance: 0, competitions: 0, seminars: 0 }), [filtered]);
  const byDepartment = useMemo(() => {
    const grouped = new Map<string, { activities: number; competitions: number; seminars: number; expenses: number; attendance: number }>();
    filtered.forEach((row) => {
      const name = text(row, "TenBM", "Chưa phân bộ môn");
      const item = grouped.get(name) ?? { activities: 0, competitions: 0, seminars: 0, expenses: 0, attendance: 0 };
      item.activities += 1;
      item.competitions += kindOf(row) === "Cuộc thi" ? 1 : 0;
      item.seminars += kindOf(row) === "Seminar" ? 1 : 0;
      item.expenses += number(row, "TongChiPhi");
      item.attendance += number(row, "SoLuotThamDu");
      grouped.set(name, item);
    });
    return [...grouped.entries()].map(([name, metrics]) => ({ name, ...metrics })).sort((a, b) => b.expenses - a.expenses || b.activities - a.activities);
  }, [filtered]);
  const monthly = useMemo(() => {
    const result = Array.from({ length: 12 }, (_, month) => ({ month, activities: 0, expenses: 0 }));
    filtered.forEach((row) => {
      const date = dateOf(row);
      if (!date) return;
      result[date.getMonth()].activities += 1;
      result[date.getMonth()].expenses += number(row, "TongChiPhi");
    });
    return result;
  }, [filtered]);
  const maxActivities = Math.max(1, ...monthly.map((item) => item.activities));
  const scope = `${year === "all" ? "Tất cả năm học" : `Năm học ${year}`} · ${department === "all" ? "Toàn khoa" : department}${kind === "all" ? "" : ` · ${kind}`}`;

  function printReport() {
    const popup = window.open("", "_blank", "width=1100,height=800");
    if (!popup) { setError("Trình duyệt đã chặn cửa sổ biên bản."); return; }
    const departmentRows = byDepartment.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.activities}</td><td>${row.competitions}</td><td>${row.seminars}</td><td>${row.attendance.toLocaleString("vi-VN")}</td><td>${escapeHtml(money(row.expenses))}</td></tr>`).join("");
    const activityRows = filtered.map((row) => `<tr><td>${escapeHtml(text(row, "TenHoatDong"))}</td><td>${escapeHtml(kindOf(row))}</td><td>${escapeHtml(text(row, "TenBM", "Chưa phân bộ môn"))}</td><td>${escapeHtml(dateLabel(row))}</td><td>${escapeHtml(text(row, "TrangThai"))}</td><td>${escapeHtml(money(number(row, "TongChiPhi")))}</td></tr>`).join("");
    popup.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Biên bản thống kê hoạt động học thuật</title><style>*{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#152f50;margin:28px}header{text-align:center;margin-bottom:22px}h1{font-size:21px;text-transform:uppercase;margin:0 0 8px}h2{font-size:16px;margin:22px 0 9px}p{margin:5px 0}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.summary div{border:1px solid #cbd6e4;padding:12px}.summary strong{display:block;margin-top:6px;font-size:17px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #9eacc0;padding:7px;text-align:left;font-size:12px}th{background:#edf3fa}.signatures{display:grid;grid-template-columns:repeat(3,1fr);text-align:center;margin-top:52px}.signatures strong{display:block;margin-bottom:65px}@media print{body{margin:15mm}}</style></head><body><header><p>KHOA CÔNG NGHỆ THÔNG TIN</p><h1>Biên bản thống kê hoạt động học thuật và chi phí thực tế</h1><p>${escapeHtml(scope)}</p></header><h2>I. Tổng hợp</h2><div class="summary"><div>Số hoạt động<strong>${filtered.length}</strong></div><div>Cuộc thi / Seminar<strong>${totals.competitions} / ${totals.seminars}</strong></div><div>Kinh phí thực tế<strong>${escapeHtml(money(totals.expenses))}</strong></div></div><h2>II. Thống kê theo bộ môn</h2><table><thead><tr><th>Bộ môn</th><th>Tổng hoạt động</th><th>Cuộc thi</th><th>Seminar</th><th>Lượt tham dự</th><th>Chi phí thực tế</th></tr></thead><tbody>${departmentRows || '<tr><td colspan="6">Chưa có dữ liệu.</td></tr>'}</tbody></table><h2>III. Danh sách hoạt động và chi phí</h2><table><thead><tr><th>Hoạt động</th><th>Loại</th><th>Bộ môn</th><th>Thời gian</th><th>Trạng thái</th><th>Chi phí thực tế</th></tr></thead><tbody>${activityRows || '<tr><td colspan="6">Chưa có dữ liệu.</td></tr>'}</tbody></table><div class="signatures"><div><strong>Người lập biên bản</strong><span>(Ký, ghi rõ họ tên)</span></div><div><strong>Trưởng bộ môn</strong><span>(Ký, ghi rõ họ tên)</span></div><div><strong>Trưởng khoa</strong><span>(Ký, ghi rõ họ tên)</span></div></div><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }

  function exportExcel() {
    const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const lines = [
      ["BÁO CÁO HOẠT ĐỘNG HỌC THUẬT VÀ CHI PHÍ THỰC TẾ", scope].map(cell).join(","),
      ["Hoạt động", "Loại hoạt động", "Bộ môn", "Khoa", "Năm học", "Thời gian", "Trạng thái", "Lượt đăng ký", "Lượt tham dự", "Chi phí thực tế (đồng)"].map(cell).join(","),
      ...filtered.map((row) => [text(row, "TenHoatDong"), kindOf(row), text(row, "TenBM", "Chưa phân bộ môn"), text(row, "TenKhoa"), text(row, "NamHoc"), dateLabel(row), text(row, "TrangThai"), number(row, "SoLuotDangKy"), number(row, "SoLuotThamDu"), Math.round(number(row, "TongChiPhi"))].map(cell).join(",")),
      ["TỔNG CỘNG", "", "", "", "", "", "", totals.registrations, totals.attendance, Math.round(totals.expenses)].map(cell).join(","),
    ];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Thong_ke_chi_phi_${year === "all" ? "tat_ca" : year.replace(/[^\p{L}\p{N}-]/gu, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <div className={s.reportDashboard}>
    <div className={s.reportToolbar}>
      <label aria-label="Lọc năm học">▣ <select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">Tất cả năm học</option>{years.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label aria-label="Lọc bộ môn">⌂ <select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="all">Toàn khoa</option>{departments.map((item) => <option key={item}>{item}</option>)}<option>Chưa phân bộ môn</option></select></label>
      <label aria-label="Lọc loại hoạt động">☷ <select value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">Cuộc thi và Seminar</option><option>Cuộc thi</option><option>Seminar</option></select></label>
      <span className={s.reportToolbarSpacer} />
      <button type="button" className={s.reportPrimaryButton} onClick={printReport} disabled={loading}>▤ Lập biên bản</button>
      <button type="button" className={s.reportSecondaryButton} onClick={printReport} disabled={loading}>▧ Xuất PDF</button>
      <button type="button" className={s.reportSecondaryButton} onClick={exportExcel} disabled={loading}>▦ Xuất Excel</button>
    </div>
    {error && <div className={s.reportError} role="alert">{error}</div>}
    <div className={s.reportKpis}>
      <article className={s.reportKpi}><span className={s.reportKpiIcon}>▤</span><small>Tổng hoạt động</small><strong>{loading ? "…" : filtered.length.toLocaleString("vi-VN")}</strong><em>{totals.competitions} cuộc thi · {totals.seminars} seminar</em></article>
      <article className={`${s.reportKpi} ${s.reportKpiBlue}`}><span className={s.reportKpiIcon}>◷</span><small>Lượt đăng ký</small><strong>{loading ? "…" : totals.registrations.toLocaleString("vi-VN")}</strong><em>Trong phạm vi đã chọn</em></article>
      <article className={`${s.reportKpi} ${s.reportKpiGreen}`}><span className={s.reportKpiIcon}>✓</span><small>Lượt tham dự</small><strong>{loading ? "…" : totals.attendance.toLocaleString("vi-VN")}</strong><em>Được ghi nhận điểm danh</em></article>
      <article className={`${s.reportKpi} ${s.reportKpiAmber}`}><span className={s.reportKpiIcon}>₫</span><small>Chi phí thực tế</small><strong>{loading ? "…" : money(totals.expenses)}</strong><em>Từ hồ sơ quyết toán đã duyệt</em></article>
    </div>
    <div className={s.reportCharts}>
      <section className={s.reportCard}>
        <div className={s.reportCardHeader}><div><h3>Hoạt động theo tháng</h3><p>Số cuộc thi và seminar theo thời gian tổ chức</p></div><span>{year === "all" ? "Tất cả năm học" : year}</span></div>
        <div className={s.reportBarChart} role="img" aria-label="Biểu đồ số hoạt động theo tháng">{monthly.map((item) => <div className={s.reportBarColumn} key={item.month} title={`${item.activities} hoạt động · ${money(item.expenses)}`}><strong>{item.activities || ""}</strong><i style={{ height: `${Math.max(item.activities ? 8 : 2, item.activities / maxActivities * 100)}%` }} /><small>T{item.month + 1}</small></div>)}</div>
      </section>
      <section className={s.reportCard}>
        <div className={s.reportCardHeader}><div><h3>Cơ cấu hoạt động</h3><p>Cuộc thi và seminar trong phạm vi lọc</p></div><span>{filtered.length} hoạt động</span></div>
        <div className={s.reportTypeSummary}><div><span className={s.reportTypeDot} data-kind="competition" />Cuộc thi<strong>{totals.competitions}</strong></div><div><span className={s.reportTypeDot} data-kind="seminar" />Seminar<strong>{totals.seminars}</strong></div></div>
        <div className={s.reportExpenseCallout}><span>Chi phí thực tế toàn phạm vi</span><strong>{money(totals.expenses)}</strong></div>
      </section>
    </div>
    <section className={s.reportCard}>
      <div className={s.reportCardHeader}><div><h3>Tổng hợp theo bộ môn</h3><p>Hoạt động và chi phí thực tế đã được duyệt</p></div><span>{scope}</span></div>
      <div className={s.reportTableWrap}><table className={s.reportTable}><thead><tr><th>Bộ môn</th><th>Tổng hoạt động</th><th>Cuộc thi</th><th>Seminar</th><th>Lượt tham dự</th><th>Chi phí thực tế</th></tr></thead><tbody>
        {byDepartment.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{row.activities}</td><td>{row.competitions}</td><td>{row.seminars}</td><td>{row.attendance.toLocaleString("vi-VN")}</td><td>{money(row.expenses)}</td></tr>)}
        {!byDepartment.length && <tr><td colSpan={6} className={s.reportEmpty}>{loading ? "Đang tải dữ liệu…" : "Chưa có dữ liệu trong phạm vi đã chọn."}</td></tr>}
      </tbody></table></div>
      <footer className={s.reportTableFooter}><span>{loading ? "Đang tải…" : `Tổng ${filtered.length} hoạt động`}</span><strong>Tổng chi phí thực tế: {money(totals.expenses)}</strong></footer>
    </section>
    <section className={s.reportCard}>
      <div className={s.reportCardHeader}><div><h3>Danh sách hoạt động</h3><p>Chi phí thực tế lấy từ hồ sơ quyết toán đã được duyệt</p></div><span>{filtered.length} hoạt động</span></div>
      <div className={s.reportTableWrap}><table className={s.reportTable}><thead><tr><th>Hoạt động</th><th>Loại</th><th>Bộ môn</th><th>Năm học</th><th>Thời gian</th><th>Trạng thái</th><th>Chi phí thực tế</th></tr></thead><tbody>
        {filtered.map((row) => <tr key={String(read(row, "MaHD"))}><td><strong>{text(row, "TenHoatDong")}</strong></td><td>{kindOf(row)}</td><td>{text(row, "TenBM", "Chưa phân bộ môn")}</td><td>{text(row, "NamHoc")}</td><td>{dateLabel(row)}</td><td>{text(row, "TrangThai")}</td><td>{money(number(row, "TongChiPhi"))}</td></tr>)}
        {!filtered.length && <tr><td colSpan={7} className={s.reportEmpty}>{loading ? "Đang tải dữ liệu…" : "Chưa có hoạt động trong phạm vi đã chọn."}</td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}
