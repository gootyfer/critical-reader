# Manual Browser Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una extensión Chrome/Chromium que analiza el artículo actual solo al pulsar su icono, resalta los findings confirmados y explica cada marca dentro de la página.

**Architecture:** Una acción WXT MV3 inyecta bajo demanda un content script registrado en runtime. El content script extrae el artículo y pide el análisis al background; el background es la única pieza que accede a la API local y valida la respuesta. La extracción y la presentación son módulos DOM puros cubiertos con jsdom.

**Tech Stack:** Node.js 24, TypeScript 5.9, WXT 0.21.5, Manifest V3, Vitest 4, jsdom 30.

**Spec:** `docs/superpowers/specs/2026-10-31-manual-browser-extension-design.md`

## Global Constraints

- El análisis comienza únicamente tras un clic explícito en la acción de la extensión.
- Manifest V3 con permisos `activeTab` y `scripting`, sin `<all_urls>`.
- Único host permanente: `http://127.0.0.1:8787/*`.
- API fija para el MVP: `http://127.0.0.1:8787/analyze`.
- Máximo 200 párrafos y 100.000 caracteres conforme a `@critical-reader/contracts`.
- La UI se muestra en español y no sustituye contenido HTML de la página.
- Toda función de comportamiento nueva sigue RED → GREEN → REFACTOR.

## Review Focus

- Páginas sin `article` o `main`: usar `body` sin capturar párrafos invisibles o vacíos; cubierto en Task 1.
- Artículos por encima de los límites: detenerse en un párrafo completo y producir una solicitud válida; cubierto en Task 1.
- Servidor apagado, HTTP erróneo o JSON inválido: devolver un error tipado y seguro; cubierto en Task 2.
- Findings con IDs inexistentes o ejecución repetida: ignorar IDs desconocidos y limpiar marcas anteriores; cubierto en Task 3.
- Interacción sin ratón: abrir explicación con foco/clic y cerrar con Escape; cubierto en Task 3.

---

### Task 1: Scaffold WXT y extracción conservadora del artículo

