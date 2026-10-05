# ConsultorioMedico

Sistema de citas para consultorios dentales construido con Next.js 16, Postgres (Drizzle), better-auth, Resend y Upstash QStash.

## Desarrollo local

```bash
pnpm install
cp .env.example .env.local   # llena los valores
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Verificación

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

La arquitectura y las convenciones están en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y [CLAUDE.md](CLAUDE.md).
