# Critical Reader

Prototipo local de un asistente de lectura crítica para artículos en español.

## Requisitos

- Node.js 24
- pnpm 12 (Corepack usa la versión fijada por el proyecto)

## Puesta en marcha

```bash
pnpm install
pnpm dev:api
```

El servidor queda disponible en `http://127.0.0.1:8787`.

## Endpoints locales

- `GET /health`
- `POST /analyze`
- `GET /fixtures/clear-sexism`
- `GET /fixtures/quoted-speech`
- `GET /fixtures/neutral`

El primer hito usa exclusivamente un analizador falso y no necesita claves ni servicios externos.

## Comprobaciones

```bash
pnpm typecheck
pnpm test
```
