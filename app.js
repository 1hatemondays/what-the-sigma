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
let perkDraft = '';
let composing = false;

function loadSession() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return null; } }
function saveSession(value) { session = value; answerDraft = ''; targetDraft = ''; perkDraft = ''; if (value) localStorage.setItem(STORE_KEY, JSON.stringify(value)); else localStorage.removeItem(STORE_KEY); }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
function safeHref(value) { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
function nowServer() { return Date.now() - serverOffset; }
function liveBaseScore() {
  const elapsed = Math.max(0, nowServer() - state.startedAt);
  return Math.max(100, 1000 - Math.floor(900 * elapsed / (state.durationSec * 1000)));
}
function scoreMeterValues() {
  const bonus = state.me?.bonusReady ? 200 : 0;
  const score = state.me?.solved ? state.me.roundPoints : liveBaseScore() + bonus;
  return { bonus, score, percent: Math.max(0, Math.min(100, 100 * score / (1000 + bonus))) };
}
function imageRevealProgress() {
  if (state.phase !== 'question') return 1;
  return Math.max(0, Math.min(1, (nowServer() - state.startedAt) / (state.durationSec * 1000)));
}
function imageRevealStyle(progress = imageRevealProgress()) {
  return `--image-progress:${progress};--image-blur:${(1 - progress) * 24}px;--image-scale:${1.06 - progress * .06};--image-veil-opacity:${(1 - progress) * .82}`;
}
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
  return page(`<main class="hero"><div><div class="eyebrow">Trò chơi tương tác dành cho lớp học</div><h1>Học lịch sử.<em>Chơi hết mình.</em></h1><p class="lead">Cùng đồng đội giải ô chữ, thử vận may với vòng quay và ghi điểm trước khi thời gian khép lại.</p><div class="hero-actions"><button class="btn large" data-action="create">Tạo phòng chơi <span aria-hidden="true">↗</span></button><button class="btn secondary large" data-action="join-screen">Vào phòng</button><button class="btn ghost large" data-action="demo">Chơi thử một mình</button></div><p class="hint-line">Mỗi nhóm dùng một laptop. Người dẫn điều khiển trận trên máy tính riêng.</p></div><div class="hero-art" aria-hidden="true"><div class="hero-emblem"><span class="emblem-star">★</span><b>Tri thức là<br>sức mạnh</b><small>Khám phá · Ghi nhớ · Tranh tài</small></div><span class="art-note">Hành trình qua những dấu mốc và tư tưởng</span></div></main>`);
}
function openHostGate(mode) {
  const demo = mode === 'demo';
  overlay.innerHTML = `<div class="spin-modal"><section class="spin-box host-gate" role="dialog" aria-modal="true" aria-labelledby="host-gate-title"><div class="eyebrow">Dành cho người dẫn</div><h2 id="host-gate-title">${demo ? 'Mở chế độ chơi thử' : 'Tạo phòng chơi'}</h2><p>Nhập mật khẩu được hiển thị trong cửa sổ máy chủ.</p><form id="host-gate-form" data-mode="${demo ? 'demo' : 'create'}"><div class="field"><label for="host-password">Mật khẩu người dẫn</label><input id="host-password" class="input" name="password" type="password" autocomplete="current-password" required autofocus></div><div class="host-actions"><button class="btn" type="submit">${demo ? 'Bắt đầu chơi thử' : 'Tạo phòng'}</button><button class="btn ghost" type="button" data-action="close-host-gate">Hủy</button></div></form></section></div>`;
  document.getElementById('host-password')?.focus();
}
function openLeaveConfirm() {
  overlay.innerHTML = `<div class="spin-modal"><section class="spin-box host-gate leave-confirm" role="dialog" aria-modal="true" aria-labelledby="leave-confirm-title"><div class="eyebrow">Xác nhận rời phòng</div><h2 id="leave-confirm-title">Bạn có chắc chắn muốn rời?</h2><p>Nếu rời phòng, <strong>điểm số và kho chức năng của nhóm sẽ bị xóa</strong> và không thể khôi phục.</p><div class="host-actions"><button class="btn ghost" type="button" data-action="cancel-leave">Ở lại phòng</button><button class="btn" type="button" data-action="confirm-leave">Rời phòng, xóa điểm</button></div></section></div>`;
  overlay.querySelector('[data-action="cancel-leave"]')?.focus();
}
async function goHome() {
  const current = session;
  if (current && state?.role === 'player') {
    try { await api(`/api/rooms/${current.code}/leave`, { method: 'POST' }); } catch { /* Rời giao diện ngay cả khi phòng đã đóng. */ }
  }
  saveSession(null);
  state = null;
  overlay.innerHTML = '';
  editorOpen = false;
  history.replaceState(null, '', '/');
  render();
}
function joinPage() {
  const room = new URLSearchParams(location.search).get('room') || '';
  return page(`<main class="entry"><div class="eyebrow">Tham gia trận đấu</div><h2>Vào phòng</h2><p class="muted">Nhập mã phòng trên màn hình người dẫn và đặt tên nhóm của bạn.</p><form id="join-form"><div class="field"><label for="room-code">Mã phòng gồm 6 số</label><input id="room-code" class="input code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required value="${esc(room)}" placeholder="000000"></div><div class="field"><label for="team-name">Tên nhóm</label><input id="team-name" class="input" name="name" maxlength="28" required minlength="2" placeholder="Ví dụ: Sao Vàng"></div><button class="btn full" type="submit">Tham gia phòng</button></form><div class="entry-footer"><button class="text-button" data-action="home">← Quay về</button><span class="small muted">Tối đa 20 nhóm</span></div></main>`);
}
function intro(title, subtitle, eyebrow) {
  return `<div class="page-intro"><div><div class="eyebrow">${esc(eyebrow)}</div><h2>${esc(title)}${session?.demo ? '<span class="demo-flag">Chơi thử</span>' : ''}</h2><p class="muted">${esc(subtitle)}</p></div></div>`;
}
function playerList(mode = 'score') {
  const status = p => mode === 'score' ? `${p.score} điểm` : mode === 'spin' ? `${p.spinCount}/5 lượt` : p.prepared ? 'Đã chọn' : 'Chưa chọn';
  const ready = p => mode === 'spin' ? p.spun : p.prepared;
  const items = state.players.map(p => `<li><span><span class="rank-badge">${mode === 'score' ? String(p.rank).padStart(2, '0') : '★'}</span><strong>${esc(p.name)}</strong>${p.id === state.me?.id ? ' <small>(bạn)</small>' : ''}</span><span class="${mode === 'score' ? 'score' : `status-chip ${ready(p) ? '' : 'wait'}`}">${status(p)}</span></li>`).join('');
  return `<ul class="side-list">${items || '<li class="muted">Chưa có nhóm nào tham gia.</li>'}</ul>`;
}
function sidebar(mode = 'score') {
  const title = mode === 'spin' ? 'Tiến độ quay của các nhóm' : mode === 'prepare' ? 'Lựa chọn của các nhóm' : 'Bảng xếp hạng';
  return `<aside class="panel"><div class="panel-title">${title}</div>${playerList(mode)}${state.phase === 'question' ? '<p class="hint-line">Điểm tăng khi trả lời sớm. Câu sai sẽ phải chờ 2 giây.</p>' : ''}</aside>`;
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
  const body = host ? `<div class="panel"><div class="panel-title">Mã phòng của bạn</div><div class="code-display">${esc(state.code)}</div><p>Cho các nhóm mở đường dẫn dưới đây trên laptop cùng mạng Wi-Fi, sau đó nhập mã phòng.</p><span class="share-url">${esc(shareLink())}</span>${alternateLinks()}<div class="host-actions"><button class="btn secondary" data-action="copy-link">Sao chép đường dẫn</button><button class="btn ghost" data-action="edit">Chỉnh câu hỏi & thời gian</button></div><div class="rule-strip"><div><b>${state.totalQuestions}</b><span>Câu hỏi</span></div><div><b>${state.durationSec}s</b><span>Mỗi câu</span></div><div><b>${state.players.length}</b><span>Nhóm đã vào</span></div></div><div class="host-actions"><button class="btn large" data-action="next" ${state.players.length ? '' : 'disabled'}>Bắt đầu vòng quay →</button></div></div>` : `<div class="panel"><div class="panel-title">Sẵn sàng tranh tài</div><h3>Chào ${esc(state.me.name)}!</h3><p class="lead">Trước trận, nhóm bạn sẽ quay 5 lần để tích trữ chức năng. Trước mỗi câu, nhóm có thể dùng một chức năng hoặc giữ lại cho câu sau.</p><div class="rule-strip"><div><b>${state.totalQuestions}</b><span>Câu hỏi</span></div><div><b>${state.durationSec}s</b><span>Mỗi câu</span></div><div><b>05</b><span>Lượt quay trước trận</span></div></div><p class="hint-line">Hãy giữ tab này mở. Nếu kết nối gián đoạn, mở lại trang trên cùng laptop để tiếp tục.</p></div>`;
  return page(`${intro(host ? 'Sảnh chờ' : 'Đang chờ bắt đầu', host ? 'Mời các nhóm vào phòng trước khi bắt đầu.' : `Phòng ${state.code} · Người dẫn đang chuẩn bị trận đấu.`, 'Giai đoạn chuẩn bị')}<div class="layout"><main>${body}</main>${sidebar()}</div>`, true);
}
function wheelGraphic(spinning = false, item = 'shield') { const offset = { shield: 0, hint: 270, bonus: 180, fog: 90 }[item] || 0; return `<div class="wheel-wrap" aria-hidden="true"><span class="wheel-pointer"></span><div class="wheel ${spinning ? 'spinning' : ''}" style="--final-angle:${1440 + offset}deg"><span class="wheel-label one">KHIÊN</span><span class="wheel-label two">GỢI Ý</span><span class="wheel-label three">CỘNG ĐIỂM</span><span class="wheel-label four">MÀN SƯƠNG</span></div></div>`; }
function itemCard(item, used = false) {
  if (!item) return `<div class="item-card empty"><div><b>Không dùng chức năng</b></div><p>Nhóm giữ lại toàn bộ chức năng cho câu sau.</p></div>`;
  const entry = state.itemCatalog[item];
  return `<div class="item-card"><span class="icon" aria-hidden="true">${esc(entry.icon)}</span><div><b>${esc(entry.name)}</b>${used ? ' · Đã kích hoạt' : ''}</div><p>${esc(entry.description)}</p></div>`;
}
function inventoryCounts(items = []) {
  return Object.keys(state.itemCatalog).map(item => ({ item, count: items.filter(value => value === item).length })).filter(entry => entry.count);
}
function inventoryHtml(items = []) {
  const entries = inventoryCounts(items);
  return entries.length ? `<div class="perk-inventory">${entries.map(({ item, count }) => { const entry = state.itemCatalog[item]; return `<div class="perk-chip"><span aria-hidden="true">${esc(entry.icon)}</span><strong>${esc(entry.name)}</strong><b>×${count}</b></div>`; }).join('')}</div>` : '<p class="muted">Kho chức năng đã hết.</p>';
}
function wheelPage() {
  const host = state.role === 'host';
  const pending = state.players.filter(p => !p.spun).length;
  const spinsLeft = 5 - (state.me?.spins || 0);
  const main = host ? `<div class="panel"><div class="panel-title">Vòng quay trước trận · 5 lượt mỗi nhóm</div><div class="wheel-area">${wheelGraphic()}<div><h3>Tích trữ chức năng cho cả trận</h3><p>Mỗi nhóm quay đủ 5 lượt. Chức năng nhận được sẽ được giữ trong kho để lựa chọn trước từng câu hỏi.</p><p class="muted">${pending ? `Còn ${pending} nhóm chưa hoàn thành 5 lượt.` : 'Tất cả đã quay đủ. Sẵn sàng bước vào phần chọn chức năng.'}</p><div class="host-actions">${pending ? '<button class="btn ghost" data-action="spin-missing">Quay đủ hộ các nhóm</button>' : ''}<button class="btn" data-action="begin" ${pending ? 'disabled' : ''}>Tiếp tục chọn chức năng →</button></div></div></div></div>` : `<div class="panel"><div class="panel-title">Lượt ${Math.min(state.me.spins + 1, 5)} / 5 · Vòng quay trước trận</div><div class="wheel-area">${wheelGraphic()}<div><h3>${spinsLeft ? `Còn ${spinsLeft} lượt quay` : 'Kho chức năng đã sẵn sàng!'}</h3><p>Mỗi chức năng chỉ dùng được một lần. Bạn có thể giữ lại và chọn thời điểm phù hợp trong trận.</p>${inventoryHtml(state.me.inventory)}${spinsLeft ? '<button class="btn large" data-action="spin">Quay vòng quay ✦</button>' : session.demo ? '<button class="btn" data-action="begin">Tiếp tục chọn chức năng →</button>' : '<p class="hint-line">Chờ người dẫn đưa các nhóm vào phần chọn chức năng.</p>'}</div></div></div>`;
  return page(`${intro('Vòng quay may mắn', 'Quay 5 lần trước trận để xây dựng kho chức năng của nhóm.', 'Giai đoạn trước trận')}<div class="layout"><main>${main}</main>${sidebar('spin')}</div>`, true);
}
function preparePage() {
  const host = state.role === 'host';
  const pending = state.players.filter(p => !p.prepared).length;
  if (host) {
    const main = `<div class="panel"><div class="panel-title">Câu ${state.questionIndex + 1} / ${state.totalQuestions} · Chọn chức năng</div><h3>Các nhóm đang chuẩn bị</h3><p>Trước khi mở câu hỏi, mỗi nhóm chọn dùng một chức năng trong kho hoặc bỏ qua để giữ lại.</p><p class="muted">${pending ? `Còn ${pending} nhóm chưa chốt lựa chọn.` : 'Tất cả nhóm đã sẵn sàng.'}</p><div class="host-actions">${pending ? '<button class="btn ghost" data-action="prepare-missing">Bỏ qua hộ nhóm chưa chọn</button>' : ''}<button class="btn large" data-action="begin" ${pending ? 'disabled' : ''}>Mở câu hỏi →</button></div></div>`;
    return page(`${intro('Chuẩn bị câu hỏi', 'Mỗi nhóm được dùng tối đa một chức năng cho câu này.', `Câu ${state.questionIndex + 1} / ${state.totalQuestions}`)}<div class="layout"><main>${main}</main>${sidebar('prepare')}</div>`, true);
  }
  const targets = state.players.filter(p => p.id !== state.me.id);
  const options = inventoryCounts(state.me.inventory).map(({ item, count }) => { const entry = state.itemCatalog[item]; const unavailable = item === 'fog' && !targets.length; return `<label class="perk-option ${unavailable ? 'disabled' : ''}"><input type="radio" name="item" value="${esc(item)}" ${unavailable ? 'disabled' : ''}><span class="perk-option-icon" aria-hidden="true">${esc(entry.icon)}</span><span><strong>${esc(entry.name)}</strong><small>${esc(entry.description)}${unavailable ? ' Cần ít nhất một nhóm đối thủ.' : ''}</small></span><b>×${count}</b></label>`; }).join('');
  const form = options ? `<form id="perk-form"><div class="perk-options">${options}</div><div class="fog-target"><label for="target-select">Nếu dùng Màn sương, chọn đối thủ</label><select id="target-select" class="input" name="targetId"><option value="">Chọn một nhóm</option>${targets.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></div><div class="host-actions"><button class="btn" type="submit">Dùng chức năng đã chọn</button><button class="btn ghost" type="button" data-action="skip-perk">Không dùng chức năng</button></div></form>` : `<button class="btn ghost" data-action="skip-perk">Tiếp tục không dùng chức năng</button>`;
  const chosen = state.me.selectedItem ? itemCard(state.me.selectedItem, true) : itemCard(null);
  const main = `<div class="panel"><div class="panel-title">Câu ${state.questionIndex + 1} / ${state.totalQuestions} · Kho chức năng</div><h3>${state.me.prepared ? 'Đã chốt lựa chọn' : 'Bạn có muốn dùng chức năng?'}</h3><p>${state.me.prepared ? 'Lựa chọn đã được ghi nhận. Hãy chờ người dẫn mở câu hỏi.' : 'Chọn tối đa một chức năng cho câu sắp tới, hoặc bỏ qua để giữ lại.'}</p>${state.me.prepared ? chosen : `${inventoryHtml(state.me.inventory)}${form}`}${state.me.prepared && session.demo ? '<div class="host-actions"><button class="btn" data-action="begin">Mở câu hỏi →</button></div>' : ''}</div>`;
  return page(`${intro('Chuẩn bị câu hỏi', 'Quyết định trước khi câu hỏi được mở.', `Câu ${state.questionIndex + 1} / ${state.totalQuestions}`)}<div class="layout"><main>${main}</main><aside><div class="panel"><div class="panel-title">Kho chức năng còn lại</div>${inventoryHtml(state.me.inventory)}</div><div class="panel"><div class="panel-title">Lựa chọn của các nhóm</div>${playerList('prepare')}</div></aside></div>`, true);
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
  const item = state.me?.selectedItem;
  const feedback = state.me?.feedback ? `<div class="feedback ${esc(state.me.feedback.kind)}">${esc(state.me.feedback.text)}</div>` : '';
  const wrongWait = state.me && state.me.wrongUntil > nowServer();
  const scoreMeter = scoreMeterValues();
  const scoreLabel = state.me?.solved ? 'Điểm nhóm đã nhận' : 'Điểm nếu trả lời đúng ngay';
  const image = q.images?.length ? `<figure class="image-question" style="${imageRevealStyle()}"><div class="image-frame ${q.images.length > 1 ? 'image-pair' : ''}">${q.images.map((src, index) => `<img src="${esc(src)}" alt="${esc(q.imageAlt)}${q.images.length > 1 ? `, ảnh ${index + 1}` : ''}">`).join('')}<span class="image-veil" aria-hidden="true"></span></div><figcaption>Hình ảnh sẽ hiện rõ dần theo thời gian</figcaption></figure>` : '';
  const form = host ? '<p class="hint-line">Câu hỏi sẽ tự kết thúc khi hết giờ hoặc tất cả nhóm trả lời đúng.</p>' : state.me.solved ? `<div class="feedback correct">Nhóm bạn đã trả lời đúng và nhận ${state.me.roundPoints} điểm. Chờ các nhóm khác.</div>` : `<form id="answer-form" class="answer-form"><input class="input" id="answer-input" name="answer" maxlength="100" autocomplete="off" autocapitalize="sentences" placeholder="Nhập đáp án của nhóm..." aria-label="Nhập đáp án" required><button class="btn" type="submit" ${wrongWait ? 'disabled' : ''}>Trả lời →</button></form>${feedback}`;
  const main = `<div class="panel"><div class="timer-row"><div><div class="kicker">Câu ${state.questionIndex + 1} / ${state.totalQuestions}</div><div class="muted">${q.images?.length ? 'Ảnh và ô chữ hiện rõ dần' : 'Mỗi giây hé một ký tự'}</div></div><div class="timer ${timeLeft <= 5 ? 'urgent' : ''}">${String(timeLeft).padStart(2, '0')}<small> giây</small></div></div><div class="timer-track"><div class="timer-fill" style="width:${percent}%"></div></div><div class="score-meter"><div class="score-meter-head"><span>${scoreLabel}${scoreMeter.bonus ? ' · Đã cộng 200 điểm chức năng' : ''}</span><strong class="live-score">${scoreMeter.score} điểm</strong></div><div class="score-track"><div class="score-fill" style="width:${scoreMeter.percent}%"></div></div></div><h3 class="question-heading">${esc(q.prompt)}</h3>${image}<div class="slots ${fog ? 'fogged' : ''}" aria-label="Ô chữ đáp án">${slotsHtml(q.slots)}</div>${fog ? '<p class="hint-line">Màn sương đang che ô chữ. Bạn vẫn có thể nhập đáp án.</p>' : ''}${form}</div>`;
  return page(`${intro('Giải ô chữ', 'Trả lời càng sớm, điểm càng cao.', 'Thử thách đang diễn ra')}<div class="layout"><main>${main}</main><aside><div class="panel"><div class="panel-title">${host ? 'Bảng xếp hạng' : 'Chức năng của câu này'}</div>${host ? playerList() : itemCard(item, Boolean(item))}</div>${host ? '' : `<div class="panel"><div class="panel-title">Bảng xếp hạng</div>${playerList()}</div>`}</aside></div>`, true);
}
function sourceHtml(q) { const href = safeHref(q.source); return href ? `<p class="source">Nguồn tham khảo: <a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(q.source)}</a></p>` : ''; }
function revealPage() {
  const q = state.question;
  const host = state.role === 'host' || session.demo;
  const image = q.images?.length ? `<figure class="image-question revealed" style="${imageRevealStyle(1)}"><div class="image-frame ${q.images.length > 1 ? 'image-pair' : ''}">${q.images.map((src, index) => `<img src="${esc(src)}" alt="${esc(q.imageAlt)}${q.images.length > 1 ? `, ảnh ${index + 1}` : ''}">`).join('')}</div><figcaption>Hình ảnh gợi ý đã được mở hoàn toàn</figcaption></figure>` : '';
  return page(`${intro('Đáp án & kết quả', 'Một chặng đã hoàn thành. Cùng nhìn lại kiến thức và điểm số.', `Câu ${state.questionIndex + 1} / ${state.totalQuestions}`)}<div class="layout"><main><div class="panel"><div class="panel-title">Đáp án chính xác</div><div class="result-answer">${esc(q.answer)}</div>${image}<p>${esc(q.explanation || 'Hãy cùng trao đổi thêm về nội dung câu hỏi.')}</p>${sourceHtml(q)}${host ? `<div class="host-actions"><button class="btn large" data-action="next">${state.questionIndex + 1 >= state.totalQuestions ? 'Xem kết quả chung cuộc →' : 'Câu tiếp theo →'}</button></div>` : '<p class="hint-line">Chờ người dẫn chuyển câu tiếp theo.</p>'}</div></main>${sidebar()}</div>`, true);
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
  const existingPerk = document.querySelector('input[name="item"]:checked');
  if (existingAnswer) answerDraft = existingAnswer.value;
  if (existingTarget) targetDraft = existingTarget.value;
  if (existingPerk) perkDraft = existingPerk.value;
  const caret = answerFocused ? active.selectionStart : 0;
  if (!session) { app.innerHTML = location.pathname === '/join' || new URLSearchParams(location.search).has('room') ? joinPage() : landing(); return; }
  if (!state) { app.innerHTML = page('<main class="loading"><h2>Đang kết nối...</h2><p>Vui lòng chờ trong giây lát.</p></main>'); return; }
  app.innerHTML = state.phase === 'lobby' ? lobby() : state.phase === 'wheel' ? wheelPage() : state.phase === 'prepare' ? preparePage() : state.phase === 'question' ? questionPage() : state.phase === 'reveal' ? revealPage() : finalPage();
  const input = document.getElementById('answer-input');
  if (input) { input.value = answerDraft; if (answerFocused) { input.focus(); input.setSelectionRange(caret, caret); } }
  const select = document.getElementById('target-select');
  if (select) select.value = targetDraft;
  const perk = [...document.querySelectorAll('input[name="item"]')].find(input => input.value === perkDraft);
  if (perk) perk.checked = true;
}
function updateQuestionDynamic() {
  if (state?.phase !== 'question' || composing) return;
  const q = state.question;
  const left = Math.max(0, Math.ceil((state.startedAt + state.durationSec * 1000 - nowServer()) / 1000));
  const timer = document.querySelector('.timer');
  if (timer) { timer.innerHTML = `${String(left).padStart(2, '0')}<small> giây</small>`; timer.classList.toggle('urgent', left <= 5); }
  const fill = document.querySelector('.timer-fill');
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, 100 * left / state.durationSec))}%`;
  if (!state.me?.solved) {
    const scoreMeter = scoreMeterValues();
    const liveScore = document.querySelector('.live-score');
    const scoreFill = document.querySelector('.score-fill');
    if (liveScore) liveScore.textContent = `${scoreMeter.score} điểm`;
    if (scoreFill) scoreFill.style.width = `${scoreMeter.percent}%`;
  }
  const slots = document.querySelector('.slots');
  if (slots) { slots.innerHTML = slotsHtml(q.slots); slots.classList.toggle('fogged', Boolean(state.me && state.me.fogUntil > nowServer())); }
  const imageQuestion = document.querySelector('.image-question');
  if (imageQuestion) imageQuestion.setAttribute('style', imageRevealStyle());
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
    if (state && state.questionIndex !== fresh.questionIndex) { answerDraft = ''; targetDraft = ''; perkDraft = ''; }
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
  overlay.innerHTML = `<div class="editor-backdrop"><section class="editor" role="dialog" aria-modal="true" aria-label="Chỉnh bộ câu hỏi"><div class="editor-header"><div><div class="eyebrow">Thiết lập trước trận</div><h2>Biên tập câu hỏi</h2><p class="muted">Chỉnh đáp án, cách viết tương đương và nguồn theo giáo trình của lớp.</p></div><button class="text-button" data-action="close-editor">Đóng ×</button></div><form id="editor-form"><div class="field"><label for="duration">Thời gian mỗi câu (10–90 giây)</label><input id="duration" name="duration" class="input" type="number" min="10" max="90" value="${esc(editorDuration)}" required></div><div id="editor-list">${editorQuestions.map((q, i) => `<article class="question-edit" data-index="${i}"><div class="editor-header"><h3>Câu ${i + 1}${q.images?.length ? ' · Ảnh fade' : ''}</h3><button type="button" class="text-button" data-action="remove-question" data-index="${i}" ${editorQuestions.length <= 1 ? 'disabled' : ''}>Xóa câu</button></div><div class="field"><label>Đề bài</label><textarea name="prompt" required maxlength="400">${esc(q.prompt)}</textarea></div><div class="field"><label>Đáp án</label><input class="input" name="answer" required maxlength="80" value="${esc(q.answer)}"></div><div class="field"><label>Đáp án tương đương, mỗi dòng một cách viết</label><textarea name="aliases">${esc(q.aliases.join('\n'))}</textarea></div><div class="field"><label>Giải thích khi kết thúc câu</label><textarea name="explanation" maxlength="700">${esc(q.explanation)}</textarea></div><div class="field"><label>Đường dẫn nguồn tham khảo</label><input class="input" name="source" maxlength="400" value="${esc(q.source)}"></div></article>`).join('')}</div><div class="editor-footer"><button type="button" class="btn ghost" data-action="add-question" ${editorQuestions.length >= 30 ? 'disabled' : ''}>+ Thêm câu</button><button type="submit" class="btn">Lưu bộ câu hỏi</button></div></form></section></div>`;
}
function readEditor() {
  editorDuration = document.getElementById('duration')?.value ?? editorDuration;
  editorQuestions = [...document.querySelectorAll('.question-edit')].map((card, index) => ({
    prompt: card.querySelector('[name=prompt]').value,
    answer: card.querySelector('[name=answer]').value,
    aliases: card.querySelector('[name=aliases]').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean),
    explanation: card.querySelector('[name=explanation]').value,
    source: card.querySelector('[name=source]').value,
    ...(editorQuestions[index]?.images?.length ? { images: [...editorQuestions[index].images], imageAlt: editorQuestions[index].imageAlt } : {})
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
    if (name === 'home') {
      if (session && state?.role === 'player') { openLeaveConfirm(); return; }
      button.disabled = true; await goHome(); return;
    }
    if (name === 'cancel-leave') { overlay.innerHTML = ''; return; }
    if (name === 'confirm-leave') { button.disabled = true; await goHome(); return; }
    if (name === 'join-screen') { history.pushState(null, '', '/join'); render(); return; }
    if (name === 'create') { openHostGate('create'); return; }
    if (name === 'demo') { openHostGate('demo'); return; }
    if (name === 'close-host-gate') { overlay.innerHTML = ''; return; }
    if (name === 'copy-link') { await navigator.clipboard.writeText(shareLink()); notify('Đã sao chép đường dẫn vào phòng.'); return; }
    if (name === 'edit') { openEditor(); return; }
    if (name === 'close-editor') { closeEditor(); return; }
    if (name === 'add-question') { readEditor(); editorQuestions.push({ prompt: '', answer: '', aliases: [], explanation: '', source: '' }); drawEditor(); return; }
    if (name === 'remove-question') { readEditor(); editorQuestions.splice(Number(button.dataset.index), 1); drawEditor(); return; }
    if (name === 'close-spin') { overlay.innerHTML = ''; return; }
    if (name === 'next') { await action('next', {}, session.demo ? session.demoHostToken : undefined); return; }
    if (name === 'spin') {
      const result = await action('spin');
      spinAnimation(result.item);
      return;
    }
    if (name === 'spin-missing') { await action('spin-missing'); notify('Đã hoàn tất 5 lượt quay cho các nhóm còn thiếu.'); return; }
    if (name === 'prepare-missing') { await action('prepare-missing'); notify('Các nhóm chưa chọn sẽ bỏ qua chức năng ở câu này.'); return; }
    if (name === 'skip-perk') { await action('prepare', { item: null }); notify('Đã giữ lại chức năng cho câu sau.'); return; }
    if (name === 'begin') { await action('begin', {}, session.demo ? session.demoHostToken : undefined); return; }
  } catch (error) { button.disabled = false; notify(error.message); }
});

document.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const submit = form.querySelector('[type=submit]');
  if (submit) submit.disabled = true;
  try {
    if (form.id === 'host-gate-form') {
      const password = form.elements.namedItem('password').value;
      const made = await api('/api/rooms', { method: 'POST', data: { password } });
      overlay.innerHTML = '';
      if (form.dataset.mode === 'demo') {
        const joined = await api(`/api/rooms/${made.code}/join`, { method: 'POST', data: { name: 'Nhóm chơi thử' }, token: '' });
        saveSession({ code: made.code, token: joined.token, demo: true, demoHostToken: made.token });
        await action('next', {}, made.token);
      } else {
        saveSession({ code: made.code, token: made.token, demo: false });
        history.replaceState(null, '', '/'); await refresh(true);
      }
    } else if (form.id === 'join-form') {
      const code = form.elements.namedItem('code').value.trim();
      const result = await api(`/api/rooms/${code}/join`, { method: 'POST', data: { name: form.elements.namedItem('name').value } });
      saveSession({ code, token: result.token, demo: false });
      history.replaceState(null, '', '/'); await refresh(true);
    } else if (form.id === 'perk-form') {
      const item = form.elements.namedItem('item')?.value;
      if (!item) throw new Error('Hãy chọn một chức năng hoặc bấm “Không dùng chức năng”.');
      const targetId = form.elements.namedItem('targetId')?.value || null;
      await action('prepare', { item, targetId });
      notify('Đã chốt chức năng cho câu này.');
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
