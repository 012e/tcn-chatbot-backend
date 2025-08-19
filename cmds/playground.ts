import { ModelMessage } from "npm:ai";
import * as readline from "node:readline/promises";
import { ChatBot } from "@/services/openai-chatbot.ts";
import { getConfig } from "@/config.ts";
import { TursoDocumentRepository } from "@/services/turso-document-repository.ts";
import { RagService } from "@/services/rag-service.ts";
import { RecursiveChunker } from "@/services/recursive-chunker.ts";
import process from "node:process";

import { db } from "@/db/index.ts";

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const messages: ModelMessage[] = [];

async function main() {
  const documentRepository = new TursoDocumentRepository(db);
  const ragService = new RagService(documentRepository, new RecursiveChunker());
  const chatBot = new ChatBot(getConfig(), ragService);

  while (true) {
    const userInput = await terminal.question("You: ");

    messages.push({ role: "user", content: userInput });

    const result: Response = await chatBot.chat([
      {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: userInput }],
      },
    ]);
    if (!result.ok) {
      console.error("Error from chatbot:", result.status, result.statusText);
      break;
    }
    if (!result.body) {
      console.error("No response body received from the chatbot.");
      break;
    }

    const reader = result.body.getReader();
    const decoder = new TextDecoder();

    let done = false;
    let streamedResponse = "";

    process.stdout.write("ChatBot: ");
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;

      const lines = decoder
        .decode(value, { stream: true })
        .split("\n")
        .filter((line) => line.trim() !== "");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonString = line.substring(6);
          if (jsonString === "[DONE]") {
            done = true;
            break;
          }
          try {
            const chunk = JSON.parse(jsonString);
            if (chunk.type === "text-delta" && chunk.delta) {
              streamedResponse += chunk.delta;
              process.stdout.write(chunk.delta);
            }
          } catch (e) {
            console.error("Failed to parse JSON chunk:", e, jsonString);
          }
        }
      }
    }
    process.stdout.write("\n\n");

    messages.push({ role: "assistant", content: streamedResponse });
  }
}

main().catch(console.error);
