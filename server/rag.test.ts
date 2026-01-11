import { describe, expect, it, beforeAll } from "vitest";
import { loadKnowledgeBase, searchKnowledgeBase, formatContext, formatSources, SYSTEM_PROMPT } from "./rag";

describe("RAG Service", () => {
  beforeAll(() => {
    // Ensure knowledge base is loaded
    loadKnowledgeBase();
  });

  describe("loadKnowledgeBase", () => {
    it("should load knowledge base without errors", () => {
      expect(() => loadKnowledgeBase()).not.toThrow();
    });
  });

  describe("searchKnowledgeBase", () => {
    it("should return results for SEI-related queries", () => {
      const results = searchKnowledgeBase("processo SEI", 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it("should return results for SDP-related queries", () => {
      const results = searchKnowledgeBase("prestação de contas SDP", 5);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should return results with source information", () => {
      const results = searchKnowledgeBase("documento", 3);
      expect(results.length).toBeGreaterThan(0);
      
      for (const result of results) {
        expect(result).toHaveProperty("content");
        expect(result).toHaveProperty("source");
        expect(typeof result.content).toBe("string");
        expect(typeof result.source).toBe("string");
      }
    });

    it("should respect the limit parameter", () => {
      const results = searchKnowledgeBase("SEI", 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should return empty array for irrelevant queries", () => {
      const results = searchKnowledgeBase("xyzabc123nonexistent", 5);
      expect(results.length).toBe(0);
    });
  });

  describe("formatContext", () => {
    it("should format chunks into readable context", () => {
      const chunks = searchKnowledgeBase("processo", 2);
      const context = formatContext(chunks);
      
      expect(typeof context).toBe("string");
      expect(context.length).toBeGreaterThan(0);
      
      if (chunks.length > 0) {
        expect(context).toContain("[Fonte");
      }
    });

    it("should handle empty chunks array", () => {
      const context = formatContext([]);
      expect(context).toBe("Nenhum conteúdo relevante encontrado na base de conhecimento.");
    });
  });

  describe("formatSources", () => {
    it("should return unique sources", () => {
      const chunks = searchKnowledgeBase("SEI", 5);
      const sources = formatSources(chunks);
      
      expect(Array.isArray(sources)).toBe(true);
      
      for (const source of sources) {
        expect(source).toHaveProperty("documentTitle");
        expect(typeof source.documentTitle).toBe("string");
      }
    });

    it("should handle empty chunks array", () => {
      const sources = formatSources([]);
      expect(sources).toEqual([]);
    });
  });

  describe("SYSTEM_PROMPT", () => {
    it("should contain key instructions", () => {
      expect(SYSTEM_PROMPT).toContain("SEI");
      expect(SYSTEM_PROMPT).toContain("Fontes consultadas");
      expect(SYSTEM_PROMPT).toContain("português do Brasil");
    });

    it("should be a non-empty string", () => {
      expect(typeof SYSTEM_PROMPT).toBe("string");
      expect(SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });
  });
});
