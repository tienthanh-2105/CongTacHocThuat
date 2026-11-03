// UI contract test with mocked API responses; does not write application data.
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const staff = [{ MaTK: 17, HoTen: 'Giảng viên kiểm thử A', TenBM: 'Hệ thống thông tin' }, { MaTK: 18, HoTen: 'Giảng viên kiểm thử B', TenBM: 'Khoa học máy tính' }];
let plan = { MaHD: 71, MaKHToChuc: 91, TenHoatDong: 'Cuộc thi học thuật kiểm thử', TenKeHoach: 'Kế hoạch tổ chức cuộc thi', TenKeHoachNam: 'Kế hoạch năm học 2030–2031', NamHoc: '2030-2031', TenBM: 'Hệ thống thông tin', TrangThai: 'Dự thảo', NoiDung: 'Tổ chức sơ loại và chung kết', ThoiGianBatDau: '2030-10-30T02:00:00Z', ThoiGianKetThuc: '2030-10-30T04:00:00Z', DiaDiem: 'Phòng máy', HinhThucThi: 'Cá nhân', DiemRenLuyen: 7, cacBan: [], staff, canEdit: true, canPublish: true };
let saved;
await page.route('**/auth/me', route => route.fulfill({ json: { user: { id: '17', username: 'ui-test', name: 'Giảng viên kiểm thử A', roles: ['GIANGVIEN'] } } }));
await page.route('**/api/v1/detailed-plans**', async route => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  if (request.method() === 'PUT') {
    saved = request.postDataJSON();
    plan = { ...plan, cacBan: saved.cacBan };
    return route.fulfill({ json: plan });
  }
  if (request.method() === 'POST' && path.endsWith('/submit')) {
    plan = { ...plan, TrangThai: 'Chờ khoa ký', canEdit: false };
    return route.fulfill({ json: plan });
  }
  return route.fulfill({ json: path.endsWith('/71') ? plan : [plan] });
});
try {
  await page.goto(`${process.env.E2E_BASE_URL || 'http://localhost:3100'}/dashboard/detailed-plans`);
  await page.getByRole('button', { name: 'Xem / xử lý' }).click();
  await page.getByRole('button', { name: '+ Ban tổ chức', exact: true }).click();
  const organizer = page.getByRole('group', { name: 'Ban tổ chức', exact: true });
  await organizer.getByRole('button', { name: 'Thêm giảng viên' }).click();
  await organizer.getByRole('combobox', { name: /^Giảng viên/ }).selectOption('17');
  await organizer.getByRole('combobox', { name: /^Vai trò/ }).selectOption('Trưởng ban');
  await organizer.getByLabel('Nhiệm vụ cụ thể').fill('Điều phối sơ loại và chung kết');
  await organizer.getByLabel('Hạn hoàn thành').fill('2030-10-29T17:00');
  await organizer.getByLabel('Kết quả cần bàn giao').fill('Biên bản tổ chức');
  await page.getByRole('button', { name: '+ Ban đề thi', exact: true }).click();
  const exam = page.getByRole('group', { name: 'Ban đề thi', exact: true });
  await exam.getByRole('button', { name: 'Thêm giảng viên' }).click();
  await exam.getByRole('combobox', { name: /^Giảng viên/ }).selectOption('18');
  await exam.getByLabel('Nhiệm vụ cụ thể').fill('Soạn đề cho hai vòng thi');
  await page.getByRole('button', { name: '+ Ban thư ký', exact: true }).click();
  const secretary = page.getByRole('group', { name: 'Ban thư ký', exact: true });
  await secretary.getByRole('button', { name: 'Thêm giảng viên' }).click();
  await secretary.getByRole('combobox', { name: /^Giảng viên/ }).selectOption('17');
  await secretary.getByLabel('Nhiệm vụ cụ thể').fill('Lưu bài, tổng hợp điểm và biên bản');
  await expect(page.getByRole('button', { name: 'Trình khoa ký', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Lưu kế hoạch chi tiết', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Trình khoa ký', exact: true })).toBeEnabled();
  expect(saved.cacBan).toHaveLength(3);
  expect(saved.cacBan[0].thanhVien[0]).toMatchObject({ maTK: 17, vaiTro: 'Trưởng ban', sanPham: 'Biên bản tổ chức' });
  expect(saved.cacBan[1].thanhVien[0].maTK).toBe(18);
  await mkdir(resolve('artifacts/test-video'), { recursive: true });
  await page.screenshot({ path: resolve('artifacts/test-video/plan-committees-editor.png'), fullPage: true });
  await page.getByRole('button', { name: 'Trình khoa ký', exact: true }).click();
  await expect(page.getByRole('table')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Lưu kế hoạch chi tiết', exact: true })).toHaveCount(0);
  await expect(page.getByText('Điều phối sơ loại và chung kết', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').first().getByText('Giảng viên kiểm thử A')).toBeVisible();
  const closeNotice = page.getByRole('button', { name: 'Đóng thông báo', exact: true });
  if (await closeNotice.count()) await closeNotice.click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve('artifacts/test-video/plan-committees-review.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator('aside').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: resolve('artifacts/test-video/plan-committees-mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
  console.log('PASS: add committees, assign lecturers, save payload, block unsaved submission, review locked assignments, mobile layout.');
} catch (error) {
  console.error('URL:', page.url(), 'Browser errors:', errors, 'Page:', (await page.locator('body').innerText()).slice(-4000));
  throw error;
} finally {
  await browser.close();
}
