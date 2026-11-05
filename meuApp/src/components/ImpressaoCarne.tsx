import { useEffect, type ReactNode } from 'react';
import { IoPrintOutline } from 'react-icons/io5';
import { useRequisicao } from '../hooks/useRequisicao';
import { carneService } from '../services/servicos';
import type { ImpressaoCarne as DadosImpressao, ParcelaCarne } from '../types/api';
import { imprimirCarne } from '../utils/exportar';
import { formatarData, formatarDocumento, formatarMoeda, formatarTelefone } from '../utils/formatar';
import { CodigoBarras } from './CodigoBarras';
import { Button } from './ui/Button';
import { EstadoErro } from './ui/Estados';
import { Modal } from './ui/Modal';
import { Skeleton } from './ui/Spinner';

const POR_FOLHA = 2;

const percentual = (valor: number) => `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}%`;

function Celula({ rotulo, children, className = '' }: { rotulo: string; children?: ReactNode; className?: string }) {
  return (
    <div className={`carne-celula ${className}`}>
      <span className="carne-rotulo">{rotulo}</span>
      <span className="carne-valor">{children}</span>
    </div>
  );
}

function Via({ dados, parcela }: { dados: DadosImpressao; parcela: ParcelaCarne }) {
  const { empresa, config, venda, cliente } = dados;
  const sequencia = venda.id ?? venda.controle;
  const paga = parcela.situacao === 'PAGA';
  const endereco = [empresa.endereco, empresa.bairro, [empresa.cidade, empresa.uf].filter(Boolean).join('-')].filter(Boolean).join(' - ');
  const comEncargos = config.jurosDia > 0;
  return (
    <article className="carne-via">
      <div className="carne-canhoto">
        <Celula rotulo="Sequência">{sequencia}</Celula>
        <Celula rotulo="Parc">{parcela.numeroParcela}</Celula>
        <Celula rotulo="Emissão">{formatarData(venda.data)}</Celula>
        <Celula rotulo="Vencimento" className="carne-forte">
          {formatarData(parcela.vencimento)}
        </Celula>
        <Celula rotulo="Valor" className="carne-largo carne-forte">
          {formatarMoeda(parcela.valorParcela)}
        </Celula>
        <Celula rotulo="Total pago" className="carne-largo carne-alto">
          {paga ? formatarMoeda(parcela.valorPago) : ''}
        </Celula>
        <Celula rotulo="Autenticação" className="carne-largo carne-autenticacao">
          {paga ? `Pago em ${formatarData(parcela.dataPagamento)}` : ''}
        </Celula>
      </div>
      <div className="carne-recibo">
        <Celula rotulo="Nome do cliente" className="carne-cliente carne-forte">
          {cliente?.nome ?? 'Consumidor'}
        </Celula>
        <div className="carne-linha-dados">
          <Celula rotulo="Código do cliente">{cliente?.id ?? ''}</Celula>
          <Celula rotulo="Parc">{parcela.numeroParcela}</Celula>
          <Celula rotulo="Sequência">{sequencia}</Celula>
          <Celula rotulo="CPF/CNPJ">{formatarDocumento(cliente?.documento ?? null)}</Celula>
          <Celula rotulo="Emissão">{formatarData(venda.data)}</Celula>
          <Celula rotulo="Vencimento" className="carne-forte">
            {formatarData(parcela.vencimento)}
          </Celula>
        </div>
        <div className="carne-corpo">
          <div className="carne-empresa">
            <p className="carne-empresa-nome">{empresa.nome ?? 'Atrativa Shore'}</p>
            {empresa.cnpj ? <p className="carne-empresa-cnpj">{formatarDocumento(empresa.cnpj)}</p> : null}
            {endereco ? <p className="carne-empresa-endereco">{endereco}</p> : null}
            {comEncargos ? (
              <>
                <p>Juros: {percentual(config.jurosDia)} ao dia de atraso</p>
              </>
            ) : (
              <p>Pague até o vencimento.</p>
            )}
            {empresa.telefone ? <p>Fone: {formatarTelefone(empresa.telefone)}</p> : null}
            {paga ? <p className="carne-carimbo">PAGA EM {formatarData(parcela.dataPagamento)}</p> : null}
          </div>
          <div className="carne-valores">
            <Celula rotulo="Valor" className="carne-forte">
              {formatarMoeda(parcela.valorParcela)}
            </Celula>
            <Celula rotulo="Juros">{paga && parcela.juros ? formatarMoeda(parcela.juros) : ''}</Celula>
            <Celula rotulo="Desconto">{paga && parcela.desconto ? formatarMoeda(parcela.desconto) : ''}</Celula>
            <Celula rotulo="Total" className="carne-forte">
              {paga ? formatarMoeda(parcela.valorPago) : ''}
            </Celula>
          </div>
        </div>
        {parcela.codigo ? (
          <div className="carne-codigo">
            <span className="num">{parcela.codigo}</span>
            <CodigoBarras valor={parcela.codigo} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function FolhasCarne({ dados }: { dados: DadosImpressao }) {
  const folhas: ParcelaCarne[][] = [];
  for (let i = 0; i < dados.parcelas.length; i += POR_FOLHA) folhas.push(dados.parcelas.slice(i, i + POR_FOLHA));
  return (
    <div className="carne-folhas">
      {folhas.map((parcelas, indice) => (
        <section key={parcelas[0].id} className="carne-folha" aria-label={`Folha ${indice + 1} de ${folhas.length}`}>
          {parcelas.map((parcela) => (
            <Via key={parcela.id} dados={dados} parcela={parcela} />
          ))}
        </section>
      ))}
    </div>
  );
}

export function ImprimirCarne({ controle, aoFechar, imprimirAoAbrir = false }: { controle: string; aoFechar: () => void; imprimirAoAbrir?: boolean }) {
  const dados = useRequisicao(() => carneService.impressao(controle), [controle]);
  const pronto = dados.dados !== null && !dados.carregando;
  useEffect(() => {
    if (pronto && imprimirAoAbrir) {
      const id = window.setTimeout(imprimirCarne, 300);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [pronto, imprimirAoAbrir]);
  const total = dados.dados?.parcelas.length ?? 0;
  return (
    <Modal
      aberto
      titulo="Carnê"
      descricao={
        dados.dados
          ? `${dados.dados.cliente?.nome ?? 'Consumidor'} · ${total} parcela${total > 1 ? 's' : ''} · ${Math.ceil(total / POR_FOLHA)} folha(s) A4`
          : undefined
      }
      aoFechar={aoFechar}
      tamanho="lg"
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Fechar
          </Button>
          <Button icone={<IoPrintOutline />} disabled={!pronto} onClick={imprimirCarne}>
            Imprimir carnê
          </Button>
        </>
      }
    >
      {dados.erro ? (
        <EstadoErro mensagem={dados.erro} aoTentarNovamente={dados.recarregar} />
      ) : !dados.dados ? (
        <Skeleton altura={260} />
      ) : (
        <div className="carne-previa">
          <FolhasCarne dados={dados.dados} />
        </div>
      )}
    </Modal>
  );
}
