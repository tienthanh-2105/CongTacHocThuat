# Mobile — Công tác học thuật

React Native + Expo + TypeScript. Chạy từ thư mục gốc bằng `npm run dev:mobile`, hoặc `npm run dev:android` để mở Android emulator.

`App.tsx` là điểm vào giao diện, màn hình tại `src/screens`, mã gọi backend tại `src/services`. Khi thêm điều hướng, dùng Expo Router theo AGENTS.md. Hiện chỉ có màn hình khởi đầu và kiểm tra kết nối API, chưa có nghiệp vụ Mobile.

Cấu hình `EXPO_PUBLIC_API_URL` trong `.env.local` theo `.env.example`. Android emulator dùng `10.0.2.2`; điện thoại thật dùng IP LAN của máy backend. API phải cho phép kết nối từ thiết bị. Xem [hướng dẫn chung](../../docs/development.md).

Kiểm tra: `npm run typecheck -w apps/mobile`, `npm run lint -w apps/mobile`, `npm run check:mobile`.
