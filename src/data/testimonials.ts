export interface Testimonial {
  /** The quote, without surrounding quotation marks (the component adds them). */
  quote: string;
  /** Who said it. */
  author: string;
  /** Their role / company / context, e.g. "US Army veteran · Vector Podcast guest". */
  role?: string;
}

/**
 * Real, attributed testimonials for the social-proof section.
 *
 * EMPTY BY DESIGN. Fill this with GENuine quotes (with permission) from podcast
 * guests, Altivum Logic clients, book readers, or event organizers. Do NOT
 * fabricate testimonials. While this array is empty the <Testimonials> component
 * renders nothing, so the section stays hidden until there's real proof to show —
 * adding the first entry here lights it up everywhere the component is mounted.
 *
 * Example:
 *   {
 *     quote: 'Christian cut through the noise and gave us an AI roadmap we could actually ship.',
 *     author: 'Jane Doe',
 *     role: 'COO, Acme Corp',
 *   }
 */
export const TESTIMONIALS: Testimonial[] = [];
