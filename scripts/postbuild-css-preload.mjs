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
const preloadTag = `<link rel="preload" href="${cssHref}" as="style">`;

if (html.includes(preloadTag)) {
  process.exit(0);
}

const updated = html.replace(stylesheetMatch[0], `${preloadTag}\n    ${stylesheetMatch[0]}`);
fs.writeFileSync(distIndexPath, updated, "utf8");
