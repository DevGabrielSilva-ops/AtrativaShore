# PLANEJAMENTO.md — Atrativa Shore (Etapa 2)

> Baseado no `DATABASE_MAPPING.md`, no código atual de `atrativa-shore-api/atrativa-api` e nas telas de `meuApp`.
> Nada estrutural foi alterado no banco. Única mudança feita no código até aqui: `synchronize: true` → `false` (ver 1.1).

---

## 1. Diagnóstico do que já existe

### 1.1. API (`atrativa-shore-api/atrativa-api`)

| Item | Situação | Ação |
|---|---|---|
| Stack | NestJS **12.1**, TypeORM **1.1**, TypeScript **6**, ESM (`"type": "module"`), **Vitest** | Manter (são versões estáveis e compatíveis entre si). |
| `synchronize: true` | **Perigoso.** A entidade `Cliente` declara tamanhos e `NOT NULL` diferentes do banco (ex.: `endereco` 130 vs 50, `uf` 20 vs 2, `cpf` 11 vs 18, `rg` 9 vs 16, `celular`/`cpf`/`rg`/`dataniver`/`faixasalarial` NOT NULL vs NULL no banco). Ao conectar, o TypeORM teria executado `ALTER TABLE` em `cad_clientes`, podendo **truncar CPFs/RGs** existentes. | **Já corrigido para `false`.** Verificar se a API chegou a conectar no banco com dados reais (pergunta Q5). |
| Credenciais no código | host/porta/usuário/senha fixos em `app.module.ts` | Mover para `.env` + `@nestjs/config`. |
| Módulo `users` | Na verdade é CRUD de **clientes**; rota `POST /cad_cliente/create` | Reorganizar em `clientes/` com rotas REST (`POST /api/v1/clientes`). |
| Entidade `Cliente` | Tipos divergentes do banco (acima) | Reescrever espelhando o dump exatamente. |
| Validação | DTO existe, mas não há `ValidationPipe` global; `@Param('id') id: number` sem `ParseIntPipe` | `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` global + `ParseIntPipe`. |
| Prefixo, CORS, Swagger, filtro de erros | Inexistentes | Criar. |
| Dependências que faltam | `@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`, `@nestjs/swagger`, `class-transformer` (+ tipos) | **Você instala** (comando na seção 8): meu ambiente não tem acesso ao registro npm. |

### 1.2. Frontend (`meuApp`)

Todas as telas usam **dados mockados**, nenhuma chama API ainda. Isso é bom: o contrato da API pode seguir o banco, e o frontend se adapta.

| Tela | O que espera | Onde está no banco | Divergência |
|---|---|---|---|
| Login | e-mail + senha | `cad_login.login` + `senha` | **Não há e-mail.** Trocar o campo para "Usuário". |
| Clientes | código, nome, CPF, RG, telefone, endereço, bairro, cidade, UF, CEP, aniversário, faixa salarial | `cad_clientes` (código = `cod_barra`) | Faixa salarial no front é texto ("R$ 2.000 a 3.000"); no banco é `float`. Celular e e-mail existem no banco e não no front. |
| Produtos | nome, fornecedor, compra, **à vista**, **a prazo**, lucro bruto %, código de barras, estoque mínimo | `cad_produtos` (`vr_venda_2` = à vista, `vr_venda` = a prazo, `min_estoque`) | Lucro bruto **não é coluna**: será calculado. Fornecedor vem de `cad_fornecedores`. |
| Estoque | lançamento de nota com vários produtos e quantidades | `mv_estoque_historico` + `mv_estoque` (+ `mv_financeiro` origem E, como o legado) | — |
| Vendas | itens, desconto, **acréscimo**, formas: Dinheiro, **Pix**, Cartão, Carnê | `mv_vendas` + `mv_vendas_movimento` (+ `mv_financeiro`) | **Sem coluna para Pix e para acréscimo** (Q3, Q4). |
| Carnês | parcelas em aberto por cliente, baixa com juros/desconto | `mv_financeiro` origem C (`cod_carne`, `parcela`, `efetuado`, `vr_juros`, `vr_desconto`) | Não estava no briefing, mas a tela existe e o banco suporta. |
| Caixa | abrir/fechar turno, resumo por forma de pagamento | `mv_fechamento` + somas de `mv_vendas` | Resumo por forma é calculado, não armazenado. |
| Relatórios | baixo estoque, clientes em débito, vendas por período/dia, baixas de carnê, mercadorias/investimento | Consultas sobre as tabelas acima | Todos viáveis com o banco atual. |

