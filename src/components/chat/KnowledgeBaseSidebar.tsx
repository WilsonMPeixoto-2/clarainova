import { FileText, AlertTriangle, Info, Globe, BookOpen } from "lucide-react";

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
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all duration-200 group">
      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0
        group-hover:bg-primary/15 group-hover:shadow-[0_0_8px_var(--primary-glow)]
        transition-all duration-200"
      >
        <FileText className="size-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-foreground truncate">{title}</h4>
        <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
      </div>
      <div
        className={`size-2 rounded-full shrink-0 mt-1.5 ${
          status === "indexed"
            ? "bg-success shadow-[0_0_6px_var(--success)]"
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
    <aside className="w-full">
      <div
        className="rounded-xl p-5 space-y-4"
        style={{
          background: "oklch(0.16 0.04 250 / 0.3)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid oklch(0.95 0.01 250 / 0.08)",
        }}
      >
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="size-5 text-primary" />
          Base de Conhecimento
        </h3>

        <div className="space-y-2">
          <DocumentItem
            title="Manual do Usuário SEI 4.0"
            description="Guia completo de operações no Sistema Eletrônico de Informações"
            status="indexed"
          />
          <DocumentItem
            title="Cartilha do Usuário SEI"
            description="Orientações práticas para uso do sistema"
            status="indexed"
          />
          <DocumentItem
            title="Manual de Procedimentos Administrativos"
            description="Procedimentos para gestão administrativa"
            status="indexed"
          />
          <DocumentItem
            title="Guia de Orientações Administrativas"
            description="Diretrizes para procedimentos institucionais"
            status="indexed"
          />
        </div>

        <p className="text-xs text-muted-foreground text-center italic">
          Base atualizada em: 12/01/2026
        </p>

        {/* About */}
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
          <h4 className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
            <Info className="size-3.5 text-primary" />
            Sobre este assistente
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed text-justify">
            Projeto de inteligência artificial especializada em sistemas institucionais,
            em fase de validação e aprimoramento, voltado ao apoio operacional na utilização
            de procedimentos administrativos.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed text-justify mt-1.5 font-medium">
            Este ambiente é uma ferramenta de suporte e não constitui canal oficial,
            nem substitui orientações formais de órgãos competentes.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/15">
          <h4 className="text-sm font-semibold text-primary mb-1.5 flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            Ressalva
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed text-justify">
            As respostas têm caráter orientativo, podendo conter limitações inerentes
            a sistemas automatizados. Recomenda-se validação por documentação oficial
            vigente e pelos fluxos e orientações dos setores responsáveis.
          </p>
        </div>

        {/* Scope */}
        <div className="p-3 bg-muted/30 rounded-lg">
          <h4 className="text-sm font-semibold text-foreground mb-1.5">
            Limites de atuação
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed text-justify">
            O conteúdo baseia-se na documentação oficial inserida na base de conhecimento,
            limitando-se a orientações sobre procedimentos administrativos e normas correlatas.
          </p>
        </div>

        {/* External search */}
        <div className="p-3 bg-muted/30 rounded-lg">
          <h4 className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
            <Globe className="size-3.5 text-complementar" />
            Busca externa
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed text-justify">
            Na ausência de base documental interna suficiente, o assistente poderá consultar
            fontes externas oficiais (preferencialmente .gov.br), mantendo o tema restrito a
            procedimentos administrativos. Links serão indicados na resposta.
          </p>
        </div>
      </div>
    </aside>
  );
}
