import { env } from "cloudflare:workers";
import { Elysia } from "elysia";
import { signedQuery, uploadBody, type SignedQuery } from "../schemas";
import { verify, type SigningAction } from "../signing";

const isValidSignature = (action: SigningAction, query: SignedQuery) =>
  verify(env.SIGNING_SECRET, action, query.filePath, query.expires, query.signature);

export const fileRoutes = new Elysia({ prefix: "/files" })
  .post(
    "/upload",
    async ({ query, body, status }) => {
      if (!(await isValidSignature("upload", query))) {
        return status(403, { message: "Invalid or expired signature" });
      }

      await env.BUCKET.put(query.filePath, body.file.stream(), {
        httpMetadata: { contentType: body.file.type || "application/octet-stream" },
      });

      return { filePath: query.filePath, size: body.file.size };
    },
    { query: signedQuery, body: uploadBody },
  )
  .get(
    "/download",
    async ({ query, status }) => {
      if (!(await isValidSignature("download", query))) {
        return status(403, { message: "Invalid or expired signature" });
      }

      const object = await env.BUCKET.get(query.filePath);
      if (!object) {
        return status(404, { message: "File not found" });
      }

      return new Response(object.body, {
        headers: {
          "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
        },
      });
    },
    { query: signedQuery },
  );
