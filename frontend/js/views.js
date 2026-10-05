/* CoffeeExport Manager – vistas de los 9 módulos */
"use strict";

const UI = {
  clientes:{q:"", pais:"", estado:"", page:1}, productos:{q:"", tipo:"", estado:"", page:1},
  inventario:{q:"", bodega:"", tab:"stock", page:1, mpage:1}, exportaciones:{q:"", estado:"", page:1},
  documentos:{q:"", tipo:"", estado:"", page:1}, pagos:{q:"", estado:"", page:1},
  reportes:{desde:iso(addDays(new Date(), -90)), hasta:iso(addDays(new Date(), 7)), tipo:"exportaciones"}, config:{tab:"general"},
};
const Views = {};
const cliCode = c => "CLI-" + String(c.id).padStart(3, "0");
const optPais = (sel = "", todos = false) => [...(todos ? [["", "Todos los países"]] : [["", "Seleccione un país"]]), ...Object.entries(EU).sort((a, b) => a[1].localeCompare(b[1], "es"))];
const bindPager = (root, st, draw) => $$("[data-pg]", root).forEach(a => a.onclick = e => { e.preventDefault(); if (a.parentElement.classList.contains("disabled")) return; st.page = +a.dataset.pg; draw(); });
const bindFilters = (st, map, draw) => Object.entries(map).forEach(([id, key]) => { const el = $("#" + id); el.value = st[key]; el.oninput = () => { st[key] = el.value; st.page = 1; draw(); }; });
const tableCard = (head, rowsHTML, pg, what, empty) => `<div class="card-cem">${pg.total ? `<div class="table-responsive"><table class="table table-cem align-middle"><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rowsHTML}</tbody></table></div>${pager(pg, what)}` : emptyState(empty)}</div>`;
const searchBox = (id, ph) => `<div class="search-box"><i class="bi bi-search"></i><input class="form-control" id="${id}" placeholder="${ph}" aria-label="${ph}"></div>`;
const selectBox = (id, opts) => `<select class="form-select" id="${id}" aria-label="Filtro">${opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("")}</select>`;
const newBtn = (label, id) => `<button class="btn btn-cem" id="${id}"><i class="bi bi-plus-lg me-1"></i>${label}</button>`;
const nrm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const REQ_MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const cliName = id => (byId(DBx().clientes, id) || {}).nombre || "—";
const prodName = id => (byId(DBx().productos, id) || {}).nombre || "—";
const expOf = id => byId(DBx().exportaciones, id);

/* ======================================================= DASHBOARD */
Views.dashboard = () => {
  const d = DBx(), now = new Date(), ym = x => String(x).slice(0, 7);
  const mes = iso(now).slice(0, 7), prev = iso(new Date(now.getFullYear(), now.getMonth() - 1, 15)).slice(0, 7);
  const valid = d.exportaciones.filter(e => !["CANCELADA", "BORRADOR"].includes(e.estado));
  const ventas = m => valid.filter(e => ym(e.fecha_envio) === m).reduce((a, e) => a + totalExp(e), 0);
  const cnt = m => d.exportaciones.filter(e => ym(e.fecha_envio) === m).length;
  const delta = (a, b) => { if (!b) return `<span class="delta flat">— vs mes anterior</span>`; const p = Math.round((a - b) / b * 100); return `<span class="delta ${p >= 0 ? "up" : "down"}"><i class="bi bi-arrow-${p >= 0 ? "up" : "down"}-short"></i>${Math.abs(p)}% vs. mes anterior</span>`; };
  const act = d.clientes.filter(c => c.activo).length;
  const kpi = (ico, cls, lbl, val, dl) => `<div class="col-6 col-xl-3"><div class="card-cem kpi h-100"><div class="ico ${cls}"><i class="bi ${ico}"></i></div><div><div class="lbl">${lbl}</div><div class="val">${val}</div>${dl}</div></div></div>`;
  const ult = [...d.exportaciones].sort((a, b) => b.fecha_envio.localeCompare(a.fecha_envio)).slice(0, 5);
  $("#view").innerHTML = pageHead("Dashboard", "Resumen general del sistema") + `
  <div class="row g-3 mb-3">
    ${kpi("bi-truck", "", "Total Exportaciones", d.exportaciones.length, delta(cnt(mes), cnt(prev)))}
    ${kpi("bi-people", "blue", "Clientes Activos", act, `<span class="delta flat">${d.clientes.length} registrados</span>`)}
    ${kpi("bi-boxes", "coffee", "Inventario Disponible", `${nf(totalInventario())} <small>kg</small>`, `<span class="delta ${alertasStock().length ? "down" : "up"}">${alertasStock().length ? alertasStock().length + " producto(s) bajo mínimo" : "Stock saludable"}</span>`)}
    ${kpi("bi-currency-dollar", "amber", "Ventas del mes", `${usd0(ventas(mes))} <small>USD</small>`, delta(ventas(mes), ventas(prev)))}
  </div>
  <div class="row g-3 mb-3">
    <div class="col-lg-7"><div class="card-cem h-100"><div class="card-h">Exportaciones por país</div><div class="card-b"><div class="chart-box"><canvas id="ch-pais" aria-label="Exportaciones por país" role="img"></canvas></div></div></div></div>
    <div class="col-lg-5"><div class="card-cem h-100"><div class="card-h">Productos más vendidos</div><div class="card-b"><div class="chart-box"><canvas id="ch-prod" aria-label="Productos más vendidos" role="img"></canvas></div></div></div></div>
  </div>
  <div class="card-cem"><div class="card-h">Últimas exportaciones <a href="#exportaciones" class="small fw-normal">Ver todas</a></div>
    <div class="table-responsive"><table class="table table-cem"><thead><tr><th>ID</th><th>Cliente</th><th>País destino</th><th>Producto</th><th>Fecha de envío</th><th>Estado</th></tr></thead><tbody>
    ${ult.map(e => `<tr><td class="fw-semibold">${esc(e.codigo)}</td><td>${esc(cliName(e.cliente_id))}</td><td>${esc(EU[e.pais])}</td><td>${esc(prodName(e.lineas[0].producto_id))}${e.lineas.length > 1 ? ` <span class="text-muted">+${e.lineas.length - 1}</span>` : ""}</td><td>${fdate(e.fecha_envio)}</td><td>${estadoExp(e.estado)}</td></tr>`).join("")}
    </tbody></table></div></div>`;
  const porPais = {}; d.exportaciones.filter(e => e.estado !== "CANCELADA").forEach(e => porPais[e.pais] = (porPais[e.pais] || 0) + 1);
  const top = Object.entries(porPais).sort((a, b) => b[1] - a[1]).slice(0, 6);
  mkChart("ch-pais", {type:"bar", data:{labels:top.map(t => EU[t[0]]), datasets:[{label:"Exportaciones", data:top.map(t => t[1]), backgroundColor:"#0e7c6b", borderRadius:6}]},
    options:{maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true, ticks:{precision:0}, grid:{color:"#eef3f2"}}, x:{grid:{display:false}}}}});
  const kgp = {}; valid.forEach(e => e.lineas.forEach(l => kgp[l.producto_id] = (kgp[l.producto_id] || 0) + l.kg));
  const tp = Object.entries(kgp).sort((a, b) => b[1] - a[1]); const t4 = tp.slice(0, 4), otros = tp.slice(4).reduce((a, x) => a + x[1], 0);
  const labels = t4.map(x => prodName(+x[0])).concat(otros ? ["Otros"] : []), vals = t4.map(x => x[1]).concat(otros ? [otros] : []);
  mkChart("ch-prod", {type:"doughnut", data:{labels, datasets:[{data:vals, backgroundColor:PALETTE, borderWidth:2}]},
    options:{maintainAspectRatio:false, cutout:"62%", plugins:{legend:{position:"right", labels:{boxWidth:10, font:{size:11}}}, tooltip:{callbacks:{label:c => `${c.label}: ${nf(c.parsed)} kg`}}}}});
};

