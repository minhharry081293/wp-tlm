import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tlm/db", "@tlm/jobs", "@tlm/shared"],
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
