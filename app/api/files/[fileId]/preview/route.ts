import {NextRequest, NextResponse} from 'next/server';
import {ALLOWED_IMAGE_CONTENT_TYPES, fetchUpstreamBinary} from '@/lib/server/rawBinaryProxy';
import {getServerAccessToken} from '@/lib/utils/cookies';

export async function GET(request: NextRequest, context: {params: Promise<{fileId: string}>}) {
  const apiBase = process.env.WORF_API_URL;
  if (!apiBase) {
    return NextResponse.json({message: 'WORF_API_URL is not configured'}, {status: 500});
  }

  const {fileId} = await context.params;
  const token = await getServerAccessToken();
  if (!token) {
    return NextResponse.json({detail: 'Authentication required.'}, {status: 401});
  }

  const targetUrl = new URL(
    `/v1/files/${encodeURIComponent(fileId)}/preview`,
    apiBase.endsWith('/') ? apiBase : `${apiBase}/`
  );

  const forwardedFor =
    request.headers.get('x-forwarded-for') ?? request.headers.get('cf-connecting-ip') ?? '127.0.0.1';

  const response = await fetchUpstreamBinary(targetUrl, {
    Authorization: `Bearer ${token}`,
    'x-forwarded-for': forwardedFor,
  });

  if (response.status === 202) {
    // {"status": "pending" | "failed"} — small, valid JSON, safe to decode.
    return new NextResponse(response.body.toString('utf8'), {
      status: 202,
      headers: {'Content-Type': 'application/json'},
    });
  }

  if (response.status !== 200) {
    return new NextResponse(response.body.toString('utf8'), {
      status: response.status,
      headers: {'Content-Type': response.contentType},
    });
  }

  const baseContentType = response.contentType.split(';')[0].trim();
  const safeContentType = ALLOWED_IMAGE_CONTENT_TYPES.has(baseContentType)
    ? response.contentType
    : 'application/octet-stream';

  return new NextResponse(new Uint8Array(response.body), {
    status: 200,
    headers: {
      'Content-Type': safeContentType,
      'Cache-Control': response.cacheControl ?? 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
}
