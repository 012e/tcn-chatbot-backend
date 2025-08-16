/**
 * Represents a single chunk of text.
 */
export interface Chunk {
  /** The content of the chunk. */
  content: string;
  /** Metadata associated with the chunk. Can be used for source, page number, etc. */
  metadata: Record<string, unknown>;
}

/**
 * Options for the chunking process.
 */
export interface ChunkerOptions {
  /** The desired size of each chunk. */
  chunkSize: number;
  /** The number of characters to overlap between chunks to maintain context. */
  chunkOverlap?: number;
}

/**
 * Defines a contract for a text chunking utility.
 */
export interface Chunker {
  /**
   * Splits a given text into an array of smaller chunks based on the provided options.
   * @param text The input string to be chunked.
   * @param options Configuration for the chunking process.
   * @returns An array of Chunk objects.
   */
  chunk(text: string, options?: ChunkerOptions): Promise<Chunk[]>;
}
