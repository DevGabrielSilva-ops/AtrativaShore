import { useState } from "react";
import {
  IoAlertCircle,
  IoPeople,
  IoCart,
  IoCalendar,
  IoCash,
  IoCube,
  IoSearch,
} from "react-icons/io5";

import "./Relatorios.css";

type RelatorioAtivo =
  | "baixoEstoque"
  | "clientesDebito"
  | "vendasPeriodo"
  | "vendasDia"
  | "baixasCarne"
  | "mercadorias";

interface ProdutoEstoque {
  id: string;
  nome: string;
  estoque: number;
  estoqueMinimo: number;
}

interface ClienteDebito {
  id: string;
  nome: string;
  telefone: string;
  valorDebito: number;
  vencimento: string;
}

interface Venda {
  id: string;
  data: string;
  cliente: string;
  formaPagamento: string;
  total: number;
}

interface BaixaCarne {
  id: string;
  data: string;
  cliente: string;
  valorPago: number;
}

interface Mercadoria {
  id: string;
  dataCadastro: string;
  produto: string;
  quantidade: number;
  valorCompra: number;
}

const produtosBaixoEstoque: ProdutoEstoque[] = [
  { id: "1", nome: "Camiseta Feminina", estoque: 2, estoqueMinimo: 5 },
  { id: "2", nome: "Calça Jeans", estoque: 1, estoqueMinimo: 3 },
];

const clientesDebito: ClienteDebito[] = [
  {
    id: "1",
    nome: "Maria Silva",
    telefone: "(14) 99999-9999",
    valorDebito: 150,
    vencimento: "2026-06-20",
  },
];

const vendas: Venda[] = [
  {
    id: "1",
    data: "2026-06-16",
    cliente: "Maria Silva",
    formaPagamento: "Dinheiro",
    total: 89.9,
  },
  {
    id: "2",
    data: "2026-06-15",
    cliente: "João Santos",
    formaPagamento: "Pix",
    total: 139.9,
  },
];

const baixasCarne: BaixaCarne[] = [
  {
    id: "1",
    data: "2026-06-16",
    cliente: "Maria Silva",
    valorPago: 50,
  },
];

const mercadorias: Mercadoria[] = [
  {
    id: "1",
    dataCadastro: "2026-06-10",
    produto: "Manta Soft Casal",
    quantidade: 20,
    valorCompra: 25,
  },
  {
    id: "2",
    dataCadastro: "2026-06-15",
    produto: "Calça Jeans",
    quantidade: 10,
    valorCompra: 45,
  },
];

