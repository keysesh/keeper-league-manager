import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
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
    discordId?: string | null;
    discordUsername?: string | null;
  }

  interface Session {
    user: {
      id: string;
      sleeperId: string;
      username: string;
      name?: string | null;
      image?: string | null;
      discordId?: string | null;
      discordUsername?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sleeperId?: string;
    username?: string;
    discordId?: string | null;
    discordUsername?: string | null;
    needsSleeperLink?: boolean;
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
        email: {
          label: "Email",
          type: "email",
          placeholder: "Enter your email",
        },
        isRegistration: {
          label: "Is Registration",
          type: "text",
        },
      },
      async authorize(credentials) {
        if (!credentials?.username) {
          return null;
        }

        const sleeper = new SleeperClient();
        const sleeperUser = await sleeper.getUser(credentials.username);

        if (!sleeperUser) {
          throw new Error("INVALID_USERNAME");
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { sleeperId: sleeperUser.user_id },
        });

        const isRegistration = credentials.isRegistration === "true";
        const email = credentials.email?.toLowerCase().trim();

        // REGISTRATION FLOW
        if (isRegistration) {
          if (!email) {
            throw new Error("EMAIL_REQUIRED");
          }

          // Check if this Sleeper account is already registered
          if (existingUser?.email) {
            throw new Error("USERNAME_CLAIMED");
          }

          // Check if email is already used
          const emailExists = await prisma.user.findUnique({
            where: { email },
          });
          if (emailExists) {
            throw new Error("EMAIL_IN_USE");
          }

          // Create or update user with email
          const user = await prisma.user.upsert({
            where: { sleeperId: sleeperUser.user_id },
            update: {
              email,
              sleeperUsername: sleeperUser.username,
              displayName: sleeperUser.display_name,
              avatar: sleeperUser.avatar,
              lastLoginAt: new Date(),
            },
            create: {
              email,
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
        }

        // LOGIN FLOW
        if (!existingUser) {
          throw new Error("NOT_REGISTERED");
        }

        if (!existingUser.email) {
          throw new Error("NOT_REGISTERED");
        }

        // Verify email matches
        if (email && existingUser.email !== email) {
          throw new Error("EMAIL_MISMATCH");
        }

        // Update login time
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            sleeperUsername: sleeperUser.username,
            displayName: sleeperUser.display_name,
            avatar: sleeperUser.avatar,
            lastLoginAt: new Date(),
          },
        });

        return {
          id: existingUser.id,
          sleeperId: existingUser.sleeperId,
          username: existingUser.sleeperUsername,
          name: existingUser.displayName,
          image: existingUser.avatar
            ? `https://sleepercdn.com/avatars/thumbs/${existingUser.avatar}`
            : null,
        };
      },
    }),
    // Discord OAuth provider
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "identify email",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle Discord sign-in
      if (account?.provider === "discord") {
        const discordProfile = profile as { id: string; username: string; avatar?: string };

        // Check if this Discord account is already linked to a user
        const existingUser = await prisma.user.findUnique({
          where: { discordId: discordProfile.id },
        });

        if (existingUser) {
          // Update Discord info and allow sign in
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              discordUsername: discordProfile.username,
              discordAvatar: discordProfile.avatar,
              lastLoginAt: new Date(),
            },
          });
          return true;
        }

        // Discord not linked yet - redirect to linking page
        // Store Discord info in token for linking later
        return `/link-sleeper?discordId=${discordProfile.id}&discordUsername=${encodeURIComponent(discordProfile.username)}`;
      }

      return true;
    },
    async jwt({ token, user, account, profile }) {
      // Initial sign in with credentials
      if (user && account?.provider === "credentials") {
        token.sleeperId = user.sleeperId;
        token.username = user.username;
        token.discordId = user.discordId;
        token.discordUsername = user.discordUsername;
      }

      // Initial sign in with Discord (already linked user)
      if (account?.provider === "discord") {
        const discordProfile = profile as { id: string; username: string };
        const linkedUser = await prisma.user.findUnique({
          where: { discordId: discordProfile.id },
        });

        if (linkedUser) {
          token.sub = linkedUser.id;
          token.sleeperId = linkedUser.sleeperId;
          token.username = linkedUser.sleeperUsername;
          token.discordId = linkedUser.discordId;
          token.discordUsername = linkedUser.discordUsername;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.sleeperId = token.sleeperId || "";
        session.user.username = token.username || "";
        session.user.discordId = token.discordId;
        session.user.discordUsername = token.discordUsername;
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
