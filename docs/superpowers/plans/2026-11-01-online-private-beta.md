# Critical Reader: Online Private Beta Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task. Use `superpowers:test-driven-development` for every behavior change and `superpowers:verification-before-completion` before claiming completion.

**Goal:** Publish a shareable, unlisted Chrome Web Store beta backed by a Vercel-hosted API, with explicit consent, basic abuse controls, public privacy/terms pages, and stronger protection against false positives caused by attributed speech.

**Architecture:** Keep the existing TypeScript monorepo, Fastify API, Chrome extension, and direct OpenAI analyzer abstraction. Deploy the API as one Fastify Vercel Function in Frankfurt, keep inference on the global OpenAI endpoint with `store: false`, and make the extension API endpoint build-time configurable. The beta remains intentionally stateless: no database, cache, user accounts, analytics, or OpenRouter.

**Tech Stack:** Node.js 24, pnpm 12, TypeScript, Fastify, WXT/Manifest V3, Vitest, OpenAI Responses API, Vercel, Chrome Web Store.

---

## Global constraints

- [ ] Work on a `codex/online-private-beta` branch or an isolated worktree; do not implement directly on `main`.
- [ ] Preserve the analyzer-provider boundary so OpenRouter can replace direct OpenAI later without changing routes or the extension.
- [ ] Keep `gpt-6-luna` with low reasoning for this milestone.
- [ ] Keep `store: false`; do not claim ZDR. Public text must disclose that OpenAI may retain abuse-monitoring data for up to 30 days.
- [ ] Do not persist or log article text, article URLs, titles, subtitles, findings, or explanations.
- [ ] Do not add a database, KV cache, authentication, telemetry, cookies, analytics, or third-party page assets.
- [ ] Use HTTPS for every production request. Plain HTTP is permitted only for `127.0.0.1` local development.
- [ ] Make all production-only protections fail closed: missing allowlist, client version, or API URL must prevent startup/build rather than silently weakening policy.
- [ ] Use red-green-refactor for each behavior and commit after each task passes its scoped verification.
- [ ] Never put API keys, Vercel tokens, or OpenAI project identifiers in committed files, fixtures, logs, screenshots, or the extension archive.

## Review focus

Reviewers should explicitly verify these failure modes:

1. A missing, spoofed, or unsupported extension origin/version is rejected before the analyzer is called.
2. Declined or stale consent causes no extraction and no network request.
3. Malformed or oversized requests return a controlled 4xx response without calling OpenAI.
4. Repeated clicks or concurrent content-script execution create at most one active analysis per page.
5. A production or preview misconfiguration cannot accidentally expose a permissive API or consume the production OpenAI key.

---

### Task 1: Lock the attributed-speech regression into the evaluation suite

**Files:**

- Modify: `apps/api/src/evals/openai-cases.test.ts`
- Modify: `apps/api/src/evals/openai-cases.ts`
- Modify: `apps/api/src/evals/evaluate-cases.test.ts`
- Modify: `apps/api/src/analyzers/model/prompt.test.ts`
- Modify: `apps/api/src/analyzers/model/prompt.ts`

- [ ] **Step 1: Write failing corpus-shape tests**

  Update `openai-cases.test.ts` to require 21 unique cases: 13 synthetic and 8 real. Require the new synthetic case ID `negative_indirect_attribution` and four real negative cases whose expected result is `findings: []`.

- [ ] **Step 2: Add the exact reported false-positive regression**

  Include this paragraph verbatim as the analyzed paragraph in the elDiario.es Aragón case, with the full article context retained in the case input:

  ```text
  La posición de Vox se ha traducido ya en una modificación concreta de las subvenciones autonómicas. El pasado 2 de octubre, el departamento de Nolasco publicó una convocatoria que eliminaba la línea específica de apoyo a personas LGTBI y sus familias, dotada con 161.000 euros en 2025, y concentraba los 516.000 euros disponibles en proyectos dirigidos a personas con discapacidad.
  ```

  Expected result: no finding, because the newspaper is reporting another actor's actions rather than endorsing a discriminatory claim.

