import { useState } from "react";
import { IoMail, IoLockClosed, IoEye, IoEyeOff } from "react-icons/io5";
import "./Login.css";
import { useNavigate } from "react-router-dom";

function Login() {
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const navigate = useNavigate()

  const clickLogin = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('clickado')
    navigate('/menu')
  }
  return (
    <div className="loginPage">
      <div className="loginCard">
        <div className="loginLogoArea">
          <img src="/logo.svg" alt="Logo do sistema" />
        </div>

        <form className="loginForm" onSubmit={clickLogin}>
          <label>E-mail</label>
          <div className="loginInput">
            <IoMail size={20} />
            <input type="email" placeholder="Digite seu e-mail" />
          </div>

          <label>Senha</label>
          <div className="loginInput">
            <IoLockClosed size={20} />
            <input
              type={mostrarSenha ? "text" : "password"}
              placeholder="Digite sua senha"
            />

            <button
              type="button"
              onClick={() => setMostrarSenha(!mostrarSenha)}
            >
              {mostrarSenha ? <IoEyeOff size={20} /> : <IoEye size={20} />}
            </button>
          </div>

          <div className="loginOptions">
            <label className="remember">
              <input type="checkbox" />
              Lembrar-me
            </label>

            <a href="#">Esqueci minha senha</a>
          </div>

          <button className="loginButton" type="submit">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;