# Atrativa Shore — Arquitetura SaaS multiempresa

Status: **implementado** (etapas 1 a 9). Decisões aprovadas pelo proprietário: um banco por empresa, o usuário `ATRATIVA` vira administrador da empresa nº 1, criação automática do banco de cada empresa, e a estrutura legada é mantida para importar o banco do sistema anterior depois.

---

## 1. Auditoria do que existe hoje

### 1.1 Banco legado (MySQL, dump `bd.sql`)

21 tabelas do sistema desktop, todas de **uma única loja**:

| Grupo | Tabelas | Registros (dump) |
|---|---|---|
| Empresa | `cad_empresa` (1 linha: ATRATIVA CAMA MESA E BANHO, com `chave_liberacao` do desktop) | 1 |
| Acesso | `cad_login`, `cad_login_perfil`, `mv_login` (histórico de logins do desktop) | 1 usuário, 1 perfil, 56 sessões |
| Cadastros | `cad_clientes`, `cad_clientes_obs`, `cad_fornecedores`, `cad_produtos`, `cad_produtos_grade`, `cad_produtos_obs`, `cad_produtos_tipo`, `cad_cartoes`, `cad_plano_de_contas` | 320 clientes, 577 produtos |
| Movimento | `mv_vendas`, `mv_vendas_movimento`, `mv_financeiro`, `mv_estoque`, `mv_estoque_historico`, `mv_fechamento` | 25 mil itens vendidos, 15 mil lançamentos |
| Etiquetas | `eti_config`, `eti_config_campo` | — |

Tabelas criadas pela API: `api_migrations`, `api_credencial` (hash da senha da API); colunas `mv_vendas.vr_pix` e `cad_clientes.limite_carne`.

**Nenhuma tabela tem coluna de empresa.** O conceito de "empresa" é implícito: o banco inteiro é a loja.

Restrições **globais** que impedem colocar várias empresas nas mesmas tabelas sem alterar o legado:

| Índice único | Efeito se duas empresas dividirem a tabela |
|---|---|
| `cad_produtos.nome_produto` | Duas lojas não poderiam ter um produto chamado "CAMISETA BASICA" |
| `cad_fornecedores.nome_fornecedor`, `cad_produtos_tipo.nome_tipo`, `cad_cartoes.nome_cartao` | Idem para fornecedores, tipos e cartões |
| `cad_login.login` | Logins únicos na plataforma inteira |
| `mv_vendas.controle` (`yyyymmddhhmmss`) | Duas vendas de lojas diferentes no mesmo segundo colidem |
| `mv_estoque.id_produto` | Saldo é 1 linha por produto (funcionaria, ids são globais) |

Outros pontos do legado que assumem loja única: código do carnê (EAN-13 montado com data/hora + parcela), código do cliente (`1` + id), caixa por `terminal`/`turno`, `cad_empresa` lida como "a primeira linha".

### 1.2 Usuário existente

`cad_login` id 1, login `ATRATIVA`, perfil 1 `ADMINISTRADOR` (todas as opções de menu liberadas), `autoriza = 'S'`. Usado no desktop até hoje (`mv_login` registra sessões em `DESKTOP-B26DOHL`). **Interpretação:** é o administrador da loja ATRATIVA CAMA MESA E BANHO, não o dono do software. A senha legada tem 6 caracteres em texto puro.

### 1.3 Backend (NestJS)

- ~7.000 linhas, 13 módulos, **83 consultas SQL manuais** e 17 pontos que recebem a conexão (`DataSource`/repositórios).
- Auth: JWT com `sub`, `login`, `perfil`; guard "administrador" = perfil `ADMINISTRADOR`. Sem empresa, sem cargos, sem refresh token, sem auditoria.
- Toda consulta usa a mesma conexão fixa do `.env`.

### 1.4 Frontend

Login por usuário, rotas privadas, menu fixo, ações de admin escondidas por `usuario.administrador`. Sem área de plataforma, ativação ou funcionários.

### 1.5 Desktop

