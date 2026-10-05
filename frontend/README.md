# CoffeeExport Manager – Frontend (prototipo)

Interfaz web de RITECH SAS con las 9 pantallas del mockup: Login, Dashboard, Clientes, Productos, Inventario,
Exportaciones (asistente de 4 pasos), Documentos, Pagos, Reportes (PDF/Excel) y Configuración.

**Stack:** HTML5, CSS3, JavaScript y Bootstrap 5 (CDN). Gráficas con Chart.js; PDF con jsPDF; Excel con SheetJS.

## Cómo ejecutarlo
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
