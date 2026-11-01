import { afterEach, describe, expect, it } from "vitest";

import { buildServer } from "../server.js";
import type { ServerPolicy } from "../server-policy.js";

const servers: Awaited<ReturnType<typeof buildServer>>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

const productionPolicy: ServerPolicy = {
  production: true,
  analysisEnabled: true,
  allowedExtensionOrigins: ["chrome-extension://valid"],
  requiredClientVersion: "0.2.0",
  fixturesEnabled: false,
  bodyLimitBytes: 128 * 1024,
};

describe("fixture routes", () => {
  it("does not register fixtures when production policy disables them", async () => {
    const app = await buildServer({ policy: productionPolicy });
    servers.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/fixtures/clear-sexism",
    });

    expect(response.statusCode).toBe(404);
  });
});
