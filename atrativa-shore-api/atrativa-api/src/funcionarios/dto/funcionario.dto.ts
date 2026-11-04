import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginacaoDto } from '../../common/dto/paginacao.dto.js';
import { Aparar } from '../../common/dto/transformacoes.js';
import { PAPEIS_EMPRESA, type PapelEmpresa, STATUS_USUARIO, type StatusUsuario } from '../../plataforma/entities/papeis.js';

export const REGEX_LOGIN = /^[A-Za-z0-9._-]{3,40}$/;

export class CriarFuncionarioDto {
  @ApiProperty({ example: 'Maria Souza' })
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @ApiPropertyOptional({ example: 'maria@loja.com' })
  @Aparar()
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ example: 'maria.souza', description: 'Usuário de acesso (letras, números, ponto, hífen)' })
  @Aparar()
  @IsOptional()
  @Matches(REGEX_LOGIN, { message: 'login deve ter de 3 a 40 letras, números, ponto, hífen ou sublinhado' })
  login?: string;

  @ApiProperty({ enum: PAPEIS_EMPRESA })
  @IsIn(PAPEIS_EMPRESA)
  papel: PapelEmpresa;

  @ApiPropertyOptional({ description: 'Cargo personalizado (define as permissões)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCargo?: number;

  @ApiPropertyOptional({ format: 'password', description: 'Senha inicial. Vazio: a API gera uma senha temporária.' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  senha?: string;
}

export class AtualizarFuncionarioDto {
  @ApiPropertyOptional()
  @Aparar()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome?: string;

  @ApiPropertyOptional({ nullable: true })
  @Aparar()
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Aparar()
  @IsOptional()
  @Matches(REGEX_LOGIN, { message: 'login deve ter de 3 a 40 letras, números, ponto, hífen ou sublinhado' })
  login?: string | null;

  @ApiPropertyOptional({ enum: PAPEIS_EMPRESA })
  @IsOptional()
  @IsIn(PAPEIS_EMPRESA)
  papel?: PapelEmpresa;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idCargo?: number | null;
}

export class AlterarStatusDto {
  @ApiProperty({ enum: STATUS_USUARIO })
  @IsIn(STATUS_USUARIO)
  status: StatusUsuario;
}

export class ListarFuncionariosDto extends PaginacaoDto {
  @ApiPropertyOptional()
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busca?: string;

  @ApiPropertyOptional({ enum: STATUS_USUARIO })
  @IsOptional()
  @IsIn(STATUS_USUARIO)
  status?: StatusUsuario;

  @ApiPropertyOptional({ enum: PAPEIS_EMPRESA })
  @IsOptional()
  @IsIn(PAPEIS_EMPRESA)
  papel?: PapelEmpresa;
}

export class CargoDto {
  @ApiProperty({ example: 'Caixa' })
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nome: string;

  @ApiProperty({ enum: PAPEIS_EMPRESA.filter((p) => p !== 'COMPANY_ADMIN') })
  @IsIn(PAPEIS_EMPRESA.filter((p) => p !== 'COMPANY_ADMIN'))
  papelBase: PapelEmpresa;

  @ApiProperty({ type: [String], example: ['vendas.registrar', 'clientes.consultar'] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissoes: string[];
}
