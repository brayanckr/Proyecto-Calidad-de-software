# CoffeeExport Manager – Frontend (prototipo)

Interfaz web de RITECH SAS con las 9 pantallas del mockup: Login, Dashboard, Clientes, Productos, Inventario,
Exportaciones (asistente de 4 pasos), Documentos, Pagos, Reportes (PDF/Excel) y Configuración.

**Stack:** HTML5, CSS3, JavaScript y Bootstrap 5 (CDN). Gráficas con Chart.js; PDF con jsPDF; Excel con SheetJS.

## Cómo ejecutarlo
**Landing pública:** `index.html` (catálogo, proceso, cifras y normativa). **Sistema:** `app.html` (botón "Acceder al sistema").
Abra `index.html` en el navegador (requiere internet para cargar las librerías por CDN), o sirva la carpeta:

    python -m http.server 8000     # y abra http://localhost:8000

## Cuentas de demostración (contraseña `Demo2026*`)
| Rol | Usuario |
|---|---|
| Administrador | admin@ritech.co |
| Gerente / Ejecutivo | gerente@ritech.co |
| Operador de exportaciones | exportaciones@ritech.co |
| Operador de bodega | bodega@ritech.co |
| Contador / Finanzas | contador@ritech.co |

## Alcance y limitaciones
- Es un **prototipo de interfaz**: los datos viven en `localStorage` (botón *Restablecer datos demo* en Configuración).
- Las reglas de negocio (RF del Sprint 2) están simuladas en el cliente: validación de stock, país UE, documentos
  obligatorios, monedas USD/EUR, sesión de 30 min, permisos por rol.
- En producción la autenticación (BCrypt), la autorización por rol y la persistencia las hará el backend
  Spring Boot + MySQL (RNF-01 a RNF-04); las contraseñas de demostración nunca deben usarse en producción.
- Estructura: `js/data.js` (datos y almacenamiento), `js/ui.js` (utilidades y reglas), `js/views.js` (pantallas), `js/app.js` (sesión y rutas).

## Landing (rediseño)
- `index.html`, `css/landing.css`, `js/landing.js`. Tipografía Geist autoalojada en `fonts/`. Iconos Phosphor (CDN) en la landing.
- El catálogo lee los mismos productos, precios y stock del sistema (`localStorage`), con filtro por tipo, detalle y estados de carga.
- Movimiento solo con IntersectionObserver, CSS y Web Animations; respeta `prefers-reduced-motion`. Tema claro y oscuro (sigue al sistema, con botón).
- **Fotos temporales de Unsplash** (licencia Unsplash, enlazadas desde images.unsplash.com). Para producción, reemplazarlas por fotos propias:
  hero, 6 productos (mapa `FOTO` en `js/landing.js`), proceso, cifras, normativa y cierre.

## Sistema (app.html) con el mismo lenguaje visual
- Paleta Forest, tipografía Geist, tema claro y oscuro compartido con la landing (botón en la barra superior; cambia también las gráficas).
- Entrada animada por vista, KPI que cuentan desde cero, miniaturas con foto en Productos y Login con foto de cafetal. Todo respeta `prefers-reduced-motion`.
- La lógica y los permisos no cambiaron.

## Pruebas automáticas (Sprint 3)
- **Unitarias** (`tests/unit`): 30 pruebas de la lógica de `data.js` y `ui.js` con `node:test`, en un contexto aislado.
- **Integración** (`tests/integration`): 28 pruebas en Chrome real con Playwright (flujos, permisos, validaciones, reportes, landing).
- Ejecutar desde `frontend/` (Node 20+ y Chrome o Edge instalado): `npm install` y luego `npm test`.
  Si Playwright no encuentra su navegador: `PW_CHANNEL=chrome` (o `msedge`).
- Resultados y análisis: `docs/sprint3/CoffeeExport_Manager_Sprint3_Pruebas.docx`. Las capturas se regeneran en `tests/evidence/`.
