/* CoffeeExport Manager – datos de demostración y almacenamiento local.
   Prototipo de frontend: la persistencia real será MySQL vía API REST (Spring Boot).
   Las credenciales de abajo son SOLO de demostración; el backend usará BCrypt (RNF-01). */
"use strict";

const EU = {DE:"Alemania",NL:"Países Bajos",BE:"Bélgica",FR:"Francia",IT:"Italia",ES:"España",PT:"Portugal",AT:"Austria",IE:"Irlanda",SE:"Suecia",DK:"Dinamarca",FI:"Finlandia",PL:"Polonia",CZ:"Chequia",GR:"Grecia",HU:"Hungría",RO:"Rumanía",BG:"Bulgaria",HR:"Croacia",SK:"Eslovaquia",SI:"Eslovenia",LT:"Lituania",LV:"Letonia",EE:"Estonia",LU:"Luxemburgo",MT:"Malta",CY:"Chipre"};
const PUERTOS_SALIDA = ["Cartagena","Santa Marta","Barranquilla","Buenaventura"];
const PUERTOS_LLEGADA = ["Róterdam","Amberes","Hamburgo","Bremerhaven","Le Havre","Génova","Gioia Tauro","Valencia","Barcelona","Lisboa","Gdansk","Pireo"];
const PUERTO_POR_PAIS = {DE:"Hamburgo",NL:"Róterdam",BE:"Amberes",FR:"Le Havre",IT:"Génova",ES:"Valencia",PT:"Lisboa",PL:"Gdansk",GR:"Pireo"};

const ROLES = {
  ADMIN:{nombre:"Administrador",desc:"Gestiona usuarios, roles y datos maestros. Acceso total."},
  GERENTE:{nombre:"Gerente / Ejecutivo",desc:"Dashboard y reportes; solo lectura en el resto."},
  OP_EXPORTACIONES:{nombre:"Operador de exportaciones",desc:"Clientes, exportaciones y documentación."},
  OP_BODEGA:{nombre:"Operador de bodega",desc:"Consulta y movimientos de inventario."},
  CONTADOR:{nombre:"Contador / Finanzas",desc:"Pagos internacionales y reportes financieros."},
};
/* Matriz de permisos por módulo: r = lectura, w = escritura (RF-04) */
const MODULOS = [
  {id:"dashboard",   label:"Dashboard",     icon:"bi-house-door"},
  {id:"clientes",    label:"Clientes",      icon:"bi-people"},
  {id:"productos",   label:"Productos",     icon:"bi-box-seam"},
  {id:"inventario",  label:"Inventario",    icon:"bi-boxes"},
  {id:"exportaciones",label:"Exportaciones",icon:"bi-truck"},
  {id:"documentos",  label:"Documentos",    icon:"bi-file-earmark-text"},
  {id:"pagos",       label:"Pagos",         icon:"bi-credit-card"},
  {id:"reportes",    label:"Reportes",      icon:"bi-bar-chart-line"},
  {id:"config",      label:"Configuración", icon:"bi-gear"},
];
const PERMISOS = {
  ADMIN:{dashboard:"w",clientes:"w",productos:"w",inventario:"w",exportaciones:"w",documentos:"w",pagos:"w",reportes:"w",config:"w"},
  GERENTE:{dashboard:"r",clientes:"r",productos:"r",inventario:"r",exportaciones:"r",documentos:"r",pagos:"r",reportes:"w"},
  OP_EXPORTACIONES:{clientes:"w",productos:"r",inventario:"r",exportaciones:"w",documentos:"w"},
  OP_BODEGA:{productos:"r",inventario:"w"},
  CONTADOR:{exportaciones:"r",pagos:"w",reportes:"w"},
};
const HOME = {ADMIN:"dashboard",GERENTE:"dashboard",OP_EXPORTACIONES:"exportaciones",OP_BODEGA:"inventario",CONTADOR:"pagos"};

const TIPOS_DOC = {
  CERTIFICADO_ORIGEN:"Certificado de origen", FITOSANITARIO:"Certificado fitosanitario", FACTURA_COMERCIAL:"Factura comercial",
  LISTA_EMPAQUE:"Lista de empaque", DECLARACION_ADUANERA:"Declaración aduanera", OTRO:"Otro",
};
const DOCS_OBLIGATORIOS = ["CERTIFICADO_ORIGEN","FITOSANITARIO","FACTURA_COMERCIAL","DECLARACION_ADUANERA"];
const ESTADOS_EXP = {BORRADOR:["Borrador","st-gray"],EN_PREPARACION:["En preparación","st-orange"],EN_TRANSITO:["En tránsito","st-blue"],ENTREGADA:["Completada","st-green"],CANCELADA:["Cancelada","st-red"]};

const DB_KEY = "cem_db_v1";
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const iso = d => d.toISOString().slice(0, 10);