Continua em uso e grava direto no banco. Alterar tabelas legadas (colunas novas, índices) já exigiu teste de compatibilidade em `vr_pix` e `limite_carne`.

---

## 2. Opções de multi-tenancy

| Critério | A. Banco único com `id_empresa` em todas as tabelas | **B. Um banco por empresa + banco central da plataforma (recomendado)** |
|---|---|---|
| Alteração no legado | `id_empresa` em ~18 tabelas e troca de 6 índices únicos por compostos | Nenhuma: cada empresa recebe uma cópia vazia da mesma estrutura |
| Desktop | Risco alto: `INSERT` sem lista de colunas quebra em cada tabela | Loja atual continua no banco de hoje, sem mudança |
| Isolamento | Depende de **todas as 83 consultas** terem `WHERE id_empresa = ?` (um esquecimento vaza dados) | Garantido pela conexão: a consulta só enxerga o banco da empresa |
| Colisões (`controle`, carnê, nomes) | Precisam de redesenho | Não existem (cada empresa tem seus próprios) |
| Esforço no backend | Reescrever as 83 consultas e regras | Trocar a origem da conexão nos 17 pontos (contexto por requisição) |
| Novas empresas | Uma linha em `plataforma_empresas` | Criar banco a partir do modelo (automático; exige usuário MySQL com `CREATE`) |
| Migrations | Uma vez | Rodam em cada banco de empresa (script percorre todas) |
| Indicadores globais | Consulta direta | Vêm do banco central (empresas, usuários, ativações); números comerciais por empresa quando necessário |
| Escala | Milhares de empresas | Dezenas a centenas de empresas sem ajuste; acima disso, pool por servidor |

**Recomendação: B.** O legado foi feito para uma loja por banco; manter essa unidade e adicionar uma camada central é a forma de ter isolamento real sem reescrever regras já testadas nem quebrar o desktop.

---

## 3. Arquitetura proposta (opção B)

```
                 ┌──────────────────────────────┐
  JWT ─────────▶ │ atrativa_plataforma (central)│  empresas, planos, usuários, cargos,
                 │                              │  códigos de ativação, refresh tokens, auditoria
                 └──────────────┬───────────────┘
                                │ usuário → empresa → banco
             ┌──────────────────┼──────────────────┐
             ▼                  ▼                  ▼
     Atrativa (atual)     atrativa_emp_2     atrativa_emp_3      ← estrutura legada idêntica
     + desktop            (nova empresa)     (nova empresa)
```

### 3.1 Banco central `atrativa_plataforma` (tabelas novas)

| Tabela | Objetivo | Campos principais |
|---|---|---|
| `plataforma_planos` | Planos contratáveis (sem cobrança nesta etapa) | id, nome, max_funcionarios, descricao, ativo |
| `plataforma_empresas` | Cada empresa cliente | id, nome, cnpj, **status** (PENDING/ACTIVE/SUSPENDED/EXPIRED), id_plano, **banco** (nome do banco da empresa), assinatura_ate, criada_em, ativada_em, suspensa_em, motivo_status |
| `plataforma_usuarios` | Todos os acessos: superadmin, admin da empresa, funcionários | id, id_empresa (NULL = plataforma), nome, email (único), login (único, opcional), senha_hash (bcrypt), **papel**, id_cargo, status (ACTIVE/INACTIVE), trocar_senha, **versao_token**, id_login_legado, ultimo_login_em, criado_em, criado_por |
| `plataforma_cargos` | Cargos da empresa e permissões personalizadas | id, id_empresa, nome, papel_base, permissoes (JSON), sistema |
| `plataforma_codigos_ativacao` | Códigos de ativação | id, **hash** (SHA-256), prefixo (4 caracteres para identificar na tela), tipo (NOVA_EMPRESA/EMPRESA_EXISTENTE), id_empresa, email_destinatario, max_usos, usos, expira_em, revogado_em, criado_por, criado_em, ultimo_uso_em |
| `plataforma_ativacoes` | Cada uso de um código | id, id_codigo, id_empresa, id_usuario, data_hora, ip |
| `plataforma_refresh_tokens` | Sessões renováveis | id, id_usuario, hash, expira_em, revogado_em, substituido_por, criado_em, ip, user_agent |
| `plataforma_auditoria` | Rastreabilidade | id, data_hora, id_usuario, id_empresa, acao, entidade, id_entidade, detalhes (JSON sem segredos), ip |

