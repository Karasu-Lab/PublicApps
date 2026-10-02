export type SigningAction = "upload" | "download";

const encoder = new TextEncoder();

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

const payloadOf = (action: SigningAction, filePath: string, expires: number) =>
  `${action}\n${filePath}\n${expires}`;

export async function sign(
  secret: string,
  action: SigningAction,
  filePath: string,
  expires: number,
): Promise<string> {
  return hmac(secret, payloadOf(action, filePath, expires));
}

export async function verify(
  secret: string,
  action: SigningAction,
  filePath: string,
  expires: number,
  signature: string,
  now = Date.now(),
): Promise<boolean> {
  if (expires * 1000 < now) return false;
  const expected = await hmac(secret, payloadOf(action, filePath, expires));
  if (expected.length !== signature.length) return false;

  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
