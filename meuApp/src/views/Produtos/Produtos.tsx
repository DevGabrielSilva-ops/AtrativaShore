import { useState } from "react";
import {
  IoAdd,
  IoCreate,
  IoTrash,
  IoClose,
  IoSave,
  IoBarcodeOutline,
} from "react-icons/io5";

import "./Produtos.css";

interface Produto {
  id: string;
  nome: string;
  fornecedor: string;
  valorCompra: number;
  valorPrazo: number;
  valorVista: number;
  lucroBruto: number;
  codigoBarras: string;
  estoque: number;
  estoqueMinimo: number;
}

const fornecedores = ["Fornecedor A", "Fornecedor B", "Fornecedor C"];

const produtosIniciais: Produto[] = [
  {
    id: "1",
    nome: "Camiseta Feminina",
    fornecedor: "Fornecedor A",
    valorCompra: 20,
    valorPrazo: 49.9,
    valorVista: 39.9,
    lucroBruto: 99.5,
    codigoBarras: "789100000001",
    estoque: 15,
    estoqueMinimo: 5,
  },
  {
    id: "2",
    nome: "Calça Jeans",
    fornecedor: "Fornecedor B",
    valorCompra: 45,
    valorPrazo: 99.9,
    valorVista: 89.9,
    lucroBruto: 99.78,
    codigoBarras: "789100000002",
    estoque: 8,
    estoqueMinimo: 3,
  },
];

const produtoVazio: Produto = {
  id: "",
  nome: "",
  fornecedor: "",
  valorCompra: 0,
  valorPrazo: 0,
  valorVista: 0,
  lucroBruto: 0,
  codigoBarras: "",
  estoque: 0,
  estoqueMinimo: 0,
};

