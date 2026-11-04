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
import { FormaPagamento } from '../../common/constantes/legado.js';
import { PeriodoPaginadoDto } from '../../common/dto/periodo.dto.js';
import { ParaBooleano } from '../../common/dto/transformacoes.js';
import { REGEX_DATA_ISO } from '../../common/utils/datas.js';

export class ItemVendaDto {
  @ApiProperty({ example: 396 })
  @IsInt()
  @IsPositive()
  idProduto: number;

  @ApiProperty({ example: 2, description: 'Até 3 casas decimais (venda por metro/peso)' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantidade: number;

  @ApiPropertyOptional({
    example: 29.99,
    description: 'Preço unitário. Se omitido, usa o preço a prazo do cadastro (ou o à vista, se não houver).',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precoUnitario?: number;
}

export class PagamentoDto {
  @ApiProperty({ enum: FormaPagamento, example: FormaPagamento.DINHEIRO })
  @IsEnum(FormaPagamento)
  forma: FormaPagamento;

  @ApiProperty({ example: 59.98 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;
}

export class RegistrarVendaDto {
  @ApiPropertyOptional({ example: 175, description: 'Omitir (ou 0) para consumidor não identificado. Obrigatório no carnê.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  idCliente?: number;

  @ApiProperty({ type: [ItemVendaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => ItemVendaDto)
  itens: ItemVendaDto[];

  @ApiPropertyOptional({
    type: [ItemVendaDto],
    description: 'Itens devolvidos pelo cliente (troca). Voltam ao estoque e o valor é abatido do total.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ItemVendaDto)
  itensTroca?: ItemVendaDto[];

  @ApiPropertyOptional({ example: 5, default: 0, description: 'Desconto em reais (rateado nos itens)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  desconto?: number;

  @ApiPropertyOptional({ example: 0, default: 0, description: 'Acréscimo em reais (rateado nos itens)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  acrescimo?: number;

  @ApiProperty({
    type: [PagamentoDto],
    description: 'A soma deve ser igual ao total calculado pela API. Pode ficar vazio se a troca zerar o total.',
  })
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => PagamentoDto)
  pagamentos: PagamentoDto[];

  @ApiPropertyOptional({ example: 3, description: 'Número de parcelas do carnê (obrigatório se houver CARNE)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(48)
  parcelasCarne?: number;

  @ApiPropertyOptional({
    example: '2026-12-04',
    description: '1º vencimento do carnê. Padrão: 30 dias após a venda (como o desktop).',
  })
  @IsOptional()
  @Matches(REGEX_DATA_ISO, { message: 'primeiroVencimento deve estar no formato AAAA-MM-DD' })
  primeiroVencimento?: string;
}

export class ListarVendasDto extends PeriodoPaginadoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  idCliente?: number;

  @ApiPropertyOptional({ description: 'Vendedor (id do login da empresa); só para quem vê as vendas de todos' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idVendedor?: number;

  @ApiPropertyOptional({ enum: FormaPagamento })
  @IsOptional()
  @IsEnum(FormaPagamento)
  formaPagamento?: FormaPagamento;

  @ApiPropertyOptional({ default: false })
  @ParaBooleano()
  @IsOptional()
  incluirEstornadas?: boolean;

  @ApiPropertyOptional({ enum: ['recentes', 'antigas'], default: 'recentes' })
  @IsOptional()
  @IsIn(['recentes', 'antigas'])
  ordem?: 'recentes' | 'antigas';
}
