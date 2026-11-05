import { CaixaService } from './caixa.service.js';

function servico(comTabela: boolean) {
  const consultas: string[] = [];
  const fonte = {
    query: async (sql: string) => {
      consultas.push(sql);
      if (sql.includes("TABLE_NAME = 'api_recebimentos_carne'")) return comTabela ? [{ 1: 1 }] : [];
      if (sql.includes('FROM mv_vendas\n') || sql.includes('SUM(vr_dinheiro)')) {
        return [{ quantidade: 3, dinheiro: '100.00', pix: '50.00', cartao: '30.00', carne: '200.00', outros: 0, descontos: '2.00' }];
      }
      if (sql.includes('COUNT(*) AS quantidade, SUM(m.vr_total)')) {
        return comTabela
          ? [{ quantidade: 3, total: '150.00', dinheiro: '40.00', pix: '70.00', cartao: '40.00' }]
          : [{ quantidade: 3, total: '150.00', dinheiro: '150.00', pix: 0, cartao: 0 }];
      }
      if (sql.includes('FROM mv_vendas v')) return [];
      if (sql.includes('SELECT m.controle')) {
        return comTabela
          ? [
              { controle: '20261104100000', data_venda: '2026-11-04', vr_total: '70.00', vr_dinheiro: '0.00', vr_pix: '70.00', vr_cartao: '0.00' },
              { controle: '20261104090000', data_venda: '2026-11-04', vr_total: '40.00', vr_dinheiro: null, vr_pix: null, vr_cartao: null },
            ]
          : [];
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
  };
  const caixa = new CaixaService(fonte as never, { pdv: { terminal: '02' }, fusoHorario: 'America/Sao_Paulo' } as never);
  return { caixa, consultas };
}

const aberto = {
  id: 1,
  terminal: '02',
  turno: '1',
  aberto: true,
  idLogin: 1,
  abertura: { data: '2026-11-04', hora: '08:00:00', valor: 100 },
  fechamento: { data: null, hora: null, valor: null },
};

describe('resumo do caixa com recebimentos de carnê por forma', () => {
  it('soma cada recebimento na sua forma e só o dinheiro entra na gaveta', async () => {
    const { caixa } = servico(true);
    const resumo = await caixa.resumo(aberto);
    expect(resumo.vendas).toMatchObject({ dinheiro: 100, pix: 50, cartao: 30, carne: 200 });
    expect(resumo.recebimentosCarne).toEqual({ quantidade: 3, total: 150, dinheiro: 40, pix: 70, cartao: 40 });
    expect(resumo.entradas).toEqual({ dinheiro: 140, pix: 120, cartao: 70, outros: 0, total: 330 });
    expect(resumo.totalRecebido).toBe(330);
    expect(resumo.dinheiroEsperadoNaGaveta).toBe(240);
    expect(resumo.movimentos.map((m) => m.descricao)).toEqual(['Recebimento de carnê (Pix)', 'Recebimento de carnê (dinheiro)']);
  });

  it('sem a tabela nova trata todos os recebimentos como dinheiro, como antes', async () => {
    const { caixa, consultas } = servico(false);
    const resumo = await caixa.resumo(aberto);
    expect(consultas.some((sql) => sql.includes('api_recebimentos_carne r'))).toBe(false);
    expect(resumo.entradas.dinheiro).toBe(250);
    expect(resumo.dinheiroEsperadoNaGaveta).toBe(350);
  });
});
