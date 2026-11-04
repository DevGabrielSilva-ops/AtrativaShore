import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginacaoDto } from '../../common/dto/paginacao.dto.js';
import { Aparar, MaiusculasAparadas, ParaBooleano } from '../../common/dto/transformacoes.js';

export class CriarProdutoDto {
  @ApiProperty({ example: 'TOALHA BANHO 29,99', maxLength: 60 })
  @MaiusculasAparadas()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nome: string;

  @ApiPropertyOptional({
    example: '7891000000017',
    maxLength: 20,
    description: 'Se omitido, a API gera um código interno com prefixo 2 (como o desktop)',
  })
  @Aparar()
  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Za-z-]+$/, { message: 'codigoBarras deve conter apenas letras, números e hífen' })
  @MaxLength(20)
  codigoBarras?: string;

  @ApiPropertyOptional({ example: 15, description: 'Valor de compra (R$)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorCompra?: number;

  @ApiProperty({ example: 29.99, description: 'Preço à vista (cad_produtos.vr_venda_2)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precoVista: number;

  @ApiPropertyOptional({
    example: 35,
    description: 'Preço a prazo (cad_produtos.vr_venda). Se omitido, igual ao à vista. É o preço sugerido na venda.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precoPrazo?: number;

  @ApiPropertyOptional({ example: 5, description: 'Estoque mínimo para o alerta de estoque baixo' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  estoqueMinimo?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  idFornecedor?: number;

  @ApiPropertyOptional({ example: 1, description: 'Categoria (cad_produtos_tipo). Padrão: a primeira cadastrada.' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  idTipo?: number;

  @ApiPropertyOptional({ example: 'UN', maxLength: 3 })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  unidade?: string;

  @ApiPropertyOptional({ maxLength: 30 })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  informacoesAdicionais?: string;
}

export class AtualizarProdutoDto extends PartialType(CriarProdutoDto) {}

export class ListarProdutosDto extends PaginacaoDto {
  @ApiPropertyOptional({ description: 'Parte do nome, código de barras ou id' })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  busca?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idFornecedor?: number;

  @ApiPropertyOptional({ description: 'Somente produtos com saldo maior que zero' })
  @ParaBooleano()
  @IsOptional()
  somenteDisponiveis?: boolean;

  @ApiPropertyOptional({ description: 'Inclui itens de serviço (ex.: "RECEBIMENTO DE CARNÊ")', default: false })
  @ParaBooleano()
  @IsOptional()
  incluirServicos?: boolean;
}

export class EstoqueBaixoDto extends PaginacaoDto {
  @ApiPropertyOptional({
    description:
      'Limite usado para produtos sem estoque mínimo cadastrado (hoje, todos). Padrão: ESTOQUE_BAIXO_LIMITE.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  limite?: number;
}
