import { useEffect } from "react";

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string[];
  type?: "website" | "article";
  image?: string;
  noIndex?: boolean;
}

export function SEOHead({
  title = "CLARA - Assistente de Legislação",
  description = "Consultora de Legislação e Apoio a Rotinas Administrativas. Sua assistente especializada em SEI, SDP e procedimentos da 4ª CRE.",
  keywords = ["SEI", "SDP", "legislação", "4ª CRE", "assistente virtual", "administração pública"],
  type = "website",
  image = "/og-image.png",
  noIndex = false,
}: SEOHeadProps) {
  useEffect(() => {
    // Update document title
    document.title = title.includes("CLARA") ? title : `${title} | CLARA`;

    // Update meta tags
    const updateMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? "property" : "name";
      let meta = document.querySelector(`meta[${attr}="${name}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    updateMeta("description", description);
    updateMeta("keywords", keywords.join(", "));
    updateMeta("og:title", title, true);
    updateMeta("og:description", description, true);
    updateMeta("og:type", type, true);
    updateMeta("og:image", image, true);
    updateMeta("twitter:card", "summary_large_image");
    updateMeta("twitter:title", title);
    updateMeta("twitter:description", description);

    if (noIndex) {
      updateMeta("robots", "noindex, nofollow");
    }

    // Cleanup
    return () => {
      if (noIndex) {
        const robotsMeta = document.querySelector('meta[name="robots"]');
        if (robotsMeta) robotsMeta.remove();
      }
    };
  }, [title, description, keywords, type, image, noIndex]);

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
