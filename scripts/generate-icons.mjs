import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "assets", "app-icon-source.png");
const iconsDir = path.join(root, "public", "icons");
const publicDir = path.join(root, "public");
const appIconPath = path.join(root, "app", "icon.png");
const appleIconPath = path.join(root, "app", "apple-icon.png");
const publicIconPath = path.join(publicDir, "icon.png");
const publicAppleIconPath = path.join(publicDir, "apple-icon.png");
const logoMarkPath = path.join(publicDir, "logo-mark.png");
const faviconPath = path.join(publicDir, "favicon.ico");
const legacySvgIconPath = path.join(root, "app", "icon.svg");
const legacyLogoMarkSvgPath = path.join(publicDir, "logo-mark.svg");

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

async function renderIco(source, outPath) {
  // Multi-size ICO via PNG packing (browsers accept PNG-compressed ICO).
  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) {
    const png = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: CANVAS,
      },
    })
      .composite([
        {
          input: await sharp(source)
            .resize(Math.round(size * 0.92), Math.round(size * 0.92), {
              fit: "contain",
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .png()
            .toBuffer(),
          left: Math.floor(size * 0.04),
          top: Math.floor(size * 0.04),
        },
      ])
      .png()
      .toBuffer();
    images.push({ size, png });
  }

  const headerSize = 6 + 16 * images.length;
  const parts = [];
  let offset = headerSize;
  const dirEntries = Buffer.alloc(16 * images.length);

  images.forEach((img, i) => {
    const entry = dirEntries.subarray(i * 16, i * 16 + 16);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0); // width
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1); // height
    entry.writeUInt8(0, 2); // colors
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bit count
    entry.writeUInt32LE(img.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += img.png.length;
    parts.push(img.png);
  });

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(images.length, 4);

  await writeFile(outPath, Buffer.concat([header, dirEntries, ...parts]));
  console.log(`Wrote ${path.relative(root, outPath)} (ico)`);
}

async function removeIfExists(filePath) {
  try {
    await unlink(filePath);
    console.log(`Removed ${path.relative(root, filePath)}`);
  } catch (err) {
    if (err && err.code !== "ENOENT") throw err;
  }
}

async function main() {
  const source = await readFile(sourcePath);
  await mkdir(iconsDir, { recursive: true });

  // App Router metadata icons
  await renderPng(source, 512, appIconPath, { scale: 0.92 });
  await renderPng(source, 180, appleIconPath, { scale: 0.92 });

  // Public / statically served (favicon, UI, PWA)
  await renderPng(source, 512, publicIconPath, { scale: 0.92 });
  await renderPng(source, 180, publicAppleIconPath, { scale: 0.92 });
  await renderPng(source, 512, logoMarkPath, { scale: 0.92 });
  await renderIco(source, faviconPath);
  await renderPng(source, 192, path.join(iconsDir, "icon-192.png"), {
    scale: 0.92,
  });
  await renderPng(source, 512, path.join(iconsDir, "icon-512.png"), {
    scale: 0.92,
  });
  await renderPng(source, 512, path.join(iconsDir, "maskable-512.png"), {
    scale: 0.7,
  });

  await removeIfExists(legacySvgIconPath);
  await removeIfExists(legacyLogoMarkSvgPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
