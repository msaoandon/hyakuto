import type { Hono } from "hono";

// Shared plumbing for driving the app in-process.

export async function newGuest(app: Hono): Promise<string> {
  const res = await app.request("/v1/auth/guest", { method: "POST" });
  if (res.status !== 201) throw new Error(`guest issuance failed: ${res.status}`);
  return ((await res.json()) as { token: string }).token;
}

export const authed = (token: string) => ({ authorization: `Bearer ${token}` });

/** A minimal browser-cookie jar for walking the OAuth redirect chain. */
export class CookieJar {
  private cookies = new Map<string, string>();

  collect(res: Response): void {
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const eq = pair!.indexOf("=");
      const name = pair!.slice(0, eq);
      const value = pair!.slice(eq + 1);
      const expired = /max-age=0|expires=thu, 01 jan 1970/i.test(line);
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}
