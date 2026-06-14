#!/usr/bin/env node
// Tier B — live headless extractor (Playwright). The powerhouse: renders the
// real page, reads RESOLVED computed styles, enumerates the network resource
// manifest, probes runtime window globals, and (optionally) captures
// scroll-state screenshots. Feeds the SAME synthesis layer as the static path.
//
// Requires an unrestricted network + a Chromium binary, so it runs on YOUR Mac
// (or any open-network machine), NOT inside the network-walled cloud sandbox.
//
// First-time setup (once):
//   cd .claude/skills/web-design-dna/scripts && npm install && npx playwright install chromium
//
// Usage:
//   node extract-live.mjs <url> [options]
// Options:
//   --scroll             scroll the full page to trigger lazy/scroll animations
//   --shots <dir>        save full-page + scroll-state screenshots to <dir>
//   --label "<name>"     friendly source name
//   --brand <path|none>  brand profile JSON (default: built-in Altivum profile)
//   --out <file.md>      markdown report (default: ./dna-report.md)
//   --json <file.json>   JSON report (default: ./dna-report.json)
//   --timeout <ms>       navigation timeout (default 45000)

import { writeFileSync, mkdirSync } from 'node:fs';
import { analyzeCss } from './lib/css-dna.mjs';
import { detectFromText, detectFromGlobals, detectShaders, mergeDetections } from './lib/fingerprints.mjs';
import { buildReport, renderMarkdown, loadBrand } from './lib/report.mjs';

function parseArgs(argv) {
  const args = { _: [], timeout: 45000 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--scroll') args.scroll = true;
    else if (a === '--shots') args.shots = argv[++i];
    else if (a === '--label') args.label = argv[++i];
    else if (a === '--brand') args.brand = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--timeout') args.timeout = Number(argv[++i]);
    else args._.push(a);
  }
  return args;
}

// Window-global keys worth probing (mirrors fingerprints' `globals`).
const GLOBAL_PROBE = [
  'gsap', 'ScrollTrigger', 'ScrollSmoother', 'SplitText', 'THREE', '__r3f', 'PIXI', 'BABYLON',
  'Lenis', 'LocomotiveScroll', 'barba', 'Swup', 'Curtains', 'VANTA', 'lottie', 'bodymovin',
  'p5', 'Splitting', 'Swiper', 'Matter', 'Shopify', '__NEXT_DATA__', '__NUXT__', '___gatsby',
  '__remixContext', '__framer', 'SPLINE', 'VanillaTilt', 'Motion', 'anime', 'AOS',
];

