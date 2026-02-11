import { Settings } from "lucide-react";
import { Link } from "wouter";

export function ChatFooter() {
  return (
    <footer className="clara-footer">
      <div className="container">
        <div className="clara-footer-grid">
          <div>
            <h3 className="clara-footer-title text-lg text-foreground">Sobre CLARA</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Assistente de inteligencia artificial especializada em legislacao e procedimentos administrativos.
            </p>
            <p className="text-muted-foreground/55 text-xs mt-3">Versao de testes (Beta)</p>
          </div>

          <div>
            <h3 className="clara-footer-title text-lg text-foreground">Recursos</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/relatorio-tecnico">
                  <span className="text-muted-foreground hover:text-primary transition-colors cursor-pointer inline-flex items-center gap-2">
                    <Settings className="size-4" />
                    Relatorio Tecnico
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="clara-footer-title text-lg text-foreground">Importante</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              As respostas tem carater orientativo e devem ser validadas por fontes oficiais.
            </p>
          </div>
        </div>

        <div className="border-t border-border/20 pt-5 text-center text-muted-foreground/65 text-sm">
          <p>(c) 2026 CLARA - Consultora de Legislacao e Apoio a Rotinas Administrativas</p>
        </div>
      </div>
    </footer>
  );
}
