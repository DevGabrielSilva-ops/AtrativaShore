import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { PeriodoPaginadoDto } from '../../common/dto/periodo.dto.js';
import { ParaBooleano } from '../../common/dto/transformacoes.js';
import { REGEX_DATA_ISO } from '../../common/utils/datas.js';

export const SITUACOES_PARCELA = ['ABERTA', 'PAGA', 'TODAS'] as const;
export type SituacaoParcelaFiltro = (typeof SITUACOES_PARCELA)[number];

export class ListarCarnesDto extends PeriodoPaginadoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  idCliente?: number;

  @ApiPropertyOptional({ enum: SITUACOES_PARCELA, default: 'ABERTA' })
  @IsOptional()
  @IsIn(SITUACOES_PARCELA)
  situacao?: SituacaoParcelaFiltro;

  @ApiPropertyOptional({ description: 'Somente parcelas em aberto com vencimento anterior a hoje' })
  @ParaBooleano()
  @IsOptional()
  vencidas?: boolean;
}

export class ParcelaBaixaDto {
  @ApiProperty({ example: '2108612020015', description: 'Código do carnê (13 dígitos)' })
  @Matches(/^\d{13}$/, { message: 'codigo deve ter 13 dígitos' })
  codigo: string;

  @ApiPropertyOptional({ example: 2.5, description: 'Juros ou multa (R$)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  juros?: number;

  @ApiPropertyOptional({ example: 0, description: 'Desconto (R$)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  desconto?: number;
}

export class BaixaCarneDto {
  @ApiProperty({ type: [ParcelaBaixaDto], description: 'Uma ou mais parcelas pagas juntas' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(48)
  @ValidateNested({ each: true })
  @Type(() => ParcelaBaixaDto)
  parcelas: ParcelaBaixaDto[];

  @ApiPropertyOptional({ example: '2026-11-04', description: 'Padrão: hoje. Não pode ser futura.' })
  @IsOptional()
  @Matches(REGEX_DATA_ISO, { message: 'dataPagamento deve estar no formato AAAA-MM-DD' })
  dataPagamento?: string;
}
