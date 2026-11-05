import zlib from 'node:zlib';
import { crc32 } from './zip.js';

export interface EntradaLida {
  nome: string;
  conteudo: Buffer;
}

export function lerZip(arquivo: Buffer): Map<string, EntradaLida> {
  let fim = -1;
  for (let i = arquivo.length - 22; i >= Math.max(0, arquivo.length - 65557); i -= 1) {
    if (arquivo.readUInt32LE(i) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error('ZIP inválido: diretório central não encontrado');
  const quantidade = arquivo.readUInt16LE(fim + 10);
  let posicao = arquivo.readUInt32LE(fim + 16);
  const entradas = new Map<string, EntradaLida>();
  for (let n = 0; n < quantidade; n += 1) {
    if (arquivo.readUInt32LE(posicao) !== 0x02014b50) throw new Error('ZIP inválido: entrada central corrompida');
    const metodo = arquivo.readUInt16LE(posicao + 10);
    const crc = arquivo.readUInt32LE(posicao + 16);
    const comprimido = arquivo.readUInt32LE(posicao + 20);
    const original = arquivo.readUInt32LE(posicao + 24);
    const tamanhoNome = arquivo.readUInt16LE(posicao + 28);
    const tamanhoExtra = arquivo.readUInt16LE(posicao + 30);
    const tamanhoComentario = arquivo.readUInt16LE(posicao + 32);
    const local = arquivo.readUInt32LE(posicao + 42);
    const nome = arquivo.subarray(posicao + 46, posicao + 46 + tamanhoNome).toString('utf8');
    if (arquivo.readUInt32LE(local) !== 0x04034b50) throw new Error(`ZIP inválido: cabeçalho local de ${nome}`);
    const inicio = local + 30 + arquivo.readUInt16LE(local + 26) + arquivo.readUInt16LE(local + 28);
    const bruto = arquivo.subarray(inicio, inicio + comprimido);
    const conteudo = metodo === 8 ? zlib.inflateRawSync(bruto) : Buffer.from(bruto);
    if (conteudo.length !== original) throw new Error(`ZIP inválido: tamanho de ${nome}`);
    if (crc32(conteudo) !== crc) throw new Error(`ZIP inválido: CRC de ${nome}`);
    entradas.set(nome, { nome, conteudo });
    posicao += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
  }
  return entradas;
}
