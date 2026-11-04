import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado.js';
import type { ConfiguracaoService } from '../config/configuracao.service.js';
import { FormaPagamento, MODO_ESTOQUE, MODO_VENDA } from '../common/constantes/legado.js';
import type { VerificacaoBancoService } from '../database/verificacao-banco.service.js';
import type { EmpresaService } from '../empresa/empresa.service.js';
import type { RegistrarVendaDto } from './dto/venda.dto.js';
import { VendasService } from './vendas.service.js';

class BancoFalso {
  produtos = new Map<number, Record<string, unknown>>();
  saldos = new Map<number, number>();
  confirmadas: Array<{ entidade: string; dados: unknown }> = [];
  commits = 0;
  rollbacks = 0;
  caixaAberto = true;
  roubarEstoqueAntesDaBaixa: number | null = null;
  cliente = { limite_carne: null as string | null, faixasalarial: '2000.00' as string | null };
  carneEmAberto = 0;

  fonte(): DataSource {
    return {
      query: async (sql: string) => (sql.includes('FROM mv_fechamento') && this.caixaAberto ? [{ id: 1 }] : []),
      transaction: async (_isolamento: string, callback: (manager: unknown) => Promise<unknown>) => {
        const rascunho: Array<{ entidade: string; dados: unknown }> = [];
        const saldosAntes = new Map(this.saldos);
        try {
          const resultado = await callback(this.manager(rascunho));
          this.confirmadas.push(...rascunho);
          this.commits += 1;
          return resultado;
        } catch (erro) {
          this.saldos = saldosAntes;
          this.rollbacks += 1;
          throw erro;
        }
      },
    } as unknown as DataSource;
  }

  private manager(rascunho: Array<{ entidade: string; dados: unknown }>) {
    return {
      find: async (_entidade: unknown, opcoes: { where: { id: { value: number[] } } }) => {
        const ids = opcoes.where.id.value;
        return ids.filter((id) => this.produtos.has(id)).map((id) => this.produtos.get(id));
      },
      insert: async (entidade: { name: string }, dados: unknown) => {
        rascunho.push({ entidade: entidade.name, dados });
        return { identifiers: [{ id: 1 }] };
      },
      query: async (sql: string, parametros: unknown[] = []) => {
        if (sql.startsWith('SELECT nome_cliente')) return [{ nome_cliente: 'MARIA TESTE' }];
        if (sql.startsWith('SELECT limite_carne')) return [this.cliente];
        if (sql.includes('SUM(vr_parcela)')) {
          if (!sql.includes('FOR UPDATE')) throw new Error('limite do carnê deve travar as parcelas');
          return [{ total: this.carneEmAberto }];
        }
        if (sql.includes('FROM mv_estoque WHERE id_produto IN')) {
          const ids = parametros[0] as number[];
          return ids.filter((id) => this.saldos.has(id)).map((id) => ({ id_produto: id, quantidade: this.saldos.get(id) }));
        }
        if (sql.startsWith('SELECT 1 FROM mv_vendas')) return [];
        if (sql.includes('SET quantidade = ROUND(quantidade - ?')) {
          const [quantidade, idProduto] = parametros as [number, number];
          if (this.roubarEstoqueAntesDaBaixa !== null) this.saldos.set(idProduto, this.roubarEstoqueAntesDaBaixa);
          const atual = this.saldos.get(idProduto) ?? 0;
          if (atual + 0.0005 < quantidade) return { affectedRows: 0 };
          this.saldos.set(idProduto, atual - quantidade);
          return { affectedRows: 1 };
        }
        if (sql.includes('COALESCE(quantidade, 0) + ?')) {
          const [quantidade, idProduto] = parametros as [number, number];
          if (!this.saldos.has(idProduto)) return { affectedRows: 0 };
          this.saldos.set(idProduto, (this.saldos.get(idProduto) ?? 0) + quantidade);
          return { affectedRows: 1 };
        }
        throw new Error(`SQL não previsto no teste: ${sql}`);
      },
    };
  }

  gravadas(entidade: string) {
    return this.confirmadas.filter((gravacao) => gravacao.entidade === entidade).map((gravacao) => gravacao.dados);
  }
}

const usuario: UsuarioAutenticado = {
  id: 10,
  nome: 'Administrador',
  email: null,
  login: 'ATRATIVA',
  papel: 'COMPANY_ADMIN',
  idCargo: null,
  cargo: null,
  permissoes: [],
  idEmpresa: 1,
  empresa: { id: 1, nome: 'Loja', status: 'ACTIVE', banco: 'Atrativa' },
  idLogin: 1,
  trocarSenha: false,
  administrador: true,
};

