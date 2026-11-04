import { FechamentoCaixa } from '../caixa/entities/fechamento-caixa.entity.js';
import { ClienteObservacao } from '../clientes/entities/cliente-observacao.entity.js';
import { Cliente } from '../clientes/entities/cliente.entity.js';
import { Empresa } from '../empresa/entities/empresa.entity.js';
import { EstoqueHistorico } from '../estoque/entities/estoque-historico.entity.js';
import { Estoque } from '../estoque/entities/estoque.entity.js';
import { Financeiro } from '../financeiro/entities/financeiro.entity.js';
import { Fornecedor } from '../fornecedores/entities/fornecedor.entity.js';
import { ProdutoTipo } from '../produtos/entities/produto-tipo.entity.js';
import { Produto } from '../produtos/entities/produto.entity.js';
import { Credencial } from '../usuarios/entities/credencial.entity.js';
import { Perfil } from '../usuarios/entities/perfil.entity.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { VendaItem } from '../vendas/entities/venda-item.entity.js';
import { Venda } from '../vendas/entities/venda.entity.js';

export const ENTIDADES = [
  Empresa,
  Usuario,
  Perfil,
  Credencial,
  Cliente,
  ClienteObservacao,
  Fornecedor,
  Produto,
  ProdutoTipo,
  Estoque,
  EstoqueHistorico,
  Venda,
  VendaItem,
  Financeiro,
  FechamentoCaixa,
];
