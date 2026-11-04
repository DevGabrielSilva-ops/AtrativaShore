import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Publico } from '../common/decorators/publico.decorator.js';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator.js';
import { AuthService } from './auth.service.js';
import { AlterarSenhaDto, LoginDto } from './dto/login.dto.js';
import type { UsuarioAutenticado } from './usuario-autenticado.js';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login com usuário e senha',
    description:
      'Retorna um JWT para enviar em "Authorization: Bearer <token>". ' +
      'No primeiro acesso a senha do sistema desktop é aceita e convertida em hash.',
  })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.login, dto.senha);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Dados do usuário autenticado' })
  me(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return usuario;
  }

  @ApiBearerAuth()
  @Patch('senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Altera a senha usada na API (não altera a senha do desktop)' })
  async alterarSenha(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dto: AlterarSenhaDto) {
    await this.auth.alterarSenha(usuario, dto.senhaAtual, dto.novaSenha);
  }
}
