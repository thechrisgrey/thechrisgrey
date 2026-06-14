// Lightweight, dependency-free HTML dissection for the static (saved-source)
// extraction path. Pulls the raw design layer out of a saved page or a
// View-Source paste: inline + linked CSS, script srcs, inline JS, shader
// blocks, data-* attributes, and meta/generator hints.
//
// For linked stylesheets it resolves *local* relative files (e.g. a saved
// "page_files/" folder) when a baseDir is provided. Remote hrefs are recorded
// but not fetched — the static path is offline by design.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export function parseHtml(html, { baseDir = null } = {}) {
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);

  const linkHrefs = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (/rel\s*=\s*["']?\s*(stylesheet|preload)/i.test(tag) || /\.css/i.test(tag)) {
      const href = (tag.match(/href\s*=\s*["']([^"']+)["']/i) || [])[1];
      if (href) linkHrefs.push(href);
    }
  }

  const scriptSrcs = [];
  const inlineScripts = [];
  const shaderBlocks = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    const body = m[2];
    const src = (attrs.match(/src\s*=\s*["']([^"']+)["']/i) || [])[1];
    const type = (attrs.match(/type\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    if (src) scriptSrcs.push(src);
    if (/x-shader/i.test(type)) shaderBlocks.push(body);
    else if (body && body.trim()) inlineScripts.push(body);
  }
  // self-closing / src-only scripts not caught above
  for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    if (!scriptSrcs.includes(m[1])) scriptSrcs.push(m[1]);
  }

  // Resolve local relative stylesheets if we have them on disk.
  let linkedCss = '';
  if (baseDir) {
    for (const href of linkHrefs) {
      if (/^https?:|^\/\//i.test(href)) continue;
      const p = resolve(baseDir, href.replace(/^\.?\//, '').split(/[?#]/)[0]);
      if (existsSync(p)) {
        try { linkedCss += `\n/* ${href} */\n` + readFileSync(p, 'utf8'); } catch { /* ignore */ }
      }
    }
  }

  const dataAttrs = [...new Set([...html.matchAll(/\b(data-[\w-]+)/gi)].map((m) => m[1].toLowerCase()))];
  const generator = (html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i) || [])[1] || null;
  const themeColor = (html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i) || [])[1] || null;
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || null;

  return {
    css: styleBlocks.join('\n') + linkedCss,
    inlineCss: styleBlocks.join('\n'),
    linkedCss,
    js: inlineScripts.join('\n'),
    srcs: [...scriptSrcs, ...linkHrefs],
    scriptSrcs,
    linkHrefs,
    shaders: shaderBlocks.join('\n'),
    dataAttrs,
    meta: { generator, themeColor, title },
  };
}

export function readSource(input) {
  // input '-' reads stdin; a directory reads index.html within it.
  if (input === '-') {
    return { html: readFileSync(0, 'utf8'), baseDir: process.cwd() };
  }
  const path = resolve(input);
  if (existsSync(path) && statSync(path).isDirectory()) {
    const idx = resolve(path, 'index.html');
    return { html: readFileSync(idx, 'utf8'), baseDir: path };
  }
  return { html: readFileSync(path, 'utf8'), baseDir: dirname(path) };
}
