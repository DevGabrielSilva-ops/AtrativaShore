import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IoAlertCircle, IoEye, IoEyeOff, IoInformationCircle } from 'react-icons/io5';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { ApiError, mensagemErro } from '../../services/api';

export default function Login() {
  const { entrar, motivoSaida } = useAuth();
  const navegar = useNavigate();
  const local = useLocation();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [manterConectado, setManterConectado] = useState(false);
  const [erros, setErros] = useState<{ login?: string; senha?: string }>({});
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (enviando) return;
    const novos: typeof erros = {};
    if (!login.trim()) novos.login = 'Informe o usuário.';
    if (!senha) novos.senha = 'Informe a senha.';
    setErros(novos);
    if (Object.keys(novos).length) return;

    setEnviando(true);
    setFalha(null);
    try {
      await entrar(login.trim(), senha, manterConectado);
      const destino = (local.state as { de?: string } | null)?.de ?? '/';
      navegar(destino, { replace: true });
    } catch (erro) {
      setFalha(
        erro instanceof ApiError && erro.status === 401
          ? 'Usuário ou senha incorretos. Use o mesmo usuário do sistema da loja.'
          : mensagemErro(erro),
      );
      setSenha('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <div className="login-cartao">
        <img src="/logo.svg" alt="Atrativa Shore" className="login-logo" />
        <h1>Entrar</h1>
        <p className="muted">Use seu usuário e senha do sistema da loja.</p>

        {motivoSaida === 'expirada' && !falha ? (
          <div className="aviso-faixa info" role="status">
            <IoInformationCircle size={18} aria-hidden />
            <span>Sua sessão expirou. Entre novamente para continuar.</span>
          </div>
        ) : null}
        {falha ? (
          <div className="aviso-faixa erro" role="alert">
            <IoAlertCircle size={18} aria-hidden />
            <span>{falha}</span>
          </div>
        ) : null}

        <form className="pilha" onSubmit={enviar} noValidate>
          <div className={`campo ${erros.login ? 'campo-erro' : ''}`}>
            <label htmlFor="login-usuario">Usuário</label>
            <input
              id="login-usuario"
              className="entrada"
              autoComplete="username"
              autoCapitalize="characters"
              maxLength={15}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              aria-invalid={erros.login ? true : undefined}
              aria-describedby={erros.login ? 'login-usuario-erro' : undefined}
              autoFocus
            />
            {erros.login ? (
              <p className="campo-msg campo-msg-erro" id="login-usuario-erro">
                {erros.login}
              </p>
            ) : null}
          </div>

          <div className={`campo ${erros.senha ? 'campo-erro' : ''}`}>
            <label htmlFor="login-senha">Senha</label>
            <div className="entrada-senha">
              <input
                id="login-senha"
                className="entrada"
                type={mostrarSenha ? 'text' : 'password'}
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                aria-invalid={erros.senha ? true : undefined}
                aria-describedby={erros.senha ? 'login-senha-erro' : undefined}
              />
              <button
                type="button"
                className="btn btn-fantasma btn-icone btn-sm"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={mostrarSenha}
              >
                {mostrarSenha ? <IoEyeOff /> : <IoEye />}
              </button>
            </div>
            {erros.senha ? (
              <p className="campo-msg campo-msg-erro" id="login-senha-erro">
                {erros.senha}
              </p>
            ) : null}
          </div>

          <label className="caixa-selecao">
            <input type="checkbox" checked={manterConectado} onChange={(e) => setManterConectado(e.target.checked)} />
            Manter conectado neste computador
          </label>

          <Button type="submit" carregando={enviando} className="login-botao">
            {enviando ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
