import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { SleeperClient } from "@/lib/sleeper/client";

// Extend NextAuth types
declare module "next-auth" {
  interface User {
    id: string;
    sleeperId: string;
    username: string;
    name?: string | null;
    image?: string | null;
  }

  interface Session {
    user: {
      id: string;
      sleeperId: string;
      username: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sleeperId: string;
    username: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Sleeper",
      credentials: {
        username: {
          label: "Sleeper Username",
          type: "text",
          placeholder: "Enter your Sleeper username",
        },
      },
      async authorize(credentials) {
        if (!credentials?.username) {
          return null;
        }

        const sleeper = new SleeperClient();
        const sleeperUser = await sleeper.getUser(credentials.username);

        if (!sleeperUser) {
          return null;
        }

        // Upsert user in database
        const user = await prisma.user.upsert({
          where: { sleeperId: sleeperUser.user_id },
          update: {
            sleeperUsername: sleeperUser.username,
            displayName: sleeperUser.display_name,
            avatar: sleeperUser.avatar,
            lastLoginAt: new Date(),
          },
          create: {
            sleeperId: sleeperUser.user_id,
            sleeperUsername: sleeperUser.username,
            displayName: sleeperUser.display_name,
            avatar: sleeperUser.avatar,
            lastLoginAt: new Date(),
          },
        });

        return {
          id: user.id,
          sleeperId: user.sleeperId,
          username: user.sleeperUsername,
          name: user.displayName,
          image: user.avatar
            ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}`
            : null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sleeperId = user.sleeperId;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.sleeperId = token.sleeperId;
        session.user.username = token.username;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
