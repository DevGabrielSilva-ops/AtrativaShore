import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { Painel } from '../../components/ui/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAcao } from '../../hooks/useRequisicao';
import { ApiError, mensagemErro } from '../../services/api';
import { authService } from '../../services/servicos';

export function AlterarSenha({
  titulo = 'Alterar senha',
  descricao = 'Ao trocar a senha, as outras sessões abertas com a sua conta são encerradas.',
  aoConcluir,
}: {
  titulo?: string;
  descricao?: string;
  aoConcluir?: () => void;
}) {
  const { notificar } = useFeedback();
  const { aplicarSessao } = useAuth();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erros, setErros] = useState<{ atual?: string; nova?: string; confirmacao?: string }>({});

  const salvar = useAcao(async () => {
    try {
      const sessao = await authService.alterarSenha(atual, nova);
      aplicarSessao(sessao);
      notificar('Senha alterada.');
      setAtual('');
      setNova('');
      setConfirmacao('');
      aoConcluir?.();
    } catch (erro) {
      if (erro instanceof ApiError && erro.status === 401) setErros({ atual: 'Senha atual incorreta.' });
      else notificar(mensagemErro(erro), 'erro');
    }
  });

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const novos: typeof erros = {};
    if (!atual) novos.atual = 'Informe a senha atual.';
    if (nova.length < 8) novos.nova = 'Mínimo de 8 caracteres.';
    else if (nova.length > 72) novos.nova = 'Máximo de 72 caracteres.';
    else if (nova === atual) novos.nova = 'A nova senha deve ser diferente da atual.';
    if (confirmacao !== nova) novos.confirmacao = 'As senhas não conferem.';
    setErros(novos);
    if (Object.keys(novos).length === 0) void salvar.executar();
  };

  return (
    <Painel titulo={titulo} descricao={descricao}>
      <form className="pilha" onSubmit={enviar} noValidate>
        <Input rotulo="Senha atual" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} erro={erros.atual} />
        <Input rotulo="Nova senha" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} erro={erros.nova} ajuda="Entre 8 e 72 caracteres." />
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
