import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { calcularPermissoes, statusEfetivo } from '../acesso/permissoes.js';
import { dataNoFuso } from '../common/utils/datas.js';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { Cargo, PlataformaEmpresa, PlataformaUsuario } from '../plataforma/entities/index.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

export const CONEXAO_PLATAFORMA = 'plataforma';

@Injectable()
export class SessaoUsuarioService {
  constructor(
    @InjectRepository(PlataformaUsuario, CONEXAO_PLATAFORMA) private readonly usuarios: Repository<PlataformaUsuario>,
    @InjectRepository(PlataformaEmpresa, CONEXAO_PLATAFORMA) private readonly empresas: Repository<PlataformaEmpresa>,
    @InjectRepository(Cargo, CONEXAO_PLATAFORMA) private readonly cargos: Repository<Cargo>,
    private readonly config: ConfiguracaoService,
  ) {}

  hoje(): string {
    return dataNoFuso(new Date(), this.config.fusoHorario);
  }

  async empresaComStatus(idEmpresa: number): Promise<PlataformaEmpresa | null> {
    const empresa = await this.empresas.findOne({ where: { id: idEmpresa } });
    if (!empresa) return null;
    const efetivo = statusEfetivo(empresa.status, empresa.assinaturaAte, this.hoje());
    if (efetivo !== empresa.status) {
      await this.empresas.update({ id: empresa.id }, { status: efetivo, motivoStatus: 'Assinatura vencida' });
      empresa.status = efetivo;
    }
    return empresa;
  }

  async montar(usuario: PlataformaUsuario): Promise<UsuarioAutenticado> {
    const [empresa, cargo] = await Promise.all([
      usuario.idEmpresa ? this.empresaComStatus(usuario.idEmpresa) : Promise.resolve(null),
      usuario.idCargo ? this.cargos.findOne({ where: { id: usuario.idCargo } }) : Promise.resolve(null),
    ]);
    if (usuario.idEmpresa && !empresa) throw new UnauthorizedException('Empresa do usuário não encontrada');
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      login: usuario.login,
      papel: usuario.papel,
      idCargo: cargo?.id ?? null,
      cargo: cargo?.nome ?? null,
      permissoes: calcularPermissoes(usuario.papel, cargo?.permissoes),
      idEmpresa: usuario.idEmpresa,
      empresa: empresa ? { id: empresa.id, nome: empresa.nome, status: empresa.status, banco: empresa.banco } : null,
      idLogin: usuario.idLoginLegado,
      trocarSenha: usuario.trocarSenha,
      administrador: usuario.papel === 'COMPANY_ADMIN',
    };
  }

  async porToken(id: number, versao: number): Promise<UsuarioAutenticado> {
    const usuario = await this.usuarios.findOne({ where: { id } });
    if (!usuario || usuario.versaoToken !== versao) throw new UnauthorizedException('Sessão encerrada. Entre novamente.');
    if (usuario.status !== 'ACTIVE') throw new UnauthorizedException('Usuário desativado');
    return this.montar(usuario);
  }
}
