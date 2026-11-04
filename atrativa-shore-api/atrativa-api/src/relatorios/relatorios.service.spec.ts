import { BadRequestException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { ConfiguracaoService } from '../config/configuracao.service.js';
import type { ProdutosService } from '../produtos/produtos.service.js';
import type { VendasService } from '../vendas/vendas.service.js';
import { RelatoriosService } from './relatorios.service.js';

function montar(responder: (sql: string, parametros: unknown[]) => unknown) {
  const consultas: Array<{ sql: string; parametros: unknown[] }> = [];
  const fonte = {
    query: async (sql: string, parametros: unknown[] = []) => {
      consultas.push({ sql, parametros });
      return responder(sql, parametros);
    },
  } as unknown as DataSource;
  const config = { fusoHorario: 'America/Sao_Paulo' } as unknown as ConfiguracaoService;
  const produtos = {
    estoqueBaixo: async () => ({ data: [], meta: { page: 1, limit: 1, total: 7, totalPages: 7 } }),
  } as unknown as ProdutosService;
  const servico = new RelatoriosService(fonte, config, {} as VendasService, produtos);
  return { servico, consultas };
}

describe('RelatoriosService', () => {
  it('usa o mês corrente quando o período não é informado e valida datas', () => {
    const { servico } = montar(() => []);
    const periodo = servico.resolverPeriodo({});
    expect(periodo.inicio).toMatch(/^\d{4}-\d{2}-01$/);
    expect(periodo.fim >= periodo.inicio).toBe(true);
    expect(() => servico.resolverPeriodo({ inicio: '2026-11-10', fim: '2026-11-01' })).toThrow(BadRequestException);
    expect(() => servico.resolverPeriodo({ inicio: '2026-02-30' })).toThrow(BadRequestException);
  });

  it('monta os indicadores do dashboard a partir de consultas agregadas', async () => {
    const { servico, consultas } = montar((sql, parametros) => {
      if (sql.includes('FROM mv_vendas v')) {
        const atual = parametros[0] === '2026-11-01';
        return [
          atual
            ? { quantidade: 4, faturamento: 300, descontos: 10, dinheiro: 100, pix: 50, cartao: 50, carne: 100, outros: 0, clientes: 3 }
            : { quantidade: 2, faturamento: 200 },
        ];
      }
      if (sql.includes('SUM(m.quant)')) return [{ quantidade: 9 }];
      if (sql.includes('SUM(m.vr_total)')) return [{ quantidade: 2, total: 80 }];
      if (sql.includes('FROM mv_financeiro')) return [{ parcelas: 5, total: 250, parcelas_vencidas: 1, total_vencido: 50 }];
      throw new Error(`SQL inesperado: ${sql}`);
    });

    const resultado = await servico.dashboard({ inicio: '2026-11-01', fim: '2026-11-04' });

    expect(resultado).toMatchObject({
      faturamento: 300,
      quantidadeVendas: 4,
      ticketMedio: 75,
      itensVendidos: 9,
      clientesAtendidos: 3,
      recebimentosCarne: { quantidade: 2, total: 80 },
      carneEmAberto: { parcelas: 5, total: 250, parcelasVencidas: 1, totalVencido: 50 },
      produtosEstoqueBaixo: 7,
      comparativo: {
        periodoAnterior: { inicio: '2026-10-28', fim: '2026-10-31' },
        faturamentoAnterior: 200,
        variacaoFaturamentoPercentual: 50,
        variacaoQuantidadePercentual: 100,
      },
    });
    expect(consultas.filter((c) => c.sql.includes('FROM mv_vendas v')).every((c) => c.sql.includes('v.estornado = 0'))).toBe(
      true,
    );
  });
});
