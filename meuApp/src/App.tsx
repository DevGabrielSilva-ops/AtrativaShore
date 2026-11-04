import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Spinner } from './components/ui/Spinner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FeedbackProvider } from './contexts/FeedbackContext';
import { AppLayout } from './layouts/AppLayout';
import Login from './pages/Login/Login';

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Empresa = lazy(() => import('./pages/Empresa/Empresa'));
const Clientes = lazy(() => import('./pages/Clientes/Clientes'));
const Fornecedores = lazy(() => import('./pages/Fornecedores/Fornecedores'));
const Produtos = lazy(() => import('./pages/Produtos/Produtos'));
const Estoque = lazy(() => import('./pages/Estoque/Estoque'));
const NovaVenda = lazy(() => import('./pages/Vendas/NovaVenda'));
const HistoricoVendas = lazy(() => import('./pages/Vendas/HistoricoVendas'));
const Caixa = lazy(() => import('./pages/Caixa/Caixa'));
const Carnes = lazy(() => import('./pages/Carnes/Carnes'));
const Relatorios = lazy(() => import('./pages/Relatorios/Relatorios'));
const Perfil = lazy(() => import('./pages/Perfil/Perfil'));
const Configuracoes = lazy(() => import('./pages/Perfil/Configuracoes'));
const NaoEncontrada = lazy(() => import('./pages/NaoEncontrada'));

function Carregando() {
  return (
    <div className="carregando-pagina">
      <Spinner tamanho={28} rotulo="Carregando" />
    </div>
  );
}

function RotaPrivada({ children }: { children: ReactNode }) {
  const { autenticado, carregando } = useAuth();
  const local = useLocation();
  if (carregando) return <Carregando />;
  if (!autenticado) return <Navigate to="/login" replace state={{ de: local.pathname + local.search }} />;
  return <>{children}</>;
}

function RotaPublica({ children }: { children: ReactNode }) {
  const { autenticado, carregando } = useAuth();
  if (carregando) return <Carregando />;
  if (autenticado) return <Navigate to="/" replace />;
  return <>{children}</>;
}

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
                element={
                  <RotaPrivada>
                    <AppLayout />
                  </RotaPrivada>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="empresa" element={<Empresa />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="fornecedores" element={<Fornecedores />} />
                <Route path="produtos" element={<Produtos />} />
                <Route path="estoque" element={<Estoque />} />
                <Route path="vendas" element={<HistoricoVendas />} />
                <Route path="vendas/nova" element={<NovaVenda />} />
                <Route path="caixa" element={<Caixa />} />
                <Route path="carnes" element={<Carnes />} />
                <Route path="relatorios" element={<Relatorios />} />
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
