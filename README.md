# Dấu ấn Hồ Chí Minh

Webgame tiếng Việt dành cho lớp học Tư tưởng Hồ Chí Minh. Người dẫn mở phòng trên máy tính; mỗi nhóm dùng một laptop để tham gia bằng mã 6 số. Tám câu hỏi khởi đầu có thể chỉnh trong sảnh chờ.

## Chạy trong lớp

Máy tính cần [Node.js 20 trở lên](https://nodejs.org/). Trên Windows, nhấp đúp **`start-game.bat`**, sau đó mở `http://localhost:3000` trên máy người dẫn. Hoặc chạy `npm start` trong thư mục này. Lần chạy local đầu tiên, máy chủ tự tạo mật khẩu người dẫn và lưu trong file `.host-password`; file này bị Git bỏ qua nên không bị đẩy lên repository. Mật khẩu được hiển thị trong cửa sổ máy chủ để tạo phòng hoặc mở chế độ chơi thử.

Nếu muốn tự chọn mật khẩu local cố định, tạo file `.env.local` với dòng `HOST_PASSWORD=mat-khau-rieng-cua-ban`, sau đó chạy `npm start`. Không commit `.env.local`, `.host-password` hoặc ghi mật khẩu thật vào README/source code.

Chọn **Tạo phòng chơi** và nhập mật khẩu người dẫn trong cửa sổ máy chủ. Màn hình sảnh chờ hiển thị mã phòng và đường dẫn dùng cho các laptop cùng Wi-Fi. Cho học viên mở đường dẫn đó, đặt tên nhóm và tham gia. Nếu máy có nhiều card mạng, sảnh chờ hiển thị các đường dẫn thay thế; chọn địa chỉ thuộc Wi-Fi thực tế của lớp. Nếu laptop không kết nối được, kiểm tra cùng mạng và cho phép Node.js qua Windows Firewall trên mạng riêng.

Người dẫn có thể chỉnh câu hỏi, đáp án tương đương, giải thích, nguồn và thời gian mỗi câu trước trận. Bấm **Bắt đầu vòng quay** để mỗi nhóm quay 5 lần và tích trữ chức năng cho cả trận; nếu một nhóm không thể tự hoàn tất, người dẫn có thể quay đủ hộ. Trước từng câu, mỗi nhóm chọn dùng một chức năng trong kho hoặc bỏ qua để giữ lại. Khi tất cả đã chốt, người dẫn mở câu hỏi. Mỗi giây hé một ký tự; nhóm nhập đáp án trên laptop. Kết thúc câu hiện đáp án và bảng điểm, rồi chuyển sang bước chọn chức năng của câu kế tiếp. Khi một nhóm bấm **Rời phòng**, nhóm đó được xóa ngay khỏi danh sách của người dẫn.

## Luật chơi

- Mỗi câu mặc định 30 giây, có thể chỉnh 10–90 giây. Trả lời đúng nhận từ 100 đến 1000 điểm theo thời gian; sai có thời gian chờ 2 giây.
- Mỗi nhóm quay đúng 5 lần trước trận. Chức năng có thể trùng và được giữ trong kho; trước mỗi câu, nhóm dùng tối đa một chức năng hoặc bỏ qua. Chức năng đã dùng bị trừ khỏi kho.
- Khiên chặn một Màn sương; Gợi ý hé thêm hai chữ; Cộng điểm thưởng 200 nếu trả lời đúng; Màn sương che ô chữ đối thủ ba giây nhưng vẫn cho phép nhập đáp án. Các hiệu ứng kích hoạt khi người dẫn mở câu.
- Đáp án không phân biệt hoa/thường, dấu tiếng Việt và khoảng trắng dư. Người dẫn có thể thêm các cách viết tương đương.
- Nhóm bằng điểm cùng thứ hạng. Máy chủ quyết định lượt quay, thời gian, đáp án và điểm.

## Giới hạn triển khai

Phòng, tên nhóm, câu hỏi đã sửa và điểm chỉ lưu trong bộ nhớ của tiến trình Node.js. Đóng cửa sổ máy chủ hoặc khởi động lại sẽ mất các phòng đang chơi. Thiết bị phải truy cập được máy chủ qua cùng mạng; ứng dụng chưa có máy chủ công khai. Mỗi thiết bị lưu khóa tham gia trong trình duyệt để tải lại trang và tiếp tục. Người dẫn nên dùng cùng trình duyệt/tab đã tạo phòng.

Không triển khai bản hiện tại trực tiếp lên Vercel để chơi thật: Vercel Functions có thể tạo nhiều instance và thu hồi instance, trong khi trạng thái trận đấu hiện chỉ nằm trong RAM. Muốn dùng Vercel cần chuyển `GameStore` sang kho dữ liệu dùng chung như Redis/Postgres và tạo Vercel Function handler. Trên Vercel, đặt `HOST_PASSWORD` trong **Project Settings → Environment Variables**, bật **Sensitive** cho Preview/Production, rồi redeploy; không đặt giá trị trong `vercel.json`.

## Kiểm tra

Chạy `npm test` để kiểm tra luật chơi, kho chức năng, rời phòng, mật khẩu người dẫn và luồng API nhiều nhóm. Không cần cài thêm thư viện.
