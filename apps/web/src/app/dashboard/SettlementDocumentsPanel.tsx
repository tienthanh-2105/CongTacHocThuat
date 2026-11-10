"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { workflowRequest } from "@/services/workflow";
import NoticeDialog from "./NoticeDialog";
import s from "./dashboard.module.css";

type Row = Record<string, unknown>;
type ReportLine = { stt?: number; noiDungThucHien: string; duToan: number; thucThi: number; chenhLech?: number; ghiChu?: string };
type DraftLine = { noiDungThucHien: string; duToan: string; thucThi: string; ghiChu: string };
type ActivityContext = { id: string; name: string; academicYear: string };
const emptyLine = (): DraftLine => ({ noiDungThucHien: "", duToan: "", thucThi: "", ghiChu: "" });
const readRaw = (row: Row, key: string): unknown => {
  const actual = Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
  return actual ? row[actual] : undefined;
};
const read = (row: Row, key: string, fallback = "—") => {
  const value = readRaw(row, key);
  return value === undefined || value === null || value === "" ? fallback : String(value);
};
const money = (amount: unknown) => Number(amount ?? 0).toLocaleString("vi-VN") + " ₫";
const date = (input: unknown) => {
  if (!input) return "—";
  const parsed = new Date(String(input));
  return Number.isNaN(parsed.getTime()) ? String(input) : parsed.toLocaleDateString("vi-VN");
};
const parseLines = (input: unknown): ReportLine[] => {
  if (Array.isArray(input)) return input as ReportLine[];
  if (typeof input !== "string" || !input) return [];
  try {
    const value: unknown = JSON.parse(input);
    return Array.isArray(value) ? value as ReportLine[] : [];
  } catch { return []; }
};

