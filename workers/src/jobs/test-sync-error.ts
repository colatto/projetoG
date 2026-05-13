import { getSupabase } from '../supabase.js';
import { getSiengeClient } from '../sienge.js';
import { OrderClient, mapOrderToLocal } from '@projetog/integration-sienge';

async function run() {
  const supabase = getSupabase();
  const siengeClient = await getSiengeClient(supabase);
  const orderClient = new OrderClient(siengeClient);

  const page = await orderClient.listPaged({ limit: 1 });
  const order = page.results?.[0];
  if (!order) {
    console.log('No orders found');
    return;
  }

  console.log('Found order:', order.purchaseOrderId, 'supplierId:', order.supplierId);
  const localOrder = mapOrderToLocal(order);

  const { error } = await supabase.from('purchase_orders').upsert({
    id: localOrder.id,
    formatted_purchase_order_id: localOrder.formattedPurchaseOrderId,
    supplier_id: localOrder.supplierId,
    buyer_id: localOrder.buyerId,
    building_id: localOrder.buildingId,
    sienge_status: localOrder.siengeStatus,
    local_status: localOrder.localStatus,
    authorized: localOrder.authorized,
    disapproved: localOrder.disapproved,
    delivery_late: localOrder.deliveryLate,
    consistent: localOrder.consistent,
    date: localOrder.date,
  });

  console.log('Upsert result error:', error);
}

run();
