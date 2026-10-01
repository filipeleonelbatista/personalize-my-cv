// web/app/sitemap.ts
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: "/", lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: "/privacidade", lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: "/termos", lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
