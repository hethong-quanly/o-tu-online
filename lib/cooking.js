'use strict';

const QUIZ = [
  { id: 'c1', q: 'Nấu hủ tiếu, nước dùng chủ yếu từ xương gì?', choices: ['Xương ống bò', 'Xương cá', 'Xương gà ta', 'Không cần xương'], answer: 0 },
  { id: 'c2', q: 'Rang đậu phộng cho thơm thì để lửa sao?', choices: ['Lửa thật lớn', 'Lửa vừa, đảo đều', 'Không cần lửa', 'Luộc trước'], answer: 1 },
  { id: 'c3', q: 'Nêm canh chua miền Nam thường có?', choices: ['Me / trái thơm', 'Tương bần', 'Mù tạt', 'Sốt cà'], answer: 0 },
  { id: 'c4', q: 'Cơm suất trại muốn tơi thì?', choices: ['Đổ nước ít', 'Vo gạo, tỷ lệ nước vừa, để hơi', 'Không vo gạo', 'Nấu khô hoàn toàn'], answer: 1 },
  { id: 'c5', q: 'Chiên đồ ăn dùng dầu, khi dầu già thì?', choices: ['Tiếp tục dùng mãi', 'Đổi dầu, tránh khét', 'Thêm nước', 'Tắt bếp bỏ đi luôn'], answer: 1 },
  { id: 'c6', q: 'Làm gỏi cuốn, bánh tráng nên?', choices: ['Nhúng nhanh cho mềm', 'Ngâm nửa tiếng', 'Chiên giòn trước', 'Không cần nước'], answer: 0 },
  { id: 'c7', q: 'Kho cá bằng gì cho đậm đà miền Nam?', choices: ['Nước mắm + đường', 'Chỉ muối', 'Chỉ tiêu', 'Sữa đặc'], answer: 0 },
  { id: 'c8', q: 'Nấu canh bí đỏ nên?', choices: ['Nêm sớm khi bí còn sống', 'Nêm khi bí chín mềm', 'Không nêm', 'Cho đá lạnh'], answer: 1 },
  { id: 'c9', q: 'Luộc rau muống xanh giòn thì?', choices: ['Luộc lửa lớn, nước sôi già', 'Luộc lửa nhỏ lâu', 'Ngâm nước đá trước 1 giờ', 'Không cần nước sôi'], answer: 0 },
  { id: 'c10', q: 'Làm nước chấm đồ luộc miền Nam thường có?', choices: ['Nước mắm + ớt + tỏi + chanh', 'Chỉ tương đen', 'Chỉ mayonnaise', 'Sốt cà chua'], answer: 0 },
  { id: 'c11', q: 'Nấu chè đậu xanh mau mềm thì?', choices: ['Ngâm đậu trước', 'Không ngâm', 'Rang trước', 'Cho muối nhiều'], answer: 0 },
  { id: 'c12', q: 'Bánh xèo giòn nhờ?', choices: ['Bột pha đúng + chảo nóng', 'Bột nguội đặc', 'Không dầu', 'Hấp'], answer: 0 },
  { id: 'c13', q: 'Ướp thịt heo kho tiêu nên có?', choices: ['Nước mắm, đường, tiêu', 'Chỉ bột ngọt', 'Chỉ dầu', 'Socola'], answer: 0 },
  { id: 'c14', q: 'Nấu pasta/trại mì thì nước sôi cần?', choices: ['Muối vừa', 'Đường', 'Sữa', 'Không gì cả'], answer: 0 },
  { id: 'c15', q: 'Làm salad trái cây nên?', choices: ['Cắt gần giờ ăn, để lạnh', 'Ngâm nước từ sáng', 'Chiên trái cây', 'Rắc bột mì'], answer: 0 },
  { id: 'c16', q: 'Sơ chế gà sạch sẽ cần?', choices: ['Rửa, chặt miếng vừa', 'Để nguyên lông', 'Ngâm xăng', 'Phơi nắng'], answer: 0 },
  { id: 'c17', q: 'Nấu súp đặc hơn thì?', choices: ['Nấu giảm / thêm bột', 'Thêm đá', 'Tắt bếp ngay', 'Khuấy dầu'], answer: 0 },
  { id: 'c18', q: 'Trứng ốp la chín đều khi?', choices: ['Lửa vừa, đậy nắp nhẹ', 'Lửa tối đa luôn', 'Không dầu', 'Cho vào tủ lạnh'], answer: 0 },
  { id: 'c19', q: 'Làm nước màu kho bằng?', choices: ['Thắng đường', 'Pha cà phê', 'Mực tàu', 'Sơn'], answer: 0 },
  { id: 'c20', q: 'Bảo quản rau trong bếp nên?', choices: ['Để khô ráo, thoáng', 'Ngâm nước suốt ngày', 'Phơi ngoài nắng', 'Gói kín lúc còn ướt'], answer: 0 },
  { id: 'c21', q: 'Nêm canh chua cá lóc thường thêm?', choices: ['Cà chua, giá, rau thơm', 'Phô mai', 'Socola', 'Bơ'], answer: 0 },
  { id: 'c22', q: 'Chiên cá không dính chảo thì?', choices: ['Chảo nóng, cá lau khô', 'Cá ướt bỏ vào', 'Lửa tắt', 'Không dầu'], answer: 0 },
  { id: 'c23', q: 'Nấu cháo trắng mịn nhờ?', choices: ['Nấu lửa nhỏ, khuấy', 'Nấu khô', 'Thêm dầu nhớt', 'Không nước'], answer: 0 },
  { id: 'c24', q: 'Pha trà đá đúng vị miền Nam?', choices: ['Trà đậm + đá + đường vừa', 'Chỉ nước lọc', 'Sữa đặc không trà', 'Cà phê'], answer: 0 },
  { id: 'c25', q: 'Làm gỏi gà xé phay cần?', choices: ['Gà luộc, xé, trộn chua ngọt', 'Gà sống', 'Chiên giòn không trộn', 'Hấp không gia vị'], answer: 0 },
  { id: 'c26', q: 'Nấu đậu hũ sốt cà thì đậu nên?', choices: ['Chiên/áp chảo sơ', 'Để lạnh đông', 'Ngâm dầu nhớt', 'Không cắt'], answer: 0 },
  { id: 'c27', q: 'Kiểm tra dầu chiên đủ nóng bằng?', choices: ['Thử que gỗ/bột sủi tăm', 'Nhúng tay', 'Nhìn đồng hồ', 'Đếm sao'], answer: 0 },
  { id: 'c28', q: 'Dọn món lên khay phục vụ cần?', choices: ['Nóng/sạch, bày gọn', 'Để nguội 2 giờ', 'Trộn tất cả một thau', 'Không muỗng'], answer: 0 },
  { id: 'c29', q: 'Nấu canh chua nam bộ trái thơm thay me khi?', choices: ['Muốn vị thơm dịu', 'Muốn đắng', 'Muốn cháy', 'Không bao giờ'], answer: 0 },
  { id: 'c30', q: 'An toàn bếp: dao sắc thì?', choices: ['Cắt xa người, để đúng chỗ', 'Chạy cầm dao', 'Để dưới nền', 'Ném cho bạn'], answer: 0 },
  { id: 'c31', q: 'Làm nước màu kho bị đắng vì?', choices: ['Đường cháy quá lửa', 'Thiếu đường', 'Thừa nước đá', 'Thiếu muối biển'], answer: 0 },
  { id: 'c32', q: 'Nấu cơm cháy cố ý thì?', choices: ['Lửa nhỏ cuối nồi', 'Đổ nước thêm', 'Tắt ngay khi sôi', 'Cho đá'], answer: 0 },
  { id: 'c33', q: 'Bắp Mỹ luộc ngon hơn khi?', choices: ['Chọn bắp tươi, luộc vừa chín', 'Luộc khô không nước', 'Để tủ đông 1 tháng', 'Thêm xăng'], answer: 0 },
  { id: 'c34', q: 'Rắc mè rang lên xôi/bánh nhằm?', choices: ['Thơm béo, đẹp mắt', 'Làm đắng', 'Thay muối hẳn', 'Cho cháy'], answer: 0 },
  { id: 'c35', q: 'Múc canh bằng gì cho sạch sẽ?', choices: ['Muỗng / vá sạch', 'Tay không', 'Giẻ lau', 'Dao'], answer: 0 },
];

