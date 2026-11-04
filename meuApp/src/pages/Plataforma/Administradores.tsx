import { useState } from 'react';
import { IoAdd } from 'react-icons/io5';
import { SegredoUnico } from '../../components/SegredoUnico';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Badge } from '../../components/ui/Estados';
import { Input } from '../../components/ui/Field';
import { PageHeader, Painel } from '../../components/ui/Layout';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAcao, useRequisicao } from '../../hooks/useRequisicao';
import { mensagemErro } from '../../services/api';
import { plataformaService } from '../../services/servicos';
import type { AdministradorPlataforma } from '../../types/api';
import { formatarDataHora } from '../../utils/formatar';
import { emailValido } from '../../utils/validar';

export default function Administradores() {
  const { usuario } = useAuth();
  const { confirmar, notificar } = useFeedback();
  const lista = useRequisicao(() => plataformaService.administradores(), []);
  const [criando, setCriando] = useState(false);
  const [segredo, setSegredo] = useState<{ nome: string; senha: string } | null>(null);

  const alternar = async (a: AdministradorPlataforma) => {
    const desativar = a.status === 'ACTIVE';
    const sim = await confirmar({
      titulo: desativar ? `Desativar ${a.nome}?` : `Reativar ${a.nome}?`,
      mensagem: desativar ? 'A pessoa perde o acesso à administração da plataforma na hora.' : 'A pessoa volta a acessar a administração.',
      confirmar: desativar ? 'Desativar' : 'Reativar',
      perigo: desativar,
    });
    if (!sim) return;
    try {
      await plataformaService.statusAdministrador(a.id, desativar ? 'INACTIVE' : 'ACTIVE');
      lista.recarregar();
    } catch (e) {
      notificar(mensagemErro(e), 'erro');
    }
  };

  const redefinir = async (a: AdministradorPlataforma) => {
    if (!(await confirmar({ titulo: `Gerar senha temporária para ${a.nome}?`, mensagem: 'A senha atual deixa de valer.', confirmar: 'Gerar senha' }))) return;
    try {
      const { senhaTemporaria } = await plataformaService.senhaAdministrador(a.id);
      setSegredo({ nome: a.nome, senha: senhaTemporaria });
    } catch (e) {
      notificar(mensagemErro(e), 'erro');
    }
  };

  return (
    <>
      <PageHeader
        titulo="Administradores da plataforma"
        descricao="Pessoas com acesso a esta área. Não há cadastro público: só um administrador cria outro."
        acoes={
          <Button icone={<IoAdd />} onClick={() => setCriando(true)}>
            Novo administrador
          </Button>
        }
      />
      <Painel semEspaco>
        <DataTable<AdministradorPlataforma>
          rotulo="Administradores"
          carregando={lista.carregando}
          erro={lista.erro}
          aoTentarNovamente={lista.recarregar}
          linhas={lista.dados}
          chaveLinha={(a) => a.id}
          colunas={[
            {
              chave: 'nome',
              titulo: 'Administrador',
              render: (a) => (
                <div className="celula-principal">
                  <strong>
                    {a.nome} {a.id === usuario?.id ? <span className="muted">(você)</span> : null}
                  </strong>
                  <span>{a.email}</span>
                </div>
              ),
            },
            {
              chave: 'status',
              titulo: 'Situação',
              render: (a) =>
                a.status !== 'ACTIVE' ? <Badge tom="perigo">Desativado</Badge> : a.trocarSenha ? <Badge tom="aviso">Aguardando 1º acesso</Badge> : <Badge tom="sucesso">Ativo</Badge>,
            },
            { chave: 'acesso', titulo: 'Último acesso', ocultarNoCelular: true, render: (a) => <span className="num">{a.ultimoLoginEm ? formatarDataHora(a.ultimoLoginEm) : 'Nunca'}</span> },
            {
              chave: 'acoes',
              titulo: 'Ações',
              alinhar: 'direita',
              render: (a) =>
                a.id !== usuario?.id ? (
                  <div className="acoes-linha">
                    <Button variante="fantasma" tamanho="sm" onClick={() => void redefinir(a)}>
                      Senha temporária
                    </Button>
                    <Button variante="fantasma" tamanho="sm" onClick={() => void alternar(a)}>
                      {a.status === 'ACTIVE' ? 'Desativar' : 'Reativar'}
                    </Button>
                  </div>
                ) : null,
            },
          ]}
        />
      </Painel>
      {criando ? (
        <NovoAdministrador
          aoFechar={() => setCriando(false)}
          aoCriar={(nome, senha) => {
            setCriando(false);
            setSegredo({ nome, senha });
            lista.recarregar();
          }}
        />
      ) : null}
      {segredo ? (
        <SegredoUnico
          titulo="Senha temporária"
          descricao={`Entregue a ${segredo.nome}. No primeiro acesso será pedida uma senha nova.`}
          valor={segredo.senha}
          aoFechar={() => setSegredo(null)}
        />
      ) : null}
    </>
  );
}

function NovoAdministrador({ aoFechar, aoCriar }: { aoFechar: () => void; aoCriar: (nome: string, senha: string) => void }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [falha, setFalha] = useState<string | null>(null);
  const criar = useAcao(async () => {
    if (!nome.trim()) return setFalha('Informe o nome.');
    if (!emailValido(email.trim())) return setFalha('Informe um e-mail válido.');
    try {
      const criado = await plataformaService.criarAdministrador({ nome: nome.trim(), email: email.trim() });
      aoCriar(criado.nome, criado.senhaTemporaria);
    } catch (e) {
      setFalha(mensagemErro(e));
    }
  });
  return (
    <Modal
      aberto
      titulo="Novo administrador da plataforma"
      descricao="Terá acesso total à gestão de empresas, códigos e planos."
      aoFechar={aoFechar}
      tamanho="sm"
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={() => void criar.executar()} carregando={criar.executando}>
            Criar administrador
          </Button>
        </>
      }
    >
      <div className="pilha">
        {falha ? <p className="aviso-faixa erro">{falha}</p> : null}
        <Input rotulo="Nome" obrigatorio maxLength={100} value={nome} onChange={(e) => setNome(e.target.value)} />
        <Input rotulo="E-mail" type="email" obrigatorio maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
    </Modal>
  );
}
