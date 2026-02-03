import { useEffect, useMemo } from "react";

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string[];
  type?: "website" | "article";
  image?: string;
  noIndex?: boolean;
  googleVerification?: string;
}

// Cache DOM query results to avoid repeated lookups
const metaCache = new Map<string, HTMLMetaElement>();
const linkCache = new Map<string, HTMLLinkElement>();

export function SEOHead({
  title = "CLARA Inteligência Administrativa",
  description = "Consultora de Legislação e Apoio a Rotinas Administrativas. Sua assistente especializada em sistemas eletrônicos de informação e procedimentos administrativos.",
  keywords = ["SEI", "legislação", "administração pública", "assistente virtual", "CLARA", "inteligência administrativa", "procedimentos administrativos"],
  type = "website",
  image = "/og-image.png",
  noIndex = false,
  googleVerification,
}: SEOHeadProps) {
  // Pre-compute values outside of effect to avoid reflow
  const computedTitle = useMemo(() => 
    title.includes("CLARA") ? title : `${title} | CLARA`, 
    [title]
  );
  
  const keywordsStr = useMemo(() => keywords.join(", "), [keywords]);

  useEffect(() => {
    // Batch all DOM writes using double RAF to ensure they happen after paint
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Get origin once (this is a property read, not a layout query)
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const absoluteImageUrl = image.startsWith("http") ? image : `${baseUrl}${image}`;
        
        // Update document title
        document.title = computedTitle;

        // Batch meta updates using cached elements
        const updateMeta = (name: string, content: string, isProperty = false) => {
          const cacheKey = `${isProperty ? 'p' : 'n'}_${name}`;
          let meta = metaCache.get(cacheKey);
          
          if (!meta) {
            const attr = isProperty ? "property" : "name";
            meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null ?? undefined;
            if (!meta) {
              meta = document.createElement("meta");
              meta.setAttribute(isProperty ? "property" : "name", name);
              document.head.appendChild(meta);
            }
            if (meta) metaCache.set(cacheKey, meta);
          }
          
          if (meta) meta.setAttribute("content", content);
        };

        // Batch link updates using cached elements
        const updateLink = (rel: string, href: string) => {
          let link = linkCache.get(rel);
          
          if (!link) {
            link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null ?? undefined;
            if (!link) {
              link = document.createElement("link");
              link.setAttribute("rel", rel);
              document.head.appendChild(link);
            }
            if (link) linkCache.set(rel, link);
          }
          
          if (link) link.setAttribute("href", href);
        };

        // All meta updates batched together (no layout reads between writes)
        updateMeta("description", description);
        updateMeta("keywords", keywordsStr);
        updateMeta("author", "CLARA");
        
        updateMeta("og:title", title, true);
        updateMeta("og:description", description, true);
        updateMeta("og:type", type, true);
        updateMeta("og:image", absoluteImageUrl, true);
        updateMeta("og:image:width", "1200", true);
        updateMeta("og:image:height", "630", true);
        updateMeta("og:image:alt", "CLARA - Consultora de Legislação e Apoio a Rotinas Administrativas", true);
        updateMeta("og:url", baseUrl, true);
        updateMeta("og:site_name", "CLARA", true);
        updateMeta("og:locale", "pt_BR", true);
        
        updateMeta("twitter:card", "summary_large_image");
        updateMeta("twitter:title", title);
        updateMeta("twitter:description", description);
        updateMeta("twitter:image", absoluteImageUrl);
        updateMeta("twitter:image:alt", "CLARA - Inteligência Administrativa");

        updateLink("privacy-policy", "/privacidade.html");
        updateLink("canonical", baseUrl);

        if (googleVerification) {
          updateMeta("google-site-verification", googleVerification);
        }

        if (noIndex) {
          updateMeta("robots", "noindex, nofollow");
        }
      });
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (noIndex) {
        const robotsMeta = document.querySelector('meta[name="robots"]');
        if (robotsMeta) robotsMeta.remove();
      }
    };
  }, [computedTitle, description, keywordsStr, type, image, noIndex, googleVerification, title]);

  return null;
}

// JSON-LD Schema component
export function SchemaOrg({ 
  type = "Organization",
  data 
}: { 
  type?: "Organization" | "WebApplication" | "FAQPage";
  data?: Record<string, unknown>;
}) {
  useEffect(() => {
    const defaultSchemas = {
      Organization: {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "CLARA",
        description: "Consultora de Legislação e Apoio a Rotinas Administrativas",
        url: window.location.origin,
      },
      WebApplication: {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "CLARA",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: "Assistente virtual especializada em SEI, SDP e procedimentos administrativos",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "BRL",
        },
      },
      FAQPage: {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [],
      },
    };

    const schema = data || defaultSchemas[type];
    
    let script = document.querySelector('script[type="application/ld+json"]');
    if (!script) {
      script = document.createElement("script");
      script.setAttribute("type", "application/ld+json");
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);

    return () => {
      script?.remove();
    };
  }, [type, data]);

  return null;
}
