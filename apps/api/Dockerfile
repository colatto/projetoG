FROM node:20-slim

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV NODE_ENV=production

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/integration-sienge/package.json packages/integration-sienge/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile --filter @projetog/api... --prod=false

COPY apps/api apps/api
COPY packages/domain packages/domain
COPY packages/integration-sienge packages/integration-sienge
COPY packages/shared packages/shared

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["pnpm", "--dir", "apps/api", "exec", "tsx", "src/server.ts"]
