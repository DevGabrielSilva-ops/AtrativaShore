import type { IconType } from 'react-icons';
import {
  IoArchiveOutline,
  IoBarChartOutline,
  IoBusinessOutline,
  IoCartOutline,
  IoCashOutline,
  IoCubeOutline,
  IoDocumentTextOutline,
  IoGridOutline,
  IoIdCardOutline,
  IoKeyOutline,
  IoLayersOutline,
  IoPeopleCircleOutline,
  IoPeopleOutline,
  IoPersonCircleOutline,
  IoPricetagOutline,
  IoPricetagsOutline,
  IoReceiptOutline,
  IoSettingsOutline,
  IoShieldCheckmarkOutline,
  IoStorefrontOutline,
  IoTimeOutline,
} from 'react-icons/io5';
import type { Permissao } from '../types/api';

export interface ItemMenu {
  caminho: string;
  titulo: string;
  icone: IconType;
  grupo: string;
  permissoes?: Permissao[];
}

export interface GrupoMenu {
  titulo: string;
  itens: ItemMenu[];
}

function grupo(titulo: string, itens: Array<Omit<ItemMenu, 'grupo'>>): GrupoMenu {
  return { titulo, itens: itens.map((item) => ({ ...item, grupo: titulo })) };
}

export const MENU: GrupoMenu[] = [
  grupo('Gerenciamento', [
    { caminho: '/', titulo: 'Dashboard', icone: IoGridOutline, permissoes: ['dashboard.ver'] },
    { caminho: '/empresa', titulo: 'Empresa', icone: IoBusinessOutline },
    { caminho: '/clientes', titulo: 'Clientes', icone: IoPeopleOutline, permissoes: ['clientes.consultar'] },
    { caminho: '/fornecedores', titulo: 'Fornecedores', icone: IoStorefrontOutline, permissoes: ['fornecedores.consultar'] },
    { caminho: '/funcionarios', titulo: 'Funcionários', icone: IoIdCardOutline, permissoes: ['funcionarios.consultar'] },
  ]),
  grupo('Operações', [
    { caminho: '/vendas/nova', titulo: 'Nova venda', icone: IoCartOutline, permissoes: ['vendas.registrar'] },
    { caminho: '/vendas', titulo: 'Histórico de vendas', icone: IoReceiptOutline, permissoes: ['vendas.consultar'] },
    { caminho: '/caixa', titulo: 'Caixa', icone: IoCashOutline, permissoes: ['caixa.operar'] },
    { caminho: '/carnes', titulo: 'Carnês', icone: IoDocumentTextOutline, permissoes: ['carnes.consultar'] },
    { caminho: '/produtos', titulo: 'Produtos', icone: IoCubeOutline, permissoes: ['produtos.consultar'] },
    { caminho: '/estoque', titulo: 'Estoque', icone: IoLayersOutline, permissoes: ['estoque.consultar'] },
    { caminho: '/etiquetas', titulo: 'Maleta de etiquetas', icone: IoPricetagOutline, permissoes: ['produtos.consultar'] },
  ]),
  grupo('Análises', [
    { caminho: '/relatorios', titulo: 'Relatórios', icone: IoBarChartOutline, permissoes: ['relatorios.vendas', 'relatorios.estoque'] },
  ]),
  grupo('Sistema', [
    { caminho: '/atividades', titulo: 'Atividades', icone: IoTimeOutline, permissoes: ['auditoria.consultar'] },
    { caminho: '/perfil', titulo: 'Meu perfil', icone: IoPersonCircleOutline },
    { caminho: '/configuracoes', titulo: 'Configurações', icone: IoSettingsOutline },
  ]),
];

export const MENU_PLATAFORMA: GrupoMenu[] = [
  grupo('Plataforma', [
    { caminho: '/plataforma', titulo: 'Visão geral', icone: IoGridOutline },
    { caminho: '/plataforma/empresas', titulo: 'Empresas', icone: IoBusinessOutline },
    { caminho: '/plataforma/codigos', titulo: 'Códigos de ativação', icone: IoKeyOutline },
    { caminho: '/plataforma/planos', titulo: 'Planos', icone: IoPricetagsOutline },
  ]),
  grupo('Controle', [
    { caminho: '/plataforma/administradores', titulo: 'Administradores', icone: IoShieldCheckmarkOutline },
    { caminho: '/plataforma/auditoria', titulo: 'Auditoria', icone: IoTimeOutline },
    { caminho: '/plataforma/backups', titulo: 'Backups', icone: IoArchiveOutline },
    { caminho: '/plataforma/perfil', titulo: 'Meu perfil', icone: IoPeopleCircleOutline },
  ]),
];

export function itemPermitido(item: ItemMenu, permissoes: Permissao[]): boolean {
  return !item.permissoes || item.permissoes.some((p) => permissoes.includes(p));
}

export function menuDoUsuario(menu: GrupoMenu[], permissoes: Permissao[]): GrupoMenu[] {
  return menu
    .map((g) => ({ ...g, itens: g.itens.filter((item) => itemPermitido(item, permissoes)) }))
    .filter((g) => g.itens.length > 0);
}

export function itemDaRota(caminho: string, menu: GrupoMenu[] = MENU): ItemMenu | undefined {
  const raizes = new Set(['/', '/plataforma']);
  return menu
    .flatMap((g) => g.itens)
    .sort((a, b) => b.caminho.length - a.caminho.length)
    .find((item) =>
      raizes.has(item.caminho) ? caminho === item.caminho : caminho === item.caminho || caminho.startsWith(`${item.caminho}/`),
    );
}
