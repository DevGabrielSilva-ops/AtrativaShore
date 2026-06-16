import { BrowserRouter, Routes, Route } from "react-router-dom";

import Layout from "../src/components/Layout/Layout";
import MenuInicial from "../src/views/MenuInicial/menu"
import Caixa from "../src/views/Caixa/caixa";
import Vendas from "./views/Vendas/Vendas";
import Produtos from "./views/Produtos/Produtos";
import Clientes from "./views/Clientes/clientes";
import Relatorios from "./views/Relatórios/relatorios";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<MenuInicial />} />
          <Route path="caixa" element={<Caixa />} />
          <Route path="vendas" element={<Vendas />} />
          <Route path="produtos" element={<Produtos />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="relatorios" element={<Relatorios />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App