// Elements whose resolved styles define the visual system.
const COMPUTED_SELECTORS = ['body', 'h1', 'h2', 'h3', 'p', 'a', 'button'];
const COMPUTED_PROPS = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'backgroundColor'];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = args._[0];
  if (!url) {
    console.error('Usage: node extract-live.mjs <url> [--scroll --shots dir --label .. --brand .. --out .. --json ..]');
    process.exit(1);
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('✖ Playwright not installed. Run:\n  npm install && npx playwright install chromium');
    process.exit(2);
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    console.error('✖ Could not launch Chromium. Install the browser binary:\n  npx playwright install chromium');
    console.error('  (underlying error: ' + e.message + ')');
    process.exit(2);
  }

  const resources = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('response', (res) => {
    try {
      const req = res.request();
      resources.push({ url: res.url(), type: req.resourceType(), status: res.status() });
    } catch { /* ignore */ }
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: args.timeout }).catch(() => page.goto(url, { waitUntil: 'load', timeout: args.timeout }));
    await page.waitForTimeout(1500);

    if (args.scroll) {
      await autoScroll(page);
      await page.waitForTimeout(1000);
    }

    const html = await page.content();

    // Collect stylesheet text: same-origin cssRules read directly; cross-origin
    // sheets are re-fetched by href (CORS permitting).
    const css = await page.evaluate(async () => {
      let out = '';
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = sheet.cssRules; // throws for cross-origin
          for (const r of Array.from(rules)) out += r.cssText + '\n';
        } catch {
          if (sheet.href) {
            try { out += await (await fetch(sheet.href)).text() + '\n'; } catch { /* ignore */ }
          }
        }
      }
      // inline style attributes carry a lot on builder sites
      for (const el of Array.from(document.querySelectorAll('[style]')).slice(0, 400)) {
        out += `x{${el.getAttribute('style')}}\n`;
      }
      return out;
    });

    const globals = await page.evaluate((keys) => {
      const present = keys.filter((k) => typeof window[k] !== 'undefined');
      const versions = {};
      try { if (window.THREE?.REVISION) versions.THREE = 'r' + window.THREE.REVISION; } catch { /* ignore */ }
      try { if (window.gsap?.version) versions.GSAP = window.gsap.version; } catch { /* ignore */ }
      return { present, versions };
    }, GLOBAL_PROBE);

    const computed = await page.evaluate(({ sels, props }) => {
      const result = {};
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const cs = getComputedStyle(el);
        const o = {};
        for (const p of props) o[p] = cs[p];
        result[sel] = o;
      }
      return result;
    }, { sels: COMPUTED_SELECTORS, props: COMPUTED_PROPS });

    const inlineJs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script:not([src])')).map((s) => s.textContent).join('\n').slice(0, 200000));

    const srcs = resources.filter((r) => r.type === 'script' || r.type === 'stylesheet' || r.type === 'font').map((r) => r.url);

    // Detect from every angle, then merge.
    const stack = mergeDetections(
      detectFromText({ html, css, js: inlineJs, srcs }),
      detectFromGlobals(globals.present),
    );
    const shaders = detectShaders(html + '\n' + inlineJs);
    const dna = analyzeCss(css, srcs.join('\n'));
    // computed styles refine roles precisely
    if (computed.body) dna.color.roles = { background: computed.body.backgroundColor, text: computed.body.color };
    const brand = loadBrand(args.brand);

    let shotNote = [];
    if (args.shots) {
      mkdirSync(args.shots, { recursive: true });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${args.shots}/full.png`, fullPage: true });
      shotNote.push(`${args.shots}/full.png`);
    }

    const report = buildReport({
      source: args.label || url,
      tier: 'B (live Playwright)',
      stack,
      shaders,
      dna,
      meta: { title: await page.title(), generator: globals.versions ? Object.entries(globals.versions).map(([k, v]) => `${k} ${v}`).join(', ') : null },
      computed,
      resources: summarizeResources(resources),
      brand,
    });

    const md = renderMarkdown(report);
    const outMd = args.out || 'dna-report.md';
    const outJson = args.json || 'dna-report.json';
    writeFileSync(outMd, md);
    writeFileSync(outJson, JSON.stringify(report, null, 2));

    console.log(`\n✔ DNA extracted (Tier B / live) from: ${url}`);
    console.log(`  Stack: ${stack.map((s) => s.name).join(', ') || 'none'}`);
    if (Object.keys(globals.versions).length) console.log(`  Versions: ${Object.entries(globals.versions).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    if (shaders.length) console.log(`  Shaders: ${shaders.join(', ')}`);
    if (computed.body) console.log(`  Body: ${computed.body.color} on ${computed.body.backgroundColor}, ${computed.body.fontFamily}`);
    if (shotNote.length) console.log(`  Screenshots: ${shotNote.join(', ')}`);
    console.log(`  Signature moves:`);
    report.moves.forEach((m) => console.log(`    • ${m}`));
    console.log(`\n  → ${outMd}\n  → ${outJson}\n`);
  } finally {
    await browser.close();
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const step = 600;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        if (total >= document.body.scrollHeight + window.innerHeight) { clearInterval(timer); resolve(); }
      }, 120);
    });
  });
}

function summarizeResources(resources) {
  const by = {};
  for (const r of resources) by[r.type] = (by[r.type] || 0) + 1;
  const fonts = resources.filter((r) => r.type === 'font').map((r) => r.url.split('/').pop());
  return { counts: by, fonts: [...new Set(fonts)].slice(0, 12) };
}

main();
