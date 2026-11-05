import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt, IsPositive } from 'class-validator';

export class ProdutosEtiquetaDto {
  @ApiProperty({ example: '12,15,40', description: 'Ids dos produtos separados por vírgula (até 500)' })
  @Transform(({ value }: { value: unknown }) =>
    (Array.isArray(value) ? value : String(value ?? '').split(','))
      .map((parte) => String(parte).trim())
      .filter(Boolean)
      .map(Number),
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  ids: number[];
}
