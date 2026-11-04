import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { definirToken, quandoSessaoExpirar } from '../services/api';
import { authService } from '../services/servicos';
import type { UsuarioAutenticado } from '../types/api';

interface Sessao {
  token: string;
  expiresAt: string;
  usuario: UsuarioAutenticado;
}

type MotivoSaida = 'manual' | 'expirada' | null;

interface ValorAuth {
  usuario: UsuarioAutenticado | null;
  autenticado: boolean;
  carregando: boolean;
  motivoSaida: MotivoSaida;
  entrar: (login: string, senha: string, manterConectado: boolean) => Promise<void>;
  sair: (motivo?: MotivoSaida) => void;
}

const CHAVE = 'atrativa.sessao';
const AuthContexto = createContext<ValorAuth | null>(null);

/** Lê a sessão salva (local = "manter conectado"; session = só esta aba). */
function lerSessao(): Sessao | null {
  for (const armazenamento of [sessionStorage, localStorage]) {
    try {
      const bruto = armazenamento.getItem(CHAVE);
      if (!bruto) continue;
      const sessao = JSON.parse(bruto) as Sessao;
      if (sessao?.token && Date.parse(sessao.expiresAt) > Date.now()) return sessao;
      armazenamento.removeItem(CHAVE);
    } catch {
      // armazenamento indisponível ou corrompido
    }
  }
  return null;
}

function limparSessao(): void {
  for (const armazenamento of [sessionStorage, localStorage]) {
    try {
      armazenamento.removeItem(CHAVE);
    } catch {
      // ignora
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(() => {
    const salva = lerSessao();
    definirToken(salva?.token ?? null);
    return salva;
  });
  const [carregando, setCarregando] = useState(() => sessao !== null);
  const [motivoSaida, setMotivoSaida] = useState<MotivoSaida>(null);
  const temporizador = useRef<number | undefined>(undefined);

  const sair = useCallback((motivo: MotivoSaida = 'manual') => {
    limparSessao();
    definirToken(null);
    setSessao(null);
    setMotivoSaida(motivo);
  }, []);

  // Qualquer 401 da API (token expirado ou usuário removido) encerra a sessão.
  useEffect(() => {
    quandoSessaoExpirar(() => sair('expirada'));
  }, [sair]);

  // Confere a sessão salva com o backend ao abrir o sistema.
  useEffect(() => {
    if (!sessao || !carregando) return;
    authService
      .me()
      .then((usuario) => setSessao((atual) => (atual ? { ...atual, usuario } : atual)))
      .catch(() => sair('expirada'))
      .finally(() => setCarregando(false));
  }, [sessao, carregando, sair]);

  // Encerra a sessão no instante em que o token expira.
  useEffect(() => {
    window.clearTimeout(temporizador.current);
    if (!sessao) return;
    const restante = Date.parse(sessao.expiresAt) - Date.now();
    temporizador.current = window.setTimeout(() => sair('expirada'), Math.max(0, Math.min(restante, 2_147_000_000)));
    return () => window.clearTimeout(temporizador.current);
  }, [sessao, sair]);

  const entrar = useCallback(async (login: string, senha: string, manterConectado: boolean) => {
    const resposta = await authService.login(login, senha);
    const nova: Sessao = { token: resposta.accessToken, expiresAt: resposta.expiresAt, usuario: resposta.usuario };
    limparSessao();
    try {
      (manterConectado ? localStorage : sessionStorage).setItem(CHAVE, JSON.stringify(nova));
    } catch {
      // sem armazenamento: a sessão vale até recarregar a página
    }
    definirToken(nova.token);
    setMotivoSaida(null);
    setSessao(nova);
  }, []);

  const valor = useMemo<ValorAuth>(
    () => ({
      usuario: sessao?.usuario ?? null,
      autenticado: sessao !== null,
      carregando,
      motivoSaida,
      entrar,
      sair,
    }),
    [sessao, carregando, motivoSaida, entrar, sair],
  );

  return <AuthContexto.Provider value={valor}>{children}</AuthContexto.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): ValorAuth {
  const contexto = useContext(AuthContexto);
  if (!contexto) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return contexto;
}
