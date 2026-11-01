"use client";

import { useCallback, useEffect, useState } from "react";
import { workflowRequest } from "@/services/workflow";
import NoticeDialog from "./NoticeDialog";
import s from "./dashboard.module.css";

type Department = { MaBM: number; TenBM: string; VaiTro: string };
type Proposal = { MaDeXuat: number; MaHD?: number | null; MaBM: number; TenBM: string; TenHoatDong?: string | null; NamHoc: string; TenCuocThi: string; NoiDung: string; DuTruKinhPhi: number; TenNguoiLap: string; TrangThai: string; GhiChuDuyet?: string | null; MaKeHoachKhoa?: number | null; TrangThaiKeHoachKhoa?: string | null; LaNguoiLap?: boolean; LaTruongBM?: boolean; HocVi?: string | null; ChucDanh?: string | null; ChucVu?: string | null };
type FacultyPlan = { MaKeHoach: number; SoKeHoach: string; NamHoc: string; TrangThai: string };
type Form = { maBM: number; namHoc: string; tenCuocThi: string; noiDung: string; duTruKinhPhi: number };
type Member = { HoTen: string; Email?: string; HocVi?: string; VaiTro: string; TenBM: string };
const initial: Form = { maBM: 0, namHoc: "2026-2027", tenCuocThi: "", noiDung: "", duTruKinhPhi: 0 };
const money = (value: number) => `${Number(value).toLocaleString("vi-VN")} đ`;
function proposalStatusLabel(proposal: Proposal) {
  if (proposal.TrangThai === "Chờ Trưởng bộ môn") return "Chờ Phụ trách bộ môn";
  if (proposal.TrangThai === "Chờ khoa") return "Chờ Trưởng ban học thuật tổng hợp";
  if (proposal.TrangThai === "Đã duyệt") {
    if (proposal.TrangThaiKeHoachKhoa === "Chờ Trưởng khoa ký duyệt") return "Chờ Trưởng khoa duyệt";
    if (proposal.TrangThaiKeHoachKhoa === "Đã duyệt") return "Đã duyệt";
    if (proposal.MaKeHoachKhoa && ["Dự thảo", "Cần bổ sung"].includes(proposal.TrangThaiKeHoachKhoa ?? "")) return "Đã gộp, chờ trình Trưởng khoa";
    return proposal.MaKeHoachKhoa ? "Đã gộp vào kế hoạch" : "Đã tổng hợp, chờ gộp kế hoạch";
  }
  if (proposal.TrangThai === "Khoa yêu cầu bổ sung") return "Cần bổ sung";
  return proposal.TrangThai;
}

