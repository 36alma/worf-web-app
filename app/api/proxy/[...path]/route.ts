import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {NextRequest, NextResponse} from 'next/server';
import {getServerAccessToken} from '@/lib/utils/cookies';
import {normalizeGroupId} from '@/lib/utils/groupId';

type RawHttpResponse = {
  status: number;
  text: string;
  contentType: string;
};

const tryExtractFirstJson = (input: string): string | null => {
  const text = input.trim();
  if (!text) return null;
  const start = text[0];
  if (start !== '{' && start !== '[') return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{' || ch === '[') {
      depth += 1;
      continue;
    }

    if (ch === '}' || ch === ']') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(0, i + 1);
      }
    }
  }

  return null;
};

const normalizePossiblyBrokenJsonResponse = (
  text: string,
  contentType: string,
  requestLabel: string
): {text: string; contentType: string} => {
  const trimmed = text.trim();
  const likelyJson =
    contentType.toLowerCase().includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[');

  if (!trimmed || !likelyJson) {
    return {text, contentType};
  }

  try {
    const parsed = JSON.parse(trimmed);
    return {text: JSON.stringify(parsed), contentType: 'application/json'};
  } catch {
    const extracted = tryExtractFirstJson(trimmed);
    if (!extracted) {
      console.warn(`[Proxy] Upstream returned invalid JSON payload for ${requestLabel}`);
      return {text, contentType: 'text/plain; charset=utf-8'};
    }

    try {
      const parsed = JSON.parse(extracted);
      console.warn(`[Proxy] Upstream JSON had trailing garbage for ${requestLabel}. Trimmed to first valid JSON value.`);
      return {text: JSON.stringify(parsed), contentType: 'application/json'};
    } catch {
      console.warn(`[Proxy] Upstream returned non-recoverable JSON payload for ${requestLabel}`);
      return {text, contentType: 'text/plain; charset=utf-8'};
    }
  }
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

function sendJsonWithBody(
  url: URL,
  method: string,
  payload: Record<string, any>,
  headers: Record<string, string> = {}
): Promise<RawHttpResponse> {
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
          'Content-Length': Buffer.byteLength(data),
          ...headers
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
  const normalizedPath = joinedPath.startsWith('v1/') ? joinedPath.slice(3) : joinedPath;
  const shouldTranslatePostToGet =
    request.method === 'POST' &&
    (normalizedPath === 'group/permission' || normalizedPath === 'user/permission');
  const upstreamMethod = shouldTranslatePostToGet ? 'GET' : request.method;
  const targetUrl = new URL(
    `/v1/${normalizedPath}`,
    apiBase.endsWith('/') ? apiBase : `${apiBase}/`
  );
  targetUrl.search = request.nextUrl.search;

  const token = await getServerAccessToken();
  const input = await request.text();

  let parsedBody: Record<string, any> = {};
  if (input) {
    try {
      parsedBody = JSON.parse(input) as Record<string, any>;
    } catch {
      parsedBody = {};
    }
  }

  if (request.method === 'GET') {
    const queryPayload = getQueryPayload(request);
    parsedBody = {...parsedBody, ...queryPayload};
  }

  const payload: Record<string, any> = {
    ...parsedBody,
    ...(token ? {Bearer: token} : {})
  };

  // Normalise group_id: callers sometimes pass URL-encoded base64 ids (e.g.
  // %3D instead of =).  Decode so the value matches the raw database key.
  if (typeof payload.group_id === 'string') {
    payload.group_id = normalizeGroupId(payload.group_id);
  }

  const forwardedFor =
    request.headers.get('x-forwarded-for') ??
    request.headers.get('cf-connecting-ip') ??
    '127.0.0.1';




  const response = await sendJsonWithBody(targetUrl, upstreamMethod, payload, {
    ...(forwardedFor ? {'x-forwarded-for': forwardedFor} : {})
  });
  const normalizedResponse = normalizePossiblyBrokenJsonResponse(
    response.text,
    response.contentType,
    `${upstreamMethod} ${joinedPath}`
  );

  if (response.status >= 400) {
    console.error(`[Proxy] Backend error for ${upstreamMethod} ${joinedPath}:`, response.status, response.text);
  }

  return new NextResponse(normalizedResponse.text, {
    status: response.status,
    headers: {
      'Content-Type': normalizedResponse.contentType
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