- [ ] **Step 3: Add the remaining real negative cases**

  Add the approved accessible articles from El País, El Español, and elDiario.es. Preserve source URL only as evaluation metadata; it must never enter production logs or requests unless already part of the article content selected by the extractor.

- [ ] **Step 4: Add a synthetic indirect-attribution case**

  Cover attribution without quotation marks, such as a paragraph reporting that a party, report, survey, organization, or named person holds a discriminatory view. Expected result: no finding unless the paragraph's author adopts or endorses the claim.

- [ ] **Step 5: Run the focused tests and observe the expected failure**

  Run: `pnpm --filter @critical-reader/api test -- openai-cases.test.ts evaluate-cases.test.ts prompt.test.ts`

  Expected: FAIL because the corpus size, new IDs, call count, and prompt version/rules are not implemented yet.

- [ ] **Step 6: Implement the corpus changes**

  Add the five cases, update the expected analyzer invocation count from 16 to 21, and keep acceptance dynamic: zero false positives, at most one missed positive, and no evaluation failures.

- [ ] **Step 7: Strengthen and version the prompt**

  Bump the prompt version from `2026-11-01` to `2026-11-02`. Add an explicit ownership check before classification:

  - Identify who owns the potentially discriminatory proposition.
  - Return no finding if it is attributed to a person, political party, organization, survey, document, source, or other third party.
  - Apply that rule even when there are no quotation marks and even when the paragraph does not explicitly condemn the proposition.
  - Flag only when the paragraph's author adopts, endorses, or directly asserts the proposition.

- [ ] **Step 8: Run focused and API tests**

  Run: `pnpm --filter @critical-reader/api test`

  Expected: PASS.

- [ ] **Step 9: Commit**

  ```bash
  git add apps/api/src/evals apps/api/src/analyzers/model
  git commit -m "test: expand attributed discourse evaluation corpus"
  ```

---

### Task 2: Add fail-closed production policy to the API

**Files:**

- Create: `apps/api/src/server-policy.ts`
- Create: `apps/api/src/server-policy.test.ts`
- Modify: `apps/api/src/bootstrap.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/routes/analyze.ts`
- Modify: `apps/api/src/routes/analyze.test.ts`
- Modify: `apps/api/src/routes/fixtures.test.ts`

- [ ] **Step 1: Define a pure server-policy interface**

  Implement and test this boundary:

  ```ts
  export interface ServerPolicy {
    production: boolean;
    analysisEnabled: boolean;
    allowedExtensionOrigins: readonly string[];
    requiredClientVersion: string | null;
    fixturesEnabled: boolean;
    bodyLimitBytes: number;
  }

  export function loadServerPolicy(env: NodeJS.ProcessEnv): ServerPolicy;
  ```

  Local defaults: analysis enabled, fixtures enabled, no origin/version enforcement, and a 128 KiB body limit. Production requires non-empty `ALLOWED_EXTENSION_ORIGINS` and `CRITICAL_READER_CLIENT_VERSION`; invalid values throw during bootstrap. `ANALYSIS_ENABLED=false` acts as the kill switch.

- [ ] **Step 2: Write failing request-policy tests**

  Add cases proving:

  - Missing or non-allowlisted `Origin` returns `403 client_not_allowed`.
  - Missing or mismatched `X-Critical-Reader-Version` returns `426 unsupported_client_version`.
  - `ANALYSIS_ENABLED=false` returns `503 analysis_disabled`.
  - An oversized body returns `413`.
  - Malformed schema still returns `400`.
  - The analyzer spy is not called for any rejected request.
  - Fixture routes return `404` when production policy disables them.

- [ ] **Step 3: Run the focused tests and confirm red**

  Run: `pnpm --filter @critical-reader/api test -- server-policy.test.ts analyze.test.ts fixtures.test.ts`

  Expected: FAIL because policy loading and guards do not exist.

