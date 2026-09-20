// scripts/make-brand-assets.mjs   (run with: npm run assets:brand)
//
// Draws Fieldnote's app icon and splash mark — a hard hat with an "inspection
// done" check — and renders every image the app needs from that one drawing, so
// the PNGs are reproducible instead of hand-exported. Colours are the app's own
// palette (src/theme/design.ts); this is a build-time script, so it can't import
// that TypeScript file and repeats the few values it needs.
//
// Writes:  assets/brand/*.svg   (the drawings, viewable in any browser)
//          assets/icon.png, android-icon-foreground/background/monochrome.png,
//          splash-icon.png, favicon.png

import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "assets");
const brand = join(assets, "brand");
mkdirSync(brand, { recursive: true });

const P = {
  purpleTop: "#A283E4",
  purple: "#8B63C9",
  purpleBottom: "#6A44A8",
  soft: "#B79BE3",
  cream: "#FFFCF4",
  beige: "#E6E0CC",
  amber: "#F5B301",
  olive: "#5E7453",
  ink: "#2B2522",
};

// The hat + check, drawn in a 1024 x 1024 box and centred on (512, 512).
const dome = "M262 610 C262 400 380 285 512 285 C644 285 762 400 762 610 Z";
const centre = "translate(-15 -39)"; // the drawing's own bounding box is slightly off-centre

function art({ mono = false } = {}) {
  if (mono) {
    // One flat colour; the ridge, band and the gap around the badge are cut out.
    return `
    <defs>
      <clipPath id="dome"><path d="${dome}"/></clipPath>
      <mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
        <rect width="1024" height="1024" fill="#fff"/>
        <g transform="${centre}">
          <g clip-path="url(#dome)">
            <rect x="482" y="270" width="60" height="360" rx="22" fill="#000"/>
            <rect x="240" y="520" width="544" height="26" fill="#000"/>
          </g>
          <circle cx="742" cy="702" r="146" fill="#000"/>
        </g>
      </mask>
    </defs>
    <g mask="url(#cut)">
      <g transform="${centre}" fill="#000">
        <path d="${dome}"/>
        <rect x="196" y="596" width="632" height="70" rx="35"/>
      </g>
    </g>
    <g transform="${centre}">
      <circle cx="742" cy="702" r="124" fill="#000"/>
      <path d="M690 704 L728 742 L796 662" fill="none" stroke="#fff" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`;
  }
  return `
    <defs><clipPath id="dome"><path d="${dome}"/></clipPath></defs>
    <g transform="${centre}">
      <ellipse cx="512" cy="690" rx="340" ry="30" fill="${P.ink}" opacity="0.2"/>
      <path d="${dome}" fill="${P.cream}"/>
      <g clip-path="url(#dome)">
        <rect x="240" y="500" width="544" height="50" fill="${P.amber}"/>
        <rect x="468" y="270" width="88" height="360" rx="32" fill="${P.soft}"/>
      </g>
      <rect x="196" y="596" width="632" height="70" rx="35" fill="${P.beige}"/>
      <circle cx="742" cy="702" r="124" fill="${P.olive}" stroke="${P.cream}" stroke-width="18"/>
      <path d="M690 704 L728 742 L796 662" fill="none" stroke="#fff" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`;
}

const scaled = (inner, s) => `<g transform="translate(512 512) scale(${s}) translate(-512 -512)">${inner}</g>`;

const gradient = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${P.purpleTop}"/>
      <stop offset="0.55" stop-color="${P.purple}"/>
      <stop offset="1" stop-color="${P.purpleBottom}"/>
    </linearGradient>
    <radialGradient id="gloss" cx="0.3" cy="0.05" r="0.75">
      <stop offset="0" stop-color="#fff" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
const backdrop = `<rect width="1024" height="1024" fill="url(#bg)"/><rect width="1024" height="1024" fill="url(#gloss)"/>`;

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;

const files = {
  // Full-bleed square (iOS and older Android round/squircle it themselves).
  icon: svg(`${gradient}${backdrop}${scaled(art(), 1.16)}`),
  // Android adaptive icon: the launcher masks the outer third, so keep the art inside ~2/3.
  foreground: svg(scaled(art(), 0.74)),
  background: svg(`${gradient}${backdrop}`),
  monochrome: svg(scaled(art({ mono: true }), 0.74)),
  // The splash shows on cream, so the mark sits on a purple tile with padding around it.
  splash: svg(
    `${gradient}
     <rect x="152" y="152" width="720" height="720" rx="180" fill="url(#bg)"/>
     <rect x="152" y="152" width="720" height="720" rx="180" fill="url(#gloss)"/>
     ${scaled(art(), 0.78)}`,
  ),
};

for (const [name, markup] of Object.entries(files)) {
  writeFileSync(join(brand, `${name}.svg`), markup);
}

const render = (name, size, out) =>
  sharp(Buffer.from(files[name]), { density: 300 }).resize(size, size).png().toFile(join(assets, out));

await render("icon", 1024, "icon.png");
await render("foreground", 1024, "android-icon-foreground.png");
await render("background", 1024, "android-icon-background.png");
await render("monochrome", 1024, "android-icon-monochrome.png");
await render("splash", 1024, "splash-icon.png");
await render("icon", 48, "favicon.png");
console.log("brand assets written to", assets);
