'use strict';
// Toca: front-end da demonstração (JavaScript puro, sem build).
// Toda regra de permissão e de Karma é aplicada no servidor; aqui só exibimos.

const S = { config: null, me: null, avatars: {}, replyTo: null, timers: [], msgSig: '', messages: [], filter: '', adminTab: 'flags', adminQ: '' };
const app = document.getElementById('app');
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = n => Number(n || 0).toLocaleString('pt-BR');

// ---------------------------------------------------------------------------
// Ícones
// ---------------------------------------------------------------------------
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
  chat: '<path d="M20.5 12a8.5 8.5 0 0 1-12.3 7.6L3.5 21l1.4-4.6A8.5 8.5 0 1 1 20.5 12Z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18.5 14.2a6.5 6.5 0 0 1 3 5.8"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12"/><path d="M12 8S10.5 3.5 7.8 4.1C5.6 4.6 6.4 8 12 8Zm0 0s1.5-4.5 4.2-3.9C18.4 4.6 17.6 8 12 8Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5v-3a4 4 0 0 1 8 0v3"/>',
  lockFill: '<path fill="currentColor" stroke="none" d="M7 10V7.5a5 5 0 0 1 10 0V10h.5A2.5 2.5 0 0 1 20 12.5v6A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-6A2.5 2.5 0 0 1 6.5 10H7Zm2 0h6V7.5a3 3 0 0 0-6 0V10Z"/>',
  unlock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5v-3a4 4 0 0 1 7.7-1.6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  send: '<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4 18-7Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/>',
  shieldCheck: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20Z"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  reply: '<path d="M10 8 4 13l6 5"/><path d="M4 13h10a6 6 0 0 1 6 6"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/>',
  alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
  dots: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M14.5 9.5h-3.2a1.8 1.8 0 0 0 0 3.5h1.4a1.8 1.8 0 0 1 0 3.5H9.5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  megaphone: '<path d="M3 10v4h3l7 4V6L6 10H3Z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
const GOOGLE_G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const SHIELD_OK = '<svg class="shield" viewBox="0 0 24 24" aria-hidden="true"><path fill="#22b35e" d="M12 2 3.5 5.2v6.3c0 5.3 3.6 9 8.5 10.5 4.9-1.5 8.5-5.2 8.5-10.5V5.2L12 2Z"/><path d="m8.3 12 2.6 2.6 5-5.2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const VERIFIED = '<svg class="gv" viewBox="0 0 24 24" aria-label="Conta Google verificada"><path fill="#22b35e" opacity=".9" d="M12 2 3.5 5.2v6.3c0 5.3 3.6 9 8.5 10.5 4.9-1.5 8.5-5.2 8.5-10.5V5.2L12 2Z"/><path d="m8.5 12 2.4 2.4 4.6-4.8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Toca': '1' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Algo deu errado.');
    err.status = res.status; err.data = data;
    if (res.status === 401 && data.code === 'auth_required' && S.me) { S.me = null; go('#/entrar'); }
    throw err;
  }
  return data;
}

function avatarHtml(key, size = 48, { online = null } = {}) {
  const a = S.avatars[key] || S.avatars.raposa || { emoji: '🦊', bg: '#fde' };
  const inner = a.img ? `<img src="${esc(a.img)}" alt="" loading="lazy">` : `<span style="background:${esc(a.bg)};font-size:${Math.round(size * 0.56)}px">${a.emoji}</span>`;
  const dot = online === null ? '' : `<i class="dot ${online ? 'on' : ''}"></i>`;
  return `<span class="av" style="--s:${size}px" title="${esc(a.label || '')}">${inner}${dot}</span>`;
}

function fmtTime(ts) {
  const d = new Date(ts), n = new Date();
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = (day(n) - day(d)) / 86400000;
  if (diff === 0) return `Hoje às ${hm}`;
  if (diff === 1) return `Ontem às ${hm}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${hm}`;
}
function fmtSince(ts) {
  const days = Math.max(1, Math.round((Date.now() - ts) / 86400000));
  if (days < 30) return `${days} ${days === 1 ? 'dia' : 'dias'}`;
  const m = Math.round(days / 30);
  if (m < 12) return `${m} ${m === 1 ? 'mês' : 'meses'}`;
  const y = Math.floor(m / 12);
  return `${y} ${y === 1 ? 'ano' : 'anos'}`;
}
const fmtBody = s => esc(s).replace(/\n/g, '<br>');

function toast(text, { kind = 'ok', pts = null, ms = 3200 } = {}) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${pts !== null ? `<span class="pts">${pts > 0 ? '+' : ''}${pts} Karma</span>` : ''}<span>${esc(text)}</span>`;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), ms);
}

function modal(html, { wide = false, cls = '' } = {}) {
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'modal-bg'; bg.id = 'modalBg';
  bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  bg.addEventListener('mousedown', e => { if (e.target === bg) closeModal(); });
  document.body.append(bg);
  const f = bg.querySelector('input:not([type=hidden]), button.primary');
  if (f) setTimeout(() => f.focus(), 30);
  return bg.firstElementChild;
}
function closeModal() { $('#modalBg')?.remove(); }

function ask({ title, text = '', placeholder = '', value = '', ok = 'Confirmar', danger = false, input = true }) {
  return new Promise(resolve => {
    const m = modal(`<h2>${esc(title)}</h2>${text ? `<p class="muted">${esc(text)}</p>` : ''}
      <form id="askForm">${input ? `<label class="field"><span>Motivo</span><input type="text" name="v" maxlength="80" placeholder="${esc(placeholder)}" value="${esc(value)}"></label>` : ''}
      <div class="actions"><button type="button" class="btn" data-x>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}">${esc(ok)}</button></div></form>`);
    m.querySelector('[data-x]').onclick = () => { closeModal(); resolve(null); };
    m.querySelector('form').onsubmit = e => { e.preventDefault(); const v = input ? e.target.v.value.trim() : true; closeModal(); resolve(v || (input ? placeholder : true)); };
  });
}

function closePops() { document.querySelectorAll('.pop').forEach(p => p.remove()); }
function popover(anchor, html, cls = '') {
  closePops();
  const el = document.createElement('div');
  el.className = `pop ${cls}`; el.innerHTML = html;
  document.body.append(el);
  const r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  let left = Math.min(Math.max(8, r.right - w), innerWidth - w - 8);
  let top = r.bottom + 8;
  if (top + h > innerHeight - 8) top = r.top - h - 8;
  el.style.left = left + 'px'; el.style.top = Math.max(8, top) + 'px';
  return el;
}
document.addEventListener('mousedown', e => { if (!e.target.closest('.pop, [data-pop]')) closePops(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePops(); closeModal(); } });

