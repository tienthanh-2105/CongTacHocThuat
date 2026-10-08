# Web — Công tác học thuật

Next.js + TypeScript, sử dụng App Router. Chạy từ thư mục gốc bằng `npm run dev:web`, mở http://localhost:3000.

Trang chính: `src/app/page.tsx`. Layout và CSS: `src/app/layout.tsx`, `src/app/globals.css`. Mã gọi backend: `src/services/api.ts`.

Địa chỉ API cấu hình qua `NEXT_PUBLIC_API_URL` trong `.env.local`; xem `.env.example`. Trang / và /login hiển thị giao diện đăng nhập, kết nối API bằng cookie HttpOnly; có hiện/ẩn mật khẩu, báo lỗi và đăng xuất sau khi đăng nhập.

Xem [hướng dẫn chung](../../docs/development.md).
