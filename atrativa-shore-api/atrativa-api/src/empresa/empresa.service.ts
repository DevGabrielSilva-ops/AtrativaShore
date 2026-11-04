import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import type { AtualizarEmpresaDto } from './dto/atualizar-empresa.dto.js';
import { Empresa } from './entities/empresa.entity.js';

@Injectable()
export class EmpresaService {
  constructor(
    @InjectRepository(Empresa) private readonly empresas: Repository<Empresa>,
    private readonly config: ConfiguracaoService,
  ) {}

  async obter(): Promise<Empresa> {
    const empresa = await this.empresas.findOne({ where: { id: this.config.empresaId } });
    if (!empresa) {
      throw new NotFoundException(`Empresa #${this.config.empresaId} não encontrada em cad_empresa`);
    }
    return empresa;
  }

  async atualizar(dto: AtualizarEmpresaDto): Promise<Empresa> {
    const empresa = await this.obter();
    if (Object.keys(dto).length > 0) {
      await this.empresas.update({ id: empresa.id }, dto);
    }
    return this.obter();
  }
}
