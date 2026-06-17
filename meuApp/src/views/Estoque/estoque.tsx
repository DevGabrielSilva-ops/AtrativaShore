import { useState } from "react";
import {
  IoAdd,
  IoTrash,
  IoPrint,
  IoClose,
  IoSave,
  IoCube,
} from "react-icons/io5";

import "./Estoque.css";

interface ProdutoBanco {
  id: string;
  nome: string;
  quantidadeCadastrada: number;
  valorCompra: number;
}

interface ItemLancamento {
  id: string;
  produtoId: string;
  nome: string;
  quantidadeAtual: number;
  valorCompra: number;
  quantidadeAdicionar: number;
}

const produtosBanco: ProdutoBanco[] = [
  {
    id: "1",
    nome: "Camiseta Feminina",
    quantidadeCadastrada: 15,
    valorCompra: 20,
  },
  {
    id: "2",
    nome: "Calça Jeans",
    quantidadeCadastrada: 8,
    valorCompra: 45,
  },
  {
    id: "3",
    nome: "Manta Soft Casal",
    quantidadeCadastrada: 12,
    valorCompra: 25,
  },
];

function Estoque() {
  const [modalNovo, setModalNovo] = useState(false);
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState("");
  const [quantidadeAdicionar, setQuantidadeAdicionar] = useState(0);
  const [itensLancamento, setItensLancamento] = useState<ItemLancamento[]>([]);

  const produtoSelecionado = produtosBanco.find(
    (produto) => produto.id === produtoSelecionadoId
  );

  function formatarMoeda(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function adicionarMercadoria() {
    if (!produtoSelecionado) {
      alert("Selecione uma mercadoria.");
      return;
    }

    if (quantidadeAdicionar <= 0) {
      alert("Digite uma quantidade válida.");
      return;
    }

    const itemJaExiste = itensLancamento.find(
      (item) => item.produtoId === produtoSelecionado.id
    );

    if (itemJaExiste) {
      setItensLancamento((lista) =>
        lista.map((item) =>
          item.produtoId === produtoSelecionado.id
            ? {
                ...item,
                quantidadeAdicionar:
                  item.quantidadeAdicionar + quantidadeAdicionar,
              }
            : item
        )
      );
    } else {
      const novoItem: ItemLancamento = {
        id: crypto.randomUUID(),
        produtoId: produtoSelecionado.id,
        nome: produtoSelecionado.nome,
        quantidadeAtual: produtoSelecionado.quantidadeCadastrada,
        valorCompra: produtoSelecionado.valorCompra,
        quantidadeAdicionar,
      };

      setItensLancamento((lista) => [...lista, novoItem]);
    }

    setProdutoSelecionadoId("");
    setQuantidadeAdicionar(0);
  }

  function removerMercadoria(itemId: string) {
    const item = itensLancamento.find((produto) => produto.id === itemId);

    if (!item) return;

    const quantidadeRemover = Number(
      prompt(
        `Quantas unidades deseja remover de ${item.nome}?\nQuantidade lançada: ${item.quantidadeAdicionar}`
      )
    );

    if (!quantidadeRemover || quantidadeRemover <= 0) {
      alert("Quantidade inválida.");
      return;
    }

    if (quantidadeRemover > item.quantidadeAdicionar) {
      alert("Você não pode remover mais do que a quantidade lançada.");
      return;
    }

    setItensLancamento((lista) =>
      lista
        .map((produto) =>
          produto.id === itemId
            ? {
                ...produto,
                quantidadeAdicionar:
                  produto.quantidadeAdicionar - quantidadeRemover,
              }
            : produto
        )
        .filter((produto) => produto.quantidadeAdicionar > 0)
    );
  }

  function salvarMercadorias() {
    if (itensLancamento.length === 0) {
      alert("Adicione pelo menos uma mercadoria.");
      return;
    }

    alert("Mercadorias salvas e estoque atualizado com sucesso!");
    setItensLancamento([]);
    setModalNovo(false);
  }

  function imprimirNota() {
    window.print();
  }

  const totalInvestimento = itensLancamento.reduce(
    (total, item) => total + item.valorCompra * item.quantidadeAdicionar,
    0
  );

  return (
    <div className="estoque">
      <div className="estoqueHeader">
        <div>
          <h1>Estoque</h1>
          <p>Controle a entrada de novas mercadorias no estoque.</p>
        </div>

        <button className="novoEstoqueButton" onClick={() => setModalNovo(true)}>
          <IoAdd size={22} />
          Novo
        </button>
      </div>

      <section className="estoqueCard">
        <h2>Mercadorias Cadastradas</h2>

        <table>
          <thead>
            <tr>
              <th>Mercadoria</th>
              <th>Quantidade cadastrada</th>
              <th>Valor de compra</th>
              <th>Investimento atual</th>
            </tr>
          </thead>

          <tbody>
            {produtosBanco.map((produto) => (
              <tr key={produto.id}>
                <td>{produto.nome}</td>
                <td>{produto.quantidadeCadastrada}</td>
                <td>{formatarMoeda(produto.valorCompra)}</td>
                <td>
                  {formatarMoeda(
                    produto.quantidadeCadastrada * produto.valorCompra
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {modalNovo && (
        <div className="modalOverlay">
          <div className="modalEstoque">
            <div className="modalEstoqueHeader">
              <div>
                <h2>Novo Lançamento de Mercadorias</h2>
                <p>Selecione uma mercadoria cadastrada e informe a quantidade.</p>
              </div>

              <button onClick={() => setModalNovo(false)}>
                <IoClose size={24} />
              </button>
            </div>

            <section className="formLancamento">
              <div className="campoEstoque grande">
                <label>Selecionar mercadoria</label>
                <select
                  value={produtoSelecionadoId}
                  onChange={(e) => setProdutoSelecionadoId(e.target.value)}
                >
                  <option value="">Selecione uma mercadoria</option>

                  {produtosBanco.map((produto) => (
                    <option key={produto.id} value={produto.id}>
                      {produto.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="campoEstoque">
                <label>Qtd. já cadastrada</label>
                <input
                  type="number"
                  value={produtoSelecionado?.quantidadeCadastrada || 0}
                  readOnly
                />
              </div>

              <div className="campoEstoque">
                <label>Valor de compra</label>
                <input
                  type="text"
                  value={
                    produtoSelecionado
                      ? formatarMoeda(produtoSelecionado.valorCompra)
                      : "R$ 0,00"
                  }
                  readOnly
                />
              </div>

              <div className="campoEstoque">
                <label>Quantidade a adicionar</label>
                <input
                  type="number"
                  value={quantidadeAdicionar}
                  onChange={(e) =>
                    setQuantidadeAdicionar(Number(e.target.value))
                  }
                />
              </div>

              <button className="adicionarMercadoriaButton" onClick={adicionarMercadoria}>
                <IoAdd size={20} />
                Adicionar
              </button>
            </section>

            <section className="listagemLancamento">
              <h3>Mercadorias adicionadas na nota</h3>

              {itensLancamento.length === 0 ? (
                <div className="estoqueVazio">
                  Nenhuma mercadoria adicionada.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Mercadoria</th>
                      <th>Qtd. atual</th>
                      <th>Qtd. adicionada</th>
                      <th>Valor compra</th>
                      <th>Total</th>
                      <th>Ações</th>
                    </tr>
                  </thead>

                  <tbody>
                    {itensLancamento.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <IoCube size={18} /> {item.nome}
                        </td>
                        <td>{item.quantidadeAtual}</td>
                        <td>{item.quantidadeAdicionar}</td>
                        <td>{formatarMoeda(item.valorCompra)}</td>
                        <td>
                          {formatarMoeda(
                            item.valorCompra * item.quantidadeAdicionar
                          )}
                        </td>
                        <td>
                          <button
                            className="excluirMercadoriaButton"
                            onClick={() => removerMercadoria(item.id)}
                          >
                            <IoTrash size={18} />
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="totalEstoque">
                <span>Total do investimento</span>
                <strong>{formatarMoeda(totalInvestimento)}</strong>
              </div>
            </section>

            <div className="botoesEstoque">
              <button onClick={imprimirNota}>
                <IoPrint size={18} />
                Imprimir Nota
              </button>

              <button onClick={() => setModalNovo(false)}>
                <IoClose size={18} />
                Fechar
              </button>

              <button className="salvarEstoqueButton" onClick={salvarMercadorias}>
                <IoSave size={18} />
                Salvar Mercadoria
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Estoque;