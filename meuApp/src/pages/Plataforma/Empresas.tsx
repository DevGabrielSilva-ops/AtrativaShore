import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IoAdd, IoKeyOutline, IoPauseCircleOutline, IoPlayCircleOutline } from 'react-icons/io5';
import { SegredoUnico } from '../../components/SegredoUnico';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Badge, EstadoErro } from '../../components/ui/Estados';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { CampoBusca, Detalhes, PageHeader, Painel } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Spinner';
import { useFeedback } from '../../contexts/FeedbackContext';
import { usePagina } from '../../hooks/useEstadoReiniciado';
import { useFormulario } from '../../hooks/useFormulario';
import { useAcao, useAtrasado, useRequisicao } from '../../hooks/useRequisicao';
import { mensagemErro } from '../../services/api';
import { plataformaService } from '../../services/servicos';
import type { EmpresaPlataforma, EmpresaPlataformaDetalhe, Plano, StatusEmpresa } from '../../types/api';
import { formatarData, formatarDataHora, formatarDocumento, formatarTelefone, hojeIso } from '../../utils/formatar';
import { emailValido } from '../../utils/validar';
import {
  ROTULOS_PAPEL,
  ROTULOS_SITUACAO_CODIGO,
  ROTULOS_STATUS_EMPRESA,
  TOM_SITUACAO_CODIGO,
  TOM_STATUS_EMPRESA,
  UFS,
} from '../compartilhado';

export default function Empresas() {
  const [parametros, setParametros] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<StatusEmpresa | ''>('');
  const buscaAtrasada = useAtrasado(busca);
  const [pagina, setPagina] = usePagina([buscaAtrasada, status]);
  const [criando, setCriando] = useState(() => parametros.get('novo') === '1');
  const planos = useRequisicao(() => plataformaService.planos(), []);
  const lista = useRequisicao(
    () => plataformaService.empresas({ busca: buscaAtrasada.trim() || undefined, status: status || undefined, page: pagina, limit: 20 }),
    [buscaAtrasada, status, pagina],
  );
  const idAberta = Number(parametros.get('empresa')) || null;
  const abrir = (id: number | null) => setParametros(id ? { empresa: String(id) } : {}, { replace: true });

  return (
    <>
      <PageHeader
        titulo="Empresas"
        descricao="Empresas clientes do Atrativa Shore. Suspender bloqueia o acesso sem apagar dados."
        acoes={
          <Button icone={<IoAdd />} onClick={() => setCriando(true)}>
            Cadastrar empresa
          </Button>
        }
      />
      <Painel semEspaco>
        <div className="barra-ferramentas filtros-funcionarios">
          <CampoBusca valor={busca} aoMudar={setBusca} rotulo="Buscar por nome, CNPJ ou e-mail" />
          <Select rotulo="Situação" value={status} onChange={(e) => setStatus(e.target.value as StatusEmpresa | '')}>
            <option value="">Todas</option>
            {(Object.keys(ROTULOS_STATUS_EMPRESA) as StatusEmpresa[]).map((s) => (
              <option key={s} value={s}>
                {ROTULOS_STATUS_EMPRESA[s]}
              </option>
            ))}
          </Select>
        </div>
        <DataTable<EmpresaPlataforma>
          rotulo="Empresas"
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarNovamente={lista.recarregar}
          linhas={lista.dados?.data}
          chaveLinha={(e) => e.id}
          aoClicarLinha={(e) => abrir(e.id)}
          vazio={{ titulo: 'Nenhuma empresa encontrada', descricao: 'Cadastre uma empresa ou gere um código de nova empresa.' }}
          colunas={[
            {
              chave: 'nome',
              titulo: 'Empresa',
              render: (e) => (
                <div className="celula-principal">
                  <strong>{e.nome}</strong>
                  <span className="num">{e.cnpj ? formatarDocumento(e.cnpj) : (e.email ?? '—')}</span>
                </div>
              ),
            },
            { chave: 'status', titulo: 'Situação', render: (e) => <Badge tom={TOM_STATUS_EMPRESA[e.status]}>{ROTULOS_STATUS_EMPRESA[e.status]}</Badge> },
            { chave: 'plano', titulo: 'Plano', ocultarNoCelular: true, render: (e) => e.plano?.nome ?? '—' },
            {
              chave: 'usuarios',
              titulo: 'Funcionários',
              alinhar: 'direita',
              render: (e) => (
                <span className="num">
                  {e.usuariosAtivos}
                  {e.usuarios > e.usuariosAtivos ? <span className="muted"> / {e.usuarios}</span> : null}
                </span>
              ),
            },
            { chave: 'assinatura', titulo: 'Assinatura até', alinhar: 'direita', ocultarNoCelular: true, render: (e) => <span className="num">{e.assinaturaAte ? formatarData(e.assinaturaAte) : 'Sem vencimento'}</span> },
          ]}
        />
        <Pagination meta={lista.dados?.meta} aoMudar={setPagina} />
      </Painel>

      {criando ? (
        <FormularioEmpresa
          planos={planos.dados ?? []}
          aoFechar={() => {
            setCriando(false);
            if (parametros.get('novo')) setParametros({}, { replace: true });
          }}
          aoSalvar={(empresa) => {
            setCriando(false);
            lista.recarregar();
            abrir(empresa.id);
          }}
        />
      ) : null}

      {idAberta ? (
        <DetalheEmpresa id={idAberta} planos={planos.dados ?? []} aoFechar={() => abrir(null)} aoMudar={lista.recarregar} />
      ) : null}
    </>
  );
}

