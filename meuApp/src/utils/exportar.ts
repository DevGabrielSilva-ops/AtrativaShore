export interface ColunaExportacao<T> {
  titulo: string;
  valor: (linha: T) => string | number | null | undefined;
}

function celula(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  const texto = typeof valor === 'number' ? String(valor).replace('.', ',') : valor;
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function exportarCsv<T>(nomeArquivo: string, colunas: ColunaExportacao<T>[], linhas: T[]): void {
  const conteudo = [
    colunas.map((coluna) => celula(coluna.titulo)).join(';'),
    ...linhas.map((linha) => colunas.map((coluna) => celula(coluna.valor(linha))).join(';')),
  ].join('\r\n');
  const blob = new Blob(['﻿', conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function imprimir(): void {
  window.print();
}

function imprimirComClasse(classe: string): void {
  document.body.classList.add(classe);
  const limpar = () => {
    document.body.classList.remove(classe);
    window.removeEventListener('afterprint', limpar);
  };
  window.addEventListener('afterprint', limpar);
  window.print();
  window.setTimeout(limpar, 1000);
}

export function imprimirCarne(): void {
  imprimirComClasse('imprimindo-carne');
}

export function imprimirRecibo(): void {
  imprimirComClasse('imprimindo-recibo');
}
