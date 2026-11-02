# Ficha de Chrome Web Store — Critical Reader BETA

## Datos básicos

- Nombre: **Critical Reader BETA**
- Idioma principal: español
- Categoría sugerida: Productividad
- Visibilidad: no listada; cualquier persona con el enlace puede instalarla
- Público: mayores de 18 años; marcar contenido para adultos por la naturaleza potencialmente ofensiva de los textos analizados
- Contacto público: Israel Gutiérrez — gootyfer@gmail.com

## Resumen breve

Señala párrafos con expresiones discriminatorias claras al leer artículos en español.

## Descripción detallada

Critical Reader BETA es una herramienta experimental de lectura crítica. Cuando pulsas su icono en un artículo en español, analiza el texto visible y marca con un fondo amarillo los párrafos en los que identifica expresiones claramente machistas, racistas u homófobas. Al interactuar con un párrafo marcado puedes consultar la categoría y una explicación breve.

El análisis solo comienza tras tu clic. Antes del primer uso se explica qué datos se enviarán y se solicita tu consentimiento. La extensión no analiza páginas automáticamente ni recopila tu historial de navegación.

Para realizar la función solicitada, el título, el subtítulo y el texto visible del artículo se transmiten a la API de Critical Reader alojada en Vercel y de ahí a OpenAI. Critical Reader no guarda el artículo en una base de datos, caché ni logs de aplicación. Esta beta no ofrece Zero Data Retention; consulta la política de privacidad para conocer el tratamiento y la posible retención por el proveedor.

Los resultados se generan automáticamente y pueden contener errores, omisiones o interpretaciones discutibles. La ausencia de resaltados no significa que el texto esté libre de discriminación, y un resaltado no constituye una valoración jurídica ni una opinión definitiva sobre el autor o el medio.

Esta versión es una beta privada no listada, dirigida a un grupo pequeño de prueba. Puede estar temporalmente indisponible y aplica límites de uso para controlar abusos y costes.

- Información: `https://critical-reader.vercel.app/`
- Privacidad: `https://critical-reader.vercel.app/privacy`
- Términos: `https://critical-reader.vercel.app/terms`
- Soporte: gootyfer@gmail.com

## Recursos gráficos

- Icono de tienda: `public/icon/128.png`.
- Captura obligatoria: 1280 × 800 px, sin padding, mostrando un artículo real con un párrafo marcado y el detalle abierto.
- Captura opcional: 1280 × 800 px mostrando el consentimiento previo al primer análisis.
- No usar montajes que atribuyan un resultado real a un medio distinto ni prometer una detección completa.
