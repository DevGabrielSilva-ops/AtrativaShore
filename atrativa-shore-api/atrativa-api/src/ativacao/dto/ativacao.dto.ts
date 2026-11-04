import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Aparar } from '../../common/dto/transformacoes.js';
import { REGEX_LOGIN } from '../../funcionarios/dto/funcionario.dto.js';

export class ValidarCodigoDto {
  @ApiProperty({ example: 'ATV-7K2QM-9XH4P-RT6WB-3NC8D-YF5JA' })
  @Aparar()
  @IsString()
  @Length(20, 40)
  codigo: string;
}

export class ResponsavelDto {
  @ApiProperty({ example: 'Ana Lima' })
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @ApiProperty({ example: 'ana@loja.com' })
  @Aparar()
  @IsEmail()
  @MaxLength(200)
  email: string;

  @ApiPropertyOptional({ example: 'ana.lima' })
  @Aparar()
  @IsOptional()
  @Matches(REGEX_LOGIN, { message: 'login deve ter de 3 a 40 letras, números, ponto, hífen ou sublinhado' })
  login?: string;

  @ApiProperty({ format: 'password', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  senha: string;
}

export class EmpresaAtivacaoDto {
  @ApiProperty({ example: 'Loja Exemplo' })
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
  @IsString()
  @MaxLength(15)
  telefone?: string;

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
  @MaxLength(100)
  endereco?: string;

  @ApiPropertyOptional()
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bairro?: string;

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
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(15)
  cep?: string;
}

export class ConcluirAtivacaoDto extends ValidarCodigoDto {
  @ApiProperty({ type: ResponsavelDto })
  @ValidateNested()
  @Type(() => ResponsavelDto)
  responsavel: ResponsavelDto;

  @ApiPropertyOptional({ type: EmpresaAtivacaoDto, description: 'Obrigatório para códigos de nova empresa' })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmpresaAtivacaoDto)
  empresa?: EmpresaAtivacaoDto;
}
