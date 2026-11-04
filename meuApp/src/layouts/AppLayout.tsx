import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  IoChevronDown,
  IoClose,
  IoLogOutOutline,
  IoMenu,
  IoPersonCircleOutline,
  IoSettingsOutline,
} from 'react-icons/io5';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { useRequisicao } from '../hooks/useRequisicao';
import { empresaService } from '../services/servicos';
import { itemDaRota, MENU } from './navegacao';
import './layout.css';

function iniciais(texto: string): string {
  return texto
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('');
}

export function AppLayout() {
  const { usuario, sair } = useAuth();
  const { confirmar } = useFeedback();
  const local = useLocation();
  const navegar = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const menuPerfil = useRef<HTMLDivElement>(null);
  const empresa = useRequisicao(() => empresaService.obter(), []);

  const atual = itemDaRota(local.pathname);

  // Fecha a gaveta (celular) e o menu do usuário ao navegar.
  const [rotaAnterior, setRotaAnterior] = useState(local.pathname);
  if (rotaAnterior !== local.pathname) {
    setRotaAnterior(local.pathname);
    setMenuAberto(false);
    setPerfilAberto(false);
  }

  useEffect(() => {
    document.title = atual ? `${atual.titulo} · Atrativa Shore` : 'Atrativa Shore';
  }, [atual]);

  useEffect(() => {
    if (!perfilAberto) return;
    const fora = (evento: MouseEvent) => {
      if (!menuPerfil.current?.contains(evento.target as Node)) setPerfilAberto(false);
    };
    const esc = (evento: KeyboardEvent) => evento.key === 'Escape' && setPerfilAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [perfilAberto]);

  const pedirSaida = async () => {
    const sim = await confirmar({ titulo: 'Sair do sistema?', mensagem: 'Você precisará entrar novamente com usuário e senha.', confirmar: 'Sair' });
    if (sim) {
      sair('manual');
      navegar('/login', { replace: true });
    }
  };

  return (
    <div className={menuAberto ? 'app app-menu-aberto' : 'app'}>
      <a href="#conteudo" className="pular-link">
        Pular para o conteúdo
      </a>

      <aside className="sidebar nao-imprimir" aria-label="Menu principal">
        <div className="sidebar-topo">
          <img src="/logo.svg" alt="Atrativa Shore" className="sidebar-logo" />
          <button type="button" className="btn btn-fantasma btn-icone btn-sm so-celular" onClick={() => setMenuAberto(false)} aria-label="Fechar menu">
            <IoClose size={20} />
          </button>
        </div>
        <nav className="sidebar-nav">
          {MENU.map((grupo) => (
            <div key={grupo.titulo} className="sidebar-grupo">
              <p className="sidebar-grupo-titulo">{grupo.titulo}</p>
              <ul>
                {grupo.itens.map((item) => {
                  const Icone = item.icone;
                  return (
                    <li key={item.caminho}>
                      <NavLink
                        to={item.caminho}
                        end
                        className={() => (atual?.caminho === item.caminho ? 'sidebar-item ativo' : 'sidebar-item')}
                        aria-current={atual?.caminho === item.caminho ? 'page' : undefined}
                      >
                        <Icone size={18} aria-hidden />
                        <span>{item.titulo}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <button type="button" className="sidebar-item sidebar-sair" onClick={pedirSaida}>
          <IoLogOutOutline size={18} aria-hidden />
          <span>Sair</span>
        </button>
      </aside>
      <div className="sidebar-veu so-celular" onClick={() => setMenuAberto(false)} aria-hidden />

      <div className="principal">
        <header className="topo nao-imprimir">
          <button type="button" className="btn btn-fantasma btn-icone so-celular" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
            <IoMenu size={22} />
          </button>
          <div className="topo-titulo">
            {atual ? (
              <nav aria-label="Você está em" className="trilha">
                <span>{atual.grupo}</span>
                <span aria-hidden>/</span>
                <span aria-current="page">{atual.titulo}</span>
              </nav>
            ) : null}
          </div>
          <div className="topo-direita">
            <span className="topo-empresa" title="Empresa">
              {empresa.dados?.nome ?? (empresa.carregando ? '' : 'Empresa')}
            </span>
            <div className="perfil" ref={menuPerfil}>
              <button
                type="button"
                className="perfil-botao"
                aria-haspopup="menu"
                aria-expanded={perfilAberto}
                onClick={() => setPerfilAberto((aberto) => !aberto)}
              >
                <span className="avatar" aria-hidden>
                  {iniciais(usuario?.login ?? '?')}
                </span>
                <span className="perfil-texto">
                  <strong>{usuario?.login}</strong>
                  <span>{usuario?.perfil ?? 'Usuário'}</span>
                </span>
                <IoChevronDown size={14} aria-hidden />
              </button>
              {perfilAberto ? (
                <div className="perfil-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => navegar('/perfil')}>
                    <IoPersonCircleOutline size={18} aria-hidden /> Meu perfil
                  </button>
                  <button type="button" role="menuitem" onClick={() => navegar('/configuracoes')}>
                    <IoSettingsOutline size={18} aria-hidden /> Configurações
                  </button>
                  <hr />
                  <button type="button" role="menuitem" className="perfil-sair" onClick={pedirSaida}>
                    <IoLogOutOutline size={18} aria-hidden /> Sair
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main id="conteudo" className="conteudo" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
