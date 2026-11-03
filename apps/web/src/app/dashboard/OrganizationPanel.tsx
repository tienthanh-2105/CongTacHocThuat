"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { workflowRequest } from "@/services/workflow";
import type { AuthUser } from "@/services/auth";
import s from "./dashboard.module.css";
import NoticeDialog from "./NoticeDialog";
import { PlanCommitteesEditor, PlanCommitteesSummary, type Committee, type PlanStaff, type WorkItem } from "./PlanCommittees";
import { SeminarPlanEditor, SeminarPlanView } from "./SeminarPlanEditor";
import { CompetitionPlanEditor, CompetitionPlanView } from "./CompetitionPlanEditor";
import { exportDetailedPlanPdf } from "./detailedPlanExport";

type Row = Record<string, unknown>;
type Field = { name: string; label: string; type?: string; optional?: boolean; options?: { value: string; label: string }[] };
const text = (r: Row, k: string) => String(r[k] ?? "");
const rows = (v: unknown): Row[] => Array.isArray(v) ? v as Row[] : [];
const date = (v: unknown) => v ? new Date(String(v)).toLocaleString("vi-VN") : "Chưa cập nhật";
const inputDate = (v: unknown) => { if (!v) return ""; const d = new Date(String(v)); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16); };

function ActionForm({ title, submitLabel, fields, defaults = {}, onSave, busy, children, onDirty }: { title?: string; submitLabel?: string; fields: Field[]; defaults?: Row; onSave: (v: Row) => Promise<void>; busy: boolean; children?: ReactNode; onDirty?: () => void }) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget); const value: Row = {};
    for (const field of fields) {
      const raw = String(data.get(field.name) ?? "").trim();
      if (raw) value[field.name] = field.type === "number" ? Number(raw) : field.type === "datetime-local" ? new Date(raw).toISOString() : raw;
    }
    if (data.has("cacBan")) value.cacBan = JSON.parse(String(data.get("cacBan")));
    await onSave(value);
  }
  return <form className={s.businessForm} onSubmit={submit} onChange={onDirty}>{title ? <h3>{title}</h3> : null}{fields.map(f => <label className={s.businessField} key={f.name}><span>{f.label}</span>{f.options
    ? <select className={s.businessInput} disabled={busy} name={f.name} defaultValue={text(defaults,f.name)} required={!f.optional}><option value="">Chọn…</option>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
    : f.type === "textarea" ? <textarea className={s.businessInput} disabled={busy} name={f.name} defaultValue={text(defaults,f.name)} required={!f.optional} rows={4} />
      : <input className={s.businessInput} disabled={busy} name={f.name} type={f.type ?? "text"} defaultValue={text(defaults,f.name)} required={!f.optional} min={f.type === "number" ? 0 : undefined} step={f.type === "number" ? "any" : undefined} />}</label>)}{children}<button className={s.primary} disabled={busy}>{submitLabel || title || "Lưu"}</button></form>;
}

