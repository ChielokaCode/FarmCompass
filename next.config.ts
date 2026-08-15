import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {},
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Do not set a geolocation Permissions-Policy directive here.
          // Geolocation's browser default allowlist is `self`, which is exactly
          // what FarmCompass needs. Omitting it also prevents an app-level
          // policy from overriding a farmer's browser Location permission.
          { key: "Permissions-Policy", value: "camera=(self), microphone=()" }
        ]
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }
        ]
      }
    ];
  }
};

export default nextConfig;
