import { ButtonAction } from '../../common/interfaces';

export const INVENTORY_SLOTS = 8;

export interface InventorySlot {
	action?: ButtonAction;
}

export function createDefaultInventorySlots(): InventorySlot[] {
	return Array.from({ length: INVENTORY_SLOTS }, () => ({ action: undefined }));
}
