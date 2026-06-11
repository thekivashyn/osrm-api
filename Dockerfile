FROM oven/bun:1.2-alpine AS base
WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["bun", "run", "start"]