function every(ms, fn) { S.timers.push(setInterval(fn, ms)); }
function clearTimers() { S.timers.forEach(clearInterval); S.timers = []; }

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('toca-theme', t); } catch (e) { /* ignora */ }
  document.querySelectorAll('.theme button').forEach(b => b.classList.toggle('on', b.dataset.theme === t));
}
const currentTheme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function ringHtml(value, max, size = 116) {
  const r = 50, c = 2 * Math.PI * r, pct = Math.min(1, value / max);
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 116 116"><circle class="track" cx="58" cy="58" r="${r}"/>
    <circle class="val" cx="58" cy="58" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}"/></svg>
    <div class="lbl"><b>${fmtN(value)}</b><small>/ ${fmtN(max)}</small></div></div>`;
}

// ---------------------------------------------------------------------------
// Roteamento: o link geral sempre cai no cadastro para quem não tem sessão.
// ---------------------------------------------------------------------------
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
window.addEventListener('hashchange', route);

async function route() {
  clearTimers(); closePops(); closeModal();
  const [, page = '', arg] = (location.hash || '#/').split('/');
  if (!S.me) return page === 'entrar' ? renderSignup() : go('#/entrar');
  if (S.me.needsOnboarding) return page === 'boas-vindas' ? renderOnboarding() : go('#/boas-vindas');
  if (!page || page === 'entrar' || page === 'boas-vindas' || page === 'inicio') return go('#/comunidade');

  renderShell(page);
  every(15000, refreshMe);
  switch (page) {
    case 'comunidade': return pageChat();
    case 'perfil': return pageProfile(arg ? +arg : S.me.id);
    case 'recompensas': return pageRewards();
    case 'admin': return pageAdmin();
    case 'conversas': return pagePlaceholder('chat', 'Conversas privadas', 'Mensagens diretas ficam fora do escopo desta entrega. O foco aqui é cadastro, perfil, Karma, presentes raros e moderação.');
    default: return go('#/comunidade');
  }
}

async function refreshMe() {
  try {
    S.me = await api('/me');
    const pip = $('#bellPip'); if (pip) pip.hidden = !S.me.unreadNotifications;
    const al = $('.admin-link'); if (al) al.classList.toggle('elevated', !!S.me.modElevatedUntil);
  } catch (e) { /* 401 já redireciona */ }
}

// ---------------------------------------------------------------------------
// Cadastro com Google
// ---------------------------------------------------------------------------
function renderSignup() {
  const c = S.config;
  const cluster = [['raposa', 104, 8, 30], ['gatinho', 72, 150, 0], ['lobinho', 86, 250, 90], ['corujinha', 66, 130, 140], ['cachorrinho', 78, 360, 10], ['ursinho', 60, 400, 150]];
  app.innerHTML = `<div class="auth">
    <section class="auth-art">
      <div class="brand"><img src="/img/logo.png" alt=""><div><b>Toca</b><small>Pessoas melhores<br>em boa companhia</small></div></div>
      <div class="cluster">${cluster.map(([k, s, x, y]) => `<span style="position:absolute;left:${x}px;top:${y}px">${avatarHtml(k, s)}</span>`).join('')}</div>
      <h1>Um lugar para <span>conversar de verdade</span>.</h1>
      <p>Entre com o Google, ganhe um avatar de animalzinho e acumule Karma com conversas que fazem o chat ficar melhor.</p>
      <div class="auth-feats">
        <div><b>🦊</b>Avatar e nome sorteados na hora</div>
        <div><b>✨</b>Karma por respostas e reações</div>
        <div><b>🎁</b>Presentes raros aos ${fmtN(c.karma.threshold)}</div>
      </div>
    </section>
    <section class="auth-form"><div class="auth-card">
      <div class="eyebrow">Novo por aqui?</div>
      <h2>Crie sua conta na Toca</h2>
      <p>O cadastro é feito só com a sua conta Google. Rápido, sem senha para lembrar e com e-mail verificado.</p>
      ${c.googleClientId ? '<div id="gsiBtn"></div>' : `<button class="gbtn-google" data-act="google-demo">${GOOGLE_G} Continuar com o Google</button>`}
      <ul class="auth-list">
        <li><span class="ic">${icon('shieldCheck')}</span><div><b>Conta verificada</b><span>Só entra quem tem e-mail Google confirmado.</span></div></li>
        <li><span class="ic">${icon('user')}</span><div><b>Você escolhe como aparecer</b><span>Troque o apelido quando quiser. Seu sexo fica privado, a não ser que você decida mostrar.</span></div></li>
        <li><span class="ic">${icon('sparkle')}</span><div><b>Karma que vale a pena</b><span>Pontos vêm de conversa, não de volume de mensagens.</span></div></li>
      </ul>
      ${c.demoLogin ? `<div class="demo-note">${icon('info')}<span><b>Modo demonstração:</b> o seletor de conta Google é simulado. Defina <code>GOOGLE_CLIENT_ID</code> no servidor para usar o login real.</span></div>` : ''}
      <p class="legal">Ao continuar, você concorda com as regras da comunidade.</p>
    </div></section>
  </div>`;
  if (c.googleClientId) mountGoogleButton();
}

function mountGoogleButton() {
  const init = () => {
    google.accounts.id.initialize({
      client_id: S.config.googleClientId,
      callback: async r => {
        try { const out = await api('/auth/google', { method: 'POST', body: { credential: r.credential } }); afterLogin(out); }
        catch (e) { toast(e.message, { kind: 'err' }); }
      },
    });
    google.accounts.id.renderButton($('#gsiBtn'), { theme: 'outline', size: 'large', shape: 'pill', text: 'signup_with', locale: 'pt-BR', width: 340 });
  };
  if (window.google?.accounts) return init();
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = init;
  document.head.append(s);
}

function openGoogleChooser() {
  const m = modal(`<div class="chooser-head">${GOOGLE_G}<h2>Escolha uma conta</h2><p>para continuar em <b>Toca</b></p></div>
    ${S.config.demoAccounts.map(a => `<button class="acct" data-email="${esc(a.email)}">${avatarHtml(a.avatar, 38)}<div><b>${esc(a.name)}</b><small>${esc(a.email)}</small></div><span class="tagline">${esc(a.note)}</span></button>`).join('')}
    <div class="other-acct"><b>Usar outra conta</b><small class="muted" style="display:block;font-size:12.5px">Qualquer e-mail cria uma conta nova, com avatar e nome sorteados.</small>
      <form id="otherAcct"><input type="email" name="email" placeholder="voce@gmail.com" required><button class="btn primary">Continuar</button></form></div>`, { cls: 'chooser' });
  const login = async email => {
    try { const out = await api('/auth/demo', { method: 'POST', body: { email } }); closeModal(); afterLogin(out); }
    catch (e) { toast(e.message, { kind: 'err' }); }
  };
  m.querySelectorAll('.acct').forEach(b => b.onclick = () => login(b.dataset.email));
  m.querySelector('#otherAcct').onsubmit = e => { e.preventDefault(); login(e.target.email.value); };
}

async function afterLogin(out) {
  S.me = await api('/me');
  if (out.created) toast('Conta criada! Sorteamos um avatar para você.');
  go(S.me.needsOnboarding ? '#/boas-vindas' : '#/comunidade');
}

// ---------------------------------------------------------------------------
// Boas-vindas: nome temporário -> apelido + sexo obrigatório
// ---------------------------------------------------------------------------
function avatarPicker(current) {
  return `<div class="av-grid">${Object.values(S.avatars).map(a => `<button type="button" data-av="${a.key}" class="${a.key === current ? 'on' : ''}">${avatarHtml(a.key, 44)}${esc(a.label)}</button>`).join('')}</div>`;
}
function bindPicker(root, input) {
  root.querySelectorAll('[data-av]').forEach(b => b.onclick = () => {
    root.querySelectorAll('[data-av]').forEach(x => x.classList.toggle('on', x === b));
    input.value = b.dataset.av;
    const prev = root.querySelector('[data-preview]'); if (prev) prev.innerHTML = avatarHtml(b.dataset.av, 120);
  });
}

function renderOnboarding() {
  const me = S.me, a = S.avatars[me.avatar];
  app.innerHTML = `<div class="onb-wrap"><div class="onb card">
    <div class="onb-hero">
      <div class="reveal" data-preview>${avatarHtml(me.avatar, 120)}</div>
      <span class="eyebrow">${icon('shieldCheck')} Conta Google verificada · ${esc(me.email)}</span>
      <h1>Você chegou como <span>${esc(me.name)}</span>!</h1>
      <p>Sorteamos o avatar ${esc(a?.label || '')} e um nome temporário. Agora escolha como quer ser chamado(a).</p>
    </div>
    <form id="onbForm" novalidate>
      <input type="hidden" name="avatar" value="${esc(me.avatar)}">
      <label class="field" data-f="displayName"><span>Apelido</span>
        <input type="text" name="displayName" value="${esc(me.name)}" maxlength="20" autocomplete="nickname">
        <small>De 3 a 20 caracteres, único na comunidade. Pode manter o temporário e trocar depois no perfil.</small><div class="err"></div></label>
      <div class="field" data-f="gender"><span>Sexo <em>obrigatório</em></span>
        <div class="gender">
          <label><input type="radio" name="gender" value="M"><span class="sym">♂</span> Masculino</label>
          <label><input type="radio" name="gender" value="F"><span class="sym">♀</span> Feminino</label>
        </div><div class="err"></div>
        <label class="check"><input type="checkbox" name="genderVisible"><span>Mostrar no meu perfil público<br><small class="muted">Desligado por padrão: só você vê. Não é usado para filtrar quem pode falar com você.</small></span></label>
      </div>
      <details><summary>Prefere outro animalzinho?</summary>${avatarPicker(me.avatar)}</details>
      <button class="btn primary big">Entrar na comunidade ${icon('arrowRight')}</button>
    </form></div></div>`;
  const f = $('#onbForm');
  bindPicker(f, f.avatar);
  f.onsubmit = async e => {
    e.preventDefault();
    f.querySelectorAll('.field').forEach(x => { x.classList.remove('invalid'); x.querySelector('.err').textContent = ''; });
    const gender = f.gender.value;
    if (!gender) return showFieldErr(f, 'gender', 'Selecione Masculino ou Feminino para continuar.');
    try {
      S.me = await api('/me/profile', { method: 'PUT', body: { displayName: f.displayName.value, gender, genderVisible: f.genderVisible.checked, avatar: f.avatar.value } });
      toast(`Tudo pronto, ${S.me.name}!`);
      go('#/comunidade');
    } catch (err) { showFieldErr(f, err.data?.field || 'displayName', err.message); }
  };
}
function showFieldErr(form, field, msg) {
  const box = form.querySelector(`[data-f="${field}"]`);
  if (!box) return toast(msg, { kind: 'err' });
  box.classList.add('invalid'); box.querySelector('.err').textContent = msg;
}

// ---------------------------------------------------------------------------
// Estrutura principal
// ---------------------------------------------------------------------------
function renderShell(page) {
  const me = S.me;
  const nav = [['inicio', 'home', 'Início', 'home'], ['conversas', 'chat', 'Conversas', 'convo'], ['comunidade', 'users', 'Comunidade', ''], ['recompensas', 'gift', 'Recompensas', ''], ['perfil', 'user', 'Perfil', '']];
  const t = currentTheme();
  app.innerHTML = `<div class="shell">
    <aside class="sidebar">
      <a class="brand" href="#/comunidade"><img src="/img/logo.png" alt=""><div><b>Toca</b><small>Pessoas melhores<br>em boa companhia</small></div></a>
      <nav class="nav">${nav.map(([k, ic, label, cls]) => `<a href="#/${k}" class="${cls} ${page === k || (k === 'comunidade' && page === 'inicio') ? 'on' : ''}">${icon(ic)}<span>${label}</span></a>`).join('')}</nav>
      <div class="promo"><p>Faça o bem.<br>Ganhe Karma.<br>Construa um lugar<br>mais gentil. 🧡</p></div>
      ${me.role === 'moderator' ? `<div><a href="#/admin" class="admin-link ${page === 'admin' ? 'on' : ''} ${me.modElevatedUntil ? 'elevated' : ''}">${icon('lock')}<span>Administração</span><span class="lock-state">${icon(me.modElevatedUntil ? 'unlock' : 'lockFill')}</span></a><span class="admin-note">Apenas moderadores</span></div>` : ''}
    </aside>
    <div class="main">
      <header class="topbar">
        <label class="search">${icon('search')}<span class="sr">Buscar</span><input id="q" type="search" placeholder="Buscar pessoas, mensagens ou tópicos..." value="${esc(S.filter)}"></label>
        <div class="gchip">${SHIELD_OK}<div><b>Conta verificada com Google</b><small>Mais segurança para a nossa comunidade</small></div></div>
        <button class="tb-btn" data-act="bell" data-pop title="Notificações">${icon('bell')}<i class="pip" id="bellPip" ${me.unreadNotifications ? '' : 'hidden'}></i></button>
        <div class="theme" role="group" aria-label="Tema"><button data-act="theme" data-theme="light" class="${t === 'light' ? 'on' : ''}" title="Claro">${icon('sun')}</button><button data-act="theme" data-theme="dark" class="${t === 'dark' ? 'on' : ''}" title="Escuro">${icon('moon')}</button></div>
        <span class="vline"></span>
        <button class="me-btn" data-act="menu" data-pop>${avatarHtml(me.avatar, 44, { online: true })}<span class="nm">${esc(me.name)}</span>${icon('chevron')}</button>
      </header>
      <main id="page" class="page page-${esc(page)}"></main>
    </div></div>`;
  $('#q').addEventListener('input', e => {
    S.filter = e.target.value.trim().toLowerCase();
    if (page !== 'comunidade') { if (S.filter) go('#/comunidade'); } else renderMessages(false, true);
  });
}

function pagePlaceholder(ic, title, text) {
  $('#page').innerHTML = `<div class="card placeholder">${icon(ic)}<h1>${esc(title)}</h1><p>${esc(text)}</p><p style="margin-top:18px"><a class="btn primary" href="#/comunidade">Ir para a Comunidade</a></p></div>`;
}

// ---------------------------------------------------------------------------
// Chat da comunidade
// ---------------------------------------------------------------------------
function pageChat() {
  $('#page').innerHTML = `<section class="card chat">
      <div class="chat-head"><span class="room-ic">${icon('users')}</span>
        <div><h1>Comunidade</h1><p>Converse, compartilhe, faça amizades e torne o mundo mais gentil. 🧡</p></div>
        <div class="head-tools"><span class="online"><i></i><b id="onlineN">·</b> online</span>
          <a class="sq" href="#/perfil" title="Meu perfil">${icon('user')}</a>
          <button class="sq" data-act="focus-search" title="Buscar">${icon('search')}</button>
          <button class="sq" data-act="rules" title="Regras do Karma">${icon('dots')}</button></div></div>
      <div class="msgs" id="msgs"><div class="loading">Carregando conversa…</div></div>
      <div id="replyBar"></div>
      <form class="composer" id="composer" autocomplete="off">
        <div class="box"><button type="button" class="circle" title="Anexar (em breve)" disabled>${icon('plus')}</button>
          <input id="msgInput" maxlength="1000" placeholder="Escrever uma mensagem para #comunidade...">
          <span class="count-hint" id="hint"></span>
          <button type="button" class="ico" title="Imagem (em breve)" disabled>${icon('image')}</button>
          <button type="button" class="ico" data-act="emoji-insert" data-pop title="Emoji">${icon('smile')}</button></div>
        <button class="send" title="Enviar">${icon('send')}</button>
      </form></section>
    <aside class="side" id="side"></aside>`;
  S.msgSig = '';
  $('#composer').onsubmit = sendMessage;
  $('#msgInput').addEventListener('input', updateHint);
  renderReplyBar();
  loadMessages(true);
  renderSide();
  every(2500, () => loadMessages(false));
  every(20000, renderSide);
}

function updateHint() {
  const v = $('#msgInput').value;
  const letters = v.normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '').length;
  const min = 10;
  $('#hint').textContent = v && letters < min ? `${min - letters} letras para pontuar` : '';
}

async function loadMessages(forceBottom) {
  try {
    const data = await api('/messages');
    const n = $('#onlineN'); if (n) n.textContent = fmtN(data.online);
    const sig = JSON.stringify(data.messages) + S.me.modElevatedUntil;
    if (sig === S.msgSig && !forceBottom) return;
    S.msgSig = sig; S.messages = data.messages;
    renderMessages(forceBottom);
  } catch (e) { /* tenta de novo no próximo ciclo */ }
}

function renderMessages(forceBottom, keep) {
  const box = $('#msgs'); if (!box) return;
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  const list = S.filter ? S.messages.filter(m => (m.body || '').toLowerCase().includes(S.filter) || m.user.name.toLowerCase().includes(S.filter)) : S.messages;
  box.innerHTML = list.length ? list.map(msgHtml).join('') : `<div class="loading">${S.filter ? 'Nada encontrado para essa busca.' : 'Seja o primeiro a dizer oi com algo legal!'}</div>`;
  if (forceBottom || (nearBottom && !keep)) box.scrollTop = box.scrollHeight;
}

function msgHtml(m) {
  const mine = m.user.id === S.me.id;
  const canMod = !!S.me.modElevatedUntil && !mine;
  const quote = m.replyTo ? `<div class="quote">${avatarHtml(m.replyTo.avatar, 20)}<b>@${esc(m.replyTo.name)}</b><span>${m.replyTo.body ? esc(m.replyTo.body) : '<i>mensagem removida</i>'}</span></div>` : '';
  const body = m.deleted
    ? `<div class="bubble removed">${icon('shield')} Mensagem removida pela moderação</div>`
    : `<div class="bubble">${fmtBody(m.body)}</div>${m.image ? `<img class="msg-img" src="${esc(m.image)}" alt="Foto enviada por ${esc(m.user.name)}">` : ''}
       <div class="reacts">${m.reactions.map(r => `<button class="react ${r.mine ? 'on' : ''}" data-act="react" data-id="${m.id}" data-emoji="${esc(r.emoji)}">${r.emoji} <b>${r.count}</b></button>`).join('')}
         <button class="react add" data-act="picker" data-pop data-id="${m.id}" title="Reagir">${icon('smile')}</button>
         <span class="msg-actions"><button data-act="reply" data-id="${m.id}">${icon('reply')} Responder</button>
         ${canMod ? `<button class="danger" data-act="mod-del" data-id="${m.id}">${icon('trash')} Remover</button>` : ''}</span></div>`;
  return `<article class="msg ${mine ? 'mine' : ''}" data-id="${m.id}">${quote}
    <div class="msg-row"><a href="#/perfil/${m.user.id}">${avatarHtml(m.user.avatar, 52, { online: m.user.online })}</a>
      <div><div class="msg-meta"><a class="msg-name" href="#/perfil/${m.user.id}">${esc(m.user.name)}</a>${VERIFIED}${m.user.role === 'moderator' ? '<span class="mod-tag">MOD</span>' : ''}<time>${fmtTime(m.createdAt)}</time></div>${body}</div>
    </div></article>`;
}

function renderReplyBar() {
  const bar = $('#replyBar'); if (!bar) return;
  const m = S.replyTo;
  bar.innerHTML = m ? `<div class="reply-bar">${icon('reply')}<b>Respondendo ${esc(m.user.name)}</b><span>${esc((m.body || '').split('\n')[0])}</span><button data-act="cancel-reply" title="Cancelar">${icon('x')}</button></div>` : '';
}

async function sendMessage(e) {
  e.preventDefault();
  const input = $('#msgInput');
  const body = input.value.trim();
  if (!body) return;
  try {
    const out = await api('/messages', { method: 'POST', body: { body, replyTo: S.replyTo?.id } });
    input.value = ''; updateHint();
    S.replyTo = null; renderReplyBar();
    const k = out.karma;
    if (k.points > 0) toast(k.replyAwarded ? `${k.text} · quem você respondeu ganhou +${k.replyAwarded}` : k.text, { pts: k.points });
    else toast(k.text, { kind: 'warn', pts: 0, ms: 4200 });
    await loadMessages(true);
    renderSide();
  } catch (err) { toast(err.message, { kind: 'err' }); }
}

// ---------------------------------------------------------------------------
// Blocos do perfil (coluna lateral e página de perfil)
// ---------------------------------------------------------------------------
function karmaCardHtml(k, threshold, { today = null, cap = null } = {}) {
  const left = Math.max(0, threshold - k);
  return `<div class="card kcard">${ringHtml(k, threshold)}
    <div><h3>Karma <button data-act="rules" title="Como funciona">${icon('info')}</button></h3>
      <p class="sub">${left ? `${fmtN(left)} para desbloquear` : '<b style="color:var(--primary)">Troca liberada!</b>'}</p>
      <div class="bar"><i style="width:${Math.min(100, (k / threshold) * 100).toFixed(1)}%"></i></div>
      ${today !== null ? `<div class="today"><span>Hoje: +${today} de ${cap}</span><span>teto diário</span></div>` : ''}
      <p class="note">Quanto mais você participa, mais coisas boas você desbloqueia.</p></div></div>`;
}

function giftCardHtml(g, { karma, threshold, forRedeem = true } = {}) {
  const owned = !!g.ownedSerial;
  const ready = !owned && karma >= threshold && g.stockLeft > 0;
  let btn;
  if (owned) btn = `<button class="gbtn owned" disabled>${icon('check')} Na sua vitrine · Nº ${g.ownedSerial}</button>`;
  else if (!g.stockLeft) btn = `<button class="gbtn" disabled>Esgotado</button>`;
  else if (ready && forRedeem) btn = `<button class="gbtn ready" data-act="redeem" data-id="${g.id}">${icon('sparkle')} Trocar ${fmtN(g.cost)} Karma</button>`;
  else btn = `<button class="gbtn" disabled>${icon('lockFill')} Desbloqueia com ${fmtN(g.cost)} Karma</button>`;
  return `<div class="gift ${esc(g.tint)}">
    <img class="gift-img tint-${esc(g.tint)}" src="${esc(g.image)}" alt="">
    <div><h3>Presente raro</h3><div class="gname">${esc(g.name)}</div><p class="gdesc">${esc(g.description)}</p>
      ${g.stockTotal ? `<div class="stockbar"><i style="width:${(g.stockLeft / g.stockTotal * 100).toFixed(0)}%"></i></div><div class="stocktxt">${fmtN(g.stockLeft)} de ${fmtN(g.stockTotal)} disponíveis · edição numerada</div>` : ''}
      ${btn}</div>
    ${!owned && !ready ? `<span class="glock">${icon('lockFill')}</span>` : ''}</div>`;
}

function profileHeadCard(p) {
  const u = p.user, own = u.id === S.me.id;
  return `<div class="card pcard"><div class="pcard-top">
    ${avatarHtml(u.avatar, 106)}
    <div><div class="pcard-name"><h2>${esc(u.name)}</h2>${own ? `<a class="btn" href="#/perfil" data-act="edit-profile">${icon('edit')} Editar perfil</a>` : ''}</div><div class="status-line"><i class="${u.online ? '' : 'off'}"></i>${u.online ? 'Online' : 'Offline'}</div>
      <div class="handle">@${esc(u.handle)}</div><p class="bio">${esc(u.bio || (own ? 'Conte um pouco sobre você no perfil.' : ''))}</p></div></div>
    ${u.interests.length ? `<div class="tags">${u.interests.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}</div>`;
}

