import type { CSSProperties } from 'react';
import type { CampoEtiqueta, ConteudoCampoEtiqueta, ModeloEtiqueta, ProdutoEtiqueta } from '../types/api';
import { CONTEUDOS_PRECO } from '../utils/etiquetas';
import { CodigoBarras } from './CodigoBarras';

const cm = (valor: number) => `${valor}cm`;

function posicao(campo: CampoEtiqueta, modelo: ModeloEtiqueta): CSSProperties {
  return {
    top: cm(campo.topo),
    left: cm(campo.esquerda),
    width: cm(Math.min(campo.largura, Math.max(0.1, modelo.larguraEtiqueta - campo.esquerda))),
    height: cm(campo.altura),
    fontSize: `${campo.fonte}pt`,
  };
}

function textoDoCampo(conteudo: ConteudoCampoEtiqueta, produto: ProdutoEtiqueta, empresa: string | null): string | null {
  if (conteudo === 'empresa') return empresa;
  if (conteudo === 'informacoes') return produto.informacoes;
  if (conteudo === 'fornecedor') return produto.fornecedor;
  if (conteudo === 'tipo') return produto.tipo;
  return null;
}

export function EtiquetaProduto({
  modelo,
  produto,
  empresa,
  opcionais,
}: {
  modelo: ModeloEtiqueta;
  produto: ProdutoEtiqueta;
  empresa: string | null;
  opcionais: ConteudoCampoEtiqueta[];
}) {
  const codigo = produto.codigoBarras ?? '';
  return (
    <>
      {modelo.campos.map((campo) => {
        if (CONTEUDOS_PRECO.includes(campo.conteudo)) return null;
        if (campo.conteudo === 'codigoBarras') {
          return (
            <div key={campo.id} className="etiqueta-campo etiqueta-codigo" style={posicao(campo, modelo)}>
              <CodigoBarras valor={codigo} altura={20} />
              <span>{codigo}</span>
            </div>
          );
        }
        if (campo.conteudo === 'produto') {
          return (
            <div key={campo.id} className="etiqueta-campo etiqueta-nome" style={posicao(campo, modelo)}>
              {produto.nome ?? `Produto #${produto.id}`}
            </div>
          );
        }
        if (!opcionais.includes(campo.conteudo)) return null;
        const texto = textoDoCampo(campo.conteudo, produto, empresa);
        if (!texto) return null;
        return (
          <div key={campo.id} className="etiqueta-campo etiqueta-texto" style={posicao(campo, modelo)}>
            {texto}
          </div>
        );
      })}
    </>
  );
}

export function FolhaEtiquetas({
  modelo,
  etiquetas,
  empresa,
  opcionais,
  previa = false,
  usadas = 0,
  rotulo,
}: {
  modelo: ModeloEtiqueta;
  etiquetas: Array<ProdutoEtiqueta | null>;
  empresa: string | null;
  opcionais: ConteudoCampoEtiqueta[];
  previa?: boolean;
  usadas?: number;
  rotulo: string;
}) {
  return (
    <section
      className={`etiquetas-folha${previa ? ' etiquetas-folha-previa' : ''}`}
      style={{ width: cm(modelo.pagina.largura), height: cm(modelo.pagina.altura) }}
      aria-label={rotulo}
    >
      {etiquetas.map((produto, indice) => {
        const coluna = indice % modelo.colunas;
        const linha = Math.floor(indice / modelo.colunas);
        const estilo: CSSProperties = {
          top: cm(modelo.margens.topo + linha * modelo.alturaEtiqueta),
          left: cm(modelo.margens.esquerda + coluna * (modelo.larguraEtiqueta + modelo.espacoColunas)),
          width: cm(modelo.larguraEtiqueta),
          height: cm(modelo.alturaEtiqueta),
        };
        return (
          <div key={indice} className={`etiqueta${produto ? '' : indice < usadas ? ' etiqueta-usada' : ' etiqueta-vazia'}`} style={estilo}>
            {produto ? <EtiquetaProduto modelo={modelo} produto={produto} empresa={empresa} opcionais={opcionais} /> : null}
          </div>
        );
      })}
    </section>
  );
}
