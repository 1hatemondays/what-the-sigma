// Bộ 15 câu được chọn từ tài liệu ôn tập: đáp án ngắn, ít trùng lặp và phù hợp ô chữ.
// Ba câu có `images` dùng chế độ ảnh hiện rõ dần.
export const seedQuestions = [
  {
    prompt: 'Nguồn lý luận nào cung cấp quan điểm về bản chất giai cấp của Nhà nước?',
    answer: 'Chủ nghĩa Mác-Lênin', aliases: ['Mác Lênin', 'Chủ nghĩa Mác Lênin'],
    explanation: 'Chủ nghĩa Mác-Lênin cung cấp quan điểm lý luận về bản chất giai cấp của Nhà nước.', source: ''
  },
  {
    prompt: 'Theo tư tưởng Hồ Chí Minh, độc lập dân tộc gắn liền với chủ nghĩa nào?',
    answer: 'Chủ nghĩa xã hội', aliases: ['Xã hội chủ nghĩa'],
    explanation: 'Độc lập dân tộc phải gắn liền với chủ nghĩa xã hội.', source: ''
  },
  {
    prompt: 'Độc lập phải đem lại điều gì cho nhân dân?',
    answer: 'Tự do và hạnh phúc', aliases: ['Tự do hạnh phúc'],
    explanation: 'Độc lập phải đem lại tự do và hạnh phúc thực sự cho nhân dân.', source: ''
  },
  {
    prompt: 'Hồ Chí Minh yêu cầu Đảng phải là đạo đức và là gì?',
    answer: 'Văn minh', aliases: [],
    explanation: 'Hồ Chí Minh khẳng định Đảng phải là đạo đức, là văn minh.', source: ''
  },
  {
    prompt: 'Nhà nước Việt Nam mới mang bản chất của giai cấp nào?',
    answer: 'Giai cấp công nhân', aliases: ['Công nhân'],
    explanation: 'Nhà nước Việt Nam mới mang bản chất giai cấp công nhân.', source: ''
  },
  {
    prompt: 'Nhà nước được tổ chức và hoạt động theo nguyên tắc nào?',
    answer: 'Tập trung dân chủ', aliases: [],
    explanation: 'Nguyên tắc tổ chức và hoạt động của Nhà nước là tập trung dân chủ.', source: ''
  },
  {
    prompt: 'Tất cả quyền lực nhà nước và xã hội thuộc về ai?',
    answer: 'Nhân dân', aliases: [],
    explanation: 'Trong Nhà nước của dân, tất cả quyền lực nhà nước và xã hội thuộc về nhân dân.', source: ''
  },
  {
    prompt: 'Hình thức dân chủ nào được Hồ Chí Minh coi là hoàn bị nhất?',
    answer: 'Dân chủ trực tiếp', aliases: [],
    explanation: 'Hồ Chí Minh coi dân chủ trực tiếp là hình thức dân chủ hoàn bị nhất.', source: ''
  },
  {
    prompt: 'Cán bộ và cơ quan nhà nước phải là gì của dân?',
    answer: 'Công bộc của dân', aliases: ['Công bộc'],
    explanation: 'Cán bộ và cơ quan nhà nước phải là công bộc, tận tâm phục vụ nhân dân.', source: ''
  },
  {
    prompt: 'Quan sát hình ảnh đang hiện rõ dần: nhân dân cử đại diện của mình thông qua cơ chế nào?',
    answer: 'Bầu cử', aliases: [],
    explanation: 'Nhân dân lựa chọn các đại diện của mình thông qua cơ chế bầu cử.', source: '',
    images: ['/question-images/baucu.jpg'], imageAlt: 'Tranh cổ động toàn dân tham gia bầu cử'
  },
  {
    prompt: 'Thước đo của một Nhà nước vì dân là gì?',
    answer: 'Được lòng dân', aliases: ['Lòng dân'],
    explanation: 'Một Nhà nước vì dân phải phục vụ nhân dân và được lòng dân.', source: ''
  },
  {
    prompt: 'Bản Yêu sách năm 1919 đề nghị thay chế độ ra sắc lệnh bằng loại văn bản nào?',
    answer: 'Đạo luật', aliases: ['Các đạo luật'],
    explanation: 'Bản Yêu sách đề nghị thay chế độ ra sắc lệnh bằng chế độ ra các đạo luật.', source: ''
  },
  {
    prompt: 'Quan sát ảnh tư liệu đang hiện rõ dần: cuộc Tổng tuyển cử đầu tiên diễn ra ngày nào?',
    answer: '6/1/1946', aliases: ['Ngày 6 tháng 1 năm 1946', '06/01/1946'],
    explanation: 'Cuộc Tổng tuyển cử đầu tiên của nước Việt Nam Dân chủ Cộng hòa diễn ra ngày 6/1/1946.', source: '',
    images: ['/question-images/06011946.jpg'], imageAlt: 'Hình cổ động kỷ niệm cuộc Tổng tuyển cử đầu tiên'
  },
  {
    prompt: 'Quan sát hai văn kiện đang hiện rõ dần: Hồ Chí Minh lãnh đạo soạn thảo hai bản Hiến pháp năm nào?',
    answer: '1946 và 1959', aliases: ['1946, 1959', '1946 1959'],
    explanation: 'Hồ Chí Minh tham gia lãnh đạo soạn thảo Hiến pháp năm 1946 và Hiến pháp năm 1959.', source: '',
    images: ['/question-images/hienphap1946.jpg', '/question-images/hienphap1959.jpg'], imageAlt: 'Bìa hai bản Hiến pháp Việt Nam năm 1946 và 1959'
  },
  {
    prompt: 'Quyền tự nhiên cao nhất của con người là quyền gì?',
    answer: 'Quyền sống', aliases: [],
    explanation: 'Quyền sống là quyền tự nhiên cao nhất và cơ bản nhất của con người.', source: ''
  }
];
