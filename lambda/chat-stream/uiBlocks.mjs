/**
 * UI block vocabulary for Alti's generative answer surfaces.
 *
 * Single source of truth (mirrors the discipline of lambda/blueprint/schema.mjs):
 * this Zod schema IS the render_ui tool's inputSchema, so the Strands SDK validates
 * the model's args BEFORE the callback runs — a malformed or oversized block never
 * reaches the client. The frontend type mirror lives in src/utils/uiBlocks.ts.
 *
 * The vocabulary is intentionally tiny and token-locked. The model CHOOSES from
 * these blocks; it never designs free-form markup. Generative UI renders ONLY on
 * the dedicated /chat page (gated in tools/index.mjs by deps.surface === 'page').
 */

import { z } from "zod";

const TimelineBlock = z.object({
  type: z.literal("timeline"),
  title: z.string().min(2).max(80).optional().describe("Optional heading for the timeline"),
  items: z
    .array(
      z.object({
        year: z.string().min(1).max(20).describe("Year or short period label, e.g. '2018' or '2018–2021'"),
        heading: z.string().min(2).max(80).describe("What happened — short"),
        detail: z.string().min(2).max(200).describe("One-sentence detail"),
      }),
    )
    .min(2)
    .max(8)
    .describe("Chronological entries, earliest first"),
});

const ComparisonColumn = z.object({
  heading: z.string().min(2).max(60).describe("Column heading, e.g. 'AWS work'"),
  points: z.array(z.string().min(2).max(160)).min(1).max(6).describe("Bullet points for this side"),
});

const ComparisonBlock = z.object({
  type: z.literal("comparison"),
  title: z.string().min(2).max(80).optional().describe("Optional heading for the comparison"),
  left: ComparisonColumn,
  right: ComparisonColumn,
});

const StatRowBlock = z.object({
  type: z.literal("stat_row"),
  stats: z
    .array(
      z.object({
        value: z.string().min(1).max(20).describe("The figure, e.g. '9' or '18D'"),
        label: z.string().min(2).max(40).describe("What it measures, e.g. 'Episodes'"),
      }),
    )
    .min(2)
    .max(4)
    .describe("A row of headline figures"),
});

const ProfileMiniBlock = z.object({
  type: z.literal("profile_mini"),
  name: z.string().min(2).max(60).describe("Person or entity name"),
  role: z.string().min(2).max(80).describe("Role or one-line title"),
  blurb: z.string().min(10).max(280).describe("Two-to-three sentence summary"),
  ctaPath: z
    .string()
    .regex(/^\/[a-z0-9/-]*$/, "ctaPath must be an internal path like /about")
    .max(80)
    .optional()
    .describe("Optional internal link, e.g. '/about'"),
});

const ExplainerBlock = z.object({
  type: z.literal("explainer"),
  title: z.string().min(2).max(80).optional().describe("Optional heading"),
  paragraphs: z.array(z.string().min(10).max(400)).min(1).max(3).describe("Short paragraphs"),
  bullets: z.array(z.string().min(2).max(160)).max(5).optional().describe("Optional supporting bullets"),
});

const LinkGridBlock = z.object({
  type: z.literal("link_grid"),
  title: z.string().min(2).max(80).optional().describe("Optional heading"),
  links: z
    .array(
      z.object({
        label: z.string().min(2).max(50).describe("Link label"),
        path: z
          .string()
          .regex(/^\/[a-z0-9/-]*$/, "path must be an internal path like /podcast")
          .max(80)
          .describe("Internal destination path"),
        blurb: z.string().min(2).max(120).describe("One-line description"),
      }),
    )
    .min(2)
    .max(6)
    .describe("A grid of internal links"),
});

export const UiBlockSchema = z
  .discriminatedUnion("type", [
    TimelineBlock,
    ComparisonBlock,
    StatRowBlock,
    ProfileMiniBlock,
    ExplainerBlock,
    LinkGridBlock,
  ])
  .describe("A single visual block from the allowed vocabulary");

export const RenderUiInputSchema = z.object({
  blocks: z
    .array(UiBlockSchema)
    .min(1)
    .max(3)
    .describe("One to three blocks to render below the text answer. Most answers need none."),
});

export const UI_BLOCK_TYPES = ["timeline", "comparison", "stat_row", "profile_mini", "explainer", "link_grid"];

export default { UiBlockSchema, RenderUiInputSchema, UI_BLOCK_TYPES };
