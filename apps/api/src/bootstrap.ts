import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createArticleAnalyzer } from "./analyzers/create-analyzer.js";
import { loadApiConfig } from "./config.js";
import { buildServer } from "./app-server.js";
import { loadServerPolicy } from "./server-policy.js";

export const API_ENV_PATH = fileURLToPath(new URL("../.env", import.meta.url));

interface EnvLoaderDependencies {
  existsSync: (path: string) => boolean;
  loadEnvFile: (path: string) => void;
}

const defaultEnvLoaderDependencies: EnvLoaderDependencies = {
  existsSync,
  loadEnvFile: process.loadEnvFile,
};

export const loadLocalEnv = (
  path = API_ENV_PATH,
  dependencies: EnvLoaderDependencies = defaultEnvLoaderDependencies,
): void => {
  if (dependencies.existsSync(path)) dependencies.loadEnvFile(path);
};

export const createConfiguredServer = async (
  env: NodeJS.ProcessEnv,
  options: { logger?: boolean } = {},
) => {
  const configured = createArticleAnalyzer(loadApiConfig(env));
  return buildServer({
    analyzer: configured.analyzer,
    analyzerName: configured.name,
    policy: loadServerPolicy(env),
    ...(options.logger === undefined ? {} : { logger: options.logger }),
  });
};
