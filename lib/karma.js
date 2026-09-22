// Motor de Karma: pontua participação que outras pessoas valorizam, não volume.
// Toda decisão é tomada no servidor e registrada no livro-razão (karma_ledger).
const { db } = require('./db');
const { KARMA } = require('./config');
const { letterCount, isLowEffort, similarity } = require('./text');

const REASONS = {
  mensagem:      'Mensagem com conteúdo',
  reacao:        'Alguém reagiu à sua mensagem',
  resposta:      'Alguém respondeu à sua mensagem',
  troca:         'Troca por presente raro',
  estorno:       'Estorno: mensagem removida pela moderação',
  curta:         'Sem Karma: mensagem curta ou vazia demais',
  repetida:      'Sem Karma: mensagem repetida',
  intervalo:     `Sem Karma: aguarde ${KARMA.COOLDOWN_SECONDS}s entre mensagens pontuadas`,
  limite:        'Sem Karma: limite diário atingido',
  reciprocidade: 'Sem Karma: reações repetidas da mesma pessoa',
};

function startOfDay(ts = Date.now()) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime();
}

function earnedToday(userId) {
  return db.prepare('SELECT COALESCE(SUM(delta), 0) s FROM karma_ledger WHERE user_id = ? AND delta > 0 AND created_at >= ? AND reason IN (\'mensagem\',\'reacao\',\'resposta\')')
    .get(userId, startOfDay()).s;
}

