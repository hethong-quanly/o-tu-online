'use strict';

const QUESTIONS = [
  {
    "id": "toan_1",
    "cat": "toan",
    "q": "2 + 5 = ?",
    "choices": [
      "5",
      "6",
      "7",
      "8"
    ],
    "answer": 2
  },
  {
    "id": "toan_2",
    "cat": "toan",
    "q": "9 × 3 = ?",
    "choices": [
      "27",
      "18",
      "36",
      "21"
    ],
    "answer": 0
  },
  {
    "id": "toan_3",
    "cat": "toan",
    "q": "Căn bậc hai của 49 là?",
    "choices": [
      "6",
      "7",
      "8",
      "9"
    ],
    "answer": 1
  },
  {
    "id": "toan_4",
    "cat": "toan",
    "q": "15% của 200 là?",
    "choices": [
      "20",
      "25",
      "30",
      "35"
    ],
    "answer": 2
  },
  {
    "id": "toan_5",
    "cat": "toan",
    "q": "Chu vi hình vuông cạnh 4cm?",
    "choices": [
      "8cm",
      "12cm",
      "16cm",
      "20cm"
    ],
    "answer": 2
  },
  {
    "id": "toan_6",
    "cat": "toan",
    "q": "1 giờ = bao nhiêu phút?",
    "choices": [
      "30",
      "45",
      "60",
      "90"
    ],
    "answer": 2
  },
  {
    "id": "toan_7",
    "cat": "toan",
    "q": "Số nguyên tố nhỏ nhất?",
    "choices": [
      "0",
      "1",
      "2",
      "3"
    ],
    "answer": 2
  },
  {
    "id": "toan_8",
    "cat": "toan",
    "q": "Phân số 1/2 bằng?",
    "choices": [
      "0,2",
      "0,5",
      "1,2",
      "2"
    ],
    "answer": 1
  },
  {
    "id": "toan_9",
    "cat": "toan",
    "q": "(-3) + 8 = ?",
    "choices": [
      "5",
      "-5",
      "11",
      "-11"
    ],
    "answer": 0
  },
  {
    "id": "toan_10",
    "cat": "toan",
    "q": "Diện tích hình chữ nhật 5×3?",
    "choices": [
      "8",
      "15",
      "16",
      "30"
    ],
    "answer": 1
  },
  {
    "id": "sinh_11",
    "cat": "sinh",
    "q": "Cơ quan hô hấp chính của người?",
    "choices": [
      "Gan",
      "Phổi",
      "Thận",
      "Tim"
    ],
    "answer": 1
  },
  {
    "id": "sinh_12",
    "cat": "sinh",
    "q": "Đơn vị cơ bản của sự sống?",
    "choices": [
      "Nguyên tử",
      "Tế bào",
      "Phân tử",
      "Mô"
    ],
    "answer": 1
  },
  {
    "id": "sinh_13",
    "cat": "sinh",
    "q": "Động vật nào là động vật có vú?",
    "choices": [
      "Cá mập",
      "Cá voi",
      "Cá sấu",
      "Rắn"
    ],
    "answer": 1
  },
  {
    "id": "sinh_14",
    "cat": "sinh",
    "q": "Máy quang hợp ở thực vật?",
    "choices": [
      "Lục lạp",
      "Ty thể",
      "Nhân",
      "Không bào"
    ],
    "answer": 0
  },
  {
    "id": "sinh_15",
    "cat": "sinh",
    "q": "Máu đỏ nhờ chất gì?",
    "choices": [
      "Hemoglobin",
      "Insulin",
      "Collagen",
      "Keratin"
    ],
    "answer": 0
  },
  {
    "id": "sinh_16",
    "cat": "sinh",
    "q": "Loài nào đẻ trứng?",
    "choices": [
      "Mèo",
      "Gà",
      "Chó",
      "Bò"
    ],
    "answer": 1
  },
  {
    "id": "sinh_17",
    "cat": "sinh",
    "q": "Vitamin C nhiều trong?",
    "choices": [
      "Cam",
      "Cơm",
      "Thịt",
      "Dầu"
    ],
    "answer": 0
  },
  {
    "id": "sinh_18",
    "cat": "sinh",
    "q": "Não bộ thuộc hệ?",
    "choices": [
      "Tiêu hóa",
      "Thần kinh",
      "Tuần hoàn",
      "Hô hấp"
    ],
    "answer": 1
  },
  {
    "id": "sinh_19",
    "cat": "sinh",
    "q": "Côn trùng có bao nhiêu chân?",
    "choices": [
      "4",
      "6",
      "8",
      "10"
    ],
    "answer": 1
  },
  {
    "id": "sinh_20",
    "cat": "sinh",
    "q": "ADN mang thông tin?",
    "choices": [
      "Di truyền",
      "Tiêu hóa",
      "Vận động",
      "Hô hấp"
    ],
    "answer": 0
  },
  {
    "id": "hoa_21",
    "cat": "hoa",
    "q": "Công thức nước?",
    "choices": [
      "CO2",
      "H2O",
      "O2",
      "NaCl"
    ],
    "answer": 1
  },
  {
    "id": "hoa_22",
    "cat": "hoa",
    "q": "Nguyên tố hóa học của oxy?",
    "choices": [
      "O",
      "Ox",
      "Og",
      "Oy"
    ],
    "answer": 0
  },
  {
    "id": "hoa_23",
    "cat": "hoa",
    "q": "NaCl là?",
    "choices": [
      "Đường",
      "Muối ăn",
      "Giấm",
      "Cồn"
    ],
    "answer": 1
  },
  {
    "id": "hoa_24",
    "cat": "hoa",
    "q": "Khí cần để cháy?",
    "choices": [
      "Nito",
      "Oxy",
      "CO2",
      "Heli"
    ],
    "answer": 1
  },
  {
    "id": "hoa_25",
    "cat": "hoa",
    "q": "pH = 7 là?",
    "choices": [
      "Axit",
      "Bazơ",
      "Trung tính",
      "Muối"
    ],
    "answer": 2
  },
  {
    "id": "hoa_26",
    "cat": "hoa",
    "q": "Kim loại dẫn điện tốt?",
    "choices": [
      "Gỗ",
      "Đồng",
      "Nhựa",
      "Thủy tinh"
    ],
    "answer": 1
  },
  {
    "id": "hoa_27",
    "cat": "hoa",
    "q": "CO2 ở điều kiện thường là?",
    "choices": [
      "Rắn",
      "Lỏng",
      "Khí",
      "Plasma"
    ],
    "answer": 2
  },
  {
    "id": "hoa_28",
    "cat": "hoa",
    "q": "Nguyên tố H là?",
    "choices": [
      "Heli",
      "Hydro",
      "Hafni",
      "Holmi"
    ],
    "answer": 1
  },
  {
    "id": "hoa_29",
    "cat": "hoa",
    "q": "Phản ứng tạo muối + nước từ axit + bazơ?",
    "choices": [
      "Oxi hóa",
      "Trung hòa",
      "Phân hủy",
      "Thế"
    ],
    "answer": 1
  },
  {
    "id": "hoa_30",
    "cat": "hoa",
    "q": "Công thức khí carbonic?",
    "choices": [
      "CO",
      "CO2",
      "C2O",
      "CH4"
    ],
    "answer": 1
  },
  {
    "id": "van_31",
    "cat": "van",
    "q": "Tác giả Truyện Kiều?",
    "choices": [
      "Nguyễn Du",
      "Nguyễn Trãi",
      "Hồ Xuân Hương",
      "Nam Cao"
    ],
    "answer": 0
  },
  {
    "id": "van_32",
    "cat": "van",
    "q": "Thể thơ lục bát có mấy chữ dòng 6?",
    "choices": [
      "4",
      "5",
      "6",
      "8"
    ],
    "answer": 2
  },
  {
    "id": "van_33",
    "cat": "van",
    "q": "«Chí Phèo» của ai?",
    "choices": [
      "Nam Cao",
      "Ngô Tất Tố",
      "Vũ Trọng Phụng",
      "Tô Hoài"
    ],
    "answer": 0
  },
  {
    "id": "van_34",
    "cat": "van",
    "q": "Thủ đô văn hóa được ví trong thơ?",
    "choices": [
      "Huế",
      "Hà Nội",
      "Sài Gòn",
      "Đà Lạt"
    ],
    "answer": 1
  },
  {
    "id": "van_35",
    "cat": "van",
    "q": "Từ đồng nghĩa với «vui vẻ»?",
    "choices": [
      "Buồn",
      "Vui",
      "Giận",
      "Mệt"
    ],
    "answer": 1
  },
  {
    "id": "van_36",
    "cat": "van",
    "q": "Câu cảm thán thường kết thúc bằng?",
    "choices": [
      ".",
      ",",
      "!",
      "?"
    ],
    "answer": 2
  },
  {
    "id": "van_37",
    "cat": "van",
    "q": "Truyện ngắn «Lão Hạc» của?",
    "choices": [
      "Nam Cao",
      "Nguyễn Công Hoan",
      "Thạch Lam",
      "Nguyễn Huy Thiệp"
    ],
    "answer": 0
  },
  {
    "id": "van_38",
    "cat": "van",
    "q": "«Đất nước» là?",
    "choices": [
      "Danh từ",
      "Động từ",
      "Tính từ",
      "Trạng từ"
    ],
    "answer": 0
  },
  {
    "id": "van_39",
    "cat": "van",
    "q": "Tác phẩm «Dế Mèn phiêu lưu ký» của?",
    "choices": [
      "Tô Hoài",
      "Xuân Diệu",
      "Hàn Mặc Tử",
      "Chế Lan Viên"
    ],
    "answer": 0
  },
  {
    "id": "van_40",
    "cat": "van",
    "q": "Vần trong thơ là sự?",
    "choices": [
      "Lặp âm cuối",
      "Lặp chữ đầu",
      "Đảo ngữ",
      "Ẩn dụ"
    ],
    "answer": 0
  },
  {
    "id": "ly_41",
    "cat": "ly",
    "q": "Đơn vị lực trong SI?",
    "choices": [
      "Joule",
      "Newton",
      "Watt",
      "Pascal"
    ],
    "answer": 1
  },
  {
    "id": "ly_42",
    "cat": "ly",
    "q": "Tốc độ ánh sáng xấp xỉ?",
    "choices": [
      "3×10^8 m/s",
      "3×10^5 m/s",
      "300 m/s",
      "3 m/s"
    ],
    "answer": 0
  },
  {
    "id": "ly_43",
    "cat": "ly",
    "q": "Nhiệt độ đông đặc của nước (1atm)?",
    "choices": [
      "0°C",
      "100°C",
      "-10°C",
      "37°C"
    ],
    "answer": 0
  },
  {
    "id": "ly_44",
    "cat": "ly",
    "q": "Điện trở đơn vị?",
    "choices": [
      "Vôn",
      "Ampe",
      "Ohm",
      "Farad"
    ],
    "answer": 2
  },
  {
    "id": "ly_45",
    "cat": "ly",
    "q": "Trái Đất quay quanh?",
    "choices": [
      "Mặt Trăng",
      "Mặt Trời",
      "Sao Hỏa",
      "Chính nó thôi"
    ],
    "answer": 1
  },
  {
    "id": "ly_46",
    "cat": "ly",
    "q": "Âm thanh truyền trong?",
    "choices": [
      "Chân không",
      "Không khí",
      "Không gian tuyệt đối",
      "Hạ nguyên tử"
    ],
    "answer": 1
  },
  {
    "id": "ly_47",
    "cat": "ly",
    "q": "Gia tốc trọng trường ~?",
    "choices": [
      "9,8 m/s²",
      "3 m/s²",
      "1 m/s²",
      "98 m/s²"
    ],
    "answer": 0
  },
  {
    "id": "ly_48",
    "cat": "ly",
    "q": "Năng lượng đơn vị SI?",
    "choices": [
      "Watt",
      "Joule",
      "Newton",
      "Coulomb"
    ],
    "answer": 1
  },
  {
    "id": "ly_49",
    "cat": "ly",
    "q": "Gương phẳng tạo ảnh?",
    "choices": [
      "Thật lớn",
      "Ảo bằng vật",
      "Thật nhỏ",
      "Không ảnh"
    ],
    "answer": 1
  },
  {
    "id": "ly_50",
    "cat": "ly",
    "q": "Dòng điện một chiều viết tắt?",
    "choices": [
      "AC",
      "DC",
      "RF",
      "EM"
    ],
    "answer": 1
  },
  {
    "id": "xh_51",
    "cat": "xh",
    "q": "Thủ đô Việt Nam?",
    "choices": [
      "Huế",
      "Hà Nội",
      "TP.HCM",
      "Đà Nẵng"
    ],
    "answer": 1
  },
  {
    "id": "xh_52",
    "cat": "xh",
    "q": "Ngày Quốc khánh Việt Nam?",
    "choices": [
      "30/4",
      "2/9",
      "1/5",
      "19/8"
    ],
    "answer": 1
  },
  {
    "id": "xh_53",
    "cat": "xh",
    "q": "Châu lục Việt Nam thuộc?",
    "choices": [
      "Âu",
      "Á",
      "Phi",
      "Mỹ"
    ],
    "answer": 1
  },
  {
    "id": "xh_54",
    "cat": "xh",
    "q": "Biển lớn nhất thế giới?",
    "choices": [
      "Địa Trung Hải",
      "Thái Bình Dương",
      "Đen",
      "Đỏ"
    ],
    "answer": 1
  },
  {
    "id": "xh_55",
    "cat": "xh",
    "q": "Liên Hợp Quốc viết tắt?",
    "choices": [
      "WHO",
      "UN",
      "NATO",
      "ASEAN"
    ],
    "answer": 1
  },
  {
    "id": "xh_56",
    "cat": "xh",
    "q": "Tiền Việt Nam?",
    "choices": [
      "USD",
      "VND",
      "EUR",
      "JPY"
    ],
    "answer": 1
  },
  {
    "id": "xh_57",
    "cat": "xh",
    "q": "Tết Nguyên đán theo lịch?",
    "choices": [
      "Dương",
      "Âm",
      "Hồi giáo",
      "Julian"
    ],
    "answer": 1
  },
  {
    "id": "xh_58",
    "cat": "xh",
    "q": "ASEAN là tổ chức?",
    "choices": [
      "Quân sự",
      "Đông Nam Á",
      "Châu Âu",
      "Tài chính Mỹ"
    ],
    "answer": 1
  },
  {
    "id": "xh_59",
    "cat": "xh",
    "q": "Núi cao nhất Việt Nam?",
    "choices": [
      "Ba Vì",
      "Fansipan",
      "Bà Đen",
      "Lang Biang"
    ],
    "answer": 1
  },
  {
    "id": "xh_60",
    "cat": "xh",
    "q": "Sông dài nhất Việt Nam?",
    "choices": [
      "Hồng",
      "Mê Kông (đoạn VN)",
      "Đà",
      "Đồng Nai"
    ],
    "answer": 1
  },
  {
    "id": "toan_61",
    "cat": "toan",
    "q": "12 ÷ 4 = ?",
    "choices": [
      "2",
      "3",
      "4",
      "6"
    ],
    "answer": 1
  },
  {
    "id": "sinh_62",
    "cat": "sinh",
    "q": "Tim người có mấy ngăn?",
    "choices": [
      "2",
      "3",
      "4",
      "5"
    ],
    "answer": 2
  },
  {
    "id": "hoa_63",
    "cat": "hoa",
    "q": "Kim loại lỏng ở nhiệt độ phòng?",
    "choices": [
      "Sắt",
      "Thủy ngân",
      "Đồng",
      "Nhôm"
    ],
    "answer": 1
  },
  {
    "id": "van_64",
    "cat": "van",
    "q": "Bút danh của nhà thơ Hàn Mặc Tử gắn với?",
    "choices": [
      "Trăng",
      "Biển",
      "Núi",
      "Sông"
    ],
    "answer": 0
  },
  {
    "id": "ly_65",
    "cat": "ly",
    "q": "Công thức v = s/t là?",
    "choices": [
      "Vận tốc",
      "Gia tốc",
      "Lực",
      "Công"
    ],
    "answer": 0
  },
  {
    "id": "xh_66",
    "cat": "xh",
    "q": "Việt Nam gia nhập LHQ năm?",
    "choices": [
      "1975",
      "1977",
      "1986",
      "1995"
    ],
    "answer": 1
  }
];

