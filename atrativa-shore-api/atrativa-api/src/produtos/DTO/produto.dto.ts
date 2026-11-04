import {
  IsString,
  IsNumber,
  IsNotEmpty,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProdutoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nome_produto: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  vr_compra: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  vr_venda: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  cod_barra: string;

  @IsString()
  @MaxLength(30)
  inf_adicional: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quantidade: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  min_estoque: number;
}