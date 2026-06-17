import { useState } from "react";
import {
  IoPeople,
  IoDocumentText,
  IoCash,
  IoQrCode,
  IoArrowBack,
  IoClose,
  IoEye,
  IoCheckmarkCircle,
  IoSearch,
} from "react-icons/io5";

import "./Carnes.css";

interface Cliente {
  id: string;
  nome: string;
}

interface Carne {
  id: string;
  clienteId: string;
  codigo: string;
  vencimento: string;
  valorParcela: number;
  numeroParcela: string;
  valorTotalCompra: number;
  status: "aberto" | "pago";
}

const clientes: Cliente[] = [
  { id: "1", nome: "Maria Silva" },
  { id: "2", nome: "João Santos" },
];

const carnesIniciais: Carne[] = [
  {
    id: "1",
    clienteId: "1",
    codigo: "CAR-1001",
    vencimento: "2026-06-25",
    valorParcela: 80,
    numeroParcela: "1/5",
    valorTotalCompra: 400,
    status: "aberto",
  },
  {
    id: "2",
    clienteId: "1",
    codigo: "CAR-1002",
    vencimento: "2026-07-25",
    valorParcela: 120,
    numeroParcela: "2/4",
    valorTotalCompra: 480,
    status: "aberto",
  },
];

function Carnes() {
  const [carnes, setCarnes] = useState<Carne[]>(carnesIniciais);
  const [clienteSelecionado, setClienteSelecionado] =
    useState<Cliente | null>(null);
  const [carneSelecionado, setCarneSelecionado] =
    useState<Carne | null>(null);

  const [dataPagamento, setDataPagamento] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [juros, setJuros] = useState(0);
  const [desconto, setDesconto] = useState(0);
  const [modalPagamento, setModalPagamento] = useState(false);
  const [modalVisualizar, setModalVisualizar] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [pesquisaCliente, setPesquisaCliente] = useState("");

  function formatarMoeda(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function normalizarTexto(texto: string) {
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  const clientesFiltrados = clientes.filter((cliente) =>
    normalizarTexto(cliente.nome).includes(normalizarTexto(pesquisaCliente))
  );

  function selecionarCarne(carne: Carne) {
    setCarneSelecionado(carne);
    setDataPagamento(new Date().toISOString().split("T")[0]);
    setJuros(0);
    setDesconto(0);
    setFormaPagamento("");
  }

  function voltarParaClientes() {
    setClienteSelecionado(null);
    setCarneSelecionado(null);
    setFormaPagamento("");
    setJuros(0);
    setDesconto(0);
  }

  function voltarParaCarnes() {
    setCarneSelecionado(null);
    setFormaPagamento("");
    setJuros(0);
    setDesconto(0);
  }

  function confirmarPagamento() {
    if (!carneSelecionado) return;

    if (!formaPagamento) {
      alert("Selecione uma forma de pagamento.");
      return;
    }

    setCarnes((lista) =>
      lista.map((carne) =>
        carne.id === carneSelecionado.id
          ? { ...carne, status: "pago" }
          : carne
      )
    );

    alert("Pagamento confirmado com sucesso!");

    setModalPagamento(false);
    setCarneSelecionado(null);
    setFormaPagamento("");
    setJuros(0);
    setDesconto(0);
  }

  const carnesDoCliente = carnes.filter(
    (carne) =>
      carne.clienteId === clienteSelecionado?.id && carne.status === "aberto"
  );

  const valorTotalEmAberto = carnesDoCliente.reduce(
    (total, carne) => total + carne.valorParcela,
    0
  );

  const valorTotalParcela =
    (carneSelecionado?.valorParcela || 0) + juros - desconto;

  return (
    <div className="carnes">
      <div className="carnesHeader">
        <h1>Carnês</h1>
        <p>Consulte carnês em aberto e registre pagamentos de parcelas.</p>
      </div>

      {!clienteSelecionado && (
        <section className="clientesCarnes">
          <h2>Clientes</h2>

          <div className="pesquisaCarnes" >
            <IoSearch size={20} />

            <input
              type="text"
              placeholder="Pesquisar cliente pelo nome..."
              
              value={pesquisaCliente}
              onChange={(e) => setPesquisaCliente(e.target.value)}
            />
          </div>

          <div className="listaClientesCarnes">
            {clientesFiltrados.length === 0 ? (
              <div className="semCarnes">
                Nenhum cliente encontrado.
              </div>
            ) : (
              clientesFiltrados.map((cliente) => (
                <button
                  key={cliente.id}
                  onClick={() => setClienteSelecionado(cliente)}
                >
                  <IoPeople size={24} />
                  <span>{cliente.nome}</span>
                </button>
              ))
            )}
          </div>
        </section>
      )}

      {clienteSelecionado && !carneSelecionado && (
        <section className="carnesAbertos">
          <div className="sectionHeaderCarnes">
            <div>
              <h2>Carnês em Aberto</h2>
              <p>Cliente: {clienteSelecionado.nome}</p>
            </div>

            <button className="voltarButton" onClick={voltarParaClientes}>
              <IoArrowBack size={20} />
              Voltar
            </button>
          </div>

          <div className="resumoCliente">
            <span>Carnês em aberto: {carnesDoCliente.length}</span>
            <span>Total em aberto: {formatarMoeda(valorTotalEmAberto)}</span>
          </div>

          {carnesDoCliente.length === 0 ? (
            <div className="semCarnes">
              Este cliente não possui carnês em aberto.
            </div>
          ) : (
            <div className="listaCarnes">
              {carnesDoCliente.map((carne) => (
                <button key={carne.id} onClick={() => selecionarCarne(carne)}>
                  <IoDocumentText size={28} />

                  <div>
                    <strong>{carne.codigo}</strong>
                    <span>Vencimento: {carne.vencimento}</span>
                    <span>Parcela: {carne.numeroParcela}</span>
                  </div>

                  <strong>{formatarMoeda(carne.valorParcela)}</strong>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {clienteSelecionado && carneSelecionado && (
        <section className="detalhesCarne">
          <div className="sectionHeaderCarnes">
            <div>
              <h2>Pagamento de Carnê</h2>
              <p>Cliente: {clienteSelecionado.nome}</p>
            </div>

            <button className="fecharButton" onClick={voltarParaClientes}>
              <IoClose size={20} />
              Fechar Tela
            </button>
          </div>

          <div className="detalhesGrid">
            <div className="campoCarne">
              <label>Nome da Pessoa</label>
              <input type="text" value={clienteSelecionado.nome} readOnly />
            </div>

            <div className="campoCarne">
              <label>Código do Carnê</label>
              <input type="text" value={carneSelecionado.codigo} readOnly />
            </div>

            <div className="campoCarne">
              <label>Data do Vencimento</label>
              <input type="date" value={carneSelecionado.vencimento} readOnly />
            </div>

            <div className="campoCarne">
              <label>Valor da Parcela</label>
              <input
                type="text"
                value={formatarMoeda(carneSelecionado.valorParcela)}
                readOnly
              />
            </div>

            <div className="campoCarne">
              <label>Data do Pagamento</label>
              <input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
              />
            </div>

            <div className="campoCarne">
              <label>Juros ou Multa</label>
              <input
                type="number"
                min="0"
                value={juros}
                onChange={(e) => setJuros(Number(e.target.value))}
              />
            </div>

            <div className="campoCarne">
              <label>Desconto</label>
              <input
                type="number"
                min="0"
                value={desconto}
                onChange={(e) => setDesconto(Number(e.target.value))}
              />
            </div>

            <div className="campoCarne">
              <label>Número da Parcela</label>
              <input
                type="text"
                value={carneSelecionado.numeroParcela}
                readOnly
              />
            </div>

            <div className="campoCarne">
              <label>Valor Total da Compra</label>
              <input
                type="text"
                value={formatarMoeda(carneSelecionado.valorTotalCompra)}
                readOnly
              />
            </div>

            <div className="campoCarne totalParcela">
              <label>Valor Total da Parcela</label>
              <strong>{formatarMoeda(valorTotalParcela)}</strong>
            </div>
          </div>

          <div className="acoesCarne">
            <button onClick={voltarParaCarnes}>
              <IoArrowBack size={20} />
              Voltar
            </button>

            <button onClick={() => setModalVisualizar(true)}>
              <IoEye size={20} />
              Visualizar Carnê
            </button>

            <button
              className="confirmarPagamentoButton"
              onClick={() => setModalPagamento(true)}
            >
              <IoCheckmarkCircle size={20} />
              Confirmar Pagamento
            </button>
          </div>
        </section>
      )}

      {modalPagamento && (
        <div className="modalOverlay">
          <div className="modalCarne">
            <h2>Forma de Pagamento</h2>

            <div className="resumoPagamentoModal">
              <p>
                <strong>Cliente:</strong> {clienteSelecionado?.nome}
              </p>
              <p>
                <strong>Carnê:</strong> {carneSelecionado?.codigo}
              </p>
              <p>
                <strong>Data do pagamento:</strong> {dataPagamento}
              </p>
              <p>
                <strong>Juros/Multa:</strong> {formatarMoeda(juros)}
              </p>
              <p>
                <strong>Desconto:</strong> {formatarMoeda(desconto)}
              </p>
            </div>

            <div className="valorPagamento">
              <span>Valor total da parcela</span>
              <strong>{formatarMoeda(valorTotalParcela)}</strong>
            </div>

            <div className="formasPagamentoCarne">
              <button
                className={formaPagamento === "Dinheiro" ? "selected" : ""}
                onClick={() => setFormaPagamento("Dinheiro")}
              >
                <IoCash size={28} />
                Dinheiro
              </button>

              <button
                className={formaPagamento === "Pix" ? "selected" : ""}
                onClick={() => setFormaPagamento("Pix")}
              >
                <IoQrCode size={28} />
                Pix
              </button>
            </div>

            <div className="modalActions">
              <button onClick={() => setModalPagamento(false)}>
                Voltar
              </button>

              <button className="success" onClick={confirmarPagamento}>
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {modalVisualizar && carneSelecionado && clienteSelecionado && (
        <div className="modalOverlay">
          <div className="modalCarne visualizar">
            <h2>Visualizar Carnê</h2>

            <p>
              <strong>Cliente:</strong> {clienteSelecionado.nome}
            </p>

            <p>
              <strong>Código:</strong> {carneSelecionado.codigo}
            </p>

            <p>
              <strong>Parcela:</strong> {carneSelecionado.numeroParcela}
            </p>

            <p>
              <strong>Vencimento:</strong> {carneSelecionado.vencimento}
            </p>

            <p>
              <strong>Valor da parcela:</strong>{" "}
              {formatarMoeda(carneSelecionado.valorParcela)}
            </p>

            <p>
              <strong>Valor total da compra:</strong>{" "}
              {formatarMoeda(carneSelecionado.valorTotalCompra)}
            </p>

            <div className="modalActions">
              <button onClick={() => setModalVisualizar(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Carnes;