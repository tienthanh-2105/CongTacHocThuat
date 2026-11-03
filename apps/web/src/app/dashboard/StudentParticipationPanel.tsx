"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { workflowRequest } from "@/services/workflow";
import NoticeDialog from "./NoticeDialog";
import s from "./dashboard.module.css";

type Row = Record<string, unknown>;
const text = (row: Row, key: string) => String(row[key] ?? "");
const date = (value: unknown) => value ? new Date(String(value)).toLocaleString("vi-VN") : "Chưa cập nhật";

export default function StudentParticipationPanel({ section }: { section: string }) {
  const [activities, setActivities] = useState<Row[]>([]);
  const [registrations, setRegistrations] = useState<Row[]>([]);
  const [points, setPoints] = useState<{ tongDiem: number; chiTiet: Row[] }>({ tongDiem: 0, chiTiet: [] });
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const work = section === "training-points"
      ? workflowRequest<typeof points>("/mobile/my-training-points").then(value => { if (active) setPoints(value); })
      : Promise.all([workflowRequest<Row[]>("/activities"), workflowRequest<Row[]>("/registrations/my-registrations")]).then(([list, mine]) => {
        if (active) { setActivities(list.filter(row => row.TrangThai === "Đã công bố")); setRegistrations(mine); }
      });
    void work.catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được dữ liệu"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [section]);
  async function submit(event: FormEvent<HTMLFormElement>, path: string, body: (data: FormData) => Row) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await workflowRequest<{ message?: string }>(path, { method: "POST", body: body(data) });
      setRegistrations(await workflowRequest<Row[]>("/registrations/my-registrations"));
      setNotice(response.message || "Đã đăng ký.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không đăng ký được"); }
    finally { setBusy(false); }
  }
  const activity = activities.find(row => text(row, "MaHD") === selected);
  const support = section === "support";
  return <div className={s.businessPanel}>
    {error && <NoticeDialog kind="error" message={error} onClose={() => setError("")} />}
    {notice && <NoticeDialog kind="success" message={notice} onClose={() => setNotice("")} />}
    {loading && <p role="status">Đang tải dữ liệu…</p>}
    {section === "training-points" ? <section className={s.card}>
      <h2>Điểm rèn luyện của tôi</h2><p>Điểm đã xác nhận: <strong>{points.tongDiem}</strong></p>
      <p>Điểm dự thi, tham dự, hỗ trợ và cổ vũ được ghi nhận theo kế hoạch đã có chữ ký CTSV. Các khoản chờ duyệt chưa được cộng vào tổng.</p>
      {!points.chiTiet.length && !loading && <p>Chưa có khoản điểm rèn luyện.</p>}
      <div className={s.planAssignmentTable}><table><thead><tr><th>Hoạt động</th><th>Năm học / Học kỳ</th><th>Điểm</th><th>Lý do</th><th>Trạng thái</th></tr></thead>
        <tbody>{points.chiTiet.map(row => <tr key={text(row, "MaDiem")}><td>{text(row, "TenHoatDong")}</td><td>{text(row, "NamHoc")} · {text(row, "HocKy")}</td><td>{text(row, "SoDiem")}</td><td>{text(row, "LyDo")}</td><td>{text(row, "TrangThai")}</td></tr>)}</tbody></table></div>
    </section> : <>
      <section className={s.card}><h2>{support ? "Đăng ký hỗ trợ và cổ vũ" : "Đăng ký dự thi / tham dự"}</h2>
        <label className={s.businessField}><span>Hoạt động đã công bố</span><select className={s.businessInput} aria-label="Hoạt động đã công bố" value={selected} onChange={event => setSelected(event.target.value)}>
          <option value="">Chọn hoạt động…</option>{activities.map(row => <option key={text(row, "MaHD")} value={text(row, "MaHD")}>{text(row, "TenHoatDong")}</option>)}
        </select></label>
        {!loading && !activities.length && <p>Chưa có hoạt động đã được công bố.</p>}
        {activity && <><p className={s.planTask}>{text(activity, "NoiDung")}</p><p>{text(activity, "DiaDiem")} · {date(activity.ThoiGianBatDau)} · Hạn đăng ký: {date(activity.HanDangKy)}</p>
          {(support || activity.HinhThucThi !== "Theo đội") && <form className={s.businessForm} onSubmit={event => void submit(event, "/registrations/individual", data => ({ maHD: Number(selected), hinhThuc: data.get("hinhThuc") }))}>
            <label className={s.businessField}><span>Hình thức tham gia</span><select className={s.businessInput} name="hinhThuc" aria-label="Hình thức tham gia">{(support ? ["Hỗ trợ", "Cổ vũ"] : activity.MaCThi ? ["Dự thi"] : ["Tham gia"]).map(value => <option key={value}>{value}</option>)}</select></label>
            <button className={s.primary} disabled={busy}>Đăng ký tham gia</button>
          </form>}
          {!support && Boolean(activity.MaCThi) && activity.HinhThucThi === "Theo đội" && <>
            <form className={s.businessForm} onSubmit={event => void submit(event, "/registrations/team", data => ({ maCThi: Number(activity.MaCThi), tenDoi: String(data.get("tenDoi")).trim(), thanhVienMSSV: String(data.get("thanhVien")).split(/[\s,;]+/).filter(Boolean) }))}>
              <h3>Đăng ký đội thi</h3><label className={s.businessField}><span>Tên đội</span><input className={s.businessInput} name="tenDoi" required minLength={2} maxLength={100} /></label>
              <label className={s.businessField}><span>MSSV thành viên, cách nhau bởi dấu phẩy (tối đa 4, không gồm bạn)</span><textarea className={s.businessInput} name="thanhVien" required rows={3} /></label>
              <button className={s.primary} disabled={busy}>Tạo đội và đăng ký dự thi</button>
            </form>
            <form className={s.businessForm} onSubmit={event => void submit(event, "/registrations/team/join", data => ({ maDoi: Number(data.get("maDoi")) }))}>
              <h3>Tham gia đội đã có</h3><label className={s.businessField}><span>Mã đội do trưởng đội cung cấp</span><input className={s.businessInput} name="maDoi" type="number" min={1} step={1} required /></label>
              <button className={s.secondaryButton} disabled={busy}>Tham gia đội</button>
            </form>
          </>}
          {!support && Boolean(activity.MaCThi) && <p>Sau khi đăng ký dự thi, mở <Link href="/dashboard/competitions">Tổ chức cuộc thi</Link> để đăng ký từng vòng và nộp bài.</p>}
        </>}
      </section>
      <section className={s.card}><h2>Đăng ký của tôi</h2>{!registrations.length && !loading && <p>Bạn chưa đăng ký hoạt động nào.</p>}
        <div className={s.businessList}>{registrations.map(row => <article key={text(row, "MaDK")}><div><strong>{text(row, "TenHoatDong")}</strong><p>{text(row, "HinhThuc")} · {text(row, "TenDoi")} · {text(row, "TrangThai")} · {date(row.NgayDK)}</p></div></article>)}</div>
      </section>
    </>}
  </div>;
}
