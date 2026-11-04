import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IoAdd } from 'react-icons/io5';
import { SegredoUnico } from '../../components/SegredoUnico';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Estados';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { PageHeader, Painel } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { SeletorBusca } from '../../components/SeletorBusca';
import { useFeedback } from '../../contexts/FeedbackContext';
import { usePagina } from '../../hooks/useEstadoReiniciado';
import { useAcao, useRequisicao } from '../../hooks/useRequisicao';
import { mensagemErro } from '../../services/api';
import { plataformaService } from '../../services/servicos';
import type { CodigoAtivacao, EmpresaPlataforma, SituacaoCodigo, TipoCodigo } from '../../types/api';
import { formatarDataHora } from '../../utils/formatar';
import { emailValido } from '../../utils/validar';
import { ROTULOS_SITUACAO_CODIGO, TOM_SITUACAO_CODIGO } from '../compartilhado';

const ROTULOS_TIPO: Record<TipoCodigo, string> = {
  NOVA_EMPRESA: 'Nova empresa',
  EMPRESA_EXISTENTE: 'Empresa cadastrada',
};

export default function Codigos() {
  const { confirmar, notificar } = useFeedback();
  const [parametros, setParametros] = useSearchParams();
  const [situacao, setSituacao] = useState<SituacaoCodigo | ''>('ATIVO');
  const [pagina, setPagina] = usePagina([situacao]);
  const [gerando, setGerando] = useState(() => parametros.get('novo') === '1');
  const [gerado, setGerado] = useState<string | null>(null);
  const lista = useRequisicao(
    () => plataformaService.codigos({ situacao: situacao || undefined, page: pagina, limit: 20 }),
    [situacao, pagina],
  );

  const revogar = async (codigo: CodigoAtivacao) => {
    const sim = await confirmar({
      titulo: `Revogar o código ${codigo.prefixo}…?`,
      mensagem: 'O código deixa de funcionar na hora. Contas já criadas com ele continuam ativas.',
      confirmar: 'Revogar',
      perigo: true,
    });
    if (!sim) return;
    try {
      await plataformaService.revogarCodigo(codigo.id);
      notificar('Código revogado.');
      lista.recarregar();
    } catch (e) {
      notificar(mensagemErro(e), 'erro');
    }
  };

  return (
    <>
      <PageHeader
        titulo="Códigos de ativação"
        descricao="Cada código é mostrado uma única vez. Aqui ficam só o início do código, a validade e o uso."
        acoes={
          <Button icone={<IoAdd />} onClick={() => setGerando(true)}>
            Gerar código
          </Button>
        }
      />
      <Painel semEspaco>
        <div className="barra-ferramentas">
          <div className="segmentado" role="group" aria-label="Situação">
            {(['ATIVO', 'USADO', 'EXPIRADO', 'REVOGADO', ''] as const).map((s) => (
              <button key={s || 'todos'} type="button" className={situacao === s ? 'segmento segmento-ativo' : 'segmento'} aria-pressed={situacao === s} onClick={() => setSituacao(s)}>
                {s ? ROTULOS_SITUACAO_CODIGO[s] : 'Todos'}
              </button>
            ))}
          </div>
        </div>
        <DataTable<CodigoAtivacao>
          rotulo="Códigos de ativação"
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarNovamente={lista.recarregar}
          linhas={lista.dados?.data}
          chaveLinha={(c) => c.id}
          vazio={{ titulo: 'Nenhum código nesta situação' }}
          colunas={[
            {
              chave: 'codigo',
              titulo: 'Código',
              render: (c) => (
                <div className="celula-principal">
                  <strong className="num">{c.prefixo}…</strong>
                  <span>{ROTULOS_TIPO[c.tipo]}{c.empresa?.nome ? ` · ${c.empresa.nome}` : ''}</span>
                </div>
              ),
            },
            { chave: 'situacao', titulo: 'Situação', render: (c) => <Badge tom={TOM_SITUACAO_CODIGO[c.situacao]}>{ROTULOS_SITUACAO_CODIGO[c.situacao]}</Badge> },
            { chave: 'uso', titulo: 'Usos', alinhar: 'direita', render: (c) => <span className="num">{c.usos}/{c.maxUsos}</span> },
            { chave: 'email', titulo: 'Restrito a', ocultarNoCelular: true, render: (c) => c.emailDestinatario ?? <span className="muted">Qualquer e-mail</span> },
            { chave: 'validade', titulo: 'Válido até', alinhar: 'direita', ocultarNoCelular: true, render: (c) => <span className="num">{formatarDataHora(c.expiraEm)}</span> },
            {
              chave: 'acoes',
              titulo: 'Ações',
              alinhar: 'direita',
              render: (c) =>
                c.situacao === 'ATIVO' ? (
                  <Button variante="fantasma" tamanho="sm" onClick={() => void revogar(c)}>
                    Revogar
                  </Button>
                ) : null,
            },
          ]}
        />
        <Pagination meta={lista.dados?.meta} aoMudar={setPagina} />
      </Painel>
      {gerando ? (
        <GerarCodigo
          aoFechar={() => {
            setGerando(false);
            if (parametros.get('novo')) setParametros({}, { replace: true });
          }}
          aoGerar={(codigo) => {
            setGerando(false);
            setGerado(codigo);
            lista.recarregar();
          }}
        />
      ) : null}
      {gerado ? (
        <SegredoUnico
          titulo="Código gerado"
          descricao="Entregue ao responsável pela empresa. Ele usa o código na tela de ativação."
          valor={gerado}
          aoFechar={() => setGerado(null)}
        />
      ) : null}
    </>
  );
}

