import { IoPrintOutline } from 'react-icons/io5';
import { useRequisicao } from '../hooks/useRequisicao';
import { clienteService, empresaService } from '../services/servicos';
import type { Cliente, Empresa, VendaDetalhe } from '../types/api';
import { imprimirRecibo } from '../utils/exportar';
import { formatarData, formatarDocumento, formatarMoeda, formatarNumero, formatarTelefone } from '../utils/formatar';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

const LINHAS_MINIMAS = 8;

function Linha({ rotulo, valor, largo = false }: { rotulo: string; valor: string | null | undefined; largo?: boolean }) {
  return (
    <div className={`recibo-campo${largo ? ' recibo-campo-largo' : ''}`}>
      <span className="recibo-campo-rotulo">{rotulo}</span>
      <span className="recibo-campo-valor">{valor || ''}</span>
    </div>
  );
}

export function FolhaRecibo({ venda, empresa, cliente }: { venda: VendaDetalhe; empresa: Empresa | null; cliente: Cliente | null }) {
  const enderecoEmpresa = [empresa?.endereco, empresa?.bairro, [empresa?.cidade, empresa?.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ');
  const contatos = [empresa?.telefone ? formatarTelefone(empresa.telefone) : null, empresa?.email, empresa?.site].filter(Boolean).join(' | ');
  const enderecoCliente = cliente
    ? [cliente.endereco, cliente.bairro, [cliente.cidade, cliente.uf].filter(Boolean).join('/')].filter(Boolean).join(', ')
    : null;
  const telefoneCliente = cliente?.celular ?? cliente?.telefone ?? null;
  const vazias = Math.max(0, LINHAS_MINIMAS - venda.itens.length - venda.itensTroca.length);
  const formas = (
    [
      ['Dinheiro', venda.pagamentos.dinheiro],
      ['Pix', venda.pagamentos.pix],
      ['Cartão', venda.pagamentos.cartao],
      ['Carnê', venda.pagamentos.carne],
    ] as const
  ).filter(([, valor]) => valor > 0);

  return (
    <article className="recibo-folha" aria-label={`Recibo da venda ${venda.controle}`}>
      <header className="recibo-cabecalho">
        <div className="recibo-loja">
          <p className="recibo-loja-nome">{empresa?.nome ?? 'Atrativa Shore'}</p>
          {empresa?.cnpj ? <p className="recibo-loja-doc">CNPJ {formatarDocumento(empresa.cnpj)}</p> : null}
          {contatos ? <p>{contatos}</p> : null}
          {enderecoEmpresa ? <p>{enderecoEmpresa}</p> : null}
        </div>
        <img className="recibo-logo" src="/logo.svg" alt="Atrativa Shore" />
      </header>

      <div className="recibo-titulo">
        <h2>Recibo de venda</h2>
        <dl>
          <div>
            <dt>Nº</dt>
            <dd className="num">{venda.id}</dd>
          </div>
          <div>
            <dt>Data</dt>
            <dd className="num">
              {formatarData(venda.data)} {venda.hora?.slice(0, 5)}
            </dd>
          </div>
        </dl>
      </div>

      <section className="recibo-cliente" aria-label="Cliente">
        <Linha rotulo="Nome" valor={venda.cliente?.nome ?? 'Consumidor'} largo />
        <Linha rotulo="Endereço" valor={enderecoCliente} largo />
        <Linha rotulo="CPF/CNPJ" valor={cliente?.cpf ? formatarDocumento(cliente.cpf) : null} />
        <Linha rotulo="Telefone" valor={telefoneCliente ? formatarTelefone(telefoneCliente) : null} />
      </section>

      <table className="recibo-itens">
        <thead>
          <tr>
            <th scope="col" className="recibo-qtd">
              Qtd
            </th>
            <th scope="col">Descrição</th>
            <th scope="col" className="recibo-num">
              V. unit
            </th>
            <th scope="col" className="recibo-num">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {venda.itens.map((item) => (
            <tr key={item.id}>
              <td className="recibo-qtd num">{formatarNumero(item.quantidade)}</td>
              <td>{item.produto}</td>
              <td className="recibo-num num">{formatarMoeda(item.valorUnitario)}</td>
              <td className="recibo-num num">{formatarMoeda(item.valorTotal)}</td>
            </tr>
          ))}
          {venda.itensTroca.map((item) => (
            <tr key={`troca-${item.id}`} className="recibo-troca">
              <td className="recibo-qtd num">{formatarNumero(item.quantidade)}</td>
              <td>Devolução: {item.produto}</td>
              <td className="recibo-num num">{formatarMoeda(item.valorUnitario)}</td>
              <td className="recibo-num num">− {formatarMoeda(item.valorTotal)}</td>
            </tr>
          ))}
          {Array.from({ length: vazias }, (_, i) => (
            <tr key={`vazia-${i}`} className="recibo-vazia" aria-hidden>
              <td />
              <td />
              <td />
              <td />
            </tr>
          ))}
        </tbody>
      </table>

      <div className="recibo-rodape-valores">
        <div className="recibo-pagamento">
          {formas.length ? (
            <>
              <p className="recibo-subtitulo">Forma de pagamento</p>
              <ul>
                {formas.map(([nome, valor]) => (
                  <li key={nome}>
                    <span>{nome}</span>
                    <span className="num">{formatarMoeda(valor)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {venda.parcelasCarne.length ? (
            <>
              <p className="recibo-subtitulo">Parcelas do carnê</p>
              <ul className="recibo-parcelas">
                {venda.parcelasCarne.map((parcela) => (
                  <li key={parcela.parcela}>
                    <span className="num">
                      {parcela.parcela}/{venda.parcelasCarne.length} · vence {formatarData(parcela.vencimento)}
                    </span>
                    <span className="num">{formatarMoeda(parcela.valor)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
        <dl className="recibo-totais">
          {venda.desconto > 0 || venda.creditoTroca > 0 ? (
            <div>
              <dt>Subtotal</dt>
              <dd className="num">{formatarMoeda(venda.subtotalItens)}</dd>
            </div>
          ) : null}
          {venda.creditoTroca > 0 ? (
            <div>
              <dt>Crédito de troca</dt>
              <dd className="num">− {formatarMoeda(venda.creditoTroca)}</dd>
            </div>
          ) : null}
          {venda.desconto > 0 ? (
            <div>
              <dt>Desconto</dt>
              <dd className="num">− {formatarMoeda(venda.desconto)}</dd>
            </div>
          ) : null}
          <div className="recibo-total">
            <dt>Total R$</dt>
            <dd className="num">{formatarMoeda(venda.total).replace(/^R\$\s?/, '')}</dd>
          </div>
        </dl>
      </div>

      <footer className="recibo-fim">
        {venda.parcelasCarne.length ? (
          <div className="recibo-assinatura">
            <span />
            <p>Assinatura do cliente</p>
          </div>
        ) : null}
        <p className="recibo-mensagem">{empresa?.mensagem ?? 'Obrigado pela preferência!'}</p>
        <p className="recibo-meta num">
          Controle {venda.controle}
          {venda.vendedor?.login ? ` · Vendedor ${venda.vendedor.login}` : ''}
          {venda.estornada ? ' · VENDA ESTORNADA' : ''} · Documento sem valor fiscal
        </p>
      </footer>
    </article>
  );
}

export function ReciboVenda({ venda, aoFechar }: { venda: VendaDetalhe; aoFechar: () => void }) {
  const empresa = useRequisicao(() => empresaService.obter(), []);
  const idCliente = venda.cliente?.id ?? 0;
  const cliente = useRequisicao(() => clienteService.obter(idCliente).catch(() => null), [idCliente], idCliente > 0);
  const carregando = empresa.carregando || (idCliente > 0 && cliente.carregando);
  return (
    <Modal
      aberto
      titulo="Recibo de venda"
      descricao="Folha A5 (meia folha A4). Ajuste a impressora para A5 ou imprima em A4 sem redimensionar."
      aoFechar={aoFechar}
      tamanho="lg"
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Fechar
          </Button>
          <Button icone={<IoPrintOutline />} disabled={carregando} onClick={imprimirRecibo}>
            Imprimir recibo
          </Button>
        </>
      }
    >
      <div className="recibo-previa">
        <FolhaRecibo venda={venda} empresa={empresa.dados} cliente={cliente.dados} />
      </div>
    </Modal>
  );
}
