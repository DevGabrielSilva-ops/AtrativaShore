import { Link, useNavigate } from 'react-router-dom';
import { IoAdd, IoKeyOutline } from 'react-icons/io5';
import { BarraSegmentada } from '../../components/charts/Graficos';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Badge, EstadoErro } from '../../components/ui/Estados';
import { Indicador, PageHeader, Painel } from '../../components/ui/Layout';
import { Skeleton } from '../../components/ui/Spinner';
import { useAuth } from '../../contexts/AuthContext';
import { useRequisicao } from '../../hooks/useRequisicao';
import { plataformaService } from '../../services/servicos';
import type { EmpresaPlataforma } from '../../types/api';
import { formatarData, formatarInteiro } from '../../utils/formatar';
import { ROTULOS_PAPEL, ROTULOS_STATUS_EMPRESA, TOM_STATUS_EMPRESA } from '../compartilhado';

export default function VisaoGeral() {
  const { usuario } = useAuth();
  const navegar = useNavigate();
  const dados = useRequisicao(() => plataformaService.indicadores(), []);
  const d = dados.dados;

  return (
    <div className="pilha">
      <PageHeader
        titulo={`Olá, ${usuario?.nome.split(' ')[0] ?? ''}`}
        descricao="Empresas que usam o Atrativa Shore, acessos e ativações."
        acoes={
          <>
            <Button variante="secundario" icone={<IoKeyOutline />} onClick={() => navegar('/plataforma/codigos?novo=1')}>
              Gerar código
            </Button>
            <Button icone={<IoAdd />} onClick={() => navegar('/plataforma/empresas?novo=1')}>
              Cadastrar empresa
            </Button>
          </>
        }
      />
      {dados.erro ? (
        <Painel>
          <EstadoErro mensagem={dados.erro} aoTentarNovamente={dados.recarregar} />
        </Painel>
      ) : (
        <>
          <div className="indicadores">
            <Indicador rotulo="Empresas" carregando={!d} valor={formatarInteiro(d?.empresas.total)} nota={d ? `${formatarInteiro(d.empresas.ACTIVE)} ativas` : null} />
            <Indicador
              rotulo="Suspensas ou vencidas"
              carregando={!d}
              valor={formatarInteiro(d ? d.empresas.SUSPENDED + d.empresas.EXPIRED : null)}
              nota={d && d.empresas.PENDING ? `${formatarInteiro(d.empresas.PENDING)} aguardando ativação` : null}
              tom={d && d.empresas.SUSPENDED + d.empresas.EXPIRED > 0 ? 'alerta' : undefined}
            />
            <Indicador rotulo="Usuários das empresas" carregando={!d} valor={formatarInteiro(d?.usuarios.total)} nota={d ? `${formatarInteiro(d.usuarios.ativos)} ativos` : null} />
            <Indicador rotulo="Ativações realizadas" carregando={!d} valor={formatarInteiro(d?.ativacoes)} nota={d ? `${formatarInteiro(d.codigosAtivos)} códigos disponíveis` : null} />
          </div>
          <div className="dash-grade">
            <Painel
              semEspaco
              titulo="Empresas recentes"
              acoes={
                <Link to="/plataforma/empresas" className="link-pequeno">
                  Ver todas
                </Link>
              }
            >
              <DataTable<EmpresaPlataforma>
                rotulo="Empresas recentes"
                carregando={!d}
                linhas={d?.empresasRecentes}
                chaveLinha={(e) => e.id}
                aoClicarLinha={(e) => navegar(`/plataforma/empresas?empresa=${e.id}`)}
                vazio={{ titulo: 'Nenhuma empresa cadastrada', descricao: 'Gere um código de ativação para a primeira empresa.' }}
                colunas={[
                  { chave: 'nome', titulo: 'Empresa', render: (e) => <strong>{e.nome}</strong> },
                  { chave: 'status', titulo: 'Situação', render: (e) => <Badge tom={TOM_STATUS_EMPRESA[e.status]}>{ROTULOS_STATUS_EMPRESA[e.status]}</Badge> },
                  { chave: 'usuarios', titulo: 'Usuários', alinhar: 'direita', render: (e) => <span className="num">{e.usuariosAtivos}</span> },
                  { chave: 'data', titulo: 'Cadastro', alinhar: 'direita', ocultarNoCelular: true, render: (e) => <span className="num">{formatarData(e.criadaEm)}</span> },
                ]}
              />
            </Painel>
            <Painel titulo="Usuários por papel" descricao="Contas das empresas, ativas e desativadas">
              {!d ? (
                <Skeleton altura={120} />
              ) : (
                <BarraSegmentada
                  rotulo="Usuários por papel"
                  formatar={(v) => formatarInteiro(v)}
                  partes={(['COMPANY_ADMIN', 'MANAGER', 'SELLER', 'STOCK_OPERATOR'] as const).map((papel, i) => ({
                    nome: ROTULOS_PAPEL[papel],
                    valor: d.usuarios.porPapel[papel] ?? 0,
                    cor: ['var(--serie-dinheiro)', 'var(--serie-pix)', 'var(--serie-cartao)', 'var(--serie-carne)'][i],
                  }))}
                />
              )}
            </Painel>
          </div>
        </>
      )}
    </div>
  );
}
