import { useState, type FormEvent } from 'react';
import { IoBarcodeOutline, IoCashOutline, IoPrintOutline } from 'react-icons/io5';
import { CreditoCarneCliente } from '../../components/CreditoCarne';
import { SeletorBusca } from '../../components/SeletorBusca';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Estados';
import { Input } from '../../components/ui/Field';
import { PageHeader, Painel } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAcao, useRequisicao } from '../../hooks/useRequisicao';
import { useEstadoReiniciado } from '../../hooks/useEstadoReiniciado';
import { mensagemErro } from '../../services/api';
import { carneService, clienteService, relatorioService } from '../../services/servicos';
import type { Cliente, ClienteDebito, ParcelaCarne, ResultadoBaixa } from '../../types/api';
import { imprimir } from '../../utils/exportar';
import { formatarData, formatarDocumento, formatarMoeda, formatarTelefone, hojeIso, lerNumero, somarReais } from '../../utils/formatar';

interface ClienteSelecionado {
  id: number;
  nome: string;
  telefone: string | null;
}

export default function Carnes() {
  const { notificar } = useFeedback();
  const [pagina, setPagina] = useState(1);
  const devedores = useRequisicao(() => relatorioService.clientesDebito({ page: pagina, limit: 12 }), [pagina]);
  const [cliente, setCliente] = useState<ClienteSelecionado | null>(null);
  const [situacao, setSituacao] = useState<'ABERTA' | 'PAGA' | 'TODAS'>('ABERTA');
  const [selecionadas, setSelecionadas] = useEstadoReiniciado<ParcelaCarne[]>([], [cliente?.id, situacao]);
  const [recebendo, setRecebendo] = useState<ParcelaCarne[] | null>(null);
  const [recibo, setRecibo] = useState<ResultadoBaixa | null>(null);
  const [versaoCredito, setVersaoCredito] = useState(0);
  const [codigoLido, setCodigoLido] = useState('');

  const parcelas = useRequisicao(
    () => carneService.listar({ idCliente: cliente!.id, situacao, limit: 100 }),
    [cliente?.id, situacao],
    cliente !== null,
  );

  const alternar = (parcela: ParcelaCarne) =>
    setSelecionadas((lista) => (lista.some((p) => p.id === parcela.id) ? lista.filter((p) => p.id !== parcela.id) : [...lista, parcela]));

  const porCodigo = async (codigo: string) => {
    try {
      const parcela = await carneService.obter(codigo);
      if (parcela.situacao === 'PAGA') {
        notificar(`A parcela ${codigo} já foi paga em ${formatarData(parcela.dataPagamento)}.`, 'info');
        return;
      }
      if (parcela.cliente) setCliente({ id: parcela.cliente.id, nome: parcela.cliente.nome ?? '', telefone: parcela.cliente.celular ?? parcela.cliente.telefone });
      setRecebendo([parcela]);
    } catch (erro) {
      notificar(mensagemErro(erro), 'erro');
    }
  };

  return (
    <>
      <PageHeader titulo="Carnês" descricao="Parcelas a receber por cliente. Leia o código do carnê para receber direto." />
      <div className="carnes-grade">
        <Painel titulo="Clientes com parcelas em aberto" semEspaco className="carnes-clientes">
          <div className="barra-ferramentas">
            <SeletorBusca<Cliente>
              rotulo="Buscar cliente"
              buscar={async (termo) => (await clienteService.listar({ busca: termo, limit: 8 })).data}
              chave={(c) => c.id}
              renderizar={(c) => (
                <div className="celula-principal">
                  <strong>{c.nome}</strong>
                  <span className="num">{formatarDocumento(c.cpf)}</span>
                </div>
              )}
              aoSelecionar={(c) => setCliente({ id: c.id, nome: c.nome ?? '', telefone: c.celular ?? c.telefone })}
            />
          </div>
          <DataTable<ClienteDebito>
            rotulo="Clientes com débito"
            carregando={devedores.carregando}
            erro={devedores.erro}
            aoTentarNovamente={devedores.recarregar}
            linhas={devedores.dados?.data}
            chaveLinha={(c) => c.idCliente}
            aoClicarLinha={(c) => setCliente({ id: c.idCliente, nome: c.cliente, telefone: c.celular ?? c.telefone })}
            linhasCarregando={6}
            vazio={{ titulo: 'Nenhum cliente com parcela em aberto' }}
            colunas={[
              {
                chave: 'cliente',
                titulo: 'Cliente',
                render: (c) => (
                  <div className="celula-principal">
                    <strong className={cliente?.id === c.idCliente ? 'texto-marca' : undefined}>{c.cliente}</strong>
                    <span>
                      {c.parcelasEmAberto} parcela(s) · próximo venc. {formatarData(c.proximoVencimento)}
                    </span>
                  </div>
                ),
              },
              {
                chave: 'valor',
                titulo: 'Em aberto',
                alinhar: 'direita',
                render: (c) => (
                  <div className="celula-principal alinhar-direita">
                    <strong className="num">{formatarMoeda(c.valorEmAberto)}</strong>
                    {c.parcelasVencidas > 0 ? <span className="nota-negativo">{c.parcelasVencidas} vencida(s)</span> : null}
                  </div>
                ),
              },
            ]}
          />
          <Pagination meta={devedores.dados?.meta} aoMudar={setPagina} />
        </Painel>

        <div className="pilha">
          <Painel>
            <form
              className="seletor-codigo"
              onSubmit={(evento) => {
                evento.preventDefault();
                const codigo = codigoLido.replace(/\D/g, '');
                if (codigo.length !== 13) return notificar('O código do carnê tem 13 dígitos.', 'erro');
                setCodigoLido('');
                void porCodigo(codigo);
              }}
            >
              <IoBarcodeOutline size={22} aria-hidden />
              <label htmlFor="codigo-carne" className="sr-only">
                Código do carnê
              </label>
              <input
                id="codigo-carne"
                className="entrada"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Leia ou digite o código do carnê (13 dígitos)"
                value={codigoLido}
                onChange={(e) => setCodigoLido(e.target.value)}
              />
              <Button type="submit" variante="secundario">
                Buscar
              </Button>
            </form>
          </Painel>

          {cliente ? (
            <Painel
              titulo={cliente.nome}
              descricao={cliente.telefone ? formatarTelefone(cliente.telefone) : undefined}
              acoes={
                <div className="segmentado" role="group" aria-label="Situação das parcelas">
                  {(['ABERTA', 'PAGA', 'TODAS'] as const).map((s) => (
                    <button key={s} type="button" className={situacao === s ? 'segmento segmento-ativo' : 'segmento'} aria-pressed={situacao === s} onClick={() => setSituacao(s)}>
                      {s === 'ABERTA' ? 'Em aberto' : s === 'PAGA' ? 'Pagas' : 'Todas'}
                    </button>
                  ))}
                </div>
              }
              semEspaco
            >
              <div className="carnes-credito">
                <CreditoCarneCliente idCliente={cliente.id} versao={versaoCredito} />
              </div>
              <DataTable<ParcelaCarne>
                rotulo={`Parcelas de ${cliente.nome}`}
                carregando={parcelas.carregando}
                erro={parcelas.erro}
                aoTentarNovamente={parcelas.recarregar}
                linhas={parcelas.dados?.data}
                chaveLinha={(p) => p.id}
                linhasCarregando={4}
                vazio={{ titulo: situacao === 'ABERTA' ? 'Nenhuma parcela em aberto' : 'Nenhuma parcela' }}
                colunas={[
                  {
                    chave: 'sel',
                    titulo: '',
                    largura: '40px',
                    render: (p) =>
                      p.situacao === 'ABERTA' ? (
                        <input
                          type="checkbox"
                          className="caixa-tabela"
                          aria-label={`Selecionar parcela ${p.numeroParcela} de ${formatarData(p.vencimento)}`}
                          checked={selecionadas.some((s) => s.id === p.id)}
                          onChange={() => alternar(p)}
                        />
                      ) : null,
                  },
                  {
                    chave: 'parcela',
                    titulo: 'Parcela',
                    render: (p) => (
                      <div className="celula-principal">
                        <strong className="num">{p.numeroParcela}</strong>
                        <span className="num">{p.codigo}</span>
                      </div>
                    ),
                  },
                  { chave: 'compra', titulo: 'Compra', ocultarNoCelular: true, render: (p) => <span className="num">{formatarData(p.dataCompra)} · {formatarMoeda(p.valorTotalCompra)}</span> },
                  {
                    chave: 'venc',
                    titulo: 'Vencimento',
                    render: (p) =>
                      p.situacao === 'PAGA' ? (
                        <Badge tom="sucesso">Paga em {formatarData(p.dataPagamento)}</Badge>
                      ) : p.atrasada ? (
                        <Badge tom="perigo">Venceu {formatarData(p.vencimento)}</Badge>
                      ) : (
                        <span className="num">{formatarData(p.vencimento)}</span>
                      ),
                  },
                  { chave: 'valor', titulo: 'Valor', alinhar: 'direita', render: (p) => formatarMoeda(p.situacao === 'PAGA' ? p.valorPago : p.valorParcela) },
                ]}
              />
              {selecionadas.length ? (
                <div className="carnes-acao">
                  <span className="num">
                    {selecionadas.length} parcela(s) · <strong>{formatarMoeda(somarReais(selecionadas.map((p) => p.valorParcela)))}</strong>
                  </span>
                  <Button icone={<IoCashOutline />} onClick={() => setRecebendo(selecionadas)}>
                    Receber selecionadas
                  </Button>
                </div>
              ) : null}
            </Painel>
          ) : (
            <Painel>
              <p className="muted pequeno">Escolha um cliente na lista ou leia o código do carnê para ver as parcelas.</p>
            </Painel>
          )}
        </div>
      </div>

      {recebendo ? (
        <ModalRecebimento
          parcelas={recebendo}
          aoFechar={() => setRecebendo(null)}
          aoConcluir={(resultado) => {
            setRecebendo(null);
            setSelecionadas([]);
            setRecibo(resultado);
            notificar(`Recebido ${formatarMoeda(resultado.valorTotal)}.`);
            parcelas.recarregar();
            devedores.recarregar();
            setVersaoCredito((v) => v + 1);
          }}
        />
      ) : null}

      {recibo ? (
        <Modal
          aberto
          titulo="Pagamento recebido"
          descricao={`${formatarData(recibo.dataPagamento)} · ${recibo.parcelas[0]?.cliente?.nome ?? ''}`}
          aoFechar={() => setRecibo(null)}
          rodape={
            <>
              <Button variante="secundario" icone={<IoPrintOutline />} onClick={imprimir}>
                Imprimir recibo
              </Button>
              <Button onClick={() => setRecibo(null)}>Concluir</Button>
            </>
          }
        >
          <div className="area-impressao pilha">
            <ul className="revisao-lista">
              {recibo.parcelas.map((p) => (
                <li key={p.id}>
                  <span className="num">
                    Parcela {p.numeroParcela} · {p.codigo}
                    {p.juros ? ` · juros ${formatarMoeda(p.juros)}` : ''}
                    {p.desconto ? ` · desconto ${formatarMoeda(p.desconto)}` : ''}
                  </span>
                  <span className="num">{formatarMoeda(p.valorPago)}</span>
                </li>
              ))}
            </ul>
            <dl className="cupom-linhas">
              <div className="revisao-total">
                <dt>Total recebido</dt>
                <dd className="num">{formatarMoeda(recibo.valorTotal)}</dd>
              </div>
            </dl>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function ModalRecebimento({
  parcelas,
  aoFechar,
  aoConcluir,
}: {
  parcelas: ParcelaCarne[];
  aoFechar: () => void;
  aoConcluir: (resultado: ResultadoBaixa) => void;
}) {
  const [dataPagamento, setDataPagamento] = useState(hojeIso());
  const [ajustes, setAjustes] = useState<Record<number, { juros: string; desconto: string }>>({});
  const [falha, setFalha] = useState<string | null>(null);

  const valorDe = (p: ParcelaCarne) => {
    const ajuste = ajustes[p.id];
    return p.valorParcela + (lerNumero(ajuste?.juros ?? '') ?? 0) - (lerNumero(ajuste?.desconto ?? '') ?? 0);
  };
  const total = somarReais(parcelas.map(valorDe));

  const receber = useAcao(async () => {
    try {
      aoConcluir(
        await carneService.baixar({
          dataPagamento,
          parcelas: parcelas.map((p) => ({
            codigo: p.codigo!,
            juros: lerNumero(ajustes[p.id]?.juros ?? '') ?? undefined,
            desconto: lerNumero(ajustes[p.id]?.desconto ?? '') ?? undefined,
          })),
        }),
      );
    } catch (erro) {
      setFalha(mensagemErro(erro));
    }
  });

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    setFalha(null);
    if (parcelas.some((p) => valorDe(p) <= 0)) return setFalha('O desconto não pode zerar uma parcela.');
    void receber.executar();
  };

  const mudar = (id: number, campo: 'juros' | 'desconto', valor: string) =>
    setAjustes((atual) => ({ ...atual, [id]: { ...(atual[id] ?? { juros: '', desconto: '' }), [campo]: valor } }));

  return (
    <Modal
      aberto
      titulo="Receber parcelas"
      descricao={parcelas[0]?.cliente?.nome ?? undefined}
      aoFechar={aoFechar}
      tamanho="lg"
      rodape={
        <>
          <span className="rodape-esquerda num">
            Total a receber: <strong>{formatarMoeda(total)}</strong>
          </span>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-recebimento" carregando={receber.executando}>
            Confirmar recebimento
          </Button>
        </>
      }
    >
      <form id="form-recebimento" className="pilha" onSubmit={enviar} noValidate>
        {falha ? (
          <p className="aviso-faixa erro" role="alert">
            {falha}
          </p>
        ) : null}
        <Input rotulo="Data do pagamento" type="date" max={hojeIso()} value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className="campo-curto" />
        <DataTable<ParcelaCarne>
          rotulo="Parcelas a receber"
          linhas={parcelas}
          chaveLinha={(p) => p.id}
          colunas={[
            {
              chave: 'parcela',
              titulo: 'Parcela',
              render: (p) => (
                <div className="celula-principal">
                  <strong className="num">{p.numeroParcela}</strong>
                  <span className="num">
                    vence {formatarData(p.vencimento)} · {formatarMoeda(p.valorParcela)}
                  </span>
                </div>
              ),
            },
            {
              chave: 'juros',
              titulo: 'Juros/multa',
              render: (p) => (
                <input className="entrada entrada-tabela" inputMode="decimal" placeholder="0,00" aria-label={`Juros da parcela ${p.numeroParcela}`} value={ajustes[p.id]?.juros ?? ''} onChange={(e) => mudar(p.id, 'juros', e.target.value)} />
              ),
            },
            {
              chave: 'desconto',
              titulo: 'Desconto',
              render: (p) => (
                <input className="entrada entrada-tabela" inputMode="decimal" placeholder="0,00" aria-label={`Desconto da parcela ${p.numeroParcela}`} value={ajustes[p.id]?.desconto ?? ''} onChange={(e) => mudar(p.id, 'desconto', e.target.value)} />
              ),
            },
            { chave: 'valor', titulo: 'A receber', alinhar: 'direita', render: (p) => formatarMoeda(valorDe(p)) },
          ]}
        />
      </form>
    </Modal>
  );
}