function GerarCodigo({ aoFechar, aoGerar }: { aoFechar: () => void; aoGerar: (codigo: string) => void }) {
  const [tipo, setTipo] = useState<TipoCodigo>('NOVA_EMPRESA');
  const [empresa, setEmpresa] = useState<EmpresaPlataforma | null>(null);
  const [email, setEmail] = useState('');
  const [dias, setDias] = useState('7');
  const [usos, setUsos] = useState('1');
  const [observacao, setObservacao] = useState('');
  const [falha, setFalha] = useState<string | null>(null);

  const gerar = useAcao(async () => {
    if (tipo === 'EMPRESA_EXISTENTE' && !empresa) return setFalha('Escolha a empresa.');
    if (email.trim() && !emailValido(email.trim())) return setFalha('E-mail inválido.');
    try {
      const codigo = await plataformaService.gerarCodigo({
        tipo,
        idEmpresa: tipo === 'EMPRESA_EXISTENTE' ? empresa?.id : undefined,
        emailDestinatario: email.trim() || undefined,
        validadeDias: Number(dias) || 7,
        maxUsos: Number(usos) || 1,
        observacao: observacao.trim() || undefined,
      });
      aoGerar(codigo.codigo);
    } catch (e) {
      setFalha(mensagemErro(e));
    }
  });

  return (
    <Modal
      aberto
      titulo="Gerar código de ativação"
      aoFechar={aoFechar}
      tamanho="md"
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={() => void gerar.executar()} carregando={gerar.executando}>
            Gerar código
          </Button>
        </>
      }
    >
      <div className="pilha">
        {falha ? <p className="aviso-faixa erro">{falha}</p> : null}
        <Select rotulo="Para quem" value={tipo} onChange={(e) => setTipo(e.target.value as TipoCodigo)}>
          <option value="NOVA_EMPRESA">Nova empresa (o responsável cadastra a empresa)</option>
          <option value="EMPRESA_EXISTENTE">Empresa já cadastrada (cria o acesso do responsável)</option>
        </Select>
        {tipo === 'EMPRESA_EXISTENTE' ? (
          empresa ? (
            <div className="produto-escolhido">
              <strong>{empresa.nome}</strong>
              <Button variante="fantasma" tamanho="sm" onClick={() => setEmpresa(null)}>
                Trocar
              </Button>
            </div>
          ) : (
            <SeletorBusca<EmpresaPlataforma>
              rotulo="Empresa"
              rotuloVisivel
              buscar={async (termo) => (await plataformaService.empresas({ busca: termo, limit: 8 })).data}
              chave={(e) => e.id}
              renderizar={(e) => (
                <div className="celula-principal">
                  <strong>{e.nome}</strong>
                  <span>{e.cidade ?? e.email ?? ''}</span>
                </div>
              )}
              aoSelecionar={setEmpresa}
            />
          )
        ) : null}
        <Input rotulo="Restringir ao e-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} ajuda="Opcional. Só este e-mail poderá usar o código." />
        <div className="form-grade">
          <Input className="col-3" rotulo="Validade (dias)" type="number" min={1} max={365} value={dias} onChange={(e) => setDias(e.target.value)} />
          <Input className="col-3" rotulo="Usos permitidos" type="number" min={1} max={100} value={usos} onChange={(e) => setUsos(e.target.value)} />
        </div>
        <Textarea rotulo="Observação interna" maxLength={255} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      </div>
    </Modal>
  );
}
