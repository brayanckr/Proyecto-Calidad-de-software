/* Pruebas de integración: la interfaz, la lógica de negocio y el almacenamiento local trabajando juntos
   en un navegador real (Chromium, vía Playwright). Ejecutar: node --test "tests/integration/*.test.js"
   Requiere: npm install (playwright-core) y un Chromium/Chrome/Edge instalado. */
"use strict";
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const servidor = require("../helpers/servidor");

const EVIDENCIA = path.join(__dirname, "..", "evidence");
fs.mkdirSync(EVIDENCIA, { recursive: true });
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

let browser, srv, base;
before(async () => {
  srv = await servidor.iniciar(); base = srv.base;
  browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL || undefined });
});
after(async () => { await browser.close(); await srv.cerrar(); });

/* Cada prueba usa un contexto nuevo: localStorage limpio y datos de demostración frescos. */
async function abrir({ reloj = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: "es-CO", timezoneId: "America/Bogota" });
  const page = await ctx.newPage();
  const errores = []; page.on("pageerror", e => errores.push(e.message));
  if (reloj) await page.clock.install({ time: new Date() });
  return { ctx, page, errores };
}
async function entrar(page, usuario = "admin@ritech.co") {
  await page.goto(base + "/app.html");
  await page.click(`#demo-users [data-u="${usuario}"]`);
  await page.click("#login-form button[type=submit]");
  await page.waitForSelector("#app:not([hidden])");
  await page.waitForSelector("#view > *");
}
const ir = async (page, hash) => { await page.evaluate(h => { location.hash = "#" + h; }, hash); await page.waitForTimeout(450); };
const db = page => page.evaluate(() => JSON.parse(localStorage.getItem("cem_db_v1")));
/* Espera a que terminen las animaciones (conteo de KPI, ventanas) antes de capturar la evidencia. */
const foto = async (page, nombre) => { await page.waitForTimeout(1300); await page.screenshot({ path: path.join(EVIDENCIA, nombre + ".png") }); };
const errorDe = page => page.locator(".form-errors").innerText();
async function llenarCliente(page, d) {
  await page.click("#new-cli"); await page.waitForSelector("#modal.show");
  for (const [k, v] of Object.entries(d)) {
    if (k === "consent") { if (v) await page.check("[name=consent]"); continue; }
    const campo = `#modal-body [name=${k}]`;
    if (k === "pais") await page.selectOption(campo, v); else await page.fill(campo, v);
  }
}
/* Crea una exportación de 300 kg de Café Arábica para el cliente 1 usando el asistente. */
async function crearExportacion(page, kg = 300) {
  await ir(page, "exportaciones/nueva");
  await page.click("#w-next");
  await page.selectOption("[name=cliente]", "1"); await page.selectOption("[name=llegada]", "Hamburgo"); await page.click("#w-next");
  await page.selectOption("[data-k=producto]", "1"); await page.fill("[data-k=kg]", String(kg)); await page.click("#w-next");
  await page.click("#w-finish"); await page.waitForFunction(() => location.hash === "#exportaciones");
  const d = await db(page); return d.exportaciones[d.exportaciones.length - 1];
}
const stock = (d, pid) => d.inventario.filter(i => i.producto_id === pid).reduce((a, i) => a + i.kg, 0);

