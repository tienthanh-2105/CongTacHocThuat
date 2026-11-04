"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { workflowRequest } from "@/services/workflow";
import s from "./dashboard.module.css";

type Assignment = {
  MaPhanCongDeXuat: number; TenHoatDong: string; LoaiHoatDong: string; NamHoc: string;
  TenBM: string; TenNguoiGiao: string; NguoiChuTri: number; NoiDung: string; HanHoanThanh?: string | null;
  members: { MaTK: number; HoTen: string; NoiDung?: string }[];
};
export const assignmentDate = (value?: string | null) => value ? value.slice(0,10).split("-").reverse().join("/") : "—";

export default function DepartmentAssignmentDetails({ id, onClose }: { id: number; onClose: () => void }) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [error, setError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let active = true;
    void workflowRequest<Assignment>(`/department-plans/assignments/${id}`).then((row) => {
      if (active) setAssignment(row);
    }).catch((error: unknown) => { if (active) setError(error instanceof Error ? error.message : "Không tải được phân công."); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("keydown", close); previous?.focus(); };
  }, [onClose]);
  return <div className={s.modalOverlay} onClick={onClose}>
    <section className={`${s.modalCard} ${s.departmentAssignmentDialog}`} role="dialog" aria-modal="true" aria-labelledby="assignment-detail-title" onClick={(event) => event.stopPropagation()}>
      <div className={s.departmentAssignmentDialogHeading}><h2 id="assignment-detail-title">Phân công thực hiện công việc bộ môn</h2><button ref={closeRef} type="button" className={s.modalCloseBtn} aria-label="Đóng chi tiết phân công" onClick={onClose}>×</button></div>
      <div className={s.departmentAssignmentBody}>
        {error ? <p role="alert">{error}</p> : !assignment ? <p>Đang tải phân công…</p> : <>
          <h3>{assignment.TenHoatDong}</h3>
          <dl className={s.departmentAssignmentFacts}>
            <div><dt>Loại công việc</dt><dd>{assignment.LoaiHoatDong}</dd></div>
            <div><dt>Năm học</dt><dd>{assignment.NamHoc}</dd></div>
            <div><dt>Bộ môn</dt><dd>{assignment.TenBM}</dd></div>
            <div><dt>Người phân công</dt><dd>{assignment.TenNguoiGiao}</dd></div>
            <div><dt>Hạn hoàn thành</dt><dd>{assignmentDate(assignment.HanHoanThanh)}</dd></div>
          </dl>
          <div><strong>Nội dung thực hiện</strong><p className={s.departmentAssignmentContent}>{assignment.NoiDung}</p></div>
          <div><strong>Giảng viên thực hiện</strong><ul>{assignment.members.map((member) => <li key={member.MaTK}><strong>{member.HoTen}</strong> · <span style={{ color: member.MaTK === assignment.NguoiChuTri ? "#2563eb" : "#475569", fontWeight: 600 }}>{member.MaTK === assignment.NguoiChuTri ? "Chủ trì" : "Phối hợp"}</span>{member.NoiDung ? ` — Nhiệm vụ: ${member.NoiDung}` : ""}</li>)}</ul></div>
          <p className={s.studentProfilesHint}>Người chủ trì phối hợp với các thành viên để thực hiện công việc bộ môn theo đúng tiến độ được giao.</p>
          <div className={s.departmentAssignmentActions}><button type="button" className={s.secondaryButton} onClick={onClose}>Đóng</button></div>
        </>}
      </div>
    </section>
  </div>;
}
