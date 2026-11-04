import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginacaoDto } from '../../../common/dto/paginacao.dto.js';
import { Aparar } from '../../../common/dto/transformacoes.js';
import { REGEX_DATA_ISO } from '../../../common/utils/datas.js';
import { STATUS_EMPRESA, type StatusEmpresa, TIPOS_CODIGO, type TipoCodigo } from '../../entities/papeis.js';

export class ListarEmpresasDto extends PaginacaoDto {
  @ApiPropertyOptional()
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busca?: string;

  @ApiPropertyOptional({ enum: STATUS_EMPRESA })
  @IsOptional()
  @IsIn(STATUS_EMPRESA)
  status?: StatusEmpresa;
}

export class EmpresaPlataformaDto {
  @ApiProperty()
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @ApiPropertyOptional()
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string;

  @ApiPropertyOptional()
  @Aparar()
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional()
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(15)
  telefone?: string;

  @ApiPropertyOptional()
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  cidade?: string;

  @ApiPropertyOptional()
  @Aparar()
  @IsOptional()
  @Matches(/^[A-Za-z]{2}$/, { message: 'uf deve ter 2 letras' })
  uf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idPlano?: number;

  @ApiPropertyOptional({ example: '2027-12-31', nullable: true, description: 'Fim da assinatura; vazio = sem vencimento' })
  @IsOptional()
  @Matches(REGEX_DATA_ISO, { message: 'assinaturaAte deve estar no formato AAAA-MM-DD' })
  assinaturaAte?: string | null;
}

export class AtualizarEmpresaPlataformaDto {
  @ApiPropertyOptional()
  @Aparar()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idPlano?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(REGEX_DATA_ISO, { message: 'assinaturaAte deve estar no formato AAAA-MM-DD' })
  assinaturaAte?: string | null;
}

export class AlterarStatusEmpresaDto {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'] })
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status: 'ACTIVE' | 'SUSPENDED';

  @ApiPropertyOptional()
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivo?: string;

  @ApiPropertyOptional({ description: 'Nova data de fim da assinatura ao reativar uma empresa vencida' })
  @IsOptional()
  @Matches(REGEX_DATA_ISO, { message: 'assinaturaAte deve estar no formato AAAA-MM-DD' })
  assinaturaAte?: string;
}

export class GerarCodigoDto {
  @ApiProperty({ enum: TIPOS_CODIGO })
  @IsIn(TIPOS_CODIGO)
  tipo: TipoCodigo;

  @ApiPropertyOptional({ description: 'Obrigatório para EMPRESA_EXISTENTE' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idEmpresa?: number;

  @ApiPropertyOptional({ description: 'Se informado, só este e-mail pode usar o código' })
  @Aparar()
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  emailDestinatario?: string;

  @ApiPropertyOptional({ default: 7, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  validadeDias?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxUsos?: number;

  @ApiPropertyOptional()
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacao?: string;
}

export class ListarCodigosDto extends PaginacaoDto {
  @ApiPropertyOptional({ enum: ['ATIVO', 'USADO', 'EXPIRADO', 'REVOGADO'] })
  @IsOptional()
  @IsIn(['ATIVO', 'USADO', 'EXPIRADO', 'REVOGADO'])
  situacao?: 'ATIVO' | 'USADO' | 'EXPIRADO' | 'REVOGADO';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idEmpresa?: number;
}

export class PlanoDto {
  @ApiProperty()
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nome: string;

  @ApiPropertyOptional()
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descricao?: string;

  @ApiPropertyOptional({ nullable: true, description: 'Vazio = sem limite de usuários' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxFuncionarios?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class AdministradorDto {
  @ApiProperty()
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @ApiProperty()
  @Aparar()
  @IsEmail()
  @MaxLength(200)
  email: string;
}

export class StatusUsuarioDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsIn(['ACTIVE', 'INACTIVE'])
  status: 'ACTIVE' | 'INACTIVE';
}
