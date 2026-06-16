import {
  IoCash,
  IoCart,
  IoCube,
  IoPeople,
  IoBarChart,
} from "react-icons/io5";

import '../MenuInicial/menu.css'
import { useNavigate } from "react-router-dom";

function MenuInicial() {
    const navigate = useNavigate()

    const clickCaixa = () => {
        navigate('/caixa')
    } 

    const clickVendas = () => {
        navigate('/vendas')
    } 

    const clickProdutos = () => {
        navigate('/produtos')
    } 
    const clickRelatorios = () => {
        navigate('/relatorios')
    } 
    const clickClientes = () => {
        navigate('/clientes')
    } 
  return (
    
    <div>
      <h1>Menu Inicial</h1>
      <p className="subtitle">Bem-vindo ao sistema Atrativa Shore</p>

      <div className="cards">
        <div onClick={clickCaixa} className="card">
          <IoCash size={34} />
          <h3>Caixa</h3>
          <p>Abrir e controlar o caixa da loja.</p>
        </div>

        <div onClick={clickVendas} className="card">
          <IoCart size={34} />
          <h3>Vendas</h3>
          <p>Registrar vendas e acompanhar pedidos.</p>
        </div>

        <div onClick={clickProdutos} className="card">
          <IoCube size={34} />
          <h3>Produtos</h3>
          <p>Gerenciar estoque e cadastro de produtos.</p>
        </div>

        <div onClick={clickClientes} className="card">
          <IoPeople size={34} />
          <h3>Clientes</h3>
          <p>Cadastrar e consultar clientes.</p>
        </div>

        <div onClick={clickRelatorios} className="card" >
          <IoBarChart size={34} />
          <h3>Relatórios</h3>
          <p>Acompanhar vendas, caixa e desempenho.</p>
        </div>
      </div>
    </div>
  );
}

export default MenuInicial;