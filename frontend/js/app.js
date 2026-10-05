/* CoffeeExport Manager – sesión, navegación y arranque */
"use strict";

const SESSION_KEY = "cem_session", IDLE_MS = 30 * 60 * 1000;   // RF-02: expira a los 30 min de inactividad
const Session = {user:null, last:Date.now()};
const can = (mod, lvl = "r") => { const p = (PERMISOS[Session.user?.rol] || {})[mod]; return lvl === "w" ? p === "w" : !!p; };

function saveSession(remember) {
  try { const v = JSON.stringify({id:Session.user.id}); (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, v); (remember ? sessionStorage : localStorage).removeItem(SESSION_KEY); } catch (e) { /* sin almacenamiento */ }
}
function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch (e) {} }
function restoreSession() {
  try { const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY); if (!raw) return false;
    const u = byId(Store.db.usuarios, JSON.parse(raw).id); if (!u || !u.activo) return false; Session.user = u; return true; } catch (e) { return false; }
}

/* ---------------- Login ---------------- */
function showLogin(msg) {
  killCharts(); Session.user = null; $("#app").hidden = true; $("#login-view").hidden = false;
  $("#hero-logo").innerHTML = logoSVG(96, "#6ee0c6", "#0b3b35");
  $("#demo-users").innerHTML = Store.db.usuarios.filter(u => u.activo).map(u => `<button type="button" data-u="${esc(u.email)}">${esc(ROLES[u.rol].nombre)}</button>`).join("");
  $$("#demo-users [data-u]").forEach(b => b.onclick = () => { $("#login-email").value = b.dataset.u; $("#login-pass").value = "Demo2026*"; $("#login-pass").focus(); });
  const err = $("#login-error"); err.hidden = !msg; err.textContent = msg || "";
  history.replaceState(null, "", location.pathname);
}
function doLogin(e) {
  e.preventDefault();
  const email = $("#login-email").value.trim().toLowerCase(), pass = $("#login-pass").value, err = $("#login-error");
  const fail = m => { err.hidden = false; err.textContent = m; };
  if (!email || !pass) return fail("Ingrese su correo y contraseña.");
  const u = Store.db.usuarios.find(x => x.email.toLowerCase() === email);
  if (!u || u.password !== pass) return fail("Credenciales incorrectas");            // mensaje genérico (UC-01 3a)
  if (!u.activo) return fail("Su usuario está inactivo. Contacte al administrador.");
  Session.user = u; Session.last = Date.now(); saveSession($("#login-remember").checked);
  $("#login-pass").value = ""; err.hidden = true; startApp(true);
}

/* ---------------- App ---------------- */
function startApp(fresh) {
  const u = Session.user; $("#login-view").hidden = true; $("#app").hidden = false;
  $("#side-logo").innerHTML = logoSVG(36, "#6ee0c6", "#0b3b35");
  $("#u-name").textContent = u.nombre.split(" ")[0] === "Administrador" ? "Admin" : u.nombre; $("#u-role").textContent = ROLES[u.rol].nombre; $("#u-mail").textContent = u.email;
  $("#u-avatar").textContent = u.nombre.split(" ").map(x => x[0]).slice(0, 2).join("").toUpperCase();
  $("#nav").innerHTML = MODULOS.filter(m => can(m.id)).map(m => `<li><a href="#${m.id}" data-m="${m.id}"><i class="bi ${m.icon}"></i><span>${m.label}</span></a></li>`).join("");
  refreshBell();
  if (fresh || !location.hash) location.hash = "#" + HOME[u.rol]; else route();
}
function route() {
  if (!Session.user) return;
  const hash = (location.hash || "").slice(1) || HOME[Session.user.rol], mod = hash.split("/")[0];
  closeSidebar(); killCharts();
  const m = MODULOS.find(x => x.id === mod);
  if (!m || !Views[hash]) { location.hash = "#" + HOME[Session.user.rol]; return; }
  if (!can(mod)) { toast("Acceso denegado: su rol no tiene permiso para este módulo.", "danger"); location.hash = "#" + HOME[Session.user.rol]; return; }   // RNF-03
  $$("#nav a").forEach(a => a.classList.toggle("active", a.dataset.m === mod));
  document.title = `${m.label} · CoffeeExport Manager`;
  Views[hash](); window.scrollTo(0, 0); const v = $("#view"); v.focus({preventScroll:true});
}
function logout(msg) { clearSession(); showLogin(msg); }

/* ---------------- Sidebar móvil ---------------- */
const closeSidebar = () => { $("#sidebar").classList.remove("open"); $("#backdrop").classList.remove("show"); };

