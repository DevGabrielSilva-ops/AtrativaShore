import { Link } from 'react-router-dom';
import { Painel } from '../components/ui/Layout';

export default function NaoEncontrada() {
  return (
    <Painel>
      <div className="estado">
        <p className="estado-titulo">Página não encontrada</p>
        <p className="muted pequeno">O endereço não existe ou foi movido. Use o menu ao lado ou volte ao início.</p>
        <div className="estado-acao">
          <Link to="/" className="btn btn-primario btn-md">
            Ir para o Dashboard
          </Link>
        </div>
      </div>
    </Painel>
  );
}
