import type { ReactNode } from 'react';
import { Skeleton } from './Spinner';
import { EstadoErro, EstadoVazio } from './Estados';

export interface Coluna<T> {
  chave: string;
  titulo: string;
  render: (linha: T) => ReactNode;
  alinhar?: 'esquerda' | 'direita' | 'centro';
  largura?: string;
  /** Some em telas pequenas (a primeira coluna nunca some). */
  ocultarNoCelular?: boolean;
}

interface Props<T> {
  colunas: Coluna<T>[];
  linhas: T[] | null | undefined;
  chaveLinha: (linha: T) => string | number;
  carregando?: boolean;
  erro?: string | null;
  aoTentarNovamente?: () => void;
  vazio?: { titulo: string; descricao?: string; acao?: ReactNode };
  aoClicarLinha?: (linha: T) => void;
  rotulo: string;
  linhasCarregando?: number;
  rodape?: ReactNode;
}

/** Tabela padrão: carregando (skeleton), erro, vazio e linhas clicáveis acessíveis por teclado. */
export function DataTable<T>({
  colunas,
  linhas,
  chaveLinha,
  carregando,
  erro,
  aoTentarNovamente,
  vazio,
  aoClicarLinha,
  rotulo,
  linhasCarregando = 6,
  rodape,
}: Props<T>) {
  if (erro && !carregando) return <EstadoErro mensagem={erro} aoTentarNovamente={aoTentarNovamente} />;

  const classeColuna = (coluna: Coluna<T>) =>
    [`alinhar-${coluna.alinhar ?? 'esquerda'}`, coluna.ocultarNoCelular ? 'ocultar-celular' : ''].join(' ');

  const mostrarVazio = !carregando && (linhas?.length ?? 0) === 0;

  return (
    <div className="tabela-rolagem">
      <table className="tabela" aria-label={rotulo} aria-busy={carregando || undefined}>
        <thead>
          <tr>
            {colunas.map((coluna) => (
              <th key={coluna.chave} scope="col" className={classeColuna(coluna)} style={{ width: coluna.largura }}>
                {coluna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {carregando && !linhas?.length
            ? Array.from({ length: linhasCarregando }, (_, i) => (
                <tr key={`sk-${i}`}>
                  {colunas.map((coluna) => (
                    <td key={coluna.chave} className={classeColuna(coluna)}>
                      <Skeleton largura={coluna.alinhar === 'direita' ? 60 : '70%'} />
                    </td>
                  ))}
                </tr>
              ))
            : (linhas ?? []).map((linha) => (
                <tr
                  key={chaveLinha(linha)}
                  className={aoClicarLinha ? 'linha-clicavel' : undefined}
                  onClick={aoClicarLinha ? () => aoClicarLinha(linha) : undefined}
                  onKeyDown={
                    aoClicarLinha
                      ? (evento) => {
                          if (evento.key === 'Enter') aoClicarLinha(linha);
                        }
                      : undefined
                  }
                  tabIndex={aoClicarLinha ? 0 : undefined}
                >
                  {colunas.map((coluna) => (
                    <td key={coluna.chave} className={classeColuna(coluna)}>
                      {coluna.render(linha)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
        {rodape && !mostrarVazio ? <tfoot>{rodape}</tfoot> : null}
      </table>
      {mostrarVazio && vazio ? <EstadoVazio {...vazio} /> : null}
      {carregando && linhas?.length ? <div className="tabela-atualizando" aria-hidden /> : null}
    </div>
  );
}
