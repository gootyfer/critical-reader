export interface ExtensionConfig {
  apiBaseUrl: string;
  analyzeEndpoint: string;
  publicSiteUrl: string;
  clientVersion: string;
}

export function createExtensionConfig(_input: {
  apiBaseUrl: string;
  clientVersion: string;
  production: boolean;
}): ExtensionConfig {
  const clientVersion = _input.clientVersion.trim();
  const rawBaseUrl = _input.apiBaseUrl.trim();
  if (!clientVersion || !rawBaseUrl) {
    throw new Error("Invalid extension configuration");
  }

  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    throw new Error("Invalid extension configuration");
  }

  const isOriginOnly =
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "" &&
    url.username === "" &&
    url.password === "";
  const isHttps = url.protocol === "https:";
  const isLocalDevelopment =
    !_input.production &&
    url.protocol === "http:" &&
    url.hostname === "127.0.0.1";

  if (
    !isOriginOnly ||
    url.hostname.includes("*") ||
    (!isHttps && !isLocalDevelopment)
  ) {
    throw new Error("Invalid extension configuration");
  }

  const apiBaseUrl = url.origin;
  return {
    apiBaseUrl,
    analyzeEndpoint: `${apiBaseUrl}/analyze`,
    publicSiteUrl: apiBaseUrl,
    clientVersion,
  };
}
