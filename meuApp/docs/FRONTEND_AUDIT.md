# FRONTEND_AUDIT.md — Atrativa Shore (meuApp)

> Etapas 1 e 2: auditoria do frontend React + Vite e cruzamento com a API NestJS (`atrativa-shore-api/atrativa-api`). Feita em 04/11/2026 sobre o código do repositório.

## 1. Estado atual

**Stack:** React 19.2, Vite 8, TypeScript 6, React Router 7, react-icons 5. Sem biblioteca de requisição, estado global, formulários ou gráficos. CSS puro, um arquivo por tela.

**Navegação:** `BrowserRouter` em `App.tsx`. `/` é o login; as demais rotas ficam dentro de `Layout` (sidebar fixa). Nenhuma rota é protegida e o botão "Sair" apenas navega para `/`.

**Integração com backend:** nenhuma. Todas as telas usam arrays fixos no código (`produtosMock`, `clientesIniciais`, `carnesIniciais`...). O login navega para `/menu` sem verificar credenciais.

### 1.1. Telas existentes

| Tela | Arquivo | O que faz hoje | Situação |
|---|---|---|---|
| Login | `views/Login/Login.tsx` | Campos e-mail/senha, mostrar senha, "lembrar-me", "esqueci minha senha" | Simulado. O banco não tem e-mail (o login é `cad_login.login`) e não existe recuperação de senha no backend. |
| Menu inicial | `views/MenuInicial/menu.tsx` | Cards de atalho para os módulos | Sem indicadores; vira o Dashboard. |
| Caixa | `views/Caixa/caixa.tsx` | Abrir caixa, resumo por forma de pagamento, fechamento com "valor para o próximo dia" e impressão | Valores fixos (`dadosBanco`). Backend tem `/caixa/*`. |
| Vendas (PDV) | `views/Vendas/vendas.tsx` | Busca por nome/código, itens, quantidade, desconto, acréscimo, formas Dinheiro/Pix/Cartão/Carnê, botão "Realizar Troca" sem ação | Total calculado no frontend; venda não é gravada; troca não implementada. |
| Produtos | `views/Produtos/Produtos.tsx` | Lista, cadastro/edição em modal, compra, à vista, a prazo, lucro bruto, fornecedor, estoque mínimo | Fornecedores fixos ("Fornecedor A/B/C"). |
| Clientes | `views/Clientes/clientes.tsx` | Lista, cadastro/edição em modal | Sem paginação; faixa salarial como texto (no banco é número). |
| Estoque | `views/Estoque/estoque.tsx` | Lançamento de mercadorias (nota com vários itens) e impressão | Sem saldo real, histórico ou ajuste. |
| Carnês | `views/Carnês/carnes.tsx` | Clientes → carnês em aberto → pagamento com juros/desconto | Rota `/carnês` com acento; não aparece na sidebar. |
| Relatórios | `views/Relatórios/relatorios.tsx` | Abas: baixo estoque, clientes em débito, vendas por período, vendas do dia, baixas de carnê, mercadorias | Botões de exportar sem ação. |

### 1.2. Componentes e padrões visuais

- Único componente compartilhado: `components/Layout` (sidebar + `<Outlet/>`).
- Cada tela redefine botões, cards, modais, tabelas e inputs no próprio CSS: 2.079 linhas de CSS com estilos repetidos e divergentes (raios de 10, 12, 14, 18px; sombras diferentes por tela).
- Cor de destaque `#8c0774`; o logotipo usa `#592675`. Fonte Arial. Reset global (`* { margin: 0 }`) dentro do CSS do layout.
- Sem estados de carregamento, vazio ou erro. Feedback com `alert()` e `window.confirm()`.
- Sem layout para celular: sidebar de 260px fixa e tabelas sem rolagem.

### 1.3. Problemas encontrados

1. Nenhuma tela usa dados reais; o login não autentica.
2. Rotas privadas acessíveis sem login; "Sair" não encerra sessão.
3. Totais da venda calculados no frontend (a API recalcula e recusa totais divergentes).
4. Rota com acento (`/carnês`) e pastas com acento (`Carnês`, `Relatórios`), frágeis em URLs e ferramentas.
5. `alert`/`confirm` nativos como interface principal.
6. Botões sem função: "Realizar Troca", exportar relatórios, "Esqueci minha senha".
7. CSS duplicado e inconsistente; sem design system.
8. Sem responsividade nem foco visível de teclado.
9. `index.html` com título "meuapp" e `lang="en"`; favicon inexistente.

## 2. Backend disponível × frontend

Endpoints reais (prefixo `/api/v1`, documentados no Swagger em `/api/v1/docs`):