function Relatorios() {
  const [relatorioAtivo, setRelatorioAtivo] =
    useState<RelatorioAtivo>("baixoEstoque");

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [dataUnica, setDataUnica] = useState("");

  function formatarMoeda(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function filtrarPorPeriodo<T extends { data?: string; dataCadastro?: string }>(
    lista: T[]
  ) {
    if (!dataInicio && !dataFim) return lista;

    return lista.filter((item) => {
      const data = item.data || item.dataCadastro || "";

      if (dataInicio && data < dataInicio) return false;
      if (dataFim && data > dataFim) return false;

      return true;
    });
  }

  function filtrarPorDia<T extends { data: string }>(lista: T[]) {
    if (!dataUnica) return lista;

    return lista.filter((item) => item.data === dataUnica);
  }

  const vendasPeriodoFiltradas = filtrarPorPeriodo(vendas);
  const vendasDiaFiltradas = filtrarPorDia(vendas);
  const baixasFiltradas = filtrarPorDia(baixasCarne);
  const mercadoriasFiltradas = filtrarPorPeriodo(mercadorias);

  const totalVendasPeriodo = vendasPeriodoFiltradas.reduce(
    (total, venda) => total + venda.total,
    0
  );

  const totalVendasDia = vendasDiaFiltradas.reduce(
    (total, venda) => total + venda.total,
    0
  );

  const totalBaixasDia = baixasFiltradas.reduce(
    (total, baixa) => total + baixa.valorPago,
    0
  );

  const investimentoMercadorias = mercadoriasFiltradas.reduce(
    (total, item) => total + item.quantidade * item.valorCompra,
    0
  );

  return (
    <div className="relatorios">
      <div className="relatoriosHeader">
        <h1>Relatórios</h1>
        <p>Acompanhe estoque, vendas, carnês, clientes e investimentos.</p>
      </div>

      <section className="relatoriosMenu">
        <button
          className={relatorioAtivo === "baixoEstoque" ? "active" : ""}
          onClick={() => setRelatorioAtivo("baixoEstoque")}
        >
          <IoAlertCircle size={22} />
          Baixo Estoque
        </button>

        <button
          className={relatorioAtivo === "clientesDebito" ? "active" : ""}
          onClick={() => setRelatorioAtivo("clientesDebito")}
        >
          <IoPeople size={22} />
          Clientes com Débitos
        </button>

        <button
          className={relatorioAtivo === "vendasPeriodo" ? "active" : ""}
          onClick={() => setRelatorioAtivo("vendasPeriodo")}
        >
          <IoCart size={22} />
          Vendas por Período
        </button>

        <button
          className={relatorioAtivo === "vendasDia" ? "active" : ""}
          onClick={() => setRelatorioAtivo("vendasDia")}
        >
          <IoCalendar size={22} />
          Vendas do Dia
        </button>

        <button
          className={relatorioAtivo === "baixasCarne" ? "active" : ""}
          onClick={() => setRelatorioAtivo("baixasCarne")}
        >
          <IoCash size={22} />
          Baixas em Carnê
        </button>

        <button
          className={relatorioAtivo === "mercadorias" ? "active" : ""}
          onClick={() => setRelatorioAtivo("mercadorias")}
        >
          <IoCube size={22} />
          Mercadorias Cadastradas
        </button>
      </section>

      <section className="relatorioConteudo">
        {relatorioAtivo === "baixoEstoque" && (
          <>
            <div className="relatorioTitulo">
              <h2>Produtos com Baixo Estoque</h2>
              <span>{produtosBaixoEstoque.length} produtos encontrados</span>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Estoque Atual</th>
                  <th>Estoque Mínimo</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {produtosBaixoEstoque.map((produto) => (
                  <tr key={produto.id}>
                    <td>{produto.nome}</td>
                    <td>{produto.estoque}</td>
                    <td>{produto.estoqueMinimo}</td>
                    <td>
                      <span className="status perigo">Baixo estoque</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {relatorioAtivo === "clientesDebito" && (
          <>
            <div className="relatorioTitulo">
              <h2>Clientes com Débitos em Carnê</h2>
              <span>{clientesDebito.length} clientes encontrados</span>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Valor em Aberto</th>
                  <th>Vencimento</th>
                </tr>
              </thead>

              <tbody>
                {clientesDebito.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>{cliente.nome}</td>
                    <td>{cliente.telefone}</td>
                    <td>{formatarMoeda(cliente.valorDebito)}</td>
                    <td>{cliente.vencimento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {relatorioAtivo === "vendasPeriodo" && (
          <>
            <div className="relatorioTitulo">
              <h2>Relatório de Vendas por Período</h2>
              <strong>{formatarMoeda(totalVendasPeriodo)}</strong>
            </div>

            <div className="filtros">
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />

              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />

              <button>
                <IoSearch size={18} />
                Filtrar
              </button>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Pagamento</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {vendasPeriodoFiltradas.map((venda) => (
                  <tr key={venda.id}>
                    <td>{venda.data}</td>
                    <td>{venda.cliente}</td>
                    <td>{venda.formaPagamento}</td>
                    <td>{formatarMoeda(venda.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {relatorioAtivo === "vendasDia" && (
          <>
            <div className="relatorioTitulo">
              <h2>Relatório de Vendas do Dia</h2>
              <strong>{formatarMoeda(totalVendasDia)}</strong>
            </div>

            <div className="filtros">
              <input
                type="date"
                value={dataUnica}
                onChange={(e) => setDataUnica(e.target.value)}
              />

              <button>
                <IoSearch size={18} />
                Buscar Dia
              </button>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Pagamento</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {vendasDiaFiltradas.map((venda) => (
                  <tr key={venda.id}>
                    <td>{venda.data}</td>
                    <td>{venda.cliente}</td>
                    <td>{venda.formaPagamento}</td>
                    <td>{formatarMoeda(venda.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {relatorioAtivo === "baixasCarne" && (
          <>
            <div className="relatorioTitulo">
              <h2>Baixas Dadas em Carnê no Dia</h2>
              <strong>{formatarMoeda(totalBaixasDia)}</strong>
            </div>

            <div className="filtros">
              <input
                type="date"
                value={dataUnica}
                onChange={(e) => setDataUnica(e.target.value)}
              />

              <button>
                <IoSearch size={18} />
                Buscar Baixas
              </button>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Valor Pago</th>
                </tr>
              </thead>

              <tbody>
                {baixasFiltradas.map((baixa) => (
                  <tr key={baixa.id}>
                    <td>{baixa.data}</td>
                    <td>{baixa.cliente}</td>
                    <td>{formatarMoeda(baixa.valorPago)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {relatorioAtivo === "mercadorias" && (
          <>
            <div className="relatorioTitulo">
              <h2>Mercadorias Cadastradas / Investimento</h2>
              <strong>{formatarMoeda(investimentoMercadorias)}</strong>
            </div>

            <div className="filtros">
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />

              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />

              <button>
                <IoSearch size={18} />
                Filtrar
              </button>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Data Cadastro</th>
                  <th>Produto</th>
                  <th>Quantidade</th>
                  <th>Valor Compra</th>
                  <th>Investimento</th>
                </tr>
              </thead>

              <tbody>
                {mercadoriasFiltradas.map((item) => (
                  <tr key={item.id}>
                    <td>{item.dataCadastro}</td>
                    <td>{item.produto}</td>
                    <td>{item.quantidade}</td>
                    <td>{formatarMoeda(item.valorCompra)}</td>
                    <td>{formatarMoeda(item.quantidade * item.valorCompra)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  );
}

export default Relatorios;