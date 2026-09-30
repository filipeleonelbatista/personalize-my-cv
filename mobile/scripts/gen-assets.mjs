// mobile/scripts/gen-assets.mjs — node scripts/gen-assets.mjs
// Generates Android icons + splash from web/app/icon.svg.
import sharp from "sharp";

await sharp("../web/app/icon.svg").resize(1024, 1024).png().toFile("assets/icon.png");
console.log("wrote assets/icon.png");

const inner = await sharp("../web/app/icon.svg").resize(768, 768).png().toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 9, g: 9, b: 11, alpha: 1 } } })
  .composite([{ input: inner, left: 128, top: 128 }])
  .png()
  .toFile("assets/adaptive-icon.png");
console.log("wrote assets/adaptive-icon.png");

const mark = await sharp("../web/app/icon.svg").resize(256, 256).png().toBuffer();
await sharp({ create: { width: 1284, height: 2778, channels: 4, background: { r: 9, g: 9, b: 11, alpha: 1 } } })
  .composite([{ input: mark, left: Math.round((1284 - 256) / 2), top: Math.round((2778 - 256) / 2) }])
  .png()
  .toFile("assets/splash.png");
console.log("wrote assets/splash.png");
