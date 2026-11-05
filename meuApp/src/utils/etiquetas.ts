import type { ConteudoCampoEtiqueta, ModeloEtiqueta, ProdutoEtiqueta } from '../types/api';

export const LIMITE_ETIQUETAS = 5000;
export const QUANTIDADE_MAXIMA = 999;

export const CONTEUDOS_OPCIONAIS: ConteudoCampoEtiqueta[] = ['empresa', 'informacoes', 'fornecedor', 'tipo'];
export const CONTEUDOS_PRECO: ConteudoCampoEtiqueta[] = ['precoVarejo', 'precoAtacado'];

export interface ItemMaleta {
  id: number;
  quantidade: number;
}

export function temCodigo(produto: Pick<ProdutoEtiqueta, 'codigoBarras'> | null | undefined): boolean {
  return Boolean(produto?.codigoBarras?.trim());
}

export function opcionaisDoModelo(modelo: ModeloEtiqueta): ConteudoCampoEtiqueta[] {
  return CONTEUDOS_OPCIONAIS.filter((conteudo) => modelo.campos.some((campo) => campo.conteudo === conteudo));
}

export function opcionaisPadrao(modelo: ModeloEtiqueta): ConteudoCampoEtiqueta[] {
  return opcionaisDoModelo(modelo).filter((conteudo) =>
    modelo.campos.some((campo) => campo.conteudo === conteudo && campo.usar),
  );
}

export function montarFolhas(
  itens: ItemMaleta[],
  produtos: Map<number, ProdutoEtiqueta>,
  porFolha: number,
  inicio: number,
): Array<Array<ProdutoEtiqueta | null>> {
  const sequencia: Array<ProdutoEtiqueta | null> = Array.from({ length: Math.max(0, inicio - 1) }, () => null);
  let impressas = 0;
  for (const item of itens) {
    const produto = produtos.get(item.id);
    if (!produto || !temCodigo(produto)) continue;
    const quantidade = Math.min(item.quantidade, LIMITE_ETIQUETAS - impressas);
    for (let i = 0; i < quantidade; i += 1) sequencia.push(produto);
    impressas += Math.max(0, quantidade);
    if (impressas >= LIMITE_ETIQUETAS) break;
  }
  if (impressas === 0) return [];
  const folhas: Array<Array<ProdutoEtiqueta | null>> = [];
  for (let i = 0; i < sequencia.length; i += porFolha) {
    const folha = sequencia.slice(i, i + porFolha);
    while (folha.length < porFolha) folha.push(null);
    folhas.push(folha);
  }
  return folhas;
}

export function lerMaleta(chave: string): ItemMaleta[] {
  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return [];
    const lido = JSON.parse(bruto) as unknown;
    if (!Array.isArray(lido)) return [];
    return lido
      .map((item) => ({ id: Number((item as ItemMaleta).id), quantidade: Number((item as ItemMaleta).quantidade) }))
      .filter((item) => Number.isInteger(item.id) && item.id > 0 && Number.isInteger(item.quantidade) && item.quantidade > 0)
      .map((item) => ({ ...item, quantidade: Math.min(item.quantidade, QUANTIDADE_MAXIMA) }));
  } catch {
    return [];
  }
}

export function gravarMaleta(chave: string, itens: ItemMaleta[]): void {
  try {
    if (itens.length) window.localStorage.setItem(chave, JSON.stringify(itens));
    else window.localStorage.removeItem(chave);
  } catch {
    return;
  }
}
