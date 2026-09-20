# Dấu ấn Hồ Chí Minh

Webgame tiếng Việt dành cho lớp học Tư tưởng Hồ Chí Minh. Người dẫn mở phòng trên máy tính; mỗi nhóm dùng một điện thoại để tham gia bằng mã 6 số. Tám câu hỏi khởi đầu có thể chỉnh trong sảnh chờ.

## Chạy trong lớp

Máy tính cần [Node.js 20 trở lên](https://nodejs.org/). Trên Windows, nhấp đúp **`start-game.bat`**, sau đó mở `http://localhost:3000` trên máy người dẫn. Hoặc chạy `npm start` trong thư mục này.

Chọn **Tạo phòng chơi**. Màn hình sảnh chờ hiển thị mã phòng và đường dẫn dùng cho các thiết bị cùng Wi-Fi. Cho học viên mở đường dẫn đó trên điện thoại, đặt tên nhóm và tham gia. Nếu máy có nhiều card mạng, sảnh chờ hiển thị các đường dẫn thay thế; chọn địa chỉ thuộc Wi-Fi thực tế của lớp. Nếu điện thoại không kết nối được, kiểm tra cùng mạng và cho phép Node.js qua Windows Firewall trên mạng riêng.

Người dẫn có thể chỉnh câu hỏi, đáp án tương đương, giải thích, nguồn và thời gian mỗi câu trước trận. Bấm **Bắt đầu trận đấu**, đợi các nhóm quay, rồi **Mở câu hỏi**. Nếu có nhóm chưa quay và không còn ở đó, dùng **Quay hộ nhóm chưa quay**. Mỗi giây hé một ký tự; nhóm nhập đáp án trên điện thoại. Kết thúc câu hiện đáp án và bảng điểm, rồi người dẫn chuyển câu. Nút **Chơi thử một mình** trên trang đầu chạy một trận thật trên máy chủ với một nhóm và có nhãn rõ ràng.

## Luật chơi

- Mỗi câu mặc định 30 giây, có thể chỉnh 10–90 giây. Trả lời đúng nhận từ 100 đến 1000 điểm theo thời gian; sai có thời gian chờ 2 giây.
- Mỗi nhóm quay một lần trước mỗi câu và nhận một vật phẩm dùng tối đa một lần: Khiên chặn Màn sương; Gợi ý hé thêm hai chữ; Cộng điểm thưởng 200 nếu trả lời đúng; Màn sương che ô chữ đối thủ ba giây nhưng vẫn cho phép nhập đáp án.
- Đáp án không phân biệt hoa/thường, dấu tiếng Việt và khoảng trắng dư. Người dẫn có thể thêm các cách viết tương đương.
- Nhóm bằng điểm cùng thứ hạng. Máy chủ quyết định lượt quay, thời gian, đáp án và điểm.

## Giới hạn triển khai

Phòng, tên nhóm, câu hỏi đã sửa và điểm chỉ lưu trong bộ nhớ của tiến trình Node.js. Đóng cửa sổ máy chủ hoặc khởi động lại sẽ mất các phòng đang chơi. Thiết bị phải truy cập được máy chủ qua cùng mạng; ứng dụng chưa có máy chủ công khai. Mỗi thiết bị lưu khóa tham gia trong trình duyệt để tải lại trang và tiếp tục. Người dẫn nên dùng cùng trình duyệt/tab đã tạo phòng.

## Kiểm tra

Chạy `npm test` để kiểm tra luật chơi và luồng API nhiều nhóm. Không cần cài thêm thư viện.
