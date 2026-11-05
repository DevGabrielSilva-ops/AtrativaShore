export type ConteudoCampo =
  | 'produto'
  | 'codigoBarras'
  | 'precoVarejo'
  | 'precoAtacado'
  | 'informacoes'
  | 'empresa'
  | 'fornecedor'
  | 'tipo';

export interface CampoEtiqueta {
  id: number;
  nome: string;
  conteudo: ConteudoCampo;
  ordem: number;
  usar: boolean;
  topo: number;
  esquerda: number;
  largura: number;
  altura: number;
  fonte: number;
}

export interface ModeloEtiqueta {
  id: number;
  nome: string;
  pagina: { largura: number; altura: number };
  margens: { topo: number; baixo: number; esquerda: number; direita: number };
  colunas: number;
  linhas: number;
  porFolha: number;
  espacoColunas: number;
  larguraEtiqueta: number;
  alturaEtiqueta: number;
  campos: CampoEtiqueta[];
}

export interface LinhaConfig {
  id: number | string;
  nome_etiqueta: string | null;
  pag_comprimento: number | string | null;
  pag_largura: number | string | null;
  qtd_colunas: number | string | null;
  espaco_colunas: number | string | null;
  etq_comprimento: number | string | null;
  marg_top: number | string | null;
  marg_bottom: number | string | null;
  marg_left: number | string | null;
  marg_right: number | string | null;
}

export interface LinhaCampo {
  id: number | string;
  nome_demonstrativo: string | null;
  id_etiqueta: number | string | null;
  id_class: number | string | null;
  usar: number | string | null;
  top_e: number | string | null;
  left_e: number | string | null;
  width_e: number | string | null;
  height_e: number | string | null;
  font_size_e: number | string | null;
}

export const CONFIG_PADRAO: LinhaConfig[] = [
  { id: 1, nome_etiqueta: 'PRODUTOS MODO SIMPLES (1 CÓDIGO DE BARRA)', pag_comprimento: 29.7, pag_largura: 21, qtd_colunas: 6, espaco_colunas: 0, etq_comprimento: 2.1, marg_top: 1.35, marg_bottom: 0.5, marg_left: 0.5, marg_right: 0.5 },
  { id: 2, nome_etiqueta: 'PRODUTOS MODO DUPLO    (2 CÓDIGO DE BARRA)', pag_comprimento: 27.94, pag_largura: 21.59, qtd_colunas: 4, espaco_colunas: 0.2, etq_comprimento: 6.2, marg_top: 1.4, marg_bottom: 1.4, marg_left: 1.6, marg_right: 1.6 },
];

const campo = (
  id: number,
  nome: string,
  etiqueta: number,
  classe: number,
  usar: number,
  topo: number,
  esquerda: number,
  largura: number,
  altura: number,
  fonte: number,
): LinhaCampo => ({
  id,
  nome_demonstrativo: nome,
  id_etiqueta: etiqueta,
  id_class: classe,
  usar,
  top_e: topo,
  left_e: esquerda,
  width_e: largura,
  height_e: altura,
  font_size_e: fonte,
});

export const CAMPOS_PADRAO: LinhaCampo[] = [
  campo(1, 'NOME DO PRODUTO', 1, 3, 0, 0.1, 0.4, 3.2, 0.5, 6),
  campo(2, 'IMAGEM CÓDIGO DE BARRA', 1, 2, 0, 0.6, 0.6, 2.8, 0.8, 8),
  campo(3, 'VALOR DE VAREJO', 1, 1, 1, 1.4, 0.4, 1.5, 0.4, 8),
  campo(4, 'INFORMAÇÕES ADICIONAIS', 1, 1, 0, 1.8, 0.4, 3.2, 0.2, 4),
  campo(5, 'VALOR DE ATACADO', 1, 1, 1, 1.4, 2.0, 1.5, 0.4, 8),
  campo(6, 'NOME DA EMPRESA', 2, 1, 0, 1.0, 0.2, 3.9, 0.3, 5),
  campo(7, 'NOME DO FORNECEDOR', 2, 1, 0, 1.4, 0.2, 3.9, 0.2, 5),
  campo(8, 'NOME DO PRODUTO ( 1 )', 2, 3, 0, 1.7, 0.2, 3.9, 0.5, 7),
  campo(9, 'NOME DO TIPO', 2, 1, 0, 2.2, 0.2, 3.9, 0.2, 5),
  campo(10, 'INFORMAÇÕES ADICIONAIS', 2, 1, 0, 2.5, 0.2, 3.9, 0.2, 5),
  campo(11, 'IMAGEM CÓDIGO DE BARRA ( 1 )', 2, 2, 0, 2.8, 0.9, 2.8, 0.8, 8),
  campo(12, 'NOME DO PRODUTO ( 2 )', 2, 3, 0, 4.0, 0.2, 3.9, 0.5, 7),
  campo(13, 'IMAGEM CÓDIGO DE BARRA ( 2 )', 2, 2, 0, 4.7, 0.9, 2.8, 0.8, 8),
  campo(14, 'VALOR DE VAREJO', 2, 1, 0, 5.6, 2.2, 1.8, 0.4, 8),
  campo(15, 'VALOR DE ATACADO', 2, 1, 0, 5.6, 0.2, 1.8, 0.4, 8),
  campo(23, 'NOME DA EMPRESA', 1, 1, 1, 1.8, 0.4, 1.5, 0.4, 5),
];

