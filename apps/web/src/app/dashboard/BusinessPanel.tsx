"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { workflowRequest } from "@/services/workflow";
import type { AuthUser } from "@/services/auth";
import { canApproveSettlements, canManageActivities } from "./sections";
import s from "./dashboard.module.css";
import NoticeDialog from "./NoticeDialog";

type Row = Record<string, unknown>;
type PlanUnits = { faculty: Row; departments: Row[] };
type ActivityBudgetLineForm = { maKPHD?: string; noiDung: string; soLuong: string; donViTinh: string; donGia: string; thuyetMinh: string; ghiChu: string };
const emptyActivityBudgetLine = (): ActivityBudgetLineForm => ({ noiDung: "", soLuong: "", donViTinh: "", donGia: "", thuyetMinh: "", ghiChu: "" });
const planApprovalStages = [
  { status: "Chờ Trưởng khoa ký duyệt", code: "faculty-dean", title: "Trưởng khoa ký và duyệt" , roles: ["TRUONGKHOA"] },
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
function planStatusTone(status: string) {
  if (status === "Đã duyệt") return "approved";
  if (status === "Từ chối") return "rejected";
  if (status === "Cần bổ sung") return "changes";
  if (status === "Dự thảo") return "draft";
  return "pending";
}
function planProgress(status: string) {
  if (status === "Đã duyệt" || status === "Từ chối") return 100;
  if (status === "Chờ Trưởng khoa ký duyệt") return 75;
  if (status === "Cần bổ sung") return 50;
  return 25;
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

type ActivityBudgetDisplayRow =
  | { kind: "line"; row: Row; index: number }
  | { kind: "subtotal"; round: 1 | 2; amount: number };

function activityBudgetDisplayRows(items: Row[]): ActivityBudgetDisplayRow[] {
  let currentRound: 0 | 1 | 2 = 0;
  let firstV2Index = -1;
  let hasV1 = false;
  let hasV2 = false;
  const calculatedTotals: Record<1 | 2, number> = { 1: 0, 2: 0 };

  items.forEach((row, index) => {
    const description = label(row, "NoiDung").trim().toLocaleLowerCase("vi-VN");
    if (description.startsWith("vòng 1")) {
      currentRound = 1;
      hasV1 = true;
    } else if (description.startsWith("vòng 2")) {
      currentRound = 2;
      hasV2 = true;
      if (firstV2Index < 0) firstV2Index = index;
    }
    if (currentRound) calculatedTotals[currentRound] += Number(readValue(row, "SoTien") ?? 0);
  });

  const storedTotal = (key: string, calculated: number) => {
    const stored = readValue(items[0] ?? {}, key);
    const amount = stored == null ? Number.NaN : Number(stored);
    return Number.isFinite(amount) && (amount !== 0 || calculated === 0) ? amount : calculated;
  };
  const hasTwoRounds = hasV1 && hasV2;
  const rows: ActivityBudgetDisplayRow[] = [];
  items.forEach((row, index) => {
    if (hasTwoRounds && index === firstV2Index) {
      rows.push({ kind: "subtotal", round: 1, amount: storedTotal("TongTienV1", calculatedTotals[1]) });
    }
    rows.push({ kind: "line", row, index });
  });
  if (hasTwoRounds) rows.push({ kind: "subtotal", round: 2, amount: storedTotal("TongTienV2", calculatedTotals[2]) });
  return rows;
}

function ActivityBudgetTable({ activityId, items, spaced = false }: { activityId: string; items: Row[]; spaced?: boolean }) {
  const first = items[0] ?? {};
  const total = items.reduce((sum, item) => sum + Number(readValue(item, "SoTien") ?? 0), 0);
  return <table className={`${s.budgetSummaryTable} ${s.activityBudgetTable}`} style={spaced ? { marginBottom: 18 } : undefined}>
    <thead>
      <tr>
        <th>Mã hoạt động</th><th>{activityId}</th>
        <th>Tên hoạt động</th><th>{label(first, "TenHoatDong")}</th>
        <th>Số lượng SV</th><th>{label(first, "SLSVDuKienHoatDong", "SLSinhVienHoatDong", "SLSinhVien")}</th>
      </tr>
      <tr><th>STT</th><th colSpan={2}>Nội dung</th><th>Thuyết minh</th><th>Số tiền</th><th>Ghi chú</th></tr>
    </thead>
    <tbody>{activityBudgetDisplayRows(items).map((entry) => entry.kind === "subtotal"
      ? <tr key={`round-${entry.round}-subtotal`}><td colSpan={4}><strong>Tổng tiền vòng {entry.round}</strong></td><td colSpan={2} style={{ textAlign: "right" }}><strong>{formatCurrency(entry.amount)}</strong></td></tr>
      : <tr key={`budget-line-${String(readValue(entry.row, "MaKPHD") ?? entry.index)}`}>
        <td>{entry.index + 1}</td><td colSpan={2}>{label(entry.row, "NoiDung")}</td>
        <td>{label(entry.row, "ThuyetMinh")}</td><td>{formatCurrency(readValue(entry.row, "SoTien"))}</td><td>{label(entry.row, "GhiChu")}</td>
      </tr>)}</tbody>
    <tfoot><tr><td>Nguồn</td><td colSpan={2}>{label(first, "NguonKinhPhi", "NguonKinhPhiDuTru")}</td><td>Tổng cộng</td><td>{formatCurrency(total)}</td><td></td></tr></tfoot>
  </table>;
}

function annualPlanDocument(plan: Row, activities: Row[], legacyDetails: Row[], departmentProposals: Row[] = []) {
  const year = label(plan, "NamHoc");
  const planTitle = label(plan, "TenKeHoach");
  const facultyName = String(readValue(plan, "TenKhoa") ?? "KHOA CÔNG NGHỆ THÔNG TIN");
  const planBudget = readValue(plan, "KinhPhiTC");
  const planApproverName = String(readValue(plan, "TenNguoiDuyet") ?? "").trim();
  const issuedAt = readValue(plan, "NgayBanHanh");
  const issuedDate = issuedAt ? new Date(String(issuedAt)) : null;
  const issuedDay = issuedDate && !Number.isNaN(issuedDate.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(issuedDate)
    : null;
  const issuedMonth = issuedDate && !Number.isNaN(issuedDate.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(issuedDate)
    : null;
  const issuedYear = issuedDate && !Number.isNaN(issuedDate.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(issuedDate)
    : null;
  const dateLine = issuedDate && !Number.isNaN(issuedDate.getTime())
    ? `Tp. Hồ Chí Minh, ngày ${issuedDay} tháng ${issuedMonth} năm ${issuedYear}`
    : "Tp. Hồ Chí Minh, ngày …… tháng …… năm ……";
  const committee = (activity: Row, key: string, title: string) => {
    const members = readValue(activity, key);
    const list = Array.isArray(members) ? members.map((member) => {
      const person = member as Row;
      const name = [readValue(person, "HocVi"), readValue(person, "HoTen")].filter(Boolean).join(" ") || "Chưa cập nhật";
      const role = [readValue(person, "ChucDanh"), readValue(person, "ChucVu"), readValue(person, "NhiemVu")].filter(Boolean).join(" · ");
      return "- " + escapeHtml(name) + (role ? " — " + escapeHtml(role) : "");
    }) : [];
    return `<p class="committeeTitle">- ${title}:</p><p class="bulletText">${list.length ? list.join("<br/>") : "- Chưa cập nhật"}</p>`;
  };
  const activityCandidates: Row[] = [
    ...activities,
    ...legacyDetails.map((detail) => ({
      ...detail,
      TgDuKien: readValue(detail, "TgDuKien", "TgBatDau", "ThoiGianDuKien"),
      TgKetThuc: readValue(detail, "TgKetThuc", "ThoiGianKetThuc"),
    })),
    ...departmentProposals.map((proposal) => ({
      ...proposal,
      TenHoatDong: label(proposal, "TenCuocThi", "TenHoatDong"),
    })),
  ];
  const seenActivityIds = new Set<string>();
  const namesWithoutId = new Set<string>();
  const namesWithId = new Map<string, Set<string>>();
  const allActivities = activityCandidates.filter((activity) => {
    const rawId = readValue(activity, "MaHD", "MaHoatDong");
    const id = rawId === undefined ? "" : String(rawId).trim();
    const name = label(activity, "TenHoatDong", "TenCuocThi")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("vi")
      .replace(/[^a-z0-9]/g, "");
    if (id) {
      if (seenActivityIds.has(id) || (name && namesWithoutId.has(name))) return false;
      seenActivityIds.add(id);
      if (name) {
        const ids = namesWithId.get(name) ?? new Set<string>();
        ids.add(id);
        namesWithId.set(name, ids);
      }
      return true;
    }
    if (!name) return true;
    if (namesWithoutId.has(name) || namesWithId.has(name)) return false;
    namesWithoutId.add(name);
    return true;
  });
  const dateAndTime = (value: unknown) => {
    const formatted = formatDateTime(value);
    if (!formatted) return null;
    const [date, time] = formatted.split(" · ");
    return { date, time };
  };
  const formatActivityContent = (value: unknown) => String(value ?? "—")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?=Phần\s*\d+\s*:)/gi)
    .flatMap((part) => {
      const sentences = part.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
      return sentences.map((sentence, index) => ({
        text: /^Phần\s*\d+\s*:/i.test(part) && index === 0 ? "- " + sentence : sentence,
        isPartHeading: /^Phần\s*\d+\s*:/i.test(part) && index === 0,
      }));
    })
    .map(({ text, isPartHeading }) => `<p style="text-indent:${isPartHeading ? "0" : "10mm"}">${escapeHtml(text)}</p>`)
    .join("");
  const progressLines = (value: unknown) => {
    const text = String(value ?? "").replace(/\r\n?/g, "\n").trim();
    if (!text) return [] as string[];
    const dateMatches = Array.from(text.matchAll(/\b(?:\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\s*[:：]/g));
    if (dateMatches.length) return dateMatches.map((match, index) => {
      const start = match.index ?? 0;
      const end = dateMatches[index + 1]?.index ?? text.length;
      return text.slice(start, end).trim();
    }).filter(Boolean);
    return text.split(/\n+|;\s*/g).map((line) => line.trim()).filter(Boolean);
  };
  const activitySections = allActivities.map((activity, index) => {
    const start = dateAndTime(readValue(activity, "TgDuKien", "TgBatDau", "ThoiGianDuKien"));
    const end = dateAndTime(readValue(activity, "TgKetThuc", "ThoiGianKetThuc"));
    const timeDescription = start
      ? `Dự kiến tổ chức vào ngày ${escapeHtml(start.date)}, từ ${escapeHtml(start.time)}${end ? ` đến ${escapeHtml(end.date === start.date ? end.time : `${end.date} lúc ${end.time}`)}` : ""}.`
      : "Chưa cập nhật thời gian tổ chức.";
    const progress = progressLines(readValue(activity, "TienDoTH"));
    return `<article class="activity">
      <h3 class="activityTitle">2.${index + 1}. ${escapeHtml(label(activity, "TenHoatDong"))}</h3>
      <p class="subsection">a) Nội dung:</p>${formatActivityContent(readValue(activity, "NoiDung"))}
      <p class="subsection">b) Thời gian thực hiện tổ chức:</p>
      <p class="bulletText">- ${timeDescription}<br/>- Địa điểm: ${escapeHtml(label(activity, "DiaDiem") || "—")}</p>
      ${readValue(activity, "TienDoTH") ? `<p class="subsection">c) Tiến độ thực hiện:</p><p class="bulletText">${progress.map((line) => "- " + escapeHtml(line)).join("<br/>")}</p>` : ""}
      <p class="subsection">d) Thành phần, số lượng tham dự:</p>
      <p class="bulletText">- ${escapeHtml(label(activity, "DoiTuongThamDu") || "—")}; số lượng dự kiến: ${escapeHtml(label(activity, "SLSVDuKien") || "—")}.</p>
      ${committee(activity, "banChiDao", "Ban chỉ đạo")}${committee(activity, "banToChuc", "Ban tổ chức")}${committee(activity, "banHoTro", "Ban hỗ trợ")}
    </article>`;
  }).join("");
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"/><title>Ke-hoach-hoc-thuat-${escapeHtml(year)}</title><style>
    @page{size:A4 portrait;margin:25.4mm 10mm 25.4mm 25mm}*{box-sizing:border-box}body{font-family:"Times New Roman",Times,serif;color:#111;font-size:13pt;line-height:1.3;margin:0;text-align:justify}h1,h2,h3,p{margin:0}h1{text-align:center;font-size:13pt;line-height:1.3;margin:8mm 0 1mm}h2{font-size:13pt;margin:5mm 0 2mm;text-transform:uppercase}h3{font-size:13pt;margin:3mm 0 1.5mm;font-style:normal;font-weight:bold}.activityTitle{break-after:avoid-page}p{margin:1.5mm 0;text-indent:10mm;white-space:pre-wrap}.header{display:grid;grid-template-columns:74mm minmax(0,1fr);gap:6mm;text-align:center;font-size:12pt;line-height:1.25;margin-top:8mm;width:100%}.headerBlock{display:grid;grid-template-rows:16mm auto}.headerHeading{min-height:16mm;white-space:nowrap}.header strong{display:block}.header .underline{text-decoration:underline;text-underline-offset:2px}.headerMeta{margin-top:8mm}.document-number{text-align:center;white-space:nowrap;text-indent:0}.date{text-align:center;white-space:nowrap;font-size:11pt;font-style:italic;text-indent:0}.documentContent{margin-right:10mm}.subtitle{text-align:center;font-size:13pt;font-weight:bold;text-decoration:underline;text-underline-offset:2px;margin:0 0 14mm;text-indent:0}.activity{break-inside:auto}.activityTitle{break-after:avoid-page}.activity p{margin-left:8mm;text-indent:0}.subsection{font-weight:normal;margin-top:2mm}.committee{margin:1mm 0 2mm 12mm;break-inside:avoid}.committee ul{list-style:none;margin:1mm 0 2mm 7mm;padding:0}.committee li{margin-bottom:1mm}.signature{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;text-align:center;margin-top:10mm;break-inside:avoid;font-size:13pt}.signature strong{display:block}.signspace{height:27mm}.closing{margin-top:5mm}.recipients{font-size:12pt;margin-top:6mm}.recipients p{margin:1mm 0;text-indent:0}@media print{.activity{orphans:3;widows:3}}
  </style></head><body>
    <div class="header"><div class="headerBlock"><div class="headerHeading">TRƯỜNG ĐẠI HỌC CÔNG THƯƠNG<br/>THÀNH PHỐ HỒ CHÍ MINH<strong class="underline">${escapeHtml(facultyName.toLocaleUpperCase("vi"))}</strong></div><p class="document-number headerMeta">Số: ${escapeHtml(label(plan, "SoKeHoach"))}</p></div><div class="headerBlock"><div class="headerHeading"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><strong class="underline">Độc lập – Tự do – Hạnh phúc</strong></div><p class="date headerMeta">${escapeHtml(dateLine)}</p></div></div>
    <main class="documentContent"><h1>KẾ HOẠCH</h1><p class="subtitle">${escapeHtml(planTitle)}</p>
    ${readValue(plan, "CanCu") ? `<p>${escapeHtml(readValue(plan, "CanCu"))}</p>` : ""}
    <p>${escapeHtml(facultyName)} xây dựng kế hoạch tổ chức các hoạt động học thuật năm học ${escapeHtml(year)} như sau:</p>
    <h2>1. MỤC ĐÍCH, YÊU CẦU</h2>
    ${readValue(plan, "MucDich") ? `<h3>1.1. Mục đích</h3><p>${escapeHtml(readValue(plan, "MucDich"))}</p>` : ""}
    ${readValue(plan, "YeuCau") ? `<h3>1.2. Yêu cầu</h3><p>${escapeHtml(readValue(plan, "YeuCau"))}</p>` : ""}
    <h2>2. NỘI DUNG</h2>${readValue(plan, "NoiDung") ? `<p>${escapeHtml(readValue(plan, "NoiDung"))}</p>` : ""}
    ${activitySections || `<p>Chưa có hoạt động học thuật được gộp vào kế hoạch.</p>`}
    <h2>3. TỔ CHỨC THỰC HIỆN</h2>
    <h3>3.1. Ban tổ chức</h3><p>Các Ban tổ chức triển khai hoạt động theo danh sách nhân sự được nêu tại từng hoạt động ở Mục 2.</p>
    <h3>3.2. Ban thư ký</h3><p>Ban thư ký thực hiện theo phân công của Khoa.</p>
    <h3>3.3. Kinh phí tổ chức:</h3><p>${escapeHtml(planBudget ?? "Theo bản dự trù kinh phí đính kèm")}</p>
    <p class="closing">Trên đây là kế hoạch tổ chức các hoạt động học thuật năm học ${escapeHtml(year)} của ${escapeHtml(facultyName)}.</p>
    <div class="signature"><div><strong>BAN GIÁM HIỆU</strong><div class="signspace"></div><strong>Đã ký</strong></div><div><strong>PHÒNG KHCN</strong><div class="signspace"></div><strong>Đã ký</strong></div><div><strong>TRƯỞNG KHOA</strong><div class="signspace"></div><strong>${escapeHtml(planApproverName || "Chưa cập nhật")}</strong></div></div>
    <div class="recipients"><strong><em>Nơi nhận:</em></strong><p>- Phòng KHCN;</p><p>- Trưởng khoa CNTT;</p><p>- Lưu VP.</p></div></main>
  </body></html>`;
}

function budgetEstimatePdfDocument(detail: { header: Row; lines: Row[] }) {
  const header = detail.header;
  const groups = Array.from(detail.lines.reduce((result, line) => {
    const activityId = String(readValue(line, "MaHD") ?? "");
    if (!result.has(activityId)) result.set(activityId, []);
    result.get(activityId)!.push(line);
    return result;
  }, new Map<string, Row[]>()));
  const roundDetails = (item: Row) => {
    const description = label(item, "NoiDung").trim();
    const match = /^vòng\s*([12])\s*(?:\(([^)]*)\))?\s*:\s*(.*)$/i.exec(description);
    return match ? { round: Number(match[1]) as 1 | 2, title: match[2]?.trim(), description: match[3]?.trim() || description } : null;
  };
  const totalAmount = detail.lines.reduce((sum, item) => sum + (Number(readValue(item, "SoTien")) || 0), 0);
  const sourceTotals = new Map<string, number>();
  detail.lines.forEach((line) => {
    const source = label(line, "NguonKinhPhi", "NguonKinhPhiDuTru") || "Kinh phí học thuật";
    sourceTotals.set(source, (sourceTotals.get(source) ?? 0) + (Number(readValue(line, "SoTien")) || 0));
  });
  const normalizedSource = (source: string) => source.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi-VN");
  const knownSources = ["Kinh phí học thuật", "Kinh phí sinh viên NCKH", "Kinh phí khoa"];
  const sourceRows = knownSources.map((source) => {
    const amount = Array.from(sourceTotals.entries()).reduce((sum, [name, value]) => {
      const normalized = normalizedSource(name);
      const matches = source === "Kinh phí sinh viên NCKH"
        ? normalized.includes("nckh")
        : source === "Kinh phí khoa"
          ? normalized.includes("kinh phi khoa")
          : normalized.includes("hoc thuat") || normalized.includes("academic");
      return sum + (matches ? value : 0);
    }, 0);
    return { name: source, amount };
  });
  const unclassifiedSources = Array.from(sourceTotals.entries()).filter(([name]) => {
    const normalized = normalizedSource(name);
    return !normalized.includes("nckh") && !normalized.includes("sinh vien")
      && !normalized.includes("kinh phi khoa")
      && !normalized.includes("hoc thuat") && !normalized.includes("academic");
  }).map(([name, amount]) => ({ name, amount }));
  const aggregateRows = [
    `<tr class="grandTotal"><th colspan="3">Tổng cộng các hoạt động</th><td>Mã HĐ: ${escapeHtml(groups.map(([activityId]) => activityId).join(" + ") || "—")}</td><td><strong>${formatCurrency(totalAmount)}</strong></td><td></td></tr>`,
    ...[...sourceRows, ...unclassifiedSources].map(({ name, amount }) => `<tr class="sourceTotal"><th colspan="3">${escapeHtml(name)}</th><td></td><td><strong>${formatCurrency(amount)}</strong></td><td></td></tr>`),
  ].join("");
  const activityTables = groups.map(([activityId, items]) => {
    const first = items[0] ?? {};
    const total = items.reduce((sum, item) => sum + (Number(readValue(item, "SoTien")) || 0), 0);
    const roundTotals = new Map<1 | 2, number>();
    items.forEach((item) => {
      const round = roundDetails(item)?.round;
      if (round) roundTotals.set(round, (roundTotals.get(round) ?? 0) + (Number(readValue(item, "SoTien")) || 0));
    });
    let currentRound: 1 | 2 | null = null;
    const rows = items.map((item, index) => {
      const roundInfo = roundDetails(item);
      const rowsBeforeLine = roundInfo && roundInfo.round !== currentRound
        ? `<tr class="roundTotal"><th colspan="3">Vòng ${roundInfo.round}${roundInfo.title ? ` (${escapeHtml(roundInfo.title)})` : roundInfo.round === 1 ? " (Sơ khảo)" : " (Chung kết)"}</th><td></td><td><strong>${formatCurrency(roundTotals.get(roundInfo.round) ?? 0)}</strong></td><td></td></tr>`
        : "";
      if (roundInfo) currentRound = roundInfo.round;
      const description = roundInfo?.description ?? label(item, "NoiDung");
      return `${rowsBeforeLine}<tr><td>${index + 1}</td><td colspan="2">${escapeHtml(description)}</td><td>${escapeHtml(label(item, "ThuyetMinh") || "—")}</td><td>${formatCurrency(readValue(item, "SoTien"))}</td><td>${escapeHtml(label(item, "GhiChu") || "—")}</td></tr>`;
    }).join("");
    const sources = Array.from(new Set(items.map((item) => label(item, "NguonKinhPhi", "NguonKinhPhiDuTru")).filter(Boolean)));
    return `<section class="activity"><table class="activityTable"><colgroup><col/><col/><col/><col/><col/><col/></colgroup><thead>
      <tr><th>Mã HĐ</th><td>${escapeHtml(activityId)}</td><th>Tên hoạt động</th><td>${escapeHtml(label(first, "TenHoatDong"))}</td><th>Số lượng sinh viên</th><td>${escapeHtml(label(first, "SLSVDuKienHoatDong", "SLSinhVienHoatDong", "SLSinhVien") || "—")}</td></tr>
      <tr><th>STT</th><th colspan="2">Nội dung</th><th>Thuyết minh</th><th>Số tiền</th><th>Ghi chú</th></tr>
    </thead><tbody>${rows}</tbody><tfoot>
      <tr><th>Nguồn</th><td colspan="2">${escapeHtml(sources.join(", ") || "Kinh phí học thuật")}</td><th>Tổng cộng</th><td><strong>${formatCurrency(total)}</strong></td><td></td></tr>
    </tfoot></table></section>`;
  }).join("");
  const createdAtTimestamp = timestamp(readValue(header, "NgayLap"));
  const createdAt = createdAtTimestamp === null ? new Date() : new Date(createdAtTimestamp);
  const dateLine = `Tp. Hồ Chí Minh, ngày ${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(createdAt)} tháng ${new Intl.DateTimeFormat("vi-VN", { month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(createdAt)} năm ${new Intl.DateTimeFormat("vi-VN", { year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(createdAt)}`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"/><title>Du-tru-kinh-phi-${escapeHtml(label(header, "MaDuTruKP"))}</title>
    <style>
      @page{size:A4 portrait;margin:25.4mm 15mm}*{box-sizing:border-box}body{font-family:"Times New Roman",Times,serif;color:#111;font-size:12pt;line-height:1.25;margin:0}
      .letterhead{display:grid;grid-template-columns:1fr 1fr;gap:5mm;text-align:center;line-height:1.25}.letterhead strong{display:block}.faculty{text-decoration:underline;text-underline-offset:2px}.documentNumber,.dateLine{margin-top:7mm;white-space:nowrap}.dateLine{font-style:italic;font-size:11pt}.title{text-align:center;font-size:13pt;font-weight:bold;text-transform:uppercase;margin:9mm 0 1mm}.year{text-align:center;margin:0 0 6mm}
      table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 5mm}col:nth-child(1){width:8.8%}col:nth-child(2){width:10.6%}col:nth-child(3){width:19.3%}col:nth-child(4){width:35.3%}col:nth-child(5){width:16.3%}col:nth-child(6){width:9.7%}
      th,td{border:1px solid #111;padding:4px 5px;text-align:left;vertical-align:top;overflow-wrap:anywhere;font-size:12pt}th{font-weight:bold}.roundTotal th{font-weight:normal}.roundTotal td,.grandTotal td,.grandTotal th,.sourceTotal td,.sourceTotal th{font-weight:bold}.aggregateTable{margin-top:3mm}.signatures{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:2mm;margin-top:16mm;text-align:center;break-inside:avoid}.signatures strong{font-size:12pt}.signatureGap{height:22mm}.signatureNote{font-size:10pt;font-style:italic}
      @media print{thead{display:table-header-group}tfoot{display:table-row-group}tr{break-inside:avoid}.activityTable{break-inside:auto}.signatures{break-inside:avoid}}
    </style></head><body>
      <div class="letterhead"><div><div>TRƯỜNG ĐẠI HỌC CÔNG THƯƠNG<br/>THÀNH PHỐ HỒ CHÍ MINH</div><strong class="faculty">KHOA CÔNG NGHỆ THÔNG TIN</strong><p class="documentNumber">Số: ${escapeHtml(label(header, "MaDuTruKP"))}</p></div><div><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><strong class="faculty">Độc lập – Tự do – Hạnh phúc</strong><p class="dateLine">${escapeHtml(dateLine)}</p></div></div>
      <h1 class="title">${escapeHtml(label(header, "TenTieuDe") || "Dự trù kinh phí hoạt động học thuật")}</h1>
      <p class="year">Năm học: ${escapeHtml(label(header, "NamHoc"))}</p>
      ${activityTables || "<p>Hồ sơ chưa có khoản kinh phí hoạt động.</p>"}
      ${groups.length ? `<table class="aggregateTable"><colgroup><col/><col/><col/><col/><col/><col/></colgroup><tbody>${aggregateRows}</tbody></table>` : ""}
      <div class="signatures"><div><strong>Hiệu trưởng</strong><div class="signatureGap"></div></div><div><strong>Phòng KHTC</strong><div class="signatureGap"></div></div><div><strong>Phòng KHCN</strong><div class="signatureGap"></div></div><div><strong>Khoa CNTT</strong><div class="signatureGap"></div></div><div><strong>Người lập bảng</strong><div class="signatureGap"></div></div></div>
    </body></html>`;
}

function printBudgetEstimatePdf(printWindow: Window, detail: { header: Row; lines: Row[] }) {
  printWindow.document.open();
  printWindow.document.write(budgetEstimatePdfDocument(detail));
  printWindow.document.close();
  let didPrint = false;
  const print = () => {
    if (didPrint || printWindow.closed) return;
    didPrint = true;
    printWindow.focus();
    printWindow.print();
  };
  printWindow.addEventListener("load", print, { once: true });
  window.setTimeout(print, 300);
}

function exportAnnualPlanPdf(plan: Row, activities: Row[], legacyDetails: Row[], departmentProposals: Row[] = []) {
  const printWindow = window.open("", "_blank", "width=1050,height=800");
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(annualPlanDocument(plan, activities, legacyDetails, departmentProposals));
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
        {passwordMismatch && <p className={s.error}>Hai mật khẩu nhập lại không khớp.</p>}
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
  const [planUnits, setPlanUnits] = useState<PlanUnits | null>(null);
  const [selectedApprovedActivities, setSelectedApprovedActivities] = useState<string[]>([]);
  const [newPlanAcademicYear, setNewPlanAcademicYear] = useState("2026-2027");
  const [activityYearFilter, setActivityYearFilter] = useState("");
  const [planCreateOpen, setPlanCreateOpen] = useState(false);
  const [planSearch, setPlanSearch] = useState("");
  const [planYearFilter, setPlanYearFilter] = useState("");
  const [planStatusFilter, setPlanStatusFilter] = useState("");
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetDetailActivityId, setBudgetDetailActivityId] = useState<string | null>(null);
  const [budgetEstimates, setBudgetEstimates] = useState<Row[]>([]);
  const [budgetEstimateNextId, setBudgetEstimateNextId] = useState(1);
  const [budgetEstimateDetail, setBudgetEstimateDetail] = useState<{ header: Row; lines: Row[] } | null>(null);
  const [budgetEditingActivityId, setBudgetEditingActivityId] = useState<string | null>(null);
  const [budgetLines, setBudgetLines] = useState<ActivityBudgetLineForm[]>([emptyActivityBudgetLine()]);
  const [budgetRemovedLineIds, setBudgetRemovedLineIds] = useState<string[]>([]);
  const [budgetSource, setBudgetSource] = useState("Kinh phí học thuật");
  const [budgetYearFilter, setBudgetYearFilter] = useState("");
  const [budgetDialogYear, setBudgetDialogYear] = useState("");
  const [budgetTitle, setBudgetTitle] = useState("");
  const expenseAutoOpenedActivity = useRef<string | null>(null);
  const loadSequence = useRef(0);
  const planDetailAnchor = useRef<HTMLDivElement>(null);
  const academicCoordinatorPosition = user.roles.some((role) => role.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toUpperCase() === "TRUONGBANHOCTHUAT")
    || (user.position ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toUpperCase().includes("TRUONGBANHOCTHUAT");
  const academicCoordinator = academicCoordinatorPosition || user.roles.some((role) => role.toUpperCase() === "ADMIN");
  const facultyDean = user.roles.some((role) => role.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toUpperCase() === "TRUONGKHOA")
    || (user.position ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toUpperCase().startsWith("TRUONGKHOA");

  const load = useCallback(async () => {
    const requestId = ++loadSequence.current;
    setError("");
    setProfileLoadError("");
    try {
      if (sectionId === "plans") {
        const canLoadActivityOptions = academicCoordinatorPosition || user.roles.some((role) => ["ADMIN", "CANBOKHOA", "TRUONGKHOA"].includes(role.toUpperCase()));
        const [value, units, activities] = await Promise.all([
          workflowRequest<unknown>("/plans"),
          workflowRequest<PlanUnits>("/plans/units"),
          canLoadActivityOptions ? workflowRequest<unknown>("/academic-activities").catch((cause) => {
            if (requestId === loadSequence.current) setError(cause instanceof Error ? cause.message : "Không tải được các hoạt động do Phụ trách bộ môn chuyển lên.");
            return [];
          }) : Promise.resolve([]),
        ]);
        if (requestId === loadSequence.current) {
          setRows(Array.isArray(value) ? value as Row[] : []);
          setPlanUnits(units);
          setApprovedActivities((Array.isArray(activities) ? activities as Row[] : []).filter((activity) => ["Chờ khoa", "Đã duyệt"].includes(label(activity, "TrangThaiDeXuatBoMon"))));
        }
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
      } else if (["expenses", "budget-estimates"].includes(sectionId)) {
        const includeAllBudgets = sectionId === "budget-estimates" && academicCoordinatorPosition;
        const [budgets, activities, estimates, estimateNextId] = await Promise.all([
          workflowRequest<unknown>(`/academic-activities/budgets${includeAllBudgets ? "?includeAll=1" : ""}`),
          workflowRequest<unknown>("/academic-activities").catch(() => []),
          sectionId === "budget-estimates" ? workflowRequest<unknown>("/academic-activities/budget-estimates") : Promise.resolve([]),
          sectionId === "budget-estimates" ? workflowRequest<{ nextId?: number }>("/academic-activities/budget-estimates/next-id") : Promise.resolve({ nextId: 1 }),
        ]);
        if (requestId === loadSequence.current) {
          setRows(Array.isArray(budgets) ? budgets as Row[] : []);
          setSecondary(Array.isArray(activities) ? activities as Row[] : []);
          setBudgetEstimates(Array.isArray(estimates) ? estimates as Row[] : []);
          setBudgetEstimateNextId(Number(estimateNextId.nextId ?? 1));
        }
      } else if (sectionId === "actual-expenses") {
        const activities = await workflowRequest<unknown>("/academic-activities");
        if (requestId === loadSequence.current) {
          setRows(Array.isArray(activities) ? activities as Row[] : []);
          setSecondary([]);
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
        if (sectionId === "plans") setPlanUnits(null);
        setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu.");
        setRows([]);
      }
    }
  }, [sectionId, academicCoordinatorPosition]);

  useEffect(() => {
    setDetail(null);
    setCompetitionResults(null);
    setTrainingPointReport(null);
    setTrainingPointReportLoading(false);
    setRegistrationDataKind(null);
    setAttendanceQr(null);
    setSelectedId("");
    setSelectedRegistrationId("");
    setBudgetDialogOpen(false);
    setBudgetDetailActivityId(null);
    setBudgetEstimateDetail(null);
    setNotice("");
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => { active = false; };
  }, [load]);

  useEffect(() => {
    if (sectionId !== "expenses" || !initialActivityId) {
      expenseAutoOpenedActivity.current = null;
    }
    if (sectionId === "expenses" && initialActivityId) {
      const id = String(initialActivityId);
      setSelectedId(id);
      const activity = secondary.find((row) => String(readValue(row, "MaHD") ?? "") === id);
      if (!activity) return;
      setBudgetDialogYear(String(readValue(activity, "NamHoc") ?? ""));
      setBudgetDetailActivityId(id);
      if (expenseAutoOpenedActivity.current !== id && ["Dự thảo", "Từ chối"].includes(label(activity, "TrangThai"))) {
        expenseAutoOpenedActivity.current = id;
        setBudgetEditingActivityId(null);
        setBudgetRemovedLineIds([]);
        setBudgetSource("Kinh phí học thuật");
        setBudgetLines([emptyActivityBudgetLine()]);
        setBudgetDialogOpen(true);
      }
    }
    if (sectionId === "actual-expenses" && initialActivityId) {
      const id = String(initialActivityId);
      setSelectedId(id);
      void workflowRequest<unknown>(`/settlements/${id}`).then((value) => setDetail(value && typeof value === "object" ? value as Row : null)).catch(() => undefined);
    }
  }, [sectionId, initialActivityId, secondary]);

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

  async function deletePlan(id: string, title: string) {
    if (!window.confirm(`Bạn có chắc muốn xóa kế hoạch “${title}”?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await workflowRequest<unknown>(`/plans/${id}`, { method: "DELETE" });
      if (selectedId === id) { setSelectedId(""); setDetail(null); }
      setNotice("Đã xóa kế hoạch.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xóa kế hoạch.");
    } finally { setBusy(false); }
  }

  function openNewActivityBudget() {
    setBudgetEditingActivityId(null);
    setBudgetRemovedLineIds([]);
    setBudgetLines([emptyActivityBudgetLine()]);
    setBudgetSource("Kinh phí học thuật");
    setSelectedId("");
    setBudgetDialogYear("");
    setBudgetDialogOpen(true);
  }

  function openEditActivityBudget(activityId: string, items: Row[]) {
    const first = items[0];
    setBudgetEditingActivityId(activityId);
    setBudgetRemovedLineIds([]);
    setSelectedId(activityId);
    setBudgetDialogYear(String(readValue(first, "NamHoc") ?? ""));
    setBudgetSource(String(readValue(first, "NguonKinhPhi", "NguonKinhPhiDuTru") ?? "Kinh phí học thuật"));
    setBudgetLines(items.map((line) => ({
      maKPHD: String(readValue(line, "MaKPHD") ?? ""),
      noiDung: String(readValue(line, "NoiDung") ?? ""),
      soLuong: String(readValue(line, "SoLuong") ?? ""),
      donViTinh: String(readValue(line, "DonViTinh") ?? ""),
      donGia: String(readValue(line, "DonGia") ?? ""),
      thuyetMinh: String(readValue(line, "ThuyetMinh") ?? ""),
      ghiChu: String(readValue(line, "GhiChu") ?? ""),
    })));
    setBudgetDialogOpen(true);
  }

  function closeActivityBudgetDialog() {
    setBudgetDialogOpen(false);
    setBudgetEditingActivityId(null);
    setBudgetRemovedLineIds([]);
  }

  async function saveActivityBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const activityId = Number(form.get("maHD") ?? selectedId);
    if (!activityId) {
      setError("Hãy chọn hoạt động ở trạng thái Dự thảo hoặc Từ chối.");
      return;
    }
    if (!budgetLines.length || budgetLines.some((line) => !line.noiDung.trim() || !line.soLuong || !line.donGia)) {
      setError("Hãy nhập đủ nội dung, số lượng và đơn giá cho ít nhất một dòng.");
      return;
    }

    const isEditing = budgetEditingActivityId !== null;
    const source = String(form.get("nguonKinhPhi") ?? "Kinh phí học thuật");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      for (const line of budgetLines) {
        const soLuong = Number(line.soLuong);
        const donGia = Number(line.donGia);
        const body = {
          noiDung: line.noiDung.trim(),
          soLuong,
          donViTinh: line.donViTinh,
          donGia,
          soTien: soLuong * donGia,
          thuyetMinh: line.thuyetMinh,
          nguonKinhPhi: source,
          ghiChu: line.ghiChu,
        };
        if (isEditing && line.maKPHD) {
          await workflowRequest(`/academic-activities/budgets/lines/${line.maKPHD}`, { method: "PATCH", body });
        } else {
          await workflowRequest(`/academic-activities/${activityId}/budget`, { method: "POST", body });
        }
      }
      if (isEditing) {
        for (const lineId of budgetRemovedLineIds) {
          await workflowRequest(`/academic-activities/budgets/lines/${lineId}`, { method: "DELETE" });
        }
      }
      setNotice(isEditing ? "Đã cập nhật kinh phí hoạt động." : `Đã lưu ${budgetLines.length} khoản kinh phí hoạt động.`);
      setBudgetDialogOpen(false);
      setBudgetEditingActivityId(null);
      setBudgetRemovedLineIds([]);
      setBudgetLines([emptyActivityBudgetLine()]);
      setBudgetSource("Kinh phí học thuật");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu kinh phí hoạt động.");
    } finally {
      setBusy(false);
    }
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
    setNotice("Đang tải kế hoạch…");
    try {
      const canLoadActivityOptions = academicCoordinatorPosition || user.roles.some((role) => ["ADMIN", "CANBOKHOA", "TRUONGKHOA"].includes(role.toUpperCase()));
      const [planValue, activityValue] = await Promise.all([
        workflowRequest<unknown>(`/plans/${id}`),
        canLoadActivityOptions ? workflowRequest<unknown>("/academic-activities").catch((cause) => {
          setError(cause instanceof Error ? cause.message : "Không tải được các hoạt động do Phụ trách bộ môn chuyển lên.");
          return [];
        }) : Promise.resolve([]),
      ]);
      const plan = planValue && typeof planValue === "object" && !Array.isArray(planValue) ? planValue as Row : null;
      if (!plan) throw new Error("Không thể tải thông tin kế hoạch.");
      const activities = Array.isArray(activityValue) ? activityValue as Row[] : [];
      const linkedActivities = readValue(plan, "hoatDongHocThuat");
      setDetail(plan);
      setNewPlanAcademicYear(String(readValue(plan, "NamHoc") ?? newPlanAcademicYear));
      setApprovedActivities(activities.filter((activity) => ["Chờ khoa", "Đã duyệt"].includes(label(activity, "TrangThaiDeXuatBoMon"))));
      setSelectedApprovedActivities(Array.isArray(linkedActivities)
        ? linkedActivities.map((activity) => String(readValue(activity as Row, "MaHD"))).filter((activityId) => activityId !== "undefined")
        : []);
      setNotice("");
      window.setTimeout(() => planDetailAnchor.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (cause) {
      setNotice("");
      setError(cause instanceof Error ? `Không tải được kế hoạch #${id}: ${cause.message}` : `Không tải được kế hoạch #${id}.`);
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
    }
  }

  async function exportApprovedPlan(id: string) {
    const printWindow = window.open("", "_blank", "width=1050,height=800");
    if (!printWindow) { setError("Trình duyệt đã chặn cửa sổ xuất PDF."); return; }
    try {
      const value = await workflowRequest<unknown>(`/plans/${id}`);
      const plan = value && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
      if (!plan || label(plan, "TrangThai") !== "Đã duyệt") throw new Error("Chỉ xuất được kế hoạch đã duyệt.");
      const linked = Array.isArray(readValue(plan, "hoatDongHocThuat")) ? readValue(plan, "hoatDongHocThuat") as Row[] : [];
      const legacy = Array.isArray(readValue(plan, "hoatDong")) ? readValue(plan, "hoatDong") as Row[] : [];
      printWindow.document.open();
      const departmentProposals = Array.isArray(readValue(plan, "deXuatBoMon")) ? readValue(plan, "deXuatBoMon") as Row[] : [];
      printWindow.document.write(annualPlanDocument(plan, linked, legacy, departmentProposals));
      printWindow.document.close();
      let printed = false;
      const print = () => { if (!printed && !printWindow.closed) { printed = true; printWindow.print(); } };
      printWindow.addEventListener("load", () => window.setTimeout(print, 200), { once: true });
      window.setTimeout(print, 800);
      setNotice("Đã mở bản in kế hoạch. Chọn Lưu dưới dạng PDF để tải tệp.");
    } catch (cause) {
      printWindow.close();
      setError(cause instanceof Error ? cause.message : "Không xuất được kế hoạch.");
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

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const facultyId = readValue(planUnits?.faculty ?? {}, "MaKhoa");
    if (!facultyId) {
      setError("Chưa tải được thông tin Khoa Công nghệ thông tin. Hãy tải lại trang.");
      return;
    }
    const values = new FormData(event.currentTarget);
    const created = await run("/plans", "POST", {
      soKeHoach: values.get("soKeHoach"), tenKeHoach: values.get("tenKeHoach"),
      ngayBanHanh: values.get("ngayBanHanh") || undefined,
      namHoc: values.get("namHoc"), kinhPhiTC: values.get("kinhPhiTC"),
      canCu: values.get("canCu"), mucDich: values.get("mucDich"),
      yeuCau: values.get("yeuCau"), noiDung: values.get("noiDung"),
      maKhoa: Number(facultyId),
    }, "Đã tạo bản nháp kế hoạch của Khoa Công nghệ thông tin.");
    const planId = created && typeof created === "object" && !Array.isArray(created)
      ? readValue(created as Row, "maKeHoach", "MaKeHoach")
      : undefined;
    if (planId) setPlanCreateOpen(false);
    const eligibleSelectedActivities = selectedApprovedActivities.filter((id) => planCandidateActivities.some((activity) => String(readValue(activity, "MaHD")) === id && normalizedAcademicYear(readValue(activity, "NamHoc")) === normalizedAcademicYear(newPlanAcademicYear)));
    if (planId && eligibleSelectedActivities.length) {
      const linked = await run(`/plans/${planId}/activities/select`, "POST", { maHDs: eligibleSelectedActivities.map(Number) }, "Đã tạo kế hoạch và gộp các đề xuất của bộ môn đã chọn.");
      if (linked) await openPlan(String(planId));
    } else if (planId) {
      await openPlan(String(planId));
    }
  }

  function exportPlanData() {
    const columns = ["Số kế hoạch", "Tên kế hoạch", "Năm học", "Trạng thái", "Kinh phí tổ chức"];
    const content = [columns, ...visiblePlanRows.map((row) => [
      label(row, "SoKeHoach"), label(row, "TenKeHoach"), label(row, "NamHoc"), label(row, "TrangThai"), label(row, "KinhPhiTC"),
    ])].map((line) => line.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "danh-muc-ke-hoach-hoc-thuat.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const activitySelect = sectionId !== "plans" && sectionId !== "seminars" && sectionId !== "news" && sectionId !== "reports" && sectionId !== "overview" && sectionId !== "expenses" && sectionId !== "budget-estimates" && sectionId !== "actual-expenses";
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
  const canManagePlans = academicCoordinator;
  const canCreatePlans = canManagePlans && !facultyDean;
  const canSelectApprovedActivities = academicCoordinator;
  const planAcademicYears = Array.from(new Set(rows.map((row) => String(readValue(row, "NamHoc") ?? "")).filter(Boolean))).sort((a, b) => b.localeCompare(a, "vi"));
  const visiblePlanRows = rows.filter((row) => {
    const haystack = [readValue(row, "SoKeHoach"), readValue(row, "TenKeHoach"), readValue(row, "MaKeHoach"), readValue(row, "NamHoc")].join(" ").toLocaleLowerCase("vi");
    const status = label(row, "TrangThai");
    return (!planSearch.trim() || haystack.includes(planSearch.trim().toLocaleLowerCase("vi")))
      && (!planYearFilter || normalizedAcademicYear(readValue(row, "NamHoc")) === normalizedAcademicYear(planYearFilter))
      && (!planStatusFilter || status === planStatusFilter);
  });
  const approvedPlanCount = rows.filter((row) => label(row, "TrangThai") === "Đã duyệt").length;
  const pendingPlanCount = rows.filter((row) => /chờ|cần bổ sung/i.test(label(row, "TrangThai"))).length;
  const totalPlanBudget = rows.reduce((total, row) => total + (Number(readValue(row, "KinhPhiTC")) || 0), 0);
  const planStatus = detail ? label(detail, "TrangThai") : "";
  const planActivities = detail && Array.isArray(readValue(detail, "hoatDong")) ? readValue(detail, "hoatDong") as Row[] : [];
  const planLinkedActivities = detail && Array.isArray(readValue(detail, "hoatDongHocThuat")) ? readValue(detail, "hoatDongHocThuat") as Row[] : [];
  const visibleLegacyPlanActivities = planActivities.filter((activity) => !planLinkedActivities.some((linked) =>
    label(linked, "TenHoatDong").trim().toLocaleLowerCase("vi") === label(activity, "TenHoatDong").trim().toLocaleLowerCase("vi"),
  ));
  const planCandidateActivities = approvedActivities.filter((activity) => {
    if (!["Chờ khoa", "Đã duyệt"].includes(label(activity, "TrangThaiDeXuatBoMon"))) return false;
    const activityYear = readValue(activity, "NamHoc");
    const targetYear = detail ? readValue(detail, "NamHoc") : activityYearFilter;
    if (targetYear && activityYear && normalizedAcademicYear(activityYear) !== normalizedAcademicYear(targetYear)) return false;
    const activityFaculty = readValue(activity, "MaKhoa");
    const planFaculty = readValue(detail ?? {}, "MaKhoa") ?? readValue(planUnits?.faculty ?? {}, "MaKhoa");
    if (planFaculty && String(activityFaculty ?? "") !== String(planFaculty)) return false;
    const activityPlan = readValue(activity, "MaKeHoachKhoa", "MaKeHoach");
    return !activityPlan;
  });
  const selectablePlanCandidateActivities = planCandidateActivities.filter((activity) =>
    normalizedAcademicYear(readValue(activity, "NamHoc")) === normalizedAcademicYear(detail ? readValue(detail, "NamHoc") : newPlanAcademicYear),
  );
  const activityAcademicYears = Array.from(new Set(approvedActivities.map((activity) => String(readValue(activity, "NamHoc") ?? "")).filter(Boolean))).sort((a, b) => b.localeCompare(a, "vi"));
  const canEditPlan = canManagePlans && ["Dự thảo", "Cần bổ sung"].includes(planStatus);
  const currentPlanStage = planApprovalStages.find((stage) => stage.status === planStatus);
  const canReviewPlan = Boolean(currentPlanStage && (user.roles.includes("ADMIN") || currentPlanStage.roles.some((role) => user.roles.includes(role))));
  const planHistory = planApprovalHistory(detail);
  const lastPlanSubmission = planHistory.map((event) => readValue(event, "action")).lastIndexOf("submit");
  const currentPlanHistory = lastPlanSubmission >= 0 ? planHistory.slice(lastPlanSubmission + 1) : planHistory;
  const planReviewEvents = currentPlanHistory.filter((event) => ["approve", "request_changes", "reject"].includes(String(readValue(event, "action"))));
  const legacyApprovedPlan = planStatus === "Đã duyệt" && !currentPlanHistory.some((event) => readValue(event, "stage") !== undefined);
  const activePlanSummary = detail && readValue(detail, "TenKeHoach") !== undefined
    ? detail
    : rows.find((row) => String(readValue(row, "MaKeHoach")) === selectedId) ?? visiblePlanRows[0] ?? null;
  const activePlanSummaryStatus = activePlanSummary ? label(activePlanSummary, "TrangThai") : "";
  const activePlanSubmitted = !["", "Dự thảo", "Cần bổ sung"].includes(activePlanSummaryStatus);
  const activePlanApproved = activePlanSummaryStatus === "Đã duyệt";
  const departmentPlanPrepared = activePlanSubmitted || planLinkedActivities.length > 0;
  const facultyPlanSummarized = activePlanSubmitted;
  const assignableRoles = secondary.filter((role) => roleCode(role) !== "SINHVIEN");
  const budgetYears = Array.from(new Set([...rows, ...secondary].map((row) => String(readValue(row, "NamHoc") ?? "")).filter(Boolean))).sort((a, b) => b.localeCompare(a, "vi"));
  const visibleBudgetRows = budgetYearFilter ? rows.filter((row) => String(readValue(row, "NamHoc") ?? "") === budgetYearFilter) : rows;
  const approvedBudgetRows = visibleBudgetRows.filter((row) => label(row, "TrangThaiDuTru") === "Đã duyệt");
  const canSubmitBudgets = user.roles.some((role) => ["ADMIN", "CANBOKHOA", "GIANGVIEN"].includes(role.toUpperCase()));
  const canCreateBudgetEstimates = academicCoordinatorPosition || user.roles.some((role) => ["ADMIN", "CANBOKHOA"].includes(role.toUpperCase()));
  const canReviewBudgets = user.roles.some((role) => ["ADMIN", "TRUONGKHOA"].includes(role.toUpperCase()));
  const canReviewBudgetEstimates = canReviewBudgets;
  const canSubmitBudgetEstimates = canCreateBudgetEstimates;
  const budgetActivityOptions = secondary.filter((activity) => ["Dự thảo", "Từ chối"].includes(label(activity, "TrangThai")) && (!budgetDialogYear || label(activity, "NamHoc") === budgetDialogYear)).flatMap((activity) => {
    const id = readValue(activity, "MaHD");
    return id === undefined ? [] : [{ id: String(id), activity }];
  });
  const selectedBudgetActivity = budgetActivityOptions.find(({ id }) => id === selectedId)?.activity;
  const nextBudgetLineId = rows.reduce((max, row) => Math.max(max, Number(readValue(row, "MaKPHD") ?? 0)), 0) + 1;
  const selectedYearBudgetRows = budgetDialogYear ? rows.filter((row) => String(readValue(row, "NamHoc") ?? "") === budgetDialogYear) : [];
  const selectedEligibleBudgetRows = selectedYearBudgetRows.filter((row) => {
    const activityStatus = label(row, "TrangThaiHoatDong");
    const departmentProposalStatus = label(row, "TrangThaiDeXuatBoMon");
    return ["Chờ khoa", "Đã duyệt"].includes(departmentProposalStatus)
      || (!departmentProposalStatus && ["Đã duyệt", "Đã công bố"].includes(activityStatus));
  });
  const budgetDialogGroups = Array.from(selectedEligibleBudgetRows.reduce((groups, row) => {
    const id = String(readValue(row, "MaHD") ?? "");
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(row);
    return groups;
  }, new Map<string, Row[]>()));
  const focusedBudgetRows = budgetDetailActivityId
    ? visibleBudgetRows.filter((row) => String(readValue(row, "MaHD") ?? "") === budgetDetailActivityId)
    : visibleBudgetRows;
  const budgetGroups = Array.from(focusedBudgetRows.reduce((groups, row) => {
    const id = String(readValue(row, "MaHD") ?? "");
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(row);
    return groups;
  }, new Map<string, Row[]>()));
  const visibleBudgetEstimateRows = budgetYearFilter
    ? budgetEstimates.filter((estimate) => String(readValue(estimate, "NamHoc") ?? "") === budgetYearFilter)
    : budgetEstimates;
  const budgetEstimateDetailGroups = Array.from((budgetEstimateDetail?.lines ?? []).reduce((groups, row) => {
    const id = String(readValue(row, "MaHD") ?? "");
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(row);
    return groups;
  }, new Map<string, Row[]>()));

  if (sectionId === "seminars") {
    return <div className={s.businessPanel}>
      {error ? <NoticeDialog message={error} kind="error" onClose={() => setError("")} /> : notice ? <NoticeDialog message={notice} kind="success" onClose={() => setNotice("")} /> : null}
      <section className={s.card}>
        <h2>Seminar học thuật</h2>
        <Listing rows={rows} empty="Chưa có Seminar." onSelect={(row) => setSelectedId(String(row.MaSeminar))} />
        {selectedId && user.roles.includes("SINHVIEN") && <button className={s.primary} disabled={busy} onClick={() => void run(`/seminars/${selectedId}/register`, "POST", {}, "Đã gửi đăng ký tham gia seminar.")}>Đăng ký tham gia Seminar #{selectedId}</button>}
      </section>
    </div>;
  }

  return <div className={`${s.businessPanel} ${sectionId === "plans" ? s.planPage : ""}`}>
    {sectionId === "budget-estimates" && budgetEstimateDetail && <div className={s.modalOverlay} role="dialog" aria-modal="true">
      <div className={s.modalCard} style={{ maxWidth: "1400px", width: "min(1400px, calc(100vw - 32px))", maxHeight: "calc(100vh - 40px)", overflowY: "auto", borderRadius: 18 }}>
        <div className={s.modalHeader}>
          <div><div style={{ color: "#2563eb", fontSize: 12, fontWeight: 700, letterSpacing: ".08em" }}>HỒ SƠ DỰ TRÙ TỔNG HỢP · #{label(budgetEstimateDetail.header, "MaDuTruKP")}</div><h3>{label(budgetEstimateDetail.header, "TenTieuDe")}</h3></div>
          <button type="button" className={s.modalCloseBtn} onClick={() => setBudgetEstimateDetail(null)}>✕</button>
        </div>
        <div className={s.modalBody}>
          <p><strong>Năm học:</strong> {label(budgetEstimateDetail.header, "NamHoc")}　 <strong>Trạng thái:</strong> {label(budgetEstimateDetail.header, "TrangThai")}　 <strong>Tổng kinh phí:</strong> {formatCurrency(readValue(budgetEstimateDetail.header, "TongKinhPhi"))}</p>
          {budgetEstimateDetailGroups.map(([activityId, activityRows]) => <section key={`estimate-detail-activity-${activityId}`} style={{ marginTop: 18 }}><h4 style={{ color: "#163b63", marginBottom: 8 }}>Hoạt động #{activityId} · {label(activityRows[0] ?? {}, "TenHoatDong")}</h4><ActivityBudgetTable activityId={activityId} items={activityRows} /></section>)}
          {Boolean(budgetEstimateDetail.header.GhiChuDuyet) && <p className={s.budgetReviewNote}>Ghi chú của Trưởng khoa: {String(budgetEstimateDetail.header.GhiChuDuyet)}</p>}
          {!budgetEstimateDetailGroups.length && <p className={s.emptyMessage}>Hồ sơ này chưa có khoản kinh phí hoạt động.</p>}
        </div>
      </div>
    </div>}
    {(["expenses", "budget-estimates"].includes(sectionId)) && <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", justifyContent: "space-between", gap: "12px", marginBottom: "16px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "12px" }}>
        <label className={s.businessField} style={{ minWidth: "190px" }}><span>Năm học</span><select className={inputClass} value={budgetYearFilter} onChange={(event) => setBudgetYearFilter(event.target.value)}><option value="">Tất cả năm học</option>{budgetYears.map((year) => <option key={`budget-year-${year}`} value={year}>{year}</option>)}</select></label>
      </div>
      {sectionId === "expenses" && canSubmitBudgets && <button type="button" className={s.primary} onClick={openNewActivityBudget}>＋ Tạo kinh phí hoạt động</button>}
      {sectionId === "budget-estimates" && canCreateBudgetEstimates && <button type="button" className={s.primary} onClick={() => { setBudgetEditingActivityId(null); setBudgetTitle(""); setBudgetDialogYear(""); setBudgetDialogOpen(true); }}>＋ Tạo dự trù kinh phí</button>}
    </div>}
    
    {error ? <NoticeDialog message={error} kind="error" onClose={() => setError("")} /> : notice ? <NoticeDialog message={notice} kind="success" onClose={() => setNotice("")} /> : null}
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
      <section className={s.overviewMetrics} aria-label="Số liệu học thuật">
        {[
          { title: "Hoạt động học kỳ", value: rows.length, note: "Hoạt động đã ghi nhận", icon: "▣", tone: "blue" },
          { title: "Lượt đăng ký", value: rows.reduce((sum, row) => sum + Number(row.SoLuotDangKy ?? 0), 0), note: "Tổng lượt đăng ký", icon: "♙", tone: "green" },
          { title: "Lượt tham dự", value: rows.reduce((sum, row) => sum + Number(row.SoLuotThamDu ?? 0), 0), note: "Đã tham gia hoạt động", icon: "♧", tone: "purple" },
          { title: "Cần theo dõi", value: rows.filter((row) => /chờ|cần|quá hạn/i.test(label(row, "TrangThai"))).length, note: "Hoạt động chờ xử lý", icon: "◷", tone: "orange" },
        ].map((item) => <article key={item.title} className={s.overviewMetric} data-tone={item.tone}>
          <div><span>{item.title}</span><b aria-hidden="true">{item.icon}</b></div>
          <strong>{item.value.toLocaleString("vi-VN")}</strong><small>{item.note}</small>
        </article>)}
      </section>
      <div className={s.overviewGrid}>
        <section className={s.overviewCard}>
          <div className={s.overviewCardHeading}><div><h2>Lượt tham gia theo tháng</h2><p>Tổng lượt đăng ký hoạt động thực tế</p></div></div>
          <div className={s.overviewChart}>
            {Array.from({ length: 7 }, (_, index) => {
              const month = new Date().getMonth() - 6 + index;
              const normalizedMonth = (month + 12) % 12;
              const count = rows.filter((row) => {
                const time = timestamp(activityStart(row));
                return time !== null && new Date(time).getMonth() === normalizedMonth;
              }).reduce((sum, row) => sum + Number(row.SoLuotDangKy ?? 0), 0);
              const max = Math.max(1, ...rows.map((row) => Number(row.SoLuotDangKy ?? 0)));
              return <div className={s.overviewBarColumn} key={index}><span>{count}</span><div className={s.overviewBar} data-current={index === 6} style={{ height: `${Math.max(12, Math.min(100, count / max * 100))}%` }} /><small>T{normalizedMonth + 1}</small></div>;
            })}
          </div>
        </section>
        <section className={s.overviewCard}>
          <div className={s.overviewCardHeading}><div><h2>Tiến độ hoạt động</h2><p>Theo trạng thái hiện tại</p></div></div>
          <div className={s.overviewProgress}>
            {["Đã duyệt", "Đang mở", "Chờ duyệt", "Hoàn thành"].map((status) => {
              const count = rows.filter((row) => label(row, "TrangThai").toLocaleLowerCase("vi").includes(status.toLocaleLowerCase("vi"))).length;
              const percent = rows.length ? Math.round(count / rows.length * 100) : 0;
              return <div key={status}><div><span>{status}</span><strong>{percent}%</strong></div><div className={s.overviewTrack}><span style={{ width: `${percent}%` }} /></div></div>;
            })}
          </div>
        </section>
        <section className={s.overviewCard}>
          <div className={s.overviewCardHeading}><div><h2>Hoạt động sắp tới</h2><p>Các hoạt động gần nhất</p></div></div>
          <div className={s.overviewTableWrap}><table className={s.overviewTable}><thead><tr><th>HOẠT ĐỘNG</th><th>THỜI GIAN</th><th>ĐĂNG KÝ</th><th>TRẠNG THÁI</th></tr></thead><tbody>
            {displayRows.slice(0, 5).map((row, index) => <tr key={String(row.MaHD ?? index)}><td>{label(row, "TenHoatDong", "TenCThi", "TenCuocThi")}</td><td>{formatDateTime(activityStart(row)) ?? "Chưa cập nhật"}</td><td>{Number(row.SoLuotDangKy ?? 0).toLocaleString("vi-VN")}</td><td><span>{label(row, "TrangThai")}</span></td></tr>)}
            {!displayRows.length && <tr><td colSpan={4}>Chưa có hoạt động trong khoảng thời gian báo cáo.</td></tr>}
          </tbody></table></div>
        </section>
        <section className={s.overviewCard}>
          <div className={s.overviewCardHeading}><div><h2>Việc cần làm</h2><p>Hoạt động cần theo dõi</p></div></div>
          <div className={s.overviewTasks}>{rows.filter((row) => /chờ|cần|quá hạn/i.test(label(row, "TrangThai"))).slice(0, 3).map((row, index) => <div key={String(row.MaHD ?? index)}><b>◷</b><span><strong>{label(row, "TenHoatDong", "TenCThi")}</strong><small>{label(row, "TrangThai")}</small></span></div>)}{!rows.some((row) => /chờ|cần|quá hạn/i.test(label(row, "TrangThai"))) && <p>Chưa có hoạt động cần xử lý.</p>}</div>
        </section>
      </div>
    </>}

    {sectionId === "plans" && <>
      <header className={s.planDashboardHeader}>
        <div><h1>Kế hoạch học thuật &amp; quản lý lớp</h1><p>Lập kế hoạch cấp khoa, theo dõi tiến độ phê duyệt và các hoạt động đã tổng hợp.</p></div>
        {canCreatePlans && <button type="button" className={s.primary} onClick={() => setPlanCreateOpen((open) => !open)}>{planCreateOpen ? "Đóng biểu mẫu" : "+ Tạo kế hoạch"}</button>}
      </header>
      <section className={s.planStats} aria-label="Tổng quan kế hoạch">
        <article className={s.planStatCard}><div><span>Tổng kế hoạch</span><b data-tone="blue">▤</b></div><strong>{rows.length}</strong><small>Danh mục kế hoạch của khoa</small></article>
        <article className={s.planStatCard}><div><span>Đã duyệt</span><b data-tone="green">✓</b></div><strong>{approvedPlanCount}</strong><small>Kế hoạch đã được Trưởng khoa duyệt</small></article>
        <article className={s.planStatCard}><div><span>Chờ xử lý</span><b data-tone="amber">◷</b></div><strong>{pendingPlanCount}</strong><small>Đang chờ duyệt hoặc cần bổ sung</small></article>
        <article className={s.planStatCard}><div><span>Ngân sách dự kiến</span><b data-tone="violet">₫</b></div><strong>{formatCurrency(totalPlanBudget)}</strong><small>Tổng kinh phí tổ chức trong kế hoạch</small></article>
      </section>
      <div className={s.planDashboardFilters}>
        <label className={s.planDashboardSearch}><span aria-hidden="true">⌕</span><input value={planSearch} onChange={(event) => setPlanSearch(event.target.value)} placeholder="Tìm theo mã hoặc tên kế hoạch..." aria-label="Tìm kế hoạch" /></label>
        <select className={inputClass} value={planYearFilter} onChange={(event) => setPlanYearFilter(event.target.value)} aria-label="Lọc theo năm học"><option value="">Tất cả năm học</option>{planAcademicYears.map((year) => <option key={year} value={year}>{year}</option>)}</select>
        <select className={inputClass} value={planStatusFilter} onChange={(event) => setPlanStatusFilter(event.target.value)} aria-label="Lọc theo trạng thái"><option value="">Tất cả trạng thái</option>{Array.from(new Set(rows.map((row) => label(row, "TrangThai")))).map((status) => <option key={status} value={status}>{status}</option>)}</select>
        <button type="button" className={s.secondaryButton} onClick={exportPlanData} disabled={!visiblePlanRows.length}>↓ Xuất dữ liệu</button>
      </div>
      {canCreatePlans && planCreateOpen && <section className={s.card}>
        <h2>Tạo kế hoạch</h2>
        <form id="create-academic-plan" className={s.businessForm} onSubmit={createPlan}>
          <Field title="Số kế hoạch" name="soKeHoach" required /><Field title="Tên kế hoạch" name="tenKeHoach" required /><Field title="Ngày ban hành" name="ngayBanHanh" type="date" /><label className={s.businessField}><span>Năm học</span><input className={inputClass} name="namHoc" value={newPlanAcademicYear} onChange={(event) => setNewPlanAcademicYear(event.target.value)} required /></label><Field title="Kinh phí tổ chức" name="kinhPhiTC" />
          <label className={s.businessField}><span>Khoa</span><input className={inputClass} value="Khoa Công nghệ thông tin" readOnly /></label>
          <Field title="Căn cứ" name="canCu" /><Field title="Mục đích" name="mucDich" /><Field title="Yêu cầu" name="yeuCau" /><Field title="Nội dung" name="noiDung" />
          {canSelectApprovedActivities && <div className={s.businessField} style={{ gridColumn: "1 / -1" }}>
            <div className={s.planActivityFilterHeading}><span>Hoạt động do Phụ trách bộ môn chuyển lên</span><label className={s.planYearFilter}>Lọc theo năm học
              <select className={inputClass} value={activityYearFilter} onChange={(event) => { setActivityYearFilter(event.target.value); if (event.target.value) setNewPlanAcademicYear(event.target.value); setSelectedApprovedActivities([]); }}>
                <option value="">Tất cả năm học</option>
                {activityAcademicYears.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label></div>
            <div className={s.planActivityTableWrap}><table className={s.planActivityTable}>
              <thead><tr>
                <th><input type="checkbox" aria-label="Chọn tất cả hoạt động cùng năm học" disabled={!selectablePlanCandidateActivities.length} checked={selectablePlanCandidateActivities.length > 0 && selectablePlanCandidateActivities.every((activity) => selectedApprovedActivities.includes(String(readValue(activity, "MaHD"))))} onChange={(event) => {
                  const selectableIds = new Set(selectablePlanCandidateActivities.map((activity) => String(readValue(activity, "MaHD"))));
                  setSelectedApprovedActivities((current) => event.target.checked
                    ? [...new Set([...current, ...selectableIds])]
                    : current.filter((id) => !selectableIds.has(id)));
                }} /></th>
                <th>Mã hoạt động</th><th>Tên hoạt động</th><th>Năm học</th><th>Trạng thái</th>
              </tr></thead>
              <tbody>{planCandidateActivities.length ? planCandidateActivities.map((activity) => {
                const activityId = String(readValue(activity, "MaHD"));
                return <tr key={`new-plan-approved-${activityId}`}>
                  <td style={{ textAlign: "center" }}><input type="checkbox" aria-label={`Chọn ${label(activity, "TenHoatDong")}`} disabled={normalizedAcademicYear(readValue(activity, "NamHoc")) !== normalizedAcademicYear(newPlanAcademicYear)} checked={selectedApprovedActivities.includes(activityId)} onChange={(event) => setSelectedApprovedActivities((current) => event.target.checked ? [...new Set([...current, activityId])] : current.filter((id) => id !== activityId))} /></td>
                  <td>{activityId}</td><td><strong>{label(activity, "TenHoatDong")}</strong></td>
                  <td>{label(activity, "NamHoc")}</td><td><span className={s.planStatusBadge}>{label(activity, "TrangThaiDeXuatBoMon") === "Chờ khoa" ? "Chờ Trưởng ban học thuật tổng hợp" : "Đã qua Ban bộ môn"}</span></td>
                </tr>;
              }) : <tr><td colSpan={5} className={s.emptyMessage}>Chưa có hoạt động do Phụ trách bộ môn chuyển lên phù hợp với khoa CNTT{activityYearFilter ? `, năm học ${activityYearFilter}` : ""}.</td></tr>}</tbody>
            </table></div>
          </div>}
          <div className={s.businessActions} style={{ gridColumn: "1 / -1", justifyContent: "flex-start" }}>
            <button type="submit" className={s.primary} disabled={busy}>{busy ? "Đang tạo kế hoạch…" : "Tạo kế hoạch"}</button>
          </div>
        </form>
      </section>}
      <div className={s.planDashboardGrid}>
        <section className={s.planCatalogCard}>
          <div className={s.planCatalogHeading}><div><h2>Danh mục kế hoạch</h2><p>{visiblePlanRows.length} kế hoạch trong danh sách đã lọc</p></div><span>{planYearFilter || "Tất cả năm học"}</span></div>
          {visiblePlanRows.length ? <div className={s.planCatalogList}>{visiblePlanRows.map((row, index) => {
            const id = String(identifier(row, "MaKeHoach"));
            const status = label(row, "TrangThai");
            const tone = planStatusTone(status);
            const progress = planProgress(status);
            const stage = planApprovalStages.find((item) => item.status === status);
            const canApprove = Boolean(stage && (user.roles.includes("ADMIN") || stage.roles.some((role) => user.roles.includes(role))));
            const isPlanOpen = selectedId === id && detail && String(readValue(detail, "MaKeHoach")) === id;
            return <article className={s.planCatalogItem} data-selected={Boolean(isPlanOpen)} key={`plan-${id}-${index}`}>
              <div className={s.planCatalogItemHeader}>
                <span className={s.planCatalogCode}>{label(row, "SoKeHoach")}</span>
                <div className={s.planCatalogItemInfo}><strong>{label(row, "TenKeHoach")}</strong><small>{label(row, "TenKhoa", "TenBM")} · Năm học {label(row, "NamHoc")}</small></div>
                <span className={s.planStatusBadge} data-status={tone}>{status}</span>
              </div>
              <div className={s.planCatalogProgress}><span style={{ width: `${progress}%` }} data-status={tone} /></div>
              <div className={s.planCatalogItemFooter}>
                <small>{progress}% tiến độ phê duyệt</small>
                <div className={s.planRowActions}>
                  <button type="button" className={s.secondaryButton} onClick={() => {
                    if (isPlanOpen) {
                      setSelectedId(""); setDetail(null); setSelectedApprovedActivities([]); setNotice(""); setError("");
                    } else void openPlan(id);
                  }}>{isPlanOpen ? "Ẩn" : "Xem"}</button>
                  {status === "Dự thảo" && canManagePlans && <button type="button" className={s.secondaryButton} onClick={() => void openPlan(id)}>Sửa</button>}
                  {canManagePlans && ["Dự thảo", "Cần bổ sung"].includes(status) && <button type="button" className={s.dangerButton} disabled={busy} onClick={() => void deletePlan(id, label(row, "TenKeHoach"))}>Xóa</button>}
                  {canApprove && <button type="button" className={s.secondaryButton} disabled={busy} onClick={() => void run(`/plans/${id}/review`, "PATCH", { action: "approve" }, "Đã duyệt kế hoạch.")}>Duyệt</button>}
                  {status === "Đã duyệt" && <button type="button" className={s.secondaryButton} onClick={() => void exportApprovedPlan(id)}>Xuất</button>}
                </div>
              </div>
            </article>;
          })}</div> : <p className={s.planCatalogEmpty}>{rows.length ? "Không có kế hoạch phù hợp với bộ lọc." : "Chưa có kế hoạch của Khoa Công nghệ thông tin."}</p>}
        </section>
        <aside className={s.planReviewCard}>
          <div className={s.planCatalogHeading}><div><h2>Phê duyệt &amp; hoạt động</h2><p>{activePlanSummary ? `${label(activePlanSummary, "SoKeHoach")} · ${label(activePlanSummary, "NamHoc")}` : "Theo dõi quy trình kế hoạch"}</p></div></div>
          {activePlanSummary ? <>
            <ol className={s.planReviewTimeline}>
              <li className={departmentPlanPrepared ? s.planReviewDone : s.planReviewCurrent}>
                <span>1</span><div><strong>Ban bộ môn lập kế hoạch cuộc thi học thuật trong năm học và dự trù kinh phí</strong><small>{departmentPlanPrepared ? "Hoạt động và kinh phí đã được chuyển lên" : "Đang chờ Ban bộ môn lập kế hoạch và dự trù"}</small></div>
              </li>
              <li className={facultyPlanSummarized ? s.planReviewDone : activePlanSummaryStatus === "Dự thảo" || activePlanSummaryStatus === "Cần bổ sung" ? s.planReviewCurrent : ""}>
                <span>2</span><div><strong>Trưởng ban học thuật tổng hợp</strong><small>{facultyPlanSummarized ? "Đã tổng hợp và trình kế hoạch chung" : activePlanSummaryStatus === "Cần bổ sung" ? "Đang hoàn thiện nội dung cần bổ sung" : "Đang tổng hợp kế hoạch chung"}</small></div>
              </li>
              <li className={activePlanApproved ? s.planReviewDone : activePlanSummaryStatus === "Chờ Trưởng khoa ký duyệt" ? s.planReviewCurrent : ""}>
                <span>3</span><div><strong>Trưởng khoa ký và duyệt</strong><small>{activePlanApproved ? "Đã duyệt kế hoạch" : activePlanSummaryStatus === "Chờ Trưởng khoa ký duyệt" ? "Đang chờ Trưởng khoa xử lý" : "Chưa chuyển đến bước duyệt"}</small></div>
              </li>
              <li className={activePlanApproved ? s.planReviewDone : ""}><span>4</span><div><strong>Phòng KHCN ký duyệt</strong></div></li>
              <li className={activePlanApproved ? s.planReviewDone : ""}><span>5</span><div><strong>Hiệu trưởng ký duyệt</strong></div></li>
            </ol>
          </> : <p className={s.planCatalogEmpty}>Chọn một kế hoạch để xem tiến độ duyệt.</p>}
        </aside>
      </div>
      <div ref={planDetailAnchor} />
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
              <DetailItem title="Kinh phí tổ chức" value={label(detail, "KinhPhiTC")} />
              <DetailItem title="Loại kế hoạch" value={label(detail, "LoaiKeHoach")} />
              <DetailItem title="Ngày ban hành" value={formatDateTime(readValue(detail, "NgayBanHanh")) ?? "Chưa cập nhật"} />
              <DetailItem title="Khoa" value={label(detail, "TenKhoa")} />
              <DetailItem title="Bộ môn" value={label(detail, "TenBM")} />
              <DetailItem title="Mã cán bộ phụ trách" value={label(detail, "NgPhuTrach")} />
              <DetailItem title="Mã tài khoản duyệt" value={label(detail, "NguoiDuyet")} />
              <DetailItem title="Ngày duyệt cuối" value={formatDateTime(readValue(detail, "NgayDuyet")) ?? "Chưa duyệt"} />
              <DetailItem title="Căn cứ" value={label(detail, "CanCu")} />
              <DetailItem title="Mục đích" value={label(detail, "MucDich")} />
              <DetailItem title="Yêu cầu" value={label(detail, "YeuCau")} />
              <DetailItem title="Nội dung kế hoạch" value={label(detail, "NoiDung")} />
            </div>
          </section>
          {Array.isArray(readValue(detail, "deXuatBoMon")) && (readValue(detail, "deXuatBoMon") as Row[]).length > 0 && <section className={s.planActivitiesCard}>
            <h3>Đề xuất cuộc thi bộ môn đã gộp</h3>
            <div className={s.planActivityTableWrap}><table className={`${s.planActivityTable} ${s.planDepartmentProposalTable}`}><thead><tr><th>Bộ môn</th><th>Cuộc thi</th><th>Dự trù kinh phí</th></tr></thead><tbody>{(readValue(detail, "deXuatBoMon") as Row[]).map((proposal) => <tr key={String(proposal.MaDeXuat)}><td>{label(proposal, "TenBM")}</td><td><strong>{label(proposal, "TenCuocThi")}</strong><small>{label(proposal, "NoiDung")}</small></td><td>{Number(proposal.DuTruKinhPhi ?? 0).toLocaleString("vi-VN")} đ</td></tr>)}</tbody></table></div>
          </section>}
          <section className={s.planActivitiesCard} aria-label="Hoạt động do Phụ trách bộ môn chuyển lên">
            {canSelectApprovedActivities && canEditPlan && <>
              {planCandidateActivities.length ? <div className={s.planActivityTableWrap}><table className={`${s.planActivityTable} ${s.planForwardedActivityTable}`}>
                <thead><tr><th>Chọn</th><th>Hoạt động / nội dung</th><th>Thời gian / địa điểm</th><th>Đối tượng / số lượng</th><th>Trạng thái hoạt động</th></tr></thead>
                <tbody>{planCandidateActivities.map((activity) => {
                  const activityId = String(readValue(activity, "MaHD"));
                  return <tr key={`approved-plan-activity-${activityId}`}>
                    <td style={{ textAlign: "center" }}><input type="checkbox" aria-label={`Chọn ${label(activity, "TenHoatDong")}`} checked={selectedApprovedActivities.includes(activityId)} onChange={(event) => setSelectedApprovedActivities((current) => event.target.checked ? [...new Set([...current, activityId])] : current.filter((id) => id !== activityId))} /></td>
                    <td><strong>{label(activity, "TenHoatDong")}</strong><small>{label(activity, "LoaiHoatDong")} · Mã HĐ {activityId}</small><small>{label(activity, "NoiDung")}</small></td>
                    <td>{formatDateTime(readValue(activity, "TgDuKien", "TgBatDau")) ?? "Chưa cập nhật"}<small>{label(activity, "DiaDiem")}</small></td>
                    <td>{label(activity, "DoiTuongThamDu")}<small>{label(activity, "SLSVDuKien")} người dự kiến</small></td>
                  <td><span className={s.planActivityStatus}>{label(activity, "TrangThaiDeXuatBoMon") === "Chờ khoa" ? "Chờ Trưởng ban học thuật tổng hợp" : "Đã qua Ban bộ môn"}</span></td>
                  </tr>;
              })}</tbody>
              </table></div> : <p className={s.emptyMessage}>Chưa có đề xuất nào được Phụ trách bộ môn chuyển lên phù hợp với khoa và năm học này.</p>}
            </>}
            {!(canSelectApprovedActivities && canEditPlan) && (planLinkedActivities.length ? <div className={s.planActivityTableWrap} style={{ marginTop: "16px" }}><table className={`${s.planActivityTable} ${s.planLinkedActivityTable}`}>
              <thead><tr><th>Hoạt động đã gộp</th><th>Thời gian / địa điểm</th><th>Đối tượng / số lượng</th><th>Trạng thái duyệt</th></tr></thead>
              <tbody>{planLinkedActivities.map((activity) => {
                const activityId = String(readValue(activity, "MaHD"));
                const activityStatus = label(activity, "TrangThai");
                const activityStatusTone = activityStatus.includes("Đã duyệt") ? "approved" : activityStatus.includes("Từ chối") ? "rejected" : activityStatus.toLocaleLowerCase("vi").includes("bổ sung") ? "changes" : "pending";
                return <tr key={`linked-plan-activity-${activityId}`}>
                  <td><strong>{label(activity, "TenHoatDong")}</strong><small>{label(activity, "LoaiHoatDong")} · Mã HĐ {activityId}</small><small>{label(activity, "NoiDung")}</small></td>
                  <td>{formatDateTime(readValue(activity, "TgDuKien", "TgBatDau")) ?? "Chưa cập nhật"}<small>{label(activity, "DiaDiem")}</small></td>
                  <td>{label(activity, "DoiTuongThamDu")}<small>{label(activity, "SLSVDuKien")} người dự kiến</small></td>
                  <td><span className={s.planActivityStatus} data-status={activityStatusTone}>{activityStatus}</span></td>
                </tr>;
              })}</tbody>
            </table></div> : <p className={s.emptyMessage}>Chưa gộp hoạt động do Phụ trách bộ môn chuyển lên vào kế hoạch.</p>)}
            <div className={s.businessActions} style={{ marginTop: "16px" }}>
              {planStatus === "Đã duyệt" && <button type="button" className={s.secondaryButton} disabled={!planLinkedActivities.length && !visibleLegacyPlanActivities.length && !(Array.isArray(readValue(detail, "deXuatBoMon")) && (readValue(detail, "deXuatBoMon") as Row[]).length)} onClick={() => {
                if (exportAnnualPlanPdf(detail, planLinkedActivities, visibleLegacyPlanActivities, Array.isArray(readValue(detail, "deXuatBoMon")) ? readValue(detail, "deXuatBoMon") as Row[] : [])) setNotice("Đã mở bản in kế hoạch. Trong hộp thoại in, chọn ‘Save as PDF’ hoặc ‘Lưu dưới dạng PDF’ để tải tệp.");
                else setError("Trình duyệt đã chặn cửa sổ xuất PDF. Hãy cho phép cửa sổ bật lên rồi thử lại.");
              }}>Xuất kế hoạch PDF</button>}

            </div>
          </section>
          <div className={s.businessActions}>{canEditPlan && <button className={s.primary} disabled={busy || (planLinkedActivities.length === 0 && !(Array.isArray(readValue(detail, "deXuatBoMon")) && (readValue(detail, "deXuatBoMon") as Row[]).length))} onClick={async () => { const result = await run(`/plans/${selectedId}/submit`, "POST", {}, "Kế hoạch đã được chuyển đến Trưởng khoa để ký và duyệt."); if (result) await selected("/plans/"); }}>Trình ký duyệt</button>}{canReviewPlan && currentPlanStage && <><button className={s.primary} disabled={busy} onClick={async () => { const result = await run(`/plans/${selectedId}/review`, "PATCH", { action: "approve" }, `Đã hoàn tất bước: ${currentPlanStage.title}.`); if (result) await selected("/plans/"); }}>{currentPlanStage.title}</button><button className={s.secondaryButton} disabled={busy} onClick={async () => { const result = await run(`/plans/${selectedId}/review`, "PATCH", { action: "request_changes", ghiChu: "Vui lòng bổ sung thông tin." }, "Đã yêu cầu bổ sung."); if (result) await selected("/plans/"); }}>Yêu cầu bổ sung</button></>}</div>
        </>}
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
      <h2>Kinh phí theo hoạt động</h2>
      <p>Mỗi hoạt động có một hồ sơ dự trù riêng. Khoa duyệt từng hồ sơ; file tổng hợp chỉ gồm các khoản đã duyệt.</p>
      {budgetGroups.length ? <div className={s.businessList}>{budgetGroups.map(([activityId, items]) => {
        const first = items[0];
        const rawStatus = label(first, "TrangThaiDuTru");
        const status = rawStatus === "—" ? "Dự thảo" : rawStatus;
        const proposalId = Number(readValue(first, "MaHoSoDuTru", "MaDuTruKP") ?? 0);
        const isBudgetOwner = String(readValue(first, "NguoiLapHoatDong") ?? "") === String(user.id);
        const canManageOwnBudget = canSubmitBudgets && isBudgetOwner;
        const canSubmit = canManageOwnBudget && ["Dự thảo", "Từ chối", "Cần bổ sung"].includes(status);
        const canReview = canReviewBudgets && status === "Chờ duyệt" && proposalId > 0 && label(first, "TrangThaiKeHoachKhoa") === "Chờ Trưởng khoa ký duyệt";
        const canEdit = canManageOwnBudget && ["Dự thảo", "Từ chối", "Cần bổ sung"].includes(status);
        const lockReason = `Hồ sơ đang ở trạng thái “${status}”; chỉ hồ sơ Dự thảo hoặc Từ chối mới được sửa, xóa hoặc gửi lại.`;
        return <article key={`budget-activity-${activityId}`}>
          <div className={s.businessActions} style={{ justifyContent: "flex-start", marginTop: 0 }}>
            <button type="button" className={s.secondaryButton} onClick={() => setBudgetDetailActivityId((current) => current === String(activityId) ? null : String(activityId))}>Xem</button>
            {canManageOwnBudget && <button type="button" className={s.secondaryButton} disabled={!canEdit || busy} title={canEdit ? "Chỉnh sửa kinh phí hoạt động" : lockReason} onClick={() => openEditActivityBudget(String(activityId), items)}>Chỉnh sửa</button>}
            {canManageOwnBudget && <button type="button" className={s.secondaryButton} disabled={busy || !canEdit || proposalId <= 0} title={canEdit ? "Xóa toàn bộ hồ sơ dự trù" : lockReason} onClick={() => { if (window.confirm(`Xóa toàn bộ hồ sơ dự trù của hoạt động “${label(first,"TenHoatDong") }”?`)) void run(`/academic-activities/budgets/${proposalId}`, "DELETE", undefined, "Đã xóa hồ sơ dự trù.").then((result) => { if (result) setBudgetDetailActivityId(null); }); }}>Xóa</button>}
            {canManageOwnBudget && <button type="button" className={s.primary} disabled={busy || !canSubmit} title={canSubmit ? "Gửi hồ sơ lên khoa duyệt" : status === "Chờ duyệt" ? "Hồ sơ đã gửi và đang chờ Trưởng khoa duyệt." : lockReason} onClick={() => void run(`/academic-activities/${activityId}/budget/submit`, "PATCH", undefined, status === "Từ chối" ? "Đã gửi lại dự trù lên khoa duyệt." : "Đã gửi dự trù của hoạt động lên khoa duyệt.")}>{status === "Từ chối" || status === "Dự thảo" ? "Gửi" : status === "Chờ duyệt" ? "Đang chờ duyệt" : status === "Đã duyệt" ? "Đã duyệt" : "Gửi"}</button>}
            {canReview && <>
              <button className={s.primary} disabled={busy} onClick={() => void run(`/academic-activities/budgets/${proposalId}/review`, "PATCH", { action: "approve" }, "Đã duyệt dự trù kinh phí hoạt động.")}>Duyệt dự trù</button>
              <button className={s.secondaryButton} disabled={busy} onClick={() => { const note = window.prompt("Nội dung cần bổ sung:"); if (note === null) return; void run(`/academic-activities/budgets/${proposalId}/review`, "PATCH", { action: "request_changes", ghiChu: note.trim() }, "Đã yêu cầu bổ sung dự trù kinh phí."); }}>Yêu cầu bổ sung</button>
            </>}
          </div>
          <div className={s.budgetTableWrap}><ActivityBudgetTable activityId={String(activityId)} items={items} />{label(first, "GhiChuDuyet") !== "—" && <p className={s.budgetReviewNote}>Ghi chú bổ sung: {label(first, "GhiChuDuyet")}</p>}</div>
        </article>;
      })}</div> : <p className={s.emptyMessage}>Chưa có dữ liệu kinh phí hoạt động trong năm học đã chọn.</p>}
    </section>}

    {sectionId === "budget-estimates" && <section className={`${s.card} ${s.proposalListPage}`}><h2>Danh sách Dự trù kinh phí</h2><p>Hồ sơ tổng hợp các khoản kinh phí hoạt động đã được duyệt theo năm học, gửi Trưởng khoa xét duyệt.</p>{visibleBudgetEstimateRows.length ? <div className={s.budgetTableWrap}><table className={`${s.budgetSummaryTable} ${s.proposalListTable}`}><thead><tr><th>Mã dự trù kinh phí</th><th>Tên tiêu đề</th><th>Năm học</th><th>Ngày lập</th><th>Số hoạt động</th><th>Tổng kinh phí</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{visibleBudgetEstimateRows.map((estimate) => { const id = String(readValue(estimate, "MaDuTruKP") ?? ""); const status = label(estimate, "TrangThai"); const canSubmit = canSubmitBudgetEstimates && ["Dự thảo", "Cần bổ sung", "Từ chối"].includes(status); const canReview = canReviewBudgetEstimates && status === "Chờ duyệt"; return <tr key={`annual-budget-estimate-${id}`}><td>{id}</td><td>{label(estimate, "TenTieuDe")}</td><td>{label(estimate, "NamHoc")}</td><td>{formatDateTime(readValue(estimate, "NgayLap"))}</td><td>{label(estimate, "SoHoatDong")}</td><td>{formatCurrency(readValue(estimate, "TongKinhPhi"))}</td><td>{status}</td><td><div className={s.businessActions} style={{ marginTop: 0 }}><button type="button" className={s.secondaryButton} onClick={async () => { setBusy(true); setError(""); try { const value = await workflowRequest<{ header: Row; lines: Row[] }>(`/academic-activities/budget-estimates/${id}`); setBudgetEstimateDetail(value); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được hồ sơ dự trù."); } finally { setBusy(false); } }}>Xem</button>{status === "Đã duyệt" && <button type="button" className={s.secondaryButton} disabled={busy} onClick={async () => { const printWindow = window.open("", "_blank", "width=1100,height=800"); if (!printWindow) { setError("Trình duyệt đã chặn cửa sổ xuất PDF."); return; } setBusy(true); setError(""); try { const detail = await workflowRequest<{ header: Row; lines: Row[] }>(`/academic-activities/budget-estimates/${id}`); if (label(detail.header, "TrangThai") !== "Đã duyệt") { printWindow.close(); setError("Chỉ xuất PDF được hồ sơ dự trù đã duyệt."); return; } printBudgetEstimatePdf(printWindow, detail); } catch (cause) { printWindow.close(); setError(cause instanceof Error ? cause.message : "Không tải được hồ sơ dự trù để xuất PDF."); } finally { setBusy(false); } }}>Xuất PDF</button>}{canSubmit && <button type="button" className={s.primary} disabled={busy} onClick={() => void run(`/academic-activities/budget-estimates/${id}/submit`, "PATCH", undefined, "Đã gửi hồ sơ dự trù tổng hợp lên Trưởng khoa duyệt.")}>Gửi Trưởng khoa duyệt</button>}{canReview && <><button type="button" className={s.primary} disabled={busy} onClick={() => void run(`/academic-activities/budget-estimates/${id}/review`, "PATCH", { action: "approve" }, "Đã duyệt hồ sơ dự trù tổng hợp.")}>Duyệt</button><button type="button" className={s.secondaryButton} disabled={busy} onClick={() => { const note = window.prompt("Ghi chú hoặc nội dung cần bổ sung:"); if (note === null) return; void run(`/academic-activities/budget-estimates/${id}/review`, "PATCH", { action: "request_changes", ghiChu: note.trim() }, "Đã gửi yêu cầu bổ sung hồ sơ dự trù."); }}>Yêu cầu bổ sung</button><button type="button" className={s.secondaryButton} disabled={busy} onClick={() => { const note = window.prompt("Lý do từ chối hồ sơ:"); if (note === null) return; void run(`/academic-activities/budget-estimates/${id}/review`, "PATCH", { action: "reject", ghiChu: note.trim() }, "Đã từ chối hồ sơ dự trù."); }}>Từ chối</button></>}</div></td></tr>; })}</tbody></table></div> : <p className={s.emptyMessage}>Chưa có hồ sơ dự trù tổng hợp trong năm học đã chọn.</p>}</section>}

    {sectionId === "actual-expenses" && <section className={s.card}><h2>Kinh phí thực tế</h2><p>Danh sách hoạt động và hồ sơ quyết toán chi phí thực tế.</p>{rows.length ? <div className={s.budgetTableWrap}><table className={s.budgetSummaryTable}><thead><tr><th>Mã hoạt động</th><th>Tên hoạt động</th><th>Năm học</th><th>Kinh phí dự trù</th><th>Thao tác</th></tr></thead><tbody>{rows.map((activity) => { const id=String(readValue(activity,"MaHD") ?? ""); return <tr key={`actual-expense-activity-${id}`}><td>{id}</td><td>{label(activity,"TenHoatDong")}</td><td>{label(activity,"NamHoc")}</td><td>{formatCurrency(readValue(activity,"KinhPhiDuTru"))}</td><td><button type="button" className={s.secondaryButton} onClick={() => { setSelectedId(id); void workflowRequest<unknown>(`/settlements/${id}`).then((value) => setDetail(value as Row)).catch((cause) => setError(cause instanceof Error ? cause.message : "Không tải được quyết toán.")); }}>Xem quyết toán</button></td></tr>; })}</tbody></table></div> : <p className={s.emptyMessage}>Chưa có hoạt động để theo dõi kinh phí thực tế.</p>}{detail && selectedId && <div className={s.card} style={{ marginTop: 16 }}><h3>Chi tiết quyết toán hoạt động #{selectedId}</h3><Listing rows={Array.isArray(readValue(detail,"expenses")) ? readValue(detail,"expenses") as Row[] : []} empty="Chưa có khoản chi thực tế." /></div>}</section>}

    {sectionId === "expenses" && budgetDialogOpen && <div className={s.modalOverlay} role="dialog" aria-modal="true">
      <div className={s.modalCard} style={{ maxWidth: 1100, width: "min(1100px, calc(100vw - 32px))", maxHeight: "calc(100vh - 40px)", overflowY: "auto", borderRadius: 18, fontSize: 15 }}>
        <div className={s.modalHeader}>
          <div><div style={{ color: "#2563eb", fontSize: 12, fontWeight: 700, letterSpacing: ".08em" }}>DỰ TRÙ NGÂN SÁCH</div><h3>{budgetEditingActivityId ? "Chỉnh sửa kinh phí hoạt động" : "Thêm khoản cho hoạt động"}</h3></div>
          <button type="button" className={s.modalCloseBtn} onClick={closeActivityBudgetDialog}>✕</button>
        </div>
        <form onSubmit={saveActivityBudget}>
          <div className={s.modalBody} style={{ padding: "22px 24px 18px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "150px 160px minmax(240px, 1fr) 160px", gap: 10 }}>
              <label className={s.businessField}><span>Mã kinh phí hoạt động <b style={{ color: "#dc2626" }}>*</b></span><input className={inputClass} value={budgetEditingActivityId ? budgetLines[0]?.maKPHD ?? String(nextBudgetLineId) : String(nextBudgetLineId)} readOnly disabled /></label>
              <label className={s.businessField}>
                <span>Mã hoạt động <b style={{ color: "#dc2626" }}>*</b></span>
                {budgetEditingActivityId
                  ? <><input className={inputClass} value={selectedId} readOnly /><input type="hidden" name="maHD" value={selectedId} /></>
                  : <select className={inputClass} name="maHD" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} required><option value="">Chọn mã</option>{budgetActivityOptions.map(({ id }) => <option key={"activity-budget-code-" + id} value={id}>{id}</option>)}</select>}
              </label>
              <label className={s.businessField}><span>Tên hoạt động <b style={{ color: "#dc2626" }}>*</b></span><input className={inputClass} value={budgetEditingActivityId ? label(rows.find((row) => String(readValue(row, "MaHD") ?? "") === budgetEditingActivityId) ?? {}, "TenHoatDong") : selectedBudgetActivity ? label(selectedBudgetActivity, "TenHoatDong") : selectedId === String(initialActivityId ?? "") ? initialActivityName ?? "—" : "—"} readOnly /></label>
              <label className={s.businessField}>
                <span>Năm học <b style={{ color: "#dc2626" }}>*</b></span>
                {budgetEditingActivityId
                  ? <input className={inputClass} value={budgetDialogYear} readOnly />
                  : <select className={inputClass} value={budgetDialogYear} onChange={(event) => { setBudgetDialogYear(event.target.value); setSelectedId(""); }} required><option value="">Chọn năm học</option>{budgetYears.map((year) => <option key={year} value={year}>{year}</option>)}</select>}
              </label>
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              {budgetLines.map((line, index) => <div key={line.maKPHD ?? "activity-budget-line-" + index} style={{ border: "1px solid #dbe5f0", borderRadius: 12, padding: 18, display: "grid", gridTemplateColumns: "minmax(0, 2fr) repeat(4, minmax(0, 1fr))", columnGap: 16, rowGap: 16 }}>
                <div style={{ display: "contents" }}>
                  <label className={s.businessField}><span>Nội dung <b style={{ color: "#dc2626" }}>*</b></span><input className={inputClass} value={line.noiDung} onChange={(event) => setBudgetLines((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, noiDung: event.target.value } : item))} required /></label>
                  <label className={s.businessField}><span>Số lượng <b style={{ color: "#dc2626" }}>*</b></span><input className={inputClass} type="number" min="0" step="0.01" value={line.soLuong} onChange={(event) => setBudgetLines((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, soLuong: event.target.value } : item))} required /></label>
                  <label className={s.businessField}><span>Đơn vị tính</span><input className={inputClass} value={line.donViTinh} onChange={(event) => setBudgetLines((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, donViTinh: event.target.value } : item))} /></label>
                  <label className={s.businessField}><span>Đơn giá <b style={{ color: "#dc2626" }}>*</b></span><input className={inputClass} type="number" min="0" step="0.01" value={line.donGia} onChange={(event) => setBudgetLines((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, donGia: event.target.value } : item))} required /></label>
                  <label className={s.businessField}><span>Số tiền <b style={{ color: "#dc2626" }}>*</b></span><input className={inputClass} value={formatCurrency(Number(line.soLuong || 0) * Number(line.donGia || 0))} readOnly /></label>
                </div>
                <div style={{ display: "contents" }}>
                  <label className={s.businessField} style={{ gridColumn: "span 3" }}><span>Thuyết minh</span><input className={inputClass} value={line.thuyetMinh} onChange={(event) => setBudgetLines((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, thuyetMinh: event.target.value } : item))} /></label>
                  <label className={s.businessField} style={{ gridColumn: "span 2" }}><span>Ghi chú</span><input className={inputClass} value={line.ghiChu} onChange={(event) => setBudgetLines((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, ghiChu: event.target.value } : item))} /></label>
                </div>
                {budgetLines.length > 1 && <div style={{ gridColumn: "1 / -1", marginTop: 2 }}><button type="button" className={s.secondaryButton} onClick={() => { if (line.maKPHD) setBudgetRemovedLineIds((ids) => [...ids, line.maKPHD!]); setBudgetLines((all) => all.filter((_, itemIndex) => itemIndex !== index)); }}>Xóa dòng</button></div>}
              </div>)}
            </div>
            <button type="button" className={s.secondaryButton} style={{ marginTop: 12, marginBottom: 18 }} onClick={() => setBudgetLines((all) => [...all, emptyActivityBudgetLine()])}>＋ Thêm dòng</button>
            <label className={s.businessField}><span>Nguồn kinh phí <b style={{ color: "#dc2626" }}>*</b></span><input className={inputClass} name="nguonKinhPhi" value={budgetSource} onChange={(event) => setBudgetSource(event.target.value)} required /></label>
            <p style={{ color: "#64748b", fontSize: 13 }}>Số tiền mỗi dòng tự tính theo số lượng × đơn giá.</p>
          </div>
          <div className={s.modalFooter} style={{ justifyContent: "flex-start", gap: 14, padding: "16px 24px 20px" }}>
            <button type="button" className={s.secondaryButton} onClick={closeActivityBudgetDialog}>Hủy</button>
            <button type="submit" className={s.primary} style={{ marginLeft: 14 }} disabled={busy}>{busy ? "Đang lưu…" : budgetEditingActivityId ? "Lưu thay đổi" : "Lưu khoản kinh phí"}</button>
          </div>
        </form>
      </div>
    </div>}
    {sectionId === "budget-estimates" && budgetDialogOpen && <div className={s.modalOverlay} role="dialog" aria-modal="true">
      <div className={s.modalCard} style={{ maxWidth: "1200px", width: "min(1200px, calc(100vw - 32px))", maxHeight: "calc(100vh - 40px)", overflowY: "auto", borderRadius: "18px", boxShadow: "0 24px 70px rgba(15, 23, 42, .22)" }}>
        <div className={s.modalHeader} style={{ padding: "20px 24px", background: "linear-gradient(135deg, #eff6ff, #ffffff)" }}>
          <div><div style={{ color: "#2563eb", fontSize: "12px", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>DỰ TRÙ KINH PHÍ HOẠT ĐỘNG HỌC THUẬT</div></div>
          <button type="button" className={s.modalCloseBtn} onClick={() => setBudgetDialogOpen(false)}>✕</button>
        </div>
        <form onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          if (!budgetDialogYear) { setError("Hãy chọn năm học cần lập dự trù."); return; }
          if (!selectedEligibleBudgetRows.length) { setError("Năm học này chưa có kinh phí nào được chuyển từ Ban bộ môn hoặc hoạt động nào đã được duyệt."); return; }
          setBusy(true); setError(""); setNotice("");
          try {
            const result = await workflowRequest<{ maDuTruKP: number; soKhoan: number }>("/academic-activities/budget-estimates", { method: "POST", body: { tenTieuDe: budgetTitle, namHoc: budgetDialogYear, ngayLap: String(formData.get("ngayLap") ?? "") || undefined } });
            setNotice(`Đã tổng hợp ${result.soKhoan} khoản kinh phí thành hồ sơ dự trù #${result.maDuTruKP}. Hãy gửi hồ sơ lên Trưởng khoa duyệt.`); setBudgetDialogOpen(false); setBudgetTitle(""); setBudgetDialogYear(""); await load();
          } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tạo hồ sơ dự trù tổng hợp."); }
          finally { setBusy(false); }
        }}>
          <div className={s.modalBody} style={{ padding: "22px 24px 8px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className={s.businessField}><span>Mã dự trù kinh phí</span><input className={inputClass} value={String(budgetEstimateNextId)} readOnly disabled /></label>
              <label className={s.businessField}><span>Tên tiêu đề *</span><input className={inputClass} value={budgetTitle} onChange={(event) => setBudgetTitle(event.target.value)} placeholder="Dự trù kinh phí hoạt động học thuật" required /></label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className={s.businessField}><span>Năm học *</span><select className={inputClass} value={budgetDialogYear} onChange={(event) => { setBudgetDialogYear(event.target.value); setSelectedId(""); }} required><option value="">Chọn năm học</option>{budgetYears.map((year) => <option key={`dialog-budget-year-${year}`} value={year}>{year}</option>)}</select></label>
              <label className={s.businessField}><span>Ngày lập *</span><input className={inputClass} type="date" name="ngayLap" defaultValue={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)} required /></label>
            </div>
            <h4 style={{ margin: "18px 0 0", color: "#163b63", fontSize: "16px" }}>Kinh phí hoạt động</h4>
            <div className={s.budgetTableWrap}>{budgetDialogGroups.map(([activityId, activityRows]) => { const departmentProposalStatus = label(activityRows[0] ?? {}, "TrangThaiDeXuatBoMon"); const statusText = departmentProposalStatus === "Chờ khoa" ? "Chờ Trưởng ban học thuật tổng hợp" : departmentProposalStatus === "Đã duyệt" ? "Đã qua Ban bộ môn" : "Hoạt động đã duyệt"; return <div key={`dialog-activity-budget-${activityId}`} style={{ marginBottom: 18 }}><div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}><strong style={{ color: "#163b63" }}>Hoạt động #{activityId} · {label(activityRows[0] ?? {}, "TenHoatDong")}</strong><span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 13, fontWeight: 600, color: "#1d4ed8", background: "#dbeafe" }}>{statusText}</span></div><ActivityBudgetTable activityId={activityId} items={activityRows} /></div>; })}{!budgetDialogYear && <p className={s.emptyMessage}>Chọn năm học để xem kinh phí hoạt động đã chuyển từ Ban bộ môn lên Trưởng ban học thuật.</p>}{budgetDialogYear && !budgetDialogGroups.length && <p className={s.emptyMessage}>Chưa có kinh phí hoạt động được chuyển từ Ban bộ môn hoặc hoạt động đã duyệt trong năm học {budgetDialogYear}.</p>}</div>
            <p style={{ margin: "12px 0 0", color: "#64748b", fontSize: "13px" }}>Các khoản đã được Ban bộ môn chuyển lên sẽ được Trưởng ban học thuật tổng hợp thành hồ sơ dự trù và gửi Trưởng khoa duyệt.</p>
          </div>
          <div className={s.modalFooter} style={{ display: "flex", justifyContent: "flex-start", gap: 16, padding: "16px 24px 20px", borderTop: "1px solid #eef2f7", background: "#fbfdff" }}><button type="button" className={s.secondaryButton} onClick={() => setBudgetDialogOpen(false)}>Hủy</button><button type="submit" className={s.primary} disabled={busy}>{busy ? "Đang tổng hợp…" : "Tạo hồ sơ dự trù"}</button></div>
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






