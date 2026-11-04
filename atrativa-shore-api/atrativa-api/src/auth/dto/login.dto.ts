import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Aparar } from '../../common/dto/transformacoes.js';

export class LoginDto {
  @ApiProperty({ example: 'maria@loja.com', description: 'E-mail ou usuário de acesso' })
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  login: string;

  @ApiProperty({ example: '******', format: 'password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  senha: string;

  @ApiPropertyOptional({ default: false, description: 'Mantém a sessão por mais tempo neste navegador' })
  @IsOptional()
  @IsBoolean()
  lembrar?: boolean;
}

export class AlterarSenhaDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  senhaAtual: string;

  @ApiProperty({ format: 'password', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  novaSenha: string;
}
