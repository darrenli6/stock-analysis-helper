/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  // Tell Next.js file-system tracing to include westock in the nft.json manifests for all
  // API routes. Amplify Hosting reads these manifests to populate the SSR Lambda bundle,
  // so westock will be available at process.cwd()/node_modules/… at runtime.
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/westock-data-clawhub/**/*"],
  },
};

export default config;
