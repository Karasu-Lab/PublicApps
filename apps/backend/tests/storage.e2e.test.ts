import { fileURLToPath } from "node:url";
import { unstable_startWorker } from "wrangler";
// oxlint-disable-next-line vite-plus/prefer-vite-plus-imports -- this package tests with vitest directly
import { afterAll, beforeAll, describe, expect, it } from "vitest";

interface SignedUrl {
  url: string;
  filePath: string;
  expiresAt: string;
}

describe("signed upload/download with local R2", () => {
  let worker: Awaited<ReturnType<typeof unstable_startWorker>>;
  let baseUrl: URL;

  const request = (path: string, init?: RequestInit) =>
    fetch(new URL(path, baseUrl).toString(), init);

  const getSignedUrl = async (path: string): Promise<SignedUrl> => {
    const response = await request(path);
    expect(response.status).toBe(200);
    return response.json<SignedUrl>();
  };

  const downloadSigningPath = (filePath: string) =>
    `/signing/download?${new URLSearchParams({ filePath }).toString()}`;

  const uploadForm = (file?: File) => {
    const form = new FormData();
    if (file) form.append("file", file);
    return form;
  };

  beforeAll(async () => {
    worker = await unstable_startWorker({
      config: fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)),
      bindings: { SIGNING_SECRET: { type: "plain_text", value: "test-secret" } },
      dev: { server: { port: 0 }, inspector: false },
    });
    await worker.ready;
    baseUrl = await worker.url;
  });

  afterAll(async () => {
    await worker?.dispose();
  });

  it("uploads a file to local R2 and downloads it into memory", async () => {
    const content = `hello r2 ${crypto.randomUUID()}`;
    const file = new File([content], "hello.txt", { type: "text/plain" });

    const { url: uploadUrl, filePath } = await getSignedUrl("/signing/upload");
    expect(filePath).toMatch(/^uploads\//);

    const upload = await request(uploadUrl, { method: "POST", body: uploadForm(file) });
    expect(upload.status).toBe(200);
    expect(await upload.json()).toEqual({ filePath, size: file.size });

    const { url: downloadUrl } = await getSignedUrl(downloadSigningPath(filePath));

    const download = await request(downloadUrl);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toBe("text/plain");

    const downloaded = new Uint8Array(await download.arrayBuffer());
    expect(new TextDecoder().decode(downloaded)).toBe(content);
  });

  it("rejects a download signing request without filePath", async () => {
    const response = await request("/signing/download");
    expect(response.status).toBe(422);
  });

  it("rejects an upload without a file", async () => {
    const { url } = await getSignedUrl("/signing/upload");
    const response = await request(url, { method: "POST", body: uploadForm() });
    expect(response.status).toBe(422);
  });

  it("rejects an upload with a tampered signature", async () => {
    const { url } = await getSignedUrl("/signing/upload");
    const tampered = new URL(url);
    tampered.searchParams.set("filePath", "uploads/other");

    const file = new File(["x"], "x.txt", { type: "text/plain" });
    const response = await request(tampered.toString(), {
      method: "POST",
      body: uploadForm(file),
    });
    expect(response.status).toBe(403);
  });

  it("returns 404 for a missing file", async () => {
    const { url } = await getSignedUrl(downloadSigningPath(`uploads/${crypto.randomUUID()}`));
    const response = await request(url);
    expect(response.status).toBe(404);
  });
});
