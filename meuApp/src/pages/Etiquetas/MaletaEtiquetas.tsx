import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { IoAdd, IoChevronBack, IoChevronForward, IoPrintOutline, IoTrashOutline } from 'react-icons/io5';
import { FolhaEtiquetas } from '../../components/EtiquetaProduto';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Badge, EstadoErro } from '../../components/ui/Estados';
import { Input, Select } from '../../components/ui/Field';
import { CampoBusca, PageHeader, Painel } from '../../components/ui/Layout';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Spinner';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { usePagina } from '../../hooks/useEstadoReiniciado';
import { useAtrasado, useRequisicao } from '../../hooks/useRequisicao';
import { mensagemErro } from '../../services/api';
import { etiquetaService, produtoService } from '../../services/servicos';
import type { ConteudoCampoEtiqueta, ModeloEtiqueta, Produto, ProdutoEtiqueta } from '../../types/api';
import {
  gravarMaleta,
  LIMITE_ETIQUETAS,
  lerMaleta,
  montarFolhas,
  opcionaisDoModelo,
  opcionaisPadrao,
  QUANTIDADE_MAXIMA,
  temCodigo,
  type ItemMaleta,
} from '../../utils/etiquetas';
import { imprimirEtiquetas } from '../../utils/exportar';
import { formatarInteiro, formatarNumero } from '../../utils/formatar';

const PX_POR_CM = 96 / 2.54;

const ROTULOS_OPCIONAIS: Record<ConteudoCampoEtiqueta, string> = {
  produto: 'Nome do produto',
  codigoBarras: 'Código de barras',
  precoVarejo: 'Valor de varejo',
  precoAtacado: 'Valor de atacado',
  empresa: 'Nome da empresa',
  informacoes: 'Informações adicionais',
  fornecedor: 'Fornecedor',
  tipo: 'Tipo do produto',
};

