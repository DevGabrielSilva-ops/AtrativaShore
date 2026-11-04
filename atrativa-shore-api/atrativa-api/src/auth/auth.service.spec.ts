import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { Repository } from 'typeorm';
import type { ConfiguracaoService } from '../config/configuracao.service.js';
import type { Credencial } from '../usuarios/entities/credencial.entity.js';
import type { Usuario } from '../usuarios/entities/usuario.entity.js';
import type { UsuariosService } from '../usuarios/usuarios.service.js';
import { AuthService } from './auth.service.js';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';

function montar(senhaLegada: string | null, hashExistente?: string) {
  const usuario = { id: 1, login: 'ATRATIVA', senhaLegada, idPerfil: 1, autoriza: 'S' } as Usuario;
  const credenciais = new Map<number, string>();
  if (hashExistente) credenciais.set(1, hashExistente);

  const usuarios = {
    buscarParaAutenticacao: async (login: string) => (login === 'ATRATIVA' ? usuario : null),
    montarAutenticado: async () => ({ id: 1, login: 'ATRATIVA', idPerfil: 1, perfil: 'ADMINISTRADOR', administrador: true }),
  } as unknown as UsuariosService;
  const repositorio = {
    findOne: async () => (credenciais.has(1) ? { idLogin: 1, senhaHash: credenciais.get(1) } : null),
    upsert: vi.fn(async (dados: { idLogin: number; senhaHash: string }) => {
      credenciais.set(dados.idLogin, dados.senhaHash);
    }),
  } as unknown as Repository<Credencial> & { upsert: ReturnType<typeof vi.fn> };
  const config = { valores: { bcryptRodadas: 4 } } as unknown as ConfiguracaoService;
  const jwt = new JwtService({ secret: SEGREDO, signOptions: { expiresIn: '1h' } });

  return { servico: new AuthService(usuarios, jwt, config, repositorio), repositorio, credenciais, jwt };
}

describe('AuthService', () => {
  it('no primeiro login aceita a senha do desktop e grava o hash bcrypt em api_credencial', async () => {
    const { servico, repositorio, credenciais, jwt } = montar('202020');
    const resposta = await servico.login('ATRATIVA', '202020');

    expect(repositorio.upsert).toHaveBeenCalledTimes(1);
    const hash = credenciais.get(1)!;
    expect(hash).not.toBe('202020');
    expect(await bcrypt.compare('202020', hash)).toBe(true);

    expect(resposta.tokenType).toBe('Bearer');
    expect(jwt.verify<{ sub: number }>(resposta.accessToken).sub).toBe(1);
    expect(JSON.stringify(resposta)).not.toContain('202020');
  });

  it('depois da migração usa somente o hash', async () => {
    const hash = await bcrypt.hash('nova-senha', 4);
    const { servico, repositorio } = montar('202020', hash);
    await expect(servico.login('ATRATIVA', '202020')).rejects.toThrow(UnauthorizedException);
    await expect(servico.login('ATRATIVA', 'nova-senha')).resolves.toMatchObject({ tokenType: 'Bearer' });
    expect(repositorio.upsert).not.toHaveBeenCalled();
  });

  it('recusa senha errada e usuário inexistente com a mesma mensagem', async () => {
    const { servico } = montar('202020');
    await expect(servico.login('ATRATIVA', 'errada')).rejects.toThrow('Usuário ou senha inválidos');
    await expect(servico.login('NINGUEM', '202020')).rejects.toThrow('Usuário ou senha inválidos');
  });

  it('recusa usuário legado sem senha cadastrada', async () => {
    const { servico } = montar(null);
    await expect(servico.login('ATRATIVA', '')).rejects.toThrow(UnauthorizedException);
  });

  it('altera a senha da API exigindo a senha atual', async () => {
    const { servico, credenciais } = montar('202020');
    const usuario = { id: 1, login: 'ATRATIVA', idPerfil: 1, perfil: 'ADMINISTRADOR', administrador: true };
    await expect(servico.alterarSenha(usuario, 'errada', 'outra-senha')).rejects.toThrow('Senha atual incorreta');
    await servico.alterarSenha(usuario, '202020', 'outra-senha');
    expect(await bcrypt.compare('outra-senha', credenciais.get(1)!)).toBe(true);
  });
});
