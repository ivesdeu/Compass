import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async headers() {
    // In dev, allow the static dashboard (any localhost port / file server) to embed /chat.
    // In production, restrict to known hosts (add your dashboard origin if you iframe embed).
    if (process.env.NODE_ENV !== "production") {
      return []
    }
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://ivesdeu.netlify.app https://21st.dev https://www.21st.dev;",
          },
        ],
      },
    ]
  },
}

export default nextConfig
