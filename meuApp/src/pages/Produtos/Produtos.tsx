import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { IoAdd, IoCreateOutline, IoDownloadOutline, IoTrashOutline } from 'react-icons/io5';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Input, Select } from '../../components/ui/Field';
import { CampoBusca, Detalhes, PageHeader, Painel } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useFormulario } from '../../hooks/useFormulario';
import { useAcao, useAtrasado, useRequisicao } from '../../hooks/useRequisicao';
import { usePagina } from '../../hooks/useEstadoReiniciado';
import { mensagemErro } from '../../services/api';
import { estoqueService, fornecedorService, produtoService } from '../../services/servicos';
import type { Produto, ProdutoEntrada } from '../../types/api';
import { exportarCsv } from '../../utils/exportar';
import { formatarData, formatarMoeda, formatarNumero, lerNumero, numeroParaCampo } from '../../utils/formatar';
import { BadgeMovimentacao } from '../../components/BadgeMovimentacao';
import { BadgeEstoque } from '../../components/Produto';

export default function Produtos() {
  const { pode } = useAuth();
  const podeEditar = pode('produtos.gerenciar');
  const podeExcluir = pode('produtos.gerenciar');
  const { notificar, confirmar } = useFeedback();
  const [busca, setBusca] = useState('');
  const [idFornecedor, setIdFornecedor] = useState('');
  const [somenteDisponiveis, setSomenteDisponiveis] = useState(false);
  const buscaAtrasada = useAtrasado(busca);
  const [editando, setEditando] = useState<Produto | 'novo' | null>(null);
  const [vendo, setVendo] = useState<Produto | null>(null);

  const [pagina, setPagina] = usePagina([buscaAtrasada, idFornecedor, somenteDisponiveis]);

  const fornecedores = useRequisicao(() => fornecedorService.listar({ limit: 100 }), []);
  const lista = useRequisicao(
    () =>
      produtoService.listar({
        busca: buscaAtrasada.trim() || undefined,
        idFornecedor: idFornecedor ? Number(idFornecedor) : undefined,
        somenteDisponiveis: somenteDisponiveis || undefined,
        page: pagina,
        limit: 20,
      }),
    [buscaAtrasada, idFornecedor, somenteDisponiveis, pagina],
  );

  const excluir = async (produto: Produto) => {
    const sim = await confirmar({
      titulo: 'Excluir produto?',
      mensagem: `${produto.nome} será removido. Produtos com vendas, movimentação ou saldo em estoque não podem ser excluídos.`,
      confirmar: 'Excluir',
      perigo: true,
    });
    if (!sim) return;
    try {
      await produtoService.remover(produto.id);
      notificar('Produto excluído.');
      setVendo(null);
      lista.recarregar();
    } catch (erro) {
      notificar(mensagemErro(erro), 'erro');
    }
  };

  const exportar = () =>
    lista.dados &&
    exportarCsv(
      'produtos',
      [
        { titulo: 'Código de barras', valor: (p: Produto) => p.codigoBarras },
        { titulo: 'Produto', valor: (p) => p.nome },
        { titulo: 'Fornecedor', valor: (p) => p.fornecedor?.nome },
        { titulo: 'Compra', valor: (p) => p.valorCompra },
        { titulo: 'À vista', valor: (p) => p.precoVista },
        { titulo: 'A prazo', valor: (p) => p.precoPrazo },
        { titulo: 'Lucro bruto (%)', valor: (p) => p.lucroBrutoPercentual },
        { titulo: 'Estoque', valor: (p) => p.quantidadeEstoque },
      ],
      lista.dados.data,
    );

  return (
    <>
      <PageHeader
        titulo="Produtos"
        descricao="Preços, custo e saldo. O estoque muda por entradas, ajustes e vendas."
        acoes={
          <>
            <Button variante="secundario" icone={<IoDownloadOutline />} onClick={exportar} disabled={!lista.dados?.data.length}>
              Exportar página
            </Button>
            {podeEditar ? (
              <Button icone={<IoAdd />} onClick={() => setEditando('novo')}>
                Novo produto
              </Button>
            ) : null}
          </>
        }
      />
      <Painel semEspaco>
        <div className="barra-ferramentas">
          <CampoBusca valor={busca} aoMudar={setBusca} rotulo="Buscar por nome, código de barras ou id" />
          <label className="sr-only" htmlFor="filtro-fornecedor">
            Fornecedor
          </label>
          <select id="filtro-fornecedor" className="entrada" value={idFornecedor} onChange={(e) => setIdFornecedor(e.target.value)}>
            <option value="">Todos os fornecedores</option>
            {fornecedores.dados?.data.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          <label className="caixa-selecao">
            <input type="checkbox" checked={somenteDisponiveis} onChange={(e) => setSomenteDisponiveis(e.target.checked)} />
            Só com estoque
          </label>
        </div>
        <DataTable<Produto>
          rotulo="Produtos"
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarNovamente={lista.recarregar}
          linhas={lista.dados?.data}
          chaveLinha={(p) => p.id}
          aoClicarLinha={setVendo}
          vazio={{
            titulo: buscaAtrasada || idFornecedor || somenteDisponiveis ? 'Nenhum produto com esses filtros' : 'Nenhum produto cadastrado',
          }}
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
            { chave: 'compra', titulo: 'Compra', alinhar: 'direita', ocultarNoCelular: true, render: (p) => formatarMoeda(p.valorCompra) },
            { chave: 'vista', titulo: 'À vista', alinhar: 'direita', render: (p) => formatarMoeda(p.precoVista) },
            { chave: 'prazo', titulo: 'A prazo', alinhar: 'direita', ocultarNoCelular: true, render: (p) => formatarMoeda(p.precoPrazo) },
            {
              chave: 'lucro',
              titulo: 'Lucro',
              alinhar: 'direita',
              ocultarNoCelular: true,
              render: (p) => (p.lucroBrutoPercentual == null ? '—' : `${formatarNumero(p.lucroBrutoPercentual)}%`),
            },
            { chave: 'estoque', titulo: 'Estoque', alinhar: 'direita', render: (p) => <BadgeEstoque produto={p} /> },
            {
              chave: 'acoes',
              titulo: 'Ações',
              alinhar: 'direita',
              render: (p) => (
                <div className="acoes-linha" onClick={(e) => e.stopPropagation()}>
                  {podeEditar ? (
                    <Button variante="fantasma" tamanho="sm" somenteIcone icone={<IoCreateOutline />} onClick={() => setEditando(p)}>
                      Editar
                    </Button>
                  ) : null}
                  {podeExcluir ? (
                    <Button variante="fantasma" tamanho="sm" somenteIcone icone={<IoTrashOutline />} onClick={() => excluir(p)}>
                      Excluir
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
        <Pagination meta={lista.dados?.meta} aoMudar={setPagina} />
      </Painel>

      {editando ? (
        <FormularioProduto
          produto={editando === 'novo' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={(produto) => {
            setEditando(null);
            lista.recarregar();
            if (vendo?.id === produto.id) setVendo(produto);
          }}
        />
      ) : null}
      {vendo ? (
        <DetalheProduto produto={vendo} aoFechar={() => setVendo(null)} aoEditar={podeEditar ? () => setEditando(vendo) : undefined} aoExcluir={podeExcluir ? () => excluir(vendo) : undefined} />
      ) : null}
    </>
  );
}

const VAZIO = {
  nome: '',
  codigoBarras: '',
  idFornecedor: '',
  idTipo: '',
  unidade: '',
  valorCompra: '',
  precoVista: '',
  precoPrazo: '',
  estoqueMinimo: '',
  informacoesAdicionais: '',
};
type FormProduto = typeof VAZIO;

function FormularioProduto({
  produto,
  aoFechar,
  aoSalvar,
}: {
  produto: Produto | null;
  aoFechar: () => void;
  aoSalvar: (produto: Produto) => void;
}) {
  const { notificar } = useFeedback();
  const fornecedores = useRequisicao(() => fornecedorService.listar({ limit: 100 }), []);
  const tipos = useRequisicao(() => produtoService.tipos(), []);
  const form = useFormulario<FormProduto>(
    produto
      ? {
          nome: produto.nome ?? '',
          codigoBarras: produto.codigoBarras ?? '',
          idFornecedor: produto.fornecedor ? String(produto.fornecedor.id) : '',
          idTipo: produto.tipo ? String(produto.tipo.id) : '',
          unidade: produto.unidade ?? '',
          valorCompra: numeroParaCampo(produto.valorCompra),
          precoVista: numeroParaCampo(produto.precoVista),
          precoPrazo: numeroParaCampo(produto.precoPrazo),
          estoqueMinimo: produto.estoqueMinimo ? String(produto.estoqueMinimo).replace('.', ',') : '',
          informacoesAdicionais: produto.informacoesAdicionais ?? '',
        }
      : VAZIO,
  );
  const [falha, setFalha] = useState<string | null>(null);
  const { valores, campo } = form;

  const lucro = useMemo(() => {
    const compra = lerNumero(valores.valorCompra);
    const vista = lerNumero(valores.precoVista);
    if (!compra || !vista || compra <= 0) return null;
    return ((vista - compra) / compra) * 100;
  }, [valores.valorCompra, valores.precoVista]);

  const salvar = useAcao(async () => {
    const numeroOuNada = (texto: string) => (texto.trim() ? (lerNumero(texto) ?? undefined) : undefined);
    const dados: ProdutoEntrada = {
      nome: valores.nome.trim(),
      codigoBarras: valores.codigoBarras.trim() || undefined,
      idFornecedor: valores.idFornecedor ? Number(valores.idFornecedor) : undefined,
      idTipo: valores.idTipo ? Number(valores.idTipo) : undefined,
      unidade: valores.unidade.trim() || undefined,
      valorCompra: numeroOuNada(valores.valorCompra),
      precoVista: lerNumero(valores.precoVista) ?? 0,
      precoPrazo: numeroOuNada(valores.precoPrazo),
      estoqueMinimo: numeroOuNada(valores.estoqueMinimo),
      informacoesAdicionais: valores.informacoesAdicionais.trim() || undefined,
    };
    try {
      const salvo = produto ? await produtoService.atualizar(produto.id, dados) : await produtoService.criar(dados);
      notificar(produto ? 'Produto atualizado.' : `Produto cadastrado com o código ${salvo.codigoBarras}.`);
      aoSalvar(salvo);
    } catch (erro) {
      setFalha(mensagemErro(erro));
    }
  });

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const erros: Partial<Record<keyof FormProduto, string>> = {};
    if (!valores.nome.trim()) erros.nome = 'Informe o nome.';
    const vista = lerNumero(valores.precoVista);
    if (!vista || vista <= 0) erros.precoVista = 'Informe o preço à vista.';
    for (const nome of ['valorCompra', 'precoPrazo', 'estoqueMinimo'] as const) {
      const texto = valores[nome];
      if (texto.trim() && (lerNumero(texto) == null || (lerNumero(texto) ?? 0) < 0)) erros[nome] = 'Valor inválido.';
    }
    if (valores.precoPrazo.trim() && (lerNumero(valores.precoPrazo) ?? 0) <= 0) erros.precoPrazo = 'Deve ser maior que zero.';
    form.setErros(erros);
    if (Object.keys(erros).length === 0) void salvar.executar();
  };

  return (
    <Modal
      aberto
      titulo={produto ? `Editar ${produto.nome}` : 'Novo produto'}
      descricao={produto ? undefined : 'O saldo começa em zero; lance a entrada em Estoque.'}
      aoFechar={aoFechar}
      tamanho="lg"
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-produto" carregando={salvar.executando}>
            {produto ? 'Salvar alterações' : 'Cadastrar produto'}
          </Button>
        </>
      }
    >
      <form id="form-produto" onSubmit={enviar} noValidate>
        {falha ? (
          <p className="aviso-faixa erro" role="alert">
            {falha}
          </p>
        ) : null}
        <div className="form-secao">
          <h3>Identificação</h3>
          <div className="form-grade">
            <Input className="col-4" rotulo="Nome" obrigatorio maxLength={60} autoFocus {...campo('nome')} />
            <Input
              className="col-2"
              rotulo="Código de barras"
              maxLength={20}
              ajuda={produto ? undefined : 'Vazio: a API gera um código.'}
              {...campo('codigoBarras')}
            />
            <Select className="col-2" rotulo="Fornecedor" {...campo('idFornecedor')}>
              <option value="">Sem fornecedor</option>
              {fornecedores.dados?.data.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Select>
            <Select className="col-2" rotulo="Categoria" {...campo('idTipo')}>
              <option value="">{produto ? 'Manter' : 'Padrão'}</option>
              {tipos.dados?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </Select>
            <Input className="col-2" rotulo="Unidade" maxLength={3} placeholder="UN" {...campo('unidade')} />
          </div>
        </div>
        <div className="form-secao">
          <h3>Preços</h3>
          <div className="form-grade">
            <Input className="col-2" rotulo="Valor de compra" prefixo="R$" inputMode="decimal" placeholder="0,00" {...campo('valorCompra')} />
            <Input className="col-2" rotulo="Preço à vista" obrigatorio prefixo="R$" inputMode="decimal" placeholder="0,00" {...campo('precoVista')} />
            <Input
              className="col-2"
              rotulo="Preço a prazo"
              prefixo="R$"
              inputMode="decimal"
              placeholder="0,00"
              ajuda="Sugerido na venda. Vazio: igual ao à vista."
              {...campo('precoPrazo')}
            />
          </div>
          <p className="pequeno muted" aria-live="polite">
            Lucro bruto sobre o preço à vista: <strong className="num">{lucro == null ? '—' : `${formatarNumero(Math.round(lucro * 100) / 100)}%`}</strong>
          </p>
        </div>
        <div className="form-secao">
          <h3>Estoque</h3>
          <div className="form-grade">
            <Input
              className="col-2"
              rotulo="Estoque mínimo"
              inputMode="decimal"
              ajuda="Abaixo disso o produto aparece em “Repor estoque”."
              {...campo('estoqueMinimo')}
            />
            <Input className="col-4" rotulo="Informações adicionais" maxLength={30} {...campo('informacoesAdicionais')} />
          </div>
        </div>
      </form>
    </Modal>
  );
}

function DetalheProduto({
  produto,
  aoFechar,
  aoEditar,
  aoExcluir,
}: {
  produto: Produto;
  aoFechar: () => void;
  aoEditar?: () => void;
  aoExcluir?: () => void;
}) {
  const saldo = useRequisicao(() => estoqueService.saldo(produto.id), [produto.id]);
  const atual = saldo.dados ?? produto;
  return (
    <Modal
      aberto
      titulo={produto.nome ?? 'Produto'}
      descricao={produto.codigoBarras ?? undefined}
      aoFechar={aoFechar}
      tamanho="lg"
      rodape={
        <>
          {aoExcluir ? (
            <Button variante="fantasma" icone={<IoTrashOutline />} onClick={aoExcluir}>
              Excluir
            </Button>
          ) : null}
          <Link to={`/estoque?produto=${produto.id}`} className="btn btn-secundario btn-md">
            Lançar no estoque
          </Link>
          {aoEditar ? (
            <Button variante="secundario" icone={<IoCreateOutline />} onClick={aoEditar}>
              Editar
            </Button>
          ) : null}
        </>
      }
    >
      <div className="pilha">
        <Detalhes
          itens={[
            { rotulo: 'Saldo em estoque', valor: <BadgeEstoque produto={atual} /> },
            { rotulo: 'Estoque mínimo', valor: atual.estoqueMinimo ? formatarNumero(atual.estoqueMinimo) : null },
            { rotulo: 'Valor de compra', valor: formatarMoeda(atual.valorCompra) },
            { rotulo: 'Preço à vista', valor: formatarMoeda(atual.precoVista) },
            { rotulo: 'Preço a prazo', valor: formatarMoeda(atual.precoPrazo) },
            { rotulo: 'Lucro bruto', valor: atual.lucroBrutoPercentual == null ? null : `${formatarNumero(atual.lucroBrutoPercentual)}%` },
            { rotulo: 'Fornecedor', valor: atual.fornecedor?.nome },
            { rotulo: 'Categoria', valor: atual.tipo?.nome },
            { rotulo: 'Unidade', valor: atual.unidade },
            { rotulo: 'Informações', valor: atual.informacoesAdicionais },
          ]}
        />
        <h3>Últimas movimentações</h3>
        <DataTable
          rotulo="Últimas movimentações do produto"
          carregando={saldo.carregando}
          erro={saldo.erro}
          aoTentarNovamente={saldo.recarregar}
          linhas={saldo.dados?.ultimasMovimentacoes}
          chaveLinha={(m) => `${m.origem}-${m.id}`}
          linhasCarregando={3}
          vazio={{ titulo: 'Nenhuma movimentação registrada' }}
          colunas={[
            { chave: 'data', titulo: 'Data', render: (m) => <span className="num">{formatarData(m.data)}</span> },
            { chave: 'tipo', titulo: 'Tipo', render: (m) => <BadgeMovimentacao tipo={m.tipo} /> },
            {
              chave: 'qtd',
              titulo: 'Quantidade',
              alinhar: 'direita',
              render: (m) => (m.quantidade > 0 ? `+${formatarNumero(m.quantidade)}` : formatarNumero(m.quantidade)),
            },
          ]}
        />
      </div>
    </Modal>
  );
}
