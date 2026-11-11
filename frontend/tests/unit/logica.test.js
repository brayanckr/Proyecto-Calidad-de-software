/* Pruebas unitarias de la lógica de negocio del prototipo (data.js y ui.js).
   Ejecutar: node --test tests/unit
   Cada título lleva: ID de prueba, historia de usuario y requerimiento relacionado. */
"use strict";
process.env.TZ = "America/Bogota";   // las reglas de fecha se prueban en la zona horaria del proyecto
const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { crearEntorno } = require("../helpers/cargar");

/* Los objetos creados dentro del contexto aislado (vm) tienen otros prototipos: se copian antes de compararlos con deepEqual. */
const plano = x => JSON.parse(JSON.stringify(x));
let A, ls;
beforeEach(() => { ({ api: A, localStorage: ls } = crearEntorno()); A.Store.load(); });

/* ======================= Datos de demostración (seed) ======================= */
describe("Datos iniciales", () => {
  test("PU-01 [HU-04][RF-12] el inventario inicial suma 12.450 kg en 7 registros", () => {
    assert.equal(A.Store.db.inventario.length, 7);
    assert.equal(A.totalInventario(), 12450);
  });
  test("PU-02 [HU-02][RF-05] 8 clientes (7 activos), todos de la UE y con NIF único", () => {
    const c = A.Store.db.clientes;
    assert.equal(c.length, 8);
    assert.equal(c.filter(x => x.activo).length, 7);
    assert.ok(c.every(x => A.EU[x.pais]), "todos los países deben pertenecer a la UE");
    assert.equal(new Set(c.map(x => x.nif)).size, c.length);
    assert.ok(c.every(x => x.consent), "todos tienen consentimiento GDPR");
  });
  test("PU-03 [HU-03][RF-09] 6 productos con precio > 0 y código único", () => {
    const p = A.Store.db.productos;
    assert.equal(p.length, 6);
    assert.ok(p.every(x => x.precio > 0));
    assert.equal(new Set(p.map(x => x.codigo)).size, 6);
    assert.deepEqual(plano([...new Set(p.map(x => x.tipo))]).sort(), ["CACAO", "CAFE"]);
  });
  test("PU-04 [HU-11][RF-16] 24 exportaciones con id único y código EXP-AAAA-NNNN", () => {
    const e = A.Store.db.exportaciones;
    assert.equal(e.length, 24);
    assert.equal(new Set(e.map(x => x.id)).size, 24);
    assert.ok(e.every(x => /^EXP-\d{4}-\d{4}$/.test(x.codigo)));
  });
  test("PU-05 [HU-15][RF-21] las exportaciones En tránsito o Completadas tienen los documentos obligatorios", () => {
    const e = A.Store.db.exportaciones.filter(x => ["EN_TRANSITO", "ENTREGADA"].includes(x.estado));
    assert.ok(e.length > 0);
    for (const x of e) assert.deepEqual(plano(A.docsFaltantes(x.id)), [], `${x.codigo} tiene faltantes`);
  });
});

/* ======================= Almacenamiento ======================= */
describe("Almacenamiento local (Store)", () => {
  test("PU-06 [RNF-13] load() crea y persiste los datos cuando no hay almacenamiento previo", () => {
    assert.ok(ls.getItem(A.DB_KEY), "debe guardar la base en localStorage");
    assert.ok(JSON.parse(ls.getItem(A.DB_KEY)).clientes.length > 0);
  });
  test("PU-07 [RNF-13] save() y load() conservan los cambios; reset() restaura los datos de demostración", () => {
    A.Store.db.clientes.push({ id: 99, nombre: "Prueba SL", pais: "ES", nif: "ESX1", activo: true });
    A.Store.save();
    const otro = crearEntorno(); otro.localStorage.setItem(A.DB_KEY, ls.getItem(A.DB_KEY));
    assert.equal(otro.api.Store.load().clientes.length, 9);
    A.Store.reset();
    assert.equal(A.Store.db.clientes.length, 8);
  });
  test("PU-08 nextId() incrementa por colección sin mezclar contadores", () => {
    const a = A.Store.nextId("clientes"), b = A.Store.nextId("clientes"), p = A.Store.nextId("productos");
    assert.equal(b, a + 1);
    assert.equal(p, 7);
  });
});