**Files:**
- Create: `apps/extension/package.json`
- Create: `apps/extension/tsconfig.json`
- Create: `apps/extension/wxt.config.ts`
- Create: `apps/extension/src/article/extract-article.test.ts`
- Create: `apps/extension/src/article/extract-article.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `AnalyzeRequest`, `MAX_PARAGRAPHS` y `MAX_TOTAL_CHARACTERS` de `@critical-reader/contracts`.
- Produces: `extractArticle(document: Document): ExtractedArticle | null`, donde `ExtractedArticle` contiene `request: AnalyzeRequest` y `elementsByParagraphId: Map<string, HTMLParagraphElement>`.

- [ ] **Step 1: Crear el paquete WXT mínimo y configurar Vitest con jsdom.**

Añadir scripts `dev`, `build`, `test` y `typecheck`; configurar manifest con acción sin popup, `activeTab`, `scripting` y el host local. Añadir scripts raíz `dev:extension` y `build:extension`.

- [ ] **Step 2: Escribir pruebas fallidas de `extractArticle`.**

Cubrir prioridad `article > main > body`, título/subtítulo, filtrado de texto vacío/invisible, IDs `p0…`, mapa DOM, ausencia de párrafos y límites sin cortar un párrafo. La mutación que deben detectar es devolver todos los `<p>` del body sin filtrar ni limitar.

- [ ] **Step 3: Ejecutar la prueba y comprobar RED.**

Run: `pnpm --filter @critical-reader/extension test -- src/article/extract-article.test.ts`

Expected: FAIL porque `extractArticle` todavía no existe.

- [ ] **Step 4: Implementar `extractArticle(document)`.**

Usar texto normalizado, visibilidad basada en `hidden`, `aria-hidden` y estilos computados, y acumulación conservadora hasta los límites del contrato.

- [ ] **Step 5: Comprobar GREEN, typecheck y build.**

Run: `pnpm --filter @critical-reader/extension test && pnpm --filter @critical-reader/extension typecheck && pnpm --filter @critical-reader/extension build`

Expected: tests PASS, TypeScript sin errores y salida WXT MV3 generada.

- [ ] **Step 6: Commit.**

```bash
git add package.json pnpm-lock.yaml apps/extension
git commit -m "feat: extract articles in browser extension"
```

### Task 2: Cliente de análisis y coordinación del background

**Files:**
- Create: `apps/extension/src/analysis/request-analysis.test.ts`
- Create: `apps/extension/src/analysis/request-analysis.ts`
- Create: `apps/extension/src/messages.ts`
- Create: `apps/extension/entrypoints/background.ts`

**Interfaces:**
- Consumes: `AnalyzeRequest` y `AnalyzeResponseSchema`.
- Produces: `requestAnalysis(fetchFn: typeof fetch, input: AnalyzeRequest): Promise<AnalyzeResponse>`; mensajes `AnalyzeArticleMessage` y `AnalyzeArticleResult`; acción que inyecta `content-scripts/analyze.js`.

- [ ] **Step 1: Escribir pruebas fallidas del cliente HTTP.**

Comprobar POST literal al endpoint, cabecera JSON, respuesta válida, HTTP no exitoso, fallo de red y JSON que incumple el contrato. La mutación que deben detectar es devolver `response.json()` sin validarlo.

- [ ] **Step 2: Ejecutar la prueba y comprobar RED.**

Run: `pnpm --filter @critical-reader/extension test -- src/analysis/request-analysis.test.ts`

Expected: FAIL porque `requestAnalysis` todavía no existe.

- [ ] **Step 3: Implementar `requestAnalysis` y los tipos de mensaje.**

Usar un error propio con mensajes internos estables, sin copiar cuerpos remotos a la UI.

- [ ] **Step 4: Comprobar GREEN.**

Run: `pnpm --filter @critical-reader/extension test -- src/analysis/request-analysis.test.ts`

Expected: PASS.

- [ ] **Step 5: Añadir el background WXT como wiring mínimo.**

Dentro de `defineBackground`, registrar `runtime.onMessage` para `ANALYZE_ARTICLE` y `action.onClicked` para inyectar el content script runtime. Convertir excepciones en `{ ok: false, error: "analysis_failed" }`; marcar páginas no inyectables con badge `!` temporal.

- [ ] **Step 6: Ejecutar suite, typecheck y build.**

Run: `pnpm --filter @critical-reader/extension test && pnpm --filter @critical-reader/extension typecheck && pnpm --filter @critical-reader/extension build`

Expected: todo PASS.

- [ ] **Step 7: Commit.**

```bash
git add apps/extension
git commit -m "feat: connect extension to local analyzer"
```

### Task 3: Resaltados, popover accesible y content script

**Files:**
- Create: `apps/extension/src/ui/reader-ui.test.ts`
- Create: `apps/extension/src/ui/reader-ui.ts`
- Create: `apps/extension/entrypoints/analyze.content.ts`

**Interfaces:**
- Consumes: `ExtractedArticle`, `AnalyzeResponse` y `AnalyzeArticleResult`.
- Produces: `createReaderUi(document: Document): ReaderUi`, con `showLoading()`, `showError(message)`, `renderFindings(extracted, response)` y `destroy()`.

- [ ] **Step 1: Escribir pruebas fallidas de UI.**

Comprobar resaltado completo, texto del popover, apertura por hover/foco/clic, cierre por Escape/clic fuera, atributos accesibles, ID desconocido ignorado y limpieza de una ejecución anterior. Las mutaciones que deben detectar son reemplazar `textContent`, duplicar el host o renderizar un finding desconocido.

- [ ] **Step 2: Ejecutar la prueba y comprobar RED.**

Run: `pnpm --filter @critical-reader/extension test -- src/ui/reader-ui.test.ts`

Expected: FAIL porque `createReaderUi` todavía no existe.

- [ ] **Step 3: Implementar `createReaderUi`.**

Aplicar el fondo con atributos/clase propios y alojar toast/popover en Shadow DOM. Las etiquetas de categorías y mecanismos son traducciones de presentación, no parte del contrato remoto.

- [ ] **Step 4: Comprobar GREEN.**

Run: `pnpm --filter @critical-reader/extension test -- src/ui/reader-ui.test.ts`

Expected: PASS.

- [ ] **Step 5: Implementar el content script runtime.**

En cada inyección: destruir UI previa, crear UI, extraer, mostrar carga, enviar `ANALYZE_ARTICLE`, y renderizar findings o un mensaje en español. Guardar la instancia previa en una clave Symbol de `globalThis` para soportar reinyección.

- [ ] **Step 6: Ejecutar suite, typecheck y build.**

Run: `pnpm test && pnpm typecheck && pnpm build:extension`

Expected: todas las suites PASS, TypeScript sin errores y build MV3 correcto.

- [ ] **Step 7: Commit.**

```bash
git add apps/extension
git commit -m "feat: highlight confirmed findings in articles"
```

### Task 4: Documentación y prueba local del flujo completo

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: comandos y salida producidos por Tasks 1–3.
- Produces: instrucciones reproducibles para arrancar API, compilar/cargar extensión y probar las tres fixtures.

- [ ] **Step 1: Documentar instalación y uso local.**

Incluir dos terminales, ruta exacta de `.output/chrome-mv3`, carga desempaquetada en `chrome://extensions`, URLs de fixtures y comportamiento esperado.

- [ ] **Step 2: Ejecutar verificación automatizada completa.**

Run: `pnpm test && pnpm typecheck && pnpm build:extension && git diff --check`

Expected: 0 fallos, 0 errores TypeScript, build correcto y diff limpio.

- [ ] **Step 3: Inspeccionar el manifest generado.**

Confirmar `activeTab`, `scripting`, host local, acción sin popup y ausencia de `<all_urls>`.

- [ ] **Step 4: Commit.**

```bash
git add README.md
git commit -m "docs: explain local extension workflow"
```
