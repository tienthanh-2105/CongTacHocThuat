"use client";

import { useMemo, useState, type FormEvent } from "react";
import s from "./dashboard.module.css";

type Row = Record<string, unknown>;

export type WorkItemRow = {
  id?: string;
  stt: number;
  noiDung: string;
  thoiGian: string;
  maTK: number;
  hoTen?: string;
};

const text = (r: Row | null | undefined, k: string) => String(r?.[k] ?? "");

export function CompetitionPlanEditor({
  selected,
  busy,
  onSave,
  onDirty,
}: {
  selected: Row;
  busy: boolean;
  onSave: (val: Row) => Promise<void>;
  onDirty: () => void;
}) {
  const cuocThi = (selected.cuocThi as Row) || null;
  const maHD = text(selected, "MaHD");
  const maCThi = text(cuocThi, "MaCThi") || text(selected, "MaCThi");
  const isTechInnovators = Number(maHD) === 42 || text(selected, "TenHoatDong").toLowerCase().includes("tech innovators");

  // Mã cuộc thi: hiển thị mã hiện tại hoặc mã tiếp theo được lưu trong DB
  const nextIdFromDb = selected.nextMaCThi ? String(selected.nextMaCThi) : "24";
  const displayMaCThi = maCThi ? `#${maCThi}` : `#${nextIdFromDb}`;

  // Danh sách giảng viên phân ra từng bộ môn
  const staffGroupedByDept = useMemo(() => {
    const list = Array.isArray(selected.staff) ? selected.staff : [];
    const groups: Record<string, Array<{ maTK: number; hoTen: string; label: string }>> = {};

    for (const st of list) {
      const hoTen = String(st.HoTen || "").trim();
      const hocVi = String(st.HocVi || "").trim();
      let dept = String(st.TenBM || st.DonViCongTac || "").trim();
      if (!dept) dept = "Bộ môn khác";
      else if (!dept.toLowerCase().startsWith("bộ môn") && !dept.toLowerCase().startsWith("khoa")) {
        dept = `Bộ môn ${dept}`;
      }

      let prefix = "";
      if (hocVi && !/^(PGS\.TS\.|GS\.TS\.|PGS\.|GS\.|TS\.|ThS\.|KS\.|CN\.)\s+/i.test(hoTen)) {
        if (/tiến sĩ|ts/i.test(hocVi)) prefix = "TS.";
        else if (/thạc sĩ|ths/i.test(hocVi)) prefix = "ThS.";
        else prefix = hocVi;
      }
      const formattedName = prefix ? `${prefix} ${hoTen}` : hoTen;

      if (!groups[dept]) groups[dept] = [];
      groups[dept].push({
        maTK: Number(st.MaTK ?? 0),
        hoTen: formattedName,
        label: formattedName,
      });
    }

    return groups;
  }, [selected.staff]);

  // Hàng 1
  const defaultSoKeHoach =
    text(cuocThi, "SoKeHoach") ||
    text(selected, "SoKeHoach") ||
    (isTechInnovators ? "18/KH-CNTT" : `KH-CT-${maHD}/${text(selected, "NamHoc") || "2024-2025"}`);

  const defaultTenCuocThi =
    text(cuocThi, "TenCuocThi") ||
    text(selected, "TenCuocThi") ||
    text(selected, "TenKeHoach") ||
    text(selected, "TenHoatDong") ||
    "Cuộc thi học thuật";

  // Hàng 2: Căn cứ & Mục đích
  const defaultCanCu =
    text(cuocThi, "CanCu") ||
    text(selected, "CanCu") ||
    (isTechInnovators
      ? "Căn cứ Kế hoạch năm học 2024 - 2025 của Trường ĐH Công Thương TP.HCM và Kế hoạch hoạt động học thuật của Khoa Công nghệ thông tin."
      : "Căn cứ Thông báo số 913/TB-DCT ngày 24 tháng 9 năm 2024 về việc tổ chức hoạt động học thuật dành cho sinh viên năm học 2024 – 2025 của Trường Đại học Công Thương Thành phố Hồ Chí Minh; Căn cứ Quyết định số 2987/QĐ-DCT ngày 24 tháng 9 năm 2024 về việc chi hỗ trợ tổ chức các hoạt động học thuật dành cho sinh viên năm học 2024 – 2025.");

  const defaultMucDich =
    text(cuocThi, "MucDich") ||
    text(selected, "MucDich") ||
    text(selected, "NoiDung") ||
    text(selected, "NoiDungHoatDong") ||
    (isTechInnovators
      ? "Tech Innovators Challenge là cuộc thi dành cho các cá nhân và nhóm đam mê công nghệ, nhằm tìm kiếm và khuyến khích những ý tưởng sáng tạo và sản phẩm đột phá trong lĩnh vực Công nghệ thông tin."
      : "Cuộc thi nhằm khuyến khích các đề tài nghiên cứu khoa học của sinh viên thuộc Khoa Công nghệ Thông tin, từ đó lựa chọn những đề tài có tiềm năng để tham gia các cuộc thi ở cấp cao hơn. Thông qua cuộc thi, sinh viên có cơ hội phát huy niềm đam mê nghiên cứu khoa học, nâng cao năng lực nghiên cứu, triển khai các đề tài và dự án có tính ứng dụng trong thực tiễn. Đây cũng là cơ hội để lựa chọn những đội thi xuất sắc, chuẩn bị tham gia cuộc thi Sinh viên nghiên cứu khoa học cấp Trường.");

  // Hàng 3 & 4 (ghép): Yêu cầu (chiếm 2 dòng) | Cấp tổ chức, Vòng thi | Thời gian, Địa điểm
  const defaultYeuCau =
    text(cuocThi, "YeuCau") ||
    text(selected, "YeuCau") ||
    "Sinh viên chấp hành đúng thể lệ và tiến độ cuộc thi; các sản phẩm dự thi đảm bảo tính trung thực, sáng tạo và khả thi. Mỗi đội tham gia có một giảng viên thuộc Khoa Công nghệ Thông tin hướng dẫn.";

  const defaultCapToChuc =
    text(cuocThi, "CapToChuc") ||
    text(selected, "CapToChuc") ||
    text(selected, "CapTC") ||
    "Cấp Khoa";

  const defaultVongThi =
    text(cuocThi, "VongThi") ||
    text(selected, "VongThi") ||
    (isTechInnovators
      ? "Giai đoạn chuẩn bị (05/2025), Vòng 1: Chấm sơ loại (06/2025), Vòng chung kết (06/2025)"
      : "Vòng 1: Sơ khảo, Vòng 2: Chung kết");

  const defaultThoiGian =
    text(cuocThi, "ThoiGian") ||
    (isTechInnovators
      ? "Từ tháng 03 - 05/2025"
      : selected?.ThoiGianBatDau
      ? new Date(String(selected.ThoiGianBatDau)).toLocaleDateString("vi-VN")
      : "Từ tháng 03 - 05/2025");

  const defaultDiaDiem =
    text(cuocThi, "DiaDiem") ||
    text(selected, "DiaDiem") ||
    "Hội trường C - Trường ĐH Công Thương TP.HCM";

  // Hàng 5: Số lượng sinh viên dự kiến | Đối tượng tham gia | Hình thức đăng ký | Ban giám khảo
  const defaultSLSV = Number(cuocThi?.SLSVDuKien ?? selected?.SLSVDuKien ?? 150);

  const defaultDoiTuong =
    text(cuocThi, "DoiTuongTG") ||
    text(selected, "DoiTuongThamDu") ||
    (isTechInnovators
      ? "Sinh viên, nhà phát triển phần mềm, chuyên gia công nghệ, nhà nghiên cứu và doanh nghiệp khởi nghiệp trong lĩnh vực CNTT"
      : "Sinh viên Khoa CNTT");

  const defaultHinhThuc =
    text(cuocThi, "HinhThucThi") ||
    text(selected, "HinhThucThi") ||
    "Theo đội";

  const defaultDsBanGiamKhao =
    text(cuocThi, "DSBanGiamKhao") ||
    (isTechInnovators
      ? "TS. Thái Doãn Thanh (Trưởng ban), TS. Nguyễn Thanh Long (Phó ban), ThS. Vũ Văn Vinh (Ủy viên), ThS. Bùi Công Danh (Ủy viên)"
      : "");

  // State cho Ban giám khảo (hỗ trợ nhập tay và chọn thêm từ selection theo bộ môn)
  const [dsBanGiamKhao, setDsBanGiamKhao] = useState<string>(defaultDsBanGiamKhao);

  // Hàng 6: Thể lệ | Tiêu chí chấm
  const defaultTheLe =
    text(cuocThi, "TheLe") ||
    text(selected, "TheLe") ||
    (isTechInnovators
      ? "Mỗi đội tối đa 5 sinh viên và có ít nhất 01 giảng viên hướng dẫn. Các đội đăng ký ý tưởng và nộp sản phẩm hoàn chỉnh theo quy định của Ban tổ chức."
      : "Sinh viên dự thi theo hình thức cá nhân hoặc đội nhóm. Sản phẩm dự thi không được sao chép và tuân thủ quy chế thi.");

  const defaultGiaiThuong =
    text(cuocThi, "GiaiThuong") ||
    (isTechInnovators
      ? "01 Giải Nhất (5.000.000đ + Giấy khen), 01 Giải Nhì (3.000.000đ + Giấy khen), 02 Giải Ba (2.000.000đ + Giấy khen), 03 Giải Khuyến khích (1.000.000đ + Giấy khen)"
      : "01 Giải Nhất, 01 Giải Nhì, 02 Giải Ba, 02 Giải Khuyến khích");

  const defaultTieuChiCham =
    text(cuocThi, "TieuChiCham") ||
    text(selected, "TieuChiCham") ||
    (isTechInnovators
      ? "Tính sáng tạo và đột phá (30%), Khả năng ứng dụng thực tiễn (30%), Hoàn thiện kỹ thuật / Demo (20%), Kỹ năng thuyết trình và phản biện (20%)."
      : "Ý tưởng sáng tạo (30%), Tính khả thi và ứng dụng (40%), Trình bày và hỏi đáp (30%).");

  // Nội dung tổ chức (Bảng: mặc định hiển thị 1 dòng trống)
  const initialWorkItems: WorkItemRow[] =
    Array.isArray(selected.noiDungThucHien) && selected.noiDungThucHien.length > 0
      ? (selected.noiDungThucHien as any[]).map((w, idx) => ({
          id: `work-init-${idx}-${Date.now()}`,
          stt: Number(w.stt ?? (idx + 1)),
          noiDung: String(w.noiDung || ""),
          thoiGian: String(w.thoiGian || ""),
          maTK: Number(w.maTK || 0),
          hoTen: String(w.hoTen || ""),
        }))
      : [
          { id: `w1-${Date.now()}`, stt: 1, noiDung: "", thoiGian: "", maTK: 0, hoTen: "" },
        ];

  const [workItems, setWorkItems] = useState<WorkItemRow[]>(initialWorkItems);

  function handleAddWorkItem() {
    setWorkItems((prev) => [
      ...prev,
      {
        id: `work-add-${Date.now()}-${prev.length}`,
        stt: prev.length + 1,
        noiDung: "",
        thoiGian: "",
        maTK: 0,
        hoTen: "",
      },
    ]);
    onDirty();
  }

  function handleRemoveWorkItem(index: number) {
    setWorkItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((it, i) => ({ ...it, stt: i + 1 }));
    });
    onDirty();
  }

  function handleWorkItemChange(index: number, field: keyof WorkItemRow, val: any) {
    setWorkItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        return { ...it, [field]: val };
      })
    );
    onDirty();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const value: Row = {};

    const tenCuocThi = String(data.get("tenCuocThi") ?? "").trim() || defaultTenCuocThi;
    const soKeHoach = String(data.get("soKeHoach") ?? "").trim() || defaultSoKeHoach;
    const canCu = String(data.get("canCu") ?? "").trim();
    const mucDich = String(data.get("mucDich") ?? "").trim();
    const yeuCau = String(data.get("yeuCau") ?? "").trim();
    const capToChuc = String(data.get("capToChuc") ?? "").trim() || "Cấp Khoa";
    const vongThi = String(data.get("vongThi") ?? "").trim() || "Chung kết";
    const thoiGian = String(data.get("thoiGian") ?? "").trim();
    const diaDiem = String(data.get("diaDiem") ?? "").trim() || "Hội trường C";
    const doiTuongTG = String(data.get("doiTuongTG") ?? "").trim();
    const slRaw = String(data.get("slsvDuKien") ?? "").trim();
    const slsvDuKien = slRaw ? Number(slRaw) : 150;
    const theLe = String(data.get("theLe") ?? "").trim();
    const giaiThuong = String(data.get("giaiThuong") ?? "").trim();
    const tieuChiCham = String(data.get("tieuChiCham") ?? "").trim();
    const hinhThucThi = String(data.get("hinhThucThi") ?? "").trim() || "Theo đội";
    const dsBanGiamKhaoVal = dsBanGiamKhao.trim() || String(data.get("dsBanGiamKhao") ?? "").trim();

    value.tenCuocThi = tenCuocThi;
    value.tenKeHoach = tenCuocThi;
    value.soKeHoach = soKeHoach;
    value.canCu = canCu;
    value.mucDich = mucDich;
    value.yeuCau = yeuCau;
    value.capToChuc = capToChuc;
    value.vongThi = vongThi;
    value.thoiGian = thoiGian;
    value.diaDiem = diaDiem;
    value.doiTuongTG = doiTuongTG;
    value.slsvDuKien = slsvDuKien;
    value.theLe = theLe;
    value.giaiThuong = giaiThuong;
    value.tieuChiCham = tieuChiCham;
    value.hinhThucThi = hinhThucThi;
    value.dsBanGiamKhao = dsBanGiamKhaoVal;
    value.noiDung = mucDich || "Kế hoạch tổ chức cuộc thi";
    value.diemRenLuyen = Number(selected.DiemRenLuyen ?? 5);

    // Bảng Nội dung tổ chức
    value.noiDungThucHien = workItems
      .filter((w) => w.noiDung.trim())
      .map((w, idx) => ({
        stt: idx + 1,
        noiDung: w.noiDung.trim(),
        thoiGian: w.thoiGian?.trim() || undefined,
        maTK: w.maTK ? Number(w.maTK) : undefined,
        hoTen: w.hoTen?.trim() || undefined,
      }));

    // Keep dates valid to satisfy database check constraints
    const parsedStart = thoiGian ? new Date(String(thoiGian)) : null;
    const isValidDate = parsedStart && Number.isFinite(parsedStart.getTime());
    const existingStart = selected?.ThoiGianBatDau ? new Date(String(selected.ThoiGianBatDau)) : null;
    const startObj = isValidDate ? parsedStart! : (existingStart && Number.isFinite(existingStart.getTime()) ? existingStart : new Date());

    const existingEnd = selected?.ThoiGianKetThuc ? new Date(String(selected.ThoiGianKetThuc)) : null;
    const endObj = (existingEnd && Number.isFinite(existingEnd.getTime()) && existingEnd > startObj)
      ? existingEnd
      : new Date(startObj.getTime() + 30 * 24 * 3600 * 1000);

    const existingDeadline = selected?.HanDangKy ? new Date(String(selected.HanDangKy)) : null;
    const deadlineObj = (existingDeadline && Number.isFinite(existingDeadline.getTime()) && existingDeadline <= startObj)
      ? existingDeadline
      : new Date(startObj.getTime() - 7 * 24 * 3600 * 1000);

    value.thoiGianBatDau = startObj.toISOString();
    value.thoiGianKetThuc = endObj.toISOString();
    value.hanDangKy = deadlineObj.toISOString();

    value.trangThai = "Chờ phân công thực hiện";

    await onSave(value);
  }

  return (
    <form
      onSubmit={handleSubmit}
      onChange={onDirty}
      spellCheck={false}
      style={{ display: "flex", flexDirection: "column", gap: "18px", width: "100%", marginTop: "10px" }}
    >
      {/* HÀNG 1: Mã cuộc thi | Số kế hoạch | Tên cuộc thi */}
      <div style={{ display: "grid", gridTemplateColumns: "140px 200px 1fr", gap: "14px", width: "100%", alignItems: "start" }}>
        <label className={s.businessField} style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Mã cuộc thi</span>
          <input
            className={s.businessInput}
            type="text"
            value={displayMaCThi}
            disabled
            readOnly
            spellCheck={false}
            title="Mã cuộc thi tiếp theo trong DB, không được chỉnh sửa"
            style={{ background: "#f1f5f9", color: "#0369a1", fontWeight: 700, boxSizing: "border-box" }}
          />
        </label>

        <label className={s.businessField} style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Số kế hoạch</span>
          <input
            className={s.businessInput}
            type="text"
            name="soKeHoach"
            defaultValue={defaultSoKeHoach}
            placeholder="VD: 18/KH-CNTT"
            spellCheck={false}
            disabled={busy}
            style={{ boxSizing: "border-box" }}
          />
        </label>

        <label className={s.businessField} style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Tên cuộc thi</span>
          <input
            className={s.businessInput}
            type="text"
            name="tenCuocThi"
            defaultValue={defaultTenCuocThi}
            required
            placeholder="Nhập tên cuộc thi..."
            spellCheck={false}
            disabled={busy}
            style={{ fontWeight: 600, boxSizing: "border-box" }}
          />
        </label>
      </div>

      {/* HÀNG 2: Căn cứ | Mục đích */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", width: "100%", alignItems: "start" }}>
        <label className={s.businessField} style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Căn cứ</span>
          <textarea
            className={s.businessInput}
            name="canCu"
            defaultValue={defaultCanCu}
            rows={4}
            placeholder="Căn cứ các thông báo, quyết định, kế hoạch..."
            spellCheck={false}
            disabled={busy}
            style={{ boxSizing: "border-box", resize: "vertical", minHeight: "100px", lineHeight: "1.4" }}
          />
        </label>

        <label className={s.businessField} style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Mục đích</span>
          <textarea
            className={s.businessInput}
            name="mucDich"
            defaultValue={defaultMucDich}
            rows={4}
            placeholder="Mục đích tổ chức cuộc thi..."
            spellCheck={false}
            disabled={busy}
            style={{ boxSizing: "border-box", resize: "vertical", minHeight: "100px", lineHeight: "1.4" }}
          />
        </label>
      </div>

      {/* HÀNG 3 & 4 (ghép): Yêu cầu (chiếm 2 dòng) | Cấp tổ chức & Vòng thi (dòng 1) | Thời gian & Địa điểm (dòng 2) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.2fr 1fr 1fr",
        gridTemplateRows: "auto auto",
        gap: "14px",
        width: "100%",
        alignItems: "start",
      }}>
        {/* Yêu cầu: chiếm 2 dòng bên trái */}
        <label className={s.businessField} style={{ minWidth: 0, gridColumn: "1", gridRow: "1 / span 2", height: "100%", display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Yêu cầu</span>
          <textarea
            className={s.businessInput}
            name="yeuCau"
            defaultValue={defaultYeuCau}
            rows={5}
            placeholder="Yêu cầu tham dự..."
            spellCheck={false}
            disabled={busy}
            style={{ boxSizing: "border-box", resize: "vertical", flex: 1, minHeight: "115px", lineHeight: "1.4" }}
          />
        </label>

        {/* Cột 2 & 3, Dòng 1: Cấp tổ chức | Vòng thi */}
        <label className={s.businessField} style={{ minWidth: 0, gridColumn: "2", gridRow: "1" }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Cấp tổ chức</span>
          <select
            className={s.businessInput}
            name="capToChuc"
            defaultValue={defaultCapToChuc}
            disabled={busy}
            style={{ boxSizing: "border-box" }}
          >
            <option value="Cấp Khoa">Cấp Khoa</option>
            <option value="Cấp Trường">Cấp Trường</option>
            <option value="Cấp Bộ môn">Cấp Bộ môn</option>
            <option value="Cấp Quốc gia">Cấp Quốc gia</option>
          </select>
        </label>

        <label className={s.businessField} style={{ minWidth: 0, gridColumn: "3", gridRow: "1" }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Vòng thi</span>
          <input
            className={s.businessInput}
            type="text"
            name="vongThi"
            defaultValue={defaultVongThi}
            placeholder="VD: Vòng 1: Sơ khảo, Vòng 2: Chung kết"
            spellCheck={false}
            disabled={busy}
            style={{ boxSizing: "border-box" }}
          />
        </label>

        {/* Cột 2 & 3, Dòng 2: Thời gian | Địa điểm */}
        <label className={s.businessField} style={{ minWidth: 0, gridColumn: "2", gridRow: "2" }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Thời gian</span>
          <input
            className={s.businessInput}
            type="text"
            name="thoiGian"
            defaultValue={defaultThoiGian}
            placeholder="VD: Từ tháng 03 - 05/2025"
            spellCheck={false}
            disabled={busy}
            style={{ boxSizing: "border-box" }}
          />
        </label>

        <label className={s.businessField} style={{ minWidth: 0, gridColumn: "3", gridRow: "2" }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Địa điểm</span>
          <input
            className={s.businessInput}
            type="text"
            name="diaDiem"
            defaultValue={defaultDiaDiem}
            placeholder="VD: Hội trường C / Giảng đường B"
            spellCheck={false}
            disabled={busy}
            style={{ boxSizing: "border-box" }}
          />
        </label>
      </div>

      {/* HÀNG 5: Số lượng sinh viên dự kiến | Đối tượng tham gia | Hình thức đăng ký | Ban giám khảo */}
      <div style={{ display: "grid", gridTemplateColumns: "180px 1.2fr 160px 1.5fr", gap: "14px", width: "100%", alignItems: "start" }}>
        <label className={s.businessField} style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Số lượng SV dự kiến</span>
          <input
            className={s.businessInput}
            type="number"
            name="slsvDuKien"
            defaultValue={defaultSLSV}
            min={1}
            placeholder="150"
            disabled={busy}
            style={{ boxSizing: "border-box" }}
          />
        </label>

        <label className={s.businessField} style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Đối tượng tham gia</span>
          <input
            className={s.businessInput}
            type="text"
            name="doiTuongTG"
            defaultValue={defaultDoiTuong}
            placeholder="VD: Sinh viên Khoa CNTT"
            spellCheck={false}
            disabled={busy}
            style={{ boxSizing: "border-box" }}
          />
        </label>

        <label className={s.businessField} style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Hình thức đăng ký</span>
          <select
            className={s.businessInput}
            name="hinhThucThi"
            defaultValue={defaultHinhThuc}
            disabled={busy}
            style={{ boxSizing: "border-box" }}
          >
            <option value="Theo đội">Theo đội</option>
            <option value="Cá nhân">Cá nhân</option>
          </select>
        </label>

        {/* Ban giám khảo: có thể nhập bằng tay, khi bấm vào mũi tên thì load selection phân riêng từng bộ môn */}
        <label className={s.businessField} style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Ban giám khảo</span>
          <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center" }}>
            <input
              type="text"
              className={s.businessInput}
              name="dsBanGiamKhao"
              value={dsBanGiamKhao}
              onChange={(e) => {
                setDsBanGiamKhao(e.target.value);
                onDirty();
              }}
              placeholder="VD: TS. Nguyễn Thanh Long, ThS. Bùi Công Danh..."
              disabled={busy}
              style={{ minHeight: "38px", padding: "6px 36px 6px 10px", fontSize: "13px", width: "100%", boxSizing: "border-box" }}
            />
            <div
              style={{
                position: "absolute",
                right: "1px",
                top: "1px",
                bottom: "1px",
                width: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f8fafc",
                borderLeft: "1px solid #e2e8f0",
                borderTopRightRadius: "6px",
                borderBottomRightRadius: "6px",
              }}
              title="Bấm vào mũi tên để chọn thêm giảng viên theo từng bộ môn vào Ban giám khảo"
            >
              <select
                aria-label="Chọn giảng viên theo từng bộ môn vào Ban giám khảo"
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    for (const members of Object.values(staffGroupedByDept)) {
                      const matched = members.find((st) => String(st.maTK) === val);
                      if (matched) {
                        setDsBanGiamKhao((prev) => {
                          const trimmed = prev.trim();
                          if (!trimmed) return matched.hoTen;
                          if (trimmed.includes(matched.hoTen)) return trimmed;
                          return `${trimmed}, ${matched.hoTen}`;
                        });
                        onDirty();
                        break;
                      }
                    }
                  }
                }}
                disabled={busy}
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  cursor: "pointer",
                  zIndex: 2,
                }}
              >
                <option value="" disabled>-- Chọn giảng viên theo từng bộ môn --</option>
                {Object.entries(staffGroupedByDept).map(([dept, members]) => (
                  <optgroup key={dept} label={dept}>
                    {members.map((st) => (
                      <option key={st.maTK} value={st.maTK}>
                        {st.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span style={{ pointerEvents: "none", color: "#64748b", fontSize: "11px", fontWeight: "bold" }}>▼</span>
            </div>
          </div>
        </label>
      </div>

      {/* HÀNG 6: Thể lệ | Tiêu chí chấm (1 dòng bằng Thể lệ) */}
      {/* Giải thưởng ở dưới ô Thể lệ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "14px",
        width: "100%",
        alignItems: "start",
      }}>
        {/* Hàng 1, Cột 1: Thể lệ */}
        <label className={s.businessField} style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Thể lệ</span>
          <textarea
            className={s.businessInput}
            name="theLe"
            defaultValue={defaultTheLe}
            rows={3}
            placeholder="Nội dung thể lệ cuộc thi, quy định đội thi, điều kiện nộp bài..."
            spellCheck={false}
            disabled={busy}
            style={{ boxSizing: "border-box", resize: "vertical" }}
          />
        </label>

        {/* Hàng 1, Cột 2: Tiêu chí chấm (1 dòng bằng Thể lệ) */}
        <label className={s.businessField} style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Tiêu chí chấm</span>
          <textarea
            className={s.businessInput}
            name="tieuChiCham"
            defaultValue={defaultTieuChiCham}
            rows={3}
            placeholder="Các tiêu chí đánh giá, thang điểm..."
            spellCheck={false}
            disabled={busy}
            style={{ boxSizing: "border-box", resize: "vertical" }}
          />
        </label>

        {/* Hàng 2, Cột 1: Giải thưởng (ở dưới ô Thể lệ) */}
        <label className={s.businessField} style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Giải thưởng</span>
          <textarea
            className={s.businessInput}
            name="giaiThuong"
            defaultValue={defaultGiaiThuong}
            rows={3}
            placeholder="Cơ cấu giải thưởng, tiền thưởng và hiện vật..."
            spellCheck={false}
            disabled={busy}
            style={{ boxSizing: "border-box", resize: "vertical" }}
          />
        </label>
      </div>

      {/* NỘI DUNG TỔ CHỨC (BẢNG: mặc định 1 dòng, không còn dòng mô tả) */}
      <div style={{ marginTop: "10px", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", background: "#f8fafc" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#1e3a8a", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>📅 Nội dung tổ chức</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={handleAddWorkItem}
            disabled={busy}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "1px solid #3b82f6",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>➕ Thêm nội dung thực hiện</span>
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#ffffff", borderRadius: "6px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
            <thead>
              <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", fontSize: "13px" }}>
                <th style={{ padding: "10px 12px", width: "50px", textAlign: "center", fontWeight: 700, color: "#475569" }}>STT</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#475569" }}>Nội dung thực hiện</th>
                <th style={{ padding: "10px 12px", width: "270px", textAlign: "left", fontWeight: 700, color: "#475569" }}>Thời gian hoàn thành</th>
                <th style={{ padding: "10px 12px", width: "270px", textAlign: "left", fontWeight: 700, color: "#475569" }}>Người thực hiện</th>
                <th style={{ padding: "10px 12px", width: "50px", textAlign: "center", fontWeight: 700, color: "#475569" }}>Xóa</th>
              </tr>
            </thead>
            <tbody>
              {workItems.map((item, index) => (
                <tr key={item.id || `work-row-${index}`} style={{ borderBottom: index === workItems.length - 1 ? "none" : "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 600, color: "#64748b" }}>
                    {index + 1}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <input
                      type="text"
                      className={s.businessInput}
                      value={item.noiDung}
                      onChange={(e) => handleWorkItemChange(index, "noiDung", e.target.value)}
                      placeholder="VD: Ban hành kế hoạch, Tiếp nhận hồ sơ..."
                      disabled={busy}
                      style={{ minHeight: "36px", padding: "6px 10px", fontSize: "13px" }}
                    />
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <input
                      type="text"
                      className={s.businessInput}
                      value={item.thoiGian}
                      onChange={(e) => handleWorkItemChange(index, "thoiGian", e.target.value)}
                      placeholder="VD: 05/2025 hoặc 15/05/2025"
                      disabled={busy}
                      style={{ minHeight: "36px", padding: "6px 10px", fontSize: "13px" }}
                    />
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    {/* Người thực hiện: có thể gõ trực tiếp bằng tay, hoặc bấm mũi tên để chọn giảng viên phân theo bộ môn */}
                    <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center" }}>
                      <input
                        type="text"
                        className={s.businessInput}
                        value={item.hoTen || ""}
                        onChange={(e) => handleWorkItemChange(index, "hoTen", e.target.value)}
                        placeholder="Nhập hoặc chọn giảng viên..."
                        disabled={busy}
                        style={{ minHeight: "36px", padding: "6px 34px 6px 10px", fontSize: "13px", width: "100%", boxSizing: "border-box" }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          right: "1px",
                          top: "1px",
                          bottom: "1px",
                          width: "30px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#f8fafc",
                          borderLeft: "1px solid #e2e8f0",
                          borderTopRightRadius: "6px",
                          borderBottomRightRadius: "6px",
                        }}
                        title="Bấm vào mũi tên để chọn giảng viên theo từng bộ môn"
                      >
                        <select
                          aria-label="Chọn giảng viên phân theo từng bộ môn"
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              for (const members of Object.values(staffGroupedByDept)) {
                                const matched = members.find((st) => String(st.maTK) === val);
                                if (matched) {
                                  handleWorkItemChange(index, "maTK", matched.maTK);
                                  handleWorkItemChange(index, "hoTen", matched.hoTen);
                                  break;
                                }
                              }
                            }
                          }}
                          disabled={busy}
                          style={{
                            position: "absolute",
                            right: 0,
                            top: 0,
                            width: "100%",
                            height: "100%",
                            opacity: 0,
                            cursor: "pointer",
                            zIndex: 2,
                          }}
                        >
                          <option value="" disabled>-- Chọn giảng viên theo bộ môn --</option>
                          {Object.entries(staffGroupedByDept).map(([dept, members]) => (
                            <optgroup key={dept} label={dept}>
                              {members.map((st) => (
                                <option key={st.maTK} value={st.maTK}>
                                  {st.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <span style={{ pointerEvents: "none", color: "#64748b", fontSize: "11px", fontWeight: "bold" }}>▼</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveWorkItem(index)}
                      disabled={busy || workItems.length <= 1}
                      title="Xóa dòng"
                      style={{
                        background: "none",
                        border: "none",
                        color: workItems.length <= 1 ? "#cbd5e1" : "#ef4444",
                        cursor: workItems.length <= 1 ? "not-allowed" : "pointer",
                        fontSize: "15px",
                        padding: "4px",
                      }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nút lưu: không icon */}
      <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
        <button
          type="submit"
          className={s.primary}
          disabled={busy}
          style={{ padding: "10px 24px", fontSize: "14px", fontWeight: 600, display: "inline-flex", alignItems: "center" }}
        >
          {busy ? "Đang lưu..." : "Lưu kế hoạch cuộc thi"}
        </button>
      </div>
    </form>
  );
}

export function CompetitionPlanView({ selected }: { selected: Row }) {
  const cuocThi = (selected.cuocThi as Row) || null;
  const maHD = text(selected, "MaHD");
  const maCThi = text(cuocThi, "MaCThi") || text(selected, "MaCThi");
  const soKeHoach = text(cuocThi, "SoKeHoach") || text(selected, "SoKeHoach") || `KH-CT-${maHD}/${text(selected, "NamHoc") || "2024-2025"}`;
  const tenCuocThi = text(cuocThi, "TenCuocThi") || text(selected, "TenCuocThi") || text(selected, "TenKeHoach") || text(selected, "TenHoatDong");
  const canCu = text(cuocThi, "CanCu") || text(selected, "CanCu") || "Kế hoạch năm học của Khoa CNTT";
  const mucDich = text(cuocThi, "MucDich") || text(selected, "MucDich") || text(selected, "NoiDung") || text(selected, "NoiDungHoatDong");
  const yeuCau = text(cuocThi, "YeuCau") || text(selected, "YeuCau") || "Sinh viên tuân thủ quy chế và thể lệ cuộc thi.";
  const capToChuc = text(cuocThi, "CapToChuc") || text(selected, "CapToChuc") || text(selected, "CapTC") || "Cấp Khoa";
  const vongThi = text(cuocThi, "VongThi") || text(selected, "VongThi") || "Chung kết";
  const thoiGian = text(cuocThi, "ThoiGian") || (selected?.ThoiGianBatDau ? new Date(String(selected.ThoiGianBatDau)).toLocaleDateString("vi-VN") : "Chưa cập nhật");
  const diaDiem = text(cuocThi, "DiaDiem") || text(selected, "DiaDiem") || "Chưa cập nhật";
  const slsv = text(cuocThi, "SLSVDuKien") || text(selected, "SLSVDuKien") || "150";
  const theLe = text(cuocThi, "TheLe") || text(selected, "TheLe") || "Chưa cập nhật";
  const giaiThuong = text(cuocThi, "GiaiThuong") || "Chưa cập nhật";
  const tieuChiCham = text(cuocThi, "TieuChiCham") || text(selected, "TieuChiCham") || "Chưa cập nhật";
  const doiTuong = text(cuocThi, "DoiTuongTG") || text(selected, "DoiTuongThamDu") || "Sinh viên Khoa CNTT";
  const hinhThuc = text(cuocThi, "HinhThucThi") || text(selected, "HinhThucThi") || "Theo đội";
  const dsBanGiamKhao = text(cuocThi, "DSBanGiamKhao") || "Chưa cập nhật";

  const workItems = Array.isArray(selected.noiDungThucHien) ? (selected.noiDungThucHien as any[]) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px", width: "100%", marginTop: "10px" }}>
      {/* HÀNG 1: Mã cuộc thi | Số kế hoạch | Tên cuộc thi */}
      <div style={{ display: "grid", gridTemplateColumns: "140px 200px 1fr", gap: "14px", width: "100%", alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Mã cuộc thi</span>
          <strong style={{ color: "#0369a1" }}>{maCThi ? `#${maCThi}` : "Chưa lưu"}</strong>
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Số kế hoạch</span>
          <strong>{soKeHoach}</strong>
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Tên cuộc thi</span>
          <p style={{ margin: "4px 0 0", fontWeight: 700, color: "#0f172a" }}>{tenCuocThi}</p>
        </div>
      </div>

      {/* HÀNG 2: Căn cứ | Mục đích */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", width: "100%", alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Căn cứ</span>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.4" }}>{canCu}</p>
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Mục đích</span>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.4" }}>{mucDich}</p>
        </div>
      </div>

      {/* HÀNG 3 & 4 (ghép): Yêu cầu (chiếm 2 dòng) | Cấp tổ chức, Vòng thi | Thời gian, Địa điểm */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.2fr 1fr 1fr",
        gridTemplateRows: "auto auto",
        gap: "14px",
        width: "100%",
        alignItems: "start",
      }}>
        <div style={{ minWidth: 0, gridColumn: "1", gridRow: "1 / span 2" }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Yêu cầu</span>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.4" }}>{yeuCau}</p>
        </div>

        <div style={{ minWidth: 0, gridColumn: "2", gridRow: "1" }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Cấp tổ chức</span>
          <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{capToChuc}</p>
        </div>

        <div style={{ minWidth: 0, gridColumn: "3", gridRow: "1" }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Vòng thi</span>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{vongThi}</p>
        </div>

        <div style={{ minWidth: 0, gridColumn: "2", gridRow: "2" }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Thời gian</span>
          <p style={{ margin: "4px 0 0", fontWeight: 500 }}>{thoiGian}</p>
        </div>

        <div style={{ minWidth: 0, gridColumn: "3", gridRow: "2" }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Địa điểm</span>
          <p style={{ margin: "4px 0 0", fontWeight: 500 }}>{diaDiem}</p>
        </div>
      </div>

      {/* HÀNG 5: Số lượng sinh viên dự kiến | Đối tượng tham gia | Hình thức đăng ký | Ban giám khảo */}
      <div style={{ display: "grid", gridTemplateColumns: "180px 1.2fr 160px 1.5fr", gap: "14px", width: "100%", alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Số lượng SV dự kiến</span>
          <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{slsv} sinh viên</p>
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Đối tượng tham gia</span>
          <p style={{ margin: "4px 0 0" }}>{doiTuong}</p>
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Hình thức đăng ký</span>
          <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{hinhThuc}</p>
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Ban giám khảo</span>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{dsBanGiamKhao}</p>
        </div>
      </div>

      {/* HÀNG 6: Thể lệ | Tiêu chí chấm (1 dòng bằng Thể lệ) */}
      {/* Giải thưởng ở dưới ô Thể lệ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "14px",
        width: "100%",
        alignItems: "start",
      }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Thể lệ</span>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.4" }}>{theLe}</p>
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Tiêu chí chấm</span>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.4" }}>{tieuChiCham}</p>
        </div>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Giải thưởng</span>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: "1.4" }}>{giaiThuong}</p>
        </div>
      </div>

      {/* PHẦN 7: NỘI DUNG TỔ CHỨC (BẢNG HIỂN THỊ) */}
      <div style={{ marginTop: "10px", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", background: "#f8fafc" }}>
        <h3 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: 700, color: "#1e3a8a", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>📅 Nội dung tổ chức</span>
        </h3>
        {workItems.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#ffffff", borderRadius: "6px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", fontSize: "13px" }}>
                  <th style={{ padding: "10px 12px", width: "50px", textAlign: "center", fontWeight: 700, color: "#475569" }}>STT</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#475569" }}>Nội dung thực hiện</th>
                  <th style={{ padding: "10px 12px", width: "270px", textAlign: "left", fontWeight: 700, color: "#475569" }}>Thời gian hoàn thành</th>
                  <th style={{ padding: "10px 12px", width: "270px", textAlign: "left", fontWeight: 700, color: "#475569" }}>Người thực hiện</th>
                </tr>
              </thead>
              <tbody>
                {workItems.map((item: any, index: number) => (
                  <tr key={`view-work-${index}`} style={{ borderBottom: index === workItems.length - 1 ? "none" : "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "#64748b" }}>
                      {item.stt ?? (index + 1)}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 500, color: "#1e293b" }}>
                      {item.noiDung}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#475569" }}>
                      {item.thoiGian || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#1e3a8a", fontWeight: 600 }}>
                      {item.hoTen || "Chưa phân công"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>Chưa có nội dung thực hiện.</p>
        )}
      </div>
    </div>
  );
}
