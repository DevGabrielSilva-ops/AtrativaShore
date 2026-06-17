import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./views/Login/Login";
import Layout from "./components/Layout/Layout";

import MenuInicial from "./views/MenuInicial/menu";
import Caixa from "./views/Caixa/caixa";
import Vendas from "./views/Vendas/vendas";
import Produtos from "./views/Produtos/Produtos";
import Clientes from "./views/Clientes/clientes";
import Relatorios from "./views/Relatórios/relatorios";
import Carnes from "./views/Carnês/carnes";
import Estoque from "./views/Estoque/estoque";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route element={<Layout />}>
          <Route path="/menu" element={<MenuInicial />} />
          <Route path="/caixa" element={<Caixa />} />
          <Route path="/vendas" element={<Vendas />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/carnês" element={<Carnes />} />
          <Route path="/estoque" element={<Estoque />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;