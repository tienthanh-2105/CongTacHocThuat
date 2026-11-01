"use client";

import { useEffect, useState, type FormEvent } from "react";
import { workflowRequest } from "@/services/workflow";
import type { AuthUser } from "@/services/auth";
import s from "./dashboard.module.css";
import NoticeDialog from "./NoticeDialog";

type Row = Record<string, unknown>;
type Field = { name: string; label: string; type?: string; optional?: boolean; options?: { value: string; label: string }[] };
const text = (r: Row, k: string) => String(r[k] ?? "");
const rows = (v: unknown): Row[] => Array.isArray(v) ? v as Row[] : [];
const date = (v: unknown) => v ? new Date(String(v)).toLocaleString("vi-VN") : "Chưa cập nhật";
const inputDate = (v: unknown) => { if (!v) return ""; const d = new Date(String(v)); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16); };

function ActionForm({ title, fields, defaults = {}, onSave, busy }: { title: string; fields: Field[]; defaults?: Row; onSave: (v: Row) => Promise<void>; busy: boolean }) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget); const value: Row = {};
    for (const field of fields) {
      const raw = String(data.get(field.name) ?? "").trim();
      if (raw) value[field.name] = field.type === "number" ? Number(raw) : field.type === "datetime-local" ? new Date(raw).toISOString() : raw;
    }
    await onSave(value);
  }
  return <form className={s.businessForm} onSubmit={submit}><h3>{title}</h3>{fields.map(f => <label className={s.businessField} key={f.name}><span>{f.label}</span>{f.options
    ? <select name={f.name} defaultValue={text(defaults,f.name)} required={!f.optional}><option value="">Chọn…</option>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
    : f.type === "textarea" ? <textarea name={f.name} defaultValue={text(defaults,f.name)} required={!f.optional} rows={4} />
      : <input name={f.name} type={f.type ?? "text"} defaultValue={text(defaults,f.name)} required={!f.optional} min={f.type === "number" ? 0 : undefined} step={f.type === "number" ? "any" : undefined} />}</label>)}<button className={s.primary} disabled={busy}>{title}</button></form>;
}