| Módulo | Endpoints | Tela hoje |
|---|---|---|
| Auth | `POST /auth/login`, `GET /auth/me`, `PATCH /auth/senha` | Login simulado; sem perfil/troca de senha |
| Empresa | `GET /empresa`, `PATCH /empresa` | **Não existe** |
| Usuários | `GET /usuarios` (admin) | Não existe |
| Clientes | CRUD + `GET /clientes/:id/vendas` | Parcial (sem API) |
| Fornecedores | CRUD | Não existe (fixos no produto) |
| Produtos | CRUD, `codigo/:cod`, `estoque-baixo`, `tipos` | Parcial |
| Estoque | saldo, `entradas`, `ajustes` (admin), `movimentacoes` | Só lançamento visual |
| Vendas | `POST /vendas` (com troca e carnê), listagem, detalhe, estorno (admin) | PDV visual; **sem histórico** |
| Carnês | listagem, consulta, `POST /carnes/baixa` | Visual |
| Caixa | atual, abrir, fechar, histórico | Visual |
| Relatórios | dashboard, faturamento, vendas-período/dia, formas-pagamento, mais vendidos, vendas por cliente, estoque baixo, clientes em débito, baixas de carnê, mercadorias, movimentações | Visual, parcial |

### 2.1. Pedidos do briefing sem suporte no backend

| Pedido | Situação | Decisão no frontend |
|---|---|---|
| Listagem, cadastro e exclusão de **empresas** | O banco tem uma única empresa (`cad_empresa`) e nenhuma tabela tem `id_empresa`; a API expõe só `GET`/`PATCH /empresa` | Tela **Empresa**: visualização e edição dos dados (edição só para administrador). Sem lista, cadastro ou exclusão. |
| Login por e-mail | Não existe e-mail em `cad_login` | Campo "Usuário". |
| "Esqueci minha senha" / "lembrar-me" | Não há recuperação de senha | Link removido. "Manter conectado" decide onde o token fica (sessão do navegador ou armazenamento local). |
| Quantidade de clientes/produtos no dashboard | Não há endpoint de contagem | Usa `meta.total` de `GET /clientes?limit=1` e `GET /produtos?limit=1` (dados reais, sem endpoint novo). |
| Exportar PDF/Excel | Backend não gera arquivos | Exportação **CSV** (abre no Excel) gerada a partir dos dados recebidos e **impressão/PDF** pelo navegador com folha de estilo de impressão. |
| "Configurações" do sistema | Só existem troca de senha e dados da empresa | Configurações = troca de senha da API + atalho para Empresa. Nenhuma opção sem backend. |

Nenhum endpoint novo é necessário para as telas abaixo.

## 3. Plano

### 3.1. Preservado
Todas as funções das telas atuais (incluindo Caixa, Carnês, troca e os seis relatórios), React Router, TypeScript, CSS puro e react-icons. **Nenhuma dependência nova**: requisições com `fetch`, gráficos em SVG próprio (barras e linha simples), exportação CSV própria. Assim o projeto não depende de `npm install` adicional.

### 3.2. Alterado
- `views/` (mock) → `pages/` integradas; pastas sem acento; rota `/carnes`.
- Um design system único em `src/styles` e `src/components/ui`.
- Login real com JWT; rotas protegidas; logout real; sessão expirada volta ao login.
- PDV envia itens/pagamentos e mostra o total calculado pela API; o frontend nunca baixa estoque.
- `alert`/`confirm` → toasts e diálogo de confirmação.

### 3.3. Criado
Dashboard, Empresa, Fornecedores (necessário para o cadastro de produtos), Histórico e detalhe de vendas, Estoque completo (saldo, entradas, ajustes, movimentações), Perfil, Configurações, página 404.

### 3.4. Estrutura

```text
src/
├── main.tsx, App.tsx (rotas)
├── styles/          tokens.css, base.css
├── components/ui/   Button, Field, Modal, DataTable, Pagination, Toast, ConfirmDialog, Badge, Skeleton, EmptyState...
├── components/charts/  BarChart, LineChart (SVG)
├── layouts/         AppLayout (sidebar + header)
├── contexts/        AuthContext, ToastContext, ConfirmContext
├── hooks/           useRequest, useDebounce
├── services/        api.ts + um serviço por módulo
├── types/           tipos das respostas da API
├── utils/           formatação, CSV, validação
└── pages/           uma pasta por módulo
```

### 3.5. Direção visual

- **Cor:** a marca vem do logotipo, `#592675` (ameixa). Superfícies brancas sobre fundo `#F6F5F8`, linhas `#E4E0EA`, texto `#201A26`/`#5E5768`. Cores de estado (verde, âmbar, vermelho) só para estado, sempre com texto ou ícone.
- **Tipo:** Onest (Google Fonts), uma família só; números tabulares nas tabelas.
- **Layout:** sidebar branca de 248px com indicador lateral no item ativo (não um bloco preenchido); header com título, breadcrumb, empresa e menu do usuário; conteúdo até 1280px.
- **Onde ousar:** no PDV. O painel da venda imita um cupom, com total grande e serrilhado no topo, que é o objeto que o caixa da loja conhece. O resto da interface fica quieto.
- **Celular:** sidebar vira gaveta; tabelas rolam na horizontal com a primeira coluna visível; formulários em uma coluna.
