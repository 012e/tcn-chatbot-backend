import { Chunk, Chunker } from "./chunker.ts";
import {
  DocumentCreateDto,
  DocumentChunkCreateDto,
  DocumentRepository,
  DocumentChunk,
} from "./document-repository.ts";
import z from "zod";
import sanitizeHtml from "sanitize-html";
import { env } from "cloudflare:workers";

export type InsertDocumentCommand = z.infer<typeof InsertDocumentSchema>;

export const InsertDocumentSchema = z.object({
  content: z.string().min(1, "Content must not be empty"),
});

export class RagService {
  constructor(
    private readonly _documentRepository: DocumentRepository,
    private readonly _chunker: Chunker,
  ) {}

  async rerank(
    chunks: DocumentChunk[],
    query: string,
    limit: number = 5,
  ): Promise<DocumentChunk[]> {
    const contexts = chunks.map((chunk) => {
      return { text: chunk.chunk };
    });
    const response: Ai_Cf_Baai_Bge_Reranker_Base_Output = await env.AI.run(
      "@cf/baai/bge-reranker-base",
      {
        top_k: 5,
        query,
        contexts,
      },
    );
    const selectedIndexes = response.response?.map((i) => i.id) || [];

    return chunks.filter((_, index) => selectedIndexes.includes(index));
  }

  async getRelevantChunks(query: string): Promise<DocumentChunk[]> {
    const embeddedQuery = await this.embed(query);

    const chunks = await this._documentRepository.getReleventChunks(
      embeddedQuery,
      20,
    );

    return this.rerank(chunks, query, 5);
  }
  private async embedMulti(queries: string[]): Promise<number[][]> {
    try {
      const embeddings: Ai_Cf_Baai_Bge_M3_Output = await env.AI.run(
        "@cf/baai/bge-m3",
        {
          text: queries,
        },
      );
      return (embeddings as any).data as number[][];
    } catch (error) {
      console.error("Error during embedding:", error);
      throw new Error("Failed to embed queries");
    }
  }

  private async embed(query: string): Promise<number[]> {
    try {
      const embeddings: Ai_Cf_Baai_Bge_M3_Output = await env.AI.run(
        "@cf/baai/bge-m3",
        {
          text: query,
        },
      );
      return (embeddings as any).data[0] as number[];
    } catch (error) {
      console.error("Error during embedding:", error);
      throw new Error("Failed to embed query");
    }
  }

  private async _embedChunks(
    chunks: string[],
  ): Promise<DocumentChunkCreateDto[]> {
    try {
      const embeddings = await this.embedMulti(chunks);
      return embeddings.map((embedding, index) => ({
        chunk: chunks[index],
        embedding: embedding as number[],
      }));
    } catch (error) {
      console.error("Error during embedding:", error);
      throw new Error("Failed to embed chunks");
    }
  }

  async insertDocument(document: InsertDocumentCommand): Promise<void> {
    document.content = sanitizeHtml(document.content, {
      allowedAttributes: {
        a: ["href", "title"],
        img: ["src", "alt"],
      },
    });

    const chunks = await this._chunker.chunk(document.content);
    const embeddedChunks = await this._embedChunks(
      chunks.map((chunk: Chunk) => chunk.content),
    );

    const documentToSave: DocumentCreateDto = {
      content: document.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      docmentChunks: embeddedChunks,
    };

    await this._documentRepository.saveDocument(documentToSave);
  }

  async updateDocument(
    id: number,
    document: InsertDocumentCommand,
  ): Promise<void> {
    document.content = sanitizeHtml(document.content, {
      allowedAttributes: {
        a: ["href", "title"],
        img: ["src", "alt"],
      },
    });

    const chunks = await this._chunker.chunk(document.content);
    const embeddedChunks = await this._embedChunks(
      chunks.map((chunk: Chunk) => chunk.content),
    );

    const documentToUpdate = {
      id,
      content: document.content,
      updatedAt: new Date().toISOString(),
      documentChunks: embeddedChunks,
    };

    await this._documentRepository.updateDocument(documentToUpdate);
  }
}
