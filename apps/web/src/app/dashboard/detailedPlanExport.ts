function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateDisplay(val?: string | null): string {
  if (!val) return "";
  const str = String(val).trim();
  if (!str || str.toLowerCase() === "theo tiến độ") return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const [y, m, d] = str.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  const date = new Date(str);
  if (!isNaN(date.getTime()) && date.getFullYear() > 2000) {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${d}/${m}/${date.getFullYear()}`;
  }
  return str;
}

function inferWorkItemDate(item: any, eventDateStr?: string | null): string {
  if (item.dateText && String(item.dateText).trim()) return String(item.dateText).trim();
  const direct = formatDateDisplay(item.thoiGian);
  const endDirect = formatDateDisplay(item.thoiGianKetThuc);
  if (direct && endDirect && direct !== endDirect) return `${direct} đến ${endDirect}`;
  if (direct) return direct;

  let eventDate = "15/04/2025";
  if (eventDateStr) {
    const match = eventDateStr.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (match) eventDate = match[1];
  }

  const text = String(item.noiDung || "").toLowerCase();
  if (
    text.includes("mc") ||
    text.includes("điểm danh") ||
    text.includes("ổn định") ||
    text.includes("hậu cần") ||
    text.includes("biên bản") ||
    text.includes("nước uống") ||
    text.includes("bánh") ||
    text.includes("chụp hình") ||
    text.includes("hoa")
  ) {
    return eventDate;
  }
  if (
    text.includes("mượn phòng") ||
    text.includes("thông báo") ||
    text.includes("đăng ký") ||
    text.includes("thư mời") ||
    text.includes("liên chi đoàn")
  ) {
    return "28/02/2025";
  }
  if (
    text.includes("kinh phí") ||
    text.includes("thanh toán") ||
    text.includes("hồ sơ thanh toán") ||
    text.includes("quyết toán")
  ) {
    return "25/04/2025";
  }
  if (text.includes("lập kế hoạch") || text.includes("xây dựng kế hoạch")) {
    return "15/12/2024";
  }
  if (text.includes("sơ tuyển") || text.includes("vòng 1") || text.includes("sơ khảo")) {
    return "10/01/2025";
  }
  if (text.includes("chung kết") || text.includes("vòng 2")) {
    return "15/04/2025";
  }
  return "Theo tiến độ";
}

function formatCanCuList(canCu: string): string[] {
  if (!canCu || !canCu.trim()) {
    return [
      "Căn cứ Thông báo số 913/TB-DCT ngày 24 tháng 9 năm 2024 về việc tổ chức hoạt động học thuật dành cho sinh viên năm học 2024 – 2025 của Trường Đại học Công Thương Thành phố Hồ Chí Minh",
      "Căn cứ Quyết định số 2987/QĐ-DCT ngày 24 tháng 9 năm 2024 về việc chi hỗ trợ tổ chức các hoạt động học thuật dành cho sinh viên năm học 2024 – 2025",
      "Căn cứ Kế hoạch năm học 2024 - 2025 của Khoa Công nghệ Thông tin",
    ];
  }
  const parts = canCu
    .split(/(?:;\s*|\r?\n)+/g)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    const ccParts = canCu
      .split(/(?=\bCăn cứ\b)/gi)
      .map((p) => p.trim().replace(/^;\s*|;\s*$/g, ""))
      .filter(Boolean);
    if (ccParts.length > 1) return ccParts;
  }
  return parts;
}

function formatBulletList(text: string): string[] {
  if (!text || !text.trim()) return [];
  if (/^\s*[-–•*]/m.test(text)) {
    return text
      .split(/\r?\n/)
      .map((s) => s.replace(/^\s*[-–•*]\s*/, "").trim())
      .filter(Boolean);
  }
  const parts = text
    .split(/(?:;\s*|\r?\n)+|(?<=\.)\s+(?=[A-ZĐNhằmGiúpTạoĐảmBảoPhát])/g)
    .map((s) => s.trim().replace(/^;\s*|;\s*$/g, ""))
    .filter(Boolean);
  return parts.length ? parts : [text.trim()];
}

function formatCriteriaList(text: string): string[] {
  if (!text || !text.trim()) return [];
  const clean = text.trim();
  const parts = clean
    .split(/(?:;\s*|\r?\n|(?<=\))\s*[,.]\s*)/gi)
    .map((s) => s.trim().replace(/^[-–•*]\s*/, ""))
    .filter(Boolean);
  return parts.length ? parts : [clean];
}

function formatPrizesList(text: string): string[] {
  if (!text || !text.trim()) return [];
  const clean = text.trim();
  const parts = clean
    .split(/(?:;\s*|\r?\n|,\s*(?=\d+\s*Giải))/gi)
    .map((s) => s.trim().replace(/^[-–•*]\s*/, ""))
    .filter(Boolean);
  return parts.length ? parts : [clean];
}

function renderCommitteeList(
  title: string,
  members: Array<{ hoTen: string; chucDanh: string; vaiTro: string }>
): string {
  if (!members || members.length === 0) return "";
  const rows = members
    .map(
      (m, idx) => `
        <tr>
          <td style="width: 46%; padding: 2px 4px 2px 25px; border: none; vertical-align: top;">
            ${idx + 1}. ${escapeHtml(m.hoTen)}
          </td>
          <td style="width: 30%; padding: 2px 4px; border: none; vertical-align: top;">
            ${escapeHtml(m.chucDanh)}
          </td>
          <td style="width: 24%; padding: 2px 4px; border: none; vertical-align: top;">
            ${escapeHtml(m.vaiTro)}
          </td>
        </tr>`
    )
    .join("");

  return `
    <p class="indent-p" style="margin-top: 6px; margin-bottom: 2px;">
      <strong>${escapeHtml(title)}:</strong>
    </p>
    <table class="borderless-committee-table">
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function parseOtherContents(text: unknown): Array<{
  stt: number;
  noiDung: string;
  thoiGian: string;
  moTa: string;
}> {
  if (!text) return [];
  if (Array.isArray(text)) {
    return text.map((item: any, idx: number) => ({
      stt: item.stt ?? idx + 1,
      noiDung: item.noiDung || item.ten || "",
      thoiGian: item.thoiGian || "",
      moTa: item.moTa || item.ghiChu || item.phuTrach || "",
    }));
  }
  const raw = String(text).trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any, idx: number) => ({
        stt: item.stt ?? idx + 1,
        noiDung: item.noiDung || item.ten || "",
        thoiGian: item.thoiGian || "",
        moTa: item.moTa || item.ghiChu || item.phuTrach || "",
      }));
    }
  } catch {}

  const items = raw
    .split(/(?:^|;)\s*(?=\d+[\.\)]|\b[A-ZĐ])/g)
    .filter((s) => s.trim());
  return items.map((item, idx) => {
    let clean = item.replace(/^\d+[\.\)]\s*/, "").trim();
    let thoiGian = "";
    let moTa = "";

    const tgMatch = clean.match(/(?:thời gian|thoi gian)\s*:\s*([^,;]+)/i);
    if (tgMatch) {
      thoiGian = tgMatch[1].trim();
      clean = clean.replace(tgMatch[0], "").replace(/,\s*,/g, ",").trim();
    }

    const ptMatch = clean.match(/(?:phụ trách|mô tả|mo ta|ghi chú)\s*:\s*([^;]+)/i);
    if (ptMatch) {
      moTa = ptMatch[1].trim();
      clean = clean.replace(ptMatch[0], "").replace(/,\s*,/g, ",").trim();
    }

    clean = clean.replace(/^,\s*|,\s*$/g, "").trim();
    return {
      stt: idx + 1,
      noiDung: clean,
      thoiGian: thoiGian,
      moTa: moTa || "Theo phân công",
    };
  });
}

