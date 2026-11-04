import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { Perfil } from './entities/perfil.entity.js';
import { Usuario } from './entities/usuario.entity.js';

export const PERFIL_ADMINISTRADOR = 'ADMINISTRADOR';

export interface UsuarioResposta {
  id: number;
  login: string | null;
  autoriza: string | null;
  perfil: { id: number; nome: string | null };
}

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Perfil) private readonly perfis: Repository<Perfil>,
  ) {}

  /** Busca pelo login incluindo a senha legada (uso exclusivo da autenticação). */
  async buscarParaAutenticacao(login: string): Promise<Usuario | null> {
    return this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.senhaLegada')
      .where('u.login = :login', { login })
      .getOne();
  }

  async buscarPorId(id: number): Promise<Usuario | null> {
    return this.usuarios.findOne({ where: { id } });
  }

  async montarAutenticado(usuario: Usuario): Promise<UsuarioAutenticado> {
    const perfil = await this.perfis.findOne({ where: { id: usuario.idPerfil } });
    const nomePerfil = perfil?.nome?.trim() ?? null;
    return {
      id: usuario.id,
      login: usuario.login ?? '',
      idPerfil: usuario.idPerfil,
      perfil: nomePerfil,
      administrador: nomePerfil?.toUpperCase() === PERFIL_ADMINISTRADOR,
    };
  }

  async listar(): Promise<UsuarioResposta[]> {
    const [usuarios, perfis] = await Promise.all([
      this.usuarios.find({ order: { login: 'ASC' } }),
      this.perfis.find(),
    ]);
    const nomes = new Map(perfis.map((perfil) => [perfil.id, perfil.nome]));
    return usuarios.map((usuario) => ({
      id: usuario.id,
      login: usuario.login,
      autoriza: usuario.autoriza,
      perfil: { id: usuario.idPerfil, nome: nomes.get(usuario.idPerfil) ?? null },
    }));
  }

  async obter(id: number): Promise<UsuarioResposta> {
    const usuario = await this.buscarPorId(id);
    if (!usuario) throw new NotFoundException('Usuário não encontrado');
    const perfil = await this.perfis.findOne({ where: { id: usuario.idPerfil } });
    return {
      id: usuario.id,
      login: usuario.login,
      autoriza: usuario.autoriza,
      perfil: { id: usuario.idPerfil, nome: perfil?.nome ?? null },
    };
  }
}