- [ ] **Step 4: Implement production policy loading**

  Parse the comma-separated origin allowlist into exact origins such as `chrome-extension://<extension-id>`. Reject wildcards and non-`chrome-extension:` entries in production. Parse the client version as an exact non-empty string. Keep local development behavior unchanged.

- [ ] **Step 5: Apply the guards before analysis**

  Pass the policy through `createConfiguredServer` into `buildServer`. Configure Fastify's `bodyLimit`, conditionally register fixture routes, and reject disallowed requests before body processing reaches the analyzer. Return stable machine-readable error codes without echoing request content.

- [ ] **Step 6: Keep logging content-free**

  Ensure route logs contain only request ID, status, duration, configured model/provider, and generic error category. Add a test using a unique sentinel paragraph and assert it does not appear in captured logs or error bodies when the analyzer throws.

- [ ] **Step 7: Run tests and typecheck**

  Run: `pnpm --filter @critical-reader/api test`

  Run: `pnpm --filter @critical-reader/api typecheck`

  Expected: PASS.

- [ ] **Step 8: Commit**

  ```bash
  git add apps/api/src
  git commit -m "feat(api): enforce beta client policy"
  ```

---

### Task 3: Publish privacy, terms, and service information from the API

**Files:**

- Create: `apps/api/src/routes/public-pages.ts`
- Create: `apps/api/src/routes/public-pages.test.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Write failing public-page tests**

  Require `GET /`, `GET /privacy`, and `GET /terms` to return accessible HTML, `200`, UTF-8 content type, no `Set-Cookie`, no third-party scripts/assets, and security headers including `Content-Security-Policy`, `X-Content-Type-Options`, and `Referrer-Policy`.

- [ ] **Step 2: Specify the exact privacy disclosures in tests**

  The privacy page must identify “Critical Reader BETA”, Israel Gutiérrez, and `gootyfer@gmail.com`, and clearly state:

  - The extension sends the visible article title, subtitle, and paragraph text to the service only after consent.
  - The API runs on Vercel and sends text to OpenAI for inference.
  - The beta does not send browsing history or the page URL as an analysis field.
  - The service has no database, cache, analytics, or application-level article storage.
  - OpenAI input is sent with `store: false` and is not used for training by default, but may be retained in abuse-monitoring logs for up to 30 days; this beta is not ZDR.
  - The policy has a visible version/effective date.

- [ ] **Step 3: Specify terms content in tests**

  Require language that the beta is experimental, classifications can be wrong, results are educational context rather than a definitive or legal judgment, availability and limits may change, abusive/automated use is prohibited, and the same public contact is provided.

- [ ] **Step 4: Run the test and confirm red**

  Run: `pnpm --filter @critical-reader/api test -- public-pages.test.ts`

  Expected: FAIL with missing routes.

- [ ] **Step 5: Implement small self-contained HTML pages**

  Register the three routes unconditionally, including when analysis is disabled. Use inline CSS only, escaped static content, semantic headings, readable contrast, and no JavaScript.

- [ ] **Step 6: Run the API suite**

  Run: `pnpm --filter @critical-reader/api test`

  Expected: PASS.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/api/src/routes/public-pages.ts apps/api/src/routes/public-pages.test.ts apps/api/src/server.ts
  git commit -m "feat(api): publish beta privacy and terms"
  ```

---

### Task 4: Make the extension build environment explicit

**Files:**

- Create: `apps/extension/src/config/extension-config.ts`
- Create: `apps/extension/src/config/extension-config.test.ts`
- Create: `apps/extension/src/config/manifest-config.ts`
- Create: `apps/extension/src/config/manifest-config.test.ts`
- Modify: `apps/extension/src/analysis/request-analysis.ts`
- Modify: `apps/extension/src/analysis/request-analysis.test.ts`
- Modify: `apps/extension/entrypoints/background.ts`
- Modify: `apps/extension/wxt.config.ts`
- Create: `apps/extension/.env.production.example`

