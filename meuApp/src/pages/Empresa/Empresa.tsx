import { useEffect, useState, type FormEvent } from 'react';
import { IoCreateOutline, IoInformationCircleOutline } from 'react-icons/io5';
import { Button } from '../../components/ui/Button';
import { EstadoErro } from '../../components/ui/Estados';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { Detalhes, PageHeader, Painel } from '../../components/ui/Layout';
import { Skeleton } from '../../components/ui/Spinner';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useFormulario } from '../../hooks/useFormulario';
import { useAcao, useRequisicao } from '../../hooks/useRequisicao';
import { mensagemErro } from '../../services/api';
import { carneService, empresaService } from '../../services/servicos';
import type { Empresa as TipoEmpresa } from '../../types/api';
import { formatarDocumento, formatarTelefone, lerNumero, numeroParaCampo } from '../../utils/formatar';
import { emailValido } from '../../utils/validar';
import { UFS } from '../compartilhado';

const CAMPOS_TEXTO = ['nome', 'cnpj', 'ie', 'im', 'telefone', 'fax', 'email', 'site', 'endereco', 'bairro', 'cidade', 'uf', 'cep', 'mensagem'] as const;
type FormEmpresa = Record<(typeof CAMPOS_TEXTO)[number] | 'maxDesconto', string> & { fracionado: boolean };

function paraFormulario(empresa: TipoEmpresa): FormEmpresa {
  const texto = Object.fromEntries(CAMPOS_TEXTO.map((c) => [c, (empresa[c] as string | null) ?? ''])) as Record<(typeof CAMPOS_TEXTO)[number], string>;
  return { ...texto, maxDesconto: numeroParaCampo(empresa.maxDesconto), fracionado: empresa.fracionado === 1 };
}

export default function Empresa() {
  const { pode } = useAuth();
  const podeEditar = pode('empresa.configurar');
  const empresa = useRequisicao(() => empresaService.obter(), []);
  const [editando, setEditando] = useState(false);
  const e = empresa.dados;

  return (
    <>
      <PageHeader
        titulo="Empresa"
        descricao="Dados cadastrais da loja, usados nos comprovantes e relatórios."
        acoes={
          podeEditar && e && !editando ? (
            <Button variante="secundario" icone={<IoCreateOutline />} onClick={() => setEditando(true)}>
              Editar dados
            </Button>
          ) : null
        }
      />
      <div className="pilha">
        <div className="aviso-faixa info">
          <IoInformationCircleOutline size={18} aria-hidden />
          <span>
            Estes são os dados da sua empresa no Atrativa Shore. O cadastro de novas empresas é feito pela administração da plataforma.
            {podeEditar ? '' : ' Somente o administrador da empresa pode alterar estes dados.'}
          </span>
        </div>
        {empresa.erro ? (
          <Painel>
            <EstadoErro mensagem={empresa.erro} aoTentarNovamente={empresa.recarregar} />
          </Painel>
        ) : !e ? (
          <Painel>
            <Skeleton altura={180} />
          </Painel>
        ) : editando ? (
          <FormularioEmpresa
            empresa={e}
            aoCancelar={() => setEditando(false)}
            aoSalvar={() => {
              setEditando(false);
              empresa.recarregar();
            }}
          />
        ) : (
          <>
            <Painel titulo={e.nome ?? 'Empresa'}>
              <Detalhes
                itens={[
                  { rotulo: 'CNPJ/CPF', valor: formatarDocumento(e.cnpj) },
                  { rotulo: 'Inscrição estadual', valor: e.ie },
                  { rotulo: 'Inscrição municipal', valor: e.im },
                  { rotulo: 'Telefone', valor: formatarTelefone(e.telefone) },
                  { rotulo: 'Fax', valor: e.fax },
                  { rotulo: 'E-mail', valor: e.email },
                  { rotulo: 'Site', valor: e.site },
                  { rotulo: 'Endereço', valor: e.endereco },
                  { rotulo: 'Bairro', valor: e.bairro },
                  { rotulo: 'Cidade', valor: e.cidade ? `${e.cidade}${e.uf ? `/${e.uf}` : ''}` : null },
                  { rotulo: 'CEP', valor: e.cep },
                ]}
              />
            </Painel>
            <Painel titulo="Regras de venda">
              <Detalhes
                itens={[
                  { rotulo: 'Desconto máximo', valor: e.maxDesconto != null ? `${e.maxDesconto}%` : 'Sem limite' },
                  { rotulo: 'Venda fracionada', valor: e.fracionado === 1 ? 'Permitida' : 'Não informada' },
                  { rotulo: 'Terminais licenciados', valor: e.qtdTerminal },
                  { rotulo: 'Turnos', valor: e.qtdTurnos },
                  { rotulo: 'Mensagem do comprovante', valor: e.mensagem },
                ]}
              />
            </Painel>
          </>
        )}
        {e ? <JurosCarne podeEditar={podeEditar} /> : null}
      </div>
    </>
  );
}

