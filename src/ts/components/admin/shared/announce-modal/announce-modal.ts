import { Component, ViewChild, TemplateRef } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AdminModel } from '../../../services/adminModel';
import { faBullhorn, faHorseHead } from '../../../../client/icons';

@Component({
	selector: 'announce-modal',
	exportAs: 'announceModal',
	templateUrl: 'announce-modal.pug',
})
export class AnnounceModal {
	@ViewChild('template', { static: true }) template!: TemplateRef<any>;
	modalRef?: BsModalRef;
	message = '';
	announceType: 'admin' | 'announcement' = 'admin';
	readonly faBullhorn = faBullhorn;
	readonly typeOptions = [
		{ label: 'Admin announce', value: 'admin', icon: faBullhorn, description: 'Global admin chat message.' },
		{ label: 'In-game announcement', value: 'announcement', icon: faHorseHead, description: 'Broadcast styled announcement to all players.' },
	];

	constructor(private modalService: BsModalService, private model: AdminModel) {
	}

	open() {
		this.message = '';
		this.announceType = 'admin';
		this.modalRef = this.modalService.show(this.template, { class: 'modal-lg' });
	}

	cancel() {
		this.modalRef && this.modalRef.hide();
	}

	canSend() {
		return !!this.message.trim();
	}

	send() {
		const message = this.message.trim();

		if (!message) {
			return;
		}

		this.model.announce(message, this.announceType)
			.then(() => this.cancel())
			.catch(() => undefined);
	}
}
