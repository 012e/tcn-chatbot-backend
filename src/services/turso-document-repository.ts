import { Client, LibsqlError } from "@libsql/client";
import {
  DocumentChunk,
  DocumentCreateDto,
  DocumentRepository,
  SimpleDocument,
  DocumentUpdateDto,
} from "./document-repository.ts";
import type { PageResult } from "@/helpers/types.ts";

export class TursoDocumentRepository implements DocumentRepository {
  public constructor(private readonly _db: Client) {}

  async getDocumentById(id: number): Promise<SimpleDocument | null> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Invalid document id");
    }

    const result = await this._db.execute({
      sql: `
          SELECT d.id, d.content, d.created_at, d.updated_at
          FROM documents d
          WHERE d.id = ?
        `,
      args: [id],
    });

    if (result.rows.length !== 1) {
      return null; // Document not found
    }

    const row = result.rows[0] as any;
    return {
      id: Number(row.id),
      content: String(row.content),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  async updateDocument(document: DocumentUpdateDto): Promise<void> {
    if (!Number.isInteger(document.id) || document.id <= 0) {
      throw new Error("Invalid document id");
    }

    const transaction = await this._db.transaction("write");

    try {
      // Update the document content and timestamp
      await transaction.execute({
        sql: "UPDATE documents SET content = ?, updated_at = ? WHERE id = ?",
        args: [document.content, document.updatedAt, document.id],
      });

      // Delete existing chunks for this document
      await transaction.execute({
        sql: "DELETE FROM document_chunks WHERE document_id = ?",
        args: [document.id],
      });

      // Insert new chunks
      for (const documentChunk of document.documentChunks) {
        await transaction.execute({
          sql: "INSERT INTO document_chunks (document_id, chunk, metadata, embedding) VALUES (?, ?, ?, vector32(?))",
          args: [
            document.id,
            documentChunk.chunk,
            documentChunk.metadata ?? null,
            JSON.stringify(documentChunk.embedding),
          ],
        });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      if (error instanceof LibsqlError) {
        console.error("Database error updating document:", error.message);
      } else {
        console.error("An unexpected error occurred while updating:", error);
      }
      throw error;
    }
  }

  async saveDocument(document: DocumentCreateDto): Promise<void> {
    const transaction = await this._db.transaction("write");

    try {
      const documentResult = await transaction.execute({
        sql: "INSERT INTO documents (content, created_at, updated_at) VALUES (?, ?, ?) RETURNING id",
        args: [document.content, document.createdAt, document.updatedAt],
      });
      const documentId = (documentResult.rows[0] as any).id as number;

      for (const documentChunk of document.docmentChunks) {
        await transaction.execute({
          sql: "INSERT INTO document_chunks (document_id, chunk, metadata, embedding) VALUES (?, ?, ?, vector32(?))",
          args: [
            documentId,
            documentChunk.chunk,
            documentChunk.metadata ?? null,
            JSON.stringify(documentChunk.embedding),
          ],
        });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error("Error saving document:", error);
      throw error;
    }
  }

  async getReleventChunks(
    documentVector: number[],
    topK: number,
  ): Promise<DocumentChunk[]> {
    try {
      const result = await this._db.execute({
        sql: `
          SELECT id, chunk, metadata, document_id, embedding
          FROM document_chunks
          ORDER BY vector_distance_cos(embedding, vector32(?))
          LIMIT ?
        `,
        args: [JSON.stringify(documentVector), topK],
      });

      return result.rows.map((row) => this.mapRowToDocumentChunk(row));
    } catch (error) {
      if (error instanceof LibsqlError) {
        console.error(
          "Database error fetching relevant chunks:",
          error.message,
        );
      } else {
        console.error("An unexpected error occurred:", error);
      }
      throw error;
    }
  }

  async deleteDocument(id: number): Promise<boolean> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Invalid document id");
    }

    const transaction = await this._db.transaction("write");
    try {
      const existing = await transaction.execute({
        sql: `SELECT id FROM documents WHERE id = ?`,
        args: [id],
      });

      if (existing.rows.length === 0) {
        await transaction.rollback();
        return false; // not found
      }

      await transaction.execute({
        sql: `DELETE FROM documents WHERE id = ?`,
        args: [id],
      });

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      if (error instanceof LibsqlError) {
        console.error("Database error deleting document:", error.message);
      } else {
        console.error("An unexpected error occurred while deleting:", error);
      }
      throw error;
    }
  }

  async listDocuments(params: {
    page: number;
    pageSize: number;
  }): Promise<PageResult<SimpleDocument>> {
    const { page, pageSize } = params;

    const currentPage = Number.isFinite(Number(page))
      ? Math.max(1, Number(page))
      : 1;
    const size = Number.isFinite(Number(pageSize))
      ? Math.max(1, Math.min(100, Number(pageSize)))
      : 20;

    const offset = (currentPage - 1) * size;

    const countResult = await this._db.execute({
      sql: `SELECT COUNT(*) as cnt FROM documents`,
      args: [],
    });
    const totalItems = Number((countResult.rows[0] as any).cnt) || 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / size));

    const result = await this._db.execute({
      sql: `
        SELECT id, content, created_at, updated_at
        FROM documents
        ORDER BY id DESC
        LIMIT ?
        OFFSET ?
      `,
      args: [size, offset],
    });

    const items: SimpleDocument[] = (result.rows as any[]).map((r) => ({
      id: Number(r.id),
      content: String(r.content),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));

    return {
      items,
      page: currentPage,
      pageSize: size,
      totalItems,
      totalPages,
    };
  }

  private mapRowToDocumentChunk(row: any): DocumentChunk {
    return {
      id: String(row.id),
      chunk: row.chunk as string,
      metadata: row.metadata as string | undefined,
      documentId: String(row.document_id),
    };
  }
}
