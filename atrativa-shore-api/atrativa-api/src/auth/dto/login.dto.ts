import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Aparar } from '../../common/dto/transformacoes.js';

export class LoginDto {
  @ApiProperty({ example: 'ATRATIVA', description: 'Login do usuário (cad_login.login)' })
  @Aparar()
  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  login: string;

  @ApiProperty({ example: '******', format: 'password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  senha: string;
}

export class AlterarSenhaDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  senhaAtual: string;

  @ApiProperty({ format: 'password', minLength: 6, maxLength: 72 })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  novaSenha: string;
}
