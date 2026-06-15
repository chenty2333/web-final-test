import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(webRoot, "../..");
const buildRoot = existsSync(resolve(repositoryRoot, "package.json")) ? repositoryRoot : webRoot;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: buildRoot,
  turbopack: {
    root: buildRoot,
  },
};

export default nextConfig;
