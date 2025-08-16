import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Chunk, Chunker, ChunkerOptions } from "./chunker.ts";

export class RecursiveChunker implements Chunker {
  /**
   * Splits a given text into an array of smaller chunks.
   *
   * @param text The input string to be chunked.
   * @param options Configuration for the chunking process, including chunk size and overlap.
   * @returns An array of Chunk objects.
   */
  public async chunk(
    text: string,
    options: ChunkerOptions = {
      chunkSize: 1000,
      chunkOverlap: 200,
    },
  ): Promise<Chunk[]> {
    const splitter = RecursiveCharacterTextSplitter.fromLanguage("html", {
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap ?? 0,
    });

    const stringChunks = await splitter.splitText(text);

    return stringChunks.map((content) => ({
      content,
      metadata: {},
    }));
  }
}
