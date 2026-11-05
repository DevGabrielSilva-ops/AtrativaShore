import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { ProdutosEtiquetaDto } from './dto/etiqueta.dto.js';
import {
  CAMPOS_PADRAO,
  CONFIG_PADRAO,
  montarModelos,
  type LinhaCampo,
  type LinhaConfig,
  type ModeloEtiqueta,
} from './modelos.js';

export interface ModelosEtiqueta {
  empresa: string | null;
  origem: 'empresa' | 'padrao';
  modelos: ModeloEtiqueta[];
}

export interface ProdutoEtiqueta {
  id: number;
  nome: string | null;
  codigoBarras: string | null;
  informacoes: string | null;
  tipo: string | null;
  fornecedor: string | null;
}

interface LinhaProdutoEtiqueta {
  id: number | string;
  nome_produto: string | null;
  cod_barra: string | null;
  inf_adicional: string | null;
  nome_tipo: string | null;
  nome_fornecedor: string | null;
}

const texto = (valor: string | null | undefined): string | null => {
  const limpo = (valor ?? '').trim();
  return limpo === '' ? null : limpo;
};

@Injectable()
export class EtiquetasService {
  constructor(private readonly fonte: DataSource) {}

  async modelos(): Promise<ModelosEtiqueta> {
    const [configuracao, empresa] = await Promise.all([this.lerConfiguracao(), this.nomeEmpresa()]);
    const daEmpresa = configuracao ? montarModelos(configuracao.configs, configuracao.campos) : [];
    if (daEmpresa.length) return { empresa, origem: 'empresa', modelos: daEmpresa };
    return { empresa, origem: 'padrao', modelos: montarModelos(CONFIG_PADRAO, CAMPOS_PADRAO) };
  }

  async produtos(dto: ProdutosEtiquetaDto): Promise<{ produtos: ProdutoEtiqueta[]; naoEncontrados: number[] }> {
    const ids = [...new Set(dto.ids)];
    const linhas = (await this.fonte.query(
      `SELECT p.id, p.nome_produto, p.cod_barra, p.inf_adicional, t.nome_tipo, f.nome_fornecedor
         FROM cad_produtos p
         LEFT JOIN cad_produtos_tipo t ON t.id = p.id_tipo
         LEFT JOIN cad_fornecedores f ON f.id = p.id_fornecedor
        WHERE p.id IN (${ids.map(() => '?').join(', ')})`,
      ids,
    )) as LinhaProdutoEtiqueta[];
    const porId = new Map(linhas.map((linha) => [Number(linha.id), linha]));
    const produtos: ProdutoEtiqueta[] = [];
    const naoEncontrados: number[] = [];
    for (const id of ids) {
      const linha = porId.get(id);
      if (!linha) {
        naoEncontrados.push(id);
        continue;
      }
      produtos.push({
        id,
        nome: texto(linha.nome_produto),
        codigoBarras: texto(linha.cod_barra),
        informacoes: texto(linha.inf_adicional),
        tipo: texto(linha.nome_tipo),
        fornecedor: texto(linha.nome_fornecedor),
      });
    }
    return { produtos, naoEncontrados };
  }

  private async lerConfiguracao(): Promise<{ configs: LinhaConfig[]; campos: LinhaCampo[] } | null> {
    try {
      const [configs, campos] = await Promise.all([
        this.fonte.query('SELECT * FROM eti_config ORDER BY id') as Promise<LinhaConfig[]>,
        this.fonte.query('SELECT * FROM eti_config_campo ORDER BY id') as Promise<LinhaCampo[]>,
      ]);
      return { configs, campos };
    } catch (erro) {
      if ((erro as { code?: string }).code === 'ER_NO_SUCH_TABLE') return null;
      throw erro;
    }
  }

  private async nomeEmpresa(): Promise<string | null> {
    const [linha] = (await this.fonte.query('SELECT nome_empresa FROM cad_empresa ORDER BY id LIMIT 1')) as Array<{
      nome_empresa: string | null;
    }>;
    return texto(linha?.nome_empresa);
  }
}
