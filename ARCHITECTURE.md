---

# Relatório de Decisão Arquitetural (ADR): Projeto Clarainova

**Data:** Março de 2026
**Status:** Aprovado para Implementação
**Tópico:** Arquitetura Híbrida de IA, RAG Enxuto e FinOps

## 1. Visão Geral e Estratégia de Custos (FinOps)

O projeto Clarainova tem como objetivo ser um assistente virtual inteligente capaz de realizar buscas semânticas, extração de dados e raciocínio sobre uma base restrita de documentos em PDF.

O principal desafio arquitetural não foi a tecnologia da IA em si, mas a **viabilidade financeira**. O projeto recebeu um subsídio de $1.000 em créditos do Google Cloud (Vertex AI). A armadilha padrão da indústria é atrelar todo o backend a esses serviços Enterprise (vendor lock-in), o que geraria custos de manutenção impossíveis de serem pagos quando o crédito expirar.

**A Decisão Técnica:** Optamos por uma **Arquitetura Híbrida**. O núcleo do sistema roda em infraestrutura 100% gratuita para sempre. Os créditos do Google serão utilizados exclusivamente de forma tática (como microserviços) para gerar funcionalidades Premium sob demanda, protegidas por uma chave de desligamento remoto.

## 2. A Fundação do Sistema (Custo Mensal: $0)

A base da Clarainova não depende do Vertex AI. Se o crédito do Google acabar hoje, o sistema continua operando sem interrupções através da seguinte stack:

* **Frontend e Backend Edge:** **Vercel** (React + Node.js). Hospeda a interface do usuário e as *Serverless Functions* que atuam como nosso gateway seguro de API.
* **Banco de Dados e RAG:** **Supabase**. Armazena os textos dos 6 PDFs estruturais já vetorizados (embeddings). O Supabase realiza a busca por similaridade de forma rápida e gratuita.
* **Inteligência Cognitiva Padrão:** **Google AI Studio (Gemini 1.5 Flash)**. Usando a cota gratuita para desenvolvedores, este modelo processa 90% das interações (perguntas em texto puro baseadas nos PDFs resgatados do Supabase).

## 3. A Camada Premium (Uso Tático dos $1.000)

Para elevar a experiência do usuário de um simples "chatbot" para um assistente de nível Enterprise, integramos o Vertex AI do Google Cloud apenas para tarefas de alto custo computacional. Estas funcionalidades agregam um "efeito UAU" à Clarainova:

1. **Geração de Elementos Visuais (SVG Inline):** Em vez de apenas descrever processos, o sistema aciona o *Gemini 3.1 Pro* no Vertex AI para desenhar ícones de interface e gerar fluxogramas estruturados (Mermaid.js/SVG) diretamente no fluxo da conversa.
2. **Visão Computacional Aplicada:** Para dúvidas sobre seções visuais dos PDFs (tabelas, assinaturas, layouts), o *Vertex AI Layout Parser* resgata e exibe o "print" exato do documento original.
3. **Resumos em Áudio (TTS Ultra-Realista):** Integração com o *Gemini 2.5 Pro TTS* para transformar respostas longas e resumos de editais/contratos em áudio consumível pelo usuário em trânsito.

## 4. O Roteador Inteligente e Segurança Financeira

O coração dessa arquitetura é a função `api/chat.ts` hospedada na Vercel, que atua como um "LLM Gateway". Ela possui o controle absoluto sobre o fluxo de dados e, mais importante, sobre os gastos.

### O Padrão "Kill Switch" (Feature Flag)

Implementamos uma variável de ambiente chamada `ENABLE_VERTEX_PREMIUM`.

* **Se `true`:** A função Vercel faz uma triagem rápida da pergunta do usuário. Se o usuário pedir um fluxograma, a Vercel roteia a requisição para o Vertex AI, consumindo o saldo de $1.000.
* **Se `false`:** O sistema blinda qualquer chamada ao Google Cloud. A interface desabilita os botões de áudio/imagem e roteia 100% das requisições para o Supabase + AI Studio (Custo Zero).

Esta decisão garante que, ao primeiro sinal de esgotamento do alerta de orçamento de $950 configurado no painel de faturamento do GCP, o administrador possa "virar a chave" e evitar que a aplicação gere dívidas no cartão de crédito, sem tirar o site do ar.

## 5. Fluxo de Execução (O Ciclo de Vida da Requisição)

1. **Ação:** O usuário acessa a Clarainova e envia uma pergunta.
2. **Interceptação:** A Vercel (Backend) recebe a string e oculta todas as credenciais de segurança do frontend.
3. **Triagem Gratuita:** A Vercel consulta o Gemini Flash (AI Studio) perguntando: *"Esta tarefa exige SVG, Imagem do PDF ou apenas Texto?"*
4. **Roteamento:**

* *Caminho A (Texto):* A Vercel busca os chunks relevantes no Supabase, envia ao AI Studio, recebe o texto e devolve ao usuário.
* *Caminho B (Premium - se ativo):* A Vercel empacota a requisição usando as credenciais da *Service Account* e aciona os modelos pesados do Vertex AI para gerar o diagrama ou recuperar a imagem.

1. **Renderização:** O React atualiza a interface dinamicamente, seja com Markdown simples ou renderizando nós SVG embutidos na resposta.