/* ======================= Utilidades de presentación ======================= */
describe("Utilidades de formato", () => {
  test("PU-09 [RNF-04] esc() neutraliza < > & \" ' para evitar XSS", () => {
    assert.equal(A.esc(`<img src=x onerror="alert('x')">&`), "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;");
    assert.equal(A.esc(null), "");
    assert.equal(A.esc(0), "0");
  });
  test("PU-10 [RR-07] nf(), usd() y kg() formatean en es-CO", () => {
    assert.equal(A.nf(12450), "12.450");
    assert.equal(A.usd(4.5), "$ 4,50");
    assert.equal(A.kg(1200), "1.200 kg");
  });
  test("PU-11 fdate() convierte AAAA-MM-DD a DD/MM/AAAA y tolera vacíos", () => {
    assert.equal(A.fdate("2026-11-10"), "10/11/2026");
    assert.equal(A.fdate("2026-11-10T08:00:00Z"), "10/11/2026");
    assert.equal(A.fdate(""), "-");
    assert.equal(A.fdate(null), "-");
  });
  test("PU-12 paginate() calcula páginas, rangos y limita la página fuera de rango", () => {
    const items = Array.from({ length: 14 }, (_, i) => i);
    const p2 = A.paginate(items, 2, 6);
    assert.deepEqual([p2.pages, p2.from, p2.to, p2.rows.length], [3, 7, 12, 6]);
    assert.equal(A.paginate(items, 99, 6).page, 3);
    assert.equal(A.paginate(items, -4, 6).page, 1);
    const vacio = A.paginate([], 1, 6);
    assert.deepEqual([vacio.total, vacio.from, vacio.to, vacio.pages], [0, 0, 0, 1]);
  });
});

/* ======================= Cálculos del negocio ======================= */
describe("Cálculos de negocio", () => {
  test("PU-13 [RF-23][RR-07] aUSD() convierte EUR con la tasa configurada y no altera USD", () => {
    A.Store.db.meta.tasaEurUsd = 1.1;
    assert.equal(A.aUSD(100, "USD"), 100);
    assert.ok(Math.abs(A.aUSD(100, "EUR") - 110) < 1e-9);
  });
  test("PU-14 [HU-11][RF-17] totalExp() y kgExp() suman todas las líneas", () => {
    const ex = { lineas: [{ kg: 100, precio: 4.5 }, { kg: 50, precio: 8 }] };
    assert.equal(A.totalExp(ex), 850);
    assert.equal(A.kgExp(ex), 150);
  });
  test("PU-15 [HU-04][RF-12] stockProducto() suma las bodegas del producto", () => {
    assert.equal(A.stockProducto(1), 2500);   // Café Arábica: 1.500 + 1.000
    assert.equal(A.stockProducto(999), 0);
  });
  test("PU-16 [HU-15][RF-21] docsFaltantes() lista los obligatorios sin cargar e ignora los rechazados", () => {
    const d = A.Store.db; d.documentos = [];
    assert.equal(A.docsFaltantes(1).length, 4);
    d.documentos.push({ id: 1, exportacion_id: 1, tipo: "CERTIFICADO_ORIGEN", estado: "VALIDADO" },
                      { id: 2, exportacion_id: 1, tipo: "FITOSANITARIO", estado: "RECHAZADO" });
    const f = A.docsFaltantes(1);
    assert.deepEqual(plano(f).sort(), ["DECLARACION_ADUANERA", "FACTURA_COMERCIAL", "FITOSANITARIO"]);
  });
  test("PU-17 [HU-17][RF-24] pagadoExp() cuenta solo pagos confirmados salvo que se pida lo contrario", () => {
    const d = A.Store.db; d.pagos = [
      { exportacion_id: 7, monto: 100, moneda: "USD", estado: "CONFIRMADO" },
      { exportacion_id: 7, monto: 50, moneda: "USD", estado: "PENDIENTE" },
      { exportacion_id: 7, monto: 10, moneda: "USD", estado: "RECHAZADO" }];
    assert.equal(A.pagadoExp(7), 100);
    assert.equal(A.pagadoExp(7, false), 160);
  });
  test("PU-18 [HU-09][RF-15] alertasStock() detecta productos bajo el mínimo y no los demás", () => {
    const d = A.Store.db;
    d.inventario.forEach(i => { i.min = 0; });
    d.inventario.find(i => i.producto_id === 5).min = 900;   // Cacao en polvo: stock 800 < 900
    const a = A.alertasStock();
    assert.equal(a.length, 1);
    assert.equal(a[0].p.id, 5);
    assert.equal(a[0].stock, 800);
  });
});

/* ======================= Movimientos de inventario ======================= */
describe("Movimientos de inventario", () => {
  const inv = () => A.Store.db.inventario.find(i => i.producto_id === 3);   // Café Castillo, 2.200 kg
  test("PU-19 [HU-04][RF-13] una ENTRADA suma al stock y registra el movimiento", () => {
    A.moverInventario({ inv_id: inv().id, tipo: "ENTRADA", kg: 50, motivo: "Compra", usuario: "Test" });
    assert.equal(inv().kg, 2250);
    const m = A.Store.db.movimientos[0];
    assert.deepEqual([m.tipo, m.kg, m.usuario], ["ENTRADA", 50, "Test"]);
  });
  test("PU-20 [HU-04][RF-13] una SALIDA descuenta del stock", () => {
    A.moverInventario({ inv_id: inv().id, tipo: "SALIDA", kg: 200, usuario: "Test" });
    assert.equal(inv().kg, 2000);
  });
  test("PU-21 [HU-04][RF-14] una SALIDA mayor al stock se rechaza y el stock no cambia", () => {
    assert.throws(() => A.moverInventario({ inv_id: inv().id, tipo: "SALIDA", kg: 5000, usuario: "Test" }), /Stock insuficiente: disponible 2\.200 kg/);
    assert.equal(inv().kg, 2200);
    assert.equal(A.Store.db.movimientos.length, 0);
  });
  test("PU-22 [HU-04][RF-13] cantidades 0, negativas o no numéricas se rechazan", () => {
    for (const kg of [0, -5, NaN, undefined]) assert.throws(() => A.moverInventario({ inv_id: inv().id, tipo: "ENTRADA", kg, usuario: "Test" }), /mayor que cero/);
    assert.equal(inv().kg, 2200);
  });
  test("PU-23 [HU-04][RF-13] un AJUSTE fija el stock al valor indicado", () => {
    A.moverInventario({ inv_id: inv().id, tipo: "AJUSTE", kg: 1800, motivo: "Conteo físico", usuario: "Test" });
    assert.equal(inv().kg, 1800);
  });
});

