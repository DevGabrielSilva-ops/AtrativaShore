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
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PeriodoPaginadoDto } from '../../common/dto/periodo.dto.js';
import { ParaBooleano } from '../../common/dto/transformacoes.js';
import { REGEX_DATA_ISO } from '../../common/utils/datas.js';

export enum FormaRecebimentoCarne {
  DINHEIRO = 'DINHEIRO',
  PIX = 'PIX',
  CARTAO = 'CARTAO',
}

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

  @ApiPropertyOptional({
    example: 2.5,
    description: 'Juros e multa (R$). Se omitido, usa o cálculo automático pela configuração de juros e multa do carnê.',
  })
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

export class PagamentoCarneDto {
  @ApiProperty({ enum: FormaRecebimentoCarne, example: FormaRecebimentoCarne.PIX })
  @IsEnum(FormaRecebimentoCarne, { message: 'forma deve ser DINHEIRO, PIX ou CARTAO' })
  forma: FormaRecebimentoCarne;

  @ApiProperty({ example: 50 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;
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

  @ApiPropertyOptional({
    type: [PagamentoCarneDto],
    description: 'Formas de pagamento (podem ser combinadas); a soma deve ser igual ao total. Se omitido, tudo em dinheiro.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => PagamentoCarneDto)
  pagamentos?: PagamentoCarneDto[];

  @ApiPropertyOptional({ example: 100, description: 'Valor entregue em dinheiro, para calcular o troco' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorRecebidoDinheiro?: number;
}

export class SimularBaixaDto {
  @ApiProperty({ example: ['2108612020015'], description: 'Códigos das parcelas' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(48)
  @Matches(/^\d{13}$/, { each: true, message: 'cada código deve ter 13 dígitos' })
  codigos: string[];

  @ApiPropertyOptional({ example: '2026-11-04' })
  @IsOptional()
  @Matches(REGEX_DATA_ISO, { message: 'dataPagamento deve estar no formato AAAA-MM-DD' })
  dataPagamento?: string;
}

export class ConfigCarneDto {
  @ApiProperty({ example: 0.35, description: 'Juros por dia de atraso (%)' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(10)
  jurosDia: number;

  @ApiProperty({ example: 1.25, description: 'Multa por atraso (%), cobrada uma vez após a carência' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  multa: number;

  @ApiProperty({ example: 5, description: 'Dias após o vencimento sem multa' })
  @IsInt()
  @Min(0)
  @Max(365)
  carenciaDias: number;
}
