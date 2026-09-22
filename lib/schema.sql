-- Esquema da Toca. SQL padrão, portável para MySQL/MariaDB/PostgreSQL com ajustes mínimos
-- (AUTOINCREMENT -> AUTO_INCREMENT, INTEGER epoch -> BIGINT).

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub      TEXT UNIQUE NOT NULL,          -- id estável da conta Google
  email           TEXT UNIQUE NOT NULL,
  display_name    TEXT NOT NULL,
  name_key        TEXT UNIQUE NOT NULL,          -- nome normalizado, garante apelido único
  name_confirmed  INTEGER NOT NULL DEFAULT 0,    -- 0 = ainda com o nome temporário
  name_changed_at INTEGER,
  handle          TEXT UNIQUE NOT NULL,
  avatar          TEXT NOT NULL,
  gender          TEXT CHECK (gender IN ('M','F')),
  gender_visible  INTEGER NOT NULL DEFAULT 0,    -- por padrão só o próprio usuário vê
  bio             TEXT NOT NULL DEFAULT '',
  interests       TEXT NOT NULL DEFAULT '[]',
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','moderator')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','banned')),
  karma           INTEGER NOT NULL DEFAULT 0,    -- saldo disponível para troca
  karma_total     INTEGER NOT NULL DEFAULT 0,    -- tudo que já ganhou (nunca diminui na troca)
  reached_threshold_at INTEGER,                  -- métrica: quando chegou aos 5.000
  signup_ip       TEXT,
  created_at      INTEGER NOT NULL,
  last_seen_at    INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash          TEXT PRIMARY KEY,          -- sha256 do token; o token em si só existe no cookie
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at          INTEGER NOT NULL,
  expires_at          INTEGER NOT NULL,
  mod_elevated_until  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  norm        TEXT NOT NULL,                     -- texto normalizado para detectar repetição
  image       TEXT,
  reply_to    INTEGER REFERENCES messages(id),
  scored      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  deleted_by  INTEGER REFERENCES users(id),
  deleted_at  INTEGER,
  delete_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, created_at);

CREATE TABLE IF NOT EXISTS reactions (
  message_id  INTEGER NOT NULL REFERENCES messages(id),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  emoji       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);

-- Livro-razão do Karma: todo ponto tem origem rastreável. Linhas com delta 0 registram
-- mensagens que não pontuaram e o motivo, o que alimenta os sinais de abuso.
CREATE TABLE IF NOT EXISTS karma_ledger (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  delta           INTEGER NOT NULL,
  reason          TEXT NOT NULL,
  message_id      INTEGER REFERENCES messages(id),
  source_user_id  INTEGER REFERENCES users(id),
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON karma_ledger(user_id, created_at);

CREATE TABLE IF NOT EXISTS gifts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT UNIQUE NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('rare','shop')),
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  image       TEXT,
  emoji       TEXT,
  tint        TEXT,
  cost_karma  INTEGER,                           -- só presentes raros
  price_coins INTEGER,                           -- só presentes da loja
  stock_total INTEGER,
  stock_left  INTEGER
);

CREATE TABLE IF NOT EXISTS user_gifts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  gift_id     INTEGER NOT NULL REFERENCES gifts(id),
  source      TEXT NOT NULL CHECK (source IN ('karma','shop')),
  serial      INTEGER,                           -- "Nº 7 de 100"
  from_user   INTEGER REFERENCES users(id),
  acquired_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rare_once ON user_gifts(user_id, gift_id) WHERE source = 'karma';

-- Registro imutável de moderação: inclui tentativas negadas.
CREATE TABLE IF NOT EXISTS mod_audit (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id        INTEGER REFERENCES users(id),
  action          TEXT NOT NULL,
  allowed         INTEGER NOT NULL,
  target_user_id  INTEGER REFERENCES users(id),
  target_message_id INTEGER REFERENCES messages(id),
  detail          TEXT,
  ip              TEXT,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS flags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL,
  detail      TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  resolved_by INTEGER REFERENCES users(id),
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL,
  text        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  read_at     INTEGER
);
