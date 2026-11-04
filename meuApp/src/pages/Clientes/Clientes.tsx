import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IoAdd, IoCreateOutline, IoDownloadOutline, IoTrashOutline } from 'react-icons/io5';
import { Button } from '../../components/ui/Button';
import { CreditoCarneCliente } from '../../components/CreditoCarne';
import { DataTable } from '../../components/ui/DataTable';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { Abas, CampoBusca, Detalhes, PageHeader, Painel } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { useFeedback } from '../../contexts/FeedbackContext';
import { textoOuIndefinido, textoOuNulo, useFormulario } from '../../hooks/useFormulario';
import { useAcao, useAtrasado, useRequisicao } from '../../hooks/useRequisicao';
import { usePagina } from '../../hooks/useEstadoReiniciado';
import { mensagemErro } from '../../services/api';
import { carneService, clienteService } from '../../services/servicos';
import type { Cliente, ClienteEntrada } from '../../types/api';
import { exportarCsv } from '../../utils/exportar';
import {
  formatarData,
  formatarDocumento,
  formatarMoeda,
  formatarTelefone,
  lerNumero,
  numeroParaCampo,
} from '../../utils/formatar';
import { documentoValido, emailValido } from '../../utils/validar';
import { UFS } from '../compartilhado';

const VAZIO = {
  nome: '',
  cpf: '',
  rg: '',
  ie: '',
  dataAniversario: '',
  faixaSalarial: '',
  limiteCarne: '',
  telefone: '',
  celular: '',
  email: '',
  cep: '',
  endereco: '',
  bairro: '',
  cidade: '',
  uf: '',
  informacoesAdicionais: '',
};
type FormCliente = typeof VAZIO;

function paraFormulario(cliente: Cliente): FormCliente {
  return {
    nome: cliente.nome ?? '',
    cpf: formatarDocumento(cliente.cpf).replace('—', ''),
    rg: cliente.rg ?? '',
    ie: cliente.ie ?? '',
    dataAniversario: cliente.dataAniversario ?? '',
    faixaSalarial: numeroParaCampo(cliente.faixaSalarial),
    limiteCarne: numeroParaCampo(cliente.limiteCarne),
    telefone: cliente.telefone ?? '',
    celular: cliente.celular ?? '',
    email: cliente.email ?? '',
    cep: cliente.cep ?? '',
    endereco: cliente.endereco ?? '',
    bairro: cliente.bairro ?? '',
    cidade: cliente.cidade ?? '',
    uf: cliente.uf ?? '',
    informacoesAdicionais: cliente.informacoesAdicionais ?? '',
  };
}

