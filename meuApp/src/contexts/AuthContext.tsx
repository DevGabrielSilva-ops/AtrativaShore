import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { definirRenovador, definirToken, quandoSessaoExpirar } from '../services/api';
import { authService } from '../services/servicos';
import type { Permissao, RespostaLogin, UsuarioAutenticado } from '../types/api';

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
  plataforma: boolean;
  entrar: (login: string, senha: string, lembrar: boolean) => Promise<UsuarioAutenticado>;
  sair: (motivo?: MotivoSaida) => void;
  aplicarSessao: (resposta: RespostaLogin) => void;
  pode: (...permissoes: Permissao[]) => boolean;
}

const AuthContexto = createContext<ValorAuth | null>(null);

let restauracao: Promise<RespostaLogin | null> | null = null;

function esperar(ms: number) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

async function renovarComRetentativa(): Promise<RespostaLogin | null> {
  try {
    return await authService.renovar();
  } catch {
    await esperar(400);
    try {
      return await authService.renovar();
    } catch {
      return null;
    }
  }
}

function restaurarUmaVez(): Promise<RespostaLogin | null> {
  restauracao ??= renovarComRetentativa().finally(() => {
    restauracao = null;
  });
  return restauracao;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [motivoSaida, setMotivoSaida] = useState<MotivoSaida>(null);
  const temporizador = useRef<number | undefined>(undefined);

  const aplicarSessao = useCallback((resposta: RespostaLogin) => {
    definirToken(resposta.accessToken);
    setSessao({ token: resposta.accessToken, expiresAt: resposta.expiresAt, usuario: resposta.usuario });
  }, []);

  const limpar = useCallback((motivo: MotivoSaida) => {
    definirToken(null);
    setSessao(null);
    setMotivoSaida(motivo);
  }, []);

  const sair = useCallback(
    (motivo: MotivoSaida = 'manual') => {
      if (motivo === 'manual') void authService.sair().catch(() => undefined);
      limpar(motivo);
    },
    [limpar],
  );

  useEffect(() => {
    quandoSessaoExpirar(() => limpar('expirada'));
    definirRenovador(async () => {
      const resposta = await restaurarUmaVez();
      if (!resposta) return null;
      aplicarSessao(resposta);
      return resposta.accessToken;
    });
  }, [limpar, aplicarSessao]);

  useEffect(() => {
    let ativo = true;
    restaurarUmaVez().then((resposta) => {
      if (!ativo) return;
      if (resposta) aplicarSessao(resposta);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [aplicarSessao]);

  useEffect(() => {
    window.clearTimeout(temporizador.current);
    if (!sessao) return;
    const restante = Date.parse(sessao.expiresAt) - Date.now() - 60_000;
    temporizador.current = window.setTimeout(
      () => {
        void restaurarUmaVez().then((resposta) => (resposta ? aplicarSessao(resposta) : limpar('expirada')));
      },
      Math.max(5_000, Math.min(restante, 2_147_000_000)),
    );
    return () => window.clearTimeout(temporizador.current);
  }, [sessao, aplicarSessao, limpar]);

  const entrar = useCallback(
    async (login: string, senha: string, lembrar: boolean) => {
      const resposta = await authService.login(login, senha, lembrar);
      setMotivoSaida(null);
      aplicarSessao(resposta);
      return resposta.usuario;
    },
    [aplicarSessao],
  );

  const usuario = sessao?.usuario ?? null;
  const pode = useCallback(
    (...permissoes: Permissao[]) => !!usuario && permissoes.every((p) => usuario.permissoes.includes(p)),
    [usuario],
  );

  const valor = useMemo<ValorAuth>(
    () => ({
      usuario,
      autenticado: sessao !== null,
      carregando,
      motivoSaida,
      plataforma: usuario?.papel === 'SUPER_ADMIN',
      entrar,
      sair,
      aplicarSessao,
      pode,
    }),
    [usuario, sessao, carregando, motivoSaida, entrar, sair, aplicarSessao, pode],
  );

  return <AuthContexto.Provider value={valor}>{children}</AuthContexto.Provider>;
}

export function useAuth(): ValorAuth {
  const contexto = useContext(AuthContexto);
  if (!contexto) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return contexto;
}