function FormularioEmpresa({
  planos,
  aoFechar,
  aoSalvar,
}: {
  planos: Plano[];
  aoFechar: () => void;
  aoSalvar: (empresa: EmpresaPlataforma) => void;
}) {
  const { notificar } = useFeedback();
  const form = useFormulario({ nome: '', cnpj: '', email: '', telefone: '', cidade: '', uf: '', idPlano: '', assinaturaAte: '' });
  const [falha, setFalha] = useState<string | null>(null);
  const { campo, valores } = form;

  const salvar = useAcao(async () => {
    const texto = (v: string) => v.trim() || undefined;
    try {
      const empresa = await plataformaService.criarEmpresa({
        nome: valores.nome.trim(),
        cnpj: texto(valores.cnpj),
        email: texto(valores.email),
        telefone: texto(valores.telefone),
        cidade: texto(valores.cidade),
        uf: texto(valores.uf),
        idPlano: valores.idPlano ? Number(valores.idPlano) : undefined,
        assinaturaAte: texto(valores.assinaturaAte),
      });
      notificar('Empresa cadastrada. Gere um código de ativação para o responsável.');
      aoSalvar(empresa);
    } catch (e) {
      setFalha(mensagemErro(e));
    }
  });

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const erros: Partial<Record<keyof typeof valores, string>> = {};
    if (!valores.nome.trim()) erros.nome = 'Informe o nome.';
    if (valores.email.trim() && !emailValido(valores.email.trim())) erros.email = 'E-mail inválido.';
    form.setErros(erros);
    if (Object.keys(erros).length === 0) void salvar.executar();
  };

  return (
    <Modal
      aberto
      titulo="Cadastrar empresa"
      descricao="A empresa fica aguardando ativação até o responsável usar um código."
      aoFechar={aoFechar}
      tamanho="lg"
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-empresa-plataforma" carregando={salvar.executando}>
            Cadastrar empresa
          </Button>
        </>
      }
    >
      <form id="form-empresa-plataforma" onSubmit={enviar} noValidate>
        {falha ? (
          <p className="aviso-faixa erro" role="alert">
            {falha}
          </p>
        ) : null}
        <div className="form-grade">
          <Input className="col-4" rotulo="Nome" obrigatorio maxLength={100} {...campo('nome')} />
          <Input className="col-2" rotulo="CNPJ/CPF" maxLength={18} {...campo('cnpj')} />
          <Input className="col-3" rotulo="E-mail" type="email" maxLength={200} {...campo('email')} />
          <Input className="col-3" rotulo="Telefone" maxLength={15} {...campo('telefone')} />
          <Input className="col-3" rotulo="Cidade" maxLength={30} {...campo('cidade')} />
          <Select className="col-1" rotulo="UF" {...campo('uf')}>
            <option value="">—</option>
            {UFS.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </Select>
          <Select className="col-2" rotulo="Plano" {...campo('idPlano')}>
            <option value="">Plano padrão</option>
            {planos
              .filter((p) => p.ativo)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
          </Select>
          <Input className="col-3" rotulo="Assinatura até" type="date" min={hojeIso()} ajuda="Vazio: sem vencimento." {...campo('assinaturaAte')} />
        </div>
      </form>
    </Modal>
  );
}

