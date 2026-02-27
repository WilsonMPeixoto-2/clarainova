import { type ElementType } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type BentoVariant = "default" | "highlight";

interface BentoCardProps {
  title: string;
  description: string;
  icon: ElementType;
  href?: string;
  variant?: BentoVariant;
  className?: string;
}

export default function BentoCard({
  title,
  description,
  icon: Icon,
  href,
  variant = "default",
  className,
}: BentoCardProps) {
  const baseClasses =
    "group relative rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent backdrop-blur-3xl backdrop-saturate-150 px-5 py-5 md:px-6 md:py-6 transition-all duration-500 shadow-[0_24px_64px_-8px_rgba(0,0,0,0.4)] overflow-hidden";
  const interactionClasses =
    "hover:border-white/10 hover:from-white/[0.08] hover:to-white/[0.02] focus:outline-none hover:shadow-[0_32px_80px_-12px_rgba(0,0,0,0.6)] focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:-translate-y-1";
  const variantClasses =
    variant === "highlight"
      ? "bg-[linear-gradient(160deg,hsl(var(--gold-2)/0.08),transparent)] border-primary/20"
      : "";

  if (href) {
    return (
      <a href={href} className={cn(baseClasses, interactionClasses, variantClasses, className)}>
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-white/15 bg-white/5 text-primary">
            <Icon className="w-5 h-5" aria-hidden="true" />
          </span>
          <ArrowUpRight className="w-4 h-4 text-text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-lg md:text-xl font-semibold tracking-tight text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
          {title}
        </h3>
        <p className="mt-2 text-sm md:text-base leading-relaxed text-[hsl(var(--text-muted))]" style={{ fontFamily: "var(--font-body)" }}>
          {description}
        </p>
      </a>
    );
  }

  return (
    <article className={cn(baseClasses, variantClasses, className)}>
      <div className="flex items-start gap-3">
        <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-white/15 bg-white/5 text-primary">
          <Icon className="w-5 h-5" aria-hidden="true" />
        </span>
      </div>
      <h3 className="mt-4 text-lg md:text-xl font-semibold tracking-tight text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
        {title}
      </h3>
      <p className="mt-2 text-sm md:text-base leading-relaxed text-[hsl(var(--text-muted))]" style={{ fontFamily: "var(--font-body)" }}>
        {description}
      </p>
    </article>
  );
}
