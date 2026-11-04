import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { PaginacaoDto } from '../../common/dto/paginacao.dto.js';
import { Aparar, MaiusculasAparadas } from '../../common/dto/transformacoes.js';

export class CriarFornecedorDto {
  @ApiProperty({ example: 'IBITINGA', maxLength: 60 })
  @MaiusculasAparadas()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nome: string;

  @ApiPropertyOptional({ maxLength: 18 })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string;

  @ApiPropertyOptional({ maxLength: 16 })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  ie?: string;

  @ApiPropertyOptional({ maxLength: 30 })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  contato?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @Aparar()
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ maxLength: 15 })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(15)
  telefone?: string;

  @ApiPropertyOptional({ maxLength: 15 })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(15)
  fax?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  rua?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cidade?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @Length(2, 2)
  uf?: string;

  @ApiPropertyOptional({ maxLength: 15 })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(15)
  cep?: string;
}

export class AtualizarFornecedorDto extends PartialType(CriarFornecedorDto) {}

export class ListarFornecedoresDto extends PaginacaoDto {
  @ApiPropertyOptional({ description: 'Parte do nome' })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  busca?: string;
}
