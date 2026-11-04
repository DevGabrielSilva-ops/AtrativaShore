# Atrativa Shore — frontend

Painel de vendas, estoque, carnês e relatórios da loja, em React + TypeScript + Vite,
integrado à API NestJS (`atrativa-shore-api`).

```bash
cp .env.example .env   # VITE_API_URL=http://localhost:3000/api/v1
npm install
npm run dev            # desenvolvimento
npm run build          # produção (dist/)
npm run lint
```

- `docs/FRONTEND_AUDIT.md`: diagnóstico do projeto anterior e decisões.
- `docs/FRONTEND_INTEGRATION.md`: telas × endpoints, autenticação, exportação e limites da API.
