import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { DefaultSession } from 'next-auth';
import { getJwtExpiryMs, isAccessTokenExpired, refreshAccessToken } from './auth-token';

const apiUrl = () => process.env.INTERNAL_API_URL ?? 'http://localhost:3000';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.ADMIN_NEXTAUTH_SECRET,
  pages: { signIn: '/login' },
  cookies: {
    sessionToken: {
      name: process.env.ADMIN_AUTH_COOKIE ?? 'anees-admin.session-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' },
    },
  },
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';
        if (!email || !password) return null;

        try {
          const response = await fetch(`${apiUrl()}/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ email, password }),
            cache: 'no-store',
          });
          if (!response.ok) return null;
          const data = await response.json();
          if (data?.user?.role !== 'super_admin' || typeof data?.accessToken !== 'string') return null;
          return {
            id: data.user.id,
            email: data.user.email,
            name: [data.user.firstName, data.user.lastName].filter(Boolean).join(' '),
            role: data.user.role,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            accessTokenExpiresAt: getJwtExpiryMs(data.accessToken),
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.accessToken = (user as { accessToken?: string }).accessToken;
        token.refreshToken = (user as { refreshToken?: string }).refreshToken;
        token.accessTokenExpiresAt = (user as { accessTokenExpiresAt?: number | null }).accessTokenExpiresAt;
      }
      const accessToken = token.accessToken as string | undefined;
      const refreshToken = token.refreshToken as string | undefined;
      const userId = token.sub;
      if (!accessToken || !refreshToken || !userId || !isAccessTokenExpired(accessToken)) return token;
      try {
        const refreshed = await refreshAccessToken({ userId, accessToken, refreshToken }, fetch, apiUrl());
        token.accessToken = refreshed.accessToken;
        token.refreshToken = refreshed.refreshToken;
        token.accessTokenExpiresAt = refreshed.accessTokenExpiresAt;
        delete token.error;
      } catch {
        token.error = 'RefreshAccessTokenError';
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.user.role = token.role as string;
      session.error = token.error as string | undefined;
      return session;
    },
  },
});

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    error?: string;
    user: { role: string } & DefaultSession['user'];
  }
}
