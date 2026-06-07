import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — keep it server-side only
  serverExternalPackages: ["better-sqlite3"],
  // Fix turbopack root detection when parent has a package.json
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
