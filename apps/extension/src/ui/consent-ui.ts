export async function requestAnalysisConsent(
  document: Document,
  links: { privacyUrl: string; termsUrl: string },
): Promise<"accepted" | "cancelled"> {
  document.querySelector("[data-critical-reader-consent-host]")?.remove();

  const host = document.createElement("div");
  host.setAttribute("data-critical-reader-consent-host", "");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      #backdrop { background: rgba(20, 24, 20, .58); inset: 0; position: fixed; z-index: 2147483647; }
      #dialog { background: #fffdf4; border: 1px solid #d1b52f; border-radius: 12px; box-shadow: 0 16px 48px rgba(0,0,0,.3); color: #202124; font: 15px/1.5 system-ui, sans-serif; left: 50%; max-height: calc(100vh - 32px); max-width: min(540px, calc(100vw - 32px)); overflow: auto; padding: 24px; position: fixed; top: 50%; transform: translate(-50%, -50%); width: 100%; z-index: 2147483647; }
      h1 { font-size: 22px; line-height: 1.25; margin: 0 0 12px; }
      p { margin: 10px 0; }
      a { color: #165c2d; }
      #actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; margin-top: 20px; }
      button { border: 1px solid #38513d; border-radius: 7px; cursor: pointer; font: inherit; padding: 9px 14px; }
      [data-action="accept"] { background: #245f35; color: white; }
      [data-action="cancel"] { background: white; color: #202124; }
      button:focus-visible, a:focus-visible { outline: 3px solid #e1b900; outline-offset: 2px; }
    </style>
    <div id="backdrop" aria-hidden="true"></div>
    <section id="dialog" role="dialog" aria-modal="true" aria-labelledby="consent-title" aria-describedby="consent-description">
      <h1 id="consent-title">Antes de analizar este artículo</h1>
      <div id="consent-description">
        <p>Critical Reader enviará el título, subtítulo y párrafos visibles de este artículo a su API alojada en Vercel y a OpenAI para generar los resaltados y explicaciones.</p>
        <p>No se envía tu historial ni se analizan páginas en segundo plano. Critical Reader no guarda el artículo en una base de datos o caché.</p>
        <p>Esta beta no dispone de Zero Data Retention (ZDR). OpenAI puede conservar contenido en registros de prevención de abuso durante hasta 30 días. El análisis puede equivocarse y no es una valoración jurídica o definitiva.</p>
        <p><a href="${links.privacyUrl}" target="_blank" rel="noopener noreferrer">Política de privacidad</a> · <a href="${links.termsUrl}" target="_blank" rel="noopener noreferrer">Términos de uso</a></p>
      </div>
      <div id="actions">
        <button data-action="cancel" type="button">Cancelar</button>
        <button data-action="accept" type="button">Aceptar y analizar</button>
      </div>
    </section>
  `;
  document.documentElement.append(host);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: "accepted" | "cancelled") => {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKeydown);
      host.remove();
      resolve(result);
    };
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish("cancelled");
    };

    const accept = shadow.querySelector<HTMLButtonElement>(
      "[data-action='accept']",
    )!;
    accept.addEventListener("click", () => finish("accepted"));
    shadow
      .querySelector<HTMLButtonElement>("[data-action='cancel']")!
      .addEventListener("click", () => finish("cancelled"));
    document.addEventListener("keydown", onKeydown);
    accept.focus();
  });
}
