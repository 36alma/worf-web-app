import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';
import {WORF_DEVICE_TYPE} from '@/lib/utils/constants';

type WorfRequestOptions = {
  method?: string;
  body?: Record<string, any>;
  token?: string;
  query?: URLSearchParams;
};

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

export async function callWorfApi<T = unknown>(
  path: string,
  {method = 'POST', body, token, query}: WorfRequestOptions = {}
): Promise<{status: number; data: T}> {
  const apiBase = process.env.WORF_API_URL;

  if (!apiBase) {
    throw new Error('WORF_API_URL is not configured');
  }

  const url = new URL(path, apiBase.endsWith('/') ? apiBase : `${apiBase}/`);
  if (query) {
    url.search = query.toString();
  }

  const requestBody: Record<string, any> = {
    ...(body ?? {}),
    device_type: WORF_DEVICE_TYPE,
    ...(token ? {Bearer: token} : {})
  };

  const {status, text, contentType} = await sendJsonWithBody(url, method, requestBody);
  const trimmedText = text.trim();
  const isLikelyJson =
    contentType.toLowerCase().includes('json') || trimmedText.startsWith('{') || trimmedText.startsWith('[');

  let data = {} as T;
  if (trimmedText && isLikelyJson) {
    try {
      data = JSON.parse(trimmedText) as T;
    } catch {
      const extracted = tryExtractFirstJson(trimmedText);
      if (extracted) {
        try {
          data = JSON.parse(extracted) as T;
          console.warn(`[callWorfApi] Upstream JSON had trailing garbage for ${path}. Trimmed to first valid JSON value.`);
        } catch {
          console.warn(`[callWorfApi] Upstream returned non-recoverable JSON payload for ${path}.`);
          data = {} as T;
        }
      } else {
        console.warn(`[callWorfApi] Upstream returned invalid JSON payload for ${path}.`);
        data = {} as T;
      }
    }
  }

  return {status, data};
}
