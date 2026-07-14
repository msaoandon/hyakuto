// Single point of env access — every variable the service reads is named here
// (and in .env.example), so a missing value fails loudly with a pointer instead
// of surfacing as a mystery deep in a request.

/** Origins allowed to receive login codes and make CORS requests (the app). */
export function appOrigins(): string[] {
  return (process.env.APP_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set (openssl rand -base64 32) — see apps/api/.env.example");
  }
  return secret;
}
