import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Painel } from './components/ui/Layout';
import { Spinner } from './components/ui/Spinner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FeedbackProvider } from './contexts/FeedbackContext';
import { AppLayout } from './layouts/AppLayout';
import Login from './pages/Login/Login';
import type { Permissao } from './types/api';
import { destinoInicial } from './utils/acesso';

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Empresa = lazy(() => import('./pages/Empresa/Empresa'));
const Clientes = lazy(() => import('./pages/Clientes/Clientes'));
const Fornecedores = lazy(() => import('./pages/Fornecedores/Fornecedores'));
const Produtos = lazy(() => import('./pages/Produtos/Produtos'));
const Estoque = lazy(() => import('./pages/Estoque/Estoque'));
const MaletaEtiquetas = lazy(() => import('./pages/Etiquetas/MaletaEtiquetas'));
const NovaVenda = lazy(() => import('./pages/Vendas/NovaVenda'));
const HistoricoVendas = lazy(() => import('./pages/Vendas/HistoricoVendas'));
const Caixa = lazy(() => import('./pages/Caixa/Caixa'));
const Carnes = lazy(() => import('./pages/Carnes/Carnes'));
const Relatorios = lazy(() => import('./pages/Relatorios/Relatorios'));
const Funcionarios = lazy(() => import('./pages/Funcionarios/Funcionarios'));
const Atividades = lazy(() => import('./pages/Atividades/Atividades'));
const Perfil = lazy(() => import('./pages/Perfil/Perfil'));
const Configuracoes = lazy(() => import('./pages/Perfil/Configuracoes'));
const SenhaPlataforma = lazy(() => import('./pages/Plataforma/SenhaPlataforma'));
const TrocarSenha = lazy(() => import('./pages/Perfil/TrocarSenha'));
const Ativacao = lazy(() => import('./pages/Ativacao/Ativacao'));
const VisaoGeral = lazy(() => import('./pages/Plataforma/VisaoGeral'));
const EmpresasPlataforma = lazy(() => import('./pages/Plataforma/Empresas'));
const Codigos = lazy(() => import('./pages/Plataforma/Codigos'));
const Planos = lazy(() => import('./pages/Plataforma/Planos'));
const Administradores = lazy(() => import('./pages/Plataforma/Administradores'));
const AuditoriaPlataforma = lazy(() => import('./pages/Plataforma/AuditoriaPlataforma'));
const BackupsPlataforma = lazy(() => import('./pages/Plataforma/BackupsPlataforma'));
const NaoEncontrada = lazy(() => import('./pages/NaoEncontrada'));

function Carregando() {
  return (
    <div className="carregando-pagina">
      <Spinner tamanho={28} rotulo="Carregando" />
    </div>
  );
}

function RotaPrivada({ area, children }: { area: 'empresa' | 'plataforma'; children: ReactNode }) {
  const { autenticado, carregando, usuario } = useAuth();
  const local = useLocation();
  if (carregando) return <Carregando />;
  if (!autenticado || !usuario) return <Navigate to="/login" replace state={{ de: local.pathname + local.search }} />;
  if (usuario.trocarSenha) return <Navigate to="/trocar-senha" replace />;
  const ehPlataforma = usuario.papel === 'SUPER_ADMIN';
  if ((area === 'plataforma') !== ehPlataforma) return <Navigate to={destinoInicial(usuario)} replace />;
  return <>{children}</>;
}

function RotaPublica({ children }: { children: ReactNode }) {
  const { autenticado, carregando, usuario } = useAuth();
  if (carregando) return <Carregando />;
  if (autenticado && usuario) return <Navigate to={destinoInicial(usuario)} replace />;
  return <>{children}</>;
}

