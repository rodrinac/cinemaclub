// Renders every app icon, favicon and splash image from the SVG sources in
// assets/brand, using Playwright's Chromium (already a dev dependency) so no
// image tooling is needed. Run with: npm run brand:assets
import { chromium } from "@playwright/test";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = path.join(root, "assets/brand");

const tileSvg = await readFile(path.join(brandDir, "logo-tile.svg"), "utf8");
const markSvg = await readFile(path.join(brandDir, "logo-mark.svg"), "utf8");
// iOS, Expo and apple-touch icons must be full-bleed squares; the OS rounds them.
const squareSvg = tileSvg.replace('rx="224"', 'rx="0"');

const browser = await chromium.launch();
const page = await browser.newPage();

/**
 * Rasterizes an SVG at `size` x `height` px. `scale` shrinks the artwork inside
 * the canvas (used for Android's adaptive-icon safe zone).
 */
const render = async (svg, size, { type = "image/png", scale = 1, height = size } = {}) => {
  const dataUrl = await page.evaluate(
    async ({ svg, width, height, type, scale }) => {
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      const drawnWidth = width * scale;
      const drawnHeight = height * scale;
      context.drawImage(
        image,
        (width - drawnWidth) / 2,
        (height - drawnHeight) / 2,
        drawnWidth,
        drawnHeight,
      );
      return canvas.toDataURL(type, 0.95);
    },
    { svg, width: size, height, type, scale },
  );

  return Buffer.from(dataUrl.split(",")[1], "base64");
};

const write = async (relativePath, buffer) => {
  await writeFile(path.join(root, relativePath), buffer);
  console.log(`wrote ${relativePath}`);
};

/** ICO container with embedded PNG frames (supported by every current browser). */
const buildIco = (frames) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);

  let offset = 6 + frames.length * 16;
  const entries = frames.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...frames.map(({ png }) => png)]);
};

await write("assets/icon.png", await render(squareSvg, 1024));
// In-app art: the nav rail mark and the empty-state images for posters and the
// movie detail banner (used when TMDB has no image).
await write("assets/brand/logo-mark.png", await render(markSvg, 192));
await write(
  "assets/brand/banner-placeholder.png",
  await render(await readFile(path.join(brandDir, "banner-placeholder.svg"), "utf8"), 1600, { height: 900 }),
);
await write(
  "assets/brand/poster-placeholder.png",
  await render(await readFile(path.join(brandDir, "poster-placeholder.svg"), "utf8"), 600, { height: 900 }),
);
await write("assets/splash.png", await render(markSvg, 1024));
// Android adaptive icon foreground: the mark inside the 66/108 safe zone on a
// transparent canvas; app.json supplies the background color. Expo prebuild
// generates the native ios/ and android/ icons (both gitignored) from these.
await write("assets/adaptive-icon.png", await render(markSvg, 1024, { scale: 0.72 }));

const faviconFrames = [];
for (const size of [16, 32, 48]) {
  faviconFrames.push({ size, png: await render(tileSvg, size) });
}

for (const dir of ["public", "assets/favicon"]) {
  await write(`${dir}/favicon-16x16.png`, faviconFrames[0].png);
  await write(`${dir}/favicon-32x32.png`, faviconFrames[1].png);
  await write(`${dir}/apple-touch-icon.png`, await render(squareSvg, 180));
  await write(`${dir}/favicon.ico`, buildIco(faviconFrames));
}

await copyFile(path.join(brandDir, "logo-tile.svg"), path.join(root, "public/favicon.svg"));
console.log("wrote public/favicon.svg");

await browser.close();