- [ ] **Step 1: Define the pure runtime configuration boundary**

  Implement and test:

  ```ts
  export interface ExtensionConfig {
    apiBaseUrl: string;
    analyzeEndpoint: string;
    publicSiteUrl: string;
    clientVersion: string;
  }

  export function createExtensionConfig(input: {
    apiBaseUrl: string;
    clientVersion: string;
    production: boolean;
  }): ExtensionConfig;
  ```

  Strip trailing slashes, accept HTTP only for `127.0.0.1` in development, require HTTPS in production, and derive `/analyze`, `/privacy`, and `/terms` URLs from one base URL.

- [ ] **Step 2: Write failing request tests**

  Refactor the request boundary to accept configuration and verify it uses the configured endpoint and sends `X-Critical-Reader-Version` with `Content-Type: application/json`. Remove expectations tied to `http://127.0.0.1:8787`.

- [ ] **Step 3: Write failing manifest tests**

  Extract a pure `createManifestConfig` function. Assert beta name/version, exact host permission for the configured API origin, `activeTab`, `scripting`, and `storage`; reject a production wildcard host permission.

- [ ] **Step 4: Run the focused tests and confirm red**

  Run: `pnpm --filter @critical-reader/extension test -- extension-config.test.ts manifest-config.test.ts request-analysis.test.ts`

  Expected: FAIL.

- [ ] **Step 5: Implement build-time configuration**

  Read `WXT_API_BASE_URL` at build time. Default it to `http://127.0.0.1:8787` only for development. A production build with a missing, invalid, or non-HTTPS URL must throw. Set the manifest to `Critical Reader BETA`, version `0.2.0`, an exact host permission, and `storage` permission.

- [ ] **Step 6: Wire background requests to the configuration**

  Create the configuration once in the background worker and pass `analyzeEndpoint` and `clientVersion` into `requestAnalysis`. Do not expose OpenAI/Vercel secrets in extension environment variables.

- [ ] **Step 7: Add a safe environment template**

  Commit only:

  ```dotenv
  WXT_API_BASE_URL=https://your-project.vercel.app
  ```

- [ ] **Step 8: Run tests, typecheck, and local build**

  Run: `pnpm --filter @critical-reader/extension test`

  Run: `pnpm --filter @critical-reader/extension typecheck`

  Run: `pnpm --filter @critical-reader/extension build`

  Expected: PASS; development build retains the local API origin.

- [ ] **Step 9: Commit**

  ```bash
  git add apps/extension
  git commit -m "feat(extension): support production API builds"
  ```

---

### Task 5: Require informed consent and prevent duplicate analysis

**Files:**

- Create: `apps/extension/src/consent/consent-state.ts`
- Create: `apps/extension/src/consent/consent-state.test.ts`
- Create: `apps/extension/src/ui/consent-ui.ts`
- Create: `apps/extension/src/ui/consent-ui.test.ts`
- Create: `apps/extension/src/analysis/page-analysis-state.ts`
- Create: `apps/extension/src/analysis/page-analysis-state.test.ts`
- Create: `apps/extension/src/analysis/run-page-analysis.ts`
- Create: `apps/extension/src/analysis/run-page-analysis.test.ts`
- Modify: `apps/extension/entrypoints/analyze.content.ts`
- Modify: `apps/extension/src/ui/reader-ui.ts`
- Modify: `apps/extension/src/ui/reader-ui.test.ts`

- [ ] **Step 1: Write consent-state tests**

  Set `CONSENT_VERSION = "2026-11-01"`. Prove that absent, declined, malformed, or older-version storage is not accepted; current-version acceptance is accepted; and saving consent writes only the version and acceptance timestamp to `chrome.storage.local`.

