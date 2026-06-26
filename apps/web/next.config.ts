import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@ai-agent-platform/ui",
    "@ai-agent-platform/sdk",
    "@ai-agent-platform/shared",
    "@ai-agent-platform/types",
  ],
};

export default nextConfig;
