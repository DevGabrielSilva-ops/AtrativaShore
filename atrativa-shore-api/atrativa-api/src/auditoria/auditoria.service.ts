import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CONEXAO_PLATAFORMA } from '../auth/sessao-usuario.service.js';
import { offset, paginado, type Paginado } from '../common/dto/paginacao.dto.js';
import { adicionarDias, instanteNoFuso } from '../common/utils/datas.js';
import { semSegredos } from '../common/utils/segredos.js';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { PlataformaUsuario, RegistroAuditoria } from '../plataforma/entities/index.js';
import { contextoAtual } from '../tenancy/contexto.js';

export interface NovoRegistro {
  acao: string;
  entidade?: string | null;
  idEntidade?: string | number | null;
  detalhes?: unknown;
  idUsuario?: number | null;
  idEmpresa?: number | null;
}

const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function formatarDataHora(valor: string | null | undefined): string {
  if (!valor) return '—';
  const data = new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(valor) ? valor : valor.replace(' ', 'T'));
  return Number.isNaN(data.getTime()) ? valor : dataHora.format(data);
}

export interface FiltroAuditoria {
  page: number;
  limit: number;
  idEmpresa?: number;
  idUsuario?: number;
  acao?: string;
  inicio?: string;
  fim?: string;
}

export interface RegistroAuditoriaResposta {
  id: string;
  dataHora: Date;
  acao: string;
  entidade: string | null;
  idEntidade: string | null;
  detalhes: Record<string, unknown> | null;
  ip: string | null;
  idEmpresa: number | null;
  usuario: { id: number; nome: string } | null;
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger('Auditoria');

  constructor(
    @InjectRepository(RegistroAuditoria, CONEXAO_PLATAFORMA) private readonly registros: Repository<RegistroAuditoria>,
    @InjectRepository(PlataformaUsuario, CONEXAO_PLATAFORMA) private readonly usuarios: Repository<PlataformaUsuario>,
    private readonly config: ConfiguracaoService,
  ) {}

  async registrar(novo: NovoRegistro): Promise<void> {
    const contexto = contextoAtual();
    const detalhes = novo.detalhes === undefined ? null : semSegredos(novo.detalhes);
    let serializado = detalhes === null ? null : JSON.stringify(detalhes);
    if (serializado && serializado.length > 8000) serializado = JSON.stringify({ resumo: serializado.slice(0, 8000) });
    try {
      await this.registros.save(
        this.registros.create({
        acao: novo.acao.slice(0, 60),
        entidade: novo.entidade?.slice(0, 40) ?? null,
        idEntidade: novo.idEntidade === undefined || novo.idEntidade === null ? null : String(novo.idEntidade).slice(0, 40),
        detalhes: serializado ? (JSON.parse(serializado) as Record<string, unknown>) : null,
        idUsuario: novo.idUsuario !== undefined ? novo.idUsuario : (contexto?.usuario?.id ?? null),
        idEmpresa: novo.idEmpresa !== undefined ? novo.idEmpresa : (contexto?.usuario?.idEmpresa ?? null),
        ip: contexto?.ip ?? null,
        }),
      );
    } catch (erro) {
      this.logger.error(`Falha ao registrar auditoria "${novo.acao}": ${(erro as Error).message}`);
    }
  }

  async listar(filtro: FiltroAuditoria): Promise<Paginado<RegistroAuditoriaResposta>> {
    const consulta = this.registros.createQueryBuilder('a').orderBy('a.dataHora', 'DESC').addOrderBy('a.id', 'DESC');
    if (filtro.idEmpresa !== undefined) consulta.andWhere('a.idEmpresa = :idEmpresa', { idEmpresa: filtro.idEmpresa });
    if (filtro.idUsuario !== undefined) consulta.andWhere('a.idUsuario = :idUsuario', { idUsuario: filtro.idUsuario });
    if (filtro.acao) consulta.andWhere('a.acao LIKE :acao', { acao: `${filtro.acao}%` });
    const fuso = this.config.fusoHorario;
    if (filtro.inicio) consulta.andWhere('a.dataHora >= :inicio', { inicio: instanteNoFuso(filtro.inicio, '00:00:00', fuso) });
    if (filtro.fim) consulta.andWhere('a.dataHora < :fim', { fim: instanteNoFuso(adicionarDias(filtro.fim, 1), '00:00:00', fuso) });
    const [linhas, total] = await consulta.skip(offset(filtro)).take(filtro.limit).getManyAndCount();
    const ids = [...new Set(linhas.map((l) => l.idUsuario).filter((id): id is number => id !== null))];
    const nomes = new Map(
      (ids.length ? await this.usuarios.createQueryBuilder('u').whereInIds(ids).getMany() : []).map((u) => [u.id, u.nome]),
    );
    return paginado(
      linhas.map((linha) => ({
        id: linha.id,
        dataHora: linha.dataHora,
        acao: linha.acao,
        entidade: linha.entidade,
        idEntidade: linha.idEntidade,
        detalhes: linha.detalhes,
        ip: linha.ip,
        idEmpresa: linha.idEmpresa,
        usuario: linha.idUsuario ? { id: linha.idUsuario, nome: nomes.get(linha.idUsuario) ?? `#${linha.idUsuario}` } : null,
      })),
      total,
      filtro.page,
      filtro.limit,
    );
  }
}