- [ ] **Step 2: Write consent UI tests**

  Define:

  ```ts
  requestAnalysisConsent(
    document: Document,
    links: { privacyUrl: string; termsUrl: string },
  ): Promise<"accepted" | "cancelled">;
  ```

  The Shadow DOM dialog must say what text is sent, identify Vercel/OpenAI, disclose that the beta is not ZDR and may involve up to 30 days of abuse-monitoring retention, link to privacy and terms, and provide explicit “Aceptar y analizar” and “Cancelar” actions.

- [ ] **Step 3: Write orchestration tests before implementation**

  Prove:

  - Declining causes zero article extraction and zero background messages.
  - Accepting persists consent before extraction and sends exactly one request.
  - Existing current consent skips the dialog.
  - A changed consent version prompts again.
  - Two concurrent starts on the same page create one request and one UI instance.

- [ ] **Step 4: Run focused tests and confirm red**

  Run: `pnpm --filter @critical-reader/extension test -- consent-state.test.ts consent-ui.test.ts page-analysis-state.test.ts run-page-analysis.test.ts`

  Expected: FAIL.

- [ ] **Step 5: Implement storage and consent UI**

  Keep consent local to the browser. Do not store article data. Mount a dismissible, keyboard-accessible dialog without altering the article DOM beyond one isolated host node. Ensure Escape/cancel resolves without network activity.

- [ ] **Step 6: Implement a single-flight page guard**

  Use a stable `Symbol.for(...)` property on the page's global object so reinjected scripts can detect an active or completed Critical Reader session. Always clear the “active request” state in `finally`; keep the UI state capable of reopening or being dismissed without launching a parallel request.

- [ ] **Step 7: Move the content entrypoint into the tested orchestrator**

  `analyze.content.ts` should only assemble browser/document dependencies and call `runPageAnalysis`. Replace local-server-specific error text with: “No se pudo conectar con el servicio. Inténtalo de nuevo más tarde.”

- [ ] **Step 8: Run the extension suite and build**

  Run: `pnpm --filter @critical-reader/extension test`

  Run: `pnpm --filter @critical-reader/extension typecheck`

  Run: `pnpm --filter @critical-reader/extension build`

  Expected: PASS.

- [ ] **Step 9: Commit**

  ```bash
  git add apps/extension
  git commit -m "feat(extension): require consent before analysis"
  ```

---

### Task 6: Configure and document the Vercel beta deployment

**Files:**

- Create: `apps/api/vercel.json`
- Create: `apps/api/src/deployment-config.test.ts`
- Create: `docs/deployment/vercel-beta.md`
- Modify: `apps/api/.env.example`
- Modify: `README.md`

- [ ] **Step 1: Write a deployment-config test**

  Parse `apps/api/vercel.json` and assert the API is pinned to region `fra1`, `src/index.ts` has a finite duration comfortably above the current 30-second OpenAI timeout (use 45 seconds), and no secret values are embedded.

- [ ] **Step 2: Run the test and confirm red**

  Run: `pnpm --filter @critical-reader/api test -- deployment-config.test.ts`

  Expected: FAIL because the Vercel configuration is absent.

- [ ] **Step 3: Add the Vercel configuration**

  Use the existing `apps/api/src/index.ts` Fastify entrypoint and add:

  ```json
  {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "regions": ["fra1"],
    "functions": {
      "src/index.ts": { "maxDuration": 45 }
    }
  }
  ```

- [ ] **Step 4: Document exact project setup**

  In `docs/deployment/vercel-beta.md`, record:

  - Import the private GitHub repository into Vercel.
  - Set Root Directory to `apps/api`.
  - Enable inclusion of source files outside the Root Directory so the pnpm workspace package `packages/contracts` is available.
  - Use Node.js 24 and the repository's pinned pnpm version.
  - Production environment: `NODE_ENV=production`, `ANALYZER=openai`, OpenAI model/reasoning/base URL/key, `ANALYSIS_ENABLED=false` for the initial safe deploy, placeholder extension origin, and client version `0.2.0`.
  - Preview environment: use the fake analyzer and never attach the production OpenAI key.
  - Create the production OpenAI key in a dedicated project with a low monthly budget and alerts.
  - Add a Vercel WAF per-IP rate limit of 5 `/analyze` requests per 10 minutes.
  - Keep `/health`, `/`, `/privacy`, and `/terms` outside the analysis rate-limit rule.
  - Record kill-switch and rollback instructions.

