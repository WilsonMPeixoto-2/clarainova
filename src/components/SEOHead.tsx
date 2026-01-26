import { useEffect } from "react";

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string[];
  type?: "website" | "article";
  image?: string;
  noIndex?: boolean;
  googleVerification?: string;
}

export function SEOHead({
  title = "CLARA Inteligência Administrativa",
  description = "Consultora de Legislação e Apoio a Rotinas Administrativas. Sua assistente especializada em sistemas eletrônicos de informação e procedimentos administrativos.",
  keywords = ["SEI", "legislação", "administração pública", "assistente virtual", "CLARA", "inteligência administrativa", "procedimentos administrativos"],
  type = "website",
  image = "/og-image.png",
  noIndex = false,
  googleVerification,
}: SEOHeadProps) {
  useEffect(() => {
    // Get the base URL for absolute paths
    const baseUrl = window.location.origin;
    const absoluteImageUrl = image.startsWith("http") ? image : `${baseUrl}${image}`;
    
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

    // Add or update link element
    const updateLink = (rel: string, href: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", rel);
        document.head.appendChild(link);
      }
      link.setAttribute("href", href);
    };

    // Basic SEO
    updateMeta("description", description);
    updateMeta("keywords", keywords.join(", "));
    updateMeta("author", "CLARA");
    
    // Open Graph (Facebook, LinkedIn, WhatsApp)
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
    
    // Twitter Card
    updateMeta("twitter:card", "summary_large_image");
    updateMeta("twitter:title", title);
    updateMeta("twitter:description", description);
    updateMeta("twitter:image", absoluteImageUrl);
    updateMeta("twitter:image:alt", "CLARA - Inteligência Administrativa");

    // Add privacy policy link for Google verification
    updateLink("privacy-policy", "/privacidade.html");
    updateLink("canonical", baseUrl);

    // Add Google site verification if provided
    if (googleVerification) {
      updateMeta("google-site-verification", googleVerification);
    }

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
  }, [title, description, keywords, type, image, noIndex, googleVerification]);

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
