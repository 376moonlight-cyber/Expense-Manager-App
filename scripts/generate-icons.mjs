import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "assets", "app-icon-source.png");
const iconsDir = path.join(root, "public", "icons");
const appIconPath = path.join(root, "app", "icon.png");
const appleIconPath = path.join(root, "app", "apple-icon.png");
const legacySvgIconPath = path.join(root, "app", "icon.svg");

/** Soft canvas that matches the illustration's rounded-square backdrop. */
const CANVAS = { r: 236, g: 236, b: 238, alpha: 1 };

async function renderPng(source, size, outPath, { scale = 1 } = {}) {
  const inner = Math.round(size * scale);
  const pad = Math.floor((size - inner) / 2);
  const artwork = await sharp(source)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: CANVAS,
    },
  })
    .composite([{ input: artwork, left: pad, top: pad }])
    .png()
    .toFile(outPath);

  console.log(`Wrote ${path.relative(root, outPath)} (${size}x${size})`);
}

async function main() {
  const source = await readFile(sourcePath);
  await mkdir(iconsDir, { recursive: true });

  // Favicon / Next.js metadata icon
  await renderPng(source, 512, appIconPath, { scale: 0.92 });
  // Apple touch icon
  await renderPng(source, 180, appleIconPath, { scale: 0.92 });
  // PWA icons
  await renderPng(source, 192, path.join(iconsDir, "icon-192.png"), {
    scale: 0.92,
  });
  await renderPng(source, 512, path.join(iconsDir, "icon-512.png"), {
    scale: 0.92,
  });
  // Maskable: ~20% safe-zone padding
  await renderPng(source, 512, path.join(iconsDir, "maskable-512.png"), {
    scale: 0.7,
  });

  try {
    await unlink(legacySvgIconPath);
    console.log(`Removed ${path.relative(root, legacySvgIconPath)}`);
  } catch (err) {
    if (err && err.code !== "ENOENT") throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
