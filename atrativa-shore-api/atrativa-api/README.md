# Atrativa Shore — API

API REST do Atrativa Shore em **NestJS 12 + TypeScript + TypeORM 1.1 + MySQL 8**, construída sobre o **banco legado da loja** (o mesmo usado pelo sistema desktop). O frontend React + Vite consome a API em `/api/v1`.

> Mapeamento completo do banco: [`../../docs/DATABASE_MAPPING.md`](../../docs/DATABASE_MAPPING.md) · Decisões e planejamento: [`../../docs/PLANEJAMENTO.md`](../../docs/PLANEJAMENTO.md)

---

## Sumário

1. [Arquitetura](#1-arquitetura)
2. [Instalação e primeira execução](#2-instalação-e-primeira-execução)
3. [Variáveis de ambiente](#3-variáveis-de-ambiente)
4. [Migrations](#4-migrations)
5. [Autenticação](#5-autenticação)
6. [Padrão das respostas](#6-padrão-das-respostas)
7. [Endpoints](#7-endpoints)
8. [Exemplos](#8-exemplos)
9. [Regras de negócio](#9-regras-de-negócio)
10. [Testes](#10-testes)
11. [Integração com o frontend](#11-integração-com-o-frontend)
12. [Limitações conhecidas](#12-limitações-conhecidas)

---

## 1. Arquitetura

```text
src/
├── main.ts                 prefixo /api/v1, CORS, ValidationPipe, Swagger
├── app.module.ts           módulos + guard JWT global, guard de perfil, filtro e interceptor
├── config/                 leitura e validação do .env (a API não sobe com config inválida)
├── database/               conexão (synchronize SEMPRE false), entidades, migrations, verificação do banco
├── common/
│   ├── constantes/legado.ts   códigos do desktop (modo_venda, origem do financeiro, planos...)
│   ├── utils/                 dinheiro em centavos, datas no fuso da loja, códigos EAN-13, CPF/CNPJ
│   ├── filters/               erros padronizados (inclusive erros do MySQL)
│   ├── interceptors/          envelope { data } nas respostas
│   ├── guards/, decorators/   @Publico(), @SomenteAdministrador(), @UsuarioAtual()
│   └── dto/, validacao/       paginação, período, mensagens de validação em português
├── auth/                   login, JWT, migração da senha legada para bcrypt
├── usuarios/               cad_login, cad_login_perfil, api_credencial
├── empresa/                cad_empresa
├── clientes/               cad_clientes, cad_clientes_obs
├── fornecedores/           cad_fornecedores
├── produtos/               cad_produtos, cad_produtos_tipo
├── estoque/                mv_estoque, mv_estoque_historico (+ operações de saldo usadas por vendas)
├── vendas/                 mv_vendas, mv_vendas_movimento, cálculo da venda (função pura)
├── financeiro/             entidade mv_financeiro (usada por vendas, carnês e estoque)
├── carnes/                 parcelas de carnê e baixa
├── caixa/                  mv_fechamento (abertura, fechamento, resumo)
├── relatorios/             dashboard e relatórios (SQL agregado)
└── saude/                  GET /health
```

Princípios:

- **O banco é a fonte da verdade.** Entidades usam os nomes reais de tabelas e colunas; nenhuma tabela legada foi renomeada ou removida.
- **Controllers só recebem e devolvem**; regras ficam nos services. O cálculo da venda é uma função pura (`vendas/calculo/calculo-venda.ts`), testada isoladamente.
- **Compatível com o desktop**: vendas, carnês, trocas e notas são gravados no mesmo formato que o sistema desktop usa (controle `yyyymmddhhmmss`, código do carnê EAN-13, lançamentos em `mv_financeiro`), porque os dois sistemas usam o mesmo banco.
- **Dinheiro em centavos inteiros** em todos os cálculos (o banco usa FLOAT).

---

## 2. Instalação e primeira execução

Pré-requisitos: Node.js 22+, npm 10+, Docker (para o MySQL de desenvolvimento).

```bash
cd atrativa-shore-api/atrativa-api
npm install
cp .env.example .env          # e ajuste os valores (seção 3)
```

### 2.1. MySQL de desenvolvimento com o dump da loja

O `docker-compose.yaml` sobe um MySQL 8.4 na porta **3307**. O dump original é do MySQL 4.0 e não importa direto no MySQL 8; converta-o primeiro (o script não altera dados, só a sintaxe — veja o comentário no arquivo):

```bash
docker compose up -d
npm run db:converter-dump -- /caminho/bd.sql bd-mysql8.sql

docker cp bd-mysql8.sql atrativa-mysql:/tmp/bd.sql
docker exec atrativa-mysql sh -c "mysql -uroot -proot --default-character-set=latin1 atrativaLoja < /tmp/bd.sql"
```

> ⚠️ O dump contém `DROP TABLE IF EXISTS`. Importe apenas em banco vazio ou de teste, **nunca por cima do banco que a loja está usando**.

### 2.2. Plataforma multiempresa (uma vez)

Cada empresa tem um banco com a estrutura do sistema anterior; um banco central guarda empresas, usuários, códigos de ativação e auditoria. Detalhes em `../../docs/SAAS_DATABASE_ARCHITECTURE.md`.

```bash
npm run plataforma:migrar                       # cria o banco central (DB_PLATAFORMA) e as tabelas plataforma_*
npm run plataforma:superadmin                   # cria o dono da plataforma com SUPERADMIN_EMAIL e SUPERADMIN_SENHA do .env
npm run plataforma:importar -- Atrativa         # registra o banco do sistema anterior como empresa e importa os usuários
npm run empresas:migrar                         # aplica as migrations da API no banco de todas as empresas
```

- O usuário MySQL da API precisa de permissão para **criar bancos**: cada empresa ativada por código ganha o seu (`DB_EMPRESA_PREFIXO` + id).
- `plataforma:importar` não altera os dados do banco importado; só aplica as migrations da API nele (InnoDB, `vr_pix`, `limite_carne`). Faça backup antes.
- Usuários importados com perfil ADMINISTRADOR viram administradores da empresa; os demais, vendedores. A senha do sistema anterior vale no primeiro acesso e é convertida em hash.
- Para importar outro banco antigo depois: carregue o dump num banco novo e rode `npm run plataforma:importar -- <nome-do-banco>`.
- Para trocar a senha do superadministrador: `npm run plataforma:superadmin -- --redefinir-senha`.

### 2.3. Iniciar

```bash
npm run start:dev          # desenvolvimento, com recarga
npm run build && npm run start:prod
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api/v1/docs`
- Saúde: `GET /api/v1/health` (banco central) e `GET /api/v1/empresa/estado-banco` (banco da empresa do usuário)

Na inicialização a API **avisa no log** se alguma tabela ainda está em MyISAM ou se falta alguma migration.

---

## 3. Variáveis de ambiente

Todas estão em `.env.example`. As obrigatórias são `DB_HOST`, `DB_USERNAME`, `DB_DATABASE` e `JWT_SECRET` (mínimo 32 caracteres).

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | 3000 | Porta HTTP |
| `API_PREFIX` | api/v1 | Prefixo das rotas |
| `CORS_ORIGINS` | http://localhost:5173 | Origens do frontend, separadas por vírgula |
| `SWAGGER_ENABLED` | true | Publica `/api/v1/docs` |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | — / 3306 | Conexão MySQL |
| `DB_CHARSET` | utf8mb4 | Charset da conexão |
| `DB_LOGGING` | false | Loga as consultas SQL |
| `JWT_SECRET` | — | Segredo do token (gere com `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `JWT_EXPIRES_IN` | 1d | Validade do token (`1h`, `8h`, `1d`...) |
| `BCRYPT_ROUNDS` | 10 | Custo do hash de senha |
| `APP_TIMEZONE` | America/Sao_Paulo | Fuso usado em datas e no "controle" |
| `EMPRESA_ID` | 1 | Empresa de `cad_empresa` |
| `PDV_TERMINAL` | 02 | Terminal gravado nas vendas e no caixa da API (o desktop usa 01) |
| `PDV_TURNO` | 1 | Turno gravado nas vendas |
| `EXIGIR_CAIXA_ABERTO` | true | Vendas e recebimentos exigem caixa aberto |
| `ESTOQUE_BAIXO_LIMITE` | 3 | Limite do estoque baixo para produtos sem mínimo cadastrado |
| `CARNE_MAX_PARCELAS` | 12 | Máximo de parcelas no carnê |
| `CARNE_LIMITE_PERCENTUAL_RENDA` | 50 | Limite do carnê = este % da faixa salarial do cliente |
| `CARNE_LIMITE_PADRAO` | 300 | Limite do carnê (R$) para clientes sem faixa salarial |
| `BACKUP_DIR` | armazenamento/backups | Pasta dos ZIPs de backup (fora do Git e de qualquer pasta pública) |
| `BACKUP_RETENCAO_HORAS` | 24 | Tempo (1 a 720 h) que o arquivo fica disponível para download antes de ser apagado |
| `MYSQLDUMP_PATH` | mysqldump | Caminho do `mysqldump` usado nos backups; `desativado` força o exportador interno (usado também quando o `mysqldump` não é encontrado) |
| `E2E_DB_DATABASE`, `E2E_LOGIN`, `E2E_SENHA` | — | Testes e2e (seção 10) |

---

## 4. Migrations

`synchronize` está **sempre desligado** e as migrations **nunca rodam sozinhas**. Todas foram autorizadas e nenhuma apaga dados do legado.

| Migration | O que faz | Reverter |
|---|---|---|
| `ConverterTabelasInnodb` | `cad_produtos`, `mv_estoque`, `mv_estoque_historico`, `mv_vendas`, `mv_vendas_movimento`, `mv_financeiro` de MyISAM para **InnoDB** (necessário para transação real) | Volta para MyISAM |
| `CriarApiCredencial` | Cria `api_credencial` (hash bcrypt da senha da API) sem alterar `cad_login` | Remove a tabela |
| `AdicionarVrPix` | Cria `mv_vendas.vr_pix` | Remove a coluna (e os valores de Pix) |
| `AdicionarLimiteCarne` | Cria `cad_clientes.limite_carne` (NULL para todos = limite calculado) | Remove a coluna (e os limites manuais) |

Antes de rodar no banco da loja:

```bash
mysqldump -u <usuario> -p --single-transaction <banco> > backup-antes-migrations.sql
npm run migration:run
```

Depois, **faça uma venda de teste no sistema desktop**. Se o desktop grava `mv_vendas` com `INSERT ... VALUES (...)` sem lista de colunas, a coluna `vr_pix` o faria falhar; nesse caso rode `npm run migration:revert` e me avise. Faça o mesmo com **um cadastro de cliente de teste no desktop** (coluna `limite_carne`).

Enquanto as tabelas estiverem em MyISAM, **vendas, estornos, entradas e ajustes de estoque e baixas de carnê ficam bloqueados (503)**, para não gravar dados pela metade.

---

## 5. Autenticação e acesso

- `POST /auth/login` com `{ "login": "<e-mail ou usuário>", "senha": "...", "lembrar": false }` devolve um access token curto (15 min) e grava o refresh token num cookie httpOnly. `POST /auth/refresh` renova (com rotação e detecção de reuso) e `POST /auth/logout` encerra.
- Papéis: **SUPER_ADMIN** (dono da plataforma, rotas `/plataforma`), **COMPANY_ADMIN**, **MANAGER**, **SELLER**, **STOCK_OPERATOR**. Cada rota comercial declara a permissão exigida (`@RequerPermissao`) e o guard confere no backend; cargos personalizados ajustam as permissões de um papel.
- A empresa vem sempre do usuário autenticado; a requisição usa a conexão do banco dessa empresa. Usuário desativado ou empresa suspensa/vencida recebem 401/403 na hora.
- Não existe cadastro público de superadministrador: o primeiro vem do comando `plataforma:superadmin` e os outros são criados por ele.
- Empresas novas entram por **código de ativação** (`POST /ativacao/validar` e `/ativacao/concluir`), gerado em `POST /plataforma/codigos`. O código é mostrado uma vez e guardado só como hash.
- Funcionários (`/funcionarios`, `/cargos`) recebem senha temporária e trocam no primeiro acesso.
- Operações importantes ficam em `plataforma_auditoria` (`GET /auditoria` para a empresa, `GET /plataforma/auditoria` para a plataforma), sem senhas, tokens ou códigos.

---

## 6. Padrão das respostas

Sucesso:

```json
{ "data": { "id": 1, "nome": "..." } }
```

Listas paginadas (`?page=1&limit=20`, máximo 100):

```json
{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 321, "totalPages": 17 } }
```

Erro:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Estoque insuficiente: TOALHA BANHO 29,99 (pedido: 3, disponível: 2)",
  "path": "/api/v1/vendas",
  "timestamp": "2026-11-04T14:00:00.000Z"
}
```

| Código | Quando |
|---|---|
| 200 / 201 / 204 | Sucesso / criado / sem conteúdo (exclusão) |
| 400 | Dados inválidos (mensagens em português, uma por campo); pagamentos que não fecham com o total |
| 401 | Sem token, token inválido/expirado, login inválido |
| 403 | Rota exclusiva do ADMINISTRADOR |
| 404 | Registro não encontrado |
| 409 | Conflito: estoque insuficiente, duplicidade, exclusão com vínculos, caixa fechado, venda já estornada |
| 503 | Banco indisponível ou migrations pendentes |
| 500 | Erro interno (detalhe só no log) |

Datas são `AAAA-MM-DD`; valores em reais como número (`29.99`).

---

## 7. Endpoints

Todos com prefixo `/api/v1`. Detalhes de cada campo no Swagger.

| Método | Rota | Descrição |
|---|---|---|
| **Auth** |||
| POST | `/auth/login` | Login (público) |
| GET | `/auth/me` | Usuário autenticado |
| PATCH | `/auth/senha` | Altera a senha da API |
| GET | `/usuarios`, `/usuarios/:id` | Usuários (admin) |
| **Empresa** |||
| GET | `/empresa` | Dados da empresa |
| PATCH | `/empresa` | Atualiza (admin) |
| **Clientes** |||
| GET | `/clientes?busca=` | Lista; busca por nome, CPF/CNPJ (com ou sem máscara), código ou id |
| GET | `/clientes/:id` | Consulta |
| POST | `/clientes` | Cadastra (código de barras gerado no padrão do desktop) |
| PATCH | `/clientes/:id` | Atualiza |
| DELETE | `/clientes/:id` | Exclui (409 se tiver vendas ou carnês) |
| GET | `/clientes/:id/vendas` | Vendas do cliente |
| GET | `/clientes/:id/credito-carne` | Limite do carnê: `limite`, `origem` (MANUAL/RENDA/PADRAO), `emAberto`, `disponivel` |
| **Fornecedores** |||
| GET, POST | `/fornecedores` | Lista / cadastra |
| GET, PATCH, DELETE | `/fornecedores/:id` | Consulta / atualiza / exclui (409 com vínculos) |
| **Produtos** |||
| GET | `/produtos?busca=&idFornecedor=&somenteDisponiveis=` | Lista com preços, saldo e lucro bruto |
| GET | `/produtos/codigo/:codigoBarras` | Busca exata (leitor de código de barras) |
| GET | `/produtos/estoque-baixo?limite=` | Saldo ≤ mínimo (ou ≤ limite) |
| GET | `/produtos/tipos` | Categorias |
| GET, POST | `/produtos/:id`, `/produtos` | Consulta / cadastra (cria saldo zerado) |
| PATCH, DELETE | `/produtos/:id` | Atualiza / exclui (409 com vendas, movimentação ou saldo) |
| **Estoque** |||
| GET | `/estoque` | Saldos |
| GET | `/estoque/:idProduto` | Saldo + últimas movimentações |
| POST | `/estoque/entradas` | Nota de entrada (histórico + saldo + conta a pagar) |
| POST | `/estoque/ajustes` | Ajuste manual com motivo (admin) |
| GET | `/estoque/movimentacoes?inicio=&fim=&idProduto=&tipo=` | Entradas, trocas, ajustes e vendas |
| **Vendas** |||
| POST | `/vendas` | Registra a venda (transação) |
| GET | `/vendas?inicio=&fim=&idCliente=&formaPagamento=&incluirEstornadas=` | Histórico |
| GET | `/vendas/:id`, `/vendas/controle/:controle` | Detalhe com itens, trocas, pagamentos e parcelas |
| POST | `/vendas/:id/estorno` | Estorna e devolve ao estoque (admin) |
| **Carnês** |||
| GET | `/carnes?idCliente=&situacao=ABERTA\|PAGA\|TODAS&vencidas=` | Parcelas |
| GET | `/carnes/:codigo` | Parcela pelo código de 13 dígitos |
| POST | `/carnes/baixa` | Recebe uma ou mais parcelas (juros/desconto opcionais) |
| **Caixa** |||
| GET | `/caixa/atual` | Caixa aberto do terminal + resumo (ou `null`) |
| POST | `/caixa/abrir`, `/caixa/fechar` | Abre / fecha |
| GET | `/caixa/historico`, `/caixa/:id` | Caixas anteriores |
| **Relatórios** (`?inicio=&fim=`; padrão: mês corrente) |||
| GET | `/relatorios/dashboard` | Faturamento, vendas, ticket médio, carnês, estoque baixo, comparativo com o período anterior |
| GET | `/relatorios/faturamento?agrupar=dia\|mes` | Série de faturamento |
| GET | `/relatorios/vendas-periodo`, `/relatorios/vendas-dia?data=` | Vendas com totais por forma |
| GET | `/relatorios/formas-pagamento` | Participação de cada forma |
| GET | `/relatorios/produtos-mais-vendidos?limite=&ordenarPor=` | Ranking de produtos |
| GET | `/relatorios/vendas-por-cliente?limite=` | Ranking de clientes |
| GET | `/relatorios/estoque-baixo` | Menor quantidade em estoque |
| GET | `/relatorios/clientes-debito` | Clientes com carnê em aberto |
| GET | `/relatorios/baixas-carne` | Parcelas recebidas |
| GET | `/relatorios/mercadorias` | Entradas por nota e investimento |
| GET | `/relatorios/movimentacoes` | Movimentações de estoque |
| **Backups** (permissão `backup.gerar`) |||
| POST | `/backups` | Inicia o backup da empresa do usuário (202; devolve o mesmo se já houver um em andamento) |
| GET | `/backups`, `/backups/:id` | Histórico e progresso (`status`, `progresso`, `etapa`, `disponivel`) |
| GET | `/backups/:id/download` | Baixa o ZIP (`Content-Disposition: attachment`) |
| **Backup global** (somente superadministrador) |||
| POST, GET | `/plataforma/backups` | Inicia / lista backups completos da plataforma |
| GET | `/plataforma/backups/:id`, `/plataforma/backups/:id/download` | Progresso / download |
| GET | `/health` | Saúde da API e do banco (público) |

---

## 8. Exemplos

### Login

```http
POST /api/v1/auth/login
{ "login": "ATRATIVA", "senha": "******" }
```

```json
{
  "data": {
    "accessToken": "eyJhbGciOi...",
    "tokenType": "Bearer",
    "expiresAt": "2026-11-05T14:00:00.000Z",
    "usuario": { "id": 1, "login": "ATRATIVA", "idPerfil": 1, "perfil": "ADMINISTRADOR", "administrador": true }
  }
}
```

### Venda com desconto e dois pagamentos

```http
POST /api/v1/vendas
Authorization: Bearer <token>
{
  "idCliente": 175,
  "itens": [
    { "idProduto": 118, "quantidade": 1 },
    { "idProduto": 444, "quantidade": 2, "precoUnitario": 17.5 }
  ],
  "desconto": 2,
  "pagamentos": [
    { "forma": "DINHEIRO", "valor": 20 },
    { "forma": "CARNE", "valor": 49 }
  ],
  "parcelasCarne": 3
}
```

- Sem `precoUnitario`, a API usa o **preço a prazo** do cadastro (aqui, 36,00 para o produto 118).
- **Não envie totais**: a API calcula (36,00 + 2 × 17,50 − 2,00 = 69,00). Se a soma de `pagamentos` não bater, responde 400 mostrando o total correto.
- Para troca, inclua `"itensTroca": [{ "idProduto": 119, "quantidade": 1 }]`: o valor é abatido e o item volta ao estoque.

Resposta (resumida):

```json
{
  "data": {
    "id": 9871, "controle": "20261104143012", "data": "2026-11-04", "hora": "14:30:12",
    "cliente": { "id": 175, "nome": "MARIA ..." },
    "total": 69, "desconto": 2, "subtotalItens": 69, "creditoTroca": 0,
    "pagamentos": { "dinheiro": 20, "pix": 0, "cartao": 0, "carne": 49, "cheque": 0, "ticket": 0 },
    "formasPagamento": ["Dinheiro", "Carnê"],
    "itens": [
      { "idProduto": 118, "produto": "...", "quantidade": 1, "valorUnitario": 34.99, "valorTotal": 34.99 },
      { "idProduto": 444, "produto": "...", "quantidade": 2, "valorUnitario": 17.01, "valorTotal": 34.01 }
    ],
    "itensTroca": [],
    "parcelasCarne": [
      { "codigo": "0411614300019", "parcela": 1, "vencimento": "2026-12-04", "valor": 16.33, "situacao": "ABERTA" },
      { "codigo": "...", "parcela": 2, "vencimento": "2027-01-04", "valor": 16.33, "situacao": "ABERTA" },
      { "codigo": "...", "parcela": 3, "vencimento": "2027-02-04", "valor": 16.34, "situacao": "ABERTA" }
    ]
  }
}
```

O desconto de 2,00 foi rateado proporcionalmente (1,01 e 0,99) e a soma dos itens é exatamente o total. Como no desktop, `valorUnitario` é o total do item dividido pela quantidade, arredondado.

### Entrada de mercadorias

```http
POST /api/v1/estoque/entradas
{ "idFornecedor": 2, "itens": [{ "idProduto": 396, "quantidade": 12, "valorCompra": 14.5 }] }
```

### Baixa de carnê

```http
POST /api/v1/carnes/baixa
{ "parcelas": [{ "codigo": "2108612020015", "juros": 2.5 }] }
```

---

## 9. Regras de negócio

### Venda (`POST /vendas`) — tudo numa transação MySQL

1. Valida produtos (existem, não são item de serviço), cliente e caixa aberto.
2. **Calcula no backend** em centavos: preço sugerido = **a prazo** (`vr_venda`), ou o editado pelo vendedor; desconto e acréscimo **rateados nos itens** (como o desktop, os itens são gravados com o valor líquido e somam exatamente o total); troca abatida.
3. Desconto não pode passar do valor dos produtos nem de `cad_empresa.max_desc` (quando definido).
4. Bloqueia os saldos (`SELECT … FOR UPDATE`) e confere o estoque **somando linhas repetidas do mesmo produto**.
5. Grava `mv_vendas`, `mv_vendas_movimento` e `mv_financeiro`:
   - dinheiro + Pix → 1 lançamento origem **V** (plano "Venda à vista");
   - cartão → sem lançamento (igual ao desktop);
   - carnê → 1 parcela por mês, origem **C**, código EAN-13 no padrão do desktop; 1º vencimento 30 dias após a venda (ou `primeiroVencimento`).
6. Baixa o estoque com `UPDATE … WHERE quantidade >= ?`: **o estoque nunca fica negativo**, mesmo com o desktop vendendo ao mesmo tempo.
7. Troca: o item devolvido volta ao estoque (registrado em `mv_estoque_historico` como o desktop faz).
8. **Qualquer erro desfaz tudo (rollback).**

### Limite do carnê

- Cada cliente tem um limite para o **total de parcelas em aberto** no carnê.
- Limite = `limite_carne` do cadastro, se preenchido (exceção por cliente; `0` bloqueia o carnê); senão **faixa salarial × `CARNE_LIMITE_PERCENTUAL_RENDA` %**; sem faixa salarial, `CARNE_LIMITE_PADRAO`.
- Na venda, parcelas em aberto + valor desta venda no carnê não podem passar do limite: **409** e nada é gravado. Só a parte paga no carnê conta; dinheiro, Pix e cartão não.
- O valor em aberto é recalculado de `mv_financeiro` a cada venda (com `FOR UPDATE`), então **cada parcela paga libera o limite na hora**, e venda estornada também.
- Não há liberação acima do limite: para vender mais, receba parcelas ou aumente a renda/limite do cliente.
- O sistema desktop **não** conhece essa regra; vendas no carnê feitas por ele não são bloqueadas (mas contam no valor em aberto).

### Estorno

Lógico (`estornado = 1`, como no desktop). Devolve os itens ao estoque, retira de novo os itens recebidos em troca e marca os lançamentos financeiros como estornados. Bloqueado se alguma parcela do carnê já foi paga.

### Estoque

- Saldo só muda por entrada de nota, ajuste, venda, troca ou estorno — **sempre com registro** no histórico. `PATCH /produtos` não altera quantidade.
- Ajuste negativo (perda, avaria...) é gravado com quantidade negativa e `numerodanota = "AJ-<MOTIVO>"`.
- Entrada de nota gera conta a pagar em `mv_financeiro` (origem E, plano "Compra de mercadoria"), como o desktop.
- **Estoque baixo:** saldo ≤ `min_estoque`; como nenhum produto tem mínimo cadastrado hoje, usa `ESTOQUE_BAIXO_LIMITE` ou `?limite=`.

### Backup dos dados

- **Não altera o fechamento de caixa.** O backup é pedido depois do `POST /caixa/fechar`, em outra requisição; uma falha no backup não reverte nem bloqueia o fechamento.
- Roda em segundo plano na própria API. O registro fica em `plataforma_backups` (`PROCESSANDO` → `CONCLUIDO` / `FALHOU` → `EXPIRADO`) e o frontend acompanha `progresso`. Só um backup por empresa (e um global) é gerado por vez. Se a API reiniciar no meio, o registro vira `FALHOU`.
- A empresa vem sempre do usuário autenticado; buscar o id de outra empresa devolve 404. Funcionários só acessam se o cargo tiver `backup.gerar` (o administrador da empresa tem; gerente, vendedor e estoquista não, por padrão).
- **ZIP da empresa** (`atrativa-shore-backup-<empresa>-<data>.zip`):
  - `dados/empresa.sql`: **dump MySQL** de todas as tabelas do banco da empresa (estrutura e dados, ids originais), gerado pelo `mysqldump --single-transaction --skip-add-drop-table --hex-blob`. As tabelas com credenciais (`cad_login`, `cad_empresa`, `api_credencial`) saem do `mysqldump` e são acrescentadas no fim do mesmo arquivo com as colunas de senha como `NULL` (`api_credencial` só com a estrutura);
  - `dados/plataforma.sql`: registros desta empresa no banco central (empresa, plano, cargos, usuários com `senha_hash` NULL, ativações e auditoria), com `CREATE TABLE IF NOT EXISTS` e `INSERT`;
  - `empresa.json`: cadastro e configurações comerciais, para consulta rápida;
  - `metadados.json`: formato `atrativa-shore-backup-empresa`, `versaoFormato` 2, data, responsável, ferramenta usada, registros por tabela e o que ficou de fora;
  - **sem** senhas, hashes, `chave_liberacao`, refresh tokens nem códigos de ativação.
- **mysqldump:** a API procura o `mysqldump` no PATH (ou em `MYSQLDUMP_PATH`). A senha vai num arquivo de opções temporário, nunca na linha de comando. Se ele não existir ou falhar, a API gera o mesmo formato de dump sozinha (snapshot consistente) e registra o motivo em `metadados.json` e no log. `MYSQLDUMP_PATH=desativado` força o exportador interno.
- Restaurar: `mysql -u <usuario> -p -e "CREATE DATABASE <novo> CHARACTER SET utf8mb4"` e `mysql -u <usuario> -p <novo> < dados/empresa.sql`. Os usuários precisam de senha temporária nova depois.
- **Backup global:** um único dump do `mysqldump --databases` (central + cada empresa provisionada, com rotinas e gatilhos) ou, sem ele, um script por banco. `plataforma_refresh_tokens` fica de fora. Contém hashes de senha e as senhas do sistema anterior: guarde em local protegido. Os scripts não têm `DROP TABLE`.
- Os arquivos ficam em `BACKUP_DIR/empresa-<id>/` ou `BACKUP_DIR/plataforma/` com nome aleatório e permissão só do usuário da API; o download confere o status e a validade, e a limpeza apaga os vencidos a cada 30 minutos e na inicialização.
- Auditoria: `backup.gerado`, `backup.falhou` e `backup.baixado`.
- Requer `npm run plataforma:migrar` para criar `plataforma_backups` (migration `CriarBackups1762400000002`, só cria a tabela).

### Exclusões

O banco não tem chaves estrangeiras, então a API protege o histórico: cliente com vendas/carnês, produto com vendas/movimentação/saldo e fornecedor com produtos/entradas **não podem ser excluídos (409)**.

### Duplicidade

Nome de produto e de fornecedor (UNIQUE no banco), código de barras do produto e CPF/CNPJ do cliente (verificado pela API, sem máscara) não podem se repetir (409).

---

## 10. Testes

```bash
npm test                 # unitários (não precisam de banco)
npm run test:e2e         # inicialização da API com banco simulado + fluxo SaaS real (este, só com E2E_SAAS=true)
```

- **Unitários:** ZIP do backup (integridade e CRC), dump SQL da empresa sem senhas e filtrado pela empresa, mysqldump (argumentos, senha fora da linha de comando, volta ao exportador interno quando falha), geração/falha/expiração/isolamento do serviço de backups e permissões; cálculo e registro de venda, limite do carnê, operações de saldo, relatórios, códigos e datas; guard de acesso (plataforma × empresa, empresa suspensa, permissões, senha temporária), permissões por papel, códigos de ativação, remoção de segredos da auditoria e **isolamento do contexto por empresa com requisições concorrentes**.
- **Inicialização (`test/inicializacao.e2e-spec.ts`):** sobe o `AppModule` real com banco simulado e confere 401/400, envelope de resposta e todas as rotas no Swagger.
- **Fluxo SaaS (`test/api.e2e-spec.ts`):** com MySQL real, cria bancos temporários `e2e_*`, ativa duas empresas por código, confere que produtos, clientes e vendas não cruzam, que empresa não acessa `/plataforma`, permissões do vendedor, senha temporária, suspensão/reativação, rotação do refresh token, auditoria, fechamento de caixa seguido de backup (download, integridade, dados só da empresa, 404 para outra empresa, 403 para gerente e superadministrador) e backup global; no fim apaga os bancos `e2e_*` que criou. Para rodar, use um MySQL de teste e defina `E2E_SAAS=true` (e `E2E_DB_*` se for outro servidor).

---

## 11. Integração com o frontend

- CORS liberado para `CORS_ORIGINS` (padrão: Vite em `http://localhost:5173`).
- No frontend, use uma variável `VITE_API_URL=http://localhost:3000/api/v1` e envie o token em `Authorization`.
- Correspondência de campos com as telas atuais:

| Tela | Campo da tela | Campo da API |
|---|---|---|
| Login | E-mail | `login` (o banco não tem e-mail) |
| Clientes | Código / Código Postal / Data de Aniversário | `codigo` / `cep` / `dataAniversario` |
| Clientes | Faixa Salarial | `faixaSalarial` (número em reais) |
| Produtos | Valor à Vista / à Prazo / Lucro Bruto | `precoVista` / `precoPrazo` / `lucroBrutoPercentual` (calculado) |
| Produtos | Valor Mínimo de Estoque / Fornecedor | `estoqueMinimo` / `idFornecedor` (`GET /fornecedores`) |
| Vendas | Dinheiro, Pix, Cartão, Carnê | `pagamentos[].forma`: `DINHEIRO`, `PIX`, `CARTAO`, `CARNE` |
| Vendas | Realizar Troca | `itensTroca` |
| Carnês | Número da Parcela / Valor Total da Compra | `numeroParcela` ("1/5") / `valorTotalCompra` |
| Caixa | Dinheiro, Pix, Cartão, Carnês, Total | `GET /caixa/atual` → `resumo` |

---

## 12. Limitações conhecidas

- **Empresa única:** o banco não tem `id_empresa`; não há cadastro/exclusão de empresas.
- **Forma de pagamento do recebimento de carnê** não é guardada pelo banco (o desktop grava só o valor); o caixa a considera dinheiro.
- **Vendas não têm hora no banco**, só data; a hora exibida vem do `controle`.
- **Valor para o próximo dia** no fechamento de caixa não tem coluna no banco; é só devolvido na resposta.
- `modo_lancamento` (0/2/3) e `modo_venda = 3` não têm significado documentado; a API grava 0 (vendas) e 2 (trocas), como o desktop.
- Textos antigos com acentos em CP850 aparecem com caracteres trocados (ex.: `CARNÒ`); a API não altera dados existentes.
- A API exige MySQL 5.7+ (o protocolo do MySQL 4.0 não é suportado pelo driver). Para usar API e desktop juntos, os dois precisam apontar para o mesmo servidor MySQL 8.
