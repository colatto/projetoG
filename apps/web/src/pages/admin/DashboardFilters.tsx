import React from 'react';

type Props = {
  supplierId?: string;
  setSupplierId?: (value: string) => void;
  buildingId?: string;
  setBuildingId?: (value: string) => void;
  purchaseOrderId?: string;
  setPurchaseOrderId?: (value: string) => void;
  itemIdentifier?: string;
  setItemIdentifier?: (value: string) => void;
};

export function DashboardFilters({
  supplierId,
  setSupplierId,
  buildingId,
  setBuildingId,
  purchaseOrderId,
  setPurchaseOrderId,
  itemIdentifier,
  setItemIdentifier,
}: Props) {
  return (
    <div className="o-filters">
      {typeof supplierId !== 'undefined' && setSupplierId && (
        <div className="form-group">
          <label className="form-label">Fornecedor (ID)</label>
          <input
            className="form-input"
            type="number"
            min={1}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          />
        </div>
      )}
      {typeof buildingId !== 'undefined' && setBuildingId && (
        <div className="form-group">
          <label className="form-label">Obra (ID)</label>
          <input
            className="form-input"
            type="number"
            min={1}
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
          />
        </div>
      )}
      {typeof purchaseOrderId !== 'undefined' && setPurchaseOrderId && (
        <div className="form-group">
          <label className="form-label">Pedido (ID)</label>
          <input
            className="form-input"
            type="number"
            min={1}
            value={purchaseOrderId}
            onChange={(e) => setPurchaseOrderId(e.target.value)}
          />
        </div>
      )}
      {typeof itemIdentifier !== 'undefined' && setItemIdentifier && (
        <div className="form-group">
          <label className="form-label">Item</label>
          <input
            className="form-input"
            value={itemIdentifier}
            onChange={(e) => setItemIdentifier(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
