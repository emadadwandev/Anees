import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const proxy = auth((request) => {
  const pathname = request.nextUrl.pathname;
  const session = request.auth;
  if (pathname.startsWith('/api/auth') || pathname === '/login') return NextResponse.next();
  if (!session) return NextResponse.redirect(new URL('/login', request.url));
  if (session.user?.role !== 'super_admin') return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
  return NextResponse.next();
});

export default proxy;

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
