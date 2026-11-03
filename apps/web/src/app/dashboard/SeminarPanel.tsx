"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { workflowRequest } from "@/services/workflow";
import type { AuthUser } from "@/services/auth";
import NoticeDialog from "./NoticeDialog";
import s from "./dashboard.module.css";
type Row = Record<string, unknown>;
const text = (row: Row, key: string) => String(row[key] ?? "");
const array = (value: unknown): Row[] => { try { const result = typeof value === "string" ? JSON.parse(value) : value; return Array.isArray(result) ? result : []; } catch { return []; } };
const read = () => Promise.all([workflowRequest<Row[]>("/seminars"),workflowRequest<Row[]>("/news/activities")]);
export default function SeminarPanel({ user }: { user: AuthUser }) {
  const [list,setList] = useState<Row[]>([]); const [managed,setManaged] = useState<Row[]>([]);
  const [selected,setSelected] = useState(""); const [error,setError] = useState(""); const [notice,setNotice] = useState("");
  const [loading,setLoading] = useState(true); const [busy,setBusy] = useState(false);
  useEffect(() => { let active = true; void read().then(([items,choices]) => { if (active) { setList(items); setManaged(choices); } })
    .catch(cause => { if(active) setError(cause instanceof Error ? cause.message : "Không tải được seminar"); }).finally(() => { if(active) setLoading(false); });
    return () => {active=false;}; }, []);
  const seminar = list.find(item => text(item,"MaSeminar") === selected);
  const canManage = Boolean(seminar && managed.some(item => Number(item.MaHD) === Number(seminar.MaHD)));
  async function act(path: string, method: string, body: Row) {
    setBusy(true); setError(""); setNotice("");
    try { await workflowRequest(path,{method,body}); const [items,choices] = await read(); setList(items); setManaged(choices); setNotice("Đã lưu thông tin seminar."); }
    catch(cause) { setError(cause instanceof Error ? cause.message : "Không thực hiện được thao tác"); } finally {setBusy(false);}
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const speakers = String(data.get("dienGia") ?? "").split('\n').map(line => line.trim()).filter(Boolean).map(hoTen => ({
      ...array(seminar?.DienGia).find(speaker => text(speaker,"hoTen") === hoTen), hoTen,
    }));
    const agenda = String(data.get("chuongTrinh") ?? "").split('\n').filter(line => line.trim()).map(line => {
      const [thoiGian,noiDung,phuTrach] = line.split('|').map(value => value.trim()); return {thoiGian,noiDung,phuTrach:phuTrach || undefined};
    });
    if (agenda.some(item => !item.thoiGian || !item.noiDung)) {setError("Mỗi dòng chương trình cần có thời gian và nội dung, ngăn cách bởi dấu |.");return;}
    void act(`/seminars/${selected}`,"PATCH",{dvChuTri:data.get("dvChuTri"),dvPhoiHop:data.get("dvPhoiHop"),thoiLuong:data.get("thoiLuong") ? Number(data.get("thoiLuong")) : undefined,dienGia:speakers,chuongTrinh:agenda});
  }
  return <div className={s.businessPanel}>
    {error && <NoticeDialog kind="error" message={error} onClose={() => setError("")} />}{notice && <NoticeDialog kind="success" message={notice} onClose={() => setNotice("")} />}
    <section className={s.card}><h2>Seminar học thuật</h2>
      {!user.roles.includes("SINHVIEN") && <p>Lập seminar mới từ <Link href="/dashboard/academic-activities">Hoạt động học thuật</Link>, dự trù kinh phí và <Link href="/dashboard/detailed-plans">Kế hoạch tổ chức</Link> để trình khoa, CTSV ký trước khi công bố.</p>}
      {loading ? <p role="status">Đang tải seminar…</p> : !list.length && <p>Chưa có seminar.</p>}
      <div className={s.businessList}>{list.filter(item => item.TrangThai === "Đã công bố" || managed.some(choice => Number(choice.MaHD) === Number(item.MaHD))).map(item => <article key={text(item,"MaSeminar")}>
        <div><strong>{text(item,"ChuDe")}</strong><p>{item.ThoiGianBatDau ? new Date(text(item,"ThoiGianBatDau")).toLocaleString("vi-VN") : text(item,"TgDuKien")} · {text(item,"DiaDiem")}</p></div>
        <button className={s.secondaryButton} disabled={busy} onClick={() => setSelected(text(item,"MaSeminar"))}>Xem seminar</button>
      </article>)}</div>
    </section>
    {seminar && <section className={s.card}><h2>{text(seminar,"ChuDe")}</h2><p className={s.planTask}>{text(seminar,"NoiDung") || text(seminar,"MoTa")}</p>
      <p>Chủ trì: {text(seminar,"DVChuTri") || "Chưa cập nhật"} · Phối hợp: {text(seminar,"DVPhoiHop") || "Chưa cập nhật"} · Thời lượng: {text(seminar,"ThoiLuong") || "Chưa cập nhật"} phút</p>
      <h3>Diễn giả</h3>{array(seminar.DienGia).length ? array(seminar.DienGia).map((speaker,index) => <p key={index}>{text(speaker,"hoTen")} · {text(speaker,"donVi")}</p>) : <p>Chưa cập nhật diễn giả.</p>}
      <h3>Chương trình</h3>{array(seminar.ChuongTrinh).length ? array(seminar.ChuongTrinh).map((item,index) => <p key={index}>{text(item,"thoiGian")} · {text(item,"noiDung")} · {text(item,"phuTrach")}</p>) : <p>Chưa cập nhật chương trình.</p>}
      <h3>Tài liệu</h3>{array(seminar.TaiLieu).filter(item => /^https?:\/\//i.test(text(item,"UrlTep"))).map(item => <p key={text(item,"MaTep")}><a href={text(item,"UrlTep")} target="_blank" rel="noreferrer">{text(item,"TenTep")}</a></p>)}
      {user.roles.includes("SINHVIEN") && <button className={s.primary} disabled={busy} onClick={() => void act(`/seminars/${selected}/register`,"POST",{})}>Đăng ký tham dự seminar</button>}
      {canManage && <><form className={s.businessForm} key={selected} onSubmit={save}><h3>Cập nhật thông tin bổ sung</h3>
        <label className={s.businessField}><span>Đơn vị chủ trì</span><input className={s.businessInput} name="dvChuTri" maxLength={200} defaultValue={text(seminar,"DVChuTri")} /></label>
        <label className={s.businessField}><span>Đơn vị phối hợp</span><input className={s.businessInput} name="dvPhoiHop" maxLength={200} defaultValue={text(seminar,"DVPhoiHop")} /></label>
        <label className={s.businessField}><span>Thời lượng (phút)</span><input className={s.businessInput} name="thoiLuong" type="number" min={1} max={1440} defaultValue={text(seminar,"ThoiLuong")} /></label>
        <label className={s.businessField}><span>Diễn giả (mỗi người một dòng)</span><textarea className={s.businessInput} name="dienGia" rows={4} defaultValue={array(seminar.DienGia).map(item => text(item,"hoTen")).join('\n')} /></label>
        <label className={s.businessField}><span>Chương trình (mỗi dòng: thời gian | nội dung | phụ trách)</span><textarea className={s.businessInput} name="chuongTrinh" rows={5} defaultValue={array(seminar.ChuongTrinh).map(item => [text(item,"thoiGian"),text(item,"noiDung"),text(item,"phuTrach")].join(' | ')).join('\n')} /></label>
        <button className={s.primary} disabled={busy}>Lưu thông tin seminar</button>
      </form><form className={s.businessForm} onSubmit={event => {event.preventDefault();const data=new FormData(event.currentTarget);void act(`/seminars/${selected}/materials`,"POST",{tenTep:data.get("tenTep"),urlTep:data.get("urlTep"),loaiTep:data.get("loaiTep")});}}>
        <h3>Thêm tài liệu</h3><label className={s.businessField}><span>Tên tài liệu</span><input className={s.businessInput} name="tenTep" required maxLength={250} /></label>
        <label className={s.businessField}><span>Đường dẫn tài liệu</span><input className={s.businessInput} name="urlTep" type="url" required pattern="https?://.*" /></label>
        <label className={s.businessField}><span>Loại tài liệu</span><input className={s.businessInput} name="loaiTep" maxLength={80} /></label><button className={s.primary} disabled={busy}>Lưu tài liệu</button>
      </form></>}
    </section>}
  </div>;
}
