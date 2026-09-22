// Utilitários de texto usados pelo Karma e pela validação de apelidos.

function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Minúsculas, sem acento, sem emoji/pontuação e com letras repetidas encolhidas
// ("siiiim" -> "siim"), para comparar mensagens pelo conteúdo e não pela forma.
function normalize(text) {
  return stripAccents(String(text).toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/(\p{L})\1{2,}/gu, '$1$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function letterCount(norm) {
  return norm.replace(/[^\p{L}\p{N}]/gu, '').length;
}

// Palavras que sozinhas não constituem conversa.
const FILLER = new Set([
  'oi', 'ola', 'opa', 'eai', 'e', 'ai', 'kk', 'kkk', 'ha', 'haha', 'hehe', 'rs', 'rsrs',
  'ok', 'blz', 'beleza', 'sim', 'nao', 'top', 'vlw', 'valeu', 'tmj', 'bom', 'dia', 'boa',
  'noite', 'tarde', 'up', 'a', 'o', 'lol', 'sla', 'ss', 'aham', 'uhum', 'pois', 'eh',
]);

function isLowEffort(norm) {
  const words = norm.split(' ').filter(Boolean);
  if (!words.length) return true;
  if (words.every(w => FILLER.has(w) || /^(k|h|a|e|s|r)+$/.test(w))) return true;
  const uniqueChars = new Set(norm.replace(/\s/g, '')).size;
  return uniqueChars <= 3;
}

function trigrams(s) {
  const set = new Set();
  const t = ` ${s} `;
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));
  return set;
}

// Similaridade de Jaccard sobre trigramas: pega cópias com pequenas variações.
function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = trigrams(a), B = trigrams(b);
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}

// Chave do apelido para unicidade: "Luna  Raposa" e "luna raposa" são o mesmo nome.
function nameKey(name) {
  return stripAccents(name.toLowerCase()).replace(/[^a-z0-9]/g, '');
}

// Lista curta de exemplo; em produção vem de uma tabela editável pela moderação.
const BLOCKED_NAME_PARTS = [
  'admin', 'moderador', 'moderadora', 'suporte', 'oficial', 'staff',
  'idiota', 'burro', 'otario', 'merda', 'porra', 'caralho', 'puta', 'viado', 'nazi',
];

function validateDisplayName(name, { min, max }) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim();
  if (clean.length < min || clean.length > max) return { error: `O apelido precisa ter entre ${min} e ${max} caracteres.` };
  if (!/^[\p{L}\p{N} ._-]+$/u.test(clean)) return { error: 'Use apenas letras, números, espaço, ponto, hífen ou sublinhado.' };
  if (!/\p{L}/u.test(clean)) return { error: 'O apelido precisa ter pelo menos uma letra.' };
  const key = nameKey(clean);
  if (BLOCKED_NAME_PARTS.some(p => key.includes(p))) return { error: 'Esse apelido não é permitido. Escolha outro.' };
  return { name: clean, key };
}

module.exports = { normalize, letterCount, isLowEffort, similarity, nameKey, validateDisplayName, stripAccents };
