import { Helmet } from "react-helmet-async";

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
  image = "/og-image.jpg",
  noIndex = false,
  googleVerification,
}: SEOHeadProps) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://clarainova.vercel.app";
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const absoluteUrl = `${origin}${pathname}`;
  const absoluteImageUrl = image.startsWith("http") ? image : `${origin}${image}`;
  const normalizedTitle = title.includes("CLARA") ? title : `${title} | CLARA`;

  return (
    <Helmet prioritizeSeoTags>
      <title>{normalizedTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords.join(", ")} />
      <meta name="author" content="CLARA" />
      <meta name="robots" content={noIndex ? "noindex, nofollow" : "index, follow"} />
      <meta property="og:title" content={normalizedTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={absoluteImageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="CLARA - Consultora de Legislação e Apoio a Rotinas Administrativas" />
      <meta property="og:url" content={absoluteUrl} />
      <meta property="og:site_name" content="CLARA" />
      <meta property="og:locale" content="pt_BR" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={normalizedTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImageUrl} />
      <meta name="twitter:image:alt" content="CLARA - Inteligência Administrativa" />
      <meta name="twitter:url" content={absoluteUrl} />
      {googleVerification ? (
        <meta name="google-site-verification" content={googleVerification} />
      ) : null}
      <link rel="canonical" href={absoluteUrl} />
      <link rel="privacy-policy" href="/privacidade.html" />
    </Helmet>
  );
}

// JSON-LD Schema component
export function SchemaOrg({ 
  type = "Organization",
  data 
}: { 
  type?: "Organization" | "WebApplication" | "FAQPage";
  data?: Record<string, unknown>;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://clarainova.vercel.app";
  const defaultSchemas = {
    Organization: {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "CLARA",
      description: "Consultora de Legislação e Apoio a Rotinas Administrativas",
      url: origin,
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

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}
