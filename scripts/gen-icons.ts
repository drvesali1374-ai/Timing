/**
 * تولید آیکون‌های PWA از SVG منبع (یک‌بار مصرف — خروجی‌ها در public/icons کامیت می‌شوند).
 * اجرا: bun scripts/gen-icons.ts
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";

const SRC = "public/icons/icon.svg";
const svg = readFileSync(SRC);

// نسخه معمولی (هر کاربرد)
for (const size of [64, 192, 512]) {
  await sharp(svg, { density: 400 })
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
  console.log(`✓ icon-${size}.png`);
}

// نسخه maskable — آیکون داخل ناحیه امن ۸۰٪ (پس‌زمینه پُر)
const maskable = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1c1917"/>
  <g transform="translate(51.2 51.2) scale(0.8)">
    ${svg
      .toString()
      .replace(/^<\?xml[^>]*\?>/, "")
      .replace(/<\/?svg[^>]*>/g, "")}
  </g>
</svg>`,
);
for (const size of [192, 512]) {
  await sharp(maskable, { density: 400 })
    .resize(size, size)
    .png()
    .toFile(`public/icons/maskable-${size}.png`);
  console.log(`✓ maskable-${size}.png`);
}

// favicon
await sharp(svg, { density: 400 }).resize(32, 32).png().toFile("public/favicon.png");
console.log("✓ favicon.png");
