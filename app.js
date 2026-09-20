const app = document.getElementById('app');
const overlay = document.getElementById('overlay');
const toastNode = document.getElementById('toast');
const STORE_KEY = 'dau-an-hcm-session';
let session = loadSession();
let state = null;
let networkInfo = { lanUrls: [] };
let fetching = false;
let editorOpen = false;
let editorQuestions = [];
let editorDuration = 30;
let toastTimer;
let serverOffset = 0;
let lastVersion = -1;
let answerDraft = '';
let targetDraft = '';
let composing = false;
let demoPendingBegin = false;

function loadSession() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return null; } }
function saveSession(value) { session = value; answerDraft = ''; targetDraft = ''; if (value) localStorage.setItem(STORE_KEY, JSON.stringify(value)); else localStorage.removeItem(STORE_KEY); }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
function safeHref(value) { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
function nowServer() { return Date.now() - serverOffset; }
function notify(message) { toastNode.textContent = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastNode.textContent = ''; }, 3800); }
async function api(path, { method = 'GET', data, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token || session?.token) headers.Authorization = `Bearer ${token || session.token}`;
  const response = await fetch(path, { method, headers, body: data === undefined ? undefined : JSON.stringify(data), cache: 'no-store' });
  let result;
  try { result = await response.json(); } catch { throw new Error('Không đọc được phản hồi từ máy chủ.'); }
  if (!response.ok) throw new Error(result.error || 'Có lỗi xảy ra.');
  return result;
}
async function action(name, data = {}, token) {
  const result = await api(`/api/rooms/${session.code}/${name}`, { method: 'POST', data, token });
  await refresh(true);
  return result;
}
function header(room = false) {
  return `<header class="topbar"><a class="brand" href="/" data-action="home"><span class="brand-mark" aria-hidden="true">★</span><span class="brand-words"><strong>Dấu ấn Hồ Chí Minh</strong><small>Webgame tư tưởng Hồ Chí Minh</small></span></a>${room ? `<div class="top-right"><span class="room-tag">PHÒNG ${esc(state.code)}</span><span class="role-tag">${state.role === 'host' ? 'Người dẫn' : 'Nhóm chơi'}</span><button class="text-button" data-action="home">Rời phòng</button></div>` : ''}</header>`;
}
function page(content, room = false) { return `<div class="shell">${header(room)}${content}</div>`; }
function landing() {
  return page(`<main class="hero"><div><div class="eyebrow">Trò chơi tương tác dành cho lớp học</div><h1>Học lịch sử.<em>Chơi hết mình.</em></h1><p class="lead">Cùng đồng đội giải ô chữ, thử vận may với vòng quay và ghi điểm trước khi thời gian khép lại.</p><div class="hero-actions"><button class="btn large" data-action="create">Tạo phòng chơi <span aria-hidden="true">↗</span></button><button class="btn secondary large" data-action="join-screen">Vào phòng</button><button class="btn ghost large" data-action="demo">Chơi thử một mình</button></div><p class="hint-line">Mỗi nhóm dùng một điện thoại. Người dẫn điều khiển trận trên máy tính.</p></div><div class="hero-art" aria-hidden="true"><div class="hero-emblem"><span class="emblem-star">★</span><b>Tri thức là<br>sức mạnh</b><small>Khám phá · Ghi nhớ · Tranh tài</small></div><span class="art-note">Hành trình qua những dấu mốc và tư tưởng</span></div></main>`);
}
function joinPage() {
  const room = new URLSearchParams(location.search).get('room') || '';
  return page(`<main class="entry"><div class="eyebrow">Tham gia trận đấu</div><h2>Vào phòng</h2><p class="muted">Nhập mã phòng trên màn hình người dẫn và đặt tên nhóm của bạn.</p><form id="join-form"><div class="field"><label for="room-code">Mã phòng gồm 6 số</label><input id="room-code" class="input code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required value="${esc(room)}" placeholder="000000"></div><div class="field"><label for="team-name">Tên nhóm</label><input id="team-name" class="input" name="name" maxlength="28" required minlength="2" placeholder="Ví dụ: Sao Vàng"></div><button class="btn full" type="submit">Tham gia phòng</button></form><div class="entry-footer"><button class="text-button" data-action="home">← Quay về</button><span class="small muted">Tối đa 20 nhóm</span></div></main>`);
}
function intro(title, subtitle, eyebrow) {
  return `<div class="page-intro"><div><div class="eyebrow">${esc(eyebrow)}</div><h2>${esc(title)}${session?.demo ? '<span class="demo-flag">Chơi thử</span>' : ''}</h2><p class="muted">${esc(subtitle)}</p></div></div>`;
}
function playerList(mode = 'score') {
  const items = state.players.map(p => `<li><span><span class="rank-badge">${mode === 'score' ? String(p.rank).padStart(2, '0') : '★'}</span><strong>${esc(p.name)}</strong>${p.id === state.me?.id ? ' <small>(bạn)</small>' : ''}</span><span class="${mode === 'score' ? 'score' : `status-chip ${p.spun ? '' : 'wait'}`}">${mode === 'score' ? `${p.score} điểm` : p.spun ? 'Đã quay' : 'Chưa quay'}</span></li>`).join('');
  return `<ul class="side-list">${items || '<li class="muted">Chưa có nhóm nào tham gia.</li>'}</ul>`;
}
function sidebar(mode = 'score') {
  return `<aside class="panel"><div class="panel-title">${mode === 'spin' ? 'Lượt quay của các nhóm' : 'Bảng xếp hạng'}</div>${playerList(mode)}${state.phase === 'question' ? '<p class="hint-line">Điểm tăng khi trả lời sớm. Câu sai sẽ phải chờ 2 giây.</p>' : ''}</aside>`;
}
function shareLink() {
  const lan = networkInfo.lanUrls[0];
  const base = lan || location.origin;
  return `${base}/?room=${state.code}`;
}
function alternateLinks() {
  return networkInfo.lanUrls.slice(1).map(base => `<div class="small muted">Mạng khác: ${esc(`${base}/?room=${state.code}`)}</div>`).join('');
}
function lobby() {
  const host = state.role === 'host';
  const body = host ? `<div class="panel"><div class="panel-title">Mã phòng của bạn</div><div class="code-display">${esc(state.code)}</div><p>Cho các nhóm mở đường dẫn dưới đây trên thiết bị cùng mạng Wi-Fi, sau đó nhập mã phòng.</p><span class="share-url">${esc(shareLink())}</span>${alternateLinks()}<div class="host-actions"><button class="btn secondary" data-action="copy-link">Sao chép đường dẫn</button><button class="btn ghost" data-action="edit">Chỉnh câu hỏi & thời gian</button></div><div class="rule-strip"><div><b>${state.totalQuestions}</b><span>Câu hỏi</span></div><div><b>${state.durationSec}s</b><span>Mỗi câu</span></div><div><b>${state.players.length}</b><span>Nhóm đã vào</span></div></div><div class="host-actions"><button class="btn large" data-action="next" ${state.players.length ? '' : 'disabled'}>Bắt đầu trận đấu →</button></div></div>` : `<div class="panel"><div class="panel-title">Sẵn sàng tranh tài</div><h3>Chào ${esc(state.me.name)}!</h3><p class="lead">Bạn đã vào phòng. Khi người dẫn bắt đầu, mỗi nhóm sẽ quay vòng quay để nhận một vật phẩm cho câu đầu tiên.</p><div class="rule-strip"><div><b>${state.totalQuestions}</b><span>Câu hỏi</span></div><div><b>${state.durationSec}s</b><span>Mỗi câu</span></div><div><b>01</b><span>Vật phẩm mỗi câu</span></div></div><p class="hint-line">Hãy giữ tab này mở. Nếu kết nối gián đoạn, mở lại trang trên cùng thiết bị để tiếp tục.</p></div>`;
  return page(`${intro(host ? 'Sảnh chờ' : 'Đang chờ bắt đầu', host ? 'Mời các nhóm vào phòng trước khi bắt đầu.' : `Phòng ${state.code} · Người dẫn đang chuẩn bị trận đấu.`, 'Giai đoạn chuẩn bị')}<div class="layout"><main>${body}</main>${sidebar()}</div>`, true);
}
function wheelGraphic(spinning = false, item = 'shield') { const offset = { shield: 0, hint: 270, bonus: 180, fog: 90 }[item] || 0; return `<div class="wheel-wrap" aria-hidden="true"><span class="wheel-pointer"></span><div class="wheel ${spinning ? 'spinning' : ''}" style="--final-angle:${1440 + offset}deg"><span class="wheel-label one">KHIÊN</span><span class="wheel-label two">GỢI Ý</span><span class="wheel-label three">CỘNG ĐIỂM</span><span class="wheel-label four">MÀN SƯƠNG</span></div></div>`; }
function itemCard(item, used = false) {
  const entry = state.itemCatalog[item];
  return `<div class="item-card"><span class="icon" aria-hidden="true">${esc(entry.icon)}</span><div><b>${esc(entry.name)}</b>${used ? ' · Đã dùng' : ''}</div><p>${esc(entry.description)}</p></div>`;
}
function wheelPage() {
  const host = state.role === 'host';
  const pending = state.players.filter(p => !p.spun).length;
  const main = host ? `<div class="panel"><div class="panel-title">Câu ${state.questionIndex + 1} / ${state.totalQuestions} · Vòng quay</div><div class="wheel-area">${wheelGraphic()}<div><h3>Vận may trước thử thách</h3><p>Mỗi nhóm quay một lượt để nhận vật phẩm. Khi tất cả đã quay, bạn có thể mở câu hỏi.</p><p class="muted">${pending ? `Còn ${pending} nhóm chưa quay.` : 'Tất cả đã quay. Câu hỏi đã sẵn sàng.'}</p><div class="host-actions">${pending ? '<button class="btn ghost" data-action="spin-missing">Quay hộ nhóm chưa quay</button>' : ''}<button class="btn" data-action="begin" ${pending ? 'disabled' : ''}>Mở câu hỏi →</button></div></div></div></div>` : `<div class="panel"><div class="panel-title">Câu ${state.questionIndex + 1} / ${state.totalQuestions} · Vòng quay</div><div class="wheel-area">${wheelGraphic()}<div><h3>${state.me.item ? 'Vật phẩm của bạn' : 'Đến lượt bạn quay!'}</h3><p>Vòng quay sẽ quyết định lợi thế của nhóm bạn trong câu hỏi này.</p>${state.me.item ? itemCard(state.me.item) : '<button class="btn large" data-action="spin">Quay vòng quay ✦</button>'}${state.me.item ? session.demo ? '<button class="btn" data-action="begin">Mở câu hỏi →</button>' : '<p class="hint-line">Chờ người dẫn mở câu hỏi. Vật phẩm có thể dùng một lần trong lượt.</p>' : ''}</div></div></div>`;
  return page(`${intro('Vòng quay may mắn', 'Một vật phẩm cho mỗi nhóm ở mỗi câu.', `Chặng ${String(state.questionIndex + 1).padStart(2, '0')}`)}<div class="layout"><main>${main}</main>${sidebar('spin')}</div>`, true);
}
function slotHtml(slot) {
  if (slot.separator && slot.text === ' ') return '<span class="slot sep" aria-label="khoảng trắng"></span>';
  if (slot.separator) return `<span class="slot punct">${esc(slot.text)}</span>`;
  return `<span class="slot ${slot.open ? '' : 'hidden'}">${slot.open ? esc(slot.text) : '·'}</span>`;
}
function slotsHtml(slots) {
  const parts = [];
  let word = [];
  const flush = () => { if (word.length) { parts.push(`<span class="slot-word">${word.join('')}</span>`); word = []; } };
  for (const slot of slots) {
    if (slot.separator && slot.text === ' ') { flush(); parts.push(slotHtml(slot)); }
    else word.push(slotHtml(slot));
  }
  flush();
  return parts.join('');
}
function questionPage() {
  const q = state.question;
  const timeLeft = Math.max(0, Math.ceil((state.startedAt + state.durationSec * 1000 - nowServer()) / 1000));
  const percent = Math.max(0, Math.min(100, 100 * timeLeft / state.durationSec));
  const host = state.role === 'host';
  const fog = !host && state.me.fogUntil > nowServer();
  const item = state.me?.item;
  const targets = state.players.filter(p => p.id !== state.me?.id && !p.solved);
  const canUse = !host && !state.me.itemUsed && !state.me.solved;
  const itemActions = canUse ? item === 'fog' ? `<div class="item-actions"><select id="target-select" aria-label="Chọn nhóm đối thủ"><option value="">Chọn đối thủ</option>${targets.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select><button class="btn tiny" data-action="use-item" ${targets.length ? '' : 'disabled'}>Dùng Màn sương</button></div>` : `<div class="item-actions"><button class="btn tiny" data-action="use-item">Dùng ${esc(state.itemCatalog[item]?.name)}</button></div>` : '';
  const feedback = state.me?.feedback ? `<div class="feedback ${esc(state.me.feedback.kind)}">${esc(state.me.feedback.text)}</div>` : '';
  const wrongWait = state.me && state.me.wrongUntil > nowServer();
  const form = host ? '<p class="hint-line">Câu hỏi sẽ tự kết thúc khi hết giờ hoặc tất cả nhóm trả lời đúng.</p>' : state.me.solved ? `<div class="feedback correct">Nhóm bạn đã trả lời đúng và nhận ${state.me.roundPoints} điểm. Chờ các nhóm khác.</div>` : `<form id="answer-form" class="answer-form"><input class="input" id="answer-input" name="answer" maxlength="100" autocomplete="off" autocapitalize="sentences" placeholder="Nhập đáp án của nhóm..." aria-label="Nhập đáp án" required><button class="btn" type="submit" ${wrongWait ? 'disabled' : ''}>Trả lời →</button></form>${feedback}`;
  const main = `<div class="panel"><div class="timer-row"><div><div class="kicker">Câu ${state.questionIndex + 1} / ${state.totalQuestions}</div><div class="muted">Mỗi giây hé một ký tự</div></div><div class="timer ${timeLeft <= 5 ? 'urgent' : ''}">${String(timeLeft).padStart(2, '0')}<small> giây</small></div></div><div class="timer-track"><div class="timer-fill" style="width:${percent}%"></div></div><h3 class="question-heading">${esc(q.prompt)}</h3><div class="slots ${fog ? 'fogged' : ''}" aria-label="Ô chữ đáp án">${slotsHtml(q.slots)}</div>${fog ? '<p class="hint-line">Màn sương đang che ô chữ. Bạn vẫn có thể nhập đáp án.</p>' : ''}${form}</div>`;
  return page(`${intro('Giải ô chữ', 'Trả lời càng sớm, điểm càng cao.', 'Thử thách đang diễn ra')}<div class="layout"><main>${main}</main><aside><div class="panel"><div class="panel-title">${host ? 'Bảng xếp hạng' : 'Vật phẩm của nhóm'}</div>${host ? playerList() : `${itemCard(item, state.me.itemUsed)}${itemActions}`}</div>${host ? '' : `<div class="panel"><div class="panel-title">Bảng xếp hạng</div>${playerList()}</div>`}</aside></div>`, true);
}
function sourceHtml(q) { const href = safeHref(q.source); return href ? `<p class="source">Nguồn tham khảo: <a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(q.source)}</a></p>` : ''; }
function revealPage() {
  const q = state.question;
  const host = state.role === 'host' || session.demo;
  return page(`${intro('Đáp án & kết quả', 'Một chặng đã hoàn thành. Cùng nhìn lại kiến thức và điểm số.', `Câu ${state.questionIndex + 1} / ${state.totalQuestions}`)}<div class="layout"><main><div class="panel"><div class="panel-title">Đáp án chính xác</div><div class="result-answer">${esc(q.answer)}</div><p>${esc(q.explanation || 'Hãy cùng trao đổi thêm về nội dung câu hỏi.')}</p>${sourceHtml(q)}${host ? `<div class="host-actions"><button class="btn large" data-action="next">${state.questionIndex + 1 >= state.totalQuestions ? 'Xem kết quả chung cuộc →' : 'Câu tiếp theo →'}</button></div>` : '<p class="hint-line">Chờ người dẫn chuyển câu tiếp theo.</p>'}</div></main>${sidebar()}</div>`, true);
}
function finalPage() {
  const winners = state.players.filter(p => p.rank === 1).map(p => esc(p.name));
  const winnerNames = winners.length > 1 ? `${winners.slice(0, -1).join(', ')} và ${winners.at(-1)}` : winners[0] || 'các nhóm';
  return page(`${intro('Bảng vàng tri thức', 'Cuộc tranh tài đã khép lại.', 'Kết quả chung cuộc')}<div class="layout"><main><div class="panel"><div class="finish-burst" aria-hidden="true">✶</div><h3>Chúc mừng ${winnerNames}!</h3><p class="lead">Cảm ơn các nhóm đã cùng khám phá những dấu mốc lịch sử và tư tưởng Hồ Chí Minh.</p><div>${state.players.map(p => `<div class="leader-row"><span class="rank">${p.rank}</span><span><strong>${esc(p.name)}</strong>${p.id === state.me?.id ? '<small>Nhóm của bạn</small>' : ''}</span><b>${p.score} điểm</b></div>`).join('')}</div><div class="host-actions"><button class="btn secondary" data-action="home">Về trang đầu</button></div></div></main><aside class="panel"><div class="panel-title">Hành trình đã qua</div><div class="rule-strip"><div><b>${state.totalQuestions}</b><span>Câu hỏi</span></div><div><b>${state.players.length}</b><span>Nhóm chơi</span></div><div><b>${state.durationSec}s</b><span>Mỗi câu</span></div></div><p class="hint-line">Các nhóm cùng điểm có cùng thứ hạng.</p></aside></div>`, true);
}
function render() {
  if (editorOpen || composing) return;
  const active = document.activeElement;
  const answerFocused = active?.id === 'answer-input';
  const existingAnswer = document.getElementById('answer-input');
  const existingTarget = document.getElementById('target-select');
  if (existingAnswer) answerDraft = existingAnswer.value;
  if (existingTarget) targetDraft = existingTarget.value;
  const caret = answerFocused ? active.selectionStart : 0;
  if (!session) { app.innerHTML = location.pathname === '/join' || new URLSearchParams(location.search).has('room') ? joinPage() : landing(); return; }
  if (!state) { app.innerHTML = page('<main class="loading"><h2>Đang kết nối...</h2><p>Vui lòng chờ trong giây lát.</p></main>'); return; }
  app.innerHTML = state.phase === 'lobby' ? lobby() : state.phase === 'wheel' ? wheelPage() : state.phase === 'question' ? questionPage() : state.phase === 'reveal' ? revealPage() : finalPage();
  const input = document.getElementById('answer-input');
  if (input) { input.value = answerDraft; if (answerFocused) { input.focus(); input.setSelectionRange(caret, caret); } }
  const select = document.getElementById('target-select');
  if (select) select.value = targetDraft;
}
function updateQuestionDynamic() {
  if (state?.phase !== 'question' || composing) return;
  const q = state.question;
  const left = Math.max(0, Math.ceil((state.startedAt + state.durationSec * 1000 - nowServer()) / 1000));
  const timer = document.querySelector('.timer');
  if (timer) { timer.innerHTML = `${String(left).padStart(2, '0')}<small> giây</small>`; timer.classList.toggle('urgent', left <= 5); }
  const fill = document.querySelector('.timer-fill');
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, 100 * left / state.durationSec))}%`;
  const slots = document.querySelector('.slots');
  if (slots) { slots.innerHTML = slotsHtml(q.slots); slots.classList.toggle('fogged', Boolean(state.me && state.me.fogUntil > nowServer())); }
  const submit = document.querySelector('#answer-form button[type=submit]');
  if (submit) submit.disabled = Boolean(state.me?.wrongUntil > nowServer());
}
async function refresh(force = false) {
  if (!session || fetching) return;
  fetching = true;
  const current = session;
  try {
    const fresh = await api(`/api/rooms/${current.code}/state`);
    if (session !== current) return;
    serverOffset = Date.now() - fresh.serverNow;
    const changed = !state || state.phase !== fresh.phase || state.version !== fresh.version;
    if (state && state.questionIndex !== fresh.questionIndex) { answerDraft = ''; targetDraft = ''; }
    state = fresh;
    if (force || changed) render();
    else if (state.phase === 'question') updateQuestionDynamic();
    lastVersion = fresh.version;
  } catch (error) {
    if (session !== current) return;
    if (/không hợp lệ|Không tìm thấy phòng/.test(error.message)) { saveSession(null); state = null; render(); }
    notify(error.message);
  } finally { fetching = false; }
}
function openEditor() {
  editorQuestions = structuredClone(state.questions);
  editorDuration = state.durationSec;
  editorOpen = true;
  drawEditor();
}
function drawEditor() {
  overlay.innerHTML = `<div class="editor-backdrop"><section class="editor" role="dialog" aria-modal="true" aria-label="Chỉnh bộ câu hỏi"><div class="editor-header"><div><div class="eyebrow">Thiết lập trước trận</div><h2>Biên tập câu hỏi</h2><p class="muted">Chỉnh đáp án, cách viết tương đương và nguồn theo giáo trình của lớp.</p></div><button class="text-button" data-action="close-editor">Đóng ×</button></div><form id="editor-form"><div class="field"><label for="duration">Thời gian mỗi câu (10–90 giây)</label><input id="duration" name="duration" class="input" type="number" min="10" max="90" value="${esc(editorDuration)}" required></div><div id="editor-list">${editorQuestions.map((q, i) => `<article class="question-edit" data-index="${i}"><div class="editor-header"><h3>Câu ${i + 1}</h3><button type="button" class="text-button" data-action="remove-question" data-index="${i}" ${editorQuestions.length <= 1 ? 'disabled' : ''}>Xóa câu</button></div><div class="field"><label>Đề bài</label><textarea name="prompt" required maxlength="400">${esc(q.prompt)}</textarea></div><div class="field"><label>Đáp án</label><input class="input" name="answer" required maxlength="80" value="${esc(q.answer)}"></div><div class="field"><label>Đáp án tương đương, mỗi dòng một cách viết</label><textarea name="aliases">${esc(q.aliases.join('\n'))}</textarea></div><div class="field"><label>Giải thích khi kết thúc câu</label><textarea name="explanation" maxlength="700">${esc(q.explanation)}</textarea></div><div class="field"><label>Đường dẫn nguồn tham khảo</label><input class="input" name="source" maxlength="400" value="${esc(q.source)}"></div></article>`).join('')}</div><div class="editor-footer"><button type="button" class="btn ghost" data-action="add-question" ${editorQuestions.length >= 30 ? 'disabled' : ''}>+ Thêm câu</button><button type="submit" class="btn">Lưu bộ câu hỏi</button></div></form></section></div>`;
}
function readEditor() {
  editorDuration = document.getElementById('duration')?.value ?? editorDuration;
  editorQuestions = [...document.querySelectorAll('.question-edit')].map(card => ({
    prompt: card.querySelector('[name=prompt]').value,
    answer: card.querySelector('[name=answer]').value,
    aliases: card.querySelector('[name=aliases]').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean),
    explanation: card.querySelector('[name=explanation]').value,
    source: card.querySelector('[name=source]').value
  }));
}
function closeEditor() { editorOpen = false; overlay.innerHTML = ''; render(); }
function spinAnimation(item) {
  const entry = state.itemCatalog[item];
  overlay.innerHTML = `<div class="spin-modal"><div class="spin-box"><div class="eyebrow">Vòng quay may mắn</div>${wheelGraphic(true, item)}<h3>Đang chọn vật phẩm...</h3></div></div>`;
  setTimeout(() => {
    overlay.innerHTML = `<div class="spin-modal"><div class="spin-box"><div class="eyebrow">Bạn nhận được</div><div class="finish-burst">${esc(entry.icon)}</div><h2>${esc(entry.name)}</h2><p>${esc(entry.description)}</p><button class="btn" data-action="close-spin">Tiếp tục</button></div></div>`;
  }, 2400);
}

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  event.preventDefault();
  const name = button.dataset.action;
  try {
    if (name === 'home') { saveSession(null); state = null; history.replaceState(null, '', '/'); closeEditor(); return; }
    if (name === 'join-screen') { history.pushState(null, '', '/join'); render(); return; }
    if (name === 'create') {
      button.disabled = true;
      const made = await api('/api/rooms', { method: 'POST', data: {} });
      saveSession({ code: made.code, token: made.token, demo: false });
      history.replaceState(null, '', '/'); await refresh(true); return;
    }
    if (name === 'demo') {
      button.disabled = true;
      const made = await api('/api/rooms', { method: 'POST', data: {} });
      const joined = await api(`/api/rooms/${made.code}/join`, { method: 'POST', data: { name: 'Nhóm chơi thử' }, token: '' });
      saveSession({ code: made.code, token: joined.token, demo: true, demoHostToken: made.token });
      await action('next', {}, made.token); return;
    }
    if (name === 'copy-link') { await navigator.clipboard.writeText(shareLink()); notify('Đã sao chép đường dẫn vào phòng.'); return; }
    if (name === 'edit') { openEditor(); return; }
    if (name === 'close-editor') { closeEditor(); return; }
    if (name === 'add-question') { readEditor(); editorQuestions.push({ prompt: '', answer: '', aliases: [], explanation: '', source: '' }); drawEditor(); return; }
    if (name === 'remove-question') { readEditor(); editorQuestions.splice(Number(button.dataset.index), 1); drawEditor(); return; }
    if (name === 'close-spin') { overlay.innerHTML = ''; if (session.demo && demoPendingBegin) { demoPendingBegin = false; await action('begin', {}, session.demoHostToken); } return; }
    if (name === 'next') { await action('next', {}, session.demo ? session.demoHostToken : undefined); return; }
    if (name === 'spin') {
      const result = await action('spin');
      spinAnimation(result.item);
      if (session.demo) demoPendingBegin = true;
      return;
    }
    if (name === 'spin-missing') { await action('spin-missing'); notify('Đã quay hộ các nhóm chưa quay.'); return; }
    if (name === 'begin') { await action('begin', {}, session.demo ? session.demoHostToken : undefined); return; }
    if (name === 'use-item') {
      const targetId = document.getElementById('target-select')?.value;
      await action('item', { targetId }); notify('Vật phẩm đã được dùng.'); return;
    }
  } catch (error) { button.disabled = false; notify(error.message); }
});

document.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const submit = form.querySelector('[type=submit]');
  if (submit) submit.disabled = true;
  try {
    if (form.id === 'join-form') {
      const code = form.elements.namedItem('code').value.trim();
      const result = await api(`/api/rooms/${code}/join`, { method: 'POST', data: { name: form.elements.namedItem('name').value } });
      saveSession({ code, token: result.token, demo: false });
      history.replaceState(null, '', '/'); await refresh(true);
    } else if (form.id === 'answer-form') {
      const answer = form.elements.namedItem('answer').value;
      const result = await action('answer', { answer });
      if (!result.correct) notify('Chưa đúng. Bạn có thể thử lại sau 2 giây.');
    } else if (form.id === 'editor-form') {
      readEditor();
      const durationSec = Number(form.elements.namedItem('duration').value);
      await action('config', { durationSec, questions: editorQuestions });
      closeEditor(); notify('Đã lưu bộ câu hỏi.');
    }
  } catch (error) { notify(error.message); if (submit) submit.disabled = false; }
});

window.addEventListener('popstate', () => render());
document.addEventListener('compositionstart', event => { if (event.target.id === 'answer-input') composing = true; });
document.addEventListener('compositionend', event => { if (event.target.id === 'answer-input') { composing = false; answerDraft = event.target.value; render(); } });
api('/api/info').then(info => { networkInfo = info; if (state?.phase === 'lobby') render(); }).catch(() => {});
render();
refresh(true);
setInterval(() => refresh(), 850);
