// Avatares de animaizinhos. `img` usa as ilustrações do design; os demais usam emoji
// sobre um fundo pastel até a arte final ficar pronta.
const AVATARS = [
  { key: 'raposa',    label: 'Raposa',     img: '/img/raposa.png' },
  { key: 'gatinho',   label: 'Gatinho',    img: '/img/gato.png' },
  { key: 'lobinho',   label: 'Lobinho',    img: '/img/lobo.png' },
  { key: 'corujinha', label: 'Corujinha',  img: '/img/coruja.png' },
  { key: 'cachorrinho', label: 'Cachorrinho', img: '/img/cao.png' },
  { key: 'ursinho',   label: 'Ursinho',    emoji: '🐻', bg: '#f6e3cf' },
  { key: 'coelhinho', label: 'Coelhinho',  emoji: '🐰', bg: '#fbe4ec' },
  { key: 'panda',     label: 'Panda',      emoji: '🐼', bg: '#e6ecef' },
  { key: 'lontra',    label: 'Lontra',     emoji: '🦦', bg: '#e8e1d6' },
  { key: 'gaviao',    label: 'Gavião',     emoji: '🦅', bg: '#e2e8f5' },
  { key: 'ourico',    label: 'Ouriço',     emoji: '🦔', bg: '#efe6dc' },
  { key: 'tartaruga', label: 'Tartaruga',  emoji: '🐢', bg: '#dff1e4' },
];

const byKey = Object.fromEntries(AVATARS.map(a => [a.key, a]));

function randomAvatar() {
  return AVATARS[require('node:crypto').randomInt(AVATARS.length)];
}

module.exports = { AVATARS, byKey, randomAvatar };
