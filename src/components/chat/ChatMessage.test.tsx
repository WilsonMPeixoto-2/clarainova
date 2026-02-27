import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ChatMessage } from "./ChatMessage";
import type { ChatMessage as ChatMessageType } from "@/hooks/useChat";
import { TooltipProvider } from "@/components/ui/tooltip";

// Mock framer-motion to avoid animation issues in tests
const motionPropKeys = new Set([
  "animate",
  "whileHover",
  "whileTap",
  "whileInView",
  "initial",
  "exit",
  "transition",
  "variants",
  "layout",
  "layoutId",
  "drag",
  "dragConstraints",
  "dragElastic",
  "dragMomentum",
  "viewport",
]);
const stripMotionProps = (props: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(props).filter(([key]) => !motionPropKeys.has(key))
  );
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...stripMotionProps(props)}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...stripMotionProps(props)}>{children}</span>,
    a: ({ children, ...props }: any) => <a {...stripMotionProps(props)}>{children}</a>,
    button: ({ children, ...props }: any) => <button {...stripMotionProps(props)}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("ChatMessage", () => {
  const renderWithProviders = (ui: React.ReactElement) =>
    render(<TooltipProvider>{ui}</TooltipProvider>);

  const createMessage = (overrides: Partial<ChatMessageType> = {}): ChatMessageType => ({
    id: "test-id",
    role: "assistant",
    content: "Olá! Como posso ajudar?",
    timestamp: new Date("2024-01-15T10:30:00"),
    isStreaming: false,
    ...overrides,
  });

  it("renders assistant message correctly", () => {
    const message = createMessage();
    const { container } = renderWithProviders(<ChatMessage message={message} />);

    expect(container.textContent).toContain("Olá! Como posso ajudar?");
  });

  it("renders user message correctly", () => {
    const message = createMessage({
      role: "user",
      content: "Como criar um processo?",
    });
    const { container } = renderWithProviders(<ChatMessage message={message} />);

    expect(container.textContent).toContain("Como criar um processo?");
  });

  it("displays timestamp correctly", () => {
    const message = createMessage();
    const { container } = renderWithProviders(<ChatMessage message={message} />);

    expect(container.textContent).toContain("10:30");
  });

  it("renders markdown bold correctly", () => {
    const message = createMessage({
      content: "Clique no botão **Incluir Documento**",
    });
    const { container } = renderWithProviders(<ChatMessage message={message} />);

    const strongElement = container.querySelector("strong");
    expect(strongElement).toBeTruthy();
    expect(strongElement?.textContent).toBe("Incluir Documento");
  });

  it("renders markdown code inline correctly", () => {
    const message = createMessage({
      content: "Acesse o menu `Processo`",
    });
    const { container } = renderWithProviders(<ChatMessage message={message} />);

    const codeElement = container.querySelector("code");
    expect(codeElement).toBeTruthy();
    expect(codeElement?.textContent).toBe("Processo");
  });

  it("renders ordered lists correctly", () => {
    const message = createMessage({
      content: "1. Primeiro passo\n2. Segundo passo\n3. Terceiro passo",
    });
    const { container } = renderWithProviders(<ChatMessage message={message} />);

    expect(container.textContent).toContain("Primeiro passo");
    expect(container.textContent).toContain("Segundo passo");
    expect(container.textContent).toContain("Terceiro passo");

    const listItems = container.querySelectorAll("li");
    expect(listItems.length).toBe(3);
  });

  it("renders unordered lists correctly", () => {
    const message = createMessage({
      content: "- Item A\n- Item B\n- Item C",
    });
    const { container } = renderWithProviders(<ChatMessage message={message} />);

    expect(container.textContent).toContain("Item A");
    expect(container.textContent).toContain("Item B");
    expect(container.textContent).toContain("Item C");
  });

  it("renders headings correctly", () => {
    const message = createMessage({
      content: "## Título Principal\n\nConteúdo abaixo",
    });
    const { container } = renderWithProviders(<ChatMessage message={message} />);

    const heading = container.querySelector("h2");
    expect(heading).toBeTruthy();
    expect(heading?.textContent).toContain("Título Principal");
  });

  it("has correct accessibility attributes", () => {
    const message = createMessage();
    const { container } = renderWithProviders(<ChatMessage message={message} />);

    const article = container.querySelector('[role="article"]');
    expect(article).toBeTruthy();
    expect(article?.getAttribute("aria-label")).toBe("Mensagem de CLARA");
  });

  it("has correct accessibility for user messages", () => {
    const message = createMessage({ role: "user" });
    const { container } = renderWithProviders(<ChatMessage message={message} />);

    const article = container.querySelector('[role="article"]');
    expect(article).toBeTruthy();
    expect(article?.getAttribute("aria-label")).toBe("Mensagem de você");
  });

  it("renders sources count when present", () => {
    const message = createMessage({
      sources: {
        local: ["Manual SEI 4.0", "Decreto 123/2024"],
        web: [],
      },
    });
    const { container } = renderWithProviders(<ChatMessage message={message} />);

    expect(container.textContent).toContain("Fontes (2)");
  });
});