export default function OrganizationPanel({
  user,
  detailed,
  filterType,
  onNavigateTab,
}: {
  user: AuthUser;
  detailed: boolean;
  filterType?: "Cuộc thi" | "Seminar" | "Phân công thực hiện" | "Tất cả";
  onNavigateTab?: (sectionId: string, activityId?: string) => void;
}) {
  const [list, setList] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [round, setRound] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [planDirty, setPlanDirty] = useState(false);
  const [viewMode, setViewMode] = useState<"view" | "edit">("view");
  const base = detailed ? "/detailed-plans" : "/competition-workflow/competitions";

  function renderStatusBadge(statusVal: string) {
    const st = statusVal || "Chưa lập chi tiết";
    let bg = "#f1f5f9";
    let color = "#475569";
    let border = "#e2e8f0";

    if (st === "Đã duyệt" || st === "Đã công bố") {
      bg = "#dcfce7";
      color = "#15803d";
      border = "#86efac";
    } else if (st === "Cần lập ban đề thi" || st === "Chờ phân công thực hiện") {
      bg = "#fff7ed";
      color = "#c2410c";
      border = "#fed7aa";
    } else if (st === "Chờ khoa xét duyệt" || st === "Chờ khoa ký" || st === "Chờ CTSV ký") {
      bg = "#fef3c7";
      color = "#b45309";
      border = "#fde68a";
    } else if (st === "Dự thảo") {
      bg = "#eff6ff";
      color = "#1d4ed8";
      border = "#bfdbfe";
    } else if (st === "Cần bổ sung" || st === "Từ chối") {
      bg = "#fee2e2";
      color = "#b91c1c";
      border = "#fca5a5";
    }

    return (
      <span
        style={{
          display: "inline-block",
          padding: "3px 8px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: 600,
          background: bg,
          color: color,
          border: `1px solid ${border}`,
          whiteSpace: "nowrap",
        }}
      >
        {st}
      </span>
    );
  }

  useEffect(() => {
    let active = true;
    void workflowRequest<Row[]>(base).then(v => {
      if (active) {
        setList(v);
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const actId = params.get("activityId");
          if (actId) {
            void open(actId, "edit");
          }
        }
      }
    }).catch(e => {
      if (active) setError(e.message);
    });
    return () => { active = false; };
  }, [base, filterType]);

  useEffect(() => {
    setSelected(null);
    setRound(null);
    setPlanDirty(false);
  }, [filterType]);

  async function open(id: string, mode: "view" | "edit" = "view") {
    try {
      setError("");
      setSelected(await workflowRequest<Row>(`${base}/${id}`));
      setRound(null);
      setPlanDirty(false);
      setViewMode(mode);
    } catch(e) {
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu");
    }
  }

  async function openRound(id: string) {
    try {
      setError("");
      setRound(await workflowRequest<Row>(`/competition-workflow/rounds/${id}`));
    } catch(e) {
      setError(e instanceof Error ? e.message : "Không tải được vòng thi");
    }
  }

  async function act(path: string, method = "POST", body: Row = {}) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await workflowRequest(path, { method, body });
      setNotice("Đã lưu.");
      setList(await workflowRequest<Row[]>(base));
      if (selected) setSelected(await workflowRequest<Row>(`${base}/${detailed ? selected.MaHD : (selected.competition as Row).MaCThi}`));
      if (round) setRound(await workflowRequest<Row>(`/competition-workflow/rounds/${(round.round as Row).MaVong}`));
      if (detailed && method === "PUT") setPlanDirty(false);
    } catch(e) {
      setError(e instanceof Error ? e.message : "Không thực hiện được thao tác");
    } finally {
      setBusy(false);
    }
  }

  const detailId = selected ? text(selected, "MaHD") : "";
  const status = selected ? text(selected, "TrangThai") : "";
  const canEdit = detailed && Boolean(selected?.canEdit);
  const canSign = user.roles.includes("ADMIN") || ((status === "Chờ khoa xét duyệt" || status === "Chờ khoa ký") && (user.roles.includes("TRUONGKHOA") || user.roles.includes("CANBOKHOA"))) || (status === "Chờ CTSV ký" && user.roles.includes("PHONGCTSV"));
  const competition = selected?.competition as Row | undefined;
  const currentRound = round?.round as Row | undefined;
  const options = (items: Row[], key: string, label: string) => items.map(r => ({ value: text(r, key), label: `${text(r, label)} (#${text(r, key)})` }));
  const roundPath = `/competition-workflow/rounds/${currentRound?.MaVong}`;

  const currentFilter = filterType ?? "Tất cả";
  const isAssignmentTab = currentFilter === "Phân công thực hiện";
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<"Tất cả" | "Seminar" | "Cuộc thi">("Tất cả");

  const displayList = detailed
    ? isAssignmentTab
      ? list
      : selectedTypeFilter === "Seminar"
      ? list.filter((r) => String(r.LoaiHoatDong ?? "").trim().toLowerCase() === "seminar")
      : selectedTypeFilter === "Cuộc thi"
      ? list.filter((r) => String(r.LoaiHoatDong ?? "").trim().toLowerCase() === "cuộc thi")
      : list
    : list;
  const seminarCount = list.filter((r) => String(r.LoaiHoatDong ?? "").trim().toLowerCase() === "seminar").length;
  const competitionCount = list.filter((r) => String(r.LoaiHoatDong ?? "").trim().toLowerCase() === "cuộc thi").length;
  const assignmentCount = list.length;
  const isFacultyWide = user.roles.some((r) =>
    ["ADMIN", "CANBOKHOA", "TRUONGKHOA", "PHONGCTSV", "PHONGKHCN", "HIEUTRUONG"].includes(r.toUpperCase())
  );
  const isFacultyReviewer = user.roles.some((r) =>
    ["ADMIN", "CANBOKHOA", "TRUONGKHOA", "PHONGCTSV"].includes(r.toUpperCase())
  );

  async function handleExportPdf(maHD: string | number) {
    setBusy(true);
    setError("");
    try {
      const detail = await workflowRequest<Row>(`/detailed-plans/${maHD}`);
      exportDetailedPlanPdf(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được kế hoạch để xuất PDF");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.businessPanel}>
      {error ? <NoticeDialog message={error} kind="error" onClose={() => setError("")} /> : notice ? <NoticeDialog message={notice} kind="success" onClose={() => setNotice("")} /> : null}

      {detailed && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => onNavigateTab ? onNavigateTab("detailed-plans-all") : undefined}
              style={{
                padding: "9px 18px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: !isAssignmentTab ? 700 : 500,
                background: !isAssignmentTab ? "#2563eb" : "#f1f5f9",
                color: !isAssignmentTab ? "#ffffff" : "#475569",
                boxShadow: !isAssignmentTab ? "0 4px 12px rgba(37,99,235,0.25)" : "none",
                transition: "all 0.15s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>📑 Kế hoạch chi tiết Seminar và Cuộc thi</span>
              <span
                style={{
                  fontSize: "12px",
                  padding: "2px 7px",
                  borderRadius: "10px",
                  background: !isAssignmentTab ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                  color: !isAssignmentTab ? "#ffffff" : "#475569",
                }}
              >
                {list.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab ? onNavigateTab("detailed-plans-assignment") : undefined}
              style={{
                padding: "9px 18px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: isAssignmentTab ? 700 : 500,
                background: isAssignmentTab ? "#2563eb" : "#f1f5f9",
                color: isAssignmentTab ? "#ffffff" : "#475569",
                boxShadow: isAssignmentTab ? "0 4px 12px rgba(37,99,235,0.25)" : "none",
                transition: "all 0.15s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>👥 Phân công thực hiện</span>
              <span
                style={{
                  fontSize: "12px",
                  padding: "2px 7px",
                  borderRadius: "10px",
                  background: isAssignmentTab ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                  color: isAssignmentTab ? "#ffffff" : "#475569",
                }}
              >
                {assignmentCount}
              </span>
            </button>
          </div>

          {!isAssignmentTab && (
            <div style={{ display: "inline-flex", background: "#f1f5f9", padding: "4px", borderRadius: "8px", gap: "4px" }}>
              {(["Tất cả", "Seminar", "Cuộc thi"] as const).map((opt) => {
                const isAct = selectedTypeFilter === opt;
                const count = opt === "Tất cả" ? list.length : opt === "Seminar" ? seminarCount : competitionCount;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSelectedTypeFilter(opt)}
                    style={{
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 14px",
                      fontSize: "12.5px",
                      fontWeight: isAct ? 700 : 500,
                      background: isAct ? "#ffffff" : "transparent",
                      color: isAct ? "#2563eb" : "#64748b",
                      boxShadow: isAct ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {opt} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <section className={s.card}>
        {!detailed ? (
          <h2>Vòng thi, đề thi, bài thi và trao giải</h2>
        ) : isAssignmentTab ? (
          <h2 style={{ margin: "0 0 6px", fontSize: "18px", color: "#1e3a8a" }}>
            Phân công thực hiện kế hoạch hoạt động
          </h2>
        ) : (
          <h2 style={{ margin: "0 0 6px", fontSize: "18px", color: "#1e3a8a" }}>
            Kế hoạch chi tiết Seminar và Cuộc thi
          </h2>
        )}
        <p style={{ margin: "0 0 12px", color: "#64748b" }}>
          {detailed
            ? isAssignmentTab
              ? "Lập các ban (Ban tổ chức, Ban đề thi, Ban thư ký, Ban giám khảo...) và phân công cán bộ, giảng viên phụ trách thực hiện kế hoạch chi tiết."
              : "Bộ môn lập kế hoạch tổ chức cho các buổi seminar và cuộc thi học thuật từ kế hoạch chung đã duyệt → Phân công thực hiện (chuyển sang Dự thảo) → Trình Khoa xét duyệt → Ban tổ chức công bố."
            : "Chỉ hiển thị cuộc thi có kế hoạch chi tiết đã ký và đã công bố. Sinh viên đăng ký hoạt động trước, sau đó đăng ký từng vòng."}
        </p>

        {!displayList.length ? (
          <p>
            Chưa có {detailed ? (isAssignmentTab ? "hoạt động" : "seminar hoặc cuộc thi") : "cuộc thi"} trong kế hoạch chung đã duyệt.
          </p>
        ) : detailed ? (
          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "10px", marginTop: "14px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13.5px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569", width: "80px", textAlign: "center" }}>Mã HĐ</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569", minWidth: "240px" }}>Tên hoạt động</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569", width: "110px", textAlign: "center" }}>Loại</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569", width: "170px" }}>Bộ môn</th>
                  {isAssignmentTab ? (
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569", width: "170px", textAlign: "center" }}>Phân công hiện tại</th>
                  ) : (
                    <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569", width: "110px", textAlign: "center" }}>Năm học</th>
                  )}
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569", width: "140px", textAlign: "center" }}>Trạng thái</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, color: "#475569", width: isFacultyReviewer ? "330px" : (isAssignmentTab ? "260px" : "360px"), minWidth: isFacultyReviewer ? "320px" : "260px", textAlign: "center" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {displayList.map((r, idx) => {
                  const isMyDept = isFacultyWide || Boolean(r.canManage);
                  const st = text(r, "TrangThai");
                  const hasPlan = Boolean(r.MaKHToChuc);
                  const isApproved = st === "Đã duyệt";
                  const isSubmitted = ["Chờ khoa xét duyệt", "Chờ khoa ký", "Chờ CTSV ký", "Đã duyệt"].includes(st);
                  const canEditPlan = isMyDept && (!hasPlan || ["Chờ phân công thực hiện", "Cần lập ban đề thi", "Dự thảo", "Cần bổ sung", "Từ chối"].includes(st));
                  const canAssign = isMyDept && hasPlan && ["Chờ phân công thực hiện", "Cần lập ban đề thi", "Dự thảo", "Cần bổ sung", "Từ chối"].includes(st);
                  const canSubmit = isMyDept && hasPlan && ["Dự thảo", "Cần lập ban đề thi", "Cần bổ sung", "Từ chối"].includes(st);
                  const canSignRow = user.roles.includes("ADMIN") ||
                    ((st === "Chờ khoa xét duyệt" || st === "Chờ khoa ký") && (user.roles.includes("TRUONGKHOA") || user.roles.includes("CANBOKHOA"))) ||
                    (st === "Chờ CTSV ký" && user.roles.includes("PHONGCTSV"));
                  const isSelected = selected && text(selected, "MaHD") === text(r, "MaHD");

                  const parsedCommittees = (() => {
                    try {
                      return JSON.parse(String(r.CacBan || "[]")) as Committee[];
                    } catch {
                      return [];
                    }
                  })();
                  const totalMembers = parsedCommittees.reduce((sum, c) => sum + (Array.isArray(c.thanhVien) ? c.thanhVien.length : 0), 0);

                  return (
                    <tr
                      key={text(r, "MaHD")}
                      style={{
                        borderBottom: idx === displayList.length - 1 ? "none" : "1px solid #f1f5f9",
                        background: isSelected ? "#eff6ff" : undefined,
                        transition: "background 0.15s ease",
                      }}
                    >
                      <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 600, color: "#64748b" }}>
                        #{text(r, "MaHD")}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 600, color: "#1e293b", lineHeight: "1.4" }}>
                          {text(r, "TenHoatDong")}
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "3px 9px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 600,
                          background: String(r.LoaiHoatDong ?? "").toLowerCase() === "seminar" ? "#e0e7ff" : "#fef3c7",
                          color: String(r.LoaiHoatDong ?? "").toLowerCase() === "seminar" ? "#3730a3" : "#92400e",
                          border: String(r.LoaiHoatDong ?? "").toLowerCase() === "seminar" ? "1px solid #c7d2fe" : "1px solid #fde68a",
                        }}>
                          {text(r, "LoaiHoatDong") || "Seminar"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", color: "#334155" }}>
                        <div style={{ fontWeight: 500 }}>{text(r, "TenBM") || "Chưa phân công"}</div>
                        {!isFacultyWide && (
                          <div style={{ fontSize: "11px", marginTop: "2px" }}>
                            {isMyDept ? (
                              <span style={{ color: "#16a34a", fontWeight: 600 }}>Phụ trách</span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>Chỉ xem</span>
                            )}
                          </div>
                        )}
                      </td>
                      {isAssignmentTab ? (
                        <td style={{ padding: "12px 14px", textAlign: "center", color: "#475569" }}>
                          {parsedCommittees.length > 0 ? (
                            <span style={{ fontWeight: 600, color: "#2563eb" }}>
                              {parsedCommittees.length} ban · {totalMembers} cán bộ
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>Chưa lập ban</span>
                          )}
                        </td>
                      ) : (
                        <td style={{ padding: "12px 14px", textAlign: "center", color: "#475569" }}>
                          {text(r, "NamHoc") || "—"}
                        </td>
                      )}
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        {renderStatusBadge(st)}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: "6px", alignItems: "center", justifyContent: "center", flexWrap: "nowrap" }}>
                          {isFacultyReviewer ? (
                            <>
                              {/* 1. Xem */}
                              <button
                                type="button"
                                disabled={!hasPlan}
                                title={hasPlan ? "Xem chi tiết kế hoạch" : "Chưa có kế hoạch chi tiết để xem"}
                                onClick={() => void open(text(r, "MaHD"), "view")}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  border: hasPlan ? "1px solid #cbd5e1" : "1px solid #e2e8f0",
                                  background: hasPlan ? "#ffffff" : "#f8fafc",
                                  color: hasPlan ? "#334155" : "#94a3b8",
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  cursor: hasPlan ? "pointer" : "not-allowed",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Xem
                              </button>

                              {/* 2. Ký duyệt */}
                              <button
                                type="button"
                                disabled={!canSignRow || !["Chờ khoa xét duyệt", "Chờ khoa ký", "Chờ CTSV ký"].includes(st) || busy}
                                title={
                                  st === "Đã duyệt"
                                    ? "Kế hoạch đã được duyệt"
                                    : !hasPlan
                                    ? "Chưa có kế hoạch chi tiết"
                                    : ["Chờ khoa xét duyệt", "Chờ khoa ký", "Chờ CTSV ký"].includes(st)
                                    ? "Ký duyệt kế hoạch chi tiết"
                                    : "Kế hoạch chưa trình xét duyệt"
                                }
                                onClick={() => {
                                  if (window.confirm(`Xác nhận Ký duyệt kế hoạch "${text(r, "TenHoatDong")}"?`)) {
                                    void act(`/detailed-plans/${text(r, "MaHD")}/review`, "PATCH", { action: "approve" });
                                  }
                                }}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  border: canSignRow && ["Chờ khoa xét duyệt", "Chờ khoa ký", "Chờ CTSV ký"].includes(st) ? "1px solid #16a34a" : "1px solid #e2e8f0",
                                  background: canSignRow && ["Chờ khoa xét duyệt", "Chờ khoa ký", "Chờ CTSV ký"].includes(st) ? "#16a34a" : "#f8fafc",
                                  color: canSignRow && ["Chờ khoa xét duyệt", "Chờ khoa ký", "Chờ CTSV ký"].includes(st) ? "#ffffff" : "#94a3b8",
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  cursor: canSignRow && ["Chờ khoa xét duyệt", "Chờ khoa ký", "Chờ CTSV ký"].includes(st) ? "pointer" : "not-allowed",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Ký duyệt
                              </button>

                              {/* 3. Trả lại */}
                              <button
                                type="button"
                                disabled={!canSignRow || !["Chờ khoa xét duyệt", "Chờ khoa ký", "Chờ CTSV ký"].includes(st) || busy}
                                title={
                                  st === "Đã duyệt"
                                    ? "Kế hoạch đã được duyệt"
                                    : !hasPlan
                                    ? "Chưa có kế hoạch chi tiết"
                                    : ["Chờ khoa xét duyệt", "Chờ khoa ký", "Chờ CTSV ký"].includes(st)
                                    ? "Yêu cầu bộ môn bổ sung / chỉnh sửa"
                                    : "Kế hoạch chưa trình xét duyệt"
                                }
                                onClick={() => {
                                  if (window.confirm(`Yêu cầu bộ môn bổ sung kế hoạch "${text(r, "TenHoatDong")}"?`)) {
                                    void act(`/detailed-plans/${text(r, "MaHD")}/review`, "PATCH", { action: "request_changes" });
                                  }
                                }}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  border: canSignRow && ["Chờ khoa xét duyệt", "Chờ khoa ký", "Chờ CTSV ký"].includes(st) ? "1px solid #f59e0b" : "1px solid #e2e8f0",
                                  background: canSignRow && ["Chờ khoa xét duyệt", "Chờ khoa ký", "Chờ CTSV ký"].includes(st) ? "#fffbeb" : "#f8fafc",
                                  color: canSignRow && ["Chờ khoa xét duyệt", "Chờ khoa ký", "Chờ CTSV ký"].includes(st) ? "#b45309" : "#94a3b8",
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  cursor: canSignRow && ["Chờ khoa xét duyệt", "Chờ khoa ký", "Chờ CTSV ký"].includes(st) ? "pointer" : "not-allowed",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Trả lại
                              </button>

                              {/* 4. Xuất PDF */}
                              <button
                                type="button"
                                disabled={!hasPlan || busy}
                                title={hasPlan ? "Xuất tài liệu kế hoạch chi tiết ra PDF" : "Chưa có kế hoạch chi tiết để xuất PDF"}
                                onClick={() => void handleExportPdf(text(r, "MaHD"))}
                                style={{
                                  padding: "6px 11px",
                                  borderRadius: "6px",
                                  border: hasPlan ? "1px solid #fecdd3" : "1px solid #e2e8f0",
                                  background: hasPlan ? "#fff1f2" : "#f8fafc",
                                  color: hasPlan ? "#be123c" : "#94a3b8",
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  cursor: hasPlan ? "pointer" : "not-allowed",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Xuất PDF
                              </button>
                            </>
                          ) : isAssignmentTab ? (
                            <>
                              <button
                                type="button"
                                title={
                                  !hasPlan
                                    ? "Chưa có kế hoạch chi tiết để phân công"
                                    : !isMyDept
                                    ? "Hoạt động thuộc bộ môn khác (chỉ xem)"
                                    : isApproved
                                    ? "Kế hoạch đã được duyệt (chỉ xem phân công)"
                                    : isSubmitted
                                    ? "Kế hoạch đang chờ duyệt (chỉ xem phân công)"
                                    : "Mở biểu mẫu phân công thực hiện"
                                }
                                onClick={() => void open(text(r, "MaHD"), canAssign ? "edit" : "view")}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  border: canAssign ? "1px solid #93c5fd" : "1px solid #cbd5e1",
                                  background: canAssign ? "#eff6ff" : "#f8fafc",
                                  color: canAssign ? "#1d4ed8" : "#475569",
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {canAssign ? (hasPlan ? "Phân công" : "Lập KH / Phân công") : "Xem phân công"}
                              </button>
                              <button
                                type="button"
                                disabled={!canSubmit || busy}
                                title={
                                  !isMyDept
                                    ? "Không có quyền thao tác"
                                    : isSubmitted
                                    ? "Kế hoạch đã được trình xét duyệt / đã duyệt"
                                    : !hasPlan
                                    ? "Chưa lưu kế hoạch chi tiết để gửi"
                                    : st === "Chờ phân công thực hiện"
                                    ? "Cần hoàn tất phân công thực hiện (chuyển sang Dự thảo) trước khi trình khoa ký"
                                    : "Trình Khoa xét duyệt kế hoạch chi tiết"
                                }
                                onClick={() => {
                                  if (window.confirm(`Xác nhận gửi kế hoạch "${text(r, "TenHoatDong")}" trình Khoa xét duyệt?`)) {
                                    void act(`/detailed-plans/${text(r, "MaHD")}/submit`);
                                  }
                                }}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  border: canSubmit ? "1px solid #86efac" : "1px solid #e2e8f0",
                                  background: canSubmit ? "#f0fdf4" : "#f8fafc",
                                  color: canSubmit ? "#15803d" : "#94a3b8",
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  cursor: canSubmit ? "pointer" : "not-allowed",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {isSubmitted ? "Đã gửi" : "Trình khoa"}
                              </button>
                              <button
                                type="button"
                                disabled={!hasPlan || busy}
                                title={hasPlan ? "Xuất tài liệu kế hoạch chi tiết ra PDF" : "Chưa có kế hoạch chi tiết để xuất PDF"}
                                onClick={() => void handleExportPdf(text(r, "MaHD"))}
                                style={{
                                  padding: "6px 11px",
                                  borderRadius: "6px",
                                  border: hasPlan ? "1px solid #fecdd3" : "1px solid #e2e8f0",
                                  background: hasPlan ? "#fff1f2" : "#f8fafc",
                                  color: hasPlan ? "#be123c" : "#94a3b8",
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  cursor: hasPlan ? "pointer" : "not-allowed",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Xuất PDF
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Nút Xem */}
                              <button
                                type="button"
                                disabled={!hasPlan}
                                title={hasPlan ? "Xem chi tiết kế hoạch" : "Chưa có kế hoạch chi tiết để xem"}
                                onClick={() => void open(text(r, "MaHD"), "view")}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  border: hasPlan ? "1px solid #cbd5e1" : "1px solid #e2e8f0",
                                  background: hasPlan ? "#ffffff" : "#f8fafc",
                                  color: hasPlan ? "#334155" : "#94a3b8",
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  cursor: hasPlan ? "pointer" : "not-allowed",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Xem
                              </button>

                              {/* Nút Xử lý */}
                              <button
                                type="button"
                                disabled={!canEditPlan}
                                title={
                                  !isMyDept
                                    ? "Hoạt động thuộc bộ môn khác (chỉ xem)"
                                    : isApproved
                                    ? "Kế hoạch đã được duyệt, không thể chỉnh sửa"
                                    : isSubmitted
                                    ? "Kế hoạch đang chờ xét duyệt, không thể chỉnh sửa"
                                    : hasPlan
                                    ? "Chỉnh sửa kế hoạch chi tiết"
                                    : "Lập kế hoạch chi tiết"
                                }
                                onClick={() => void open(text(r, "MaHD"), "edit")}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  border: canEditPlan ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                                  background: canEditPlan ? "#eff6ff" : "#f8fafc",
                                  color: canEditPlan ? "#1d4ed8" : "#94a3b8",
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  cursor: canEditPlan ? "pointer" : "not-allowed",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {!hasPlan ? "Lập kế hoạch" : "Xử lý"}
                              </button>

                              {/* Nút Phân công - Chuyển sang trang Phân công thực hiện */}
                              <button
                                type="button"
                                disabled={!canAssign}
                                title={
                                  !hasPlan
                                    ? "Cần lập kế hoạch chi tiết trước khi phân công"
                                    : !isMyDept
                                    ? "Hoạt động thuộc bộ môn khác (chỉ xem)"
                                    : isApproved
                                    ? "Kế hoạch đã được duyệt, không thể thay đổi phân công"
                                    : isSubmitted
                                    ? "Kế hoạch đang chờ xét duyệt, không thể thay đổi phân công"
                                    : "Đi đến trang Phân công thực hiện cho hoạt động này"
                                }
                                onClick={() => {
                                  if (canAssign && onNavigateTab) {
                                    onNavigateTab("detailed-plans-assignment", text(r, "MaHD"));
                                  }
                                }}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  border: canAssign ? "1px solid #c7d2fe" : "1px solid #e2e8f0",
                                  background: canAssign ? "#eef2ff" : "#f8fafc",
                                  color: canAssign ? "#4338ca" : "#94a3b8",
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  cursor: canAssign ? "pointer" : "not-allowed",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Phân công
                              </button>

                              {/* Nút Gửi */}
                              <button
                                type="button"
                                disabled={!canSubmit || busy}
                                title={
                                  !isMyDept
                                    ? "Không có quyền thao tác"
                                    : isSubmitted
                                    ? "Kế hoạch đã được trình xét duyệt / đã duyệt"
                                    : !hasPlan
                                    ? "Chưa lưu kế hoạch chi tiết để gửi"
                                    : st === "Chờ phân công thực hiện"
                                    ? "Cần hoàn tất phân công thực hiện (chuyển sang Dự thảo) trước khi trình khoa ký"
                                    : "Trình Khoa xét duyệt kế hoạch chi tiết"
                                }
                                onClick={() => {
                                  if (window.confirm(`Xác nhận gửi kế hoạch "${text(r, "TenHoatDong")}" trình Khoa xét duyệt?`)) {
                                    void act(`/detailed-plans/${text(r, "MaHD")}/submit`);
                                  }
                                }}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  border: canSubmit ? "1px solid #86efac" : "1px solid #e2e8f0",
                                  background: canSubmit ? "#f0fdf4" : "#f8fafc",
                                  color: canSubmit ? "#15803d" : "#94a3b8",
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  cursor: canSubmit ? "pointer" : "not-allowed",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {isSubmitted ? "Đã gửi" : "Gửi"}
                              </button>

                              {/* Nút Xuất PDF */}
                              <button
                                type="button"
                                disabled={!hasPlan || busy}
                                title={hasPlan ? "Xuất tài liệu kế hoạch chi tiết ra PDF" : "Chưa có kế hoạch chi tiết để xuất PDF"}
                                onClick={() => void handleExportPdf(text(r, "MaHD"))}
                                style={{
                                  padding: "6px 11px",
                                  borderRadius: "6px",
                                  border: hasPlan ? "1px solid #fecdd3" : "1px solid #e2e8f0",
                                  background: hasPlan ? "#fff1f2" : "#f8fafc",
                                  color: hasPlan ? "#be123c" : "#94a3b8",
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  cursor: hasPlan ? "pointer" : "not-allowed",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Xuất PDF
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={s.businessList}>
            {displayList.map(r => (
              <article key={text(r, "MaCThi")}>
                <div>
                  <strong>{text(r, "TenHoatDong")}</strong>
                  <p>
                    {text(r, "NamHoc")} · {text(r, "TenBM")} · {text(r, "TrangThai") || "Chưa lập chi tiết"}
                  </p>
                </div>
                <button onClick={() => void open(text(r, "MaCThi"), "view")}>Xem / xử lý</button>
              </article>
            ))}
          </div>
        )}
      </section>

      {detailed && selected && isAssignmentTab && (
        <section className={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px", fontSize: "20px", color: "#1e3a8a" }}>
                <span>Phân công thực hiện: #{text(selected, "MaHD")} · {text(selected, "TenHoatDong")}</span>
              </h2>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {Boolean(selected.MaKHToChuc) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleExportPdf(text(selected, "MaHD"))}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "1px solid #fecdd3",
                    background: "#fff1f2",
                    color: "#be123c",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>📄 Xuất PDF</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const targetTab = "detailed-plans-all";
                  if (onNavigateTab) {
                    onNavigateTab(targetTab, text(selected, "MaHD"));
                  }
                }}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#1e293b",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>📑 Xem kế hoạch chi tiết</span>
                <span>→</span>
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#64748b",
                  fontSize: "12.5px",
                  cursor: "pointer",
                }}
              >
                ✕ Đóng
              </button>
            </div>
          </div>

          {!isFacultyWide && !selected.canManage && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#fffbeb",
              color: "#92400e",
              border: "1px solid #fde68a",
              padding: "9px 13px",
              borderRadius: "8px",
              fontSize: "13px",
              margin: "10px 0 14px",
              fontWeight: 500,
            }}>
              <span>🔒</span>
              <span>
                <strong>Chế độ chỉ xem:</strong> Hoạt động này thuộc <strong>Bộ môn {text(selected, "TenBM")}</strong>. Bạn chỉ có quyền xem phân công cán bộ, không được chỉnh sửa.
              </span>
            </div>
          )}

          {status === "Dự thảo" ? (
            <div style={{
              background: "#eff6ff",
              color: "#1e40af",
              border: "1px solid #bfdbfe",
              padding: "11px 15px",
              borderRadius: "8px",
              fontSize: "13.5px",
              margin: "10px 0 16px",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
              <span style={{ fontSize: "18px" }}>ℹ️</span>
              <span>
                Phân công đã được lưu ở trạng thái <strong>Dự thảo</strong>. Bạn có thể bấm nút <strong>Trình khoa ký</strong> để gửi Khoa xét duyệt.
              </span>
            </div>
          ) : status === "Chờ khoa xét duyệt" || status === "Chờ khoa ký" ? (
            <div style={{
              background: "#fef3c7",
              color: "#92400e",
              border: "1px solid #fde68a",
              padding: "11px 15px",
              borderRadius: "8px",
              fontSize: "13.5px",
              margin: "10px 0 16px",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
              <span style={{ fontSize: "18px" }}>⏳</span>
              <span>
                Kế hoạch đang ở trạng thái <strong>{status}</strong>. Đang chờ Trưởng khoa / Cán bộ khoa kiểm tra và ký duyệt.
              </span>
            </div>
          ) : status === "Đã duyệt" ? (
            <div style={{
              background: "#f0fdf4",
              color: "#166534",
              border: "1px solid #bbf7d0",
              padding: "11px 15px",
              borderRadius: "8px",
              fontSize: "13.5px",
              margin: "10px 0 16px",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
              <span style={{ fontSize: "18px" }}>✅</span>
              <span>
                Kế hoạch đã được <strong>Khoa duyệt</strong>. Ban tổ chức có thể tiến hành công bố và mở đăng ký.
              </span>
            </div>
          ) : null}

          {!selected.MaKHToChuc ? (
            <div style={{ padding: "30px 20px", textAlign: "center", background: "#f8fafc", borderRadius: "10px", border: "1px dashed #cbd5e1" }}>
              <p style={{ color: "#64748b", margin: "0 0 14px", fontSize: "14px" }}>
                Hoạt động này chưa lập kế hoạch chi tiết. Hãy lập kế hoạch chi tiết trước khi phân công thực hiện.
              </p>
              <button
                type="button"
                onClick={() => {
                  const targetTab = "detailed-plans-all";
                  if (onNavigateTab) onNavigateTab(targetTab, text(selected, "MaHD"));
                }}
                style={{
                  padding: "9px 18px",
                  borderRadius: "6px",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "13.5px",
                  cursor: "pointer",
                }}
              >
                📑 Đi đến lập kế hoạch chi tiết
              </button>
            </div>
          ) : canEdit && ["Chờ phân công thực hiện", "Dự thảo", "Cần bổ sung", "Từ chối"].includes(status) ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                let cacBan: Committee[] = [];
                if (data.has("cacBan")) {
                  try {
                    cacBan = JSON.parse(String(data.get("cacBan")));
                  } catch {
                    cacBan = [];
                  }
                }
                let noiDungThucHien: WorkItem[] = [];
                if (data.has("noiDungThucHien")) {
                  try {
                    noiDungThucHien = JSON.parse(String(data.get("noiDungThucHien")));
                  } catch {
                    noiDungThucHien = [];
                  }
                }
                void act(`/detailed-plans/${detailId}`, "PUT", {
                  cacBan,
                  noiDungThucHien,
                  trangThai: "Dự thảo",
                });
              }}
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <PlanCommitteesEditor
                key={`comm-edit-${detailId}-${status}`}
                initial={(selected.cacBan ?? []) as Committee[]}
                initialWorkItems={(selected.noiDungThucHien ?? []) as WorkItem[]}
                staff={(selected.staff ?? []) as PlanStaff[]}
                departmentId={Number(selected.MaBM)}
                departmentName={String(selected.TenBM || "")}
                busy={busy}
                onDirty={() => setPlanDirty(true)}
              />

              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "10px", flexWrap: "wrap" }}>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    padding: "9px 20px",
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    cursor: busy ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
                  }}
                >
                  Lưu phân công thực hiện
                </button>

                <button
                  type="button"
                  disabled={busy || planDirty || status === "Chờ phân công thực hiện"}
                  title={
                    status === "Chờ phân công thực hiện"
                      ? "Cần bấm Lưu phân công thực hiện trước khi trình khoa ký"
                      : "Trình Khoa xét duyệt kế hoạch chi tiết"
                  }
                  onClick={() => {
                    if (window.confirm(`Xác nhận gửi kế hoạch "${text(selected, "TenHoatDong")}" trình Khoa xét duyệt?`)) {
                      void act(`/detailed-plans/${detailId}/submit`);
                    }
                  }}
                  style={{
                    padding: "9px 20px",
                    background: status === "Chờ phân công thực hiện" ? "#f1f5f9" : "#16a34a",
                    color: status === "Chờ phân công thực hiện" ? "#94a3b8" : "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    cursor: (busy || planDirty || status === "Chờ phân công thực hiện") ? "not-allowed" : "pointer",
                  }}
                >
                  Trình khoa ký
                </button>

                {status === "Chờ phân công thực hiện" && (
                  <span style={{ fontSize: "12.5px", color: "#b45309", fontWeight: 500 }}>
                    * Bấm nút &quot;Lưu phân công thực hiện&quot; để chuyển trạng thái sang &quot;Dự thảo&quot; và mở khóa nút Trình khoa ký.
                  </span>
                )}
              </div>
            </form>
          ) : (
            <div>
              <PlanCommitteesSummary
                committees={(selected.cacBan ?? []) as Committee[]}
                workItems={(selected.noiDungThucHien ?? []) as WorkItem[]}
                staff={(selected.staff ?? []) as PlanStaff[]}
              />
              <div className={s.businessActions} style={{ marginTop: "16px" }}>
                {canSign && ["Chờ khoa xét duyệt", "Chờ khoa ký", "Chờ CTSV ký"].includes(status) && (
                  <>
                    {["approve", "request_changes", "reject"].map((action, i) => (
                      <button key={action} disabled={busy} onClick={() => void act(`/detailed-plans/${detailId}/review`, "PATCH", { action })}>
                        {["Ký duyệt", "Yêu cầu bổ sung", "Từ chối"][i]}
                      </button>
                    ))}
                  </>
                )}
                {Boolean(selected.canPublish) && status === "Đã duyệt" && !selected.CongBoLuc && (
                  <button disabled={busy} onClick={() => void act(`/detailed-plans/${detailId}/publish`)}>
                    Ban tổ chức công bố, mở đăng ký
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {detailed && selected && !isAssignmentTab && (
        <section className={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "8px" }}>
            <h2>#{text(selected, "MaHD")} · {text(selected, "TenHoatDong")}</h2>
            <div style={{ display: "flex", gap: "8px" }}>
              {Boolean(selected.MaKHToChuc) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleExportPdf(text(selected, "MaHD"))}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "1px solid #fecdd3",
                    background: "#fff1f2",
                    color: "#be123c",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>📄 Xuất PDF</span>
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === "edit" ? "view" : "edit")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#1e293b",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {viewMode === "edit" ? "Xem dạng tài liệu" : "Chuyển sang chỉnh sửa"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelected(null)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#64748b",
                  fontSize: "12.5px",
                  cursor: "pointer",
                }}
              >
                ✕ Đóng
              </button>
            </div>
          </div>

          {!isFacultyWide && !selected.canManage && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#fffbeb",
              color: "#92400e",
              border: "1px solid #fde68a",
              padding: "9px 13px",
              borderRadius: "8px",
              fontSize: "13px",
              margin: "10px 0 14px",
              fontWeight: 500,
            }}>
              <span>🔒</span>
              <span>
                <strong>Chế độ chỉ xem:</strong> Hoạt động này thuộc <strong>Bộ môn {text(selected, "TenBM")}</strong>. Bạn không phụ trách bộ môn này nên chỉ được xem thông tin, không được chỉnh sửa hoặc thao tác.
              </span>
            </div>
          )}

          {(() => {
            const isCompetitionPlan =
              String(selected.LoaiHoatDong ?? "").trim().toLowerCase().includes("thi") ||
              Boolean(selected.cuocThi && !String(selected.LoaiHoatDong ?? "").trim().toLowerCase().includes("seminar"));
            const isSeminarPlan = !isCompetitionPlan;

            if (canEdit && viewMode === "edit") {
              return isSeminarPlan ? (
                <SeminarPlanEditor
                  key={`${detailId}-${status}-seminar`}
                  selected={selected}
                  busy={busy}
                  onSave={(v) => act(`/detailed-plans/${detailId}`, "PUT", v)}
                  onDirty={() => setPlanDirty(true)}
                />
              ) : (
                <CompetitionPlanEditor
                  key={`${detailId}-${status}-competition`}
                  selected={selected}
                  busy={busy}
                  onSave={(v) => act(`/detailed-plans/${detailId}`, "PUT", v)}
                  onDirty={() => setPlanDirty(true)}
                />
              );
            }

            return isSeminarPlan ? (
              <SeminarPlanView selected={selected} />
            ) : (
              <CompetitionPlanView selected={selected} />
            );
          })()}

          {/* Banner chuyển sang trang Phân công thực hiện */}
          {Boolean(selected.MaKHToChuc) && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "12px 16px",
              borderRadius: "8px",
              background: status === "Chờ phân công thực hiện" ? "#fff7ed" : "#eff6ff",
              border: status === "Chờ phân công thực hiện" ? "1px solid #fed7aa" : "1px solid #bfdbfe",
              margin: "16px 0",
            }}>
              <div>
                <div style={{ fontWeight: 600, color: status === "Chờ phân công thực hiện" ? "#c2410c" : "#1e40af", fontSize: "14px" }}>
                  {status === "Chờ phân công thực hiện"
                    ? "⚠️ Kế hoạch đang ở trạng thái: Chờ phân công thực hiện"
                    : `Trạng thái: ${status}`}
                </div>
                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                  {status === "Chờ phân công thực hiện"
                    ? "Mục Các ban và phân công giảng viên đã được tách sang trang riêng. Hãy sang trang Phân công thực hiện để phân công giảng viên."
                    : "Xem và quản lý các ban thực hiện tại trang Phân công thực hiện."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab ? onNavigateTab("detailed-plans-assignment", text(selected, "MaHD")) : undefined}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>👥 Sang trang Phân công thực hiện</span>
                <span>→</span>
              </button>
            </div>
          )}

          {canEdit && planDirty && <p role="status">Có thay đổi chưa lưu. Hãy lưu kế hoạch chi tiết trước khi trình khoa ký.</p>}
          <div className={s.businessActions}>
            {canEdit && selected.MaKHToChuc ? (
              <button
                disabled={busy || planDirty || status === "Chờ phân công thực hiện"}
                title={
                  status === "Chờ phân công thực hiện"
                    ? "Cần hoàn tất phân công thực hiện (chuyển sang Dự thảo) trước khi trình khoa ký"
                    : "Trình Khoa xét duyệt kế hoạch chi tiết"
                }
                onClick={() => {
                  if (window.confirm(`Xác nhận gửi kế hoạch "${text(selected, "TenHoatDong")}" trình Khoa xét duyệt?`)) {
                    void act(`/detailed-plans/${detailId}/submit`);
                  }
                }}
              >
                Trình khoa ký
              </button>
            ) : null}
            {canSign && ["Chờ khoa xét duyệt", "Chờ khoa ký", "Chờ CTSV ký"].includes(status) && (
              <>
                {["approve", "request_changes", "reject"].map((action, i) => (
                  <button key={action} disabled={busy} onClick={() => void act(`/detailed-plans/${detailId}/review`, "PATCH", { action })}>
                    {["Ký duyệt", "Yêu cầu bổ sung", "Từ chối"][i]}
                  </button>
                ))}
              </>
            )}
            {Boolean(selected.canPublish) && status === "Đã duyệt" && !selected.CongBoLuc && (
              <button disabled={busy} onClick={() => void act(`/detailed-plans/${detailId}/publish`)}>
                Ban tổ chức công bố, mở đăng ký
              </button>
            )}
            {Boolean(selected.MaKHToChuc) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleExportPdf(detailId)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #fecdd3",
                  background: "#fff1f2",
                  color: "#be123c",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>📄 Xuất PDF</span>
              </button>
            )}
          </div>
        </section>
      )}

      {!detailed && selected && competition && (
        <section className={s.card}>
          <h2>{text(competition, "TenCuocThi")}</h2>
          <h3>Đề tài dự thi</h3>
          {user.roles.includes("SINHVIEN") && Boolean(selected.registration) && (
            <ActionForm
              title="Đăng ký đề tài"
              busy={busy}
              fields={[
                { name: "tenDeTai", label: "Tên đề tài" },
                { name: "linhVuc", label: "Lĩnh vực", optional: true },
                { name: "moTa", label: "Mô tả đề tài", type: "textarea", optional: true },
                { name: "gvhd", label: "Giảng viên hướng dẫn", optional: true },
                ...(rows(selected.teams).length ? [{ name: "maDoi", label: "Đội thực hiện", options: options(rows(selected.teams), "MaDoi", "TenDoi") }] : []),
              ]}
              onSave={(value) => act(`${base}/${competition.MaCThi}/topics`, "POST", value)}
            />
          )}
          {!rows(selected.topics).length && <p>Chưa có đề tài đăng ký.</p>}
          {rows(selected.topics).map(topic => (
            <article className={s.planCommittee} key={text(topic, "MaDeTai")}>
              <h4>{text(topic, "TenDeTai")}</h4>
              <p>{text(topic, "TenDoi") || text(topic, "HoTen")} · {text(topic, "LinhVuc")} · {text(topic, "TrangThai")}</p>
              <p className={s.planTask}>{text(topic, "MoTa")}</p>
              <p>Giảng viên hướng dẫn: {text(topic, "GVHD") || "Chưa cập nhật"}</p>
              {Boolean(selected.canOrganize) && (
                <ActionForm
                  title="Cập nhật trạng thái đề tài"
                  busy={busy}
                  defaults={{ trangThai: topic.TrangThai }}
                  fields={[
                    { name: "trangThai", label: "Trạng thái đề tài", options: ["Đang thực hiện", "Đã hoàn thành", "Không đạt", "Đã rút"].map(value => ({ value, label: value })) },
                  ]}
                  onSave={(value) => act(`/competition-workflow/topics/${topic.MaDeTai}/status`, "PATCH", value)}
                />
              )}
            </article>
          ))}
          {Boolean(selected.canOrganize) && (
            <>
              <ActionForm
                title="Tạo vòng thi"
                busy={busy}
                fields={[
                  { name: "tenVong", label: "Tên vòng" },
                  { name: "thuTu", label: "Thứ tự", type: "number" },
                  { name: "batDauLuc", label: "Bắt đầu", type: "datetime-local" },
                  { name: "ketThucLuc", label: "Kết thúc", type: "datetime-local" },
                  { name: "hanNopBai", label: "Hạn nộp", type: "datetime-local" },
                ]}
                onSave={(v) => act(`${base}/${competition.MaCThi}/rounds`, "POST", v)}
              />
              <ActionForm
                title="Tạo giải thưởng"
                busy={busy}
                fields={[
                  { name: "tenGT", label: "Tên giải" },
                  { name: "tienThuong", label: "Tiền thưởng", type: "number" },
                  { name: "slGiai", label: "Số giải", type: "number" },
                ]}
                onSave={(v) => act(`${base}/${competition.MaCThi}/awards`, "POST", v)}
              />
              <ActionForm
                title="Lập kết quả từ bài đã chấm"
                busy={busy}
                fields={[
                  { name: "maBai", label: "Mã bài đã chấm đầy đủ", type: "number" },
                  { name: "maGT", label: "Giải thưởng", options: options(rows(selected.awards), "MaGT", "TenGT") },
                  { name: "xepHang", label: "Xếp hạng", type: "number" },
                ]}
                onSave={(v) => act(`${base}/${competition.MaCThi}/results`, "POST", v)}
              />
            </>
          )}
          <h3>Các vòng thi</h3>
          {rows(selected.rounds).map(r => (
            <p key={text(r, "MaVong")}>
              {text(r, "TenVong")} · {text(r, "TrangThai")} · {date(r.BatDauLuc)}{" "}
              <button onClick={() => void openRound(text(r, "MaVong"))}>Mở vòng</button>
            </p>
          ))}
          <h3>Kết quả và giải thưởng</h3>
          {rows(selected.results).map(r => (
            <p key={text(r, "MaKQ")}>
              {text(r, "HoTen") || text(r, "TenDoi")} · {text(r, "TenGiaiThuong")} · Hạng {text(r, "XepHang")} · Điểm {text(r, "Diem")} · {text(r, "TrangThai")}
              {Boolean(selected.canOrganize) && r.TrangThai === "Dự thảo" && (
                <button disabled={busy} onClick={() => void act(`/competition-workflow/results/${r.MaKQ}/publish`)}>
                  Công bố trao giải
                </button>
              )}
            </p>
          ))}
        </section>
      )}

      {!detailed && round && currentRound && (
        <section className={s.card}>
          <h2>{text(currentRound, "TenVong")}</h2>
          <p>{text(currentRound, "TrangThai")} · Hạn nộp: {date(currentRound.HanNopBai)}</p>
          {Boolean(round.canOrganize) && (
            <>
              <ActionForm
                title="Phân công ra đề / chấm thi"
                busy={busy}
                fields={[
                  { name: "maTK", label: "Giảng viên", options: options(rows(selected?.staff), "MaTK", "HoTen") },
                  { name: "vaiTro", label: "Nhiệm vụ", options: [{ value: "RA_DE", label: "Ra đề" }, { value: "CHAM_THI", label: "Chấm thi" }] },
                ]}
                onSave={(v) => act(`${roundPath}/assignments`, "POST", v)}
              />
              <button disabled={busy} onClick={() => void act(`${roundPath}/status`, "PATCH", { trangThai: currentRound.TrangThai === "Chưa mở" ? "Đang mở" : "Đã đóng" })}>
                {currentRound.TrangThai === "Chưa mở" ? "Mở vòng thi" : "Đóng vòng thi"}
              </button>
            </>
          )}
          <p>{rows(round.assignments).map(a => `${text(a, "HoTen")}: ${a.VaiTro === "RA_DE" ? "Ra đề" : "Chấm thi"}`).join(" · ")}</p>
          {Boolean(round.canSetExam) && (
            <ActionForm
              title="Lưu đề thi"
              busy={busy}
              fields={[
                { name: "noiDung", label: "Nội dung đề thi", type: "textarea" },
                { name: "urlTep", label: "Đường dẫn tệp đề (https)", type: "url", optional: true },
              ]}
              onSave={(v) => act(`${roundPath}/exam`, "PUT", v)}
            />
          )}
          {(Boolean(round.canOrganize) || Boolean(round.canSetExam)) && (
            <button disabled={busy} onClick={() => void act(`${roundPath}/exam/release`)}>
              Phát hành đề thi
            </button>
          )}
          {round.exam ? (
            <article>
              <h3>Đề thi</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{text(round.exam as Row, "NoiDung")}</p>
              {(round.exam as Row).UrlTep ? (
                <a href={text(round.exam as Row, "UrlTep")} target="_blank" rel="noreferrer">
                  Mở tệp đề thi
                </a>
              ) : null}
            </article>
          ) : (
            <p>Đề thi chưa được mở cho tài khoản này.</p>
          )}
          {user.roles.includes("SINHVIEN") && !round.participation && (
            <ActionForm
              title="Đăng ký vòng thi"
              busy={busy}
              fields={rows(selected?.teams).length ? [{ name: "maDoi", label: "Đội dự thi", options: options(rows(selected?.teams), "MaDoi", "TenDoi") }] : []}
              onSave={(v) => act(`${roundPath}/register`, "POST", v)}
            />
          )}
          {user.roles.includes("SINHVIEN") && Boolean(round.participation) && Boolean(round.isOpen) && (
            <ActionForm
              title="Nộp bài dự thi"
              busy={busy}
              fields={[
                { name: "tieuDe", label: "Tên bài" },
                { name: "moTa", label: "Nội dung bài làm", type: "textarea" },
                { name: "urlTep", label: "Đường dẫn bài làm (https)", type: "url", optional: true },
              ]}
              onSave={(v) => {
                const { urlTep, ...body } = v;
                return act(`${roundPath}/submissions`, "POST", { ...body, tepDinhKem: urlTep ? [urlTep] : [] });
              }}
            />
          )}
          <h3>Bài thi và điểm</h3>
          {rows(round.submissions).map(b => (
            <article key={text(b, "MaBai")}>
              <h4>#{text(b, "MaBai")} · {text(b, "TieuDe")} · {text(b, "HoTen") || text(b, "TenDoi")}</h4>
              <p style={{ whiteSpace: "pre-wrap" }}>{text(b, "MoTa")}</p>
              <p>Điểm trung bình: {text(b, "DiemTrungBinh")} · {text(b, "SoLuotCham")} lượt chấm</p>
              {(() => {
                try {
                  return (JSON.parse(text(b, "TepDinhKem") || "[]") as string[])
                    .filter(u => /^https?:\/\//i.test(u))
                    .map(u => (
                      <p key={u}>
                        <a href={u} target="_blank" rel="noreferrer">Mở tệp bài làm</a>
                      </p>
                    ));
                } catch {
                  return null;
                }
              })()}
              {Boolean(round.canGrade) && (
                <ActionForm
                  title="Lưu điểm"
                  busy={busy}
                  fields={[
                    { name: "diem", label: "Điểm (0–100)", type: "number" },
                    { name: "nhanXet", label: "Nhận xét", optional: true },
                  ]}
                  onSave={(v) => act(`/competition-workflow/submissions/${b.MaBai}/score`, "PATCH", v)}
                />
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
