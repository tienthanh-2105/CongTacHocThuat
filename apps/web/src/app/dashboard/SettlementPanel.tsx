"use client";
import { useEffect, useState, type FormEvent } from "react";
import { workflowRequest } from "@/services/workflow";
import type { AuthUser } from "@/services/auth";
import { ActivityBudgetTable } from "./BusinessPanel";
import NoticeDialog from "./NoticeDialog";
import s from "./dashboard.module.css";
type Row = Record<string, unknown>;
type Detail = { settlement: Row | null; expenses: Row[]; totalAmount: number };
type ExpenseDraft = { id: number; expenseId?: string; maKPHD: string; hangMucDuTru: string; noiDung: string; ngChi: string; soLuong: string; donViTinh: string; soTien: string; thuyetMinh: string; chungTu: string; tenTepChungTu: string[]; saved?: boolean };
const emptyExpenseDraft = (id: number): ExpenseDraft => ({id,maKPHD:"",hangMucDuTru:"",noiDung:"",ngChi:"",soLuong:"1",donViTinh:"",soTien:"",thuyetMinh:"",chungTu:"",tenTepChungTu:[]});
const text = (row: Row, key: string) => String(row[key] ?? "");
const normalizeAcademicYear = (value: string) => value.trim().replace(/\s*[-–—]\s*/g, " - ");
const money = (value: unknown) => Number(value || 0).toLocaleString("vi-VN",{style:"currency",currency:"VND"});
const expenseTotal = (row: ExpenseDraft) => {
  const quantity = Number(row.soLuong);
  const unitPrice = Number(row.soTien);
  return unitPrice > 0 && quantity > 0 ? Math.round(unitPrice * quantity * 100) / 100 : 0;
};
const links = (value: unknown): string[] => { try {const parsed=typeof value==='string'?JSON.parse(value):value; return Array.isArray(parsed)?parsed.filter(item=>typeof item==='string'&&(/^(https?:\/\/|data:image\/|data:application\/pdf;base64,)/i.test(item))):[];} catch {return [];} };
export default function SettlementPanel({user, onOpenSettlementList}: {user: AuthUser; onOpenSettlementList?: (activity: { id: string; name: string; academicYear: string }) => void}) {
  const [activities,setActivities] = useState<Row[]>([]); const [selected,setSelected] = useState("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [detail,setDetail] = useState<Detail | null>(null); const [busy,setBusy] = useState(false); const [loading,setLoading] = useState(true);
  const [error,setError] = useState(""); const [notice,setNotice] = useState("");
  const [expenseRows,setExpenseRows] = useState<ExpenseDraft[]>([emptyExpenseDraft(0)]); const [nextExpenseId,setNextExpenseId] = useState(1);
  const [editingExistingExpenses, setEditingExistingExpenses] = useState(false);
  const [categoryMenuRow, setCategoryMenuRow] = useState<number | null>(null);
  const [budgetLines,setBudgetLines] = useState<Row[]>([]);
  const [unspent,setUnspent] = useState<string[]>([]);
  useEffect(()=>{let active=true;void workflowRequest<Row[]>("/settlements/activities").then(value=>{if(active)setActivities(value);})
    .catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Không tải được hoạt động");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  async function select(id: string) {setSelected(id);setDetail(null);setError("");setExpenseRows([emptyExpenseDraft(0)]);setNextExpenseId(1);setEditingExistingExpenses(false);setBudgetLines([]);setUnspent([]);if(!id)return;setBusy(true);try{const [settlement,lines]=await Promise.all([workflowRequest<Detail>(`/settlements/${id}`),workflowRequest<Row[]>("/academic-activities/budgets")]);setDetail(settlement);setBudgetLines(lines.filter(line=>text(line,"MaHD")===id));}catch(cause){setError(cause instanceof Error?cause.message:"Không tải được quyết toán");}finally{setBusy(false);}}
  function selectAcademicYear(year: string) {
    setSelectedAcademicYear(year);
    if (selected && year && normalizeAcademicYear(text(activities.find(item => text(item, "MaHD") === selected) ?? {}, "NamHoc")) !== year) {
      void select("");
    }
  }
  async function act(path: string, method: string, body: Row) {setBusy(true);setError("");setNotice("");try{await workflowRequest(path,{method,body});setDetail(await workflowRequest<Detail>(`/settlements/${selected}`));setNotice("Đã cập nhật hồ sơ quyết toán.");return true;}catch(cause){setError(cause instanceof Error?cause.message:"Không cập nhật được hồ sơ");return false;}finally{setBusy(false);}}
  function updateExpenseRow(id: number, updates: Partial<ExpenseDraft>) {setExpenseRows(current=>current.map(row=>row.id===id?{...row,...updates,saved:false}:row));}
  function updateBudgetCategory(id: number, value: string) {
    const matchedLine = budgetLines.find(line => text(line, "NoiDung").trim().toLocaleLowerCase("vi") === value.trim().toLocaleLowerCase("vi"));
    updateExpenseRow(id, { hangMucDuTru: value, maKPHD: matchedLine ? text(matchedLine, "MaKPHD") : "" });
  }
  function addExpenseRow() {setExpenseRows(current=>[...current,emptyExpenseDraft(nextExpenseId)]);setNextExpenseId(id=>id+1);}
  function expenseDraftFromRecord(item: Row, id: number): ExpenseDraft {
    return {
      id,
      expenseId: text(item, "MaCP"),
      maKPHD: text(item, "MaKPHD"),
      hangMucDuTru: text(item, "HangMucDuTru") || text(budgetLines.find(line => text(line, "MaKPHD") === text(item, "MaKPHD")) ?? {}, "NoiDung"),
      noiDung: text(item, "NoiDung"),
      ngChi: text(item, "NgChi").slice(0, 10),
      soLuong: text(item, "SoLuong") || "1",
      donViTinh: text(item, "DonViTinh"),
      soTien: String(Number(item.SoTien) / (Number(item.SoLuong) || 1)),
      thuyetMinh: text(item, "ThuyetMinh"),
      chungTu: links(item.ChungTu).join("\n"),
      tenTepChungTu: links(item.ChungTu).filter(value => /^data:/i.test(value)).map((_, index) => `Tệp đã lưu ${index + 1}`),
    };
  }
  function editAllExpenses() {
    if (!detail?.expenses.length) return;
    const drafts = detail.expenses.map((item, index) => expenseDraftFromRecord(item, nextExpenseId + index));
    setExpenseRows(drafts);
    setNextExpenseId(id => id + drafts.length);
    setEditingExistingExpenses(true);
    setNotice("Đang chỉnh sửa các khoản chi. Lưu để cập nhật hồ sơ.");
  }
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError("");setNotice("");
    try {
      for(const [index,row] of expenseRows.entries()) {
        if(row.saved)continue;
        try {
          await workflowRequest(row.expenseId?`/expenses/${row.expenseId}`:"/expenses",{method:row.expenseId?"PATCH":"POST",body:{maHD:Number(selected),maKPHD:row.maKPHD?Number(row.maKPHD):undefined,hangMucDuTru:row.hangMucDuTru,noiDung:row.noiDung,soLuong:row.soLuong?Number(row.soLuong):undefined,donViTinh:row.donViTinh||undefined,soTien:expenseTotal(row),ngChi:row.ngChi,thuyetMinh:row.thuyetMinh,chungTu:row.chungTu.split('\n').map(item=>item.trim()).filter(Boolean)}});
          setExpenseRows(current=>current.map(item=>item.id===row.id?{...item,saved:true}:item));
        } catch(cause) {
          setError(`Không lưu được dòng ${index+1}: ${cause instanceof Error?cause.message:"Không cập nhật được khoản chi"} Các dòng đã lưu được giữ lại; bấm lưu lại để tiếp tục.`);
          return;
        }
      }
      setDetail(await workflowRequest<Detail>(`/settlements/${selected}`));
      setExpenseRows([emptyExpenseDraft(nextExpenseId)]);
      setNextExpenseId(id=>id+1);
      setEditingExistingExpenses(false);
      setNotice("Đã lưu các khoản chi thực tế.");
    } catch(cause) {setError(cause instanceof Error?cause.message:"Không tải lại được hồ sơ quyết toán.");}
    finally {setBusy(false);}
  }
  const header=detail?.settlement; const activity=activities.find(item=>text(item,"MaHD")===selected);
  const filteredActivities = selectedAcademicYear
    ? activities.filter(item => normalizeAcademicYear(text(item, "NamHoc")) === selectedAcademicYear)
    : activities;
  const academicYears = [...new Set(activities.map(item => normalizeAcademicYear(text(item, "NamHoc"))).filter(Boolean))];
  const canRecord=user.roles.some(role=>["ADMIN","CANBOKHOA","GIANGVIEN"].includes(role));
  const canSubmit=header && text(header,"NguoiLap")===user.id && header.TrangThai==="Dự thảo";
  const canApprove=header?.TrangThai==="Chờ duyệt" && user.roles.some(role=>["ADMIN","CANBOKHOA","TRUONGKHOA"].includes(role));
  const canEditExpense = canRecord && header?.TrangThai === "Dự thảo" && text(header ?? {}, "NguoiLap") === user.id;
  const expenseRecorderNames = [...new Set((detail?.expenses ?? []).map(expense => text(expense, "TenNguoiGhi")).filter(Boolean))].join(", ") || "—";
  return <div className={s.businessPanel}>
    {error&&<NoticeDialog kind="error" message={error} onClose={()=>setError("")}/>}{notice&&<NoticeDialog kind="success" message={notice} onClose={()=>setNotice("")}/>}
    <section className={s.card}>
      <div className={s.settlementActivityFilters}>
        <label className={s.businessField}>
          <span>Hoạt động quyết toán</span>
          <select className={s.businessInput} aria-label="Hoạt động quyết toán"
            value={selected} disabled={busy} onChange={event => void select(event.target.value)}>
            <option value="">Chọn hoạt động…</option>
            {filteredActivities.map(item => <option key={text(item, "MaHD")} value={text(item, "MaHD")}>
              {text(item, "TenHoatDong")}
            </option>)}
          </select>
        </label>
        <label className={s.businessField}>
          <span>Năm học</span>
          <select className={s.businessInput} aria-label="Năm học" value={selectedAcademicYear}
            disabled={busy} onChange={event => selectAcademicYear(event.target.value)}>
            <option value="">Tất cả năm học</option>
            {academicYears.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
      </div>
      {loading&&<p role="status">Đang tải hoạt động…</p>}{!loading&&!activities.length&&<p>Chưa có hoạt động để ghi nhận chi phí.</p>}
    </section>
    {detail&&<section className={s.card}><h2 className={s.settlementTitle}>{activity?text(activity,"TenHoatDong"):"Hồ sơ quyết toán"}</h2>
      <p className={s.settlementSummary}>
        <strong>Kinh phí dự trù: <span>{money(activity?.KinhPhiDuTru)}</span></strong>
        <strong>Tổng chi thực tế: <span>{money(detail.totalAmount)}</span></strong>
      </p>
      {header?<p>Hồ sơ #{text(header,"MaHS")} · {text(header,"TrangThai")} · Người lập: {text(header,"TenNguoiLap")} · Người duyệt: {text(header,"TenNguoiDuyet")||"Chưa duyệt"}</p>:<p><em>Chưa có hồ sơ quyết toán. Thêm khoản chi đầu tiên để lập hồ sơ.</em></p>}
      {activity&&Number(detail.totalAmount)>Number(activity.KinhPhiDuTru||0)&&<p role="status">Chi thực tế đang vượt dự trù {money(Number(detail.totalAmount)-Number(activity.KinhPhiDuTru||0))}.</p>}
      {budgetLines.length > 0 && <div className={s.budgetTableWrap}>
        <ActivityBudgetTable activityId={selected} items={budgetLines} caption="Bảng Dự trù kinh phí" />
      </div>}
      <div className={s.planAssignmentTable}><table className={s.settlementTable}>
        <colgroup>
          <col className={s.settlementIndexColumn} /><col className={s.settlementContentColumn} />
          <col className={s.settlementDateColumn} /><col className={s.settlementExplanationColumn} />
          <col className={s.settlementMoneyColumn} />
        </colgroup>
        <caption className={s.settlementTableCaption}>Bảng Kinh phí thực tế</caption>
        <thead><tr>
          <th scope="col">STT</th>
          <th scope="col">Nội dung thực thi</th>
          <th scope="col" className={s.settlementDateCell}>Ngày chi</th>
          <th scope="col">Thuyết minh</th>
          <th scope="col" className={s.settlementAmountCell}>Số tiền thực chi</th>
        </tr></thead>
        <tbody>{detail.expenses.map((expense, index) => {
          return <tr key={text(expense, "MaCP")}>
            <td>{index + 1}</td>
            <td>
              <div className={s.planTask}>{text(expense, "NoiDung")}</div>
            </td>
            <td className={s.settlementDateCell}>{new Date(text(expense, "NgChi")).toLocaleDateString("vi-VN")}</td>
            <td>{text(expense, "ThuyetMinh") || "—"}</td>
            <td className={s.settlementAmountCell}>{money(expense.SoTien)}</td>
          </tr>;
        })}</tbody>
        <tfoot><tr className={s.settlementTotalsRow}>
          <td>Người ghi</td>
          <td>{expenseRecorderNames}</td>
          <td colSpan={2}>Tổng cộng</td>
          <td className={s.settlementAmountCell}>{money(detail.totalAmount)}</td>
        </tr></tfoot>
      </table></div>{!detail.expenses.length&&<p>Chưa có khoản chi.</p>}
      <div className={s.businessActions}>{canEditExpense&&<button type="button" className={s.secondaryButton} disabled={busy||!detail.expenses.length||editingExistingExpenses} onClick={editAllExpenses}>{editingExistingExpenses?"Đang chỉnh sửa":"Chỉnh sửa"}</button>}{editingExistingExpenses&&<button type="submit" form="settlement-expense-entry-form" className={s.primary} disabled={busy}>Lưu thay đổi</button>}{canSubmit&&<button className={s.primary} disabled={busy||!detail.expenses.length||editingExistingExpenses} onClick={async()=>{if(await act(`/settlements/${header.MaHS}/submit`,"POST",{}))onOpenSettlementList?.({id:selected,name:text(activity??{},"TenHoatDong"),academicYear:text(activity??{},"NamHoc")});}}>Lập báo cáo quyết toán</button>}
        {canApprove&&<button className={s.primary} disabled={busy} onClick={()=>void act(`/settlements/${header.MaHS}/approve`,"PATCH",{})}>Duyệt hồ sơ quyết toán</button>}</div>
      {canRecord&&(!header||header.TrangThai==="Dự thảo"||header.TrangThai==="Đã duyệt")&&<form id="settlement-expense-entry-form" className={s.expenseEntryForm} onSubmit={add}>
        <h3>Ghi nhận khoản chi thực tế</h3>
        {expenseRows.map((row, index) => {
          const rowNumber = index + 1;
          const disabled = busy || row.saved;
          const receiptValues = row.chungTu.split("\n").filter(Boolean);
          const uploadedReceipts = receiptValues.filter(value => /^data:/i.test(value));
          const receiptLinks = receiptValues.filter(value => !/^data:/i.test(value));
          return <fieldset key={row.id} className={s.expenseEntry} spellCheck={false}>
            <legend>Khoản chi {rowNumber} {row.saved && <small className={s.expenseSaved}>Đã lưu</small>}</legend>
            <div className={s.expenseEntryFields}>
              <label className={s.businessField}>
                <span>Hạng mục dự trù <b className={s.requiredMark} aria-hidden="true">*</b></span>
                <div className={s.expenseCategoryControl}>
                  <input aria-label={`Hạng mục dự trù dòng ${rowNumber}`} className={s.businessInput} role="combobox"
                    aria-autocomplete="list" aria-expanded={categoryMenuRow === row.id}
                    aria-controls={`settlement-budget-items-${row.id}`} autoComplete="off"
                    value={row.hangMucDuTru} disabled={disabled} required minLength={2} maxLength={500}
                    onFocus={() => setCategoryMenuRow(row.id)}
                    onBlur={() => window.setTimeout(() => setCategoryMenuRow(current => current === row.id ? null : current), 100)}
                    onChange={event => { updateBudgetCategory(row.id, event.target.value); setCategoryMenuRow(row.id); }}
                    onKeyDown={event => { if (event.key === "Escape") setCategoryMenuRow(null); }}
                    placeholder="Nhập hoặc chọn hạng mục dự trù…" />
                  <button type="button" className={s.expenseCategoryToggle} aria-label="Hiện danh sách hạng mục dự trù"
                    aria-expanded={categoryMenuRow === row.id} onMouseDown={event => event.preventDefault()}
                    onClick={() => setCategoryMenuRow(current => current === row.id ? null : row.id)} />
                  {categoryMenuRow === row.id && <div id={`settlement-budget-items-${row.id}`} className={s.expenseCategorySuggestions} role="listbox">
                    {budgetLines
                      .filter(line => text(line, "NoiDung").toLocaleLowerCase("vi").includes(row.hangMucDuTru.trim().toLocaleLowerCase("vi")))
                      .slice(0, 30)
                      .map(line => <button type="button" key={text(line, "MaKPHD")} className={s.expenseCategorySuggestion} role="option"
                        aria-selected={row.maKPHD === text(line, "MaKPHD")}
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => { updateBudgetCategory(row.id, text(line, "NoiDung")); setCategoryMenuRow(null); }}>
                        {text(line, "NoiDung")}
                      </button>)}
                    {!budgetLines.some(line => text(line, "NoiDung").toLocaleLowerCase("vi").includes(row.hangMucDuTru.trim().toLocaleLowerCase("vi"))) &&
                      <div className={s.expenseCategoryNoMatch}>Không có gợi ý phù hợp · sẽ lưu hạng mục bạn nhập</div>}
                  </div>}
                </div>
              </label>
              <label className={s.businessField}>
                <span>Nội dung thực chi <b className={s.requiredMark} aria-hidden="true">*</b></span>
                <textarea aria-label={`Nội dung thực chi dòng ${rowNumber}`} className={s.businessInput} spellCheck={false}
                  value={row.noiDung} disabled={disabled} onChange={event => updateExpenseRow(row.id, { noiDung: event.target.value })}
                  required minLength={2} maxLength={2000} rows={1} placeholder="Mô tả khoản chi…" />
              </label>
              <label className={s.businessField}>
                <span>Ngày chi <b className={s.requiredMark} aria-hidden="true">*</b></span>
                <input aria-label={`Ngày chi dòng ${rowNumber}`} className={s.businessInput} type="date"
                  value={row.ngChi} disabled={disabled} onChange={event => updateExpenseRow(row.id, { ngChi: event.target.value })} required />
              </label>
            </div>
            <div className={s.expenseEntryDetails}>
              <label className={s.businessField}>
                <span>Số lượng <b className={s.requiredMark} aria-hidden="true">*</b></span>
                <input aria-label={`Số lượng dòng ${rowNumber}`} className={s.businessInput} type="number"
                  value={row.soLuong} disabled={disabled} onChange={event => updateExpenseRow(row.id, { soLuong: event.target.value })}
                  required min="0.01" step="0.01" placeholder="Số lượng" />
              </label>
              <label className={s.businessField}>
                <span>Đơn vị tính</span>
                <input aria-label={`Đơn vị tính dòng ${rowNumber}`} className={s.businessInput}
                  value={row.donViTinh} disabled={disabled} onChange={event => updateExpenseRow(row.id, { donViTinh: event.target.value })}
                  maxLength={50} placeholder="cái, suất…" />
              </label>
              <label className={s.businessField}>
                <span>Đơn giá <b className={s.requiredMark} aria-hidden="true">*</b></span>
                <input aria-label={`Đơn giá dòng ${rowNumber}`} className={s.businessInput} type="number"
                  value={row.soTien} disabled={disabled} onChange={event => updateExpenseRow(row.id, { soTien: event.target.value })}
                  required min={0.01} step="any" placeholder="Đơn giá" />
              </label>
              <label className={s.businessField}>
                <span>Số tiền</span>
                <input aria-label={`Số tiền dòng ${rowNumber}`} className={s.businessInput} type="text"
                  value={row.soTien ? money(expenseTotal(row)) : ""} readOnly placeholder="Tự tính" />
              </label>
              <label className={s.businessField}>
                <span>Thuyết minh</span>
                <textarea aria-label={`Thuyết minh dòng ${rowNumber}`} className={s.businessInput} spellCheck={false}
                  value={row.thuyetMinh} disabled={disabled} onChange={event => updateExpenseRow(row.id, { thuyetMinh: event.target.value })}
                  maxLength={500} rows={1} placeholder="Mục đích, căn cứ hoặc cách tính…" />
              </label>
              <div className={`${s.businessField} ${s.expenseReceiptField}`}>
                <span>Hồ sơ chứng từ</span>
                <div className={s.expenseReceiptFields}>
                    <label className={s.expenseFilePicker}>
                      <input aria-label={`Chọn tệp chứng từ dòng ${rowNumber}`} type="file" accept="image/*,application/pdf"
                        disabled={disabled} onChange={event => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            setError("Chứng từ phải nhỏ hơn 5 MB.");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => updateExpenseRow(row.id, {
                            chungTu: [...row.chungTu.split('\n').filter(Boolean), String(reader.result)].join('\n'),
                            tenTepChungTu: [...row.tenTepChungTu, file.name],
                          });
                          reader.readAsDataURL(file);
                        }} />
                      <span>Chọn tệp</span>
                    </label>
                    <input aria-label={`Tên tệp chứng từ dòng ${rowNumber}`} className={s.businessInput} type="text"
                      value={row.tenTepChungTu.join(", ")} readOnly placeholder="Tên tệp sẽ hiển thị ở đây" />
                    <textarea aria-label={`Đường dẫn chứng từ dòng ${rowNumber}`} className={s.businessInput}
                      value={receiptLinks.join("\n")} disabled={disabled} onChange={event => {
                        const updatedLinks = event.target.value.split("\n").map(value => value.trim()).filter(value => value && !/^data:/i.test(value));
                        updateExpenseRow(row.id, { chungTu: [...uploadedReceipts, ...updatedLinks].join("\n") });
                      }} rows={1} placeholder="Nhập URL chứng từ" />
                    <button type="button" className={s.expenseReceiptClear} disabled={disabled || !row.chungTu.trim()}
                      onClick={event => {
                        updateExpenseRow(row.id, { chungTu: "", tenTepChungTu: [] });
                        const fileInput = event.currentTarget.closest("fieldset")?.querySelector<HTMLInputElement>('input[type="file"]');
                        if (fileInput) fileInput.value = "";
                      }}>
                      Xóa chứng từ
                    </button>
                </div>
              </div>
            </div>
          </fieldset>;
        })}
        <button type="button" className={s.expenseAddLineButton} disabled={busy} onClick={addExpenseRow}>＋ Thêm dòng</button>
        <button className={s.primary} disabled={busy}>{busy?"Đang lưu…":editingExistingExpenses?"Lưu thay đổi":"Lưu khoản chi"}</button>
      </form>}
    </section>}
  </div>;
}
