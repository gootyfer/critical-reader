# Diseño de la extensión manual del navegador

## Intención

Construir la primera extensión utilizable de Critical Reader para que una persona pueda analizar conscientemente el artículo que está leyendo. El análisis comienza únicamente al pulsar el icono de la extensión; los párrafos claramente discriminatorios se resaltan completos y muestran una explicación contextual.

## Objetivos

- Ejecutar el análisis solo tras un clic explícito en el icono.
- Leer título, subtítulo y párrafos del artículo actual sin modificar su contenido textual.
- Enviar el artículo al servidor local `http://127.0.0.1:8787/analyze`.
- Resaltar únicamente los párrafos devueltos por el servidor.
- Mostrar categoría, mecanismo y explicación al pasar el ratón, enfocar o pulsar un párrafo resaltado.
- Informar dentro de la página de los estados de carga, ausencia de artículo y errores del servidor.
- Permitir repetir el análisis sin duplicar resaltados ni elementos de interfaz.

## No objetivos

- Integrar Luna, OpenRouter, caché o persistencia.
- Analizar automáticamente páginas o navegación de aplicaciones SPA.
- Detectar porciones menores que un párrafo.
- Publicar todavía en Chrome Web Store ni soportar Firefox o Safari como plataformas verificadas.
- Extraer con precisión perfecta cualquier diseño periodístico.

## Restricciones y privacidad

- Node.js 24 y TypeScript estricto.
- Manifest V3 para Chrome/Chromium.
- Permisos `activeTab` y `scripting`; no se solicita acceso permanente a todas las páginas.
- El único permiso de host permanente es `http://127.0.0.1:8787/*` para el servidor local.
- El contenido se lee e inyecta solo después del gesto explícito del usuario.
- Las páginas internas del navegador y otras páginas no inyectables deben fallar de forma visible mediante el badge/título de la extensión, sin romper el service worker.

## Enfoques considerados

1. **Inyección bajo demanda al pulsar el icono — elegido.** Minimiza permisos y no ejecuta código en páginas no analizadas. Requiere coordinar background y content script.
2. **Popup con botón de análisis.** Facilita mostrar estados, pero añade un segundo clic y el popup puede cerrarse durante el proceso.
3. **Content script permanente en todas las páginas.** Simplifica la mensajería, pero solicita permisos excesivos y ejecuta código aunque la persona no analice la página.

## Arquitectura

### Acción y permisos

WXT genera una extensión MV3 sin popup. El background escucha `browser.action.onClicked` e inyecta `content-scripts/analyze.js` en la pestaña activa mediante `browser.scripting.executeScript`. WXT registra ese content script como `runtime`, por lo que no aparece en `matches` ni se carga automáticamente.

### Extracción

El content script elige `article`, después `main` y finalmente `body` como raíz. Toma el primer `h1` visible como título, un subtítulo semántico cercano si existe y los elementos `p` visibles, no vacíos y con texto significativo. Asigna IDs estables para esa ejecución (`p0`, `p1`, …), conserva un mapa entre ID y elemento, limita la solicitud a 200 párrafos y no supera 100.000 caracteres.

Si no encuentra párrafos analizables, no llama al servidor y muestra un aviso local.

### Comunicación y análisis

El content script envía al background un mensaje tipado con `AnalyzeRequest`. El background realiza el `fetch`, exige una respuesta HTTP correcta y valida el JSON con `AnalyzeResponseSchema`. Devuelve al content script un resultado discriminado de éxito o error; no expone al DOM detalles internos del error.

### Presentación

Antes de analizar se eliminan marcas creadas por una ejecución anterior. Los párrafos confirmados reciben una marca de fondo amarilla de baja opacidad y atributos accesibles, sin reemplazar nodos ni HTML.

El estado y el popover viven en un contenedor con Shadow DOM para evitar colisiones CSS. El popover muestra etiquetas en español para categoría y mecanismo, más la explicación del servidor. Se abre con `mouseenter`, `focus` o clic; se cierra con `mouseleave`, pérdida de foco, Escape o clic fuera. El clic permite usarlo en dispositivos sin hover.

### Fallos

- Página no inyectable: badge `!` temporal y título explicativo.
- Artículo sin párrafos: aviso dentro de la página.
- Servidor apagado, HTTP no exitoso o JSON inválido: aviso genérico con indicación de arrancar la API local.
- Respuesta con ID desconocido: se ignora ese finding en la UI; el servidor ya protege esta frontera, pero la página nunca debe fallar por ello.
- Segundo clic: limpia la ejecución anterior y vuelve a analizar el DOM actual.

## Pruebas

- Vitest + jsdom para extracción, límites y filtrado de DOM.
- Vitest para el cliente HTTP y validación de respuestas.
- Vitest + jsdom para resaltados, popover, accesibilidad, limpieza y IDs desconocidos.
- Typecheck y build WXT como puertas de integración.
- Prueba manual final contra las tres fixtures del servidor local en Chrome/Chromium.
