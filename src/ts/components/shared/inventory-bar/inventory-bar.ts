import { Component, HostBinding, Input } from '@angular/core';
import { PonyTownGame } from '../../../client/game';
import { entityButtonAction } from '../../../client/buttonActions';
import { getEntityTypeName, getEntityType } from '../../../common/entities';
import { isRareHoldType } from '../../../common/rareItems';
import { INVENTORY_SLOTS } from '../inventory-utils';

@Component({
	selector: 'inventory-bar',
	templateUrl: 'inventory-bar.pug',
	styleUrls: ['inventory-bar.scss'],
})
export class InventoryBar {
	@Input() opened = true;
	@Input() selectedSlot = -1;
	@HostBinding('class.inventory-hidden') get isHidden() { return !this.opened; }

	readonly shortcuts = ['1', '2', '3', '4', '5', '6', '7', '8'];
	private readonly specificZoomBySlot: Record<number, string> = {
		0: 'zoom-large',
		1: 'zoom-small',
		2: 'zoom-large',
		3: 'zoom-small',
		4: 'zoom-large',
		5: 'zoom-small',
		6: 'zoom-large',
		7: 'zoom-small',
	};

	constructor(private game: PonyTownGame) {}

	get visibleSlots() {
		const player: any = this.game.player as any;
		const inv: any[] = (player && (player.inventory || (player.options && player.options.inventory))) || [];
		const slots: Array<{ action?: any; count?: number; rare?: boolean }> = [];

		for (let i = 0; i < INVENTORY_SLOTS; i++) {
			const entry = inv[i] || 0;
			let type = 0;
			let count = 0;

			if (entry) {
				if (typeof entry === 'number') {
					type = entry;
					count = 1;
				} else if (typeof entry === 'string') {
					// server may send inventory as entity type names
					const name = entry;
					const tnum = getEntityType(name) || 0;
					slots.push({ action: entityButtonAction(name), count: 1, rare: isRareHoldType(tnum) });
					continue;
				} else if (typeof entry === 'object') {
					if (typeof entry.t === 'string') {
						const name = entry.t as string;
						const tnum = getEntityType(name) || 0;
						slots.push({ action: entityButtonAction(name), count: entry.c || 0, rare: isRareHoldType(tnum) });
						continue;
					}
					type = entry.t || 0;
					count = entry.c || 0;
				}
			}

			if (type) {
				const name = getEntityTypeName(type);
				slots.push({ action: entityButtonAction(name), count, rare: isRareHoldType(type) });
			} else {
				slots.push({ action: undefined, count: 0, rare: false });
			}
		}

		return slots;
	}

	isSelected(index: number) {
		return this.selectedSlot === index;
	}

	getSlotZoomClass(index: number) {
		const specific = this.specificZoomBySlot[index];
		if (specific) {
			return specific;
		}

		const slot = this.visibleSlots[index];
		const title = (slot && slot.action && slot.action.title ? slot.action.title : '').toLowerCase();
		if (slot && slot.action && slot.action.type === 'entity') {
			const largeNames = ['house', 'tree', 'fence', 'wall', 'rock', 'bookshelf', 'door', 'window', 'table', 'bench', 'crate', 'stairs'];
			return largeNames.some(name => title.includes(name)) ? 'zoom-small' : 'zoom-large';
		}

		return '';
	}

	onSlotClick(index: number) {
		// pass current held value from client if present to help server-side sync
		const player: any = this.game.player as any;
		const held = (player && (player.hold || (player.options && player.options.hold))) || 0;
		console.debug('inventory: click', { index, held });
		this.game.send(server => (server as any).toggleInventorySlot(index, held));
	}

	trackByIndex(_i: number, _item: any) {
		return _i;
	}
}
