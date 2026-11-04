# Integração do frontend (meuApp) com a API Atrativa Shore

## Como rodar

```bash
# 1. API (pasta atrativa-shore-api/atrativa-api)
npm run start:dev                 # http://localhost:3000/api/v1  (Swagger em /api/v1/docs)

# 2. Frontend (pasta meuApp)
cp .env.example .env              # ajuste VITE_API_URL se a API estiver em outro endereço
npm install
npm run dev                       # http://localhost:5173
npm run build                     # gera dist/ (tsc -b + vite build)
npm run lint
```

`VITE_API_URL` é a única configuração. Sem `.env`, o padrão é `http://localhost:3000/api/v1`.
O `.env` está no `.gitignore`. Nada sensível vai no código: o token só existe em memória
e na sessão do navegador.

A API precisa liberar a origem do frontend em `CORS_ORIGINS` (ex.: `http://localhost:5173`).

## Autenticação

1. `POST /auth/login` com `{ login, senha }` (o login é o usuário do sistema da loja, não e-mail).
2. A resposta traz `accessToken`, `expiresAt` e `usuario` (perfil e se é administrador).
3. A sessão fica em `sessionStorage`; com **Manter conectado**, em `localStorage` (chave `atrativa.sessao`).
   Senha nunca é guardada.
4. Ao abrir o app, `GET /auth/me` confirma o token. Passado `expiresAt` ou recebendo 401,
   a sessão é encerrada e o login mostra "Sua sessão expirou".
5. Rotas privadas redirecionam ao login e voltam para a página pedida depois.
6. Ações restritas (estornar venda, ajuste de estoque, editar empresa) só aparecem para
   `administrador: true`; a API valida de novo.

## Camada de API (`src/services`)

- `api.ts`: `fetch` com `Authorization: Bearer`, desembrulha `{ data }`, mantém `{ data, meta, resumo }`
  nas listas, converte erros `{ statusCode, message }` em `ApiError` com mensagens em português,
  evita GET duplicado em andamento.
- `servicos.ts`: um serviço por módulo; os tipos em `src/types/api.ts` espelham as respostas da API.
- `useRequisicao` descarta respostas antigas quando o filtro muda; `useAcao` impede duplo envio.

## Telas e endpoints

| Tela | Endpoints |
|---|---|
| Login | `POST /auth/login`, `GET /auth/me` |
| Dashboard | `GET /relatorios/dashboard`, `/relatorios/faturamento`, `/relatorios/produtos-mais-vendidos`, `/produtos/estoque-baixo`, `/vendas` |
| Empresa | `GET /empresa`, `PATCH /empresa` (admin) |
| Clientes | `GET/POST /clientes`, `GET/PATCH/DELETE /clientes/:id`, `GET /clientes/:id/vendas`, `GET /clientes/:id/credito-carne`, `GET /carnes?idCliente=` |
| Fornecedores | `GET/POST /fornecedores`, `PATCH/DELETE /fornecedores/:id` |
| Produtos | `GET/POST /produtos`, `PATCH/DELETE /produtos/:id`, `GET /produtos/tipos`, `GET /estoque/:id` |
| Estoque | `GET /produtos`, `/produtos/estoque-baixo`, `/estoque/movimentacoes`, `POST /estoque/entradas`, `POST /estoque/ajustes` (admin) |
| Nova venda (PDV) | `GET /produtos`, `/produtos/codigo/:codigo`, `/clientes`, `/clientes/:id/credito-carne`, `/caixa/atual`, `POST /vendas` |
| Histórico de vendas | `GET /vendas`, `GET /vendas/:id`, `POST /vendas/:id/estorno` (admin) |
| Caixa | `GET /caixa/atual`, `POST /caixa/abrir`, `POST /caixa/fechar`, `GET /caixa/historico`, `GET /caixa/:id` |
| Carnês | `GET /relatorios/clientes-debito`, `GET /clientes/:id/credito-carne`, `GET /carnes`, `GET /carnes/:codigo`, `POST /carnes/baixa` |
| Relatórios | todos os `GET /relatorios/*` (vendas, faturamento, formas, mais vendidos, por cliente, débito, baixas, estoque baixo, mercadorias, movimentações) |
| Meu perfil | `GET /auth/me`, `GET /empresa` |
| Configurações | `PATCH /auth/senha`, `GET /health` |

Os totais da venda exibidos no PDV são só prévia (mesmo arredondamento por item da API);
o valor gravado é o que a API calcula e devolve, e é ele que aparece no comprovante.

## Exportação

- **CSV** (abre no Excel, separador `;` e acentos preservados): busca todas as páginas do relatório na API.
- **PDF**: botão Imprimir/PDF usa a impressão do navegador com estilos próprios
  (comprovantes, recibos e relatórios saem sem menu).
- Não foi adicionada biblioteca de `.xlsx`/PDF para não incluir dependências sem autorização.

## Limites da API refletidos na interface

- Empresa é registro único: só visualizar e editar (sem criar/excluir).
- Não há recuperação de senha nem cadastro de usuários pela API; a troca de senha é feita em Configurações.
- Totais de clientes e produtos no dashboard vêm de `meta.total` das listas.

## Estrutura

```
src/
  styles/        tokens.css (cores, tipografia, espaçamento), base.css, componentes.css
  components/    ui/ (Button, Field, Modal, DataTable, Pagination, Estados, Layout, FiltroPeriodo, Spinner),
                 charts/Graficos.tsx (colunas, ranking, barra segmentada), SeletorBusca, Produto
  contexts/      AuthContext (sessão), FeedbackContext (toasts e confirmações)
  hooks/         useRequisicao, useFormulario, useEstadoReiniciado
  layouts/       AppLayout (sidebar agrupada, header com breadcrumb e menu do usuário), navegacao.ts
  pages/         uma pasta por tela + paginas.css
  services/      api.ts, servicos.ts
  types/         api.ts
  utils/         formatar, validar, exportar, periodo
```

## Verificação feita

- `tsc -b`, `eslint` e `vite build` sem erros nem avisos.
- Navegação de todas as telas em desktop (1440px) e celular (390px) com uma API de teste
  que devolve os mesmos formatos da API real: sem erros de JavaScript e sem rolagem horizontal.
- Fluxos testados: login com senha errada e certa, abrir caixa, venda com busca por nome e por
  código de barras, comprovante, validação do cadastro de cliente, detalhe de venda.
- Falta testar contra a API real com o banco MySQL, o que só pode ser feito na sua máquina.

## Limite do carnê

- A API calcula o limite de cada cliente: limite manual do cadastro (`limiteCarne`), senão
  `CARNE_LIMITE_PERCENTUAL_RENDA`% da faixa salarial, senão `CARNE_LIMITE_PADRAO` (cliente sem renda).
- O limite vale para a soma das parcelas em aberto; cada parcela paga libera o valor na hora.
- Cadastro de cliente: campo **Limite do carnê** (vazio = pela renda, 0 = sem carnê).
- Detalhe do cliente e tela de Carnês mostram limite, valor em aberto e disponível.
- PDV: mostra o disponível ao escolher o cliente e bloqueia a revisão se o valor no carnê passar dele;
  a API recusa com 409 de qualquer forma.
- Requer a migration `AdicionarLimiteCarne` (coluna `cad_clientes.limite_carne`).
