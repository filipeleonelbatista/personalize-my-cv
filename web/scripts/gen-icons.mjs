// web/scripts/gen-icons.mjs — node scripts/gen-icons.mjs (requires sharp)
import sharp from "sharp";
const jobs = [
  ["app/icon.svg", "public/icon-192.png", 192, 0],
  ["app/icon.svg", "public/icon-512.png", 512, 0],
  ["app/icon.svg", "public/maskable-512.png", 512, 64],
  ["app/icon.svg", "public/apple-touch-icon.png", 180, 0],
];
for (const [src, dest, size, pad] of jobs) {
  const inner = size - pad * 2;
  const png = await sharp(src).resize(inner, inner).png().toBuffer();
  if (!pad) await sharp(png).toFile(dest);
  else {
    await sharp({ create: { width: size, height: size, channels: 4, background: { r: 9, g: 9, b: 11, alpha: 1 } } })
      .composite([{ input: png, left: pad, top: pad }]).png().toFile(dest);
  }
  console.log("wrote", dest);
}

// Banner de compartilhamento (placeholder — texto exige fonte; o usuário
// substitui pelo banner desenhado; ver README "Assets visuais").
await sharp({ create: { width: 1200, height: 630, channels: 4, background: { r: 9, g: 9, b: 11, alpha: 1 } } })
  .composite([{ input: await sharp("app/icon.svg").resize(256, 256).png().toBuffer(), left: 120, top: 187 }])
  .png()
  .toFile("public/opengraph-image.png");
console.log("wrote public/opengraph-image.png");
