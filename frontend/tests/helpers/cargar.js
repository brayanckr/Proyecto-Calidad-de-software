/* Carga data.js y ui.js (scripts de navegador) en un contexto aislado de Node,
   con un localStorage simulado, para probar la lógica sin abrir el navegador. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const JS = path.join(__dirname, "..", "..", "js");

function crearEntorno({ ahora = null } = {}) {
  const memoria = new Map();
  const localStorage = {
    getItem: k => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => memoria.set(k, String(v)),
    removeItem: k => memoria.delete(k),
    _memoria: memoria,
  };
  const RealDate = Date;
  // Reloj controlado: permite probar reglas de fecha sin depender del día en que se ejecuta.
  class FechaFija extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(ahora); }
    static now() { return new RealDate(ahora).getTime(); }
  }
  const contexto = vm.createContext({
    localStorage, console, Intl, Math, JSON, Object, Array, Map, Set, String, Number, parseFloat, parseInt, isNaN, Error,
    Date: ahora ? FechaFija : RealDate, performance: { now: () => 0 },
    matchMedia: () => ({ matches: true }), requestAnimationFrame: () => 0,
    document: { documentElement: { dataset: {} }, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null },
    bootstrap: {}, Chart: undefined,
  });
  const codigo = ["data.js", "ui.js"].map(f => fs.readFileSync(path.join(JS, f), "utf8")).join("\n") + `
;globalThis.API = {Store, seed, EU, ROLES, MODULOS, PERMISOS, HOME, TIPOS_DOC, DOCS_OBLIGATORIOS, ESTADOS_EXP, DB_KEY, FOTO_PRODUCTO, fotoProducto,
  esc, nf, usd, kg, fdate, todayISO, byId, paginate, aUSD, totalExp, kgExp, stockProducto, totalInventario, docsFaltantes, pagadoExp, alertasStock,
  moverInventario, descontarStock, devolverStock};`;
  vm.runInContext(codigo, contexto, { filename: "data+ui.js" });
  return { api: contexto.API, localStorage };
}

module.exports = { crearEntorno };
