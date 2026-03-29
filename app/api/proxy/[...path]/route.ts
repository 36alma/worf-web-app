import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {NextRequest, NextResponse} from 'next/server';
import {getServerAccessToken} from '@/lib/utils/cookies';

type RawHttpResponse = {
  status: number;
  text: string;
  contentType: string;
};

const normalizeQueryValue = (value: string): unknown => {
  const lowered = value.toLowerCase();

  if (lowered === 'none' || lowered === 'null') {
    return null;
  }

  return value;
};

const getQueryPayload = (request: NextRequest): Record<string, unknown> => {
  const queryPayload: Record<string, unknown> = {};

  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    const normalizedValue = normalizeQueryValue(value);
    const currentValue = queryPayload[key];

    if (typeof currentValue === 'undefined') {
      queryPayload[key] = normalizedValue;
      continue;
    }

    if (Array.isArray(currentValue)) {
      currentValue.push(normalizedValue);
      queryPayload[key] = currentValue;
      continue;
    }

    queryPayload[key] = [currentValue, normalizedValue];
  }

  return queryPayload;
};

function sendJsonWithBody(url: URL, method: string, payload: Record<string, any>): Promise<RawHttpResponse> {
  const data = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = client(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 500,
            text: Buffer.concat(chunks).toString('utf8'),
            contentType: (res.headers['content-type'] as string | undefined) ?? 'application/json'
          });
        });
      }
    );

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function handleProxy(request: NextRequest, params: {path: string[]}) {
  const apiBase = process.env.WORF_API_URL;
  if (!apiBase) {
    return NextResponse.json({message: 'WORF_API_URL is not configured'}, {status: 500});
  }

  const joinedPath = params.path.join('/');
  const targetUrl = new URL(
    `/v1/${joinedPath}`.replace('/v1/v1/', '/v1/'),
    apiBase.endsWith('/') ? apiBase : `${apiBase}/`
  );
  targetUrl.search = request.nextUrl.search;

  const token = await getServerAccessToken();
  const input = await request.text();

  let parsedBody: Record<string, any> = {};
  if (request.method === 'GET') {
    parsedBody = getQueryPayload(request);
  } else if (input) {
    try {
      parsedBody = JSON.parse(input) as Record<string, any>;
    } catch {
      parsedBody = {};
    }
  }

  const payload: Record<string, any> = {
    ...parsedBody,
    ...(token ? {Bearer: token} : {})
  };

  const response = await sendJsonWithBody(targetUrl, request.method, payload);

  if (response.status >= 400) {
    console.error(`[Proxy] Backend error for ${request.method} ${joinedPath}:`, response.status, response.text);
  }

  return new NextResponse(response.text, {
    status: response.status,
    headers: {
      'Content-Type': response.contentType
    }
  });
}

export async function GET(request: NextRequest, context: {params: Promise<{path: string[]}>}) {
  const params = await context.params;
  return handleProxy(request, params);
}

export async function POST(request: NextRequest, context: {params: Promise<{path: string[]}>}) {
  const params = await context.params;
  return handleProxy(request, params);
}

export async function PUT(request: NextRequest, context: {params: Promise<{path: string[]}>}) {
  const params = await context.params;
  return handleProxy(request, params);
}

export async function PATCH(request: NextRequest, context: {params: Promise<{path: string[]}>}) {
  const params = await context.params;
  return handleProxy(request, params);
}

export async function DELETE(request: NextRequest, context: {params: Promise<{path: string[]}>}) {
  const params = await context.params;
  return handleProxy(request, params);
}
