import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AccountData } from '../../../common/interfaces';
import { Character } from '../../../common/adminInterfaces';
import { getPonyTag } from '../../services/model';
import { faCheck, faExclamationCircle, faTimes } from '../../../client/icons';
import { toPalette } from '../../../common/ponyInfo';

@Component({
	selector: 'imported-modal',
	templateUrl: 'imported-modal.pug',
	styleUrls: ['imported-modal.scss'],
})
export class ImportedModal {
	@Input() ponies: Character[] = [];
	@Input() account?: AccountData;
	@Input() errorMessage?: string;

	@Output() close = new EventEmitter<void>();
	@Output() keep = new EventEmitter<void>();
	@Output() remove = new EventEmitter<void>();

	readonly warningIcon = faExclamationCircle;
	readonly keepIcon = faCheck;
	readonly removeIcon = faTimes;
	readonly toPalette = toPalette;

	get hasError() {
		return !!this.errorMessage;
	}

	get displayPonies() {
		return this.ponies || [];
	}

	get previewCount() {
		return this.displayPonies.length;
	}

	get isSingle() {
		return this.previewCount === 1;
	}

	get title() {
		if (this.hasError) {
			return 'Import failed';
		}

		return this.isSingle ? 'Imported character' : `Import ${this.previewCount} characters`;
	}

	get subtitle() {
		if (this.hasError) {
			return 'Some requested characters could not be imported.';
		}

		return this.isSingle ?
			'This character was imported from another account.' :
			`${this.previewCount} characters were imported from another account.`;
	}

	get summaryText() {
		return this.errorMessage || 'Choose whether to keep the imported version or discard it.';
	}

	get useLargePreview() {
		return this.previewCount <= 3;
	}

	get usePortraitGrid() {
		return this.previewCount > 3 && this.previewCount <= 12;
	}

	get useCompactGrid() {
		return this.previewCount > 12;
	}

	get previewScale() {
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

	get previewClass() {
		if (this.previewCount === 1) {
			return 'preview-single';
		}

		if (this.previewCount === 2) {
			return 'preview-double';
		}

		if (this.previewCount === 3) {
			return 'preview-triple';
		}

		if (this.previewCount <= 12) {
			return 'preview-grid-small';
		}

		if (this.previewCount <= 24) {
			return 'preview-grid-compact';
		}

		return 'preview-grid-tiny';
	}

	getPonyTag(pony: Character) {
		return getPonyTag(pony as any, this.account);
	}

	closeModal() {
		this.close.emit();
	}

	acceptImport() {
		this.keep.emit();
	}

	rejectImport() {
		this.remove.emit();
	}
}
