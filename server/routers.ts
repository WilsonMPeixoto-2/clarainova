import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { chatWithRAG, searchKnowledgeBase, loadKnowledgeBase } from "./rag";
import { 
  getAllDocuments, 
  addChatMessage, 
  getChatHistory,
  getOrCreateChatSession
} from "./db";
import { nanoid } from "nanoid";

export const appRouter = router({
  system: systemRouter,

  // Chat router for RAG-based conversations
  chat: router({
    // Send a message and get AI response
    sendMessage: publicProcedure
      .input(z.object({
        message: z.string().min(1).max(5000),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const sessionId = input.sessionId || nanoid();
        
        // Get or create session
        await getOrCreateChatSession(sessionId, ctx.user?.id);
        
        // Get conversation history
        const historyMessages = await getChatHistory(sessionId, 10);
        const conversationHistory = historyMessages
          .reverse()
          .map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content
          }));
        
        // Save user message
        await addChatMessage({
          sessionId,
          role: "user",
          content: input.message,
          sources: null
        });
        
        // Get AI response with RAG
        const { response, sources, usedWebSearch } = await chatWithRAG(input.message, conversationHistory);
        
        // Save assistant response
        await addChatMessage({
          sessionId,
          role: "assistant",
          content: response,
          sources
        });
        
        return {
          sessionId,
          response,
          sources,
          usedWebSearch
        };
      }),

    // Get chat history for a session
    getHistory: publicProcedure
      .input(z.object({
        sessionId: z.string(),
      }))
      .query(async ({ input }) => {
        const messages = await getChatHistory(input.sessionId, 50);
        return messages.reverse();
      }),

    // Create a new chat session
    createSession: publicProcedure
      .mutation(async ({ ctx }) => {
        const sessionId = nanoid();
        await getOrCreateChatSession(sessionId, ctx.user?.id);
        return { sessionId };
      }),
  }),

  // Documents router for knowledge base management
  documents: router({
    // List all indexed documents
    list: publicProcedure.query(async () => {
      return getAllDocuments();
    }),

    // Search knowledge base
    search: publicProcedure
      .input(z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(20).default(5),
      }))
      .query(({ input }) => {
        const results = searchKnowledgeBase(input.query, input.limit);
        return results.map(r => ({
          content: r.content.slice(0, 500) + (r.content.length > 500 ? "..." : ""),
          source: r.source,
          section: r.section
        }));
      }),

    // Reload knowledge base
    reload: publicProcedure.mutation(() => {
      loadKnowledgeBase();
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
