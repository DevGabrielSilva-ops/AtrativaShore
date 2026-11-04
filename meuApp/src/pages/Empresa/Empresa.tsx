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
import { empresaService } from '../../services/servicos';
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
  const { usuario } = useAuth();
  const empresa = useRequisicao(() => empresaService.obter(), []);
  const [editando, setEditando] = useState(false);
  const e = empresa.dados;

  return (
    <>
      <PageHeader
        titulo="Empresa"
        descricao="Dados cadastrais da loja, usados nos comprovantes e relatórios."
        acoes={
          usuario?.administrador && e && !editando ? (
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
            O banco da loja guarda uma única empresa, então não há cadastro nem exclusão de empresas.
            {usuario?.administrador ? '' : ' Somente o perfil administrador pode alterar estes dados.'}
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
      </div>
    </>
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
    // Só envia o que mudou (PATCH).
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