function JurosCarne({ podeEditar }: { podeEditar: boolean }) {
  const { notificar } = useFeedback();
  const config = useRequisicao(() => carneService.configuracao(), []);
  const [valores, setValores] = useState<{ jurosDia: string; carenciaDias: string } | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const atual = config.dados;
  const campos = valores ?? {
    jurosDia: atual ? numeroParaCampo(atual.jurosDia, 3).replace(/0$/, '') : '',
    carenciaDias: atual ? String(atual.carenciaDias) : '',
  };
  const mudar = (campo: keyof typeof campos, valor: string) => setValores({ ...campos, [campo]: valor });
  const salvar = useAcao(async () => {
    const jurosDia = lerNumero(campos.jurosDia || '0');
    const carenciaDias = Number(campos.carenciaDias || '0');
    if (jurosDia === null || jurosDia < 0 || jurosDia > 10) return setFalha('Juros ao dia deve ficar entre 0 e 10%.');
    if (!Number.isInteger(carenciaDias) || carenciaDias < 0 || carenciaDias > 365) return setFalha('Carência deve ser um número de dias entre 0 e 365.');
    setFalha(null);
    try {
      await carneService.salvarConfiguracao({ jurosDia, carenciaDias });
      setValores(null);
      config.recarregar();
      notificar('Juros e multa do carnê atualizados.');
    } catch (erro) {
      setFalha(mensagemErro(erro));
    }
  });
  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    void salvar.executar();
  };
  return (
    <Painel
      titulo="Juros e multa do carnê"
      descricao="Impressos no carnê e calculados automaticamente ao receber uma parcela atrasada. Multa cobrada uma vez, após a carência; juros por dia desde o vencimento."
    >
      {config.erro ? (
        <EstadoErro mensagem={config.erro} aoTentarNovamente={config.recarregar} />
      ) : !atual ? (
        <Skeleton altura={60} />
      ) : podeEditar ? (
        <form className="pilha" onSubmit={enviar} noValidate>
          {falha ? (
            <p className="aviso-faixa erro" role="alert">
              {falha}
            </p>
          ) : null}
          <div className="form-grade">
            <Input rotulo="Juros ao dia (%)" inputMode="decimal" placeholder="0,35" value={campos.jurosDia} onChange={(ev) => mudar('jurosDia', ev.target.value)} />
            <Input rotulo="Carência da multa (dias)" inputMode="numeric" placeholder="5" value={campos.carenciaDias} onChange={(ev) => mudar('carenciaDias', ev.target.value)} />
          </div>
          <div className="form-acoes">
            <Button type="submit" carregando={salvar.executando} disabled={valores === null}>
              Salvar juros e multa
            </Button>
          </div>
        </form>
      ) : (
        <Detalhes
          itens={[
            { rotulo: 'Juros ao dia', valor: `${atual.jurosDia.toLocaleString('pt-BR')}%` },
            { rotulo: 'Carência da multa', valor: `${atual.carenciaDias} dia(s)` },
          ]}
        />
      )}
    </Painel>
  );
}

