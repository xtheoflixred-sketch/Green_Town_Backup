import { Component, Input, TemplateRef, ViewChild } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { AdminModel } from '../../../services/adminModel';
import { Account } from '../../../../common/adminInterfaces';
import { HOUR, DAY } from '../../../../common/constants';
import { faExclamationCircle, faInfoCircle, faBullhorn } from '../../../../client/icons';

export type AlertType = 'warning' | 'danger' | 'info' | 'announcement';

export interface AlertEntry {
	message: string;
	type: AlertType;
}

const alertTypes: { value: AlertType; label: string; icon?: any }[] = [
	{ value: 'warning', label: 'Warning' },
	{ value: 'danger', label: 'Danger' },
	{ value: 'info', label: 'Info' },
	{ value: 'announcement', label: 'Announcement', icon: faBullhorn },
];

const alertExpires = [
	{ name: '1h', length: HOUR },
	{ name: '5h', length: 5 * HOUR },
	{ name: '12h', length: 12 * HOUR },
	{ name: '1d', length: DAY },
	{ name: '2d', length: 2 * DAY },
	{ name: '5d', length: 5 * DAY },
	{ name: '7d', length: 7 * DAY },
	{ name: '2w', length: 14 * DAY },
];

@Component({
	selector: 'alert-modal',
	templateUrl: 'alert-modal.pug',
	styleUrls: ['alert-modal.scss'],
})
export class AlertModal {
		@Input() account?: Account;
	@ViewChild('template', { static: true }) template!: TemplateRef<any>;
	alertModalRef?: BsModalRef;
	activeIndex = 0;
	entries: AlertEntry[] = [{ message: '', type: 'warning' }];
	readonly warningIcon = faExclamationCircle;
	readonly infoIcon = faInfoCircle;
	readonly megaphoneIcon = faBullhorn;
	alertTypes = alertTypes;
	alertExpires = alertExpires;
	alertExpire = alertExpires[3];

	constructor(private model: AdminModel, private modalService: BsModalService) {
	}

	get hasAlert() {
		return !!(this.account && this.account.alert && this.account.alert.expires.getTime() > Date.now());
	}

	get alertTitle() {
		return this.hasAlert ? 'Edit alert' : 'Create alert';
	}

	get confirmLabel() {
		return this.hasAlert ? 'Update' : 'Send';
	}

	open(account?: Account) {
		if (account) {
			this.account = account;
		}

		if (!this.account) {
			return;
		}

		this.alertExpire = alertExpires[3];
		this.entries = this.parseAlert(this.account.alert && this.account.alert.message);
		this.activeIndex = this.hasAlert ? 1 : 0;
		this.alertModalRef = this.modalService.show(this.template, { ignoreBackdropClick: true });
	}

	cancel() {
		this.alertModalRef && this.alertModalRef.hide();
		this.alertModalRef = undefined;
	}

	confirm() {
		if (!this.account) {
			return;
		}

		const message = this.buildMessage();
		this.model.setAlert(this.account._id, message, this.alertExpire.length);
		this.cancel();
	}

	removeAlert() {
		if (this.account) {
			this.model.setAlert(this.account._id, '', 0);
		}
	}

	       addEntry() {
		       this.entries.push({ message: '', type: 'announcement' });
	       }

	removeEntry(index: number) {
		if (this.entries.length > 1) {
			this.entries.splice(index, 1);
		} else {
			this.entries = [{ message: '', type: 'warning' }];
		}
	}

	canConfirm() {
		return this.entries.some(entry => entry.message.trim().length > 0);
	}

	       alertClass(type: AlertType) {
		       switch (type) {
			       case 'danger': return 'alert-danger';
			       case 'info': return 'alert-info';
			       case 'announcement': return 'alert-announcement';
			       default: return 'alert-warning';
		       }
	       }

	       alertIcon(type: AlertType) {
		       switch (type) {
			       case 'danger': return this.warningIcon;
			       case 'info': return this.infoIcon;
			       case 'announcement': return this.megaphoneIcon;
			       default: return this.warningIcon;
		       }
	       }

	       private parseAlert(text?: string): AlertEntry[] {
		       if (!text) {
			       return [{ message: '', type: 'announcement' }];
		       }

		       const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
		       const parsed = lines.map(line => {
			       const match = line.match(/^\s*\[(warning|danger|info|announcement)\]\s*(.+)$/i);
			       if (match) {
				       return { type: match[1].toLowerCase() as AlertType, message: match[2] || '' };
			       }
			       return { type: 'announcement' as AlertType, message: line };
		       });

		       return parsed.length ? parsed : [{ message: '', type: 'announcement' }];
	       }

	private buildMessage() {
		return this.entries
			.filter(entry => entry.message.trim().length > 0)
			.map(entry => `[${entry.type}] ${entry.message.trim()}`)
			.join('\n');
	}
}