export default function Clientes() {
  const { notificar, confirmar } = useFeedback();
  const [parametros, setParametros] = useSearchParams();
  const [busca, setBusca] = useState(parametros.get('busca') ?? '');
  const buscaAtrasada = useAtrasado(busca);
  // ?novo=1 (atalho do PDV) já abre o cadastro.
  const [editando, setEditando] = useState<Cliente | 'novo' | null>(() => (parametros.get('novo') === '1' ? 'novo' : null));
  const [vendo, setVendo] = useState<Cliente | null>(null);

  const [pagina, setPagina] = usePagina([buscaAtrasada]);

  const lista = useRequisicao(
    () => clienteService.listar({ busca: buscaAtrasada.trim() || undefined, page: pagina, limit: 20 }),
    [buscaAtrasada, pagina],
  );

  // Tira o ?novo=1 do endereço para o cadastro não reabrir ao recarregar.
  const pedidoNovo = parametros.get('novo') === '1';
  useEffect(() => {
    if (pedidoNovo) setParametros({}, { replace: true });
  }, [pedidoNovo, setParametros]);

  const excluir = async (cliente: Cliente) => {
    const sim = await confirmar({
      titulo: 'Excluir cliente?',
      mensagem: `${cliente.nome} será removido. Clientes com vendas ou carnês não podem ser excluídos.`,
      confirmar: 'Excluir',
      perigo: true,
    });
    if (!sim) return;
    try {
      await clienteService.remover(cliente.id);
      notificar('Cliente excluído.');
      setVendo(null);
      lista.recarregar();
    } catch (erro) {
      notificar(mensagemErro(erro), 'erro');
    }
  };

  const exportar = () => {
    if (!lista.dados) return;
    exportarCsv(
      'clientes',
      [
        { titulo: 'Código', valor: (c: Cliente) => c.codigo },
        { titulo: 'Nome', valor: (c) => c.nome },
        { titulo: 'CPF/CNPJ', valor: (c) => formatarDocumento(c.cpf) },
        { titulo: 'Telefone', valor: (c) => c.telefone },
        { titulo: 'Celular', valor: (c) => c.celular },
        { titulo: 'Cidade', valor: (c) => c.cidade },
        { titulo: 'UF', valor: (c) => c.uf },
      ],
      lista.dados.data,
    );
  };

  return (
    <>
      <PageHeader
        titulo="Clientes"
        descricao="Cadastro de clientes da loja. Clique em um cliente para ver dados, compras e carnês."
        acoes={
          <>
            <Button variante="secundario" icone={<IoDownloadOutline />} onClick={exportar} disabled={!lista.dados?.data.length}>
              Exportar página
            </Button>
            <Button icone={<IoAdd />} onClick={() => setEditando('novo')}>
              Novo cliente
            </Button>
          </>
        }
      />

      <Painel semEspaco>
        <div className="barra-ferramentas">
          <CampoBusca valor={busca} aoMudar={setBusca} rotulo="Buscar por nome, CPF, código ou id" />
        </div>
        <DataTable<Cliente>
          rotulo="Clientes"
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarNovamente={lista.recarregar}
          linhas={lista.dados?.data}
          chaveLinha={(c) => c.id}
          aoClicarLinha={setVendo}
          vazio={
            buscaAtrasada
              ? { titulo: 'Nenhum cliente encontrado', descricao: 'Confira o nome ou o CPF digitado.' }
              : {
                  titulo: 'Nenhum cliente cadastrado',
                  acao: (
                    <Button icone={<IoAdd />} onClick={() => setEditando('novo')}>
                      Cadastrar cliente
                    </Button>
                  ),
                }
          }
          colunas={[
            {
              chave: 'nome',
              titulo: 'Cliente',
              render: (c) => (
                <div className="celula-principal">
                  <strong>{c.nome}</strong>
                  <span className="num">Código {c.codigo ?? c.id}</span>
                </div>
              ),
            },
            { chave: 'cpf', titulo: 'CPF/CNPJ', ocultarNoCelular: true, render: (c) => <span className="num">{formatarDocumento(c.cpf)}</span> },
            {
              chave: 'contato',
              titulo: 'Telefone',
              ocultarNoCelular: true,
              render: (c) => <span className="num">{formatarTelefone(c.celular || c.telefone)}</span>,
            },
            { chave: 'cidade', titulo: 'Cidade', ocultarNoCelular: true, render: (c) => (c.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ''}` : '—') },
            {
              chave: 'acoes',
              titulo: 'Ações',
              alinhar: 'direita',
              render: (c) => (
                <div className="acoes-linha" onClick={(e) => e.stopPropagation()}>
                  <Button variante="fantasma" tamanho="sm" somenteIcone icone={<IoCreateOutline />} onClick={() => setEditando(c)}>
                    Editar
                  </Button>
                  <Button variante="fantasma" tamanho="sm" somenteIcone icone={<IoTrashOutline />} onClick={() => excluir(c)}>
                    Excluir
                  </Button>
                </div>
              ),
            },
          ]}
        />
        <Pagination meta={lista.dados?.meta} aoMudar={setPagina} />
      </Painel>

      {editando ? (
        <FormularioCliente
          cliente={editando === 'novo' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={(cliente) => {
            setEditando(null);
            lista.recarregar();
            if (vendo?.id === cliente.id) setVendo(cliente);
          }}
        />
      ) : null}

      {vendo ? (
        <DetalheCliente
          cliente={vendo}
          aoFechar={() => setVendo(null)}
          aoEditar={() => setEditando(vendo)}
          aoExcluir={() => excluir(vendo)}
        />
      ) : null}
    </>
  );
}

function FormularioCliente({
  cliente,
  aoFechar,
  aoSalvar,
}: {
  cliente: Cliente | null;
  aoFechar: () => void;
  aoSalvar: (cliente: Cliente) => void;
}) {
  const { notificar } = useFeedback();
  const form = useFormulario<FormCliente>(cliente ? paraFormulario(cliente) : VAZIO);
  const [falha, setFalha] = useState<string | null>(null);
  const { valores, campo } = form;

  const validar = () => {
    const erros: Partial<Record<keyof FormCliente, string>> = {};
    if (!valores.nome.trim()) erros.nome = 'Informe o nome.';
    if (valores.cpf.trim() && !documentoValido(valores.cpf)) erros.cpf = 'CPF ou CNPJ inválido.';
    if (valores.email.trim() && !emailValido(valores.email.trim())) erros.email = 'E-mail inválido.';
    if (valores.faixaSalarial.trim() && (lerNumero(valores.faixaSalarial) ?? -1) < 0) erros.faixaSalarial = 'Valor inválido.';
    if (valores.limiteCarne.trim() && (lerNumero(valores.limiteCarne) ?? -1) < 0) erros.limiteCarne = 'Valor inválido.';
    form.setErros(erros);
    return Object.keys(erros).length === 0;
  };

  const salvar = useAcao(async () => {
    setFalha(null);
    const conversor = cliente ? textoOuNulo : textoOuIndefinido;
    const dados: ClienteEntrada = {
      nome: valores.nome.trim(),
      cpf: conversor(valores.cpf),
      rg: conversor(valores.rg),
      ie: conversor(valores.ie),
      dataAniversario: conversor(valores.dataAniversario),
      faixaSalarial: valores.faixaSalarial.trim() ? lerNumero(valores.faixaSalarial) : cliente ? null : undefined,
      // Vazio = limite calculado pela renda.
      limiteCarne: valores.limiteCarne.trim() ? lerNumero(valores.limiteCarne) : cliente ? null : undefined,
      telefone: conversor(valores.telefone),
      celular: conversor(valores.celular),
      email: conversor(valores.email),
      cep: conversor(valores.cep),
      endereco: conversor(valores.endereco),
      bairro: conversor(valores.bairro),
      cidade: conversor(valores.cidade),
      uf: conversor(valores.uf),
      informacoesAdicionais: conversor(valores.informacoesAdicionais),
    };
    try {
      const salvo = cliente ? await clienteService.atualizar(cliente.id, dados) : await clienteService.criar(dados);
      notificar(cliente ? 'Cliente atualizado.' : `Cliente cadastrado com o código ${salvo.codigo}.`);
      aoSalvar(salvo);
    } catch (erro) {
      setFalha(mensagemErro(erro));
    }
  });

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (validar()) void salvar.executar();
  };

  return (
    <Modal
      aberto
      titulo={cliente ? `Editar ${cliente.nome}` : 'Novo cliente'}
      descricao={cliente ? `Código ${cliente.codigo ?? cliente.id}` : 'O código do cliente é gerado ao salvar.'}
      aoFechar={aoFechar}
      tamanho="lg"
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-cliente" carregando={salvar.executando}>
            {cliente ? 'Salvar alterações' : 'Cadastrar cliente'}
          </Button>
        </>
      }
    >
      <form id="form-cliente" onSubmit={enviar} noValidate>
        {falha ? (
          <p className="aviso-faixa erro" role="alert">
            {falha}
          </p>
        ) : null}
        <div className="form-secao">
          <h3>Dados pessoais</h3>
          <div className="form-grade">
            <Input className="col-4" rotulo="Nome" obrigatorio maxLength={60} autoFocus {...campo('nome')} />
            <Input className="col-2" rotulo="CPF ou CNPJ" inputMode="numeric" maxLength={18} {...campo('cpf')} />
            <Input className="col-2" rotulo="RG" maxLength={16} {...campo('rg')} />
            <Input className="col-2" rotulo="Inscrição estadual" maxLength={16} {...campo('ie')} />
            <Input className="col-2" rotulo="Data de aniversário" type="date" {...campo('dataAniversario')} />
            <Input
              className="col-2"
              rotulo="Renda (faixa salarial)"
              prefixo="R$"
              inputMode="decimal"
              placeholder="0,00"
              {...campo('faixaSalarial')}
            />
            <Input
              className="col-2"
              rotulo="Limite do carnê"
              prefixo="R$"
              inputMode="decimal"
              placeholder="Pela renda"
              ajuda="Vazio: calculado pela renda. 0 bloqueia o carnê."
              {...campo('limiteCarne')}
            />
          </div>
        </div>
        <div className="form-secao">
          <h3>Contato</h3>
          <div className="form-grade">
            <Input className="col-2" rotulo="Celular" inputMode="tel" maxLength={15} {...campo('celular')} />
            <Input className="col-2" rotulo="Telefone" inputMode="tel" maxLength={15} {...campo('telefone')} />
            <Input className="col-2" rotulo="E-mail" type="email" maxLength={100} {...campo('email')} />
          </div>
        </div>
        <div className="form-secao">
          <h3>Endereço</h3>
          <div className="form-grade">
            <Input className="col-4" rotulo="Endereço" maxLength={50} {...campo('endereco')} />
            <Input className="col-2" rotulo="CEP" inputMode="numeric" maxLength={15} {...campo('cep')} />
            <Input className="col-2" rotulo="Bairro" maxLength={30} {...campo('bairro')} />
            <Input className="col-3" rotulo="Cidade" maxLength={30} {...campo('cidade')} />
            <Select className="col-1" rotulo="UF" {...campo('uf')}>
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf}>{uf}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="form-secao">
          <Textarea rotulo="Observações" maxLength={255} {...campo('informacoesAdicionais')} />
        </div>
      </form>
    </Modal>
  );
}

function DetalheCliente({
  cliente,
  aoFechar,
  aoEditar,
  aoExcluir,
}: {
  cliente: Cliente;
  aoFechar: () => void;
  aoEditar: () => void;
  aoExcluir: () => void;
}) {
  const [aba, setAba] = useState<'dados' | 'compras' | 'carnes'>('dados');
  const [pagina, setPagina] = useState(1);
  const vendas = useRequisicao(() => clienteService.vendas(cliente.id, { page: pagina, limit: 8 }), [cliente.id, pagina], aba === 'compras');
  const carnes = useRequisicao(() => carneService.listar({ idCliente: cliente.id, limit: 50 }), [cliente.id], aba === 'carnes');

  return (
    <Modal
      aberto
      titulo={cliente.nome ?? 'Cliente'}
      descricao={`Código ${cliente.codigo ?? cliente.id}`}
      aoFechar={aoFechar}
      tamanho="lg"
      rodape={
        <>
          <Button variante="fantasma" icone={<IoTrashOutline />} onClick={aoExcluir}>
            Excluir
          </Button>
          <Button variante="secundario" icone={<IoCreateOutline />} onClick={aoEditar}>
            Editar
          </Button>
        </>
      }
    >
      <Abas
        rotulo="Informações do cliente"
        ativa={aba}
        aoMudar={setAba}
        abas={[
          { id: 'dados', titulo: 'Dados' },
          { id: 'compras', titulo: 'Compras' },
          { id: 'carnes', titulo: 'Carnês em aberto' },
        ]}
      />
      {aba === 'dados' ? <CreditoCarneCliente idCliente={cliente.id} /> : null}
      {aba === 'dados' ? (
        <Detalhes
          itens={[
            { rotulo: 'CPF/CNPJ', valor: formatarDocumento(cliente.cpf) },
            { rotulo: 'RG', valor: cliente.rg },
            { rotulo: 'Inscrição estadual', valor: cliente.ie },
            { rotulo: 'Aniversário', valor: formatarData(cliente.dataAniversario) },
            { rotulo: 'Renda', valor: cliente.faixaSalarial != null ? formatarMoeda(cliente.faixaSalarial) : null },
            { rotulo: 'Celular', valor: formatarTelefone(cliente.celular) },
            { rotulo: 'Telefone', valor: formatarTelefone(cliente.telefone) },
            { rotulo: 'E-mail', valor: cliente.email },
            { rotulo: 'Endereço', valor: cliente.endereco },
            { rotulo: 'Bairro', valor: cliente.bairro },
            { rotulo: 'Cidade', valor: cliente.cidade ? `${cliente.cidade}${cliente.uf ? `/${cliente.uf}` : ''}` : null },
            { rotulo: 'CEP', valor: cliente.cep },
            { rotulo: 'Observações', valor: cliente.informacoesAdicionais },
          ]}
        />
      ) : null}
      {aba === 'compras' ? (
        <>
          <DataTable
            rotulo="Compras do cliente"
            carregando={vendas.carregando}
            erro={vendas.erro}
            aoTentarNovamente={vendas.recarregar}
            linhas={vendas.dados?.data}
            chaveLinha={(v) => v.id}
            linhasCarregando={4}
            vazio={{ titulo: 'Este cliente ainda não comprou' }}
            colunas={[
              { chave: 'data', titulo: 'Data', render: (v) => <span className="num">{formatarData(v.data)}</span> },
              { chave: 'formas', titulo: 'Pagamento', render: (v) => v.formasPagamento.join(' + ') || '—' },
              { chave: 'total', titulo: 'Total', alinhar: 'direita', render: (v) => formatarMoeda(v.total) },
            ]}
          />
          <Pagination meta={vendas.dados?.meta} aoMudar={setPagina} />
        </>
      ) : null}
      {aba === 'carnes' ? (
        <DataTable
          rotulo="Carnês em aberto do cliente"
          carregando={carnes.carregando}
          erro={carnes.erro}
          aoTentarNovamente={carnes.recarregar}
          linhas={carnes.dados?.data}
          chaveLinha={(p) => p.id}
          linhasCarregando={3}
          vazio={{ titulo: 'Nenhuma parcela em aberto' }}
          colunas={[
            { chave: 'parcela', titulo: 'Parcela', render: (p) => <span className="num">{p.numeroParcela}</span> },
            { chave: 'venc', titulo: 'Vencimento', render: (p) => <span className={p.atrasada ? 'nota-negativo num' : 'num'}>{formatarData(p.vencimento)}</span> },
            { chave: 'valor', titulo: 'Valor', alinhar: 'direita', render: (p) => formatarMoeda(p.valorParcela) },
          ]}
        />
      ) : null}
    </Modal>
  );
}
