import { once } from 'node:events';
import type { Writable } from 'node:stream';
import zlib from 'node:zlib';

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

export function crc32(dados: Buffer, anterior = 0): number {
  const nativo = (zlib as unknown as { crc32?: (dados: Buffer, valor?: number) => number }).crc32;
  if (nativo) return nativo(dados, anterior);
  let c = (anterior ^ 0xffffffff) >>> 0;
  for (let i = 0; i < dados.length; i += 1) c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dataDos(data: Date): { hora: number; dia: number } {
  return {
    hora: (data.getHours() << 11) | (data.getMinutes() << 5) | Math.floor(data.getSeconds() / 2),
    dia: ((Math.max(1980, data.getFullYear()) - 1980) << 9) | ((data.getMonth() + 1) << 5) | data.getDate(),
  };
}

interface EntradaCentral {
  nome: Buffer;
  crc: number;
  comprimido: number;
  original: number;
  deslocamento: number;
  hora: number;
  dia: number;
}

export type Conteudo = string | Buffer | AsyncIterable<string | Buffer> | Iterable<string | Buffer>;

const LIMITE_ZIP32 = 0xffffffff;

export class EscritorZip {
  private posicao = 0;
  private readonly entradas: EntradaCentral[] = [];

  constructor(
    private readonly saida: Writable,
    private readonly data = new Date(),
  ) {}

  private async escrever(buffer: Buffer): Promise<void> {
    this.posicao += buffer.length;
    if (!this.saida.write(buffer)) await once(this.saida, 'drain');
  }

  async adicionar(nome: string, conteudo: Conteudo): Promise<{ original: number; comprimido: number }> {
    const nomeBuffer = Buffer.from(nome, 'utf8');
    const deslocamento = this.posicao;
    const { hora, dia } = dataDos(this.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0808, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(dia, 12);
    local.writeUInt16LE(nomeBuffer.length, 26);
    await this.escrever(Buffer.concat([local, nomeBuffer]));

    const compressor = zlib.createDeflateRaw({ level: 6 });
    const pendentes: Buffer[] = [];
    let falha: Error | null = null;
    compressor.on('data', (parte: Buffer) => pendentes.push(parte));
    compressor.on('error', (erro: Error) => {
      falha = erro;
    });
    const terminado = once(compressor, 'end');
    terminado.catch(() => undefined);

    let comprimido = 0;
    const esvaziar = async () => {
      while (pendentes.length) {
        const parte = pendentes.shift()!;
        comprimido += parte.length;
        await this.escrever(parte);
      }
    };

    let crc = 0;
    let original = 0;
    const partes: AsyncIterable<string | Buffer> | Iterable<string | Buffer> =
      typeof conteudo === 'string' || Buffer.isBuffer(conteudo) ? [conteudo] : conteudo;
    for await (const parte of partes) {
      const buffer = typeof parte === 'string' ? Buffer.from(parte, 'utf8') : parte;
      if (buffer.length === 0) continue;
      crc = crc32(buffer, crc);
      original += buffer.length;
      if (!compressor.write(buffer)) await once(compressor, 'drain');
      await esvaziar();
      if (falha) throw falha;
    }
    compressor.end();
    await terminado;
    await esvaziar();
    if (falha) throw falha;
    if (original > LIMITE_ZIP32 || comprimido > LIMITE_ZIP32 || this.posicao > LIMITE_ZIP32) {
      throw new Error('Backup maior que 4 GB: use o backup global com mysqldump');
    }

    const descritor = Buffer.alloc(16);
    descritor.writeUInt32LE(0x08074b50, 0);
    descritor.writeUInt32LE(crc >>> 0, 4);
    descritor.writeUInt32LE(comprimido, 8);
    descritor.writeUInt32LE(original, 12);
    await this.escrever(descritor);

    this.entradas.push({ nome: nomeBuffer, crc: crc >>> 0, comprimido, original, deslocamento, hora, dia });
    return { original, comprimido };
  }

  async finalizar(): Promise<number> {
    const inicio = this.posicao;
    for (const entrada of this.entradas) {
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(20, 4);
      central.writeUInt16LE(20, 6);
      central.writeUInt16LE(0x0808, 8);
      central.writeUInt16LE(8, 10);
      central.writeUInt16LE(entrada.hora, 12);
      central.writeUInt16LE(entrada.dia, 14);
      central.writeUInt32LE(entrada.crc, 16);
      central.writeUInt32LE(entrada.comprimido, 20);
      central.writeUInt32LE(entrada.original, 24);
      central.writeUInt16LE(entrada.nome.length, 28);
      central.writeUInt32LE(entrada.deslocamento, 42);
      await this.escrever(Buffer.concat([central, entrada.nome]));
    }
    const tamanhoCentral = this.posicao - inicio;
    const fim = Buffer.alloc(22);
    fim.writeUInt32LE(0x06054b50, 0);
    fim.writeUInt16LE(this.entradas.length, 8);
    fim.writeUInt16LE(this.entradas.length, 10);
    fim.writeUInt32LE(tamanhoCentral, 12);
    fim.writeUInt32LE(inicio, 16);
    await this.escrever(fim);
    this.saida.end();
    await once(this.saida, 'finish');
    return this.posicao;
  }
}
