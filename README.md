# Dấu ấn Hồ Chí Minh

Webgame tiếng Việt dành cho lớp học Tư tưởng Hồ Chí Minh. Người dẫn mở phòng trên máy tính; mỗi nhóm dùng một laptop để tham gia bằng mã 6 số. Bộ 15 câu hỏi khởi đầu gồm 12 câu ô chữ và 3 câu ảnh hiện rõ dần; người dẫn có thể chỉnh nội dung trong sảnh chờ.

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

## Triển khai Vercel

Bản công khai dùng Vercel Functions và Upstash Redis để mọi nhóm thấy cùng một phòng, kể cả khi Vercel chạy nhiều phiên máy chủ. Tạo project Vercel từ repository này, vào **Storage → Create Database → Upstash for Redis**, chọn gói **Free**, vùng **Singapore (sin1)**, tắt tự động nâng cấp gói và kết nối với project. Vercel tự thêm `KV_REST_API_URL` và `KV_REST_API_TOKEN` cho project. Thêm `HOST_PASSWORD` dưới dạng **Secret** cho Production (và Preview nếu dùng), rồi deploy lại. Không đưa các giá trị bí mật vào Git.

Người dẫn mở trang công khai, chọn **Tạo phòng chơi** và nhập mật khẩu người dẫn. Chia sẻ mã phòng hoặc liên kết cho các nhóm; các nhóm có thể tham gia từ mạng khác nhau. Phòng hết hạn sau 48 giờ không có thay đổi; hãy tạo phòng mới cho buổi học tiếp theo. Mỗi thiết bị giữ khóa tham gia trong trình duyệt để tải lại trang và tiếp tục.

Bản chạy bằng `npm start` vẫn phục vụ trên mạng nội bộ và giữ phòng trong RAM; đóng máy chủ sẽ mất phòng local. Bản Vercel lưu phòng trong Redis. Mật khẩu local trong `.host-password` tách biệt với biến `HOST_PASSWORD` trên Vercel.

## Kiểm tra

Chạy `npm test` để kiểm tra luật chơi, kho chức năng, rời phòng, mật khẩu người dẫn và luồng API nhiều nhóm. Không cần cài thêm thư viện.
