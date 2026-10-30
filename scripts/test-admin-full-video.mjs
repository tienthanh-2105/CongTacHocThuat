import { chromium } from "@playwright/test";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const baseUrl = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const apiUrl = (process.env.E2E_API_URL || "http://localhost:3001/api/v1").replace(/\/$/, "");
const accountsFile = resolve(process.env.E2E_ACCOUNTS_FILE || "artifacts/test-video/accounts.json");
const chromePath = process.env.CHROME_EXECUTABLE || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputDir = resolve("artifacts", "test-video");

let configuredAccounts;
try {
  configuredAccounts = JSON.parse(await readFile(accountsFile, "utf8"));
} catch {
  console.error("Không đọc được tệp tài khoản test cục bộ. Hãy điền artifacts/test-video/accounts.json.");
  process.exit(2);
}
const admin = Array.isArray(configuredAccounts)
  ? configuredAccounts.find((item) => typeof item?.role === "string"
    && /admin|quản trị/i.test(item.role)
    && typeof item.username === "string"
    && item.username.trim()
    && typeof item.password === "string"
    && item.password)
  : null;
if (!admin) {
  console.error("Tệp tài khoản chưa có mục Quản trị viên với username và password.");
  process.exit(2);
}

await mkdir(outputDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = resolve(outputDir, "admin-report-" + stamp + ".json");
const videoPath = resolve(outputDir, "admin-test-" + stamp + ".webm");
const browser = await chromium.launch({ headless: false, executablePath: chromePath });
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  recordVideo: { dir: outputDir, size: { width: 1600, height: 900 } },
});
const page = await context.newPage();
const nav = page.getByRole("navigation", { name: "Chức năng hệ thống" });
const sectionButton = (id) => nav.locator('[data-section-id="' + id + '"]');
const failures = [];
const steps = [];
const created = { classId: null, className: null, studentId: null, studentNumber: null, staffId: null };
const testTag = new Date().toISOString().replace(/\D/g, "").slice(2, 14);
const report = {
  scope: "Quản trị viên",
  baseUrl,
  startedAt: new Date().toISOString(),
  sections: [],
  steps,
  testData: {},
  failures,
};

page.on("pageerror", (error) => failures.push({ type: "pageerror", message: error.message }));
page.on("response", (response) => {
  if (response.status() >= 500) {
    let pathname = response.url();
    try { pathname = new URL(response.url()).pathname; } catch {}
    failures.push({ type: "http-5xx", status: response.status(), path: pathname });
  }
});

function note(name, result, details) {
  const item = { name, result };
  if (details) item.details = details;
  steps.push(item);
  console.log("[" + result.toUpperCase() + "] " + name + (details ? " — " + details : ""));
}

