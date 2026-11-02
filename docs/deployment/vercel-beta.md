# Despliegue de la beta privada en Vercel

Esta guía despliega únicamente la API. La extensión se publica por separado como beta no listada en Chrome Web Store.

## Límites de esta beta

- Cuenta y scope de Vercel: `gootyfer-1267s-projects`.
- Proyecto separado: `critical-reader-api`.
- Plan: Hobby, solo para una beta personal y no comercial.
- Región de ejecución: Frankfurt (`fra1`).
- Dominio estable: `https://critical-reader.vercel.app`.
- El contenido analizado se envía a OpenAI. Esta beta no promete Zero Data Retention.

## 1. Proyecto de OpenAI aislado

Antes de activar el análisis, crea el proyecto **Critical Reader Beta** en OpenAI y genera una clave exclusiva para él. No reutilices claves de otros proyectos.

Configura un presupuesto mensual de 10 USD y alertas al alcanzar 5 y 8 USD. Guarda la clave directamente como variable cifrada de Vercel; no la pegues en documentación, commits, incidencias ni chats.

## 2. Importar el repositorio privado

1. En Vercel, importa el repositorio privado de GitHub.
2. Selecciona el scope `gootyfer-1267s-projects` y usa el nombre `critical-reader-api`.
3. Establece **Root Directory** en `apps/api`.
4. Mantén activada **Include source files outside of the Root Directory** para que Vercel pueda leer la configuración del monorepo.
5. Selecciona Node.js 24. El repositorio fija pnpm `12.16.1` en el `packageManager` raíz; no sobrescribas esa versión con un Install Command personalizado.
6. Deja que Vercel detecte Fastify a partir de `src/index.ts`. No configures un Output Directory estático.

La API conserva una copia local de los esquemas de contrato para que la función sea autocontenida. Una prueba exige que sea idéntica, byte por byte, al contrato canónico de `packages/contracts`; así evitamos symlinks externos que el adaptador Fastify de Vercel no incluye en el bundle.

`src/index.ts` es el único entrypoint: importa Fastify directamente y llama a `listen()` sin esperar su promesa, el patrón que necesita el adaptador de Vercel y que también funciona en desarrollo local. No crees módulos auxiliares llamados `src/app.ts` o `src/server.ts`, porque Vercel también los trataría como entrypoints. El constructor interno vive en `src/app-server.ts`.

`apps/api/vercel.json` fija la región `fra1`. No declares `src/index.ts` en la sección `functions`: Vercel detecta automáticamente la aplicación Fastify y un patrón manual impide la compilación. El timeout del proveedor se mantiene en 30 segundos, por debajo de la duración predeterminada de las Functions con Fluid Compute.

## 3. Variables por entorno

### Production

Añade estas variables únicamente a Production:

```dotenv
NODE_ENV=production
ANALYZER=openai
OPENAI_API_KEY=<clave-exclusiva-del-proyecto-Critical-Reader-Beta>
OPENAI_MODEL=gpt-6-luna
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_REASONING_EFFORT=low
OPENAI_TIMEOUT_MS=30000
ANALYSIS_ENABLED=false
ALLOWED_EXTENSION_ORIGINS=chrome-extension://feklbnkcmcampfdlicejamjjbhncjfmo
CRITICAL_READER_CLIENT_VERSION=0.2.0
```

El primer despliegue debe conservar `ANALYSIS_ENABLED=false`. El origen anterior corresponde al ID estable asignado al borrador de **Critical Reader BETA**. La API rechaza otros orígenes y versiones de cliente.

### Preview

Usa el analizador determinista y no adjuntes la clave de OpenAI de producción:

```dotenv
NODE_ENV=development
ANALYZER=fake
```

No copies `OPENAI_API_KEY` a Preview. Las fixtures solo están disponibles fuera de producción.

## 4. Protección contra abuso

En **Firewall / WAF**, crea una regla de rate limiting que:

- se aplique solo a `POST /analyze`;
- cuente por dirección IP;
- permita como máximo 5 solicitudes en una ventana fija de 10 minutos;
- responda bloqueando el exceso.

No incluyas en esa regla `GET /health`, `GET /`, `GET /privacy` ni `GET /terms`, porque deben seguir disponibles para diagnóstico y revisión de la tienda.

La protección se completa con el límite de cuerpo de 128 KiB, el origen exacto de la extensión, la versión obligatoria del cliente y el interruptor `ANALYSIS_ENABLED`.

## 5. Activación segura

1. Despliega con `ANALYSIS_ENABLED=false`.
2. Comprueba `/`, `/privacy`, `/terms` y `/health` en el dominio de producción.
3. Crea el borrador de Chrome Web Store y obtén el ID definitivo de la extensión.
4. Configura `ALLOWED_EXTENSION_ORIGINS=chrome-extension://feklbnkcmcampfdlicejamjjbhncjfmo` y vuelve a desplegar.
5. Compila la extensión con el dominio HTTPS definitivo y verifica el flujo completo.
6. Cambia `ANALYSIS_ENABLED=true` solo cuando las comprobaciones sean correctas.

## 6. Interruptor y rollback

Ante errores, gasto inesperado o abuso, cambia inmediatamente `ANALYSIS_ENABLED=false` en Production y redespliega. Esto mantiene las páginas legales y `/health`, pero hace que `/analyze` rechace el trabajo antes de llamar a OpenAI.

Para volver a una versión estable, abre **Deployments**, selecciona el último despliegue correcto y usa **Instant Rollback**. Después revisa los logs sin copiar contenidos de artículos ni secretos. Si existe riesgo sobre la clave, revócala en OpenAI y crea otra dentro del mismo proyecto aislado.

## 7. Comprobación posterior

- `/health` responde `200` sin datos sensibles.
- `/privacy` y `/terms` son públicas.
- Las fixtures devuelven `404` en Production.
- Un origen o versión incorrectos no pueden analizar.
- Con el interruptor apagado no se llama al proveedor.
- La regla WAF bloquea la sexta petición del mismo IP dentro de diez minutos.
- Los logs contienen metadatos operativos, no el texto recibido ni la clave.

Referencias: [Fastify en Vercel](https://vercel.com/docs/frameworks/backend/fastify) y [monorepos en Vercel](https://vercel.com/docs/monorepos/monorepo-faq).
