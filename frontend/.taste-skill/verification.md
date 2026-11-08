# Verificación de la interfaz

Tipo: aplicación de software, un asistente de IA personal en español.

## Diseño entregado

- Paleta `paper-grey-brass`, tipografía Instrument Sans con DM Mono en los índices,
  fuentes locales con sus licencias OFL, radios `soft` y acción principal `solid`.
- Navegación lateral, editor, sugerencias editables por intención, historial local,
  búsqueda, preferencias de privacidad y vista de conversación.
- La aplicación real sustituye al hero y las secciones de marketing del kit. Sin
  efecto, WebGL, escenas, momentos automáticos ni imágenes de stock.
- No se inventaron nombres de marca, cifras comerciales, precios, direcciones,
  testimonios ni clientes. «Asistente» es una descripción del producto.
- No faltan fotografías ni otros recursos visuales del cliente.

## Código e interacciones

- `npm run check`: PASS, sin errores ni advertencias.
- `npm test`: PASS, 6 pruebas. Cubren sugerencias, envío, salto de línea, historial,
  búsqueda, preferencias, borrado y recuperación de datos de almacenamiento inválidos.
- `npm run build`: PASS, TypeScript y Vite+.
- Los diálogos nativos se sustituyen por una implementación mínima en jsdom; las
  pruebas no constituyen una validación del manejo nativo de foco en todos los navegadores.
- El servidor de desarrollo sirve la aplicación en `http://127.0.0.1:5173/`.
- Los checksums de los 14 archivos originales de FastAPI no cambiaron.

## Revisión visual

Capturas de Chrome sin ventana, mediante `shoot.mjs` del kit, revisadas en:

| Tamaño | Resultado |
| --- | --- |
| 1440 × 900 | Pantalla de escritorio completa, sin desbordamiento horizontal |
| 1024 × 768 | Corregida la separación del contenido y el pie en pantallas bajas |
| 820 × 1180 | Escritorio compacto con controles completos |
| 768 × 1024 | Corregido el salto de línea de las intenciones |
| 390 × 844 | Editor y sugerencias en una columna; navegación en panel lateral |

Capturas en `shots/`. Se corrigieron los contrastes del contador del historial,
los índices de sugerencias, el atajo de búsqueda, el separador del breadcrumb,
la descripción principal y el texto del pie.

## Checkers de taste-skill

No se modificó ningún archivo del kit para cambiar los resultados.

- `assets/layout/check.mjs` no pudo completar la revisión: la aplicación no tiene
  el contenedor de landing `.wrap`. Produjo una captura de 1440 y se detuvo con
  `Cannot read properties of undefined (reading 'map')`. No se declara aprobado.
- `consistency.mjs`: se ejecutó una pasada completa y una segunda pasada `--quick`
  tras los ajustes. La completa produjo 147 FAIL y 15 WARN, incluidos problemas
  de contraste que se corrigieron. La segunda terminó con 37 FAIL y 7 WARN.
- La revisión final pasó contraste, fuentes, recursos, recortes de texto,
  desbordamiento, solapamiento, distribución de botones y controles, y carga de
  recursos en los cinco tamaños. `--quick` no vuelve a evaluar formularios,
  interacciones de hover ni movimiento; la pasada completa y las pruebas de
  React aportan evidencia complementaria, sin equivaler a un PASS global.

Los FAIL restantes y las advertencias de estructura se consideran no aplicables
al encargo por estas razones:

| Familia | Evaluación |
| --- | --- |
| `hero-screen`, `section-height`, `one-section`, `container-edges` | Exigen hero, footer y secciones de marketing de una o dos pantallas. Esta aplicación tiene cabecera, navegación y un área de conversación dentro de una sola pantalla. |
| `text-only`, `cta` | Buscan una imagen de producto y un CTA comercial; aquí el producto es la propia interfaz y la acción es enviar un mensaje. No se añadió contenido promocional para satisfacerlos. |
| `tilt` | Detecta la rotación de las elipses que forman el símbolo decorativo. Ninguna tarjeta, texto o fila está inclinada. |
| `motion-layer` | Busca un recurso llamado `motion.css`. La hoja original está importada y empaquetada dentro del CSS de Vite; las transiciones de controles están presentes. |
| `off-grid` en la pasada completa | Interpreta como márgenes de landing el padding de controles, avatares e iconos del sidebar. Las capturas muestran una navegación con padding interior consistente. |
| `forms` en la pasada completa | Exige una petición HTTP. El envío es local y muestra explícitamente una respuesta de demostración; no existe aún un servicio de IA. |
| `copy-buttons`, `copy-length` | Sus verbos esperados están en inglés y aplica el presupuesto comercial de 80 palabras a etiquetas de una interfaz en español. |
| `flush` | Señala la cercanía de la nota del editor y el pie de la aplicación. Se revisaron las capturas y se corrigió el solapamiento real en 1024 × 768. |

Informes completos: `consistency-report.txt`, `consistency/report.json`,
`consistency-final.txt`, `consistency-final/report.json` y `layout-report.json`.

## Rendimiento

`perf.mjs`, última ejecución: **PASS, 0 FAIL y 0 WARN**.

- Escritorio: 135,9 KiB transferidos, 2 familias tipográficas, 7 peticiones.
- Móvil: 120,8 KiB transferidos, 5 peticiones.
- CLS 0,000 en ambos tamaños; ninguna petición rota y ningún contexto WebGL.
- Las mediciones son locales en Chrome con renderizado por CPU, no datos de campo.

Datos: `perf-final.json` y `perf-final.txt`. La primera ejecución tuvo dos avisos
por carga de CPU del host; la última se ejecutó con carga baja y quedó limpia.

## Límites funcionales

La interfaz no tiene un modelo de IA ni autenticación conectados. Las respuestas
son texto fijo marcado como vista previa. Las conversaciones se guardan únicamente
en este navegador, salvo que el usuario desactive el guardado. Los adjuntos se
leen localmente; se registran sus nombres, no su contenido persistente. Nada se
envía a FastAPI ni a servicios externos. Las fuentes se sirven desde el proyecto.