---

## 2. Regras confirmadas nos dados (base para o `POST /vendas`)

1. `mv_vendas.vr_total` = `vr_dinheiro + vr_cheque + vr_cartao + vr_carne + vr_ticket` (**100%** das 9.719 vendas válidas).
2. Soma de `mv_vendas_movimento.vr_total` da venda = `mv_vendas.vr_total` em 98,6%; o restante são **trocas** (`modo_venda=4`, valor abatido).
3. `vr_adicional` = **desconto** (igual a `mv_financeiro.vr_desconto` em 4.494/4.494). Os itens são gravados com valor líquido.
4. Item: `vr_total = valor × quant` (0 exceções).
5. Venda à vista gera **1 linha** em `mv_financeiro` (origem `V`, plano 1, `efetuado='S'`, `documento='V'+controle`); venda no carnê gera **N parcelas** (origem `C`, plano 5, `cod_carne` de 13 dígitos, `efetuado='N'`).
6. Baixa de carnê: `efetuado='S'`, `data_pagamento`, `vr_pago`, juros/desconto, e um item `modo_venda=6` (produto "RECEBIMENTO DE CARNÊ").
7. Estorno é lógico: `estornado=1` + `estornado_data`, nunca DELETE.

---

## 3. Arquitetura

```text
src/
├── main.ts                  # prefixo /api/v1, CORS, ValidationPipe, Swagger, filtro global
├── app.module.ts
├── config/                  # validação das variáveis de ambiente
├── database/
│   ├── database.module.ts   # TypeORM via ConfigService, synchronize: false SEMPRE
│   ├── data-source.ts       # para CLI de migrations
│   └── migrations/          # só migrations autorizadas (Q1, Q2)
├── common/
│   ├── decorators/          # @Public(), @CurrentUser()
│   ├── filters/             # HttpException + erros MySQL → JSON padronizado
│   ├── interceptors/        # envelope { data, meta }
│   ├── dto/                 # paginação, período
│   └── utils/               # dinheiro em centavos, controle yyyymmddhhmmss, CPF, datas legadas
├── auth/                    # login, JWT strategy, guard global
├── usuarios/                # cad_login, cad_login_perfil (sem expor senha)
├── empresa/                 # cad_empresa (GET/PATCH da empresa única)
├── clientes/                # cad_clientes (+ obs)
├── fornecedores/            # cad_fornecedores (necessário para o cadastro de produtos)
├── produtos/                # cad_produtos, cad_produtos_tipo
├── estoque/                 # mv_estoque, mv_estoque_historico
├── vendas/                  # mv_vendas, mv_vendas_movimento, mv_financeiro (origem V/C)
├── carnes/                  # mv_financeiro origem C (consulta e baixa)
├── caixa/                   # mv_fechamento
└── relatorios/              # consultas agregadas (somente leitura)
```

Entidades ficam dentro de cada módulo (`<modulo>/entities/`), com `@Entity('nome_real')` e `@Column({ name: 'coluna_real' })`; propriedades em camelCase. Colunas FLOAT usam um *transformer* que converte para `number` e arredonda em 2 casas (valores) ou 3 casas (quantidades). `0000-00-00` é lido como `null`.

---

## 4. Endpoints planejados (`/api/v1`)

Todos exigem `Authorization: Bearer <token>`, exceto `POST /auth/login`. Listagens aceitam `?page=&limit=` (padrão 20, máximo 100).

