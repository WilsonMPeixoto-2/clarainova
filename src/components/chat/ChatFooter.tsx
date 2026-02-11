import { Settings } from "lucide-react";
import { Link } from "wouter";

export function ChatFooter() {
  return (
    <footer
      className="mt-8 py-8"
      style={{
        background: "oklch(0.10 0.04 250 / 0.8)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid oklch(0.95 0.01 250 / 0.06)",
      }}
    >
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3
              className="font-semibold mb-4 text-lg text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Sobre CLARA
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Assistente de inteligência artificial especializada em legislação
              e procedimentos administrativos.
            </p>
            <p className="text-muted-foreground/50 text-xs mt-3">
              Versão de testes (Beta)
            </p>
          </div>

          <div>
            <h3
              className="font-semibold mb-4 text-lg text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Recursos
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/relatorio-tecnico">
                  <span className="text-muted-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-2">
                    <Settings className="size-4" />
                    Relatório Técnico
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3
              className="font-semibold mb-4 text-lg text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Importante
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              As respostas têm caráter orientativo e devem ser validadas por
              fontes oficiais.
            </p>
          </div>
        </div>

        <div className="border-t border-border/20 pt-6 text-center text-muted-foreground/60 text-sm">
          <p>
            © 2026 CLARA — Consultora de Legislação e Apoio a Rotinas
            Administrativas
          </p>
        </div>
      </div>
    </footer>
  );
}