const COMMON_PDF_STYLES = `
  @page {
    size: A4;
    margin-top: 15mm;
    margin-bottom: 18mm;
    margin-left: 10mm;
    margin-right: 10mm;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 13pt;
    line-height: 1.42;
    color: #000000;
    background: #ffffff;
    margin: 0 auto;
    padding: 20px 10mm;
    max-width: 920px;
  }
  .no-print {
    margin-bottom: 24px;
    padding: 12px 20px;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .no-print button {
    background: #2563eb;
    color: #ffffff;
    border: none;
    padding: 9px 20px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .header-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
  }
  .header-table td {
    vertical-align: top;
    text-align: center;
    padding: 0;
  }
  .header-left-col {
    width: 44%;
  }
  .header-right-col {
    width: 56%;
  }
  .inst-top {
    font-size: 11pt;
    font-weight: normal;
    text-transform: uppercase;
    line-height: 1.35;
  }
  .inst-city {
    font-size: 11pt;
    font-weight: normal;
    text-transform: uppercase;
    line-height: 1.35;
  }
  .faculty-name {
    font-size: 11.5pt;
    font-weight: bold;
    text-transform: uppercase;
    line-height: 1.35;
    margin-top: 1px;
  }
  .header-line-left {
    width: 135px;
    height: 1px;
    background: #000000;
    margin: 4px auto 0;
  }
  .header-line-right {
    width: 165px;
    height: 1px;
    background: #000000;
    margin: 4px auto 0;
  }
  .country-top {
    font-size: 11.5pt;
    font-weight: bold;
    text-transform: uppercase;
    line-height: 1.35;
  }
  .country-sub {
    font-size: 12pt;
    font-weight: bold;
    line-height: 1.35;
  }
  .header-code-cell, .header-date-cell {
    padding-top: 6px !important;
    vertical-align: top;
    text-align: center;
  }
  .plan-code {
    font-size: 11.5pt;
    margin: 0;
    line-height: 1.35;
  }
  .plan-date {
    font-size: 11.5pt;
    font-style: italic;
    margin: 0;
    line-height: 1.35;
  }

  .plan-main-body {
    padding-left: 1.5cm;
    padding-right: 1.0cm;
    box-sizing: border-box;
    width: 100%;
  }

  .title-box {
    text-align: center;
    margin: 18px 0 16px;
  }
  .plan-title {
    font-size: 14pt;
    font-weight: bold;
    text-transform: uppercase;
    margin: 0 0 4px;
  }
  .plan-subtitle {
    font-size: 13pt;
    font-weight: bold;
    margin: 0 0 4px;
    line-height: 1.35;
  }

  .can-cu-box {
    margin: 12px 0 16px;
    text-align: justify;
  }
  .cancu-line {
    margin: 3px 0;
    text-indent: 25px;
    font-size: 12.5pt;
    font-style: italic;
    line-height: 1.4;
  }

  .sec-h {
    font-size: 13pt;
    font-weight: bold;
    text-transform: uppercase;
    margin: 16px 0 6px;
  }
  .sub-h {
    font-size: 12.5pt;
    font-weight: bold;
    margin: 9px 0 4px;
  }
  .indent-p {
    margin: 4px 0;
    text-indent: 20px;
    line-height: 1.45;
    text-align: justify;
  }
  .dash-item {
    margin: 3px 0 3px 20px;
    line-height: 1.45;
    text-align: justify;
  }

  ul.circle-bullet-list {
    margin: 4px 0 6px 36px;
    padding: 0;
    list-style: none;
  }
  ul.circle-bullet-list li {
    position: relative;
    padding-left: 18px;
    margin: 3px 0;
    line-height: 1.45;
    text-align: justify;
  }
  ul.circle-bullet-list li::before {
    content: "◦";
    position: absolute;
    left: 0;
    font-size: 13pt;
    line-height: 1.35;
    top: -1px;
    font-weight: bold;
  }

  ol.num-judge-list {
    margin: 4px 0 8px 36px;
    padding: 0;
    list-style: none;
  }
  ol.num-judge-list li {
    margin: 3px 0;
    line-height: 1.45;
    text-align: justify;
  }

  table.borderless-committee-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 6px 0;
    font-size: 12.5pt;
    line-height: 1.45;
  }
  table.borderless-committee-table td {
    border: none !important;
    padding: 2px 4px;
    vertical-align: top;
  }

  table.data-table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 14px;
    font-size: 11.5pt;
  }
  table.data-table th, table.data-table td {
    border: 1px solid #000000;
    padding: 6px 8px;
    vertical-align: middle;
  }
  table.data-table th {
    background: #f8fafc;
    font-weight: bold;
    text-align: center;
  }

  .conclusion-p {
    margin: 6px 0;
    text-indent: 25px;
    text-align: justify;
    line-height: 1.45;
  }

  .signatures-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 24px;
    page-break-inside: avoid;
  }
  .signatures-table td {
    text-align: center;
    vertical-align: top;
    padding: 0 6px;
  }
  .sig-role {
    font-size: 11.5pt;
    font-weight: bold;
    text-transform: uppercase;
  }
  .sig-sub {
    font-size: 10.5pt;
    font-style: italic;
    margin-top: 2px;
  }
  .sig-gap {
    height: 70px;
  }
  .sig-name {
    font-size: 11.5pt;
    font-weight: bold;
  }

  .distribution-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    page-break-inside: avoid;
  }
  .distribution-table td {
    border: none;
    padding: 0;
  }
  .noi-nhan-box {
    font-size: 10pt;
    line-height: 1.45;
  }
  .noi-nhan-title {
    font-weight: bold;
    font-style: italic;
    font-size: 10.5pt;
    margin-bottom: 2px;
  }
  .noi-nhan-item {
    margin: 1px 0 1px 6px;
  }

  @media print {
    .no-print {
      display: none !important;
    }
    body {
      padding: 0 !important;
      margin: 0 !important;
      max-width: 100% !important;
    }
    .plan-main-body {
      padding-left: 1.5cm !important;
      padding-right: 1.0cm !important;
    }
  }
`;

/**
 * XUẤT KẾ HOẠCH CHI TIẾT CUỘC THI HỌC THUẬT
 * Theo đúng mẫu người dùng cung cấp:
 * I. MỤC ĐÍCH - YÊU CẦU (1. Mục đích, 2. Yêu cầu)
 * II. TỔ CHỨC THỰC HIỆN
 *   1. Thời gian và địa điểm (Vòng 1, Vòng chung kết)
 *   2. Đối tượng tham gia:
 *      - Đối tượng tham gia: (các gạch đầu dòng tròn rỗng ◦)
 *      - Ban giám khảo gồm: (danh sách đánh số 1, 2, 3...)
 *   3. Nội dung tổ chức (Thể lệ, Tiêu chí đánh giá, Giải thưởng)
 *   4. Phân công thực hiện (Ban chỉ đạo, Ban tổ chức, Ban thư ký, Bảng phân công)
 * Lời kết liên hệ, 3 cột chữ ký (PHÒNG CTSV, TRƯỞNG KHOA, TM. BAN TỔ CHỨC), Nơi nhận.
 */