/* ======================================================= CLIENTES */
Views.clientes = () => {
  const st = UI.clientes, w = can("clientes", "w");
  const paises = [...new Set(DBx().clientes.map(c => c.pais))];
  $("#view").innerHTML = pageHead("Gestión de Clientes", "Administra los clientes internacionales", w ? newBtn("Nuevo Cliente", "new-cli") : "") +
    `<div class="toolbar">${searchBox("f-q", "Buscar cliente...")}${selectBox("f-pais", [["", "Todos los países"], ...paises.map(p => [p, EU[p]])])}${selectBox("f-est", [["", "Todos los estados"], ["1", "Activo"], ["0", "Inactivo"]])}</div><div id="tbl"></div>`;
  const draw = () => {
    const q = nrm(st.q); const rows = DBx().clientes.filter(c => (!q || nrm(c.nombre + c.nif + c.email + c.contacto).includes(q)) && (!st.pais || c.pais === st.pais) && (!st.estado || String(+c.activo) === st.estado));
    const pg = paginate(rows, st.page, 6); st.page = pg.page;
    $("#tbl").innerHTML = tableCard(["ID", "Nombre", "País", "Email", "Teléfono", "Estado", "Acciones"], pg.rows.map(c => `<tr>
      <td class="text-muted">${cliCode(c)}</td><td class="fw-semibold">${esc(c.nombre)}<div class="small text-muted fw-normal">${esc(c.contacto)} · ${esc(c.nif)}</div></td><td>${esc(EU[c.pais])}</td><td>${esc(c.email)}</td><td>${esc(c.telefono)}</td>
      <td>${c.activo ? badge("Activo", "st-green") : badge("Inactivo", "st-gray")}</td>
      <td class="text-nowrap">${w ? `<button class="btn-icon" data-edit="${c.id}" aria-label="Editar ${esc(c.nombre)}" title="Editar"><i class="bi bi-pencil-square"></i></button><button class="btn-icon ${c.activo ? "del" : ""}" data-tog="${c.id}" aria-label="${c.activo ? "Desactivar" : "Activar"} ${esc(c.nombre)}" title="${c.activo ? "Desactivar" : "Activar"}"><i class="bi ${c.activo ? "bi-person-dash" : "bi-person-check"}"></i></button>` : `<button class="btn-icon" data-edit="${c.id}" aria-label="Ver" title="Ver"><i class="bi bi-eye"></i></button>`}</td></tr>`).join(""), pg, "clientes", "No se encontraron clientes");
    bindPager($("#tbl"), st, draw);
    $$("[data-edit]").forEach(b => b.onclick = () => clienteForm(byId(DBx().clientes, b.dataset.edit)));
    $$("[data-tog]").forEach(b => b.onclick = async () => { const c = byId(DBx().clientes, b.dataset.tog);
      if (await confirmDlg(`¿${c.activo ? "Desactivar" : "Activar"} al cliente <b>${esc(c.nombre)}</b>? ${c.activo ? "Conservará su histórico de exportaciones." : ""}`, {label:c.activo ? "Desactivar" : "Activar", danger:c.activo})) { c.activo = !c.activo; Store.save(); toast(`Cliente ${c.activo ? "activado" : "desactivado"}`); draw(); } });
  };
  bindFilters(st, {"f-q":"q", "f-pais":"pais", "f-est":"estado"}, draw); draw();
  if (w) $("#new-cli").onclick = () => clienteForm(null, draw);
  function clienteForm(c, redraw = draw) {
    const ro = !w; const dis = ro ? "disabled" : "";
    openModal({title:c ? (ro ? "Detalle del cliente" : "Editar cliente") : "Nuevo cliente", size:"modal-lg", saveLabel:c ? "Guardar cambios" : "Registrar cliente", hideFoot:ro,
      body:`<div class="row g-3">${field("Nombre / razón social", "nombre", {value:c?.nombre, req:true, col:"col-md-8", attrs:dis})}${field("País (UE)", "pais", {value:c?.pais, options:optPais(), req:true, col:"col-md-4", attrs:dis})}
        ${field("Identificación fiscal (VAT)", "nif", {value:c?.nif, req:true, col:"col-md-6", attrs:dis})}${field("Persona de contacto", "contacto", {value:c?.contacto, req:true, col:"col-md-6", attrs:dis})}
        ${field("Correo de contacto", "email", {type:"email", value:c?.email, req:true, col:"col-md-6", attrs:dis})}${field("Teléfono", "telefono", {value:c?.telefono, col:"col-md-6", attrs:dis})}
        ${field("Dirección", "direccion", {value:c?.direccion, attrs:dis})}
        <div class="col-12"><div class="form-check"><input class="form-check-input" type="checkbox" name="consent" id="consent" ${c?.consent ? "checked" : ""} ${dis}><label class="form-check-label small" for="consent">El cliente autoriza el tratamiento de sus datos personales conforme al GDPR <span class="text-danger">*</span>${c?.consentFecha ? ` <span class="text-muted">(otorgado el ${fdate(c.consentFecha)})</span>` : ""}</label></div></div></div>`,
      onSave:root => { const f = formData(root), err = [];
        if (!f.nombre) err.push("El nombre es obligatorio."); if (!EU[f.pais]) err.push("Seleccione un país perteneciente a la Unión Europea.");
        if (!f.nif) err.push("La identificación fiscal es obligatoria."); else if (DBx().clientes.some(x => x.id !== c?.id && nrm(x.nif) === nrm(f.nif))) err.push("Ya existe un cliente con esa identificación fiscal.");
        if (!f.contacto) err.push("La persona de contacto es obligatoria."); if (!REQ_MAIL.test(f.email)) err.push("Ingrese un correo de contacto válido.");
        if (!f.consent) err.push("Se requiere el consentimiento de tratamiento de datos (GDPR).");
        if (!formErrors(root, err)) return false;
        if (c) Object.assign(c, {nombre:f.nombre, pais:f.pais, nif:f.nif, contacto:f.contacto, email:f.email, telefono:f.telefono, direccion:f.direccion, consent:true, consentFecha:c.consentFecha || todayISO()});
        else DBx().clientes.push({id:Store.nextId("clientes"), nombre:f.nombre, pais:f.pais, nif:f.nif, contacto:f.contacto, email:f.email, telefono:f.telefono, direccion:f.direccion, consent:true, consentFecha:todayISO(), activo:true});
        Store.save(); toast(c ? "Cliente actualizado" : "Cliente registrado"); redraw(); }});
  }
};

/* ======================================================= PRODUCTOS */
Views.productos = () => {
  const st = UI.productos, w = can("productos", "w");
  $("#view").innerHTML = pageHead("Gestión de Productos", "Administra los productos de café y cacao", w ? newBtn("Nuevo Producto", "new-prod") : "") +
    `<div class="toolbar">${searchBox("f-q", "Buscar producto...")}${selectBox("f-tipo", [["", "Todos los tipos"], ["CAFE", "Café"], ["CACAO", "Cacao"]])}${selectBox("f-est", [["", "Todos los estados"], ["1", "Activo"], ["0", "Inactivo"]])}</div><div id="tbl"></div>`;
  const draw = () => {
    const q = nrm(st.q); const rows = DBx().productos.filter(p => (!q || nrm(p.nombre + p.codigo + p.variedad).includes(q)) && (!st.tipo || p.tipo === st.tipo) && (!st.estado || String(+p.activo) === st.estado));
    const pg = paginate(rows, st.page, 6); st.page = pg.page;
    $("#tbl").innerHTML = tableCard(["Producto", "Tipo", "Variedad", "Precio (USD/kg)", "Stock", "Estado", "Acciones"], pg.rows.map(p => { const s = stockProducto(p.id);
      return `<tr><td><span class="pimg ${p.tipo === "CACAO" ? "cacao" : ""} me-2">${p.tipo === "CACAO" ? "🍫" : "☕"}</span><span class="fw-semibold">${esc(p.nombre)}</span><div class="small text-muted ms-5 ps-1">${esc(p.codigo)}</div></td>
      <td>${p.tipo === "CAFE" ? "Café" : "Cacao"}</td><td>${esc(p.variedad || "—")}</td><td class="fw-semibold">${usd(p.precio)}</td><td>${kg(s)}</td><td>${p.activo ? badge("Activo", "st-green") : badge("Inactivo", "st-gray")}</td>
      <td class="text-nowrap">${w ? `<button class="btn-icon" data-edit="${p.id}" aria-label="Editar ${esc(p.nombre)}" title="Editar"><i class="bi bi-pencil-square"></i></button><button class="btn-icon ${p.activo ? "del" : ""}" data-tog="${p.id}" aria-label="${p.activo ? "Desactivar" : "Activar"} ${esc(p.nombre)}" title="${p.activo ? "Desactivar" : "Activar"}"><i class="bi ${p.activo ? "bi-slash-circle" : "bi-check-circle"}"></i></button>` : "—"}</td></tr>`; }).join(""), pg, "productos", "No se encontraron productos");
    bindPager($("#tbl"), st, draw);
    $$("[data-edit]").forEach(b => b.onclick = () => prodForm(byId(DBx().productos, b.dataset.edit)));
    $$("[data-tog]").forEach(b => b.onclick = async () => { const p = byId(DBx().productos, b.dataset.tog);
      if (await confirmDlg(`¿${p.activo ? "Desactivar" : "Activar"} el producto <b>${esc(p.nombre)}</b>? ${p.activo ? "Dejará de estar disponible para nuevas exportaciones." : ""}`, {danger:p.activo, label:p.activo ? "Desactivar" : "Activar"})) { p.activo = !p.activo; Store.save(); toast("Producto actualizado"); draw(); } });
  };
  bindFilters(st, {"f-q":"q", "f-tipo":"tipo", "f-est":"estado"}, draw); draw();
  if (w) $("#new-prod").onclick = () => prodForm(null);
  function prodForm(p) {
    openModal({title:p ? "Editar producto" : "Nuevo producto", saveLabel:p ? "Guardar cambios" : "Registrar producto",
      body:`<div class="row g-3">${field("Nombre comercial", "nombre", {value:p?.nombre, req:true, col:"col-md-8"})}${field("Código (SKU)", "codigo", {value:p?.codigo, req:true, col:"col-md-4"})}
      ${field("Tipo", "tipo", {value:p?.tipo || "CAFE", options:[["CAFE", "Café"], ["CACAO", "Cacao"]], req:true, col:"col-md-4"})}${field("Variedad", "variedad", {value:p?.variedad, col:"col-md-4"})}
      ${field("Precio (USD por kg)", "precio", {type:"number", value:p?.precio, req:true, col:"col-md-4", attrs:'step="0.01" min="0.01"'})}</div>`,
      onSave:root => { const f = formData(root), err = [], pr = parseFloat(f.precio);
        if (!f.nombre) err.push("El nombre es obligatorio."); if (!f.codigo) err.push("El código es obligatorio."); else if (DBx().productos.some(x => x.id !== p?.id && nrm(x.codigo) === nrm(f.codigo))) err.push("Ya existe un producto con ese código.");
        if (!(pr > 0)) err.push("El precio debe ser mayor que cero.");
        if (!formErrors(root, err)) return false;
        const data = {nombre:f.nombre, codigo:f.codigo, tipo:f.tipo, variedad:f.variedad, precio:Math.round(pr * 100) / 100};
        if (p) Object.assign(p, data); else DBx().productos.push({id:Store.nextId("productos"), ...data, activo:true});
        Store.save(); toast(p ? "Producto actualizado" : "Producto registrado"); draw(); }});
  }
};