export default function DepartmentPlansPanel({ mode, facultyPlans = [] }: { mode: "lecturer" | "faculty"; facultyPlans?: FacultyPlan[] }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [form, setForm] = useState<Form>(initial);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const [year, setYear] = useState("");
  const [showBoardMembers, setShowBoardMembers] = useState(false);
  const [selectedProposalIds, setSelectedProposalIds] = useState<number[]>([]);
  const [viewingProposal, setViewingProposal] = useState<Proposal | null>(null);
  const load = useCallback(async () => {
    if (mode === "lecturer") {
      const [membershipRows, proposalRows, memberRows] = await Promise.all([
        workflowRequest<Department[]>("/department-plans/my-departments"), workflowRequest<Proposal[]>("/department-plans"), workflowRequest<Member[]>("/department-plans/board-members"),
      ]);
      setDepartments(membershipRows);
      setMembers(memberRows);
      setProposals(proposalRows);
      setForm((current) => ({ ...current, maBM: current.maBM || membershipRows[0]?.MaBM || 0 }));
    } else setProposals(await workflowRequest<Proposal[]>("/department-plans/faculty/queue"));
  }, [mode]);
  useEffect(() => { void load().catch((error) => setNotice({ message: error instanceof Error ? error.message : "Không tải được đề xuất", kind: "error" })); }, [load]);
  async function action(path: string, method: string, body: object | undefined, message: string) {
    setBusy(true);
    try {
      await workflowRequest(path, { method, body });
      await load();
      setNotice({ message, kind: "success" });
      return true;
    } catch (error) { setNotice({ message: error instanceof Error ? error.message : "Thao tác thất bại", kind: "error" }); return false; }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.maBM) return setNotice({ message: "Hãy chọn bộ môn", kind: "error" });
    if (await action(editingId ? `/department-plans/${editingId}` : "/department-plans", editingId ? "PATCH" : "POST", form, editingId ? "Đã cập nhật đề xuất." : "Đã tạo bản dự thảo.")) {
      setEditingId(null);
      setForm({ ...initial, maBM: form.maBM, namHoc: form.namHoc });
    }
  }
  function editProposal(proposal: Proposal) {
    setEditingId(proposal.MaDeXuat);
    setForm({ maBM: proposal.MaBM, namHoc: proposal.NamHoc, tenCuocThi: proposal.TenCuocThi, noiDung: proposal.NoiDung, duTruKinhPhi: Number(proposal.DuTruKinhPhi) || 0 });
  }
  async function sendSelected() {
    const selected = visible.filter((proposal) => selectedProposalIds.includes(proposal.MaDeXuat) && proposal.LaTruongBM && proposal.TrangThai === "Chờ Trưởng bộ môn");
    if (!selected.length) return setNotice({ message: "Chỉ Phụ trách bộ môn mới được chọn đề xuất đang chờ xem xét.", kind: "error" });
    setBusy(true);
    const sent: number[] = [];
    const failed: number[] = [];
    try {
      for (const proposal of selected) {
        try {
          await workflowRequest(`/department-plans/${proposal.MaDeXuat}/head-review`, { method: "PATCH", body: { approve: true } });
          sent.push(proposal.MaDeXuat);
        } catch {
          failed.push(proposal.MaDeXuat);
        }
      }
      await load();
      setSelectedProposalIds([]);
      setNotice({ message: failed.length ? `Đã chuyển ${sent.length}/${selected.length} đề xuất lên Trưởng ban học thuật tổng hợp. Không chuyển được các mã: ${failed.join(", ")}.` : `Đã chuyển ${sent.length} đề xuất lên Trưởng ban học thuật tổng hợp.`, kind: failed.length ? "error" : "success" });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Không thể gửi các đề xuất đã chọn.", kind: "error" });
    } finally {
      setBusy(false);
    }
  }
  const years = [...new Set(proposals.map((proposal) => proposal.NamHoc))].sort().reverse();
  const visible = year ? proposals.filter((proposal) => proposal.NamHoc === year) : proposals;
  const waitingForHead = visible.filter((proposal) => proposal.LaTruongBM && proposal.TrangThai === "Chờ Trưởng bộ môn");
  const allWaitingSelected = waitingForHead.length > 0 && waitingForHead.every((proposal) => selectedProposalIds.includes(proposal.MaDeXuat));
  return <>
    {notice && <NoticeDialog message={notice.message} kind={notice.kind} onClose={() => setNotice(null)} />}
    {mode === "lecturer" && <section className={`${s.card} ${s.departmentBoardMembersCard}`}>
      <div className={s.planActivityFilterHeading}><h2>Thành viên Ban bộ môn</h2><button type="button" className={s.secondaryButton} aria-expanded={showBoardMembers} onClick={() => setShowBoardMembers((visible) => !visible)}>{showBoardMembers ? "Ẩn" : "Xem"}</button></div>
      {showBoardMembers && <><div className={s.planActivityTableWrap}><table className={s.departmentMembersTable}><thead><tr><th>Họ và tên</th><th>Email</th><th>Học hàm / học vị</th><th>Bộ môn</th><th>Vai trò</th></tr></thead><tbody>{members.map((member, index) => <tr key={`${member.HoTen}-${index}`}><td>{member.HoTen}</td><td>{member.Email || "—"}</td><td>{member.HocVi || "—"}</td><td>{member.TenBM}</td><td>{["Trưởng bộ môn", "Phụ trách bộ môn"].includes(member.VaiTro) ? "Phụ trách bộ môn" : "Ban bộ môn"}</td></tr>)}</tbody></table></div><p className={s.studentProfilesHint}>Giảng viên gửi hoạt động học thuật từ trang Hoạt động học thuật. Phụ trách bộ môn xem xét rồi chuyển đề xuất lên Trưởng ban học thuật tổng hợp.</p></>}
    </section>}
    <section className={`${s.card} ${s.departmentBoardProposalsCard}`}>
      <div className={s.planActivityFilterHeading}>
        <h2>{mode === "lecturer" ? "Đề xuất của bộ môn" : "Đề xuất chờ Trưởng ban học thuật tổng hợp"}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {mode === "lecturer" && <button type="button" className={s.primary} disabled={busy || selectedProposalIds.length === 0} onClick={() => void sendSelected()}>Gửi{selectedProposalIds.length ? ` (${selectedProposalIds.length})` : ""}</button>}
          <label className={s.planYearFilter}>Năm học <select className={s.businessInput} value={year} onChange={(event) => { setYear(event.target.value); setSelectedProposalIds([]); }}><option value="">Tất cả năm học</option>{years.map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
      </div>
      {mode === "faculty" && <p className={s.studentProfilesHint}>Trưởng ban học thuật tổng hợp thông qua đề xuất và gộp vào kế hoạch chung. Kế hoạch sau đó được chuyển Trưởng khoa duyệt.</p>}
      {visible.length || mode === "lecturer" ? <div className={s.departmentBoardTableWrap}><table className={`${s.departmentBoardTable} ${mode === "lecturer" ? s.departmentActivityProposalTable : ""}`}>
        <thead>{mode === "lecturer" ? <tr><th><input type="checkbox" aria-label="Chọn tất cả đề xuất đang chờ Trưởng bộ môn" checked={allWaitingSelected} disabled={!waitingForHead.length || busy} onChange={(event) => setSelectedProposalIds(event.target.checked ? waitingForHead.map((proposal) => proposal.MaDeXuat) : [])} /></th><th>Mã hoạt động</th><th>Tên hoạt động</th><th>Trạng thái</th><th>Thao tác</th></tr> : <tr><th>Cuộc thi / bộ môn</th><th>Người lập</th><th>Năm học</th><th>Dự trù</th><th>Trạng thái</th><th>Thao tác</th></tr>}</thead>
        <tbody>{visible.length ? visible.map((proposal) => {
          const canSelect = mode === "lecturer" && Boolean(proposal.LaTruongBM) && proposal.TrangThai === "Chờ Trưởng bộ môn";
          const canEdit = Boolean(proposal.LaNguoiLap) && ["Dự thảo", "Cần bổ sung", "Khoa yêu cầu bổ sung"].includes(proposal.TrangThai);
          return <tr key={proposal.MaDeXuat}>
            {mode === "lecturer" ? <>
              <td><input type="checkbox" aria-label={`Chọn hoạt động ${proposal.MaHD ?? proposal.MaDeXuat}`} checked={selectedProposalIds.includes(proposal.MaDeXuat)} disabled={!canSelect || busy} onChange={(event) => setSelectedProposalIds((current) => event.target.checked ? [...new Set([...current, proposal.MaDeXuat])] : current.filter((id) => id !== proposal.MaDeXuat))} /></td>
              <td>{proposal.MaHD ?? "—"}</td>
              <td><strong>{proposal.TenHoatDong || proposal.TenCuocThi}</strong></td>
              <td><span className={s.planStatusBadge}>{proposalStatusLabel(proposal)}</span></td>
              <td><div className={s.planRowActions}><button type="button" className={s.secondaryButton} onClick={() => setViewingProposal(proposal)}>Xem</button><button type="button" className={s.secondaryButton} disabled={!canEdit || busy} title={canEdit ? "Sửa đề xuất" : "Chỉ người lập được sửa bản dự thảo hoặc cần bổ sung"} onClick={() => editProposal(proposal)}>Sửa</button></div></td>
            </> : <>
              <td><strong>{proposal.TenHoatDong || proposal.TenCuocThi}</strong><small>{proposal.TenBM} · {proposal.NoiDung}</small>{proposal.GhiChuDuyet && <small>Ghi chú: {proposal.GhiChuDuyet}</small>}</td>
              <td><strong>{proposal.TenNguoiLap || "—"}</strong></td><td>{proposal.NamHoc}</td><td>{money(proposal.DuTruKinhPhi)}</td><td><span className={s.planStatusBadge}>{proposalStatusLabel(proposal)}</span>{proposal.MaKeHoachKhoa && <small>Kế hoạch #{proposal.MaKeHoachKhoa} · {proposal.TrangThaiKeHoachKhoa || "Chưa trình duyệt"}</small>}{proposal.GhiChuDuyet && <small>Ghi chú: {proposal.GhiChuDuyet}</small>}</td>
              <td><div className={s.planRowActions}>
                {proposal.TrangThai === "Chờ khoa" && <><button className={s.primary} disabled={busy} onClick={() => void action(`/department-plans/${proposal.MaDeXuat}/faculty-review`, "PATCH", { approve: true }, "Đã thông qua đề xuất để tổng hợp vào kế hoạch khoa.")}>Thông qua để tổng hợp</button><button className={s.secondaryButton} disabled={busy} onClick={() => { const note = window.prompt("Nội dung cần bổ sung:"); if (note?.trim()) void action(`/department-plans/${proposal.MaDeXuat}/faculty-review`, "PATCH", { approve: false, ghiChu: note.trim() }, "Đã trả đề xuất để bổ sung."); }}>Trả bổ sung</button></>}
                {proposal.TrangThai === "Đã duyệt" && !proposal.MaKeHoachKhoa && <select className={s.businessInput} disabled={busy} defaultValue="" aria-label={`Gộp ${proposal.TenCuocThi} vào kế hoạch khoa`} onChange={(event) => { const planId = Number(event.target.value); if (planId) void action(`/department-plans/${proposal.MaDeXuat}/attach`, "PATCH", { maKeHoach: planId }, "Đã gộp đề xuất vào kế hoạch chung của khoa."); }}><option value="">Gộp vào kế hoạch…</option>{facultyPlans.filter((plan) => plan.NamHoc === proposal.NamHoc && ["Dự thảo", "Cần bổ sung"].includes(plan.TrangThai)).map((plan) => <option key={plan.MaKeHoach} value={plan.MaKeHoach}>{plan.SoKeHoach}</option>)}</select>}
              </div></td>
            </>}
          </tr>;
        }) : <tr><td colSpan={mode === "lecturer" ? 5 : 6} className={s.emptyMessage}>Chưa có đề xuất trong năm học này.</td></tr>}</tbody>
      </table></div> : <p className={s.emptyMessage}>Chưa có đề xuất trong năm học này.</p>}
    </section>
    {viewingProposal && <div className={s.modalOverlay} onClick={() => setViewingProposal(null)}><section className={s.modalCard} role="dialog" aria-modal="true" aria-labelledby="department-proposal-view-title" onClick={(event) => event.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottom: "1px solid #e2e8f0" }}><h2 id="department-proposal-view-title">Chi tiết đề xuất</h2><button type="button" className={s.modalCloseBtn} aria-label="Đóng" onClick={() => setViewingProposal(null)}>×</button></div>
      <div className={s.modalBody} style={{ padding: 20, display: "grid", gap: 14 }}><div><strong>Mã hoạt động:</strong> {viewingProposal.MaHD ?? "—"}</div><div><strong>Tên hoạt động:</strong> {viewingProposal.TenHoatDong || viewingProposal.TenCuocThi}</div><div><strong>Bộ môn:</strong> {viewingProposal.TenBM}</div><div><strong>Năm học:</strong> {viewingProposal.NamHoc}</div><div><strong>Trạng thái:</strong> {proposalStatusLabel(viewingProposal)}</div><div><strong>Nội dung:</strong><p style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{viewingProposal.NoiDung}</p></div><div><strong>Dự trù kinh phí:</strong> {money(viewingProposal.DuTruKinhPhi)}</div>{viewingProposal.GhiChuDuyet && <div><strong>Ghi chú:</strong> {viewingProposal.GhiChuDuyet}</div>}</div>
    </section></div>}
    {editingId !== null && <div className={s.modalOverlay} onClick={() => setEditingId(null)}><section className={s.modalCard} role="dialog" aria-modal="true" aria-labelledby="department-proposal-edit-title" onClick={(event) => event.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottom: "1px solid #e2e8f0" }}><h2 id="department-proposal-edit-title">Sửa đề xuất</h2><button type="button" className={s.modalCloseBtn} aria-label="Đóng" onClick={() => setEditingId(null)}>×</button></div>
      <form className={s.businessForm} style={{ padding: 20, margin: 0 }} onSubmit={save}>
        <label className={s.businessField}><span>Bộ môn</span><input className={s.businessInput} value={departments.find((department) => department.MaBM === form.maBM)?.TenBM ?? ""} readOnly /></label>
        <label className={s.businessField}><span>Năm học</span><input className={s.businessInput} value={form.namHoc} onChange={(event) => setForm((current) => ({ ...current, namHoc: event.target.value }))} required /></label>
        <label className={s.businessField} style={{ gridColumn: "1 / -1" }}><span>Tên hoạt động</span><input className={s.businessInput} value={form.tenCuocThi} onChange={(event) => setForm((current) => ({ ...current, tenCuocThi: event.target.value }))} required /></label>
        <label className={s.businessField} style={{ gridColumn: "1 / -1" }}><span>Nội dung</span><textarea className={s.businessInput} rows={4} value={form.noiDung} onChange={(event) => setForm((current) => ({ ...current, noiDung: event.target.value }))} required /></label>
        <label className={s.businessField}><span>Dự trù kinh phí</span><input className={s.businessInput} type="number" min="0" step="1000" value={form.duTruKinhPhi} onChange={(event) => setForm((current) => ({ ...current, duTruKinhPhi: Number(event.target.value) }))} required /></label>
        <div className={s.businessActions} style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 12 }}><button type="button" className={s.secondaryButton} onClick={() => setEditingId(null)}>Hủy</button><button type="submit" className={s.primary} disabled={busy}>Lưu thay đổi</button></div>
      </form>
    </section></div>}
  </>;
}