function seed() {
  const hoy = new Date();
  let s = 7; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const db = {
    meta:{nextId:{}, tasaEurUsd:1.08, empresa:{nombre:"RITECH SAS",nit:"900.123.456-7",direccion:"Cra 45 # 12-34, Bogotá, Colombia",email:"info@ritech.co",telefono:"+57 300 123 4567"},
          notif:{stock:true,docs:true,pagos:true}},
    usuarios:[
      {id:1,nombre:"Administrador RITECH",email:"admin@ritech.co",password:"Demo2026*",rol:"ADMIN",activo:true},
      {id:2,nombre:"Gerente General",email:"gerente@ritech.co",password:"Demo2026*",rol:"GERENTE",activo:true},
      {id:3,nombre:"Operador Exportaciones",email:"exportaciones@ritech.co",password:"Demo2026*",rol:"OP_EXPORTACIONES",activo:true},
      {id:4,nombre:"Operador Bodega",email:"bodega@ritech.co",password:"Demo2026*",rol:"OP_BODEGA",activo:true},
      {id:5,nombre:"Contadora Finanzas",email:"contador@ritech.co",password:"Demo2026*",rol:"CONTADOR",activo:true},
    ],
    clientes:[
      {id:1,nombre:"Kaffee GmbH",pais:"DE",nif:"DE811234567",contacto:"Hans Becker",email:"contacto@kaffeegmbh.de",telefono:"+49 30 123456",direccion:"Friedrichstraße 12, Berlín",consent:true,activo:true},
      {id:2,nombre:"EuroChoco Ltd",pais:"NL",nif:"NL820123456B01",contacto:"Sanne de Vries",email:"info@eurochoco.nl",telefono:"+31 20 987654",direccion:"Keizersgracht 88, Ámsterdam",consent:true,activo:true},
      {id:3,nombre:"Baltic Foods",pais:"BE",nif:"BE0412345678",contacto:"Luc Peeters",email:"sales@balticfoods.be",telefono:"+32 2 123456",direccion:"Rue Neuve 45, Bruselas",consent:true,activo:true},
      {id:4,nombre:"France Agro",pais:"FR",nif:"FR40303265045",contacto:"Camille Laurent",email:"contact@franceagro.fr",telefono:"+33 1 234567",direccion:"Rue de Rivoli 20, París",consent:true,activo:true},
      {id:5,nombre:"Italian Trade",pais:"IT",nif:"IT01234567890",contacto:"Giulia Rossi",email:"info@italiantrade.it",telefono:"+39 02 345678",direccion:"Via Roma 15, Milán",consent:true,activo:true},
      {id:6,nombre:"Iberia Cafés S.L.",pais:"ES",nif:"ESB12345678",contacto:"Carlos Mena",email:"compras@iberiacafes.es",telefono:"+34 91 555 0101",direccion:"Calle Alcalá 120, Madrid",consent:true,activo:true},
      {id:7,nombre:"Nordic Beans AB",pais:"SE",nif:"SE556677889901",contacto:"Elin Karlsson",email:"order@nordicbeans.se",telefono:"+46 8 123 456",direccion:"Drottninggatan 5, Estocolmo",consent:true,activo:true},
      {id:8,nombre:"Lisboa Gourmet",pais:"PT",nif:"PT509876543",contacto:"Rita Santos",email:"geral@lisboagourmet.pt",telefono:"+351 21 123 4567",direccion:"Rua Augusta 100, Lisboa",consent:true,activo:false},
    ],
    productos:[
      {id:1,codigo:"CAF-ARA-01",nombre:"Café Arábica",tipo:"CAFE",variedad:"Caturra",precio:4.50,activo:true},
      {id:2,codigo:"CAF-ROB-01",nombre:"Café Robusta",tipo:"CAFE",variedad:"Robusta estándar",precio:3.20,activo:true},
      {id:3,codigo:"CAF-CAS-01",nombre:"Café Castillo",tipo:"CAFE",variedad:"Castillo",precio:4.85,activo:true},
      {id:4,codigo:"CAC-GRA-01",nombre:"Cacao en grano",tipo:"CACAO",variedad:"Criollo",precio:5.80,activo:true},
      {id:5,codigo:"CAC-POL-01",nombre:"Cacao en polvo",tipo:"CACAO",variedad:"Trinitario",precio:4.10,activo:true},
      {id:6,codigo:"CAC-NIB-01",nombre:"Nibs de cacao",tipo:"CACAO",variedad:"Criollo",precio:6.30,activo:true},
    ],
    bodegas:[{id:1,nombre:"Bodega Cartagena",ciudad:"Cartagena"},{id:2,nombre:"Bodega Bogotá",ciudad:"Bogotá"}],
    inventario:[
      {id:1,producto_id:1,bodega_id:1,kg:1500,min:800},{id:2,producto_id:1,bodega_id:2,kg:1000,min:0},
      {id:3,producto_id:2,bodega_id:1,kg:4000,min:1000},
      {id:4,producto_id:3,bodega_id:2,kg:2200,min:700},
      {id:5,producto_id:4,bodega_id:1,kg:1200,min:1000},
      {id:6,producto_id:5,bodega_id:2,kg:800,min:500},
      {id:7,producto_id:6,bodega_id:1,kg:1750,min:400},
    ],
    movimientos:[], exportaciones:[], documentos:[], pagos:[],
  };
  const nid = k => (db.meta.nextId[k] = (db.meta.nextId[k] || 0) + 1);
  ["usuarios","clientes","productos","bodegas","inventario"].forEach(k => db.meta.nextId[k] = db[k].length);
  const prods = db.productos, cls = db.clientes.filter(c => c.activo);
  const N = 24;
  for (let i = 0; i < N; i++) {
    const cli = cls[Math.floor(rnd() * cls.length)];
    const dias = 85 - Math.round(i * (85 / (N - 1)));                // de hace 85 días a hoy
    const envio = addDays(hoy, -dias + 7);
    let estado = dias > 45 ? "ENTREGADA" : dias > 20 ? (rnd() > .35 ? "ENTREGADA" : "EN_TRANSITO") : dias > 6 ? "EN_TRANSITO" : (rnd() > .5 ? "EN_PREPARACION" : "BORRADOR");
    if (i === 9) estado = "CANCELADA";
    const nl = 1 + Math.floor(rnd() * 2), lineas = [], usados = new Set();
    while (lineas.length < nl) { const p = prods[Math.floor(rnd() * prods.length)]; if (usados.has(p.id)) continue; usados.add(p.id);
      lineas.push({producto_id:p.id, kg:Math.round((200 + rnd() * 1300) / 50) * 50, precio:p.precio}); }
    const id = nid("exportaciones");
    db.exportaciones.push({id, codigo:`EXP-${envio.getFullYear()}-${String(id).padStart(4,"0")}`, cliente_id:cli.id, pais:cli.pais,
      puerto_salida:PUERTOS_SALIDA[Math.floor(rnd() * 2)], puerto_llegada:PUERTO_POR_PAIS[cli.pais] || "Róterdam", fecha_envio:iso(envio), estado,
      creador:3, obs:"", lineas, descontado:["EN_PREPARACION","EN_TRANSITO","ENTREGADA"].includes(estado), creado:iso(addDays(envio, -10))});
    const ex = db.exportaciones[db.exportaciones.length - 1];
    const total = lineas.reduce((a, l) => a + l.kg * l.precio, 0);
    const tiposDoc = estado === "BORRADOR" || estado === "CANCELADA" ? [] : estado === "EN_PREPARACION" ? ["FACTURA_COMERCIAL","LISTA_EMPAQUE"] : [...DOCS_OBLIGATORIOS, "LISTA_EMPAQUE"];
    tiposDoc.forEach(t => db.documentos.push({id:nid("documentos"), exportacion_id:id, tipo:t, archivo:`${t.toLowerCase()}_${ex.codigo}.pdf`, kb:120 + Math.floor(rnd() * 400),
      estado:estado === "EN_PREPARACION" ? "PENDIENTE" : "VALIDADO", fecha:iso(addDays(envio, -4)), por:3}));
    if (estado === "ENTREGADA" || estado === "EN_TRANSITO") {
      const eur = rnd() > .6, f = eur ? 1 / db.meta.tasaEurUsd : 1;
      if (estado === "ENTREGADA") db.pagos.push({id:nid("pagos"), exportacion_id:id, monto:Math.round(total * f * 100) / 100, moneda:eur ? "EUR" : "USD", metodo:"TRANSFERENCIA", ref:`TRX-${100000 + id * 37}`, fecha:iso(addDays(envio, 12)), estado:"CONFIRMADO", por:5});
      else db.pagos.push({id:nid("pagos"), exportacion_id:id, monto:Math.round(total * .5 * f * 100) / 100, moneda:eur ? "EUR" : "USD", metodo:rnd() > .5 ? "CARTA_CREDITO" : "TRANSFERENCIA", ref:`TRX-${100000 + id * 37}`, fecha:iso(addDays(envio, -2)), estado:rnd() > .5 ? "PENDIENTE" : "CONFIRMADO", por:5});
    }
  }
  db.meta.nextId.movimientos = 0;
  return db;
}

const Store = {
  db: null,
  load() { try { const raw = localStorage.getItem(DB_KEY); this.db = raw ? JSON.parse(raw) : null; } catch (e) { this.db = null; }
           if (!this.db) { this.db = seed(); this.save(); } return this.db; },
  save() { try { localStorage.setItem(DB_KEY, JSON.stringify(this.db)); } catch (e) { /* almacenamiento no disponible: se opera en memoria */ } },
  reset() { try { localStorage.removeItem(DB_KEY); } catch (e) {} this.db = seed(); this.save(); },
  nextId(k) { const n = this.db.meta.nextId; n[k] = (n[k] || 0) + 1; return n[k]; },
};
