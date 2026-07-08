import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite acceder al dev server (HMR) desde la IP de red local, no solo localhost.
  allowedDevOrigins: ["192.168.119.1"],
};

export default nextConfig;
