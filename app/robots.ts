import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/(dashboard)/"],
      },
      {
        userAgent: [
          "GPTBot",
          "ClaudeBot",
          "Bytespider",
          "CCBot",
          "PerplexityBot",
          "Google-Extended",
          "cohere-ai",
        ],
        disallow: "/",
      },
    ],
  };
}
