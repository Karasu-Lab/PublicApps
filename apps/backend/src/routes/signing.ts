import { env } from "cloudflare:workers";
import { Elysia } from "elysia";
import { downloadSigningQuery } from "../schemas";
import { sign, type SigningAction } from "../signing";

/** Lifetime of signed URLs in seconds. */
const EXPIRES_IN = 300;

async function createSignedUrl(origin: string, action: SigningAction, filePath: string) {
  const expires = Math.floor(Date.now() / 1000) + EXPIRES_IN;
  const signature = await sign(env.SIGNING_SECRET, action, filePath, expires);
  const url = new URL(`/files/${action}`, origin);
  url.search = new URLSearchParams({ filePath, expires: String(expires), signature }).toString();

  return { url: url.toString(), filePath, expiresAt: new Date(expires * 1000).toISOString() };
}

export const signingRoutes = new Elysia({ prefix: "/signing" })
  .get("/upload", ({ request }) =>
    createSignedUrl(new URL(request.url).origin, "upload", `uploads/${crypto.randomUUID()}`),
  )
  .get(
    "/download",
    ({ request, query }) =>
      createSignedUrl(new URL(request.url).origin, "download", query.filePath),
    { query: downloadSigningQuery },
  );
