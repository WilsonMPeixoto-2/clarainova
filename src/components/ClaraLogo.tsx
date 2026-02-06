interface ClaraLogoProps {
  size?: number;
  className?: string;
  title?: string;
  variant?: "default" | "light";
}

// Color schemes for different variants - defined outside to avoid recreation
const COLOR_SCHEMES = {
  default: {
    primary: "#1e3a8a",
    secondary: "#1e3a8a", 
    accent: "#f59e0b",
    bg: "rgba(30, 58, 138, 0.1)",
    stroke: "white"
  },
  light: {
    primary: "#ffffff",
    secondary: "#ffffff",
    accent: "#f59e0b",
    bg: "rgba(255, 255, 255, 0.1)",
    stroke: "white"
  }
} as const;

/**
 * CLARA Logo Component - Origami-inspired design
 * Represents intelligence and precision through geometric shapes
 * Colors: Royal Blue #1e3a8a and Amber #f59e0b
 */
export default function ClaraLogo({ 
  size = 48, 
  className = "", 
  title = "CLARA - Consultora de Legislação e Apoio a Rotinas Administrativas",
  variant = "default"
}: ClaraLogoProps) {
  const colors = COLOR_SCHEMES[variant];
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
    >
      {title && <title>{title}</title>}
      
      {/* Background Circle */}
      <circle cx="24" cy="24" r="22" fill={colors.bg} />
      
      {/* Origami Paper Fold Effect - Main Shape */}
      {/* Top Triangle */}
      <path
        d="M24 6 L38 18 L24 18 Z"
        fill={colors.primary}
        opacity="0.9"
      />
      
      {/* Left Fold */}
      <path
        d="M10 18 L24 18 L17 30 Z"
        fill={colors.secondary}
      />
      
      {/* Right Fold - Amber */}
      <path
        d="M24 18 L38 18 L31 30 Z"
        fill={colors.accent}
      />
      
      {/* Bottom Left Triangle */}
      <path
        d="M17 30 L24 42 L10 42 Z"
        fill={colors.primary}
        opacity="0.8"
      />
      
      {/* Bottom Right Triangle - Amber Lighter */}
      <path
        d="M31 30 L38 42 L24 42 Z"
        fill={colors.accent}
        opacity="0.8"
      />
      
      {/* Center Diamond - Accent */}
      <path
        d="M24 18 L31 30 L24 42 L17 30 Z"
        fill={colors.primary}
        opacity="0.3"
      />
      
      {/* Highlight Lines - for depth */}
      <path
        d="M24 18 L24 42"
        stroke={colors.stroke}
        strokeWidth="0.5"
        opacity="0.4"
      />
      <path
        d="M17 30 L31 30"
        stroke={colors.stroke}
        strokeWidth="0.5"
        opacity="0.4"
      />
      
      {/* Letter C - Stylized in center */}
      <path
        d="M26 24 A4 4 0 1 0 26 30"
        stroke={colors.stroke}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
