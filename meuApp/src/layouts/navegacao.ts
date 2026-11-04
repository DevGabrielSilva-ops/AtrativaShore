import type { IconType } from 'react-icons';
import {
  IoBarChartOutline,
  IoBusinessOutline,
  IoCartOutline,
  IoCashOutline,
  IoCubeOutline,
  IoDocumentTextOutline,
  IoGridOutline,
  IoLayersOutline,
  IoPeopleOutline,
  IoPersonCircleOutline,
  IoReceiptOutline,
  IoSettingsOutline,
  IoStorefrontOutline,
} from 'react-icons/io5';

export interface ItemMenu {
  caminho: string;
  titulo: string;
  icone: IconType;
  /** Nome do grupo no breadcrumb. */
  grupo: string;
}

export interface GrupoMenu {
  titulo: string;
  itens: ItemMenu[];
}

/** Menu organizado só com módulos que existem no backend. */
export const MENU: GrupoMenu[] = [
  {
    titulo: 'Gerenciamento',
    itens: [
      { caminho: '/', titulo: 'Dashboard', icone: IoGridOutline, grupo: 'Gerenciamento' },
      { caminho: '/empresa', titulo: 'Empresa', icone: IoBusinessOutline, grupo: 'Gerenciamento' },
      { caminho: '/clientes', titulo: 'Clientes', icone: IoPeopleOutline, grupo: 'Gerenciamento' },
      { caminho: '/fornecedores', titulo: 'Fornecedores', icone: IoStorefrontOutline, grupo: 'Gerenciamento' },
    ],
  },
  {
    titulo: 'Operações',
    itens: [
      { caminho: '/vendas/nova', titulo: 'Nova venda', icone: IoCartOutline, grupo: 'Operações' },
      { caminho: '/vendas', titulo: 'Histórico de vendas', icone: IoReceiptOutline, grupo: 'Operações' },
      { caminho: '/caixa', titulo: 'Caixa', icone: IoCashOutline, grupo: 'Operações' },
      { caminho: '/carnes', titulo: 'Carnês', icone: IoDocumentTextOutline, grupo: 'Operações' },
      { caminho: '/produtos', titulo: 'Produtos', icone: IoCubeOutline, grupo: 'Operações' },
      { caminho: '/estoque', titulo: 'Estoque', icone: IoLayersOutline, grupo: 'Operações' },
    ],
  },
  {
    titulo: 'Análises',
    itens: [{ caminho: '/relatorios', titulo: 'Relatórios', icone: IoBarChartOutline, grupo: 'Análises' }],
  },
  {
    titulo: 'Sistema',
    itens: [
      { caminho: '/perfil', titulo: 'Meu perfil', icone: IoPersonCircleOutline, grupo: 'Sistema' },
      { caminho: '/configuracoes', titulo: 'Configurações', icone: IoSettingsOutline, grupo: 'Sistema' },
    ],
  },
];

const TODOS = MENU.flatMap((grupo) => grupo.itens);

/** Item do menu correspondente à rota atual (o mais específico). */
export function itemDaRota(caminho: string): ItemMenu | undefined {
  return [...TODOS]
    .sort((a, b) => b.caminho.length - a.caminho.length)
    .find((item) => (item.caminho === '/' ? caminho === '/' : caminho === item.caminho || caminho.startsWith(`${item.caminho}/`)));
}
