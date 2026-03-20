import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';
  const baseDomain = process.env.BASE_DOMAIN ?? 'igeol.kr';

  // *.igeol.kr 서브도메인 요청 감지
  if (
    hostname.endsWith(`.${baseDomain}`) &&
    !hostname.startsWith('www.')
  ) {
    const subdomain = hostname.replace(`.${baseDomain}`, '');
    const { pathname, search } = request.nextUrl;

    // /s/{subdomain}{pathname} 으로 rewrite
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/s/${subdomain}${pathname === '/' ? '' : pathname}`;
    rewriteUrl.search = search;

    return NextResponse.rewrite(rewriteUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // API routes, static files, Next.js internals 제외
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
