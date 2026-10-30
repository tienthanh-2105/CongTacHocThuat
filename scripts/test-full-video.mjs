import { chromium } from "@playwright/test";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const baseUrl = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const accountsFile = resolve(process.env.E2E_ACCOUNTS_FILE || "artifacts/test-video/accounts.json");
const chromePath = process.env.CHROME_EXECUTABLE || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputDir = resolve("artifacts", "test-video");

let accounts;
try {
  accounts = JSON.parse(await readFile(accountsFile, "utf8"));
} catch {
  console.error(`Chưa đọc được danh sách tài khoản kiểm thử: ${accountsFile}`);
  console.error("Sao chép docs/testing/test-accounts.example.json thành artifacts/test-video/accounts.json rồi điền tài khoản test tại máy của bạn.");
  process.exit(2);
}
if (!Array.isArray(accounts) || accounts.length === 0) {
  console.error("Tệp tài khoản phải là mảng gồm role, username và password; không gửi tệp này lên Git hoặc qua chat.");
  process.exit(2);
}
const skippedRoles = accounts
  .filter((account) => !account || typeof account.role !== "string" || typeof account.username !== "string" || typeof account.password !== "string" || !account.role.trim() || !account.username.trim() || !account.password)
  .map((account) => typeof account?.role === "string" && account.role.trim() ? account.role.trim() : "Vai trò chưa đặt tên");
accounts = accounts.filter((account) => account && typeof account.role === "string" && typeof account.username === "string" && typeof account.password === "string" && account.role.trim() && account.username.trim() && account.password);
if (!accounts.length) {
  console.error("Chưa có tài khoản nào đủ role, username và password trong tệp cấu hình.");
  process.exit(2);
}
if (skippedRoles.length) console.log(`Bỏ qua ${skippedRoles.length} vai trò chưa điền đủ tài khoản.`);

await mkdir(outputDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = resolve(outputDir, `report-${stamp}.json`);
const browser = await chromium.launch({ headless: false, executablePath: chromePath });
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  recordVideo: { dir: outputDir, size: { width: 1600, height: 900 } },
});
const page = await context.newPage();
const failures = [];
const report = { baseUrl, startedAt: new Date().toISOString(), skippedRoles, accounts: [], failures };

page.on("pageerror", (error) => failures.push({ type: "pageerror", message: error.message }));
page.on("response", (response) => {
  if (response.status() >= 500) {
    const url = new URL(response.url());
    failures.push({ type: "http-5xx", status: response.status(), url: `${url.origin}${url.pathname}` });
  }
});

const nav = page.getByRole("navigation", { name: "Chức năng hệ thống" });
const sectionButton = (id) => nav.locator(`[data-section-id="${id}"]`);

async function waitForSectionReady() {
  await nav.waitFor({ state: "visible", timeout: 12000 });
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function visitSection(id, role, visited) {
  const button = sectionButton(id);
  if (await button.count() !== 1) {
    failures.push({ type: "missing-section", role, sectionId: id });
    return;
  }
  const before = failures.length;
  await button.click();
  await waitForSectionReady();
  const sectionFailures = failures.slice(before);
  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (/Internal server error|Không thể kết nối máy chủ/i.test(bodyText)) {
    failures.push({ type: "visible-server-error", role, sectionId: id });
  }
  visited.push({ id, result: sectionFailures.length ? "error" : "opened" });
  console.log(`[${role}] ${id}: ${sectionFailures.length ? "có lỗi" : "đã mở"}`);
}

try {
  for (const account of accounts) {
    const visited = [];
    const failuresBeforeLogin = failures.length;
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Tên đăng nhập").fill(account.username);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(account.password);
    const loginResponsePromise = page.waitForResponse((response) =>
      response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/auth/login"),
      { timeout: 15000 },
    );
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    const loginResponse = await loginResponsePromise;
    if (!loginResponse.ok()) {
      const errorBody = await loginResponse.json().catch(() => null);
      const reason = typeof errorBody?.message === "string" ? errorBody.message : `HTTP ${loginResponse.status()}`;
      failures.push({ type: "login-failed", role: account.role, status: loginResponse.status(), reason: reason.slice(0, 240) });
      report.accounts.push({ role: account.role, testedSections: [], result: "login-failed" });
      console.log(`[${account.role}] đăng nhập không thành công (HTTP ${loginResponse.status()}); bỏ qua vai trò này.`);
      continue;
    }
    try {
      await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 12000 });
    } catch {
      failures.push({ type: "login-redirect-failed", role: account.role });
      report.accounts.push({ role: account.role, testedSections: [], result: "redirect-failed" });
      continue;
    }
    await nav.waitFor({ state: "visible", timeout: 15000 });

    const topLevelIds = await nav.locator("button[data-section-id]").evaluateAll((buttons) =>
      buttons.filter((button) => !button.getAttribute("data-section-parent")).map((button) => button.getAttribute("data-section-id")),
    );
    if (!topLevelIds.length) failures.push({ type: "empty-role-menu", role: account.role });

    for (const id of topLevelIds) {
      if (!id) continue;
      await visitSection(id, account.role, visited);
      const children = await nav.locator(`button[data-section-parent="${id}"]`).evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("data-section-id")),
      );
      for (const childId of children) {
        if (childId) await visitSection(childId, account.role, visited);
      }
    }

    report.accounts.push({
      role: account.role,
      testedSections: visited,
      result: failures.length === failuresBeforeLogin ? "passed" : "review",
    });

    await page.getByRole("button", { name: "Tài khoản của tôi" }).click();
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await page.getByLabel("Tên đăng nhập").waitFor({ state: "visible", timeout: 12000 });
  }
} catch (error) {
  failures.push({ type: "automation-error", message: error instanceof Error ? error.message : String(error) });
} finally {
  report.finishedAt = new Date().toISOString();
  report.status = failures.length ? "failed" : "passed";
  report.failureCount = failures.length;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const source = await video.path();
    const videoPath = resolve(outputDir, `full-test-${stamp}.webm`);
    await rename(source, videoPath);
    console.log(`Video: ${videoPath}`);
  }
  console.log(`Báo cáo: ${reportPath}`);
  console.log(`Kết quả: ${report.status} (${failures.length} lỗi)`);
}

if (failures.length) process.exitCode = 1;