async function waitReady() {
  await nav.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForLoadState("networkidle", { timeout: 4500 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function goToSection(id) {
  let button = sectionButton(id);
  if (await button.count() !== 1) {
    const parents = {
      "student-profiles": "users",
      "staff-profiles": "users",
      classes: "users",
      "academic-steering": "academic-activities",
      "academic-organizing": "academic-activities",
      "academic-support": "academic-activities",
    };
    const parent = parents[id] || await nav.locator('button[data-section-id="' + id + '"]').getAttribute("data-section-parent").catch(() => null);
    if (parent) {
      await sectionButton(parent).click();
      await waitReady();
    }
    button = sectionButton(id);
  }
  if (await button.count() !== 1) throw new Error("Không thấy mục menu " + id);
  await button.click();
  await waitReady();
}

async function waitResponse(method, suffix) {
  const response = await page.waitForResponse((candidate) => {
    if (candidate.request().method() !== method) return false;
    try { return new URL(candidate.url()).pathname.endsWith(suffix); } catch { return false; }
  }, { timeout: 25000 });
  if (!response.ok()) {
    throw new Error(method + " " + suffix + " trả HTTP " + response.status());
  }
  return response;
}

async function visitSection(id) {
  const before = failures.length;
  await goToSection(id);
  const body = await page.locator("body").innerText().catch(() => "");
  if (/Internal server error|Không thể kết nối máy chủ/i.test(body)) {
    failures.push({ type: "visible-server-error", sectionId: id });
  }
  const result = failures.length === before ? "opened" : "review";
  report.sections.push({ id, result });
  console.log("[ADMIN] " + id + ": " + result);
}

async function sweepAdminSections() {
  const topLevelIds = await nav.locator("button[data-section-id]").evaluateAll((buttons) =>
    buttons.filter((button) => !button.getAttribute("data-section-parent"))
      .map((button) => button.getAttribute("data-section-id")).filter(Boolean));
  if (topLevelIds.length < 10) throw new Error("Menu Quản trị viên không tải đủ các phân hệ.");
  for (const id of topLevelIds) {
    await visitSection(id);
    const childIds = await nav.locator('button[data-section-parent="' + id + '"]')
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-section-id")).filter(Boolean));
    for (const childId of childIds) await visitSection(childId);
  }
  note("Mở lần lượt tất cả phân hệ được cấp cho Quản trị viên", "passed", report.sections.length + " mục");
}

async function testRoleMatrix() {
  await goToSection("users");
  await page.getByRole("button", { name: "Cấu hình", exact: true }).click();
  const modal = page.locator('[class*="modalOverlay"]').last();
  await modal.getByRole("heading", { name: /Ma trận Vai trò/ }).waitFor({ state: "visible" });
  await modal.getByRole("button", { name: "Đã hiểu" }).click();
  note("Mở và đóng ma trận vai trò", "passed");
}

async function createAndEditClass() {
  await goToSection("classes");
  await page.getByRole("button", { name: "Tạo lớp mới" }).click();
  const modal = page.locator('[class*="modalOverlay"]').last();
  const facultySelect = modal.locator("label").filter({ hasText: "Khoa / Đơn vị trực thuộc" }).locator("select");
  await facultySelect.waitFor({ state: "visible" });
  if (await facultySelect.locator("option").count() < 2) throw new Error("Không có khoa để tạo lớp test.");
  await facultySelect.selectOption({ index: 1 });
  const className = "TEST-ADMIN-" + testTag;
  const editedClassName = className + "-EDIT";
  created.className = className;
  await modal.locator("input").first().fill(className);
  await modal.locator("input").nth(1).fill("2099-2103");
  const createResponsePromise = waitResponse("POST", "/admin/accounts/classes");
  await modal.getByRole("button", { name: "Tạo lớp học" }).click();
  const createResponse = await createResponsePromise;
  const classResult = await createResponse.json();
  created.classId = Number(classResult.maLop);
  if (!created.classId) throw new Error("API chưa trả mã lớp sau khi tạo lớp test.");
  await page.locator('[class*="modernTable"] tbody tr').filter({ hasText: className }).waitFor({ state: "visible" });
  const classRow = page.locator('[class*="modernTable"] tbody tr').filter({ hasText: className });
  await classRow.getByTitle("Chỉnh sửa lớp học").click();
  const editModal = page.locator('[class*="modalOverlay"]').last();
  await editModal.getByRole("heading", { name: "Chỉnh sửa lớp học" }).waitFor({ state: "visible" });
  await editModal.locator("input").first().fill(editedClassName);
  const updateResponsePromise = waitResponse("PATCH", "/admin/accounts/classes/" + created.classId);
  await editModal.getByRole("button", { name: "Cập nhật" }).click();
  await updateResponsePromise;
  await page.locator('[class*="modernTable"] tbody tr').filter({ hasText: editedClassName }).waitFor({ state: "visible" });
  created.className = editedClassName;
  note("Tạo và cập nhật lớp test", "passed", editedClassName);
}

async function createEditGrantStudent() {
  await goToSection("student-profiles");
  await page.getByRole("button", { name: "Thêm sinh viên" }).click();
  const modal = page.locator('[class*="modalOverlay"]').last();
  await modal.getByRole("heading", { name: "Thêm mới hồ sơ sinh viên" }).waitFor({ state: "visible" });
  const mssv = "2099" + String(Date.now() % 1000000).padStart(6, "0");
  const studentName = "TEST-Quản trị " + testTag;
  const editedStudentName = studentName + " Đã sửa";
  const studentEmail = "test-admin-" + testTag + "@example.invalid";
  created.studentNumber = mssv;
  report.testData.studentNumber = mssv;
  await modal.getByLabel(/Họ và tên sinh viên/).fill(studentName);
  await modal.getByLabel(/Mã số sinh viên/).fill(mssv);
  const classSelect = modal.locator("label").filter({ hasText: "Lớp sinh hoạt" }).locator("select");
  await classSelect.selectOption(String(created.classId));
  await modal.getByLabel("Email", { exact: true }).fill(studentEmail);
  const createResponsePromise = waitResponse("POST", "/admin/accounts/student-profiles");
  await modal.getByRole("button", { name: "Thêm hồ sơ sinh viên" }).click();
  const createResponse = await createResponsePromise;
  const studentResult = await createResponse.json();
  created.studentId = Number(studentResult.MaSV);
  if (!created.studentId) throw new Error("API chưa trả mã hồ sơ sinh viên test.");
  await page.getByPlaceholder("Tìm theo MSSV, họ tên, lớp, email...").fill(mssv);
  let row = page.locator('[class*="modernTable"] tbody tr').filter({ hasText: mssv });
  await row.waitFor({ state: "visible" });
  await row.getByTitle("Chỉnh sửa hồ sơ").click();
  const editModal = page.locator('[class*="modalOverlay"]').last();
  await editModal.getByRole("heading", { name: "Chỉnh sửa hồ sơ sinh viên" }).waitFor({ state: "visible" });
  await editModal.getByLabel(/Họ và tên sinh viên/).fill(editedStudentName);
  const updateResponsePromise = waitResponse("PATCH", "/admin/accounts/student-records/" + created.studentId);
  await editModal.getByRole("button", { name: "Lưu thay đổi" }).click();
  await updateResponsePromise;
  await page.locator('[class*="modernTable"] tbody tr').filter({ hasText: editedStudentName }).waitFor({ state: "visible" });

  row = page.locator('[class*="modernTable"] tbody tr').filter({ hasText: mssv });
  await row.getByTitle("Cấp tài khoản đăng nhập").click();
  const grantModal = page.locator('[class*="modalOverlay"]').last();
  await grantModal.getByRole("heading", { name: "Cấp tài khoản đăng nhập" }).waitFor({ state: "visible" });
  const newPassword = "TEST-Admin-" + testTag + "!A";
  await grantModal.getByPlaceholder("ví dụ: 2001220001").fill(mssv);
  await grantModal.getByPlaceholder("Nhập mật khẩu (tối thiểu 6 ký tự)").fill(newPassword);
  await grantModal.getByPlaceholder("Nhập lại mật khẩu để xác nhận").fill(newPassword);
  const accountResponsePromise = waitResponse("POST", "/admin/accounts/student-records/" + created.studentId + "/account");
  await grantModal.getByRole("button", { name: "Xác nhận cấp tài khoản" }).click();
  await accountResponsePromise;
  await page.getByText(mssv, { exact: true }).first().waitFor({ state: "visible" });
  note("Tạo, cập nhật hồ sơ sinh viên và cấp tài khoản", "passed", "MSSV test " + mssv);
  return { studentName: editedStudentName, newPassword };
}

async function testAccountManagement(username, displayName) {
  await goToSection("users");
  const serverAccount = await page.evaluate(async (input) => {
    const response = await fetch(input.api + "/admin/accounts", { credentials: "include", cache: "no-store" });
    const accounts = response.ok ? await response.json() : [];
    return {
      status: response.status,
      found: Array.isArray(accounts) && accounts.some((account) => String(account.TenDangNhap) === input.username),
    };
  }, { api: apiUrl, username });
  report.testData.accountFoundInAdminApi = serverAccount.found;
  if (serverAccount.status !== 200 || !serverAccount.found) {
    throw new Error("Tài khoản sinh viên test không xuất hiện trong API danh sách quản trị.");
  }
  await page.getByPlaceholder("Tìm theo họ tên, email, vai trò, bộ môn/lớp...").fill(username);
  let row = page.locator('[class*="modernTable"] tbody tr').filter({ hasText: displayName });
  await row.waitFor({ state: "visible" });
  await row.getByTitle("Đặt lại mật khẩu").click();
  const modal = page.locator('[class*="modalOverlay"]').last();
  await modal.getByRole("heading", { name: /Đặt lại mật khẩu/ }).waitFor({ state: "visible" });
  const resetPassword = "TEST-Reset-" + testTag + "!B";
  await modal.getByPlaceholder("Nhập mật khẩu mới...").fill(resetPassword);
  const fallbackResetPromise = page.waitForResponse((response) =>
    response.request().method() === "PATCH" && /\/admin\/accounts\/\d+\/password$/.test(new URL(response.url()).pathname),
  { timeout: 25000 });
  await modal.getByRole("button", { name: "Xác nhận", exact: true }).click();
  const resetResponse = await fallbackResetPromise;
  if (!resetResponse.ok()) throw new Error("Đặt lại mật khẩu tài khoản test thất bại.");

  row = page.locator('[class*="modernTable"] tbody tr').filter({ hasText: displayName });
  const lockResponsePromise = waitResponse("PATCH", "/status");
  await row.getByTitle("Khóa tài khoản").click();
  const lockResponse = await lockResponsePromise;
  if (!/\/admin\/accounts\/\d+\/status$/.test(new URL(lockResponse.url()).pathname)) {
    throw new Error("Không xác nhận được API khóa tài khoản.");
  }
  row = page.locator('[class*="modernTable"] tbody tr').filter({ hasText: displayName });
  await row.getByTitle("Kích hoạt tài khoản").waitFor({ state: "visible" });
  const activateResponsePromise = waitResponse("PATCH", "/status");
  await row.getByTitle("Kích hoạt tài khoản").click();
  const activateResponse = await activateResponsePromise;
  if (!/\/admin\/accounts\/\d+\/status$/.test(new URL(activateResponse.url()).pathname)) {
    throw new Error("Không xác nhận được API kích hoạt tài khoản.");
  }
  await row.getByTitle("Khóa tài khoản").waitFor({ state: "visible" });
  note("Tìm tài khoản, đặt lại mật khẩu, khóa rồi kích hoạt lại", "passed", "Tài khoản test " + username);
}

async function createDeleteStaff() {
  await goToSection("staff-profiles");
  await page.getByRole("button", { name: "Thêm cán bộ / giảng viên" }).click();
  const modal = page.locator('[class*="modalOverlay"]').last();
  await modal.getByRole("heading", { name: "Thêm mới hồ sơ cán bộ" }).waitFor({ state: "visible" });
  const staffName = "TEST-Quản trị cán bộ " + testTag;
  const email = "test-admin-staff-" + testTag + "@example.invalid";
  await modal.getByLabel(/Họ và tên/).fill(staffName);
  await modal.getByLabel(/Học hàm \/ Học vị/).fill("Thạc sĩ");
  await modal.getByLabel(/Chức vụ/).fill("Giảng viên");
  await modal.getByLabel("Email liên hệ").fill(email);
  const departmentCheckbox = modal.locator('input[type="checkbox"]').first();
  await departmentCheckbox.waitFor({ state: "visible" });
  await departmentCheckbox.check();
  const createResponsePromise = waitResponse("POST", "/admin/accounts/staff-records");
  await modal.getByRole("button", { name: "Thêm cán bộ / giảng viên" }).click();
  const createResponse = await createResponsePromise;
  const staffResult = await createResponse.json();
  created.staffId = Number(staffResult.maNgDung);
  if (!created.staffId) throw new Error("API chưa trả mã hồ sơ cán bộ test.");
  await page.getByPlaceholder("Tìm theo họ tên, chức vụ, bộ môn...").fill(staffName);
  let row = page.locator('[class*="modernTable"] tbody tr').filter({ hasText: staffName });
  await row.waitFor({ state: "visible" });
  await row.getByTitle("Xóa hồ sơ").click();
  const deleteModal = page.locator('[class*="modalOverlay"]').last();
  const deleteResponsePromise = waitResponse("DELETE", "/admin/accounts/staff-records/" + created.staffId);
  await deleteModal.getByRole("button", { name: "Xóa vĩnh viễn" }).click();
  await deleteResponsePromise;
  created.staffId = null;
  note("Tạo và xóa hồ sơ cán bộ test", "passed", "Email test " + email);
}

async function deleteTestStudentAndClass() {
  if (created.studentId) {
    await goToSection("student-profiles");
    await page.getByPlaceholder("Tìm theo MSSV, họ tên, lớp, email...").fill(created.studentNumber || "");
    const row = page.locator('[class*="modernTable"] tbody tr').filter({ hasText: created.studentNumber || "" });
    if (await row.count()) {
      await row.getByTitle("Xóa hồ sơ").click();
      const modal = page.locator('[class*="modalOverlay"]').last();
      const deleteResponsePromise = waitResponse("DELETE", "/admin/accounts/student-records/" + created.studentId);
      await modal.getByRole("button", { name: "Xóa vĩnh viễn" }).click();
      await deleteResponsePromise;
      created.studentId = null;
      note("Dọn hồ sơ và tài khoản TEST- đã tạo", "passed");
    }
  }
  if (created.classId) {
    await goToSection("classes");
    const search = page.getByPlaceholder("Tìm theo tên lớp, khoa, khóa học...");
    await search.fill(created.className || "");
    const row = page.locator('[class*="modernTable"] tbody tr').filter({ hasText: created.className || "" });
    if (await row.count()) {
      await row.getByTitle("Xóa lớp học").click();
      const modal = page.locator('[class*="modalOverlay"]').last();
      const deleteResponsePromise = waitResponse("DELETE", "/admin/accounts/classes/" + created.classId);
      await modal.getByRole("button", { name: "Xác nhận xóa" }).click();
      await deleteResponsePromise;
      created.classId = null;
      note("Dọn lớp TEST- đã tạo", "passed");
    }
  }
}

async function cleanupViaApi() {
  const results = [];
  if (created.studentId) {
    const result = await page.evaluate(async (input) => {
      const response = await fetch(input.api + "/admin/accounts/student-records/" + input.id, {
        method: "DELETE", credentials: "include",
      });
      return { ok: response.ok, status: response.status };
    }, { api: apiUrl, id: created.studentId }).catch(() => ({ ok: false, status: 0 }));
    results.push({ target: "test-student", ...result });
    if (result.ok) created.studentId = null;
  }
  if (created.staffId) {
    const result = await page.evaluate(async (input) => {
      const response = await fetch(input.api + "/admin/accounts/staff-records/" + input.id, {
        method: "DELETE", credentials: "include",
      });
      return { ok: response.ok, status: response.status };
    }, { api: apiUrl, id: created.staffId }).catch(() => ({ ok: false, status: 0 }));
    results.push({ target: "test-staff", ...result });
    if (result.ok) created.staffId = null;
  }
  if (created.classId) {
    const result = await page.evaluate(async (input) => {
      const response = await fetch(input.api + "/admin/accounts/classes/" + input.id, {
        method: "DELETE", credentials: "include",
      });
      return { ok: response.ok, status: response.status };
    }, { api: apiUrl, id: created.classId }).catch(() => ({ ok: false, status: 0 }));
    results.push({ target: "test-class", ...result });
    if (result.ok) created.classId = null;
  }
  if (results.length) {
    report.cleanup = results;
    if (results.some((item) => !item.ok)) failures.push({ type: "cleanup-incomplete", results });
  }
}

try {
  await page.goto(baseUrl + "/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Tên đăng nhập").fill(admin.username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(admin.password);
  const loginResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/auth/login"),
  { timeout: 20000 });
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  const loginResponse = await loginResponsePromise;
  if (!loginResponse.ok()) throw new Error("Đăng nhập tài khoản Quản trị viên thất bại (HTTP " + loginResponse.status() + ").");
  await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 15000 });
  await waitReady();
  note("Đăng nhập Quản trị viên", "passed");

  await sweepAdminSections();
  await testRoleMatrix();

  try {
    await createAndEditClass();
  } catch (error) {
    note("Tạo/sửa lớp test", "failed", error instanceof Error ? error.message : String(error));
    failures.push({ type: "class-crud", message: error instanceof Error ? error.message : String(error) });
  }

  let accountInfo = null;
  if (created.classId) {
    try {
      accountInfo = await createEditGrantStudent();
    } catch (error) {
      note("Tạo/sửa hồ sơ và cấp tài khoản sinh viên test", "failed", error instanceof Error ? error.message : String(error));
      failures.push({ type: "student-crud", message: error instanceof Error ? error.message : String(error) });
    }
  }

  if (created.studentId && created.studentNumber) {
    try {
      await testAccountManagement(created.studentNumber, accountInfo?.studentName || "");
    } catch (error) {
      note("Quản lý tài khoản test", "failed", error instanceof Error ? error.message : String(error));
      failures.push({ type: "account-management", message: error instanceof Error ? error.message : String(error) });
    }
  }

  try {
    await createDeleteStaff();
  } catch (error) {
    note("Tạo/xóa hồ sơ cán bộ test", "failed", error instanceof Error ? error.message : String(error));
    failures.push({ type: "staff-crud", message: error instanceof Error ? error.message : String(error) });
  }

  if (created.studentId || created.classId) {
    try {
      await deleteTestStudentAndClass();
    } catch (error) {
      note("Dọn dữ liệu lớp/sinh viên TEST-", "failed", error instanceof Error ? error.message : String(error));
      failures.push({ type: "cleanup-ui", message: error instanceof Error ? error.message : String(error) });
    }
  }

  if (accountInfo && failures.length === 0) note("Toàn bộ luồng tài khoản test hoàn tất", "passed");
} catch (error) {
  failures.push({ type: "automation-error", message: error instanceof Error ? error.message : String(error) });
  console.error("Kiểm thử tự động dừng: " + (error instanceof Error ? error.message : String(error)));
} finally {
  await cleanupViaApi();
  report.finishedAt = new Date().toISOString();
  report.failureCount = failures.length;
  report.status = failures.length ? "failed" : "passed";
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const source = await video.path();
    await rename(source, videoPath);
    console.log("Video: " + videoPath);
  }
  console.log("Báo cáo: " + reportPath);
  console.log("Kết quả: " + report.status + " (" + failures.length + " lỗi)");
}

if (failures.length) process.exitCode = 1;