export function competitionPlanDocument(detail: any): string {
  const cuocThi = detail.cuocThi || null;
  const maHD = detail.MaHD || "";
  const namHoc = detail.NamHoc || "2024–2025";
  const rawTenCuocThi =
    cuocThi?.TenCuocThi ||
    detail.TenKeHoach ||
    detail.TenHoatDong ||
    "Cuộc thi Sinh viên nghiên cứu khoa học cấp Khoa";
  const cleanTenCuocThi = String(rawTenCuocThi)
    .replace(/^["'“”«»]+|["'“”«»]+$/g, "")
    .trim();

  let rawSoKeHoach = String(
    cuocThi?.SoKeHoach || detail.SoKeHoach || `${maHD}/KH-KCNTT`
  ).trim();
  if (/^số\s*:\s*/i.test(rawSoKeHoach)) {
    rawSoKeHoach = rawSoKeHoach.replace(/^số\s*:\s*/i, "").trim();
  }
  if (!rawSoKeHoach.includes("/")) {
    rawSoKeHoach = `${rawSoKeHoach}/KH-KCNTT`;
  }

  const today = new Date();
  const dateStr = `Tp. Hồ Chí Minh, ngày ${today.getDate()} tháng ${
    today.getMonth() + 1
  } năm ${today.getFullYear()}`;

  // Căn cứ
  const canCuRaw =
    cuocThi?.CanCu ||
    detail.CanCu ||
    "Căn cứ Thông báo số 913/TB-DCT ngày 24 tháng 9 năm 2024 về việc tổ chức hoạt động học thuật dành cho sinh viên năm học 2024 – 2025 của Trường Đại học Công Thương Thành phố Hồ Chí Minh; Căn cứ Quyết định số 2987/QĐ-DCT ngày 24 tháng 9 năm 2024 về việc chi hỗ trợ tổ chức các hoạt động học thuật dành cho sinh viên năm học 2024 – 2025; Căn cứ Kế hoạch năm học 2024 - 2025 của Khoa Công nghệ Thông tin.";
  const canCuList = formatCanCuList(canCuRaw);
  const canCuHtml = canCuList
    .map((item, idx) => {
      const cleanItem = item.replace(/^;\s*|;\s*$/g, "").trim();
      const isLast = idx === canCuList.length - 1;
      const endChar = cleanItem.endsWith(".") || cleanItem.endsWith(";") ? "" : isLast ? "." : ";";
      return `<p class="cancu-line"><em>${escapeHtml(cleanItem)}${endChar}</em></p>`;
    })
    .join("");

  // Mục đích
  const mucDichRaw =
    cuocThi?.MucDich ||
    detail.NoiDung ||
    detail.NoiDungHoatDong ||
    "Tạo sân chơi học thuật cho sinh viên khoa CNTT nhằm mở rộng kiến thức chuyên môn, rèn luyện tư duy sáng tạo và tinh thần chủ động trong học tập. Phát triển kỹ năng mềm như giao tiếp, làm việc nhóm trình bày hiệu quả sản phẩm, kết quả nghiên cứu của tập thể.";
  const mucDichList = formatBulletList(mucDichRaw);
  const mucDichHtml =
    mucDichList.length > 0
      ? mucDichList.map((m) => `<p class="dash-item">&ndash; ${escapeHtml(m)}</p>`).join("")
      : `<p class="dash-item">&ndash; ${escapeHtml(mucDichRaw)}</p>`;

  // Yêu cầu
  const yeuCauRaw =
    cuocThi?.YeuCau ||
    detail.YeuCau ||
    "Sinh viên chấp hành đúng thể lệ và tiến độ cuộc thi; các sản phẩm dự thi đảm bảo tính trung thực, sáng tạo và khả thi. Mỗi đội tham gia có một giảng viên thuộc Khoa Công nghệ Thông tin hướng dẫn.";
  const yeuCauList = formatBulletList(yeuCauRaw);
  const yeuCauHtml =
    yeuCauList.length > 0
      ? yeuCauList.map((y) => `<p class="dash-item">&ndash; ${escapeHtml(y)}</p>`).join("")
      : `<p class="dash-item">&ndash; ${escapeHtml(yeuCauRaw)}</p>`;

  // 1. Thời gian và địa điểm
  const noiDungThucHien: any[] = Array.isArray(detail.noiDungThucHien)
    ? detail.noiDungThucHien
    : [];

  const v1Item = noiDungThucHien.find((w: any) =>
    /vòng 1|sơ khảo|sơ tuyển/i.test(String(w.noiDung || ""))
  );
  const v2Item = noiDungThucHien.find((w: any) =>
    /chung kết|vòng 2/i.test(String(w.noiDung || ""))
  );

  const v1DateText = v1Item ? inferWorkItemDate(v1Item) : "10/01/2025";
  const v2DateText = v2Item ? inferWorkItemDate(v2Item) : "15/04/2025";

  let diaDiemRaw = String(cuocThi?.DiaDiem || detail.DiaDiem || "Phòng B201, B02, B03 Trường Đại học Công Thương TP.HCM").trim();
  diaDiemRaw = diaDiemRaw.replace(/^P+hòng/i, "Phòng");

  // 2. Đối tượng tham gia và Ban giám khảo (Chính xác như ảnh 1)
  const defaultDoiTuongItems = [
    "Ban chỉ đạo;",
    "Ban tổ chức, ban hỗ trợ và thư ký;",
    "Giảng viên, nghiên cứu viên Khoa Công nghệ Thông tin;",
    "Học viên cao học, sinh viên Khoa Công nghệ Thông tin;",
    "Các đội dự thi và giảng viên hướng dẫn;",
  ];

  let rawDoiTuongStr = String(cuocThi?.DoiTuongTG || detail.DoiTuongThamDu || "").trim();
  let doiTuongItems: string[] = [];

  if (rawDoiTuongStr) {
    const parts = rawDoiTuongStr
      .split(/(?:;\s*|\r?\n)+/g)
      .map((s) => s.trim().replace(/^[-–•*o◦]\s*/, ""))
      .filter(Boolean);
    if (parts.length > 1) {
      doiTuongItems = parts.map((p) => (p.endsWith(";") || p.endsWith(".") ? p : `${p};`));
    } else {
      doiTuongItems = defaultDoiTuongItems;
    }
  } else {
    doiTuongItems = defaultDoiTuongItems;
  }

  const doiTuongLisHtml = doiTuongItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("\n");

  const defaultJudges = [
    "ThS. Nguyễn Văn Lễ – Trưởng ban",
    "TS. Nguyễn Thị Định",
    "ThS. Nguyễn Thế Hữu",
    "ThS. Trần Đình Toàn",
    "ThS. Vũ Văn Vinh",
    "ThS. Lê Thị Thùy Lan",
  ];

  const cacBan: any[] = Array.isArray(detail.cacBan)
    ? detail.cacBan
    : (() => {
        try {
          return JSON.parse(String(detail.CacBan || "[]"));
        } catch {
          return [];
        }
      })();

  const giamKhaoBan = cacBan.find(
    (c: any) =>
      String(c.loaiBan || "").toUpperCase() === "GIAM_KHAO" ||
      String(c.tenBan || "").toLowerCase().includes("giám khảo")
  );

  let rawJudgesStr = String(cuocThi?.DSBanGiamKhao || "").trim();
  let judgesList: string[] = [];

  if (rawJudgesStr) {
    let parts: string[] = [];
    if (rawJudgesStr.includes("\n") || rawJudgesStr.includes(";")) {
      parts = rawJudgesStr.split(/(?:;\s*|\r?\n)+/g).map((s) => s.trim()).filter(Boolean);
    } else if (/\d+\.\s+/.test(rawJudgesStr)) {
      parts = rawJudgesStr.split(/(?=\d+\.\s+)/g).map((s) => s.trim()).filter(Boolean);
    } else if (rawJudgesStr.includes("),") || rawJudgesStr.includes(") ,")) {
      parts = rawJudgesStr.split(/\)\s*,\s*/g).map((s) => (s.endsWith(")") ? s : `${s})`).trim()).filter(Boolean);
    } else {
      parts = rawJudgesStr.split(/,\s*(?=[A-ZĐ])/g).map((s) => s.trim()).filter(Boolean);
    }

    const cleaned = parts.map((p) => p.replace(/^\d+[\.\)]\s*/, "").trim()).filter(Boolean);
    if (cleaned.length > 0) {
      judgesList = cleaned;
    } else {
      judgesList = defaultJudges;
    }
  } else if (giamKhaoBan?.thanhVien && giamKhaoBan.thanhVien.length > 0) {
    judgesList = giamKhaoBan.thanhVien.map((m: any) =>
      `${m.hoTen}${m.vaiTro && !m.vaiTro.toLowerCase().includes("thành viên") && !m.vaiTro.toLowerCase().includes("ủy viên") ? ` – ${m.vaiTro}` : ""}`
    );
  } else {
    judgesList = defaultJudges;
  }

  const giamKhaoLisHtml = judgesList
    .map((j, idx) => `<li>${idx + 1}. ${escapeHtml(j)}</li>`)
    .join("\n");

  // 3. Nội dung tổ chức: Thể lệ, Tiêu chí đánh giá, Giải thưởng
  const theLeRaw =
    cuocThi?.TheLe ||
    detail.TheLe ||
    "Sinh viên dự thi theo hình thức cá nhân hoặc đội nhóm. Sản phẩm dự thi không được sao chép và tuân thủ quy chế thi. Ban tổ chức sử dụng các sản phẩm tiêu biểu phục vụ mục đích đào tạo và truyền thông. Quyết định của Ban giám khảo là quyết định cuối cùng.";
  const theLeList = formatBulletList(theLeRaw);
  const theLeHtml =
    theLeList.length > 1
      ? theLeList.map((t) => `<p class="dash-item">&ndash; ${escapeHtml(t)}</p>`).join("")
      : `<p class="indent-p">${escapeHtml(theLeRaw)}</p>`;

  const tieuChiRaw =
    cuocThi?.TieuChiCham ||
    detail.TieuChiCham ||
    "Tính khả thi và ứng dụng (40%), Tính logic, hợp lý khả năng mở rộng ứng dụng (30%). Tính sáng tạo, ý tưởng và cách trình bày (20%). Hình thức báo cáo và trình bày sản phẩm (10%).";
  const tieuChiList = formatCriteriaList(tieuChiRaw);
  const tieuChiHtml =
    tieuChiList.length > 1
      ? tieuChiList.map((t) => `<p class="dash-item">&ndash; ${escapeHtml(t)}</p>`).join("")
      : `<p class="indent-p">${escapeHtml(tieuChiRaw)}</p>`;

  const giaiThuongRaw =
    cuocThi?.GiaiThuong ||
    "01 Giải Nhất (5.000.000đ + Giấy khen), 01 Giải Nhì (3.000.000đ), 02 Giải Ba (2.000.000đ), 03 Giải Khuyến khích (1.000.000đ)";
  const giaiThuongList = formatPrizesList(giaiThuongRaw);
  const giaiThuongHtml =
    giaiThuongList.length > 1
      ? giaiThuongList.map((g) => `<p class="dash-item">&ndash; ${escapeHtml(g)}</p>`).join("")
      : `<p class="indent-p">${escapeHtml(giaiThuongRaw)}</p>`;

  // 4. Phân công thực hiện: Ban chỉ đạo, Ban tổ chức, Ban thư ký
  const chiDaoBan = cacBan.find(
    (c: any) =>
      String(c.loaiBan || "").toUpperCase() === "CHI_DAO" ||
      String(c.tenBan || "").toLowerCase().includes("chỉ đạo")
  );
  const chiDaoMembers: any[] = Array.isArray(chiDaoBan?.thanhVien) ? chiDaoBan.thanhVien : [];
  const chiDaoList: Array<{ hoTen: string; chucDanh: string; vaiTro: string }> =
    chiDaoMembers.length > 0
      ? chiDaoMembers.map((m: any) => ({
          hoTen: m.hoTen || "",
          chucDanh: m.chucDanh || "Trưởng khoa",
          vaiTro: m.vaiTro || m.nhiemVu || "Trưởng ban",
        }))
      : [
          { hoTen: "TS. Nguyễn Hồng Thanh", chucDanh: "Trưởng khoa", vaiTro: "Trưởng ban" },
          { hoTen: "ThS. Nguyễn Trần Công Danh", chucDanh: "Phó Trưởng khoa", vaiTro: "Phó ban" },
        ];
  const banChiDaoHtml = renderCommitteeList("Ban chỉ đạo", chiDaoList);

  const toChucBan = cacBan.find(
    (c: any) =>
      String(c.loaiBan || "").toUpperCase() === "TO_CHUC" ||
      String(c.tenBan || "").toLowerCase().includes("tổ chức")
  );
  const toChucMembers: any[] = Array.isArray(toChucBan?.thanhVien) ? toChucBan.thanhVien : [];
  const toChucList: Array<{ hoTen: string; chucDanh: string; vaiTro: string }> =
    toChucMembers.length > 0
      ? toChucMembers.map((m: any) => ({
          hoTen: m.hoTen || "",
          chucDanh: m.chucDanh || "Giảng viên",
          vaiTro: m.vaiTro || m.nhiemVu || "Ủy viên",
        }))
      : [
          { hoTen: "ThS. Nguyễn Văn Linh", chucDanh: "Phụ trách bộ môn", vaiTro: "Trưởng ban" },
          { hoTen: "ThS. Nguyễn Văn Lễ", chucDanh: "Giảng viên", vaiTro: "Ủy viên" },
          { hoTen: "ThS. Lê Thị Vân Anh", chucDanh: "Giảng viên", vaiTro: "Ủy viên" },
        ];
  const banToChucHtml = renderCommitteeList("Ban tổ chức", toChucList);

  const thuKyBan = cacBan.find(
    (c: any) =>
      String(c.loaiBan || "").toUpperCase() === "THU_KY" ||
      String(c.tenBan || "").toLowerCase().includes("thư ký")
  );
  const thuKyMembers: any[] = Array.isArray(thuKyBan?.thanhVien) ? thuKyBan.thanhVien : [];
  const thuKyList: Array<{ hoTen: string; chucDanh: string; vaiTro: string }> =
    thuKyMembers.length > 0
      ? thuKyMembers.map((m: any) => ({
          hoTen: m.hoTen || "",
          chucDanh: m.chucDanh || "Giảng viên",
          vaiTro: m.vaiTro || m.nhiemVu || "Trưởng ban",
        }))
      : [
          { hoTen: "TS. Nguyễn Thị Định", chucDanh: "Giảng viên", vaiTro: "Trưởng ban" },
        ];
  const banThuKyHtml = renderCommitteeList("Ban thư ký", thuKyList);

  // Các ban khác nếu có
  let otherCommitteesHtml = "";
  for (const b of cacBan) {
    if (b === chiDaoBan || b === toChucBan || b === thuKyBan) continue;
    const members: any[] = Array.isArray(b.thanhVien) ? b.thanhVien : [];
    if (!members.length) continue;
    const list = members.map((m: any) => ({
      hoTen: m.hoTen || "",
      chucDanh: m.chucDanh || "Giảng viên",
      vaiTro: m.vaiTro || m.nhiemVu || "Thành viên",
    }));
    otherCommitteesHtml += renderCommitteeList(b.tenBan || "Ban khác", list);
  }

  // Bảng phân công chi tiết
  let noiDungPhanCongRowsHtml = "";
  if (noiDungThucHien && noiDungThucHien.length > 0) {
    noiDungThucHien.forEach((w: any, idx: number) => {
      const tgDisplay = inferWorkItemDate(w);
      noiDungPhanCongRowsHtml += `
        <tr>
          <td style="text-align: center;">${w.stt ?? idx + 1}</td>
          <td>${escapeHtml(w.noiDung || "")}</td>
          <td style="text-align: center;">${escapeHtml(tgDisplay)}</td>
          <td>${escapeHtml(w.hoTen || "Chưa phân công")}</td>
        </tr>
      `;
    });
  } else {
    noiDungPhanCongRowsHtml = `
      <tr>
        <td style="text-align: center;">1</td>
        <td>Xây dựng kế hoạch chi tiết cuộc thi, lập Ban Tổ chức, Ban Giám khảo, Ban đề thi.</td>
        <td style="text-align: center;">15/12/2024</td>
        <td>ThS. Nguyễn Văn Linh; ThS. Nguyễn Văn Lễ</td>
      </tr>
      <tr>
        <td style="text-align: center;">2</td>
        <td>Triển khai thông báo cuộc thi trên các kênh truyền thông của Khoa (website, fanpage, YouTube); hướng dẫn sinh viên đăng ký tham gia.</td>
        <td style="text-align: center;">20/12/2024</td>
        <td>ThS. Nguyễn Đình Hữu</td>
      </tr>
      <tr>
        <td style="text-align: center;">3</td>
        <td>Tiếp nhận hồ sơ đăng ký, thuyết minh đề tài của các đội dự thi.</td>
        <td style="text-align: center;">05/01/2025</td>
        <td>Cô Nguyễn Thị Tâm; Cô Nguyễn Thị Thùy Lan</td>
      </tr>
      <tr>
        <td style="text-align: center;">4</td>
        <td>Tổ chức cuộc thi vòng 1 (Sơ tuyển)</td>
        <td style="text-align: center;">10/01/2025</td>
        <td>Ban Tổ chức, Ban Giám khảo, Ban Đề thi, sinh viên hỗ trợ</td>
      </tr>
      <tr>
        <td style="text-align: center;">5</td>
        <td>Công bố kết quả sơ tuyển và danh sách các đội vào vòng chung kết trên website, fanpage Khoa.</td>
        <td style="text-align: center;">15/01/2025</td>
        <td>ThS. Nguyễn Đình Hữu</td>
      </tr>
      <tr>
        <td style="text-align: center;">6</td>
        <td>Chuẩn bị địa điểm tổ chức, phòng thi, thiết bị trình chiếu, âm thanh, bàn ghế phục vụ vòng chung kết.</td>
        <td style="text-align: center;">10/04/2025</td>
        <td>Cô Đinh Thi Diễm Kiều; Thầy Nguyễn Đình Hữu</td>
      </tr>
      <tr>
        <td style="text-align: center;">7</td>
        <td>Tổ chức thi vòng chung kết cấp Khoa.</td>
        <td style="text-align: center;">15/04/2025</td>
        <td>Ban Tổ chức, Ban Giám khảo, Ban Đề thi, sinh viên hỗ trợ</td>
      </tr>
      <tr>
        <td style="text-align: center;">8</td>
        <td>Tổng hợp kết quả cuộc thi, lập biên bản, danh sách ký tên, hoàn thiện hồ sơ thanh toán và quyết toán kinh phí.</td>
        <td style="text-align: center;">25/04/2025</td>
        <td>Cô Nguyễn Thị Định; Cô Nguyễn Thị Thùy Lan</td>
      </tr>
    `;
  }

  // Người liên hệ Ban tổ chức
  const truongBanToChuc =
    toChucBan?.thanhVien?.find((m: any) =>
      String(m.vaiTro || m.nhiemVu || "").toLowerCase().includes("trưởng")
    ) || toChucBan?.thanhVien?.[0];
  const tenTruongBanToChuc = truongBanToChuc?.hoTen || toChucList[0]?.hoTen || "ThS. Nguyễn Văn Linh";

  let lienHeName = tenTruongBanToChuc;
  if (!lienHeName.toLowerCase().startsWith("thầy") && !lienHeName.toLowerCase().startsWith("cô")) {
    lienHeName = `thầy ${lienHeName}`;
  }

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Kế hoạch chi tiết cuộc thi - ${escapeHtml(cleanTenCuocThi)}</title>
  <style>
    ${COMMON_PDF_STYLES}
  </style>
</head>
<body>
  <div class="no-print">
    <div>
      <strong style="color:#1e293b;font-size:15px;">Kế hoạch chi tiết cuộc thi: #${escapeHtml(maHD)} &ndash; ${escapeHtml(cleanTenCuocThi)}</strong>
      <div style="color:#64748b;font-size:13px;margin-top:2px;">Trong hộp thoại in, chọn mục &quot;Save as PDF&quot; (Lưu dưới dạng PDF) để tải tệp.</div>
    </div>
    <button type="button" onclick="window.print()">In / Lưu thành PDF</button>
  </div>

  <!-- Phần tiêu đề cơ quan & quốc hiệu -->
  <table class="header-table">
    <tr>
      <td class="header-left-col">
        <div class="inst-top">TRƯỜNG ĐẠI HỌC CÔNG THƯƠNG</div>
        <div class="inst-city">THÀNH PHỐ HỒ CHÍ MINH</div>
        <div class="faculty-name">KHOA CÔNG NGHỆ THÔNG TIN</div>
        <div class="header-line-left"></div>
      </td>
      <td class="header-right-col">
        <div class="country-top">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div class="country-sub">Độc lập &ndash; Tự do &ndash; Hạnh phúc</div>
        <div class="header-line-right"></div>
      </td>
    </tr>
    <tr>
      <td class="header-left-col header-code-cell">
        <div class="plan-code">Số: ${escapeHtml(rawSoKeHoach)}</div>
      </td>
      <td class="header-right-col header-date-cell">
        <div class="plan-date">${dateStr}</div>
      </td>
    </tr>
  </table>

  <!-- Thân kế hoạch -->
  <div class="plan-main-body">
    <div class="title-box">
      <div class="plan-title">KẾ HOẠCH</div>
      <div class="plan-subtitle">${escapeHtml(cleanTenCuocThi)}</div>
    </div>

    <!-- Căn cứ -->
    <div class="can-cu-box">
      ${canCuHtml}
    </div>

    <!-- I. MỤC ĐÍCH - YÊU CẦU -->
    <div class="sec-h">I. MỤC ĐÍCH &ndash; YÊU CẦU</div>
    <div class="sub-h">1. Mục đích</div>
    ${mucDichHtml}

    <div class="sub-h">2. Yêu cầu</div>
    ${yeuCauHtml}

    <!-- II. TỔ CHỨC THỰC HIỆN -->
    <div class="sec-h">II. TỔ CHỨC THỰC HIỆN</div>
    <div class="sub-h">1. Thời gian và địa điểm</div>
    <p class="indent-p"><strong>Thời gian:</strong></p>
    <p class="dash-item">&ndash; Từ 7g00 đến 11g30, ngày ${escapeHtml(v1DateText)}: Tổ chức vòng 1</p>
    <p class="dash-item">&ndash; Từ 7g00 đến 11g30, ngày ${escapeHtml(v2DateText)}: Tổ chức vòng chung kết</p>
    <p class="indent-p" style="margin-top: 6px;"><strong>Địa điểm:</strong></p>
    <p class="dash-item">&ndash; Vòng 1: ${escapeHtml(diaDiemRaw)}</p>
    <p class="dash-item">&ndash; Vòng 2: ${escapeHtml(diaDiemRaw)}</p>

    <!-- 2. Đối tượng tham gia (Đúng chuẩn Ảnh 1) -->
    <div class="sub-h">2. Đối tượng tham gia</div>
    <p class="dash-item" style="font-weight: 500;">&ndash; Đối tượng tham gia:</p>
    <ul class="circle-bullet-list">
      ${doiTuongLisHtml}
    </ul>
    <p class="dash-item" style="margin-top: 6px; font-weight: 500;">&ndash; Ban giám khảo gồm:</p>
    <ol class="num-judge-list">
      ${giamKhaoLisHtml}
    </ol>

    <!-- 3. Nội dung tổ chức -->
    <div class="sub-h">3. Nội dung tổ chức</div>
    <p class="indent-p"><strong>Thể lệ:</strong></p>
    ${theLeHtml}

    <p class="indent-p" style="margin-top: 6px;"><strong>Tiêu chí đánh giá:</strong></p>
    ${tieuChiHtml}

    <p class="indent-p" style="margin-top: 6px;"><strong>Giải thưởng:</strong></p>
    ${giaiThuongHtml}

    <!-- 4. Phân công thực hiện -->
    <div class="sub-h">4. Phân công thực hiện</div>
    ${banChiDaoHtml}
    ${banToChucHtml}
    ${banThuKyHtml}
    ${otherCommitteesHtml}

    <p class="indent-p" style="margin-top: 8px; margin-bottom: 4px;">
      <strong>Phân công:</strong>
    </p>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 45px; text-align: center;">STT</th>
          <th style="width: 44%;">Nội dung thực hiện</th>
          <th style="width: 24%; text-align: center;">Thời gian hoàn thành</th>
          <th style="width: 27%;">Phân công thực hiện</th>
        </tr>
      </thead>
      <tbody>
        ${noiDungPhanCongRowsHtml}
      </tbody>
    </table>

    <p class="conclusion-p">
      Trên đây là kế hoạch chi tiết về chương trình tổ chức cuộc thi học thuật cấp khoa của Khoa Công nghệ thông tin năm học ${escapeHtml(namHoc)}. Mọi thắc mắc sinh viên liên hệ ${escapeHtml(lienHeName)} (trưởng ban trong Ban tổ chức) email: linhnv@huit.edu.vn.
    </p>
    <p class="conclusion-p" style="margin-top: 3px;">
      Trân trọng.
    </p>

    <!-- Chữ ký 3 cột -->
    <table class="signatures-table">
      <tr>
        <td style="width: 33%;">
          <div class="sig-role">PHÒNG CTSV</div>
          <div class="sig-sub">(Ký duyệt)</div>
          <div class="sig-gap"></div>
          <div class="sig-name"></div>
        </td>
        <td style="width: 34%;">
          <div class="sig-role">TRƯỞNG KHOA</div>
          <div class="sig-sub">(Ký duyệt)</div>
          <div class="sig-gap"></div>
          <div class="sig-name">TS. Nguyễn Hồng Thanh</div>
        </td>
        <td style="width: 33%;">
          <div class="sig-role">TM. BAN TỔ CHỨC</div>
          <div class="sig-sub">(Ký và ghi rõ họ tên)</div>
          <div class="sig-gap"></div>
          <div class="sig-name">${escapeHtml(tenTruongBanToChuc)}</div>
        </td>
      </tr>
    </table>

    <!-- Nơi nhận -->
    <table class="distribution-table">
      <tr>
        <td style="width: 50%; vertical-align: top;">
          <div class="noi-nhan-box">
            <div class="noi-nhan-title">Nơi nhận:</div>
            <div class="noi-nhan-item">&ndash; Phòng CTSV để tính ĐRL;</div>
            <div class="noi-nhan-item">&ndash; BCN Khoa CNTT để báo cáo;</div>
            <div class="noi-nhan-item">&ndash; GV, CVHT, HV, SV khoa CNTT;</div>
            <div class="noi-nhan-item">&ndash; Lưu: VP khoa CNTT.</div>
          </div>
        </td>
        <td style="width: 50%;"></td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

/**
 * XUẤT KẾ HOẠCH CHI TIẾT SEMINAR
 */
export function seminarPlanDocument(detail: any): string {
  const seminar = detail.seminar || null;
  const maHD = detail.MaHD || "";
  const namHoc = detail.NamHoc || "2024–2025";
  const rawChuDe = seminar?.ChuDe || detail.TenKeHoach || detail.TenHoatDong || "";
  const cleanChuDe = String(rawChuDe)
    .replace(/^["'“”«»]+|["'“”«»]+$/g, "")
    .trim();

  let rawSoKeHoach = String(
    seminar?.SoKeHoach || detail.SoKeHoach || `SEM-CNTT-${maHD}/${namHoc}`
  ).trim();
  if (/^số\s*:\s*/i.test(rawSoKeHoach)) {
    rawSoKeHoach = rawSoKeHoach.replace(/^số\s*:\s*/i, "").trim();
  }

  const canCuRaw =
    seminar?.CanCu ||
    detail.CanCu ||
    "Căn cứ Kế hoạch tổ chức các hoạt động học thuật cho sinh viên Khoa Công nghệ Thông tin năm học 2024 – 2025.";
  const canCuList = formatCanCuList(canCuRaw);

  const mucDichRaw = seminar?.MucDich || detail.NoiDung || detail.NoiDungHoatDong || "";
  const mucDichList = formatBulletList(mucDichRaw);

  const yeuCauRaw =
    seminar?.YeuCau ||
    "Sinh viên, học viên và giảng viên Khoa Công nghệ thông tin tham gia đầy đủ, đúng giờ.";
  const yeuCauList = formatBulletList(yeuCauRaw);

  const thoiGian =
    seminar?.ThoiGian ||
    (detail.ThoiGianBatDau
      ? new Date(detail.ThoiGianBatDau).toLocaleString("vi-VN")
      : "Ngày 07/03/2025 (từ 07h30 đến 11h30)");
  const diaDiem = seminar?.DiaDiem || detail.DiaDiem || "Trung tâm thư viện F401";
  const slsv = seminar?.SLSVDuKien || detail.SLSVDuKien || "150";
  const rawDoiTuong =
    seminar?.DoiTuongTG ||
    detail.DoiTuongThamDu ||
    "Ban chỉ đạo; Ban hỗ trợ; Ban tổ chức; Giảng viên Khoa Công nghệ Thông tin; Sinh viên, học viên Khoa Công nghệ Thông tin.";

  // Các ban
  const cacBan: any[] = Array.isArray(detail.cacBan)
    ? detail.cacBan
    : (() => {
        try {
          return JSON.parse(String(detail.CacBan || "[]"));
        } catch {
          return [];
        }
      })();

  const chiDaoBan = cacBan.find(
    (c: any) =>
      String(c.loaiBan || "").toUpperCase() === "CHI_DAO" ||
      String(c.tenBan || "").toLowerCase().includes("chỉ đạo")
  );
  const chiDaoMembers: any[] = Array.isArray(chiDaoBan?.thanhVien) ? chiDaoBan.thanhVien : [];
  const chiDaoList: Array<{ hoTen: string; chucDanh: string; vaiTro: string }> =
    chiDaoMembers.length > 0
      ? chiDaoMembers.map((m: any) => ({
          hoTen: m.hoTen || "",
          chucDanh: m.chucDanh || "Trưởng khoa",
          vaiTro: m.vaiTro || m.nhiemVu || "Trưởng ban",
        }))
      : [
          { hoTen: "TS. Nguyễn Hồng Thanh", chucDanh: "Trưởng khoa", vaiTro: "Trưởng ban" },
          { hoTen: "ThS. Nguyễn Trần Công Danh", chucDanh: "Phó Trưởng khoa", vaiTro: "Phó ban" },
        ];
  const banChiDaoHtml = renderCommitteeList("Ban chỉ đạo", chiDaoList);

  const toChucBan = cacBan.find(
    (c: any) =>
      String(c.loaiBan || "").toUpperCase() === "TO_CHUC" ||
      String(c.tenBan || "").toLowerCase().includes("tổ chức")
  );
  const toChucMembers: any[] = Array.isArray(toChucBan?.thanhVien) ? toChucBan.thanhVien : [];
  const toChucList: Array<{ hoTen: string; chucDanh: string; vaiTro: string }> =
    toChucMembers.length > 0
      ? toChucMembers.map((m: any) => ({
          hoTen: m.hoTen || "",
          chucDanh: m.chucDanh || "Giảng viên",
          vaiTro: m.vaiTro || m.nhiemVu || "Ủy viên",
        }))
      : [
          { hoTen: "ThS. Phan Văn Vinh", chucDanh: "Phụ trách bộ môn", vaiTro: "Trưởng ban" },
          { hoTen: "ThS. Huỳnh Minh Châu", chucDanh: "Giảng viên", vaiTro: "Ủy viên" },
          { hoTen: "ThS. Lê Trần Ngọc Mi", chucDanh: "Giảng viên", vaiTro: "Ủy viên" },
        ];
  const banToChucHtml = renderCommitteeList("Ban tổ chức", toChucList);

  let otherCommitteesHtml = "";
  for (const b of cacBan) {
    if (b === chiDaoBan || b === toChucBan) continue;
    const members: any[] = Array.isArray(b.thanhVien) ? b.thanhVien : [];
    if (!members.length) continue;
    const list = members.map((m: any) => ({
      hoTen: m.hoTen || "",
      chucDanh: m.chucDanh || "Giảng viên",
      vaiTro: m.vaiTro || m.nhiemVu || "Thành viên",
    }));
    otherCommitteesHtml += renderCommitteeList(b.tenBan || "Ban khác", list);
  }

  const truongBan =
    toChucBan?.thanhVien?.find((m: any) =>
      String(m.vaiTro || m.nhiemVu || "").toLowerCase().includes("trưởng")
    ) || toChucBan?.thanhVien?.[0];
  const tenTruongBanToChuc = truongBan?.hoTen || toChucList[0]?.hoTen || detail.TenBM || "ThS. Phan Văn Vinh";

  const noiDungThucHien: any[] = Array.isArray(detail.noiDungThucHien)
    ? detail.noiDungThucHien
    : [];

  let noiDungPhanCongRowsHtml = "";
  if (noiDungThucHien && noiDungThucHien.length > 0) {
    noiDungThucHien.forEach((w: any, idx: number) => {
      const tgDisplay = inferWorkItemDate(w, thoiGian);
      noiDungPhanCongRowsHtml += `
        <tr>
          <td style="text-align: center;">${w.stt ?? idx + 1}</td>
          <td>${escapeHtml(w.noiDung || "")}</td>
          <td style="text-align: center;">${escapeHtml(tgDisplay)}</td>
          <td>${escapeHtml(w.hoTen || "Chưa phân công")}</td>
        </tr>
      `;
    });
  } else {
    noiDungPhanCongRowsHtml = `
      <tr>
        <td style="text-align: center;">1</td>
        <td>Lập kế hoạch chi tiết</td>
        <td style="text-align: center;">15/12/2024</td>
        <td>ThS. Phan Văn Vinh</td>
      </tr>
      <tr>
        <td style="text-align: center;">2</td>
        <td>Triển khai thông báo lên website, fanpage Khoa.</td>
        <td style="text-align: center;">15/12/2024</td>
        <td>PGS.TS. Phạm Hoàng Nguyên</td>
      </tr>
      <tr>
        <td style="text-align: center;">3</td>
        <td>Gửi thư mời tới doanh nghiệp, diễn giả, khách mời.</td>
        <td style="text-align: center;">20/12/2024</td>
        <td>ThS. Phan Văn Vinh</td>
      </tr>
    `;
  }

  const chuongTrinh: any[] = Array.isArray(detail.chuongTrinh) && detail.chuongTrinh.length > 0
    ? detail.chuongTrinh
    : (() => {
        try {
          return JSON.parse(String(seminar?.ChuongTrinh || "[]"));
        } catch {
          return [];
        }
      })();

  let orgFlowRowsHtml = "";
  if (chuongTrinh && chuongTrinh.length > 0) {
    chuongTrinh.forEach((item: any, idx: number) => {
      orgFlowRowsHtml += `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>${escapeHtml(item.noiDung || "")}</td>
          <td style="text-align: center;">${escapeHtml(item.thoiGian || "Theo tiến độ")}</td>
          <td>${escapeHtml(item.dvChuTri || item.phuTrach || "Ban tổ chức")}</td>
        </tr>
      `;
    });
  } else {
    orgFlowRowsHtml = `
      <tr>
        <td style="text-align: center;">1</td>
        <td>Ổn định, điểm danh sinh viên tham gia đầu giờ và các công tác chuẩn bị</td>
        <td style="text-align: center;">07:30 – 07:45</td>
        <td>Thầy Nguyễn Đình Hữu; Thầy Trần Đình Toàn; Câu lạc bộ Học thuật</td>
      </tr>
      <tr>
        <td style="text-align: center;">2</td>
        <td>Giới thiệu chương trình: tuyên bố lý do; giới thiệu khách mời</td>
        <td style="text-align: center;">07:45 – 08:00</td>
        <td>MC: Cô Nguyễn Thị Định</td>
      </tr>
      <tr>
        <td style="text-align: center;">3</td>
        <td>BCN Khoa phát biểu khai mạc</td>
        <td style="text-align: center;">08:00 – 08:10</td>
        <td>Đại diện BCN Khoa</td>
      </tr>
    `;
  }

  const chuDeList: any[] = Array.isArray(detail.chuDeList) && detail.chuDeList.length > 0
    ? detail.chuDeList
    : [];

  let topicsRowsHtml = "";
  if (chuDeList && chuDeList.length > 0) {
    chuDeList.forEach((item: any, idx: number) => {
      const tenDeTai = item.TenChuDe || item.noiDung || item.tenDeTai || item.chuDe || "";
      let tg = "";
      if (item.TgBatDau && item.TgKetThuc) {
        tg = `${item.TgBatDau} – ${item.TgKetThuc}`;
      } else if (item.thoiGian) {
        tg = item.thoiGian;
      } else if (item.TgBatDau) {
        tg = item.TgBatDau;
      } else {
        tg = "Theo chương trình";
      }
      const dienGia =
        item.DienGia || item.dvChuTri || item.phuTrach || item.nguoiTrinhBay || "";
      topicsRowsHtml += `
        <tr>
          <td style="text-align: center;">${item.STT ?? idx + 1}</td>
          <td>${escapeHtml(tenDeTai)}</td>
          <td style="text-align: center;">${escapeHtml(tg)}</td>
          <td>${escapeHtml(dienGia || "—")}</td>
        </tr>
      `;
    });
  } else {
    topicsRowsHtml = `
      <tr>
        <td style="text-align: center;">1</td>
        <td>Báo cáo 1 với chủ đề: Những công nghệ phát triển dự án tại doanh nghiệp.</td>
        <td style="text-align: center;">08:10 – 09:10</td>
        <td>Bà Lê Thị Bảo Trân – Giám đốc, Công ty TNHH Phần Mềm Quốc Bảo.</td>
      </tr>
      <tr>
        <td style="text-align: center;">2</td>
        <td>Báo cáo 2 với chủ đề: Nghiên cứu mô hình ngôn ngữ lớn và ứng dụng.</td>
        <td style="text-align: center;">09:10 – 09:40</td>
        <td>TS. Nguyễn Hồng Bửu Long – Giảng viên Khoa CNTT.</td>
      </tr>
    `;
  }

  const noiDungKhacRaw = seminar?.NoiDung || detail.NoiDungKhac || "";
  const otherContents = parseOtherContents(noiDungKhacRaw);

  let otherRowsHtml = "";
  if (otherContents && otherContents.length > 0) {
    otherContents.forEach((o: any, idx: number) => {
      otherRowsHtml += `
        <tr>
          <td style="text-align: center;">${o.stt ?? idx + 1}</td>
          <td>${escapeHtml(o.noiDung || "")}</td>
          <td style="text-align: center;">${escapeHtml(o.thoiGian || "Theo tiến độ")}</td>
          <td>${escapeHtml(o.moTa || "Ban tổ chức")}</td>
        </tr>
      `;
    });
  } else {
    otherRowsHtml = `
      <tr>
        <td style="text-align: center;">1</td>
        <td>Trao hoa cảm ơn diễn giả</td>
        <td style="text-align: center;">11:20 – 11:25</td>
        <td>BCN khoa</td>
      </tr>
      <tr>
        <td style="text-align: center;">2</td>
        <td>Chụp hình lưu niệm</td>
        <td style="text-align: center;">11:25 – 11:30</td>
        <td>Sinh viên, giảng viên và diễn giả</td>
      </tr>
    `;
  }

  const today = new Date();
  const dateStr = `Tp. Hồ Chí Minh, ngày ${today.getDate()} tháng ${
    today.getMonth() + 1
  } năm ${today.getFullYear()}`;

  const canCuHtml = canCuList
    .map((item, idx) => {
      const cleanItem = item.replace(/^;\s*|;\s*$/g, "").trim();
      const isLast = idx === canCuList.length - 1;
      const endChar = cleanItem.endsWith(".") || cleanItem.endsWith(";") ? "" : isLast ? "." : ";";
      return `<p class="cancu-line"><em>${escapeHtml(cleanItem)}${endChar}</em></p>`;
    })
    .join("");

  const mucDichHtml =
    mucDichList.length > 0
      ? mucDichList.map((m) => `<p class="dash-item">&ndash; ${escapeHtml(m)}</p>`).join("")
      : `<p class="dash-item">&ndash; ${escapeHtml(mucDichRaw)}</p>`;

  const yeuCauHtml =
    yeuCauList.length > 0
      ? yeuCauList.map((y) => `<p class="dash-item">&ndash; ${escapeHtml(y)}</p>`).join("")
      : `<p class="dash-item">&ndash; ${escapeHtml(yeuCauRaw)}</p>`;

  const doiTuongLines: string[] = [];
  if (cacBan && cacBan.length > 0) {
    for (const b of cacBan) {
      doiTuongLines.push(`&ndash; ${escapeHtml(b.tenBan)};`);
    }
  }
  const rawParts = rawDoiTuong.split(/(?:;\s*|\r?\n)+/g).map((s: string) => s.trim()).filter(Boolean);
  for (const part of rawParts) {
    const isCovered = doiTuongLines.some((l) =>
      l.toLowerCase().includes(part.toLowerCase().slice(0, 10))
    );
    if (!isCovered) {
      doiTuongLines.push(`&ndash; ${escapeHtml(part)};`);
    }
  }
  const doiTuongHtml = doiTuongLines.length
    ? doiTuongLines.map((l) => `<p class="dash-item">${l}</p>`).join("")
    : `<p class="dash-item">&ndash; ${escapeHtml(rawDoiTuong)}</p>`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Kế hoạch chi tiết seminar - ${escapeHtml(cleanChuDe)}</title>
  <style>
    ${COMMON_PDF_STYLES}
    .plan-activity-name {
      font-size: 13pt;
      font-weight: bold;
      margin: 0;
    }
    .table-group-header td {
      background: #e2e8f0;
      font-weight: bold;
      text-align: center;
      text-transform: uppercase;
      padding: 7px 8px;
      border-top: 2px solid #000000;
      font-size: 11.5pt;
    }
    .table-sub-header td {
      background: #f1f5f9;
      font-weight: bold;
      padding: 6px 8px;
      font-size: 11.5pt;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div>
      <strong style="color:#1e293b;font-size:15px;">Kế hoạch chi tiết: #${escapeHtml(maHD)} &ndash; ${escapeHtml(cleanChuDe)}</strong>
      <div style="color:#64748b;font-size:13px;margin-top:2px;">Trong hộp thoại in, chọn mục &quot;Save as PDF&quot; (Lưu dưới dạng PDF) để tải tệp.</div>
    </div>
    <button type="button" onclick="window.print()">In / Lưu thành PDF</button>
  </div>

  <table class="header-table">
    <tr>
      <td class="header-left-col">
        <div class="inst-top">TRƯỜNG ĐẠI HỌC CÔNG THƯƠNG</div>
        <div class="inst-city">THÀNH PHỐ HỒ CHÍ MINH</div>
        <div class="faculty-name">KHOA CÔNG NGHỆ THÔNG TIN</div>
        <div class="header-line-left"></div>
      </td>
      <td class="header-right-col">
        <div class="country-top">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div class="country-sub">Độc lập &ndash; Tự do &ndash; Hạnh phúc</div>
        <div class="header-line-right"></div>
      </td>
    </tr>
    <tr>
      <td class="header-left-col header-code-cell">
        <div class="plan-code">Số: ${escapeHtml(rawSoKeHoach)}</div>
      </td>
      <td class="header-right-col header-date-cell">
        <div class="plan-date">${dateStr}</div>
      </td>
    </tr>
  </table>

  <div class="plan-main-body">
    <div class="title-box">
      <div class="plan-title">KẾ HOẠCH</div>
      <div class="plan-subtitle">V/v Tổ chức hoạt động học thuật sinh viên năm học ${escapeHtml(namHoc)}</div>
      <div class="plan-activity-name">&ldquo;${escapeHtml(cleanChuDe)}&rdquo;</div>
    </div>

    <div class="can-cu-box">
      ${canCuHtml}
    </div>

    <div class="sec-h">I. MỤC ĐÍCH &ndash; YÊU CẦU</div>
    <div class="sub-h">1. Mục đích</div>
    ${mucDichHtml}

    <div class="sub-h">2. Yêu cầu</div>
    ${yeuCauHtml}

    <div class="sec-h">II. TỔ CHỨC THỰC HIỆN</div>
    <div class="sub-h">1. Thời gian và địa điểm</div>
    <p class="indent-p"><strong>Thời gian:</strong> ${escapeHtml(thoiGian)}</p>
    <p class="indent-p"><strong>Địa điểm:</strong> ${escapeHtml(diaDiem)}</p>

    <div class="sub-h">2. Đối tượng tham gia và số lượng sinh viên</div>
    <p class="indent-p"><strong>Đối tượng tham gia:</strong></p>
    ${doiTuongHtml}
    <p class="indent-p" style="margin-top: 5px;"><strong>Số lượng sinh viên dự kiến tham gia:</strong> ${escapeHtml(slsv)} sinh viên.</p>

    <div class="sub-h">3. Nội dung tổ chức</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 45px; text-align: center;">STT</th>
          <th style="width: 44%;">Nội dung thực hiện</th>
          <th style="width: 22%; text-align: center;">Thời gian hoàn thành</th>
          <th style="width: 29%;">Người thực hiện</th>
        </tr>
      </thead>
      <tbody>
        ${orgFlowRowsHtml}
        <tr class="table-group-header">
          <td colspan="4">CÁC CHỦ ĐỀ TRÌNH BÀY</td>
        </tr>
        <tr class="table-sub-header">
          <td style="text-align: center;">STT</td>
          <td>Tên đề tài</td>
          <td style="text-align: center;">Thời gian</td>
          <td>Diễn giả</td>
        </tr>
        ${topicsRowsHtml}
        <tr class="table-group-header">
          <td colspan="4">CÁC NỘI DUNG KHÁC</td>
        </tr>
        <tr class="table-sub-header">
          <td style="text-align: center;">STT</td>
          <td>Nội dung</td>
          <td style="text-align: center;">Thời gian</td>
          <td>Mô tả</td>
        </tr>
        ${otherRowsHtml}
      </tbody>
    </table>

    <div class="sub-h">4. Phân công thực hiện</div>
    ${banChiDaoHtml}
    ${banToChucHtml}
    ${otherCommitteesHtml}

    <p class="indent-p" style="margin-top: 8px; margin-bottom: 4px;">
      <strong>Phân công:</strong>
    </p>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 45px; text-align: center;">STT</th>
          <th style="width: 44%;">Nội dung thực hiện</th>
          <th style="width: 22%; text-align: center;">Thời gian hoàn thành</th>
          <th style="width: 29%;">Phân công thực hiện</th>
        </tr>
      </thead>
      <tbody>
        ${noiDungPhanCongRowsHtml}
      </tbody>
    </table>

    <p class="conclusion-p">
      Trên đây là kế hoạch chi tiết về chương trình &ldquo;${escapeHtml(cleanChuDe)}&rdquo; của Khoa Công nghệ thông tin năm học ${escapeHtml(namHoc)}.
    </p>
    <p class="conclusion-p" style="margin-top: 3px;">
      Trân trọng./.
    </p>

    <table class="signatures-table">
      <tr>
        <td style="width: 33%;">
          <div class="sig-role">PHÒNG CTSV</div>
          <div class="sig-sub">(Ký duyệt)</div>
          <div class="sig-gap"></div>
          <div class="sig-name"></div>
        </td>
        <td style="width: 34%;">
          <div class="sig-role">TRƯỞNG KHOA</div>
          <div class="sig-sub">(Ký duyệt)</div>
          <div class="sig-gap"></div>
          <div class="sig-name">TS. Nguyễn Hồng Thanh</div>
        </td>
        <td style="width: 33%;">
          <div class="sig-role">T.M BAN TỔ CHỨC</div>
          <div class="sig-sub">(Ký và ghi rõ họ tên)</div>
          <div class="sig-gap"></div>
          <div class="sig-name">${escapeHtml(tenTruongBanToChuc || "Trưởng Ban Tổ chức")}</div>
        </td>
      </tr>
    </table>

    <table class="distribution-table">
      <tr>
        <td style="width: 48%; vertical-align: top;">
          <div class="noi-nhan-box">
            <div class="noi-nhan-title">Nơi nhận:</div>
            <div class="noi-nhan-item">&ndash; Phòng CTSV để tính ĐRL;</div>
            <div class="noi-nhan-item">&ndash; BCN khoa CNTT để báo cáo;</div>
            <div class="noi-nhan-item">&ndash; GV, CVHT, HV, SV khoa CNTT;</div>
            <div class="noi-nhan-item">&ndash; Lưu: VP khoa CNTT.</div>
          </div>
        </td>
        <td style="width: 52%;"></td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

/**
 * XUẤT KẾ HOẠCH CHI TIẾT TỔNG QUÁT:
 * Phân biệt Cuộc thi hoặc Seminar tự động theo LoaiHoatDong
 */
export function detailedPlanDocument(detail: any): string {
  const isCompetition =
    String(detail.LoaiHoatDong || "").trim().toLowerCase() === "cuộc thi" ||
    Boolean(detail.cuocThi && !String(detail.LoaiHoatDong || "").trim().toLowerCase().includes("seminar"));

  if (isCompetition) {
    return competitionPlanDocument(detail);
  }
  return seminarPlanDocument(detail);
}

export function exportDetailedPlanPdf(detail: any): boolean {
  const printWindow = window.open("", "_blank", "width=1050,height=800");
  if (!printWindow) {
    alert("Trình duyệt đã chặn cửa sổ xuất PDF. Hãy cho phép pop-up và thử lại.");
    return false;
  }
  printWindow.document.open();
  printWindow.document.write(detailedPlanDocument(detail));
  printWindow.document.close();
  let didPrint = false;
  const print = () => {
    if (didPrint || printWindow.closed) return;
    didPrint = true;
    printWindow.focus();
    printWindow.print();
  };
  printWindow.addEventListener("load", () => window.setTimeout(print, 200), { once: true });
  window.setTimeout(print, 600);
  return true;
}
