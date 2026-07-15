// Pure, AWS/Sanity-free validation for kb-builder entries.
// Extracted from index.mjs so it can be unit-tested without the module-level
// Sanity client (which throws at import when SANITY_WRITE_TOKEN is unset).

export const CATEGORY_ORDER = [
  "biography",
  "military",
  "education",
  "career",
  "business",
  "skills",
  "awards",
  "philosophy",
  "podcast",
  "book",
];

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 50000;
const MAX_DATE_LENGTH = 20;
const MAX_SORT_ORDER = 1000;

/**
 * @param {{ title?: string, category?: string, content?: string, date?: string|null, sortOrder?: number }} fields
 * @param {boolean} [requireAll=false]
 * @returns {string|null}
 */
export function validateEntryFields({ title, category, content, date, sortOrder }, requireAll = false) {
  if (requireAll && (!title || !category || !content)) {
    return "title, category, and content are required";
  }
  if (title !== undefined && (typeof title !== "string" || title.length > MAX_TITLE_LENGTH)) {
    return `title must be a string of at most ${MAX_TITLE_LENGTH} characters`;
  }
  if (category !== undefined && !CATEGORY_ORDER.includes(category)) {
    return `category must be one of: ${CATEGORY_ORDER.join(", ")}`;
  }
  if (content !== undefined && (typeof content !== "string" || content.length > MAX_CONTENT_LENGTH)) {
    return `content must be a string of at most ${MAX_CONTENT_LENGTH} characters`;
  }
  if (
    date !== undefined &&
    date !== null &&
    (typeof date !== "string" || date.length > MAX_DATE_LENGTH || isNaN(Date.parse(date)))
  ) {
    return "date must be a valid date string";
  }
  if (
    sortOrder !== undefined &&
    sortOrder !== null &&
    (typeof sortOrder !== "number" || sortOrder < 0 || sortOrder > MAX_SORT_ORDER)
  ) {
    return `sortOrder must be a number between 0 and ${MAX_SORT_ORDER}`;
  }
  return null;
}
