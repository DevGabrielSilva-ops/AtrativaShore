import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { destinoInicial } from '../../utils/acesso';
import { AlterarSenha } from './AlterarSenha';

export default function TrocarSenha() {
  const { usuario, sair } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  if (!usuario.trocarSenha) return <Navigate to={destinoInicial(usuario)} replace />;
  return (
    <div className="login">
      <div className="login-cartao login-largo">
        <img src="/logo.svg" alt="Atrativa Shore" className="login-logo" />
        <h1>Crie sua senha</h1>
        <p className="muted">
          Olá, {usuario.nome.split(' ')[0]}. Você entrou com uma senha temporária. Defina uma senha pessoal para continuar.
        </p>
        <AlterarSenha titulo="Nova senha" descricao="Use a senha temporária como senha atual." />
        <button type="button" className="link-botao pequeno" onClick={() => sair('manual')}>
          Sair e continuar depois
        </button>
      </div>
    </div>
  );
}
