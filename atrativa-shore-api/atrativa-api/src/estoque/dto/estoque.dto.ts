import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
  NotEquals,
  ValidateNested,
} from 'class-validator';
import { MotivoAjusteEstoque } from '../../common/constantes/legado.js';
import { PeriodoPaginadoDto } from '../../common/dto/periodo.dto.js';
import { Aparar, ParaBooleano } from '../../common/dto/transformacoes.js';
import { REGEX_DATA_ISO } from '../../common/utils/datas.js';

export class ItemEntradaDto {
  @ApiProperty({ example: 396 })
  @IsInt()
  @IsPositive()
  idProduto: number;

  @ApiProperty({ example: 12, description: 'Quantidade que entrou (até 3 casas decimais)' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantidade: number;

  @ApiPropertyOptional({ example: 14.5, description: 'Custo unitário. Se omitido, usa o valor de compra do cadastro.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorCompra?: number;
}

export class RegistrarEntradaDto {
  @ApiPropertyOptional({ example: '00002201', maxLength: 15, description: 'Se omitido, usa o próximo número sequencial' })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(15)
  numeroNota?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  idFornecedor?: number;

  @ApiPropertyOptional({ example: '2026-11-04', description: 'Padrão: hoje' })
  @IsOptional()
  @Matches(REGEX_DATA_ISO, { message: 'dataLancamento deve estar no formato AAAA-MM-DD' })
  dataLancamento?: string;

  @ApiPropertyOptional({ example: '2026-12-04', description: 'Vencimento da conta a pagar. Padrão: data do lançamento' })
  @IsOptional()
  @Matches(REGEX_DATA_ISO, { message: 'vencimento deve estar no formato AAAA-MM-DD' })
  vencimento?: string;

  @ApiPropertyOptional({ default: true, description: 'Atualiza o valor de compra do cadastro com o custo informado' })
  @ParaBooleano()
  @IsOptional()
  atualizarValorCompra?: boolean;

  @ApiProperty({ type: [ItemEntradaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => ItemEntradaDto)
  itens: ItemEntradaDto[];
}

export class RegistrarAjusteDto {
  @ApiProperty({ example: 396 })
  @IsInt()
  @IsPositive()
  idProduto: number;

  @ApiProperty({ example: -2, description: 'Positivo = entrada; negativo = saída (perda, avaria...)' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @NotEquals(0, { message: 'quantidade não pode ser zero' })
  quantidade: number;

  @ApiProperty({ enum: MotivoAjusteEstoque })
  @IsEnum(MotivoAjusteEstoque)
  motivo: MotivoAjusteEstoque;
}

export const TIPOS_MOVIMENTACAO = ['ENTRADA', 'TROCA', 'AJUSTE_ENTRADA', 'AJUSTE_SAIDA', 'VENDA'] as const;
export type TipoMovimentacao = (typeof TIPOS_MOVIMENTACAO)[number];

export class ListarMovimentacoesDto extends PeriodoPaginadoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  idProduto?: number;

  @ApiPropertyOptional({ enum: TIPOS_MOVIMENTACAO })
  @IsOptional()
  @IsIn(TIPOS_MOVIMENTACAO)
  tipo?: TipoMovimentacao;
}