const TRIAL_SIZE = 5;
const INNOCENT_REWARD = 500; // in-game coins (future: real top-up reward)
const YEAR_ONLINE_MS = 120 * 60 * 60 * 1000; // 120 hours

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickTrialQuestions() {
  if (QUESTIONS.length < TRIAL_SIZE) throw new Error('question bank too small');
  return shuffle(QUESTIONS).slice(0, TRIAL_SIZE).map((q) => ({
    id: q.id,
    cat: q.cat,
    q: q.q,
    choices: q.choices.slice(),
  }));
}

function gradeTrial(answers) {
  // answers: [{ id, choiceIndex }]
  const byId = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
  let correct = 0;
  const detail = [];
  for (const a of (answers || []).slice(0, TRIAL_SIZE)) {
    const q = byId[a.id];
    if (!q) continue;
    const ok = Number(a.choiceIndex) === q.answer;
    if (ok) correct += 1;
    detail.push({ id: q.id, ok, correctIndex: q.answer });
  }
  // If fewer than 5 answered, remaining count as wrong
  const answered = detail.length;
  const wrong = TRIAL_SIZE - correct;
  const years = wrong; // 0 → innocent; 1..5 → years
  return {
    correct,
    wrong,
    total: TRIAL_SIZE,
    answered,
    years,
    innocent: wrong === 0,
    detail,
    reward: wrong === 0 ? INNOCENT_REWARD : 0,
  };
}

function publicQuestionBankMeta() {
  return { count: QUESTIONS.length, trialSize: TRIAL_SIZE, cats: ['toan','sinh','hoa','van','ly','xh'] };
}

module.exports = {
  QUESTIONS,
  TRIAL_SIZE,
  INNOCENT_REWARD,
  YEAR_ONLINE_MS,
  pickTrialQuestions,
  gradeTrial,
  publicQuestionBankMeta,
};
