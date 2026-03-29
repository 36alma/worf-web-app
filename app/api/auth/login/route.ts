import {NextResponse} from 'next/server';

export async function POST() {
  return NextResponse.json(
    {message: 'Direct auth login is disabled. Use GET /api/auth/oauth/login redirect flow.'},
    {status: 405}
  );
}
