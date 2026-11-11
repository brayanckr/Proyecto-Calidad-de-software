/* CoffeeExport Manager | comportamiento de la landing.
   Movimiento solo con IntersectionObserver, CSS y Web Animations (sin listeners de scroll).
   Todo se desactiva con prefers-reduced-motion. */
"use strict";
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const nf = (n, d = 0) => Number(n).toLocaleString("es-CO", {minimumFractionDigits:d, maximumFractionDigits:d});
  const foto = fotoProducto;   // definido en data.js

  /* ---------- tema ---------- */
  const root = document.documentElement, themeIc = $("#theme-ic");
  const paintTheme = () => { themeIc.className = "ph " + (root.dataset.theme === "dark" ? "ph-sun" : "ph-moon"); };
  paintTheme();
  $("#theme").addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("cem_theme", root.dataset.theme); } catch (e) { /* sin almacenamiento */ }
    paintTheme();
  });

  /* ---------- barra de navegación: sombra al salir del tope (sin listener de scroll) ---------- */
  new IntersectionObserver(([e]) => $("#nav").classList.toggle("scrolled", !e.isIntersecting)).observe($("#top-sentinel"));

  /* enlace activo según la sección visible */
  const links = $$(".nav-links a");
  const secObs = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
  }), {rootMargin:"-45% 0px -50% 0px"});
  ["catalogo", "proceso", "cifras", "normativa"].forEach(id => secObs.observe($("#" + id)));

  /* ---------- aparición al hacer scroll: comunica el orden de lectura ---------- */
  const revObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); revObs.unobserve(e.target); } }), {threshold:.15, rootMargin:"0px 0px -6% 0px"});
  $$("[data-reveal]").forEach(el => reduce ? el.classList.add("in") : revObs.observe(el));

  /* ---------- datos (mismo almacenamiento que el sistema) ---------- */
  const db = Store.load();
  const stockDe = id => db.inventario.filter(i => i.producto_id === id).reduce((a, i) => a + i.kg, 0);
  const minDe = id => db.inventario.filter(i => i.producto_id === id).reduce((a, i) => a + i.min, 0);
  const activos = db.productos.filter(p => p.activo);

  /* ---------- catálogo ---------- */
  const grid = $("#grid");
  $("#n-all").textContent = activos.length;
  $("#n-cafe").textContent = activos.filter(p => p.tipo === "CAFE").length;
  $("#n-cacao").textContent = activos.filter(p => p.tipo === "CACAO").length;

  const cardHTML = p => {
    const s = stockDe(p.id), low = minDe(p.id) > 0 && s < minDe(p.id), sin = s <= 0;
    return `<button class="card" type="button" data-id="${p.id}" data-tipo="${p.tipo}" aria-label="Ver detalle de ${esc(p.nombre)}">
      <div class="card-img"><img src="${foto(p, 700)}" width="700" height="770" loading="lazy" alt="${esc(p.nombre)}, ${p.tipo === "CAFE" ? "café" : "cacao"} variedad ${esc(p.variedad || "estándar")}"></div>
      <div class="card-b"><h3>${esc(p.nombre)}</h3><span class="card-var">${p.tipo === "CAFE" ? "Café" : "Cacao"}${p.variedad ? ", " + esc(p.variedad) : ""}</span>
        <div class="card-row"><span class="price">USD ${nf(p.precio, 2)} <small>/kg</small></span><span class="avail ${sin || low ? "low" : "ok"}">${sin ? "Agotado" : low ? "Stock bajo" : "Disponible"}</span></div>
        <span class="card-more">Ver detalle <i class="ph ph-arrow-right"></i></span></div></button>`;
  };
  const skeleton = n => Array.from({length:n}, () => `<div class="sk" aria-hidden="true"><i class="a"></i><i class="b"></i><i class="c"></i></div>`).join("");

  /* estado de carga con skeletons con la forma final; luego las tarjetas entran escalonadas */
  grid.innerHTML = skeleton(Math.min(6, Math.max(3, activos.length)));
  grid.setAttribute("aria-busy", "true");
  setTimeout(() => {
    if (!activos.length) { grid.innerHTML = `<div class="empty"><i class="ph ph-package"></i>Aún no hay productos activos en el catálogo.</div>`; grid.removeAttribute("aria-busy"); return; }
    grid.innerHTML = activos.map(cardHTML).join(""); grid.removeAttribute("aria-busy");
    if (!reduce) $$(".card", grid).forEach((c, i) => c.animate([{opacity:0, transform:"translateY(24px)"}, {opacity:1, transform:"none"}], {duration:700, delay:i * 70, easing:"cubic-bezier(.16,1,.3,1)", fill:"backwards"}));
  }, reduce ? 0 : 650);

  /* filtro con FLIP: las tarjetas se reacomodan desde su posición anterior (feedback de cambio de estado) */
  $$(".chip").forEach(ch => ch.addEventListener("click", () => {
    $$(".chip").forEach(c => c.setAttribute("aria-pressed", String(c === ch)));
    const f = ch.dataset.f, cards = $$(".card", grid); if (!cards.length) return;
    const before = new Map(cards.map(c => [c, c.getBoundingClientRect()]));
    cards.forEach(c => { c.hidden = !(f === "all" || c.dataset.tipo === f); });
    if (reduce) return;
    cards.filter(c => !c.hidden).forEach(c => {
      const a = before.get(c), b = c.getBoundingClientRect();
      if (a.width && (a.left !== b.left || a.top !== b.top)) c.animate([{transform:`translate(${a.left - b.left}px,${a.top - b.top}px)`}, {transform:"none"}], {duration:520, easing:"cubic-bezier(.16,1,.3,1)"});
      else c.animate([{opacity:0, transform:"scale(.96)"}, {opacity:1, transform:"none"}], {duration:420, easing:"cubic-bezier(.16,1,.3,1)"});
    });
  }));

  /* detalle del producto */
  const dlg = $("#dlg");
  grid.addEventListener("click", e => {
    const c = e.target.closest(".card"); if (!c) return;
    const p = db.productos.find(x => x.id === +c.dataset.id), s = stockDe(p.id);
    const bodegas = db.inventario.filter(i => i.producto_id === p.id && i.kg > 0).map(i => `${esc(db.bodegas.find(b => b.id === i.bodega_id).nombre)} (${nf(i.kg)} kg)`).join("<br>") || "Sin existencias";
    $("#dlg-img").src = foto(p, 700); $("#dlg-img").alt = p.nombre;
    $("#dlg-title").textContent = p.nombre;
    $("#dlg-sub").textContent = `${p.tipo === "CAFE" ? "Café" : "Cacao"}${p.variedad ? ", variedad " + p.variedad : ""}`;
    $("#dlg-specs").innerHTML = `<dt>Código</dt><dd>${esc(p.codigo)}</dd><dt>Precio de lista</dt><dd>USD ${nf(p.precio, 2)} por kg</dd><dt>Disponible</dt><dd>${nf(s)} kg</dd><dt>Bodegas</dt><dd>${bodegas}</dd>`;
    dlg.showModal();
  });
  $("#dlg-x").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });

  /* ---------- proceso: el paso visible se resalta y el carril lo acompaña ---------- */
  const steps = $$(".step"), rail = $$("#rail li");
  const stepObs = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    steps.forEach(s => s.classList.toggle("on", s === e.target)); rail.forEach(r => r.classList.toggle("on", r.dataset.i === e.target.dataset.i));
  }), {rootMargin:"-40% 0px -40% 0px"});
  steps.forEach(s => stepObs.observe(s)); rail[0].classList.add("on"); steps[0].classList.add("on");

  /* ---------- cifras reales del sistema ---------- */
  const paises = {}; db.exportaciones.forEach(e => paises[e.pais] = (paises[e.pais] || 0) + 1);
  const kpi = {"k-exp":db.exportaciones.length, "k-cli":db.clientes.filter(c => c.activo).length, "k-kg":db.inventario.reduce((a, i) => a + i.kg, 0)};
  Object.entries(kpi).forEach(([id, v]) => { const el = $("#" + id); el.dataset.count = v; el.textContent = reduce ? nf(v) : "0"; });
  $("#k-paises").innerHTML = Object.entries(paises).sort((a, b) => b[1] - a[1]).map(([c]) => `<li>${esc(EU[c] || c)}</li>`).join("") || "<li>Sin envíos aún</li>";
  const countUp = el => {
    const to = +el.dataset.count, t0 = performance.now(), dur = 1400;
    const tick = t => { const k = Math.min(1, (t - t0) / dur), v = to * (1 - Math.pow(1 - k, 4)); el.textContent = nf(Math.round(v)); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  if (!reduce) { const cObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { countUp(e.target); cObs.unobserve(e.target); } }), {threshold:.6}); $$("[data-count]").forEach(el => cObs.observe(el)); }

  /* ---------- acordeón ---------- */
  $$(".acc-btn").forEach(b => b.addEventListener("click", () => {
    const item = b.parentElement, open = !item.classList.contains("open");
    $$(".acc-item").forEach(i => { i.classList.remove("open"); i.firstElementChild.setAttribute("aria-expanded", "false"); });
    if (open) { item.classList.add("open"); b.setAttribute("aria-expanded", "true"); }
  }));
})();
