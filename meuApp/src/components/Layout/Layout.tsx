import { Outlet, NavLink } from "react-router-dom";
import {
  IoHome,
  IoCash,
  IoCart,
  IoCube,
  IoPeople,
  IoBarChart,
  IoLogOut,
} from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import "./Layout.css";

function Layout() {
  const navigate = useNavigate()

  const clickSair = () => {
    navigate('/')
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logoArea">
          <img src="logo.svg" alt="" />
        </div>

        <nav className="menu">
          <NavLink to="/menu" end className={({ isActive }) => isActive ? "menuItem active" : "menuItem"}>
            <IoHome size={24} />
            <span>Menu Inicial</span>
          </NavLink>

          <NavLink to="/caixa" className={({ isActive }) => isActive ? "menuItem active" : "menuItem"}>
            <IoCash size={24} />
            <span>Caixa</span>
          </NavLink>

          <NavLink to="/vendas" className={({ isActive }) => isActive ? "menuItem active" : "menuItem"}>
            <IoCart size={24} />
            <span>Vendas</span>
          </NavLink>

          <NavLink to="/produtos" className={({ isActive }) => isActive ? "menuItem active" : "menuItem"}>
            <IoCube size={24} />
            <span>Produtos</span>
          </NavLink>

          <NavLink to="/clientes" className={({ isActive }) => isActive ? "menuItem active" : "menuItem"}>
            <IoPeople size={24} />
            <span>Clientes</span>
          </NavLink>

          <NavLink to="/relatorios" className={({ isActive }) => isActive ? "menuItem active" : "menuItem"}>
            <IoBarChart size={24} />
            <span>Relatórios</span>
          </NavLink>
        </nav>

        <button onClick={clickSair} className="logout">
          <IoLogOut size={24} />
          <span>Sair</span>
        </button>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;