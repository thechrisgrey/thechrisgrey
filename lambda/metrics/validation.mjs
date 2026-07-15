// Pure, AWS-free validation helpers for the metrics handler.
// Extracted from index.mjs so they can be unit-tested without the
// module-level CloudWatch/DynamoDB singletons.

export const VALID_VITALS = new Set(["CLS", "INP", "FCP", "LCP", "TTFB"]);
export const VALID_RATINGS = new Set(["good", "needs-improvement", "poor"]);
export const VALID_CSP_KEYWORDS = new Set(["inline", "eval", "self", "data", "blob", "unknown"]);
const CSP_URI_PATTERN = /^https?:\/\/[\w.-]+$/;

/**
 * @param {{name?: string, value?: number, rating?: string}} body
 * @returns {{ok:true, dimensions:Array<{Name:string,Value:string}>}|{ok:false, status:number, error:string}}
 */
export function validateVitals(body) {
  const { name, value, rating } = body;
  if (!name || typeof value !== "number") {
    return { ok: false, status: 400, error: "name and numeric value are required" };
  }
  if (!Number.isFinite(value) || value < 0 || value > 60000) {
    return { ok: false, status: 400, error: "value must be a finite number between 0 and 60000" };
  }
  if (!VALID_VITALS.has(name)) {
    return { ok: false, status: 400, error: `Invalid metric name. Must be one of: ${[...VALID_VITALS].join(", ")}` };
  }
  const dimensions = [];
  if (rating && VALID_RATINGS.has(rating)) {
    dimensions.push({ Name: "Rating", Value: rating });
  }
  return { ok: true, dimensions };
}

/** @param {string} blockedUri @returns {boolean} */
export function validateCspUri(blockedUri) {
  return VALID_CSP_KEYWORDS.has(blockedUri) || CSP_URI_PATTERN.test(blockedUri);
}