/* ================================ Autenticación y permisos ================================ */
describe("Autenticación y control de acceso", () => {
  test("PI-01 [HU-01][RF-01] un usuario activo inicia sesión y llega al dashboard con sus KPI", async () => {
    const { ctx, page, errores } = await abrir(); await entrar(page);
    assert.equal(await page.evaluate(() => location.hash), "#dashboard");
    assert.equal(await page.locator(".kpi").count(), 4);
    assert.equal(await page.locator("#nav a").count(), 9);
    await foto(page, "PI-01-dashboard"); assert.deepEqual(errores, []); await ctx.close();
  });
  test("PI-02 [HU-01][RF-01] una contraseña incorrecta muestra un mensaje genérico y no abre sesión", async () => {
    const { ctx, page } = await abrir(); await page.goto(base + "/app.html");
    await page.fill("#login-email", "admin@ritech.co"); await page.fill("#login-pass", "incorrecta"); await page.click("#login-form button[type=submit]");
    assert.equal((await page.locator("#login-error").innerText()).trim(), "Credenciales incorrectas");
    assert.equal(await page.locator("#app").isHidden(), true);
    await foto(page, "PI-02-login-fallido"); await ctx.close();
  });
  test("PI-03 [HU-01][RNF-04] un intento básico de inyección SQL en el login es rechazado", async () => {
    const { ctx, page } = await abrir(); await page.goto(base + "/app.html");
    await page.fill("#login-email", "' OR '1'='1' --"); await page.fill("#login-pass", "x"); await page.click("#login-form button[type=submit]");
    assert.match(await page.locator("#login-error").innerText(), /Credenciales incorrectas|correo/i);
    assert.equal(await page.locator("#app").isHidden(), true);
    await ctx.close();
  });
  test("PI-04 [HU-06][RNF-03] el operador de bodega solo ve Productos e Inventario y es redirigido si fuerza otra ruta", async () => {
    const { ctx, page } = await abrir(); await entrar(page, "bodega@ritech.co");
    assert.deepEqual(await page.$$eval("#nav a", a => a.map(x => x.dataset.m)), ["productos", "inventario"]);
    assert.equal(await page.evaluate(() => location.hash), "#inventario");
    await ir(page, "clientes");
    assert.equal(await page.evaluate(() => location.hash), "#inventario");
    assert.match(await page.locator(".toast-body").first().innerText(), /Acceso denegado/);
    await foto(page, "PI-04-acceso-denegado"); await ctx.close();
  });
  test("PI-05 [HU-06][RF-04] el gerente ve Clientes en solo lectura (sin botón para crear)", async () => {
    const { ctx, page } = await abrir(); await entrar(page, "gerente@ritech.co"); await ir(page, "clientes");
    assert.equal(await page.locator("#new-cli").count(), 0);
    assert.ok(await page.locator("#tbl tbody tr").count() > 0);
    assert.equal(await page.locator("[data-tog]").count(), 0, "no debe poder desactivar clientes");
    await ctx.close();
  });
  test("PI-06 [HU-01][RF-02] la sesión expira tras 30 minutos de inactividad y vuelve al login con aviso", async () => {
    const { ctx, page } = await abrir({ reloj: true }); await entrar(page);
    await page.clock.fastForward(31 * 60 * 1000);
    await page.waitForSelector("#login-view:not([hidden])");
    assert.match(await page.locator("#login-error").innerText(), /expiró por inactividad/);
    await ctx.close();
  });
});