const CLASSE_CODIGO = 2;
const CLASSE_PRODUTO = 3;

const num = (valor: number | string | null | undefined): number => {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
};

const cm = (valor: number) => Math.round(valor * 1000) / 1000;

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

export function conteudoDoCampo(linha: LinhaCampo): ConteudoCampo | null {
  const nome = normalizar(linha.nome_demonstrativo ?? '');
  const classe = num(linha.id_class);
  if (classe === CLASSE_CODIGO) return nome.includes('CLIENTE') ? null : 'codigoBarras';
  if (classe === CLASSE_PRODUTO || nome.includes('NOME DO PRODUTO')) return 'produto';
  if (nome.includes('VAREJO')) return 'precoVarejo';
  if (nome.includes('ATACADO')) return 'precoAtacado';
  if (nome.includes('INFORMAC')) return 'informacoes';
  if (nome.includes('FORNECEDOR')) return 'fornecedor';
  if (nome.includes('TIPO')) return 'tipo';
  if (nome.includes('EMPRESA')) return 'empresa';
  return null;
}

function ordemDoCampo(nome: string | null): number {
  const encontrado = /\(\s*(\d+)\s*\)/.exec(nome ?? '');
  return encontrado ? Number(encontrado[1]) : 1;
}

function rotulo(nome: string): string {
  const limpo = nome.replace(/\s+/g, ' ').trim().toLowerCase();
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

export function montarModelos(configs: LinhaConfig[], campos: LinhaCampo[]): ModeloEtiqueta[] {
  const modelos: ModeloEtiqueta[] = [];
  for (const config of configs) {
    const id = num(config.id);
    const camposDoModelo: CampoEtiqueta[] = [];
    for (const linha of campos) {
      if (num(linha.id_etiqueta) !== id) continue;
      const conteudo = conteudoDoCampo(linha);
      if (!conteudo) continue;
      camposDoModelo.push({
        id: num(linha.id),
        nome: rotulo(linha.nome_demonstrativo ?? conteudo),
        conteudo,
        ordem: ordemDoCampo(linha.nome_demonstrativo),
        usar: num(linha.usar) === 1,
        topo: cm(num(linha.top_e)),
        esquerda: cm(num(linha.left_e)),
        largura: cm(num(linha.width_e)),
        altura: cm(num(linha.height_e)),
        fonte: num(linha.font_size_e) || 6,
      });
    }
    const temProduto = camposDoModelo.some((c) => c.conteudo === 'produto');
    const temCodigo = camposDoModelo.some((c) => c.conteudo === 'codigoBarras');
    const colunas = Math.max(1, Math.trunc(num(config.qtd_colunas)));
    const alturaEtiqueta = num(config.etq_comprimento);
    if (!temProduto || !temCodigo || alturaEtiqueta <= 0) continue;
    const pagina = { largura: num(config.pag_largura), altura: num(config.pag_comprimento) };
    const margens = {
      topo: num(config.marg_top),
      baixo: num(config.marg_bottom),
      esquerda: num(config.marg_left),
      direita: num(config.marg_right),
    };
    const espacoColunas = num(config.espaco_colunas);
    const larguraEtiqueta = (pagina.largura - margens.esquerda - margens.direita - espacoColunas * (colunas - 1)) / colunas;
    const linhas = Math.max(1, Math.floor((pagina.altura - margens.topo - margens.baixo + 0.001) / alturaEtiqueta));
    if (larguraEtiqueta <= 0) continue;
    camposDoModelo.sort((a, b) => a.topo - b.topo || a.esquerda - b.esquerda);
    modelos.push({
      id,
      nome: (config.nome_etiqueta ?? `Modelo ${id}`).replace(/\s+/g, ' ').trim(),
      pagina,
      margens,
      colunas,
      linhas,
      porFolha: colunas * linhas,
      espacoColunas,
      larguraEtiqueta: cm(larguraEtiqueta),
      alturaEtiqueta,
      campos: camposDoModelo,
    });
  }
  return modelos;
}
