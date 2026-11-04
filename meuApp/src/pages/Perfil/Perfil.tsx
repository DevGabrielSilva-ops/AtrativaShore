import { Link, useNavigate } from 'react-router-dom';
import { IoKeyOutline, IoLogOutOutline } from 'react-icons/io5';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Estados';
import { Detalhes, PageHeader, Painel } from '../../components/ui/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useRequisicao } from '../../hooks/useRequisicao';
import { authService, empresaService } from '../../services/servicos';
import { formatarDocumento } from '../../utils/formatar';

export default function Perfil() {
  const { usuario, sair } = useAuth();
  const { confirmar } = useFeedback();
  const navegar = useNavigate();
  // Consulta o backend para mostrar o perfil atual (não só o salvo no login).
  const eu = useRequisicao(() => authService.me(), []);
  const empresa = useRequisicao(() => empresaService.obter(), []);
  const u = eu.dados ?? usuario;

  const sairAgora = async () => {
    if (await confirmar({ titulo: 'Sair do sistema?', mensagem: 'Você precisará entrar novamente.', confirmar: 'Sair' })) {
      sair('manual');
      navegar('/login', { replace: true });
    }
  };

  return (
    <>
      <PageHeader titulo="Meu perfil" descricao="Seus dados de acesso ao sistema." />
      <div className="grade-2">
        <Painel
          titulo="Usuário"
          acoes={u?.administrador ? <Badge tom="marca">Administrador</Badge> : <Badge>{u?.perfil ?? 'Usuário'}</Badge>}
        >
          <Detalhes
            itens={[
              { rotulo: 'Login', valor: u?.login },
              { rotulo: 'Perfil de acesso', valor: u?.perfil },
              { rotulo: 'Código do usuário', valor: u?.id },
              {
                rotulo: 'Permissões especiais',
                valor: u?.administrador ? 'Estornar vendas, ajustar estoque, editar empresa' : 'Nenhuma',
              },
            ]}
          />
          <div className="form-acoes">
            <Button variante="fantasma" icone={<IoLogOutOutline />} onClick={sairAgora}>
              Sair
            </Button>
            <Link to="/configuracoes" className="btn btn-secundario btn-md">
              <IoKeyOutline aria-hidden /> Alterar senha
            </Link>
          </div>
        </Painel>
        <Painel titulo="Empresa" acoes={<Link to="/empresa" className="link-pequeno">Ver dados</Link>}>
          <Detalhes
            itens={[
              { rotulo: 'Nome', valor: empresa.dados?.nome },
              { rotulo: 'CNPJ/CPF', valor: formatarDocumento(empresa.dados?.cnpj) },
              { rotulo: 'Cidade', valor: empresa.dados?.cidade ? `${empresa.dados.cidade}/${empresa.dados.uf ?? ''}` : null },
            ]}
          />
        </Painel>
      </div>
    </>
  );
}
