import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginacaoDto } from '../../common/dto/paginacao.dto.js';
import { Aparar, MaiusculasAparadas } from '../../common/dto/transformacoes.js';
import { IsCpfOuCnpj } from '../../common/validacao/cpf-cnpj.validator.js';
import { REGEX_DATA_ISO } from '../../common/utils/datas.js';

/** Tamanhos máximos = tamanhos reais das colunas de cad_clientes. */
export class CriarClienteDto {
  @ApiProperty({ example: 'MARIA SILVA', maxLength: 60 })
  @MaiusculasAparadas()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nome: string;

  @ApiPropertyOptional({ example: '529.982.247-25', description: 'CPF ou CNPJ; gravado só com dígitos' })
  @Aparar()
  @IsOptional()
  @IsCpfOuCnpj()
  cpf?: string;

  @ApiPropertyOptional({ maxLength: 16 })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  rg?: string;

  @ApiPropertyOptional({ maxLength: 16, description: 'Inscrição estadual' })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  ie?: string;

  @ApiPropertyOptional({ example: '1433331234', maxLength: 15 })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(15)
  telefone?: string;

  @ApiPropertyOptional({ example: '14999999999', maxLength: 15 })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(15)
  celular?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @Aparar()
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  endereco?: string;

  @ApiPropertyOptional({ maxLength: 30 })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  bairro?: string;

  @ApiPropertyOptional({ maxLength: 30 })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  cidade?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @Length(2, 2)
  uf?: string;

  @ApiPropertyOptional({ example: '18700000', maxLength: 15 })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(15)
  cep?: string;

  @ApiPropertyOptional({ example: '1998-05-10' })
  @IsOptional()
  @Matches(REGEX_DATA_ISO, { message: 'dataAniversario deve estar no formato AAAA-MM-DD' })
  dataAniversario?: string;

  @ApiPropertyOptional({ example: 2500, description: 'Renda/faixa salarial em reais' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  faixaSalarial?: number;

  @ApiPropertyOptional({ maxLength: 255 })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  informacoesAdicionais?: string;
}

export class AtualizarClienteDto extends PartialType(CriarClienteDto) {}

export class ListarClientesDto extends PaginacaoDto {
  @ApiPropertyOptional({ description: 'Nome (parcial), CPF/CNPJ, código do cliente ou id' })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  busca?: string;
}
