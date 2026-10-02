import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Il server di produzione gira in un container: `standalone` produce
  // `.next/standalone/server.js` con le sole dipendenze tracciate, così
  // l'immagine non si porta dietro `node_modules` intero.
  output: "standalone",
  experimental: {
    serverActions: {
      // Le foto arrivano con il form della ricetta, e quelle di un telefono
      // superano facilmente il megabyte predefinito. Il limite vero (10 MB per
      // foto) lo controlla `src/lib/photos.ts`; qui c'è un po' di margine per
      // il resto del form.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
