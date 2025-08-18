import { Hono } from "hono";
import { InsertDocumentSchema, RagService } from "./services/rag-service.ts";
import { logger } from "hono/logger";
import z from "zod";
import { TursoDocumentRepository } from "./services/turso-document-repository.ts";
import { db } from "./db/index.ts";
import { RecursiveChunker } from "./services/recursive-chunker.ts";
import { ChatBot } from "./services/openai-chatbot.ts";
import { cors } from "hono/cors";
import { getConfig } from "./config.ts";
import type { PageQuery } from "@/helpers/types.ts";
import { basicAuth } from "hono/basic-auth";

const config = getConfig();
const app = new Hono()
  .use(logger())
  .use(cors())
  .use(
    "/api/internal/*",
    basicAuth({
      username: config.basicAuth.username,
      password: config.basicAuth.password,
    }),
  )
  .basePath("/api");

const createRagService = () => {
  const documentRepository = new TursoDocumentRepository(db);
  const chunker = new RecursiveChunker();
  return new RagService(documentRepository, chunker);
};

app.post("/public/chat", async (c) => {
  try {
    const body = await c.req.json();
    if (!body["messages"] || !Array.isArray(body["messages"])) {
      return c.json(
        {
          message: "messages must be an array",
        },
        400,
      );
    }
    const chatbot = new ChatBot(getConfig(), createRagService());
    return await chatbot.chat(body["messages"]);
  } catch (e) {
    console.error("Error processing chat request:", e);
    return c.json(
      {
        message: "invalid json",
      },
      400,
    );
  }
});

app.get("/public/health", (c) => {
  return c.text("Hello, Hono!");
});

app.get("/internal/search/document", async (c) => {
  const query = c.req.query("q");
  if (!query) {
    return c.json(
      {
        message: "query parameter 'q' is required",
      },
      400,
    );
  }
  const ragService = createRagService();
  const results = await ragService.getRelevantChunks(query);
  return c.json(results);
});

app.post("/internal/document", async (c) => {
  let jsonBody = null;
  try {
    jsonBody = await c.req.json();
  } catch (e) {
    return c.json({
      message: "invalid json",
    });
  }

  const insertDocumentCommand = InsertDocumentSchema.safeParse(jsonBody);
  if (!insertDocumentCommand.success) {
    return c.json(
      { message: z.prettifyError(insertDocumentCommand.error) },
      400,
    );
  }

  const ragService = createRagService();
  await ragService.insertDocument({
    content: insertDocumentCommand.data.content,
  });

  return c.json(
    {
      message: "success",
    },
    201,
  );
});

app.get("/internal/document", async (c) => {
  const { page, pageSize }: PageQuery = {
    page: c.req.query("page") ?? 1,
    pageSize: c.req.query("pageSize") ?? 20,
  };

  const repo = new TursoDocumentRepository(db);
  const result = await repo.listDocuments({
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 20,
  });

  return c.json(result);
});

app.get("/internal/document/:id", async (c) => {
  const idParam = c.req.param("id");
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ message: "invalid document id" }, 400);
  }

  try {
    const repo = new TursoDocumentRepository(db);
    const document = await repo.getDocumentById(id);

    if (!document) {
      return c.json({ message: "document not found" }, 404);
    }

    return c.json(document);
  } catch (e) {
    console.error("Error fetching document:", e);
    return c.json({ message: "internal server error" }, 500);
  }
});

app.put("/internal/document/:id", async (c) => {
  const idParam = c.req.param("id");
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ message: "invalid document id" }, 400);
  }

  let jsonBody = null;
  try {
    jsonBody = await c.req.json();
  } catch (e) {
    return c.json(
      {
        message: "invalid json",
      },
      400,
    );
  }

  const updateDocumentCommand = InsertDocumentSchema.safeParse(jsonBody);
  if (!updateDocumentCommand.success) {
    return c.json(
      { message: z.prettifyError(updateDocumentCommand.error) },
      400,
    );
  }

  try {
    const repo = new TursoDocumentRepository(db);
    const existingDocument = await repo.getDocumentById(id);
    if (!existingDocument) {
      return c.json({ message: "document not found" }, 404);
    }
    const ragService = createRagService();
    await ragService.updateDocument(id, {
      content: updateDocumentCommand.data.content,
    });

    return c.json({
      message: "document updated successfully",
    });
  } catch (e) {
    console.error("Error updating document:", e);
    return c.json({ message: "internal server error" }, 500);
  }
});

app.delete("/internal/document/:id", async (c) => {
  const idParam = c.req.param("id");
  const id = Number(idParam);

  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ message: "invalid document id" }, 400);
  }

  try {
    const repo = new TursoDocumentRepository(db);
    const deleted = await repo.deleteDocument(id);
    if (!deleted) {
      return c.json({ message: "document not found" }, 404);
    }
    return c.body(null, 204);
  } catch (e) {
    console.error("Error deleting document:", e);
    return c.json({ message: "internal server error" }, 500);
  }
});

Deno.serve({
  port: config.port,
  handler: app.fetch,
});