function statsHtml(s, rare) {
  return `<div class="card stats">
    <div class="stat">${icon('chat')}<div><b>${fmtN(s.messages)}</b><small>Mensagens</small></div></div>
    <div class="stat">${icon('heart')}<div><b>${fmtN(s.reactions)}</b><small>Reações</small></div></div>
    <div class="stat">${icon('reply')}<div><b>${fmtN(s.replies)}</b><small>Respostas</small></div></div>
    <div class="stat">${icon('calendar')}<div><b>${fmtSince(Date.now() - s.days * 86400000)}</b><small>Na comunidade</small></div></div></div>`;
}

const AUDIT_ICON = { remover_mensagem: 'trash', alertar_usuario: 'shield', editar_canal: 'edit', banir_usuario: 'ban', desbanir_usuario: 'check', confirmar_senha: 'key', ver_painel: 'eye', resolver_sinal: 'flag', alterar_papel: 'user' };

async function modWidgetHtml() {
  const head = `<div class="modw-head"><h3>Ferramentas de moderação</h3><span class="role-pill">${icon('shield')} Moderador</span>${icon(S.me.modElevatedUntil ? 'unlock' : 'lock')}<a class="see" href="#/admin">Ver tudo ${icon('arrowRight')}</a></div>`;
  if (!S.me.modElevatedUntil) {
    return `<div class="card modw">${head}<div class="locked-box">${icon('lockFill')}<span>O painel está trancado. Confirme a senha de moderação para ver o registro e agir.</span><a class="btn sm primary" href="#/admin">Desbloquear</a></div></div>`;
  }
  try {
    const rows = await api('/mod/audit?limit=4');
    return `<div class="card modw">${head}${rows.map(r => `<div class="arow ${r.allowed ? '' : 'denied'}">${icon(AUDIT_ICON[r.action] || 'shield')}<b>${esc(r.actor_name || 'Servidor')}</b><span>${esc(r.detail)}</span><time>${fmtTime(r.created_at)}</time></div>`).join('')}</div>`;
  } catch (e) {
    if (e.data?.code === 'elevation_required') { S.me.modElevatedUntil = null; return modWidgetHtml(); }
    return '';
  }
}

