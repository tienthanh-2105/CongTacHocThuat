import { chromium } from "@playwright/test";
import { mkdir, access } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";

const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3000";
const chromePath = process.env.CHROME_EXECUTABLE || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const videoDir = resolve("artifacts", "test-video");

await access(chromePath).catch(() => {
  throw new Error(`Không tìm thấy Chrome tại ${chromePath}. Đặt biến CHROME_EXECUTABLE tới chrome.exe rồi chạy lại.`);
});
await mkdir(videoDir, { recursive: true });

const browser = await chromium.launch({ headless: false, executablePath: chromePath });
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  recordVideo: { dir: videoDir, size: { width: 1600, height: 900 } },
});
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.bringToFront();
  stdout.write(`Đang ghi video kiểm thử tại ${baseUrl}.\n`);
  stdout.write("Đăng nhập bằng tài khoản TEST, chạy lần lượt các chức năng và đổi vai trò khi cần.\n");
  stdout.write("Dùng checklist docs/testing/huong-dan-test-thu-cong.md để không bỏ sót luồng.\n");
  stdout.write("Khi hoàn tất, quay lại terminal này và nhấn Enter để lưu video.\n");
  const prompt = createInterface({ input: stdin, output: stdout });
  await prompt.question("Nhấn Enter sau khi đã hoàn tất kiểm thử: ");
  prompt.close();
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) stdout.write(`Đã lưu video: ${await video.path()}\n`);
}
