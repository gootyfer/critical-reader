# Publicación manual de la beta en Chrome Web Store

La primera subida es manual. No se guardan credenciales de Chrome Web Store ni se automatiza la publicación en este hito.

El borrador **Critical Reader BETA** usa el ID estable `feklbnkcmcampfdlicejamjjbhncjfmo`. El paquete 0.2.0 se subió correctamente y permanece en estado borrador, sin envío a revisión.

## Antes de empaquetar

1. Despliega la API y comprueba sus páginas públicas.
2. Crea un borrador llamado **Critical Reader BETA** en Chrome Web Store para obtener el ID estable.
3. Configura ese ID como origen permitido de la API y conserva `ANALYSIS_ENABLED=false`.
4. Confirma que `apps/extension/store/listing-es.md` usa el dominio estable de producción.
5. Compila y verifica el ZIP con el mismo origen exacto:

```bash
WXT_API_BASE_URL=https://critical-reader.vercel.app pnpm zip:extension
WXT_API_BASE_URL=https://critical-reader.vercel.app pnpm verify:extension-archive
```

El verificador exige un dominio HTTPS `*.vercel.app` real y rechaza placeholders, localhost, claves, `.env`, mapas de fuentes, permisos comodín y archivos ajenos al bundle.

## Ficha

- Idioma: español.
- Visibilidad: **Unlisted / No listada**; cualquiera con el enlace puede instalarla.
- Distribución geográfica: todas las regiones.
- Nombre y descripción: copiar desde `apps/extension/store/listing-es.md`.
- Icono de tienda: `apps/extension/public/icon/128.png`.
- Capturas: al menos una captura real de 1280 × 800 o 640 × 400 px. Se recomienda una con el resaltado y el detalle abierto y otra con el consentimiento.
- Política de privacidad: `https://critical-reader.vercel.app/privacy`.
- Página principal: `https://critical-reader.vercel.app/`.
- Soporte: gootyfer@gmail.com.

## Propósito único

> Ayudar al usuario a leer críticamente artículos en español resaltando, únicamente cuando lo solicita, párrafos en los que un análisis automatizado identifica expresiones claramente machistas, racistas u homófobas, y mostrando una explicación breve.

No describir la extensión como detector exhaustivo ni como sistema que califica personas o medios.

## Justificación de permisos

- `activeTab`: permite acceder solo a la pestaña que el usuario decide analizar al pulsar el icono; no concede acceso permanente al historial.
- `scripting`: inyecta el lector y los resaltados en esa pestaña después del clic.
- `storage`: guarda localmente la versión del consentimiento aceptado; no guarda artículos ni resultados.
- `https://critical-reader.vercel.app/*`: permite enviar la solicitud de análisis únicamente a la API de Critical Reader. No se solicita acceso directo a OpenAI.

No se usa código remoto. Todo el JavaScript ejecutado por la extensión está incluido en el ZIP.

## Declaraciones de privacidad

- Datos tratados: **Website content / Contenido de sitios web** — título, subtítulo y párrafos visibles de la página elegida.
- Finalidad: funcionalidad principal solicitada por el usuario.
- Transmisión: API de Critical Reader en Vercel y OpenAI, según la política enlazada.
- No se vende información, no hay anuncios, analítica ni personalización publicitaria.
- No se usa la información para crédito, seguros ni finalidades ajenas a la función única.
- Confirmar las declaraciones de Limited Use y que la ficha, el consentimiento y la política describen el mismo comportamiento.

## Instrucciones para revisión

1. Instalar la extensión; no requiere cuenta ni pago.
2. Abrir un artículo público en español y pulsar el icono de Critical Reader.
3. En el primer uso, revisar los enlaces de privacidad y términos y pulsar **Aceptar y analizar**.
4. Esperar el aviso de resultado. Si hay un párrafo marcado, pasar el ratón, enfocarlo o pulsarlo para ver la explicación. Si no hay ninguno, aparecerá un aviso que puede cerrarse con `×`.
5. El análisis no se inicia al navegar ni en segundo plano. Las páginas internas de Chrome, PDFs y Reading Mode no son compatibles.

Si Google necesita un caso reproducible, proporcionar en el campo de notas una URL pública probada inmediatamente antes de enviar la revisión, sin paywall ni datos personales.

## Subida y activación

1. Subir el ZIP verificado, completar todos los campos y guardar como borrador.
2. Revisar que el ID del borrador coincide con `ALLOWED_EXTENSION_ORIGINS`.
3. Hacer una prueba instalada desde el borrador con `ANALYSIS_ENABLED=false`; la API debe rechazar el análisis de forma segura.
4. Activar `ANALYSIS_ENABLED=true`, redesplegar y repetir la prueba completa.
5. Enviar a revisión, pero no publicar definitivamente ni compartir el enlace hasta confirmar expresamente el resultado con el propietario del proyecto.

Referencias oficiales: [preparar la ficha](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), [imágenes](https://developer.chrome.com/docs/webstore/images) y [políticas de privacidad](https://developer.chrome.com/docs/webstore/program-policies/policies).