/* ======================================================= INVENTARIO */
Views.inventario = () => {
  const st = UI.inventario, w = can("inventario", "w"), d = DBx();
  const alerts = alertasStock();
  $("#view").innerHTML = pageHead("Inventario", "Consulta y control de stock en tiempo real", w ? newBtn("Registrar movimiento", "new-mov") : "") + `
  <div class="row g-3 mb-3">
    <div class="col-sm-4"><div class="card-cem kpi"><div class="ico coffee"><i class="bi bi-boxes"></i></div><div><div class="lbl">Stock total</div><div class="val">${nf(totalInventario())} <small>kg</small></div></div></div></div>
    <div class="col-sm-4"><div class="card-cem kpi"><div class="ico amber"><i class="bi bi-exclamation-triangle"></i></div><div><div class="lbl">Productos bajo el mínimo</div><div class="val">${alerts.length}</div></div></div></div>
    <div class="col-sm-4"><div class="card-cem kpi"><div class="ico blue"><i class="bi bi-building"></i></div><div><div class="lbl">Bodegas</div><div class="val">${d.bodegas.length}</div></div></div></div>
  </div>
  ${alerts.length ? `<div class="alert alert-warning py-2 small"><i class="bi bi-exclamation-triangle me-1"></i><b>Stock bajo el mínimo:</b> ${alerts.map(a => `${esc(a.p.nombre)} (${nf(a.stock)} de ${nf(a.min)} kg)`).join(" · ")}</div>` : ""}
  <ul class="nav nav-tabs mb-3" id="inv-tabs"><li class="nav-item"><button class="nav-link" data-tab="stock">Existencias</button></li><li class="nav-item"><button class="nav-link" data-tab="mov">Movimientos</button></li></ul>
  <div class="toolbar">${searchBox("f-q", "Buscar producto...")}${selectBox("f-bod", [["", "Todas las bodegas"], ...d.bodegas.map(b => [b.id, b.nombre])])}</div><div id="tbl"></div>`;
  const draw = () => {
    $$("#inv-tabs .nav-link").forEach(b => b.classList.toggle("active", b.dataset.tab === st.tab));
    const q = nrm(st.q);
    if (st.tab === "stock") {
      const rows = d.inventario.filter(i => (!q || nrm(prodName(i.producto_id)).includes(q)) && (!st.bodega || i.bodega_id === +st.bodega));
      const pg = paginate(rows, st.page, 7); st.page = pg.page;
      $("#tbl").innerHTML = tableCard(["Producto", "Bodega", "Stock (kg)", "Nivel", "Mínimo (kg)", "Estado", w ? "Acciones" : ""], pg.rows.map(i => { const low = i.min > 0 && i.kg < i.min, pct = Math.min(100, i.min ? i.kg / (i.min * 2) * 100 : 100);
        return `<tr><td class="fw-semibold">${esc(prodName(i.producto_id))}</td><td>${esc(byId(d.bodegas, i.bodega_id).nombre)}</td><td>${nf(i.kg)}</td>
        <td><div class="stock-bar ${low ? "low" : ""}"><span style="width:${pct}%"></span></div></td><td>${nf(i.min)}</td><td>${low ? badge("Bajo mínimo", "st-red") : badge("Normal", "st-green")}</td>
        <td>${w ? `<button class="btn-icon" data-min="${i.id}" aria-label="Editar mínimo" title="Editar stock mínimo"><i class="bi bi-sliders"></i></button>` : ""}</td></tr>`; }).join(""), pg, "registros", "No hay existencias para el filtro seleccionado");
    } else {
      const rows = d.movimientos.filter(m => { const i = byId(d.inventario, m.inv_id); return (!q || nrm(prodName(i.producto_id)).includes(q)) && (!st.bodega || i.bodega_id === +st.bodega); });
      const pg = paginate(rows, st.mpage, 7); st.mpage = pg.page; const tcls = {ENTRADA:"st-green", SALIDA:"st-orange", AJUSTE:"st-blue"};
      $("#tbl").innerHTML = tableCard(["Fecha", "Producto", "Bodega", "Tipo", "Cantidad", "Motivo", "Usuario"], pg.rows.map(m => { const i = byId(d.inventario, m.inv_id);
        return `<tr><td>${new Date(m.fecha).toLocaleString("es-CO", {dateStyle:"short", timeStyle:"short"})}</td><td>${esc(prodName(i.producto_id))}</td><td>${esc(byId(d.bodegas, i.bodega_id).nombre)}</td><td>${badge(m.tipo, tcls[m.tipo])}</td><td>${nf(m.kg)} kg</td><td>${esc(m.motivo || "—")}</td><td>${esc(m.usuario)}</td></tr>`; }).join(""), pg, "movimientos", "Aún no hay movimientos registrados");
    }
    $$("[data-pg]").forEach(a => a.onclick = e => { e.preventDefault(); if (a.parentElement.classList.contains("disabled")) return; st[st.tab === "stock" ? "page" : "mpage"] = +a.dataset.pg; draw(); });
    $$("[data-min]").forEach(b => b.onclick = () => { const i = byId(d.inventario, b.dataset.min);
      openModal({title:`Stock mínimo · ${prodName(i.producto_id)}`, body:field("Stock mínimo (kg)", "min", {type:"number", value:i.min, attrs:'min="0" step="10"', help:"Se alertará cuando el stock total del producto baje de la suma de mínimos."}),
        onSave:root => { const v = parseFloat(formData(root).min); if (!(v >= 0)) return formErrors(root, ["Ingrese un valor válido (≥ 0)."]); i.min = v; Store.save(); toast("Stock mínimo actualizado"); Views.inventario(); } }); });
  };
  $$("#inv-tabs .nav-link").forEach(b => b.onclick = () => { st.tab = b.dataset.tab; draw(); });
  bindFilters(st, {"f-q":"q", "f-bod":"bodega"}, draw); draw();
  if (w) $("#new-mov").onclick = () => {
    const prods = d.productos.filter(p => p.activo);
    openModal({title:"Registrar movimiento de inventario", body:`<div class="row g-3">${field("Producto", "producto", {options:prods.map(p => [p.id, p.nombre]), req:true, col:"col-md-6"})}${field("Bodega", "bodega", {options:d.bodegas.map(b => [b.id, b.nombre]), req:true, col:"col-md-6"})}
      ${field("Tipo de movimiento", "tipo", {options:[["ENTRADA", "Entrada"], ["SALIDA", "Salida"], ["AJUSTE", "Ajuste (fija el stock)"]], req:true, col:"col-md-6"})}${field("Cantidad (kg)", "cant", {type:"number", req:true, col:"col-md-6", attrs:'min="0" step="0.01"'})}
      ${field("Motivo", "motivo", {attrs:'maxlength="255"'})}<div class="col-12"><div class="alert alert-light border small mb-0" id="stock-hint"></div></div></div>`,
      onSave:root => { const f = formData(root), cant = parseFloat(f.cant); let inv = d.inventario.find(i => i.producto_id === +f.producto && i.bodega_id === +f.bodega);
        try { if (!inv) { if (f.tipo === "SALIDA") throw new Error("No hay existencias de ese producto en la bodega seleccionada."); inv = {id:Store.nextId("inventario"), producto_id:+f.producto, bodega_id:+f.bodega, kg:0, min:0}; d.inventario.push(inv); }
          moverInventario({inv_id:inv.id, tipo:f.tipo, kg:cant, motivo:f.motivo, usuario:Session.user.nombre}); }
        catch (e) { return formErrors(root, [e.message]); }
        Store.save(); toast("Movimiento registrado"); Views.inventario(); }});
    const hint = () => { const r = $("#modal-body"), f = formData(r), i = d.inventario.find(x => x.producto_id === +f.producto && x.bodega_id === +f.bodega); $("#stock-hint").innerHTML = `<i class="bi bi-info-circle me-1"></i>Stock actual en la bodega: <b>${nf(i ? i.kg : 0)} kg</b> · Total del producto: <b>${nf(stockProducto(+f.producto))} kg</b>`; };
    $$("#modal-body select").forEach(s => s.onchange = hint); hint();
  };
};

