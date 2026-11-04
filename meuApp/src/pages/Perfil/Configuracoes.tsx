import { Link } from 'react-router-dom';
import { IoCheckmarkCircle, IoWarningOutline } from 'react-icons/io5';
import { Badge } from '../../components/ui/Estados';
import { Detalhes, PageHeader, Painel } from '../../components/ui/Layout';
import { Skeleton } from '../../components/ui/Spinner';
import { useAuth } from '../../contexts/AuthContext';
import { useRequisicao } from '../../hooks/useRequisicao';
import { saudeService } from '../../services/servicos';
import { AlterarSenha } from './AlterarSenha';

export default function Configuracoes() {
  const { pode } = useAuth();
  return (
    <>
      <PageHeader titulo="Configurações" descricao="Senha de acesso e situação do banco de dados da empresa." />
      <div className="grade-2">
        <AlterarSenha />
        <div className="pilha">
          <EstadoSistema />
          {pode('empresa.configurar') ? (
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

function EstadoSistema() {
  const estado = useRequisicao(() => saudeService.estadoEmpresa(), []);
  const m = estado.dados?.migrations;
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
    <Painel titulo="Banco de dados da empresa" descricao={import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'}>
      {estado.erro ? (
        <p className="aviso-faixa erro">{estado.erro}</p>
      ) : !m ? (
        <Skeleton altura={80} />
      ) : (
        <Detalhes
          itens={[
            { rotulo: 'Conexão', valor: <Badge tom="sucesso">Conectado</Badge> },
            { rotulo: 'Transações (InnoDB)', valor: ok(m.tabelasInnodb, 'Ativas') },
            { rotulo: 'Pagamento Pix', valor: ok(m.colunaVrPix, 'Disponível') },
            { rotulo: 'Limite do carnê', valor: ok(m.colunaLimiteCarne, 'Ativo') },
          ]}
        />
      )}
      {m && (!m.tabelasInnodb || !m.colunaVrPix || !m.colunaLimiteCarne) ? (
        <p className="pequeno muted">Itens pendentes dependem das migrations do servidor (npm run empresas:migrar).</p>
      ) : null}
    </Painel>
  );
}
