import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit loads its standard-font .afm files from disk at runtime;
  // bundling it with webpack strips those files out, so it must be
  // required directly from node_modules instead.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
