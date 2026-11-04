import { PageHeader } from '../../components/ui/Layout';
import { AlterarSenha } from '../Perfil/AlterarSenha';

export default function SenhaPlataforma() {
  return (
    <>
      <PageHeader titulo="Alterar senha" descricao="Senha da sua conta de administrador da plataforma." />
      <div className="grade-2">
        <AlterarSenha />
      </div>
    </>
  );
}