Relacionamentos: empresa 1—N usuários; empresa 1—N cargos; plano 1—N empresas; código N—1 empresa (opcional); usuário 1—N refresh tokens; auditoria referencia usuário e empresa.

### 3.2 Bancos das empresas

- Estrutura legada idêntica + migrations da API (`vr_pix`, `limite_carne`, InnoDB).
- Criados a partir de um modelo versionado com as linhas-base que as regras exigem: `cad_empresa` (1 linha com os dados informados na ativação), `cad_plano_de_contas`, `cad_login_perfil`, produto de serviço "RECEBIMENTO DE CARNÊ".
- **Vendedor nas vendas:** `mv_vendas.id_login` aponta para `cad_login` do banco da empresa. Cada usuário da plataforma ganha um espelho em `cad_login` (`id_login_legado`) com senha aleatória e um perfil sem acesso ao desktop. Assim relatórios e o desktop continuam mostrando quem vendeu.
- O banco atual (`Atrativa`) vira a **empresa nº 1**, ACTIVE, sem nenhuma alteração de dados.

### 3.3 Isolamento

1. O JWT traz `sub` (usuário) e `ver` (versão do token). O backend busca o usuário no banco central e, dele, a empresa e o banco. **Nenhum `id_empresa` vem do frontend.**
2. Um `TenantContext` (AsyncLocalStorage) guarda a conexão da empresa durante a requisição; os serviços comerciais pedem a conexão a ele em vez de usar a conexão fixa. Sem contexto, a chamada falha (nunca cai no banco errado).
3. Pool de conexões por empresa, criado sob demanda e reaproveitado.
4. Rotas `/plataforma/*` só para SUPER_ADMIN; rotas comerciais exigem usuário de empresa ACTIVE.
5. Testes e2e com duas empresas confirmam que produtos, clientes, vendas e relatórios de uma não aparecem na outra.

### 3.4 Perfis e permissões (RBAC verificado no backend)

| Permissão | COMPANY_ADMIN | MANAGER | SELLER | STOCK_OPERATOR |
|---|:-:|:-:|:-:|:-:|
| Dashboard comercial | ✔ | ✔ | — | — |
| Registrar venda / operar caixa / receber carnê | ✔ | ✔ | ✔ | — |
| Ver todas as vendas | ✔ | ✔ | só as próprias | — |
| Estornar venda | ✔ | ✔ | — | — |
| Clientes: consultar / cadastrar | ✔ / ✔ | ✔ / ✔ | ✔ / configurável | — |
| Produtos: consultar / gerenciar | ✔ / ✔ | ✔ / ✔ | ✔ / — | ✔ / — |
| Estoque: consultar / entrada / ajuste | ✔ | ✔ | consultar | ✔ / ✔ / ✔ |
| Relatórios | ✔ | ✔ | — | estoque |
| Funcionários | gerenciar | consultar | — | — |
| Dados da empresa | ✔ | — | — | — |

- Cada permissão é uma constante (`vendas.registrar`, `estoque.ajustar`, …) e cada rota declara a sua (`@Permissao(...)`).
- Cargos personalizados partem de um papel base e ajustam a lista; um administrador só concede permissões que ele mesmo tem.
- Ninguém altera o próprio papel/cargo; mudar cargo ou desativar alguém incrementa `versao_token` e derruba as sessões dessa pessoa.
- SUPER_ADMIN não acessa dados comerciais das empresas pela área comercial; vê a plataforma.

### 3.5 Autenticação

