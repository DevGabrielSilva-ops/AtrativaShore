import { useState } from "react";
import {
  IoAdd,
  IoCreate,
  IoTrash,
  IoSearch,
  IoClose,
  IoSave,
  IoPrint,
} from "react-icons/io5";

import "./clientes.css";

interface Cliente {
  id: string;
  codigo: string;
  nome: string;
  cpf: string;
  rg: string;
  telefone: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  codigoPostal: string;
  dataAniversario: string;
  faixaSalarial: string;
}

const clienteVazio: Cliente = {
  id: "",
  codigo: "",
  nome: "",
  cpf: "",
  rg: "",
  telefone: "",
  endereco: "",
  bairro: "",
  cidade: "",
  uf: "",
  codigoPostal: "",
  dataAniversario: "",
  faixaSalarial: "",
};

const clientesIniciais: Cliente[] = [
  {
    id: "1",
    codigo: "CLI-1001",
    nome: "Maria Silva",
    cpf: "123.456.789-00",
    rg: "12.345.678-9",
    telefone: "(14) 99999-9999",
    endereco: "Rua das Flores, 123",
    bairro: "Centro",
    cidade: "Avaré",
    uf: "SP",
    codigoPostal: "18700-000",
    dataAniversario: "1998-05-10",
    faixaSalarial: "R$ 2.000,00 a R$ 3.000,00",
  },
];

