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
            text: Buffer.concat(chunks).toString('utf8')
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

  const {status, text} = await sendJsonWithBody(url, method, requestBody);
  const data = text ? (JSON.parse(text) as T) : ({} as T);

  return {status, data};
}
