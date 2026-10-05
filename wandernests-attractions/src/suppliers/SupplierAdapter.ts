import type { Activity, SupplierId, SupplierSearchQuery } from '../types';

/** Every partner integration implements this; the engine never talks HTTP directly. */
export interface SupplierAdapter {
  readonly id: SupplierId;
  search(query: SupplierSearchQuery, signal?: AbortSignal): Promise<Activity[]>;
}

export type SupplierRegistry = Partial<Record<SupplierId, SupplierAdapter>>;

export class SupplierError extends Error {
  constructor(
    readonly supplier: SupplierId,
    message: string,
    readonly status?: number,
  ) {
    super(`[${supplier}] ${message}`);
  }
}
