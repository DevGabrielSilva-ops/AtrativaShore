import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { PaginacaoDto } from '../../common/dto/paginacao.dto.js';
import { REGEX_DATA_ISO } from '../../common/utils/datas.js';

export class ListarAuditoriaDto extends PaginacaoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idUsuario?: number;

  @ApiPropertyOptional({ example: 'venda.', description: 'Ação ou prefixo da ação' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  acao?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @Matches(REGEX_DATA_ISO, { message: 'inicio deve estar no formato AAAA-MM-DD' })
  inicio?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @Matches(REGEX_DATA_ISO, { message: 'fim deve estar no formato AAAA-MM-DD' })
  fim?: string;
}

export class ListarAuditoriaPlataformaDto extends ListarAuditoriaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idEmpresa?: number;
}
