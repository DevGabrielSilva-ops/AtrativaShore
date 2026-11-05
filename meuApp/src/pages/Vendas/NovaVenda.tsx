import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IoDocumentTextOutline,
  IoAdd,
  IoCheckmarkCircle,
  IoClose,
  IoPersonAddOutline,
  IoPrintOutline,
  IoRemove,
  IoSwapHorizontal,
  IoTrashOutline,
  IoWarningOutline,
} from 'react-icons/io5';
import { ImprimirCarne } from '../../components/ImpressaoCarne';
import { OpcaoProduto } from '../../components/Produto';
import { ReciboVenda } from '../../components/ReciboVenda';
import { SeletorBusca } from '../../components/SeletorBusca';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Estados';
import { Input } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAcao, useRequisicao } from '../../hooks/useRequisicao';
import { ApiError, mensagemErro } from '../../services/api';
import { caixaService, clienteService, produtoService, vendaService } from '../../services/servicos';
import type { Cliente, FormaPagamento, Produto, RegistrarVendaEntrada, VendaDetalhe } from '../../types/api';
import {
  formatarData,
  formatarDocumento,
  formatarMoeda,
  formatarNumero,
  hojeIso,
  lerNumero,
  numeroParaCampo,
  somarDiasIso,
} from '../../utils/formatar';
import { FORMAS_PAGAMENTO } from '../compartilhado';
import './vendas.css';

interface Linha {
  chave: number;
  produto: Produto;
  quantidade: string;
  preco: string;
}

const centavos = (valor: number) => Math.round(valor * 100);
const reais = (valor: number) => valor / 100;

function precoSugerido(produto: Produto): number {
  return (produto.precoPrazo ?? 0) > 0 ? produto.precoPrazo! : (produto.precoVista ?? 0);
}

function totalLinha(linha: Linha): number {
  const preco = lerNumero(linha.preco) ?? 0;
  const quantidade = lerNumero(linha.quantidade) ?? 0;
  return Math.round(centavos(preco) * quantidade);
}

