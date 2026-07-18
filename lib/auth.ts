import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// A valid bcrypt hash to compare against when no user is found, so a login
// attempt takes the same time whether or not the account exists (defeats
// timing-based account enumeration). It is not the hash of any real password.
const DUMMY_PASSWORD_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        const user = await prisma.user.findUnique({
          where: {
            // Emails are stored lowercased at signup — normalize before lookup
            // so mixed-case sign-in attempts still match.
            email: credentials.email.toLowerCase(),
          },
          include: {
            business: true,
          },
        });

        // Always run one bcrypt comparison — against the real hash if the user
        // exists, else a dummy — so response time doesn't reveal whether the
        // account exists (timing enumeration).
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user?.password ?? DUMMY_PASSWORD_HASH
        );

        if (!user || !user.password || !isPasswordValid) {
          throw new Error('Invalid credentials');
        }

        // Account-state checks run ONLY after the password is verified, so their
        // distinct messages can't be used to enumerate accounts or their state.
        if (!user.isActive) {
          throw new Error('This account has been deactivated. Please contact support.');
        }

        if (!user.emailVerified) {
          throw new Error('Please verify your email before signing in. Check your inbox for the verification link.');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId: user.business?.id,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.businessId = token.businessId as string | undefined;
      }
      return session;
    },
  },
};