- [ ] **Step 5: Update safe environment examples and README**

  Add variable names and non-secret example values. Explain local vs hosted execution and link to the deployment guide. Do not paste a real key or project ID.

- [ ] **Step 6: Run API tests and root checks**

  Run: `pnpm --filter @critical-reader/api test`

  Run: `pnpm typecheck`

  Expected: PASS.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/api/vercel.json apps/api/src/deployment-config.test.ts apps/api/.env.example docs/deployment/vercel-beta.md README.md
  git commit -m "chore: configure Vercel beta deployment"
  ```

---

### Task 7: Prepare the Chrome Web Store beta package and listing

**Files:**

- Create: `apps/extension/public/icon/16.png`
- Create: `apps/extension/public/icon/32.png`
- Create: `apps/extension/public/icon/48.png`
- Create: `apps/extension/public/icon/128.png`
- Create: `apps/extension/store/critical-reader-source.svg`
- Create: `apps/extension/store/listing-es.md`
- Create: `docs/release/chrome-web-store-beta.md`
- Create: `scripts/verify-extension-archive.mjs`
- Modify: `apps/extension/src/config/manifest-config.ts`
- Modify: `apps/extension/src/config/manifest-config.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Extend manifest tests for release metadata**

  Require the four icon sizes, beta display name, description, version `0.2.0`, and only the permissions actually used. The test must fail if `<all_urls>`, remote code, or an OpenAI host permission appears.

- [ ] **Step 2: Write archive-verification tests or a self-test fixture**

  The verifier must reject an archive containing `sk-`, `.env`, source maps, `localhost`, `127.0.0.1`, wildcard host permissions, or files outside the expected extension bundle. It must require the production Vercel origin, manifest, service worker, content bundle, and icons.

- [ ] **Step 3: Run focused tests and confirm red**

  Run: `pnpm --filter @critical-reader/extension test -- manifest-config.test.ts`

  Expected: FAIL until release metadata and icons are configured.

- [ ] **Step 4: Create simple original store assets**

  Create a source SVG using the existing highlighter concept, then render crisp PNG icons at 16, 32, 48, and 128 px. Keep assets original and avoid text in small icons.

- [ ] **Step 5: Add exact Spanish listing copy**

  `listing-es.md` must describe the single purpose, experimental beta status, click-to-analyze behavior, possible errors, remote processing, privacy/terms URLs as placeholders to replace after deployment, and public contact. Do not claim the tool “detects all” discriminatory discourse.

- [ ] **Step 6: Document Chrome Web Store answers**

  Include:

  - Visibility: unlisted; anyone with the link.
  - Single purpose and permission justifications for `activeTab`, `scripting`, `storage`, and the single API host.
  - Data disclosure: website content is transmitted for the user-requested feature; no sale, ads, analytics, or unrelated use.
  - Privacy-policy URL, support contact, screenshots, and reviewer instructions.
  - First upload is manual; future automation is out of scope.

- [ ] **Step 7: Add packaging commands**

  Add root scripts similar to:

  ```json
  {
    "zip:extension": "pnpm --filter @critical-reader/extension exec wxt zip",
    "verify:extension-archive": "node scripts/verify-extension-archive.mjs"
  }
  ```

  The production command must be run with `WXT_API_BASE_URL=https://<deployed-host>`.