- Login único (e-mail ou usuário + senha); a resposta indica o papel e o frontend leva ao painel certo.
- Access token JWT de 15 min + refresh token rotativo (7 dias, guardado com hash, em cookie `httpOnly`); logout revoga.
- Bloqueios no login **e** a cada requisição: usuário INACTIVE, empresa SUSPENDED/EXPIRED/PENDING (status em cache de poucos segundos).
- Superadmin inicial: comando `npm run plataforma:superadmin` lendo `SUPERADMIN_EMAIL`/`SUPERADMIN_SENHA` do ambiente. Não há rota HTTP para criar superadmin.
- Recuperação de senha: não há envio de e-mail no projeto, então o administrador gera uma senha temporária e o usuário é obrigado a trocá-la no próximo acesso (o superadmin faz o mesmo para administradores de empresa). Pronto para trocar por e-mail quando houver infraestrutura.

### 3.6 Códigos de ativação

- 25 caracteres aleatórios de um alfabeto de 32 símbolos (125 bits, `crypto.randomInt`), exibidos **uma única vez** no formato `ATV-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX`; no banco ficam só o SHA-256 e o prefixo. Letras ambíguas digitadas (O, I, L) são aceitas como 0 e 1.
- Validade, revogação, limite de usos e registro de cada uso; expirado, revogado ou esgotado é recusado com mensagem específica.
- **NOVA_EMPRESA:** cria empresa (PENDING → ACTIVE), banco da empresa e o COMPANY_ADMIN numa única operação; se algo falhar, nada fica pela metade.
- **EMPRESA_EXISTENTE:** vinculado a uma empresa já cadastrada e, opcionalmente, ao e-mail do responsável; só cria o administrador dessa empresa. Não permite trocar de empresa nem assumir uma empresa com administrador já ativo, exceto se o código for explicitamente de "novo responsável".
- Validação e consumo com bloqueio de linha e limite de tentativas por IP.

### 3.7 Status da empresa

PENDING (cadastrada, aguardando ativação) → ACTIVE → SUSPENDED (manual) ou EXPIRED (`assinatura_ate` vencida) → ACTIVE (reativação). Suspender nunca apaga dados: só bloqueia o acesso comercial.

### 3.8 Auditoria

Registrada em `plataforma_auditoria`: login (sucesso/falha), logout, criação e alteração de usuários e cargos, ativações, mudanças de status de empresa, geração/revogação de códigos, produtos, entradas/ajustes de estoque, vendas, estornos, recebimentos de carnê, alteração de dados da empresa. Campos de senha, token e código são removidos antes de gravar.

---

## 4. Migração dos dados atuais (sem perda)

1. Criar o banco central e suas tabelas (migration da plataforma).
2. Registrar `Atrativa` como empresa nº 1, ACTIVE, plano padrão, dados copiados de `cad_empresa`.
3. Criar o usuário `ATRATIVA` na plataforma como COMPANY_ADMIN da empresa 1, ligado a `cad_login.id = 1`; senha: o hash já gravado em `api_credencial` ou, se não houver, conferência da senha legada no primeiro login (como hoje).
4. Criar o SUPER_ADMIN pelo comando de provisionamento.
5. Nenhuma tabela legada é alterada; `api_credencial` é preservada (deixa de ser usada depois da migração).

Rollback: apagar o banco central volta a API ao estado anterior; os bancos das empresas não dependem dele.

---

## 5. Etapas de implementação

| Etapa | Entrega | Teste |
|---|---|---|
| 3. Migração | Banco central, migrations da plataforma, script de migração dos dados atuais, modelo de banco de empresa | Migração em banco de teste; dados legados intactos (contagem por tabela) |
| 4. Autenticação | Login único, refresh, logout, papéis, guards, bloqueios | Unitários + e2e de login por papel e bloqueios |
| 5. Multi-tenancy | TenantContext, pool por empresa, todos os módulos comerciais usando a conexão da empresa | e2e com duas empresas: nenhum dado cruza |
| 6. Ativação | Geração, listagem, revogação, validação e consumo | e2e: código usado/expirado/revogado recusado; corrida de duas ativações |
| 7. Funcionários | CRUD, cargos, permissões, ativar/desativar, senha temporária | e2e: vendedor não acessa rotas de gerente; não eleva o próprio cargo |
| 8. Superadmin | Empresas, status, planos, códigos, admins da plataforma, auditoria, indicadores | e2e: admin de empresa recebe 403 em `/plataforma/*` |
| 9. Frontend | Área da plataforma, tela de ativação, funcionários, menu por permissão | Build, lint e navegação por papel |

