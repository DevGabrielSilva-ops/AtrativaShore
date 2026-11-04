import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class AbrirCaixaDto {
  @ApiProperty({ example: 100, description: 'Troco inicial na gaveta (R$)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorAbertura: number;
}

export class FecharCaixaDto {
  @ApiPropertyOptional({
    example: 100,
    description: 'Valor que fica na gaveta para o próximo dia (informativo: não há coluna no banco para guardá-lo)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorProximoDia?: number;
}