function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciais);
  const [pesquisa, setPesquisa] = useState("");
  const [modalFormulario, setModalFormulario] = useState(false);
  const [modalExcluir, setModalExcluir] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [formCliente, setFormCliente] = useState<Cliente>(clienteVazio);

  const clientesFiltrados = clientes.filter((cliente) =>
    cliente.nome.toLowerCase().includes(pesquisa.toLowerCase())
  );

  function gerarCodigoCliente() {
    return `CLI-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  function abrirAdicionarCliente() {
    setModoEdicao(false);
    setFormCliente({
      ...clienteVazio,
      id: crypto.randomUUID(),
      codigo: gerarCodigoCliente(),
    });
    setModalFormulario(true);
  }

  function abrirAlterarCliente(cliente: Cliente) {
    setModoEdicao(true);
    setFormCliente(cliente);
    setModalFormulario(true);
  }

  function abrirExcluirCliente(cliente: Cliente) {
    setClienteSelecionado(cliente);
    setModalExcluir(true);
  }

  function atualizarCampo(campo: keyof Cliente, valor: string) {
    setFormCliente((cliente) => ({
      ...cliente,
      [campo]: valor,
    }));
  }

  function salvarCliente() {
    if (!formCliente.nome || !formCliente.cpf || !formCliente.telefone) {
      alert("Preencha nome, CPF e telefone.");
      return;
    }

    if (modoEdicao) {
      setClientes((lista) =>
        lista.map((cliente) =>
          cliente.id === formCliente.id ? formCliente : cliente
        )
      );
    } else {
      setClientes((lista) => [...lista, formCliente]);
    }

    setModalFormulario(false);
    setFormCliente(clienteVazio);
  }

  function confirmarExclusao() {
    if (!clienteSelecionado) return;

    setClientes((lista) =>
      lista.filter((cliente) => cliente.id !== clienteSelecionado.id)
    );

    setModalExcluir(false);
    setClienteSelecionado(null);
  }

  function imprimirFichaCliente() {
    window.print();
  }

  return (
    <div className="clientes">
      <div className="clientesHeader">
        <div>
          <h1>Clientes</h1>
          <p>Cadastre, pesquise, altere e apague clientes.</p>
        </div>

        <button className="adicionarClienteButton" onClick={abrirAdicionarCliente}>
          <IoAdd size={22} />
          Adicionar Cliente
        </button>
      </div>

      <section className="pesquisaCliente">
        <IoSearch size={22} />
        <input
          type="text"
          placeholder="Pesquisar cliente pelo nome"
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
        />
      </section>

      <section className="clientesCard">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>CPF</th>
              <th>Telefone</th>
              <th>Cidade</th>
              <th>UF</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {clientesFiltrados.map((cliente) => (
              <tr key={cliente.id}>
                <td>{cliente.codigo}</td>
                <td>{cliente.nome}</td>
                <td>{cliente.cpf}</td>
                <td>{cliente.telefone}</td>
                <td>{cliente.cidade}</td>
                <td>{cliente.uf}</td>
                <td>
                  <div className="acoesClientes">
                    <button
                      className="alterarClienteButton"
                      onClick={() => abrirAlterarCliente(cliente)}
                    >
                      <IoCreate size={18} />
                      Alterar
                    </button>

                    <button
                      className="excluirClienteButton"
                      onClick={() => abrirExcluirCliente(cliente)}
                    >
                      <IoTrash size={18} />
                      Apagar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {modalFormulario && (
        <div className="modalOverlay">
          <div className="modalCliente formularioCliente">
            <div className="modalHeader">
              <h2>{modoEdicao ? "Alterar Cliente" : "Adicionar Cliente"}</h2>

              <button onClick={() => setModalFormulario(false)}>
                <IoClose size={24} />
              </button>
            </div>

            <div className="formGridCliente">
              <div className="campoCliente">
                <label>Código do Cliente</label>
                <input type="text" value={formCliente.codigo} readOnly />
              </div>

              <div className="campoCliente">
                <label>Nome do Cliente</label>
                <input
                  type="text"
                  value={formCliente.nome}
                  onChange={(e) => atualizarCampo("nome", e.target.value)}
                />
              </div>

              <div className="campoCliente">
                <label>CPF</label>
                <input
                  type="text"
                  value={formCliente.cpf}
                  onChange={(e) => atualizarCampo("cpf", e.target.value)}
                />
              </div>

              <div className="campoCliente">
                <label>RG</label>
                <input
                  type="text"
                  value={formCliente.rg}
                  onChange={(e) => atualizarCampo("rg", e.target.value)}
                />
              </div>

              <div className="campoCliente">
                <label>Telefone</label>
                <input
                  type="text"
                  value={formCliente.telefone}
                  onChange={(e) => atualizarCampo("telefone", e.target.value)}
                />
              </div>

              <div className="campoCliente">
                <label>Endereço</label>
                <input
                  type="text"
                  value={formCliente.endereco}
                  onChange={(e) => atualizarCampo("endereco", e.target.value)}
                />
              </div>

              <div className="campoCliente">
                <label>Bairro</label>
                <input
                  type="text"
                  value={formCliente.bairro}
                  onChange={(e) => atualizarCampo("bairro", e.target.value)}
                />
              </div>

              <div className="campoCliente">
                <label>Cidade</label>
                <input
                  type="text"
                  value={formCliente.cidade}
                  onChange={(e) => atualizarCampo("cidade", e.target.value)}
                />
              </div>

              <div className="campoCliente">
                <label>UF</label>
                <input
                  type="text"
                  maxLength={2}
                  value={formCliente.uf}
                  onChange={(e) => atualizarCampo("uf", e.target.value.toUpperCase())}
                />
              </div>

              <div className="campoCliente">
                <label>Código Postal</label>
                <input
                  type="text"
                  value={formCliente.codigoPostal}
                  onChange={(e) => atualizarCampo("codigoPostal", e.target.value)}
                />
              </div>

              <div className="campoCliente">
                <label>Data de Aniversário</label>
                <input
                  type="date"
                  value={formCliente.dataAniversario}
                  onChange={(e) =>
                    atualizarCampo("dataAniversario", e.target.value)
                  }
                />
              </div>

              <div className="campoCliente">
                <label>Faixa Salarial</label>
                <input
                  type="text"
                  value={formCliente.faixaSalarial}
                  onChange={(e) =>
                    atualizarCampo("faixaSalarial", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="modalActions">
              <button onClick={imprimirFichaCliente}>
                <IoPrint size={18} />
                Imprimir Ficha
              </button>

              <button onClick={() => setModalFormulario(false)}>
                Fechar
              </button>

              <button className="success" onClick={salvarCliente}>
                <IoSave size={18} />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalExcluir && clienteSelecionado && (
        <div className="modalOverlay">
          <div className="modalCliente pequeno">
            <h2>Apagar Cliente</h2>

            <p>
              Deseja realmente apagar o cliente{" "}
              <strong>{clienteSelecionado.nome}</strong>?
            </p>

            <div className="modalActions">
              <button onClick={() => setModalExcluir(false)}>
                Fechar
              </button>

              <button className="danger" onClick={confirmarExclusao}>
                Apagar Cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Clientes;