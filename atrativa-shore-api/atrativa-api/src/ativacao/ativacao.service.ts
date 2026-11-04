import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { DataSource, type EntityManager, type Repository } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { CONEXAO_PLATAFORMA } from '../auth/sessao-usuario.service.js';
import { LimitadorTentativas } from '../common/utils/limitador.js';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { FuncionariosService } from '../funcionarios/funcionarios.service.js';
import { Ativacao, CodigoAtivacao, PlataformaEmpresa, PlataformaUsuario } from '../plataforma/entities/index.js';
import { contextoAtual } from '../tenancy/contexto.js';
import { ProvisionamentoService } from '../tenancy/provisionamento.service.js';
import { hashDoCodigo, situacaoDoCodigo } from './codigos.js';
import type { ConcluirAtivacaoDto } from './dto/ativacao.dto.js';

const MENSAGENS = {
  INVALIDO: 'Código de ativação inválido. Confira os caracteres e tente novamente.',
  REVOGADO: 'Este código de ativação foi cancelado. Peça um novo ao suporte do Atrativa Shore.',
  EXPIRADO: 'Este código de ativação expirou. Peça um novo ao suporte do Atrativa Shore.',
  USADO: 'Este código de ativação já foi utilizado.',
};

function mascararEmail(email: string): string {
  const [nome, dominio] = email.split('@');
  return `${nome.slice(0, 2)}${'*'.repeat(Math.max(1, nome.length - 2))}@${dominio}`;
}

@Injectable()
export class AtivacaoService {
  private readonly logger = new Logger('Ativacao');
  private readonly limitador = new LimitadorTentativas(10, 15 * 60 * 1000);

  constructor(
    @InjectDataSource(CONEXAO_PLATAFORMA) private readonly plataforma: DataSource,
    @InjectRepository(CodigoAtivacao, CONEXAO_PLATAFORMA) private readonly codigos: Repository<CodigoAtivacao>,
    @InjectRepository(PlataformaEmpresa, CONEXAO_PLATAFORMA) private readonly empresas: Repository<PlataformaEmpresa>,
    private readonly funcionarios: FuncionariosService,
    private readonly provisionamento: ProvisionamentoService,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfiguracaoService,
  ) {}

  async validar(entrada: string) {
    this.limitar();
    const codigo = await this.codigos.findOne({ where: { hash: hashDoCodigo(entrada) } });
    this.conferirSituacao(codigo);
    const empresa = codigo!.idEmpresa ? await this.empresas.findOne({ where: { id: codigo!.idEmpresa } }) : null;
    if (empresa) this.conferirEmpresa(empresa);
    return {
      tipo: codigo!.tipo,
      expiraEm: codigo!.expiraEm,
      empresa: empresa ? { nome: empresa.nome } : null,
      emailDestinatario: codigo!.emailDestinatario ? mascararEmail(codigo!.emailDestinatario) : null,
    };
  }

  async concluir(dto: ConcluirAtivacaoDto) {
    this.limitar();
    const email = dto.responsavel.email.toLowerCase();
    await this.funcionarios.garantirIdentificadoresLivres(email, dto.responsavel.login ?? null);

    const reserva = await this.plataforma.transaction(async (manager) => {
      const codigo = await manager
        .getRepository(CodigoAtivacao)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.hash = :hash', { hash: hashDoCodigo(dto.codigo) })
        .getOne();
      this.conferirSituacao(codigo);
      if (codigo!.emailDestinatario && codigo!.emailDestinatario.toLowerCase() !== email) {
        throw new ForbiddenException('Este código foi emitido para outro e-mail. Use o e-mail informado ao suporte.');
      }
      const empresa = await this.empresaDoCodigo(manager, codigo!, dto);
      await manager
        .getRepository(CodigoAtivacao)
        .update({ id: codigo!.id }, { usos: codigo!.usos + 1, ultimoUsoEm: new Date() });
      return { codigo: codigo!, empresa };
    });

    try {
      const { empresa } = reserva;
      if (!empresa.bancoProvisionado) {
        await this.provisionamento.provisionar(empresa.banco, {
          nome: dto.empresa?.nome ?? empresa.nome,
          cnpj: dto.empresa?.cnpj ?? empresa.cnpj,
          telefone: dto.empresa?.telefone ?? empresa.telefone,
          email: dto.empresa?.email ?? empresa.email,
          endereco: dto.empresa?.endereco,
          bairro: dto.empresa?.bairro,
          cidade: dto.empresa?.cidade ?? empresa.cidade,
          uf: dto.empresa?.uf?.toUpperCase() ?? empresa.uf,
          cep: dto.empresa?.cep,
        });
        await this.empresas.update({ id: empresa.id }, { bancoProvisionado: true });
      }

      const idLoginLegado = await this.provisionamento.criarLoginEspelho(
        empresa.banco,
        dto.responsavel.login ?? dto.responsavel.nome,
      );
      const senhaHash = await bcrypt.hash(dto.responsavel.senha, this.config.valores.bcryptRodadas);
      const usuario = await this.plataforma.transaction(async (manager) => {
        const salvo = await manager.getRepository(PlataformaUsuario).save(
          manager.getRepository(PlataformaUsuario).create({
            idEmpresa: empresa.id,
            nome: dto.responsavel.nome,
            email,
            login: dto.responsavel.login ?? null,
            senhaHash,
            papel: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            trocarSenha: false,
            idLoginLegado,
          }),
        );
        if (empresa.status === 'PENDING') {
          await manager
            .getRepository(PlataformaEmpresa)
            .update({ id: empresa.id }, { status: 'ACTIVE', ativadaEm: new Date(), motivoStatus: null });
        }
        await manager.getRepository(Ativacao).insert({
          idCodigo: reserva.codigo.id,
          idEmpresa: empresa.id,
          idUsuario: salvo.id,
          ip: contextoAtual()?.ip ?? null,
        });
        return salvo;
      });

      await this.auditoria.registrar({
        acao: 'empresa.ativada',
        entidade: 'empresa',
        idEntidade: empresa.id,
        idUsuario: usuario.id,
        idEmpresa: empresa.id,
        detalhes: { tipo: reserva.codigo.tipo, codigo: reserva.codigo.prefixo, responsavel: usuario.nome },
      });
      return {
        empresa: { id: empresa.id, nome: empresa.nome },
        usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, login: usuario.login },
      };
    } catch (erro) {
      await this.codigos.decrement({ id: reserva.codigo.id }, 'usos', 1);
      if (reserva.empresa.status === 'PENDING') {
        await this.empresas.update({ id: reserva.empresa.id }, { motivoStatus: 'Falha na ativação; tente novamente' });
      }
      this.logger.error(`Falha ao concluir ativação da empresa #${reserva.empresa.id}: ${(erro as Error).message}`);
      await this.auditoria.registrar({
        acao: 'empresa.ativacao_falhou',
        entidade: 'empresa',
        idEntidade: reserva.empresa.id,
        idEmpresa: reserva.empresa.id,
        idUsuario: null,
        detalhes: { erro: (erro as Error).message.slice(0, 300) },
      });
      if (erro instanceof ConflictException || erro instanceof BadRequestException) throw erro;
      if ((erro as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Este e-mail ou usuário de acesso já está em uso na plataforma');
      }
      throw new InternalServerErrorException('Não foi possível concluir a ativação agora. Tente novamente em instantes.');
    }
  }