- [ ] **Step 8: Run tests and a placeholder production package test**

  Use a syntactically valid HTTPS placeholder only for validating build mechanics; do not upload that archive.

  Run: `WXT_API_BASE_URL=https://critical-reader.invalid pnpm zip:extension`

  Expected: build succeeds, and the verifier correctly rejects or marks the placeholder archive as non-releasable.

- [ ] **Step 9: Commit**

  ```bash
  git add apps/extension package.json scripts/verify-extension-archive.mjs docs/release/chrome-web-store-beta.md
  git commit -m "chore(extension): prepare Chrome Web Store beta"
  ```

---

### Task 8: Deploy safely and bind the real Chrome extension ID

**Files:**

- Modify: `apps/extension/store/listing-es.md`
- Modify: `docs/deployment/vercel-beta.md`
- Modify: `docs/release/chrome-web-store-beta.md`

This task changes external state and requires the user's Vercel/Chrome Web Store sessions. Stop for approval only if credentials or a browser action is required; do not request or expose secret values.

- [ ] **Step 1: Push the implementation branch and create the Vercel project**

  Deploy from the private GitHub repository with `ANALYSIS_ENABLED=false`. Confirm Vercel builds the workspace dependency and places the function in `fra1`.

- [ ] **Step 2: Smoke-test public, non-analysis routes**

  Verify over HTTPS:

  ```bash
  curl -i https://<host>/health
  curl -i https://<host>/privacy
  curl -i https://<host>/terms
  ```

  Expected: `200`; no cookies; privacy and terms match the approved wording. Verify `/analyze` returns `503 analysis_disabled` without making an OpenAI call.

- [ ] **Step 3: Build the real production extension archive**

  Run:

  ```bash
  WXT_API_BASE_URL=https://<host> pnpm zip:extension
  pnpm verify:extension-archive <path-to-zip>
  ```

  Expected: PASS with no localhost strings, source maps, secrets, or wildcard host permissions.

- [ ] **Step 4: Create the unlisted Chrome Web Store draft**

  Upload the archive, set Spanish listing content and assets, choose unlisted visibility, and save the generated extension ID. Do not submit for review yet.

- [ ] **Step 5: Bind the store ID to the API policy**

  Set production `ALLOWED_EXTENSION_ORIGINS=chrome-extension://<store-id>` and `CRITICAL_READER_CLIENT_VERSION=0.2.0`. For manual pre-review testing, temporarily append the unpacked extension's exact ID as a second comma-separated origin; remove it after testing.

- [ ] **Step 6: Enable analysis and configure abuse controls**

  Enable `ANALYSIS_ENABLED=true`, redeploy, and create the WAF rule for 5 `/analyze` requests per 10 minutes per IP. Confirm the OpenAI project budget cap/alerts are active.

- [ ] **Step 7: Smoke-test policy behavior**

  Verify:

  - No origin: `403`, analyzer not invoked.
  - Wrong version: `426`, analyzer not invoked.
  - Correct origin/version and a minimal valid body: success.
  - Sixth rapid request from one IP is rate-limited by Vercel.
  - Public pages remain accessible under rate limiting.

- [ ] **Step 8: Replace listing placeholders**

  Put the real HTTPS privacy, terms, and support/home URLs into the listing documentation and Chrome Web Store draft.

- [ ] **Step 9: Commit the non-secret final URLs/documentation**

  ```bash
  git add apps/extension/store/listing-es.md docs/deployment/vercel-beta.md docs/release/chrome-web-store-beta.md
  git commit -m "docs: record private beta deployment"
  ```

---

### Task 9: Verify, evaluate, submit, and record the beta release

**Files:**

- Create: `docs/releases/0.2.0-beta.md`
- Modify if evidence requires correction: files changed in Tasks 1–8

- [ ] **Step 1: Run the complete deterministic verification**

  Run:

  ```bash
  pnpm test
  pnpm typecheck
  pnpm build
  WXT_API_BASE_URL=https://<host> pnpm zip:extension
  pnpm verify:extension-archive <path-to-zip>
  ```

  Expected: every command exits `0`.

