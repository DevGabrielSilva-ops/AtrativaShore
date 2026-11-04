import { useState, type FormEvent } from 'react';
import { IoAdd, IoCreateOutline, IoTrashOutline } from 'react-icons/io5';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Input, Select } from '../../components/ui/Field';
import { CampoBusca, PageHeader, Painel } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { textoOuIndefinido, textoOuNulo, useFormulario } from '../../hooks/useFormulario';
import { useAcao, useAtrasado, useRequisicao } from '../../hooks/useRequisicao';
import { usePagina } from '../../hooks/useEstadoReiniciado';
import { mensagemErro } from '../../services/api';
import { fornecedorService } from '../../services/servicos';
import type { Fornecedor, FornecedorEntrada } from '../../types/api';
import { formatarDocumento, formatarTelefone } from '../../utils/formatar';
import { emailValido } from '../../utils/validar';
import { UFS } from '../compartilhado';

const VAZIO = { nome: '', cnpj: '', ie: '', contato: '', email: '', telefone: '', fax: '', rua: '', cidade: '', uf: '', cep: '' };
type FormFornecedor = typeof VAZIO;

export default function Fornecedores() {
  const { pode } = useAuth();
  const podeEditar = pode('fornecedores.gerenciar');
  const podeExcluir = pode('fornecedores.gerenciar');
  const { notificar, confirmar } = useFeedback();
  const [busca, setBusca] = useState('');
  const buscaAtrasada = useAtrasado(busca);
  const [editando, setEditando] = useState<Fornecedor | 'novo' | null>(null);

  const [pagina, setPagina] = usePagina([buscaAtrasada]);
  const lista = useRequisicao(
    () => fornecedorService.listar({ busca: buscaAtrasada.trim() || undefined, page: pagina, limit: 20 }),
    [buscaAtrasada, pagina],
  );

  const excluir = async (fornecedor: Fornecedor) => {
    const sim = await confirmar({
      titulo: 'Excluir fornecedor?',
      mensagem: `${fornecedor.nome} será removido. Fornecedores com produtos ou notas lançadas não podem ser excluídos.`,
      confirmar: 'Excluir',
      perigo: true,
    });
    if (!sim) return;
    try {
      await fornecedorService.remover(fornecedor.id);
      notificar('Fornecedor excluído.');
      lista.recarregar();
    } catch (erro) {
      notificar(mensagemErro(erro), 'erro');
    }
  };

  return (
    <>
      <PageHeader
        titulo="Fornecedores"
        descricao="Usados no cadastro de produtos e nas notas de entrada de estoque."
        acoes={
          podeEditar ? (
            <Button icone={<IoAdd />} onClick={() => setEditando('novo')}>
              Novo fornecedor
            </Button>
          ) : null
        }
      />
      <Painel semEspaco>
        <div className="barra-ferramentas">
          <CampoBusca valor={busca} aoMudar={setBusca} rotulo="Buscar por nome" />
        </div>
        <DataTable<Fornecedor>
          rotulo="Fornecedores"
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarNovamente={lista.recarregar}
          linhas={lista.dados?.data}
          chaveLinha={(f) => f.id}
          aoClicarLinha={setEditando}
          vazio={{ titulo: buscaAtrasada ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado' }}
          colunas={[
            { chave: 'nome', titulo: 'Fornecedor', render: (f) => <strong>{f.nome}</strong> },
            { chave: 'cnpj', titulo: 'CNPJ', ocultarNoCelular: true, render: (f) => <span className="num">{formatarDocumento(f.cnpj)}</span> },
            { chave: 'contato', titulo: 'Contato', ocultarNoCelular: true, render: (f) => f.contato ?? '—' },
            { chave: 'telefone', titulo: 'Telefone', ocultarNoCelular: true, render: (f) => <span className="num">{formatarTelefone(f.telefone)}</span> },
            { chave: 'cidade', titulo: 'Cidade', ocultarNoCelular: true, render: (f) => (f.cidade ? `${f.cidade}${f.uf ? `/${f.uf}` : ''}` : '—') },
            {
              chave: 'acoes',
              titulo: 'Ações',
              alinhar: 'direita',
              render: (f) => (
                <div className="acoes-linha" onClick={(e) => e.stopPropagation()}>
                  {podeEditar ? (
                    <Button variante="fantasma" tamanho="sm" somenteIcone icone={<IoCreateOutline />} onClick={() => setEditando(f)}>
                      Editar
                    </Button>
                  ) : null}
                  {podeExcluir ? (
                    <Button variante="fantasma" tamanho="sm" somenteIcone icone={<IoTrashOutline />} onClick={() => excluir(f)}>
                      Excluir
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
        <Pagination meta={lista.dados?.meta} aoMudar={setPagina} />
      </Painel>
      {editando ? (
        <FormularioFornecedor
          fornecedor={editando === 'novo' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            lista.recarregar();
          }}
        />
      ) : null}
    </>
  );
}

function FormularioFornecedor({
  fornecedor,
  aoFechar,
  aoSalvar,
}: {
  fornecedor: Fornecedor | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const { notificar } = useFeedback();
  const inicial: FormFornecedor = fornecedor
    ? (Object.fromEntries(Object.keys(VAZIO).map((k) => [k, (fornecedor[k as keyof Fornecedor] as string | null) ?? ''])) as FormFornecedor)
    : VAZIO;
  const form = useFormulario<FormFornecedor>(inicial);
  const [falha, setFalha] = useState<string | null>(null);

  const salvar = useAcao(async () => {
    const conversor = fornecedor ? textoOuNulo : textoOuIndefinido;
    const dados = Object.fromEntries(
      Object.entries(form.valores).map(([chave, valor]) => [chave, conversor(valor as string)]),
    ) as unknown as FornecedorEntrada;
    dados.nome = form.valores.nome.trim();
    try {
      await (fornecedor ? fornecedorService.atualizar(fornecedor.id, dados) : fornecedorService.criar(dados));
      notificar(fornecedor ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.');
      aoSalvar();
    } catch (erro) {
      setFalha(mensagemErro(erro));
    }
  });

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const erros: Partial<Record<keyof FormFornecedor, string>> = {};
    if (!form.valores.nome.trim()) erros.nome = 'Informe o nome.';
    if (form.valores.email.trim() && !emailValido(form.valores.email.trim())) erros.email = 'E-mail inválido.';
    form.setErros(erros);
    if (Object.keys(erros).length === 0) void salvar.executar();
  };

  const { campo } = form;
  return (
    <Modal
      aberto
      titulo={fornecedor ? `Editar ${fornecedor.nome}` : 'Novo fornecedor'}
      aoFechar={aoFechar}
      tamanho="lg"
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-fornecedor" carregando={salvar.executando}>
            {fornecedor ? 'Salvar alterações' : 'Cadastrar fornecedor'}
          </Button>
        </>
      }
    >
      <form id="form-fornecedor" onSubmit={enviar} noValidate>
        {falha ? (
          <p className="aviso-faixa erro" role="alert">
            {falha}
          </p>
        ) : null}
        <div className="form-grade">
          <Input className="col-4" rotulo="Nome" obrigatorio maxLength={60} autoFocus {...campo('nome')} />
          <Input className="col-2" rotulo="CNPJ" maxLength={18} {...campo('cnpj')} />
          <Input className="col-2" rotulo="Inscrição estadual" maxLength={16} {...campo('ie')} />
          <Input className="col-2" rotulo="Contato" maxLength={30} {...campo('contato')} />
          <Input className="col-2" rotulo="E-mail" type="email" maxLength={100} {...campo('email')} />
          <Input className="col-2" rotulo="Telefone" maxLength={15} {...campo('telefone')} />
          <Input className="col-2" rotulo="Fax" maxLength={15} {...campo('fax')} />
          <Input className="col-2" rotulo="CEP" maxLength={15} {...campo('cep')} />
          <Input className="col-3" rotulo="Rua" maxLength={50} {...campo('rua')} />
          <Input className="col-2" rotulo="Cidade" maxLength={20} {...campo('cidade')} />
          <Select className="col-1" rotulo="UF" {...campo('uf')}>
            <option value="">—</option>
            {UFS.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </Select>
        </div>
      </form>
    </Modal>
  );
}