export default function NovaVenda() {
  const { notificar } = useFeedback();
  const { pode } = useAuth();
  const caixa = useRequisicao(() => caixaService.atual(), []);
  const [itens, setItens] = useState<Linha[]>([]);
  const [trocas, setTrocas] = useState<Linha[]>([]);
  const [modoTroca, setModoTroca] = useState(false);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [desconto, setDesconto] = useState('');
  const [acrescimo, setAcrescimo] = useState('');
  const [pagamentosDigitados, setPagamentos] = useState<Partial<Record<FormaPagamento, string>>>({});
  const [parcelas, setParcelas] = useState('1');
  const [primeiroVencimento, setPrimeiroVencimento] = useState('');
  const [revisando, setRevisando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [concluida, setConcluida] = useState<VendaDetalhe | null>(null);
  const proximaChave = useRef(1);

  const subtotal = itens.reduce((soma, linha) => soma + totalLinha(linha), 0);
  const creditoTroca = trocas.reduce((soma, linha) => soma + totalLinha(linha), 0);
  const descontoC = centavos(lerNumero(desconto) ?? 0);
  const acrescimoC = centavos(lerNumero(acrescimo) ?? 0);
  const total = subtotal - descontoC + acrescimoC - creditoTroca;
  const formas = Object.keys(pagamentosDigitados) as FormaPagamento[];
  const pagamentos: Partial<Record<FormaPagamento, string>> =
    formas.length === 1 && total >= 0 ? { [formas[0]]: numeroParaCampo(reais(total)) } : pagamentosDigitados;
  const pago = formas.reduce((soma, forma) => soma + centavos(lerNumero(pagamentos[forma] ?? '') ?? 0), 0);
  const restante = total - pago;

  const adicionar = (produto: Produto, destino: 'itens' | 'trocas') => {
    if (!produto.controlaEstoque) {
      notificar(`${produto.nome} é um item de serviço e não pode ser vendido aqui.`, 'erro');
      return;
    }
    const definir = destino === 'itens' ? setItens : setTrocas;
    definir((lista) => {
      const existente = lista.find((linha) => linha.produto.id === produto.id);
      if (existente) {
        return lista.map((linha) =>
          linha === existente
            ? { ...linha, quantidade: formatarNumero((lerNumero(linha.quantidade) ?? 0) + 1).replace(/\./g, '') }
            : linha,
        );
      }
      return [...lista, { chave: proximaChave.current++, produto, quantidade: '1', preco: numeroParaCampo(precoSugerido(produto)) }];
    });
    setFalha(null);
  };

  const alternarForma = (forma: FormaPagamento) => {
    const novo = { ...pagamentos };
    if (forma in novo) delete novo[forma];
    else novo[forma] = Object.keys(novo).length === 0 ? numeroParaCampo(reais(Math.max(total, 0))) : numeroParaCampo(reais(Math.max(restante, 0)));
    setPagamentos(novo);
  };

  const temCarne = 'CARNE' in pagamentos;
  const credito = useRequisicao(() => clienteService.creditoCarne(cliente!.id), [cliente?.id], cliente !== null);
  const disponivelCarne = cliente && credito.dados ? centavos(credito.dados.disponivel) : null;
  const valorCarne = temCarne ? centavos(lerNumero(pagamentos.CARNE ?? '') ?? 0) : 0;
  const avisos: string[] = [];
  if (itens.length === 0) avisos.push('Adicione pelo menos um produto.');
  if (total < 0) avisos.push('O valor devolvido na troca é maior que a compra.');
  if (descontoC > subtotal) avisos.push('O desconto é maior que o valor dos produtos.');
  if (total > 0 && formas.length === 0) avisos.push('Escolha a forma de pagamento.');
  if (formas.length > 0 && restante !== 0) avisos.push(restante > 0 ? `Faltam ${formatarMoeda(reais(restante))} nos pagamentos.` : `Os pagamentos passam ${formatarMoeda(reais(-restante))} do total.`);
  if (temCarne && !cliente) avisos.push('Venda no carnê precisa de um cliente.');
  if (temCarne && disponivelCarne !== null && valorCarne > disponivelCarne)
    avisos.push(
      disponivelCarne <= 0
        ? 'Este cliente atingiu o limite do carnê. Ele volta a comprar no carnê conforme pagar as parcelas.'
        : `Limite do carnê insuficiente: disponível ${formatarMoeda(reais(disponivelCarne))}.`,
    );
  const semEstoque = itens.filter((linha) => (lerNumero(linha.quantidade) ?? 0) > (linha.produto.quantidadeEstoque ?? 0));
  const invalidas = [...itens, ...trocas].filter((linha) => !((lerNumero(linha.quantidade) ?? 0) > 0) || !((lerNumero(linha.preco) ?? 0) > 0));
  if (invalidas.length) avisos.push('Confira quantidade e preço de todos os itens.');

  const montarPedido = (): RegistrarVendaEntrada => ({
    idCliente: cliente?.id,
    itens: itens.map((linha) => ({
      idProduto: linha.produto.id,
      quantidade: lerNumero(linha.quantidade) ?? 0,
      precoUnitario: lerNumero(linha.preco) ?? undefined,
    })),
    itensTroca: trocas.length
      ? trocas.map((linha) => ({ idProduto: linha.produto.id, quantidade: lerNumero(linha.quantidade) ?? 0, precoUnitario: lerNumero(linha.preco) ?? undefined }))
      : undefined,
    desconto: descontoC ? reais(descontoC) : undefined,
    acrescimo: acrescimoC ? reais(acrescimoC) : undefined,
    pagamentos: formas
      .map((forma) => ({ forma, valor: reais(centavos(lerNumero(pagamentos[forma] ?? '') ?? 0)) }))
      .filter((pagamento) => pagamento.valor > 0),
    parcelasCarne: temCarne ? Number(parcelas) : undefined,
    primeiroVencimento: temCarne && primeiroVencimento ? primeiroVencimento : undefined,
  });

  const confirmar = useAcao(async () => {
    setFalha(null);
    try {
      const venda = await vendaService.registrar(montarPedido());
      setRevisando(false);
      setConcluida(venda);
      notificar(`Venda registrada: ${formatarMoeda(venda.total)}.`);
      credito.recarregar();
    } catch (erro) {
      setRevisando(false);
      setFalha(
        erro instanceof ApiError && erro.status === 409
          ? mensagemErro(erro)
          : `A venda não foi registrada. ${mensagemErro(erro)}`,
      );
      if (erro instanceof ApiError && erro.status === 409) {
        caixa.recarregar();
        credito.recarregar();
      }
    }
  });

  const novaVenda = () => {
    setItens([]);
    setTrocas([]);
    setCliente(null);
    setDesconto('');
    setAcrescimo('');
    setPagamentos({});
    setParcelas('1');
    setPrimeiroVencimento('');
    setFalha(null);
    setModoTroca(false);
    setConcluida(null);
  };

  const buscarProdutos = async (termo: string) => (await produtoService.listar({ busca: termo, limit: 8 })).data;
  const buscarCodigo = (codigo: string) => produtoService.porCodigo(codigo).catch(() => null);

  return (
    <div className="pdv">
      <div className="pdv-cabecalho">
        <div>
          <h1>Nova venda</h1>
          <p className="muted">Busque pelo nome ou passe o leitor de código de barras.</p>
        </div>
        <Button variante={modoTroca ? 'primario' : 'secundario'} icone={<IoSwapHorizontal />} onClick={() => setModoTroca((v) => !v)} aria-pressed={modoTroca}>
          {modoTroca ? 'Fechar troca' : 'Realizar troca'}
        </Button>
      </div>

      {caixa.dados === null && !caixa.carregando ? (
        <div className="aviso-faixa" role="status">
          <IoWarningOutline size={18} aria-hidden />
          <span>
            O caixa deste terminal está fechado e a loja exige caixa aberto para vender. <Link to="/caixa">Abrir o caixa</Link>
          </span>
        </div>
      ) : null}

      <div className="pdv-grade">
        <section className="pdv-itens" aria-label="Itens da venda">
          <SeletorBusca<Produto>
            rotulo="Adicionar produto"
            placeholder="Nome, código de barras ou id do produto"
            buscar={buscarProdutos}
            buscarExato={buscarCodigo}
            chave={(p) => p.id}
            renderizar={(p) => <OpcaoProduto produto={p} />}
            aoSelecionar={(p) => adicionar(p, 'itens')}
            autoFocus
          />
          <TabelaLinhas
            linhas={itens}
            aoMudar={setItens}
            vazio="Nenhum produto na venda ainda."
            avisoEstoque
          />

          {modoTroca || trocas.length ? (
            <div className="pdv-troca">
              <div className="linha-entre">
                <h2>Itens devolvidos na troca</h2>
                <span className="pequeno muted">Voltam ao estoque e o valor é abatido</span>
              </div>
              <SeletorBusca<Produto>
                rotulo="Adicionar item devolvido"
                placeholder="Produto que o cliente está devolvendo"
                buscar={buscarProdutos}
                buscarExato={buscarCodigo}
                chave={(p) => p.id}
                renderizar={(p) => <OpcaoProduto produto={p} />}
                aoSelecionar={(p) => adicionar(p, 'trocas')}
              />
              <TabelaLinhas linhas={trocas} aoMudar={setTrocas} vazio="Nenhum item devolvido." />
            </div>
          ) : null}
        </section>

        <aside className="cupom" aria-label="Resumo e pagamento">
          <div className="cupom-serrilha" aria-hidden />
          <div className="cupom-corpo">
            <div className="cupom-bloco">
              <p className="cupom-rotulo">Cliente</p>
              {cliente ? (
                <div className="produto-escolhido">
                  <div className="celula-principal">
                    <strong>{cliente.nome}</strong>
                    <span className="num">{formatarDocumento(cliente.cpf)}</span>
                    {credito.dados ? (
                      <span className={`num ${credito.dados.disponivel <= 0 ? 'nota-negativo' : ''}`}>
                        Carnê: {formatarMoeda(credito.dados.disponivel)} disponível de {formatarMoeda(credito.dados.limite)}
                      </span>
                    ) : null}
                  </div>
                  <Button variante="fantasma" tamanho="sm" somenteIcone icone={<IoClose />} onClick={() => setCliente(null)}>
                    Remover cliente
                  </Button>
                </div>
              ) : (
                <div className="linha cupom-cliente">
                  <SeletorBusca<Cliente>
                    rotulo="Cliente (opcional)"
                    placeholder="Nome, CPF ou código"
                    buscar={async (termo) => (await clienteService.listar({ busca: termo, limit: 8 })).data}
                    chave={(c) => c.id}
                    renderizar={(c) => (
                      <div className="celula-principal">
                        <strong>{c.nome}</strong>
                        <span className="num">{formatarDocumento(c.cpf)}</span>
                      </div>
                    )}
                    aoSelecionar={setCliente}
                  />
                  {pode('clientes.gerenciar') ? (
                    <Link to="/clientes?novo=1" className="btn btn-fantasma btn-sm btn-icone" aria-label="Cadastrar cliente" title="Cadastrar cliente">
                      <IoPersonAddOutline />
                    </Link>
                  ) : null}
                </div>
              )}
            </div>

            <dl className="cupom-linhas">
              <div>
                <dt>Produtos ({itens.length})</dt>
                <dd className="num">{formatarMoeda(reais(subtotal))}</dd>
              </div>
              {creditoTroca ? (
                <div>
                  <dt>Devolvido na troca</dt>
                  <dd className="num">− {formatarMoeda(reais(creditoTroca))}</dd>
                </div>
              ) : null}
              <div className="cupom-ajuste">
                <dt>
                  <label htmlFor="pdv-desconto">Desconto</label>
                </dt>
                <dd>
                  <input id="pdv-desconto" className="entrada entrada-tabela" inputMode="decimal" placeholder="0,00" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
                </dd>
              </div>
              <div className="cupom-ajuste">
                <dt>
                  <label htmlFor="pdv-acrescimo">Acréscimo</label>
                </dt>
                <dd>
                  <input id="pdv-acrescimo" className="entrada entrada-tabela" inputMode="decimal" placeholder="0,00" value={acrescimo} onChange={(e) => setAcrescimo(e.target.value)} />
                </dd>
              </div>
            </dl>

            <div className="cupom-total">
              <span>Total</span>
              <strong className="num">{formatarMoeda(reais(total))}</strong>
            </div>

            <div className="cupom-bloco">
              <p className="cupom-rotulo">Pagamento</p>
              <div className="formas" role="group" aria-label="Formas de pagamento">
                {FORMAS_PAGAMENTO.map((forma) => (
                  <button
                    key={forma.id}
                    type="button"
                    className={forma.id in pagamentos ? 'forma forma-ativa' : 'forma'}
                    aria-pressed={forma.id in pagamentos}
                    onClick={() => alternarForma(forma.id)}
                  >
                    {forma.rotulo}
                  </button>
                ))}
              </div>
              {formas.length > 1
                ? formas.map((forma) => (
                    <div className="linha-entre forma-valor" key={forma}>
                      <label htmlFor={`pdv-forma-${forma}`}>{FORMAS_PAGAMENTO.find((f) => f.id === forma)?.rotulo}</label>
                      <input
                        id={`pdv-forma-${forma}`}
                        className="entrada entrada-tabela"
                        inputMode="decimal"
                        value={pagamentos[forma] ?? ''}
                        onChange={(e) => setPagamentos((atual) => ({ ...atual, [forma]: e.target.value }))}
                      />
                    </div>
                  ))
                : null}
              {formas.length > 1 ? (
                <p className={`pequeno num ${restante === 0 ? 'nota-positivo' : 'nota-alerta'}`}>
                  {restante === 0 ? 'Pagamentos conferem com o total.' : `Restante: ${formatarMoeda(reais(restante))}`}
                </p>
              ) : null}
              {temCarne ? (
                <div className="form-grade carne-campos">
                  <Input
                    className="col-3"
                    rotulo="Parcelas"
                    type="number"
                    min={1}
                    max={48}
                    value={parcelas}
                    onChange={(e) => setParcelas(e.target.value)}
                  />
                  <Input
                    className="col-3"
                    rotulo="1º vencimento"
                    type="date"
                    min={somarDiasIso(hojeIso(), 1)}
                    value={primeiroVencimento}
                    onChange={(e) => setPrimeiroVencimento(e.target.value)}
                    ajuda="Vazio: 30 dias após hoje"
                  />
                </div>
              ) : null}
            </div>

            {falha ? (
              <div className="aviso-faixa erro" role="alert">
                <IoWarningOutline size={18} aria-hidden />
                <span>{falha}</span>
              </div>
            ) : null}
            {itens.length > 0 && avisos.length ? (
              <ul className="cupom-avisos" aria-live="polite">
                {avisos.map((aviso) => (
                  <li key={aviso}>{aviso}</li>
                ))}
              </ul>
            ) : null}

            <Button className="cupom-confirmar" onClick={() => setRevisando(true)} disabled={avisos.length > 0}>
              Revisar e confirmar
            </Button>
            {semEstoque.length ? (
              <p className="pequeno nota-alerta">
                {semEstoque.length === 1 ? `${semEstoque[0].produto.nome} tem` : `${semEstoque.length} produtos têm`} menos estoque que o pedido; a API vai recusar se não houver saldo.
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      {revisando ? (
        <Modal
          aberto
          titulo="Confirmar venda"
          descricao="Confira antes de registrar. O total final é calculado pela API."
          aoFechar={() => setRevisando(false)}
          rodape={
            <>
              <Button variante="secundario" onClick={() => setRevisando(false)}>
                Voltar
              </Button>
              <Button onClick={() => void confirmar.executar()} carregando={confirmar.executando} autoFocus>
                Registrar venda
              </Button>
            </>
          }
        >
          <div className="pilha">
            <ul className="revisao-lista">
              {itens.map((linha) => (
                <li key={linha.chave}>
                  <span>
                    {linha.quantidade} × {linha.produto.nome}
                  </span>
                  <span className="num">{formatarMoeda(reais(totalLinha(linha)))}</span>
                </li>
              ))}
              {trocas.map((linha) => (
                <li key={`t${linha.chave}`} className="muted">
                  <span>
                    Devolvido: {linha.quantidade} × {linha.produto.nome}
                  </span>
                  <span className="num">− {formatarMoeda(reais(totalLinha(linha)))}</span>
                </li>
              ))}
            </ul>
            <dl className="cupom-linhas">
              {descontoC ? (
                <div>
                  <dt>Desconto</dt>
                  <dd className="num">− {formatarMoeda(reais(descontoC))}</dd>
                </div>
              ) : null}
              {acrescimoC ? (
                <div>
                  <dt>Acréscimo</dt>
                  <dd className="num">+ {formatarMoeda(reais(acrescimoC))}</dd>
                </div>
              ) : null}
              <div className="revisao-total">
                <dt>Total</dt>
                <dd className="num">{formatarMoeda(reais(total))}</dd>
              </div>
              {formas.map((forma) => (
                <div key={forma}>
                  <dt>
                    {FORMAS_PAGAMENTO.find((f) => f.id === forma)?.rotulo}
                    {forma === 'CARNE' ? ` em ${parcelas}x` : ''}
                  </dt>
                  <dd className="num">{formatarMoeda(lerNumero(pagamentos[forma] ?? '') ?? 0)}</dd>
                </div>
              ))}
              <div>
                <dt>Cliente</dt>
                <dd>{cliente?.nome ?? 'Não identificado'}</dd>
              </div>
            </dl>
          </div>
        </Modal>
      ) : null}

      {concluida ? <VendaConcluida venda={concluida} aoNovaVenda={novaVenda} /> : null}
    </div>
  );
}

function TabelaLinhas({
  linhas,
  aoMudar,
  vazio,
  avisoEstoque = false,
}: {
  linhas: Linha[];
  aoMudar: (atualizar: (lista: Linha[]) => Linha[]) => void;
  vazio: string;
  avisoEstoque?: boolean;
}) {
  const mudar = (chave: number, campo: 'quantidade' | 'preco', valor: string) =>
    aoMudar((lista) => lista.map((linha) => (linha.chave === chave ? { ...linha, [campo]: valor } : linha)));
  const passo = (linha: Linha, delta: number) => {
    const atual = lerNumero(linha.quantidade) ?? 0;
    const novo = Math.max(1, Math.round((atual + delta) * 1000) / 1000);
    mudar(linha.chave, 'quantidade', String(novo).replace('.', ','));
  };

  if (linhas.length === 0) return <p className="pdv-vazio muted">{vazio}</p>;

  return (
    <div className="tabela-rolagem">
      <table className="tabela pdv-tabela">
        <thead>
          <tr>
            <th scope="col">Produto</th>
            <th scope="col">Quantidade</th>
            <th scope="col" className="alinhar-direita">
              Preço unit.
            </th>
            <th scope="col" className="alinhar-direita">
              Total
            </th>
            <th scope="col">
              <span className="sr-only">Remover</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => {
            const quantidade = lerNumero(linha.quantidade) ?? 0;
            const saldo = linha.produto.quantidadeEstoque ?? 0;
            const sugerido = precoSugerido(linha.produto);
            const editado = Math.abs((lerNumero(linha.preco) ?? 0) - sugerido) > 0.004;
            return (
              <tr key={linha.chave}>
                <td>
                  <div className="celula-principal">
                    <strong>{linha.produto.nome}</strong>
                    <span className="num">
                      {linha.produto.codigoBarras ?? `#${linha.produto.id}`} · estoque {formatarNumero(saldo)}
                      {avisoEstoque && quantidade > saldo ? (
                        <>
                          {' '}
                          <Badge tom="perigo">insuficiente</Badge>
                        </>
                      ) : null}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="quantidade">
                    <button type="button" className="btn btn-secundario btn-sm btn-icone" onClick={() => passo(linha, -1)} aria-label={`Diminuir ${linha.produto.nome}`}>
                      <IoRemove />
                    </button>
                    <input
                      className="entrada entrada-tabela num"
                      inputMode="decimal"
                      aria-label={`Quantidade de ${linha.produto.nome}`}
                      value={linha.quantidade}
                      onChange={(e) => mudar(linha.chave, 'quantidade', e.target.value)}
                    />
                    <button type="button" className="btn btn-secundario btn-sm btn-icone" onClick={() => passo(linha, 1)} aria-label={`Aumentar ${linha.produto.nome}`}>
                      <IoAdd />
                    </button>
                  </div>
                </td>
                <td className="alinhar-direita">
                  <input
                    className="entrada entrada-tabela num entrada-preco"
                    inputMode="decimal"
                    aria-label={`Preço unitário de ${linha.produto.nome}`}
                    value={linha.preco}
                    onChange={(e) => mudar(linha.chave, 'preco', e.target.value)}
                  />
                  {editado ? (
                    <button type="button" className="link-botao pequeno" onClick={() => mudar(linha.chave, 'preco', numeroParaCampo(sugerido))}>
                      sugerido {formatarMoeda(sugerido)}
                    </button>
                  ) : null}
                </td>
                <td className="alinhar-direita num">{formatarMoeda(reais(totalLinha(linha)))}</td>
                <td className="alinhar-direita">
                  <Button
                    variante="fantasma"
                    tamanho="sm"
                    somenteIcone
                    icone={<IoTrashOutline />}
                    onClick={() => aoMudar((lista) => lista.filter((item) => item.chave !== linha.chave))}
                  >
                    {`Remover ${linha.produto.nome}`}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VendaConcluida({ venda, aoNovaVenda }: { venda: VendaDetalhe; aoNovaVenda: () => void }) {
  const [carne, setCarne] = useState(false);
  const [recibo, setRecibo] = useState(false);
  const formas = useMemo(
    () =>
      (
        [
          ['Dinheiro', venda.pagamentos.dinheiro],
          ['Pix', venda.pagamentos.pix],
          ['Cartão', venda.pagamentos.cartao],
          ['Carnê', venda.pagamentos.carne],
        ] as const
      ).filter(([, valor]) => valor > 0),
    [venda],
  );
  return (
    <Modal
      aberto
      titulo="Venda registrada"
      aoFechar={aoNovaVenda}
      rodape={
        <>
          <Button variante="secundario" icone={<IoPrintOutline />} onClick={() => setRecibo(true)}>
            Imprimir recibo
          </Button>
          {venda.parcelasCarne.length ? (
            <Button variante="secundario" icone={<IoDocumentTextOutline />} onClick={() => setCarne(true)}>
              Imprimir carnê
            </Button>
          ) : null}
          <Button onClick={aoNovaVenda} autoFocus>
            Nova venda
          </Button>
        </>
      }
    >
      <div className="comprovante area-impressao">
        <p className="comprovante-ok">
          <IoCheckmarkCircle size={22} aria-hidden /> Estoque atualizado e venda gravada.
        </p>
        <p className="muted pequeno num">
          Controle {venda.controle} · {formatarData(venda.data)} {venda.hora}
          {venda.cliente ? ` · ${venda.cliente.nome}` : ''}
        </p>
        <ul className="revisao-lista">
          {venda.itens.map((item) => (
            <li key={item.id}>
              <span>
                {formatarNumero(item.quantidade)} × {item.produto}
              </span>
              <span className="num">{formatarMoeda(item.valorTotal)}</span>
            </li>
          ))}
          {venda.itensTroca.map((item) => (
            <li key={item.id} className="muted">
              <span>Devolvido: {item.produto}</span>
              <span className="num">− {formatarMoeda(item.valorTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="cupom-linhas">
          {venda.desconto ? (
            <div>
              <dt>Desconto concedido</dt>
              <dd className="num">{formatarMoeda(venda.desconto)}</dd>
            </div>
          ) : null}
          <div className="revisao-total">
            <dt>Total</dt>
            <dd className="num">{formatarMoeda(venda.total)}</dd>
          </div>
          {formas.map(([nome, valor]) => (
            <div key={nome}>
              <dt>{nome}</dt>
              <dd className="num">{formatarMoeda(valor)}</dd>
            </div>
          ))}
        </dl>
        {venda.parcelasCarne.length ? (
          <>
            <h3>Parcelas do carnê</h3>
            <ul className="revisao-lista">
              {venda.parcelasCarne.map((parcela) => (
                <li key={parcela.parcela}>
                  <span className="num">
                    {parcela.parcela}/{venda.parcelasCarne.length} · vence {formatarData(parcela.vencimento)} · {parcela.codigo}
                  </span>
                  <span className="num">{formatarMoeda(parcela.valor)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      {carne ? <ImprimirCarne controle={venda.controle} aoFechar={() => setCarne(false)} /> : null}
      {recibo ? <ReciboVenda venda={venda} aoFechar={() => setRecibo(false)} /> : null}
    </Modal>
  );
}
