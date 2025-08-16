# Build stage
FROM denoland/deno:latest AS builder
WORKDIR /app
COPY . .
RUN deno cache main.ts

# Production stage
FROM denoland/deno:latest
WORKDIR /app
COPY --from=builder /app .
EXPOSE 8000
ENTRYPOINT ["deno", "task", "start"]
