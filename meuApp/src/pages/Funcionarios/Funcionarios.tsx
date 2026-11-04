import { useMemo, useState, type FormEvent } from 'react';
import { IoAdd, IoCreateOutline, IoKeyOutline, IoTimeOutline, IoTrashOutline } from 'react-icons/io5';
import { ListaAuditoria } from '../../components/ListaAuditoria';
import { SegredoUnico } from '../../components/SegredoUnico';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Badge, EstadoErro } from '../../components/ui/Estados';
import { Input, Select } from '../../components/ui/Field';
import { Abas, CampoBusca, PageHeader, Painel } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Spinner';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { usePagina } from '../../hooks/useEstadoReiniciado';
import { useFormulario } from '../../hooks/useFormulario';
import { useAcao, useAtrasado, useRequisicao } from '../../hooks/useRequisicao';
import { mensagemErro } from '../../services/api';
import { funcionarioService } from '../../services/servicos';
import type { Cargo, CatalogoPermissoes, Funcionario, PapelEmpresa, Permissao, StatusUsuario } from '../../types/api';
import { formatarDataHora } from '../../utils/formatar';
import { emailValido } from '../../utils/validar';
import { PAPEIS_EMPRESA, ROTULOS_PAPEL } from '../compartilhado';

type Aba = 'funcionarios' | 'cargos';

export default function Funcionarios() {
  const { pode } = useAuth();
  const [aba, setAba] = useState<Aba>('funcionarios');
  const catalogo = useRequisicao(() => funcionarioService.catalogo(), []);
  const cargos = useRequisicao(() => funcionarioService.cargos(), []);
  const podeGerenciar = pode('funcionarios.gerenciar');

  return (
    <>
      <PageHeader
        titulo="Funcionários"
        descricao="Cada pessoa tem o próprio acesso. O cargo define o que ela pode fazer no sistema."
      />
      <Abas
        rotulo="Funcionários e cargos"
        ativa={aba}
        aoMudar={setAba}
        abas={[
          { id: 'funcionarios', titulo: 'Funcionários' },
          { id: 'cargos', titulo: 'Cargos e permissões' },
        ]}
      />
      {catalogo.erro ? (
        <Painel>
          <EstadoErro mensagem={catalogo.erro} aoTentarNovamente={catalogo.recarregar} />
        </Painel>
      ) : aba === 'funcionarios' ? (
        <ListaFuncionarios catalogo={catalogo.dados} cargos={cargos.dados ?? []} podeGerenciar={podeGerenciar} />
      ) : (
        <ListaCargos
          catalogo={catalogo.dados}
          cargos={cargos.dados}
          carregando={cargos.carregando}
          erro={cargos.erro}
          aoMudar={cargos.recarregar}
          podeGerenciar={podeGerenciar}
        />
      )}
    </>
  );
}

