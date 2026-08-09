import { Component, ViewChild, TemplateRef } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AdminModel } from '../../../services/adminModel';
import { DEFAULT_PONY } from '../../../../common/constants';
import { decompressPonyString } from '../../../../common/compressPony';
// preview conversion handled by CharacterPreview

@Component({
	selector: 'default-pony-modal',
	exportAs: 'defaultPonyModal',
	templateUrl: 'default-pony-modal.pug',
	styleUrls: ['default-pony-modal.scss'],
})
export class DefaultPonyModal {
	@ViewChild('template', { static: true }) template!: TemplateRef<any>;
	modalRef?: BsModalRef;
	inputValue = '';
	preview: any = undefined;
	previewError = '';

	constructor(private modalService: BsModalService, private model: AdminModel) {
	}

	open() {
		// initialize with current server setting or constant
		this.inputValue = (this.model.state && (this.model.state as any).settings && (this.model.state as any).settings.defaultPonyInfo)
			|| DEFAULT_PONY;
		this.updatePreview();
		this.modalRef = this.modalService.show(this.template, { class: 'modal-lg' });
	}

	cancel() {
		this.modalRef && this.modalRef.hide();
	}

	updatePreview() {
		if (!this.inputValue.trim()) {
			this.preview = undefined;
			this.previewError = 'No pony string provided. Paste a pony string to preview and import the default pony.';
			return;
		}

		try {
			const info = decompressPonyString(this.inputValue, true);
			this.preview = info;
			this.previewError = '';
		} catch (e) {
			this.preview = undefined;
			this.previewError = 'Invalid compressed pony string. Please check the value or paste a valid pony code.';
		}
	}

	async importPonyFile(file: File | undefined) {
		if (!file) {
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			const text = reader.result as string;
			this.inputValue = text;
			this.updatePreview();
		};
		reader.onerror = () => {
			this.preview = undefined;
			this.previewError = 'Failed to load the pony file. Please try again.';
		};
		reader.readAsText(file);
	}

	canImport() {
		return !!this.preview && !this.previewError;
	}

	saveDefault() {
		if (!this.canImport()) {
			return;
		}

		const value = this.inputValue || DEFAULT_PONY;
		return this.model.updateSettings({ defaultPonyInfo: value })
			.then(() => this.cancel())
			.catch(() => undefined);
	}

	saveAndPublic() {
		if (!this.canImport()) {
			return;
		}

		const value = this.inputValue || DEFAULT_PONY;
		return this.model.updateSettings({ defaultPonyInfo: value })
			.then(() => {
				// this action intentionally publishes the new default immediately
				this.cancel();
			})
			.catch(() => undefined);
	}
}
