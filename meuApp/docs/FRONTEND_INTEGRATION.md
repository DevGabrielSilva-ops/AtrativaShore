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

A API precisa liberar a origem do frontend em `CORS_ORIGINS` (ex.: `http://localhost:5173`). Com frontend e API em domínios diferentes, use HTTPS, `COOKIE_SECURE=true` e `COOKIE_SAMESITE=none`.

## Autenticação e áreas

1. `POST /auth/login` com `{ login, senha, lembrar }`; o login aceita e-mail ou usuário.
2. O access token (15 min) fica só em memória. O refresh token vem num cookie httpOnly; ao abrir o app e quando o token vence, `POST /auth/refresh` renova a sessão sem pedir senha. As chamadas usam `credentials: "include"`.
3. `POST /auth/logout` encerra a sessão no servidor.
4. O papel decide a área: SUPER_ADMIN vai para `/plataforma`; os demais para a área da empresa. Usuário com senha temporária vai para `/trocar-senha`.
5. O menu e os botões seguem as permissões do usuário (`usuario.permissoes`); o backend confere de novo em toda rota.
6. Empresa nova entra por `/ativar` com o código de ativação.

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
| Meu perfil | `GET /auth/me`, `GET /funcionarios/catalogo` |
| Configurações | `PATCH /auth/senha`, `GET /empresa/estado-banco` |
| Ativação | `POST /ativacao/validar`, `POST /ativacao/concluir` |
| Funcionários | `GET/POST /funcionarios`, `PATCH /funcionarios/:id`, `POST /funcionarios/:id/status`, `POST /funcionarios/:id/senha-temporaria`, `GET /funcionarios/:id/atividades`, `GET/POST/PATCH/DELETE /cargos` |
| Atividades | `GET /auditoria` |
| Plataforma | `GET /plataforma/indicadores`, `/plataforma/empresas`, `/plataforma/codigos`, `/plataforma/planos`, `/plataforma/administradores`, `/plataforma/auditoria` e as ações de status, código e senha temporária |

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

## Backup após o fechamento de caixa

- O modal de fechamento mostra "Caixa fechado com sucesso!" com o resumo de sempre. Para quem tem `backup.gerar`, aparece a cópia de segurança com **Gerar backup** e **Fazer isso depois**; o fechamento já está gravado antes disso.
- Durante a geração a barra mostra `progresso` (consulta `GET /backups/:id` a cada segundo). O usuário pode fechar o modal e continuar usando o sistema; o backup termina no servidor e fica no histórico.
- **Baixar backup** chama `GET /backups/:id/download` com o token, recebe o ZIP como blob e o navegador salva com o nome enviado pelo servidor (`backupService.baixar`, `baixarArquivo` em `services/api.ts`). Erros (expirado, sem permissão) aparecem na própria tela.
- Histórico: Configurações › Cópias de segurança (atalho no cabeçalho do Caixa), com arquivo, data, responsável, tamanho, status e download enquanto disponível.
- Superadministrador: Plataforma › Backups, para o backup completo de todas as empresas.

## Carregar backup

- Em Configurações › Carregar backup (permissão `backup.restaurar`): escolher ou arrastar o `.zip`/`.sql` → **Enviar e analisar** (envio com progresso via `XMLHttpRequest`, `enviarArquivo` em `services/api.ts`) → análise com tabelas, registros, avisos e usuários a criar → digitar `SUBSTITUIR` → **Substituir dados** → progresso → resultado.
- As senhas temporárias dos funcionários criados aparecem uma única vez (**Ver senhas temporárias**, `GET /importacoes/:id/senhas`).
- No histórico de cópias, **Restaurar** prepara a restauração de um backup já gerado (`POST /backups/:id/restaurar`). Se a restauração falhar, a tela oferece **Restaurar backup de segurança**.
- Ao reabrir a tela, a importação em andamento (ou pronta para confirmar) é retomada.
