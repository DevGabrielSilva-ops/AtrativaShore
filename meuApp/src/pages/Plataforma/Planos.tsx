import { useState } from 'react';
import { IoAdd, IoCreateOutline } from 'react-icons/io5';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Estados';
import { Input, Textarea } from '../../components/ui/Field';
import { PageHeader, Painel } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAcao, useRequisicao } from '../../hooks/useRequisicao';
import { mensagemErro } from '../../services/api';
import { plataformaService } from '../../services/servicos';
import type { Plano } from '../../types/api';

export default function Planos() {
  const planos = useRequisicao(() => plataformaService.planos(), []);
  const [editando, setEditando] = useState<Plano | 'novo' | null>(null);
  return (
    <>
      <PageHeader
        titulo="Planos"
        descricao="Limites de uso por empresa. Não há cobrança automática nesta versão."
        acoes={
          <Button icone={<IoAdd />} onClick={() => setEditando('novo')}>
            Novo plano
          </Button>
        }
      />
      <Painel semEspaco>
        <DataTable<Plano>
          rotulo="Planos"
          carregando={planos.carregando}
          erro={planos.erro}
          aoTentarNovamente={planos.recarregar}
          linhas={planos.dados}
          chaveLinha={(p) => p.id}
          vazio={{ titulo: 'Nenhum plano cadastrado' }}
          colunas={[
            {
              chave: 'nome',
              titulo: 'Plano',
              render: (p) => (
                <div className="celula-principal">
                  <strong>{p.nome}</strong>
                  <span>{p.descricao ?? ''}</span>
                </div>
              ),
            },
            { chave: 'limite', titulo: 'Usuários ativos', alinhar: 'direita', render: (p) => <span className="num">{p.maxFuncionarios ?? 'Sem limite'}</span> },
            { chave: 'ativo', titulo: 'Situação', render: (p) => (p.ativo ? <Badge tom="sucesso">Disponível</Badge> : <Badge>Inativo</Badge>) },
            {
              chave: 'acoes',
              titulo: 'Ações',
              alinhar: 'direita',
              render: (p) => (
                <Button variante="fantasma" tamanho="sm" somenteIcone icone={<IoCreateOutline />} onClick={() => setEditando(p)}>
                  Editar
                </Button>
              ),
            },
          ]}
        />
      </Painel>
      {editando ? (
        <FormularioPlano
          plano={editando === 'novo' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            planos.recarregar();
          }}
        />
      ) : null}
    </>
  );
}

function FormularioPlano({ plano, aoFechar, aoSalvar }: { plano: Plano | null; aoFechar: () => void; aoSalvar: () => void }) {
  const { notificar } = useFeedback();
  const [nome, setNome] = useState(plano?.nome ?? '');
  const [descricao, setDescricao] = useState(plano?.descricao ?? '');
  const [limite, setLimite] = useState(plano?.maxFuncionarios ? String(plano.maxFuncionarios) : '');
  const [ativo, setAtivo] = useState(plano?.ativo ?? true);
  const [falha, setFalha] = useState<string | null>(null);
  const salvar = useAcao(async () => {
    if (!nome.trim()) return setFalha('Informe o nome do plano.');
    const dados = { nome: nome.trim(), descricao: descricao.trim() || undefined, maxFuncionarios: limite ? Number(limite) : null, ativo };
    try {
      if (plano) await plataformaService.atualizarPlano(plano.id, dados);
      else await plataformaService.criarPlano(dados);
      notificar(plano ? 'Plano atualizado.' : 'Plano criado.');
      aoSalvar();
    } catch (e) {
      setFalha(mensagemErro(e));
    }
  });
  return (
    <Modal
      aberto
      titulo={plano ? `Editar plano ${plano.nome}` : 'Novo plano'}
      aoFechar={aoFechar}
      tamanho="sm"
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar.executar()} carregando={salvar.executando}>
            Salvar plano
          </Button>
        </>
      }
    >
      <div className="pilha">
        {falha ? <p className="aviso-faixa erro">{falha}</p> : null}
        <Input rotulo="Nome" obrigatorio maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} />
        <Textarea rotulo="Descrição" maxLength={255} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <Input rotulo="Limite de usuários ativos" type="number" min={1} value={limite} onChange={(e) => setLimite(e.target.value)} ajuda="Vazio: sem limite." />
        <label className="caixa-selecao">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Disponível para novas empresas
        </label>
      </div>
    </Modal>
  );
}