/* ---------------- Notificaciones ---------------- */
function refreshBell() {
  if (!Session.user) return; const d = DBx(), n = d.meta.notif, items = [];
  if (n.stock && can("inventario")) alertasStock().forEach(a => items.push({ic:"bi-exclamation-triangle text-warning", t:`Stock bajo: ${a.p.nombre}`, s:`${nf(a.stock)} kg disponibles (mínimo ${nf(a.min)} kg)`, h:"#inventario"}));
  if (n.docs && can("documentos")) { const p = d.documentos.filter(x => x.estado === "PENDIENTE").length; if (p) items.push({ic:"bi-file-earmark-text text-primary", t:`${p} documento(s) por validar`, s:"Revise la sección de documentos", h:"#documentos"});
    d.exportaciones.filter(e => e.estado === "EN_PREPARACION" && docsFaltantes(e.id).length).slice(0, 3).forEach(e => items.push({ic:"bi-exclamation-circle text-danger", t:`${e.codigo}: documentación incompleta`, s:`Faltan ${docsFaltantes(e.id).length} documento(s) obligatorio(s)`, h:"#documentos"})); }
  if (n.pagos && can("pagos")) { const p = d.pagos.filter(x => x.estado === "PENDIENTE").length; if (p) items.push({ic:"bi-credit-card text-success", t:`${p} pago(s) por confirmar`, s:"Concilie los pagos pendientes", h:"#pagos"}); }
  $("#bell-n").hidden = !items.length; $("#bell-n").textContent = items.length;
  $("#bell-menu").innerHTML = `<div class="px-3 py-2 fw-semibold border-bottom">Notificaciones</div>` + (items.length ? items.map(i => `<a class="dropdown-item d-flex gap-2 py-2" href="${i.h}" style="white-space:normal"><i class="bi ${i.ic} mt-1"></i><span><span class="d-block small fw-semibold">${esc(i.t)}</span><span class="small text-muted">${esc(i.s)}</span></span></a>`).join("") : `<div class="p-3 small text-muted">Sin notificaciones pendientes.</div>`);
}

/* ---------------- Búsqueda global ---------------- */
function initSearch() {
  const inp = $("#gsearch"), box = $("#gsearch-res");
  const run = () => { const q = nrm(inp.value); if (q.length < 2) { box.hidden = true; return; } const d = DBx(), out = [];
    if (can("clientes")) d.clientes.filter(c => nrm(c.nombre + c.nif + c.email).includes(q)).slice(0, 3).forEach(c => out.push({t:c.nombre, s:`Cliente · ${EU[c.pais]}`, h:"clientes", key:"clientes", q:c.nombre}));
    if (can("productos")) d.productos.filter(p => nrm(p.nombre + p.codigo).includes(q)).slice(0, 3).forEach(p => out.push({t:p.nombre, s:`Producto · ${p.codigo}`, h:"productos", key:"productos", q:p.nombre}));
    if (can("exportaciones")) d.exportaciones.filter(e => nrm(e.codigo + cliName(e.cliente_id)).includes(q)).slice(0, 4).forEach(e => out.push({t:e.codigo, s:`Exportación · ${cliName(e.cliente_id)}`, h:"exportaciones", key:"exportaciones", q:e.codigo}));
    box.innerHTML = out.length ? out.map((o, i) => `<a href="#${o.h}" data-i="${i}"><b>${esc(o.t)}</b><small>${esc(o.s)}</small></a>`).join("") : `<div class="p-3 small text-muted">Sin resultados</div>`; box.hidden = false;
    $$("a", box).forEach(a => a.onclick = () => { const o = out[+a.dataset.i]; UI[o.key].q = o.q; UI[o.key].page = 1; box.hidden = true; inp.value = ""; if (location.hash === "#" + o.h) route(); }); };
  inp.oninput = run; inp.onfocus = run; document.addEventListener("click", e => { if (!e.target.closest(".search")) box.hidden = true; });
  inp.onkeydown = e => { if (e.key === "Escape") { box.hidden = true; inp.blur(); } };
}

/* ---------------- Arranque ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  Store.load();
  $("#login-form").addEventListener("submit", doLogin);
  $("#toggle-pass").onclick = () => { const p = $("#login-pass"), show = p.type === "password"; p.type = show ? "text" : "password"; $("#toggle-pass i").className = `bi bi-eye${show ? "-slash" : ""}`; };
  $("#forgot").onclick = e => { e.preventDefault(); toast("Contacte al administrador para restablecer su contraseña.", "info"); };
  $("#logout").onclick = e => { e.preventDefault(); logout(); };
  $("#menu-toggle").onclick = () => { $("#sidebar").classList.add("open"); $("#backdrop").classList.add("show"); };
  $("#backdrop").onclick = closeSidebar;
  initSearch();
  window.addEventListener("hashchange", route);
  ["click", "keydown", "mousemove", "touchstart"].forEach(ev => document.addEventListener(ev, () => { Session.last = Date.now(); }, {passive:true}));
  setInterval(() => { if (Session.user && Date.now() - Session.last > IDLE_MS) logout("Su sesión expiró por inactividad. Inicie sesión de nuevo."); }, 30000);
  if (restoreSession()) { Session.last = Date.now(); startApp(false); } else showLogin();
});
