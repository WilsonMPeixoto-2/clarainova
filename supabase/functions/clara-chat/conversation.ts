export type ConversationalNoticeType =
  | "web_search"
  | "limited_base"
  | "general_guidance"
  | "out_of_scope"
  | "info"
  | "clarification"
  | "source_ambiguity"
  | "low_confidence";

export type ProcessingStage =
  | "understand_question"
  | "search_internal"
  | "compare_sources"
  | "expand_internal"
  | "web_validation"
  | "compose_answer";

export interface QuestionAssessment {
  normalizedQuery: string;
  confidence: "high" | "medium" | "low";
  shouldAskClarification: boolean;
  reason:
    | "generic_reference"
    | "too_short"
    | "error_without_context"
    | "broad_request"
    | "clear_enough";
}

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function chooseVariant(seed: string, variants: string[]): string {
  if (variants.length === 0) return "";
  return variants[hashString(seed) % variants.length];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function assessQuestion(message: string, historyLength: number): QuestionAssessment {
  const normalizedQuery = normalizeWhitespace(message);
  const lower = normalizedQuery.toLowerCase();
  const tokens = lower.split(/\s+/).filter(Boolean);
  const hasRecentContext = historyLength >= 2;

  const hasDomainAnchor =
    /\b(sei|sei-rio|processo|documento|assinatura|bloco|tramita|tramitacao|andamento|unidade|incluir|anexar|pdf|menu|tela|botao|despacho|portaria|decreto|lei|publicacao|pesquisa)\b/.test(
      lower,
    );

  const hasGenericReference =
    /\b(isso|isto|aquilo|essa|esse|essa parte|essa tela|esse botao|aquele menu)\b/.test(lower);

  const looksLikeErrorWithoutContext =
    /\b(erro|falha|nao funciona|não funciona|travou|bugou)\b/.test(lower) && !hasDomainAnchor;

  const isTooShort = tokens.length <= 3 && normalizedQuery.length < 24;
  const isBroadRequest =
    !hasRecentContext &&
    /\b(como faco|como faço|me ajuda|me explique|onde fica|qual caminho)\b/.test(lower) &&
    !hasDomainAnchor;

  if (!hasRecentContext && (hasGenericReference || looksLikeErrorWithoutContext)) {
    return {
      normalizedQuery,
      confidence: "low",
      shouldAskClarification: true,
      reason: hasGenericReference ? "generic_reference" : "error_without_context",
    };
  }

  if (!hasRecentContext && isTooShort && !hasDomainAnchor) {
    return {
      normalizedQuery,
      confidence: "low",
      shouldAskClarification: true,
      reason: "too_short",
    };
  }

  if (isBroadRequest) {
    return {
      normalizedQuery,
      confidence: "medium",
      shouldAskClarification: true,
      reason: "broad_request",
    };
  }

  return {
    normalizedQuery,
    confidence: hasDomainAnchor ? "high" : "medium",
    shouldAskClarification: false,
    reason: "clear_enough",
  };
}

function shortenTitle(title: string): string {
  return normalizeWhitespace(title.replace(/\.pdf$/i, "").replace(/\s+/g, " ")).slice(0, 90);
}

export function buildClarificationReply(opts: {
  reason: QuestionAssessment["reason"];
  message: string;
  candidateSources?: string[];
  seed: string;
}): string {
  const intro = chooseVariant(`${opts.seed}:clarification:intro`, [
    "Quero te orientar com seguranca, entao preciso confirmar um ponto antes de seguir.",
    "Para eu te ajudar da forma mais precisa possivel, preciso alinhar um detalhe com voce.",
    "Posso te fazer uma pergunta curta so para direcionar melhor a orientacao?",
  ]);

  const closing = chooseVariant(`${opts.seed}:clarification:closing`, [
    "Se preferir, voce tambem pode me dizer em que tela ou etapa isso aconteceu.",
    "Se ficar mais facil, me conte qual era o objetivo final que voce queria alcancar no SEI-Rio.",
    "Com um pouco mais de contexto, eu consigo comparar as referencias certas e te orientar melhor.",
  ]);

  const compared = opts.candidateSources
    ?.filter(Boolean)
    .slice(0, 2)
    .map(shortenTitle);

  if (compared && compared.length === 2) {
    return `${intro}\n\nPelo que aparece na base, a sua duvida pode estar mais proxima de "${compared[0]}" ou "${compared[1]}". Qual dos dois contextos esta mais perto do que voce quer fazer?\n\n${closing}`;
  }

  if (opts.reason === "error_without_context") {
    return `${intro}\n\nVoce pode me dizer em que tela, etapa ou mensagem de erro isso aconteceu? Assim eu evito te passar um caminho que nao combine com o seu caso.\n\n${closing}`;
  }

  if (opts.reason === "generic_reference") {
    return `${intro}\n\nA sua pergunta pode estar se referindo a mais de uma acao dentro do sistema. Se puder, me diga qual tarefa voce estava tentando fazer ou em que ponto do fluxo voce ficou com duvida.\n\n${closing}`;
  }

  return `${intro}\n\nSe puder, descreva com um pouco mais de contexto o que voce estava tentando fazer no SEI-Rio. Isso me ajuda a localizar a orientacao certa sem assumir algo que nao corresponde ao seu caso.\n\n${closing}`;
}

export function processingMessage(stage: ProcessingStage, seed: string): string {
  const variants: Record<ProcessingStage, string[]> = {
    understand_question: [
      "Entendendo a sua duvida",
      "Organizando o contexto da sua pergunta",
      "Lendo com cuidado o que voce precisa",
    ],
    search_internal: [
      "Pesquisando na base interna",
      "Consultando os materiais da base interna",
      "Buscando as referencias mais aderentes ao tema",
    ],
    compare_sources: [
      "Comparando orientacoes e versoes",
      "Cruzando as referencias encontradas",
      "Verificando qual orientacao se aplica melhor ao SEI-Rio",
    ],
    expand_internal: [
      "Ampliando a analise na base interna",
      "Buscando mais referencias para reduzir a duvida",
      "Conferindo outros materiais relacionados na base",
    ],
    web_validation: [
      "Confirmando a informacao em fontes oficiais",
      "Fazendo uma checagem complementar em fontes oficiais",
      "Validando este ponto fora da base interna para te responder com mais seguranca",
    ],
    compose_answer: [
      "Organizando a resposta para voce",
      "Montando a orientacao final com cuidado",
      "Preparando uma resposta clara e objetiva",
    ],
  };

  return chooseVariant(`${seed}:${stage}`, variants[stage]);
}

export function buildNotice(opts: {
  type: ConversationalNoticeType;
  seed: string;
  comparedSources?: string[];
  preferredSources?: string[];
  webSourceCount?: number;
}): { type: ConversationalNoticeType; message: string } {
  const compared = opts.comparedSources?.filter(Boolean).slice(0, 2).map(shortenTitle) || [];
  const preferred = opts.preferredSources?.filter(Boolean).slice(0, 1).map(shortenTitle) || [];

  if (opts.type === "source_ambiguity") {
    const message = preferred[0]
      ? `${chooseVariant(`${opts.seed}:source_ambiguity`, [
          "Encontrei pequenas variacoes entre as referencias e priorizei a orientacao mais aderente ao SEI-Rio.",
          "Cruzei referencias com pequenas variacoes e consolidei a orientacao que parece mais aplicavel ao SEI-Rio.",
          "Havia pequenas diferencas entre as fontes, entao consolidei a resposta com foco na referencia mais aderente ao seu contexto.",
        ])} Base principal: ${preferred[0]}.`
      : chooseVariant(`${opts.seed}:source_ambiguity:fallback`, [
          "Encontrei pequenas variacoes entre as referencias e consolidei a orientacao mais aderente ao SEI-Rio.",
          "Cruzei materiais com pequenas diferencas para evitar uma resposta apressada ou imprecisa.",
        ]);
    return { type: opts.type, message };
  }

  if (opts.type === "web_search") {
    const sourceCount = opts.webSourceCount ?? 0;
    return {
      type: opts.type,
      message: chooseVariant(`${opts.seed}:web_search:${sourceCount}`, [
        `A base interna deixou uma duvida neste ponto, entao consultei ${sourceCount || "algumas"} fonte${sourceCount === 1 ? "" : "s"} oficial${sourceCount === 1 ? "" : "s"} para confirmar a orientacao.`,
        `Usei fontes oficiais da web para validar este trecho da resposta com mais seguranca.`,
        `Fiz uma checagem complementar em fontes oficiais porque a base interna, sozinha, nao eliminou toda a duvida.`,
      ]),
    };
  }

  if (opts.type === "low_confidence") {
    const sourceHint =
      compared.length >= 2 ? ` Comparei, entre outras, ${compared[0]} e ${compared[1]}.` : "";
    return {
      type: opts.type,
      message:
        chooseVariant(`${opts.seed}:low_confidence`, [
          "Encontrei materiais proximos do seu tema, mas eles nao parecem corresponder com seguranca total ao que voce precisa.",
          "Os achados ajudam a orientar, mas ainda existe margem de duvida sobre a aderencia exata ao seu caso.",
          "Prefiro te sinalizar com transparencia que a resposta ficou com confianca parcial neste ponto.",
        ]) + sourceHint,
    };
  }

  if (opts.type === "clarification") {
    return {
      type: opts.type,
      message: chooseVariant(`${opts.seed}:clarification_notice`, [
        "Vou alinhar um detalhe com voce antes de responder, para evitar um caminho que nao combine com o seu caso.",
        "Preciso confirmar um ponto da sua duvida antes de seguir, assim a orientacao fica mais precisa.",
      ]),
    };
  }

  if (opts.type === "limited_base") {
    return {
      type: opts.type,
      message: chooseVariant(`${opts.seed}:limited_base`, [
        "A base interna trouxe pouco contexto para este tema, entao vou responder com cautela.",
        "Encontrei pouco material diretamente aderente a esta pergunta na base interna.",
      ]),
    };
  }

  return {
    type: opts.type,
    message: chooseVariant(`${opts.seed}:${opts.type}`, [
      "Estou mantendo a resposta transparente para que voce acompanhe como cheguei a essa orientacao.",
      "Quero te mostrar esse contexto para que a resposta fique clara e confiavel.",
    ]),
  };
}
