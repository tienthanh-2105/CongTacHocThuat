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
const pendingAssignmentStatuses = ["Chờ phân công thực hiện", "Cần lập ban đề thi"];
const editablePlanStatuses = [...pendingAssignmentStatuses, "Dự thảo", "Cần bổ sung", "Từ chối"];
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
  managementView,
  filterType,
  onNavigateTab,
}: {
  user: AuthUser;
  detailed: boolean;
  managementView?: "topics" | "results";
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
  const [topicSearch, setTopicSearch] = useState("");
  const [topicStatusFilter, setTopicStatusFilter] = useState("all");
  const [resultSearch, setResultSearch] = useState("");
  const [resultYearFilter, setResultYearFilter] = useState("all");
  const canUseManagementEndpoint = user.roles.some((role) => ["ADMIN", "CANBOKHOA", "TRUONGKHOA"].includes(role.toUpperCase()));
  const base = detailed
    ? "/detailed-plans"
    : canUseManagementEndpoint
    ? "/competition-workflow/manage/competitions"
    : "/competition-workflow/competitions";

  function renderStatusBadge(statusVal: string) {
    const st = statusVal || "Chưa lập chi tiết";
    let bg = "#f1f5f9";
    let color = "#475569";
    let border = "#e2e8f0";

    if (st === "Đã duyệt" || st === "Đã công bố") {
      bg = "#dcfce7";
      color = "#15803d";
      border = "#86efac";
    } else if (pendingAssignmentStatuses.includes(st)) {
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
          } else if (!detailed && (managementView || canUseManagementEndpoint) && v.length) {
            void open(text(v[0], "MaCThi"), "view");
          }
        }
      }
    }).catch(e => {
      if (active) setError(e.message);
    });
    return () => { active = false; };
  }, [base, detailed, filterType, managementView, canUseManagementEndpoint]);

  useEffect(() => {
    setSelected(null);
    setRound(null);
    setPlanDirty(false);
  }, [filterType]);

  function confirmDiscardPlanChanges() {
    return !planDirty || window.confirm("Bạn có thay đổi phân công chưa lưu. Nếu rời biểu mẫu, các thay đổi này sẽ mất. Bạn có muốn tiếp tục không?");
  }

  function navigateTab(sectionId: string, activityId?: string) {
    if (!confirmDiscardPlanChanges()) return;
    onNavigateTab?.(sectionId, activityId);
  }

  async function open(id: string, mode: "view" | "edit" = "view") {
    if (!confirmDiscardPlanChanges()) return;
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
  const validDetailId = /^\d+$/.test(detailId);
  const status = selected ? text(selected, "TrangThai") : "";
  const awaitingAssignment = pendingAssignmentStatuses.includes(status);
  const canEdit = detailed && Boolean(selected?.canEdit);
  const canSign = validDetailId && (user.roles.includes("ADMIN") || ((status === "Chờ khoa xét duyệt" || status === "Chờ khoa ký") && (user.roles.includes("TRUONGKHOA") || user.roles.includes("CANBOKHOA"))) || (status === "Chờ CTSV ký" && user.roles.includes("PHONGCTSV")));
  const competition = selected?.competition as Row | undefined;
  const currentRound = round?.round as Row | undefined;
  const options = (items: Row[], key: string, label: string) => items.map(r => ({ value: text(r, key), label: `${text(r, label)} (#${text(r, key)})` }));
  const planCommittee = (type: "DE_THI" | "CHAM_THI") => rows(selected?.cacBan).find((committee) => {
    const kind = text(committee, "loaiBan");
    if (kind === type) return true;
    const name = text(committee, "tenBan").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return type === "DE_THI" ? name.includes("de thi") || name.includes("ra de") : name.includes("giam khao") || name.includes("cham thi") || name.includes("cham diem");
  });
  const committeeMemberOptions = (type: "DE_THI" | "CHAM_THI") => {
    const committee = planCommittee(type);
    return rows(committee?.thanhVien).flatMap((member) => {
      const accountId = text(member, "maTK") || text(member, "MaTK");
      if (!accountId) return [];
      const staff = rows(selected?.staff).find((person) => text(person, "MaTK") === accountId);
      const name = text(member, "hoTen") || text(member, "HoTen") || text(staff ?? {}, "HoTen") || `Tài khoản ${accountId}`;
      return [{ value: accountId, label: `${name} (#${accountId})` }];
    });
  };
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
  const resultYearOptions = [...new Set(displayList.map((row) => text(row, "NamHoc")).filter(Boolean))];
  const resultCompetitionOptions = resultYearFilter === "all" ? displayList : displayList.filter((row) => text(row, "NamHoc") === resultYearFilter);
  const topicRows = rows(selected?.topics);
  const teamTopicRows = rows(selected?.planTeams);
  const competitionResultRows = rows(selected?.results);
  const visibleCompetitionTopics = topicRows.filter((topic) => {
    const query = resultSearch.trim().toLocaleLowerCase("vi");
    if (!query) return true;
    const team = teamTopicRows.find((candidate) => text(candidate, "MaDoi") === text(topic, "MaDoi"));
    return [text(topic, "TenDeTai"), text(topic, "TenDoi"), text(topic, "HoTen"), text(topic, "MSSV"), text(topic, "LinhVuc"), text(topic, "GVHD"), text(team ?? {}, "ThanhVien")]
      .some((value) => value.toLocaleLowerCase("vi").includes(query));
  });
  const visibleCompetitionResults = competitionResultRows.filter((result) => {
    const query = resultSearch.trim().toLocaleLowerCase("vi");
    if (!query) return true;
    const team = teamTopicRows.find((candidate) => text(candidate, "MaDoi") === text(result, "MaDoi"));
    return [text(result, "TenDoi"), text(result, "HoTen"), text(result, "MSSV"), text(result, "TenGiaiThuong"), text(result, "TenGiai"), text(result, "GhiChu"), text(team ?? {}, "TenDeTai"), text(team ?? {}, "ThanhVien")]
      .some((value) => value.toLocaleLowerCase("vi").includes(query));
  });
  const visibleTopics = topicRows.filter((topic) => {
    if (topicStatusFilter !== "all" && text(topic, "TrangThai") !== topicStatusFilter) return false;
    const query = topicSearch.trim().toLocaleLowerCase("vi");
    if (!query) return true;
    return ["TenDeTai", "TenDoi", "HoTen", "MSSV", "TenLop", "ThanhVien", "LinhVuc", "GVHD"]
      .some((key) => text(topic, key).toLocaleLowerCase("vi").includes(query));
  });
  const topicsNeedingReview = topicRows.filter((topic) => /chờ|phản biện|cần duyệt/i.test(text(topic, "TrangThai"))).length;
  const visibleTeamTopics = teamTopicRows.filter((team) => {
    if (topicStatusFilter !== "all" && text(team, "TrangThai") !== topicStatusFilter) return false;
    const query = topicSearch.trim().toLocaleLowerCase("vi");
    if (!query) return true;
    return ["TenDoi", "TenDeTai", "ThanhVien", "GVHD", "LinhVuc", "TrangThai"]
      .some((key) => text(team, key).toLocaleLowerCase("vi").includes(query));
  });
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

  function exportResultsCsv() {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ["Mã đề tài", "Tên đề tài", "Đội / Thí sinh", "Lĩnh vực", "Giải thưởng", "Xếp hạng", "Điểm", "Trạng thái"],
      ...topicRows.map((topic) => {
        const result = competitionResultRows.find((item) => (text(topic, "MaDoi") && text(item, "MaDoi") === text(topic, "MaDoi")) || (text(topic, "MaDK") && text(item, "MaDK") === text(topic, "MaDK")));
        return [text(topic, "MaDeTai"), text(topic, "TenDeTai"), text(topic, "TenDoi") || text(topic, "HoTen"), text(topic, "LinhVuc"), text(result ?? {}, "TenGiaiThuong") || text(result ?? {}, "TenGiai"), text(result ?? {}, "XepHang"), text(result ?? {}, "Diem"), text(result ?? {}, "TrangThai") || text(topic, "TrangThai")];
      }),
    ];
    const csv = `\uFEFF${lines.map((line) => line.map(escape).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `ket-qua-${text(competition ?? {}, "MaCThi") || "cuoc-thi"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`${s.businessPanel} ${managementView === "topics" ? s.topicManagementPage : managementView === "results" ? s.resultsManagementPage : ""}`}>
      {error ? <NoticeDialog message={error} kind="error" onClose={() => setError("")} /> : notice ? <NoticeDialog message={notice} kind="success" onClose={() => setNotice("")} /> : null}

      {detailed && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => navigateTab("detailed-plans-all")}
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
              onClick={() => navigateTab("detailed-plans-assignment")}
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

      <section className={`${s.card} ${managementView === "results" ? s.resultsHeaderCard : ""}`}>
        {!detailed && managementView === "results" ? (
          <>
            <header className={s.resultsMainHeader}>
              <div><h1>Đề tài, kết quả & seminar học thuật</h1><p>Quản lý hồ sơ dự thi, đội nhóm, công bố kết quả và vinh danh sinh viên.</p></div>
              <div className={s.resultsHeaderActions}><button type="button" className={s.secondaryButton} disabled={!competition} onClick={exportResultsCsv}>↓ Xuất dữ liệu</button><button type="button" onClick={() => onNavigateTab?.("topics")}>＋ Tiếp nhận đề tài</button></div>
            </header>
            <div className={s.resultsStats}>
              <div><span>Đề tài đã nộp</span><strong>{topicRows.length}</strong><small>{teamTopicRows.filter((team) => Boolean(text(team, "MaDeTai"))).length} thuộc đội thi</small></div>
              <div><span>Vào chung kết</span><strong>{competitionResultRows.length}</strong><small>{competitionResultRows.filter((result) => text(result, "TrangThai") === "Đã công bố").length} kết quả đã công bố</small></div>
              <div><span>Nhóm sinh viên</span><strong>{new Set(teamTopicRows.map((team) => text(team, "MaDoi")).filter(Boolean)).size}</strong><small>{teamTopicRows.reduce((sum, team) => sum + text(team, "ThanhVien").split("|").filter(Boolean).length, 0)} thành viên</small></div>
              <div><span>Cần phản biện</span><strong>{topicsNeedingReview}</strong><small>{topicsNeedingReview ? "Chờ hội đồng xem xét" : "Không có hồ sơ chờ xử lý"}</small></div>
            </div>
            <div className={s.resultsToolbar}>
              <label><span>⌕</span><input value={resultSearch} onChange={(event) => setResultSearch(event.target.value)} placeholder="Tìm theo mã hoặc tên đề tài…" /></label>
              <select aria-label="Lọc năm học" value={resultYearFilter} onChange={(event) => {
                const year = event.target.value;
                setResultYearFilter(year);
                const nextOptions = year === "all" ? displayList : displayList.filter((row) => text(row, "NamHoc") === year);
                if (nextOptions.length && !nextOptions.some((row) => text(row, "MaCThi") === text(competition ?? {}, "MaCThi"))) void open(text(nextOptions[0], "MaCThi"), "view");
              }}><option value="all">Tất cả năm học</option>{resultYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}</select>
              <select aria-label="Chọn cuộc thi" value={String(competition?.MaCThi ?? "")} onChange={(event) => { if (event.target.value) void open(event.target.value, "view"); }}><option value="">Chọn cuộc thi</option>{resultCompetitionOptions.map((item) => <option key={text(item, "MaCThi")} value={text(item, "MaCThi")}>{text(item, "TenCuocThi") || text(item, "TenHoatDong")}</option>)}</select>
            </div>
          </>
        ) : <>
        {!detailed ? (
          <h2>{managementView === "topics" ? "Danh sách cuộc thi" : managementView === "results" ? "Kết quả cuộc thi" : "Vòng thi, đề thi, bài thi và trao giải"}</h2>
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
            : managementView === "topics"
            ? "Chọn cuộc thi để quản lý đề tài và giảng viên hướng dẫn do sinh viên khai báo ngay trong form đăng ký tham gia cuộc thi."
            : managementView === "results"
            ? "Chọn cuộc thi để lập, rà soát và công bố kết quả cùng giải thưởng."
            : canUseManagementEndpoint
            ? "Chọn cuộc thi để quản lý vòng thi, đề bài, chấm điểm và công bố giải. Danh sách bao gồm cả cuộc thi đang trong giai đoạn thiết lập."
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
                  const activityId = text(r, "MaHD");
                  const validActivityId = /^\d+$/.test(activityId);
                  const isMyDept = isFacultyWide || Boolean(r.canManage);
                  const st = text(r, "TrangThai");
                  const hasPlan = Boolean(r.MaKHToChuc);
                  const isApproved = st === "Đã duyệt";
                  const isSubmitted = ["Chờ khoa xét duyệt", "Chờ khoa ký", "Chờ CTSV ký", "Đã duyệt"].includes(st);
                  const canEditPlan = isMyDept && (!hasPlan || editablePlanStatuses.includes(st));
                  const canAssign = isMyDept && hasPlan && editablePlanStatuses.includes(st);
                  const canSubmit = isMyDept && hasPlan && ["Dự thảo", "Cần bổ sung", "Từ chối"].includes(st);
                  const canSignRow = validActivityId && (user.roles.includes("ADMIN") ||
                    ((st === "Chờ khoa xét duyệt" || st === "Chờ khoa ký") && (user.roles.includes("TRUONGKHOA") || user.roles.includes("CANBOKHOA"))) ||
                    (st === "Chờ CTSV ký" && user.roles.includes("PHONGCTSV")));
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
                                    void act(`/detailed-plans/${activityId}/review`, "PATCH", { action: "approve" });
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
                                    void act(`/detailed-plans/${activityId}/review`, "PATCH", { action: "request_changes" });
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
                                disabled={!canSubmit || busy || (Boolean(isSelected) && planDirty)}
                                title={
                                  isSelected && planDirty
                                    ? "Có phân công chưa lưu. Hãy bấm Lưu phân công thực hiện trước khi trình ký"
                                    : !isMyDept
                                    ? "Không có quyền thao tác"
                                    : isSubmitted
                                    ? "Kế hoạch đã được trình xét duyệt / đã duyệt"
                                    : !hasPlan
                                    ? "Chưa lưu kế hoạch chi tiết để gửi"
                                    : pendingAssignmentStatuses.includes(st)
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
                                  border: canSubmit && !(Boolean(isSelected) && planDirty) ? "1px solid #86efac" : "1px solid #e2e8f0",
                                  background: canSubmit && !(Boolean(isSelected) && planDirty) ? "#f0fdf4" : "#f8fafc",
                                  color: canSubmit && !(Boolean(isSelected) && planDirty) ? "#15803d" : "#94a3b8",
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  cursor: canSubmit && !(Boolean(isSelected) && planDirty) ? "pointer" : "not-allowed",
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
                                  if (canAssign) navigateTab("detailed-plans-assignment", text(r, "MaHD"));
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
                                disabled={!canSubmit || busy || (Boolean(isSelected) && planDirty)}
                                title={
                                  isSelected && planDirty
                                    ? "Có phân công chưa lưu. Hãy bấm Lưu phân công thực hiện trước khi trình ký"
                                    : !isMyDept
                                    ? "Không có quyền thao tác"
                                    : isSubmitted
                                    ? "Kế hoạch đã được trình xét duyệt / đã duyệt"
                                    : !hasPlan
                                    ? "Chưa lưu kế hoạch chi tiết để gửi"
                                    : pendingAssignmentStatuses.includes(st)
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
                                  border: canSubmit && !(Boolean(isSelected) && planDirty) ? "1px solid #86efac" : "1px solid #e2e8f0",
                                  background: canSubmit && !(Boolean(isSelected) && planDirty) ? "#f0fdf4" : "#f8fafc",
                                  color: canSubmit && !(Boolean(isSelected) && planDirty) ? "#15803d" : "#94a3b8",
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  cursor: canSubmit && !(Boolean(isSelected) && planDirty) ? "pointer" : "not-allowed",
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
              <article key={text(r, "MaCThi")} data-selected={String(competition?.MaCThi ?? "") === text(r, "MaCThi")}>
                <div>
                  <strong>{text(r, "TenHoatDong")}</strong>
                  <p>
                    {text(r, "NamHoc")} · {text(r, "TenBM")} · {text(r, "TrangThai") || "Chưa lập chi tiết"}
                  </p>
                  {managementView === "topics" && <small>{text(r, "SoDeTai") || "0"} đề tài · {text(r, "SoLuotDangKy") || "0"} lượt đăng ký dự thi</small>}
                  {managementView === "results" && <small>{text(r, "SoKetQua") || "0"} kết quả · {text(r, "SoLuotDangKy") || "0"} lượt dự thi</small>}
                </div>
                <button aria-pressed={String(competition?.MaCThi ?? "") === text(r, "MaCThi")} onClick={() => void open(text(r, "MaCThi"), "view")}>
                  {String(competition?.MaCThi ?? "") === text(r, "MaCThi")
                    ? managementView === "topics" ? "Đang xem đề tài" : managementView === "results" ? "Đang xem kết quả" : "Đang mở"
                    : managementView === "topics" ? "Quản lý đề tài" : managementView === "results" ? "Xem kết quả" : "Xem / xử lý"}
                </button>
              </article>
            ))}
          </div>
        )}
        </>}
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
                    navigateTab(targetTab, text(selected, "MaHD"));
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
                  navigateTab(targetTab, text(selected, "MaHD"));
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
          ) : canEdit && editablePlanStatuses.includes(status) ? (
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
                const invalidWorkItem = noiDungThucHien.find((item) => {
                  const start = String(item.thoiGian || "").slice(0, 10);
                  const end = String(item.thoiGianKetThuc || "").slice(0, 10);
                  if (start && end && end < start) return true;
                  const range = String(item.dateText || "").match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(?:đến|[-–])\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/i);
                  if (!range) return false;
                  const startText = `${range[3]}-${range[2].padStart(2, "0")}-${range[1].padStart(2, "0")}`;
                  const endText = `${range[6]}-${range[5].padStart(2, "0")}-${range[4].padStart(2, "0")}`;
                  return endText < startText;
                });
                if (invalidWorkItem) {
                  setError(`Ngày kết thúc ở dòng ${invalidWorkItem.stt} phải bằng hoặc sau ngày bắt đầu.`);
                  return;
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
                  disabled={busy || planDirty || awaitingAssignment}
                  title={
                    awaitingAssignment
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
                    background: awaitingAssignment ? "#f1f5f9" : "#16a34a",
                    color: awaitingAssignment ? "#94a3b8" : "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    cursor: (busy || planDirty || awaitingAssignment) ? "not-allowed" : "pointer",
                  }}
                >
                  Trình khoa ký
                </button>

                {awaitingAssignment && (
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
              background: awaitingAssignment ? "#fff7ed" : "#eff6ff",
              border: awaitingAssignment ? "1px solid #fed7aa" : "1px solid #bfdbfe",
              margin: "16px 0",
            }}>
              <div>
                <div style={{ fontWeight: 600, color: awaitingAssignment ? "#c2410c" : "#1e40af", fontSize: "14px" }}>
                  {awaitingAssignment
                    ? "⚠️ Kế hoạch đang ở trạng thái: Chờ phân công thực hiện"
                    : `Trạng thái: ${status}`}
                </div>
                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                  {awaitingAssignment
                    ? "Mục Các ban và phân công giảng viên đã được tách sang trang riêng. Hãy sang trang Phân công thực hiện để phân công giảng viên."
                    : "Xem và quản lý các ban thực hiện tại trang Phân công thực hiện."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigateTab("detailed-plans-assignment", text(selected, "MaHD"))}
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
                disabled={busy || planDirty || awaitingAssignment}
                title={
                  awaitingAssignment
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
        <section className={`${s.card} ${managementView === "results" ? s.resultsDetailCard : ""}`}>
          {managementView === "results" ? (
            <>
              <div className={s.resultsContentGrid}>
                <section className={s.resultsTopicPanel}>
                  <header className={s.resultsPanelHeader}><div><h3>Đề tài dự thi học thuật</h3><p>{visibleCompetitionTopics.length} / {topicRows.length} hồ sơ trong cuộc thi</p></div><span>{text(competition, "NamHoc")}</span></header>
                  <div className={s.resultsTableWrap}>
                    {visibleCompetitionTopics.length ? <table className={s.resultsTable}>
                      <thead><tr><th>Tên đề tài</th><th>Nhóm</th><th>Lĩnh vực</th><th>Điểm</th><th>Trạng thái</th></tr></thead>
                      <tbody>{visibleCompetitionTopics.map((topic, index) => {
                        const result = competitionResultRows.find((item) => (text(topic, "MaDoi") && text(item, "MaDoi") === text(topic, "MaDoi")) || (text(topic, "MaDK") && text(item, "MaDK") === text(topic, "MaDK")));
                        const team = teamTopicRows.find((candidate) => text(candidate, "MaDoi") === text(topic, "MaDoi"));
                        const topicName = text(topic, "TenDeTai") || "Chưa đặt tên đề tài";
                        const topicId = text(topic, "MaDeTai");
                        const topicStatus = text(topic, "TrangThai") || "Chưa cập nhật";
                        const memberSource = text(team ?? topic, "ThanhVien");
                        const memberCount = new Set(memberSource.split(memberSource.includes("|") ? "|" : ", ").map((member) => member.trim()).filter(Boolean)).size;
                        return <tr key={topicId || `${text(topic, "MaDoi")}-${index}`}>
                          <td><strong className={s.resultsTopicName}>{topicName}</strong>{topicId && <small className={s.resultsTopicCode}>Mã đề tài: DT-{topicId.padStart(3, "0")}</small>}</td>
                          <td><strong>{text(topic, "TenDoi") || text(topic, "HoTen") || "Thí sinh cá nhân"}</strong><small>{text(topic, "TenDoi") ? `${memberCount} thành viên` : text(topic, "MSSV")}</small></td>
                          <td>{text(topic, "LinhVuc") || "Chưa phân loại"}</td>
                          <td><strong>{text(result ?? {}, "Diem") || "—"}</strong></td>
                          <td><span className={`${s.resultsStatus} ${text(result ?? {}, "TrangThai") === "Đã công bố" ? s.resultsPublished : s.resultsDraft}`}>{text(result ?? {}, "TenGiaiThuong") || text(result ?? {}, "TenGiai") || topicStatus}</span></td>
                        </tr>;
                      })}</tbody>
                    </table> : <div className={s.resultsEmpty}><span>📄</span><strong>{topicRows.length ? "Không tìm thấy đề tài phù hợp" : "Chưa có đề tài dự thi"}</strong><p>Đề tài sinh viên đăng ký sẽ được tổng hợp tại đây.</p></div>}
                  </div>
                </section>

                <aside className={s.resultsWinnersPanel}>
                  <header className={s.resultsPanelHeader}><div><h3>Kết quả chung kết</h3><p>{text(competition, "TenCuocThi")}</p></div><span className={`${s.resultsStatus} ${competitionResultRows.some((result) => text(result, "TrangThai") === "Đã công bố") ? s.resultsPublished : s.resultsDraft}`}>{competitionResultRows.some((result) => text(result, "TrangThai") === "Đã công bố") ? "Đã công bố" : "Đang cập nhật"}</span></header>
                  {visibleCompetitionResults.length ? <div className={s.resultsWinnerList}>{visibleCompetitionResults.map((result, index) => {
                    const team = teamTopicRows.find((candidate) => text(candidate, "MaDoi") === text(result, "MaDoi"));
                    const rank = Number(text(result, "XepHang")) || index + 1;
                    const statusValue = text(result, "TrangThai") || "Chưa xác định";
                    const award = rows(competition.awards).find((candidate) => text(candidate, "MaGT") === text(result, "MaGT"));
                    return <article className={s.resultsWinner} key={text(result, "MaKQ") || `${text(result, "MaDoi")}-${index}`}>
                      <span className={`${s.resultsRank} ${rank > 0 && rank <= 3 ? s[`resultsRank${rank}`] : ""}`}>{String(rank).padStart(2, "0")}</span>
                      <div className={s.resultsWinnerInfo}><strong>{text(result, "TenDoi") || text(result, "HoTen") || "Chưa có tên"}</strong><small>{text(team ?? {}, "TenDeTai") || (text(result, "TenDoi") ? "Đội thi" : `MSSV ${text(result, "MSSV") || "—"}`)}</small><span>{text(result, "TenGiaiThuong") || text(result, "TenGiai") || "Chưa gán giải"}{award?.TienThuong != null ? ` · ${Number(award.TienThuong).toLocaleString("vi-VN")} ₫` : ""}</span></div>
                      <strong className={s.resultsWinnerScore}>{text(result, "Diem") || "—"}</strong>
                      {Boolean(selected.canOrganize) && statusValue === "Dự thảo" && <button className={s.resultsPublishButton} disabled={busy} onClick={() => void act(`/competition-workflow/results/${text(result, "MaKQ")}/publish`)}>Công bố</button>}
                    </article>;
                  })}</div> : <div className={s.resultsEmpty}><span>🏆</span><strong>Chưa có đội đạt giải</strong><p>Kết quả chung kết sẽ hiện tại đây sau khi có bài thi được chấm và lập giải.</p></div>}
                  <div className={s.resultsWinnersFooter}><span>{rows(competition.awards).length} hạng mục giải thưởng</span><span>{competitionResultRows.length} kết quả</span></div>
                </aside>
              </div>

              {Boolean(selected.canOrganize) && <details className={s.resultsCreatePanel}>
                <summary><span><strong>Ghi nhận đội hoặc thí sinh đạt giải</strong><small>Lập kết quả từ bài thi đã được chấm</small></span><b>＋</b></summary>
                <ActionForm
                  title="Thông tin kết quả"
                  busy={busy}
                  fields={[
                    { name: "maBai", label: "Mã bài thi đã chấm", type: "number" },
                    { name: "maGT", label: "Giải thưởng", optional: true, options: options(rows(competition.awards), "MaGT", "TenGT") },
                    { name: "xepHang", label: "Thứ hạng", type: "number" },
                    { name: "ghiChu", label: "Ghi chú", optional: true },
                  ]}
                  onSave={(value) => act(`${base}/${competition.MaCThi}/results`, "POST", value)}
                />
              </details>}
            </>
          ) : <>
          <h2>{text(competition, "TenCuocThi")}</h2>
          <div className={s.topicManagementStats}>
            <div><span>Tổng đội thi</span><strong>{teamTopicRows.length}</strong></div>
            <div><span>Đã khai báo đề tài</span><strong>{teamTopicRows.filter((team) => Boolean(text(team, "TenDeTai"))).length}</strong></div>
            <div><span>Chưa khai báo đề tài</span><strong>{teamTopicRows.filter((team) => !text(team, "TenDeTai")).length}</strong></div>
          </div>
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
          <div className={s.topicManagementToolbar}>
            <label><span>⌕</span><input value={topicSearch} onChange={(event) => setTopicSearch(event.target.value)} placeholder="Tìm đội thi, đề tài, thành viên hoặc GVHD…" /></label>
            <select aria-label="Lọc trạng thái đề tài" value={topicStatusFilter} onChange={(event) => setTopicStatusFilter(event.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              {[...new Set(teamTopicRows.map((team) => text(team, "TrangThai")).filter(Boolean))].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          {selected.canOrganize ? (
            <div className={s.topicTeamsTableWrap}>
              {visibleTeamTopics.length ? <table className={s.topicTeamsTable}>
                <thead><tr><th>Đội thi</th><th>Tên đề tài</th><th>Giảng viên hướng dẫn</th><th>Thành viên</th><th>Trạng thái đề tài</th></tr></thead>
                <tbody>{visibleTeamTopics.map((team) => <tr key={text(team, "MaDoi")}>
                  <td><strong>{text(team, "TenDoi")}</strong><small>Đội #{text(team, "MaDoi")}</small></td>
                  <td>{text(team, "TenDeTai") || <span className={s.topicTeamMissing}>Chưa khai báo đề tài</span>}</td>
                  <td>{text(team, "GVHD") || <span className={s.topicTeamMissing}>Chưa cập nhật</span>}</td>
                  <td><div className={s.topicMemberLines}>{text(team, "ThanhVien") ? text(team, "ThanhVien").split("|").map((member) => <span key={member}>{member}</span>) : <span>Chưa có thành viên</span>}</div></td>
                  <td>{Boolean(team.MaDeTai) ? <ActionForm
                    submitLabel="Lưu"
                    busy={busy}
                    defaults={{ trangThai: team.TrangThai }}
                    fields={[{ name: "trangThai", label: "Trạng thái", options: ["Đang thực hiện", "Đã hoàn thành", "Không đạt", "Đã rút"].map((value) => ({ value, label: value })) }]}
                    onSave={(value) => act(`/competition-workflow/topics/${team.MaDeTai}/status`, "PATCH", value)}
                  /> : <span className={s.topicManagementStatus}>{text(team, "TrangThai") || "Chưa có đề tài"}</span>}</td>
                </tr>)}</tbody>
              </table> : <div className={s.topicManagementEmpty}><strong>{teamTopicRows.length ? "Không tìm thấy đội thi phù hợp" : "Cuộc thi chưa có đội đăng ký"}</strong><span>{teamTopicRows.length ? "Thử đổi từ khóa hoặc trạng thái lọc." : "Danh sách đội sẽ xuất hiện khi sinh viên đăng ký theo đội."}</span></div>}
            </div>
          ) : (
            <div className={s.topicManagementTableWrap}>
              {visibleTopics.length ? <table className={s.topicManagementTable}><thead><tr><th>Đề tài</th><th>Thí sinh</th><th>GV hướng dẫn</th><th>Trạng thái</th></tr></thead><tbody>{visibleTopics.map((topic) => <tr key={text(topic, "MaDeTai")}><td><strong>{text(topic, "TenDeTai")}</strong><small>{text(topic, "MoTa")}</small></td><td>{text(topic, "HoTen")}</td><td>{text(topic, "GVHD")}</td><td>{text(topic, "TrangThai")}</td></tr>)}</tbody></table> : <div className={s.topicManagementEmpty}><strong>Chưa có đề tài đăng ký</strong></div>}
            </div>
          )}
          {Boolean(selected.canOrganize) && (
            <>
              {!managementView && <>
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
              </>}
              {managementView !== "topics" && <ActionForm
                title="Lập kết quả từ bài đã chấm"
                busy={busy}
                fields={[
                  { name: "maBai", label: "Mã bài đã chấm đầy đủ", type: "number" },
                  { name: "maGT", label: "Giải thưởng", options: options(rows(selected.awards), "MaGT", "TenGT") },
                  { name: "xepHang", label: "Xếp hạng", type: "number" },
                ]}
                onSave={(v) => act(`${base}/${competition.MaCThi}/results`, "POST", v)}
              />}
            </>
          )}
          {!managementView && <>
          <h3>Các vòng thi</h3>
          {rows(selected.rounds).map(r => (
            <p key={text(r, "MaVong")}>
              {text(r, "TenVong")} · {text(r, "TrangThai")} · {date(r.BatDauLuc)}{" "}
              <button onClick={() => void openRound(text(r, "MaVong"))}>Mở vòng</button>
            </p>
          ))}
          </>}
          {managementView !== "topics" && <>
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
          </>}
          </>}
        </section>
      )}

      {!detailed && round && currentRound && (
        <section className={s.card}>
          <h2>{text(currentRound, "TenVong")}</h2>
          <p>{text(currentRound, "TrangThai")} · Hạn nộp: {date(currentRound.HanNopBai)}</p>
          {Boolean(round.canOrganize) && (
            <>
              <div className={s.businessForm}>
                <h3>Phân công theo ban trong kế hoạch chi tiết</h3>
                {([
                  { type: "DE_THI" as const, role: "RA_DE", title: "Ban đề thi", task: "Ra đề" },
                  { type: "CHAM_THI" as const, role: "CHAM_THI", title: "Ban giám khảo", task: "Chấm thi" },
                ]).map(({ type, role, title, task }) => {
                  const committee = planCommittee(type);
                  const members = committeeMemberOptions(type);
                  return <section key={type} style={{ border: "1px solid #dbe5f2", borderRadius: 10, padding: 14, marginTop: 12 }}>
                    <h4 style={{ margin: "0 0 4px", color: "#15375b" }}>{title}</h4>
                    <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 13 }}>{committee ? `Thành viên lấy từ ${text(committee, "tenBan") || title} của kế hoạch chi tiết · Nhiệm vụ: ${task}` : `Kế hoạch chi tiết chưa khai báo ${title}. Hãy bổ sung ban và trình ký lại trước khi phân công.`}</p>
                    {members.length ? <ActionForm
                      submitLabel={`Phân công ${task.toLocaleLowerCase("vi")}`}
                      busy={busy}
                      fields={[{ name: "maTK", label: `Giảng viên thuộc ${title}`, options: members }]}
                      onSave={(v) => act(`${roundPath}/assignments`, "POST", { ...v, vaiTro: role })}
                    /> : <p role="status" style={{ margin: 0, color: "#b45309", fontSize: 13 }}>{committee ? `${title} chưa có giảng viên được phân công trong kế hoạch chi tiết.` : ""}</p>}
                  </section>;
                })}
              </div>
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