function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>(produtosIniciais);
  const [modalExcluir, setModalExcluir] = useState(false);
  const [modalFormulario, setModalFormulario] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [formProduto, setFormProduto] = useState<Produto>(produtoVazio);
  const [modoEdicao, setModoEdicao] = useState(false);

  function formatarMoeda(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function abrirCriarProduto() {
    setModoEdicao(false);
    setFormProduto({
      ...produtoVazio,
      id: crypto.randomUUID(),
    });
    setModalFormulario(true);
  }

  function abrirAlterarProduto(produto: Produto) {
    setModoEdicao(true);
    setFormProduto(produto);
    setModalFormulario(true);
  }

  function abrirExcluirProduto(produto: Produto) {
    setProdutoSelecionado(produto);
    setModalExcluir(true);
  }

  function confirmarExclusao() {
    if (!produtoSelecionado) return;

    setProdutos((lista) =>
      lista.filter((produto) => produto.id !== produtoSelecionado.id)
    );

    setModalExcluir(false);
    setProdutoSelecionado(null);
  }

  function gerarCodigoBarras() {
    const codigo = `789${Math.floor(100000000 + Math.random() * 900000000)}`;

    setFormProduto((produto) => ({
      ...produto,
      codigoBarras: codigo,
    }));
  }

  function calcularLucroBruto(valorCompra: number, valorVista: number) {
    if (valorCompra <= 0) return 0;

    return Number((((valorVista - valorCompra) / valorCompra) * 100).toFixed(2));
  }

  function atualizarCampo(campo: keyof Produto, valor: string | number) {
    const novoProduto = {
      ...formProduto,
      [campo]: valor,
    };

    if (campo === "valorCompra" || campo === "valorVista") {
      novoProduto.lucroBruto = calcularLucroBruto(
        Number(novoProduto.valorCompra),
        Number(novoProduto.valorVista)
      );
    }

    setFormProduto(novoProduto);
  }

  function salvarProduto() {
    if (!formProduto.nome || !formProduto.fornecedor) {
      alert("Preencha o nome do produto e o fornecedor.");
      return;
    }

    if (modoEdicao) {
      setProdutos((lista) =>
        lista.map((produto) =>
          produto.id === formProduto.id ? formProduto : produto
        )
      );
    } else {
      setProdutos((lista) => [...lista, formProduto]);
    }

    setModalFormulario(false);
    setFormProduto(produtoVazio);
  }

  return (
    <div className="produtos">
      <div className="produtosHeader">
        <div>
          <h1>Produtos</h1>
          <p>Cadastre, altere e controle o estoque dos produtos.</p>
        </div>

        <button className="novoProdutoButton" onClick={abrirCriarProduto}>
          <IoAdd size={22} />
          Criar Novo Produto
        </button>
      </div>

      <section className="produtosCard">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Código</th>
              <th>Fornecedor</th>
              <th>Compra</th>
              <th>À Vista</th>
              <th>À Prazo</th>
              <th>Estoque</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {produtos.map((produto) => (
              <tr key={produto.id}>
                <td>{produto.nome}</td>
                <td>{produto.codigoBarras}</td>
                <td>{produto.fornecedor}</td>
                <td>{formatarMoeda(produto.valorCompra)}</td>
                <td>{formatarMoeda(produto.valorVista)}</td>
                <td>{formatarMoeda(produto.valorPrazo)}</td>
                <td>
                  {produto.estoque} / mín. {produto.estoqueMinimo}
                </td>
                <td>
                  <div className="acoesProdutos">
                    <button
                      className="alterarButton"
                      onClick={() => abrirAlterarProduto(produto)}
                    >
                      <IoCreate size={18} />
                      Alterar
                    </button>

                    <button
                      className="excluirButton"
                      onClick={() => abrirExcluirProduto(produto)}
                    >
                      <IoTrash size={18} />
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {modalExcluir && produtoSelecionado && (
        <div className="modalOverlay">
          <div className="modalProduto pequeno">
            <h2>Excluir Produto</h2>

            <p>
              Deseja realmente excluir o produto{" "}
              <strong>{produtoSelecionado.nome}</strong>?
            </p>

            <div className="modalActions">
              <button onClick={() => setModalExcluir(false)}>
                Cancelar
              </button>

              <button className="danger" onClick={confirmarExclusao}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {modalFormulario && (
        <div className="modalOverlay">
          <div className="modalProduto formulario">
            <div className="modalHeader">
              <h2>{modoEdicao ? "Alterar Produto" : "Criar Novo Produto"}</h2>

              <button onClick={() => setModalFormulario(false)}>
                <IoClose size={24} />
              </button>
            </div>

            <div className="formGrid">
              <div className="campo full">
                <label>Nome do Produto</label>
                <input
                  type="text"
                  value={formProduto.nome}
                  onChange={(e) => atualizarCampo("nome", e.target.value)}
                />
              </div>

              <div className="campo">
                <label>Valor de Compra</label>
                <input
                  type="number"
                  value={formProduto.valorCompra}
                  onChange={(e) =>
                    atualizarCampo("valorCompra", Number(e.target.value))
                  }
                />
              </div>

              <div className="campo">
                <label>Valor à Vista</label>
                <input
                  type="number"
                  value={formProduto.valorVista}
                  onChange={(e) =>
                    atualizarCampo("valorVista", Number(e.target.value))
                  }
                />
              </div>

              <div className="campo">
                <label>Valor à Prazo</label>
                <input
                  type="number"
                  value={formProduto.valorPrazo}
                  onChange={(e) =>
                    atualizarCampo("valorPrazo", Number(e.target.value))
                  }
                />
              </div>

              <div className="campo">
                <label>Lucro Bruto (%)</label>
                <input
                  type="number"
                  value={formProduto.lucroBruto}
                  readOnly
                />
              </div>

              <div className="campo">
                <label>Fornecedor</label>
                <select
                  value={formProduto.fornecedor}
                  onChange={(e) =>
                    atualizarCampo("fornecedor", e.target.value)
                  }
                >
                  <option value="">Selecione</option>

                  {fornecedores.map((fornecedor) => (
                    <option key={fornecedor} value={fornecedor}>
                      {fornecedor}
                    </option>
                  ))}
                </select>
              </div>

              <div className="campo codigoCampo">
                <label>Código de Barras</label>

                <div className="codigoInput">
                  <input
                    type="text"
                    value={formProduto.codigoBarras}
                    onChange={(e) =>
                      atualizarCampo("codigoBarras", e.target.value)
                    }
                  />

                  <button onClick={gerarCodigoBarras}>
                    <IoBarcodeOutline size={20} />
                  </button>
                </div>
              </div>

              <div className="campo">
                <label>Estoque Atual</label>
                <input
                  type="number"
                  value={formProduto.estoque}
                  onChange={(e) =>
                    atualizarCampo("estoque", Number(e.target.value))
                  }
                />
              </div>

              <div className="campo">
                <label>Valor Mínimo de Estoque</label>
                <input
                  type="number"
                  value={formProduto.estoqueMinimo}
                  onChange={(e) =>
                    atualizarCampo("estoqueMinimo", Number(e.target.value))
                  }
                />
              </div>
            </div>

            <div className="modalActions">
              <button onClick={() => setModalFormulario(false)}>
                Cancelar
              </button>

              <button onClick={() => setModalFormulario(false)}>
                Fechar
              </button>

              <button className="success" onClick={salvarProduto}>
                <IoSave size={18} />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Produtos;