/* ======================================================= EXPORTACIONES */
Views.exportaciones = () => {
  const st = UI.exportaciones, w = can("exportaciones", "w");
  $("#view").innerHTML = pageHead("Exportaciones", "Pedidos y envíos de café y cacao hacia la Unión Europea", w ? `<a class="btn btn-cem" href="#exportaciones/nueva"><i class="bi bi-plus-lg me-1"></i>Nueva Exportación</a>` : "") +
    `<div class="toolbar">${searchBox("f-q", "Buscar por código, cliente o país...")}${selectBox("f-est", [["", "Todos los estados"], ...Object.entries(ESTADOS_EXP).map(([k, v]) => [k, v[0]])])}</div><div id="tbl"></div>`;
  const draw = () => {
    const q = nrm(st.q); const rows = [...DBx().exportaciones].sort((a, b) => b.id - a.id).filter(e => (!q || nrm(e.codigo + cliName(e.cliente_id) + EU[e.pais]).includes(q)) && (!st.estado || e.estado === st.estado));
    const pg = paginate(rows, st.page, 7); st.page = pg.page;
    $("#tbl").innerHTML = tableCard(["Código", "Cliente", "Destino", "Productos", "Total (USD)", "Fecha de envío", "Estado", ""], pg.rows.map(e => `<tr>
      <td class="fw-semibold">${esc(e.codigo)}</td><td>${esc(cliName(e.cliente_id))}</td><td>${esc(EU[e.pais])}<div class="small text-muted">${esc(e.puerto_llegada)}</div></td>
      <td>${e.lineas.map(l => esc(prodName(l.producto_id))).join(", ")}<div class="small text-muted">${nf(kgExp(e))} kg</div></td><td class="fw-semibold">${usd(totalExp(e))}</td><td>${fdate(e.fecha_envio)}</td><td>${estadoExp(e.estado)}</td>
      <td><button class="btn-icon" data-det="${e.id}" aria-label="Ver detalle ${esc(e.codigo)}" title="Ver detalle"><i class="bi bi-eye"></i></button></td></tr>`).join(""), pg, "exportaciones", "No se encontraron exportaciones");
    bindPager($("#tbl"), st, draw); $$("[data-det]").forEach(b => b.onclick = () => expDetail(+b.dataset.det, draw));
  };
  bindFilters(st, {"f-q":"q", "f-est":"estado"}, draw); draw();
};

function expDetail(id, redraw) {
  const e = expOf(id), w = can("exportaciones", "w"), falt = docsFaltantes(id), pag = pagadoExp(id), tot = totalExp(e);
  const next = {BORRADOR:[["EN_PREPARACION", "Confirmar exportación", "btn-cem"]], EN_PREPARACION:[["EN_TRANSITO", "Pasar a En tránsito", "btn-cem"]], EN_TRANSITO:[["ENTREGADA", "Marcar como entregada", "btn-cem"]], ENTREGADA:[], CANCELADA:[]}[e.estado];
  const canCancel = w && ["BORRADOR", "EN_PREPARACION"].includes(e.estado);
  openModal({title:`Exportación ${e.codigo}`, size:"modal-lg", hideFoot:true, body:`
    <div class="row g-3 mb-3"><div class="col-md-6"><div class="text-muted small">Cliente</div><b>${esc(cliName(e.cliente_id))}</b></div><div class="col-md-6"><div class="text-muted small">Estado</div>${estadoExp(e.estado)}</div>
    <div class="col-md-4"><div class="text-muted small">País destino</div>${esc(EU[e.pais])}</div><div class="col-md-4"><div class="text-muted small">Puerto de salida</div>${esc(e.puerto_salida)}</div><div class="col-md-4"><div class="text-muted small">Puerto de llegada</div>${esc(e.puerto_llegada)}</div>
    <div class="col-md-4"><div class="text-muted small">Fecha de envío</div>${fdate(e.fecha_envio)}</div><div class="col-md-8"><div class="text-muted small">Observaciones</div>${esc(e.obs || "—")}</div></div>
    <table class="table table-cem table-sm"><thead><tr><th>Producto</th><th class="text-end">Cantidad</th><th class="text-end">Precio USD/kg</th><th class="text-end">Subtotal</th></tr></thead><tbody>
    ${e.lineas.map(l => `<tr><td>${esc(prodName(l.producto_id))}</td><td class="text-end">${kg(l.kg)}</td><td class="text-end">${usd(l.precio)}</td><td class="text-end">${usd(l.kg * l.precio)}</td></tr>`).join("")}
    <tr class="fw-bold"><td colspan="3" class="text-end">Total</td><td class="text-end">${usd(tot)}</td></tr></tbody></table>
    <div class="row g-3"><div class="col-md-6"><div class="card-cem card-b"><div class="fw-semibold mb-1"><i class="bi bi-file-earmark-text me-1"></i>Documentación obligatoria</div>
      ${["BORRADOR", "CANCELADA"].includes(e.estado) && falt.length === DOCS_OBLIGATORIOS.length ? `<span class="text-muted small">Sin documentos cargados.</span>` : ""}
      ${DOCS_OBLIGATORIOS.map(t => `<div class="small">${falt.includes(t) ? '<i class="bi bi-x-circle text-danger"></i>' : '<i class="bi bi-check-circle text-success"></i>'} ${TIPOS_DOC[t]}</div>`).join("")}</div></div>
    <div class="col-md-6"><div class="card-cem card-b"><div class="fw-semibold mb-1"><i class="bi bi-credit-card me-1"></i>Pagos</div><div class="small">Confirmado: <b>${usd(pag)}</b></div><div class="small">Saldo pendiente: <b>${usd(Math.max(0, tot - pag))}</b></div>
      <div class="stock-bar mt-2"><span style="width:${Math.min(100, tot ? pag / tot * 100 : 0)}%"></span></div></div></div></div>
    <div class="d-flex flex-wrap gap-2 justify-content-end mt-3" id="exp-actions">${w ? next.map(n => `<button class="btn ${n[2]}" data-to="${n[0]}">${n[1]}</button>`).join("") : ""}${canCancel ? `<button class="btn btn-outline-danger" data-to="CANCELADA">Cancelar exportación</button>` : ""}<button class="btn btn-light" data-bs-dismiss="modal">Cerrar</button></div>`});
  $$("[data-to]", $("#modal")).forEach(b => b.onclick = async () => {
    const to = b.dataset.to, u = Session.user.nombre;
    try {
      if (to === "EN_PREPARACION") { for (const l of e.lineas) if (stockProducto(l.producto_id) < e.lineas.filter(x => x.producto_id === l.producto_id).reduce((a, x) => a + x.kg, 0)) throw new Error(`Stock insuficiente de ${prodName(l.producto_id)}.`); descontarStock(e, u); }
      if (to === "EN_TRANSITO") { const f = docsFaltantes(id); if (f.length) throw new Error("Faltan documentos obligatorios: " + f.map(t => TIPOS_DOC[t]).join(", ") + "."); }
      if (to === "CANCELADA") { if (!(await confirmDlg(`¿Cancelar la exportación <b>${esc(e.codigo)}</b>? ${e.descontado ? "Se devolverá el stock descontado." : ""}`, {danger:true, label:"Cancelar exportación"}))) return; if (e.descontado) devolverStock(e, u); }
    } catch (err) { toast(err.message, "danger"); return; }
    e.estado = to; Store.save(); closeModal(); toast(`Exportación ${ESTADOS_EXP[to][0].toLowerCase()}`); redraw && redraw(); refreshBell();
  });
}

