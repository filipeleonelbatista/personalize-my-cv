// web/app/sitemap.ts
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "/", lastModified: new Date(), changeFrequency: "weekly", priority: 1 }];
}
