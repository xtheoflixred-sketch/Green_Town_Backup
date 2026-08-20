import { Component, Output, EventEmitter, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { Model } from '../../services/model';
import { PalettePonyInfo, Action } from '../../../common/interfaces';
import { toPalette } from '../../../common/ponyInfo';
import { getToySprite, getToyColorExtra } from '../../../client/ponyDraw';
import { PonyTownGame } from '../../../client/game';

@Component({
	selector: 'select-toy-modal',
	templateUrl: 'select-toy-modal.pug',
	styleUrls: ['select-toy-modal.scss'],
})
export class SelectToyModal implements OnInit, OnDestroy {
	@Output() close = new EventEmitter<void>();
	@Output() toySelected = new EventEmitter<number>();
	previewPony: PalettePonyInfo | undefined;
	toySets: any[][] = [];
	private _toys: number[] = [];
	private _toysLoaded = false;
	private selectedToy: number | undefined;
	toySet: { type: number; pattern: number } = { type: 0, pattern: 0 };
	private _toyBitmask = 0;

	constructor(
		private model: Model,
		private game: PonyTownGame,
		private cdr: ChangeDetectorRef
	) {}

	ngOnInit() {
		this.initializeData();
	}

	ngOnDestroy() {
		// modal is short-lived; nothing to explicitly unsubscribe here
	}

	private initializeData() {
		// Get current player pony for preview
		const pony = this.model && this.model.pony;
		if (pony && pony.ponyInfo) {
			this.previewPony = toPalette(pony.ponyInfo, this.game.paletteManager);
			if ((pony.ponyInfo as any).toy) {
				this.selectedToy = (pony.ponyInfo as any).toy;
			}
		}

		// Load toy bitmask from account state
		if (this.model && this.model.account) {
			const acct: any = this.model.account;
			const toysValue = acct.state && acct.state.toys;
			if (toysValue !== undefined) {
				this._toyBitmask = typeof toysValue === 'number' ? toysValue : parseInt(toysValue, 10) || 0;
			}
		}

		// Collect toy IDs and build ColorExtra sets
		if (!this._toysLoaded) {
			this._toys = [];
			this.toySets = [];

			for (let n = 1; n < 200; n++) {
				const toySet = getToySprite(n);
				if (!toySet) break;

				this._toys.push(n);

				const item = getToyColorExtra(n);
				if (!item) continue;
				if (toySet.palette && toySet.palette.colors) {
					item.palette = toySet.palette.colors;
					item.palettes = [toySet.palette.colors];
				}
				item.label = `Toy ${n}`;

				this.toySets.push([item]);
			}

			const selectedIndex = this.selectedToy ? this._toys.indexOf(this.selectedToy) : 0;
			this.toySet = { type: selectedIndex >= 0 ? selectedIndex : 0, pattern: 0 };
			this._toysLoaded = true;
		}
	}

	onToySetChanged() {
		const idx = this.toySet && typeof this.toySet.type === 'number' ? this.toySet.type : 0;
		const toyId = (this._toys && this._toys[idx]) || 0;
		if (toyId && this.isCollected(toyId)) {
			this.selectToyInternal(toyId);
		}
	}

	get toys(): number[] {
		return this._toys;
	}

	get toyBitmask(): number {
		if (this.model && this.model.account) {
			const acct: any = this.model.account;
			const toysValue = acct.state && acct.state.toys;
			if (toysValue !== undefined) {
				const newMask = typeof toysValue === 'number' ? toysValue : parseInt(toysValue, 10) || 0;
				if (newMask !== this._toyBitmask) {
					this._toyBitmask = newMask;
				}
			}
		}
		return this._toyBitmask;
	}

	isCollected(toyId: number): boolean {
		const bitIndex = toyId - 1;
		return !!(this.toyBitmask & (1 << bitIndex));
	}

	private selectToyInternal(toyId: number) {
		if (!this.isCollected(toyId)) return;
		this.selectedToy = toyId;
		const current = this.previewPony;
		if (current) {
			this.previewPony = { ...current, toy: toyId } as PalettePonyInfo;
			this.cdr.markForCheck();
		}
	}

	confirmSelection() {
		if (this.selectedToy && this.selectedToy > 0) {
			const current = this.previewPony;
			if (current) {
				this.previewPony = { ...current, toy: this.selectedToy } as PalettePonyInfo;
				this.cdr.markForCheck();
			}
			this.game.send(server => server.actionParam(Action.DropToy, this.selectedToy));
		}
		this.closeModal();
	}

	closeModal() {
		this.close.emit();
	}

	getCollectedCount(): number {
		return this.toys.filter(t => this.isCollected(t)).length;
	}
}
