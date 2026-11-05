import { BadRequestException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import { CarnesService } from './carnes.service.js';
import { FormaRecebimentoCarne } from './dto/carne.dto.js';

type Linha = Record<string, unknown>;

function cenario(config: Linha | null = { juros_dia: '0.350', multa: '1.25', carencia_dias: 5 }) {
  const parcelas: Linha[] = [
    { id: 1, cod_carne: '0411111111111', controle: '20261001120000', vr_parcela: '100.00', data_vencimento: '2026-10-25', efetuado: 'N', estornado: 0, parcela: 1 },
    { id: 2, cod_carne: '0411111111112', controle: '20261001120000', vr_parcela: '100.00', data_vencimento: '2026-12-25', efetuado: 'N', estornado: 0, parcela: 2 },
  ];
  const gravados: Array<{ sql: string; parametros: unknown[] }> = [];
  const inseridos: Linha[] = [];
  const query = async (sql: string, parametros: unknown[] = []): Promise<unknown> => {
    if (sql.includes('FROM api_config_carne')) return config ? [config] : [];
    if (sql.includes('FROM mv_financeiro') && sql.includes('FOR UPDATE')) {
      return parcelas.filter((p) => (parametros[0] as string[]).includes(String(p.cod_carne)));
    }
    if (sql.startsWith('UPDATE mv_financeiro')) {
      const p = parcelas.find((x) => x.id === parametros[5])!;
      Object.assign(p, { efetuado: 'S', data_pagamento: parametros[1], vr_pago: parametros[2], vr_juros: parametros[3], vr_desconto: parametros[4] });
      return [];
    }
    if (sql.includes('UNION ALL')) return [];
    if (sql.includes('FROM cad_produtos')) return [{ id: 99 }];
    if (sql.startsWith('INSERT INTO api_recebimentos_carne')) {
      gravados.push({ sql, parametros });
      return [];
    }
    if (sql.includes('f.cod_carne = ?')) {
      const p = parcelas.find((x) => x.cod_carne === parametros[0])!;
      return [{ ...p, data_lancamento: '2026-10-01', total_parcelas: 2, id_cliente: 5, nome_cliente: 'MARIA' }];
    }
    throw new Error(`SQL inesperado: ${sql}`);
  };
  const fonte = {
    query,
    transaction: async (_nivel: string, executar: (manager: unknown) => Promise<unknown>) =>
      executar({ query, insert: async (_entidade: unknown, linha: Linha) => inseridos.push(linha) }),
  };
  const servico = new CarnesService(
    fonte as never,
    { pdv: { terminal: '02', turno: '1', exigirCaixaAberto: false }, fusoHorario: 'America/Sao_Paulo' } as never,
    { garantirTransacoes: async () => undefined, garantirTabelasCarne: async () => undefined } as never,
  );
  return { servico, parcelas, gravados, inseridos };
}

const usuario = { id: 10, idLogin: 3 } as UsuarioAutenticado;

describe('recebimento de carnê', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-04T15:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('calcula juros e multa automaticamente e divide o pagamento entre as formas', async () => {
    const { servico, parcelas, gravados, inseridos } = cenario();
    const resultado = await servico.baixar(
      {
        parcelas: [{ codigo: '0411111111111' }, { codigo: '0411111111112' }],
        pagamentos: [
          { forma: FormaRecebimentoCarne.DINHEIRO, valor: 50 },
          { forma: FormaRecebimentoCarne.PIX, valor: 120 },
          { forma: FormaRecebimentoCarne.CARTAO, valor: 34.75 },
        ],
        valorRecebidoDinheiro: 60,
      },
      usuario,
    );
    expect(parcelas[0]).toMatchObject({ efetuado: 'S', vr_juros: 4.75, vr_pago: 104.75 });
    expect(parcelas[1]).toMatchObject({ efetuado: 'S', vr_juros: null, vr_pago: 100 });
    expect(resultado).toMatchObject({ valorTotal: 204.75, pagamentos: { dinheiro: 50, pix: 120, cartao: 34.75 }, troco: 10 });
    expect(inseridos[0]).toMatchObject({ valorTotal: 204.75, modoVenda: expect.anything(), terminal: '02' });
    expect(gravados[0].parametros).toEqual([
      resultado.controleRecebimento,
      '2026-11-04',
      '02',
      '1',
      3,
      204.75,
      50,
      120,
      34.75,
      60,
      10,
      '0411111111111,0411111111112',
    ]);
  });

  it('sempre aplica os juros calculados pelo sistema e aceita desconto', async () => {
    const { servico, parcelas } = cenario();
    await servico.baixar({ parcelas: [{ codigo: '0411111111111', desconto: 5 }] }, usuario);
    expect(parcelas[0]).toMatchObject({ vr_juros: 4.75, vr_desconto: 5, vr_pago: 99.75 });
  });

  it('parcela em dia não tem juros', async () => {
    const { servico, parcelas } = cenario();
    await servico.baixar({ parcelas: [{ codigo: '0411111111112' }] }, usuario);
    expect(parcelas[1]).toMatchObject({ vr_juros: null, vr_pago: 100 });
  });

  it('sem formas informadas registra tudo em dinheiro', async () => {
    const { servico, gravados } = cenario(null);
    const resultado = await servico.baixar({ parcelas: [{ codigo: '0411111111111' }] }, usuario);
    expect(resultado.pagamentos).toEqual({ dinheiro: 100, pix: 0, cartao: 0 });
    expect(gravados[0].parametros.slice(5, 9)).toEqual([100, 100, 0, 0]);
  });

  it('recusa pagamentos que não fecham o total, formas repetidas e dinheiro recebido a menos', async () => {
    const servico = () => cenario().servico;
    await expect(
      servico().baixar({ parcelas: [{ codigo: '0411111111112' }], pagamentos: [{ forma: FormaRecebimentoCarne.PIX, valor: 90 }] }, usuario),
    ).rejects.toThrow(/deve ser igual ao total a receber \(R\$ 100.00\)/);
    await expect(
      servico().baixar(
        {
          parcelas: [{ codigo: '0411111111112' }],
          pagamentos: [
            { forma: FormaRecebimentoCarne.PIX, valor: 50 },
            { forma: FormaRecebimentoCarne.PIX, valor: 50 },
          ],
        },
        usuario,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      servico().baixar(
        { parcelas: [{ codigo: '0411111111112' }], pagamentos: [{ forma: FormaRecebimentoCarne.DINHEIRO, valor: 100 }], valorRecebidoDinheiro: 80 },
        usuario,
      ),
    ).rejects.toThrow(/menor que a parte paga em dinheiro/);
  });

  it('simula os encargos sem gravar nada', async () => {
    const { servico, parcelas } = cenario();
    const simulacao = await servico.simular({ codigos: ['0411111111111', '0411111111112'], dataPagamento: '2026-11-04' });
    expect(simulacao.parcelas.map((p) => [p.diasAtraso, p.juros, p.multa, p.total])).toEqual([
      [10, 3.5, 1.25, 104.75],
      [0, 0, 0, 100],
    ]);
    expect(simulacao.total).toBe(204.75);
    expect(parcelas.every((p) => p.efetuado === 'N')).toBe(true);
  });
});