/* ---- Asistente "Nueva Exportación" (4 pasos) ---- */
let W = null;
Views["exportaciones/nueva"] = () => {
  if (!can("exportaciones", "w")) { toast("Su rol no permite crear exportaciones.", "danger"); location.hash = "#exportaciones"; return; }
  W = {step:1, f:{fecha:iso(addDays(new Date(), 10)), estado:"EN_PREPARACION", obs:"", cliente:"", pais:"", salida:"Cartagena", llegada:"", lineas:[{producto:"", kg:"", precio:""}], docs:{}}};
  wizDraw();
};
const WSTEPS = ["Información básica", "Cliente y destino", "Productos y cantidades", "Documentos"];
function wizDraw() {
  const f = W.f, s = W.step, d = DBx();
  const stepper = `<div class="wizard-steps">${WSTEPS.map((t, i) => `${i ? '<div class="bar"></div>' : ""}<div class="st ${i + 1 === s ? "active" : i + 1 < s ? "done" : ""}"><span class="n">${i + 1 < s ? '<i class="bi bi-check"></i>' : i + 1}</span><span class="lbl">${t}</span></div>`).join("")}</div>`;
  let body = "";
  if (s === 1) body = `<div class="row g-3">${field("Fecha de envío", "fecha", {type:"date", value:f.fecha, req:true, col:"col-md-6"})}${field("Estado inicial", "estado", {value:f.estado, col:"col-md-6", options:[["BORRADOR", "Borrador"], ["EN_PREPARACION", "En preparación (confirmar y descontar inventario)"]]})}${field("Observaciones", "obs", {type:"textarea", value:f.obs})}</div>`;
  if (s === 2) body = `<div class="row g-3">${field("Cliente", "cliente", {value:f.cliente, req:true, col:"col-md-6", options:[["", "Seleccione un cliente"], ...d.clientes.filter(c => c.activo).map(c => [c.id, `${c.nombre} (${EU[c.pais]})`])]})}${field("País destino", "pais", {value:f.pais, req:true, col:"col-md-6", options:optPais()})}
    ${field("Puerto de salida", "salida", {value:f.salida, req:true, col:"col-md-6", options:[["", "Seleccione un puerto"], ...PUERTOS_SALIDA.map(p => [p, p])]})}${field("Puerto de llegada", "llegada", {value:f.llegada, req:true, col:"col-md-6", options:[["", "Seleccione un puerto"], ...PUERTOS_LLEGADA.map(p => [p, p])]})}</div>`;
  if (s === 3) { const prods = d.productos.filter(p => p.activo); body = `<div id="lines">${f.lineas.map((l, i) => `<div class="line-row"><div class="row g-2 align-items-end">
      <div class="col-md-5"><label class="form-label">Producto</label><select class="form-select" data-i="${i}" data-k="producto"><option value="">Seleccione…</option>${prods.map(p => `<option value="${p.id}" ${+l.producto === p.id ? "selected" : ""}>${esc(p.nombre)} · disp. ${nf(stockProducto(p.id))} kg</option>`).join("")}</select></div>
      <div class="col-6 col-md-3"><label class="form-label">Cantidad (kg)</label><input class="form-control" type="number" min="1" step="1" data-i="${i}" data-k="kg" value="${esc(l.kg)}"></div>
      <div class="col-6 col-md-3"><label class="form-label">Precio USD/kg</label><input class="form-control" type="number" min="0.01" step="0.01" data-i="${i}" data-k="precio" value="${esc(l.precio)}"></div>
      <div class="col-md-1 text-end">${f.lineas.length > 1 ? `<button class="btn-icon del" data-rm="${i}" aria-label="Quitar producto"><i class="bi bi-trash"></i></button>` : ""}</div></div></div>`).join("")}</div>
    <button class="btn btn-outline-cem btn-sm" id="add-line"><i class="bi bi-plus-lg me-1"></i>Agregar producto</button>
    <div class="text-end fs-5 mt-3">Total: <b id="w-total">${usd(wizTotal())}</b> <small class="text-muted">USD</small></div>`; }
  if (s === 4) body = `<p class="text-muted small">Adjunte los documentos en PDF (máx. 5 MB). Los obligatorios (*) pueden diferirse, pero son necesarios para pasar a <b>En tránsito</b>.</p>
    ${Object.entries(TIPOS_DOC).filter(([k]) => k !== "OTRO").map(([k, v]) => { const dd = f.docs[k]; return `<div class="doc-slot ${dd ? "ok" : ""}"><div><i class="bi ${dd ? "bi-file-earmark-check text-success" : "bi-file-earmark-pdf"} me-2"></i><b>${v}</b>${DOCS_OBLIGATORIOS.includes(k) ? " *" : ""}${dd ? `<div class="small text-muted">${esc(dd.nombre)} · ${nf(dd.kb)} KB</div>` : ""}</div>
      <div>${dd ? `<button class="btn btn-sm btn-light" data-rmdoc="${k}">Quitar</button>` : `<label class="btn btn-sm btn-outline-cem mb-0">Adjuntar PDF<input type="file" accept="application/pdf,.pdf" hidden data-doc="${k}"></label>`}</div></div>`; }).join("")}
    <div class="alert alert-light border small mt-3 mb-0"><b>Resumen:</b> ${esc(cliName(+f.cliente))} · ${esc(EU[f.pais] || "")} · ${esc(f.salida)} → ${esc(f.llegada)} · ${nf(wizKg())} kg · <b>${usd(wizTotal())}</b></div>`;
  $("#view").innerHTML = pageHead("Nueva Exportación", "Registra una nueva exportación de café o cacao", `<a class="btn btn-light" href="#exportaciones">Cancelar</a>`) +
    `<div class="card-cem"><div class="card-b" style="max-width:860px"><div id="wiz-body">${stepper}<h2 class="fs-6 mb-3">Paso ${s}: ${WSTEPS[s - 1]}</h2>${body}</div>
    <div class="d-flex justify-content-between mt-4 pt-3 border-top"><button class="btn btn-light" id="w-prev" ${s === 1 ? "disabled" : ""}><i class="bi bi-arrow-left me-1"></i>Anterior</button>
    <div class="d-flex gap-2">${s === 4 ? `<button class="btn btn-outline-cem" id="w-draft">Guardar borrador</button><button class="btn btn-cem" id="w-finish"><i class="bi bi-check2-circle me-1"></i>Crear exportación</button>` : `<button class="btn btn-cem" id="w-next">Siguiente <i class="bi bi-arrow-right ms-1"></i></button>`}</div></div></div></div>`;
  wizBind();
}
const wizKg = () => W.f.lineas.reduce((a, l) => a + (parseFloat(l.kg) || 0), 0);
const wizTotal = () => W.f.lineas.reduce((a, l) => a + (parseFloat(l.kg) || 0) * (parseFloat(l.precio) || 0), 0);
function wizCollect() {
  const f = W.f, root = $("#wiz-body");
  $$("[name]", root).forEach(e => f[{fecha:"fecha", estado:"estado", obs:"obs", cliente:"cliente", pais:"pais", salida:"salida", llegada:"llegada"}[e.name]] = e.value);
}
function wizValidate() {
  const f = W.f, err = [], s = W.step;
  if (s === 1) { if (!f.fecha) err.push("La fecha de envío es obligatoria."); else if (f.fecha < todayISO()) err.push("La fecha de envío no puede estar en el pasado."); }
  if (s === 2) { if (!f.cliente) err.push("Seleccione un cliente."); if (!f.pais) err.push("Seleccione el país destino."); if (!f.salida) err.push("Seleccione el puerto de salida."); if (!f.llegada) err.push("Seleccione el puerto de llegada."); }
  if (s === 3) { const acc = {};
    f.lineas.forEach((l, i) => { if (!l.producto) err.push(`Línea ${i + 1}: seleccione un producto.`); if (!(parseFloat(l.kg) > 0)) err.push(`Línea ${i + 1}: la cantidad debe ser mayor que cero.`); if (!(parseFloat(l.precio) > 0)) err.push(`Línea ${i + 1}: el precio debe ser mayor que cero.`); acc[l.producto] = (acc[l.producto] || 0) + (parseFloat(l.kg) || 0); });
    Object.entries(acc).forEach(([p, k]) => { if (p && k > stockProducto(+p)) err.push(`Stock insuficiente de ${prodName(+p)}: solicitado ${nf(k)} kg, disponible ${nf(stockProducto(+p))} kg.`); }); }
  return err;
}
function wizBind() {
  const root = $("#wiz-body"), f = W.f, showErr = m => formErrors(root, m);
  const go = n => { wizCollect(); W.step = n; wizDraw(); };
  $("#w-prev").onclick = () => go(W.step - 1);
  if ($("#w-next")) $("#w-next").onclick = () => { wizCollect(); const e = wizValidate(); if (e.length) return showErr(e); go(W.step + 1); };
  if (W.step === 2) { const sel = $("[name=pais]", root); sel.onchange = () => { const l = $("[name=llegada]", root); if (!l.value && PUERTO_POR_PAIS[sel.value]) l.value = PUERTO_POR_PAIS[sel.value]; }; const c = $("[name=cliente]", root); c.onchange = () => { const cl = byId(DBx().clientes, c.value); if (cl) { sel.value = cl.pais; sel.onchange(); } }; }
  if (W.step === 3) {
    $$("[data-k]", root).forEach(el => el.oninput = el.onchange = () => { const l = f.lineas[+el.dataset.i]; l[el.dataset.k] = el.value;
      if (el.dataset.k === "producto") { const p = byId(DBx().productos, el.value); l.precio = p ? p.precio : ""; wizDraw(); return; } $("#w-total").textContent = usd(wizTotal()); });
    $$("[data-rm]", root).forEach(b => b.onclick = () => { f.lineas.splice(+b.dataset.rm, 1); wizDraw(); });
    $("#add-line").onclick = () => { f.lineas.push({producto:"", kg:"", precio:""}); wizDraw(); };
  }
  if (W.step === 4) {
    $$("[data-doc]", root).forEach(inp => inp.onchange = () => { const file = inp.files[0]; if (!file) return;
      if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) { inp.value = ""; return showErr(["Solo se permiten archivos PDF."]); }
      if (file.size > 5 * 1024 * 1024) { inp.value = ""; return showErr(["El archivo supera el tamaño máximo de 5 MB."]); }
      f.docs[inp.dataset.doc] = {nombre:file.name, kb:Math.max(1, Math.round(file.size / 1024))}; wizDraw(); });
    $$("[data-rmdoc]", root).forEach(b => b.onclick = () => { delete f.docs[b.dataset.rmdoc]; wizDraw(); });
    const finish = async estado => {
      const errs = [], saved = W.step; [1, 2, 3].forEach(n => { W.step = n; errs.push(...wizValidate()); }); W.step = saved;
      if (estado !== "BORRADOR" && errs.length) return showErr(errs); if (estado === "BORRADOR" && W.f.lineas.some(l => !l.producto) ) return showErr(["Complete al menos los productos antes de guardar el borrador."]);
      const ex = {id:Store.nextId("exportaciones"), cliente_id:+f.cliente, pais:f.pais, puerto_salida:f.salida, puerto_llegada:f.llegada, fecha_envio:f.fecha, estado:"BORRADOR", creador:Session.user.id, obs:f.obs,
        lineas:f.lineas.map(l => ({producto_id:+l.producto, kg:parseFloat(l.kg) || 0, precio:parseFloat(l.precio) || 0})), descontado:false, creado:todayISO()};
      ex.codigo = `EXP-${new Date().getFullYear()}-${String(ex.id).padStart(4, "0")}`;
      try { if (estado !== "BORRADOR") { descontarStock(ex, Session.user.nombre); ex.estado = "EN_PREPARACION"; } } catch (err) { return showErr([err.message]); }
      DBx().exportaciones.push(ex);
      Object.entries(f.docs).forEach(([t, dd]) => DBx().documentos.push({id:Store.nextId("documentos"), exportacion_id:ex.id, tipo:t, archivo:dd.nombre, kb:dd.kb, estado:"PENDIENTE", fecha:todayISO(), por:Session.user.id}));
      Store.save(); toast(`Exportación ${ex.codigo} creada`); location.hash = "#exportaciones";
    };
    $("#w-finish").onclick = () => finish(W.f.estado); $("#w-draft").onclick = () => finish("BORRADOR");
  }
}