| Módulo | Endpoints |
|---|---|
| Auth | `POST /auth/login` · `GET /auth/me` |
| Empresa | `GET /empresa` · `PATCH /empresa` (cadastro/exclusão não expostos: banco é de empresa única) |
| Clientes | `GET /clientes?busca=` (nome, CPF sem máscara, código) · `GET /clientes/:id` · `POST /clientes` · `PATCH /clientes/:id` · `DELETE /clientes/:id` (409 se tiver vendas ou carnês) · `GET /clientes/:id/vendas` |
| Fornecedores | `GET /fornecedores` · `POST /fornecedores` · `PATCH /fornecedores/:id` |
| Produtos | `GET /produtos?busca=` (nome ou código de barras) · `GET /produtos/codigo/:codBarra` · `GET /produtos/:id` · `POST /produtos` (cria também a linha em `mv_estoque` com 0) · `PATCH /produtos/:id` · `DELETE /produtos/:id` (409 se tiver vendas ou movimentação) · `GET /produtos/estoque-baixo?limite=` |
| Estoque | `GET /estoque` · `GET /estoque/:idProduto` · `POST /estoque/entradas` (nota com vários itens) · `GET /estoque/movimentacoes?inicio=&fim=&idProduto=` (entradas + saídas unificadas) · saída/ajuste manual: depende da Q6 |
| Vendas | `POST /vendas` · `GET /vendas?inicio=&fim=&idCliente=` · `GET /vendas/:id` (com itens e pagamento) · `POST /vendas/:id/estorno` (devolve estoque) |
| Carnês | `GET /carnes?idCliente=&situacao=aberto` · `GET /carnes/:codCarne` · `POST /carnes/:codCarne/baixa` |
| Caixa | `GET /caixa/atual` · `POST /caixa/abrir` · `POST /caixa/fechar` · `GET /caixa/:id/resumo` |
| Relatórios | `GET /relatorios/dashboard` · `/vendas-periodo` · `/vendas-dia` · `/faturamento?agrupar=dia\|mes` · `/produtos-mais-vendidos` · `/estoque-baixo` · `/clientes-debito` · `/baixas-carne` · `/mercadorias` · `/vendas-por-cliente` · `/movimentacoes` |

**Formato de erro padronizado:** `{ "statusCode": 409, "error": "Conflict", "message": "Estoque insuficiente para TOALHA BANHO 29,99 (disponível: 2)", "path": "/api/v1/vendas", "timestamp": "..." }`.

---

## 5. Fluxo do `POST /vendas` (transação)

Entrada do frontend: `idCliente?`, `itens: [{ idProduto, quantidade, precoUnitario? }]`, `desconto`, `pagamentos: [{ forma, valor }]`, `parcelas?` (carnê). **Totais não são aceitos do frontend.**

1. Abre transação (`QueryRunner`, isolamento `READ COMMITTED`).
2. Carrega os produtos com `SELECT … FOR UPDATE` em `mv_estoque` (bloqueia o saldo).
3. Valida: produto existe, tem preço, `modo_estoque = 1` (controla estoque), quantidade > 0, saldo suficiente. Erro → 404/409 e rollback.
4. Preço: `vr_venda_2` (à vista) ou `vr_venda` (a prazo) conforme a forma de pagamento; preço manual só se Q7 permitir.
5. Calcula em **centavos inteiros**: bruto, desconto (não pode passar do bruto nem do `cad_empresa.max_desc`, quando definido), líquido. Rateia o desconto entre os itens (o legado grava itens líquidos) e ajusta o último item para fechar o centavo.
6. Valida que a soma dos pagamentos = líquido (senão 400).
7. Gera `controle` (`yyyymmddhhmmss`, horário de São Paulo); se colidir no UNIQUE, tenta o segundo seguinte.
8. Grava `mv_vendas`, `mv_vendas_movimento` e `mv_financeiro` (V ou C).
9. Baixa estoque com `UPDATE mv_estoque SET quantidade = quantidade - ? WHERE id_produto = ? AND quantidade >= ?`; se `affectedRows = 0`, rollback (proteção extra contra concorrência com o desktop).
10. Commit e retorna a venda completa.

> **Isso só é transacional de verdade se as tabelas estiverem em InnoDB (Q1).** Em MyISAM o ROLLBACK é ignorado.

---

## 6. Migrations previstas (todas dependem da sua aprovação)

| # | Migration | Reversível | Depende de |
|---|---|---|---|
| M1 | `ALTER TABLE … ENGINE=InnoDB` em `mv_vendas`, `mv_vendas_movimento`, `mv_estoque`, `mv_estoque_historico`, `mv_financeiro`, `cad_produtos` | Sim (`ENGINE=MyISAM`) | Q1 + backup |
| M2 | `CREATE TABLE api_credencial (id_login, senha_hash, atualizado_em)` **ou** `ALTER cad_login MODIFY senha VARCHAR(60)` | Sim | Q2 |
| M3 | Coluna/forma para Pix (ex.: `vr_pix` em `mv_vendas`) | Sim | Q3 |

Nenhuma migration apaga dados. Nenhuma FK será criada (os dados órfãos impediriam).

---

## 7. Testes

O projeto já usa **Vitest** (padrão do NestJS 12 com ESM). O briefing pede Jest. Recomendo **manter Vitest**: a API de testes é praticamente idêntica (`describe/it/expect/vi.fn`), funciona com `@nestjs/testing` e evita reconfigurar ESM no Jest, que é instável (Q8).