/* ======================= Descuento de stock por exportación ======================= */
describe("Descuento de stock (RF-19)", () => {
  const crear = (kg) => ({ id: 500, codigo: "EXP-2026-0500", lineas: [{ producto_id: 1, kg, precio: 4.5 }], descontado: false });
  test("PU-24 [HU-11][RF-19] descontarStock() reparte entre bodegas (la de mayor stock primero) y marca descontado", () => {
    const ex = crear(1800);   // Café Arábica: 1.500 en bodega 1 y 1.000 en bodega 2
    A.descontarStock(ex, "Test");
    assert.equal(A.stockProducto(1), 700);
    assert.equal(ex.descontado, true);
    assert.equal(A.Store.db.movimientos.filter(m => m.exportacion_id === 500).length, 2);
  });
  test("PU-25 [HU-11][RF-19] con stock insuficiente lanza error y NO descuenta nada (operación atómica)", () => {
    const ex = crear(3000);   // solo hay 2.500 kg
    const antes = A.stockProducto(1);
    assert.throws(() => A.descontarStock(ex, "Test"), /Stock insuficiente/);
    assert.equal(A.stockProducto(1), antes, "el stock no debe cambiar si falla");
    assert.equal(ex.descontado, false);
    assert.equal(A.Store.db.movimientos.length, 0);
  });
  test("PU-26 [HU-12][RF-19] devolverStock() restituye lo descontado y desmarca la exportación", () => {
    const ex = crear(1800); A.descontarStock(ex, "Test");
    A.devolverStock(ex, "Test");
    assert.equal(A.stockProducto(1), 2500);
    assert.equal(ex.descontado, false);
  });
});

/* ======================= Fechas, permisos y catálogo ======================= */
describe("Fechas, permisos y catálogo", () => {
  test("PU-27 [HU-11][RF-18] todayISO() devuelve la fecha LOCAL (Colombia) aunque en UTC ya sea el día siguiente", () => {
    // 10-nov-2026 23:30 en Colombia (UTC-5) = 11-nov-2026 04:30 UTC
    const e = crearEntorno({ ahora: "2026-11-11T04:30:00Z" });
    assert.equal(e.api.todayISO(), "2026-11-10");
  });
  test("PU-28 [HU-06][RF-04] la matriz de permisos respeta los roles", () => {
    const P = A.PERMISOS;
    assert.ok(A.MODULOS.every(m => P.ADMIN[m.id] === "w"), "ADMIN escribe en todo");
    assert.equal(P.OP_BODEGA.clientes, undefined);
    assert.equal(P.OP_BODEGA.inventario, "w");
    assert.equal(P.GERENTE.clientes, "r");
    assert.equal(P.GERENTE.reportes, "w");
    assert.equal(P.CONTADOR.pagos, "w");
    assert.equal(P.CONTADOR.config, undefined);
    for (const rol of Object.keys(A.ROLES)) assert.ok(P[rol][A.HOME[rol]], `la pantalla inicial de ${rol} debe ser accesible`);
  });
  test("PU-29 [HU-14][RR-06] los documentos obligatorios pertenecen a los tipos de documento válidos", () => {
    assert.ok(A.DOCS_OBLIGATORIOS.every(t => A.TIPOS_DOC[t]));
    assert.equal(A.DOCS_OBLIGATORIOS.length, 4);
    assert.deepEqual(plano(Object.keys(A.ESTADOS_EXP)).sort(), ["BORRADOR", "CANCELADA", "ENTREGADA", "EN_PREPARACION", "EN_TRANSITO"]);
  });
  test("PU-30 [HU-03][RF-10] fotoProducto() usa la foto por código y una de respaldo por tipo", () => {
    assert.match(A.fotoProducto({ codigo: "CAF-ARA-01", tipo: "CAFE" }, 300), /photo-1447933601403-0c6688de566e.*w=300/);
    assert.match(A.fotoProducto({ codigo: "NUEVO-01", tipo: "CACAO" }), /photo-1545567724-9b16e57c906d.*w=600/);
  });
});
