import { Chunk, Chunker } from "./chunker.ts";
import {
  DocumentCreateDto,
  DocumentChunkCreateDto,
  DocumentRepository,
  DocumentChunk,
} from "./document-repository.ts";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import z from "zod";
import sanitizeHtml from "sanitize-html";

export type InsertDocumentCommand = z.infer<typeof InsertDocumentSchema>;

export const InsertDocumentSchema = z.object({
  content: z.string().min(1, "Content must not be empty"),
});

export class RagService {
  constructor(
    private readonly _documentRepository: DocumentRepository,
    private readonly _chunker: Chunker,
  ) {}

  async getRelevantChunks(query: string): Promise<DocumentChunk[]> {
    const embeddedQuery = await this.embedQuery(query);

    const chunks = await this._documentRepository.getReleventChunks(
      embeddedQuery,
      5,
    );

    return chunks;
  }

  private async embedQuery(query: string): Promise<number[]> {
    try {
      const { embedding } = await embed({
        model: openai.textEmbeddingModel("text-embedding-3-small"),
        value: query,
      });
      return embedding as number[];
    } catch (error) {
      console.error("Error during embedding:", error);
      throw new Error("Failed to embed query");
    }
  }

  private async _embedChunks(
    chunks: string[],
  ): Promise<DocumentChunkCreateDto[]> {
    const jobs = chunks.map((chunk) =>
      embed({
        model: openai.textEmbeddingModel("text-embedding-3-small"),
        value: chunk,
      }),
    );
    try {
      const result = await Promise.all(jobs);
      return result.map(({ embedding }, index) => ({
        chunk: chunks[index],
        embedding: embedding as number[],
      }));
    } catch (error) {
      console.error("Error during embedding:", error);
      throw new Error("Failed to embed chunks");
    }
  }

  async insertDocument(document: InsertDocumentCommand): Promise<void> {
    console.log("fuckkkkkkkkkkkkkkkkkkkkkkkkkkk");
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
