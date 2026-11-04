import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { REGEX_DATA_ISO } from '../utils/datas.js';
import { PaginacaoDto } from './paginacao.dto.js';

const MENSAGEM_DATA = '$property deve estar no formato AAAA-MM-DD';

export class PeriodoDto {
  @ApiPropertyOptional({ example: '2026-11-01', description: 'Data inicial (inclusive)' })
  @IsOptional()
  @Matches(REGEX_DATA_ISO, { message: MENSAGEM_DATA })
  inicio?: string;

  @ApiPropertyOptional({ example: '2026-11-30', description: 'Data final (inclusive)' })
  @IsOptional()
  @Matches(REGEX_DATA_ISO, { message: MENSAGEM_DATA })
  fim?: string;
}

export class PeriodoPaginadoDto extends IntersectionType(PeriodoDto, PaginacaoDto) {}
