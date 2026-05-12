import type { NextConfig } from "next";

const backendUrl =
  process.env.PIXELMEM_BACKEND_URL?.replace(/\/$/, "") || "http://localhost:8000";

const parsed = (() => {
  try {
    const u = new URL(backendUrl);
    return { hostname: u.hostname, port: u.port, protocol: u.protocol.replace(":", "") };
  } catch {
    return { hostname: "localhost", port: "8000", protocol: "http" };
  }
})();

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: parsed.protocol as "http" | "https",
        hostname: parsed.hostname,
        port: parsed.port,
      },
    ],
  },
};

export default nextConfig;
