import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from '@/src/lib/db/client';
import { Adapter } from 'next-auth/adapters';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    // Credentials provider for email/password auth
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          return null;
        }

        // For demo purposes, create a demo user
        if (credentials.email === 'demo@taskmaster.ai' && credentials.password === 'demo123') {
          // Check if demo user exists, if not create it
          let user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email: credentials.email,
                name: 'Demo User',
                emailVerified: new Date(),
              },
            });

            // Create a default workspace for the demo user
            await prisma.workspace.create({
              data: {
                name: 'Demo Workspace',
                userId: user.id,
              },
            });
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        }

        return null;
      },
    }),

    // Google OAuth provider (ready for when you add credentials)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    async signIn({ user, account }) {
      // Auto-create workspace for new OAuth users
      if (account?.provider === 'google' && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { workspaces: true },
        });

        if (existingUser && existingUser.workspaces.length === 0) {
          await prisma.workspace.create({
            data: {
              name: `${user.name}'s Workspace`,
              userId: existingUser.id,
            },
          });
        }
      }
      return true;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};