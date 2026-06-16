import '../Caixa/caixa.css'
function Caixa() {
  return (
    
    <div>
      <h1>Caixa</h1>
      <p className="subtitle">Controle de abertura, movimentação e fechamento do caixa.</p>

      <div className="caixaContainer">
        <section className="caixaCard">
          <h2>Abertura de Caixa</h2>

          <label>Valor inicial</label>
          <input type="number" placeholder="R$ 0,00" />

          <button className="primaryButton">Abrir Caixa</button>
        </section>

        <section className="caixaCard">
          <h2>Resumo do Caixa</h2>

          <div className="resumoLinha">
            <span>Dinheiro</span>
            <strong>R$ 0,00</strong>
          </div>

          <div className="resumoLinha">
            <span>Pix</span>
            <strong>R$ 0,00</strong>
          </div>

          <div className="resumoLinha">
            <span>Cartão</span>
            <strong>R$ 0,00</strong>
          </div>

          <div className="total">
            <span>Total</span>
            <strong>R$ 0,00</strong>
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
                <td>Abertura do caixa</td>
                <td>R$ 0,00</td>
              </tr>
            </tbody>
          </table>

          <button className="dangerButton">Fechar Caixa</button>
        </section>
      </div>
    </div>
  );
}

export default Caixa;