export default function SettlementDocumentsPanel({ initialActivity = null }: { initialActivity?: ActivityContext | null }) {
  const [reports, setReports] = useState<Row[]>([]);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const autoOpenedActivityId = useRef("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const reportRows = await workflowRequest<Row[]>("/reports/settlements");
      setReports(Array.isArray(reportRows) ? reportRows : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được danh sách báo cáo quyết toán.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const selectedActivity = initialActivity;
  const totals = useMemo(() => lines.reduce((result, line) => {
    const budget = Number(line.duToan || 0);
    const actual = Number(line.thucThi || 0);
    return { budget: result.budget + budget, actual: result.actual + actual };
  }, { budget: 0, actual: 0 }), [lines]);
  const amountOf = (input: string) => Number(input || 0);

  const openDialog = useCallback(async (prefillActivity = true) => {
    setLines([emptyLine()]);
    setDialogOpen(true);
    setError("");
    if (!prefillActivity || !initialActivity?.id) return;
    setLoadingDraft(true);
    try {
      const [settlement, budgetRows] = await Promise.all([
        workflowRequest<{ expenses?: Row[] }>(`/settlements/${initialActivity.id}`),
        workflowRequest<Row[]>("/academic-activities/budgets"),
      ]);
      const budgets = Array.isArray(budgetRows) ? budgetRows : [];
      const budgetById = new Map(budgets.map((row) => [read(row, "MaKPHD", ""), row]));
      const groups = new Map<string, { budgetId: string; descriptions: string[]; explanations: string[]; actual: number }>();
      for (const expense of settlement.expenses ?? []) {
        const budgetId = read(expense, "MaKPHD", "");
        const key = budgetId ? `budget:${budgetId}` : `expense:${read(expense, "MaCP", String(groups.size))}`;
        const group = groups.get(key) ?? { budgetId, descriptions: [], explanations: [], actual: 0 };
        const description = read(expense, "NoiDung", "").trim();
        const explanation = read(expense, "ThuyetMinh", "").trim();
        if (description && description !== "—" && !group.descriptions.includes(description)) group.descriptions.push(description);
        if (explanation && explanation !== "—" && !group.explanations.includes(explanation)) group.explanations.push(explanation);
        group.actual += Number(readRaw(expense, "SoTien") ?? 0);
        groups.set(key, group);
      }
      const draftLines = [...groups.values()].map((group) => {
        const budget = budgetById.get(group.budgetId);
        return {
          noiDungThucHien: group.descriptions.join("; "),
          duToan: String(Number(readRaw(budget ?? {}, "SoTien") ?? 0)),
          thucThi: String(Number(group.actual.toFixed(2))),
          ghiChu: group.explanations.join("; "),
        };
      });
      setLines(draftLines.length ? draftLines : [emptyLine()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được nội dung chi để điền báo cáo.");
    } finally {
      setLoadingDraft(false);
    }
  }, [initialActivity]);

  useEffect(() => {
    if (!initialActivity?.id || autoOpenedActivityId.current === initialActivity.id) return;
    autoOpenedActivityId.current = initialActivity.id;
    void openDialog(true);
  }, [initialActivity?.id, openDialog]);

  function updateLine(index: number, field: keyof DraftLine, value: string) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line));
  }

  async function saveReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedActivity?.id) { setError("Không xác định được hoạt động để lập báo cáo."); return; }
    setSaving(true);
    setError("");
    try {
      await workflowRequest("/reports/settlements", {
        method: "POST",
        body: {
          maHD: Number(selectedActivity.id),
          cacDong: lines.map((line) => ({
            noiDungThucHien: line.noiDungThucHien.trim(),
            duToan: Number(line.duToan),
            thucThi: Number(line.thucThi),
            ghiChu: line.ghiChu.trim() || undefined,
          })),
        },
      });
      setDialogOpen(false);
      setNotice("Đã lưu báo cáo quyết toán.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được báo cáo quyết toán.");
    } finally {
      setSaving(false);
    }
  }

  return <div className={s.businessPanel}>
    {error && !dialogOpen && <NoticeDialog kind="error" message={error} onClose={() => setError("")} />}
    {notice && <NoticeDialog kind="success" message={notice} onClose={() => setNotice("")} />}
    <section className={s.card}>
      <div className={s.settlementReportToolbar}>
        <div><h2>Danh sách báo cáo quyết toán</h2><p>Các báo cáo quyết toán đã được lập cho hoạt động được phân công.</p></div>
        <button type="button" className={s.primary} disabled={!initialActivity} onClick={() => void openDialog(true)}>＋ Lập báo cáo quyết toán</button>
      </div>
      {loading ? <p role="status">Đang tải báo cáo quyết toán…</p> : reports.length ? <div className={s.budgetTableWrap}>
        <table className={s.budgetSummaryTable}>
          <thead><tr><th>Mã báo cáo</th><th>Mã hoạt động</th><th>Tên hoạt động</th><th>Năm học</th><th>Người lập</th><th>Ngày lập</th><th>Số dòng</th><th>Dự toán</th><th>Thực thi</th><th>Chênh lệch</th><th>Chi tiết</th></tr></thead>
          <tbody>{reports.map((report) => {
            const id = read(report, "MaBC", "");
            return <tr key={id}>
              <td>{id}</td><td>{read(report, "MaHD")}</td><td>{read(report, "TenHoatDong")}</td><td>{read(report, "NamHoc")}</td>
              <td>{read(report, "TenNguoiLap")}</td><td>{date(readRaw(report, "NgayLap"))}</td><td>{read(report, "SoDong", "0")}</td>
              <td>{money(readRaw(report, "TongDuToan"))}</td><td>{money(readRaw(report, "TongThucThi"))}</td><td>{money(readRaw(report, "TongChenhLech"))}</td>
              <td><button type="button" className={s.secondaryButton} onClick={() => setExpandedReportId((current) => current === id ? "" : id)}>{expandedReportId === id ? "Ẩn" : "Xem"}</button></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <div className={s.settlementReportEmpty}><span aria-hidden="true">▤</span><strong>Chưa có báo cáo quyết toán</strong><p>Nhấn “Lập báo cáo quyết toán” để tạo báo cáo đầu tiên.</p></div>}
    </section>
    {expandedReportId && (() => {
      const report = reports.find((item) => read(item, "MaBC", "") === expandedReportId);
      if (!report) return null;
      const reportLines = parseLines(readRaw(report, "CacDong"));
      return <section className={s.card}>
        <h2>Chi tiết báo cáo #{expandedReportId} · {read(report, "TenHoatDong")}</h2>
        <div className={s.budgetTableWrap}><table className={s.budgetSummaryTable}><thead><tr><th>STT</th><th>Nội dung thực hiện</th><th>Dự toán</th><th>Thực thi</th><th>Chênh lệch</th><th>Ghi chú</th></tr></thead><tbody>
          {reportLines.map((line, index) => <tr key={`${expandedReportId}-${index}`}><td>{line.stt ?? index + 1}</td><td>{line.noiDungThucHien}</td><td>{money(line.duToan)}</td><td>{money(line.thucThi)}</td><td>{money(line.chenhLech ?? line.thucThi - line.duToan)}</td><td>{line.ghiChu || "—"}</td></tr>)}
        </tbody></table></div>
      </section>;
    })()}
    {dialogOpen && <div className={s.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="settlement-report-dialog-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDialogOpen(false); }}>
      <form className={`${s.modalCard} ${s.settlementReportDialog}`} onSubmit={saveReport}>
        <div className={s.modalHeader}><div><h2 id="settlement-report-dialog-title">Lập báo cáo quyết toán</h2></div><button type="button" className={s.modalCloseBtn} aria-label="Đóng" disabled={saving} onClick={() => setDialogOpen(false)}>×</button></div>
        <div className={s.modalBody}>
          {error && <div className={s.reportError} role="alert">{error}</div>}
          <div className={s.settlementReportIdentity}>
            <label className={s.businessField}><span>Mã hoạt động</span><input className={s.businessInput} value={selectedActivity?.id || "Chưa chọn hoạt động"} readOnly /></label>
            <label className={s.businessField}><span>Tên hoạt động</span><input className={s.businessInput} value={selectedActivity?.name ?? ""} readOnly placeholder="Tự động hiển thị" /></label>
            <label className={s.businessField}><span>Năm học</span><input className={s.businessInput} value={selectedActivity?.academicYear ?? ""} readOnly placeholder="Tự động hiển thị" /></label>
          </div>
          <div className={s.settlementReportLinesHeader}><div><h3>Nội dung báo cáo</h3><p>Chênh lệch được tính tự động: thực thi trừ dự toán.</p></div><span>{lines.length} dòng</span></div>
          {lines.map((line, index) => {
            const difference = Number((amountOf(line.thucThi) - amountOf(line.duToan)).toFixed(2));
            return <fieldset className={s.settlementReportLine} key={`report-line-${index}`}>
              <legend>Dòng {index + 1}</legend>
              <div className={s.settlementReportLineGrid}>
                <label className={`${s.businessField} ${s.settlementReportContent}`}><span>Nội dung thực hiện <b className={s.requiredMark}>*</b></span><input className={s.businessInput} value={line.noiDungThucHien} onChange={(event) => updateLine(index, "noiDungThucHien", event.target.value)} maxLength={2000} required disabled={saving || loadingDraft} /></label>
                <label className={s.businessField}><span>Dự toán <b className={s.requiredMark}>*</b></span><input className={s.businessInput} type="number" min="0" step="0.01" value={line.duToan} onChange={(event) => updateLine(index, "duToan", event.target.value)} required disabled={saving || loadingDraft} /></label>
                <label className={s.businessField}><span>Thực thi <b className={s.requiredMark}>*</b></span><input className={s.businessInput} type="number" min="0" step="0.01" value={line.thucThi} onChange={(event) => updateLine(index, "thucThi", event.target.value)} required disabled={saving || loadingDraft} /></label>
                <label className={s.businessField}><span>Chênh lệch</span><output className={`${s.businessInput} ${s.settlementReportDifference}`} data-negative={difference < 0}>{money(difference)}</output></label>
                <label className={`${s.businessField} ${s.settlementReportNote}`}><span>Ghi chú</span><input className={s.businessInput} value={line.ghiChu} onChange={(event) => updateLine(index, "ghiChu", event.target.value)} maxLength={1000} disabled={saving || loadingDraft} /></label>
              </div>
            </fieldset>;
          })}
          {loadingDraft && <p role="status">Đang điền nội dung từ các khoản chi thực tế…</p>}
          <button type="button" className={s.secondaryButton} disabled={saving || loadingDraft || lines.length >= 100} onClick={() => setLines((current) => [...current, emptyLine()])}>＋ Thêm dòng</button>
          <div className={s.settlementReportTotals}><span>Tổng dự toán <strong>{money(totals.budget)}</strong></span><span>Tổng thực thi <strong>{money(totals.actual)}</strong></span><span>Chênh lệch <strong>{money(totals.actual - totals.budget)}</strong></span></div>
        </div>
        <div className={s.modalFooter}><button type="button" className={s.secondaryButton} disabled={saving} onClick={() => setDialogOpen(false)}>Hủy</button><button type="submit" className={s.primary} disabled={saving || loadingDraft || !selectedActivity}>{saving ? "Đang lưu…" : "Lưu báo cáo"}</button></div>
      </form>
    </div>}
  </div>;
}
