import { afterEach, describe, expect, it } from "vitest";

import { buildServer } from "./server.js";

const servers: Awaited<ReturnType<typeof buildServer>>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("local API", () => {
  it("reports its health", async () => {
    const app = await buildServer();
    servers.push(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", analyzer: "fake" });
  });

  it("returns only the clearly matched paragraph", async () => {
    const app = await buildServer();
    servers.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: {
        title: "Ejemplo",
        subtitle: "",
        language: "es",
        paragraphs: [
          {
            id: "p0",
            text: "Las mujeres no deberían ocupar puestos técnicos.",
          },
          {
            id: "p1",
            text: "La empresa publicó sus resultados trimestrales.",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-content-hash"]).toMatch(/^[a-f0-9]{64}$/u);
    expect(response.json()).toEqual({
      findings: [
        {
          paragraphId: "p0",
          category: "sexism",
          mechanism: "stereotype",
          explanation:
            "El párrafo atribuye una falta de capacidad técnica a las mujeres como grupo.",
        },
      ],
    });
  });

  it("does not flag quoted speech in the fake analyzer", async () => {
    const app = await buildServer();
    servers.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: {
        title: "Ejemplo",
        subtitle: "",
        language: "es",
        paragraphs: [
          {
            id: "p0",
            text: "El portavoz afirmó: «Las mujeres no deberían ocupar puestos técnicos».",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ findings: [] });
  });

  it("rejects invalid input", async () => {
    const app = await buildServer();
    servers.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: { language: "en", paragraphs: [] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_request");
  });

  it.each([
    ["clear-sexism", "Las mujeres no deberían ocupar puestos técnicos."],
    ["quoted-speech", "El portavoz afirmó"],
    ["neutral", "El museo abrirá"],
  ])("serves the %s fixture", async (fixture, expectedText) => {
    const app = await buildServer();
    servers.push(app);

    const response = await app.inject({
      method: "GET",
      url: `/fixtures/${fixture}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain(expectedText);
  });

  it("returns 404 for an unknown fixture", async () => {
    const app = await buildServer();
    servers.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/fixtures/unknown",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "fixture_not_found" });
  });
});
