import { Button } from "@/components/ui/button";
import { Home, SearchX } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center px-6 max-w-lg mx-auto">
        <div
          className="size-20 rounded-2xl flex items-center justify-center mx-auto mb-8"
          style={{
            background: "oklch(0.70 0.18 45 / 0.12)",
            border: "1px solid oklch(0.70 0.18 45 / 0.2)",
            boxShadow: "0 0 30px oklch(0.70 0.18 45 / 0.15)",
          }}
        >
          <SearchX className="size-10 text-primary" />
        </div>

        <h1
          className="text-6xl font-bold text-primary mb-3"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          404
        </h1>

        <h2
          className="text-xl font-semibold text-foreground mb-4"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Página não encontrada
        </h2>

        <p className="text-muted-foreground mb-8 leading-relaxed">
          A página que você procura não existe ou foi movida.
          <br />
          Verifique o endereço ou retorne à página inicial.
        </p>

        <Button
          onClick={() => setLocation("/")}
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2.5 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_var(--primary-glow)]"
        >
          <Home className="size-4 mr-2" />
          Voltar ao Início
        </Button>
      </div>
    </div>
  );
}
