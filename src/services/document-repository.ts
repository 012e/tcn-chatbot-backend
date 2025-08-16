import type { PageResult } from "@/helpers/types";

export type DocumentCreateDto = {
  content: string;
  createdAt: string;
  updatedAt: string;
  docmentChunks: DocumentChunkCreateDto[];
};

export type DocumentChunkCreateDto = {
  chunk: string;
  metadata?: string;
  embedding: number[];
};

export type Document = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  documentChunks: DocumentChunkCreateDto[];
};

export type DocumentChunk = {
  id: string;
  chunk: string;
  metadata?: string;
  documentId: string;
};

// does not contain chunk and its vectors
export type SimpleDocument = {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentUpdateDto = {
  id: number;
  content: string;
  updatedAt: string;
  documentChunks: DocumentChunkCreateDto[];
};

export interface DocumentRepository {
  saveDocument(document: DocumentCreateDto): Promise<void>;
  getReleventChunks(
    documentVector: number[],
    topK: number,
  ): Promise<DocumentChunk[]>;
  deleteDocument(id: number): Promise<boolean>;
  getDocumentById(id: number): Promise<SimpleDocument | null>;
  updateDocument(document: DocumentUpdateDto): Promise<void>;
  listDocuments(params: {
    page: number;
    pageSize: number;
  }): Promise<PageResult<SimpleDocument>>;
}