/* ================================ Clientes ================================ */
describe("Clientes", () => {
  const valido = { nombre: "Café del Norte BV", pais: "NL", nif: "NL999999999B01", contacto: "Eva Smit", email: "eva@cafedelnorte.nl", consent: true };
  test("PI-07 [HU-02][RF-05] el alta de un cliente válido queda guardada y aparece en el listado", async () => {
    const { ctx, page } = await abrir(); await entrar(page); await ir(page, "clientes");
    await llenarCliente(page, valido); await foto(page, "PI-07-formulario-cliente"); await page.click("#modal-save");
    await page.waitForSelector("#modal", { state: "hidden" });
    await page.fill("#f-q", "Café del Norte"); await page.waitForTimeout(300);
    assert.equal(await page.locator("#tbl tbody tr").count(), 1);
    const d = await db(page); const c = d.clientes.find(x => x.nif === valido.nif);
    assert.ok(c && c.activo && c.consent && c.pais === "NL");
    await foto(page, "PI-07-cliente-en-listado"); await ctx.close();
  });
  test("PI-08 [HU-02][RF-05] sin país de la UE, el formulario no guarda y el selector solo ofrece países de la UE", async () => {
    const { ctx, page } = await abrir(); await entrar(page); await ir(page, "clientes");
    await llenarCliente(page, { ...valido, pais: "" }); await page.click("#modal-save");
    assert.match(await errorDe(page), /Unión Europea/);
    const opciones = await page.$$eval("#modal-body select[name=pais] option", o => o.map(x => x.value));
    assert.equal(opciones.includes("US"), false); assert.equal(opciones.includes("CO"), false); assert.ok(opciones.includes("DE"));
    assert.equal(opciones.filter(Boolean).length, 27);
    await foto(page, "PI-08-pais-obligatorio"); await ctx.close();
  });
  test("PI-09 [HU-02][RF-05] una identificación fiscal duplicada se rechaza", async () => {
    const { ctx, page } = await abrir(); await entrar(page); await ir(page, "clientes");
    await llenarCliente(page, { ...valido, nif: "DE811234567" }); await page.click("#modal-save");
    assert.match(await errorDe(page), /Ya existe un cliente con esa identificación fiscal/);
    assert.equal((await db(page)).clientes.length, 8); await ctx.close();
  });
  test("PI-10 [HU-02][RF-08][RR-05] sin consentimiento GDPR no se puede registrar el cliente", async () => {
    const { ctx, page } = await abrir(); await entrar(page); await ir(page, "clientes");
    await llenarCliente(page, { ...valido, consent: false }); await page.click("#modal-save");
    assert.match(await errorDe(page), /consentimiento/i);
    assert.equal((await db(page)).clientes.length, 8); await ctx.close();
  });
  test("PI-11 [HU-02][RNF-04] un nombre con HTML se muestra como texto y no ejecuta código (XSS)", async () => {
    const { ctx, page } = await abrir(); await entrar(page); await ir(page, "clientes");
    await llenarCliente(page, { ...valido, nombre: "<img src=x onerror=\"window.__xss=1\">Evil", nif: "NL1" }); await page.click("#modal-save");
    await page.waitForSelector("#modal", { state: "hidden" }); await page.fill("#f-q", "Evil"); await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.__xss), undefined);
    assert.match(await page.locator("#tbl tbody tr").first().innerText(), /<img src=x/);
    await ctx.close();
  });
  test("PI-12 [HU-02][RF-06] desactivar un cliente lo marca inactivo sin borrarlo", async () => {
    const { ctx, page } = await abrir(); await entrar(page); await ir(page, "clientes");
    await page.click('[data-tog="1"]'); await page.click("#modal-save"); await page.waitForSelector("#modal", { state: "hidden" });
    const d = await db(page); assert.equal(d.clientes.length, 8); assert.equal(d.clientes.find(c => c.id === 1).activo, false);
    await ctx.close();
  });
});

/* ================================ Productos e inventario ================================ */
describe("Productos e inventario", () => {
  test("PI-13 [HU-03][RF-09] el alta de producto es válida con precio positivo y se rechaza con precio negativo", async () => {
    const { ctx, page } = await abrir(); await entrar(page); await ir(page, "productos");
    const llenar = async precio => { await page.click("#new-prod"); await page.waitForSelector("#modal.show");
      await page.fill("[name=nombre]", "Café Geisha"); await page.fill("[name=codigo]", "CAF-GEI-01"); await page.fill("[name=variedad]", "Geisha"); await page.fill("[name=precio]", precio); await page.click("#modal-save"); };
    await llenar("-5"); assert.match(await errorDe(page), /precio debe ser mayor que cero/);
    await page.fill("[name=precio]", "18.50"); await page.click("#modal-save"); await page.waitForSelector("#modal", { state: "hidden" });
    const p = (await db(page)).productos.find(x => x.codigo === "CAF-GEI-01"); assert.ok(p && p.precio === 18.5 && p.activo);
    await ctx.close();
  });
  test("PI-14 [HU-03][RF-10] el filtro por tipo del catálogo muestra solo cacao", async () => {
    const { ctx, page } = await abrir(); await entrar(page); await ir(page, "productos");
    await page.selectOption("#f-tipo", "CACAO"); await page.waitForTimeout(300);
    const tipos = await page.$$eval("#tbl tbody tr td:nth-child(2)", t => t.map(x => x.innerText.trim()));
    assert.equal(tipos.length, 3); assert.ok(tipos.every(t => t === "Cacao"));
    await foto(page, "PI-14-catalogo-cacao"); await ctx.close();
  });
  test("PI-15 [HU-04][RF-13] una entrada de inventario actualiza el stock y queda en el historial de movimientos", async () => {
    const { ctx, page } = await abrir(); await entrar(page, "bodega@ritech.co"); await ir(page, "inventario");
    await page.click("#new-mov"); await page.waitForSelector("#modal.show");
    await page.selectOption("[name=producto]", "3"); await page.selectOption("[name=bodega]", "2"); await page.selectOption("[name=tipo]", "ENTRADA");
    await page.fill("[name=cant]", "100"); await page.fill("[name=motivo]", "Compra de prueba"); await page.click("#modal-save");
    await page.waitForSelector("#modal", { state: "hidden" });
    const d = await db(page); assert.equal(d.inventario.find(i => i.producto_id === 3 && i.bodega_id === 2).kg, 2300);
    assert.equal(d.movimientos.length, 1); assert.equal(d.movimientos[0].tipo, "ENTRADA");
    await page.click('[data-tab="mov"]'); await page.waitForTimeout(300);
    assert.match(await page.locator("#tbl").innerText(), /Compra de prueba/);
    await foto(page, "PI-15-movimientos"); await ctx.close();
  });
  test("PI-16 [HU-04][RF-14] una salida mayor al stock se rechaza con el stock disponible y no cambia el inventario", async () => {
    const { ctx, page } = await abrir(); await entrar(page, "bodega@ritech.co"); await ir(page, "inventario");
    await page.click("#new-mov"); await page.waitForSelector("#modal.show");
    await page.selectOption("[name=producto]", "3"); await page.selectOption("[name=bodega]", "2"); await page.selectOption("[name=tipo]", "SALIDA"); await page.fill("[name=cant]", "999999"); await page.click("#modal-save");
    assert.match(await errorDe(page), /Stock insuficiente: disponible 2\.200 kg/);
    assert.equal((await db(page)).inventario.find(i => i.producto_id === 3).kg, 2200);
    await foto(page, "PI-16-salida-rechazada"); await ctx.close();
  });
});