async function renderSide() {
  const side = $('#side'); if (!side) return;
  try {
    const [p, g] = await Promise.all([api('/users/' + S.me.id), api('/gifts')]);
    S.me.karma = p.user.karma;
    const featured = g.rare.find(x => !x.ownedSerial && x.stockLeft > 0) || g.rare[0];
    const html = profileHeadCard(p) + karmaCardHtml(g.karma, g.threshold) + giftCardHtml(featured, { karma: g.karma, threshold: g.threshold })
      + statsHtml(p.stats, p.rareGifts.length) + (S.me.role === 'moderator' ? await modWidgetHtml() : '');
    if ($('#side')) $('#side').innerHTML = html;
  } catch (e) { /* ignora */ }
}

// ---------------------------------------------------------------------------
// Página de perfil
// ---------------------------------------------------------------------------
async function pageProfile(id) {
  const page = $('#page');
  page.innerHTML = '<div class="loading">Carregando perfil…</div>';
  let p, k = null, g = null;
  try {
    p = await api('/users/' + id);
    if (id === S.me.id) [k, g] = await Promise.all([api('/karma'), api('/gifts')]);
  } catch (e) { page.innerHTML = `<div class="card placeholder">${icon('alert')}<h1>${esc(e.message)}</h1></div>`; return; }
  const u = p.user, own = u.id === S.me.id;
  const genderTxt = u.gender ? (u.gender === 'M' ? '♂ Masculino' : '♀ Feminino') : null;
  page.innerHTML = `<div class="profile">
    <section class="card prof-main">
      <div class="cover"></div>
      <div class="prof-id">
        <div class="row">${avatarHtml(u.avatar, 120, { online: u.online })}${own ? `<button class="btn" data-act="edit-profile">${icon('edit')} Editar perfil</button>` : ''}</div>
        <h1>${esc(u.name)} ${u.role === 'moderator' ? `<span class="role-pill">${icon('shield')} Moderador</span>` : ''}${u.status === 'banned' ? '<span class="chip bad">Suspenso</span>' : ''}</h1>
        <div class="meta-line"><span>@${esc(u.handle)}</span><span><i style="width:9px;height:9px;border-radius:50%;background:${u.online ? 'var(--green)' : 'var(--faint)'};display:inline-block"></i>${u.online ? 'Online' : 'Offline'}</span>
          <span>${icon('calendar')} Há ${fmtSince(u.memberSince)} na comunidade</span>
          ${genderTxt ? `<span>${genderTxt}${own ? ` <span class="privacy">(${u.genderVisible ? 'visível para todos' : 'só você vê'})</span>` : ''}</span>` : ''}</div>
        ${u.bio ? `<p class="bio" style="margin-top:14px;font-size:15px">${esc(u.bio)}</p>` : ''}
        ${u.interests.length ? `<div class="tags">${u.interests.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="section showcase"><h3>✨ Vitrine de presentes raros</h3>
        <p class="lead">Conquistados com ${fmtN(S.config.karma.threshold)} Karma. Edição limitada e numerada. Não estão à venda na loja.</p>
        ${p.rareGifts.length ? `<div class="show-grid">${p.rareGifts.map(r => `<div class="gift ${esc(r.tint)}"><img class="gift-img tint-${esc(r.tint)}" src="${esc(r.image)}" alt=""><div><h3>${esc(r.name)}</h3><p class="gdesc">${esc(r.description)}</p><span class="serial">Nº ${r.serial} de ${r.stock_total} · ${new Date(r.acquired_at).toLocaleDateString('pt-BR')}</span></div></div>`).join('')}</div>`
          : `<div class="empty">${own ? `Você ainda não tem presentes raros. Faltam <b>${fmtN(Math.max(0, S.config.karma.threshold - u.karma))}</b> Karma para a primeira troca.` : 'Nenhum presente raro ainda.'}</div>`}
      </div>
      <div class="section"><h3>${icon('gift')} Presentes recebidos · loja</h3><p class="lead">Enviados por outras pessoas com moedas. Ficam separados dos raros.</p>
        ${p.shopGifts.length ? `<div class="shop-row">${p.shopGifts.map(s => `<span class="shop-chip"><span class="e">${s.emoji}</span>${esc(s.name)} <small>×${s.count}</small></span>`).join('')}</div>` : '<div class="empty">Nenhum presente da loja ainda.</div>'}
      </div>
    </section>
    <aside class="stack">
      ${own ? karmaCardHtml(k.karma, k.threshold, { today: k.today, cap: k.dailyCap }) : `<div class="card kcard">${ringHtml(u.karma, S.config.karma.threshold)}<div><h3>Karma</h3><p class="sub">${fmtN(u.karmaTotal)} acumulados no total</p><p class="note">O Karma cresce com respostas e reações de outras pessoas.</p></div></div>`}
      ${own && g ? (() => { const f = g.rare.find(x => !x.ownedSerial && x.stockLeft > 0); return f ? giftCardHtml(f, { karma: g.karma, threshold: g.threshold }) : ''; })() : ''}
      ${statsHtml(p.stats, p.rareGifts.length)}
      ${own ? `<div class="card ledger"><h3>Histórico de Karma</h3>${k.ledger.length ? k.ledger.map(l => `<div class="lrow"><span>${esc(l.text)}</span><span class="d ${l.delta > 0 ? 'pos' : l.delta < 0 ? 'neg' : 'zero'}">${l.delta > 0 ? '+' : ''}${fmtN(l.delta)}</span><time>${fmtTime(l.created_at)}</time></div>`).join('') : '<p class="muted" style="font-size:13.5px;padding-bottom:6px">Nada ainda. Mande uma mensagem com conteúdo no chat!</p>'}</div>
        <div class="card rules"><h3>Como ganhar Karma</h3><ul>${S.config.karma.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>` : ''}
    </aside></div>`;
}

function openEditProfile() {
  const me = S.me;
  const lock = me.nameChangeAvailableAt ? `Próxima troca de apelido liberada ${fmtTime(me.nameChangeAvailableAt).toLowerCase()}.` : 'Você pode trocar o apelido uma vez a cada 24h.';
  const m = modal(`<h2>Editar perfil</h2>
    <form id="editForm" novalidate>
      <input type="hidden" name="avatar" value="${esc(me.avatar)}">
      <div class="field"><span>Avatar</span>${avatarPicker(me.avatar)}</div>
      <label class="field" data-f="displayName"><span>Nome / apelido</span><input type="text" name="displayName" value="${esc(me.name)}" maxlength="20"><small>${esc(lock)}</small><div class="err"></div></label>
      <label class="field" data-f="bio"><span>Bio</span><textarea name="bio" maxlength="160" rows="3">${esc(me.bio)}</textarea><div class="err"></div></label>
      <label class="field" data-f="interests"><span>Interesses</span><input type="text" name="interests" value="${esc(me.interests.join(', '))}" placeholder="🐾 Animais, 🌿 Natureza"><small>Separe por vírgula. Até 5.</small><div class="err"></div></label>
      <div class="field" data-f="gender"><span>Sexo <em>obrigatório</em></span><div class="gender">
        <label><input type="radio" name="gender" value="M" ${me.gender === 'M' ? 'checked' : ''}><span class="sym">♂</span> Masculino</label>
        <label><input type="radio" name="gender" value="F" ${me.gender === 'F' ? 'checked' : ''}><span class="sym">♀</span> Feminino</label></div><div class="err"></div>
        <label class="check"><input type="checkbox" name="genderVisible" ${me.genderVisible ? 'checked' : ''}><span>Mostrar no meu perfil público</span></label></div>
      <div class="actions"><button type="button" class="btn" data-x>Cancelar</button><button class="btn primary">Salvar</button></div>
    </form>`, { wide: true });
  const f = m.querySelector('form');
  bindPicker(f, f.avatar);
  m.querySelector('[data-x]').onclick = closeModal;
  f.onsubmit = async e => {
    e.preventDefault();
    f.querySelectorAll('.field').forEach(x => { x.classList.remove('invalid'); const er = x.querySelector('.err'); if (er) er.textContent = ''; });
    const body = { avatar: f.avatar.value, bio: f.bio.value, gender: f.gender.value, genderVisible: f.genderVisible.checked,
      interests: f.interests.value.split(',').map(s => s.trim()).filter(Boolean) };
    if (f.displayName.value.trim() !== me.name) body.displayName = f.displayName.value;
    try {
      S.me = await api('/me/profile', { method: 'PUT', body });
      closeModal(); toast('Perfil atualizado.');
      route();
    } catch (err) { showFieldErr(f, err.data?.field, err.message); }
  };
}

// ---------------------------------------------------------------------------
// Recompensas
// ---------------------------------------------------------------------------
async function pageRewards() {
  const page = $('#page');
  page.innerHTML = '<div class="loading">Carregando…</div>';
  const [g, k] = await Promise.all([api('/gifts'), api('/karma')]);
  const left = Math.max(0, g.threshold - g.karma);
  page.innerHTML = `<div class="rewards">
    <section class="card rw-head">${ringHtml(g.karma, g.threshold, 128)}
      <div><h1>${left ? `Faltam ${fmtN(left)} Karma` : 'Você pode trocar um presente raro!'}</h1>
        <p>Karma vem de conversas que outras pessoas valorizam: respostas, reações e mensagens com conteúdo. Ao chegar a ${fmtN(g.threshold)}, você troca os pontos por um presente raro que fica em destaque no seu perfil.</p>
        <div class="today" style="margin-top:12px"><span>Hoje: <b>+${k.today}</b> de ${k.dailyCap}</span><span>Acumulado: <b>${fmtN(k.total)}</b></span></div></div>
      <button class="btn" data-act="rules">${icon('info')} Regras</button></section>
    <div class="h2row"><h2>Presentes raros e exclusivos</h2><p>Só com Karma · edição numerada · um de cada por pessoa</p></div>
    <div class="rare-grid">${g.rare.map(x => giftCardHtml(x, { karma: g.karma, threshold: g.threshold })).join('')}</div>
    <div class="compare"><div class="card"><b>✨ Raros (Karma)</b>Conquistados participando. Não podem ser comprados, têm estoque limitado e número de série. Aparecem na vitrine do perfil.</div>
      <div class="card"><b>🪙 Loja (moedas)</b>Comprados para presentear outras pessoas. Aparecem separados, em "Presentes recebidos".</div></div>
    <div class="h2row"><h2>Presentes da loja</h2><p>Continuam à venda normalmente</p></div>
    <div class="shop-grid">${g.shop.map(s => `<div class="card shop-card"><div class="e">${s.emoji}</div><b>${esc(s.name)}</b><small>${esc(s.description)}</small><span class="coin">${icon('coin')} ${s.price} moedas</span></div>`).join('')}</div>
  </div>`;
}

async function redeem(id) {
  const g = await api('/gifts');
  const gift = g.rare.find(x => x.id === id);
  if (!gift) return;
  const ok = await ask({ title: `Trocar por ${gift.name}?`, text: `Serão descontados ${fmtN(gift.cost)} Karma do seu saldo (${fmtN(g.karma)} → ${fmtN(g.karma - gift.cost)}). Seu Karma acumulado continua registrado.`, ok: `Trocar ${fmtN(gift.cost)} Karma`, input: false });
  if (!ok) return;
  try {
    const out = await api(`/gifts/${id}/redeem`, { method: 'POST' });
    modal(`<div class="celebrate"><div class="stage"><img class="gift-img tint-${esc(gift.tint)}" src="${esc(gift.image)}" alt=""></div>
      <h2>${esc(out.name)} é sua! ✨</h2><span class="serial-big">Nº ${out.serial} de ${out.stockTotal}</span>
      <p class="muted" style="margin-top:12px">O presente já está em destaque na vitrine do seu perfil.</p>
      <div class="actions" style="justify-content:center"><button class="btn" data-x>Fechar</button><a class="btn primary" href="#/perfil">Ver no perfil</a></div></div>`)
      .querySelector('[data-x]').onclick = () => { closeModal(); route(); };
    refreshMe();
  } catch (e) { toast(e.message, { kind: 'err' }); }
}

function showRules() {
  modal(`<h2>Como funciona o Karma</h2><p class="muted">O Karma recompensa participação que melhora a conversa, não volume.</p>
    <ul>${S.config.karma.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
    <p class="muted" style="margin-top:14px;font-size:13.5px">Contas com padrões suspeitos (muitas mensagens repetidas, reações sempre entre as mesmas pessoas, várias contas do mesmo lugar) são sinalizadas para a moderação.</p>
    <div class="actions"><button class="btn primary" data-x>Entendi</button></div>`).querySelector('[data-x]').onclick = closeModal;
}

// ---------------------------------------------------------------------------
// Moderação
// ---------------------------------------------------------------------------
async function pageAdmin() {
  const page = $('#page');
  if (S.me.role !== 'moderator') {
    // O menu nem aparece para usuário comum, mas mesmo digitando o endereço
    // quem decide é o servidor, que recusa e registra a tentativa.
    let msg = '';
    try { await api('/mod/overview'); } catch (e) { msg = `${e.status} · ${e.message}`; }
    page.innerHTML = `<div class="card gate"><div class="big-ic no">${icon('ban')}</div><h1>Área exclusiva da moderação</h1>
      <p>Sua conta não tem o papel de moderador no banco de dados. Esta tentativa foi registrada.</p>
      <div class="server-says">Resposta do servidor: ${esc(msg)}</div>
      <p style="margin-top:20px"><a class="btn" href="#/comunidade">Voltar para a Comunidade</a></p></div>`;
    return;
  }
  if (!S.me.modElevatedUntil || S.me.modElevatedUntil < Date.now()) return renderPinGate();
  return renderAdminPanel();
}

function renderPinGate() {
  $('#page').innerHTML = `<div class="card gate"><div class="big-ic">${icon('shieldCheck')}</div><h1>Confirme que é você</h1>
    <p>Para abrir o painel de moderação, digite a senha de moderação. O acesso vale por 15 minutos.</p>
    <div class="checks"><div>${icon('check')} Conta Google verificada (${esc(S.me.email)})</div><div>${icon('check')} Papel de moderador confirmado pelo servidor</div><div>${icon('lock', 'x')} Senha de moderação pendente</div></div>
    <form id="pinForm"><label class="field" data-f="pin"><span>Senha de moderação</span><input type="password" name="pin" autocomplete="current-password" required><div class="err"></div></label>
      <button class="btn primary big" style="margin-top:16px">${icon('unlock')} Desbloquear painel</button></form>
    <p class="muted" style="font-size:12.5px;margin-top:14px">Até 5 tentativas a cada 15 minutos. Toda ação no painel fica registrada com seu nome.</p></div>`;
  const f = $('#pinForm');
  f.onsubmit = async e => {
    e.preventDefault();
    try {
      await api('/mod/elevate', { method: 'POST', body: { pin: f.pin.value } });
      await refreshMe(); toast('Painel desbloqueado por 15 minutos.');
      renderShell('admin'); every(15000, refreshMe); renderAdminPanel();
    } catch (err) { showFieldErr(f, 'pin', err.message); f.pin.select(); }
  };
}

const FLAG_LABEL = { spam_repeticao: ['Mensagens repetidas', 'bad'], multi_contas: ['Várias contas', 'warn'], reciprocidade: ['Reações combinadas', 'warn'], limite_diario: ['Teto diário', 'pri'], acesso_moderacao: ['Tentou moderar', 'bad'] };
const BLOCK_LABEL = { curta: 'curtas', repetida: 'repetidas', intervalo: 'intervalo', limite: 'teto diário', reciprocidade: 'reciprocidade' };

async function renderAdminPanel() {
  const page = $('#page');
  let d;
  try { d = await api('/mod/overview?q=' + encodeURIComponent(S.adminQ)); }
  catch (e) {
    if (e.data?.code === 'elevation_required') { S.me.modElevatedUntil = null; return renderPinGate(); }
    page.innerHTML = `<div class="card placeholder">${icon('alert')}<h1>${esc(e.message)}</h1></div>`; return;
  }
  const mt = d.metrics;
  const openFlags = d.flags.filter(f => !f.resolved_at).length;
  const blocked = mt.blockedToday.reduce((a, b) => a + b.n, 0);
  const tabs = [['flags', 'Sinais', openFlags], ['msgs', 'Mensagens', d.messages.length], ['users', 'Usuários', d.users.length], ['audit', 'Registro', d.audit.length]];
  page.innerHTML = `<div class="admin">
    <div class="admin-top"><h1>Painel de moderação</h1><span class="timer">${icon('clock')} <span id="elev">--:--</span> restantes</span>
      <button class="btn" data-act="mod-lock">${icon('lock')} Trancar painel</button></div>
    <div class="tiles">
      <div class="card tile"><small>Chegaram a ${fmtN(mt.threshold)} Karma</small><b>${mt.reachedThreshold}</b><span>${mt.avgDaysToThreshold ? `em média ${mt.avgDaysToThreshold} dias` : 'sem dados ainda'}</span></div>
      <div class="card tile"><small>Perto da troca (≥ 80%)</small><b>${mt.near}</b><span>usuários</span></div>
      <div class="card tile"><small>Presentes raros trocados</small><b>${mt.redeemed}</b><span>no total</span></div>
      <div class="card tile"><small>Karma distribuído hoje</small><b>${fmtN(mt.pointsToday)}</b><span>${mt.scoredToday} mensagens pontuadas</span></div>
      <div class="card tile"><small>Mensagens sem Karma hoje</small><b>${blocked}</b><div class="chips">${mt.blockedToday.map(b => `<span class="chip warn">${esc(BLOCK_LABEL[b.reason] || b.reason)}: ${b.n}</span>`).join('') || '<span class="chip">nenhuma</span>'}</div></div>
    </div>
    <div class="tabs">${tabs.map(([k, l, n]) => `<button data-act="mod-tab" data-tab="${k}" class="${S.adminTab === k ? 'on' : ''}">${l} <span class="n">${n}</span></button>`).join('')}</div>
    <div id="modTab">${adminTab(d)}</div></div>`;
  const q = $('#adminQ');
  if (q) q.addEventListener('change', () => { S.adminQ = q.value; renderAdminPanel(); });
  const tick = () => {
    const el = $('#elev'); if (!el) return;
    const ms = (S.me.modElevatedUntil || 0) - Date.now();
    if (ms <= 0) { S.me.modElevatedUntil = null; toast('Sessão de moderação expirou.', { kind: 'warn' }); route(); return; }
    el.textContent = `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  };
  tick(); every(1000, tick);
}

function who(name, avatar, sub = '') {
  return `<div class="who">${avatarHtml(avatar || 'raposa', 34)}<div><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div></div>`;
}

function adminTab(d) {
  switch (S.adminTab) {
    case 'flags':
      return `<div class="card table"><div class="trow head g-flags"><span>Usuário</span><span>Sinal</span><span>Detalhe</span><span>Quando</span><span></span></div>
        ${d.flags.map(f => { const [l, c] = FLAG_LABEL[f.kind] || [f.kind, 'pri']; return `<div class="trow g-flags ${f.resolved_at ? 'resolved' : ''}">${who(f.name, f.avatar, f.status === 'banned' ? 'suspenso' : '')}
          <span><span class="chip ${c}">${esc(l)}</span></span><span class="txt">${esc(f.detail)}</span><time>${fmtTime(f.created_at)}</time>
          <span class="acts">${f.resolved_at ? '<span class="chip ok">revisado</span>' : `<a class="btn sm" href="#/perfil/${f.user_id}">Perfil</a><button class="btn sm" data-act="mod-warn" data-id="${f.user_id}">Alertar</button>${f.status === 'active' ? `<button class="btn sm danger" data-act="mod-ban" data-id="${f.user_id}">Banir</button>` : ''}<button class="btn sm" data-act="mod-resolve" data-id="${f.id}">${icon('check')} Revisado</button>`}</span></div>`; }).join('') || '<div class="loading">Nenhum sinal.</div>'}</div>`;
    case 'msgs':
      return `<div class="card table"><div class="trow head g-msgs"><span>Autor</span><span>Mensagem</span><span>Karma</span><span>Quando</span><span></span></div>
        ${d.messages.map(m => `<div class="trow g-msgs ${m.deleted_at ? 'resolved' : ''}">${who(m.name, m.avatar)}<span class="txt">${m.deleted_at ? `<i>removida (${esc(m.delete_reason)})</i> · ` : ''}${esc(m.body)}</span>
          <span><span class="chip ${m.scored ? 'ok' : ''}">${m.scored ? 'pontuou' : 'sem Karma'}</span></span><time>${fmtTime(m.created_at)}</time>
          <span class="acts">${m.deleted_at ? '' : `<button class="btn sm danger" data-act="mod-del" data-id="${m.id}">${icon('trash')} Remover</button>`}</span></div>`).join('')}</div>`;
    case 'users':
      return `<div class="toolbar"><input id="adminQ" type="search" placeholder="Buscar por nome, @usuário ou e-mail" value="${esc(S.adminQ)}"></div>
        <div class="card table"><div class="trow head g-users"><span>Usuário</span><span>Papel</span><span>Status</span><span>Karma</span><span>Sinais</span><span></span></div>
        ${d.users.map(u => `<div class="trow g-users">${who(u.name, u.avatar, `@${u.handle} · ${u.email}`)}
          <span>${u.role === 'moderator' ? '<span class="chip pri">moderador</span>' : '<span class="chip">usuário</span>'}</span>
          <span>${u.status === 'banned' ? '<span class="chip bad">banido</span>' : '<span class="chip ok">ativo</span>'}</span>
          <span>${fmtN(u.karma)}</span><span>${u.open_flags ? `<span class="chip warn">${u.open_flags}</span>` : '–'}</span>
          <span class="acts"><a class="btn sm" href="#/perfil/${u.id}">Perfil</a>${u.role === 'moderator' || u.id === S.me.id ? '' : `<button class="btn sm" data-act="mod-warn" data-id="${u.id}">Alertar</button>${u.status === 'banned' ? `<button class="btn sm" data-act="mod-unban" data-id="${u.id}">Desbanir</button>` : `<button class="btn sm danger" data-act="mod-ban" data-id="${u.id}">Banir</button>`}`}</span></div>`).join('')}</div>`;
    case 'audit':
      return `<div class="card table"><div class="trow head g-audit"><span></span><span>Quem</span><span>Ação</span><span>Alvo</span><span>IP</span><span>Quando</span></div>
        ${d.audit.map(a => `<div class="trow g-audit ${a.allowed ? '' : 'denied'}">${icon(a.allowed ? (AUDIT_ICON[a.action] || 'shield') : 'ban')}<b>${esc(a.actor_name || 'Servidor (terminal)')}</b>
          <span class="txt">${a.allowed ? '' : '<b style="color:var(--danger)">NEGADO · </b>'}${esc(a.detail)}</span><span class="txt">${esc(a.target_name || '–')}</span><span class="txt">${esc(a.ip)}</span><time>${fmtTime(a.created_at)}</time></div>`).join('')}</div>`;
  }
  return '';
}

async function modAction(path, successMsg) {
  try { await api(path.url, { method: 'POST', body: path.body }); toast(successMsg); }
  catch (e) {
    if (e.data?.code === 'elevation_required') { S.me.modElevatedUntil = null; toast('Confirme a senha de moderação.', { kind: 'warn' }); return go('#/admin'); }
    toast(e.message, { kind: 'err' });
  }
  if ($('.admin')) renderAdminPanel(); else { S.msgSig = ''; loadMessages(false); renderSide(); }
}

// ---------------------------------------------------------------------------
// Eventos (delegação)
// ---------------------------------------------------------------------------
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act, id = t.dataset.id ? +t.dataset.id : null;
  switch (act) {
    case 'google-demo': return openGoogleChooser();
    case 'theme': return setTheme(t.dataset.theme);
    case 'rules': return showRules();
    case 'focus-search': return $('#q')?.focus();
    case 'edit-profile': e.preventDefault(); if (!location.hash.startsWith('#/perfil') || location.hash.split('/')[2]) { location.hash = '#/perfil'; setTimeout(openEditProfile, 250); } else openEditProfile(); return;
    case 'menu': {
      const p = popover(t, `<a href="#/perfil">${icon('user')} Meu perfil</a><a href="#/recompensas">${icon('gift')} Recompensas</a><button class="item" data-act="logout">${icon('logout')} Sair</button>`);
      p.addEventListener('click', () => setTimeout(closePops));
      return;
    }
    case 'logout': await api('/auth/logout', { method: 'POST' }); S.me = null; return go('#/entrar');
    case 'bell': {
      const list = await api('/notifications');
      popover(t, `<h4>Notificações</h4>${list.map(n => `<div class="n ${n.read_at ? '' : 'unread'}"><span>${esc(n.text)}</span><time>${fmtTime(n.created_at)}</time></div>`).join('') || '<p class="muted" style="padding:10px;font-size:13.5px">Nada por aqui.</p>'}`, 'notif');
      if (list.some(n => !n.read_at)) { await api('/notifications/read', { method: 'POST' }); $('#bellPip').hidden = true; S.me.unreadNotifications = 0; }
      return;
    }
    case 'react':
      try { await api(`/messages/${id}/reactions`, { method: 'POST', body: { emoji: t.dataset.emoji } }); closePops(); S.msgSig = ''; loadMessages(false); }
      catch (err) { toast(err.message, { kind: 'err' }); }
      return;
    case 'picker':
      popover(t, S.config.reactions.map(r => `<button data-act="react" data-id="${id}" data-emoji="${r}">${r}</button>`).join(''), 'emoji-pop');
      return;
    case 'emoji-insert': {
      const p = popover(t, ['😊', '🧡', '✨', '🐾', '😄', '🙌', '🌿', '☀️', '🐱', '🦊'].map(r => `<button type="button" data-emo="${r}">${r}</button>`).join(''), 'emoji-pop');
      p.onclick = ev => { const b = ev.target.closest('[data-emo]'); if (!b) return; const i = $('#msgInput'); i.value += b.dataset.emo; i.focus(); updateHint(); };
      return;
    }
    case 'reply':
      S.replyTo = S.messages.find(m => m.id === id) || null; renderReplyBar(); $('#msgInput')?.focus(); return;
    case 'cancel-reply': S.replyTo = null; return renderReplyBar();
    case 'redeem': return redeem(id);
    case 'mod-tab': S.adminTab = t.dataset.tab; return renderAdminPanel();
    case 'mod-lock': await api('/mod/lock', { method: 'POST' }); await refreshMe(); S.me.modElevatedUntil = null; toast('Painel trancado.'); return route();
    case 'mod-del': { const r = await ask({ title: 'Remover mensagem?', text: 'O autor será notificado e o Karma gerado por ela será estornado.', placeholder: 'conteúdo impróprio', ok: 'Remover', danger: true }); if (r) modAction({ url: `/mod/messages/${id}/delete`, body: { reason: r } }, 'Mensagem removida.'); return; }
    case 'mod-warn': { const r = await ask({ title: 'Enviar alerta', text: 'O usuário recebe uma notificação da moderação.', placeholder: 'linguagem ofensiva', ok: 'Enviar alerta' }); if (r) modAction({ url: `/mod/users/${id}/warn`, body: { reason: r } }, 'Alerta enviado.'); return; }
    case 'mod-ban': { const r = await ask({ title: 'Banir usuário?', text: 'A conta perde o acesso imediatamente e todas as sessões são encerradas.', placeholder: 'spam', ok: 'Banir', danger: true }); if (r) modAction({ url: `/mod/users/${id}/ban`, body: { reason: r } }, 'Usuário banido.'); return; }
    case 'mod-unban': { const r = await ask({ title: 'Reverter banimento?', placeholder: 'revisão', ok: 'Desbanir' }); if (r) modAction({ url: `/mod/users/${id}/unban`, body: { reason: r } }, 'Banimento revertido.'); return; }
    case 'mod-resolve': return modAction({ url: `/mod/flags/${id}/resolve` }, 'Sinal marcado como revisado.');
  }
});

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------
(async function boot() {
  try {
    const [config, avatars] = await Promise.all([api('/config'), api('/avatars')]);
    S.config = config;
    S.avatars = Object.fromEntries(avatars.map(a => [a.key, a]));
    try { S.me = await api('/me'); } catch (e) { S.me = null; }
  } catch (e) {
    app.innerHTML = '<div class="loading">Não foi possível conectar ao servidor.</div>';
    return;
  }
  route();
})();