function DetalheEmpresa({
  id,
  planos,
  aoFechar,
  aoMudar,
}: {
  id: number;
  planos: Plano[];
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const { notificar, confirmar } = useFeedback();
  const empresa = useRequisicao(() => plataformaService.empresa(id), [id]);
  const [segredo, setSegredo] = useState<{ titulo: string; descricao: string; valor: string } | null>(null);
  const [mudandoStatus, setMudandoStatus] = useState<'ACTIVE' | 'SUSPENDED' | null>(null);
  const [editando, setEditando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const e = empresa.dados;

  const atualizar = () => {
    empresa.recarregar();
    aoMudar();
  };

  const senhaAdmin = async (admin: EmpresaPlataformaDetalhe['administradores'][number]) => {
    const sim = await confirmar({
      titulo: `Gerar senha temporária para ${admin.nome}?`,
      mensagem: 'Use quando o administrador da empresa perdeu o acesso. A senha atual deixa de valer.',
      confirmar: 'Gerar senha',
    });
    if (!sim) return;
    try {
      const { senhaTemporaria } = await plataformaService.senhaUsuario(id, admin.id);
      setSegredo({ titulo: 'Senha temporária', descricao: `Entregue a ${admin.nome}. Ele cria uma senha nova no próximo acesso.`, valor: senhaTemporaria });
    } catch (erro) {
      notificar(mensagemErro(erro), 'erro');
    }
  };

  return (
    <Modal
      aberto
      titulo={e?.nome ?? 'Empresa'}
      descricao={e ? `Cadastrada em ${formatarData(e.criadaEm)}` : undefined}
      aoFechar={aoFechar}
      tamanho="lg"
      rodape={
        e ? (
          <>
            <Button variante="fantasma" onClick={() => setEditando(true)}>
              Plano e assinatura
            </Button>
            <Button variante="secundario" icone={<IoKeyOutline />} onClick={() => setGerando(true)} disabled={e.status === 'SUSPENDED'}>
              Código de acesso
            </Button>
            {e.status === 'SUSPENDED' || e.status === 'EXPIRED' ? (
              <Button icone={<IoPlayCircleOutline />} onClick={() => setMudandoStatus('ACTIVE')}>
                Reativar
              </Button>
            ) : e.status === 'ACTIVE' ? (
              <Button variante="perigo" icone={<IoPauseCircleOutline />} onClick={() => setMudandoStatus('SUSPENDED')}>
                Suspender
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      {empresa.erro ? (
        <EstadoErro mensagem={empresa.erro} aoTentarNovamente={empresa.recarregar} />
      ) : !e ? (
        <Skeleton altura={220} />
      ) : (
        <div className="pilha">
          <div className="linha-entre">
            <Badge tom={TOM_STATUS_EMPRESA[e.status]}>{ROTULOS_STATUS_EMPRESA[e.status]}</Badge>
            {e.motivoStatus ? <span className="pequeno muted">{e.motivoStatus}</span> : null}
          </div>
          <Detalhes
            itens={[
              { rotulo: 'CNPJ/CPF', valor: formatarDocumento(e.cnpj) },
              { rotulo: 'E-mail', valor: e.email },
              { rotulo: 'Telefone', valor: formatarTelefone(e.telefone) },
              { rotulo: 'Cidade', valor: e.cidade ? `${e.cidade}${e.uf ? `/${e.uf}` : ''}` : null },
              { rotulo: 'Plano', valor: e.plano?.nome },
              { rotulo: 'Assinatura até', valor: e.assinaturaAte ? formatarData(e.assinaturaAte) : 'Sem vencimento' },
              { rotulo: 'Ativada em', valor: e.ativadaEm ? formatarDataHora(e.ativadaEm) : 'Ainda não' },
              { rotulo: 'Funcionários ativos', valor: `${e.usuariosAtivos} de ${e.usuarios}` },
            ]}
          />
          <div className="grade-2">
            <div>
              <h3 className="titulo-papel">Administradores</h3>
              {e.administradores.length ? (
                <ul className="lista-simples">
                  {e.administradores.map((a) => (
                    <li key={a.id}>
                      <div className="celula-principal">
                        <strong>{a.nome}</strong>
                        <span>
                          {a.email ?? a.login} · {a.status === 'ACTIVE' ? `último acesso ${a.ultimoLoginEm ? formatarDataHora(a.ultimoLoginEm) : 'nunca'}` : 'desativado'}
                        </span>
                      </div>
                      <Button variante="fantasma" tamanho="sm" onClick={() => void senhaAdmin(a)}>
                        Senha temporária
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pequeno muted">Nenhum administrador. Gere um código de acesso para o responsável.</p>
              )}
            </div>
            <div>
              <h3 className="titulo-papel">Funcionários por papel</h3>
              <ul className="lista-simples">
                {(['COMPANY_ADMIN', 'MANAGER', 'SELLER', 'STOCK_OPERATOR'] as const).map((p) => (
                  <li key={p}>
                    <span>{ROTULOS_PAPEL[p]}</span>
                    <strong className="num">{e.funcionariosPorPapel[p] ?? 0}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div>
            <h3 className="titulo-papel">Códigos desta empresa</h3>
            {e.codigos.length ? (
              <ul className="lista-simples">
                {e.codigos.map((c) => (
                  <li key={c.id}>
                    <span className="num">
                      {c.prefixo}… · criado em {formatarData(c.criadoEm)} · {c.usos}/{c.maxUsos} uso(s)
                    </span>
                    <Badge tom={TOM_SITUACAO_CODIGO[c.situacao]}>{ROTULOS_SITUACAO_CODIGO[c.situacao]}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pequeno muted">Nenhum código emitido para esta empresa.</p>
            )}
          </div>
        </div>
      )}

      {mudandoStatus && e ? (
        <ModalStatus
          empresa={e}
          status={mudandoStatus}
          aoFechar={() => setMudandoStatus(null)}
          aoSalvar={() => {
            setMudandoStatus(null);
            atualizar();
          }}
        />
      ) : null}
      {editando && e ? (
        <ModalPlano
          empresa={e}
          planos={planos}
          aoFechar={() => setEditando(false)}
          aoSalvar={() => {
            setEditando(false);
            atualizar();
          }}
        />
      ) : null}
      {gerando && e ? (
        <ModalCodigoEmpresa
          empresa={e}
          aoFechar={() => setGerando(false)}
          aoGerar={(codigo) => {
            setGerando(false);
            empresa.recarregar();
            setSegredo({
              titulo: 'Código de acesso gerado',
              descricao: `Entregue ao responsável por ${e.nome}. Ele usa o código na tela "Ativar minha empresa".`,
              valor: codigo,
            });
          }}
        />
      ) : null}
      {segredo ? <SegredoUnico {...segredo} aoFechar={() => setSegredo(null)} /> : null}
    </Modal>
  );
}

function ModalStatus({
  empresa,
  status,
  aoFechar,
  aoSalvar,
}: {
  empresa: EmpresaPlataforma;
  status: 'ACTIVE' | 'SUSPENDED';
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const { notificar } = useFeedback();
  const [motivo, setMotivo] = useState('');
  const vencida = !!empresa.assinaturaAte && empresa.assinaturaAte < hojeIso();
  const [assinaturaAte, setAssinaturaAte] = useState('');
  const [falha, setFalha] = useState<string | null>(null);
  const salvar = useAcao(async () => {
    try {
      await plataformaService.alterarStatus(empresa.id, {
        status,
        motivo: motivo.trim() || undefined,
        assinaturaAte: assinaturaAte || undefined,
      });
      notificar(status === 'ACTIVE' ? 'Empresa reativada.' : 'Empresa suspensa. Os usuários perderam o acesso.');
      aoSalvar();
    } catch (e) {
      setFalha(mensagemErro(e));
    }
  });
  return (
    <Modal
      aberto
      titulo={status === 'ACTIVE' ? `Reativar ${empresa.nome}?` : `Suspender ${empresa.nome}?`}
      descricao={
        status === 'ACTIVE'
          ? 'Os usuários voltam a entrar e encontram todos os dados como estavam.'
          : 'Ninguém da empresa consegue usar o sistema até a reativação. Nenhum dado é apagado.'
      }
      aoFechar={aoFechar}
      tamanho="sm"
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button variante={status === 'ACTIVE' ? 'primario' : 'perigo'} onClick={() => void salvar.executar()} carregando={salvar.executando}>
            {status === 'ACTIVE' ? 'Reativar empresa' : 'Suspender empresa'}
          </Button>
        </>
      }
    >
      <div className="pilha">
        {falha ? <p className="aviso-faixa erro">{falha}</p> : null}
        <Textarea rotulo="Motivo (aparece para a equipe da plataforma)" maxLength={255} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {status === 'ACTIVE' && vencida ? (
          <Input
            rotulo="Nova data de fim da assinatura"
            type="date"
            min={hojeIso()}
            value={assinaturaAte}
            onChange={(e) => setAssinaturaAte(e.target.value)}
            ajuda={`A assinatura venceu em ${formatarData(empresa.assinaturaAte)}.`}
          />
        ) : null}
      </div>
    </Modal>
  );
}

function ModalPlano({
  empresa,
  planos,
  aoFechar,
  aoSalvar,
}: {
  empresa: EmpresaPlataforma;
  planos: Plano[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const { notificar } = useFeedback();
  const [idPlano, setIdPlano] = useState(empresa.plano ? String(empresa.plano.id) : '');
  const [assinaturaAte, setAssinaturaAte] = useState(empresa.assinaturaAte ?? '');
  const [falha, setFalha] = useState<string | null>(null);
  const salvar = useAcao(async () => {
    try {
      await plataformaService.atualizarEmpresa(empresa.id, {
        ...(idPlano ? { idPlano: Number(idPlano) } : {}),
        assinaturaAte: assinaturaAte || null,
      });
      notificar('Plano e assinatura atualizados.');
      aoSalvar();
    } catch (e) {
      setFalha(mensagemErro(e));
    }
  });
  return (
    <Modal
      aberto
      titulo="Plano e assinatura"
      aoFechar={aoFechar}
      tamanho="sm"
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar.executar()} carregando={salvar.executando}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="pilha">
        {falha ? <p className="aviso-faixa erro">{falha}</p> : null}
        <Select rotulo="Plano" value={idPlano} onChange={(e) => setIdPlano(e.target.value)}>
          {planos.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.ativo}>
              {p.nome}
              {p.maxFuncionarios ? ` · até ${p.maxFuncionarios} usuários` : ' · sem limite'}
            </option>
          ))}
        </Select>
        <Input
          rotulo="Assinatura até"
          type="date"
          value={assinaturaAte}
          onChange={(e) => setAssinaturaAte(e.target.value)}
          ajuda="Vazio: sem vencimento. Passada a data, a empresa fica com a assinatura vencida e perde o acesso."
        />
      </div>
    </Modal>
  );
}

function ModalCodigoEmpresa({
  empresa,
  aoFechar,
  aoGerar,
}: {
  empresa: EmpresaPlataforma;
  aoFechar: () => void;
  aoGerar: (codigo: string) => void;
}) {
  const [email, setEmail] = useState(empresa.email ?? '');
  const [dias, setDias] = useState('7');
  const [falha, setFalha] = useState<string | null>(null);
  const gerar = useAcao(async () => {
    if (email.trim() && !emailValido(email.trim())) return setFalha('E-mail inválido.');
    try {
      const gerado = await plataformaService.gerarCodigo({
        tipo: 'EMPRESA_EXISTENTE',
        idEmpresa: empresa.id,
        emailDestinatario: email.trim() || undefined,
        validadeDias: Number(dias) || 7,
      });
      aoGerar(gerado.codigo);
    } catch (e) {
      setFalha(mensagemErro(e));
    }
  });
  return (
    <Modal
      aberto
      titulo="Código de acesso"
      descricao={`Permite que o responsável por ${empresa.nome} crie a conta de administrador desta empresa.`}
      aoFechar={aoFechar}
      tamanho="sm"
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button icone={<IoKeyOutline />} onClick={() => void gerar.executar()} carregando={gerar.executando}>
            Gerar código
          </Button>
        </>
      }
    >
      <div className="pilha">
        {falha ? <p className="aviso-faixa erro">{falha}</p> : null}
        <Input
          rotulo="E-mail do responsável"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          ajuda="Se informado, só este e-mail consegue usar o código."
        />
        <Input rotulo="Validade (dias)" type="number" min={1} max={365} value={dias} onChange={(e) => setDias(e.target.value)} />
      </div>
    </Modal>
  );
}
