import { EtiquetasService } from './etiquetas.service.js';
import { CAMPOS_PADRAO, CONFIG_PADRAO, montarModelos } from './modelos.js';

function servico(respostas: (sql: string, parametros?: unknown[]) => unknown) {
  return new EtiquetasService({ query: async (sql: string, parametros?: unknown[]) => respostas(sql, parametros) } as never);
}

describe('modelos de etiqueta', () => {
  it('monta a geometria do sistema antigo', () => {
    const [simples, duplo] = montarModelos(CONFIG_PADRAO, CAMPOS_PADRAO);
    expect(simples).toMatchObject({ id: 1, colunas: 6, linhas: 13, porFolha: 78, larguraEtiqueta: 3.333, alturaEtiqueta: 2.1 });
    expect(simples.pagina).toEqual({ largura: 21, altura: 29.7 });
    expect(simples.campos.map((c) => [c.conteudo, c.usar])).toEqual([
      ['produto', false],
      ['codigoBarras', false],
      ['precoVarejo', true],
      ['precoAtacado', true],
      ['informacoes', false],
      ['empresa', true],
    ]);
    expect(duplo).toMatchObject({ id: 2, colunas: 4, linhas: 4, porFolha: 16, larguraEtiqueta: 4.447, espacoColunas: 0.2 });
    expect(duplo.campos.filter((c) => c.conteudo === 'codigoBarras').map((c) => c.ordem)).toEqual([1, 2]);
  });

  it('usa a configuração gravada na empresa e ignora a etiqueta de mala-direta', async () => {
    const etiquetas = servico((sql) => {
      if (sql.includes('FROM eti_config_campo'))
        return [
          ...CAMPOS_PADRAO,
          { id: 22, nome_demonstrativo: 'CODIGO DE BARRA ( DO CLIENTE )', id_etiqueta: 3, id_class: 2, usar: 0, top_e: 1.5, left_e: 3.9, width_e: 2.8, height_e: 0.8, font_size_e: 8 },
        ];
      if (sql.includes('FROM eti_config')) return [{ ...CONFIG_PADRAO[0], qtd_colunas: '5' }, CONFIG_PADRAO[1], { ...CONFIG_PADRAO[0], id: 3 }];
      if (sql.includes('FROM cad_empresa')) return [{ nome_empresa: ' ATRATIVA SHORE ' }];
      throw new Error(sql);
    });
    const resultado = await etiquetas.modelos();
    expect(resultado.origem).toBe('empresa');
    expect(resultado.empresa).toBe('ATRATIVA SHORE');
    expect(resultado.modelos.map((m) => [m.id, m.colunas])).toEqual([
      [1, 5],
      [2, 4],
    ]);
  });

  it('cai no padrão do sistema antigo quando a empresa não tem as tabelas', async () => {
    const etiquetas = servico((sql) => {
      if (sql.includes('eti_config')) throw Object.assign(new Error('não existe'), { code: 'ER_NO_SUCH_TABLE' });
      return [];
    });
    const resultado = await etiquetas.modelos();
    expect(resultado).toMatchObject({ origem: 'padrao', empresa: null });
    expect(resultado.modelos).toHaveLength(2);
  });

  it('devolve os produtos na ordem pedida, com o código cadastrado, e lista os inexistentes', async () => {
    let recebidos: unknown[] = [];
    const etiquetas = servico((sql, parametros) => {
      recebidos = parametros ?? [];
      expect(sql).toContain('IN (?, ?, ?)');
      return [
        { id: 7, nome_produto: 'FRONHA IBI', cod_barra: '2000000000077', inf_adicional: '', nome_tipo: 'CAMA', nome_fornecedor: null },
        { id: 3, nome_produto: 'TOALHA', cod_barra: null, inf_adicional: 'AZUL', nome_tipo: null, nome_fornecedor: 'IBI' },
      ];
    });
    const resultado = await etiquetas.produtos({ ids: [3, 7, 9, 3] });
    expect(recebidos).toEqual([3, 7, 9]);
    expect(resultado.produtos).toEqual([
      { id: 3, nome: 'TOALHA', codigoBarras: null, informacoes: 'AZUL', tipo: null, fornecedor: 'IBI' },
      { id: 7, nome: 'FRONHA IBI', codigoBarras: '2000000000077', informacoes: null, tipo: 'CAMA', fornecedor: null },
    ]);
    expect(resultado.naoEncontrados).toEqual([9]);
  });
});
