import type { FastifyInstance, FastifyReply } from "fastify";

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
} as const;

const layout = (title: string, content: string): string => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · Critical Reader BETA</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, sans-serif; line-height: 1.6; color: #202124; background: #fffdf7; }
    body { margin: 0; }
    main { max-width: 46rem; margin: 0 auto; padding: 3rem 1.25rem 4rem; }
    h1, h2 { line-height: 1.2; color: #172018; }
    h1 { font-size: clamp(2rem, 7vw, 3.25rem); }
    h2 { margin-top: 2rem; }
    a { color: #165c2d; text-underline-offset: 0.18em; }
    nav { display: flex; gap: 1rem; flex-wrap: wrap; margin: 2rem 0; }
    .notice { border-left: 0.35rem solid #ffd84d; background: #fff4bd; padding: 1rem; }
    footer { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid #d7d3c5; font-size: 0.95rem; }
    code { background: #eeece5; padding: 0.1rem 0.3rem; border-radius: 0.25rem; }
  </style>
</head>
<body>
  <main>
    ${content}
    <footer>
      <p>Responsable: Israel Gutiérrez · <a href="mailto:gootyfer@gmail.com">gootyfer@gmail.com</a></p>
      <nav aria-label="Información legal">
        <a href="/">Inicio</a>
        <a href="/privacy">Privacidad</a>
        <a href="/terms">Términos de uso</a>
      </nav>
    </footer>
  </main>
</body>
</html>`;

const homePage = layout(
  "Inicio",
  `<h1>Critical Reader BETA</h1>
  <p class="notice"><strong>Versión experimental:</strong> esta herramienta puede equivocarse.</p>
  <p>Critical Reader ayuda a leer textos periodísticos con atención. Cuando tú lo solicitas, analiza los párrafos visibles y destaca expresiones claramente machistas, racistas, xenófobas, homófobas o tránsfobas, acompañadas de una explicación breve.</p>
  <p>No analiza páginas en segundo plano ni sustituye tu criterio. Antes del primer análisis te pedirá consentimiento para enviar el texto al servicio remoto.</p>
  <nav aria-label="Documentación del servicio">
    <a href="/privacy">Política de privacidad</a>
    <a href="/terms">Términos de uso</a>
  </nav>`,
);

const privacyPage = layout(
  "Política de privacidad",
  `<h1>Política de privacidad de Critical Reader BETA</h1>
  <p><strong>Versión 2026-11-01 · efectiva desde el 1 de noviembre de 2026.</strong></p>
  <p>El responsable de esta beta es Israel Gutiérrez. Para cualquier consulta sobre privacidad puedes escribir a <a href="mailto:gootyfer@gmail.com">gootyfer@gmail.com</a>.</p>

  <h2>Qué datos se procesan</h2>
  <p>Al pulsar el botón de análisis, la extensión envía el título, el subtítulo y el texto visible de los párrafos del artículo, pero solo después de que aceptes el aviso de consentimiento. El tratamiento se realiza para generar los resaltados y explicaciones que has solicitado.</p>
  <p>La extensión no envía tu historial de navegación ni la URL de la página como campo del análisis. Tampoco analiza automáticamente otras páginas o pestañas.</p>

  <h2>Proveedores y transferencias</h2>
  <p>La API de Critical Reader se ejecuta en Vercel. Esa API envía el texto a OpenAI para realizar la inferencia del modelo. Estos proveedores pueden procesar información fuera de España; esta beta no promete residencia europea de extremo a extremo.</p>

  <h2>Retención</h2>
  <p>Critical Reader no conserva el artículo en una base de datos, caché, analítica ni almacenamiento de aplicación. Los registros técnicos de la API no incluyen el título, el subtítulo, los párrafos, los hallazgos ni la URL.</p>
  <p>Las solicitudes a OpenAI se realizan con <code>store: false</code>. Según la configuración estándar de la API, OpenAI no utiliza estos datos para entrenar sus modelos por defecto, salvo adhesión voluntaria del titular de la cuenta. OpenAI puede conservar contenido en registros de prevención de abuso durante un máximo de 30 días. Por ello, esta beta no ofrece Zero Data Retention (ZDR).</p>

  <h2>Tus decisiones y derechos</h2>
  <p>Puedes cancelar el consentimiento antes del análisis y no se enviará el artículo. También puedes retirar el consentimiento borrando los datos de la extensión o desinstalándola. Puedes solicitar información, acceso, rectificación, supresión, oposición o limitación escribiendo al correo de contacto.</p>
  <p>Esta política se actualizará si cambian los datos enviados, los proveedores o la retención. Un cambio material exigirá una nueva aceptación en la extensión.</p>`,
);

const termsPage = layout(
  "Términos de uso",
  `<h1>Términos de uso de Critical Reader BETA</h1>
  <p><strong>Versión experimental para pruebas privadas.</strong></p>

  <h2>Naturaleza del resultado</h2>
  <p>Las clasificaciones son automatizadas y pueden contener errores, omisiones o explicaciones imprecisas. Se ofrecen como contexto educativo para favorecer una lectura crítica. El resultado no constituye una valoración definitiva ni jurídica sobre un texto, una persona o un medio de comunicación.</p>

  <h2>Uso permitido</h2>
  <p>Puedes usar la beta para analizar artículos que estés leyendo y compartir observaciones sobre su funcionamiento. No está permitido el uso abusivo o automatizado, el intento de eludir límites, interferir con el servicio, extraerlo masivamente o utilizarlo para perjudicar a terceros.</p>

  <h2>Disponibilidad</h2>
  <p>La disponibilidad y los límites pueden cambiar durante la beta. El servicio puede pausarse para controlar costes, corregir errores, proteger datos o responder a un uso indebido. No se garantiza funcionamiento continuo ni compatibilidad con todas las páginas.</p>

  <h2>Responsabilidad</h2>
  <p>Debes interpretar cada resaltado dentro de su contexto y conservar tu propio criterio. No tomes decisiones legales, laborales, editoriales o personales basándote únicamente en esta herramienta.</p>

  <h2>Contacto y legislación</h2>
  <p>El responsable es Israel Gutiérrez y el contacto es <a href="mailto:gootyfer@gmail.com">gootyfer@gmail.com</a>. Estos términos se interpretan conforme a la legislación española. La beta está dirigida a personas mayores de 18 años.</p>`,
);

const sendHtml = (reply: FastifyReply, html: string) => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    reply.header(name, value);
  }
  return reply.type("text/html; charset=utf-8").send(html);
};

export async function registerPublicPageRoutes(app: FastifyInstance) {
  app.get("/", async (_request, reply) => sendHtml(reply, homePage));
  app.get("/privacy", async (_request, reply) =>
    sendHtml(reply, privacyPage),
  );
  app.get("/terms", async (_request, reply) => sendHtml(reply, termsPage));
}
