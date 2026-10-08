import type { AdminProduct, Coupon, Order, UserState } from '@cart/contracts';

export interface StoredUser extends UserState {
  cartLines: { productId: string; quantity: number }[];
  couponCode: string | null;
}
export interface StoredOrder { ownerId: string; sequence: number; snapshot: Order }
export interface StoreState {
  users: StoredUser[];
  products: AdminProduct[];
  coupons: Coupon[];
  orders: StoredOrder[];
  orderSequence: number;
}
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

/** All reads and writes share FIFO dispatch order. Callbacks see one consistent unit of work.
 * Transactions commit all state only on success; any thrown/rejected error rolls everything back.
 * Reads/results must be detached, never expose stored references. No nested adapter calls inside callbacks.
 * A replacement DB adapter loads these records on one transaction connection and persists the delta atomically.
 */
export interface PersistenceAdapter {
  read<T>(work: (state: DeepReadonly<StoreState>) => T | Promise<T>): Promise<T>;
  transaction<T>(work: (state: StoreState) => T | Promise<T>): Promise<T>;
}

// Fixed local fixture UUIDs are DESIGN; SRS specifies usernames/roles/tiers, not IDs.
export function createSeedState(): StoreState {
  return {
    users: [
      { userId: '00000000-0000-4000-8000-000000000001', username: 'cus_normal', role: 'Customer', memberTier: 'normal', stage: 'cart', currentOrderId: null, cartLines: [], couponCode: null },
      { userId: '00000000-0000-4000-8000-000000000002', username: 'cus_prime', role: 'Customer', memberTier: 'prime', stage: 'cart', currentOrderId: null, cartLines: [], couponCode: null },
      { userId: '00000000-0000-4000-8000-000000000003', username: 'admin01', role: 'Admin', memberTier: null, stage: null, currentOrderId: null, cartLines: [], couponCode: null },
    ],
    products: [
      { productId: 'P1', name: 'Coffee Beans 250g', price: 450, weightGram: 300, availableStock: 20, status: 'onSale' },
      { productId: 'P2', name: 'Drip Kettle', price: 1200, weightGram: 900, availableStock: 3, status: 'onSale' },
      { productId: 'P3', name: 'Espresso Machine', price: 15000, weightGram: 8000, availableStock: 5, status: 'onSale' },
    ],
    coupons: [{ code: 'SAVE10', percent: 10, minSpend: 1000, status: 'active' }],
    orders: [], orderSequence: 0,
  };
}

/** Development/test mock only: volatile, single-process, no real DB/auth/RLS guarantees. */
export function createMemoryPersistence(seed: StoreState = createSeedState()): PersistenceAdapter {
  let state = structuredClone(seed);
  let tail: Promise<unknown> = Promise.resolve();
  function enqueue<T>(work: (draft: StoreState) => T | Promise<T>, commit: boolean): Promise<T> {
    const result = tail.then(async () => {
      const draft = structuredClone(state);
      const output = structuredClone(await work(draft));
      if (commit) state = structuredClone(draft);
      return output;
    });
    tail = result.then(() => undefined, () => undefined);
    return result;
  }
  return {
    read: work => enqueue(work, false),
    transaction: work => enqueue(work, true),
  };
}
