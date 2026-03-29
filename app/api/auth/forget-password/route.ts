import {NextRequest} from 'next/server';
import {jsonWithStatus} from '@/lib/server/auth';
import {callWorfApi} from '@/lib/server/worf';

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const {status, data} = await callWorfApi('/v1/auth/forget-password', {
    method: 'POST',
    body: payload
  });

  return jsonWithStatus(data, status);
}