const COOK_STEPS = [
  { id: 'so_che', name: 'Sơ chế', emoji: '🔪', hint: 'Chạm đúng nhịp để gọt/rửa/thái', taps: 5 },
  { id: 'nau', name: 'Nấu', emoji: '🔥', hint: 'Giữ lửa vừa — chạm khi kim ở vùng xanh', taps: 5 },
  { id: 'nem', name: 'Nêm', emoji: '🧂', hint: 'Nêm 3 lần: mặn / ngọt / chua vừa', taps: 3 },
  { id: 'don', name: 'Dọn món', emoji: '🍽️', hint: 'Xếp khay nhanh gọn', taps: 4 },
];

function shuffle(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

function pickCookQuiz(n = 5) {
  return shuffle(QUIZ).slice(0, n).map((q) => ({
    id: q.id, q: q.q, choices: q.choices.slice(),
  }));
}

function gradeCookQuiz(answers) {
  const byId = Object.fromEntries(QUIZ.map((q) => [q.id, q]));
  let correct = 0;
  for (const a of (answers || []).slice(0, 5)) {
    const q = byId[a.id];
    if (q && Number(a.choiceIndex) === q.answer) correct += 1;
  }
  return { correct, total: 5, pass: correct >= 5 };
}

function scoreCookStep(stepId, taps) {
  const step = COOK_STEPS.find((s) => s.id === stepId);
  if (!step) return { ok: false, error: 'Bước không hợp lệ.' };
  const good = (taps || []).filter((t) => t && t.ok).length;
  const need = step.taps;
  const quality = Math.max(0, Math.min(100, Math.round((good / need) * 100)));
  return { ok: true, stepId, quality, good, need };
}

module.exports = {
  QUIZ,
  COOK_STEPS,
  pickCookQuiz,
  gradeCookQuiz,
  scoreCookStep,
};