/* ======================================================= DOCUMENTOS */
Views.documentos = () => {
  const st = UI.documentos, w = can("documentos", "w"), dst = {PENDIENTE:["Pendiente", "st-amber"], VALIDADO:["Validado", "st-green"], RECHAZADO:["Rechazado", "st-red"]};
  $("#view").innerHTML = pageHead("Documentos de Exportación", "Gestiona y consulta los documentos de cada exportación", w ? newBtn("Subir documento", "new-doc") : "") +
    `<div class="toolbar">${searchBox("f-q", "Buscar documento o exportación...")}${selectBox("f-tipo", [["", "Todos los tipos"], ...Object.entries(TIPOS_DOC)])}${selectBox("f-est", [["", "Todos los estados"], ...Object.entries(dst).map(([k, v]) => [k, v[0]])])}</div><div id="tbl"></div>`;
  const draw = () => {
    const q = nrm(st.q); const rows = [...DBx().documentos].sort((a, b) => b.id - a.id).filter(x => (!q || nrm(x.archivo + (expOf(x.exportacion_id) || {}).codigo).includes(q)) && (!st.tipo || x.tipo === st.tipo) && (!st.estado || x.estado === st.estado));
    const pg = paginate(rows, st.page, 7); st.page = pg.page;
    $("#tbl").innerHTML = tableCard(["ID", "Tipo", "Exportación", "Archivo", "Fecha", "Estado", "Acciones"], pg.rows.map(x => `<tr><td class="text-muted">DOC-${String(x.id).padStart(3, "0")}</td><td class="fw-semibold">${TIPOS_DOC[x.tipo]}</td><td>${esc((expOf(x.exportacion_id) || {}).codigo)}</td>
      <td class="small">${esc(x.archivo)}<div class="text-muted">${nf(x.kb)} KB</div></td><td>${fdate(x.fecha)}</td><td>${badge(dst[x.estado][0], dst[x.estado][1])}</td>
      <td class="text-nowrap"><button class="btn-icon" data-dl="${x.id}" aria-label="Descargar" title="Descargar"><i class="bi bi-download"></i></button>${w && x.estado === "PENDIENTE" ? `<button class="btn-icon" data-val="${x.id}" aria-label="Validar" title="Validar"><i class="bi bi-check2-circle"></i></button><button class="btn-icon del" data-rej="${x.id}" aria-label="Rechazar" title="Rechazar"><i class="bi bi-x-circle"></i></button>` : ""}</td></tr>`).join(""), pg, "documentos", "No se encontraron documentos");
    bindPager($("#tbl"), st, draw);
    $$("[data-dl]").forEach(b => b.onclick = () => toast("Demostración: el archivo PDF se almacenará en el servidor cuando exista el backend.", "info"));
    $$("[data-val]").forEach(b => b.onclick = () => { byId(DBx().documentos, b.dataset.val).estado = "VALIDADO"; Store.save(); toast("Documento validado"); draw(); refreshBell(); });
    $$("[data-rej]").forEach(b => b.onclick = () => { byId(DBx().documentos, b.dataset.rej).estado = "RECHAZADO"; Store.save(); toast("Documento rechazado", "warning"); draw(); refreshBell(); });
  };
  bindFilters(st, {"f-q":"q", "f-tipo":"tipo", "f-est":"estado"}, draw); draw();
  if (w) $("#new-doc").onclick = () => openModal({title:"Subir documento", saveLabel:"Subir",
    body:`<div class="row g-3">${field("Exportación", "exp", {req:true, options:[["", "Seleccione una exportación"], ...DBx().exportaciones.filter(e => !["CANCELADA", "ENTREGADA"].includes(e.estado)).map(e => [e.id, `${e.codigo} · ${cliName(e.cliente_id)}`])]})}
    ${field("Tipo de documento", "tipo", {req:true, options:Object.entries(TIPOS_DOC)})}<div class="col-12"><label class="form-label">Archivo PDF <span class="text-danger">*</span></label><input type="file" class="form-control" id="doc-file" accept="application/pdf,.pdf"><div class="form-text">Solo PDF, máximo 5 MB.</div></div></div>`,
    onSave:root => { const f = formData(root), file = $("#doc-file").files[0], err = [];
      if (!f.exp) err.push("Seleccione una exportación."); if (!file) err.push("Seleccione un archivo."); else { if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) err.push("Solo se permiten archivos PDF."); if (file.size > 5 * 1024 * 1024) err.push("El archivo supera el tamaño máximo de 5 MB."); }
      if (!formErrors(root, err)) return false;
      DBx().documentos.push({id:Store.nextId("documentos"), exportacion_id:+f.exp, tipo:f.tipo, archivo:file.name, kb:Math.max(1, Math.round(file.size / 1024)), estado:"PENDIENTE", fecha:todayISO(), por:Session.user.id});
      Store.save(); toast("Documento cargado"); draw(); refreshBell(); }});
};

/* ======================================================= PAGOS */
Views.pagos = () => {
  const st = UI.pagos, w = can("pagos", "w"), d = DBx(), pst = {PENDIENTE:["Pendiente", "st-amber"], CONFIRMADO:["Confirmado", "st-green"], RECHAZADO:["Rechazado", "st-red"]};
  const facturable = d.exportaciones.filter(e => ["EN_PREPARACION", "EN_TRANSITO", "ENTREGADA"].includes(e.estado));
  const porCobrar = facturable.reduce((a, e) => a + Math.max(0, totalExp(e) - pagadoExp(e.id)), 0);
  const conf = d.pagos.filter(p => p.estado === "CONFIRMADO").reduce((a, p) => a + aUSD(p.monto, p.moneda), 0), pend = d.pagos.filter(p => p.estado === "PENDIENTE").reduce((a, p) => a + aUSD(p.monto, p.moneda), 0);
  $("#view").innerHTML = pageHead("Gestión de Pagos", "Registra y consulta los pagos de tus exportaciones", w ? newBtn("Registrar Pago", "new-pay") : "") + `
  <div class="row g-3 mb-3"><div class="col-sm-4"><div class="card-cem kpi"><div class="ico"><i class="bi bi-check2-circle"></i></div><div><div class="lbl">Confirmado (USD eq.)</div><div class="val">${usd0(conf)}</div></div></div></div>
  <div class="col-sm-4"><div class="card-cem kpi"><div class="ico amber"><i class="bi bi-hourglass-split"></i></div><div><div class="lbl">Pendiente de confirmar</div><div class="val">${usd0(pend)}</div></div></div></div>
  <div class="col-sm-4"><div class="card-cem kpi"><div class="ico blue"><i class="bi bi-cash-stack"></i></div><div><div class="lbl">Saldo por cobrar</div><div class="val">${usd0(porCobrar)}</div><span class="delta flat">Tasa EUR/USD: ${d.meta.tasaEurUsd}</span></div></div></div></div>
  <div class="toolbar">${searchBox("f-q", "Buscar pago...")}${selectBox("f-est", [["", "Todos los estados"], ...Object.entries(pst).map(([k, v]) => [k, v[0]])])}</div><div id="tbl"></div>`;
  const draw = () => {
    const q = nrm(st.q); const rows = [...d.pagos].sort((a, b) => b.id - a.id).filter(p => { const e = expOf(p.exportacion_id); return (!q || nrm(e.codigo + cliName(e.cliente_id) + p.ref).includes(q)) && (!st.estado || p.estado === st.estado); });
    const pg = paginate(rows, st.page, 7); st.page = pg.page;
    $("#tbl").innerHTML = tableCard(["ID", "Exportación", "Cliente", "Monto", "Moneda", "Fecha", "Estado", "Acciones"], pg.rows.map(p => { const e = expOf(p.exportacion_id);
      return `<tr><td class="text-muted">PAY-${String(p.id).padStart(3, "0")}</td><td class="fw-semibold">${esc(e.codigo)}</td><td>${esc(cliName(e.cliente_id))}</td><td class="fw-semibold">${p.moneda === "EUR" ? "€" : "$"} ${nf(p.monto, 2)}</td><td>${p.moneda}<div class="small text-muted">${esc(p.metodo === "CARTA_CREDITO" ? "Carta de crédito" : p.metodo === "TRANSFERENCIA" ? "Transferencia" : "Otro")}</div></td><td>${fdate(p.fecha)}</td><td>${badge(pst[p.estado][0], pst[p.estado][1])}</td>
      <td class="text-nowrap">${w && p.estado === "PENDIENTE" ? `<button class="btn-icon" data-ok="${p.id}" aria-label="Confirmar pago" title="Confirmar"><i class="bi bi-check2-circle"></i></button><button class="btn-icon del" data-no="${p.id}" aria-label="Rechazar pago" title="Rechazar"><i class="bi bi-x-circle"></i></button>` : `<span class="small text-muted">${esc(p.ref || "")}</span>`}</td></tr>`; }).join(""), pg, "pagos", "No se encontraron pagos");
    bindPager($("#tbl"), st, draw);
    $$("[data-ok]").forEach(b => b.onclick = () => { byId(d.pagos, b.dataset.ok).estado = "CONFIRMADO"; Store.save(); toast("Pago confirmado"); Views.pagos(); refreshBell(); });
    $$("[data-no]").forEach(b => b.onclick = () => { byId(d.pagos, b.dataset.no).estado = "RECHAZADO"; Store.save(); toast("Pago rechazado", "warning"); Views.pagos(); refreshBell(); });
  };
  bindFilters(st, {"f-q":"q", "f-est":"estado"}, draw); draw();
  if (w) $("#new-pay").onclick = () => {
    openModal({title:"Registrar pago internacional", saveLabel:"Registrar pago", size:"modal-lg",
      body:`<div class="row g-3">${field("Exportación", "exp", {req:true, col:"col-md-12", options:[["", "Seleccione una exportación"], ...facturable.map(e => [e.id, `${e.codigo} · ${cliName(e.cliente_id)} · saldo ${usd(Math.max(0, totalExp(e) - pagadoExp(e.id)))}`])]})}
      ${field("Monto", "monto", {type:"number", req:true, col:"col-md-4", attrs:'min="0.01" step="0.01"'})}${field("Moneda", "moneda", {req:true, col:"col-md-4", options:[["USD", "USD – Dólar"], ["EUR", "EUR – Euro"]]})}${field("Fecha de pago", "fecha", {type:"date", value:todayISO(), req:true, col:"col-md-4"})}
      ${field("Método", "metodo", {col:"col-md-6", options:[["TRANSFERENCIA", "Transferencia bancaria"], ["CARTA_CREDITO", "Carta de crédito"], ["OTRO", "Otro"]]})}${field("Referencia de la transacción", "ref", {col:"col-md-6", attrs:'maxlength="80"'})}</div>`,
      onSave:root => { const f = formData(root), m = parseFloat(f.monto), err = [];
        if (!f.exp) err.push("Seleccione una exportación."); if (!(m > 0)) err.push("El monto debe ser mayor que cero."); if (!["USD", "EUR"].includes(f.moneda)) err.push("Moneda no soportada: solo USD o EUR."); if (!f.fecha) err.push("Ingrese la fecha de pago.");
        if (!formErrors(root, err)) return false;
        d.pagos.push({id:Store.nextId("pagos"), exportacion_id:+f.exp, monto:Math.round(m * 100) / 100, moneda:f.moneda, metodo:f.metodo, ref:f.ref, fecha:f.fecha, estado:"PENDIENTE", por:Session.user.id});
        Store.save(); toast("Pago registrado como pendiente"); Views.pagos(); refreshBell(); }});
  };
};

