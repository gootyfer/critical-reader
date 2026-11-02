import { afterEach, describe, expect, it } from "vitest";

import { buildServer } from "../app-server.js";

const servers: Awaited<ReturnType<typeof buildServer>>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function getPage(path: string) {
  const app = await buildServer();
  servers.push(app);
  return app.inject({ method: "GET", url: path });
}

describe("public service pages", () => {
  it.each(["/", "/privacy", "/terms"])(
    "serves %s as self-contained accessible HTML with security headers",
    async (path) => {
      const response = await getPage(path);

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain(
        "text/html; charset=utf-8",
      );
      expect(response.headers["set-cookie"]).toBeUndefined();
      expect(response.headers["content-security-policy"]).toBe(
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      );
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["referrer-policy"]).toBe("no-referrer");
      expect(response.body).toContain('<html lang="es">');
      expect(response.body).toContain("<main");
      expect(response.body).toContain("<h1");
      expect(response.body).not.toMatch(/<script|<link|\ssrc=/iu);
    },
  );

  it("explains the service and links to its policies", async () => {
    const response = await getPage("/");

    expect(response.body).toContain("Critical Reader BETA");
    expect(response.body).toContain('href="/privacy"');
    expect(response.body).toContain('href="/terms"');
    expect(response.body).toContain("Israel Gutiérrez");
    expect(response.body).toContain("gootyfer@gmail.com");
  });

  it("discloses every material part of remote article processing", async () => {
    const response = await getPage("/privacy");
    const body = response.body;

    for (const disclosure of [
      "Critical Reader BETA",
      "Israel Gutiérrez",
      "gootyfer@gmail.com",
      "título, el subtítulo y el texto visible de los párrafos",
      "después de que aceptes",
      "Vercel",
      "OpenAI",
      "historial de navegación",
      "URL de la página",
      "base de datos",
      "caché",
      "analítica",
      "store: false",
      "entrenar",
      "30 días",
      "no ofrece Zero Data Retention (ZDR)",
      "Versión 2026-11-01",
      "1 de noviembre de 2026",
    ]) {
      expect(body).toContain(disclosure);
    }
  });

  it("states the experimental limits and acceptable use terms", async () => {
    const response = await getPage("/terms");
    const body = response.body;

    for (const term of [
      "Critical Reader BETA",
      "experimental",
      "pueden contener errores",
      "contexto educativo",
      "no constituye una valoración definitiva ni jurídica",
      "disponibilidad y los límites pueden cambiar",
      "uso abusivo o automatizado",
      "Israel Gutiérrez",
      "gootyfer@gmail.com",
    ]) {
      expect(body).toContain(term);
    }
  });
});