## 6. Como colocar no ar

```bash
cd atrativa-shore-api/atrativa-api
npm run plataforma:migrar                 # banco central
npm run plataforma:superadmin             # SUPERADMIN_EMAIL e SUPERADMIN_SENHA no .env
npm run plataforma:importar -- Atrativa   # banco atual vira a empresa nº 1, usuário ATRATIVA vira administrador
npm run start:dev
```

Depois: entrar com o e-mail do superadministrador (vai para `/plataforma`), gerar um código de nova empresa e testar a ativação em `/ativar`.

Migrations futuras do banco das empresas: `npm run empresas:migrar` aplica em todas.

### 6.1 Backups

- Backup da empresa: depois de fechar o caixa (ou em Configurações › Cópias de segurança), quem tem `backup.gerar` gera um ZIP com o dump MySQL (`mysqldump`) do banco da empresa e os registros dela no banco central, sem senhas nem tokens. Detalhes do formato na seção "Backup dos dados" do README da API.
- Backup global: em Plataforma › Backups, o superadministrador gera o dump de todos os bancos com o `mysqldump` (ou o exportador interno, se ele não estiver instalado).
- Os dois tipos ficam em `plataforma_backups`, separados por `tipo`, e nunca aparecem um na lista do outro.
- Carregar backup: em Configurações › Carregar backup, quem tem `backup.restaurar` envia um ZIP do Atrativa Shore ou o dump `.sql` do sistema anterior. O sistema analisa, pede confirmação, gera um backup de segurança e substitui os dados da empresa. É também o caminho para migrar cada loja antiga para a nova plataforma: ative a empresa por código e carregue o dump dela. Os usuários antigos viram funcionários com senha temporária.
- Depois de atualizar, rode `npm run plataforma:migrar` para criar `plataforma_backups` e `plataforma_importacoes`.

## 7. Onde está cada parte no código

- Backups e importação: `src/backup/` (API: `leitor-sql.ts`, `importador.ts`, `importacoes.service.ts`) e `src/components/Backup.tsx`, `src/components/CarregarBackup.tsx`, `src/hooks/useGeracaoBackup.ts` (frontend).

| Parte | Backend | Frontend |
|---|---|---|
| Banco central | `src/plataforma/entities`, `src/plataforma/migrations` | — |
| Isolamento | `src/tenancy` (contexto, pool, provisionamento, modelo do banco) | — |
| Acesso | `src/acesso` (permissões, guard), `src/auth` (login, refresh, sessão) | `contexts/AuthContext.tsx`, `layouts/navegacao.ts`, `App.tsx` |
| Auditoria | `src/auditoria` | `components/ListaAuditoria.tsx`, `pages/Atividades` |
| Funcionários | `src/funcionarios` | `pages/Funcionarios` |
| Ativação | `src/ativacao` | `pages/Ativacao` |
| Superadministrador | `src/plataforma/admin` | `pages/Plataforma` |
| Comandos | `src/database/cli.ts` | — |

## 8. Limitações desta etapa

- Sem envio de e-mail: recuperação de senha é por senha temporária gerada pelo administrador (ou pelo superadministrador, para administradores de empresa).
- Planos limitam usuários ativos; não há cobrança automática.
- O caixa usa o mesmo terminal e turno (`PDV_TERMINAL`, `PDV_TURNO`) em todas as empresas; cada empresa tem o próprio caixa porque o banco é dela.
- Indicadores comerciais globais (faturamento somado de todas as empresas) não foram incluídos: exigiriam consultar o banco de cada empresa.
- O teste de isolamento com MySQL real (`E2E_SAAS=true npm run test:e2e`) precisa ser rodado na sua máquina; aqui ele foi escrito e compila, e os testes de isolamento do contexto rodaram com sucesso.
