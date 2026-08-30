import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Next's server action default is 1 MB. Checkout accepts receipt
      // images up to 5 MB (src/app/checkout/actions.ts), so the default
      // silently 500s on any real phone screenshot over ~1 MB — found live
      // in the dev server log, not by design review. 8 MB leaves headroom
      // for multipart form overhead above the file itself.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