function nomeDoModelo(modelo: ModeloEtiqueta): string {
  const texto = modelo.nome.toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function nomeDoPapel(modelo: ModeloEtiqueta): string {
  const { largura, altura } = modelo.pagina;
  const perto = (a: number, b: number) => Math.abs(a - b) < 0.05;
  if (perto(largura, 21) && perto(altura, 29.7)) return 'A4';
  if (perto(largura, 21.59) && perto(altura, 27.94)) return 'Carta';
  return `${formatarNumero(largura)} × ${formatarNumero(altura)} cm`;
}

function paraEtiqueta(produto: Produto): ProdutoEtiqueta {
  return {
    id: produto.id,
    nome: produto.nome,
    codigoBarras: produto.codigoBarras?.trim() || null,
    informacoes: produto.informacoesAdicionais?.trim() || null,
    tipo: produto.tipo?.nome ?? null,
    fornecedor: produto.fornecedor?.nome ?? null,
  };
}

function PreviaEscalada({ modelo, children }: { modelo: ModeloEtiqueta; children: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  useLayoutEffect(() => {
    const elemento = caixa.current;
    if (!elemento) return undefined;
    const observador = new ResizeObserver(([entrada]) => setLargura(entrada.contentRect.width));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  const larguraPx = modelo.pagina.largura * PX_POR_CM;
  const escala = largura ? Math.min(1, largura / larguraPx) : 0.5;
  return (
    <div ref={caixa} className="etiquetas-previa">
      <div style={{ height: modelo.pagina.altura * PX_POR_CM * escala }}>
        <div className="etiquetas-previa-escala" style={{ transform: `scale(${escala})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function MaletaEtiquetas() {
  const { usuario } = useAuth();
  const { notificar, confirmar } = useFeedback();
  const chave = `maleta-etiquetas:${usuario?.idEmpresa ?? 0}:${usuario?.id ?? 0}`;
  const [itens, setItens] = useState<ItemMaleta[]>(() => lerMaleta(chave));
  const [produtos, setProdutos] = useState<Map<number, ProdutoEtiqueta>>(() => new Map());
  const [idsIniciais] = useState(() => lerMaleta(chave).map((item) => item.id));
  const [carga, setCarga] = useState<{ carregando: boolean; erro: string | null; tentativa: number }>(() => ({
    carregando: idsIniciais.length > 0,
    erro: null,
    tentativa: 0,
  }));

  useEffect(() => gravarMaleta(chave, itens), [chave, itens]);

  useEffect(() => {
    if (!idsIniciais.length) return undefined;
    let atual = true;
    etiquetaService
      .produtos(idsIniciais)
      .then((resposta) => {
        if (!atual) return;
        setProdutos((anterior) => {
          const novo = new Map(anterior);
          for (const produto of resposta.produtos) novo.set(produto.id, produto);
          return novo;
        });
        if (resposta.naoEncontrados.length) {
          const removidos = new Set(resposta.naoEncontrados);
          setItens((anterior) => anterior.filter((item) => !removidos.has(item.id)));
          notificar(`${resposta.naoEncontrados.length} produto(s) não existem mais no cadastro e saíram da maleta.`, 'info');
        }
        setCarga((anterior) => ({ ...anterior, carregando: false, erro: null }));
      })
      .catch((falha: unknown) => {
        if (atual) setCarga((anterior) => ({ ...anterior, carregando: false, erro: mensagemErro(falha) }));
      });
    return () => {
      atual = false;
    };
  }, [idsIniciais, carga.tentativa, notificar]);

  const recarregarMaleta = () => setCarga((anterior) => ({ carregando: true, erro: null, tentativa: anterior.tentativa + 1 }));

  const [busca, setBusca] = useState('');
  const buscaAtrasada = useAtrasado(busca);
  const [pagina, setPagina] = usePagina([buscaAtrasada]);
  const lista = useRequisicao(
    () => produtoService.listar({ busca: buscaAtrasada.trim() || undefined, page: pagina, limit: 10 }),
    [buscaAtrasada, pagina],
  );

  const modelos = useRequisicao(() => etiquetaService.modelos(), []);
  const [idModelo, setIdModelo] = useState<number | null>(null);
  const modelo = modelos.dados?.modelos.find((m) => m.id === idModelo) ?? modelos.dados?.modelos[0] ?? null;
  const [escolhaOpcionais, setEscolhaOpcionais] = useState<Record<number, ConteudoCampoEtiqueta[]>>({});
  const opcionais = modelo ? (escolhaOpcionais[modelo.id] ?? opcionaisPadrao(modelo)) : [];
  const [inicioTexto, setInicioTexto] = useState('1');
  const inicio = modelo ? Math.min(Math.max(1, Math.trunc(Number(inicioTexto)) || 1), modelo.porFolha) : 1;
  const [folhaVista, setFolhaVista] = useState(0);

  const quantidades = useMemo(() => new Map(itens.map((item) => [item.id, item.quantidade])), [itens]);
  const semCodigo = itens.filter((item) => produtos.has(item.id) && !temCodigo(produtos.get(item.id)));
  const totalPedido = itens.reduce((soma, item) => (temCodigo(produtos.get(item.id)) ? soma + item.quantidade : soma), 0);
  const folhas = useMemo(
    () => (modelo ? montarFolhas(itens, produtos, modelo.porFolha, inicio) : []),
    [itens, produtos, modelo, inicio],
  );
  const totalImpresso = Math.min(totalPedido, LIMITE_ETIQUETAS);
  const folhaAtual = Math.min(folhaVista, Math.max(0, folhas.length - 1));

  const adicionar = (lote: Produto[]) => {
    const validos = lote.filter((produto) => temCodigo(produto));
    if (!validos.length) return;
    setProdutos((anterior) => {
      const novo = new Map(anterior);
      for (const produto of validos) novo.set(produto.id, paraEtiqueta(produto));
      return novo;
    });
    setItens((anterior) => {
      const novo = [...anterior];
      for (const produto of validos) {
        const indice = novo.findIndex((item) => item.id === produto.id);
        if (indice >= 0) novo[indice] = { ...novo[indice], quantidade: Math.min(novo[indice].quantidade + 1, QUANTIDADE_MAXIMA) };
        else novo.push({ id: produto.id, quantidade: 1 });
      }
      return novo;
    });
    if (lote.length > 1) {
      const ignorados = lote.length - validos.length;
      notificar(
        `${validos.length} produto(s) na maleta.${ignorados ? ` ${ignorados} sem código de barras ficaram de fora.` : ''}`,
      );
    }
  };

  const mudarQuantidade = (id: number, texto: string) => {
    const valor = Math.trunc(Number(texto));
    if (!Number.isFinite(valor)) return;
    setItens((anterior) =>
      anterior.map((item) => (item.id === id ? { ...item, quantidade: Math.min(Math.max(valor, 1), QUANTIDADE_MAXIMA) } : item)),
    );
  };

  const remover = (id: number) => setItens((anterior) => anterior.filter((item) => item.id !== id));

  const esvaziar = async () => {
    const sim = await confirmar({
      titulo: 'Esvaziar a maleta?',
      mensagem: `Os ${itens.length} produtos selecionados saem da maleta. Nenhum cadastro é alterado.`,
      confirmar: 'Esvaziar',
      perigo: true,
    });
    if (sim) setItens([]);
  };

  const alternarOpcional = (conteudo: ConteudoCampoEtiqueta, ligado: boolean) => {
    if (!modelo) return;
    const atuais = new Set(opcionais);
    if (ligado) atuais.add(conteudo);
    else atuais.delete(conteudo);
    setEscolhaOpcionais((anterior) => ({ ...anterior, [modelo.id]: [...atuais] }));
  };

  const imprimir = () => {
    if (!folhas.length) return;
    imprimirEtiquetas();
  };

  const empresa = modelos.dados?.empresa ?? usuario?.empresa?.nome ?? null;
  const paginaComCodigo = lista.dados?.data.filter((p) => temCodigo(p)) ?? [];

  return (
    <>
      <PageHeader
        titulo="Maleta de etiquetas"
        descricao="Escolha os produtos e quantas etiquetas de cada. O código de barras impresso é o que já está no cadastro."
        acoes={
          <Button icone={<IoPrintOutline />} onClick={imprimir} disabled={!folhas.length}>
            Imprimir etiquetas
          </Button>
        }
      />

      <div className="maleta-grade">
        <Painel
          titulo="Produtos"
          descricao="Busque por nome, código de barras ou id."
          semEspaco
          acoes={
            <Button variante="secundario" tamanho="sm" icone={<IoAdd />} disabled={!paginaComCodigo.length} onClick={() => adicionar(lista.dados?.data ?? [])}>
              Adicionar página
            </Button>
          }
        >
          <div className="barra-ferramentas">
            <CampoBusca valor={busca} aoMudar={setBusca} rotulo="Buscar produto" />
          </div>
          <DataTable<Produto>
            rotulo="Produtos para etiquetar"
            carregando={lista.carregando}
            erro={lista.erro}
            aoTentarNovamente={lista.recarregar}
            linhas={lista.dados?.data}
            chaveLinha={(p) => p.id}
            linhasCarregando={5}
            vazio={{ titulo: buscaAtrasada ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado' }}
            colunas={[
              {
                chave: 'produto',
                titulo: 'Produto',
                render: (p) => (
                  <div className="celula-principal">
                    <strong>{p.nome ?? `Produto #${p.id}`}</strong>
                    {temCodigo(p) ? <span className="num">{p.codigoBarras}</span> : <span>Sem código de barras</span>}
                  </div>
                ),
              },
              {
                chave: 'estoque',
                titulo: 'Estoque',
                alinhar: 'direita',
                ocultarNoCelular: true,
                render: (p) => <span className="num">{p.quantidadeEstoque == null ? '—' : formatarNumero(p.quantidadeEstoque)}</span>,
              },
              {
                chave: 'acao',
                titulo: 'Maleta',
                alinhar: 'direita',
                render: (p) =>
                  temCodigo(p) ? (
                    <Button variante={quantidades.has(p.id) ? 'fantasma' : 'secundario'} tamanho="sm" icone={<IoAdd />} onClick={() => adicionar([p])}>
                      {quantidades.has(p.id) ? `Mais 1 (${quantidades.get(p.id)})` : 'Adicionar'}
                    </Button>
                  ) : (
                    <Link className="link-pequeno" to="/produtos">
                      Cadastrar código
                    </Link>
                  ),
              },
            ]}
          />
          <Pagination meta={lista.dados?.meta} aoMudar={setPagina} />
        </Painel>

        <Painel
          titulo="Na maleta"
          descricao={
            itens.length
              ? `${formatarInteiro(itens.length)} produto(s) · ${formatarInteiro(totalPedido)} etiqueta(s)`
              : 'Os produtos adicionados aparecem aqui e ficam guardados neste navegador.'
          }
          semEspaco
          acoes={
            itens.length ? (
              <Button variante="fantasma" tamanho="sm" icone={<IoTrashOutline />} onClick={() => void esvaziar()}>
                Esvaziar
              </Button>
            ) : null
          }
        >
          {carga.erro ? <EstadoErro mensagem={carga.erro} aoTentarNovamente={recarregarMaleta} /> : null}
          {semCodigo.length ? (
            <p className="aviso-faixa maleta-aviso" role="status">
              {semCodigo.length} produto(s) estão sem código de barras e não serão impressos. Cadastre o código em{' '}
              <Link to="/produtos">Produtos</Link>.
            </p>
          ) : null}
          <DataTable<ItemMaleta>
            rotulo="Produtos na maleta"
            carregando={carga.carregando && !produtos.size}
            linhas={itens}
            chaveLinha={(item) => item.id}
            linhasCarregando={3}
            vazio={{ titulo: 'Maleta vazia', descricao: 'Adicione produtos pela lista ao lado.' }}
            colunas={[
              {
                chave: 'produto',
                titulo: 'Produto',
                render: (item) => {
                  const produto = produtos.get(item.id);
                  return (
                    <div className="celula-principal">
                      <strong>{produto?.nome ?? `Produto #${item.id}`}</strong>
                      {produto && !temCodigo(produto) ? (
                        <Badge tom="aviso">Sem código</Badge>
                      ) : (
                        <span className="num">{produto?.codigoBarras ?? ''}</span>
                      )}
                    </div>
                  );
                },
              },
              {
                chave: 'quantidade',
                titulo: 'Etiquetas',
                alinhar: 'direita',
                render: (item) => (
                  <input
                    className="entrada maleta-quantidade num"
                    type="number"
                    min={1}
                    max={QUANTIDADE_MAXIMA}
                    value={item.quantidade}
                    aria-label={`Quantidade de etiquetas de ${produtos.get(item.id)?.nome ?? `produto ${item.id}`}`}
                    onChange={(e) => mudarQuantidade(item.id, e.target.value)}
                  />
                ),
              },
              {
                chave: 'remover',
                titulo: 'Remover',
                alinhar: 'direita',
                render: (item) => (
                  <Button variante="fantasma" tamanho="sm" somenteIcone icone={<IoTrashOutline />} onClick={() => remover(item.id)}>
                    Remover da maleta
                  </Button>
                ),
              },
            ]}
          />
        </Painel>
      </div>

      <Painel titulo="Impressão" descricao="Mesmo modelo de etiqueta do sistema antigo, sem preço.">
        {modelos.erro ? (
          <EstadoErro mensagem={modelos.erro} aoTentarNovamente={modelos.recarregar} />
        ) : !modelo ? (
          <Skeleton altura={220} />
        ) : (
          <div className="etiquetas-impressao-grade">
            <div className="etiquetas-opcoes">
              <Select
                rotulo="Modelo de etiqueta"
                value={modelo.id}
                onChange={(e) => {
                  setIdModelo(Number(e.target.value));
                  setFolhaVista(0);
                }}
                ajuda={`${modelo.colunas} colunas × ${modelo.linhas} linhas = ${modelo.porFolha} por folha ${nomeDoPapel(modelo)} · etiqueta de ${formatarNumero(modelo.larguraEtiqueta)} × ${formatarNumero(modelo.alturaEtiqueta)} cm`}
              >
                {modelos.dados?.modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {nomeDoModelo(m)}
                  </option>
                ))}
              </Select>
              <Input
                rotulo="Começar na etiqueta nº"
                type="number"
                min={1}
                max={modelo.porFolha}
                value={inicioTexto}
                onChange={(e) => setInicioTexto(e.target.value)}
                onBlur={() => setInicioTexto(String(inicio))}
                ajuda="Para reaproveitar uma folha já usada: as posições anteriores ficam em branco."
              />
              {opcionaisDoModelo(modelo).length ? (
                <fieldset className="etiquetas-campos">
                  <legend>Também imprimir</legend>
                  {opcionaisDoModelo(modelo).map((conteudo) => (
                    <label key={conteudo} className="caixa-selecao">
                      <input type="checkbox" checked={opcionais.includes(conteudo)} onChange={(e) => alternarOpcional(conteudo, e.target.checked)} />
                      {ROTULOS_OPCIONAIS[conteudo]}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <div className="etiquetas-resumo">
                <p>
                  <strong className="num">{formatarInteiro(totalImpresso)}</strong> etiqueta(s) em{' '}
                  <strong className="num">{formatarInteiro(folhas.length)}</strong> folha(s) {nomeDoPapel(modelo)}
                </p>
                {totalPedido > LIMITE_ETIQUETAS ? (
                  <p className="aviso-faixa">Limite de {formatarInteiro(LIMITE_ETIQUETAS)} etiquetas por impressão. Imprima o restante em seguida.</p>
                ) : null}
                <p className="muted pequeno">Na janela de impressão, use escala 100% (tamanho real) e margens “nenhuma”.</p>
                <Button icone={<IoPrintOutline />} onClick={imprimir} disabled={!folhas.length}>
                  Imprimir etiquetas
                </Button>
              </div>
            </div>
            <div className="etiquetas-previa-area">
              <div className="etiquetas-previa-topo">
                <span className="pequeno">
                  {folhas.length ? `Folha ${folhaAtual + 1} de ${folhas.length}` : 'Prévia da folha'}
                </span>
                {folhas.length > 1 ? (
                  <span className="linha">
                    <Button variante="secundario" tamanho="sm" somenteIcone icone={<IoChevronBack />} disabled={folhaAtual === 0} onClick={() => setFolhaVista(folhaAtual - 1)}>
                      Folha anterior
                    </Button>
                    <Button
                      variante="secundario"
                      tamanho="sm"
                      somenteIcone
                      icone={<IoChevronForward />}
                      disabled={folhaAtual >= folhas.length - 1}
                      onClick={() => setFolhaVista(folhaAtual + 1)}
                    >
                      Próxima folha
                    </Button>
                  </span>
                ) : null}
              </div>
              <PreviaEscalada modelo={modelo}>
                <FolhaEtiquetas
                  modelo={modelo}
                  etiquetas={folhas[folhaAtual] ?? Array.from({ length: modelo.porFolha }, () => null)}
                  usadas={folhaAtual === 0 ? inicio - 1 : 0}
                  empresa={empresa}
                  opcionais={opcionais}
                  previa
                  rotulo="Prévia da folha de etiquetas"
                />
              </PreviaEscalada>
            </div>
          </div>
        )}
      </Painel>

      {modelo && folhas.length
        ? createPortal(
            <div className="etiquetas-impressao" aria-hidden>
              <style>{`@page etiquetas { size: ${modelo.pagina.largura}cm ${modelo.pagina.altura}cm; margin: 0; }`}</style>
              {folhas.map((folha, indice) => (
                <FolhaEtiquetas
                  key={indice}
                  modelo={modelo}
                  etiquetas={folha}
                  empresa={empresa}
                  opcionais={opcionais}
                  rotulo={`Folha ${indice + 1}`}
                />
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
