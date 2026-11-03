"use client";
import { useEffect, useState, type FormEvent } from "react";
import { workflowRequest } from "@/services/workflow";
import type { AuthUser } from "@/services/auth";
import NoticeDialog from "./NoticeDialog";
import s from "./dashboard.module.css";
type Row = Record<string, unknown>;
type Detail = { settlement: Row | null; expenses: Row[]; totalAmount: number };
const text = (row: Row, key: string) => String(row[key] ?? "");
const money = (value: unknown) => Number(value || 0).toLocaleString("vi-VN",{style:"currency",currency:"VND"});
const links = (value: unknown): string[] => { try {const parsed=typeof value==='string'?JSON.parse(value):value; return Array.isArray(parsed)?parsed.filter(item=>typeof item==='string'&&/^https?:\/\//i.test(item)):[];} catch {return [];} };
export default function SettlementPanel({user}: {user: AuthUser}) {
  const [activities,setActivities] = useState<Row[]>([]); const [selected,setSelected] = useState("");
  const [detail,setDetail] = useState<Detail | null>(null); const [busy,setBusy] = useState(false); const [loading,setLoading] = useState(true);
  const [error,setError] = useState(""); const [notice,setNotice] = useState("");
  useEffect(()=>{let active=true;void workflowRequest<Row[]>("/academic-activities").then(value=>{if(active)setActivities(value);})
    .catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Không tải được hoạt động");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  async function select(id: string) {setSelected(id);setDetail(null);setError("");if(!id)return;setBusy(true);try{setDetail(await workflowRequest<Detail>(`/settlements/${id}`));}catch(cause){setError(cause instanceof Error?cause.message:"Không tải được quyết toán");}finally{setBusy(false);}}
  async function act(path: string, method: string, body: Row) {setBusy(true);setError("");setNotice("");try{await workflowRequest(path,{method,body});setDetail(await workflowRequest<Detail>(`/settlements/${selected}`));setNotice("Đã cập nhật hồ sơ quyết toán.");}catch(cause){setError(cause instanceof Error?cause.message:"Không cập nhật được hồ sơ");}finally{setBusy(false);}}
  function add(event: FormEvent<HTMLFormElement>) {event.preventDefault();const data=new FormData(event.currentTarget);void act("/expenses","POST",{maHD:Number(selected),noiDung:data.get("noiDung"),soTien:Number(data.get("soTien")),ngChi:data.get("ngChi"),chungTu:String(data.get("chungTu")??"").split('\n').map(item=>item.trim()).filter(Boolean)});}
  const header=detail?.settlement; const activity=activities.find(item=>text(item,"MaHD")===selected);
  const canRecord=user.roles.some(role=>["ADMIN","CANBOKHOA","GIANGVIEN"].includes(role));
  const canSubmit=header && text(header,"NguoiLap")===user.id && header.TrangThai==="Dự thảo";
  const canApprove=header?.TrangThai==="Chờ duyệt" && user.roles.some(role=>["ADMIN","CANBOKHOA"].includes(role));
  return <div className={s.businessPanel}>
    {error&&<NoticeDialog kind="error" message={error} onClose={()=>setError("")}/>}{notice&&<NoticeDialog kind="success" message={notice} onClose={()=>setNotice("")}/>}
    <section className={s.card}><h2>Chi phí thực tế và hồ sơ quyết toán</h2>
      <label className={s.businessField}><span>Hoạt động quyết toán</span><select className={s.businessInput} aria-label="Hoạt động quyết toán" value={selected} disabled={busy} onChange={event=>void select(event.target.value)}>
        <option value="">Chọn hoạt động…</option>{activities.map(item=><option key={text(item,"MaHD")} value={text(item,"MaHD")}>{text(item,"TenHoatDong")} · {text(item,"NamHoc")}</option>)}
      </select></label>{loading&&<p role="status">Đang tải hoạt động…</p>}{!loading&&!activities.length&&<p>Chưa có hoạt động để ghi nhận chi phí.</p>}
    </section>
    {detail&&<section className={s.card}><h2>{activity?text(activity,"TenHoatDong"):"Hồ sơ quyết toán"}</h2>
      <p>Kinh phí dự trù: <strong>{money(activity?.KinhPhiDuTru)}</strong> · Tổng chi thực tế: <strong>{money(detail.totalAmount)}</strong></p>
      {header?<p>Hồ sơ #{text(header,"MaHS")} · {text(header,"TrangThai")} · Người lập: {text(header,"TenNguoiLap")} · Người duyệt: {text(header,"TenNguoiDuyet")||"Chưa duyệt"}</p>:<p>Chưa có hồ sơ quyết toán. Thêm khoản chi đầu tiên để lập hồ sơ.</p>}
      {activity&&Number(detail.totalAmount)>Number(activity.KinhPhiDuTru||0)&&<p role="status">Chi thực tế đang vượt dự trù {money(Number(detail.totalAmount)-Number(activity.KinhPhiDuTru||0))}.</p>}
      <div className={s.planAssignmentTable}><table><thead><tr><th>Nội dung chi</th><th>Ngày chi</th><th>Số tiền</th><th>Người ghi</th><th>Chứng từ</th></tr></thead>
        <tbody>{detail.expenses.map(item=><tr key={text(item,"MaCP")}><td className={s.planTask}>{text(item,"NoiDung")}</td><td>{new Date(text(item,"NgChi")).toLocaleDateString("vi-VN")}</td><td>{money(item.SoTien)}</td><td>{text(item,"TenNguoiGhi")}</td><td>{links(item.ChungTu).map(url=><p key={url}><a href={url} target="_blank" rel="noreferrer">Mở chứng từ</a></p>)}</td></tr>)}</tbody>
      </table></div>{!detail.expenses.length&&<p>Chưa có khoản chi.</p>}
      <div className={s.businessActions}>{canSubmit&&<button className={s.primary} disabled={busy||!detail.expenses.length} onClick={()=>void act(`/settlements/${header.MaHS}/submit`,"POST",{})}>Gửi hồ sơ quyết toán</button>}
        {canApprove&&<button className={s.primary} disabled={busy} onClick={()=>void act(`/settlements/${header.MaHS}/approve`,"PATCH",{})}>Duyệt hồ sơ quyết toán</button>}</div>
      {canRecord&&(!header||header.TrangThai==="Dự thảo"||header.TrangThai==="Đã duyệt")&&<form className={s.businessForm} onSubmit={add}><h3>Ghi nhận khoản chi thực tế</h3>
        <label className={s.businessField}><span>Nội dung chi</span><textarea className={s.businessInput} name="noiDung" required minLength={2} maxLength={2000} rows={3}/></label>
        <label className={s.businessField}><span>Số tiền (VND)</span><input className={s.businessInput} name="soTien" type="number" required min={0.01} step={0.01}/></label>
        <label className={s.businessField}><span>Ngày chi</span><input className={s.businessInput} name="ngChi" type="date" required/></label>
        <label className={s.businessField}><span>Đường dẫn chứng từ (mỗi dòng một tệp)</span><textarea className={s.businessInput} name="chungTu" rows={3}/></label>
        <button className={s.primary} disabled={busy}>Lưu khoản chi</button>
      </form>}
    </section>}
  </div>;
}