  private async empresaDoCodigo(manager: EntityManager, codigo: CodigoAtivacao, dto: ConcluirAtivacaoDto) {
    const repositorio = manager.getRepository(PlataformaEmpresa);
    if (codigo.tipo === 'EMPRESA_EXISTENTE') {
      if (!codigo.idEmpresa) throw new ConflictException('Código sem empresa vinculada. Peça um novo ao suporte.');
      const empresa = await repositorio
        .createQueryBuilder('e')
        .setLock('pessimistic_write')
        .where('e.id = :id', { id: codigo.idEmpresa })
        .getOne();
      if (!empresa) throw new NotFoundException('Empresa do código não encontrada');
      this.conferirEmpresa(empresa);
      return empresa;
    }
    if (!dto.empresa) throw new BadRequestException('Informe os dados da empresa');
    const provisoria = await repositorio.save(
      repositorio.create({
        nome: dto.empresa.nome,
        cnpj: dto.empresa.cnpj ?? null,
        email: dto.empresa.email?.toLowerCase() ?? null,
        telefone: dto.empresa.telefone ?? null,
        cidade: dto.empresa.cidade ?? null,
        uf: dto.empresa.uf?.toUpperCase() ?? null,
        status: 'PENDING',
        idPlano: await this.planoPadrao(manager),
        banco: `pendente_${codigo.id}_${Date.now()}`,
        bancoProvisionado: false,
        criadaPor: codigo.criadoPor,
      }),
    );
    const banco = this.provisionamento.nomeDoBanco(provisoria.id);
    await repositorio.update({ id: provisoria.id }, { banco });
    return { ...provisoria, banco };
  }

  private async planoPadrao(manager: EntityManager): Promise<number | null> {
    const [plano] = (await manager.query('SELECT id FROM plataforma_planos WHERE ativo = 1 ORDER BY id LIMIT 1')) as Array<{
      id: number;
    }>;
    return plano?.id ?? null;
  }

  private conferirSituacao(codigo: CodigoAtivacao | null): void {
    if (!codigo) throw new NotFoundException(MENSAGENS.INVALIDO);
    const situacao = situacaoDoCodigo(codigo);
    if (situacao === 'REVOGADO') throw new GoneException(MENSAGENS.REVOGADO);
    if (situacao === 'EXPIRADO') throw new GoneException(MENSAGENS.EXPIRADO);
    if (situacao === 'USADO') throw new ConflictException(MENSAGENS.USADO);
  }

  private conferirEmpresa(empresa: PlataformaEmpresa): void {
    if (empresa.status === 'SUSPENDED' || empresa.status === 'EXPIRED') {
      throw new ConflictException('A empresa deste código está suspensa. Fale com o suporte do Atrativa Shore.');
    }
  }

  private limitar(): void {
    this.limitador.conferir(
      contextoAtual()?.ip ?? 'desconhecido',
      'Muitas tentativas de ativação. Aguarde alguns minutos e tente novamente.',
    );
  }
}
