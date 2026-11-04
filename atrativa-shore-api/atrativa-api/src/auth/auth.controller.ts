import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { QualquerUsuario } from '../acesso/acesso.decorators.js';
import { Publico } from '../common/decorators/publico.decorator.js';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator.js';
import { ConfiguracaoService } from '../config/configuracao.service.js';
import { AuthService } from './auth.service.js';
import { apagarCookie, COOKIE_REFRESH, gravarCookie, lerCookie } from './cookie-sessao.js';
import { AlterarSenhaDto, LoginDto } from './dto/login.dto.js';
import { type UsuarioAutenticado, usuarioPublico } from './usuario-autenticado.js';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfiguracaoService,
  ) {}

  @Publico()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login com e-mail ou usuário e senha',
    description:
      'Retorna o access token (curto) e grava o refresh token em cookie httpOnly. ' +
      'O papel do usuário indica o painel: SUPER_ADMIN vai para a plataforma; os demais, para a empresa.',
  })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) resposta: Response) {
    const resultado = await this.auth.login(dto.login, dto.senha, dto.lembrar ?? false);
    gravarCookie(resposta, this.config, resultado);
    return resultado.sessao;
  }

  @Publico()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renova o access token usando o cookie de sessão (rotação do refresh token)' })
  async renovar(@Req() requisicao: Request, @Res({ passthrough: true }) resposta: Response) {
    try {
      const resultado = await this.auth.renovar(lerCookie(requisicao, COOKIE_REFRESH));
      gravarCookie(resposta, this.config, resultado);
      return resultado.sessao;
    } catch (erro) {
      apagarCookie(resposta, this.config);
      throw erro;
    }
  }

  @Publico()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Encerra a sessão deste navegador' })
  async sair(@Req() requisicao: Request, @Res({ passthrough: true }) resposta: Response) {
    await this.auth.sair(lerCookie(requisicao, COOKIE_REFRESH));
    apagarCookie(resposta, this.config);
  }

  @ApiBearerAuth()
  @QualquerUsuario()
  @Get('me')
  @ApiOperation({ summary: 'Dados do usuário autenticado, papel e permissões' })
  me(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return usuarioPublico(usuario);
  }

  @ApiBearerAuth()
  @QualquerUsuario()
  @Patch('senha')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Troca a própria senha; encerra as outras sessões' })
  async alterarSenha(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dto: AlterarSenhaDto,
    @Res({ passthrough: true }) resposta: Response,
  ) {
    const resultado = await this.auth.alterarSenha(usuario, dto.senhaAtual, dto.novaSenha);
    gravarCookie(resposta, this.config, resultado);
    return resultado.sessao;
  }
}
