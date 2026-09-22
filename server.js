// Toca: servidor de demonstração (Node.js >= 22.13, sem dependências externas).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('./lib/config');
const { db, tx } = require('./lib/db');
const karma = require('./lib/karma');
const { AVATARS, byKey, randomAvatar } = require('./lib/avatars');
const { normalize, nameKey, validateDisplayName } = require('./lib/text');

const PUBLIC = path.join(__dirname, 'public');
const REACTIONS = ['❤️', '🐾', '😄', '🐱', '🌱', '⛰️', '✨', '🎉', '🦉', '👏'];
const now = () => Date.now();

// ---------------------------------------------------------------------------
// CLI: promover/rebaixar moderador direto no banco (nunca pela API pública)
// ---------------------------------------------------------------------------
const cli = process.argv.indexOf('--promote') > -1 ? 'moderator' : process.argv.indexOf('--demote') > -1 ? 'user' : null;
if (cli) {
  const email = process.argv[process.argv.length - 1];
  const r = db.prepare('UPDATE users SET role = ? WHERE email = ?').run(cli, email);
  console.log(r.changes ? `${email} agora é ${cli}.` : `Usuário ${email} não encontrado.`);
  if (r.changes) db.prepare('INSERT INTO mod_audit (actor_id, action, allowed, target_user_id, detail, ip, created_at) VALUES (NULL, ?, 1, (SELECT id FROM users WHERE email = ?), ?, ?, ?)')
    .run('alterar_papel', email, `Papel alterado para ${cli} via terminal do servidor`, 'cli', now());
  process.exit(0);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com/gsi/client",
    "frame-src https://accounts.google.com/gsi/",
    "connect-src 'self' https://accounts.google.com/gsi/",
    "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data: https://*.googleusercontent.com",
  ].join('; '));
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}
const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 20000) { reject(new HttpError(413, 'Requisição grande demais.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'JSON inválido.')); }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(p => p.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
// Atrás de um proxy (Railway), o IP real do visitante vem no X-Forwarded-For. Só confiamos
// nesse cabeçalho quando há proxy; senão qualquer um poderia forjar o próprio IP.
const TRUST_PROXY = process.env.TRUST_PROXY === '1' || !!process.env.RAILWAY_ENVIRONMENT;
const ipOf = req => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '';

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------
function createSession(res, userId, req) {
  const token = crypto.randomBytes(32).toString('base64url');
  const exp = now() + config.SESSION_DAYS * 86400000;
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(sha256(token), userId, now(), exp);
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${config.COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${config.SESSION_DAYS * 86400}${secure}`);
}

function loadSession(req) {
  const token = parseCookies(req)[config.COOKIE_NAME];
  if (!token) return {};
  const hash = sha256(token);
  const session = db.prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?').get(hash, now());
  if (!session) return {};
  // O papel e o status vêm SEMPRE do banco, a cada requisição. Nada que o navegador
  // envie decide se alguém é moderador.
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
  if (!user || user.status !== 'active') return {};
  if (!user.last_seen_at || now() - user.last_seen_at > 30000) db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now(), user.id);
  return { session, user, hash };
}

// ---------------------------------------------------------------------------
// Serialização
// ---------------------------------------------------------------------------
const isOnline = u => !!u.last_seen_at && now() - u.last_seen_at < 5 * 60000;
const needsOnboarding = u => !u.name_confirmed || !u.gender;

function publicUser(u, viewerId) {
  const self = viewerId === u.id;
  return {
    id: u.id, name: u.display_name, handle: u.handle, avatar: u.avatar, role: u.role, status: u.status,
    online: isOnline(u), bio: u.bio, interests: JSON.parse(u.interests || '[]'),
    karma: u.karma, karmaTotal: u.karma_total, memberSince: u.created_at,
    gender: self || u.gender_visible ? u.gender : null,
    ...(self ? { genderVisible: !!u.gender_visible } : {}),
  };
}

function meView(user, session) {
  const unread = db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(user.id).n;
  const cooldownEnd = user.name_changed_at ? user.name_changed_at + config.NAME.CHANGE_COOLDOWN_HOURS * 3600000 : 0;
  return {
    ...publicUser(user, user.id),
    email: user.email,
    nameConfirmed: !!user.name_confirmed,
    needsOnboarding: needsOnboarding(user),
    nameChangeAvailableAt: cooldownEnd > now() ? cooldownEnd : null,
    modElevatedUntil: user.role === 'moderator' && session.mod_elevated_until > now() ? session.mod_elevated_until : null,
    unreadNotifications: unread,
    karmaThreshold: config.KARMA.REDEEM_THRESHOLD,
  };
}

// ---------------------------------------------------------------------------
// Cadastro / login
// ---------------------------------------------------------------------------
function findOrCreateUser({ sub, email, ip }) {
  let user = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(sub)
    || db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user) {
    if (user.status === 'banned') fail(403, 'Esta conta foi suspensa pela moderação.');
    return { user, created: false };
  }
  return tx(() => {
    const av = randomAvatar();
    let name, key, digits;
    do {
      digits = String(crypto.randomInt(1000, 10000));
      name = `${av.label} ${digits}`;
      key = nameKey(name);
    } while (db.prepare('SELECT 1 FROM users WHERE name_key = ?').get(key));
    const r = db.prepare(`INSERT INTO users (google_sub, email, display_name, name_key, handle, avatar, signup_ip, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(sub, email, name, key, key, av.key, ip, now(), now());
    const id = Number(r.lastInsertRowid);
    const sameIp = db.prepare('SELECT COUNT(*) n FROM users WHERE signup_ip = ? AND created_at > ?').get(ip, now() - 86400000).n;
    if (sameIp >= 3) {
      db.prepare('INSERT INTO flags (user_id, kind, detail, created_at) VALUES (?, ?, ?, ?)')
        .run(id, 'multi_contas', `${sameIp} contas criadas do mesmo endereço nas últimas 24h`, now());
    }
    db.prepare('INSERT INTO notifications (user_id, kind, text, created_at) VALUES (?, ?, ?, ?)')
      .run(id, 'boas_vindas', `Bem-vindo(a) à Toca! Você ganhou o avatar ${av.label}. Troque o apelido quando quiser no seu perfil.`, now());
    return { user: db.prepare('SELECT * FROM users WHERE id = ?').get(id), created: true };
  });
}

async function verifyGoogleCredential(credential) {
  if (!config.GOOGLE_CLIENT_ID) fail(400, 'Login Google não configurado neste servidor.');
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!r.ok) fail(401, 'Credencial Google inválida.');
  const t = await r.json();
  if (t.aud !== config.GOOGLE_CLIENT_ID) fail(401, 'Credencial emitida para outro aplicativo.');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(t.iss)) fail(401, 'Emissor inválido.');
  if (String(t.email_verified) !== 'true') fail(401, 'E-mail Google não verificado.');
  if (Number(t.exp) * 1000 < now()) fail(401, 'Credencial expirada.');
  return { sub: `google-${t.sub}`, email: t.email.toLowerCase() };
}

// ---------------------------------------------------------------------------
// Moderação: portão único para TODA ação de moderação
// ---------------------------------------------------------------------------
function audit(actorId, action, allowed, { targetUser = null, targetMessage = null, detail = '', ip = '' } = {}) {
  db.prepare('INSERT INTO mod_audit (actor_id, action, allowed, target_user_id, target_message_id, detail, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(actorId, action, allowed ? 1 : 0, targetUser, targetMessage, detail, ip, now());
}

function requireModerator(ctx, action, { elevated = true } = {}) {
  const { user, session, req } = ctx;
  if (!user) fail(401, 'Faça login.');
  if (user.role !== 'moderator') {
    audit(user.id, action, false, { detail: 'Tentativa de ação de moderação por usuário comum', ip: ipOf(req) });
    db.prepare('INSERT INTO flags (user_id, kind, detail, created_at) VALUES (?, ?, ?, ?)')
      .run(user.id, 'acesso_moderacao', `Tentou executar "${action}" sem ser moderador`, now());
    fail(403, 'Acesso restrito a moderadores.');
  }
  if (elevated && !(session.mod_elevated_until > now())) fail(403, 'Confirme a senha de moderação para continuar.', { code: 'elevation_required' });
}

const pinAttempts = new Map();
function checkPinRate(userId) {
  const list = (pinAttempts.get(userId) || []).filter(t => now() - t < 15 * 60000);
  pinAttempts.set(userId, list);
  if (list.length >= config.MOD_PIN_MAX_ATTEMPTS) fail(429, 'Muitas tentativas. Aguarde 15 minutos.');
  list.push(now());
}

function safeEqual(a, b) {
  const x = Buffer.from(sha256(String(a))), y = Buffer.from(sha256(String(b)));
  return crypto.timingSafeEqual(x, y);
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------
const routes = [];
const route = (method, pattern, handler, opts = {}) => routes.push({ method, pattern, handler, ...opts });
const lastPost = new Map();

function requireUser(ctx, { onboarded = true } = {}) {
  if (!ctx.user) fail(401, 'Faça login para continuar.', { code: 'auth_required' });
  if (onboarded && needsOnboarding(ctx.user)) fail(403, 'Complete seu perfil primeiro.', { code: 'onboarding_required' });
  return ctx.user;
}

route('GET', /^\/api\/config$/, () => ({
  googleClientId: config.GOOGLE_CLIENT_ID || null,
  demoLogin: config.DEMO_LOGIN,
  demoAccounts: config.DEMO_LOGIN ? [
    { email: 'luna@gmail.com', name: 'Luna Raposa', avatar: 'raposa', note: 'Moderadora · 4.680 Karma' },
    { email: 'mimi@gmail.com', name: 'Mimi Gata', avatar: 'gatinho', note: 'Usuária comum · 4.996 Karma (quase lá)' },
    { email: 'thor@gmail.com', name: 'Thor Lobo', avatar: 'lobinho', note: 'Usuário comum · 2.310 Karma' },
  ] : [],
  karma: { threshold: config.KARMA.REDEEM_THRESHOLD, rules: karma.rulesSummary() },
  reactions: REACTIONS,
}));

route('GET', /^\/api\/avatars$/, () => AVATARS);

route('POST', /^\/api\/auth\/google$/, async ({ body, req, res }) => {
  const id = await verifyGoogleCredential(String(body.credential || ''));
  const { user, created } = findOrCreateUser({ ...id, ip: ipOf(req) });
  createSession(res, user.id, req);
  return { ok: true, created };
});

route('POST', /^\/api\/auth\/demo$/, ({ body, req, res }) => {
  if (!config.DEMO_LOGIN) fail(404, 'Não encontrado.');
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) fail(400, 'Informe um e-mail válido.');
  const { user, created } = findOrCreateUser({ sub: `demo-email-${email}`, email, ip: ipOf(req) });
  createSession(res, user.id, req);
  return { ok: true, created };
});

route('POST', /^\/api\/auth\/logout$/, ({ hash, res }) => {
  if (hash) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
  res.setHeader('Set-Cookie', `${config.COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  return { ok: true };
});

route('GET', /^\/api\/me$/, ctx => {
  requireUser(ctx, { onboarded: false });
  return meView(ctx.user, ctx.session);
});

route('PUT', /^\/api\/me\/profile$/, ctx => {
  const u = requireUser(ctx, { onboarded: false });
  const b = ctx.body;
  const set = {};

  if (b.displayName !== undefined) {
    const v = validateDisplayName(b.displayName, config.NAME);
    if (v.error) fail(400, v.error, { field: 'displayName' });
    const changing = v.key !== u.name_key || v.name !== u.display_name;
    if (changing) {
      const taken = db.prepare('SELECT 1 FROM users WHERE name_key = ? AND id <> ?').get(v.key, u.id);
      if (taken) fail(409, 'Esse apelido já está em uso. Tente outro.', { field: 'displayName' });
      if (u.name_confirmed && u.name_changed_at && now() - u.name_changed_at < config.NAME.CHANGE_COOLDOWN_HOURS * 3600000) {
        fail(429, `Você pode trocar o apelido uma vez a cada ${config.NAME.CHANGE_COOLDOWN_HOURS}h.`, { field: 'displayName' });
      }
      Object.assign(set, { display_name: v.name, name_key: v.key, name_changed_at: u.name_confirmed ? now() : null });
    }
    set.name_confirmed = 1;
  }

  if (b.gender !== undefined) {
    if (!['M', 'F'].includes(b.gender)) fail(400, 'Selecione Masculino ou Feminino.', { field: 'gender' });
    set.gender = b.gender;
  }
  if (!u.gender && !set.gender) fail(400, 'Selecione Masculino ou Feminino.', { field: 'gender' });
  if (b.genderVisible !== undefined) set.gender_visible = b.genderVisible ? 1 : 0;
  if (b.bio !== undefined) {
    const bio = String(b.bio).trim();
    if (bio.length > 160) fail(400, 'A bio pode ter no máximo 160 caracteres.', { field: 'bio' });
    set.bio = bio;
  }
  if (b.interests !== undefined) {
    if (!Array.isArray(b.interests) || b.interests.length > 5) fail(400, 'Até 5 interesses.', { field: 'interests' });
    const list = b.interests.map(s => String(s).trim()).filter(Boolean);
    if (list.some(s => s.length > 28)) fail(400, 'Cada interesse pode ter até 28 caracteres.', { field: 'interests' });
    set.interests = JSON.stringify(list);
  }
  if (b.avatar !== undefined) {
    if (!byKey[b.avatar]) fail(400, 'Avatar inválido.', { field: 'avatar' });
    set.avatar = b.avatar;
  }

  const keys = Object.keys(set);
  if (keys.length) db.prepare(`UPDATE users SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map(k => set[k]), u.id);
  return meView(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id), ctx.session);
});

route('GET', /^\/api\/users\/(\d+)$/, (ctx, [, id]) => {
  const viewer = requireUser(ctx);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(+id);
  if (!u) fail(404, 'Usuário não encontrado.');
  const stats = {
    messages: db.prepare('SELECT COUNT(*) n FROM messages WHERE user_id = ? AND deleted_at IS NULL').get(u.id).n,
    reactions: db.prepare('SELECT COUNT(*) n FROM reactions r JOIN messages m ON m.id = r.message_id WHERE m.user_id = ? AND r.user_id <> ?').get(u.id, u.id).n,
    replies: db.prepare('SELECT COUNT(*) n FROM messages c JOIN messages p ON p.id = c.reply_to WHERE p.user_id = ? AND c.user_id <> ?').get(u.id, u.id).n,
    days: Math.max(1, Math.round((now() - u.created_at) / 86400000)),
  };
  const rareGifts = db.prepare(`SELECT g.id, g.name, g.description, g.image, g.tint, g.stock_total, ug.serial, ug.acquired_at
    FROM user_gifts ug JOIN gifts g ON g.id = ug.gift_id WHERE ug.user_id = ? AND ug.source = 'karma' ORDER BY ug.acquired_at`).all(u.id);
  const shopGifts = db.prepare(`SELECT g.name, g.emoji, COUNT(*) count FROM user_gifts ug JOIN gifts g ON g.id = ug.gift_id
    WHERE ug.user_id = ? AND ug.source = 'shop' GROUP BY g.id ORDER BY count DESC`).all(u.id);
  return { user: publicUser(u, viewer.id), stats, rareGifts, shopGifts };
});

route('GET', /^\/api\/messages$/, ctx => {
  const me = requireUser(ctx);
  const rows = db.prepare(`SELECT m.*, u.display_name, u.avatar, u.role, u.last_seen_at,
      p.body p_body, p.deleted_at p_deleted, pu.display_name p_name, pu.avatar p_avatar
    FROM messages m JOIN users u ON u.id = m.user_id
    LEFT JOIN messages p ON p.id = m.reply_to LEFT JOIN users pu ON pu.id = p.user_id
    WHERE m.deleted_at IS NULL OR m.deleted_at > ?
    ORDER BY m.id DESC LIMIT 80`).all(now() - 10 * 60000).reverse();
  const ids = rows.map(r => r.id);
  const reacts = ids.length ? db.prepare(`SELECT message_id, emoji, COUNT(*) c, MAX(user_id = ?) mine, MIN(created_at) first
    FROM reactions WHERE message_id IN (${ids.map(() => '?').join(',')}) GROUP BY message_id, emoji ORDER BY first`).all(me.id, ...ids) : [];
  const byMsg = {};
  for (const r of reacts) (byMsg[r.message_id] ||= []).push({ emoji: r.emoji, count: r.c, mine: !!r.mine });
  const online = db.prepare('SELECT COUNT(*) n FROM users WHERE last_seen_at > ? AND status = \'active\'').get(now() - 5 * 60000).n;
  return {
    online,
    messages: rows.map(r => ({
      id: r.id, createdAt: r.created_at, image: r.deleted_at ? null : r.image,
      body: r.deleted_at ? null : r.body, deleted: !!r.deleted_at,
      user: { id: r.user_id, name: r.display_name, avatar: r.avatar, role: r.role, online: isOnline(r) },
      replyTo: r.reply_to ? { id: r.reply_to, name: r.p_name, avatar: r.p_avatar, body: r.p_deleted ? null : (r.p_body || '').split('\n')[0].slice(0, 90) } : null,
      reactions: byMsg[r.id] || [],
    })),
  };
});

route('POST', /^\/api\/messages$/, ctx => {
  const me = requireUser(ctx);
  const body = String(ctx.body.body || '').replace(/\r/g, '').trim();
  if (!body) fail(400, 'Escreva uma mensagem.');
  if (body.length > 1000) fail(400, 'A mensagem pode ter até 1.000 caracteres.');
  const last = lastPost.get(me.id) || 0;
  if (now() - last < config.POST_MIN_INTERVAL_MS) fail(429, 'Calma! Você está enviando rápido demais.');
  lastPost.set(me.id, now());

  let parent = null;
  if (ctx.body.replyTo) {
    parent = db.prepare('SELECT * FROM messages WHERE id = ? AND deleted_at IS NULL').get(+ctx.body.replyTo);
    if (!parent) fail(400, 'A mensagem respondida não existe mais.');
  }

  return tx(() => {
    const norm = normalize(body);
    const id = Number(db.prepare('INSERT INTO messages (user_id, body, norm, reply_to, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(me.id, body, norm, parent ? parent.id : null, now()).lastInsertRowid);
    const result = karma.scoreMessage(me.id, id, norm);
    const quality = !['curta', 'repetida'].includes(result.code);
    const replyAward = parent ? karma.onReply(parent, me.id, quality) : null;
    const balance = db.prepare('SELECT karma FROM users WHERE id = ?').get(me.id).karma;
    return { id, karma: { points: result.points, code: result.code, text: karma.REASONS[result.code], balance, replyAwarded: replyAward?.points || 0 } };
  });
});

route('POST', /^\/api\/messages\/(\d+)\/reactions$/, (ctx, [, id]) => {
  const me = requireUser(ctx);
  const bare = e => e.replace(/\uFE0F/g, '');
  const emoji = REACTIONS.find(r => bare(r) === bare(String(ctx.body.emoji || '')));
  if (!emoji) fail(400, 'Reação inválida.');
  const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND deleted_at IS NULL').get(+id);
  if (!msg) fail(404, 'Mensagem não encontrada.');
  return tx(() => {
    const exists = db.prepare('SELECT 1 FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').get(msg.id, me.id, emoji);
    if (exists) {
      db.prepare('DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').run(msg.id, me.id, emoji);
      return { active: false };
    }
    db.prepare('INSERT INTO reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)').run(msg.id, me.id, emoji, now());
    const out = karma.onReaction(msg, me.id);
    return { active: true, authorKarma: out?.points || 0 };
  });
});

route('GET', /^\/api\/karma$/, ctx => {
  const me = requireUser(ctx);
  const ledger = db.prepare('SELECT delta, reason, created_at FROM karma_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 25').all(me.id)
    .map(l => ({ ...l, text: karma.REASONS[l.reason] || l.reason }));
  return {
    karma: me.karma, total: me.karma_total, threshold: config.KARMA.REDEEM_THRESHOLD,
    today: karma.earnedToday(me.id), dailyCap: config.KARMA.DAILY_CAP, rules: karma.rulesSummary(), ledger,
  };
});

route('GET', /^\/api\/gifts$/, ctx => {
  const me = requireUser(ctx);
  const owned = Object.fromEntries(db.prepare("SELECT gift_id, serial FROM user_gifts WHERE user_id = ? AND source = 'karma'").all(me.id).map(r => [r.gift_id, r.serial]));
  const rare = db.prepare("SELECT * FROM gifts WHERE kind = 'rare' ORDER BY id").all().map(g => ({
    id: g.id, name: g.name, description: g.description, image: g.image, tint: g.tint, cost: g.cost_karma,
    stockTotal: g.stock_total, stockLeft: g.stock_left, ownedSerial: owned[g.id] || null,
    canRedeem: !owned[g.id] && g.stock_left > 0 && me.karma >= g.cost_karma,
  }));
  const shop = db.prepare("SELECT * FROM gifts WHERE kind = 'shop' ORDER BY price_coins").all()
    .map(g => ({ id: g.id, name: g.name, description: g.description, emoji: g.emoji, price: g.price_coins }));
  return { karma: me.karma, threshold: config.KARMA.REDEEM_THRESHOLD, rare, shop };
});

route('POST', /^\/api\/gifts\/(\d+)\/redeem$/, (ctx, [, id]) => {
  const me = requireUser(ctx);
  return tx(() => {
    const g = db.prepare("SELECT * FROM gifts WHERE id = ? AND kind = 'rare'").get(+id);
    if (!g) fail(404, 'Presente não encontrado.');
    if (db.prepare("SELECT 1 FROM user_gifts WHERE user_id = ? AND gift_id = ? AND source = 'karma'").get(me.id, g.id)) fail(409, 'Você já tem este presente.');
    const paid = db.prepare('UPDATE users SET karma = karma - ? WHERE id = ? AND karma >= ?').run(g.cost_karma, me.id, g.cost_karma);
    if (!paid.changes) fail(400, `Você precisa de ${g.cost_karma.toLocaleString('pt-BR')} Karma para esta troca.`);
    const stock = db.prepare('UPDATE gifts SET stock_left = stock_left - 1 WHERE id = ? AND stock_left > 0').run(g.id);
    if (!stock.changes) fail(409, 'Este presente esgotou.');
    const serial = g.stock_total - g.stock_left + 1;
    db.prepare("INSERT INTO user_gifts (user_id, gift_id, source, serial, acquired_at) VALUES (?, ?, 'karma', ?, ?)").run(me.id, g.id, serial, now());
    karma.log(me.id, -g.cost_karma, 'troca', null, null);
    db.prepare('INSERT INTO notifications (user_id, kind, text, created_at) VALUES (?, ?, ?, ?)')
      .run(me.id, 'presente', `Você trocou ${g.cost_karma.toLocaleString('pt-BR')} Karma por ${g.name} Nº ${serial} de ${g.stock_total}. Ele já está em destaque no seu perfil.`, now());
    return { ok: true, serial, name: g.name, stockTotal: g.stock_total };
  });
});

route('GET', /^\/api\/notifications$/, ctx => {
  const me = requireUser(ctx, { onboarded: false });
  return db.prepare('SELECT id, kind, text, created_at, read_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 20').all(me.id);
});
route('POST', /^\/api\/notifications\/read$/, ctx => {
  const me = requireUser(ctx, { onboarded: false });
  db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(now(), me.id);
  return { ok: true };
});

// ---- Moderação ------------------------------------------------------------
route('POST', /^\/api\/mod\/elevate$/, ctx => {
  requireUser(ctx);
  requireModerator(ctx, 'confirmar_senha', { elevated: false });
  checkPinRate(ctx.user.id);
  if (!safeEqual(ctx.body.pin || '', config.MOD_PIN)) {
    audit(ctx.user.id, 'confirmar_senha', false, { detail: 'Senha de moderação incorreta', ip: ipOf(ctx.req) });
    fail(401, 'Senha de moderação incorreta.');
  }
  pinAttempts.delete(ctx.user.id);
  const until = now() + config.MOD_ELEVATION_MINUTES * 60000;
  db.prepare('UPDATE sessions SET mod_elevated_until = ? WHERE token_hash = ?').run(until, ctx.hash);
  audit(ctx.user.id, 'confirmar_senha', true, { detail: `Acesso ao painel liberado por ${config.MOD_ELEVATION_MINUTES} min`, ip: ipOf(ctx.req) });
  return { ok: true, until };
});

route('POST', /^\/api\/mod\/lock$/, ctx => {
  requireUser(ctx);
  requireModerator(ctx, 'bloquear_painel', { elevated: false });
  db.prepare('UPDATE sessions SET mod_elevated_until = 0 WHERE token_hash = ?').run(ctx.hash);
  return { ok: true };
});

const auditRows = limit => db.prepare(`SELECT a.*, u.display_name actor_name, u.avatar actor_avatar, t.display_name target_name
  FROM mod_audit a LEFT JOIN users u ON u.id = a.actor_id LEFT JOIN users t ON t.id = a.target_user_id
  ORDER BY a.created_at DESC, a.id DESC LIMIT ?`).all(limit);

route('GET', /^\/api\/mod\/audit$/, ctx => {
  requireUser(ctx);
  requireModerator(ctx, 'ver_registro');
  return auditRows(Math.min(100, +ctx.query.get('limit') || 20));
});

route('GET', /^\/api\/mod\/overview$/, ctx => {
  requireUser(ctx);
  requireModerator(ctx, 'ver_painel');
  const T = config.KARMA.REDEEM_THRESHOLD;
  const sod = new Date(); sod.setHours(0, 0, 0, 0);
  const reached = db.prepare('SELECT COUNT(*) n, AVG((reached_threshold_at - created_at) / 86400000.0) d FROM users WHERE reached_threshold_at IS NOT NULL').get();
  const q = `%${(ctx.query.get('q') || '').trim()}%`;
  return {
    audit: auditRows(40),
    flags: db.prepare(`SELECT f.*, u.display_name name, u.avatar, u.status FROM flags f JOIN users u ON u.id = f.user_id
      ORDER BY f.resolved_at IS NOT NULL, f.created_at DESC LIMIT 40`).all(),
    metrics: {
      users: db.prepare('SELECT COUNT(*) n FROM users').get().n,
      reachedThreshold: reached.n,
      avgDaysToThreshold: reached.d ? Math.round(reached.d) : null,
      redeemed: db.prepare("SELECT COUNT(*) n FROM user_gifts WHERE source = 'karma'").get().n,
      near: db.prepare('SELECT COUNT(*) n FROM users WHERE karma >= ? AND karma < ?').get(T * 0.8, T).n,
      pointsToday: db.prepare('SELECT COALESCE(SUM(delta),0) s FROM karma_ledger WHERE delta > 0 AND reason <> \'troca\' AND created_at >= ?').get(sod.getTime()).s,
      blockedToday: db.prepare("SELECT reason, COUNT(*) n FROM karma_ledger WHERE delta = 0 AND created_at >= ? GROUP BY reason").all(sod.getTime()),
      scoredToday: db.prepare("SELECT COUNT(*) n FROM karma_ledger WHERE reason = 'mensagem' AND created_at >= ?").get(sod.getTime()).n,
      threshold: T, dailyCap: config.KARMA.DAILY_CAP,
    },
    users: db.prepare(`SELECT u.id, u.display_name name, u.handle, u.email, u.avatar, u.role, u.status, u.karma, u.karma_total, u.created_at,
        (SELECT COUNT(*) FROM flags f WHERE f.user_id = u.id AND f.resolved_at IS NULL) open_flags
      FROM users u WHERE u.display_name LIKE ? OR u.handle LIKE ? OR u.email LIKE ?
      ORDER BY open_flags DESC, u.last_seen_at DESC LIMIT 40`).all(q, q, q),
    messages: db.prepare(`SELECT m.id, m.body, m.created_at, m.deleted_at, m.delete_reason, m.scored, u.id user_id, u.display_name name, u.avatar
      FROM messages m JOIN users u ON u.id = m.user_id ORDER BY m.id DESC LIMIT 30`).all(),
  };
});

route('POST', /^\/api\/mod\/messages\/(\d+)\/delete$/, (ctx, [, id]) => {
  requireUser(ctx);
  requireModerator(ctx, 'remover_mensagem');
  const reason = String(ctx.body.reason || 'conteúdo impróprio').slice(0, 80);
  return tx(() => {
    const m = db.prepare('SELECT * FROM messages WHERE id = ? AND deleted_at IS NULL').get(+id);
    if (!m) fail(404, 'Mensagem não encontrada.');
    db.prepare('UPDATE messages SET deleted_by = ?, deleted_at = ?, delete_reason = ? WHERE id = ?').run(ctx.user.id, now(), reason, m.id);
    const revoked = karma.revokeForMessage(m.id, m.user_id);
    db.prepare('INSERT INTO notifications (user_id, kind, text, created_at) VALUES (?, ?, ?, ?)')
      .run(m.user_id, 'moderacao', `Uma mensagem sua foi removida pela moderação (${reason}).${revoked ? ` ${revoked} Karma foram estornados.` : ''}`, now());
    audit(ctx.user.id, 'remover_mensagem', true, { targetUser: m.user_id, targetMessage: m.id, detail: `Mensagem removida (${reason})`, ip: ipOf(ctx.req) });
    return { ok: true, revoked };
  });
});

function targetUser(ctx, id) {
  const t = db.prepare('SELECT * FROM users WHERE id = ?').get(+id);
  if (!t) fail(404, 'Usuário não encontrado.');
  if (t.id === ctx.user.id) fail(400, 'Você não pode aplicar isso a si mesmo(a).');
  if (t.role === 'moderator') fail(403, 'Ações contra moderadores são feitas pela administração do servidor.');
  return t;
}

route('POST', /^\/api\/mod\/users\/(\d+)\/warn$/, (ctx, [, id]) => {
  requireUser(ctx);
  requireModerator(ctx, 'alertar_usuario');
  const t = targetUser(ctx, id);
  const reason = String(ctx.body.reason || 'comportamento inadequado').slice(0, 80);
  db.prepare('INSERT INTO notifications (user_id, kind, text, created_at) VALUES (?, ?, ?, ?)')
    .run(t.id, 'moderacao', `Você recebeu um alerta da moderação: ${reason}.`, now());
  audit(ctx.user.id, 'alertar_usuario', true, { targetUser: t.id, detail: `Usuário alertado (${reason})`, ip: ipOf(ctx.req) });
  return { ok: true };
});

route('POST', /^\/api\/mod\/users\/(\d+)\/(ban|unban)$/, (ctx, [, id, op]) => {
  requireUser(ctx);
  requireModerator(ctx, op === 'ban' ? 'banir_usuario' : 'desbanir_usuario');
  const t = targetUser(ctx, id);
  const reason = String(ctx.body.reason || (op === 'ban' ? 'violação das regras' : 'revisão')).slice(0, 80);
  tx(() => {
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(op === 'ban' ? 'banned' : 'active', t.id);
    if (op === 'ban') db.prepare('DELETE FROM sessions WHERE user_id = ?').run(t.id);
    audit(ctx.user.id, op === 'ban' ? 'banir_usuario' : 'desbanir_usuario', true,
      { targetUser: t.id, detail: op === 'ban' ? `Usuário banido (${reason})` : `Banimento revertido (${reason})`, ip: ipOf(ctx.req) });
  });
  return { ok: true };
});

route('POST', /^\/api\/mod\/flags\/(\d+)\/resolve$/, (ctx, [, id]) => {
  requireUser(ctx);
  requireModerator(ctx, 'resolver_sinal');
  const r = db.prepare('UPDATE flags SET resolved_by = ?, resolved_at = ? WHERE id = ? AND resolved_at IS NULL').run(ctx.user.id, now(), +id);
  if (!r.changes) fail(404, 'Sinal não encontrado.');
  audit(ctx.user.id, 'resolver_sinal', true, { detail: `Sinal #${id} revisado`, ip: ipOf(ctx.req) });
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Arquivos estáticos (SPA): qualquer caminho sem extensão abre o app, que decide
// pela sessão se mostra cadastro, boas-vindas ou comunidade.
// ---------------------------------------------------------------------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function serveStatic(req, res, pathname) {
  let file = path.normalize(path.join(PUBLIC, decodeURIComponent(pathname)));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  if (!path.extname(file)) file = path.join(PUBLIC, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);

  try {
    // CSRF: toda escrita exige um cabeçalho que formulários de outros sites não conseguem enviar.
    if (req.method !== 'GET' && req.headers['x-toca'] !== '1') fail(403, 'Requisição bloqueada.');
    const match = routes.find(r => r.method === req.method && r.pattern.test(url.pathname));
    if (!match) fail(404, 'Rota não encontrada.');
    const body = req.method === 'GET' ? {} : await readBody(req);
    const ctx = { req, res, body, query: url.searchParams, ...loadSession(req) };
    const out = await match.handler(ctx, url.pathname.match(match.pattern));
    send(res, 200, out);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...e.extra });
    console.error(e);
    send(res, 500, { error: 'Erro interno.' });
  }
});

server.listen(config.PORT, () => {
  console.log(`\n  Toca rodando em http://localhost:${config.PORT}`);
  console.log(`  Login: ${config.GOOGLE_CLIENT_ID ? 'Google Identity Services' : 'modo demonstração (seletor de conta simulado)'}`);
  console.log(`  Senha de moderação: ${config.MOD_PIN === 'toca-moderacao-2026' ? 'toca-moderacao-2026 (padrão da demo; defina MOD_PIN em produção)' : '(definida via MOD_PIN)'}\n`);
});
