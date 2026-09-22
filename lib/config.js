// Configuração central. Tudo que afeta segurança ou economia do Karma fica aqui,
// para ser ajustado sem mexer na lógica.
module.exports = {
  PORT: Number(process.env.PORT) || 3000,

  // Google Identity Services. Sem GOOGLE_CLIENT_ID a demo usa um seletor de conta simulado.
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  DEMO_LOGIN: process.env.DEMO_LOGIN ? process.env.DEMO_LOGIN === '1' : !process.env.GOOGLE_CLIENT_ID,

  // Moderação: papel no banco + senha de confirmação (step-up) com validade curta.
  MOD_PIN: process.env.MOD_PIN || 'toca-moderacao-2026',
  MOD_ELEVATION_MINUTES: 15,
  MOD_PIN_MAX_ATTEMPTS: 5,          // por usuário, a cada 15 minutos

  SESSION_DAYS: 30,
  COOKIE_NAME: 'toca_sid',

  KARMA: {
    REDEEM_THRESHOLD: 5000,          // libera o botão de troca por presentes raros
    MESSAGE_POINTS: 2,               // mensagem com conteúdo
    REACTION_POINTS: 3,              // outra pessoa reagiu à sua mensagem
    REPLY_POINTS: 5,                 // outra pessoa respondeu à sua mensagem
    DAILY_CAP: 150,                  // teto diário de pontos, somando todas as fontes
    COOLDOWN_SECONDS: 30,            // intervalo mínimo entre mensagens pontuadas
    MIN_LETTERS: 10,                 // letras/números, sem contar emoji e pontuação
    MIN_WORDS: 2,
    SIMILARITY_BLOCK: 0.8,           // parecida demais com uma das últimas mensagens do autor
    MAX_REACTIONS_COUNTED: 10,       // por mensagem
    PAIR_REACTIONS_PER_DAY: 12,      // mesma pessoa reagindo ao mesmo autor
  },

  POST_MIN_INTERVAL_MS: 1500,        // limite duro de envio (anti-flood), independente do Karma

  NAME: { MIN: 3, MAX: 20, CHANGE_COOLDOWN_HOURS: 24 },
};