function FormularioEmpresa({ empresa, aoCancelar, aoSalvar }: { empresa: TipoEmpresa; aoCancelar: () => void; aoSalvar: () => void }) {
  const { notificar } = useFeedback();
  const form = useFormulario<FormEmpresa>(paraFormulario(empresa));
  const [falha, setFalha] = useState<string | null>(null);
  const { campo, valores } = form;

  useEffect(() => {
    document.getElementById('empresa-nome')?.focus();
  }, []);

  const salvar = useAcao(async () => {
    const original = paraFormulario(empresa);
    const dados: Record<string, unknown> = {};
    for (const chave of CAMPOS_TEXTO) {
      if (valores[chave] !== original[chave]) dados[chave] = valores[chave].trim() || null;
    }
    if (valores.maxDesconto !== original.maxDesconto) dados.maxDesconto = valores.maxDesconto.trim() ? lerNumero(valores.maxDesconto) : null;
    if (valores.fracionado !== original.fracionado) dados.fracionado = valores.fracionado ? 1 : 0;
    try {
      await empresaService.atualizar(dados as Partial<TipoEmpresa>);
      notificar('Dados da empresa atualizados.');
      aoSalvar();
    } catch (erro) {
      setFalha(mensagemErro(erro));
    }
  });

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const erros: Partial<Record<keyof FormEmpresa, string>> = {};
    if (!valores.nome.trim()) erros.nome = 'Informe o nome.';
    if (valores.email.trim() && !emailValido(valores.email.trim())) erros.email = 'E-mail inválido.';
    const desconto = valores.maxDesconto.trim() ? lerNumero(valores.maxDesconto) : 0;
    if (desconto == null || desconto < 0 || desconto > 100) erros.maxDesconto = 'Entre 0 e 100.';
    form.setErros(erros);
    if (Object.keys(erros).length === 0) void salvar.executar();
  };

  return (
    <Painel titulo="Editar dados da empresa">
      <form onSubmit={enviar} noValidate>
        {falha ? (
          <p className="aviso-faixa erro" role="alert">
            {falha}
          </p>
        ) : null}
        <div className="form-secao">
          <h3>Identificação</h3>
          <div className="form-grade">
            <Input id="empresa-nome" className="col-4" rotulo="Nome" obrigatorio maxLength={100} {...campo('nome')} />
            <Input className="col-2" rotulo="CNPJ/CPF" maxLength={18} {...campo('cnpj')} />
            <Input className="col-2" rotulo="Inscrição estadual" maxLength={16} {...campo('ie')} />
            <Input className="col-2" rotulo="Inscrição municipal" maxLength={20} {...campo('im')} />
          </div>
        </div>
        <div className="form-secao">
          <h3>Contato e endereço</h3>
          <div className="form-grade">
            <Input className="col-2" rotulo="Telefone" maxLength={15} {...campo('telefone')} />
            <Input className="col-2" rotulo="Fax" maxLength={15} {...campo('fax')} />
            <Input className="col-2" rotulo="E-mail" type="email" maxLength={200} {...campo('email')} />
            <Input className="col-3" rotulo="Site" maxLength={200} {...campo('site')} />
            <Input className="col-3" rotulo="Endereço" maxLength={100} {...campo('endereco')} />
            <Input className="col-2" rotulo="Bairro" maxLength={200} {...campo('bairro')} />
            <Input className="col-2" rotulo="Cidade" maxLength={30} {...campo('cidade')} />
            <Select className="col-1" rotulo="UF" {...campo('uf')}>
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf}>{uf}</option>
              ))}
            </Select>
            <Input className="col-1" rotulo="CEP" maxLength={15} {...campo('cep')} />
          </div>
        </div>
        <div className="form-secao">
          <h3>Regras de venda</h3>
          <div className="form-grade">
            <Input className="col-2" rotulo="Desconto máximo (%)" inputMode="decimal" ajuda="Vazio: sem limite. A API recusa descontos acima disso." {...campo('maxDesconto')} />
            <div className="col-4 campo campo-alinhado">
              <label className="caixa-selecao">
                <input type="checkbox" checked={valores.fracionado} onChange={(e) => form.definir('fracionado', e.target.checked)} />
                Permitir venda fracionada (metro, quilo)
              </label>
            </div>
            <Textarea className="col-6" rotulo="Mensagem do comprovante" maxLength={200} {...campo('mensagem')} />
          </div>
        </div>
        <div className="form-acoes">
          <Button variante="secundario" onClick={aoCancelar}>
            Cancelar
          </Button>
          <Button type="submit" carregando={salvar.executando}>
            Salvar alterações
          </Button>
        </div>
      </form>
    </Painel>
  );
}
