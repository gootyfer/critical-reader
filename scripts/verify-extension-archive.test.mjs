import assert from "node:assert/strict";
import test from "node:test";

import { assertReleaseArchive } from "./verify-extension-archive.mjs";

const productionOrigin = "https://critical-reader-api.vercel.app";

const validEntries = () =>
  new Map([
    [
      "manifest.json",
      JSON.stringify({
        manifest_version: 3,
        name: "Critical Reader BETA",
        version: "0.2.0",
        permissions: ["activeTab", "scripting", "storage"],
        host_permissions: [`${productionOrigin}/*`],
        background: { service_worker: "background.js" },
        content_scripts: [{ js: ["content-scripts/analyze.js"] }],
        icons: {
          16: "icon/16.png",
          32: "icon/32.png",
          48: "icon/48.png",
          128: "icon/128.png",
        },
        action: {
          default_icon: {
            16: "icon/16.png",
            32: "icon/32.png",
            48: "icon/48.png",
            128: "icon/128.png",
          },
        },
      }),
    ],
    ["background.js", "const api = 'https://critical-reader-api.vercel.app';"],
    ["content-scripts/analyze.js", "console.info('Critical Reader');"],
    ["icon/16.png", Buffer.from("png")],
    ["icon/32.png", Buffer.from("png")],
    ["icon/48.png", Buffer.from("png")],
    ["icon/128.png", Buffer.from("png")],
  ]);

test("accepts only a complete production extension bundle", () => {
  assert.doesNotThrow(() => assertReleaseArchive(validEntries(), productionOrigin));
});

for (const [label, mutate] of [
  ["secret", (entries) => entries.set("background.js", "const key = 'sk-example';")],
  ["environment file", (entries) => entries.set(".env", "OPENAI_API_KEY=nope")],
  ["source map", (entries) => entries.set("background.js.map", "{}")],
  ["localhost", (entries) => entries.set("background.js", "fetch('http://localhost:8787')")],
  ["loopback IP", (entries) => entries.set("background.js", "fetch('http://127.0.0.1:8787')")],
  [
    "wildcard host permission",
    (entries) => {
      const manifest = JSON.parse(entries.get("manifest.json"));
      manifest.host_permissions = ["<all_urls>"];
      entries.set("manifest.json", JSON.stringify(manifest));
    },
  ],
  ["unexpected file", (entries) => entries.set("developer-notes.txt", "private")],
]) {
  test(`rejects an archive containing ${label}`, () => {
    const entries = validEntries();
    mutate(entries);

    assert.throws(() => assertReleaseArchive(entries, productionOrigin));
  });
}

for (const requiredPath of [
  "manifest.json",
  "background.js",
  "content-scripts/analyze.js",
  "icon/16.png",
  "icon/32.png",
  "icon/48.png",
  "icon/128.png",
]) {
  test(`rejects an archive without ${requiredPath}`, () => {
    const entries = validEntries();
    entries.delete(requiredPath);

    assert.throws(() => assertReleaseArchive(entries, productionOrigin));
  });
}

test("rejects a placeholder or mismatched API origin", () => {
  assert.throws(() =>
    assertReleaseArchive(validEntries(), "https://critical-reader.invalid"),
  );
});

test("rejects an empty required asset", () => {
  const entries = validEntries();
  entries.set("icon/128.png", Buffer.alloc(0));

  assert.throws(() => assertReleaseArchive(entries, productionOrigin));
});