- [ ] **Step 2: Run the paid live evaluation once**

  Run: `pnpm eval:openai`

  Expected: 21 completed cases, zero false positives, no evaluation infrastructure failures, and at least 8 of 9 positive cases detected. Record model, prompt version `2026-11-02`, timestamp, aggregate counts, and case IDs only—never article text or API keys.

- [ ] **Step 3: Manually verify consent and duplicate protection**

  In a fresh Chrome profile:

  - Cancel consent and confirm DevTools shows no request.
  - Accept consent and confirm exactly one `/analyze` request.
  - Click the extension repeatedly during analysis and confirm no parallel requests.
  - Confirm privacy and terms links open the production pages.
  - Confirm the “no findings” banner and all other extension notices remain dismissible with their `×` button.

- [ ] **Step 4: Manually verify classification behavior**

  Test one approved positive article, the exact Vox/subsidies false-positive paragraph, and at least two approved real negatives. The regression paragraph and negatives must not be highlighted.

- [ ] **Step 5: Inspect Vercel/OpenAI observability**

  Confirm logs contain request metadata but no article content, title, URL, finding, or explanation. Confirm usage appears only in the dedicated OpenAI project and stays within the configured budget.

- [ ] **Step 6: Remove temporary test access**

  Remove the unpacked extension ID from `ALLOWED_EXTENSION_ORIGINS`, leaving only the Chrome Web Store ID. Redeploy and repeat one store-build smoke test if the item is installable before review.

- [ ] **Step 7: Complete the Chrome Web Store privacy form and submit**

  Use the documented answers, keep visibility unlisted, and submit version `0.2.0` for review. Record the submission date and resulting status; do not publish publicly/listed.

- [ ] **Step 8: Create the release evidence document**

  Record commit SHA, deployed host, Chrome Web Store item ID/link, test/eval summaries, WAF rule summary, known limitations, rollback/kill-switch steps, and the explicit decision that ZDR/OpenRouter is deferred to the next milestone. Include no secrets or raw article content.

- [ ] **Step 9: Run final verification after any fixes**

  Re-run all commands from Step 1 and the affected manual checks. Do not rely on earlier passing output after code or configuration changes.

- [ ] **Step 10: Commit and request review**

  ```bash
  git add docs/releases/0.2.0-beta.md
  git commit -m "docs: record 0.2.0 beta release evidence"
  ```

  Then use `superpowers:requesting-code-review`, resolve findings, use `superpowers:finishing-a-development-branch`, and merge only after the full verification remains green.

---

## Definition of done

- [ ] Friends can install an unlisted Chrome Web Store item from a direct link.
- [ ] First analysis requires informed consent; cancellation sends nothing.
- [ ] The extension talks only to the configured HTTPS API and includes its exact version.
- [ ] The hosted API fails closed, has a kill switch, validates origin/version/body, and is protected by a light per-IP WAF rate limit.
- [ ] The service publishes accurate privacy and terms pages with the public contact.
- [ ] No article text or URL is stored in the application or emitted to application logs.
- [ ] Direct OpenAI processing is accurately disclosed as non-ZDR with `store: false`.
- [ ] The 21-case hybrid evaluation passes its agreed acceptance threshold, including the attributed-speech regression.
- [ ] The production archive contains no secret, localhost reference, source map, wildcard host permission, or unnecessary permission.
- [ ] Release evidence, rollback instructions, and known limitations are documented.

## Deferred to the next milestone

- OpenRouter integration and provider routing.
- ZDR-only provider selection and stronger EU data residency guarantees.
- Server-side KV/cache keyed by normalized content hash.
- User accounts, durable quotas, shared-secret/device attestation, or challenge systems.
- Automated Chrome Web Store publishing.
- Support for Chrome Reading Mode or paywalled content extraction.
- Public/listed launch, broader legal review, and production-scale observability.
