import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { fileRoutes } from "./routes/files";
import { signingRoutes } from "./routes/signing";

export default new Elysia({ adapter: CloudflareAdapter })
  .get("/", () => "Hello Elysia")
  .use(signingRoutes)
  .use(fileRoutes)
  .compile();
