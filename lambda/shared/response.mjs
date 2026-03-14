/**
 * Build a JSON HTTP response with optional CORS headers.
 *
 * @param {number} statusCode
 * @param {object} body
 * @param {string|null} [corsOrigin=null] - If set, adds Access-Control-Allow-* headers.
 * @returns {{ statusCode: number, headers: object, body: string }}
 */
export function respond(statusCode, body, corsOrigin = null) {
  const headers = { "Content-Type": "application/json" };

  if (corsOrigin) {
    headers["Access-Control-Allow-Origin"] = corsOrigin;
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
  }

  return { statusCode, headers, body: JSON.stringify(body) };
}
