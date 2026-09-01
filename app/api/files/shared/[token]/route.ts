import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import { NextRequest, NextResponse } from 'next/server';

// fetchUpstreamBinary (Task 10) doesn't surface redirect Location headers —
// it's built for 200/202 binary/JSON bodies. This route needs the Location
// header instead of a body, so it uses a small local variant rather than
// changing fetchUpstreamBinary's contract (which Tasks 10/33's thumbnail
// and preview routes both already depend on as-is).
function fetchUpstreamBinaryWithRedirectCapture(url: URL, headers: Record<string, string>): Promise<{status: number; location?: string}> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = client({protocol: url.protocol, hostname: url.hostname, port: url.port, path: `${url.pathname}${url.search}`, method: 'GET', headers}, (res) => {
      res.resume(); // discard body, we only need status + location
      res.on('end', () => resolve({status: res.statusCode ?? 500, location: res.headers.location}));
    });
    req.on('error', reject);
    req.end();
  });
}

export async function POST(request: NextRequest, context: {params: Promise<{token: string}>}) {
  const apiBase = process.env.WORF_API_URL;
  if (!apiBase) {
    return NextResponse.json({detail: 'WORF_API_URL is not configured'}, {status: 500});
  }

  const {token} = await context.params;
  const body = (await request.json().catch(() => ({}))) as {password?: string};

  const targetUrl = new URL(`/v1/files/shared/${encodeURIComponent(token)}`, apiBase.endsWith('/') ? apiBase : `${apiBase}/`);
  const forwardedFor = request.headers.get('x-forwarded-for') ?? request.headers.get('cf-connecting-ip') ?? '127.0.0.1';

  // fetchUpstreamBinary issues a plain GET — the backend endpoint itself is a
  // GET that reads the optional password from a header, matching spec §7.
  // We only add the X-Share-Password header when present, keeping the
  // password out of any URL/query string on both legs of this request.
  const response = await fetchUpstreamBinaryWithRedirectCapture(targetUrl, {
    'x-forwarded-for': forwardedFor,
    ...(body.password ? {'X-Share-Password': body.password} : {}),
  });

  if (response.status >= 300 && response.status < 400 && response.location) {
    return NextResponse.json({ redirectUrl: response.location });
  }

  return NextResponse.json({detail: 'Link is no longer valid.'}, {status: 404});
}
