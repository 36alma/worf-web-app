import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';

export interface RawBinaryResponse {
  status: number;
  contentType: string;
  cacheControl: string | undefined;
  body: Buffer;
}

/**
 * MIME types the thumbnail/preview routes are allowed to pass through verbatim
 * on their 200-status branch. The upstream backend is contractually image-only
 * for these endpoints, but its Content-Type header is otherwise attacker-adjacent
 * (a backend bug or misconfigured proxy could return something else) and this
 * response is served from the app's own first-party origin — so callers must
 * coerce anything outside this allowlist to 'application/octet-stream' rather
 * than reflecting the upstream header as-is, to prevent stored XSS via a browser
 * rendering unexpected bytes as HTML/script under this origin.
 */
export const ALLOWED_IMAGE_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/**
 * Like the raw GET helpers in app/api/files/dl/[token]/route.ts and
 * app/api/proxy/[...path]/route.ts, but keeps the response body as a
 * Buffer instead of decoding it as UTF-8 — required for binary image
 * bytes (image/webp thumbnails/previews), which UTF-8 decoding corrupts.
 * The 202 "pending"/"failed" JSON responses these endpoints also return
 * are still valid UTF-8, so callers can safely `JSON.parse(body.toString())`
 * on non-binary status codes.
 */
export function fetchUpstreamBinary(url: URL, headers: Record<string, string> = {}): Promise<RawBinaryResponse> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = client(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 500,
            contentType: (res.headers['content-type'] as string | undefined) ?? 'application/octet-stream',
            cacheControl: res.headers['cache-control'] as string | undefined,
            body: Buffer.concat(chunks),
          });
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}
