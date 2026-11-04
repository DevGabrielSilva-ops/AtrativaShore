import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { IoCheckmarkCircle, IoWarningOutline } from 'react-icons/io5';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Estados';
import { Input } from '../../components/ui/Field';
import { Detalhes, PageHeader, Painel } from '../../components/ui/Layout';
import { Skeleton } from '../../components/ui/Spinner';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAcao, useRequisicao } from '../../hooks/useRequisicao';
import { ApiError, mensagemErro } from '../../services/api';
import { authService, saudeService } from '../../services/servicos';

export default function Configuracoes() {
  const { usuario } = useAuth();
  return (
    <>
      <PageHeader titulo="Configurações" descricao="Senha de acesso e situação da conexão com o servidor." />
      <div className="grade-2">
        <AlterarSenha />
        <div className="pilha">
          <EstadoSistema />
          {usuario?.administrador ? (
            <Painel titulo="Dados da empresa">
              <p className="muted pequeno">Nome, endereço, desconto máximo e mensagem do comprovante.</p>
              <div className="form-acoes">
                <Link to="/empresa" className="btn btn-secundario btn-md">
                  Abrir dados da empresa
                </Link>
              </div>
            </Painel>
          ) : null}
        </div>
      </div>
    </>
  );
}

function AlterarSenha() {
  const { notificar } = useFeedback();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erros, setErros] = useState<{ atual?: string; nova?: string; confirmacao?: string }>({});

  const salvar = useAcao(async () => {
    try {
      await authService.alterarSenha(atual, nova);
      notificar('Senha alterada. Use a nova senha no próximo acesso.');
      setAtual('');
      setNova('');
      setConfirmacao('');
    } catch (erro) {
      if (erro instanceof ApiError && erro.status === 401) setErros({ atual: 'Senha atual incorreta.' });
      else notificar(mensagemErro(erro), 'erro');
    }
  });

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const novos: typeof erros = {};
    if (!atual) novos.atual = 'Informe a senha atual.';
    if (nova.length < 6) novos.nova = 'Mínimo de 6 caracteres.';
    else if (nova.length > 72) novos.nova = 'Máximo de 72 caracteres.';
    else if (nova === atual) novos.nova = 'A nova senha deve ser diferente da atual.';
    if (confirmacao !== nova) novos.confirmacao = 'As senhas não conferem.';
    setErros(novos);
    if (Object.keys(novos).length === 0) void salvar.executar();
  };

  return (
    <Painel titulo="Alterar senha" descricao="Vale para este sistema. A senha do programa antigo da loja não muda.">
      <form className="pilha" onSubmit={enviar} noValidate>
        <Input rotulo="Senha atual" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} erro={erros.atual} />
        <Input rotulo="Nova senha" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} erro={erros.nova} ajuda="Entre 6 e 72 caracteres." />
        <Input rotulo="Confirme a nova senha" type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} erro={erros.confirmacao} />
        <div className="form-acoes">
          <Button type="submit" carregando={salvar.executando}>
            Alterar senha
          </Button>
        </div>
      </form>
    </Painel>
  );
}

function EstadoSistema() {
  const saude = useRequisicao(() => saudeService.verificar(), []);
  const m = saude.dados?.migrations;
  const ok = (valor: boolean | undefined, texto: string) =>
    valor ? (
      <Badge tom="sucesso">
        <IoCheckmarkCircle aria-hidden /> {texto}
      </Badge>
    ) : (
      <Badge tom="aviso">
        <IoWarningOutline aria-hidden /> Pendente
      </Badge>
    );
  return (
    <Painel titulo="Conexão com o servidor" descricao={import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'}>
      {saude.erro ? (
        <p className="aviso-faixa erro">{saude.erro}</p>
      ) : !m ? (
        <Skeleton altura={80} />
      ) : (
        <Detalhes
          itens={[
            { rotulo: 'Banco de dados', valor: <Badge tom="sucesso">Conectado</Badge> },
            { rotulo: 'Transações (InnoDB)', valor: ok(m.tabelasInnodb, 'Ativas') },
            { rotulo: 'Senhas protegidas', valor: ok(m.apiCredencial, 'Ativas') },
            { rotulo: 'Pagamento Pix', valor: ok(m.colunaVrPix, 'Disponível') },
            { rotulo: 'Limite do carnê', valor: ok(m.colunaLimiteCarne, 'Ativo') },
          ]}
        />
      )}
      {m && (!m.tabelasInnodb || !m.apiCredencial || !m.colunaVrPix || !m.colunaLimiteCarne) ? (
        <p className="pequeno muted">Itens pendentes dependem das migrations do servidor (npm run migration:run).</p>
      ) : null}
    </Painel>
  );
}
