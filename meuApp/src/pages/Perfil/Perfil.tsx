import { Link, useNavigate } from 'react-router-dom';
import { IoKeyOutline, IoLogOutOutline } from 'react-icons/io5';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Estados';
import { Detalhes, PageHeader, Painel } from '../../components/ui/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useRequisicao } from '../../hooks/useRequisicao';
import { authService, funcionarioService } from '../../services/servicos';
import { formatarDataHora } from '../../utils/formatar';
import { ROTULOS_PAPEL } from '../compartilhado';

export default function Perfil() {
  const { usuario, sair, plataforma, pode } = useAuth();
  const { confirmar } = useFeedback();
  const navegar = useNavigate();
  const eu = useRequisicao(() => authService.me(), []);
  const catalogo = useRequisicao(() => funcionarioService.catalogo(), [], !plataforma && pode('funcionarios.consultar'));
  const u = eu.dados ?? usuario;

  const sairAgora = async () => {
    if (await confirmar({ titulo: 'Sair do sistema?', mensagem: 'Você precisará entrar novamente.', confirmar: 'Sair' })) {
      sair('manual');
      navegar('/login', { replace: true });
    }
  };

  const descricoes = new Map(catalogo.dados?.permissoes.map((p) => [p.id, p.descricao]));

  return (
    <>
      <PageHeader titulo="Meu perfil" descricao="Seus dados de acesso e o que o seu cargo permite fazer." />
      <div className="grade-2">
        <Painel titulo={u?.nome ?? 'Usuário'} acoes={u ? <Badge tom="marca">{u.cargo ?? ROTULOS_PAPEL[u.papel]}</Badge> : null}>
          <Detalhes
            itens={[
              { rotulo: 'E-mail', valor: u?.email },
              { rotulo: 'Usuário de acesso', valor: u?.login },
              { rotulo: 'Papel', valor: u ? ROTULOS_PAPEL[u.papel] : null },
              { rotulo: 'Cargo', valor: u?.cargo ?? 'Padrão do papel' },
              { rotulo: 'Empresa', valor: u?.empresa?.nome ?? 'Administração da plataforma' },
            ]}
          />
          <div className="form-acoes">
            <Button variante="fantasma" icone={<IoLogOutOutline />} onClick={sairAgora}>
              Sair
            </Button>
            <Link to={plataforma ? '/plataforma/senha' : '/configuracoes'} className="btn btn-secundario btn-md">
              <IoKeyOutline aria-hidden /> Alterar senha
            </Link>
          </div>
        </Painel>
        {!plataforma ? (
          <Painel titulo="Permissões" descricao="Definidas pelo administrador da empresa. Peça a ele se precisar de outro acesso.">
            {u?.permissoes.length ? (
              <ul className="lista-permissoes">
                {u.permissoes.map((p) => (
                  <li key={p}>{descricoes.get(p) ?? p}</li>
                ))}
              </ul>
            ) : (
              <p className="muted pequeno">Nenhuma permissão comercial.</p>
            )}
          </Painel>
        ) : (
          <Painel titulo="Acesso">
            <p className="muted pequeno">
              Superadministrador: gerencia empresas, códigos de ativação, planos e administradores. Não acessa os dados
              comerciais das empresas.
            </p>
            {eu.dados ? <p className="pequeno muted">Sessão atualizada em {formatarDataHora(new Date().toISOString())}.</p> : null}
          </Painel>
        )}
      </div>
    </>
  );
}
