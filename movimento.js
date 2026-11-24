// Movimento do site: palavra que muda no título, texto que acende na rolagem,
// entradas suaves e contadores. Tudo é opcional: sem JS, com "reduzir movimento" ou em conexão
// lenta o conteúdo aparece parado e completo.
const reduzir = () => matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData === true || /(^|-)2g$/.test(navigator.connection?.effectiveType || '');

let pararTudo = [];
export function limparMovimento() { pararTudo.forEach(f => f()); pararTudo = []; }

export function animarPagina(raiz) {
  limparMovimento();
  const parado = reduzir();
  document.documentElement.classList.toggle('sem-movimento', parado);
  $$(raiz, '[data-roda]').forEach(el => parado ? null : rodaPalavras(el));
  $$(raiz, '[data-manifesto]').forEach(el => manifesto(el, parado));
  $$(raiz, '[data-conta]').forEach(el => parado ? null : contador(el));
  entradas(raiz, parado);
}

const $$ = (raiz, sel) => [...raiz.querySelectorAll(sel)];

// ---------- palavra que gira no título ----------
function rodaPalavras(el) {
  const palavras = el.dataset.roda.split('|'); let i = 0;
  const id = setInterval(() => {
    if (document.hidden) return;
    i = (i + 1) % palavras.length;
    el.classList.add('saindo');
    setTimeout(() => { el.textContent = palavras[i]; el.classList.remove('saindo'); el.classList.add('entrando'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('entrando'))); }, 380);
  }, 2600);
  pararTudo.push(() => clearInterval(id));
}

// ---------- texto que acende na rolagem ----------
function manifesto(el, parado) {
  if (!el.dataset.pronto) {
    el.innerHTML = el.textContent.trim().split(/\s+/).map(p => '<span class="pal">' + p + '</span>').join(' ');
    el.dataset.pronto = '1';
  }
  const pals = [...el.querySelectorAll('.pal')];
  if (parado) { pals.forEach(p => p.classList.add('acesa')); return; }
  let raf = 0;
  const atualizar = () => {
    raf = 0; const r = el.getBoundingClientRect(), vh = innerHeight;
    const prog = Math.min(1, Math.max(0, (vh * .85 - r.top) / (r.height + vh * .35)));
    const n = Math.round(prog * pals.length);
    pals.forEach((p, i) => p.classList.toggle('acesa', i < n));
  };
  const rolar = () => { if (!raf) raf = requestAnimationFrame(atualizar); };
  addEventListener('scroll', rolar, {passive: true}); atualizar();
  pararTudo.push(() => removeEventListener('scroll', rolar));
}

// ---------- números que sobem ----------
function contador(el) {
  const fim = +el.dataset.conta; if (!fim) return;
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return; io.disconnect();
    const t0 = performance.now(), dur = 1400;
    const passo = t => { const k = Math.min(1, (t - t0) / dur), v = Math.round(fim * (1 - Math.pow(1 - k, 3))); el.textContent = v; if (k < 1) requestAnimationFrame(passo); };
    el.textContent = '0'; requestAnimationFrame(passo);
  });
  io.observe(el); pararTudo.push(() => io.disconnect());
}

// ---------- entradas ao rolar ----------
function entradas(raiz, parado) {
  const alvos = $$(raiz, '.section-heading, .product-card, .room-tile, .process-grid article, .vip-banner, .store-teaser, .campaign-banner, .catalog-head');
  if (parado || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visto'); io.unobserve(e.target); } }), {threshold: .08, rootMargin: '0px 0px -5% 0px'});
  alvos.forEach(el => {
    const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) return; // já na tela: não esconde
    const irmaos = el.parentElement ? [...el.parentElement.children] : [];
    el.style.setProperty('--i', String(Math.max(0, irmaos.indexOf(el)) % 4));
    el.classList.add('anima'); io.observe(el);
  });
  pararTudo.push(() => io.disconnect());
}
