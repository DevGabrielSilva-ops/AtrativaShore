import { useState } from "react";
import "../Caixa/caixa.css";

function Caixa() {
  const [caixaAberto, setCaixaAberto] = useState(false);
  const [dataHoraAbertura, setDataHoraAbertura] = useState("");
  const [dataHoraFechamento, setDataHoraFechamento] = useState("");
  const [modalFechamento, setModalFechamento] = useState(false);
  const [caixaProximoDia, setCaixaProximoDia] = useState(0);
  const [dadosBanco] = useState({
    vendedor: "Gabriel Silva",
    dinheiro: 250,
    pix: 430,
    cartao: 680,
    carne: 320,
  });

  const total = dadosBanco.dinheiro + dadosBanco.pix + dadosBanco.cartao ;

  function formatarDataHora() {
    return new Date().toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
    });
  }

  function abrirCaixa() {
    setCaixaAberto(true);
    setDataHoraAbertura(formatarDataHora());
    setDataHoraFechamento("");
    alert("Caixa aberto com sucesso!");
  }

  function abrirModalFechamento() {
    if (!caixaAberto) {
      alert("Nenhum turno de caixa aberto.");
      return;
    }

    setDataHoraFechamento(formatarDataHora());
    setModalFechamento(true);
  }

  function confirmarFechamento() {
    const confirmar = window.confirm(
      `Deseja realmente fechar o caixa?\n\nData e hora do fechamento: ${dataHoraFechamento}`,
    );

    if (!confirmar) return;

    setCaixaAberto(false);
    setModalFechamento(false);

    alert("Caixa fechado com sucesso!");
  }

  function salvarFechamentoPDF() {
    window.print();
  }

  return (
    <div>
      <h1>Caixa</h1>

      <p className="subtitle">
        Controle de abertura, movimentação e fechamento do caixa.
      </p>

      {caixaAberto && (
        <div className="mensagemCaixaAberto">
          <strong>Caixa aberto com sucesso!</strong>
          <span>Aberto em: {dataHoraAbertura}</span>
        </div>
      )}

      {!caixaAberto && dataHoraFechamento && (
        <div className="mensagemFechadoCaixa">
          <strong>Caixa fechado com sucesso!</strong>
          <span>Fechado em: {dataHoraFechamento}</span>
        </div>
      )}

      <div className="caixaContainer">
        <section className="caixaCard">
          <h2>Abertura de Caixa</h2>

          <label>Valor inicial</label>
          <input type="number" value={caixaProximoDia} readOnly/>

          <button className="primaryButton" onClick={abrirCaixa}>
            Abrir Caixa
          </button>
        </section>

        <section className="caixaCard">
          <h2>Resumo do Caixa</h2>

          <div className="resumoLinha">
            <span>Dinheiro</span>
            <strong>R$ {dadosBanco.dinheiro.toFixed(2)}</strong>
          </div>

          <div className="resumoLinha">
            <span>Pix</span>
            <strong>R$ {dadosBanco.pix.toFixed(2)}</strong>
          </div>

          <div className="resumoLinha">
            <span>Cartão</span>
            <strong>R$ {dadosBanco.cartao.toFixed(2)}</strong>
          </div>

          <div className="resumoLinha">
            <span>Carnês</span>
            <strong>R$ {dadosBanco.carne.toFixed(2)}</strong>
          </div>

          <div className="total">
            <span>Total</span>
            <strong>R$ {total.toFixed(2)}</strong>
          </div>
        </section>

        <section className="caixaCard large">
          <h2>Movimentações</h2>

          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Valor</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>Entrada</td>
                <td>
                  {dataHoraAbertura
                    ? `Abertura do caixa - ${dataHoraAbertura}`
                    : "Abertura do caixa"}
                </td>
                <td>R$ 0,00</td>
              </tr>

              <tr>
                <td>Saída</td>
                <td>
                  {dataHoraFechamento
                    ? `Fechamento do caixa - ${dataHoraFechamento}`
                    : "Fechamento do caixa"}
                </td>
                <td>R$ {total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <button onClick={abrirModalFechamento} className="dangerButton">
            Fechar Caixa
          </button>
        </section>
      </div>

      {modalFechamento && (
        <div className="modalOverlay">
          <div className="modalFechamento">
            <div className="tituloModal">
              <div>
                <h2>Fechamento de Caixa</h2>
                <p>{dataHoraFechamento}</p>
              </div>

              <button
                className="botaoFechaModal"
                onClick={() => setModalFechamento(false)}
              >
                ×
              </button>
            </div>

            <div className="formFechamento">
              <label>Nome do vendedor</label>
              <input
                type="text"
                value={dadosBanco.vendedor}
                readOnly
              />

              <label>Dinheiro</label>
              <input
                type="number"
                value={dadosBanco.dinheiro}
                readOnly
              />

              <label>Pix</label>
              <input
                type="number"
                value={dadosBanco.pix}
                readOnly
              />

              <label>Cartão</label>
              <input
                type="number"
                value={dadosBanco.cartao}
                readOnly
              />

              <label>Vendas em carnê realizadas no dia</label>
              <input
                type="number"
                value={dadosBanco.carne}
                readOnly
              />

              <label>Valor do caixa para o próximo dia</label>
              <input
                type="number"
                value={caixaProximoDia}
                onChange={(e) => setCaixaProximoDia(Number(e.target.value))}
              />

              <div className="resumoFechamento">
                <span>Total do fechamento</span>
                <strong>R$ {total.toFixed(2)}</strong>
              </div>
            </div>

            <div className="botoesFechamento">
              <button onClick={() => setModalFechamento(false)}>Voltar</button>

              <button onClick={salvarFechamentoPDF}>
                Salvar fechamento em PDF
              </button>

              <button className="confirmar" onClick={confirmarFechamento}>
                Confirmar fechamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Caixa;
