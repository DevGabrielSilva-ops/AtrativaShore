import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IoAlertCircle, IoArrowBack, IoCheckmarkCircle, IoKeyOutline } from 'react-icons/io5';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Field';
import { useAuth } from '../../contexts/AuthContext';
import { useFormulario } from '../../hooks/useFormulario';
import { ApiError, mensagemErro } from '../../services/api';
import { ativacaoService } from '../../services/servicos';
import type { ValidacaoCodigo } from '../../types/api';
import { destinoInicial } from '../../utils/acesso';
import { formatarDataHora } from '../../utils/formatar';
import { emailValido } from '../../utils/validar';
import { UFS } from '../compartilhado';

const FORMULARIO = {
  nome: '',
  email: '',
  login: '',
  senha: '',
  confirmacao: '',
  empresaNome: '',
  cnpj: '',
  telefone: '',
  empresaEmail: '',
  cidade: '',
  uf: '',
  endereco: '',
  bairro: '',
  cep: '',
};

function formatarCodigo(valor: string): string {
  const limpo = valor.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^ATV/, '').slice(0, 25);
  const grupos = limpo.match(/.{1,5}/g) ?? [];
  return grupos.length ? `ATV-${grupos.join('-')}` : '';
}

export default function Ativacao() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const [etapa, setEtapa] = useState<'codigo' | 'cadastro' | 'pronto'>('codigo');
  const [codigo, setCodigo] = useState('');
  const [validacao, setValidacao] = useState<ValidacaoCodigo | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [empresaCriada, setEmpresaCriada] = useState('');
  const form = useFormulario(FORMULARIO);
  const { campo, valores } = form;
  const novaEmpresa = validacao?.tipo === 'NOVA_EMPRESA';

  const validar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (codigo.replace(/[^0-9A-Z]/gi, '').length < 20) {
      setFalha('Digite o código completo, como recebeu do suporte.');
      return;
    }
    setEnviando(true);
    setFalha(null);
    try {
      setValidacao(await ativacaoService.validar(codigo));
      setEtapa('cadastro');
    } catch (erro) {
      setFalha(mensagemErro(erro));
    } finally {
      setEnviando(false);
    }
  };

  const concluir = async (evento: FormEvent) => {
    evento.preventDefault();
    const erros: Partial<Record<keyof typeof FORMULARIO, string>> = {};
    if (!valores.nome.trim()) erros.nome = 'Informe seu nome.';
    if (!emailValido(valores.email.trim())) erros.email = 'Informe um e-mail válido.';
    if (valores.login.trim() && !/^[A-Za-z0-9._-]{3,40}$/.test(valores.login.trim())) {
      erros.login = 'Use de 3 a 40 letras, números, ponto ou hífen.';
    }
    if (valores.senha.length < 8) erros.senha = 'Mínimo de 8 caracteres.';
    if (valores.confirmacao !== valores.senha) erros.confirmacao = 'As senhas não conferem.';
    if (novaEmpresa && !valores.empresaNome.trim()) erros.empresaNome = 'Informe o nome da empresa.';
    if (valores.empresaEmail.trim() && !emailValido(valores.empresaEmail.trim())) erros.empresaEmail = 'E-mail inválido.';
    form.setErros(erros);
    if (Object.keys(erros).length) return;

    setEnviando(true);
    setFalha(null);
    const texto = (valor: string) => valor.trim() || undefined;
    try {
      const resultado = await ativacaoService.concluir({
        codigo,
        responsavel: {
          nome: valores.nome.trim(),
          email: valores.email.trim(),
          login: texto(valores.login),
          senha: valores.senha,
        },
        empresa: novaEmpresa
          ? {
              nome: valores.empresaNome.trim(),
              cnpj: texto(valores.cnpj),
              telefone: texto(valores.telefone),
              email: texto(valores.empresaEmail),
              cidade: texto(valores.cidade),
              uf: texto(valores.uf),
              endereco: texto(valores.endereco),
              bairro: texto(valores.bairro),
              cep: texto(valores.cep),
            }
          : undefined,
      });
      setEmpresaCriada(resultado.empresa.nome);
      setEtapa('pronto');
    } catch (erro) {
      setFalha(mensagemErro(erro));
      if (erro instanceof ApiError && [404, 409, 410].includes(erro.status) && /código/i.test(mensagemErro(erro))) {
        setEtapa('codigo');
      }
    } finally {
      setEnviando(false);
    }
  };

  const entrarAgora = async () => {
    setEnviando(true);
    try {
      const usuario = await entrar(valores.email.trim(), valores.senha, false);
      navegar(destinoInicial(usuario), { replace: true });
    } catch (erro) {
      setFalha(mensagemErro(erro));
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <div className={`login-cartao ${etapa === 'cadastro' ? 'ativacao-cartao' : ''}`}>
        <img src="/logo.svg" alt="Atrativa Shore" className="login-logo" />

        {etapa === 'codigo' ? (
          <>
            <h1>Ativar empresa</h1>
            <p className="muted">Digite o código de ativação que você recebeu do Atrativa Shore.</p>
            {falha ? (
              <div className="aviso-faixa erro" role="alert">
                <IoAlertCircle size={18} aria-hidden />
                <span>{falha}</span>
              </div>
            ) : null}
            <form className="pilha" onSubmit={validar} noValidate>
              <Input
                rotulo="Código de ativação"
                value={codigo}
                onChange={(e) => setCodigo(formatarCodigo(e.target.value))}
                placeholder="ATV-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                autoComplete="off"
                spellCheck={false}
                className="campo-codigo"
                autoFocus
              />
              <Button type="submit" carregando={enviando} icone={<IoKeyOutline />} className="login-botao">
                Validar código
              </Button>
            </form>
            <p className="login-rodape pequeno">
              Já tem acesso? <Link to="/login">Entrar</Link>
            </p>
          </>
        ) : null}

        {etapa === 'cadastro' && validacao ? (
          <>
            <button type="button" className="link-botao pequeno ativacao-voltar" onClick={() => setEtapa('codigo')}>
              <IoArrowBack aria-hidden /> Trocar código
            </button>
            <h1>{novaEmpresa ? 'Cadastre sua empresa' : `Acesso de ${validacao.empresa?.nome ?? 'empresa'}`}</h1>
            <p className="muted">
              Código válido até {formatarDataHora(validacao.expiraEm)}.{' '}
              {novaEmpresa
                ? 'Você será o administrador da empresa e poderá cadastrar os funcionários.'
                : 'Você será administrador desta empresa.'}
              {validacao.emailDestinatario ? ` Use o e-mail ${validacao.emailDestinatario}.` : ''}
            </p>
            {falha ? (
              <div className="aviso-faixa erro" role="alert">
                <IoAlertCircle size={18} aria-hidden />
                <span>{falha}</span>
              </div>
            ) : null}
            <form onSubmit={concluir} noValidate>
              <div className="form-secao">
                <h3>Seus dados de acesso</h3>
                <div className="form-grade">
                  <Input className="col-6" rotulo="Nome completo" obrigatorio maxLength={100} autoComplete="name" {...campo('nome')} />
                  <Input className="col-3" rotulo="E-mail" type="email" obrigatorio maxLength={200} autoComplete="email" {...campo('email')} />
                  <Input className="col-3" rotulo="Usuário (opcional)" maxLength={40} autoComplete="username" ajuda="Para entrar sem digitar o e-mail." {...campo('login')} />
                  <Input className="col-3" rotulo="Senha" type="password" obrigatorio autoComplete="new-password" ajuda="Mínimo de 8 caracteres." {...campo('senha')} />
                  <Input className="col-3" rotulo="Confirme a senha" type="password" obrigatorio autoComplete="new-password" {...campo('confirmacao')} />
                </div>
              </div>
              {novaEmpresa ? (
                <div className="form-secao">
                  <h3>Dados da empresa</h3>
                  <div className="form-grade">
                    <Input className="col-4" rotulo="Nome da empresa" obrigatorio maxLength={100} {...campo('empresaNome')} />
                    <Input className="col-2" rotulo="CNPJ/CPF" maxLength={18} {...campo('cnpj')} />
                    <Input className="col-2" rotulo="Telefone" maxLength={15} {...campo('telefone')} />
                    <Input className="col-4" rotulo="E-mail da empresa" type="email" maxLength={200} {...campo('empresaEmail')} />
                    <Input className="col-4" rotulo="Endereço" maxLength={100} {...campo('endereco')} />
                    <Input className="col-2" rotulo="Bairro" maxLength={200} {...campo('bairro')} />
                    <Input className="col-3" rotulo="Cidade" maxLength={30} {...campo('cidade')} />
                    <Select className="col-1" rotulo="UF" {...campo('uf')}>
                      <option value="">—</option>
                      {UFS.map((uf) => (
                        <option key={uf}>{uf}</option>
                      ))}
                    </Select>
                    <Input className="col-2" rotulo="CEP" maxLength={15} {...campo('cep')} />
                  </div>
                </div>
              ) : null}
              <div className="form-acoes">
                <Button type="submit" carregando={enviando}>
                  {novaEmpresa ? 'Criar empresa e acesso' : 'Criar meu acesso'}
                </Button>
              </div>
            </form>
          </>
        ) : null}

        {etapa === 'pronto' ? (
          <div className="ativacao-pronta">
            <IoCheckmarkCircle size={44} aria-hidden className="nota-positivo" />
            <h1>Tudo pronto</h1>
            <p className="muted">
              {empresaCriada} está ativa no Atrativa Shore. Entre para cadastrar produtos, clientes e a sua equipe.
            </p>
            {falha ? <p className="aviso-faixa erro">{falha}</p> : null}
            <Button onClick={() => void entrarAgora()} carregando={enviando} className="login-botao">
              Entrar agora
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
