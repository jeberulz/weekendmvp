import { describe, expect, test } from "vitest";
import {
  DEFAULT_WIDGET_AVATAR_SRC,
  MASCOT_DATA_URI,
  MASCOT_IMAGE_SHA256,
} from "@/components/idea-requests/mascot-data";

function decodeDataUri(uri: string): Uint8Array {
  const prefix = "data:image/webp;base64,";
  expect(uri.startsWith(prefix)).toBe(true);
  const binary = atob(uri.slice(prefix.length));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("widget mascot asset", () => {
  test("the embedded bytes are exactly the chosen Option 1 file", async () => {
    const bytes = decodeDataUri(MASCOT_DATA_URI);
    // WebP magic: RIFF....WEBP, and the exact byte length of the source file.
    expect(bytes.length).toBe(131746);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe("WEBP");
    expect(await sha256Hex(bytes)).toBe(MASCOT_IMAGE_SHA256);
    expect(MASCOT_IMAGE_SHA256).toBe(
      "8cb6941dc0a9a48469843828dcba4e794668cf3ff2e6a9738112564d95834776",
    );
  });

  test("the widget defaults to the chosen mascot image", () => {
    expect(DEFAULT_WIDGET_AVATAR_SRC).toBe(MASCOT_DATA_URI);
    expect(DEFAULT_WIDGET_AVATAR_SRC.startsWith("data:image/webp;base64,")).toBe(true);
  });
});
