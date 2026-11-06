# Hướng dẫn đưa **Ở tù online** lên cửa hàng

Ứng dụng bọc WebView/TWA tải URL live: `https://o-tu-online.onrender.com/`  
Package ID Android: `vn.otuonline.app` · phiên bản store: **2.0.0** (versionCode 2)

Artifact đã build (không gồm keystore):

- `dist/android/o-tu-online-2.0.0.aab` — upload Google Play
- `dist/android/o-tu-online-2.0.0.apk` — thử máy / sideload / GitHub Releases

Keystore upload nằm **chỉ** tại `android-keys/` (đã gitignore, chmod 600). Không khi nào commit hoặc đính kèm release.

Chính sách quyền riêng tư: https://o-tu-online.onrender.com/privacy  
Nội dung listing (tiếng Việt): `store/listing-vi.txt`

---

## A. Google Play Console (Android)

### 1) Tài khoản & phí
1. Vào https://play.google.com/console → tạo tài khoản nhà phát triển.
2. Đóng **25 USD** một lần (thẻ quốc tế).
3. Xác minh danh tính / thông tin thanh toán theo hướng dẫn Google.

### 2) Tạo ứng dụng
1. **Create app** → tên: `Ở tù online` · ngôn ngữ mặc định: Tiếng Việt · loại: Game · Free.
2. Chấp nhận tuyên bố về chính sách / US export nếu được hỏi.

### 3) Store listing (Tiếng Việt)
Dùng nội dung trong `store/listing-vi.txt`:
- **App name**: Ở tù online  
- **Short description**: ≤ 80 ký tự (đã soạn trong file)  
- **Full description**: bản đầy đủ trong file  
- **App icon**: dùng `public/icons/` hoặc `android-webview/app/src/main/res/mipmap-*/ic_launcher.png` (512×512 cần export riêng nếu Console yêu cầu)  
- **Feature graphic** 1024×500: tự thiết kế (chữ “Ở tù online” + cảnh trại chibi)  
- **Screenshots**: điện thoại (≥ 2); có thể chụp từ bản web/live  
- **Privacy policy URL**: `https://o-tu-online.onrender.com/privacy`

### 4) App content
- Category: Game → Simulation / Casual  
- Target age: hoàn thành questionnaire (game giả tưởng, không bạo lực đồ họa nặng)  
- Ads: No (trừ khi bạn gắn quảng cáo sau này)  
- Data safety: khai báo biệt danh / tiến trình game lưu trên server; không bán dữ liệu.

### 5) Upload bản build
1. **Release → Testing → Internal testing** → Create release.  
2. Upload `o-tu-online-2.0.0.aab`.  
3. Nếu Google hỏi **Play App Signing**: chọn để Google quản lý key app; upload key là `android-keys/otu-upload.jks` (giữ file credentials cục bộ).  
4. Thêm ≥ 1 tester (email) → Start rollout to Internal testing → cài qua link opt-in.

### 6) Quy tắc tài khoản cá nhân mới (12 tester / 14 ngày)
Với nhiều tài khoản **cá nhân mới**, Google yêu cầu trước khi lên Production:
- Chạy **Closed testing** (hoặc quy trình testing được yêu cầu) với **ít nhất 12 tester** trong **14 ngày** liên tục,  
- Tester phải thực sự opt-in và có tương tác tối thiểu theo cảnh báo trên Console.  
Internal testing để tự kiểm; Closed testing mới thường dùng để thỏa điều kiện 12/14.  
Đọc banner vàng trên Console — Google có thể cập nhật chính sách.

### 7) Production
1. Sau khi đủ điều kiện testing → **Production** → tạo release từ cùng AAB (hoặc bản mới hơn).  
2. Countries/regions: chọn quốc gia (VN + quốc tế tùy bạn).  
3. Gửi **Send for review**. Thời gian duyệt thường vài ngày.

### 8) Cập nhật sau này
- Tăng `versionCode` / `versionName` trong `android-webview/app/build.gradle`  
- `./gradlew bundleRelease` → upload AAB mới  
- Giữ nguyên upload keystore.

---

## B. Apple App Store (iOS)

### 1) Tài khoản
- Apple Developer Program: **99 USD/năm** — https://developer.apple.com/programs/  
- Cần pháp nhân/cá nhân + xác minh.

### 2) Máy Mac + Xcode **hoặc** cloud build
Repo đã có wrapper Android WebView. Cho iOS khuyến nghị **Capacitor**:

```bash
cd /workspace/o-tu-online
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/ios @capacitor/android
npx cap init "Ở tù online" vn.otuonline.app --web-dir public
```

Trong `capacitor.config.json` đặt server URL live (TWA-style):

```json
{
  "appId": "vn.otuonline.app",
  "appName": "Ở tù online",
  "webDir": "public",
  "server": { "url": "https://o-tu-online.onrender.com", "cleartext": false }
}
```

```bash
npx cap add ios
npx cap sync ios
```

Mở `ios/App/App.xcworkspace` bằng **Xcode trên macOS**, chọn Team signing, Archive → Upload to App Store Connect.

**Không có Mac?** Dùng cloud CI:
- [Codemagic](https://codemagic.io) / GitHub Actions macOS runner / Bitrise  
- Build scheme Release, upload `ipa` lên App Store Connect (API key).

Thư mục `ios/` (Capacitor) có thể được generate trên CI và commit nếu bạn muốn đồng đội cùng sửa — template cấu hình nằm tại `capacitor.config.json` trong repo.

### 3) App Store Connect
1. Tạo app mới · Bundle ID `vn.otuonline.app`  
2. Điền mô tả tiếng Việt (cùng nội dung listing)  
3. Privacy Policy URL: `https://o-tu-online.onrender.com/privacy`  
4. Screenshots theo kích thước iPhone bắt buộc  
5. Submit for Review

---

## C. Xây lại AAB trên máy dev

```bash
export JAVA_HOME=…/jdk-17
export ANDROID_HOME=…/Android/Sdk
# Đặt android-keys/otu-upload.jks + keystore-credentials.txt (chmod 600)
cd android-webview
./gradlew clean bundleRelease assembleRelease
# Output:
#   app/build/outputs/bundle/release/app-release.aab
#   app/build/outputs/apk/release/app-release.apk
```

---

## D. GitHub Release v2.0.0

Đính kèm **chỉ** `.aab` và `.apk` (không đính keystore / credentials). Tag: `v2.0.0`.
