import { useState } from "react";
import {
  IoSearch,
  IoBarcodeOutline,
  IoAdd,
  IoRemove,
  IoTrash,
  IoCash,
  IoCard,
  IoQrCode,
  IoArrowBack,
  IoCheckmarkCircle,
  IoSwapHorizontal,
} from "react-icons/io5";

import "./Vendas.css";

interface Produto {
  id: string;
  nome: string;
  codigoBarras: string;
  preco: number;
}

interface ItemVenda extends Produto {
  quantidade: number;
}

const produtosMock: Produto[] = [
  {
    id: "1",
    nome: "Camiseta Feminina",
    codigoBarras: "789100000001",
    preco: 39.9,
  },
  {
    id: "2",
    nome: "Calça Jeans",
    codigoBarras: "789100000002",
    preco: 89.9,
  },
  {
    id: "3",
    nome: "Manta Soft Casal",
    codigoBarras: "789100000003",
    preco: 39.99,
  },
];

function Vendas() {
  const [busca, setBusca] = useState("");
  const [itensVenda, setItensVenda] = useState<ItemVenda[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [acrescimo, setAcrescimo] = useState(0);

  const [modalPagamento, setModalPagamento] = useState(false);
  const [modalRemover, setModalRemover] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState<ItemVenda | null>(null);
  const [quantidadeRemover, setQuantidadeRemover] = useState(1);

  const [formasPagamento, setFormasPagamento] = useState<string[]>([]);

  function formatarMoeda(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function adicionarProduto(produto: Produto) {
    const produtoJaExiste = itensVenda.find((item) => item.id === produto.id);

    if (produtoJaExiste) {
      setItensVenda((itens) =>
        itens.map((item) =>
          item.id === produto.id
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        )
      );
    } else {
      setItensVenda((itens) => [...itens, { ...produto, quantidade: 1 }]);
    }

    setBusca("");
  }

  function buscarProduto() {
    const produtoEncontrado = produtosMock.find(
      (produto) =>
        produto.codigoBarras === busca ||
        produto.nome.toLowerCase().includes(busca.toLowerCase())
    );

    if (!produtoEncontrado) {
      alert("Produto não encontrado");
      return;
    }

    adicionarProduto(produtoEncontrado);
  }

  function alterarQuantidade(id: string, tipo: "mais" | "menos") {
    setItensVenda((itens) =>
      itens
        .map((item) => {
          if (item.id !== id) return item;

          const novaQuantidade =
            tipo === "mais" ? item.quantidade + 1 : item.quantidade - 1;

          return { ...item, quantidade: novaQuantidade };
        })
        .filter((item) => item.quantidade > 0)
    );
  }

  function abrirModalRemover(item: ItemVenda) {
    setItemSelecionado(item);
    setQuantidadeRemover(1);
    setModalRemover(true);
  }

  function confirmarRemocao() {
    if (!itemSelecionado) return;

    setItensVenda((itens) =>
      itens
        .map((item) =>
          item.id === itemSelecionado.id
            ? { ...item, quantidade: item.quantidade - quantidadeRemover }
            : item
        )
        .filter((item) => item.quantidade > 0)
    );

    setModalRemover(false);
    setItemSelecionado(null);
  }

  function selecionarPagamento(forma: string) {
    if (formasPagamento.includes(forma)) {
      setFormasPagamento((formas) => formas.filter((item) => item !== forma));
    } else {
      setFormasPagamento((formas) => [...formas, forma]);
    }
  }

  function finalizarVenda() {
    if (formasPagamento.length === 0) {
      alert("Selecione pelo menos uma forma de pagamento");
      return;
    }

    alert("Venda concluída com sucesso!");

    setItensVenda([]);
    setDesconto(0);
    setAcrescimo(0);
    setFormasPagamento([]);
    setModalPagamento(false);
  }

  const subtotal = itensVenda.reduce(
    (total, item) => total + item.preco * item.quantidade,
    0
  );

  const total = subtotal - desconto + acrescimo;

  const produtosFiltrados = busca
    ? produtosMock.filter(
        (produto) =>
          produto.nome.toLowerCase().includes(busca.toLowerCase()) ||
          produto.codigoBarras.includes(busca)
      )
    : [];

  return (
    <div className="vendas">
      <div className="vendasHeader">
        <div>
          <h1>Vendas</h1>
          <p>Busque produtos por código de barras ou pelo nome.</p>
        </div>

        <button className="trocaButton">
          <IoSwapHorizontal size={22} />
          Realizar Troca
        </button>
      </div>

      <section className="buscaProduto">
        <div className="inputArea">
          <IoBarcodeOutline size={24} />
          <input
            type="text"
            placeholder="Digite ou passe o código de barras / nome do produto"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") buscarProduto();
            }}
          />
        </div>

        <button onClick={buscarProduto}>
          <IoSearch size={22} />
          Buscar
        </button>
      </section>

      {produtosFiltrados.length > 0 && (
        <div className="resultadoBusca">
          {produtosFiltrados.map((produto) => (
            <button key={produto.id} onClick={() => adicionarProduto(produto)}>
              <span>{produto.nome}</span>
              <strong>{formatarMoeda(produto.preco)}</strong>
            </button>
          ))}
        </div>
      )}

      <section className="vendaConteudo">
        <div className="listaProdutos">
          <h2>Produtos da Venda</h2>

          {itensVenda.length === 0 ? (
            <div className="vendaVazia">
              Nenhum produto adicionado à venda.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Qtd.</th>
                  <th>Preço</th>
                  <th>Total</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {itensVenda.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nome}</td>

                    <td>
                      <div className="quantidade">
                        <button onClick={() => alterarQuantidade(item.id, "menos")}>
                          <IoRemove />
                        </button>

                        <span>{item.quantidade}</span>

                        <button onClick={() => alterarQuantidade(item.id, "mais")}>
                          <IoAdd />
                        </button>
                      </div>
                    </td>

                    <td>{formatarMoeda(item.preco)}</td>
                    <td>{formatarMoeda(item.preco * item.quantidade)}</td>

                    <td>
                      <button
                        className="removeButton"
                        onClick={() => abrirModalRemover(item)}
                      >
                        <IoTrash size={18} />
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="resumoVenda">
          <h2>Resumo</h2>

          <div className="linhaResumo">
            <span>Subtotal</span>
            <strong>{formatarMoeda(subtotal)}</strong>
          </div>

          <label>Desconto</label>
          <input
            type="number"
            value={desconto}
            onChange={(e) => setDesconto(Number(e.target.value))}
          />

          <label>Acréscimo</label>
          <input
            type="number"
            value={acrescimo}
            onChange={(e) => setAcrescimo(Number(e.target.value))}
          />

          <div className="totalVenda">
            <span>Total</span>
            <strong>{formatarMoeda(total)}</strong>
          </div>

          <button
            className="concluirButton"
            disabled={itensVenda.length === 0}
            onClick={() => setModalPagamento(true)}
          >
            <IoCheckmarkCircle size={22} />
            Concluir Venda
          </button>
        </aside>
      </section>

      {modalRemover && itemSelecionado && (
        <div className="modalOverlay">
          <div className="modal">
            <h2>Remover Produto</h2>

            <p>
              Produto: <strong>{itemSelecionado.nome}</strong>
            </p>

            <label>Quantidade para remover</label>
            <input
              type="number"
              min={1}
              max={itemSelecionado.quantidade}
              value={quantidadeRemover}
              onChange={(e) => setQuantidadeRemover(Number(e.target.value))}
            />

            <div className="modalActions">
              <button onClick={() => setModalRemover(false)}>
                Cancelar
              </button>

              <button className="danger" onClick={confirmarRemocao}>
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {modalPagamento && (
        <div className="modalOverlay">
          <div className="modal pagamentoModal">
            <h2>Pagamento</h2>

            <div className="valorFinal">
              <span>Total da compra</span>
              <strong>{formatarMoeda(total)}</strong>
            </div>

            <div className="pagamentos">
              <button
                className={formasPagamento.includes("Dinheiro") ? "selected" : ""}
                onClick={() => selecionarPagamento("Dinheiro")}
              >
                <IoCash size={26} />
                Dinheiro
              </button>

              <button
                className={formasPagamento.includes("Pix") ? "selected" : ""}
                onClick={() => selecionarPagamento("Pix")}
              >
                <IoQrCode size={26} />
                Pix
              </button>

              <button
                className={formasPagamento.includes("Cartão") ? "selected" : ""}
                onClick={() => selecionarPagamento("Cartão")}
              >
                <IoCard size={26} />
                Cartão
              </button>

              <button
                className={formasPagamento.includes("Carnê") ? "selected" : ""}
                onClick={() => selecionarPagamento("Carnê")}
              >
                <IoCash size={26} />
                Carnê
              </button>
            </div>

            <div className="modalActions">
              <button onClick={() => setModalPagamento(false)}>
                <IoArrowBack size={20} />
                Retornar à Venda
              </button>

              <button className="success" onClick={finalizarVenda}>
                Concluir Pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Vendas;