- **Unitários** (sem banco): cálculo de totais e rateio de desconto, validação de estoque insuficiente, geração de `controle`, CPF, auth (senha errada, usuário inexistente, sem `autoriza`).
- **Integração** (MySQL 8 do `docker-compose`, banco separado `atrativa_test` carregado com o dump convertido): venda completa + baixa de estoque, rollback quando um item falha, estoque nunca negativo, estorno, relatórios contra totais conhecidos.
- Você roda localmente (`npm test`, `npm run test:e2e`); eu não tenho acesso ao seu MySQL daqui.

---

## 8. Dependências (rodar na sua máquina)

```bash
cd atrativa-shore-api/atrativa-api
npm install @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt @nestjs/swagger class-transformer
npm install -D @types/passport-jwt @types/bcrypt
```

---

## 9. Ordem de implementação

1. Config (`.env`, `.env.example`), `database.module`, `main.ts` (prefixo, CORS, pipes, Swagger, filtro).
2. Entidades de todas as tabelas usadas (espelho fiel do dump) + utils (dinheiro, datas, controle).
3. Auth + usuários.
4. Empresa, clientes, fornecedores, produtos.
5. Estoque (entradas, saldo, movimentações).
6. Vendas (transação) e estorno.
7. Carnês e caixa.
8. Relatórios.
9. Testes, Swagger revisado, `README.md` final.
10. Integração do frontend (substituir mocks por chamadas à API), se você quiser que eu faça.

---

## 10. Perguntas pendentes

| # | Pergunta | Bloqueia |
|---|---|---|
| Q1 | Autoriza converter as 6 tabelas para InnoDB (após backup)? | Vendas transacionais |
| Q2 | Senha: tabela nova `api_credencial` (não mexe no desktop) ou alterar `cad_login.senha`? | Auth |
| Q3 | Pix: criar coluna `vr_pix` ou gravar como `vr_cartao`/`vr_ticket`? | Vendas, Caixa |
| Q4 | Acréscimo: remover do frontend, ou embutir no preço dos itens? | Vendas |
| Q5 | O banco do Docker (`atrativaLoja`) já tem o dump importado? A API antiga chegou a conectar nele com `synchronize: true`? | Integridade de `cad_clientes` |
| Q6 | Saída/ajuste manual de estoque: quantidade negativa em `mv_estoque_historico` ou não oferecer? | Estoque |
| Q7 | Qual preço usar na venda? Nos itens de 2026, 45% usaram o preço à vista, 38% o a prazo e 17% outro valor digitado. Proposta: à vista para Dinheiro/Pix/Cartão, a prazo para Carnê, e preço manual só com permissão. | Vendas |
| Q8 | Pode manter Vitest no lugar de Jest? | Testes |
| Q9 | O sistema desktop continuará em uso junto com a API? | Q2, concorrência |

---

## 11. Decisões tomadas (04/11/2026)

| # | Decisão | Como foi implementado |
|---|---|---|
| Q1 | Converter para InnoDB as 6 tabelas de venda/estoque | Migration `ConverterTabelasInnodb` (reversível). Enquanto não for aplicada, a API **bloqueia** operações transacionais (503). |
| Q2 | Senha em tabela nova | Migration `CriarApiCredencial`; a senha do desktop é aceita no 1º login e convertida em bcrypt. `cad_login` não é alterada. |
| Q3 | Pix em coluna nova `vr_pix` | Migration `AdicionarVrPix`. Testar uma venda no desktop depois de aplicar (risco de INSERT posicional). |
| Q4 | Acréscimo distribuído nos itens | Rateado junto com o desconto; não é gravado separadamente. |
| Q5 | Preço sugerido = **a prazo**, sempre editável | `precoUnitario` opcional em cada item. |
| Q6 | Ajuste manual com quantidade negativa | `POST /estoque/ajustes`, `numerodanota = "AJ-<MOTIVO>"`, somente administrador. |
| Q7 | Manter Vitest | Testes unitários e e2e em Vitest. |
| Q8 | Desktop continua em uso | Formatos do legado preservados; baixa de estoque com UPDATE condicional; terminal da API = `02`. |
| — | Empresa única | `GET/PATCH /empresa`; cadastro/exclusão não expostos. |
| — | Entrada de estoque gera conta a pagar | Sempre, como o desktop (confirmado nos dados: 2.251 de 2.251 notas). |
| — | Cartão não gera lançamento financeiro | Igual ao desktop (2.172 vendas só no cartão sem lançamento). |
