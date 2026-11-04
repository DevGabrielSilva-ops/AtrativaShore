import { ListaAuditoria } from '../../components/ListaAuditoria';
import { PageHeader, Painel } from '../../components/ui/Layout';
import { auditoriaService } from '../../services/servicos';

export default function Atividades() {
  return (
    <>
      <PageHeader
        titulo="Atividades"
        descricao="Quem fez o quê na empresa: acessos, vendas, estoque, cadastros e mudanças de permissão."
      />
      <Painel semEspaco>
        <ListaAuditoria buscar={(filtro) => auditoriaService.listar(filtro)} />
      </Painel>
    </>
  );
}
