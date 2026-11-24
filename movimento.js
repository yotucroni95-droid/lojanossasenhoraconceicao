// Movimento do site: órbitas douradas no topo, palavras que giram, texto que acende na rolagem,
// entradas suaves e contadores. Tudo é opcional: sem JS, com "reduzir movimento" ou em conexão
// lenta o conteúdo aparece parado e completo.
const reduzir = () => matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData === true || /(^|-)2g$/.test(navigator.connection?.effectiveType || '');

let pararTudo = [];
export function limparMovimento() { pararTudo.forEach(f => f()); pararTudo = []; }

export function animarPagina(raiz) {
  limparMovimento();
  const parado = reduzir();
  document.documentElement.classList.toggle('sem-movimento', parado);
  $$(raiz, '.orbita-canvas').forEach(c => parado ? null : orbitas(c));
  $$(raiz, '[data-roda]').forEach(el => parado ? null : rodaPalavras(el));
  $$(raiz, '[data-manifesto]').forEach(el => manifesto(el, parado));
  $$(raiz, '[data-conta]').forEach(el => parado ? null : contador(el));
  entradas(raiz, parado);
}

const $$ = (raiz, sel) => [...raiz.querySelectorAll(sel)];

// ---------- órbitas (canvas) ----------
function orbitas(canvas) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const caixa = canvas.parentElement;
  let w = 0, h = 0, dpr = 1, raf = 0, visivel = true, mx = 0, my = 0, alvoX = 0, alvoY = 0;
  const aneis = [
    {r: .30, inc: .34, rot: -.35, vel: .00022, n: 7},
    {r: .46, inc: .28, rot: .18, vel: -.00015, n: 10},
    {r: .64, inc: .22, rot: -.08, vel: .0001, n: 14},
    {r: .84, inc: .18, rot: .3, vel: -.00007, n: 9}
  ].map(a => ({...a, pts: Array.from({length: a.n}, (_, i) => ({f: i / a.n * Math.PI * 2 + Math.random(), t: .6 + Math.random() * 1.8, b: Math.random()}))}));
  const poeira = Array.from({length: 70}, () => ({x: Math.random(), y: Math.random(), r: Math.random() * 1.1 + .2, v: Math.random() * .00006 + .00002, b: Math.random() * Math.PI * 2}));
  function medir() {
    const r = caixa.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width; h = r.height; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function quadro(t) {
    raf = 0; if (!canvas.isConnected) return;
    mx += (alvoX - mx) * .04; my += (alvoY - my) * .04;
    ctx.clearRect(0, 0, w, h);
    const largo = w > 860, cx = (largo ? w * .74 : w * .5) + mx * 18, cy = (largo ? h * .52 : h * .30) + my * 12;
    const base = largo ? Math.min(w * .42, h * .95) : Math.max(w * .62, 260);
    // brilho central
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * .55);
    g.addColorStop(0, 'rgba(214,176,112,.20)'); g.addColorStop(1, 'rgba(214,176,112,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, base * .55, 0, Math.PI * 2); ctx.fill();
    for (const a of aneis) {
      const rx = base * a.r, ry = rx * a.inc, rot = a.rot + Math.sin(t * .00008) * .05;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
      ctx.strokeStyle = 'rgba(201,164,106,.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      for (const p of a.pts) {
        const ang = p.f + t * a.vel * (1 + p.b * .6), x = Math.cos(ang) * rx, y = Math.sin(ang) * ry;
        const frente = Math.sin(ang) > 0, tam = p.t * (frente ? 1.25 : .8);
        // rastro
        for (let k = 1; k <= 6; k++) {
          const a2 = ang - k * .018 * Math.sign(a.vel);
          ctx.fillStyle = 'rgba(232,207,159,' + (.18 - k * .028) + ')';
          ctx.beginPath(); ctx.arc(Math.cos(a2) * rx, Math.sin(a2) * ry, tam * (1 - k * .1), 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = frente ? 'rgba(244,222,176,.95)' : 'rgba(201,164,106,.55)';
        ctx.shadowColor = 'rgba(232,196,128,.9)'; ctx.shadowBlur = frente ? 10 : 0;
        ctx.beginPath(); ctx.arc(x, y, tam, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      }
      ctx.restore();
    }
    for (const p of poeira) {
      const y = (p.y - t * p.v) % 1, yy = (y < 0 ? y + 1 : y) * h;
      ctx.fillStyle = 'rgba(232,207,159,' + (.25 + Math.sin(t * .002 + p.b) * .2) + ')';
      ctx.beginPath(); ctx.arc(p.x * w, yy, p.r, 0, Math.PI * 2); ctx.fill();
    }
    if (visivel && !document.hidden) raf = requestAnimationFrame(quadro);
  }
  const iniciar = () => { if (!raf && visivel && !document.hidden) raf = requestAnimationFrame(quadro); };
  const io = new IntersectionObserver(([e]) => { visivel = e.isIntersecting; iniciar(); });
  io.observe(caixa);
  const mover = e => { const r = caixa.getBoundingClientRect(); alvoX = (e.clientX - r.left) / r.width - .5; alvoY = (e.clientY - r.top) / r.height - .5; };
  const vis = () => iniciar();
  medir(); addEventListener('resize', medir); caixa.addEventListener('pointermove', mover); document.addEventListener('visibilitychange', vis);
  iniciar();
  pararTudo.push(() => { cancelAnimationFrame(raf); io.disconnect(); removeEventListener('resize', medir); document.removeEventListener('visibilitychange', vis); });
}

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
