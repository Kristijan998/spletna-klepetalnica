import fs from "node:fs";
import path from "node:path";

const distIndexPath = path.resolve("dist", "index.html");

if (!fs.existsSync(distIndexPath)) {
  process.exit(0);
}

const html = fs.readFileSync(distIndexPath, "utf8");
const stylesheetMatch = html.match(/<link rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/i);

if (!stylesheetMatch) {
  process.exit(0);
}

const cssHref = stylesheetMatch[1];
const hasCrossorigin = /crossorigin/i.test(stylesheetMatch[0]);
const crossoriginAttr = hasCrossorigin ? " crossorigin" : "";
const asyncStylesTag = `<link rel="preload" href="${cssHref}" as="style" onload="this.onload=null;this.rel='stylesheet'"${crossoriginAttr}>`;
const fallbackStylesTag = `<noscript><link rel="stylesheet"${crossoriginAttr} href="${cssHref}"></noscript>`;
const plainPreloadTag = `<link rel="preload" href="${cssHref}" as="style">`;

if (html.includes("onload=\"this.onload=null;this.rel='stylesheet'\"")) {
  process.exit(0);
}

const cleaned = html.replace(plainPreloadTag, "").replace(/\n{3,}/g, "\n\n");
const updated = cleaned.replace(stylesheetMatch[0], `${asyncStylesTag}\n    ${fallbackStylesTag}`);
fs.writeFileSync(distIndexPath, updated, "utf8");
