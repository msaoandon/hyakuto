import type { AuthConfig } from "@auth/core";
import type { Provider } from "@auth/core/providers";
import Google from "@auth/core/providers/google";
import Discord from "@auth/core/providers/discord";
import { prisma } from "../db";
import { authSecret } from "../env";

// Auth.js (@auth/core) does exactly one job here: the OAuth dance — state,
// PKCE, code exchange, profile fetch. It does NOT own sessions (its cookie
// model is what the backend-shape decision rejected for a static Capacitor
// client) and it does NOT own the user table (our identity root is Player,
// which already owns the saves — the @auth/prisma-adapter would impose a
// second root). Its JWT-strategy cookie lives only for the seconds between
// the provider callback and /v1/auth/complete, where it is traded for a
// single-use login code (see routes.ts).

/** What our session/jwt callbacks stamp into the (short-lived) Auth.js token. */
export type DanceSession = {
  playerId: string;
  provider: string;
  providerAccountId: string;
};

function providers(): Provider[] {
  const list: Provider[] = [];
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    list.push(
      Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }),
    );
  }
  if (process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET) {
    list.push(
      Discord({ clientId: process.env.AUTH_DISCORD_ID, clientSecret: process.env.AUTH_DISCORD_SECRET }),
    );
  }
  // A generic OIDC provider pointed at a local mock issuer, so the FULL dance
  // (start → authorize → callback → complete → token) runs in CI with no real
  // Google account. Never available in production.
  if (process.env.AUTH_TEST_ISSUER && process.env.NODE_ENV !== "production") {
    list.push({
      id: "test",
      name: "Test OIDC",
      type: "oidc",
      issuer: process.env.AUTH_TEST_ISSUER,
      clientId: "hyakuto-test",
      clientSecret: "hyakuto-test-secret",
    });
  }
  return list;
}

export function buildAuthConfig(): AuthConfig {
  return {
    secret: authSecret(),
    basePath: "/v1/auth",
    trustHost: true, // local-only in Phase 3; the host IS localhost
    session: { strategy: "jwt" },
    providers: providers(),
    callbacks: {
      // Persist the verified identity against OUR model: link the provider
      // account to a Player. Email stays nullable end-to-end — Apple hides the
      // real address behind a relay, so nothing may ever assume one exists.
      async signIn({ user, account }) {
        if (!account) return false;
        const key = { provider: account.provider, providerAccountId: account.providerAccountId };
        const identity = { email: user.email ?? null, displayName: user.name ?? null };
        await prisma.authAccount.upsert({
          where: { provider_providerAccountId: key },
          update: identity, // refresh what the provider shows us
          create: { ...key, ...identity, player: { create: {} } },
        });
        return true;
      },
      // Stamp the linkage into the JWT on the sign-in request (the only call
      // where `account` is present) so /complete can read it back statelessly.
      async jwt({ token, account }) {
        if (account) {
          const key = { provider: account.provider, providerAccountId: account.providerAccountId };
          const row = await prisma.authAccount.findUniqueOrThrow({
            where: { provider_providerAccountId: key },
          });
          token.playerId = row.playerId;
          token.provider = account.provider;
          token.providerAccountId = account.providerAccountId;
        }
        return token;
      },
      async session({ session, token }) {
        return Object.assign(session, {
          playerId: token.playerId,
          provider: token.provider,
          providerAccountId: token.providerAccountId,
        });
      },
    },
  };
}
