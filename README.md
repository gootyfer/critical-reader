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

Compila la extensión local en una segunda terminal:

```bash
pnpm --filter @critical-reader/extension exec wxt build --mode development
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

Por defecto se usa el analizador falso y no se necesitan claves ni servicios externos. Para activar el prototipo real, copia el ejemplo de configuración:

```bash
cp apps/api/.env.example apps/api/.env
```

Edita únicamente `apps/api/.env`:

```dotenv
ANALYZER=openai
OPENAI_API_KEY=tu_clave_local
OPENAI_MODEL=gpt-6-luna
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_REASONING_EFFORT=low
OPENAI_TIMEOUT_MS=30000
```

`apps/api/.env` está ignorado por Git. La clave se queda en la API local y nunca se incluye en la extensión, sus respuestas o el corpus de evaluación. Con `ANALYZER=openai`, el título, subtítulo y texto completo del artículo se envían a OpenAI en una sola petición; no uses esta configuración con contenido que no debas compartir con ese proveedor.

La petición usa `store: false`, pero esto no equivale por sí solo a Zero Data Retention. El endpoint inicial es global. `OPENAI_BASE_URL` permite configurar `https://eu.api.openai.com/v1` más adelante, cuando el proyecto y el modelo sean elegibles para los controles y residencia de datos europeos correspondientes.

El dominio depende de un puerto neutral de proveedor. Una futura integración con OpenRouter podrá sustituir el adaptador OpenAI sin modificar la extensión, las rutas, el prompt ni los evals.

Si `ANALYZER=openai` no tiene una clave o contiene configuración inválida, la API falla al arrancar; no vuelve silenciosamente al analizador falso.

Las variables ya exportadas por la terminal tienen prioridad sobre `apps/api/.env`. Si una petición devuelve `credit_balance_exhausted` aunque el proyecto tenga saldo, comprueba si existe una clave global antigua sin mostrar su valor:

```bash
node -e 'console.log(process.env.OPENAI_API_KEY ? "global key present" : "no global key")'
```

Para la sesión actual, elimínala con `unset OPENAI_API_KEY`. Si vuelve al abrir una terminal, retira la línea `export OPENAI_API_KEY=...` de `~/.zprofile`, `~/.zshrc` o el archivo de inicio donde esté definida. Conserva la clave de este proyecto únicamente en `apps/api/.env`.

## Evaluación del modelo

El corpus híbrido versionado contiene doce casos sintéticos —seis positivos claros y seis negativos— y cuatro fragmentos breves procedentes de artículos reales, con su medio y URL de origen. Los casos reales cubren sexismo, xenofobia, homofobia y un control negativo de discurso atribuido. Las webs no se descargan durante la evaluación. El eval no forma parte de `pnpm test` y solo se ejecuta manualmente con la configuración OpenAI activa:

```bash
pnpm eval:openai
```

La aceptación exige cero falsos positivos en los siete negativos, detectar al menos ocho de los nueve positivos y completar los dieciséis casos dentro del timeout. El comando solo imprime identificadores, conteos, métricas y latencias; no muestra el texto de los artículos ni la clave.

## Prueba manual del flujo completo

Con la API y la extensión cargadas, abre cada fixture y pulsa el icono:

- `http://127.0.0.1:8787/fixtures/clear-sexism`: destaca únicamente el párrafo «Las mujeres no deberían ocupar puestos técnicos» y muestra su explicación.
- `http://127.0.0.1:8787/fixtures/quoted-speech`: no destaca la cita atribuida.
- `http://127.0.0.1:8787/fixtures/neutral`: no destaca ningún párrafo.

La extensión usa `activeTab`: solo lee la pestaña actual tras el clic. El único acceso de red permanente declarado es `http://127.0.0.1:8787/*`.

## Beta alojada

La API puede desplegarse en Vercel y la extensión puede compilarse contra su dominio HTTPS sin cambiar el contrato entre ambas. La configuración operativa, las variables separadas para Preview y Production, el rate limit y el procedimiento de rollback están en [la guía de despliegue de la beta](docs/deployment/vercel-beta.md).

Para generar la extensión de producción:

```bash
WXT_API_BASE_URL=https://critical-reader.vercel.app pnpm --filter @critical-reader/extension build
```

Un build de producción sin `WXT_API_BASE_URL` falla deliberadamente para impedir que se distribuya una extensión que apunte por accidente a localhost. Para desarrollo usa siempre el comando con `--mode development` mostrado al principio.

La beta envía a la API el título, subtítulo y texto completo del artículo y la API los remite a OpenAI para analizarlos. No ofrece Zero Data Retention; este tratamiento se explica antes del primer uso y en las páginas públicas de privacidad y términos.

## Comprobaciones

```bash
pnpm typecheck
pnpm test
pnpm --filter @critical-reader/extension exec wxt build --mode development
```
