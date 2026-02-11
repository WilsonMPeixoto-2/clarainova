import { FileText, AlertTriangle, Info, BookOpen } from "lucide-react";

function DocumentItem({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: "indexed" | "pending" | "error";
}) {
  return (
    <div className="clara-doc-item">
      <div className="clara-doc-icon">
        <FileText className="size-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-foreground truncate">{title}</h4>
        <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
      </div>
      <div
        className={`size-2 rounded-full shrink-0 mt-1.5 ${
          status === "indexed"
            ? "bg-success shadow-[0_0_8px_var(--success)]"
            : status === "pending"
              ? "bg-primary"
              : "bg-destructive"
        }`}
      />
    </div>
  );
}

export function KnowledgeBaseSidebar() {
  return (
    <aside className="w-full min-h-0">
      <div className="clara-kb-panel custom-scrollbar">
        <h3 className="clara-kb-title font-semibold text-foreground">
          <BookOpen className="size-5 text-primary" />
          Base de Conhecimento
        </h3>

        <div className="space-y-2">
          <DocumentItem
            title="Manual do Usuario SEI 4.0"
            description="Guia completo de operacoes no Sistema Eletronico de Informacoes"
            status="indexed"
          />
          <DocumentItem
            title="Cartilha do Usuario SEI"
            description="Orientacoes praticas para uso do sistema"
            status="indexed"
          />
          <DocumentItem
            title="Manual de Procedimentos Administrativos"
            description="Procedimentos para gestao administrativa"
            status="indexed"
          />
          <DocumentItem
            title="Guia de Orientacoes Administrativas"
            description="Diretrizes para procedimentos institucionais"
            status="indexed"
          />
        </div>

        <p className="text-xs text-muted-foreground text-center italic mt-1">Base atualizada em: 12/01/2026</p>

        <div className="clara-panel-block clara-panel-block-emphasis">
          <h4 className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
            <Info className="size-3.5 text-primary" />
            Sobre este assistente
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed text-justify">
            Projeto de inteligencia artificial especializada em sistemas institucionais, em fase de validacao e
            aprimoramento, voltado ao apoio operacional na utilizacao de procedimentos administrativos.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed text-justify mt-1.5 font-medium">
            Este ambiente e uma ferramenta de suporte e nao constitui canal oficial, nem substitui orientacoes formais
            de orgaos competentes.
          </p>
        </div>

        <div className="clara-panel-block clara-panel-block-emphasis">
          <h4 className="text-sm font-semibold text-primary mb-1.5 flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            Ressalva
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed text-justify">
            As respostas tem carater orientativo, podendo conter limitacoes inerentes a sistemas automatizados.
            Recomenda-se validacao por documentacao oficial vigente e pelos fluxos e orientacoes dos setores
            responsaveis.
          </p>
        </div>

        <div className="clara-panel-block">
          <h4 className="text-sm font-semibold text-foreground mb-1.5">Limites de atuacao</h4>
          <p className="text-xs text-muted-foreground leading-relaxed text-justify">
            O conteudo baseia-se na documentacao oficial inserida na base de conhecimento, limitando-se a orientacoes
            sobre procedimentos administrativos e normas correlatas.
          </p>
        </div>
      </div>
    </aside>
  );
}
