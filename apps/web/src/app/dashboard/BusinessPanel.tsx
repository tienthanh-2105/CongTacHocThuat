"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { workflowRequest } from "@/services/workflow";
import type { AuthUser } from "@/services/auth";
import { canApproveSettlements, canManageActivities } from "./sections";
import s from "./dashboard.module.css";

type Row = Record<string, unknown>;
const planApprovalStages = [
  { status: "Chờ Trưởng khoa ký duyệt", code: "faculty-dean", title: "Trưởng khoa ký và duyệt" , roles: ["TRUONGKHOA", "CANBOKHOA"] },
  { status: "Chờ Phòng KHCN ký duyệt", code: "research-office", title: "Phòng KHCN ký duyệt", roles: ["PHONGKHCN"] },
  { status: "Chờ Ban giám hiệu duyệt", code: "university-board", title: "Ban giám hiệu duyệt", roles: ["HIEUTRUONG"] },
] as const;
const label = (row: Row, ...keys: string[]) => {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null && row[key] !== "") return String(row[key]);
  return "—";
};
function planApprovalHistory(row: Row | null) {
  const raw = row ? readValue(row, "LichSuDuyet") : undefined;
  if (Array.isArray(raw)) return raw.filter((item): item is Row => Boolean(item) && typeof item === "object");
  if (typeof raw !== "string") return [] as Row[];
  try {
    const history: unknown = JSON.parse(raw);
    return Array.isArray(history) ? history.filter((item): item is Row => Boolean(item) && typeof item === "object") : [];
  } catch {
    return [] as Row[];
  }
}
function normalizedAcademicYear(value: unknown) {
  return String(value ?? "").replace(/\s/g, "").replace(/[–—]/g, "-").toLocaleLowerCase("vi");
}
const readValue = (row: Row, ...keys: string[]) => {
  for (const key of keys) {
    const actualKey = Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
    const value = actualKey ? row[actualKey] : undefined;
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};
function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
function downloadBudgetEstimate(rows: Row[], academicYear: string) {
  const approved = rows.filter((row) => label(row, "TrangThaiDuTru") === "Đã duyệt");
  if (!approved.length) return;
  const columns = ["Năm học", "Hoạt động", "Mã hoạt động", "Nội dung dự trù", "Số lượng", "Đơn vị tính", "Đơn giá", "Số tiền", "Thuyết minh", "Nguồn kinh phí", "Ghi chú"];
  const lines = [
    ["TỔNG HỢP DỰ TRÙ KINH PHÍ ĐÃ ĐƯỢC KHOA DUYỆT"].map(csvCell).join(","),
    ["Năm học", "Hoạt động", "Mã hoạt động", "Số khoản", "", "", "", "Tổng dự trù (đồng)"].map(csvCell).join(","),
  ];
  const grouped = approved.reduce((groups, row) => {
    const id = String(readValue(row, "MaHD") ?? "");
    const existing = groups.get(id) ?? [];
    existing.push(row);
    groups.set(id, existing);
    return groups;
  }, new Map<string, Row[]>());
  for (const [activityId, activityRows] of grouped) {
    const total = activityRows.reduce((sum, row) => sum + Number(readValue(row, "SoTien") ?? 0), 0);
    lines.push([readValue(activityRows[0], "NamHoc"), readValue(activityRows[0], "TenHoatDong"), activityId, activityRows.length, "", "", "", total.toFixed(2)].map(csvCell).join(","));
  }
  lines.push("");
  lines.push(["CHI TIẾT CÁC KHOẢN DỰ TRÙ"].map(csvCell).join(","));
  lines.push(columns.map(csvCell).join(","));
  let total = 0;
  for (const row of approved) {
    const amount = Number(readValue(row, "SoTien") ?? 0);
    total += Number.isFinite(amount) ? amount : 0;
    lines.push([
      readValue(row, "NamHoc"), readValue(row, "TenHoatDong"), readValue(row, "MaHD"), readValue(row, "NoiDung"),
      readValue(row, "SoLuong"), readValue(row, "DonViTinh"), readValue(row, "DonGia"), readValue(row, "SoTien"),
      readValue(row, "ThuyetMinh"), readValue(row, "NguonKinhPhi"), readValue(row, "GhiChu"),
    ].map(csvCell).join(","));
  }
  lines.push(["", "TỔNG CỘNG", "", "", "", "", "", total.toFixed(2), "", "", ""].map(csvCell).join(","));
  const blob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Du-tru-kinh-phi${academicYear ? `-${academicYear.replace(/[^\p{L}\p{N}-]/gu, "-")}` : ""}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function escapeHtml(value: unknown) {
  const entities: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  return String(value ?? "—").replace(/[&<>"']/g, (character) => entities[character] ?? character);
}
function competitionResultDocument(rows: Row[], competition: Row | undefined, competitionId: string) {
  const competitionName = label(competition ?? {}, "TenCuocThi", "TenHoatDong");
  const createdAt = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "long", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
  const tableRows = rows.map((row, index) => `<tr>
    <td class="center">${index + 1}</td>
    <td>${escapeHtml(readValue(row, "TenDoi", "HoTen"))}</td>
    <td class="center">${escapeHtml(readValue(row, "MSSV"))}</td>
    <td>${escapeHtml(readValue(row, "TenGT", "CapGiai", "LoaiKQ"))}</td>
    <td class="center">${escapeHtml(readValue(row, "XepHang"))}</td>
    <td class="center">${escapeHtml(readValue(row, "Diem"))}</td>
    <td>${escapeHtml(readValue(row, "GhiChu"))}</td>
  </tr>`).join("");

  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Phiếu kết quả cuộc thi ${escapeHtml(competitionId)}</title>
<style>
  *{box-sizing:border-box}body{margin:0;padding:32px;background:#eef2f7;color:#172b4d;font:15px/1.55 Arial,"Segoe UI",sans-serif}
  .sheet{max-width:1000px;margin:0 auto;padding:42px 48px;background:#fff;border:1px solid #d9e2ef;border-radius:12px;box-shadow:0 12px 35px #193b6417}
  .institution{text-align:center;color:#475569;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  h1{margin:12px 0 4px;text-align:center;color:#123a70;font-size:25px;letter-spacing:.04em}
  .subtitle{text-align:center;margin:0 0 28px;color:#526780;font-size:17px;font-weight:600}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin:0 0 20px;padding:16px 18px;border:1px solid #dce6f3;border-radius:8px;background:#f7faff}
  .meta strong{color:#294766}.meta span{color:#314963}
  table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #bac8da;padding:10px 9px;vertical-align:top}th{background:#eaf1fb;color:#16375f;text-align:center;font-weight:700}.center{text-align:center}
  .empty{padding:28px;text-align:center;border:1px dashed #b9c8dc;color:#60748c;border-radius:8px}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin:42px 0 0;text-align:center}.signatures strong{display:block}.signatures span{display:block;margin-top:68px;color:#64748b;font-size:13px}
  .actions{display:flex;justify-content:center;margin:22px auto 0}.actions button{border:0;border-radius:8px;padding:11px 18px;background:#1769e8;color:#fff;font:inherit;font-weight:700;cursor:pointer}
  @media print{body{padding:0;background:#fff}.sheet{max-width:none;margin:0;padding:18mm;border:0;border-radius:0;box-shadow:none}.actions{display:none}thead{display:table-header-group}tr{break-inside:avoid}}
  @media(max-width:680px){body{padding:12px}.sheet{padding:22px 16px}.meta{grid-template-columns:1fr}.signatures{gap:16px}}
</style></head><body><main class="sheet">
  <div class="institution">Công tác học thuật</div>
  <h1>PHIẾU KẾT QUẢ CUỘC THI</h1>
  <p class="subtitle">${escapeHtml(competitionName)}</p>
  <div class="meta">
    <span><strong>Mã cuộc thi:</strong> ${escapeHtml(competitionId)}</span>
    <span><strong>Số kết quả đã công bố:</strong> ${rows.length}</span>
    <span><strong>Ngày lập biểu:</strong> ${escapeHtml(createdAt)}</span>
    <span><strong>Trạng thái:</strong> Kết quả đã công bố</span>
  </div>
  ${rows.length ? `<table><thead><tr><th>STT</th><th>Thí sinh / Đội thi</th><th>MSSV</th><th>Giải thưởng</th><th>Xếp hạng</th><th>Điểm</th><th>Ghi chú</th></tr></thead><tbody>${tableRows}</tbody></table>` : `<p class="empty">Cuộc thi này chưa có kết quả được công bố.</p>`}
  <div class="signatures"><div><strong>ĐẠI DIỆN BAN TỔ CHỨC</strong><span>(Ký, ghi rõ họ tên)</span></div><div><strong>ĐẠI DIỆN KHOA</strong><span>(Ký, ghi rõ họ tên)</span></div></div>
  <div class="actions"><button type="button" onclick="window.print()">In / Lưu thành PDF</button></div>
</main></body></html>`;
}
function downloadCompetitionResultForm(rows: Row[], competition: Row | undefined, competitionId: string) {
  const blob = new Blob([competitionResultDocument(rows, competition, competitionId)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Phieu-ket-qua-cuoc-thi-${competitionId}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
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
function formatReportNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toLocaleString("vi-VN") : "0";
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

function DetailItem({ title, value }: { title: string; value: string }) {
  return <div className={s.planDetailItem}><span>{title}</span><strong>{value || "—"}</strong></div>;
}

function formatCurrency(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString("vi-VN")} đ` : String(value);
}

function annualPlanDocument(plan: Row, activities: Row[], legacyDetails: Row[]) {
  const year = label(plan, "NamHoc");
  const planTitle = label(plan, "TenKeHoach");
  const status = label(plan, "TrangThai");
  const totalBudget = activities.reduce((sum, activity) => sum + (Number(readValue(activity, "KinhPhiDuTru")) || 0), 0)
    + legacyDetails.reduce((sum, activity) => sum + (Number(readValue(activity, "DuToan")) || 0), 0);
  const committee = (activity: Row, key: string, title: string) => {
    const members = readValue(activity, key);
    if (!Array.isArray(members) || !members.length) return `<p><strong>${title}:</strong> Chưa cập nhật</p>`;
    const list = members.map((member) => {
      const person = member as Row;
      const name = [readValue(person, "HocVi"), readValue(person, "HoTen")].filter(Boolean).join(" ") || "Chưa cập nhật";
      const role = [readValue(person, "ChucDanh"), readValue(person, "ChucVu"), readValue(person, "NhiemVu")].filter(Boolean).join(" · ");
      return `<li>${escapeHtml(name)}${role ? ` - ${escapeHtml(role)}` : ""}</li>`;
    }).join("");
    return `<div class="committee"><strong>${title}</strong><ul>${list}</ul></div>`;
  };
  const activitySections = activities.map((activity, index) => {
    const start = formatDateTime(readValue(activity, "TgDuKien", "TgBatDau")) ?? "Chưa cập nhật";
    const end = formatDateTime(readValue(activity, "TgKetThuc"));
    return `<article class="activity">
      <h2>${index + 1}. ${escapeHtml(label(activity, "TenHoatDong"))}</h2>
      <table class="facts"><tbody>
        <tr><th>Loại hoạt động</th><td>${escapeHtml(label(activity, "LoaiHoatDong"))}</td><th>Năm học / học kỳ</th><td>${escapeHtml(label(activity, "NamHoc"))} / ${escapeHtml(label(activity, "HocKy"))}</td></tr>
        <tr><th>Thời gian</th><td>${escapeHtml(start)}${end ? ` - ${escapeHtml(end)}` : ""}</td><th>Địa điểm</th><td>${escapeHtml(label(activity, "DiaDiem"))}</td></tr>
        <tr><th>Đối tượng</th><td>${escapeHtml(label(activity, "DoiTuongThamDu"))}</td><th>Số lượng dự kiến</th><td>${escapeHtml(label(activity, "SLSVDuKien"))}</td></tr>
        <tr><th>Kinh phí dự trù</th><td colspan="3">${escapeHtml(formatCurrency(readValue(activity, "KinhPhiDuTru")))}</td></tr>
      </tbody></table>
      <h3>Nội dung</h3><p>${escapeHtml(readValue(activity, "NoiDung") ?? "Chưa cập nhật")}</p>
      <h3>Tiến độ thực hiện</h3><p>${escapeHtml(readValue(activity, "TienDoTH") ?? "Chưa cập nhật")}</p>
      <div class="committees">${committee(activity, "banChiDao", "Ban chỉ đạo")}${committee(activity, "banToChuc", "Ban tổ chức")}${committee(activity, "banHoTro", "Ban hỗ trợ")}</div>
    </article>`;
  }).join("");
  const legacyRows = legacyDetails.filter((detail) => !activities.some((activity) =>
    label(activity, "TenHoatDong").trim().toLocaleLowerCase("vi") === label(detail, "TenHoatDong").trim().toLocaleLowerCase("vi"),
  )).map((detail, index) => `<tr>
    <td>${index + 1}</td><td>${escapeHtml(label(detail, "TenHoatDong"))}<br/>${escapeHtml(label(detail, "NoiDung"))}</td>
    <td>${escapeHtml(formatDateTime(readValue(detail, "ThoiGianDuKien")) ?? "Chưa cập nhật")}${readValue(detail, "ThoiGianKetThuc") ? ` - ${escapeHtml(formatDateTime(readValue(detail, "ThoiGianKetThuc")) ?? "")}` : ""}</td>
    <td>${escapeHtml(label(detail, "DiaDiem"))}</td><td>${escapeHtml(formatCurrency(readValue(detail, "DuToan")))}</td>
  </tr>`).join("");
  const draftLabel = status === "Đã duyệt" ? "KẾ HOẠCH ĐÃ ĐƯỢC PHÊ DUYỆT" : `BẢN DỰ THẢO - ${status.toLocaleUpperCase("vi")}`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"/><title>Ke-hoach-hoc-thuat-${escapeHtml(year)}</title><style>
    @page{size:A4;margin:17mm 16mm}*{box-sizing:border-box}body{font-family:Arial,"Times New Roman",sans-serif;color:#172033;font-size:11pt;line-height:1.45;margin:0}h1{font-size:17pt;text-align:center;margin:24px 0 7px;text-transform:uppercase}h2{font-size:13pt;margin:18px 0 8px;color:#172e50}h3{font-size:11pt;margin:12px 0 5px}p{margin:4px 0 9px;white-space:pre-wrap}.header{display:grid;grid-template-columns:1fr 1.2fr;text-align:center;gap:20px;font-size:10pt;font-weight:bold}.header div{padding:3px}.header .sub{font-weight:normal}.status{text-align:center;font-size:10pt;font-weight:bold;color:${status === "Đã duyệt" ? "#166534" : "#a16207"};margin:8px 0}.meta{text-align:center;margin:0 0 16px}.facts{width:100%;border-collapse:collapse;margin:8px 0 12px;font-size:10pt}.facts th,.facts td{border:1px solid #788395;padding:6px;vertical-align:top}.facts th{width:17%;background:#f1f5f9;text-align:left}.activity{break-inside:avoid-page;border-top:1px solid #cbd5e1;padding-top:8px;margin-top:15px}.committees{display:grid;grid-template-columns:1fr 1fr;gap:8px}.committee{break-inside:avoid}.committee ul{margin:4px 0 10px;padding-left:20px}.legacy{width:100%;border-collapse:collapse;font-size:10pt}.legacy th,.legacy td{border:1px solid #788395;padding:6px;vertical-align:top}.legacy th{background:#f1f5f9}.signature{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center;margin-top:38px;break-inside:avoid}.signature div{min-height:105px}.signature strong{display:block;text-transform:uppercase}.signspace{height:65px}.footer{font-size:9pt;color:#526174;margin-top:22px;text-align:center}@media print{a{color:inherit;text-decoration:none}}
  </style></head><body>
    <div class="header"><div>TRƯỜNG ĐẠI HỌC CÔNG THƯƠNG<br/>THÀNH PHỐ HỒ CHÍ MINH<br/><span class="sub">${escapeHtml(label(plan, "TenKhoa"))}</span></div><div>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/><span class="sub">Độc lập - Tự do - Hạnh phúc</span></div></div>
    <h1>Kế hoạch tổ chức các hoạt động học thuật dành cho sinh viên năm học ${escapeHtml(year)}</h1>
    <p class="meta">${escapeHtml(label(plan, "SoKeHoach"))}${readValue(plan, "NgayBanHanh") ? ` · Ngày ban hành ${escapeHtml(formatDateTime(readValue(plan, "NgayBanHanh")) ?? "")}` : ""}</p>
    <div class="status">${escapeHtml(draftLabel)}</div>
    <p><strong>Tên kế hoạch:</strong> ${escapeHtml(planTitle)}</p><p><strong>Khoa:</strong> ${escapeHtml(label(plan, "TenKhoa"))}${readValue(plan, "TenBM") ? ` · Bộ môn: ${escapeHtml(label(plan, "TenBM"))}` : ""}</p>
    ${readValue(plan, "CanCu") ? `<h2>Căn cứ</h2><p>${escapeHtml(readValue(plan, "CanCu"))}</p>` : ""}
    ${(readValue(plan, "MucDich") || readValue(plan, "YeuCau")) ? `<h2>1. Mục đích, yêu cầu</h2>${readValue(plan, "MucDich") ? `<p><strong>Mục đích:</strong> ${escapeHtml(readValue(plan, "MucDich"))}</p>` : ""}${readValue(plan, "YeuCau") ? `<p><strong>Yêu cầu:</strong> ${escapeHtml(readValue(plan, "YeuCau"))}</p>` : ""}` : ""}
    ${readValue(plan, "NoiDung") ? `<h2>2. Nội dung kế hoạch</h2><p>${escapeHtml(readValue(plan, "NoiDung"))}</p>` : ""}
    <h2>${readValue(plan, "NoiDung") ? "3" : "2"}. Danh mục hoạt động học thuật đã được khoa duyệt</h2>
    ${activitySections || `<p>Chưa có hoạt động học thuật được gộp vào kế hoạch.</p>`}
    ${legacyRows ? `<h2>${readValue(plan, "NoiDung") ? "4" : "3"}. Các hạng mục khác của kế hoạch</h2><table class="legacy"><thead><tr><th>#</th><th>Hoạt động / nội dung</th><th>Thời gian</th><th>Địa điểm</th><th>Dự toán</th></tr></thead><tbody>${legacyRows}</tbody></table>` : ""}
    <h2>Kinh phí dự trù tổng hợp</h2><p><strong>Tổng dự toán các hoạt động:</strong> ${escapeHtml(formatCurrency(totalBudget))}</p>
    <div class="signature"><div><strong>TRƯỞNG KHOA</strong><div class="signspace"></div><span>Ký, ghi rõ họ tên</span></div><div><strong>PHÒNG KHCN</strong><div class="signspace"></div><span>Ký, ghi rõ họ tên</span></div><div><strong>BAN GIÁM HIỆU</strong><div class="signspace"></div><span>Ký, ghi rõ họ tên</span></div></div>
    <p class="footer">Biểu mẫu được tổng hợp từ các hoạt động học thuật đã được khoa duyệt trong hệ thống quản lý công tác học thuật.</p>
  </body></html>`;
}

function exportAnnualPlanPdf(plan: Row, activities: Row[], legacyDetails: Row[]) {
  const printWindow = window.open("", "_blank", "width=1050,height=800");
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(annualPlanDocument(plan, activities, legacyDetails));
  printWindow.document.close();
  let didPrint = false;
  const print = () => {
    if (didPrint || printWindow.closed) return;
    didPrint = true;
    printWindow.focus();
    printWindow.print();
  };
  printWindow.addEventListener("load", () => window.setTimeout(print, 200), { once: true });
  window.setTimeout(print, 800);
  return true;
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

export default function BusinessPanel({ sectionId, user, initialActivityId }: { sectionId: string; user: AuthUser; initialActivityId?: number | null; initialActivityName?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [competitionResults, setCompetitionResults] = useState<Row[] | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [trainingPointReport, setTrainingPointReport] = useState<Row[] | null>(null);
  const [trainingPointReportLoading, setTrainingPointReportLoading] = useState(false);
  const [registrationDataKind, setRegistrationDataKind] = useState<"registrations" | "waitlist" | null>(null);
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
  const [budgetYearFilter, setBudgetYearFilter] = useState("");
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
      } else if (sectionId === "expenses") {
        const [budgets, activities] = await Promise.all([
          workflowRequest<unknown>("/academic-activities/budgets"),
          workflowRequest<unknown>("/academic-activities"),
        ]);
        if (requestId === loadSequence.current) {
          setRows(Array.isArray(budgets) ? budgets as Row[] : []);
          setSecondary(Array.isArray(activities) ? activities as Row[] : []);
        }
      } else {
        const value = await workflowRequest<unknown>("/activities");
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
    setCompetitionResults(null);
    setTrainingPointReport(null);
    setTrainingPointReportLoading(false);
    setRegistrationDataKind(null);
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
      if (sectionId === "plans" && selectedId && path.startsWith(`/plans/${selectedId}/`)) {
        try {
          const refreshedPlan = await workflowRequest<unknown>(`/plans/${selectedId}`);
          setDetail(refreshedPlan && typeof refreshedPlan === "object" ? refreshedPlan as Row : null);
        } catch {
          setError("Đã lưu thay đổi, nhưng chưa tải lại được chi tiết kế hoạch. Hãy bấm Xem để tải lại.");
        }
      }
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể thực hiện thao tác.");
      return null;
    } finally { setBusy(false); }
  }

  async function selected(pathPrefix: string, id = selectedId) {
    if (!id) { setError("Hãy chọn một hoạt động trước."); return; }
    const path = `${pathPrefix}${id}`;
    setDetail(null);
    if (sectionId === "registrations") setRegistrationDataKind(path.includes("/waitlist") ? "waitlist" : "registrations");
    try {
      const value = await workflowRequest<unknown>(path);
      setDetail(value && typeof value === "object" ? value as Row : null);
      if (sectionId === "registrations" && Array.isArray(value)) {
        const firstRegistration = value.find((row) => readValue(row as Row, "MaDK") !== undefined) as Row | undefined;
        setSelectedRegistrationId(firstRegistration ? String(readValue(firstRegistration, "MaDK")) : "");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được chi tiết."); }
  }

  async function openPlan(id: string) {
    setSelectedId(id);
    setDetail(null);
    setError("");
    try {
      const canLoadActivityOptions = user.roles.some((role) => ["ADMIN", "CANBOKHOA"].includes(role.toUpperCase()));
      const [planValue, activityValue] = await Promise.all([
        workflowRequest<unknown>(`/plans/${id}`),
        canLoadActivityOptions ? workflowRequest<unknown>("/academic-activities").catch(() => []) : Promise.resolve([]),
      ]);
      const plan = planValue && typeof planValue === "object" && !Array.isArray(planValue) ? planValue as Row : null;
      if (!plan) throw new Error("Không thể tải thông tin kế hoạch.");
      const activities = Array.isArray(activityValue) ? activityValue as Row[] : [];
      const linkedActivities = readValue(plan, "hoatDongHocThuat");
      setDetail(plan);
      setApprovedActivities(activities.filter((activity) => label(activity, "TrangThai") === "Đã duyệt"));
      setSelectedApprovedActivities(Array.isArray(linkedActivities)
        ? linkedActivities.map((activity) => String(readValue(activity as Row, "MaHD"))).filter((activityId) => activityId !== "undefined")
        : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được kế hoạch.");
    }
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
  const supportRows = Array.isArray(detail) ? detail as Row[] : [];
  const seenActivityIds = new Set<string>();
  const activityOptions = rows.flatMap((row) => {
    const id = activityOptionId(row, sectionId);
    if (id === null || seenActivityIds.has(id)) return [];
    seenActivityIds.add(id);
    return [{ row, id }];
  });
  const displayRows = sectionId === "overview" ? sortByActivityTime(rows) : rows;
  const canManagePlans = user.roles.some((role) => ["ADMIN", "CANBOKHOA", "GIANGVIEN"].includes(role));
  const canSelectApprovedActivities = user.roles.some((role) => ["ADMIN", "CANBOKHOA"].includes(role.toUpperCase()));
  const canPublishPlanNews = user.roles.some((role) => ["ADMIN", "CANBOKHOA", "TRUONGKHOA", "HIEUTRUONG"].includes(role.toUpperCase()));
  const planStatus = detail ? label(detail, "TrangThai") : "";
  const planActivities = detail && Array.isArray(readValue(detail, "hoatDong")) ? readValue(detail, "hoatDong") as Row[] : [];
  const planLinkedActivities = detail && Array.isArray(readValue(detail, "hoatDongHocThuat")) ? readValue(detail, "hoatDongHocThuat") as Row[] : [];
  const visibleLegacyPlanActivities = planActivities.filter((activity) => !planLinkedActivities.some((linked) =>
    label(linked, "TenHoatDong").trim().toLocaleLowerCase("vi") === label(activity, "TenHoatDong").trim().toLocaleLowerCase("vi"),
  ));
  const planBudgetTotal = visibleLegacyPlanActivities.reduce((sum, activity) => sum + (Number(readValue(activity, "DuToan")) || 0), 0)
    + planLinkedActivities.reduce((sum, activity) => sum + (Number(readValue(activity, "KinhPhiDuTru")) || 0), 0);
  const planCandidateActivities = approvedActivities.filter((activity) => {
    if (label(activity, "TrangThai") !== "Đã duyệt") return false;
    const activityYear = readValue(activity, "NamHoc");
    if (activityYear && normalizedAcademicYear(activityYear) !== normalizedAcademicYear(readValue(detail ?? {}, "NamHoc"))) return false;
    const activityFaculty = readValue(activity, "MaKhoa");
    const planFaculty = readValue(detail ?? {}, "MaKhoa");
    if (planFaculty && String(activityFaculty ?? "") !== String(planFaculty)) return false;
    const planDepartment = readValue(detail ?? {}, "MaBM");
    if (planDepartment && String(readValue(activity, "MaBM")) !== String(planDepartment)) return false;
    const activityPlan = readValue(activity, "MaKeHoachKhoa", "MaKeHoach");
    return !activityPlan || String(activityPlan) === selectedId;
  });
  const canEditPlan = canManagePlans && ["Dự thảo", "Cần bổ sung"].includes(planStatus);
  const currentPlanStage = planApprovalStages.find((stage) => stage.status === planStatus);
  const canReviewPlan = Boolean(currentPlanStage && (user.roles.includes("ADMIN") || currentPlanStage.roles.some((role) => user.roles.includes(role))));
  const planHistory = planApprovalHistory(detail);
  const lastPlanSubmission = planHistory.map((event) => readValue(event, "action")).lastIndexOf("submit");
  const currentPlanHistory = lastPlanSubmission >= 0 ? planHistory.slice(lastPlanSubmission + 1) : planHistory;
  const planReviewEvents = currentPlanHistory.filter((event) => ["approve", "request_changes", "reject"].includes(String(readValue(event, "action"))));
  const legacyApprovedPlan = planStatus === "Đã duyệt" && !currentPlanHistory.some((event) => readValue(event, "stage") !== undefined);
  const assignableRoles = secondary.filter((role) => roleCode(role) !== "SINHVIEN");
  const budgetYears = Array.from(new Set(rows.map((row) => String(readValue(row, "NamHoc") ?? "")).filter(Boolean))).sort((a, b) => b.localeCompare(a, "vi"));
  const visibleBudgetRows = budgetYearFilter ? rows.filter((row) => String(readValue(row, "NamHoc") ?? "") === budgetYearFilter) : rows;
  const approvedBudgetRows = visibleBudgetRows.filter((row) => label(row, "TrangThaiDuTru") === "Đã duyệt");
  const canSubmitBudgets = user.roles.some((role) => ["ADMIN", "CANBOKHOA", "GIANGVIEN"].includes(role.toUpperCase()));
  const canReviewBudgets = user.roles.some((role) => ["ADMIN", "CANBOKHOA", "TRUONGKHOA"].includes(role.toUpperCase()));
  const budgetActivityOptions = secondary.flatMap((activity) => {
    const id = readValue(activity, "MaHD");
    return id === undefined ? [] : [{ id: String(id), activity }];
  });
  const budgetGroups = Array.from(visibleBudgetRows.reduce((groups, row) => {
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
    {sectionId === "expenses" && <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", justifyContent: "space-between", gap: "12px", marginBottom: "16px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "12px" }}>
        <label className={s.businessField} style={{ minWidth: "190px" }}><span>Năm học</span><select className={inputClass} value={budgetYearFilter} onChange={(event) => setBudgetYearFilter(event.target.value)}><option value="">Tất cả năm học</option>{budgetYears.map((year) => <option key={`budget-year-${year}`} value={year}>{year}</option>)}</select></label>
        <button type="button" className={`${s.primary} ${s.budgetExportButton}`} disabled={!approvedBudgetRows.length} onClick={() => downloadBudgetEstimate(approvedBudgetRows, budgetYearFilter)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>
          Tải file dự trù đã duyệt (CSV) · {approvedBudgetRows.length} khoản
        </button>
      </div>
      {canSubmitBudgets && <button className={s.primary} onClick={() => setBudgetDialogOpen(true)}>＋ Tạo khoản kinh phí hoạt động</button>}
    </div>}
    
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
      {canManagePlans && <section className={s.card}>
        <h2>Tạo kế hoạch</h2>
        <form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run("/plans", "POST", { soKeHoach: v.get("soKeHoach"), tenKeHoach: v.get("tenKeHoach"), ngayBanHanh: v.get("ngayBanHanh") || undefined, namHoc: v.get("namHoc"), hocKy: v.get("hocKy"), canCu: v.get("canCu"), mucDich: v.get("mucDich"), yeuCau: v.get("yeuCau"), noiDung: v.get("noiDung"), maKhoa: Number(v.get("maKhoa")), maBM: v.get("maBM") ? Number(v.get("maBM")) : undefined }))}>
          <Field title="Số kế hoạch" name="soKeHoach" required /><Field title="Tên kế hoạch" name="tenKeHoach" required /><Field title="Ngày ban hành" name="ngayBanHanh" type="date" /><Field title="Năm học" name="namHoc" defaultValue="2026-2027" required /><Field title="Học kỳ" name="hocKy" defaultValue="HK1" /><Field title="Mã khoa" name="maKhoa" type="number" min="1" required /><Field title="Mã bộ môn (nếu có)" name="maBM" type="number" min="1" /><Field title="Căn cứ" name="canCu" /><Field title="Mục đích" name="mucDich" /><Field title="Yêu cầu" name="yeuCau" /><Field title="Nội dung" name="noiDung" />
          <button className={s.primary} disabled={busy}>Tạo bản nháp</button>
        </form>
      </section>}
      <section className={s.card}>
        <h2>Kế hoạch đã lập</h2>{rows.length ? <div className={s.businessList}>{rows.map((row, index) => { const id = String(identifier(row, "MaKeHoach")); const status = label(row, "TrangThai"); return <article key={`plan-${id}-${index}`}><div><strong>{label(row, "TenKeHoach")}</strong><span>{label(row, "SoKeHoach")} · {label(row, "NamHoc")} · {status}</span></div><div className={s.businessActions}><button type="button" className={s.secondaryButton} onClick={() => void openPlan(id)}>Xem kế hoạch</button>{canManagePlans && ["Dự thảo", "Cần bổ sung"].includes(status) && <button type="button" className={s.secondaryButton} onClick={() => void openPlan(id)}>Chỉnh sửa</button>}</div></article>; })}</div> : <p className={s.emptyMessage}>Chưa có kế hoạch.</p>}
        {detail && readValue(detail, "TenKeHoach") !== undefined && <>
          <section className={s.planDetailCard} aria-label="Thông tin kế hoạch năm học">
            <header className={s.planDetailHeader}>
              <div><span>THÔNG TIN KẾ HOẠCH</span><h3>{label(detail, "TenKeHoach")}</h3><p>{label(detail, "SoKeHoach")} · Năm học {label(detail, "NamHoc")}</p></div>
              <span className={s.planStatusBadge}>{planStatus}</span>
            </header>
            <div className={s.planDetailGrid}>
              <DetailItem title="Mã kế hoạch" value={label(detail, "MaKeHoach")} />
              <DetailItem title="Số kế hoạch" value={label(detail, "SoKeHoach")} />
              <DetailItem title="Năm học" value={label(detail, "NamHoc")} />
              <DetailItem title="Học kỳ" value={label(detail, "HocKy")} />
              <DetailItem title="Loại kế hoạch" value={label(detail, "LoaiKeHoach")} />
              <DetailItem title="Ngày ban hành" value={formatDateTime(readValue(detail, "NgayBanHanh")) ?? "Chưa cập nhật"} />
              <DetailItem title="Khoa" value={label(detail, "TenKhoa")} />
              <DetailItem title="Bộ môn" value={label(detail, "TenBM")} />
              <DetailItem title="Mã bộ môn" value={label(detail, "MaBM")} />
              <DetailItem title="Mã cán bộ phụ trách" value={label(detail, "NgPhuTrach")} />
              <DetailItem title="Mã tài khoản duyệt" value={label(detail, "NguoiDuyet")} />
              <DetailItem title="Ngày duyệt cuối" value={formatDateTime(readValue(detail, "NgayDuyet")) ?? "Chưa duyệt"} />
              <DetailItem title="Căn cứ" value={label(detail, "CanCu")} />
              <DetailItem title="Mục đích" value={label(detail, "MucDich")} />
              <DetailItem title="Yêu cầu" value={label(detail, "YeuCau")} />
              <DetailItem title="Nội dung kế hoạch" value={label(detail, "NoiDung")} />
            </div>
          </section>
          <section className={s.planActivitiesCard} aria-label="Hoạt động và dự toán của kế hoạch">
            <header className={s.planActivitiesHeader}><div><h3>Hạng mục kế hoạch nhập trực tiếp</h3><span>{visibleLegacyPlanActivities.length} hạng mục</span></div><strong>Tổng dự toán: {formatCurrency(visibleLegacyPlanActivities.reduce((sum, activity) => sum + (Number(readValue(activity, "DuToan")) || 0), 0))}</strong></header>
            {visibleLegacyPlanActivities.length ? <div className={s.planActivityTableWrap}><table className={s.planActivityTable}>
              <thead><tr><th>Hoạt động / nội dung</th><th>Thời gian</th><th>Hạn đăng ký</th><th>Địa điểm / đối tượng</th><th>Chỉ tiêu</th><th>Người phụ trách</th><th>Dự toán</th><th>Trạng thái</th></tr></thead>
              <tbody>{visibleLegacyPlanActivities.map((activity, index) => {
                const activityId = String(readValue(activity, "MaChiTiet") ?? index);
                const start = formatDateTime(readValue(activity, "ThoiGianDuKien"));
                const end = formatDateTime(readValue(activity, "ThoiGianKetThuc"));
                const period = [start, end].filter(Boolean).join(" – ") || "Chưa cập nhật";
                const status = label(activity, "TrangThai");
                return <tr key={`plan-activity-${activityId}`}>
                  <td><strong>{label(activity, "TenHoatDong")}</strong><small>{label(activity, "NoiDung")}</small></td>
                  <td>{period}</td>
                  <td>{formatDateTime(readValue(activity, "HanDangKy")) ?? "Chưa cập nhật"}</td>
                  <td>{label(activity, "DiaDiem")}<small>{label(activity, "DoiTuong")}</small></td>
                  <td>{label(activity, "ChiTieu")}</td>
                  <td>{label(activity, "NguoiPhuTrach")}</td>
                  <td>{formatCurrency(readValue(activity, "DuToan"))}</td>
                  <td><span className={s.planActivityStatus}>{status}</span></td>
                </tr>;
              })}</tbody>
            </table></div> : <p className={s.emptyMessage}>Kế hoạch chưa có hạng mục nhập trực tiếp.</p>}
          </section>
          <div className={s.planApprovalFlow}>
            <h3>Quy trình ký duyệt kế hoạch</h3>
            <ol>{planApprovalStages.map((stage) => {
              const signed = planReviewEvents.find((event) => readValue(event, "stage") === stage.code && readValue(event, "action") === "approve");
              const current = planStatus === stage.status;
              const signer = signed ? readValue(signed, "userId") : undefined;
              const signedAt = signed ? formatDateTime(readValue(signed, "at")) : null;
              return <li key={stage.code} className={signed ? s.planApprovalDone : current ? s.planApprovalCurrent : ""}>
                <strong>{stage.title}</strong>
                <span>{signed ? `Đã ký bởi tài khoản #${String(signer ?? "—")}${signedAt ? ` · ${signedAt}` : ""}` : current ? "Đang chờ xử lý" : legacyApprovedPlan ? "Kế hoạch duyệt theo quy trình cũ; không lưu chữ ký riêng từng cấp." : "Chưa đến bước"}</span>
              </li>;
            })}</ol>
          </div>
          <section className={s.planActivitiesCard} aria-label="Chọn hoạt động học thuật đã được khoa duyệt">
            <header className={s.planActivitiesHeader}><div><h3>Gộp hoạt động học thuật đã được khoa duyệt</h3><span>{planLinkedActivities.length} hoạt động đã gộp vào kế hoạch năm học {label(detail, "NamHoc")}</span></div><strong>Tổng dự trù: {formatCurrency(planBudgetTotal)}</strong></header>
            {canSelectApprovedActivities && canEditPlan && <>
              <p>Hoạt động do giảng viên đề xuất và khoa duyệt sẽ xuất hiện bên dưới. Chọn hoạt động cùng năm học/khoa, sau đó lưu danh sách trước khi trình ký.</p>
              {planCandidateActivities.length ? <div className={s.planActivityTableWrap}><table className={s.planActivityTable}>
                <thead><tr><th>Chọn</th><th>Hoạt động / nội dung</th><th>Thời gian / địa điểm</th><th>Đối tượng / số lượng</th><th>Dự trù</th><th>Trạng thái</th></tr></thead>
                <tbody>{planCandidateActivities.map((activity) => {
                  const activityId = String(readValue(activity, "MaHD"));
                  return <tr key={`approved-plan-activity-${activityId}`}>
                    <td style={{ textAlign: "center" }}><input type="checkbox" aria-label={`Chọn ${label(activity, "TenHoatDong")}`} checked={selectedApprovedActivities.includes(activityId)} onChange={(event) => setSelectedApprovedActivities((current) => event.target.checked ? [...new Set([...current, activityId])] : current.filter((id) => id !== activityId))} /></td>
                    <td><strong>{label(activity, "TenHoatDong")}</strong><small>{label(activity, "LoaiHoatDong")} · Mã HĐ {activityId}</small><small>{label(activity, "NoiDung")}</small></td>
                    <td>{formatDateTime(readValue(activity, "TgDuKien", "TgBatDau")) ?? "Chưa cập nhật"}<small>{label(activity, "DiaDiem")}</small></td>
                    <td>{label(activity, "DoiTuongThamDu")}<small>{label(activity, "SLSVDuKien")} người dự kiến</small></td>
                    <td>{formatCurrency(readValue(activity, "KinhPhiDuTru"))}</td>
                    <td><span className={s.planActivityStatus}>{label(activity, "TrangThai")}</span></td>
                  </tr>;
                })}</tbody>
              </table></div> : <p className={s.emptyMessage}>Chưa có hoạt động đã duyệt phù hợp với khoa và năm học này.</p>}
              <button type="button" className={s.primary} disabled={busy} onClick={() => void run(`/plans/${selectedId}/activities/select`, "POST", { maHDs: selectedApprovedActivities.map(Number) }, "Đã lưu các hoạt động đã duyệt vào kế hoạch năm học.")}>Lưu danh sách hoạt động vào kế hoạch</button>
            </>}
            {planLinkedActivities.length ? <div className={s.planActivityTableWrap} style={{ marginTop: "16px" }}><table className={s.planActivityTable}>
              <thead><tr><th>Hoạt động đã gộp</th><th>Thời gian / địa điểm</th><th>Đối tượng / số lượng</th><th>Dự trù</th><th>Trạng thái duyệt</th></tr></thead>
              <tbody>{planLinkedActivities.map((activity) => {
                const activityId = String(readValue(activity, "MaHD"));
                return <tr key={`linked-plan-activity-${activityId}`}>
                  <td><strong>{label(activity, "TenHoatDong")}</strong><small>{label(activity, "LoaiHoatDong")} · Mã HĐ {activityId}</small><small>{label(activity, "NoiDung")}</small></td>
                  <td>{formatDateTime(readValue(activity, "TgDuKien", "TgBatDau")) ?? "Chưa cập nhật"}<small>{label(activity, "DiaDiem")}</small></td>
                  <td>{label(activity, "DoiTuongThamDu")}<small>{label(activity, "SLSVDuKien")} người dự kiến</small></td>
                  <td>{formatCurrency(readValue(activity, "KinhPhiDuTru"))}</td>
                  <td><span className={s.planActivityStatus}>{label(activity, "TrangThai")}</span></td>
                </tr>;
              })}</tbody>
            </table></div> : <p className={s.emptyMessage}>Chưa gộp hoạt động đã được khoa duyệt vào kế hoạch.</p>}
            <div className={s.businessActions} style={{ marginTop: "16px" }}>
              <button type="button" className={s.secondaryButton} disabled={!planLinkedActivities.length && !visibleLegacyPlanActivities.length} onClick={() => {
                if (exportAnnualPlanPdf(detail, planLinkedActivities, visibleLegacyPlanActivities)) setNotice("Đã mở bản in kế hoạch. Trong hộp thoại in, chọn ‘Save as PDF’ hoặc ‘Lưu dưới dạng PDF’ để tải tệp.");
                else setError("Trình duyệt đã chặn cửa sổ xuất PDF. Hãy cho phép cửa sổ bật lên rồi thử lại.");
              }}>Xuất kế hoạch PDF</button>
              {canPublishPlanNews && planStatus === "Đã duyệt" && <button type="button" className={s.primary} disabled={busy || !planLinkedActivities.length} onClick={async () => {
                const result = await run(`/plans/${selectedId}/publish-news`, "POST", {}, "Đã xử lý đăng thông tin kế hoạch.");
                if (result && typeof result === "object" && !Array.isArray(result)) setNotice(String(readValue(result as Row, "message") ?? "Đã xử lý đăng thông tin kế hoạch."));
              }}>Đăng thông tin lên Tin tức & thông báo</button>}
            </div>
            {planStatus !== "Đã duyệt" && <p className={s.studentProfilesHint}>Chỉ đăng tin cho sinh viên sau khi kế hoạch hoàn tất các bước ký duyệt đến Ban giám hiệu.</p>}
          </section>
          <div className={s.businessActions}>{canEditPlan && <button className={s.primary} disabled={busy || planLinkedActivities.length === 0} title={planLinkedActivities.length === 0 ? "Trước khi trình ký, hãy gộp ít nhất một hoạt động học thuật đã được khoa duyệt." : undefined} onClick={async () => { const result = await run(`/plans/${selectedId}/submit`, "POST", {}, "Kế hoạch đã được chuyển đến Trưởng khoa để ký và duyệt."); if (result) await selected("/plans/"); }}>Trình ký duyệt</button>}{canReviewPlan && currentPlanStage && <><button className={s.primary} disabled={busy} onClick={async () => { const result = await run(`/plans/${selectedId}/review`, "PATCH", { action: "approve" }, `Đã hoàn tất bước: ${currentPlanStage.title}.`); if (result) await selected("/plans/"); }}>{currentPlanStage.title}</button><button className={s.secondaryButton} disabled={busy} onClick={async () => { const result = await run(`/plans/${selectedId}/review`, "PATCH", { action: "request_changes", ghiChu: "Vui lòng bổ sung thông tin." }, "Đã yêu cầu bổ sung."); if (result) await selected("/plans/"); }}>Yêu cầu bổ sung</button></>}</div>
        </>}
      </section>
    </>}

    {activitySelect && <section className={s.card}>
      <h2>{sectionId === "competitions" || sectionId === "results" ? "Cuộc thi" : "Chọn hoạt động"}</h2>
      <div className={s.businessSelect}><select className={inputClass} value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setDetail(null); setCompetitionResults(null); setRegistrationDataKind(null); setAttendanceQr(null); setSelectedRegistrationId(""); }}><option value="">Chọn hoạt động</option>{activityOptions.map(({ row, id }) => {
        const start = formatDateTime(activityStart(row));
        const end = formatDateTime(readValue(row, "TgKetThuc", "thoiGianKetThuc", "ketThucLuc", "NgayKetThuc"));
        return <option key={`${sectionId}-${id}`} value={id}>{label(row, "TenHoatDong", "TenCuocThi")} · #{id}{start ? ` · ${start}` : ""}{end ? ` – ${end}` : ""}</option>;
      })}</select>
        {(sectionId === "registrations" || sectionId === "support") && <button className={s.secondaryButton} onClick={() => void selected(sectionId === "registrations" ? "/registrations/manage/" : "/registrations/support-assignments/")}>Tải dữ liệu</button>}
        {(sectionId === "expenses" || sectionId === "attendance") && <button className={s.secondaryButton} onClick={() => void selected(sectionId === "expenses" ? "/settlements/" : "/activities/")}>{sectionId === "expenses" ? "Tải quyết toán" : "Tải thông tin hoạt động"}</button>}
        {sectionId === "registrations" && <button className={s.secondaryButton} onClick={() => void selected("/activities/", `${selectedId}/waitlist`)}>Tải danh sách chờ</button>}
        {(sectionId === "competitions" || sectionId === "results") && <button className={s.secondaryButton} onClick={() => void selected(`/competition-rounds/`)}>Xem vòng thi</button>}
      </div>
      {selectedActivity && <p>{label(selectedActivity, "TenHoatDong", "TenCuocThi")} · Bắt đầu: {formatDateTime(activityStart(selectedActivity)) ?? "Chưa cập nhật"} · Kết thúc: {formatDateTime(readValue(selectedActivity, "TgKetThuc", "thoiGianKetThuc", "ketThucLuc", "NgayKetThuc")) ?? "Chưa cập nhật"} · {label(selectedActivity, "DiaDiem")}</p>}
      {detail && sectionId !== "results" && sectionId !== "registrations" && sectionId !== "support" && <pre className={s.jsonDetail}>{JSON.stringify(detail, null, 2)}</pre>}
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

    {sectionId === "registrations" && <section className={s.card}>
      <h2>{registrationDataKind === "waitlist" ? "Danh sách chờ đăng ký" : "Danh sách đăng ký dự thi"}</h2>
      {Array.isArray(detail) && registrationDataKind === "registrations" && <div className={s.registrationTableWrap}>
        {registrationRows.length ? <table className={s.registrationTable}>
          <thead><tr><th>Mã đăng ký</th><th>Sinh viên</th><th>Lớp</th><th>Liên hệ</th><th>Hình thức</th><th>Đội thi</th><th>Ngày đăng ký</th><th>Nguồn</th><th>Trạng thái</th></tr></thead>
          <tbody>{registrationRows.map((row, index) => {
            const id = String(readValue(row, "MaDK") ?? "");
            return <tr key={`registration-row-${id || index}`} className={selectedRegistrationId === id ? s.registrationRowSelected : undefined}>
              <td><button type="button" className={s.registrationIdButton} aria-pressed={selectedRegistrationId === id} onClick={() => setSelectedRegistrationId(id)}>{displayCode(row, index)}</button></td>
              <td><strong>{label(row, "HoTen")}</strong><small>MSSV: {label(row, "MSSV")}</small></td>
              <td>{label(row, "TenLop")}</td>
              <td>{label(row, "Email")}<small>{label(row, "SDT")}</small></td>
              <td>{label(row, "HinhThuc")}</td>
              <td>{label(row, "TenDoi")}<small>{label(row, "VaiTroDoi")}</small></td>
              <td>{formatDateTime(readValue(row, "NgayDK")) ?? "Chưa cập nhật"}</td>
              <td>{label(row, "NguonDK")}</td>
              <td><span className={s.registrationStatus}>{label(row, "TrangThai")}</span></td>
            </tr>;
          })}</tbody>
        </table> : <p className={s.emptyMessage}>Hoạt động này chưa có sinh viên đăng ký.</p>}
      </div>}
      {Array.isArray(detail) && registrationDataKind === "waitlist" && <div className={s.registrationTableWrap}>
        {registrationRows.length ? <table className={s.registrationTable}>
          <thead><tr><th>Vị trí</th><th>Sinh viên</th><th>Lớp</th><th>Đăng ký lúc</th><th>Trạng thái</th></tr></thead>
          <tbody>{registrationRows.map((row, index) => <tr key={`waitlist-row-${String(readValue(row, "MaCho") ?? index)}`}>
            <td>{label(row, "ViTri")}</td><td><strong>{label(row, "HoTen")}</strong><small>MSSV: {label(row, "MSSV")}</small></td>
            <td>{label(row, "TenLop")}</td><td>{formatDateTime(readValue(row, "DangKyLuc")) ?? "Chưa cập nhật"}</td>
            <td><span className={s.registrationStatus}>{label(row, "TrangThai")}</span></td>
          </tr>)}</tbody>
        </table> : <p className={s.emptyMessage}>Danh sách chờ hiện không có sinh viên.</p>}
      </div>}
      {registrationDataKind !== "waitlist" && <form className={s.businessForm} onSubmit={(e) => submit(e, async (v) => { const result = await run(`/registrations/${v.get("maDK")}/status`, "PATCH", { trangThai: v.get("trangThai") }); if (result) await selected("/registrations/manage/"); return result; })}>
        <label className={s.businessField}><span>Mã đăng ký · sinh viên · trạng thái</span><select className={inputClass} name="maDK" value={selectedRegistrationId} onChange={(e) => setSelectedRegistrationId(e.target.value)} required disabled={!registrationOptions.length}><option value="">{registrationOptions.length ? "Chọn đơn đăng ký" : "Tải dữ liệu đăng ký để chọn"}</option>{registrationOptions.map((row, index) => { const id = String(readValue(row, "MaDK")); return <option key={`registration-${id}-${index}`} value={id}>{displayCode(row, index)} · {label(row, "MSSV")} · {label(row, "HoTen")} · {label(row, "TrangThai")}</option>; })}</select></label>
        <label className={s.businessField}><span>Trạng thái</span><select className={inputClass} name="trangThai"><option>Đã xác nhận</option><option>Đã đăng ký</option><option>Từ chối</option><option>Đã hủy</option></select></label>
        <button className={s.primary} disabled={busy || !registrationOptions.length || !selectedRegistrationId}>Cập nhật trạng thái</button>
      </form>}
      {selectedId && registrationDataKind !== "waitlist" && <button className={s.secondaryButton} disabled={busy} onClick={() => void run(`/activities/${selectedId}/waitlist/promote-next`, "POST", {}, "Đã tiếp nhận sinh viên đầu tiên trong hàng chờ.")}>Nhận sinh viên tiếp theo</button>}
    </section>}

    {sectionId === "attendance" && selectedId && <section className={s.card}><h2>Điểm danh: {label(selectedActivity??{},"TenHoatDong")}</h2><form className={s.businessForm} onSubmit={(e)=>submit(e,async(v)=>{setAttendanceQr(null);const activityId=selectedId;const expiresAt=new Date(String(v.get("expiresAt"))).toISOString();const result=await run(`/attendance/activities/${activityId}/qr`,"POST",{expiresAt},"Đã tạo mã QR điểm danh.");if(result&&typeof result==="object"&&!Array.isArray(result)){const response=result as Row;const token=readValue(response,"maQRCode","MaQRCode");if(token!==undefined){try{const image=await QRCode.toDataURL(String(token),{errorCorrectionLevel:"H",margin:2,width:320});setAttendanceQr({image,expiresAt:String(readValue(response,"TGHetHan","expiresAt")??expiresAt),activityId});}catch{setError("Đã tạo mã nhưng chưa thể tạo ảnh QR. Vui lòng thử lại.");}}else{setError("API chưa trả về mã QR để hiển thị.");}}return result;})}><Field title="Mã QR hết hạn lúc" name="expiresAt" type="datetime-local" required/><button className={s.primary} disabled={busy}>Tạo mã QR</button></form>{attendanceQr?.activityId===selectedId&&<div className={s.attendanceQr}><strong>Quét mã bằng ứng dụng di động để điểm danh</strong><img src={attendanceQr.image} alt="Mã QR điểm danh" width={320} height={320}/><span>Mã có hiệu lực đến {formatDateTime(attendanceQr.expiresAt)??attendanceQr.expiresAt}</span><a href={attendanceQr.image} download={`diem-danh-${selectedId}.png`}>Tải mã QR</a></div>}<form className={s.businessForm} onSubmit={(e)=>submit(e,(v)=>run("/attendance/manual","POST",{maDK:Number(v.get("maDK"))},"Đã điểm danh; khoản +5 DRL đang chờ Phòng CTSV xác nhận."))}><Field title="Mã đăng ký của sinh viên" name="maDK" type="number" min="1" required/><button className={s.secondaryButton} disabled={busy}>Ghi nhận theo danh sách ký tay</button></form>{detail && attendanceQr?.activityId!==selectedId && <pre className={s.jsonDetail}>{JSON.stringify(detail,null,2)}</pre>}</section>}

    {sectionId === "support" && selectedId && <section className={s.card}><h2>Phân chỉ tiêu theo lớp</h2><form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run("/registrations/support-assignment", "POST", { maHD: Number(selectedId), maLop: Number(v.get("maLop")), soLuong: Number(v.get("soLuong")), loaiPhanCong: v.get("loaiPhanCong"), nhiemVu: v.get("nhiemVu") }))}><Field title="Mã lớp" name="maLop" type="number" min="1" required /><Field title="Số lượng" name="soLuong" type="number" min="1" required /><label className={s.businessField}><span>Phân công</span><select className={inputClass} name="loaiPhanCong"><option>Cổ vũ</option><option>Hỗ trợ</option></select></label><Field title="Nhiệm vụ" name="nhiemVu" /><button className={s.primary}>Lưu phân bổ</button></form>
      <h3>Danh sách phân công cổ vũ và hỗ trợ</h3>
      {Array.isArray(detail) && <div className={s.registrationTableWrap}>
        {supportRows.length ? <table className={s.registrationTable}>
          <thead><tr><th>Mã phân công</th><th>Lớp</th><th>Số lượng</th><th>Hình thức</th><th>Nhiệm vụ</th><th>Ngày phân công</th><th>Trạng thái</th></tr></thead>
          <tbody>{supportRows.map((row, index) => <tr key={`support-${String(readValue(row, "MaCoVu") ?? `${readValue(row, "MaLop") ?? "lop"}-${index}`)}`}>
            <td>{readValue(row, "MaCoVu") === undefined ? "—" : `PC-${String(readValue(row, "MaCoVu")).padStart(4, "0")}`}</td>
            <td><strong>{label(row, "TenLop", "MaLop")}</strong></td>
            <td>{label(row, "SoLuong")}</td>
            <td>{label(row, "LoaiPhanCong")}</td>
            <td>{label(row, "NhiemVu")}</td>
            <td>{formatDateTime(readValue(row, "NgayPhCong")) ?? "Chưa cập nhật"}</td>
            <td><span className={s.registrationStatus}>{label(row, "TrangThai")}</span></td>
          </tr>)}</tbody>
        </table> : <p className={s.emptyMessage}>Hoạt động này chưa có lớp được phân công.</p>}
      </div>}
    </section>}

    {sectionId === "training-points" && <section className={s.card}>
      <h2>Điểm rèn luyện</h2><p>Thống kê khoản ghi nhận theo học kỳ/năm học.</p>
      <button className={s.secondaryButton} disabled={trainingPointReportLoading} onClick={async () => {
        setTrainingPointReportLoading(true); setError("");
        try {
          const value = await workflowRequest<unknown>("/reports/training-points");
          if (!Array.isArray(value)) throw new Error("Dữ liệu báo cáo điểm rèn luyện trả về không đúng định dạng.");
          setTrainingPointReport(value as Row[]);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Không tải được báo cáo điểm rèn luyện.");
        } finally { setTrainingPointReportLoading(false); }
      }}>{trainingPointReportLoading ? "Đang tải báo cáo…" : "Tải báo cáo điểm"}</button>
      {trainingPointReport && <div className={s.registrationTableWrap}>
        {trainingPointReport.length ? <table className={s.registrationTable}>
          <thead><tr><th>Năm học</th><th>Học kỳ</th><th>Khoa</th><th>Bộ môn</th><th>Lượt ghi nhận</th><th>Tổng điểm cộng</th><th>Tổng điểm trừ</th><th>Điểm đã xác nhận</th></tr></thead>
          <tbody>{trainingPointReport.map((row, index) => <tr key={`training-point-report-${label(row, "NamHoc")}-${label(row, "HocKy")}-${label(row, "TenKhoa")}-${label(row, "TenBM")}-${index}`}>
            <td>{label(row, "NamHoc")}</td><td>{label(row, "HocKy")}</td><td>{label(row, "TenKhoa")}</td><td>{label(row, "TenBM")}</td>
            <td>{formatReportNumber(readValue(row, "SoLuotGhiNhan"))}</td><td>{formatReportNumber(readValue(row, "TongDiemCong"))}</td>
            <td>{formatReportNumber(readValue(row, "TongDiemTru"))}</td><td><strong>{formatReportNumber(readValue(row, "TongDiemDaXacNhan"))}</strong></td>
          </tr>)}</tbody>
        </table> : <p className={s.emptyMessage}>Chưa có dữ liệu điểm rèn luyện để tổng hợp.</p>}
      </div>}
      <form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run("/training-points", "POST", { maSV: Number(v.get("maSV")), maHD: Number(selectedId || v.get("maHD")), hocKy: v.get("hocKy"), namHoc: v.get("namHoc"), diem: Number(v.get("diem")), lyDo: v.get("lyDo") }))}><Field title="Mã sinh viên" name="maSV" type="number" min="1" required /><Field title="Mã hoạt động" name="maHD" type="number" min="1" required /><Field title="Học kỳ" name="hocKy" required /><Field title="Năm học" name="namHoc" required /><Field title="Điểm cộng/trừ" name="diem" type="number" required /><Field title="Lý do" name="lyDo" required /><button className={s.primary}>Ghi nhận chờ duyệt</button></form>
      <form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run(`/training-points/${v.get("maDiem")}/approve`, "PATCH", {}))}><Field title="Mã khoản DRL cần duyệt" name="maDiem" type="number" min="1" required /><button className={s.secondaryButton}>Duyệt khoản DRL</button></form>
    </section>}

    {sectionId === "results" && selectedId && <section className={s.card}>
      <h2>Kết quả cuộc thi</h2>
      <div className={s.businessActions}>
        <button className={s.primary} disabled={resultsLoading} onClick={async () => {
          setResultsLoading(true);
          setError("");
          try {
            const value = await workflowRequest<unknown>(`/competitions/${selectedId}/results`);
            if (!Array.isArray(value)) throw new Error("Dữ liệu kết quả trả về không đúng định dạng.");
            setCompetitionResults(value as Row[]);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Không tải được kết quả cuộc thi.");
            setCompetitionResults(null);
          } finally {
            setResultsLoading(false);
          }
        }}>{resultsLoading ? "Đang tải kết quả…" : "Xem kết quả thi"}</button>
        {competitionResults && competitionResults.length > 0 && <button type="button" className={s.secondaryButton} onClick={() => downloadCompetitionResultForm(competitionResults, selectedActivity, selectedId)}>Tải biểu mẫu kết quả</button>}
      </div>
      {competitionResults && <section className={s.competitionResultsForm} aria-label="Biểu mẫu kết quả cuộc thi">
        <div className={s.competitionResultsHeading}>
          <span>CÔNG TÁC HỌC THUẬT</span>
          <h3>PHIẾU KẾT QUẢ CUỘC THI</h3>
          <strong>{label(selectedActivity ?? {}, "TenCuocThi", "TenHoatDong")}</strong>
          <small>Mã cuộc thi: {selectedId} · {competitionResults.length} kết quả đã công bố</small>
        </div>
        {competitionResults.length ? <div className={s.competitionResultsTableWrap}><table className={s.competitionResultsTable}>
          <thead><tr><th>STT</th><th>Thí sinh / Đội thi</th><th>MSSV</th><th>Giải thưởng</th><th>Xếp hạng</th><th>Điểm</th><th>Ghi chú</th></tr></thead>
          <tbody>{competitionResults.map((result, index) => <tr key={`competition-result-${String(readValue(result, "MaKQ") ?? index)}`}>
            <td>{index + 1}</td>
            <td>{label(result, "TenDoi", "HoTen")}</td>
            <td>{label(result, "MSSV")}</td>
            <td>{label(result, "TenGT", "CapGiai", "LoaiKQ")}</td>
            <td>{label(result, "XepHang")}</td>
            <td>{label(result, "Diem")}</td>
            <td>{label(result, "GhiChu")}</td>
          </tr>)}</tbody>
        </table></div> : <p className={s.emptyMessage}>Cuộc thi này chưa có kết quả được công bố.</p>}
      </section>}
      {canManageActivities(user.roles) && <><form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run(`/competitions/${selectedId}/results`, "POST", { maDoi: v.get("maDoi") ? Number(v.get("maDoi")) : undefined, maDK: v.get("maDK") ? Number(v.get("maDK")) : undefined, maGT: v.get("maGT") ? Number(v.get("maGT")) : undefined, loaiKQ: v.get("loaiKQ"), xepHang: v.get("xepHang") ? Number(v.get("xepHang")) : undefined, diem: v.get("diem") ? Number(v.get("diem")) : undefined, ghiChu: v.get("ghiChu") }))}><Field title="Mã đội" name="maDoi" type="number" min="1" /><Field title="Mã đăng ký cá nhân" name="maDK" type="number" min="1" /><Field title="Mã giải" name="maGT" type="number" min="1" /><Field title="Loại kết quả" name="loaiKQ" /><Field title="Xếp hạng" name="xepHang" type="number" min="1" /><Field title="Điểm" name="diem" type="number" min="0" step="0.01" /><Field title="Ghi chú" name="ghiChu" /><button className={s.primary}>Tạo kết quả nháp</button></form><form className={s.businessForm} onSubmit={(e) => submit(e, (v) => run(`/competitions/results/${v.get("maKQ")}/publish`, "PATCH", {}))}><Field title="Mã kết quả để công bố" name="maKQ" type="number" min="1" required /><button className={s.secondaryButton}>Công bố kết quả</button></form></>}
    </section>}

    {sectionId === "expenses" && <section className={s.card}>
      <h2>Dự trù kinh phí theo hoạt động</h2>
      <p>Mỗi hoạt động có một hồ sơ dự trù riêng. Khoa duyệt từng hồ sơ; file tổng hợp chỉ gồm các khoản đã duyệt.</p>
      {budgetGroups.length ? <div className={s.businessList}>{budgetGroups.map(([activityId, items]) => {
        const total = items.reduce((sum, item) => sum + Number(readValue(item, "SoTien") ?? 0), 0);
        const first = items[0];
        const rawStatus = label(first, "TrangThaiDuTru");
        const status = rawStatus === "—" ? "Dự thảo" : rawStatus;
        const proposalId = Number(readValue(first, "MaHoSoDuTru", "MaDuTruKP") ?? 0);
        const canSubmit = canSubmitBudgets && (status === "Dự thảo" || status === "Từ chối");
        const canReview = canReviewBudgets && status === "Chờ duyệt" && proposalId > 0;
        return <article key={`budget-activity-${activityId}`}>
          <div>
            <strong>{label(first, "TenHoatDong")}</strong>
            <span>Mã HĐ: {activityId} · Năm học: {label(first, "NamHoc")} · {items.length} khoản · Tổng dự trù: {total.toLocaleString("vi-VN")} đồng</span>
            <span>Trạng thái: {status}{proposalId ? ` · Mã hồ sơ: DTP-${proposalId}` : ""}</span>
            {label(first, "GhiChuDuyet") !== "—" && <small>Lý do từ chối: {label(first, "GhiChuDuyet")}</small>}
            <small>{items.map((item) => `${label(item, "NoiDung")} (${Number(readValue(item, "SoTien") ?? 0).toLocaleString("vi-VN")} đồng)`).join(" · ")}</small>
          </div>
          <div className={s.businessActions}>
            {canSubmit && <button className={s.primary} disabled={busy} onClick={() => void run(`/academic-activities/${activityId}/budget/submit`, "PATCH", undefined, status === "Từ chối" ? "Đã gửi lại dự trù lên khoa duyệt." : "Đã gửi dự trù của hoạt động lên khoa duyệt.")}>{status === "Từ chối" ? "Gửi lại khoa duyệt" : "Gửi khoa duyệt"}</button>}
            {canReview && <>
              <button className={s.primary} disabled={busy} onClick={() => void run(`/academic-activities/budgets/${proposalId}/review`, "PATCH", { action: "approve" }, "Đã duyệt dự trù kinh phí hoạt động.")}>Duyệt dự trù</button>
              <button className={s.secondaryButton} disabled={busy} onClick={() => { const note = window.prompt("Lý do từ chối dự trù (không bắt buộc):"); if (note === null) return; void run(`/academic-activities/budgets/${proposalId}/review`, "PATCH", { action: "reject", ghiChu: note.trim() }, "Đã từ chối dự trù kinh phí hoạt động."); }}>Từ chối</button>
            </>}
          </div>
        </article>;
      })}</div> : <p className={s.emptyMessage}>Chưa có dữ liệu kinh phí hoạt động trong năm học đã chọn.</p>}
    </section>}

    {sectionId === "expenses" && budgetDialogOpen && <div className={s.modalOverlay} role="dialog" aria-modal="true">
      <div className={s.modalCard} style={{ maxWidth: "720px", width: "min(720px, calc(100vw - 32px))", maxHeight: "calc(100vh - 40px)", overflowY: "auto", borderRadius: "18px", boxShadow: "0 24px 70px rgba(15, 23, 42, .22)" }}>
        <div className={s.modalHeader} style={{ padding: "20px 24px", background: "linear-gradient(135deg, #eff6ff, #ffffff)" }}>
          <div><div style={{ color: "#2563eb", fontSize: "12px", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Dự trù ngân sách</div><h3 style={{ margin: "5px 0 0", fontSize: "20px", color: "#0f172a" }}>Thêm khoản cho hoạt động</h3></div>
          <button type="button" className={s.modalCloseBtn} onClick={() => setBudgetDialogOpen(false)}>✕</button>
        </div>
        <form onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const activityId = Number(form.get("maHD"));
          if (!activityId) { setError("Hãy chọn hoạt động cần lập dự trù."); return; }
          const result = await run(`/academic-activities/${activityId}/budget`, "POST", {
            noiDung: form.get("noiDung"), soLuong: form.get("soLuong") ? Number(form.get("soLuong")) : undefined,
            donViTinh: form.get("donViTinh"), donGia: form.get("donGia") ? Number(form.get("donGia")) : undefined,
            soTien: Number(form.get("soTien")), thuyetMinh: form.get("thuyetMinh"),
            nguonKinhPhi: form.get("nguonKinhPhi"), ghiChu: form.get("ghiChu"),
          }, "Đã thêm khoản dự trù. Hãy thêm các khoản khác của hoạt động rồi gửi khoa duyệt.");
          if (result) setBudgetDialogOpen(false);
        }}>
          <div className={s.modalBody} style={{ padding: "22px 24px 8px" }}>
            <label className={s.businessField}><span>Hoạt động *</span><select className={inputClass} name="maHD" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} required><option value="">Chọn hoạt động</option>{budgetActivityOptions.map(({ id, activity }) => <option key={`budget-activity-${id}`} value={id}>{id} · {label(activity, "TenHoatDong")}</option>)}</select></label>
            <Field title="Nội dung khoản kinh phí *" name="noiDung" placeholder="Ví dụ: thuê hội trường, in tài liệu..." required />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}><Field title="Số lượng" name="soLuong" type="number" min="0" step="0.01" /><Field title="Đơn vị tính" name="donViTinh" placeholder="bộ, người..." /><Field title="Đơn giá" name="donGia" type="number" min="0" step="0.01" /></div>
            <Field title="Số tiền dự trù *" name="soTien" type="number" min="0" step="0.01" required />
            <Field title="Thuyết minh" name="thuyetMinh" placeholder="Giải thích cơ sở lập khoản chi..." />
            <Field title="Nguồn kinh phí" name="nguonKinhPhi" defaultValue="Kinh phí học thuật" />
            <Field title="Ghi chú" name="ghiChu" />
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>Mỗi lần lưu thêm một khoản. Khi đã nhập đủ các khoản cho hoạt động, gửi hồ sơ lên khoa duyệt.</p>
          </div>
          <div className={s.modalFooter} style={{ padding: "16px 24px 20px", borderTop: "1px solid #eef2f7", background: "#fbfdff" }}><button type="button" className={s.secondaryButton} onClick={() => setBudgetDialogOpen(false)}>Hủy</button><button type="submit" className={s.primary} disabled={busy}>{busy ? "Đang lưu…" : "Lưu khoản kinh phí"}</button></div>
        </form>
      </div>
    </div>}

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






