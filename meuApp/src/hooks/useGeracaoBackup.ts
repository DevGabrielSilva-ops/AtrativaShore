import { useCallback, useEffect, useState } from 'react';
import { mensagemErro } from '../services/api';
import type { ServicoBackup } from '../services/servicos';
import type { Backup } from '../types/api';

export type EtapaGeracao = 'inicial' | 'gerando' | 'pronto' | 'falhou';

export function useGeracaoBackup(servico: ServicoBackup) {
  const [backup, setBackup] = useState<Backup | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semResposta, setSemResposta] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [baixando, setBaixando] = useState(false);

  const id = backup?.id;
  const processando = backup?.status === 'PROCESSANDO';

  useEffect(() => {
    if (!processando || id === undefined) return;
    let ativo = true;
    let temporizador = 0;
    const consultar = async () => {
      try {
        const atual = await servico.obter(id);
        if (!ativo) return;
        setSemResposta(false);
        setBackup(atual);
        if (atual.status === 'PROCESSANDO') temporizador = window.setTimeout(consultar, 1000);
      } catch {
        if (!ativo) return;
        setSemResposta(true);
        temporizador = window.setTimeout(consultar, 3000);
      }
    };
    temporizador = window.setTimeout(consultar, 700);
    return () => {
      ativo = false;
      window.clearTimeout(temporizador);
    };
  }, [id, processando, servico]);

  const gerar = useCallback(async () => {
    setIniciando(true);
    setErro(null);
    try {
      setBackup(await servico.gerar());
    } catch (falha) {
      setErro(mensagemErro(falha));
    } finally {
      setIniciando(false);
    }
  }, [servico]);

  const baixar = useCallback(async (): Promise<boolean> => {
    if (!backup) return false;
    setBaixando(true);
    setErro(null);
    try {
      await servico.baixar(backup);
      return true;
    } catch (falha) {
      setErro(mensagemErro(falha));
      return false;
    } finally {
      setBaixando(false);
    }
  }, [backup, servico]);

  let etapa: EtapaGeracao = 'inicial';
  if (backup?.status === 'PROCESSANDO') etapa = 'gerando';
  else if (backup?.status === 'CONCLUIDO') etapa = 'pronto';
  else if (backup) etapa = 'falhou';

  return { backup, etapa, erro, semResposta, iniciando, baixando, gerar, baixar };
}

export type GeracaoBackup = ReturnType<typeof useGeracaoBackup>;
