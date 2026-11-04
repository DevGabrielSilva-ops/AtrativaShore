import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { FormaPagamento } from '../../common/constantes/legado.js';
import { PeriodoDto, PeriodoPaginadoDto } from '../../common/dto/periodo.dto.js';
import { ParaBooleano } from '../../common/dto/transformacoes.js';
import { REGEX_DATA_ISO } from '../../common/utils/datas.js';

export class FaturamentoDto extends PeriodoDto {
  @ApiPropertyOptional({ enum: ['dia', 'mes'], default: 'dia' })
  @IsOptional()
  @IsIn(['dia', 'mes'])
  agrupar?: 'dia' | 'mes';
}

export class RankingDto extends PeriodoDto {
  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;
}

export class MaisVendidosDto extends RankingDto {
  @ApiPropertyOptional({ enum: ['quantidade', 'valor'], default: 'quantidade' })
  @IsOptional()
  @IsIn(['quantidade', 'valor'])
  ordenarPor?: 'quantidade' | 'valor';
}

export class VendasPorClienteDto extends RankingDto {
  @ApiPropertyOptional({ default: false, description: 'Inclui as vendas sem cliente identificado' })
  @ParaBooleano()
  @IsOptional()
  incluirNaoIdentificado?: boolean;
}

export class VendasPeriodoDto extends PeriodoPaginadoDto {
  @ApiPropertyOptional({ enum: FormaPagamento })
  @IsOptional()
  @IsEnum(FormaPagamento)
  formaPagamento?: FormaPagamento;
}

export class VendasDiaDto {
  @ApiPropertyOptional({ example: '2026-11-04', description: 'Padrão: hoje' })
  @IsOptional()
  @Matches(REGEX_DATA_ISO, { message: 'data deve estar no formato AAAA-MM-DD' })
  data?: string;
}
