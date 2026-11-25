import { createHash, timingSafeEqual } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';

const digest = (value: string) => createHash('sha256').update(value).digest();
const noStore = 'private, no-store';

export function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV !== 'production') return NextResponse.next();
    return new NextResponse('Dashboard access is not configured.', {
      status: 503,
      headers: { 'Cache-Control': noStore },
    });
  }

  const expected = 'Basic ' + Buffer.from(`agency:${password}`).toString('base64');
  if (!timingSafeEqual(digest(request.headers.get('authorization') ?? ''), digest(expected))) {
    return new NextResponse('Authentication required.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Agency Desk", charset="UTF-8"',
        'Cache-Control': noStore,
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set('Cache-Control', noStore);
  return response;
}

export const config = {
  matcher: '/((?!_next/static/).*)',
};
