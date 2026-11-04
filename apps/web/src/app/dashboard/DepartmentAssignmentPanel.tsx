"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { workflowRequest } from "@/services/workflow";
import DepartmentAssignmentDetails, { assignmentDate } from "./DepartmentAssignmentDetails";
import NoticeDialog from "./NoticeDialog";
import s from "./dashboard.module.css";

type Department = { MaBM: number; TenBM: string; VaiTro: string };
export type DepartmentMember = { MaGV: number; MaTK?: number | null; MaBM: number; HoTen: string; Email?: string; HocVi?: string; VaiTro: string; TenBM: string };
type Assignment = { MaPhanCongDeXuat: number; TenHoatDong: string; LoaiHoatDong: string; NamHoc: string; HanHoanThanh?: string | null; TenChuTri: string; SoNguoi: number };
const title = "Phân công thực hiện công việc bộ môn";

export default function DepartmentAssignmentPanel({ departments, members }: { departments: Department[]; members: DepartmentMember[] }) {
  const assignable = departments.filter((department) => ["Trưởng bộ môn", "Phụ trách bộ môn"].includes(department.VaiTro));
  const activeDepartment = assignable[0]?.MaBM || departments[0]?.MaBM || 0;
  const canAssign = assignable.some((department) => department.MaBM === activeDepartment);
  const visibleMembers = members.filter((member) => member.MaBM === activeDepartment);
  const eligible = [...new Set(visibleMembers.flatMap((member) => member.MaTK ? [member.MaTK] : []))];

  const currentYear = new Date().getFullYear();
  const startYear = new Date().getMonth() >= 7 ? currentYear : currentYear - 1;
  const defaultYear = `${startYear}-${startYear + 1}`;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  const [selected, setSelected] = useState<number[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const [history, setHistory] = useState<Assignment[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [lead, setLead] = useState(0);

  // Form states: Nội dung thực hiện & Hạn hoàn thành
  const [noiDungThucHien, setNoiDungThucHien] = useState("");
  const [hanHoanThanh, setHanHoanThanh] = useState("");

  const closeRef = useRef<HTMLButtonElement>(null);
  const submitLock = useRef(false);
  const closeDetails = useCallback(() => setDetailId(null), []);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await workflowRequest<Assignment[]>("/department-plans/assignments"));
      setHistoryError("");
    } catch {
      setHistoryError("Không tải được danh sách phân công.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void workflowRequest<Assignment[]>("/department-plans/assignments")
      .then((rows) => { if (active) setHistory(rows); })
      .catch(() => { if (active) setHistoryError("Không tải được danh sách phân công."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!showForm) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !submitLock.current) setShowForm(false); };
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("keydown", close); previous?.focus(); };
  }, [showForm]);

  function toggle(id: number, checked: boolean) {
    setSelected((current) => checked ? [...new Set([...current, id])] : current.filter((value) => value !== id));
    if (!checked && lead === id) setLead(0);
  }

  function handleOpenForm() {
    if (!selected.length) {
      setNotice({ message: "Vui lòng chọn ít nhất 1 giảng viên trong bảng để phân công.", kind: "error" });
      return;
    }
    setShowForm(true);
  }

  async function executeAssignment(payload: {
    noiDung: string;
    hanHoanThanh: string;
    selectedMembers: number[];
    leadMember: number;
  }) {
    if (submitLock.current) return;
    if (!payload.selectedMembers.length) {
      setNotice({ message: "Hãy chọn giảng viên thực hiện.", kind: "error" });
      return;
    }
    if (!payload.noiDung.trim()) {
      setNotice({ message: "Vui lòng nhập nội dung thực hiện công việc bộ môn.", kind: "error" });
      return;
    }

    submitLock.current = true;
    setBusy(true);
    try {
      const derivedTitle = payload.noiDung.trim();

      await workflowRequest("/department-plans/assignments", {
        method: "POST",
        body: {
          maBM: activeDepartment,
          maTKs: payload.selectedMembers,
          nguoiChuTri: payload.leadMember || payload.selectedMembers[0],
          tenHoatDong: derivedTitle.length > 120 ? derivedTitle.slice(0, 117) + "..." : derivedTitle,
          loaiHoatDong: "Công việc bộ môn",
          namHoc: defaultYear,
          noiDung: payload.noiDung.trim(),
          hanHoanThanh: payload.hanHoanThanh,
        },
      });

      setShowForm(false);
      setNotice({ message: `Đã phân công và gửi thông báo đến ${payload.selectedMembers.length} giảng viên.`, kind: "success" });
      setSelected([]);
      setLead(0);
      setNoiDungThucHien("");
      setHanHoanThanh("");
      window.dispatchEvent(new Event("academic-notifications-changed"));
      await loadHistory();
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Không thể phân công.", kind: "error" });
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const noiDungVal = String(values.get("noiDung") ?? noiDungThucHien).trim();
    const han = String(values.get("hanHoanThanh") ?? hanHoanThanh);

    await executeAssignment({
      noiDung: noiDungVal,
      hanHoanThanh: han,
      selectedMembers: selected,
      leadMember: lead || selected[0],
    });
  }

  const leadMember = visibleMembers.find((m) => m.MaTK === (lead || selected[0]));

  return (
    <>
      {notice && <NoticeDialog message={notice.message} kind={notice.kind} onClose={() => setNotice(null)} />}

      <section className={`${s.card} ${s.departmentBoardMembersCard}`}>
        <div className={s.departmentAssignmentHeading}>
          <h2>{title}</h2>
          <div className={s.departmentAssignmentActions}>
            {canAssign && (
              <button
                type="button"
                className={s.primary}
                disabled={busy}
                onClick={handleOpenForm}
                title="Bấm để phân công thực hiện công việc bộ môn"
              >
                Phân công thực hiện{selected.length ? ` (${selected.length})` : ""}
              </button>
            )}
            <button
              type="button"
              className={s.secondaryButton}
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Ẩn" : "Xem"}
            </button>
          </div>
        </div>

        {expanded && (
          <>
            {/* Inline Fields: Nội dung thực hiện & Hạn hoàn thành */}
            {canAssign && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "16px",
                  display: "grid",
                  gridTemplateColumns: "1fr 240px",
                  gap: "16px",
                  alignItems: "start",
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                    Nội dung thực hiện *
                  </span>
                  <textarea
                    className={s.businessInput}
                    rows={2}
                    placeholder="Nhập nội dung công việc bộ môn cần phân công thực hiện..."
                    value={noiDungThucHien}
                    onChange={(e) => setNoiDungThucHien(e.target.value)}
                    disabled={busy}
                    required
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                    Hạn hoàn thành
                  </span>
                  <input
                    type="date"
                    className={s.businessInput}
                    min={today}
                    value={hanHoanThanh}
                    onChange={(e) => setHanHoanThanh(e.target.value)}
                    disabled={busy}
                  />
                </label>
              </div>
            )}

            <div className={s.departmentAssignmentToolbar}>
              <span aria-live="polite">
                Đã chọn <strong>{selected.length}</strong> giảng viên
                {leadMember ? (
                  <span>
                    {" "}· Người chủ trì: <strong>{leadMember.HoTen}</strong>
                  </span>
                ) : null}
              </span>
            </div>

            <div className={s.planActivityTableWrap}>
              <table className={`${s.departmentMembersTable} ${s.departmentAssignmentTable}`}>
                <thead>
                  <tr>
                    <th>Họ và tên</th>
                    <th>Email</th>
                    <th>Học hàm / học vị</th>
                    <th>Bộ môn</th>
                    <th>Vai trò</th>
                    <th style={{ width: "80px", textAlign: "center" }}>
                      Chọn{" "}
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả giảng viên có tài khoản"
                        checked={eligible.length > 0 && eligible.every((id) => selected.includes(id))}
                        disabled={!canAssign || !eligible.length || busy}
                        onChange={(event) => {
                          setSelected(event.target.checked ? eligible : []);
                          setLead(0);
                        }}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMembers.length ? (
                    visibleMembers.map((member) => {
                      const isSelected = Boolean(member.MaTK && selected.includes(member.MaTK));
                      const isLead = member.MaTK === (lead || selected[0]);
                      return (
                        <tr
                          key={`${member.MaBM}-${member.MaGV}-${member.MaTK}`}
                          className={isSelected ? s.departmentAssignmentSelected : undefined}
                        >
                          <td>
                            <strong>{member.HoTen}</strong>
                            {isSelected && (
                              <div style={{ marginTop: "4px" }}>
                                <button
                                  type="button"
                                  onClick={() => member.MaTK && setLead(member.MaTK)}
                                  style={{
                                    fontSize: "11px",
                                    padding: "2px 8px",
                                    borderRadius: "4px",
                                    border: isLead ? "1px solid #2563eb" : "1px solid #cbd5e1",
                                    background: isLead ? "#eff6ff" : "#ffffff",
                                    color: isLead ? "#1d4ed8" : "#64748b",
                                    cursor: "pointer",
                                    fontWeight: isLead ? 700 : 500,
                                  }}
                                  title={isLead ? "Người chủ trì" : "Bấm để chọn làm Người chủ trì"}
                                >
                                  {isLead ? "★ Chủ trì" : "Đặt làm chủ trì"}
                                </button>
                              </div>
                            )}
                          </td>
                          <td>{member.Email || "—"}</td>
                          <td>{member.HocVi || "—"}</td>
                          <td>{member.TenBM}</td>
                          <td>
                            {["Trưởng bộ môn", "Phụ trách bộ môn"].includes(member.VaiTro)
                              ? "Phụ trách bộ môn"
                              : "Giảng viên"}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              aria-label={`Chọn ${member.HoTen}`}
                              title={
                                member.MaTK
                                  ? `Chọn ${member.HoTen}`
                                  : "Giảng viên chưa có tài khoản đang hoạt động"
                              }
                              disabled={!canAssign || !member.MaTK || busy}
                              checked={isSelected}
                              onChange={(event) => {
                                if (member.MaTK) toggle(member.MaTK, event.target.checked);
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className={s.emptyMessage}>
                        Chưa có cán bộ, giảng viên thuộc bộ môn.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {canAssign && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginTop: "16px",
                  paddingTop: "12px",
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <button
                  type="button"
                  className={s.primary}
                  disabled={busy}
                  onClick={handleOpenForm}
                >
                  Phân công thực hiện{selected.length ? ` (${selected.length})` : ""}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {(history.length > 0 || historyError) && (
        <section className={`${s.card} ${s.departmentBoardMembersCard}`}>
          <h2>Công việc bộ môn đã phân công</h2>
          {historyError ? (
            <p role="alert">
              {historyError}{" "}
              <button type="button" className={s.secondaryButton} onClick={() => void loadHistory()}>
                Thử lại
              </button>
            </p>
          ) : (
            <div className={s.planActivityTableWrap}>
              <table className={s.departmentMembersTable}>
                <thead>
                  <tr>
                    <th>Nội dung công việc</th>
                    <th>Người chủ trì</th>
                    <th>Số người</th>
                    <th>Hạn hoàn thành</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.MaPhanCongDeXuat}>
                      <td><strong>{row.TenHoatDong}</strong></td>
                      <td>{row.TenChuTri}</td>
                      <td>{row.SoNguoi}</td>
                      <td>{assignmentDate(row.HanHoanThanh)}</td>
                      <td>
                        <button
                          type="button"
                          className={s.secondaryButton}
                          onClick={() => setDetailId(row.MaPhanCongDeXuat)}
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {detailId !== null && <DepartmentAssignmentDetails key={detailId} id={detailId} onClose={closeDetails} />}

      {showForm && (
        <div
          className={s.modalOverlay}
          onClick={() => {
            if (!busy) setShowForm(false);
          }}
        >
          <section
            className={`${s.modalCard} ${s.departmentAssignmentDialog}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="assignment-form-title"
            onClick={(event) => event.stopPropagation()}
            style={{ maxWidth: "680px", width: "95%" }}
          >
            <div className={s.departmentAssignmentDialogHeading}>
              <h2 id="assignment-form-title">Xác nhận phân công thực hiện công việc bộ môn</h2>
              <button
                ref={closeRef}
                type="button"
                className={s.modalCloseBtn}
                aria-label="Đóng biểu mẫu phân công"
                disabled={busy}
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>
            <form className={`${s.businessForm} ${s.departmentAssignmentBody}`} onSubmit={submit}>
              <label className={s.businessField}>
                <span>Bộ môn</span>
                <input
                  className={s.businessInput}
                  value={departments.find((department) => department.MaBM === activeDepartment)?.TenBM ?? ""}
                  readOnly
                />
              </label>

              <label className={s.businessField}>
                <span>Hạn hoàn thành</span>
                <input
                  className={s.businessInput}
                  name="hanHoanThanh"
                  type="date"
                  min={today}
                  defaultValue={hanHoanThanh}
                />
              </label>

              <label className={`${s.businessField} ${s.departmentAssignmentFullWidth}`}>
                <span>Nội dung thực hiện *</span>
                <textarea
                  className={s.businessInput}
                  name="noiDung"
                  rows={3}
                  maxLength={5000}
                  defaultValue={noiDungThucHien}
                  placeholder="Nhập nội dung công việc bộ môn cần phân công thực hiện..."
                  required
                />
              </label>

              <label className={`${s.businessField} ${s.departmentAssignmentFullWidth}`}>
                <span>Người chủ trì *</span>
                <select
                  className={s.businessInput}
                  value={lead || selected[0] || ""}
                  onChange={(event) => setLead(Number(event.target.value))}
                  required
                >
                  {visibleMembers
                    .filter((member) => member.MaTK && selected.includes(member.MaTK))
                    .map((member) => (
                      <option key={member.MaTK} value={member.MaTK!}>
                        {member.HoTen}
                      </option>
                    ))}
                </select>
              </label>

              {/* Giảng viên thực hiện */}
              <div className={s.departmentAssignmentFullWidth}>
                <strong>Giảng viên thực hiện ({selected.length})</strong>
                <div className={s.departmentAssignmentChips} style={{ marginTop: "8px" }}>
                  {visibleMembers
                    .filter((member) => member.MaTK && selected.includes(member.MaTK))
                    .map((member) => (
                      <span key={member.MaTK}>
                        <strong>{member.HoTen}</strong> · {member.MaTK === (lead || selected[0]) ? "★ Chủ trì" : "Phối hợp"}
                      </span>
                    ))}
                </div>
              </div>

              <div className={`${s.departmentAssignmentActions} ${s.departmentAssignmentFullWidth}`}>
                <button
                  type="button"
                  className={s.secondaryButton}
                  disabled={busy}
                  onClick={() => setShowForm(false)}
                >
                  Hủy
                </button>
                <button type="submit" className={s.primary} disabled={busy}>
                  {busy ? "Đang phân công…" : "Xác nhận phân công"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
