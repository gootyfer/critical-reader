# Critical Reader

Prototipo local de un asistente de lectura crítica para artículos en español.

## Requisitos

- Node.js 24
- pnpm 12 (Corepack usa la versión fijada por el proyecto)

## Puesta en marcha

Instala las dependencias una vez:

```bash
pnpm install
```

Arranca la API en una primera terminal:

```bash
pnpm dev:api
```

El servidor queda disponible en `http://127.0.0.1:8787`.

Compila la extensión en una segunda terminal:

```bash
pnpm build:extension
```

La extensión desempaquetada queda en `apps/extension/.output/chrome-mv3`.

## Cargar la extensión en Chrome o Chromium

1. Abre `chrome://extensions`.
2. Activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida** y selecciona la carpeta `apps/extension/.output/chrome-mv3` de este proyecto.
4. Fija **Critical Reader** en la barra del navegador si quieres tener el icono visible.

La extensión no analiza páginas automáticamente. Abre un artículo y pulsa una vez el icono de Critical Reader. Mientras procesa aparece un aviso dentro de la página; los párrafos confirmados quedan marcados en amarillo. Pasa el ratón, enfoca con el teclado o pulsa el párrafo para consultar la categoría y la explicación.

Después de recompilar, pulsa **Actualizar** en la tarjeta de la extensión dentro de `chrome://extensions`.

## Endpoints locales

- `GET /health`
- `POST /analyze`
- `GET /fixtures/clear-sexism`
- `GET /fixtures/quoted-speech`
- `GET /fixtures/neutral`

El primer hito usa exclusivamente un analizador falso y no necesita claves ni servicios externos.

## Prueba manual del flujo completo

Con la API y la extensión cargadas, abre cada fixture y pulsa el icono:

- `http://127.0.0.1:8787/fixtures/clear-sexism`: destaca únicamente el párrafo «Las mujeres no deberían ocupar puestos técnicos» y muestra su explicación.
- `http://127.0.0.1:8787/fixtures/quoted-speech`: no destaca la cita atribuida.
- `http://127.0.0.1:8787/fixtures/neutral`: no destaca ningún párrafo.

La extensión usa `activeTab`: solo lee la pestaña actual tras el clic. El único acceso de red permanente declarado es `http://127.0.0.1:8787/*`.

## Comprobaciones

```bash
pnpm typecheck
pnpm test
pnpm build:extension
```
