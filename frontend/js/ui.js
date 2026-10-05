/* CoffeeExport Manager – utilidades de interfaz y reglas de negocio compartidas */
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const nf = (n, d = 0) => Number(n).toLocaleString("es-CO", {minimumFractionDigits:d, maximumFractionDigits:d});
const usd = n => "$ " + nf(n, 2);
const usd0 = n => "$ " + nf(n, 0);
const kg = n => nf(n, 0) + " kg";
const fdate = s => { if (!s) return "—"; const [y, m, d] = String(s).slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
const todayISO = () => new Date().toISOString().slice(0, 10);
const byId = (list, id) => list.find(x => x.id === Number(id));

function logoSVG(size = 40, bean = "#6ee0c6", stroke = "#0b3b35") {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="34" rx="13" ry="19" transform="rotate(25 32 34)" fill="${bean}"/><path d="M25 51C32 39 32 30 39 17" stroke="${stroke}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M44 10c8 2 12 8 11 15-7-1-12-6-11-15z" fill="${bean}" opacity=".7"/></svg>`;
}

/* ---------- Toast ---------- */
function toast(msg, type = "success") {
  const ico = {success:"bi-check-circle-fill", danger:"bi-x-octagon-fill", warning:"bi-exclamation-triangle-fill", info:"bi-info-circle-fill"}[type];
  const el = document.createElement("div");
  el.className = `toast align-items-center text-bg-${type} border-0`; el.setAttribute("role", "status");
  el.innerHTML = `<div class="d-flex"><div class="toast-body"><i class="bi ${ico} me-2"></i>${esc(msg)}</div><button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Cerrar"></button></div>`;
  $("#toasts").appendChild(el); const t = new bootstrap.Toast(el, {delay:3800}); t.show(); el.addEventListener("hidden.bs.toast", () => el.remove());
}

/* ---------- Modal ---------- */
let _modal = null;
function openModal({title, body, saveLabel = "Guardar", onSave, size = "", hideFoot = false, cancelLabel = "Cancelar", danger = false}) {
  const dlg = $("#modal-dlg"); dlg.className = `modal-dialog modal-dialog-centered modal-dialog-scrollable ${size}`;
  $("#modal-title").textContent = title; $("#modal-body").innerHTML = body;
  const foot = $("#modal-foot"); foot.hidden = hideFoot;
  foot.innerHTML = `<button class="btn btn-light" data-bs-dismiss="modal" type="button">${esc(cancelLabel)}</button>` + (onSave ? `<button class="btn ${danger ? "btn-danger" : "btn-cem"}" id="modal-save" type="button">${esc(saveLabel)}</button>` : "");
  _modal = bootstrap.Modal.getOrCreateInstance($("#modal")); _modal.show();
  if (onSave) $("#modal-save").onclick = async () => { const r = await onSave($("#modal-body")); if (r !== false) _modal.hide(); };
  const first = $("#modal-body input:not([type=hidden]),#modal-body select"); if (first) $("#modal").addEventListener("shown.bs.modal", () => first.focus(), {once:true});
}
const closeModal = () => _modal && _modal.hide();
function confirmDlg(msg, {title = "Confirmar", label = "Confirmar", danger = false} = {}) {
  return new Promise(res => { let done = false;
    openModal({title, body:`<p class="mb-0">${msg}</p>`, saveLabel:label, danger, onSave:() => { done = true; res(true); }});
    $("#modal").addEventListener("hidden.bs.modal", () => { if (!done) res(false); }, {once:true}); });
}
function formErrors(root, msgs) {
  let box = $(".form-errors", root);
  if (!box) { box = document.createElement("div"); box.className = "form-errors alert alert-danger py-2 small"; box.setAttribute("role", "alert"); root.prepend(box); }
  box.hidden = !msgs.length; box.innerHTML = msgs.map(m => `<div><i class="bi bi-exclamation-circle me-1"></i>${esc(m)}</div>`).join("");
  if (msgs.length) box.scrollIntoView({block:"nearest"}); return !msgs.length;
}

/* ---------- Formularios ---------- */
function field(label, name, {type = "text", value = "", options = null, req = false, attrs = "", col = "col-12", help = ""} = {}) {
  let ctl;
  if (options) ctl = `<select class="form-select" name="${name}" ${req ? "required" : ""} ${attrs}>${options.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
  else if (type === "textarea") ctl = `<textarea class="form-control" name="${name}" rows="2" ${attrs}>${esc(value)}</textarea>`;
  else ctl = `<input class="form-control" type="${type}" name="${name}" value="${esc(value)}" ${req ? "required" : ""} ${attrs}>`;
  return `<div class="${col}"><label class="form-label">${esc(label)}${req ? ' <span class="text-danger">*</span>' : ""}</label>${ctl}${help ? `<div class="form-text">${esc(help)}</div>` : ""}</div>`;
}
const formData = root => Object.fromEntries($$("[name]", root).map(e => [e.name, e.type === "checkbox" ? e.checked : e.value.trim()]));

/* ---------- Tablas ---------- */
function badge(text, cls) { return `<span class="badge-st ${cls}">${esc(text)}</span>`; }
const estadoExp = e => badge(ESTADOS_EXP[e][0], ESTADOS_EXP[e][1]);
function paginate(items, page, size = 6) {
  const pages = Math.max(1, Math.ceil(items.length / size)); page = Math.min(Math.max(1, page), pages);
  return {rows:items.slice((page - 1) * size, page * size), page, pages, total:items.length, from:items.length ? (page - 1) * size + 1 : 0, to:Math.min(page * size, items.length)};
}
function pager(p, what, id) {
  const li = (n, label, dis, act) => `<li class="page-item ${dis ? "disabled" : ""} ${act ? "active" : ""}"><a class="page-link" href="#" data-pg="${n}" data-pgid="${id}">${label}</a></li>`;
  let nums = "", last = 0;
  for (let i = 1; i <= p.pages; i++) { if (i === 1 || i === p.pages || Math.abs(i - p.page) <= 1) { if (last && i - last > 1) nums += `<li class="page-item disabled"><span class="page-link">…</span></li>`; nums += li(i, i, false, i === p.page); last = i; } }
  return `<div class="tbl-foot"><span>Mostrando ${p.from}-${p.to} de ${p.total} ${what}</span><ul class="pagination pagination-sm">${li(p.page - 1, "&lsaquo;", p.page === 1)}${nums}${li(p.page + 1, "&rsaquo;", p.page === p.pages)}</ul></div>`;
}
const emptyState = (msg, ic = "bi-inbox") => `<div class="empty"><i class="bi ${ic}"></i>${esc(msg)}</div>`;
function pageHead(title, sub, actionHTML = "") { return `<div class="page-head"><div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div>${actionHTML}</div></div>`; }

/* ---------- Reglas de negocio (reflejan los RF del Sprint 2) ---------- */
const DBx = () => Store.db;
const stockProducto = pid => DBx().inventario.filter(i => i.producto_id === pid).reduce((a, i) => a + i.kg, 0);
const totalInventario = () => DBx().inventario.reduce((a, i) => a + i.kg, 0);
const totalExp = ex => ex.lineas.reduce((a, l) => a + l.kg * l.precio, 0);
const kgExp = ex => ex.lineas.reduce((a, l) => a + l.kg, 0);
const aUSD = (monto, mon) => mon === "EUR" ? monto * DBx().meta.tasaEurUsd : monto;
const pagadoExp = (id, soloConf = true) => DBx().pagos.filter(p => p.exportacion_id === id && (!soloConf || p.estado === "CONFIRMADO")).reduce((a, p) => a + aUSD(p.monto, p.moneda), 0);
const docsFaltantes = id => { const t = DBx().documentos.filter(d => d.exportacion_id === id && d.estado !== "RECHAZADO").map(d => d.tipo); return DOCS_OBLIGATORIOS.filter(x => !t.includes(x)); };
const alertasStock = () => { const out = []; DBx().productos.forEach(p => { const inv = DBx().inventario.filter(i => i.producto_id === p.id); const min = inv.reduce((a, i) => a + i.min, 0); if (min > 0 && stockProducto(p.id) < min) out.push({p, stock:stockProducto(p.id), min}); }); return out; };

/* Movimientos de inventario con validación de stock (RF-13, RF-14) */
function moverInventario({inv_id, tipo, kg: cant, motivo, exportacion_id = null, usuario}) {
  const inv = byId(DBx().inventario, inv_id);
  if (!(cant > 0)) throw new Error("La cantidad debe ser mayor que cero.");
  if (tipo === "SALIDA" && cant > inv.kg) throw new Error(`Stock insuficiente: disponible ${kg(inv.kg)} en esa bodega.`);
  if (tipo === "ENTRADA") inv.kg += cant; else if (tipo === "SALIDA") inv.kg -= cant; else inv.kg = cant;   // AJUSTE: fija el nuevo stock
  DBx().movimientos.unshift({id:Store.nextId("movimientos"), inv_id, tipo, kg:cant, motivo, exportacion_id, usuario, fecha:new Date().toISOString()});
}
function descontarStock(ex, usuario) {   // RF-19: descuenta FIFO entre bodegas
  for (const l of ex.lineas) { let falta = l.kg;
    for (const inv of DBx().inventario.filter(i => i.producto_id === l.producto_id && i.kg > 0).sort((a, b) => b.kg - a.kg)) {
      if (!falta) break; const t = Math.min(falta, inv.kg); moverInventario({inv_id:inv.id, tipo:"SALIDA", kg:t, motivo:`Exportación ${ex.codigo}`, exportacion_id:ex.id, usuario}); falta -= t; } }
  ex.descontado = true;
}
function devolverStock(ex, usuario) {
  DBx().movimientos.filter(m => m.exportacion_id === ex.id && m.tipo === "SALIDA").forEach(m => moverInventario({inv_id:m.inv_id, tipo:"ENTRADA", kg:m.kg, motivo:`Cancelación ${ex.codigo}`, exportacion_id:ex.id, usuario}));
  ex.descontado = false;
}

/* ---------- Gráficas ---------- */
const _charts = [];
const killCharts = () => { while (_charts.length) _charts.pop().destroy(); };
const PALETTE = ["#0e7c6b","#e7a21a","#2b7bd1","#6f4e37","#8bc34a","#d64545","#7e57c2"];
function mkChart(id, cfg) { const el = document.getElementById(id); if (!el || typeof Chart === "undefined") return; const c = new Chart(el, cfg); _charts.push(c); return c; }
