#!/usr/bin/env node
// Tier D / static extractor — works ANYWHERE (offline, no browser).
//
// Input: a saved .html file, a saved-page directory (index.html + assets), or
// View-Source pasted on stdin ("-"). Pulls the design DNA at full fidelity on
// the *static* layer and writes a Markdown report + JSON tokens.
//
// Usage:
//   node extract-static.mjs <file.html | dir | ->  [options]
//   pbpaste | node extract-static.mjs -            (macOS: paste View-Source)
// Options:
//   --label "<name>"     friendly source name in the report
//   --brand <path|none>  brand profile JSON (default: built-in Altivum profile)
//   --out <file.md>      markdown report (default: ./dna-report.md)
//   --json <file.json>   machine-readable report (default: ./dna-report.json)

import { writeFileSync } from 'node:fs';
import { parseHtml, readSource } from './lib/parse-html.mjs';
import { analyzeCss } from './lib/css-dna.mjs';
import { detectFromText, detectShaders } from './lib/fingerprints.mjs';
import { buildReport, renderMarkdown, loadBrand } from './lib/report.mjs';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--label') args.label = argv[++i];
    else if (a === '--brand') args.brand = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--json') args.json = argv[++i];
    else args._.push(a);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = args._[0];
  if (!input) {
    console.error('Usage: node extract-static.mjs <file.html | dir | -> [--label .. --brand .. --out .. --json ..]');
    process.exit(1);
  }

  const { html, baseDir } = readSource(input);
  const parsed = parseHtml(html, { baseDir });

  const stack = detectFromText({ html, css: parsed.css, js: parsed.js, srcs: parsed.srcs });
  const shaders = detectShaders(html + '\n' + parsed.js + '\n' + parsed.shaders);
  const dna = analyzeCss(parsed.css, parsed.srcs.join('\n'));
  const brand = loadBrand(args.brand);

  const report = buildReport({
    source: args.label || (input === '-' ? 'pasted View-Source' : input),
    tier: 'D (static source)',
    stack,
    shaders,
    dna,
    meta: parsed.meta,
    brand,
  });

  const md = renderMarkdown(report);
  const outMd = args.out || 'dna-report.md';
  const outJson = args.json || 'dna-report.json';
  writeFileSync(outMd, md);
  writeFileSync(outJson, JSON.stringify(report, null, 2));

  // Console summary
  console.log(`\n✔ DNA extracted (Tier D) from: ${report.source}`);
  console.log(`  Stack: ${stack.map((s) => s.name).join(', ') || 'none fingerprinted'}`);
  if (shaders.length) console.log(`  Shaders: ${shaders.join(', ')}`);
  console.log(`  Fonts: ${(dna.typography.families || []).slice(0, 4).join(', ') || '—'}`);
  console.log(`  Palette: ${(dna.color.palette || []).slice(0, 5).map((p) => p.value).join(' ') || '—'}`);
  console.log(`  Signature moves:`);
  report.moves.forEach((m) => console.log(`    • ${m}`));
  console.log(`\n  → ${outMd}\n  → ${outJson}\n`);
}

main();
