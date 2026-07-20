import { Component, Input, Output, EventEmitter } from '@angular/core';
import { PonyInfo } from '../../../common/interfaces';
import { faExclamationCircle, faTrash } from '../../../client/icons';
import { toPalette, createDefaultPony } from '../../../common/ponyInfo';

@Component({
	selector: 'delete-modal',
	templateUrl: 'delete-modal.pug',
	styleUrls: ['delete-modal.scss'],
})
export class DeleteModal {
	@Input() name?: string;
	@Input() pony?: PonyInfo;
	@Input() ponies: PonyInfo[] = [];

	@Output() close = new EventEmitter<void>();
	@Output() confirm = new EventEmitter<void>();

	deleting = false;

	readonly warningIcon = faExclamationCircle;
	readonly trashIcon = faTrash;
	readonly toPalette = toPalette;
	readonly createDefaultPony = createDefaultPony;

	get displayPonies(): PonyInfo[] {
		if (this.ponies && this.ponies.length) {
			return this.ponies;
		}

		if (this.pony) {
			return [this.pony];
		}

		return [];
	}

	get previewCount(): number {
		return this.displayPonies.length;
	}

	get isSingle(): boolean {
		return this.previewCount === 1;
	}

	// 1-2 = большие character-preview
	get useLargePreview(): boolean {
		return this.previewCount <= 2;
	}

	// 3-12 = portrait-box
	get usePortraitGrid(): boolean {
		return this.previewCount > 2 && this.previewCount <= 12;
	}

	// 13+ = компактная сетка
	get useCompactGrid(): boolean {
		return this.previewCount > 12;
	}

	get title(): string {
		return this.isSingle ?
			'Delete character' :
			'Delete ' + this.previewCount + ' characters';
	}

	get subtitle(): string {
		return this.isSingle ?
			(this.name || 'Character') :
			(this.previewCount + ' selected characters');
	}

	get warningText(): string {
		return this.isSingle ?
			'This character will be permanently removed. This action cannot be undone.' :
			'All selected characters will be permanently removed. This action cannot be undone.';
	}

	get previewScale(): number {
		switch (this.previewCount) {
			case 1:
				return 4;

			case 2:
				return 3.25;

			case 3:
				return 2.7;

			default:
				return 2;
		}
	}

	get previewClass(): string {
		if (this.previewCount === 1) {
			return 'preview-single';
		}

		if (this.previewCount === 2) {
			return 'preview-double';
		}


		if (this.previewCount <= 12) {
			return 'preview-grid-small';
		}

		if (this.previewCount <= 24) {
			return 'preview-grid-compact';
		}

		return 'preview-grid-tiny';
	}

	closeModal() {
		this.close.emit();
	}

	confirmDelete() {
		if (this.deleting) {
			return;
		}

		this.deleting = true;
		const duration = this.getDeleteAnimationDuration();
		setTimeout(() => this.confirm.emit(), duration);
	}

	getPreviewDelay(index: number): string {
		if (this.previewCount === 2) {
			return index === 1 ? '120ms' : '0ms';
		}

		return `${index * 40}ms`;
	}

	getDeleteAnimationDuration(): number {
		if (this.previewCount <= 2) {
			return 1200;
		}

		const stagger = Math.min((this.previewCount - 1) * 40, 480);
		return 1200 + stagger;
	}
}