function log(userId, delta, reason, messageId = null, sourceUserId = null) {
  db.prepare('INSERT INTO karma_ledger (user_id, delta, reason, message_id, source_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, delta, reason, messageId, sourceUserId, Date.now());
}

function flag(userId, kind, detail) {
  const recent = db.prepare('SELECT 1 FROM flags WHERE user_id = ? AND kind = ? AND resolved_at IS NULL AND created_at > ?')
    .get(userId, kind, Date.now() - 86400000);
  if (!recent) db.prepare('INSERT INTO flags (user_id, kind, detail, created_at) VALUES (?, ?, ?, ?)').run(userId, kind, detail, Date.now());
}

// Credita pontos respeitando o teto diário. Deve rodar dentro de uma transação.
function award(userId, points, reason, messageId, sourceUserId) {
  const room = KARMA.DAILY_CAP - earnedToday(userId);
  if (room <= 0) {
    log(userId, 0, 'limite', messageId, sourceUserId);
    flag(userId, 'limite_diario', `Atingiu o teto de ${KARMA.DAILY_CAP} pontos hoje`);
    return { points: 0, code: 'limite' };
  }
  const pts = Math.min(points, room);
  log(userId, pts, reason, messageId, sourceUserId);
  db.prepare(`UPDATE users SET karma = karma + ?, karma_total = karma_total + ?,
      reached_threshold_at = CASE WHEN reached_threshold_at IS NULL AND karma_total + ? >= ? THEN ? ELSE reached_threshold_at END
    WHERE id = ?`).run(pts, pts, pts, KARMA.REDEEM_THRESHOLD, Date.now(), userId);
  return { points: pts, code: reason };
}

// Avalia uma mensagem nova (já inserida). Retorna {points, code}.
function scoreMessage(userId, messageId, norm) {
  const now = Date.now();

  if (letterCount(norm) < KARMA.MIN_LETTERS || norm.split(' ').length < KARMA.MIN_WORDS || isLowEffort(norm)) {
    return reject(userId, messageId, 'curta');
  }

  const recent = db.prepare('SELECT norm FROM messages WHERE user_id = ? AND id <> ? AND created_at > ? ORDER BY id DESC LIMIT 10')
    .all(userId, messageId, now - 86400000);
  if (recent.some(r => similarity(r.norm, norm) >= KARMA.SIMILARITY_BLOCK)) {
    return reject(userId, messageId, 'repetida');
  }

  const last = db.prepare("SELECT created_at FROM karma_ledger WHERE user_id = ? AND reason = 'mensagem' ORDER BY id DESC LIMIT 1").get(userId);
  if (last && now - last.created_at < KARMA.COOLDOWN_SECONDS * 1000) {
    return reject(userId, messageId, 'intervalo');
  }

  const out = award(userId, KARMA.MESSAGE_POINTS, 'mensagem', messageId, null);
  if (out.points > 0) db.prepare('UPDATE messages SET scored = 1 WHERE id = ?').run(messageId);
  return out;
}

function reject(userId, messageId, code) {
  log(userId, 0, code, messageId, null);
  if (code === 'curta' || code === 'repetida') {
    const n = db.prepare("SELECT COUNT(*) n FROM karma_ledger WHERE user_id = ? AND reason IN ('curta','repetida') AND created_at > ?")
      .get(userId, Date.now() - 3600000).n;
    if (n >= 5) flag(userId, 'spam_repeticao', `${n} mensagens repetidas ou vazias na última hora`);
  }
  return { points: 0, code };
}

// Outra pessoa reagiu: o autor ganha, uma vez por pessoa por mensagem.
function onReaction(message, reactorId) {
  if (message.user_id === reactorId) return null;
  const already = db.prepare("SELECT 1 FROM karma_ledger WHERE reason IN ('reacao','reciprocidade','limite') AND message_id = ? AND source_user_id = ?")
    .get(message.id, reactorId);
  if (already) return null;
  const counted = db.prepare("SELECT COUNT(*) n FROM karma_ledger WHERE reason = 'reacao' AND message_id = ?").get(message.id).n;
  if (counted >= KARMA.MAX_REACTIONS_COUNTED) return null;

  const pair = db.prepare("SELECT COUNT(*) n FROM karma_ledger WHERE reason = 'reacao' AND user_id = ? AND source_user_id = ? AND created_at > ?")
    .get(message.user_id, reactorId, Date.now() - 86400000).n;
  if (pair >= KARMA.PAIR_REACTIONS_PER_DAY) {
    log(message.user_id, 0, 'reciprocidade', message.id, reactorId);
    flag(reactorId, 'reciprocidade', `Reagiu ${pair}+ vezes ao mesmo usuário em 24h (possível conta de apoio)`);
    return { points: 0, code: 'reciprocidade' };
  }
  return award(message.user_id, KARMA.REACTION_POINTS, 'reacao', message.id, reactorId);
}

// Outra pessoa respondeu com uma mensagem de conteúdo: o autor original ganha.
function onReply(parent, replierId, replyScoredOk) {
  if (!parent || parent.user_id === replierId || !replyScoredOk) return null;
  const already = db.prepare("SELECT 1 FROM karma_ledger WHERE reason = 'resposta' AND message_id = ? AND source_user_id = ?").get(parent.id, replierId);
  if (already) return null;
  return award(parent.user_id, KARMA.REPLY_POINTS, 'resposta', parent.id, replierId);
}

// Mensagem removida pela moderação: os pontos que ela gerou voltam.
function revokeForMessage(messageId, authorId) {
  const s = db.prepare("SELECT COALESCE(SUM(delta),0) s FROM karma_ledger WHERE user_id = ? AND message_id = ? AND reason IN ('mensagem','reacao','resposta')")
    .get(authorId, messageId).s;
  if (s <= 0) return 0;
  const bal = db.prepare('SELECT karma FROM users WHERE id = ?').get(authorId).karma;
  const take = Math.min(s, bal);
  log(authorId, -take, 'estorno', messageId, null);
  db.prepare('UPDATE users SET karma = karma - ?, karma_total = MAX(0, karma_total - ?) WHERE id = ?').run(take, take, authorId);
  return take;
}

function rulesSummary() {
  return [
    `+${KARMA.MESSAGE_POINTS} por mensagem com conteúdo (mín. ${KARMA.MIN_LETTERS} letras, ${KARMA.COOLDOWN_SECONDS}s entre mensagens pontuadas)`,
    `+${KARMA.REACTION_POINTS} quando outra pessoa reage (até ${KARMA.MAX_REACTIONS_COUNTED} por mensagem)`,
    `+${KARMA.REPLY_POINTS} quando outra pessoa responde à sua mensagem`,
    'Mensagens curtas, repetidas ou só com emoji não pontuam',
    `Limite de ${KARMA.DAILY_CAP} pontos por dia`,
  ];
}

module.exports = { scoreMessage, onReaction, onReply, revokeForMessage, earnedToday, rulesSummary, REASONS, log };
