// Classified error handling for the Sanity data boundary.
//
// `client.fetch<T>()` types are compile-time only — a network blip, a timeout, a
// schema drift, or a malformed response all surface as a thrown value the page
// previously collapsed into a single boolean. `classifySanityError` mirrors the
// shape of `useBlueprint.classifyError`: it turns an unknown thrown value into a
// typed `{ kind, message }` so pages can log a distinct code and show the visitor
// guidance that actually matches the failure (retryable timeout vs. offline vs.
// a malformed payload).

export type SanityErrorKind =
  | 'timeout'
  | 'network'
  | 'not_found'
  | 'malformed'
  | 'unknown';

export interface SanityError {
  kind: SanityErrorKind;
  /** Visitor-facing, already prefixed with the call context. */
  message: string;
  /** The original thrown value, when it was an Error — preserved for logging. */
  causedBy?: Error;
}

const MESSAGES: Record<SanityErrorKind, string> = {
  timeout: 'The request timed out. Please try again in a moment.',
  network: 'A network error occurred. Check your connection and try again.',
  not_found: 'The requested content could not be found.',
  malformed: 'We received an unexpected response. Please try again.',
  unknown: 'Something went wrong. Please try again.',
};

function build(kind: SanityErrorKind, context?: string, causedBy?: Error): SanityError {
  return {
    kind,
    message: context ? `${context}: ${MESSAGES[kind]}` : MESSAGES[kind],
    causedBy,
  };
}

/**
 * Turn an unknown thrown value (or a manual signal) into a typed SanityError.
 * Accepts AbortError (timeout), @sanity/client HTTP errors (statusCode),
 * JSON/parse failures (malformed), and network-shaped errors.
 */
export function classifySanityError(err: unknown, context?: string): SanityError {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return build('timeout', context, err);

    // @sanity/client throws ClientError/ServerError carrying a numeric statusCode.
    const statusCode =
      typeof err === 'object' && err !== null && 'statusCode' in err
        ? Number((err as { statusCode?: unknown }).statusCode)
        : undefined;
    if (statusCode === 404) return build('not_found', context, err);
    if (statusCode !== undefined && statusCode >= 500) return build('network', context, err);

    const msg = err.message || '';
    if (err instanceof TypeError || /json|parse|unexpected token/i.test(msg)) {
      return build('malformed', context, err);
    }
    if (/not found|404/i.test(msg)) return build('not_found', context, err);
    if (/timeout|timed out|aborted/i.test(msg)) return build('timeout', context, err);
    if (/network|fetch|failed to fetch|enotfound|econn|dns/i.test(msg)) {
      return build('network', context, err);
    }
    return build('unknown', context, err);
  }
  return build('unknown', context);
}

export function isSanityError(value: unknown): value is SanityError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    'message' in value &&
    typeof (value as SanityError).message === 'string'
  );
}
