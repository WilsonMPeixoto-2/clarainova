import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { ChatInput } from "./ChatInput";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(() => '"fast"'),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock TooltipProvider
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <div role="tooltip">{children}</div>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
}));

describe("ChatInput", () => {
  const mockOnSend = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders textarea with placeholder", () => {
    const { container } = render(<ChatInput onSend={mockOnSend} isLoading={false} />);
    
    const textarea = container.querySelector("textarea");
    expect(textarea).toBeTruthy();
    expect(textarea?.getAttribute("placeholder")).toContain("Digite sua pergunta");
  });

  it("renders send button", () => {
    const { container } = render(<ChatInput onSend={mockOnSend} isLoading={false} />);
    
    const sendButton = container.querySelector('button[aria-label="Enviar mensagem"]');
    expect(sendButton).toBeTruthy();
  });

  it("disables send button when input is empty", () => {
    const { container } = render(<ChatInput onSend={mockOnSend} isLoading={false} />);
    
    const sendButton = container.querySelector('button[aria-label="Enviar mensagem"]');
    expect(sendButton?.hasAttribute("disabled")).toBe(true);
  });

  it("shows cancel button when loading", () => {
    const { container } = render(
      <ChatInput onSend={mockOnSend} isLoading={true} onCancel={mockOnCancel} />
    );
    
    const cancelButton = container.querySelector('button[aria-label="Cancelar resposta"]');
    expect(cancelButton).toBeTruthy();
  });

  it("disables textarea when loading", () => {
    const { container } = render(<ChatInput onSend={mockOnSend} isLoading={true} />);
    
    const textarea = container.querySelector("textarea");
    expect(textarea?.hasAttribute("disabled")).toBe(true);
  });

  it("shows character counter with initial value", () => {
    const { container } = render(<ChatInput onSend={mockOnSend} isLoading={false} />);
    
    expect(container.textContent).toContain("0/2000");
  });

  it("shows loading indicator when processing", () => {
    const { container } = render(<ChatInput onSend={mockOnSend} isLoading={true} />);
    
    expect(container.textContent).toContain("CLARA está digitando");
  });

  it("accepts initial value prop", () => {
    const { container } = render(
      <ChatInput 
        onSend={mockOnSend} 
        isLoading={false} 
        initialValue="Valor inicial"
      />
    );
    
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea?.value).toBe("Valor inicial");
  });

  it("has accessible form label", () => {
    const { container } = render(<ChatInput onSend={mockOnSend} isLoading={false} />);
    
    const form = container.querySelector('[role="form"]');
    expect(form).toBeTruthy();
    expect(form?.getAttribute("aria-label")).toBe("Enviar mensagem");
  });

  it("has accessible textarea label", () => {
    const { container } = render(<ChatInput onSend={mockOnSend} isLoading={false} />);
    
    const label = container.querySelector('label[for="chat-input"]');
    expect(label).toBeTruthy();
  });

  it("has screen reader hint for keyboard shortcuts", () => {
    const { container } = render(<ChatInput onSend={mockOnSend} isLoading={false} />);
    
    const hint = container.querySelector("#chat-hint");
    expect(hint).toBeTruthy();
    expect(hint?.textContent).toContain("Enter");
  });

  it("includes mode selector", () => {
    const { container } = render(<ChatInput onSend={mockOnSend} isLoading={false} />);
    
    // Mode selector should be present (contains "Rápido" or similar)
    const hasModeSelectorText = container.textContent?.includes("Rápido") || 
                                container.textContent?.includes("Completo") ||
                                container.textContent?.includes("Fast");
    expect(hasModeSelectorText).toBe(true);
  });
});
