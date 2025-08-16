export type Document = {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentChunk = {
  id: number;
  documentId: number;
  chunk: string;
  metadata?: string;
  embedding: number[];
};
