import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite acceder al dev server (HMR) desde la IP de red local, no solo localhost.
  allowedDevOrigins: ["192.168.119.1"],
  experimental: {
    serverActions: {
      // La respuesta del alumno a "requiere informacion" adjunta evidencia por
      // Server Action. El limite por defecto es 1 MB: un PDF escaneado no cabia
      // y la accion fallaba con un error opaco. Alineado con el maximo del
      // formulario de nueva solicitud.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
