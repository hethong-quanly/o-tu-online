# Ở tù online

Game mô phỏng đời sống trong tù (multiplayer web) — **Node.js + Express + Socket.io**.

## Chơi nhanh (local)

```bash
npm install
npm start
```

Mở http://127.0.0.1:3847 (hoặc port trong biến môi trường `PORT`).

## Deploy miễn phí trên Render

1. Đăng nhập [Render](https://render.com) bằng GitHub.
2. Bấm nút dưới (hoặc *New → Blueprint* → chọn repo này):

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/hethong-quanly/o-tu-online)

3. Chọn plan **Free**, đợi build xong → mở URL `*.onrender.com`.

> Lưu ý: máy free trên Render có thể “ngủ” sau ~15 phút không dùng; lần mở sau chờ thêm vài giây.

## Tính năng

- Vào game bằng biệt danh
- Bản đồ nhiều phòng + thấy người chơi realtime
- Chat toàn trại
- Việc làm: giặt đồ, nấu ăn, lao động (cooldown, tốn năng lượng)
- Cửa hàng: giường, đồ ăn, công cụ, dụng cụ vượt ngục
- Chỉ số: sức khỏe, năng lượng, uy tín, tiền
- Vượt ngục tại **Tường rào** (tỉ lệ theo tool/stats; phạt khi thất bại)
- Bảng xếp hạng; lưu JSON (`data/players.json` trên đĩa nếu có quyền ghi)

## Stack

- Backend: Express + Socket.io (một process)
- Frontend: HTML/CSS/JS thuần (tiếng Việt)
- Persist: file JSON / in-memory

## API

- `GET /api/health` — kiểm tra server


## Chơi trên điện thoại

### Android (APK)
Tải file `o-tu-online.apk` từ [Releases](https://github.com/hethong-quanly/o-tu-online/releases) trên GitHub, mở trên máy và cho phép cài từ nguồn không xác định (debug/self-signed). App là WebView mở `https://o-tu-online.onrender.com`.

### iOS (PWA — không có APK)
Apple không cho cài APK. Trên iPhone/iPad:
1. Mở Safari → vào https://o-tu-online.onrender.com
2. Chạm nút **Chia sẻ** (Share)
3. Chọn **Thêm vào Màn hình chính** (Add to Home Screen)
4. Đặt tên **Ở tù online** → Thêm

App sẽ mở dạng standalone (không thanh địa chỉ Safari). Cần mạng để chơi multiplayer.

### PWA (Android Chrome / Edge)
Mở trang game → trình đơn ⋮ → **Cài đặt ứng dụng** / **Add to Home screen**.
