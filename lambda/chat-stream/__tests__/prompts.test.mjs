import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BASE_SYSTEM_PROMPT,
  buildVisitorContext,
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
