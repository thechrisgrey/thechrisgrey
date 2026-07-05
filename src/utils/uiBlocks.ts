/**
 * Frontend type mirror of the render_ui block vocabulary defined in
 * lambda/chat-stream/uiBlocks.mjs (the Zod single source of truth). Kept in sync by
 * hand — both files are small and change together. Used by GenerativeBlocks.tsx to
 * render Alti's generative answer surfaces (dedicated /chat page only).
 */

export interface TimelineItem {
  year: string;
  heading: string;
  detail: string;
}

export interface TimelineBlock {
  type: 'timeline';
  title?: string;
  items: TimelineItem[];
}

export interface ComparisonColumn {
  heading: string;
  points: string[];
}

export interface ComparisonBlock {
  type: 'comparison';
  title?: string;
  left: ComparisonColumn;
  right: ComparisonColumn;
}

export interface StatItem {
  value: string;
  label: string;
}

export interface StatRowBlock {
  type: 'stat_row';
  stats: StatItem[];
}

export interface ProfileMiniBlock {
  type: 'profile_mini';
  name: string;
  role: string;
  blurb: string;
  ctaPath?: string;
}

export interface ExplainerBlock {
  type: 'explainer';
  title?: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LinkGridLink {
  label: string;
  path: string;
  blurb: string;
}

export interface LinkGridBlock {
  type: 'link_grid';
  title?: string;
  links: LinkGridLink[];
}

export type UiBlock =
  TimelineBlock | ComparisonBlock | StatRowBlock | ProfileMiniBlock | ExplainerBlock | LinkGridBlock;
