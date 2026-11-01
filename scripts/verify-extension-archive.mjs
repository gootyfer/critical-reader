import { readdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const requiredPaths = [
  "manifest.json",
  "background.js",
  "content-scripts/analyze.js",
  "icon/16.png",
  "icon/32.png",
  "icon/48.png",
  "icon/128.png",
];

const allowedPathPatterns = [
  /^manifest\.json$/u,
  /^background\.js$/u,
  /^content-scripts\/[A-Za-z0-9._-]+\.(?:js|css)$/u,
  /^chunks\/[A-Za-z0-9._-]+\.js$/u,
  /^icon\/(?:16|32|48|128)\.png$/u,
];

const textPathPattern = /\.(?:css|html|js|json)$/u;
const dangerousContentPatterns = [
  /sk-[A-Za-z0-9_-]{3,}/u,
  /(?:localhost|127\.0\.0\.1)(?::\d+)?/iu,
  /(?:import\s*\(|from\s+|src\s*=\s*)["']https?:\/\//iu,
];

const parseProductionOrigin = (value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("WXT_API_BASE_URL must be a valid production URL");
  }

  if (
    url.protocol !== "https:" ||
    url.origin !== value ||
    !url.hostname.endsWith(".vercel.app")
  ) {
    throw new Error("WXT_API_BASE_URL must be the exact production vercel.app origin");
  }

  return url.origin;
};

export const assertReleaseArchive = (entries, expectedOrigin) => {
  const origin = parseProductionOrigin(expectedOrigin);

  for (const path of requiredPaths) {
    const value = entries.get(path);
    if (value === undefined) throw new Error(`Missing required file: ${path}`);
    if (Buffer.byteLength(value) === 0) throw new Error(`Empty required file: ${path}`);
  }

  for (const [path, value] of entries) {
    if (
      path.startsWith("/") ||
      path.startsWith("-") ||
      path.split("/").includes("..") ||
      !allowedPathPatterns.some((pattern) => pattern.test(path))
    ) {
      throw new Error(`Unexpected archive file: ${path}`);
    }
    if (path.endsWith(".map") || /(?:^|\/)\.env(?:\.|$)/u.test(path)) {
      throw new Error(`Forbidden archive file: ${path}`);
    }

    if (textPathPattern.test(path)) {
      const text = Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
      if (dangerousContentPatterns.some((pattern) => pattern.test(text))) {
        throw new Error(`Forbidden content in: ${path}`);
      }
    }
  }

  let manifest;
  try {
    manifest = JSON.parse(String(entries.get("manifest.json")));
  } catch {
    throw new Error("manifest.json must contain valid JSON");
  }

  if (
    manifest.name !== "Critical Reader BETA" ||
    manifest.version !== "0.2.0" ||
    JSON.stringify(manifest.permissions) !==
      JSON.stringify(["activeTab", "scripting", "storage"]) ||
    JSON.stringify(manifest.host_permissions) !==
      JSON.stringify([`${origin}/*`]) ||
    manifest.background?.service_worker !== "background.js"
  ) {
    throw new Error("Manifest release metadata is not exact");
  }

  for (const size of [16, 32, 48, 128]) {
    if (
      manifest.icons?.[size] !== `icon/${size}.png` ||
      manifest.action?.default_icon?.[size] !== `icon/${size}.png`
    ) {
      throw new Error(`Manifest icon ${size} is not exact`);
    }
  }
};

const readArchive = (archivePath) => {
  const listing = spawnSync("unzip", ["-Z1", archivePath], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (listing.status !== 0) throw new Error("Could not list extension archive");

  const paths = listing.stdout.split(/\r?\n/u).filter(Boolean);
  if (new Set(paths).size !== paths.length) {
    throw new Error("Archive contains duplicate file names");
  }

  for (const path of paths) {
    if (path.startsWith("/") || path.startsWith("-") || path.split("/").includes("..")) {
      throw new Error(`Unsafe archive path: ${path}`);
    }
  }

  const files = paths.filter((path) => !path.endsWith("/"));

  return new Map(
    files.map((path) => {
      const extracted = spawnSync("unzip", ["-p", archivePath, path], {
        maxBuffer: 20 * 1024 * 1024,
      });
      if (extracted.status !== 0) throw new Error(`Could not read archive file: ${path}`);
      return [path, extracted.stdout];
    }),
  );
};

const findLatestArchive = async (root) => {
  const candidates = (await readdir(root))
    .filter((name) => name.endsWith(".zip"))
    .map((name) => resolve(root, name));
  if (candidates.length === 0) throw new Error("No extension ZIP found; run pnpm zip:extension first");

  const dated = await Promise.all(
    candidates.map(async (path) => ({ path, modified: (await stat(path)).mtimeMs })),
  );
  dated.sort((left, right) => right.modified - left.modified);
  return dated[0].path;
};

const main = async () => {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const archivePath = process.argv[2]
    ? resolve(process.argv[2])
    : await findLatestArchive(resolve(repositoryRoot, "apps/extension/.output"));
  const expectedOrigin = process.env.WXT_API_BASE_URL ?? "";

  assertReleaseArchive(readArchive(archivePath), expectedOrigin);
  console.log(`Release archive verified: ${archivePath}`);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Archive verification failed");
    process.exitCode = 1;
  });
}
