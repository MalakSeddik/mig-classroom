import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Next.js's dev server rejects cross-origin requests by default (DNS-
  // rebinding protection), which silently breaks client hydration when
  // testing through a tunnel (cloudflared, ngrok, etc.) - the initial
  // HTML still renders, but the HMR websocket and hydration requests get
  // refused, so the page loads but nothing is interactive. Wildcarding
  // trycloudflare.com covers every quick-tunnel URL we generate (they're
  // random subdomains, a fresh one each run) without needing to hardcode
  // one specific hostname.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
