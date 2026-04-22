const SIGNING_KEY = import.meta.env.VITE_BLUEPRINT_SIGNING_KEY || '';

/**
 * Generate HMAC-SHA256 signature for a blueprint request body.
 * Uses SubtleCrypto (available in all modern browsers).
 */
async function generateSignature(body: string, timestamp: number): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SIGNING_KEY);
  const message = encoder.encode(`${timestamp}.${body}`);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate signed headers to include with a blueprint API request.
 * Returns timestamp and HMAC signature headers matching the Lambda's expected format.
 */
export async function getSignedHeaders(
  body: string
): Promise<Record<string, string>> {
  if (!SIGNING_KEY) {
    return {};
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await generateSignature(body, timestamp);

  return {
    'x-blueprint-timestamp': String(timestamp),
    'x-blueprint-signature': signature,
  };
}
