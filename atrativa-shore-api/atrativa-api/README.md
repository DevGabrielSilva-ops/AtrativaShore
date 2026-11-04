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

### 2.2. Migrations (uma vez, após backup)

```bash
npm run migration:show     # o que falta aplicar
npm run migration:run      # aplica (ver seção 4)
```

### 2.3. Iniciar

```bash
npm run start:dev          # desenvolvimento, com recarga
npm run build && npm run start:prod
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api/v1/docs`
- Saúde: `GET /api/v1/health` (mostra se as migrations foram aplicadas)

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

## 5. Autenticação

- `POST /api/v1/auth/login` com `{ "login": "ATRATIVA", "senha": "..." }` devolve `accessToken` (JWT) e os dados do usuário.
- Envie em toda requisição: `Authorization: Bearer <accessToken>`.
- Todas as rotas exigem token, exceto `POST /auth/login` e `GET /health`.
- **Senha:** o banco legado guarda a senha em texto puro (`cad_login.senha`). A API não altera essa coluna (o desktop continua funcionando). No **primeiro login** de cada usuário, ela confere a senha do desktop e grava um **hash bcrypt** em `api_credencial`; daí em diante só o hash é usado. `PATCH /auth/senha` troca a senha da API (não a do desktop).
- A senha nunca é retornada; login inválido e usuário inexistente recebem a mesma mensagem.
- **Perfis:** o perfil vem de `cad_login_perfil`. Rotas sensíveis exigem o perfil **ADMINISTRADOR**: estorno de venda, ajuste manual de estoque, edição da empresa e listagem de usuários. (O campo `menu_options` do legado não tem mapa de significado, então não é usado.)

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

### Exclusões

O banco não tem chaves estrangeiras, então a API protege o histórico: cliente com vendas/carnês, produto com vendas/movimentação/saldo e fornecedor com produtos/entradas **não podem ser excluídos (409)**.

### Duplicidade

Nome de produto e de fornecedor (UNIQUE no banco), código de barras do produto e CPF/CNPJ do cliente (verificado pela API, sem máscara) não podem se repetir (409).

---

## 10. Testes

```bash
npm test                                 # unitários (não precisam de banco)
npm run test:e2e                         # inicialização da API + fluxo completo (este, só com banco de teste)
```

- **Unitários (64 testes):** cálculo da venda (rateio, troca, pagamentos, limites), venda com banco simulado (baixa de estoque, estoque insuficiente sem gravar nada, rollback com concorrência, carnê, troca, cartão sem financeiro, bloqueio em MyISAM), autenticação (migração da senha legada, bcrypt, token), operações de saldo, relatórios, códigos e datas **conferidos contra registros reais do banco**.
- **Inicialização (`test/inicializacao.e2e-spec.ts`):** sobe o `AppModule` real com banco simulado e confere guards (401), validação (400 em português), envelope de resposta e o documento Swagger.
- **Fluxo completo (`test/api.e2e-spec.ts`):** contra um **MySQL de teste real**: cadastro, entrada, venda, estoque insuficiente (409 sem gravar), total errado (400), estorno, carnê, baixa e relatórios. Para rodar:

```bash
# banco separado com o dump e as migrations
docker exec atrativa-mysql mysql -uroot -proot -e "CREATE DATABASE atrativa_teste; GRANT ALL ON atrativa_teste.* TO 'atrativa'@'%';"
docker exec atrativa-mysql sh -c "mysql -uroot -proot --default-character-set=latin1 atrativa_teste < /tmp/bd.sql"
DB_DATABASE=atrativa_teste npm run migration:run
# no .env: E2E_DB_DATABASE=atrativa_teste e E2E_SENHA=<senha do usuário ATRATIVA>
npm run test:e2e
```

O teste e2e **se recusa a rodar** se `E2E_DB_DATABASE` for igual a `DB_DATABASE`.

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