function montar(banco: BancoFalso, transacoesOk = true) {
  const config = {
    pdv: { terminal: '02', turno: '1', exigirCaixaAberto: true },
    fusoHorario: 'America/Sao_Paulo',
    valores: { carneMaxParcelas: 12, carneLimite: { percentualRenda: 50, limitePadrao: 300 } },
  } as unknown as ConfiguracaoService;
  const empresa = { obter: async () => ({ maxDesconto: null }) } as unknown as EmpresaService;
  const verificacao = {
    garantirTransacoes: async () => {
      if (!transacoesOk) throw new ServiceUnavailableException('MyISAM');
    },
  } as unknown as VerificacaoBancoService;
  const servico = new VendasService(banco.fonte(), config, empresa, verificacao);
  vi.spyOn(servico, 'obterPorControle').mockImplementation(async (controle) => ({ controle }) as never);
  return servico;
}

function produto(id: number, nome: string, precoPrazo: number, precoVista: number, modoEstoque: number = MODO_ESTOQUE.CONTROLA) {
  return { id, nome, precoPrazo, precoVista, valorCompra: 10, modoEstoque };
}

describe('VendasService.registrar', () => {
  let banco: BancoFalso;

  beforeEach(() => {
    banco = new BancoFalso();
    banco.produtos.set(10, produto(10, 'TOALHA BANHO 29,99', 35, 29.99));
    banco.produtos.set(20, produto(20, 'FRONHA 14,99', 18, 14.99));
    banco.produtos.set(2, produto(2, 'RECEBIMENTO DE CARNÊ', 0, 0, MODO_ESTOQUE.SERVICO));
    banco.saldos.set(10, 5);
    banco.saldos.set(20, 1);
  });

  it('grava venda, itens e financeiro e baixa o estoque usando o preço a prazo como sugestão', async () => {
    const servico = montar(banco);
    const dto: RegistrarVendaDto = {
      itens: [{ idProduto: 10, quantidade: 2 }],
      pagamentos: [{ forma: FormaPagamento.DINHEIRO, valor: 70 }],
    };
    await servico.registrar(dto, usuario);

    expect(banco.commits).toBe(1);
    expect(banco.saldos.get(10)).toBe(3);
    const [venda] = banco.gravadas('Venda') as Array<Record<string, unknown>>;
    expect(venda).toMatchObject({ valorTotal: 70, valorDinheiro: 70, valorPix: 0, terminal: '02', parcelas: 1, idCliente: 0 });
    const [itens] = banco.gravadas('VendaItem') as Array<Array<Record<string, unknown>>>;
    expect(itens[0]).toMatchObject({ idProduto: 10, quantidade: 2, valorUnitario: 35, valorTotal: 70, modoVenda: MODO_VENDA.PRODUTO });
    const [lancamentos] = banco.gravadas('Financeiro') as Array<Array<Record<string, unknown>>>;
    expect(lancamentos).toHaveLength(1);
    expect(lancamentos[0]).toMatchObject({ origem: 'V', idPlano: 1, efetuado: 'S', valorParcela: 70 });
  });

  it('usa o preço editado pelo vendedor e ignora qualquer total vindo do frontend', async () => {
    const servico = montar(banco);
    await servico.registrar(
      {
        itens: [{ idProduto: 10, quantidade: 1, precoUnitario: 29.99 }],
        pagamentos: [{ forma: FormaPagamento.PIX, valor: 29.99 }],
      },
      usuario,
    );
    const [venda] = banco.gravadas('Venda') as Array<Record<string, unknown>>;
    expect(venda).toMatchObject({ valorTotal: 29.99, valorPix: 29.99 });
  });

  it('recusa com 409 e não grava nada quando o estoque é insuficiente', async () => {
    const servico = montar(banco);
    await expect(
      servico.registrar(
        {
          itens: [
            { idProduto: 10, quantidade: 1 },
            { idProduto: 20, quantidade: 2 },
          ],
          pagamentos: [{ forma: FormaPagamento.DINHEIRO, valor: 71 }],
        },
        usuario,
      ),
    ).rejects.toThrow(ConflictException);
    expect(banco.rollbacks).toBe(1);
    expect(banco.commits).toBe(0);
    expect(banco.confirmadas).toHaveLength(0);
    expect(banco.saldos.get(10)).toBe(5);
    expect(banco.saldos.get(20)).toBe(1);
  });

  it('soma linhas repetidas do mesmo produto antes de conferir o estoque', async () => {
    const servico = montar(banco);
    await expect(
      servico.registrar(
        {
          itens: [
            { idProduto: 20, quantidade: 1 },
            { idProduto: 20, quantidade: 1 },
          ],
          pagamentos: [{ forma: FormaPagamento.DINHEIRO, valor: 36 }],
        },
        usuario,
      ),
    ).rejects.toThrow(/Estoque insuficiente/);
  });

  it('desfaz tudo (rollback) se outro terminal vender o produto no meio da transação', async () => {
    const servico = montar(banco);
    banco.roubarEstoqueAntesDaBaixa = 0;
    await expect(
      servico.registrar(
        { itens: [{ idProduto: 10, quantidade: 2 }], pagamentos: [{ forma: FormaPagamento.DINHEIRO, valor: 70 }] },
        usuario,
      ),
    ).rejects.toThrow(ConflictException);
    expect(banco.rollbacks).toBe(1);
    expect(banco.confirmadas).toHaveLength(0);
    expect(banco.saldos.get(10)).toBe(5);
  });

  it('nunca deixa o estoque negativo', async () => {
    const servico = montar(banco);
    await servico.registrar(
      { itens: [{ idProduto: 20, quantidade: 1 }], pagamentos: [{ forma: FormaPagamento.CARTAO, valor: 18 }] },
      usuario,
    );
    await expect(
      servico.registrar(
        { itens: [{ idProduto: 20, quantidade: 1 }], pagamentos: [{ forma: FormaPagamento.CARTAO, valor: 18 }] },
        usuario,
      ),
    ).rejects.toThrow(ConflictException);
    expect(banco.saldos.get(20)).toBe(0);
  });

  it('cartão não gera lançamento financeiro (igual ao desktop)', async () => {
    const servico = montar(banco);
    await servico.registrar(
      { itens: [{ idProduto: 20, quantidade: 1 }], pagamentos: [{ forma: FormaPagamento.CARTAO, valor: 18 }] },
      usuario,
    );
    expect(banco.gravadas('Financeiro')).toHaveLength(0);
    const [venda] = banco.gravadas('Venda') as Array<Record<string, unknown>>;
    expect(venda.parcelas).toBe(0);
  });

  it('venda no carnê gera uma parcela por mês com código EAN-13', async () => {
    const servico = montar(banco);
    await servico.registrar(
      {
        idCliente: 175,
        itens: [{ idProduto: 10, quantidade: 1, precoUnitario: 119 }],
        pagamentos: [{ forma: FormaPagamento.CARNE, valor: 119 }],
        parcelasCarne: 3,
      },
      usuario,
    );
    const [lancamentos] = banco.gravadas('Financeiro') as Array<Array<Record<string, unknown>>>;
    expect(lancamentos.map((l) => l.valorParcela)).toEqual([39.67, 39.67, 39.66]);
    expect(lancamentos.every((l) => l.origem === 'C' && l.efetuado === 'N' && l.idPlano === 5)).toBe(true);
    expect(lancamentos.every((l) => /^\d{13}$/.test(String(l.codigoCarne)))).toBe(true);
    const [venda] = banco.gravadas('Venda') as Array<Record<string, unknown>>;
    expect(venda).toMatchObject({ valorCarne: 119, parcelas: 3, idCliente: 175 });
  });

  describe('limite do carnê', () => {
    const vendaCarne = (valor: number) => ({
      idCliente: 175,
      itens: [{ idProduto: 10, quantidade: 1, precoUnitario: valor }],
      pagamentos: [{ forma: FormaPagamento.CARNE, valor }],
      parcelasCarne: 2,
    });

    it('aceita até o disponível (50% da renda menos as parcelas em aberto)', async () => {
      banco.carneEmAberto = 700;
      await montar(banco).registrar(vendaCarne(300), usuario);
      expect(banco.commits).toBe(1);
    });

    it('recusa com 409 e não grava nada acima do disponível', async () => {
      banco.carneEmAberto = 700;
      await expect(montar(banco).registrar(vendaCarne(300.01), usuario)).rejects.toThrow(/Limite do carnê/);
      expect(banco.confirmadas).toHaveLength(0);
      expect(banco.saldos.get(10)).toBe(5);
    });

    it('parcelas pagas liberam o limite', async () => {
      banco.carneEmAberto = 1000;
      await expect(montar(banco).registrar(vendaCarne(100), usuario)).rejects.toBeInstanceOf(ConflictException);
      banco.carneEmAberto = 900;
      await montar(banco).registrar(vendaCarne(100), usuario);
      expect(banco.commits).toBe(1);
    });

    it('sem renda usa o limite padrão; limite manual tem prioridade', async () => {
      banco.cliente = { limite_carne: null, faixasalarial: null };
      await expect(montar(banco).registrar(vendaCarne(300.01), usuario)).rejects.toBeInstanceOf(ConflictException);
      banco.cliente = { limite_carne: '5000.00', faixasalarial: null };
      await montar(banco).registrar(vendaCarne(3000), usuario);
      expect(banco.commits).toBe(1);
    });

    it('a parte paga em dinheiro não conta para o limite', async () => {
      banco.carneEmAberto = 900;
      await montar(banco).registrar(
        { ...vendaCarne(119), pagamentos: [{ forma: FormaPagamento.DINHEIRO, valor: 19 }, { forma: FormaPagamento.CARNE, valor: 100 }] },
        usuario,
      );
      expect(banco.commits).toBe(1);
    });
  });

  it('troca devolve o item ao estoque e abate o valor', async () => {
    const servico = montar(banco);
    await servico.registrar(
      {
        idCliente: 175,
        itens: [{ idProduto: 10, quantidade: 1 }],
        itensTroca: [{ idProduto: 20, quantidade: 1 }],
        pagamentos: [{ forma: FormaPagamento.DINHEIRO, valor: 17 }],
      },
      usuario,
    );
    expect(banco.saldos.get(10)).toBe(4);
    expect(banco.saldos.get(20)).toBe(2);
    const [historico] = banco.gravadas('EstoqueHistorico') as Array<Record<string, unknown>>;
    expect(historico).toMatchObject({ idProduto: 20, quantidade: 1 });
    expect(String(historico.numeroNota)).toMatch(/^V\d{11}$/);
  });

  it('exige cliente e número de parcelas no carnê', async () => {
    const servico = montar(banco);
    await expect(
      servico.registrar(
        { itens: [{ idProduto: 10, quantidade: 1 }], pagamentos: [{ forma: FormaPagamento.CARNE, valor: 35 }], parcelasCarne: 2 },
        usuario,
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      servico.registrar(
        { idCliente: 1, itens: [{ idProduto: 10, quantidade: 1 }], pagamentos: [{ forma: FormaPagamento.CARNE, valor: 35 }] },
        usuario,
      ),
    ).rejects.toThrow(/parcelasCarne/);
  });

  it('converte erro de cálculo em 400 (pagamento diferente do total)', async () => {
    const servico = montar(banco);
    await expect(
      servico.registrar(
        { itens: [{ idProduto: 10, quantidade: 1 }], pagamentos: [{ forma: FormaPagamento.DINHEIRO, valor: 10 }] },
        usuario,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(banco.confirmadas).toHaveLength(0);
  });

  it('não vende item de serviço (recebimento de carnê) nem produto inexistente', async () => {
    const servico = montar(banco);
    await expect(
      servico.registrar(
        { itens: [{ idProduto: 2, quantidade: 1, precoUnitario: 10 }], pagamentos: [{ forma: FormaPagamento.DINHEIRO, valor: 10 }] },
        usuario,
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      servico.registrar(
        { itens: [{ idProduto: 999, quantidade: 1 }], pagamentos: [{ forma: FormaPagamento.DINHEIRO, valor: 10 }] },
        usuario,
      ),
    ).rejects.toThrow(/não encontrado/);
  });

  it('exige caixa aberto', async () => {
    banco.caixaAberto = false;
    const servico = montar(banco);
    await expect(
      servico.registrar(
        { itens: [{ idProduto: 10, quantidade: 1 }], pagamentos: [{ forma: FormaPagamento.DINHEIRO, valor: 35 }] },
        usuario,
      ),
    ).rejects.toThrow(/Abra o caixa/);
  });

  it('bloqueia a venda se as tabelas ainda estiverem em MyISAM (sem transação real)', async () => {
    const servico = montar(banco, false);
    await expect(
      servico.registrar(
        { itens: [{ idProduto: 10, quantidade: 1 }], pagamentos: [{ forma: FormaPagamento.DINHEIRO, valor: 35 }] },
        usuario,
      ),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(banco.commits + banco.rollbacks).toBe(0);
  });
});
