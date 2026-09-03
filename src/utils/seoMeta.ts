import { Platform } from "react-native";

export type SeoMetadata = {
  /** Document title, e.g. "Cinema Club • Search". */
  title: string;
  /** Short summary used for the description meta tag and social previews. */
  description: string;
  /** Absolute or root-relative image URL for social previews. Defaults to the app icon. */
  image?: string;
  /** Open Graph type override, e.g. "video.movie" for movie detail pages. Defaults to "website". */
  type?: string;
};

const DEFAULT_IMAGE_PATH = "/apple-touch-icon.png";
const SITE_NAME = "Cinema Club";

const upsertMetaTag = (attribute: "name" | "property", key: string, content: string) => {
  if (!content) {
    return;
  }

  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
};

const upsertCanonicalLink = (href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
};

const resolveAbsoluteUrl = (origin: string, urlOrPath: string) =>
  /^https?:\/\//i.test(urlOrPath) ? urlOrPath : `${origin}${urlOrPath}`;

/**
 * Updates the document title and SEO/social-preview meta tags (description, canonical,
 * Open Graph, Twitter Card) for the current web route. No-op on native platforms.
 */
export const updateWebSeoMetadata = ({ title, description, image, type }: SeoMetadata) => {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return;
  }

  document.title = title;

  // React Navigation's onStateChange fires before the browser's history/URL updates,
  // so defer reading window.location until the next tick to get the final path.
  const applyUrlDependentTags = () => {
    const origin = window.location.origin;
    const canonicalUrl = resolveAbsoluteUrl(origin, `${window.location.pathname}${window.location.search}`);
    const imageUrl = resolveAbsoluteUrl(origin, image ?? DEFAULT_IMAGE_PATH);

    upsertMetaTag("name", "description", description);
    upsertCanonicalLink(canonicalUrl);

    upsertMetaTag("property", "og:type", type ?? "website");
    upsertMetaTag("property", "og:site_name", SITE_NAME);
    upsertMetaTag("property", "og:title", title);
    upsertMetaTag("property", "og:description", description);
    upsertMetaTag("property", "og:url", canonicalUrl);
    upsertMetaTag("property", "og:image", imageUrl);

    upsertMetaTag("name", "twitter:card", "summary_large_image");
    upsertMetaTag("name", "twitter:title", title);
    upsertMetaTag("name", "twitter:description", description);
    upsertMetaTag("name", "twitter:image", imageUrl);
  };

  setTimeout(applyUrlDependentTags, 0);
};
