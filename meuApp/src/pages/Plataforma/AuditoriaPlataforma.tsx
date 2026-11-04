import { useMemo, useState } from 'react';
import { ListaAuditoria } from '../../components/ListaAuditoria';
import { Select } from '../../components/ui/Field';
import { PageHeader, Painel } from '../../components/ui/Layout';
import { useRequisicao } from '../../hooks/useRequisicao';
import { plataformaService } from '../../services/servicos';

export default function AuditoriaPlataforma() {
  const [idEmpresa, setIdEmpresa] = useState('');
  const empresas = useRequisicao(() => plataformaService.empresas({ limit: 100 }), []);
  const nomes = useMemo(() => new Map((empresas.dados?.data ?? []).map((e) => [e.id, e.nome])), [empresas.dados]);
  return (
    <>
      <PageHeader titulo="Auditoria" descricao="Histórico de atividades da plataforma e de todas as empresas." />
      <Painel semEspaco>
        <div className="barra-ferramentas">
          <Select rotulo="Empresa" value={idEmpresa} onChange={(e) => setIdEmpresa(e.target.value)}>
            <option value="">Todas as empresas e a plataforma</option>
            {(empresas.dados?.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </Select>
        </div>
        <ListaAuditoria
          buscar={(filtro) => plataformaService.auditoria({ ...filtro, idEmpresa: idEmpresa ? Number(idEmpresa) : undefined })}
          dependencias={[idEmpresa]}
          mostrarEmpresa
          nomesEmpresas={nomes}
        />
      </Painel>
    </>
  );
}
