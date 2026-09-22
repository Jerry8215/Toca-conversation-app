const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { normalize, nameKey } = require('./text');

// Em hospedagem, aponte para um volume persistente (no Railway, a variável é criada ao anexar o volume).
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'toca.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Dados de demonstração (reproduzem a tela do design)
// ---------------------------------------------------------------------------

function seed() {
  if (db.prepare('SELECT COUNT(*) n FROM users').get().n > 0) return;

  const now = Date.now();
  const DAY = 86400000;
  const ago = min => now - min * 60000;

  const insUser = db.prepare(`INSERT INTO users
    (google_sub, email, display_name, name_key, name_confirmed, handle, avatar, gender, gender_visible, bio, interests, role, status, karma, karma_total, reached_threshold_at, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const people = [
    // email, nome, handle, avatar, sexo, papel, karma, dias na comunidade, bio, interesses
    ['luna@gmail.com',  'Luna Raposa',  'lunaraposa',  'raposa',      'F', 'moderator', 4680, 124, 'Mais empatia, por favor. 🧡\nAnimais, natureza e boas conversas.', ['🐾 Amante de animais', '🌿 Natureza', '⭐ Conversas profundas']],
    ['mimi@gmail.com',  'Mimi Gata',    'mimigata',    'gatinho',     'F', 'user',      4996, 210, 'Colecionando pequenas alegrias.', ['🐱 Gatos', '📚 Leitura']],
    ['bento@gmail.com', 'Bento Cão',    'bentocao',    'cachorrinho', 'M', 'user',      1240, 90,  'Bom dia é meu idioma.', ['☀️ Manhãs', '🎸 Música']],
    ['thor@gmail.com',  'Thor Lobo',    'thorlobo',    'lobinho',     'M', 'user',      2310, 160, 'Trilhas, fotos e silêncio.', ['⛰️ Trilhas', '📷 Fotografia']],
    ['nina@gmail.com',  'Nina Coruja',  'ninacoruja',  'corujinha',   'F', 'moderator', 3905, 300, 'Noturna por natureza.', ['🌙 Astronomia', '✨ Poesia']],
    ['carla@gmail.com', 'Carla Lontra', 'carlalontra', 'lontra',      'F', 'moderator', 2750, 280, '', []],
    ['rafa@gmail.com',  'Rafa Urso',    'rafaurso',    'ursinho',     'M', 'moderator', 3120, 260, '', []],
    ['tom@gmail.com',   'Tom Gavião',   'tomgaviao',   'gaviao',      'M', 'moderator', 1980, 240, '', []],
    ['zeca@gmail.com',  'Zeca Pressa',  'zecapressa',  'ourico',      'M', 'user',      40,   2,   '', []],
  ];
  const ids = {};
  for (const [email, name, handle, avatar, g, role, karma, days, bio, interests] of people) {
    const r = insUser.run(`demo-${handle}`, email, name, nameKey(name), handle, avatar, g, 0, bio, JSON.stringify(interests),
      role, handle === 'zecapressa' ? 'banned' : 'active', karma, karma + (handle === 'ninacoruja' ? 5000 : 0),
      handle === 'ninacoruja' ? now - 40 * DAY : null, now - days * DAY, handle === 'lunaraposa' ? now : now - 3600000);
    ids[handle] = Number(r.lastInsertRowid);
  }

  // Participantes de fundo (só para compor as reações do design).
  const fillerNames = ['Pipo Panda', 'Lia Coelha', 'Duda Tartaruga', 'Caio Ouriço', 'Bia Ursa', 'Leo Gato', 'Mel Raposa',
    'Juca Lobo', 'Tati Coruja', 'Nico Cão', 'Rosa Lontra', 'Beto Panda', 'Gabi Coelha', 'Vini Gavião', 'Lu Tartaruga', 'Sofi Ursa'];
  const fillerAv = ['panda', 'coelhinho', 'tartaruga', 'ourico', 'ursinho', 'gatinho', 'raposa', 'lobinho', 'corujinha', 'cachorrinho',
    'lontra', 'panda', 'coelhinho', 'gaviao', 'tartaruga', 'ursinho'];
  const fillers = fillerNames.map((n, i) => {
    const h = nameKey(n);
    return Number(insUser.run(`demo-${h}`, `${h}@exemplo.com`, n, h, h, fillerAv[i], i % 2 ? 'M' : 'F', 0, '', '[]', 'user', 'active',
      200 + i * 97, 200 + i * 97, null, now - (30 + i * 5) * DAY, now - (i < 6 ? 60000 : 7200000)).lastInsertRowid);
  });

  const insMsg = db.prepare('INSERT INTO messages (user_id, body, norm, image, reply_to, scored, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)');
  const msg = (u, body, at, image = null, replyTo = null) => Number(insMsg.run(u, body, normalize(body), image, replyTo, at).lastInsertRowid);

  const mBento = msg(ids.bentocao, 'Bom dia, pessoal! ☀️\nQue tal compartilharmos algo que nos fez sorrir hoje?', ago(26));
  const mMimi = msg(ids.mimigata, 'Eu vi um gatinho na rua hoje e ele veio pedir carinho. 🐱\nPequenas coisas que fazem o dia melhor!', ago(23));
  const mThor = msg(ids.thorlobo, 'Aqui foi um belo nascer do sol na trilha. 🌄\nNatureza sempre cura.', ago(19), '/img/trilha.jpg');
  const mLuna = msg(ids.lunaraposa, 'Também tive um dia incrível!! Terminei um projeto que estava difícil há semanas.\nPersistência realmente vale a pena. 🧡', ago(15));
  const mNina = msg(ids.ninacoruja, 'Coisa mais linda! Esses encontros aleatórios são especiais. ✨\nO mundo ainda tem muita beleza.', ago(8), null, mMimi);

  const insReact = db.prepare('INSERT INTO reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)');
  const pool = [...fillers, ids.carlalontra, ids.rafaurso, ids.tomgaviao];
  let seq = 0;
  const react = (m, emoji, n) => { seq++; for (let i = 0; i < n; i++) insReact.run(m, pool[i], emoji, now - 3600000 + seq * 1000); };
  react(mBento, '❤️', 12); react(mBento, '🐾', 5); react(mBento, '😄', 3);
  react(mMimi, '❤️', 8); react(mMimi, '🐱', 4); react(mMimi, '🌱', 1);
  react(mThor, '❤️', 15); react(mThor, '⛰️', 6); react(mThor, '✨', 4);
  react(mLuna, '❤️', 10); react(mLuna, '🎉', 3);
  react(mNina, '❤️', 6); react(mNina, '🦉', 2); react(mNina, '✨', 2);

  // Mensagens do usuário que foi banido por spam (já removidas).
  const zecaMsgs = ['kkkkkk', 'kkkkkkk', 'oi', 'oiii', 'kkkk'];
  zecaMsgs.forEach((b, i) => {
    const id = msg(ids.zecapressa, b, now - DAY - 3600000 + i * 20000);
    db.prepare('UPDATE messages SET scored = 0, deleted_by = ?, deleted_at = ?, delete_reason = ? WHERE id = ?').run(ids.ninacoruja, now - DAY, 'spam', id);
    db.prepare('INSERT INTO karma_ledger (user_id, delta, reason, message_id, created_at) VALUES (?, 0, ?, ?, ?)').run(ids.zecapressa, i ? 'repetida' : 'curta', id, now - DAY);
  });

  // Presentes
  const insGift = db.prepare(`INSERT INTO gifts (slug, kind, name, description, image, emoji, tint, cost_karma, price_coins, stock_total, stock_left)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const gLuz = Number(insGift.run('raposa-da-luz', 'rare', 'Raposa da Luz', 'Um símbolo para quem espalha bondade por onde passa.', '/img/presente-raposa-luz.png', null, 'gold', 5000, null, 100, 99).lastInsertRowid);
  insGift.run('raposa-da-aurora', 'rare', 'Raposa da Aurora', 'Para quem acende a conversa quando o chat está quieto.', '/img/presente-raposa-luz.png', null, 'aurora', 5000, null, 50, 50);
  insGift.run('raposa-ametista', 'rare', 'Raposa Ametista', 'Edição mais rara: para quem acolhe quem acabou de chegar.', '/img/presente-raposa-luz.png', null, 'amethyst', 5000, null, 25, 25);
  const shop = [
    ['rosa', 'Rosa', 'Um carinho simples.', '🌹', 30], ['cafe', 'Cafezinho', 'Para começar bem o dia.', '☕', 20],
    ['coracao', 'Coração', 'Obrigado por existir.', '💖', 50], ['estrela', 'Estrela', 'Você brilhou hoje.', '🌟', 80],
    ['bolo', 'Bolo', 'Toda comemoração merece.', '🎂', 40],
  ];
  const shopIds = shop.map(([slug, name, desc, emoji, price]) => Number(insGift.run(slug, 'shop', name, desc, null, emoji, null, null, price, null, null).lastInsertRowid));

  db.prepare("INSERT INTO user_gifts (user_id, gift_id, source, serial, acquired_at) VALUES (?, ?, 'karma', 1, ?)").run(ids.ninacoruja, gLuz, now - 40 * DAY);
  const insUG = db.prepare("INSERT INTO user_gifts (user_id, gift_id, source, from_user, acquired_at) VALUES (?, ?, 'shop', ?, ?)");
  [[shopIds[0], ids.bentocao], [shopIds[0], ids.mimigata], [shopIds[0], ids.thorlobo], [shopIds[1], ids.bentocao], [shopIds[2], ids.ninacoruja]]
    .forEach(([g, from], i) => insUG.run(ids.lunaraposa, g, from, now - i * DAY));

  // Registro de moderação (como no design)
  const insAudit = db.prepare('INSERT INTO mod_audit (actor_id, action, allowed, target_user_id, detail, ip, created_at) VALUES (?, ?, 1, ?, ?, ?, ?)');
  insAudit.run(ids.ninacoruja, 'banir_usuario', ids.zecapressa, 'Usuário banido (spam)', '10.0.0.4', now - DAY + 3600000);
  insAudit.run(ids.tomgaviao, 'editar_canal', null, 'Canal #geral atualizado', '10.0.0.7', ago(190));
  insAudit.run(ids.rafaurso, 'alertar_usuario', ids.bentocao, 'Usuário alertado (linguagem ofensiva)', '10.0.0.9', ago(115));
  insAudit.run(ids.carlalontra, 'remover_mensagem', ids.thorlobo, 'Mensagem removida (conteúdo impróprio)', '10.0.0.3', ago(88));

  db.prepare('INSERT INTO flags (user_id, kind, detail, created_at, resolved_by, resolved_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(ids.zecapressa, 'spam_repeticao', '5 mensagens repetidas ou vazias em menos de 2 minutos', now - DAY - 3500000, ids.ninacoruja, now - DAY);
}

seed();

module.exports = { db, tx };
