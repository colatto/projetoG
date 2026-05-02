import { UserRole } from '@projetog/domain';

/** Perfis que podem validar entregas e demais ações operacionais de pedido no backoffice (PRD-01 RN-18). */
export function canOperateOrderDeliveries(role: UserRole | undefined): boolean {
  return role === UserRole.ADMINISTRADOR || role === UserRole.COMPRAS;
}

/** Filtro "Exigem ação" na lista de pedidos — PRD-09 §3 / §7.2 (Visualizador não vê nem envia). */
export function canUseOrdersRequireActionFilter(role: UserRole | undefined): boolean {
  return role === UserRole.ADMINISTRADOR || role === UserRole.COMPRAS;
}
