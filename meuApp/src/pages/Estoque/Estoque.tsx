import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IoAdd, IoDownloadOutline, IoPrintOutline, IoRemoveCircleOutline, IoTrashOutline } from 'react-icons/io5';
import { SeletorBusca } from '../../components/SeletorBusca';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Estados';
import { Input, Select } from '../../components/ui/Field';
import { FiltroPeriodo, type Periodo } from '../../components/ui/FiltroPeriodo';
import { periodoDoMes } from '../../utils/periodo';
import { Abas, CampoBusca, PageHeader, Painel } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAcao, useAtrasado, useRequisicao } from '../../hooks/useRequisicao';
import { usePagina } from '../../hooks/useEstadoReiniciado';
import { mensagemErro } from '../../services/api';
import { estoqueService, fornecedorService, produtoService } from '../../services/servicos';
import type { MotivoAjuste, Movimentacao, Produto, ResultadoEntrada, TipoMovimentacao } from '../../types/api';
import { exportarCsv, imprimir } from '../../utils/exportar';
import { formatarData, formatarMoeda, formatarNumero, hojeIso, lerNumero, numeroParaCampo, somarReais } from '../../utils/formatar';
import { BadgeMovimentacao } from '../../components/BadgeMovimentacao';
import { MOTIVOS_AJUSTE, ROTULOS_MOVIMENTACAO } from '../compartilhado';
import { BadgeEstoque, OpcaoProduto } from '../../components/Produto';

type Aba = 'saldo' | 'movimentacoes';
type FiltroSaldo = 'todos' | 'disponiveis' | 'baixo';

export default function Estoque() {
  const { usuario } = useAuth();
  const [parametros] = useSearchParams();
  const [aba, setAba] = useState<Aba>('saldo');
  const [entradaAberta, setEntradaAberta] = useState(false);
  const [produtoInicial, setProdutoInicial] = useState<Produto | null>(null);
  const [ajuste, setAjuste] = useState<Produto | 'novo' | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    const id = Number(parametros.get('produto'));
    if (!id) return;
    produtoService
      .obter(id)
      .then((produto) => {
        setProdutoInicial(produto);
        setEntradaAberta(true);
      })
      .catch(() => undefined);
  }, [parametros]);

  const atualizar = () => setVersao((v) => v + 1);

  return (
    <>
      <PageHeader
        titulo="Estoque"
        descricao="Saldo atual, entradas por nota, ajustes e histórico de movimentações."
        acoes={
          <>
            {usuario?.administrador ? (
              <Button variante="secundario" icone={<IoRemoveCircleOutline />} onClick={() => setAjuste('novo')}>
                Saída ou ajuste
              </Button>
            ) : null}
            <Button icone={<IoAdd />} onClick={() => setEntradaAberta(true)}>
              Lançar entrada
            </Button>
          </>
        }
      />
      <Abas
        rotulo="Visão do estoque"
        ativa={aba}
        aoMudar={setAba}
        abas={[
          { id: 'saldo', titulo: 'Saldo atual' },
          { id: 'movimentacoes', titulo: 'Movimentações' },
        ]}
      />
      {aba === 'saldo' ? (
        <AbaSaldo
          filtroInicial={parametros.get('filtro') === 'baixo' ? 'baixo' : 'todos'}
          versao={versao}
          aoAjustar={usuario?.administrador ? (produto) => setAjuste(produto) : undefined}
        />
      ) : (
        <AbaMovimentacoes versao={versao} />
      )}

      {entradaAberta ? (
        <ModalEntrada
          produtoInicial={produtoInicial}
          aoFechar={() => {
            setEntradaAberta(false);
            setProdutoInicial(null);
          }}
          aoSalvar={atualizar}
        />
      ) : null}
      {ajuste ? (
        <ModalAjuste
          produto={ajuste === 'novo' ? null : ajuste}
          aoFechar={() => setAjuste(null)}
          aoSalvar={() => {
            setAjuste(null);
            atualizar();
          }}
        />
      ) : null}
    </>
  );
}

