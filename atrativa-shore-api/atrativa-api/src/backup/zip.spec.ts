import { randomBytes } from 'node:crypto';
import { PassThrough } from 'node:stream';
import { lerZip } from './ler-zip.js';
import { EscritorZip, crc32 } from './zip.js';

async function gerar(montar: (zip: EscritorZip) => Promise<void>): Promise<Buffer> {
  const saida = new PassThrough();
  const partes: Buffer[] = [];
  saida.on('data', (parte: Buffer) => partes.push(parte));
  const zip = new EscritorZip(saida, new Date(2026, 10, 4, 18, 30, 0));
  await montar(zip);
  const tamanho = await zip.finalizar();
  const arquivo = Buffer.concat(partes);
  expect(arquivo.length).toBe(tamanho);
  return arquivo;
}

describe('EscritorZip', () => {
  it('calcula o CRC-32 padrão', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    expect(crc32(Buffer.from('6789'), crc32(Buffer.from('12345')))).toBe(0xcbf43926);
  });

  it('gera um ZIP válido com textos, binários e conteúdo em partes', async () => {
    const binario = randomBytes(300_000);
    async function* partes() {
      for (let i = 0; i < 2000; i += 1) yield `{"linha":${i},"texto":"ção ${'x'.repeat(i % 50)}"}\n`;
    }
    const arquivo = await gerar(async (zip) => {
      await zip.adicionar('metadados.json', '{"versaoFormato":1}');
      await zip.adicionar('dados/binario.bin', binario);
      await zip.adicionar('dados/linhas.jsonl', partes());
      await zip.adicionar('vazio.txt', '');
    });
    const entradas = lerZip(arquivo);
    expect([...entradas.keys()]).toEqual(['metadados.json', 'dados/binario.bin', 'dados/linhas.jsonl', 'vazio.txt']);
    expect(entradas.get('metadados.json')!.conteudo.toString()).toBe('{"versaoFormato":1}');
    expect(entradas.get('dados/binario.bin')!.conteudo.equals(binario)).toBe(true);
    const linhas = entradas.get('dados/linhas.jsonl')!.conteudo.toString('utf8').trim().split('\n');
    expect(linhas).toHaveLength(2000);
    expect(JSON.parse(linhas[1999])).toEqual({ linha: 1999, texto: `ção ${'x'.repeat(1999 % 50)}` });
    expect(entradas.get('vazio.txt')!.conteudo.length).toBe(0);
  });

  it('detecta arquivo corrompido', async () => {
    const arquivo = await gerar((zip) => zip.adicionar('a.txt', 'conteúdo original para corromper'.repeat(20)).then(() => undefined));
    const corrompido = Buffer.from(arquivo);
    corrompido[40] ^= 0xff;
    expect(() => lerZip(corrompido)).toThrow();
  });

  it('interrompe quando a fonte de dados falha', async () => {
    async function* falha() {
      yield 'inicio';
      throw new Error('conexão perdida');
    }
    const saida = new PassThrough();
    saida.resume();
    const zip = new EscritorZip(saida);
    await expect(zip.adicionar('x.json', falha())).rejects.toThrow('conexão perdida');
  });
});