function SemAcesso() {
  const { usuario } = useAuth();
  return (
    <Painel>
      <div className="estado">
        <p className="estado-titulo">Seu cargo não tem acesso a esta área</p>
        <p className="muted pequeno">Se precisar dela, peça ao administrador da empresa para ajustar suas permissões.</p>
        <div className="estado-acao">
          <Link to={usuario ? destinoInicial(usuario) : '/'} className="btn btn-primario btn-md">
            Voltar ao início
          </Link>
        </div>
      </div>
    </Painel>
  );
}

function Permitido({ algum, children }: { algum: Permissao[]; children: ReactNode }) {
  const { usuario } = useAuth();
  if (!usuario || !algum.some((p) => usuario.permissoes.includes(p))) return <SemAcesso />;
  return <>{children}</>;
}

function Inicio() {
  const { usuario } = useAuth();
  if (usuario && !usuario.permissoes.includes('dashboard.ver')) return <Navigate to={destinoInicial(usuario)} replace />;
  return <Dashboard />;
}

const so = (algum: Permissao[], elemento: ReactNode) => <Permitido algum={algum}>{elemento}</Permitido>;

export default function App() {
  return (
    <BrowserRouter>
      <FeedbackProvider>
        <AuthProvider>
          <Suspense fallback={<Carregando />}>
            <Routes>
              <Route
                path="/login"
                element={
                  <RotaPublica>
                    <Login />
                  </RotaPublica>
                }
              />
              <Route
                path="/ativar"
                element={
                  <RotaPublica>
                    <Ativacao />
                  </RotaPublica>
                }
              />
              <Route path="/trocar-senha" element={<TrocarSenha />} />

              <Route
                path="/plataforma"
                element={
                  <RotaPrivada area="plataforma">
                    <AppLayout area="plataforma" />
                  </RotaPrivada>
                }
              >
                <Route index element={<VisaoGeral />} />
                <Route path="empresas" element={<EmpresasPlataforma />} />
                <Route path="codigos" element={<Codigos />} />
                <Route path="planos" element={<Planos />} />
                <Route path="administradores" element={<Administradores />} />
                <Route path="auditoria" element={<AuditoriaPlataforma />} />
                <Route path="backups" element={<BackupsPlataforma />} />
                <Route path="perfil" element={<Perfil />} />
                <Route path="senha" element={<SenhaPlataforma />} />
                <Route path="*" element={<NaoEncontrada />} />
              </Route>

              <Route
                element={
                  <RotaPrivada area="empresa">
                    <AppLayout area="empresa" />
                  </RotaPrivada>
                }
              >
                <Route index element={<Inicio />} />
                <Route path="empresa" element={<Empresa />} />
                <Route path="clientes" element={so(['clientes.consultar'], <Clientes />)} />
                <Route path="fornecedores" element={so(['fornecedores.consultar'], <Fornecedores />)} />
                <Route path="funcionarios" element={so(['funcionarios.consultar'], <Funcionarios />)} />
                <Route path="produtos" element={so(['produtos.consultar'], <Produtos />)} />
                <Route path="estoque" element={so(['estoque.consultar'], <Estoque />)} />
                <Route path="etiquetas" element={so(['produtos.consultar'], <MaletaEtiquetas />)} />
                <Route path="vendas" element={so(['vendas.consultar'], <HistoricoVendas />)} />
                <Route path="vendas/nova" element={so(['vendas.registrar'], <NovaVenda />)} />
                <Route path="caixa" element={so(['caixa.operar'], <Caixa />)} />
                <Route path="carnes" element={so(['carnes.consultar'], <Carnes />)} />
                <Route path="relatorios" element={so(['relatorios.vendas', 'relatorios.estoque'], <Relatorios />)} />
                <Route path="atividades" element={so(['auditoria.consultar'], <Atividades />)} />
                <Route path="perfil" element={<Perfil />} />
                <Route path="configuracoes" element={<Configuracoes />} />
                <Route path="menu" element={<Navigate to="/" replace />} />
                <Route path="carnês" element={<Navigate to="/carnes" replace />} />
                <Route path="*" element={<NaoEncontrada />} />
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </FeedbackProvider>
    </BrowserRouter>
  );
}