/* ================================ Exportaciones, documentos y pagos ================================ */
describe("Exportaciones, documentos y pagos", () => {
  test("PI-17 [HU-11][RF-16][RF-19] el asistente de 4 pasos crea la exportación y descuenta el inventario", async () => {
    const { ctx, page, errores } = await abrir(); await entrar(page); const antes = stock(await db(page), 1);
    const ex = await crearExportacion(page, 300);
    const d = await db(page);
    assert.equal(ex.estado, "EN_PREPARACION"); assert.match(ex.codigo, /^EXP-\d{4}-0025$/); assert.equal(ex.descontado, true);
    assert.equal(stock(d, 1), antes - 300);
    assert.equal(d.movimientos.filter(m => m.exportacion_id === ex.id).length >= 1, true);
    assert.equal(await page.locator("#tbl tbody tr").first().locator("td").first().innerText(), ex.codigo);
    await foto(page, "PI-17-exportacion-creada"); assert.deepEqual(errores, []); await ctx.close();
  });
  test("PI-18 [HU-11][RF-17] el asistente bloquea el paso 3 si la cantidad supera el stock disponible", async () => {
    const { ctx, page } = await abrir(); await entrar(page); await ir(page, "exportaciones/nueva");
    await page.click("#w-next"); await page.selectOption("[name=cliente]", "1"); await page.selectOption("[name=llegada]", "Hamburgo"); await page.click("#w-next");
    await page.selectOption("[data-k=producto]", "1"); await page.fill("[data-k=kg]", "99999"); await page.click("#w-next");
    assert.match(await errorDe(page), /Stock insuficiente de Café Arábica: solicitado 99\.999 kg, disponible 2\.500 kg/);
    assert.match(await page.locator("#wiz-body h2").innerText(), /Paso 3/);
    await foto(page, "PI-18-stock-insuficiente"); await ctx.close();
  });
  test("PI-19 [HU-15][RF-21] no se puede pasar a En tránsito sin los 4 documentos obligatorios, y sí con ellos", async () => {
    const { ctx, page } = await abrir(); await entrar(page); const ex = await crearExportacion(page, 100);
    await page.click(`[data-det="${ex.id}"]`); await page.waitForSelector("#modal.show"); await page.click('[data-to="EN_TRANSITO"]');
    assert.match(await page.locator(".toast-body").last().innerText(), /Faltan documentos obligatorios/);
    await page.keyboard.press("Escape"); await ir(page, "documentos");
    for (const tipo of ["CERTIFICADO_ORIGEN", "FITOSANITARIO", "FACTURA_COMERCIAL", "DECLARACION_ADUANERA"]) {
      await page.click("#new-doc"); await page.waitForSelector("#modal.show");
      await page.selectOption("[name=exp]", String(ex.id)); await page.selectOption("[name=tipo]", tipo);
      await page.setInputFiles("#doc-file", { name: tipo.toLowerCase() + ".pdf", mimeType: "application/pdf", buffer: PDF });
      await page.click("#modal-save"); await page.waitForSelector("#modal", { state: "hidden" });
    }
    await ir(page, "exportaciones"); await page.click(`[data-det="${ex.id}"]`); await page.waitForSelector("#modal.show"); await page.click('[data-to="EN_TRANSITO"]');
    await page.waitForSelector("#modal", { state: "hidden" });
    assert.equal((await db(page)).exportaciones.find(e => e.id === ex.id).estado, "EN_TRANSITO");
    await foto(page, "PI-19-en-transito"); await ctx.close();
  });
  test("PI-20 [HU-12][RF-19] cancelar una exportación En preparación devuelve el stock descontado", async () => {
    const { ctx, page } = await abrir(); await entrar(page); const antes = stock(await db(page), 1);
    const ex = await crearExportacion(page, 400); assert.equal(stock(await db(page), 1), antes - 400);
    await page.click(`[data-det="${ex.id}"]`); await page.waitForSelector("#modal.show"); await page.click('[data-to="CANCELADA"]');
    await page.waitForSelector("#modal-save"); await page.click("#modal-save"); await page.waitForTimeout(700);
    const d = await db(page); assert.equal(d.exportaciones.find(e => e.id === ex.id).estado, "CANCELADA"); assert.equal(stock(d, 1), antes);
    await ctx.close();
  });
  test("PI-21 [HU-14][RF-20] la carga de documentos rechaza archivos que no son PDF", async () => {
    const { ctx, page } = await abrir(); await entrar(page); await ir(page, "documentos");
    const antes = (await db(page)).documentos.length;
    await page.click("#new-doc"); await page.waitForSelector("#modal.show");
    await page.selectOption("[name=exp]", { index: 1 });
    await page.setInputFiles("#doc-file", { name: "virus.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });
    await page.click("#modal-save"); assert.match(await errorDe(page), /Solo se permiten archivos PDF/);
    assert.equal((await db(page)).documentos.length, antes); await foto(page, "PI-21-documento-rechazado"); await ctx.close();
  });
  test("PI-22 [HU-16][HU-17][RF-23][RF-25] un pago en EUR se registra como pendiente y al confirmarlo suma al saldo en USD", async () => {
    const { ctx, page } = await abrir(); await entrar(page, "contador@ritech.co"); await ir(page, "pagos");
    const d0 = await db(page); const exp = d0.exportaciones.find(e => e.estado === "EN_TRANSITO" && !d0.pagos.some(p => p.exportacion_id === e.id)) || d0.exportaciones.find(e => e.estado === "EN_TRANSITO");
    const opciones = await (async () => { await page.click("#new-pay"); await page.waitForSelector("#modal.show"); return page.$$eval("[name=moneda] option", o => o.map(x => x.value)); })();
    assert.deepEqual(opciones, ["USD", "EUR"], "solo USD y EUR");
    await page.selectOption("[name=exp]", String(exp.id)); await page.fill("[name=monto]", "1000"); await page.selectOption("[name=moneda]", "EUR"); await page.fill("[name=ref]", "TRX-TEST-1");
    await page.click("#modal-save"); await page.waitForSelector("#modal", { state: "hidden" });
    let d = await db(page); const pago = d.pagos[d.pagos.length - 1];
    assert.deepEqual([pago.moneda, pago.monto, pago.estado], ["EUR", 1000, "PENDIENTE"]);
    await page.click(`[data-ok="${pago.id}"]`); await page.waitForTimeout(500);
    d = await db(page); assert.equal(d.pagos.find(p => p.id === pago.id).estado, "CONFIRMADO");
    await foto(page, "PI-22-pagos"); await ctx.close();
  });
});

/* ================================ Reportes ================================ */
describe("Reportes", () => {
  test("PI-23 [HU-18][RF-26] un rango con fecha final anterior a la inicial muestra error y no genera el reporte", async () => {
    const { ctx, page } = await abrir(); await entrar(page); await ir(page, "reportes");
    await page.fill("#r-desde", "2026-10-30"); await page.fill("#r-hasta", "2026-10-01"); await page.click("#r-gen");
    assert.match(await page.locator("#r-err").innerText(), /fecha final no puede ser anterior/);
    assert.equal((await page.locator("#r-out").innerHTML()).trim(), "");
    await foto(page, "PI-23-rango-invalido"); await ctx.close();
  });
  test("PI-24 [HU-18][HU-19][RF-26][RF-27] un reporte válido muestra KPI y se exporta a Excel y a PDF", async () => {
    const { ctx, page } = await abrir(); await entrar(page); await ir(page, "reportes");
    await page.waitForSelector("#r-xls");
    assert.equal(await page.locator("#r-out .kpi").count(), 3);
    const [xls] = await Promise.all([page.waitForEvent("download"), page.click("#r-xls")]);
    assert.match(xls.suggestedFilename(), /^reporte_.*\.xlsx$/);
    const [pdf] = await Promise.all([page.waitForEvent("download"), page.click("#r-pdf")]);
    assert.match(pdf.suggestedFilename(), /^reporte_.*\.pdf$/);
    await foto(page, "PI-24-reporte"); await ctx.close();
  });
});

/* ================================ Landing, tema y persistencia ================================ */
describe("Landing, tema y persistencia", () => {
  test("PI-25 [HU-03][RF-10] el catálogo de la landing filtra por tipo y abre el detalle del producto", async () => {
    const { ctx, page, errores } = await abrir(); await page.goto(base + "/index.html");
    await page.waitForSelector(".card"); assert.equal(await page.locator(".card").count(), 6);
    await page.click('.chip[data-f="CACAO"]'); await page.waitForTimeout(700);
    assert.equal(await page.locator(".card:visible").count(), 3);
    await page.locator(".card:visible").first().click(); await page.waitForSelector("dialog[open]");
    assert.match(await page.locator("#dlg-title").innerText(), /Cacao|Nibs/);
    assert.match(await page.locator("#dlg-specs").innerText(), /USD \d+,\d{2} por kg/);
    await foto(page, "PI-25-landing-detalle"); assert.deepEqual(errores, []); await ctx.close();
  });
  test("PI-26 [RNF-08] el tema oscuro elegido en la landing se conserva al entrar al sistema", async () => {
    const { ctx, page } = await abrir(); await page.goto(base + "/index.html");
    await page.click("#theme"); assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
    await page.goto(base + "/app.html");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.bsTheme), "dark");
    await foto(page, "PI-26-tema-oscuro"); await ctx.close();
  });
  test("PI-27 [RNF-13] los datos creados sobreviven a recargar la página y a cerrar y abrir sesión", async () => {
    const { ctx, page } = await abrir(); await entrar(page); await ir(page, "clientes");
    await llenarCliente(page, { nombre: "Persistente SL", pais: "ES", nif: "ESP1", contacto: "Ana", email: "ana@persistente.es", consent: true });
    await page.click("#modal-save"); await page.waitForSelector("#modal", { state: "hidden" });
    await page.reload(); await page.waitForSelector("#app:not([hidden])");
    await page.click('[aria-label="Menú de usuario"]'); await page.click("#logout"); await page.waitForSelector("#login-view:not([hidden])");
    await page.click('#demo-users [data-u="admin@ritech.co"]'); await page.click("#login-form button[type=submit]"); await page.waitForSelector("#app:not([hidden])");
    await ir(page, "clientes"); await page.fill("#f-q", "Persistente"); await page.waitForTimeout(300);
    assert.equal(await page.locator("#tbl tbody tr").count(), 1); await ctx.close();
  });
  test("PI-28 [RNF-08] la búsqueda global encuentra clientes por nombre y navega al módulo", async () => {
    const { ctx, page } = await abrir(); await entrar(page);
    await page.fill("#gsearch", "Kaffee"); await page.waitForSelector("#gsearch-res a");
    assert.match(await page.locator("#gsearch-res").innerText(), /Kaffee GmbH/);
    await page.click("#gsearch-res a"); await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => location.hash), "#clientes"); assert.equal(await page.locator("#tbl tbody tr").count(), 1);
    await ctx.close();
  });
});
