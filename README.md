# SAPSAN – Xếp sân cầu lông (đánh đôi)

Web app dạng game 3D để host xếp sân đánh đôi: Next.js 16 (App Router) + React 19 + Three.js (React Three Fiber) + Tailwind CSS v4.

## Chạy

```bash
npm install
npm run dev      # http://localhost:3000
```

## Chức năng

- **Sân**: thêm / xóa sân, bấm vào tên sân để đổi tên. Xóa sân đang có người sẽ đưa họ về hàng chờ (trận dở không ghi lịch sử).
- **Thành viên** (tối đa 25 người — `MAX_MEMBERS` trong `lib/types.ts`): hộp thoại riêng để thêm từng người, dán nhiều tên cùng lúc, sửa tên / giới tính / trình độ, xóa. Danh sách hiện dạng lưới thẻ gọn (tới 5 cột) để xem cả 25 người gần như không phải cuộn, có lọc Tất cả / Có mặt / Chưa đến / Đã về.
- **Xác nhận vào / rời sân**: nút ✓ Vào chốt giờ đến và đưa người đó vào hàng chờ; nút 🚪 chốt giờ về và đưa ra khỏi hàng chờ (không về được khi đang đánh). Người chưa đến / đã về nằm ở cuối bảng thành viên.
- **Trình độ** hiện bằng biệt danh "gà", trình chú thích trong ngoặc:

  | Trình | Biệt danh |
  |---|---|
  | Newbie | 🐣 Gà Mới Vào Sân |
  | Yếu | 🐥 Gà Tập Bay |
  | Yếu+ | 🐔 Gà Biết Đánh |
  | TBY- | 🐓 Gà Có Nghề |
  | TBY | 🐔 Gà Chiến |
  | TBY+ | 🐓 Gà Đại Ca |
  | TB | 👑 Gà Trùm |

- **Hàng chờ**: mỗi người hiện thời gian đã chờ (tính từ lúc tham gia hoặc lúc đánh xong trận gần nhất) và số trận hôm nay. Danh sách luôn sắp theo ưu tiên vào sân: **ít trận trước, bằng trận thì chờ lâu trước**.
- **Xếp trận tự động** (nút 🎲 Xếp trận): chọn sân → thể loại (Đôi nam / Đôi nữ / Đôi nam nữ) → tính chất:

  | Tính chất | Quy tắc trình của 4 người |
  |---|---|
  | 🔥 Khô Máu | cùng trình hoặc lệch tối đa 1 bậc |
  | 😎 Giao Lưu | cùng trình |
  | 🧘 Dưỡng Sinh | Newbie → Yếu |

  Trong số người hợp lệ, ai ít trận và chờ lâu được chọn trước; hai đội được chia sao cho tổng trình cân nhất (đôi nam nữ: mỗi đội 1 nam + 1 nữ). Không đủ người hợp lệ thì báo lý do, không xếp bừa.
- **Xếp thủ công**: bấm chọn tối đa 4 người rồi bấm vào sân, hoặc kéo-thả từng người. Thả một người đang đứng trong sân lên chỗ người khác để hai người đổi chỗ (chỉnh đội).
- **Bắt đầu**: sân đủ 4 người không tự chạy — host bấm ▶ Bắt đầu.
- **Kết thúc**: bắt buộc chọn đội thắng; 4 người quay về hàng chờ.
- **Thống kê hôm nay**: số trận, thắng, thua, tỉ lệ thắng, thời gian đánh của từng người; lịch sử trận có đội thắng và tính chất trận.
- **Biểu cảm bực / giận**: người ở hàng chờ hiện 😤 khi chờ quá 10 phút, hoặc được ghép ít trận hơn mọi người; nặng hơn thành 😡. Ngưỡng ở `ANGRY_WAIT_MINUTES` trong `lib/mood.ts`.
- **Tính tiền** (nút 💰): nhập tiền sân, tiền cầu (đơn vị nghìn), chênh lệch nam/nữ (vd 10 → nam 60%, nữ 40%). Tiền sân chia theo số phút có mặt × tỉ lệ giới tính; tiền cầu chia theo đầu người (hoặc theo thời gian). Có thể sửa giờ vào/ra, thêm khoản riêng (vd `40+20`), chọn làm tròn. Xuất ra chữ hoặc ảnh PNG theo mẫu `5. Núi (19h - 21h30) 100k + 48k + 40k + 20k = 208k` (sân + cầu + khoản thêm = tổng). Nút "Bắt đầu buổi mới" trong 🧹 Dọn dẹp xóa giờ vào/ra để tính buổi sau.
- **Đồng hồ** giờ hiện tại ở giữa màn hình.
- **Giao diện sáng / tối** (nút 🌙 / ☀️): giao diện tối đổi cả HUD lẫn cảnh 3D sang buổi tối; lựa chọn được lưu lại.
- **Dọn dẹp nhanh** (nút 🧹): xóa hết thành viên, xóa hết sân, hoặc cả hai. Khi còn trận đang đánh thì không xóa được sân (kể cả xóa từng sân đang đánh) và không dọn dẹp được — phải kết thúc trận trước.

Dữ liệu lưu trong `localStorage` của trình duyệt (không có server, không đăng nhập).

## Cấu trúc

- `lib/types.ts` – bảng trình độ, thể loại, tính chất trận, kiểu dữ liệu
- `lib/store.ts` – toàn bộ trạng thái và thao tác (zustand + persist, có chuyển đổi dữ liệu cũ)
- `lib/logic.ts` – chọn người theo ưu tiên + tính chất, chia đội, thống kê
- `lib/mood.ts` – thời gian chờ và mức bực
- `lib/billing.ts` – chia tiền sân / cầu theo thời gian + giới tính, định dạng dòng xuất
- `lib/layout.ts` – toạ độ sân, ô đứng, hàng chờ trong thế giới 3D
- `lib/appearance.ts` – ngoại hình nhân vật sinh từ id thành viên
- `components/scene/` – cảnh 3D: sân, người chơi, khán đài cổ vũ, kéo-thả, camera tự căn
- `components/scene/Scenery.tsx` – bối cảnh sân vận động: cỏ sọc, đường chạy + người chạy bộ, cây, cột đèn, cờ, linh vật gà, bảng điện tử
- `components/Dialogs.tsx` – hộp thoại xếp trận, kết thúc trận, thành viên, dọn dẹp
- `components/BillingDialog.tsx` – bảng tính tiền + xuất ảnh
- `components/` – HUD: thanh trên, bảng thành viên, thống kê

Bố cục: tới 8 sân xếp một dãy ngang, hàng chờ phía trước; từ 9 sân chia hai dãy, hàng chờ ở giữa; màn hình dọc (điện thoại) xếp lưới 2 cột. Camera tự căn vừa toàn bộ sân mỗi khi thêm / xóa sân.