function ListaFuncionarios({
  catalogo,
  cargos,
  podeGerenciar,
}: {
  catalogo: CatalogoPermissoes | null;
  cargos: Cargo[];
  podeGerenciar: boolean;
}) {
  const { usuario, pode } = useAuth();
  const { notificar, confirmar } = useFeedback();
  const [busca, setBusca] = useState('');
  const [papel, setPapel] = useState<PapelEmpresa | ''>('');
  const [status, setStatus] = useState<StatusUsuario | ''>('ACTIVE');
  const buscaAtrasada = useAtrasado(busca);
  const [pagina, setPagina] = usePagina([buscaAtrasada, papel, status]);
  const [editando, setEditando] = useState<Funcionario | 'novo' | null>(null);
  const [segredo, setSegredo] = useState<{ nome: string; senha: string } | null>(null);
  const [historico, setHistorico] = useState<Funcionario | null>(null);

  const lista = useRequisicao(
    () =>
      funcionarioService.listar({
        busca: buscaAtrasada.trim() || undefined,
        papel: papel || undefined,
        status: status || undefined,
        page: pagina,
        limit: 20,
      }),
    [buscaAtrasada, papel, status, pagina],
  );

  const alternarStatus = async (f: Funcionario) => {
    const desativar = f.status === 'ACTIVE';
    const sim = await confirmar({
      titulo: desativar ? `Desativar o acesso de ${f.nome}?` : `Reativar o acesso de ${f.nome}?`,
      mensagem: desativar
        ? 'A pessoa sai do sistema na hora e não consegue mais entrar. O histórico de vendas e atividades é mantido.'
        : 'A pessoa volta a entrar com a senha que já tinha.',
      confirmar: desativar ? 'Desativar' : 'Reativar',
      perigo: desativar,
    });
    if (!sim) return;
    try {
      await funcionarioService.alterarStatus(f.id, desativar ? 'INACTIVE' : 'ACTIVE');
      notificar(desativar ? 'Acesso desativado.' : 'Acesso reativado.');
      lista.recarregar();
    } catch (erro) {
      notificar(mensagemErro(erro), 'erro');
    }
  };

  const redefinir = async (f: Funcionario) => {
    const sim = await confirmar({
      titulo: `Gerar nova senha para ${f.nome}?`,
      mensagem: 'A senha atual deixa de valer e as sessões abertas são encerradas. A pessoa cria uma senha nova no próximo acesso.',
      confirmar: 'Gerar senha temporária',
    });
    if (!sim) return;
    try {
      const { senhaTemporaria } = await funcionarioService.senhaTemporaria(f.id);
      setSegredo({ nome: f.nome, senha: senhaTemporaria });
      lista.recarregar();
    } catch (erro) {
      notificar(mensagemErro(erro), 'erro');
    }
  };

  return (
    <>
      <Painel
        semEspaco
        titulo="Equipe"
        acoes={
          podeGerenciar ? (
            <Button icone={<IoAdd />} onClick={() => setEditando('novo')}>
              Novo funcionário
            </Button>
          ) : null
        }
      >
        <div className="barra-ferramentas filtros-funcionarios">
          <CampoBusca valor={busca} aoMudar={setBusca} rotulo="Buscar por nome, e-mail ou usuário" />
          <Select rotulo="Papel" value={papel} onChange={(e) => setPapel(e.target.value as PapelEmpresa | '')}>
            <option value="">Todos os papéis</option>
            {PAPEIS_EMPRESA.map((p) => (
              <option key={p} value={p}>
                {ROTULOS_PAPEL[p]}
              </option>
            ))}
          </Select>
          <Select rotulo="Situação" value={status} onChange={(e) => setStatus(e.target.value as StatusUsuario | '')}>
            <option value="ACTIVE">Ativos</option>
            <option value="INACTIVE">Desativados</option>
            <option value="">Todos</option>
          </Select>
        </div>
        <DataTable<Funcionario>
          rotulo="Funcionários"
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarNovamente={lista.recarregar}
          linhas={lista.dados?.data}
          chaveLinha={(f) => f.id}
          vazio={{
            titulo: buscaAtrasada || papel ? 'Ninguém encontrado com esses filtros' : 'Nenhum funcionário cadastrado',
            descricao: podeGerenciar ? 'Cadastre vendedores, gerentes e estoquistas com acesso próprio.' : undefined,
          }}
          colunas={[
            {
              chave: 'nome',
              titulo: 'Funcionário',
              render: (f) => (
                <div className="celula-principal">
                  <strong>
                    {f.nome} {f.id === usuario?.id ? <span className="muted">(você)</span> : null}
                  </strong>
                  <span>{f.email ?? f.login}</span>
                </div>
              ),
            },
            {
              chave: 'cargo',
              titulo: 'Cargo',
              render: (f) => (
                <div className="celula-principal">
                  <strong>{f.cargo?.nome ?? f.papelRotulo}</strong>
                  {f.cargo ? <span>{f.papelRotulo}</span> : null}
                </div>
              ),
            },
            {
              chave: 'status',
              titulo: 'Situação',
              render: (f) =>
                f.status === 'ACTIVE' ? (
                  f.trocarSenha ? <Badge tom="aviso">Aguardando 1º acesso</Badge> : <Badge tom="sucesso">Ativo</Badge>
                ) : (
                  <Badge tom="perigo">Desativado</Badge>
                ),
            },
            {
              chave: 'acesso',
              titulo: 'Último acesso',
              ocultarNoCelular: true,
              render: (f) => <span className="num">{f.ultimoLoginEm ? formatarDataHora(f.ultimoLoginEm) : 'Nunca'}</span>,
            },
            {
              chave: 'acoes',
              titulo: 'Ações',
              alinhar: 'direita',
              render: (f) => (
                <div className="acoes-linha">
                  {pode('auditoria.consultar') ? (
                    <Button variante="fantasma" tamanho="sm" somenteIcone icone={<IoTimeOutline />} onClick={() => setHistorico(f)}>
                      Atividades
                    </Button>
                  ) : null}
                  {podeGerenciar ? (
                    <>
                      <Button variante="fantasma" tamanho="sm" somenteIcone icone={<IoCreateOutline />} onClick={() => setEditando(f)}>
                        Editar
                      </Button>
                      {f.id !== usuario?.id ? (
                        <>
                          <Button variante="fantasma" tamanho="sm" somenteIcone icone={<IoKeyOutline />} onClick={() => void redefinir(f)}>
                            Gerar senha temporária
                          </Button>
                          <Button variante="fantasma" tamanho="sm" onClick={() => void alternarStatus(f)}>
                            {f.status === 'ACTIVE' ? 'Desativar' : 'Reativar'}
                          </Button>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
        <Pagination meta={lista.dados?.meta} aoMudar={setPagina} />
      </Painel>

      {editando && catalogo ? (
        <FormularioFuncionario
          funcionario={editando === 'novo' ? null : editando}
          cargos={cargos}
          catalogo={catalogo}
          aoFechar={() => setEditando(null)}
          aoSalvar={(senha, nome) => {
            setEditando(null);
            lista.recarregar();
            if (senha) setSegredo({ nome, senha });
          }}
        />
      ) : null}

      {segredo ? (
        <SegredoUnico
          titulo="Senha temporária"
          descricao={`Entregue esta senha a ${segredo.nome}. No primeiro acesso, o sistema pede uma senha nova.`}
          valor={segredo.senha}
          aoFechar={() => setSegredo(null)}
        />
      ) : null}

      {historico ? (
        <Modal aberto titulo={`Atividades de ${historico.nome}`} aoFechar={() => setHistorico(null)} tamanho="lg">
          <ListaAuditoria
            buscar={(filtro) => funcionarioService.atividades(historico.id, filtro)}
            dependencias={[historico.id]}
            limite={10}
          />
        </Modal>
      ) : null}
    </>
  );
}

function FormularioFuncionario({
  funcionario,
  cargos,
  catalogo,
  aoFechar,
  aoSalvar,
}: {
  funcionario: Funcionario | null;
  cargos: Cargo[];
  catalogo: CatalogoPermissoes;
  aoFechar: () => void;
  aoSalvar: (senhaTemporaria: string | null, nome: string) => void;
}) {
  const { usuario } = useAuth();
  const ehVoce = funcionario?.id === usuario?.id;
  const form = useFormulario({
    nome: funcionario?.nome ?? '',
    email: funcionario?.email ?? '',
    login: funcionario?.login ?? '',
    papel: (funcionario?.papel ?? 'SELLER') as string,
    idCargo: funcionario?.cargo ? String(funcionario.cargo.id) : '',
  });
  const [falha, setFalha] = useState<string | null>(null);
  const { campo, valores } = form;
  const papel = valores.papel as PapelEmpresa;
  const cargosDoPapel = cargos.filter((c) => c.papelBase === papel);
  const cargoEscolhido = cargos.find((c) => String(c.id) === valores.idCargo);
  const permissoes: Permissao[] =
    papel === 'COMPANY_ADMIN'
      ? catalogo.permissoes.map((p) => p.id)
      : (cargoEscolhido?.permissoes ?? catalogo.papeis.find((p) => p.id === papel)?.permissoes ?? []);
  const descricao = new Map(catalogo.permissoes.map((p) => [p.id, p.descricao]));

  const salvar = useAcao(async () => {
    const dados = {
      nome: valores.nome.trim(),
      email: valores.email.trim() || null,
      login: valores.login.trim() || null,
      papel,
      idCargo: papel === 'COMPANY_ADMIN' || !valores.idCargo ? null : Number(valores.idCargo),
    };
    try {
      if (funcionario) {
        await funcionarioService.atualizar(funcionario.id, ehVoce ? { nome: dados.nome, email: dados.email, login: dados.login } : dados);
        aoSalvar(null, dados.nome);
      } else {
        const criado = await funcionarioService.criar({
          ...dados,
          email: dados.email ?? undefined,
          login: dados.login ?? undefined,
          idCargo: dados.idCargo ?? undefined,
        });
        aoSalvar(criado.senhaTemporaria, dados.nome);
      }
    } catch (erro) {
      setFalha(mensagemErro(erro));
    }
  });

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const erros: Partial<Record<keyof typeof valores, string>> = {};
    if (!valores.nome.trim()) erros.nome = 'Informe o nome.';
    if (valores.email.trim() && !emailValido(valores.email.trim())) erros.email = 'E-mail inválido.';
    if (valores.login.trim() && !/^[A-Za-z0-9._-]{3,40}$/.test(valores.login.trim())) erros.login = 'De 3 a 40 letras, números, ponto ou hífen.';
    if (!valores.email.trim() && !valores.login.trim()) erros.email = 'Informe o e-mail ou o usuário de acesso.';
    form.setErros(erros);
    if (Object.keys(erros).length === 0) void salvar.executar();
  };

  return (
    <Modal
      aberto
      titulo={funcionario ? `Editar ${funcionario.nome}` : 'Novo funcionário'}
      descricao={funcionario ? undefined : 'O sistema gera uma senha temporária para o primeiro acesso.'}
      aoFechar={aoFechar}
      tamanho="lg"
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-funcionario" carregando={salvar.executando}>
            {funcionario ? 'Salvar alterações' : 'Cadastrar funcionário'}
          </Button>
        </>
      }
    >
      <form id="form-funcionario" onSubmit={enviar} noValidate>
        {falha ? (
          <p className="aviso-faixa erro" role="alert">
            {falha}
          </p>
        ) : null}
        <div className="form-secao">
          <h3>Identificação e acesso</h3>
          <div className="form-grade">
            <Input className="col-6" rotulo="Nome" obrigatorio maxLength={100} {...campo('nome')} />
            <Input className="col-3" rotulo="E-mail" type="email" maxLength={200} {...campo('email')} />
            <Input className="col-3" rotulo="Usuário de acesso" maxLength={40} ajuda="Opcional se informar o e-mail." {...campo('login')} />
          </div>
        </div>
        <div className="form-secao">
          <h3>Cargo</h3>
          {ehVoce ? <p className="pequeno muted">Você não pode alterar o próprio cargo.</p> : null}
          <div className="form-grade">
            <Select
              className="col-3"
              rotulo="Papel"
              disabled={ehVoce}
              value={valores.papel}
              onChange={(e) => {
                form.definir('papel', e.target.value);
                form.definir('idCargo', '');
              }}
            >
              {PAPEIS_EMPRESA.map((p) => (
                <option key={p} value={p}>
                  {ROTULOS_PAPEL[p]}
                </option>
              ))}
            </Select>
            <Select className="col-3" rotulo="Cargo personalizado" disabled={ehVoce || papel === 'COMPANY_ADMIN'} {...campo('idCargo')}>
              <option value="">Padrão do papel</option>
              {cargosDoPapel.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </div>
          <p className="pequeno muted">Pode fazer:</p>
          <ul className="lista-permissoes">
            {permissoes.map((p) => (
              <li key={p}>{descricao.get(p) ?? p}</li>
            ))}
          </ul>
        </div>
      </form>
    </Modal>
  );
}

function ListaCargos({
  catalogo,
  cargos,
  carregando,
  erro,
  aoMudar,
  podeGerenciar,
}: {
  catalogo: CatalogoPermissoes | null;
  cargos: Cargo[] | null;
  carregando: boolean;
  erro: string | null;
  aoMudar: () => void;
  podeGerenciar: boolean;
}) {
  const { notificar, confirmar } = useFeedback();
  const [editando, setEditando] = useState<Cargo | 'novo' | null>(null);

  const remover = async (cargo: Cargo) => {
    const sim = await confirmar({ titulo: `Excluir o cargo ${cargo.nome}?`, mensagem: 'Só é possível excluir cargos sem funcionários.', confirmar: 'Excluir', perigo: true });
    if (!sim) return;
    try {
      await funcionarioService.removerCargo(cargo.id);
      notificar('Cargo excluído.');
      aoMudar();
    } catch (e) {
      notificar(mensagemErro(e), 'erro');
    }
  };

  return (
    <>
      <Painel
        semEspaco
        titulo="Cargos personalizados"
        descricao="Partem de um papel e ajustam as permissões. Funcionários sem cargo usam o padrão do papel."
        acoes={
          podeGerenciar && catalogo ? (
            <Button icone={<IoAdd />} onClick={() => setEditando('novo')}>
              Novo cargo
            </Button>
          ) : null
        }
      >
        <DataTable<Cargo>
          rotulo="Cargos"
          carregando={carregando}
          erro={erro}
          aoTentarNovamente={aoMudar}
          linhas={cargos}
          chaveLinha={(c) => c.id}
          vazio={{ titulo: 'Nenhum cargo personalizado', descricao: 'Os papéis padrão já cobrem gerente, vendedor e estoquista.' }}
          colunas={[
            { chave: 'nome', titulo: 'Cargo', render: (c) => <strong>{c.nome}</strong> },
            { chave: 'papel', titulo: 'Papel base', render: (c) => ROTULOS_PAPEL[c.papelBase] },
            { chave: 'perm', titulo: 'Permissões', alinhar: 'direita', render: (c) => <span className="num">{c.permissoes.length}</span> },
            { chave: 'uso', titulo: 'Funcionários', alinhar: 'direita', render: (c) => <span className="num">{c.funcionarios ?? 0}</span> },
            {
              chave: 'acoes',
              titulo: 'Ações',
              alinhar: 'direita',
              render: (c) =>
                podeGerenciar ? (
                  <div className="acoes-linha">
                    <Button variante="fantasma" tamanho="sm" somenteIcone icone={<IoCreateOutline />} onClick={() => setEditando(c)}>
                      Editar
                    </Button>
                    <Button variante="fantasma" tamanho="sm" somenteIcone icone={<IoTrashOutline />} onClick={() => void remover(c)}>
                      Excluir
                    </Button>
                  </div>
                ) : null,
            },
          ]}
        />
      </Painel>
      <Painel titulo="Papéis padrão">
        {!catalogo ? (
          <Skeleton altura={120} />
        ) : (
          <div className="grade-2">
            {catalogo.papeis.map((p) => (
              <div key={p.id}>
                <h3 className="titulo-papel">{p.rotulo}</h3>
                <p className="pequeno muted">{p.permissoes.length} permissões</p>
              </div>
            ))}
          </div>
        )}
      </Painel>
      {editando && catalogo ? (
        <FormularioCargo
          cargo={editando === 'novo' ? null : editando}
          catalogo={catalogo}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            aoMudar();
          }}
        />
      ) : null}
    </>
  );
}

function FormularioCargo({
  cargo,
  catalogo,
  aoFechar,
  aoSalvar,
}: {
  cargo: Cargo | null;
  catalogo: CatalogoPermissoes;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const { usuario } = useAuth();
  const { notificar } = useFeedback();
  const [nome, setNome] = useState(cargo?.nome ?? '');
  const [papelBase, setPapelBase] = useState<PapelEmpresa>(cargo?.papelBase ?? 'SELLER');
  const padrao = (papel: PapelEmpresa) => catalogo.papeis.find((p) => p.id === papel)?.permissoes ?? [];
  const [marcadas, setMarcadas] = useState<Set<Permissao>>(new Set(cargo?.permissoes ?? padrao('SELLER')));
  const [falha, setFalha] = useState<string | null>(null);
  const grupos = useMemo(() => {
    const mapa = new Map<string, CatalogoPermissoes['permissoes']>();
    for (const p of catalogo.permissoes) mapa.set(p.grupo, [...(mapa.get(p.grupo) ?? []), p]);
    return [...mapa.entries()];
  }, [catalogo]);

  const alternar = (p: Permissao) =>
    setMarcadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(p)) novo.delete(p);
      else novo.add(p);
      return novo;
    });

  const salvar = useAcao(async () => {
    const dados = { nome: nome.trim(), papelBase, permissoes: [...marcadas] };
    try {
      if (cargo) await funcionarioService.atualizarCargo(cargo.id, dados);
      else await funcionarioService.criarCargo(dados);
      notificar(cargo ? 'Cargo atualizado. Quem usa este cargo precisa entrar de novo.' : 'Cargo criado.');
      aoSalvar();
    } catch (e) {
      setFalha(mensagemErro(e));
    }
  });

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (!nome.trim()) return setFalha('Informe o nome do cargo.');
    if (marcadas.size === 0) return setFalha('Marque pelo menos uma permissão.');
    setFalha(null);
    void salvar.executar();
  };

  return (
    <Modal
      aberto
      titulo={cargo ? `Editar cargo ${cargo.nome}` : 'Novo cargo'}
      aoFechar={aoFechar}
      tamanho="lg"
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-cargo" carregando={salvar.executando}>
            {cargo ? 'Salvar cargo' : 'Criar cargo'}
          </Button>
        </>
      }
    >
      <form id="form-cargo" onSubmit={enviar} noValidate className="pilha">
        {falha ? (
          <p className="aviso-faixa erro" role="alert">
            {falha}
          </p>
        ) : null}
        <div className="form-grade">
          <Input className="col-3" rotulo="Nome do cargo" obrigatorio maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} />
          <Select
            className="col-3"
            rotulo="Papel base"
            value={papelBase}
            onChange={(e) => {
              const papel = e.target.value as PapelEmpresa;
              setPapelBase(papel);
              if (!cargo) setMarcadas(new Set(padrao(papel)));
            }}
          >
            {PAPEIS_EMPRESA.filter((p) => p !== 'COMPANY_ADMIN').map((p) => (
              <option key={p} value={p}>
                {ROTULOS_PAPEL[p]}
              </option>
            ))}
          </Select>
        </div>
        <div className="grupo-permissoes">
          {grupos.map(([grupo, itens]) => (
            <fieldset key={grupo}>
              <legend>{grupo}</legend>
              {itens.map((p) => {
                const proibida = !usuario?.permissoes.includes(p.id);
                return (
                  <label key={p.id} className="caixa-selecao" title={proibida ? 'Você não tem esta permissão' : undefined}>
                    <input type="checkbox" checked={marcadas.has(p.id)} disabled={proibida} onChange={() => alternar(p.id)} />
                    {p.descricao}
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
      </form>
    </Modal>
  );
}
