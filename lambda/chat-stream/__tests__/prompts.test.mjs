import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BASE_SYSTEM_PROMPT,
  buildVisitorContext,
  buildMemoryContext,
  buildSystemPrompt,
} from "../prompts.mjs";

test("buildVisitorContext returns empty string for null", () => {
  assert.equal(buildVisitorContext(null), "");
});

test("buildVisitorContext includes current section/page", () => {
  const out = buildVisitorContext({
    currentPage: "/podcast",
    section: "Podcast",
    visitedPages: [],
  });
  assert.match(out, /Podcast page \(\/podcast\)/);
  assert.match(out, /VISITOR CONTEXT/);
});

test("buildVisitorContext adds journey line when prior pages exist", () => {
  const out = buildVisitorContext({
    currentPage: "/podcast",
    section: "Podcast",
    visitedPages: ["/podcast", "/", "/about"],
  });
  assert.match(out, /also visited: \/, \/about/);
});

test("buildVisitorContext omits journey line when no prior pages", () => {
  const out = buildVisitorContext({
    currentPage: "/",
    section: "Home",
    visitedPages: ["/"],
  });
  assert.doesNotMatch(out, /also visited/);
});

test("buildSystemPrompt without context uses fallback note", () => {
  const out = buildSystemPrompt(null, null);
  assert.ok(out.startsWith(BASE_SYSTEM_PROMPT));
  assert.match(out, /No specific context was retrieved/);
});

test("buildSystemPrompt includes retrieved context", () => {
  const ctx = "Christian served in 3rd SFG as an 18D.";
  const out = buildSystemPrompt(ctx, null);
  assert.match(out, /RETRIEVED CONTEXT/);
  assert.match(out, /3rd SFG/);
  assert.match(out, /END CONTEXT/);
});

test("buildSystemPrompt combines visitor + retrieved context", () => {
  const out = buildSystemPrompt("retrieved info", {
    currentPage: "/altivum",
    section: "Altivum",
    visitedPages: [],
  });
  assert.match(out, /VISITOR CONTEXT/);
  assert.match(out, /Altivum page/);
  assert.match(out, /retrieved info/);
});

test("BASE_SYSTEM_PROMPT includes tool etiquette for each tool", () => {
  assert.match(BASE_SYSTEM_PROMPT, /TOOL ETIQUETTE/);
  assert.match(BASE_SYSTEM_PROMPT, /navigate_to/);
  assert.match(BASE_SYSTEM_PROMPT, /draft_message/);
  assert.match(BASE_SYSTEM_PROMPT, /draft_newsletter_subscription/);
  assert.match(BASE_SYSTEM_PROMPT, /search_blog/);
  assert.match(BASE_SYSTEM_PROMPT, /cite_blog_passage/);
  assert.match(BASE_SYSTEM_PROMPT, /remember_fact/);
});

test("BASE_SYSTEM_PROMPT forbids fabricating visitor identity for draft_message", () => {
  assert.match(BASE_SYSTEM_PROMPT, /NEVER fabricate the visitor's name/i);
});

test("BASE_SYSTEM_PROMPT forbids PII in memory", () => {
  assert.match(BASE_SYSTEM_PROMPT, /Never store emails, phone numbers/i);
});

test("buildMemoryContext returns empty for null/undefined/empty", () => {
  assert.equal(buildMemoryContext(null), "");
  assert.equal(buildMemoryContext(undefined), "");
  assert.equal(buildMemoryContext([]), "");
});

test("buildMemoryContext renders strings as bullet list", () => {
  const out = buildMemoryContext(["Is preparing for SFAS", "Works in DevOps"]);
  assert.match(out, /VISITOR MEMORY/);
  assert.match(out, /- Is preparing for SFAS/);
  assert.match(out, /- Works in DevOps/);
});

test("buildMemoryContext accepts {content} objects", () => {
  const out = buildMemoryContext([
    { content: "Lives in Austin" },
    { content: "Enjoys long-form podcasts" },
  ]);
  assert.match(out, /- Lives in Austin/);
  assert.match(out, /- Enjoys long-form podcasts/);
});

test("buildMemoryContext filters blanks and non-strings", () => {
  const out = buildMemoryContext([
    "   ",
    null,
    undefined,
    { content: "" },
    { content: "Real fact" },
  ]);
  assert.match(out, /- Real fact/);
  assert.doesNotMatch(out, /- \n/);
});

test("buildMemoryContext returns empty when all entries filter out", () => {
  assert.equal(buildMemoryContext(["   ", null, { content: "" }]), "");
});

test("buildSystemPrompt includes memory block when facts provided (no retrieved context)", () => {
  const out = buildSystemPrompt(null, null, ["Has three kids"]);
  assert.match(out, /VISITOR MEMORY/);
  assert.match(out, /- Has three kids/);
  assert.match(out, /No specific context was retrieved/);
});

test("buildSystemPrompt includes visitor + memory + retrieved context together", () => {
  const out = buildSystemPrompt(
    "RAG chunk about Altivum.",
    { section: "Altivum", currentPage: "/altivum", visitedPages: ["/altivum", "/"] },
    ["Is preparing for SFAS"],
  );
  assert.match(out, /VISITOR CONTEXT/);
  assert.match(out, /VISITOR MEMORY/);
  assert.match(out, /- Is preparing for SFAS/);
  assert.match(out, /RETRIEVED CONTEXT/);
  assert.match(out, /RAG chunk about Altivum/);
});

test("buildSystemPrompt omits memory block when facts empty", () => {
  const out = buildSystemPrompt(null, null, []);
  assert.doesNotMatch(out, /VISITOR MEMORY/);
});
