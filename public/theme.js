// Aplica o tema salvo antes da primeira pintura (evita piscar).
try {
  const t = localStorage.getItem('toca-theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) { /* armazenamento indisponível: segue o tema do sistema */ }