/* ======================================================= REPORTES */
Views.reportes = () => {
  const st = UI.reportes;
  $("#view").innerHTML = pageHead("Reportes", "Análisis y estadísticas de tus exportaciones") + `
  <div class="card-cem card-b mb-3"><div class="row g-2 align-items-end"><div class="col-6 col-md-3"><label class="form-label">Desde</label><input type="date" class="form-control" id="r-desde" value="${st.desde}"></div>
    <div class="col-6 col-md-3"><label class="form-label">Hasta</label><input type="date" class="form-control" id="r-hasta" value="${st.hasta}"></div>
    <div class="col-md-3"><label class="form-label">Tipo de reporte</label><select class="form-select" id="r-tipo"><option value="exportaciones">Exportaciones</option><option value="ventas">Ventas por producto y país</option><option value="existencias">Existencias</option></select></div>
    <div class="col-md-3"><button class="btn btn-cem w-100" id="r-gen"><i class="bi bi-graph-up me-1"></i>Generar reporte</button></div></div><div id="r-err" class="mt-2"></div></div>
  <div id="r-out"></div>`;
  $("#r-tipo").value = st.tipo;
  const gen = () => {
    const desde = $("#r-desde").value, hasta = $("#r-hasta").value, tipo = $("#r-tipo").value; $("#r-err").innerHTML = "";
    if (!desde || !hasta) { $("#r-err").innerHTML = `<div class="alert alert-danger py-2 small mb-0">Seleccione el rango de fechas.</div>`; return; }
    if (hasta < desde) { $("#r-err").innerHTML = `<div class="alert alert-danger py-2 small mb-0"><i class="bi bi-exclamation-circle me-1"></i>La fecha final no puede ser anterior a la fecha inicial.</div>`; $("#r-out").innerHTML = ""; return; }
    Object.assign(st, {desde, hasta, tipo}); killCharts();
    const d = DBx(), exps = d.exportaciones.filter(e => !["CANCELADA", "BORRADOR"].includes(e.estado) && e.fecha_envio >= desde && e.fecha_envio <= hasta);
    const ventas = exps.reduce((a, e) => a + totalExp(e), 0), cli = new Set(exps.map(e => e.cliente_id)).size;
    let head, rows, title;
    if (tipo === "exportaciones") { title = "Detalle de exportaciones"; head = ["Código", "Cliente", "País", "Cantidad (kg)", "Total (USD)", "Fecha de envío", "Estado"];
      rows = exps.map(e => [e.codigo, cliName(e.cliente_id), EU[e.pais], kgExp(e), +totalExp(e).toFixed(2), fdate(e.fecha_envio), ESTADOS_EXP[e.estado][0]]); }
    else if (tipo === "ventas") { title = "Ventas por producto y país"; head = ["Producto", "País", "Cantidad (kg)", "Ventas (USD)", "% del total"]; const agg = {};
      exps.forEach(e => e.lineas.forEach(l => { const k = l.producto_id + "|" + e.pais; agg[k] = agg[k] || {p:l.producto_id, c:e.pais, kg:0, v:0}; agg[k].kg += l.kg; agg[k].v += l.kg * l.precio; }));
      rows = Object.values(agg).sort((a, b) => b.v - a.v).map(a => [prodName(a.p), EU[a.c], a.kg, +a.v.toFixed(2), (ventas ? a.v / ventas * 100 : 0).toFixed(1) + " %"]); }
    else { title = "Existencias actuales"; head = ["Producto", "Bodega", "Stock (kg)", "Mínimo (kg)", "Estado"]; rows = d.inventario.map(i => [prodName(i.producto_id), byId(d.bodegas, i.bodega_id).nombre, i.kg, i.min, i.min > 0 && i.kg < i.min ? "Bajo mínimo" : "Normal"]); }
    window._reporte = {title, head, rows, desde, hasta};
    $("#r-out").innerHTML = `<div class="row g-3 mb-3">
      <div class="col-md-4"><div class="card-cem kpi"><div class="ico"><i class="bi bi-truck"></i></div><div><div class="lbl">Total Exportaciones</div><div class="val">${exps.length}</div></div></div></div>
      <div class="col-md-4"><div class="card-cem kpi"><div class="ico amber"><i class="bi bi-currency-dollar"></i></div><div><div class="lbl">Ventas Totales</div><div class="val">${usd0(ventas)} <small>USD</small></div></div></div></div>
      <div class="col-md-4"><div class="card-cem kpi"><div class="ico blue"><i class="bi bi-people"></i></div><div><div class="lbl">Clientes con envíos</div><div class="val">${cli}</div></div></div></div></div>
    ${exps.length ? `<div class="row g-3 mb-3"><div class="col-lg-6"><div class="card-cem h-100"><div class="card-h">Exportaciones por país</div><div class="card-b"><div class="chart-box"><canvas id="rc-pais" role="img" aria-label="Exportaciones por país"></canvas></div></div></div></div>
      <div class="col-lg-6"><div class="card-cem h-100"><div class="card-h">Productos más vendidos (USD)</div><div class="card-b"><div class="chart-box"><canvas id="rc-prod" role="img" aria-label="Productos más vendidos"></canvas></div></div></div></div></div>` : ""}
    <div class="card-cem"><div class="card-h"><span>${title} <small class="text-muted fw-normal">· ${fdate(desde)} – ${fdate(hasta)}</small></span><span class="d-flex gap-2"><button class="btn btn-sm btn-outline-danger" id="r-pdf"><i class="bi bi-file-earmark-pdf me-1"></i>Reporte en PDF</button><button class="btn btn-sm btn-outline-success" id="r-xls"><i class="bi bi-file-earmark-excel me-1"></i>Exportar a Excel</button></span></div>
    ${rows.length ? `<div class="table-responsive"><table class="table table-cem"><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td>${typeof c === "number" ? nf(c, Number.isInteger(c) ? 0 : 2) : esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : emptyState("No hay resultados en el rango seleccionado", "bi-search")}</div>`;
    if (exps.length) {
      const pp = {}; exps.forEach(e => pp[e.pais] = (pp[e.pais] || 0) + 1); const pe = Object.entries(pp).sort((a, b) => b[1] - a[1]);
      mkChart("rc-pais", {type:"pie", data:{labels:pe.map(x => EU[x[0]]), datasets:[{data:pe.map(x => x[1]), backgroundColor:PALETTE, borderWidth:2}]}, options:{maintainAspectRatio:false, plugins:{legend:{position:"right", labels:{boxWidth:10, font:{size:11}}}}}});
      const pv = {}; exps.forEach(e => e.lineas.forEach(l => pv[l.producto_id] = (pv[l.producto_id] || 0) + l.kg * l.precio)); const pvs = Object.entries(pv).sort((a, b) => b[1] - a[1]).slice(0, 5);
      mkChart("rc-prod", {type:"bar", data:{labels:pvs.map(x => prodName(+x[0])), datasets:[{data:pvs.map(x => Math.round(x[1])), backgroundColor:"#0e7c6b", borderRadius:6}]}, options:{indexAxis:"y", maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{grid:{color:"#eef3f2"}}, y:{grid:{display:false}}}}});
    }
    const R = window._reporte;
    $("#r-pdf") && ($("#r-pdf").onclick = () => { try { const {jsPDF} = window.jspdf; const doc = new jsPDF({orientation:"landscape"});
      doc.setFontSize(16); doc.text("CoffeeExport Manager · RITECH SAS", 14, 16); doc.setFontSize(11); doc.text(`${R.title} — ${fdate(R.desde)} a ${fdate(R.hasta)}`, 14, 24);
      doc.autoTable({head:[R.head], body:R.rows.map(r => r.map(c => typeof c === "number" ? nf(c, Number.isInteger(c) ? 0 : 2) : c)), startY:30, headStyles:{fillColor:[14, 124, 107]}, styles:{fontSize:9}});
      doc.save(`reporte_${R.desde}_${R.hasta}.pdf`); toast("PDF generado"); } catch (e) { toast("No se pudo generar el PDF (librería no disponible sin conexión).", "danger"); } });
    $("#r-xls") && ($("#r-xls").onclick = () => { try { const ws = XLSX.utils.aoa_to_sheet([R.head, ...R.rows]); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Reporte"); XLSX.writeFile(wb, `reporte_${R.desde}_${R.hasta}.xlsx`); toast("Excel generado"); } catch (e) { toast("No se pudo generar el Excel (librería no disponible sin conexión).", "danger"); } });
  };
  $("#r-gen").onclick = gen; gen();
};

/* ======================================================= CONFIGURACIÓN */
Views.config = () => {
  const st = UI.config, d = DBx(), m = d.meta, em = m.empresa;
  const tabs = [["general", "General"], ["usuarios", "Usuarios"], ["roles", "Roles y permisos"], ["notif", "Notificaciones"]];
  $("#view").innerHTML = pageHead("Configuración", "Personaliza el sistema según tus necesidades") +
    `<ul class="nav nav-tabs mb-3">${tabs.map(t => `<li class="nav-item"><button class="nav-link ${st.tab === t[0] ? "active" : ""}" data-tab="${t[0]}">${t[1]}</button></li>`).join("")}</ul><div id="tab"></div>`;
  $$("[data-tab]").forEach(b => b.onclick = () => { st.tab = b.dataset.tab; Views.config(); });
  const tab = $("#tab");
  if (st.tab === "general") {
    tab.innerHTML = `<div class="row g-3"><div class="col-lg-8"><div class="card-cem card-b"><h2 class="fs-6 mb-3">Información de la empresa</h2><div class="row g-3">${field("Nombre de la empresa", "nombre", {value:em.nombre, col:"col-md-6"})}${field("NIT", "nit", {value:em.nit, col:"col-md-6"})}${field("Dirección", "direccion", {value:em.direccion})}${field("Correo", "email", {type:"email", value:em.email, col:"col-md-6"})}${field("Teléfono", "telefono", {value:em.telefono, col:"col-md-6"})}${field("Tasa de cambio EUR → USD", "tasa", {type:"number", value:m.tasaEurUsd, col:"col-md-6", attrs:'step="0.0001" min="0.1"', help:"Se usa para consolidar pagos en EUR a USD."})}</div>
      <div class="text-end mt-3"><button class="btn btn-cem" id="save-gen">Guardar cambios</button></div></div></div>
      <div class="col-lg-4"><div class="card-cem card-b text-center mb-3"><div class="fw-semibold mb-2 text-start">Logo de la empresa</div><div class="p-3">${logoSVG(70, "#0e7c6b", "#fff")}<div class="fw-bold mt-2">CoffeeExport</div></div></div>
      <div class="card-cem card-b border-danger-subtle"><div class="fw-semibold text-danger mb-1">Datos de demostración</div><p class="small text-muted">Restablece todos los datos del prototipo a su estado inicial.</p><button class="btn btn-outline-danger btn-sm" id="reset-demo">Restablecer datos demo</button></div></div></div>`;
    $("#save-gen").onclick = () => { const f = formData(tab), t = parseFloat(f.tasa), err = [];
      if (!f.nombre) err.push("El nombre de la empresa es obligatorio."); if (f.email && !REQ_MAIL.test(f.email)) err.push("Correo no válido."); if (!(t > 0)) err.push("La tasa de cambio debe ser mayor que cero.");
      if (err.length) return toast(err[0], "danger"); Object.assign(em, {nombre:f.nombre, nit:f.nit, direccion:f.direccion, email:f.email, telefono:f.telefono}); m.tasaEurUsd = t; Store.save(); toast("Configuración guardada"); };
    $("#reset-demo").onclick = async () => { if (await confirmDlg("Se perderán los cambios hechos en el prototipo y se restablecerán los datos de demostración.", {label:"Restablecer", danger:true})) { Store.reset(); toast("Datos restablecidos"); Views.config(); refreshBell(); } };
  }
  if (st.tab === "usuarios") {
    tab.innerHTML = `<div class="d-flex justify-content-end mb-2">${newBtn("Nuevo usuario", "new-user")}</div><div class="card-cem"><div class="table-responsive"><table class="table table-cem align-middle"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>
      ${d.usuarios.map(u => `<tr><td class="fw-semibold">${esc(u.nombre)}</td><td>${esc(u.email)}</td><td>${esc(ROLES[u.rol].nombre)}</td><td>${u.activo ? badge("Activo", "st-green") : badge("Inactivo", "st-gray")}</td><td class="text-nowrap"><button class="btn-icon" data-eu="${u.id}" aria-label="Editar ${esc(u.nombre)}"><i class="bi bi-pencil-square"></i></button></td></tr>`).join("")}</tbody></table></div></div>`;
    const form = u => openModal({title:u ? "Editar usuario" : "Nuevo usuario", saveLabel:u ? "Guardar cambios" : "Crear usuario",
      body:`<div class="row g-3">${field("Nombre", "nombre", {value:u?.nombre, req:true})}${field("Correo electrónico", "email", {type:"email", value:u?.email, req:true})}${field("Rol", "rol", {value:u?.rol || "OP_EXPORTACIONES", options:Object.entries(ROLES).map(([k, v]) => [k, v.nombre]), req:true, col:"col-md-6"})}${field(u ? "Nueva contraseña (opcional)" : "Contraseña inicial", "password", {type:"password", req:!u, col:"col-md-6", help:"Mínimo 8 caracteres. Se almacenará cifrada (BCrypt) en el backend.", attrs:'autocomplete="new-password"'})}
      <div class="col-12"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" name="activo" id="u-act" ${!u || u.activo ? "checked" : ""}><label class="form-check-label" for="u-act">Usuario activo</label></div></div></div>`,
      onSave:root => { const f = formData(root), err = [];
        if (!f.nombre) err.push("El nombre es obligatorio."); if (!REQ_MAIL.test(f.email)) err.push("Ingrese un correo válido."); else if (d.usuarios.some(x => x.id !== u?.id && x.email.toLowerCase() === f.email.toLowerCase())) err.push("Ya existe un usuario con ese correo.");
        if (!u && f.password.length < 8) err.push("La contraseña debe tener al menos 8 caracteres."); if (u && f.password && f.password.length < 8) err.push("La contraseña debe tener al menos 8 caracteres.");
        if (u && u.id === Session.user.id && (!f.activo || f.rol !== "ADMIN")) err.push("No puede desactivarse ni quitarse el rol de administrador a sí mismo.");
        if (!formErrors(root, err)) return false;
        if (u) { Object.assign(u, {nombre:f.nombre, email:f.email, rol:f.rol, activo:f.activo}); if (f.password) u.password = f.password; } else d.usuarios.push({id:Store.nextId("usuarios"), nombre:f.nombre, email:f.email, rol:f.rol, password:f.password, activo:f.activo});
        Store.save(); toast(u ? "Usuario actualizado" : "Usuario creado"); Views.config(); }});
    $("#new-user").onclick = () => form(null); $$("[data-eu]").forEach(b => b.onclick = () => form(byId(d.usuarios, b.dataset.eu)));
  }
  if (st.tab === "roles") {
    const ic = p => p === "w" ? '<i class="bi bi-pencil-square text-success" title="Lectura y escritura"></i>' : p === "r" ? '<i class="bi bi-eye text-primary" title="Solo lectura"></i>' : '<i class="bi bi-dash text-muted"></i>';
    tab.innerHTML = `<div class="card-cem"><div class="card-h">Matriz de permisos por rol <small class="text-muted fw-normal"><i class="bi bi-pencil-square text-success"></i> escritura · <i class="bi bi-eye text-primary"></i> lectura · <i class="bi bi-dash"></i> sin acceso</small></div><div class="table-responsive"><table class="table table-cem perm-table"><thead><tr><th>Módulo</th>${Object.values(ROLES).map(r => `<th>${esc(r.nombre)}</th>`).join("")}</tr></thead><tbody>
      ${MODULOS.map(mo => `<tr><td class="fw-semibold"><i class="bi ${mo.icon} me-2"></i>${mo.label}</td>${Object.keys(ROLES).map(r => `<td>${ic(PERMISOS[r][mo.id])}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>
      <p class="small text-muted mt-2">La autorización definitiva se valida en el backend (RNF-03); esta matriz refleja los permisos previstos para el MVP.</p>`;
  }
  if (st.tab === "notif") {
    const items = [["stock", "Alertas de stock mínimo", "Avisar cuando un producto baje del mínimo configurado."], ["docs", "Documentos pendientes", "Avisar de documentos por validar y exportaciones sin documentación obligatoria."], ["pagos", "Pagos pendientes", "Avisar de pagos registrados por confirmar."]];
    tab.innerHTML = `<div class="card-cem card-b" style="max-width:640px">${items.map(([k, t, s]) => `<div class="form-check form-switch d-flex justify-content-between align-items-start ps-0 mb-3"><label class="form-check-label" for="n-${k}"><b>${t}</b><div class="small text-muted">${s}</div></label><input class="form-check-input ms-3 mt-1" type="checkbox" id="n-${k}" data-n="${k}" ${m.notif[k] ? "checked" : ""}></div>`).join("")}</div>`;
    $$("[data-n]").forEach(c => c.onchange = () => { m.notif[c.dataset.n] = c.checked; Store.save(); refreshBell(); toast("Preferencia guardada"); });
  }
};
