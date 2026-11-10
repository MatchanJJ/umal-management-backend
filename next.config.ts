import type { NextConfig } from "next";

// Static export only (TRD §4). Rewrites are unsupported with `output: 'export'`,
// so the /api proxy to `wrangler pages dev` exists only under `next dev`.
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  ...(isDev ? {} : { output: "export" as const }),
  images: { unoptimized: true },
  trailingSlash: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(isDev
    ? {
        async rewrites() {
          return [{ source: "/api/:path*", destination: "http://localhost:8788/api/:path*" }];
        },
      }
    : {}),
};

export default nextConfig;
