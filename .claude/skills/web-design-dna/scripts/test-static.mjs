#!/usr/bin/env node
// Functional test for the static extraction pipeline (the path that runs
// everywhere, including the network-walled cloud sandbox). Runs the real
// parse → fingerprint → css-dna → synthesis chain against fixtures/sample-site.html
// and asserts the planted DNA comes back out. Exits non-zero on any failure.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseHtml } from './lib/parse-html.mjs';
import { analyzeCss } from './lib/css-dna.mjs';
import { detectFromText, detectShaders } from './lib/fingerprints.mjs';
import { buildReport, renderMarkdown, loadBrand } from './lib/report.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(here, 'fixtures/sample-site.html'), 'utf8');

const parsed = parseHtml(html, { baseDir: resolve(here, 'fixtures') });
const stack = detectFromText({ html, css: parsed.css, js: parsed.js, srcs: parsed.srcs });
const shaders = detectShaders(html + '\n' + parsed.js + '\n' + parsed.shaders);
const dna = analyzeCss(parsed.css, parsed.srcs.join('\n'));
const report = buildReport({ source: 'fixture', tier: 'D (test)', stack, shaders, dna, meta: parsed.meta, brand: loadBrand() });
const md = renderMarkdown(report);

const stackNames = stack.map((s) => s.name);
const families = dna.typography.families.map((f) => f.toLowerCase());
const paletteVals = dna.color.palette.map((p) => p.value);
const easings = dna.motion.easings;

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failures++;
};

console.log('— Tech stack —');
check('detects GSAP', stackNames.includes('GSAP'));
check('detects GSAP ScrollTrigger', stackNames.includes('GSAP ScrollTrigger'));
check('detects Three.js', stackNames.includes('Three.js'));
check('detects Lenis', stackNames.includes('Lenis'));
check('detects Swiper', stackNames.includes('Swiper'));
check('detects Spline', stackNames.includes('Spline'));
check('detects Next.js', stackNames.includes('Next.js'));
check('detects shaders (gl_FragColor / uniforms)', shaders.length >= 2);

console.log('\n— Typography —');
check('family: Editorial (custom @font-face)', families.some((f) => f.includes('editorial')));
check('family: Space Grotesk (Google)', families.some((f) => f.includes('space grotesk')));
check('source includes Google Fonts', dna.typography.source.includes('Google Fonts'));
check('source includes Self-hosted @font-face', dna.typography.source.includes('Self-hosted @font-face'));
check('captures @font-face block', dna.typography.faces.length >= 1);
check('fluid clamp() sizes found', dna.typography.fluidSizes.length >= 2);

console.log('\n— Color —');
check('palette non-empty', paletteVals.length >= 3);
check('model includes oklch', dna.color.models.includes('oklch/oklab'));
check('model includes hex', dna.color.models.includes('hex'));
check('role: background guessed', !!dna.color.roles.background);
check('gradient captured', dna.color.gradients.length >= 1);

console.log('\n— Spacing & layout —');
check('base unit guessed (8px grid)', dna.spacing.baseUnit === 8);
check('grid detected', dna.spacing.usesGrid === true);
check('container max-width found', dna.spacing.containers.length >= 1);
check('breakpoints found (768/1200)', dna.spacing.breakpoints.length >= 2);

console.log('\n— Motion —');
check('cubic-bezier easing captured', easings.some((e) => e.startsWith('cubic-bezier')));
check('@keyframes captured (floaty/shimmer)', dna.motion.keyframes.includes('floaty'));
check('durations captured', dna.motion.durations.length >= 1);
check('scroll-driven (sticky) noted', dna.motion.scrollDriven.some((s) => /sticky/.test(s)));

console.log('\n— Effects —');
check('backdrop-filter captured', dna.effects.backdropFilter.length >= 1);
check('mix-blend-mode captured', dna.effects.mixBlendMode.length >= 1);
check('clip-path captured', dna.effects.clipPath.length >= 1);
check('box-shadow captured', dna.effects.boxShadow.length >= 1);

console.log('\n— Synthesis & Injection Kit —');
check('3–5 signature moves synthesized', report.moves.length >= 3 && report.moves.length <= 5);
check('Tailwind @theme block rendered', report.kit.tailwind.includes('@theme'));
check('CSS variables rendered', report.kit.cssVars.includes(':root'));
check('technique recipes generated', Object.keys(report.kit.recipes).length >= 2);
check('brand-conflict flags (Google Fonts vs brand)', report.kit.conflicts.some((c) => /Google Fonts/.test(c.message)));
check('markdown report renders sections', md.includes('## Signature Moves') && md.includes('## Injection Kit'));

console.log(`\n${failures === 0 ? '✔ ALL CHECKS PASSED' : `✖ ${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
