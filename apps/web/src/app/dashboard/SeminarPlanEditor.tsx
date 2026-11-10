"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { workflowRequest } from "@/services/workflow";
import s from "./dashboard.module.css";
import type { PlanStaff } from "./PlanCommittees";

type Row = Record<string, unknown>;

export type ChuongTrinhItem = {
  id?: string;
  noiDung: string;
  thoiGian: string;
  dvChuTri: string;
};

export type ChuDeItem = {
  maChuDe?: number;
  stt?: number;
  tenChuDe: string;
  tgBatDau?: string;
  tgKetThuc?: string;
  dienGia: string;
  noiDungKhac?: string;
};

interface StaffOption {
  key: string;
  value: string;
  fullName: string;
  hoTen: string;
  department: string;
}

function formatStaffOption(st: any, idx: number): StaffOption {
  const hoTen = String(st.HoTen || "").trim();
  const hocViRaw = String(st.HocVi || "").trim();
  let title = "";
  if (/phó giáo sư.*tiến sĩ/i.test(hocViRaw) || /pgs.*ts/i.test(hocViRaw)) title = "PGS.TS.";
  else if (/giáo sư.*tiến sĩ/i.test(hocViRaw) || /gs.*ts/i.test(hocViRaw)) title = "GS.TS.";
  else if (/tiến sĩ/i.test(hocViRaw) || /ts\b/i.test(hocViRaw)) title = "TS.";
  else if (/thạc sĩ/i.test(hocViRaw) || /ths\b/i.test(hocViRaw)) title = "ThS.";
  else if (hocViRaw) title = hocViRaw;

  let dept = String(st.TenBM || st.DonViCongTac || "").trim();
  if (dept && !dept.toLowerCase().startsWith("bộ môn") && !dept.toLowerCase().startsWith("khoa")) {
    dept = `Bộ môn ${dept}`;
  }
  if (!dept) dept = "Bộ môn khác";

  const fullName = title ? `${title} ${hoTen}` : hoTen;

  return {
    key: `staff-${st.MaNgDung ?? st.MaTK ?? idx}`,
    value: fullName,
    fullName,
    hoTen,
    department: dept,
  };
}

const text = (r: Row | null | undefined, k: string) => String(r?.[k] ?? "");

