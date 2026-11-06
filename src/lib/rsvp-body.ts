export const NAME_MAX = 120;
const MAX_BODY_BYTES = 1024;

export class RsvpBodyError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function readRsvpBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RsvpBodyError(415, "unsupported-media-type");
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    throw new RsvpBodyError(413, "body-too-large");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RsvpBodyError(400, "invalid-json");
  const bytes = new Uint8Array(MAX_BODY_BYTES);
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        throw new RsvpBodyError(413, "body-too-large");
      }
      bytes.set(value, size - value.byteLength);
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size)));
  } catch (error) {
    if (error instanceof RsvpBodyError) throw error;
    throw new RsvpBodyError(400, "invalid-json");
  } finally {
    reader.releaseLock();
  }
}
