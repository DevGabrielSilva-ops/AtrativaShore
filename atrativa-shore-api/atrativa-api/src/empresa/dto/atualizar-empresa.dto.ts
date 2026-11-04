import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Aparar, MaiusculasAparadas } from '../../common/dto/transformacoes.js';

/** Campos editáveis de cad_empresa (licença, terminais e turnos ficam com o desktop). */
export class AtualizarEmpresaDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nome?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  endereco?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bairro?: string;

  @ApiPropertyOptional({ maxLength: 30 })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  cidade?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @MaiusculasAparadas()
  @IsOptional()
  @IsString()
  @Length(2, 2)
  uf?: string;

  @ApiPropertyOptional({ maxLength: 15 })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(15)
  cep?: string;

  @ApiPropertyOptional({ maxLength: 18 })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string;

  @ApiPropertyOptional({ maxLength: 16 })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  ie?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  im?: string;

  @ApiPropertyOptional({ maxLength: 15 })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(15)
  telefone?: string;

  @ApiPropertyOptional({ maxLength: 15 })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(15)
  fax?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @Aparar()
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  site?: string;

  @ApiPropertyOptional({ maxLength: 200, description: 'Mensagem impressa no cupom/carnê' })
  @Aparar()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  mensagem?: string;

  @ApiPropertyOptional({ description: 'Desconto máximo permitido nas vendas (%)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  maxDesconto?: number;

  @ApiPropertyOptional({ enum: [0, 1], description: 'Permite venda de quantidade fracionada' })
  @IsOptional()
  @IsIn([0, 1])
  fracionado?: number;
}