export function SeminarPlanEditor({
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
  const seminar = (selected.seminar as Row) || null;
  const initialChuongTrinh: ChuongTrinhItem[] = Array.isArray(selected.chuongTrinh)
    ? (selected.chuongTrinh as ChuongTrinhItem[]).map((item, i) => ({
        ...item,
        id: item.id || `ct-init-${i}-${Date.now()}`,
      }))
    : [];
  const initialChuDe: ChuDeItem[] = Array.isArray(selected.chuDeList)
    ? (selected.chuDeList as ChuDeItem[]).map((c: any) => ({
        maChuDe: c.MaChuDe,
        stt: c.STT,
        tenChuDe: c.TenChuDe || "",
        tgBatDau: c.TgBatDau || "",
        tgKetThuc: c.TgKetThuc || "",
        dienGia: c.DienGia || "",
        noiDungKhac: c.NoiDungKhac || "",
      }))
    : [];

  const [chuongTrinh, setChuongTrinh] = useState<ChuongTrinhItem[]>(
    initialChuongTrinh.length > 0
      ? initialChuongTrinh
      : [{ id: `ct-default-${Date.now()}`, noiDung: "", thoiGian: "", dvChuTri: "" }]
  );
  const [chuDeList, setChuDeList] = useState<ChuDeItem[]>(
    initialChuDe.length > 0
      ? initialChuDe
      : [{ stt: 1, tenChuDe: "", tgBatDau: "", tgKetThuc: "", dienGia: "", noiDungKhac: "" }]
  );

  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest(".staff-combobox-wrapper")) {
        setOpenDropdownIdx(null);
      }
    }
    if (openDropdownIdx !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openDropdownIdx]);

  useEffect(() => {
    let active = true;
    workflowRequest<any[]>("/admin/accounts/staff-records")
      .then((records) => {
        if (!active || !Array.isArray(records)) return;
        const opts = records
          .map((r, i) => formatStaffOption(r, i))
          .filter((o) => o.hoTen.length > 0);
        opts.sort((a, b) => a.hoTen.localeCompare(b.hoTen, "vi"));
        setStaffOptions(opts);
      })
      .catch(() => {
        const fallback = ((selected.staff ?? []) as PlanStaff[]).map((st, i) =>
          formatStaffOption(st, i)
        );
        setStaffOptions(fallback);
      });
    return () => {
      active = false;
    };
  }, [selected.staff]);

  const groupedStaff = useMemo(() => {
    const map: Record<string, StaffOption[]> = {};
    for (const st of staffOptions) {
      const dept = st.department || "Bộ môn khác";
      if (!map[dept]) map[dept] = [];
      map[dept].push(st);
    }
    const depts = Object.keys(map).sort((a, b) => a.localeCompare(b, "vi"));
    return depts.map((d) => ({
      department: d,
      staff: map[d].sort((a, b) => a.hoTen.localeCompare(b.hoTen, "vi")),
    }));
  }, [staffOptions]);

  function addChuongTrinhRow() {
    onDirty();
    setChuongTrinh((prev) => [
      ...prev,
      { id: `ct-add-${Date.now()}-${Math.random()}`, noiDung: "", thoiGian: "", dvChuTri: "" },
    ]);
  }

  function updateChuongTrinh(index: number, field: keyof ChuongTrinhItem, value: string) {
    onDirty();
    setChuongTrinh((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function removeChuongTrinhRow(index: number) {
    onDirty();
    setChuongTrinh((prev) => prev.filter((_, i) => i !== index));
  }

  function addChuDeRow() {
    onDirty();
    setChuDeList((prev) => [
      ...prev,
      {
        stt: prev.length + 1,
        tenChuDe: "",
        tgBatDau: "",
        tgKetThuc: "",
        dienGia: "",
        noiDungKhac: "",
      },
    ]);
  }

  function updateChuDe(index: number, field: keyof ChuDeItem, value: unknown) {
    onDirty();
    setChuDeList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function removeChuDeRow(index: number) {
    onDirty();
    setChuDeList((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const value: Row = {};

    const stringFields = [
      "soKeHoach",
      "chuDe",
      "canCu",
      "mucDich",
      "yeuCau",
      "thoiGian",
      "diaDiem",
      "doiTuongTG",
      "noiDungKhac",
    ];

    for (const f of stringFields) {
      const v = String(data.get(f) ?? "").trim();
      if (v) value[f] = v;
    }

    const slRaw = String(data.get("slsvDuKien") ?? "").trim();
    if (slRaw) value.slsvDuKien = Number(slRaw);

    value.tenKeHoach = value.chuDe || text(selected, "TenHoatDong");
    value.noiDung = value.mucDich || text(selected, "NoiDungHoatDong") || "Kế hoạch tổ chức seminar";
    
    const parsedStart = value.thoiGian ? new Date(String(value.thoiGian)) : null;
    const isValidDate = parsedStart && Number.isFinite(parsedStart.getTime());
    const startObj = isValidDate ? parsedStart! : new Date();
    value.thoiGianBatDau = startObj.toISOString();
    value.thoiGianKetThuc = new Date(startObj.getTime() + 2 * 3600 * 1000).toISOString();
    value.diaDiem = value.diaDiem || "Hội trường A";

    value.trangThai = "Chờ phân công thực hiện";

    value.chuongTrinh = chuongTrinh
      .filter((c) => c.noiDung.trim())
      .map(({ noiDung, thoiGian, dvChuTri }) => ({
        noiDung: noiDung.trim(),
        thoiGian: thoiGian.trim() || undefined,
        dvChuTri: dvChuTri.trim() || undefined,
      }));

    value.chuDeList = chuDeList
      .filter((c) => c.tenChuDe.trim() || c.dienGia.trim())
      .map((c, i) => ({
        ...(c.maChuDe ? { maChuDe: Number(c.maChuDe) } : {}),
        stt: c.stt ?? (i + 1),
        tenChuDe: c.tenChuDe.trim() || (c.dienGia.trim() ? `Chuyên đề - ${c.dienGia.trim()}` : `Chủ đề ${i + 1}`),
        tgBatDau: c.tgBatDau?.trim() || undefined,
        tgKetThuc: c.tgKetThuc?.trim() || undefined,
        dienGia: c.dienGia.trim() || undefined,
        noiDungKhac: c.noiDungKhac?.trim() || undefined,
      }));

    await onSave(value);
  }

  const maSeminar = text(seminar, "MaSeminar") || text(selected, "MaSeminar");
  const maHD = text(selected, "MaHD");
  const defaultSoKeHoach =
    text(seminar, "SoKeHoach") || `SEM-CNTT-${maHD}/${text(selected, "NamHoc") || new Date().getFullYear()}`;
  const defaultChuDe = text(seminar, "ChuDe") || text(selected, "TenKeHoach") || text(selected, "TenHoatDong");
  const defaultCanCu = text(seminar, "CanCu") || "Kế hoạch năm học của Khoa CNTT";
  const defaultMucDich = text(seminar, "MucDich") || text(selected, "NoiDung") || text(selected, "NoiDungHoatDong");
  const defaultYeuCau =
    text(seminar, "YeuCau") || "Sinh viên tham dự đúng giờ, điểm danh bằng mã QR, trang phục lịch sự.";
  const defaultThoiGian =
    text(seminar, "ThoiGian") ||
    (selected?.ThoiGianBatDau ? new Date(String(selected.ThoiGianBatDau)).toLocaleString("vi-VN") : "") ||
    "";
  const defaultDiaDiem = text(seminar, "DiaDiem") || text(selected, "DiaDiem") || "Hội trường A";
  const defaultSLSV = Number(seminar?.SLSVDuKien ?? selected?.SLSVDuKien ?? 100);
  const defaultDoiTuong = text(seminar, "DoiTuongTG") || text(selected, "DoiTuongThamDu") || "Sinh viên khoa CNTT";
  const defaultNoiDungKhac = text(seminar, "NoiDung") || text(selected, "NoiDungKhac") || "";

  return (
    <form
      onSubmit={handleSubmit}
      onChange={onDirty}
      spellCheck={false}
      style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", marginTop: "10px" }}
    >
      {/* Hàng 1: Mã Seminar | Số kế hoạch | Mã hoạt động | Chủ đề | Căn cứ */}
      <div style={{ display: "grid", gridTemplateColumns: "110px 180px 110px 2.2fr 1.6fr", gap: "14px", width: "100%", alignItems: "start" }}>
        <label className={s.businessField}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Mã Seminar</span>
          <input
            className={s.businessInput}
            type="text"
            value={maSeminar ? `#${maSeminar}` : "(Tự động)"}
            disabled
            readOnly
            spellCheck={false}
            style={{ background: "#f1f5f9", color: "#64748b", fontWeight: 700 }}
          />
        </label>
        <label className={s.businessField}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Số kế hoạch</span>
          <input
            className={s.businessInput}
            name="soKeHoach"
            type="text"
            defaultValue={defaultSoKeHoach}
            required
            disabled={busy}
            spellCheck={false}
            placeholder="SEM-CNTT-..."
          />
        </label>
        <label className={s.businessField}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Mã hoạt động</span>
          <input
            className={s.businessInput}
            type="text"
            value={`#${maHD}`}
            disabled
            readOnly
            spellCheck={false}
            style={{ background: "#f1f5f9", color: "#64748b", fontWeight: 700 }}
          />
        </label>
        <label className={s.businessField}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Chủ đề</span>
          <textarea
            className={s.businessInput}
            name="chuDe"
            defaultValue={defaultChuDe}
            required
            disabled={busy}
            spellCheck={false}
            rows={2}
            style={{ resize: "vertical", minHeight: "42px", lineHeight: "1.4", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            placeholder="Chủ đề buổi seminar"
          />
        </label>
        <label className={s.businessField}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Căn cứ</span>
          <textarea
            className={s.businessInput}
            name="canCu"
            defaultValue={defaultCanCu}
            required
            disabled={busy}
            spellCheck={false}
            rows={2}
            style={{ resize: "vertical", minHeight: "42px", lineHeight: "1.4", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            placeholder="Căn cứ kế hoạch..."
          />
        </label>
      </div>

      {/* Hàng 2: Mục đích | Yêu cầu */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", width: "100%", alignItems: "start" }}>
        <label className={s.businessField}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Mục đích</span>
          <textarea
            className={s.businessInput}
            name="mucDich"
            defaultValue={defaultMucDich}
            rows={3}
            disabled={busy}
            spellCheck={false}
            style={{ resize: "vertical", minHeight: "60px", lineHeight: "1.4", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            placeholder="Mục đích tổ chức seminar..."
          />
        </label>
        <label className={s.businessField}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Yêu cầu</span>
          <textarea
            className={s.businessInput}
            name="yeuCau"
            defaultValue={defaultYeuCau}
            rows={3}
            disabled={busy}
            spellCheck={false}
            style={{ resize: "vertical", minHeight: "60px", lineHeight: "1.4", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            placeholder="Yêu cầu đối với người tham gia..."
          />
        </label>
      </div>

      {/* Hàng 3: Thời gian | Địa điểm | SL sinh viên dự kiến | Đối tượng tham gia */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1fr 1.6fr", gap: "14px", width: "100%" }}>
        <label className={s.businessField}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Thời gian</span>
          <input
            className={s.businessInput}
            name="thoiGian"
            type="text"
            defaultValue={defaultThoiGian}
            required
            disabled={busy}
            spellCheck={false}
            maxLength={225}
            placeholder="Ví dụ: 20/11/2025 (08h30 - 11h30)"
          />
        </label>
        <label className={s.businessField}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Địa điểm</span>
          <input
            className={s.businessInput}
            name="diaDiem"
            type="text"
            defaultValue={defaultDiaDiem}
            required
            disabled={busy}
            spellCheck={false}
          />
        </label>
        <label className={s.businessField}>
          <span style={{ fontWeight: 600, color: "#475569" }}>SL sinh viên dự kiến</span>
          <input
            className={s.businessInput}
            name="slsvDuKien"
            type="number"
            min={1}
            defaultValue={defaultSLSV}
            required
            disabled={busy}
          />
        </label>
        <label className={s.businessField}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Đối tượng tham gia</span>
          <input
            className={s.businessInput}
            name="doiTuongTG"
            type="text"
            defaultValue={defaultDoiTuong}
            disabled={busy}
            spellCheck={false}
          />
        </label>
      </div>

      {/* Khối Bảng 1: Nội dung - thời gian (thời lượng) - đơn vị chủ trì */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: "14.5px", color: "#1e3a8a" }}>
            Chương trình / Nội dung seminar
          </span>
          <button
            type="button"
            onClick={addChuongTrinhRow}
            disabled={busy}
            style={{
              padding: "6px 14px",
              background: "#eff6ff",
              color: "#1d4ed8",
              border: "1px solid #bfdbfe",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Thêm dòng
          </button>
        </div>

        <div
          className={s.planAssignmentTable}
          style={{
            width: "100%",
            overflowX: "auto",
            paddingBottom: openDropdownIdx !== null ? "260px" : "10px",
            transition: "padding-bottom 0.15s ease",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#334155" }}>
                <th style={{ padding: "9px 12px", border: "1px solid #e2e8f0", textAlign: "left", width: "38%" }}>Nội dung</th>
                <th style={{ padding: "9px 12px", border: "1px solid #e2e8f0", textAlign: "left", width: "22%" }}>Thời gian (thời lượng)</th>
                <th style={{ padding: "9px 12px", border: "1px solid #e2e8f0", textAlign: "left", width: "32%" }}>Đơn vị chủ trì</th>
                <th style={{ padding: "9px 12px", border: "1px solid #e2e8f0", textAlign: "center", width: "8%" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {chuongTrinh.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>
                    <input
                      className={s.businessInput}
                      type="text"
                      value={item.noiDung}
                      onChange={(e) => updateChuongTrinh(idx, "noiDung", e.target.value)}
                      placeholder="Nội dung phần trình bày / hoạt động"
                      disabled={busy}
                      spellCheck={false}
                      style={{ minHeight: "36px", padding: "6px 10px" }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>
                    <input
                      className={s.businessInput}
                      type="text"
                      value={item.thoiGian}
                      onChange={(e) => updateChuongTrinh(idx, "thoiGian", e.target.value)}
                      placeholder="08:00 - 08:30 (30 phút)"
                      disabled={busy}
                      spellCheck={false}
                      style={{ minHeight: "36px", padding: "6px 10px" }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", verticalAlign: "top" }}>
                    {(() => {
                      const isOpen = openDropdownIdx === idx;
                      const currentTeachers = (item.dvChuTri || "")
                        .split(/[,;]\s*/)
                        .map((s) => s.trim())
                        .filter(Boolean);

                      const toggleTeacher = (name: string) => {
                        const trimmed = name.trim();
                        if (!trimmed) return;
                        let next: string[];
                        if (currentTeachers.includes(trimmed)) {
                          next = currentTeachers.filter((t) => t !== trimmed);
                        } else {
                          next = [...currentTeachers, trimmed];
                        }
                        updateChuongTrinh(idx, "dvChuTri", next.join(", "));
                      };

                      return (
                        <div
                          className="staff-combobox-wrapper"
                          style={{ position: "relative", width: "100%" }}
                        >
                          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                            <input
                              className={s.businessInput}
                              type="text"
                              value={item.dvChuTri}
                              onChange={(e) => updateChuongTrinh(idx, "dvChuTri", e.target.value)}
                              placeholder="Thầy/Cô giảng viên ...."
                              disabled={busy}
                              spellCheck={false}
                              style={{
                                minHeight: "36px",
                                padding: "6px 34px 6px 10px",
                                width: "100%",
                                background: "#ffffff",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setOpenDropdownIdx(isOpen ? null : idx)}
                              disabled={busy}
                              title="Bấm vào mũi tên để đổ danh sách Thầy/Cô"
                              style={{
                                position: "absolute",
                                right: "4px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                padding: "6px 8px",
                                color: isOpen ? "#2563eb" : "#64748b",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "4px",
                              }}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                style={{
                                  transform: isOpen ? "rotate(180deg)" : "none",
                                  transition: "transform 0.15s ease",
                                }}
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          </div>

                          {isOpen && (
                            <div
                              style={{
                                position: "absolute",
                                top: "calc(100% + 4px)",
                                left: 0,
                                width: "100%",
                                minWidth: "260px",
                                maxHeight: "280px",
                                overflowY: "auto",
                                background: "#ffffff",
                                border: "1px solid #cbd5e1",
                                borderRadius: "8px",
                                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.08)",
                                zIndex: 100,
                              }}
                            >
                              <div
                                style={{
                                  padding: "6px 12px",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                  color: "#64748b",
                                  background: "#f8fafc",
                                  borderBottom: "1px solid #f1f5f9",
                                }}
                              >
                                Bấm để chọn / bỏ chọn (nhiều Thầy/Cô):
                              </div>
                              {groupedStaff.map((grp) => (
                                <div key={grp.department}>
                                  <div
                                    style={{
                                      padding: "6px 12px",
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      color: "#1e3a8a",
                                      background: "#f1f5f9",
                                      position: "sticky",
                                      top: 0,
                                      borderBottom: "1px solid #e2e8f0",
                                      borderTop: "1px solid #e2e8f0",
                                    }}
                                  >
                                    {grp.department}
                                  </div>
                                  {grp.staff.map((st) => {
                                    const isSelected = currentTeachers.includes(st.fullName);
                                    return (
                                      <div
                                        key={st.key}
                                        onClick={() => toggleTeacher(st.fullName)}
                                        style={{
                                          padding: "7px 12px",
                                          fontSize: "13px",
                                          cursor: "pointer",
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                          background: isSelected ? "#eff6ff" : "transparent",
                                          color: isSelected ? "#1d4ed8" : "#334155",
                                          fontWeight: isSelected ? 600 : 400,
                                          borderBottom: "1px solid #f8fafc",
                                          userSelect: "none",
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#f8fafc";
                                        }}
                                        onMouseLeave={(e) => {
                                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
                                        }}
                                      >
                                        <span>{st.fullName}</span>
                                        {isSelected && (
                                          <span style={{ color: "#2563eb", fontWeight: 700, fontSize: "14px" }}>
                                            ✓
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => removeChuongTrinhRow(idx)}
                      disabled={busy}
                      style={{
                        background: "#fff1f2",
                        color: "#be123c",
                        border: "1px solid #fecdd3",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Khối Bảng 2: Thêm các chủ đề trình bày (truy vấn table CHUDE) */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: "14.5px", color: "#1e3a8a" }}>
              Các chủ đề trình bày (truy vấn table CHUDE)
            </span>
            <span style={{ fontSize: "12.5px", color: "#64748b", marginLeft: "10px" }}>
              (Đồng bộ trực tiếp với table CHUDE trong cơ sở dữ liệu)
            </span>
          </div>
          <button
            type="button"
            onClick={addChuDeRow}
            disabled={busy}
            style={{
              padding: "6px 14px",
              background: "#eff6ff",
              color: "#1d4ed8",
              border: "1px solid #bfdbfe",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Thêm dòng
          </button>
        </div>

        <div className={s.planAssignmentTable} style={{ width: "100%", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#334155" }}>
                <th style={{ padding: "9px 10px", border: "1px solid #e2e8f0", width: "90px", textAlign: "center" }}>Mã chủ đề</th>
                <th style={{ padding: "9px 10px", border: "1px solid #e2e8f0", width: "65px", textAlign: "center" }}>STT</th>
                <th style={{ padding: "9px 10px", border: "1px solid #e2e8f0", textAlign: "left" }}>Tên đề tài (tên chủ đề)</th>
                <th style={{ padding: "9px 10px", border: "1px solid #e2e8f0", width: "120px", textAlign: "center" }}>Thời gian bắt đầu</th>
                <th style={{ padding: "9px 10px", border: "1px solid #e2e8f0", width: "120px", textAlign: "center" }}>Thời gian kết thúc</th>
                <th style={{ padding: "9px 10px", border: "1px solid #e2e8f0", width: "200px", textAlign: "left" }}>Diễn giả</th>
                <th style={{ padding: "9px 10px", border: "1px solid #e2e8f0", width: "70px", textAlign: "center" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {chuDeList.map((cd, idx) => (
                <tr key={idx}>
                  <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                    <span
                      title={
                        cd.maChuDe
                          ? `Mã chủ đề #${cd.maChuDe} (thuộc Seminar #${maSeminar})`
                          : `Chủ đề mới thêm (thuộc Seminar #${maSeminar}, sẽ tự động cấp mã khi Lưu)`
                      }
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: cd.maChuDe ? "#e0f2fe" : "#fef3c7",
                        color: cd.maChuDe ? "#0369a1" : "#b45309",
                        border: `1px solid ${cd.maChuDe ? "#bae6fd" : "#fde68a"}`,
                        cursor: "help",
                      }}
                    >
                      {cd.maChuDe ? `#${cd.maChuDe}` : "Mới"}
                    </span>
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                    <input
                      className={s.businessInput}
                      type="number"
                      value={cd.stt ?? idx + 1}
                      onChange={(e) => updateChuDe(idx, "stt", Number(e.target.value))}
                      disabled={busy}
                      style={{ minHeight: "36px", padding: "6px 8px", textAlign: "center", width: "55px" }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>
                    <input
                      className={s.businessInput}
                      type="text"
                      value={cd.tenChuDe}
                      onChange={(e) => updateChuDe(idx, "tenChuDe", e.target.value)}
                      placeholder="Tên đề tài / tên chủ đề"
                      required
                      disabled={busy}
                      spellCheck={false}
                      style={{ minHeight: "36px", padding: "6px 10px" }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                    <input
                      className={s.businessInput}
                      type="time"
                      value={cd.tgBatDau || ""}
                      onChange={(e) => updateChuDe(idx, "tgBatDau", e.target.value)}
                      disabled={busy}
                      style={{ minHeight: "36px", padding: "6px 8px" }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                    <input
                      className={s.businessInput}
                      type="time"
                      value={cd.tgKetThuc || ""}
                      onChange={(e) => updateChuDe(idx, "tgKetThuc", e.target.value)}
                      disabled={busy}
                      style={{ minHeight: "36px", padding: "6px 8px" }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0" }}>
                    <input
                      className={s.businessInput}
                      type="text"
                      value={cd.dienGia}
                      onChange={(e) => updateChuDe(idx, "dienGia", e.target.value)}
                      placeholder="Họ tên diễn giả (không bắt buộc)"
                      disabled={busy}
                      spellCheck={false}
                      style={{ minHeight: "36px", padding: "6px 10px" }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => removeChuDeRow(idx)}
                      disabled={busy}
                      style={{
                        background: "#fff1f2",
                        color: "#be123c",
                        border: "1px solid #fecdd3",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trường: Nội dung khác */}
      <label className={s.businessField} style={{ width: "100%" }}>
        <span style={{ fontWeight: 600, color: "#475569" }}>Nội dung khác</span>
        <textarea
          className={s.businessInput}
          name="noiDungKhac"
          defaultValue={defaultNoiDungKhac}
          rows={3}
          spellCheck={false}
          placeholder="Nhập nội dung khác hoặc các lưu ý thêm..."
          disabled={busy}
        />
      </label>



      {/* Nút lưu */}
      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
        <button
          type="submit"
          className={s.primary}
          disabled={busy}
          style={{ padding: "10px 24px", fontSize: "14px", fontWeight: 600 }}
        >
          Lưu kế hoạch chi tiết Seminar
        </button>
      </div>
    </form>
  );
}

export function SeminarPlanView({ selected }: { selected: Row }) {
  const seminar = (selected.seminar as Row) || null;
  const chuongTrinh: ChuongTrinhItem[] = Array.isArray(selected.chuongTrinh)
    ? (selected.chuongTrinh as ChuongTrinhItem[])
    : [];
  const chuDeList: ChuDeItem[] = Array.isArray(selected.chuDeList)
    ? (selected.chuDeList as ChuDeItem[])
    : [];

  const maSeminar = text(seminar, "MaSeminar") || text(selected, "MaSeminar");
  const maHD = text(selected, "MaHD");
  const soKeHoach = text(seminar, "SoKeHoach") || `SEM-CNTT-${maHD}/${text(selected, "NamHoc")}`;
  const chuDe = text(seminar, "ChuDe") || text(selected, "TenKeHoach") || text(selected, "TenHoatDong");
  const canCu = text(seminar, "CanCu") || "Kế hoạch năm học của Khoa CNTT";
  const mucDich = text(seminar, "MucDich") || text(selected, "NoiDung") || text(selected, "NoiDungHoatDong");
  const yeuCau = text(seminar, "YeuCau") || "Sinh viên tham dự đúng giờ, điểm danh bằng mã QR, trang phục lịch sự.";
  const thoiGian = text(seminar, "ThoiGian") || (selected?.ThoiGianBatDau ? new Date(String(selected.ThoiGianBatDau)).toLocaleString("vi-VN") : "Chưa cập nhật");
  const diaDiem = text(seminar, "DiaDiem") || text(selected, "DiaDiem") || "Chưa cập nhật";
  const slsv = text(seminar, "SLSVDuKien") || text(selected, "SLSVDuKien") || "100";
  const doiTuong = text(seminar, "DoiTuongTG") || text(selected, "DoiTuongThamDu") || "Sinh viên khoa CNTT";
  const noiDungKhac = text(seminar, "NoiDung") || text(selected, "NoiDungKhac") || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
      {/* Thông tin chung Seminar */}
      <div style={{ display: "grid", gridTemplateColumns: "110px 180px 110px 2.2fr 1.6fr", gap: "14px", width: "100%" }}>
        <div>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Mã Seminar</span>
          <strong style={{ color: "#0369a1" }}>{maSeminar ? `#${maSeminar}` : "Chưa lưu"}</strong>
        </div>
        <div>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Số kế hoạch</span>
          <strong>{soKeHoach}</strong>
        </div>
        <div>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Mã hoạt động</span>
          <strong>#{maHD}</strong>
        </div>
        <div>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Chủ đề</span>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontWeight: 700 }}>{chuDe}</p>
        </div>
        <div>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Căn cứ</span>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{canCu}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", width: "100%", alignItems: "start" }}>
        <div>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Mục đích</span>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{mucDich || "Chưa cập nhật"}</p>
        </div>
        <div>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Yêu cầu</span>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{yeuCau || "Chưa cập nhật"}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1fr 1.6fr", gap: "14px", width: "100%" }}>
        <div>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Thời gian</span>
          <strong>{thoiGian}</strong>
        </div>
        <div>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Địa điểm</span>
          <strong>{diaDiem}</strong>
        </div>
        <div>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>SL SV dự kiến</span>
          <strong>{slsv} sinh viên</strong>
        </div>
        <div>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Đối tượng tham gia</span>
          <span>{doiTuong}</span>
        </div>
      </div>

      {/* Bảng Chương trình seminar */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontWeight: 700, fontSize: "14.5px", color: "#1e3a8a" }}>
          Chương trình / Nội dung seminar
        </span>
        <div className={s.planAssignmentTable} style={{ width: "100%", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#334155" }}>
                <th style={{ padding: "8px 12px", border: "1px solid #e2e8f0", textAlign: "left" }}>Nội dung</th>
                <th style={{ padding: "8px 12px", border: "1px solid #e2e8f0", textAlign: "left", width: "220px" }}>Thời gian (thời lượng)</th>
                <th style={{ padding: "8px 12px", border: "1px solid #e2e8f0", textAlign: "left", width: "200px" }}>Đơn vị chủ trì</th>
              </tr>
            </thead>
            <tbody>
              {chuongTrinh.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: "12px", textAlign: "center", color: "#94a3b8", fontStyle: "italic" }}>
                    Chưa cập nhật chương trình seminar.
                  </td>
                </tr>
              ) : (
                chuongTrinh.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: "8px 12px", border: "1px solid #e2e8f0" }}>{item.noiDung}</td>
                    <td style={{ padding: "8px 12px", border: "1px solid #e2e8f0" }}>{item.thoiGian}</td>
                    <td style={{ padding: "8px 12px", border: "1px solid #e2e8f0" }}>
                      {item.dvChuTri ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {item.dvChuTri.split(/[,;]\s*/).map((t, ti) => (
                            <span
                              key={ti}
                              style={{
                                display: "inline-block",
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                border: "1px solid #bfdbfe",
                                borderRadius: "5px",
                                padding: "2px 8px",
                                fontSize: "12.5px",
                                fontWeight: 500,
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bảng Các chủ đề trình bày (truy vấn table CHUDE) */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontWeight: 700, fontSize: "14.5px", color: "#1e3a8a" }}>
          Các chủ đề trình bày (truy vấn table CHUDE)
        </span>
        <div className={s.planAssignmentTable} style={{ width: "100%", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#334155" }}>
                <th style={{ padding: "8px 10px", border: "1px solid #e2e8f0", width: "80px", textAlign: "center" }}>Mã chủ đề</th>
                <th style={{ padding: "8px 10px", border: "1px solid #e2e8f0", width: "60px", textAlign: "center" }}>STT</th>
                <th style={{ padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "left" }}>Tên đề tài (tên chủ đề)</th>
                <th style={{ padding: "8px 10px", border: "1px solid #e2e8f0", width: "130px", textAlign: "center" }}>Thời gian bắt đầu</th>
                <th style={{ padding: "8px 10px", border: "1px solid #e2e8f0", width: "130px", textAlign: "center" }}>Thời gian kết thúc</th>
                <th style={{ padding: "8px 10px", border: "1px solid #e2e8f0", width: "200px", textAlign: "left" }}>Diễn giả</th>
              </tr>
            </thead>
            <tbody>
              {chuDeList.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "12px", textAlign: "center", color: "#94a3b8", fontStyle: "italic" }}>
                    Chưa có chủ đề báo cáo nào trong bảng CHUDE.
                  </td>
                </tr>
              ) : (
                chuDeList.map((cd: any, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "11.5px",
                          fontWeight: 600,
                          background: "#e0f2fe",
                          color: "#0369a1",
                        }}
                      >
                        #{cd.MaChuDe || cd.maChuDe}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                      {cd.STT || cd.stt || idx + 1}
                    </td>
                    <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", fontWeight: 600 }}>
                      {cd.TenChuDe || cd.tenChuDe}
                    </td>
                    <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                      {cd.TgBatDau || cd.tgBatDau || "-"}
                    </td>
                    <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "center" }}>
                      {cd.TgKetThuc || cd.tgKetThuc || "-"}
                    </td>
                    <td style={{ padding: "8px 10px", border: "1px solid #e2e8f0" }}>
                      {cd.DienGia || cd.dienGia}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nội dung khác */}
      {noiDungKhac && (
        <div style={{ width: "100%" }}>
          <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Nội dung khác</span>
          <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{noiDungKhac}</p>
        </div>
      )}


    </div>
  );
}
