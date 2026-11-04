import { useState } from 'react';
import { DataTable } from './ui/DataTable';
import { Input } from './ui/Field';
import { Pagination } from './ui/Pagination';
import { usePagina } from '../hooks/useEstadoReiniciado';
import { useAtrasado, useRequisicao } from '../hooks/useRequisicao';
import type { Paginado, RegistroAuditoria } from '../types/api';
import { formatarDataHora } from '../utils/formatar';
import { rotuloAcao } from '../pages/compartilhado';

export interface FiltroLista {
  page: number;
  limit: number;
  acao?: string;
  inicio?: string;
  fim?: string;
}

function resumoDetalhes(registro: RegistroAuditoria): string {
  const detalhes = registro.detalhes;
  if (!detalhes) return '';
  const dados = (detalhes.dados ?? detalhes) as Record<string, unknown>;
  const partes = Object.entries(dados)
    .filter(([, valor]) => valor !== null && valor !== undefined && typeof valor !== 'object')
    .slice(0, 4)
    .map(([chave, valor]) => `${chave}: ${String(valor)}`);
  return partes.join(' · ');
}

export function ListaAuditoria({
  buscar,
  dependencias = [],
  mostrarEmpresa,
  nomesEmpresas,
  limite = 20,
}: {
  buscar: (filtro: FiltroLista) => Promise<Paginado<RegistroAuditoria>>;
  dependencias?: unknown[];
  mostrarEmpresa?: boolean;
  nomesEmpresas?: Map<number, string>;
  limite?: number;
}) {
  const [acao, setAcao] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const acaoAtrasada = useAtrasado(acao);
  const [pagina, setPagina] = usePagina([acaoAtrasada, inicio, fim, ...dependencias]);
  const lista = useRequisicao(
    () =>
      buscar({
        page: pagina,
        limit: limite,
        acao: acaoAtrasada.trim() || undefined,
        inicio: inicio || undefined,
        fim: fim || undefined,
      }),
    [pagina, acaoAtrasada, inicio, fim, ...dependencias],
  );

  return (
    <>
      <div className="barra-ferramentas filtros-auditoria">
        <Input rotulo="Ação" placeholder="ex.: venda." value={acao} onChange={(e) => setAcao(e.target.value)} />
        <Input rotulo="De" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        <Input rotulo="Até" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
      </div>
      <DataTable<RegistroAuditoria>
        rotulo="Histórico de atividades"
        carregando={lista.carregando}
        erro={lista.erro}
        aoTentarNovamente={lista.recarregar}
        linhas={lista.dados?.data}
        chaveLinha={(r) => r.id}
        vazio={{ titulo: 'Nenhuma atividade encontrada', descricao: 'Ajuste o período ou o filtro de ação.' }}
        colunas={[
          { chave: 'data', titulo: 'Quando', largura: '150px', render: (r) => <span className="num">{formatarDataHora(r.dataHora)}</span> },
          { chave: 'usuario', titulo: 'Quem', render: (r) => r.usuario?.nome ?? <span className="muted">Sistema</span> },
          ...(mostrarEmpresa
            ? [
                {
                  chave: 'empresa',
                  titulo: 'Empresa',
                  ocultarNoCelular: true,
                  render: (r: RegistroAuditoria) =>
                    r.idEmpresa ? (nomesEmpresas?.get(r.idEmpresa) ?? `#${r.idEmpresa}`) : <span className="muted">Plataforma</span>,
                },
              ]
            : []),
          {
            chave: 'acao',
            titulo: 'O que fez',
            render: (r) => (
              <div className="celula-principal">
                <strong>{rotuloAcao(r.acao)}</strong>
                <span>
                  {r.entidade ? `${r.entidade}${r.idEntidade ? ` #${r.idEntidade}` : ''}` : ''}
                  {resumoDetalhes(r) ? ` · ${resumoDetalhes(r)}` : ''}
                </span>
              </div>
            ),
          },
          { chave: 'ip', titulo: 'IP', ocultarNoCelular: true, render: (r) => <span className="num muted">{r.ip ?? '—'}</span> },
        ]}
      />
      <Pagination meta={lista.dados?.meta} aoMudar={setPagina} />
    </>
  );
}
