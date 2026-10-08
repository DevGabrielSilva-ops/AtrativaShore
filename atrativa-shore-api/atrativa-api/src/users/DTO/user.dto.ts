import {
    IsDateString,
    IsEmail,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';

export class CreateClienteDto {
    @IsOptional()
    @IsString()
    @MaxLength(60)
    nome_cliente?: string;

    @IsOptional()
    @IsString()
    @MaxLength(130)
    endereco?: string;

    @IsOptional()
    @IsString()
    @MaxLength(130)
    bairro?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    cidade?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    uf?: string;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    telefone?: string;

    @IsOptional()
    @IsString()
    @MaxLength(30)
    celular?: string;

    @IsOptional()
    @IsEmail()
    @MaxLength(60)
    email?: string;

    @IsOptional()
    @IsString()
    @MaxLength(11)
    cpf?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    cep?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    cod_barra?: string;

    @IsOptional()
    @IsDateString()
    dataniver?: string;

    @IsOptional()
    @IsString()
    @MaxLength(9)
    rg?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    inf_adicional?: string;

    @IsOptional()
    @IsNumber()
    faixasalarial?: number;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    ie?: string;
}