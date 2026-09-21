# Kế hoạch webgame — Dấu ấn Hồ Chí Minh

## Mục tiêu
Webgame tiếng Việt cho môn Tư tưởng Hồ Chí Minh. Mỗi nhóm chơi trên một laptop; người dẫn điều khiển phòng và trình chiếu trên máy tính. Làm bản chạy thực tế, không chỉ giao diện minh họa.

## Luồng chính
1. Người dẫn tạo phòng và chọn bộ câu hỏi. Người chơi nhập mã phòng và tên nhóm.
2. Trước trận, mỗi nhóm quay 5 lần để nhận và tích trữ chức năng ngẫu nhiên.
3. Trước mỗi câu, mỗi nhóm chọn dùng tối đa một chức năng trong kho hoặc bỏ qua để giữ lại; người dẫn bắt đầu câu khi tất cả đã chốt.
4. Hiển thị câu hỏi, các ô chữ chia theo từ và ô nhập đáp án.
5. Mỗi giây hé một ký tự chưa hiện. Khoảng trắng hiện sẵn, ký tự tiếng Việt giữ nguyên dấu.
6. Nhập đúng nhận điểm theo thời gian; trả lời sai có thời gian chờ ngắn trước lần thử tiếp theo.
7. Hết giờ hoặc tất cả nhóm trả lời đúng: hiện đáp án, giải thích và bảng điểm. Người dẫn chuyển câu.
8. Kết thúc bộ câu hỏi: bảng xếp hạng chung cuộc.

## Luật mặc định
- 30 giây/câu, cấu hình được trước trận. Điểm cơ bản max(100, 1000 - floor(900 * elapsed / duration)); sai hoặc hết giờ không trả lời đúng: 0.
- Máy chủ xác định thời điểm bắt đầu, lượt quay, vật phẩm, đáp án và điểm. Không gửi đáp án đầy đủ cho người chơi khi câu chưa kết thúc.
- Chuẩn hóa đáp án: không phân biệt hoa/thường, dấu tiếng Việt, khoảng trắng dư; hỗ trợ đáp án tương đương do người dẫn khai báo.
- Mỗi nhóm nhận 5 chức năng trước trận; chức năng có thể trùng và được tích lũy trong kho. Mỗi câu dùng tối đa một chức năng, hoặc bỏ qua để giữ lại.
- Khiên: chặn một đòn; Gợi ý: hé thêm 2 chữ riêng cho nhóm; Cộng điểm: +200 nếu đúng; Màn sương: che phần ô chữ của một đối thủ 3 giây, không khóa nhập đáp án. Hiệu ứng được giải quyết khi câu hỏi bắt đầu.
- Không được nhắm chính mình hoặc chọn chức năng không còn trong kho.
- Các nhóm hòa điểm có cùng hạng; thứ tự hiển thị ổn định.

## Phạm vi triển khai
- Màn hình vào phòng, sảnh chờ, vòng quay có hiệu ứng, màn chơi, kết quả và bảng xếp hạng.
- Giao diện người dẫn; chỉnh bộ câu hỏi trước trận, kèm giải thích và nguồn tham khảo.
- Đồng bộ giữa nhiều thiết bị qua máy chủ; quản lý quyền người dẫn bằng token riêng; kết nối lại khôi phục nhóm.
- Chế độ chơi thử có nhãn rõ ràng; không trình bày đối thủ giả như người chơi thật.
- Bộ câu hỏi khởi đầu dựa trên nguồn chính thống; người dẫn có thể sửa theo giáo trình.
- Giao diện Việt, đỏ trầm, nền sáng, chữ dễ đọc; ưu tiên laptop và màn hình chiếu.

## Kiểm chứng
- Chạy kiểm tra logic tính điểm, chuẩn hóa tiếng Việt, quyền người dẫn, vòng đời câu hỏi và vật phẩm.
- Kiểm tra thực tế một người dẫn và ít nhất hai nhóm: vào phòng, quay, bắt đầu, trả lời sai/đúng, dùng vật phẩm, chuyển câu và kết thúc.
- Kiểm tra không lộ đáp án, không cộng điểm hai lần, không dùng lại vật phẩm và kết nối lại.
- Kiểm tra hiển thị trên laptop, build và cung cấp hướng dẫn chạy trong lớp; nêu rõ giới hạn lưu trữ và triển khai.

## Phân công
GPT-5.6 Sol, reasoning High: thực hiện ứng dụng, chạy kiểm tra và sửa lỗi.
Agent chính: lập kế hoạch, chuẩn bị/kiểm chứng nội dung lịch sử, xem xét kết quả và bàn giao.

## Kết quả triển khai
- GPT-5.6 Sol High đã thực hiện bản ứng dụng Node.js không cần thư viện cài thêm.
- Có phòng thật cho tối đa 20 nhóm, 15 câu hỏi mẫu (gồm 3 câu ảnh fade), chỉnh câu hỏi/thời gian, 5 lượt quay trước trận, kho chức năng và bước chọn chức năng trước mỗi câu, mật khẩu người dẫn, rời phòng đồng bộ, chế độ chơi thử và khôi phục phiên khi tải lại trang.
- Kiểm tra tự động bao phủ luật chơi, API, mật khẩu người dẫn và rời phòng; giao diện được kiểm tra trên laptop.
- Chạy tại http://localhost:3000 trên máy người dẫn; đường dẫn Wi-Fi hiện trong sảnh chờ. Hướng dẫn ở README.md, có start-game.bat cho Windows.
- Chưa có máy chủ Internet công khai. Phòng và bộ câu hỏi đã sửa lưu trong bộ nhớ, mất khi dừng/khởi động lại máy chủ.
