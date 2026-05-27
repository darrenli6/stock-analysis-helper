/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  // Standalone output bundles everything needed to run the server into .next/standalone.
  // Amplify Hosting detects this mode automatically.
  output: "standalone",
  // Tell Next.js file-system tracing to include the westock CLI package so it ends up
  // inside .next/standalone/node_modules/ and is available at SSR runtime.
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/westock-data-clawhub/**/*"],
  },
};

export default config;
