FROM node:20-slim

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV NODE_ENV=production

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY workers/package.json workers/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/integration-sienge/package.json packages/integration-sienge/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile --filter @projetog/workers... --prod=false

COPY workers workers
COPY packages/domain packages/domain
COPY packages/integration-sienge packages/integration-sienge
COPY packages/shared packages/shared

EXPOSE 9080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:9080/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["pnpm", "--dir", "workers", "exec", "tsx", "src/index.ts"]
