import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const markPath = path.join(root, "public", "logo-mark.svg");
const iconsDir = path.join(root, "public", "icons");
const appleIconPath = path.join(root, "app", "apple-icon.png");

const BRAND = { r: 15, g: 118, b: 110, alpha: 1 }; // #0F766E

async function renderPng(svgBuffer, size, outPath) {
  await sharp(svgBuffer, { density: 384 })
    .resize(size, size, { fit: "contain", background: BRAND })
    .png()
    .toFile(outPath);
  console.log(`Wrote ${path.relative(root, outPath)} (${size}x${size})`);
}

/**
 * Maskable icons need ~20% safe-zone padding so OS masks don't clip the mark.
 * Full-bleed teal canvas with the mark scaled to 70% and centered.
 */
async function renderMaskable(svgBuffer, size, outPath) {
  const inner = Math.round(size * 0.7);
  const pad = Math.floor((size - inner) / 2);
  const markPng = await sharp(svgBuffer, { density: 384 })
    .resize(inner, inner, { fit: "contain", background: BRAND })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND,
    },
  })
    .composite([{ input: markPng, left: pad, top: pad }])
    .png()
    .toFile(outPath);

  console.log(
    `Wrote ${path.relative(root, outPath)} (${size}x${size}, maskable)`,
  );
}

async function main() {
  const svg = await readFile(markPath);
  await mkdir(iconsDir, { recursive: true });

  await renderPng(svg, 180, appleIconPath);
  await renderPng(svg, 192, path.join(iconsDir, "icon-192.png"));
  await renderPng(svg, 512, path.join(iconsDir, "icon-512.png"));
  await renderMaskable(svg, 512, path.join(iconsDir, "maskable-512.png"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
