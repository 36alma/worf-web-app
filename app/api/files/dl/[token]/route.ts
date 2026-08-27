import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {NextRequest, NextResponse} from 'next/server';

type RawRedirectResponse = {
  status: number;
  location: string | undefined;
  text: string;
  contentType: string;
};

function sendRawGet(url: URL, headers: Record<string, string> = {}): Promise<RawRedirectResponse> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = client(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 500,
            location: res.headers.location,
            text: Buffer.concat(chunks).toString('utf8'),
            contentType: (res.headers['content-type'] as string | undefined) ?? 'application/json'
          });
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

export async function GET(
  request: NextRequest,
  context: {params: Promise<{token: string}>}
) {
  const apiBase = process.env.WORF_API_URL;
  if (!apiBase) {
    return NextResponse.json({message: 'WORF_API_URL is not configured'}, {status: 500});
  }

  const {token} = await context.params;
  const targetUrl = new URL(
    `/v1/files/dl/${encodeURIComponent(token)}`,
    apiBase.endsWith('/') ? apiBase : `${apiBase}/`
  );

  const forwardedFor =
    request.headers.get('x-forwarded-for') ??
    request.headers.get('cf-connecting-ip') ??
    '127.0.0.1';

  const response = await sendRawGet(targetUrl, {
    ...(forwardedFor ? {'x-forwarded-for': forwardedFor} : {})
  });

  if (response.status >= 300 && response.status < 400 && response.location) {
    return NextResponse.redirect(response.location, response.status);
  }

  return new NextResponse(response.text, {
    status: response.status,
    headers: {
      'Content-Type': response.contentType
    }
  });
}
