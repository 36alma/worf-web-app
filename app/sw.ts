import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly } from "serwist";

// Declare the injection point for the precache manifest.
// `self.__SW_MANIFEST` is replaced at build time by @serwist/next.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// ═══════════════════════════════════════════════════════════════
// SECURITY: Filter out any default cache rules that could
// accidentally match API routes. This is a safety net on top of
// the explicit NetworkOnly rules defined below.
// ═══════════════════════════════════════════════════════════════
const safeDefaultCache = defaultCache.filter((entry) => {
  if (!("urlPattern" in entry)) {
    return true;
  }

  const pattern = entry.urlPattern;
  if (pattern instanceof RegExp) {
    // Drop rules whose regex would match /api/ or /v1/ paths
    return !pattern.test("/api/proxy/test") && !pattern.test("/v1/test");
  }
  return true;
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // ═══════════════════════════════════════════════════════════
    // CRITICAL — API routes must NEVER be cached.
    // All WORF API calls use POST with Bearer tokens in the body.
    // Using NetworkOnly ensures zero cache interaction.
    // ═══════════════════════════════════════════════════════════
    {
      urlPattern: /\/api\/.*/i,
      handler: new NetworkOnly(),
      method: "GET",
    },
    {
      urlPattern: /\/api\/.*/i,
      handler: new NetworkOnly(),
      method: "POST",
    },
    {
      urlPattern: /\/v1\/.*/i,
      handler: new NetworkOnly(),
      method: "GET",
    },
    {
      urlPattern: /\/v1\/.*/i,
      handler: new NetworkOnly(),
      method: "POST",
    },
    // ═══════════════════════════════════════════════════════════
    // Safe default caching for static assets (JS, CSS, images,
    // fonts, etc.) — these come from @serwist/next's defaults
    // with API-matching rules already filtered out above.
    // ═══════════════════════════════════════════════════════════
    ...safeDefaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