export default function OrganizationPanel({ user, detailed }: { user: AuthUser; detailed: boolean }) {
  const [list,setList] = useState<Row[]>([]); const [selected,setSelected] = useState<Row | null>(null);
  const [round,setRound] = useState<Row | null>(null); const [busy,setBusy] = useState(false);
  const [error,setError] = useState(""); const [notice,setNotice] = useState("");
  const base = detailed ? "/detailed-plans" : "/competition-workflow/competitions";
  useEffect(() => { let active = true; void workflowRequest<Row[]>(base).then(v => { if(active) setList(v); }).catch(e => { if(active) setError(e.message); }); return () => {active=false;}; }, [base]);
  async function open(id: string) { try {setError("");setSelected(await workflowRequest<Row>(`${base}/${id}`));setRound(null);} catch(e) {setError(e instanceof Error ? e.message : "Không tải được dữ liệu");} }
  async function openRound(id: string) { try {setError("");setRound(await workflowRequest<Row>(`/competition-workflow/rounds/${id}`));} catch(e) {setError(e instanceof Error ? e.message : "Không tải được vòng thi");} }
  async function act(path: string, method = "POST", body: Row = {}) {
    setBusy(true);setError("");setNotice("");
    try { await workflowRequest(path,{method,body});setNotice("Đã lưu.");setList(await workflowRequest<Row[]>(base));
      if(selected) setSelected(await workflowRequest<Row>(`${base}/${detailed ? selected.MaHD : (selected.competition as Row).MaCThi}`));
      if(round) setRound(await workflowRequest<Row>(`/competition-workflow/rounds/${(round.round as Row).MaVong}`));
    } catch(e) {setError(e instanceof Error ? e.message : "Không thực hiện được thao tác");} finally {setBusy(false);}
  }
  const isStaff = user.roles.some(r => ["ADMIN","GIANGVIEN","CANBOKHOA","TRUONGKHOA"].includes(r));
  const detailId = selected ? text(selected,"MaHD") : "";
  const status = selected ? text(selected,"TrangThai") : "";
  const canEdit = isStaff && (!status || ["Dự thảo","Cần bổ sung","Từ chối"].includes(status));
  const canSign = user.roles.includes("ADMIN") || (status === "Chờ khoa ký" && user.roles.includes("TRUONGKHOA")) || (status === "Chờ CTSV ký" && user.roles.includes("PHONGCTSV"));
  const competition = selected?.competition as Row | undefined; const currentRound = round?.round as Row | undefined;
  const options = (items: Row[], key: string, label: string) => items.map(r => ({value:text(r,key),label:`${text(r,label)} (#${text(r,key)})`}));
  const roundPath = `/competition-workflow/rounds/${currentRound?.MaVong}`;
  return <div className={s.businessPanel}>
    {error ? <NoticeDialog message={error} kind="error" onClose={() => setError("")} /> : notice ? <NoticeDialog message={notice} kind="success" onClose={() => setNotice("")} /> : null}
    <section className={s.card}><h2>{detailed ? "Kế hoạch tổ chức chi tiết" : "Vòng thi, đề thi, bài thi và trao giải"}</h2>
      <p>{detailed ? "Bộ môn lập kế hoạch từ kế hoạch chung đã duyệt → Trưởng khoa ký → Phòng CTSV ký → Ban tổ chức công bố." : "Chỉ hiển thị cuộc thi có kế hoạch chi tiết đã ký và đã công bố. Sinh viên đăng ký hoạt động trước, sau đó đăng ký từng vòng."}</p>
      {!list.length && <p>Chưa có {detailed ? "hoạt động trong kế hoạch chung đã duyệt" : "cuộc thi được công bố"}.</p>}
      <div className={s.businessList}>{list.map(r => <article key={text(r,detailed ? "MaHD" : "MaCThi")}><div><strong>{text(r,"TenHoatDong")}</strong><p>{text(r,"NamHoc")} · {text(r,"TenBM")} · {text(r,"TrangThai") || "Chưa lập chi tiết"}</p></div><button onClick={() => void open(text(r,detailed ? "MaHD" : "MaCThi"))}>Xem / xử lý</button></article>)}</div>
    </section>
    {detailed && selected && <section className={s.card}><h2>{text(selected,"TenHoatDong")}</h2><p>Kế hoạch chung: {text(selected,"TenKeHoachNam")} · {status || "Chưa lập"}</p><p>Khoa ký: {date(selected.NgayKyKhoa)} · CTSV ký: {date(selected.NgayKyCTSV)}</p><p>{text(selected,"NoiDung")}</p>
      {canEdit && <ActionForm key={`${detailId}-${status}`} title="Lưu kế hoạch chi tiết" busy={busy} defaults={{tenKeHoach:selected.TenKeHoach || selected.TenHoatDong,noiDung:selected.NoiDung || selected.NoiDungHoatDong,theLe:selected.TheLe,tieuChiCham:selected.TieuChiCham,hinhThucThi:selected.HinhThucThi || "Cá nhân",thoiGianBatDau:inputDate(selected.ThoiGianBatDau),thoiGianKetThuc:inputDate(selected.ThoiGianKetThuc),hanDangKy:inputDate(selected.HanDangKy),diaDiem:selected.DiaDiem,diemRenLuyen:selected.DiemRenLuyen ?? 5}} fields={[
        {name:"tenKeHoach",label:"Tên kế hoạch"},{name:"noiDung",label:"Nội dung tổ chức",type:"textarea"},{name:"theLe",label:"Thể lệ",type:"textarea",optional:true},{name:"tieuChiCham",label:"Tiêu chí chấm",optional:true},
        {name:"hinhThucThi",label:"Hình thức",options:[{value:"Cá nhân",label:"Cá nhân"},{value:"Theo đội",label:"Theo đội"}]},{name:"thoiGianBatDau",label:"Bắt đầu",type:"datetime-local"},{name:"thoiGianKetThuc",label:"Kết thúc",type:"datetime-local"},{name:"hanDangKy",label:"Hạn đăng ký",type:"datetime-local",optional:true},{name:"diaDiem",label:"Địa điểm"},{name:"diemRenLuyen",label:"Điểm rèn luyện trình CTSV",type:"number"}
      ]} onSave={v => act(`/detailed-plans/${detailId}`,"PUT",v)} />}
      <div className={s.businessActions}>{canEdit && selected.MaKHToChuc ? <button disabled={busy} onClick={() => void act(`/detailed-plans/${detailId}/submit`)}>Trình khoa ký</button> : null}
        {canSign && ["Chờ khoa ký","Chờ CTSV ký"].includes(status) && <>{["approve","request_changes","reject"].map((action,i) => <button key={action} disabled={busy} onClick={() => void act(`/detailed-plans/${detailId}/review`,"PATCH",{action})}>{["Ký duyệt","Yêu cầu bổ sung","Từ chối"][i]}</button>)}</>}
        {isStaff && status === "Đã duyệt" && !selected.CongBoLuc && <button disabled={busy} onClick={() => void act(`/detailed-plans/${detailId}/publish`)}>Ban tổ chức công bố, mở đăng ký</button>}</div>
    </section>}
    {!detailed && selected && competition && <section className={s.card}><h2>{text(competition,"TenCuocThi")}</h2>
      {Boolean(selected.canOrganize) && <><ActionForm title="Tạo vòng thi" busy={busy} fields={[{name:"tenVong",label:"Tên vòng"},{name:"thuTu",label:"Thứ tự",type:"number"},{name:"batDauLuc",label:"Bắt đầu",type:"datetime-local"},{name:"ketThucLuc",label:"Kết thúc",type:"datetime-local"},{name:"hanNopBai",label:"Hạn nộp",type:"datetime-local"}]} onSave={v => act(`${base}/${competition.MaCThi}/rounds`,"POST",v)} />
      <ActionForm title="Tạo giải thưởng" busy={busy} fields={[{name:"tenGT",label:"Tên giải"},{name:"tienThuong",label:"Tiền thưởng",type:"number"},{name:"slGiai",label:"Số giải",type:"number"}]} onSave={v => act(`${base}/${competition.MaCThi}/awards`,"POST",v)} />
      <ActionForm title="Lập kết quả từ bài đã chấm" busy={busy} fields={[{name:"maBai",label:"Mã bài đã chấm đầy đủ",type:"number"},{name:"maGT",label:"Giải thưởng",options:options(rows(selected.awards),"MaGT","TenGT")},{name:"xepHang",label:"Xếp hạng",type:"number"}]} onSave={v => act(`${base}/${competition.MaCThi}/results`,"POST",v)} /></>}
      <h3>Các vòng thi</h3>{rows(selected.rounds).map(r => <p key={text(r,"MaVong")}>{text(r,"TenVong")} · {text(r,"TrangThai")} · {date(r.BatDauLuc)} <button onClick={() => void openRound(text(r,"MaVong"))}>Mở vòng</button></p>)}
      <h3>Kết quả và giải thưởng</h3>{rows(selected.results).map(r => <p key={text(r,"MaKQ")}>{text(r,"HoTen") || text(r,"TenDoi")} · {text(r,"TenGiaiThuong")} · Hạng {text(r,"XepHang")} · Điểm {text(r,"Diem")} · {text(r,"TrangThai")}{Boolean(selected.canOrganize) && r.TrangThai === "Dự thảo" && <button disabled={busy} onClick={() => void act(`/competition-workflow/results/${r.MaKQ}/publish`)}>Công bố trao giải</button>}</p>)}
    </section>}
    {!detailed && round && currentRound && <section className={s.card}><h2>{text(currentRound,"TenVong")}</h2><p>{text(currentRound,"TrangThai")} · Hạn nộp: {date(currentRound.HanNopBai)}</p>
      {Boolean(round.canOrganize) && <><ActionForm title="Phân công ra đề / chấm thi" busy={busy} fields={[{name:"maTK",label:"Giảng viên",options:options(rows(selected?.staff),"MaTK","HoTen")},{name:"vaiTro",label:"Nhiệm vụ",options:[{value:"RA_DE",label:"Ra đề"},{value:"CHAM_THI",label:"Chấm thi"}]}]} onSave={v => act(`${roundPath}/assignments`,"POST",v)} />
      <button disabled={busy} onClick={() => void act(`${roundPath}/status`,"PATCH",{trangThai:currentRound.TrangThai === "Chưa mở" ? "Đang mở" : "Đã đóng"})}>{currentRound.TrangThai === "Chưa mở" ? "Mở vòng thi" : "Đóng vòng thi"}</button></>}
      <p>{rows(round.assignments).map(a => `${text(a,"HoTen")}: ${a.VaiTro === "RA_DE" ? "Ra đề" : "Chấm thi"}`).join(" · ")}</p>
      {Boolean(round.canSetExam) && <ActionForm title="Lưu đề thi" busy={busy} fields={[{name:"noiDung",label:"Nội dung đề thi",type:"textarea"},{name:"urlTep",label:"Đường dẫn tệp đề (https)",type:"url",optional:true}]} onSave={v => act(`${roundPath}/exam`,"PUT",v)} />}
      {(Boolean(round.canOrganize) || Boolean(round.canSetExam)) && <button disabled={busy} onClick={() => void act(`${roundPath}/exam/release`)}>Phát hành đề thi</button>}
      {round.exam ? <article><h3>Đề thi</h3><p style={{whiteSpace:"pre-wrap"}}>{text(round.exam as Row,"NoiDung")}</p>{(round.exam as Row).UrlTep ? <a href={text(round.exam as Row,"UrlTep")} target="_blank" rel="noreferrer">Mở tệp đề thi</a> : null}</article> : <p>Đề thi chưa được mở cho tài khoản này.</p>}
      {user.roles.includes("SINHVIEN") && !round.participation && <ActionForm title="Đăng ký vòng thi" busy={busy} fields={rows(selected?.teams).length ? [{name:"maDoi",label:"Đội dự thi",options:options(rows(selected?.teams),"MaDoi","TenDoi")}] : []} onSave={v => act(`${roundPath}/register`,"POST",v)} />}
      {user.roles.includes("SINHVIEN") && Boolean(round.participation) && Boolean(round.isOpen) && <ActionForm title="Nộp bài dự thi" busy={busy} fields={[{name:"tieuDe",label:"Tên bài"},{name:"moTa",label:"Nội dung bài làm",type:"textarea"},{name:"urlTep",label:"Đường dẫn bài làm (https)",type:"url",optional:true}]} onSave={v => {const {urlTep,...body}=v;return act(`${roundPath}/submissions`,"POST",{...body,tepDinhKem:urlTep ? [urlTep] : []});}} />}
      <h3>Bài thi và điểm</h3>{rows(round.submissions).map(b => <article key={text(b,"MaBai")}><h4>#{text(b,"MaBai")} · {text(b,"TieuDe")} · {text(b,"HoTen") || text(b,"TenDoi")}</h4><p style={{whiteSpace:"pre-wrap"}}>{text(b,"MoTa")}</p><p>Điểm trung bình: {text(b,"DiemTrungBinh")} · {text(b,"SoLuotCham")} lượt chấm</p>{(() => {try {return (JSON.parse(text(b,"TepDinhKem") || "[]") as string[]).filter(u => /^https?:\/\//i.test(u)).map(u => <p key={u}><a href={u} target="_blank" rel="noreferrer">Mở tệp bài làm</a></p>);} catch {return null;}})()}{Boolean(round.canGrade) && <ActionForm title="Lưu điểm" busy={busy} fields={[{name:"diem",label:"Điểm (0–100)",type:"number"},{name:"nhanXet",label:"Nhận xét",optional:true}]} onSave={v => act(`/competition-workflow/submissions/${b.MaBai}/score`,"PATCH",v)} />}</article>)}
    </section>}
  </div>;
}