function AbaSaldo({
  filtroInicial,
  versao,
  aoAjustar,
}: {
  filtroInicial: FiltroSaldo;
  versao: number;
  aoAjustar?: (produto: Produto) => void;
}) {
  const [filtro, setFiltro] = useState<FiltroSaldo>(filtroInicial);
  const [busca, setBusca] = useState('');
  const buscaAtrasada = useAtrasado(busca);
  const [pagina, setPagina] = usePagina([filtro, buscaAtrasada]);

  const lista = useRequisicao(
    () =>
      filtro === 'baixo'
        ? produtoService.estoqueBaixo({ page: pagina, limit: 20 })
        : produtoService.listar({
            busca: buscaAtrasada.trim() || undefined,
            somenteDisponiveis: filtro === 'disponiveis' || undefined,
            page: pagina,
            limit: 20,
          }),
    [filtro, buscaAtrasada, pagina, versao],
  );

  return (
    <Painel semEspaco>
      <div className="barra-ferramentas">
        {filtro !== 'baixo' ? <CampoBusca valor={busca} aoMudar={setBusca} rotulo="Buscar produto" /> : null}
        <div className="segmentado" role="group" aria-label="Disponibilidade">
          {(
            [
              ['todos', 'Todos'],
              ['disponiveis', 'Com saldo'],
              ['baixo', 'Repor estoque'],
            ] as const
          ).map(([id, titulo]) => (
            <button
              key={id}
              type="button"
              className={filtro === id ? 'segmento segmento-ativo' : 'segmento'}
              aria-pressed={filtro === id}
              onClick={() => setFiltro(id)}
            >
              {titulo}
            </button>
          ))}
        </div>
      </div>
      {filtro === 'baixo' ? (
        <p className="pequeno muted painel-nota">
          Produtos com saldo no estoque mínimo ou abaixo. Para os que não têm mínimo cadastrado, vale o limite configurado na API.
        </p>
      ) : null}
      <DataTable<Produto>
        rotulo="Saldo de estoque"
        carregando={lista.carregando}
        erro={lista.erro}
        aoTentarNovamente={lista.recarregar}
        linhas={lista.dados?.data}
        chaveLinha={(p) => p.id}
        vazio={{ titulo: filtro === 'baixo' ? 'Nenhum produto precisando de reposição' : 'Nenhum produto encontrado' }}
        colunas={[
          {
            chave: 'nome',
            titulo: 'Produto',
            render: (p) => (
              <div className="celula-principal">
                <strong>{p.nome}</strong>
                <span className="num">{p.codigoBarras ?? `#${p.id}`}</span>
              </div>
            ),
          },
          { chave: 'fornecedor', titulo: 'Fornecedor', ocultarNoCelular: true, render: (p) => p.fornecedor?.nome ?? '—' },
          { chave: 'minimo', titulo: 'Mínimo', alinhar: 'direita', ocultarNoCelular: true, render: (p) => (p.estoqueMinimo ? formatarNumero(p.estoqueMinimo) : '—') },
          { chave: 'custo', titulo: 'Custo', alinhar: 'direita', ocultarNoCelular: true, render: (p) => formatarMoeda(p.valorCompra) },
          { chave: 'saldo', titulo: 'Saldo', alinhar: 'direita', render: (p) => <BadgeEstoque produto={p} /> },
          ...(aoAjustar
            ? [
                {
                  chave: 'acoes',
                  titulo: 'Ações',
                  alinhar: 'direita' as const,
                  render: (p: Produto) => (
                    <Button variante="fantasma" tamanho="sm" onClick={() => aoAjustar(p)}>
                      Ajustar
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />
      <Pagination meta={lista.dados?.meta} aoMudar={setPagina} />
    </Painel>
  );
}

function AbaMovimentacoes({ versao }: { versao: number }) {
  const [periodo, setPeriodo] = useState<Periodo>(periodoDoMes);
  const [tipo, setTipo] = useState<TipoMovimentacao | ''>('');
  const [produto, setProduto] = useState<Produto | null>(null);
  const [pagina, setPagina] = usePagina([periodo, tipo, produto?.id]);

  const filtro = { ...periodo, tipo: tipo || undefined, idProduto: produto?.id };
  const lista = useRequisicao(
    () => estoqueService.movimentacoes({ ...filtro, page: pagina, limit: 25 }),
    [periodo.inicio, periodo.fim, tipo, produto?.id, pagina, versao],
  );

  const exportar = async () => {
    const todos = await estoqueService.movimentacoes({ ...filtro, page: 1, limit: 100 });
    exportarCsv(
      `movimentacoes-${periodo.inicio}-a-${periodo.fim}`,
      [
        { titulo: 'Data', valor: (m: Movimentacao) => formatarData(m.data) },
        { titulo: 'Tipo', valor: (m) => ROTULOS_MOVIMENTACAO[m.tipo] },
        { titulo: 'Produto', valor: (m) => m.produto },
        { titulo: 'Quantidade', valor: (m) => m.quantidade },
        { titulo: 'Valor unitário', valor: (m) => m.valorUnitario },
        { titulo: 'Documento', valor: (m) => m.documento },
      ],
      todos.data,
    );
  };

  return (
    <div className="pilha">
      <FiltroPeriodo periodo={periodo} aoMudar={setPeriodo} />
      <Painel semEspaco>
        <div className="barra-ferramentas">
          {produto ? (
            <span className="filtro-ativo">
              {produto.nome}
              <button type="button" className="btn btn-fantasma btn-sm" onClick={() => setProduto(null)}>
                Limpar
              </button>
            </span>
          ) : (
            <SeletorBusca<Produto>
              rotulo="Filtrar por produto"
              buscar={async (termo) => (await produtoService.listar({ busca: termo, limit: 8 })).data}
              chave={(p) => p.id}
              renderizar={(p) => <OpcaoProduto produto={p} />}
              aoSelecionar={setProduto}
            />
          )}
          <label className="sr-only" htmlFor="filtro-tipo">
            Tipo de movimentação
          </label>
          <select id="filtro-tipo" className="entrada" value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimentacao | '')}>
            <option value="">Todos os tipos</option>
            {Object.entries(ROTULOS_MOVIMENTACAO).map(([id, rotulo]) => (
              <option key={id} value={id}>
                {rotulo}
              </option>
            ))}
          </select>
          <Button variante="secundario" tamanho="sm" icone={<IoDownloadOutline />} onClick={exportar} disabled={!lista.dados?.data.length}>
            Exportar CSV
          </Button>
        </div>
        <DataTable<Movimentacao>
          rotulo="Movimentações de estoque"
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarNovamente={lista.recarregar}
          linhas={lista.dados?.data}
          chaveLinha={(m) => `${m.origem}-${m.id}`}
          vazio={{ titulo: 'Nenhuma movimentação no período' }}
          colunas={[
            { chave: 'data', titulo: 'Data', render: (m) => <span className="num">{formatarData(m.data)}</span> },
            { chave: 'tipo', titulo: 'Tipo', render: (m) => <BadgeMovimentacao tipo={m.tipo} /> },
            { chave: 'produto', titulo: 'Produto', render: (m) => m.produto },
            {
              chave: 'qtd',
              titulo: 'Quantidade',
              alinhar: 'direita',
              render: (m) => (
                <span className={m.quantidade < 0 ? 'nota-negativo' : 'nota-positivo'}>
                  {m.quantidade > 0 ? '+' : ''}
                  {formatarNumero(m.quantidade)}
                </span>
              ),
            },
            { chave: 'valor', titulo: 'Valor unit.', alinhar: 'direita', ocultarNoCelular: true, render: (m) => formatarMoeda(m.valorUnitario) },
            { chave: 'doc', titulo: 'Documento', ocultarNoCelular: true, render: (m) => <span className="num muted">{m.documento ?? '—'}</span> },
          ]}
        />
        <Pagination meta={lista.dados?.meta} aoMudar={setPagina} />
      </Painel>
    </div>
  );
}

interface ItemNota {
  produto: Produto;
  quantidade: string;
  valorCompra: string;
}

function ModalEntrada({
  produtoInicial,
  aoFechar,
  aoSalvar,
}: {
  produtoInicial: Produto | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const { notificar } = useFeedback();
  const fornecedores = useRequisicao(() => fornecedorService.listar({ limit: 100 }), []);
  const [itens, setItens] = useState<ItemNota[]>(() =>
    produtoInicial ? [{ produto: produtoInicial, quantidade: '', valorCompra: numeroParaCampo(produtoInicial.valorCompra) }] : [],
  );
  const [numeroNota, setNumeroNota] = useState('');
  const [idFornecedor, setIdFornecedor] = useState('');
  const [dataLancamento, setDataLancamento] = useState(hojeIso());
  const [vencimento, setVencimento] = useState('');
  const [falha, setFalha] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoEntrada | null>(null);

  const adicionar = (produto: Produto) => {
    if (!produto.controlaEstoque) {
      notificar(`${produto.nome} não controla estoque.`, 'erro');
      return;
    }
    setItens((lista) =>
      lista.some((item) => item.produto.id === produto.id)
        ? lista
        : [...lista, { produto, quantidade: '', valorCompra: numeroParaCampo(produto.valorCompra) }],
    );
  };

  const atualizarItem = (id: number, campo: 'quantidade' | 'valorCompra', valor: string) =>
    setItens((lista) => lista.map((item) => (item.produto.id === id ? { ...item, [campo]: valor } : item)));

  const totalPrevisto = somarReais(
    itens.map((item) => (lerNumero(item.quantidade) ?? 0) * (lerNumero(item.valorCompra) ?? item.produto.valorCompra ?? 0)),
  );

  const salvar = useAcao(async () => {
    setFalha(null);
    try {
      const resposta = await estoqueService.registrarEntrada({
        numeroNota: numeroNota.trim() || undefined,
        idFornecedor: idFornecedor ? Number(idFornecedor) : undefined,
        dataLancamento,
        vencimento: vencimento || undefined,
        itens: itens.map((item) => ({
          idProduto: item.produto.id,
          quantidade: lerNumero(item.quantidade) ?? 0,
          valorCompra: item.valorCompra.trim() ? (lerNumero(item.valorCompra) ?? undefined) : undefined,
        })),
      });
      setResultado(resposta);
      notificar(`Nota ${resposta.numeroNota} lançada no estoque.`);
      aoSalvar();
    } catch (erro) {
      setFalha(mensagemErro(erro));
    }
  });

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (itens.length === 0) return setFalha('Adicione pelo menos um produto.');
    const invalido = itens.find((item) => !((lerNumero(item.quantidade) ?? 0) > 0));
    if (invalido) return setFalha(`Informe a quantidade de ${invalido.produto.nome}.`);
    void salvar.executar();
  };

  if (resultado) {
    return (
      <Modal
        aberto
        titulo={`Nota ${resultado.numeroNota} lançada`}
        descricao={`${formatarData(resultado.dataLancamento)} · conta a pagar de ${formatarMoeda(resultado.valorTotal)} registrada`}
        aoFechar={aoFechar}
        tamanho="lg"
        rodape={
          <>
            <Button variante="secundario" icone={<IoPrintOutline />} onClick={imprimir}>
              Imprimir
            </Button>
            <Button onClick={aoFechar}>Concluir</Button>
          </>
        }
      >
        <div className="area-impressao">
          <DataTable
            rotulo="Itens lançados"
            linhas={resultado.itens}
            chaveLinha={(i) => i.idProduto}
            colunas={[
              { chave: 'produto', titulo: 'Produto', render: (i) => i.produto },
              { chave: 'qtd', titulo: 'Quantidade', alinhar: 'direita', render: (i) => formatarNumero(i.quantidade) },
              { chave: 'custo', titulo: 'Custo', alinhar: 'direita', render: (i) => formatarMoeda(i.valorCompra) },
              { chave: 'saldo', titulo: 'Saldo agora', alinhar: 'direita', render: (i) => formatarNumero(i.saldoAtual) },
            ]}
          />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      aberto
      titulo="Lançar entrada de mercadorias"
      descricao="Soma ao saldo e registra a conta a pagar da nota, como o sistema da loja."
      aoFechar={aoFechar}
      tamanho="lg"
      rodape={
        <>
          <span className="pequeno muted rodape-esquerda num">Total da nota: {formatarMoeda(totalPrevisto)}</span>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-entrada" carregando={salvar.executando} disabled={itens.length === 0}>
            Lançar entrada
          </Button>
        </>
      }
    >
      <form id="form-entrada" className="pilha" onSubmit={enviar} noValidate>
        {falha ? (
          <p className="aviso-faixa erro" role="alert">
            {falha}
          </p>
        ) : null}
        <div className="form-grade">
          <Input className="col-2" rotulo="Nº da nota" maxLength={15} placeholder="Automático" value={numeroNota} onChange={(e) => setNumeroNota(e.target.value)} />
          <Select className="col-2" rotulo="Fornecedor" value={idFornecedor} onChange={(e) => setIdFornecedor(e.target.value)}>
            <option value="">Do cadastro de cada produto</option>
            {fornecedores.dados?.data.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
          <Input className="col-1" rotulo="Data" type="date" max={hojeIso()} value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} />
          <Input className="col-1" rotulo="Vencimento" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        </div>
        <SeletorBusca<Produto>
          rotulo="Adicionar produto à nota"
          rotuloVisivel
          placeholder="Nome ou código de barras"
          buscar={async (termo) => (await produtoService.listar({ busca: termo, limit: 8 })).data}
          buscarExato={(codigo) => produtoService.porCodigo(codigo).catch(() => null)}
          chave={(p) => p.id}
          renderizar={(p) => <OpcaoProduto produto={p} />}
          aoSelecionar={adicionar}
          autoFocus={!produtoInicial}
        />
        <DataTable<ItemNota>
          rotulo="Itens da nota"
          linhas={itens}
          chaveLinha={(i) => i.produto.id}
          vazio={{ titulo: 'Nenhum produto na nota', descricao: 'Busque pelo nome ou passe o leitor de código de barras.' }}
          colunas={[
            {
              chave: 'produto',
              titulo: 'Produto',
              render: (i) => (
                <div className="celula-principal">
                  <strong>{i.produto.nome}</strong>
                  <span className="num">Saldo atual {formatarNumero(i.produto.quantidadeEstoque ?? 0)}</span>
                </div>
              ),
            },
            {
              chave: 'qtd',
              titulo: 'Quantidade',
              largura: '120px',
              render: (i) => (
                <input
                  className="entrada entrada-tabela"
                  inputMode="decimal"
                  aria-label={`Quantidade de ${i.produto.nome}`}
                  value={i.quantidade}
                  onChange={(e) => atualizarItem(i.produto.id, 'quantidade', e.target.value)}
                />
              ),
            },
            {
              chave: 'custo',
              titulo: 'Custo unitário',
              largura: '140px',
              render: (i) => (
                <input
                  className="entrada entrada-tabela"
                  inputMode="decimal"
                  aria-label={`Custo unitário de ${i.produto.nome}`}
                  value={i.valorCompra}
                  onChange={(e) => atualizarItem(i.produto.id, 'valorCompra', e.target.value)}
                />
              ),
            },
            {
              chave: 'remover',
              titulo: '',
              alinhar: 'direita',
              render: (i) => (
                <Button
                  variante="fantasma"
                  tamanho="sm"
                  somenteIcone
                  icone={<IoTrashOutline />}
                  onClick={() => setItens((lista) => lista.filter((item) => item.produto.id !== i.produto.id))}
                >
                  Remover
                </Button>
              ),
            },
          ]}
        />
        <p className="pequeno muted">O custo informado atualiza o valor de compra no cadastro do produto.</p>
      </form>
    </Modal>
  );
}

function ModalAjuste({ produto, aoFechar, aoSalvar }: { produto: Produto | null; aoFechar: () => void; aoSalvar: () => void }) {
  const { notificar } = useFeedback();
  const [selecionado, setSelecionado] = useState<Produto | null>(produto);
  const [sentido, setSentido] = useState<'saida' | 'entrada'>('saida');
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState<MotivoAjuste>('PERDA');
  const [falha, setFalha] = useState<string | null>(null);

  const salvar = useAcao(async () => {
    const valor = lerNumero(quantidade) ?? 0;
    try {
      const atualizado = await estoqueService.registrarAjuste({
        idProduto: selecionado!.id,
        quantidade: sentido === 'saida' ? -valor : valor,
        motivo,
      });
      notificar(`Ajuste registrado. Saldo de ${atualizado.nome}: ${formatarNumero(atualizado.quantidadeEstoque)}.`);
      aoSalvar();
    } catch (erro) {
      setFalha(mensagemErro(erro));
    }
  });

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    setFalha(null);
    if (!selecionado) return setFalha('Escolha o produto.');
    if (!((lerNumero(quantidade) ?? 0) > 0)) return setFalha('Informe uma quantidade maior que zero.');
    void salvar.executar();
  };

  return (
    <Modal
      aberto
      titulo="Saída ou ajuste de estoque"
      descricao="Fica registrado no histórico com o motivo. Use para perdas, avarias e correção de contagem."
      aoFechar={aoFechar}
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-ajuste" variante={sentido === 'saida' ? 'perigo' : 'primario'} carregando={salvar.executando}>
            {sentido === 'saida' ? 'Registrar saída' : 'Registrar entrada'}
          </Button>
        </>
      }
    >
      <form id="form-ajuste" className="pilha" onSubmit={enviar} noValidate>
        {falha ? (
          <p className="aviso-faixa erro" role="alert">
            {falha}
          </p>
        ) : null}
        {selecionado ? (
          <div className="produto-escolhido">
            <div className="celula-principal">
              <strong>{selecionado.nome}</strong>
              <span>Saldo atual: {formatarNumero(selecionado.quantidadeEstoque ?? 0)}</span>
            </div>
            {!produto ? (
              <Button variante="fantasma" tamanho="sm" onClick={() => setSelecionado(null)}>
                Trocar
              </Button>
            ) : null}
          </div>
        ) : (
          <SeletorBusca<Produto>
            rotulo="Produto"
            rotuloVisivel
            buscar={async (termo) => (await produtoService.listar({ busca: termo, limit: 8 })).data}
            buscarExato={(codigo) => produtoService.porCodigo(codigo).catch(() => null)}
            chave={(p) => p.id}
            renderizar={(p) => <OpcaoProduto produto={p} />}
            aoSelecionar={setSelecionado}
            autoFocus
          />
        )}
        <div className="segmentado" role="group" aria-label="Tipo de ajuste">
          <button type="button" className={sentido === 'saida' ? 'segmento segmento-ativo' : 'segmento'} aria-pressed={sentido === 'saida'} onClick={() => setSentido('saida')}>
            Saída (−)
          </button>
          <button type="button" className={sentido === 'entrada' ? 'segmento segmento-ativo' : 'segmento'} aria-pressed={sentido === 'entrada'} onClick={() => setSentido('entrada')}>
            Entrada (+)
          </button>
        </div>
        <div className="form-grade">
          <Input className="col-2" rotulo="Quantidade" inputMode="decimal" obrigatorio value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          <Select className="col-4" rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoAjuste)}>
            {MOTIVOS_AJUSTE.map((m) => (
              <option key={m.id} value={m.id}>
                {m.rotulo}
              </option>
            ))}
          </Select>
        </div>
        {selecionado && sentido === 'saida' && (lerNumero(quantidade) ?? 0) > (selecionado.quantidadeEstoque ?? 0) ? (
          <Badge tom="perigo">A saída é maior que o saldo; a API vai recusar.</Badge>
        ) : null}
      </form>
    </Modal>
  );
}
