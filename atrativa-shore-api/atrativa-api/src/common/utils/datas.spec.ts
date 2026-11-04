import {
  adicionarMeses,
  dataIsoValida,
  dataNoFuso,
  gerarControle,
  horaDoControle,
  normalizarDataLegada,
  proximoControle,
  vencimentosCarne,
} from './datas.js';

describe('datas', () => {
  const fuso = 'America/Sao_Paulo';

  it('gera o controle no fuso da loja, não no do servidor', () => {
    const instante = new Date('2026-11-04T02:30:05Z'); // 23:30:05 do dia 03 em São Paulo
    expect(gerarControle(instante, fuso)).toBe('20261103233005');
    expect(dataNoFuso(instante, fuso)).toBe('2026-11-03');
  });

  it('avança o controle em 1 segundo tratando virada de dia e de ano', () => {
    expect(proximoControle('20261104101959')).toBe('20261104102000');
    expect(proximoControle('20261231235959')).toBe('20270101000000');
  });

  it('calcula os vencimentos do carnê como o desktop', () => {
    // Vendas reais: 20/08 → 19/09…19/12 e 21/08 → 20/09…20/11
    expect(vencimentosCarne('2026-08-20', 4)).toEqual(['2026-09-19', '2026-10-19', '2026-11-19', '2026-12-19']);
    expect(vencimentosCarne('2026-08-21', 3)).toEqual(['2026-09-20', '2026-10-20', '2026-11-20']);
    expect(vencimentosCarne('2026-08-20', 2, '2026-09-10')).toEqual(['2026-09-10', '2026-10-10']);
  });

  it('soma meses respeitando o último dia do mês', () => {
    expect(adicionarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(adicionarMeses('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('valida datas e trata a data zerada do legado', () => {
    expect(dataIsoValida('2026-02-30')).toBe(false);
    expect(dataIsoValida('2026-02-28')).toBe(true);
    expect(normalizarDataLegada('0000-00-00')).toBeNull();
    expect(horaDoControle('20260824141339')).toBe('14:13:39');
  });
});
