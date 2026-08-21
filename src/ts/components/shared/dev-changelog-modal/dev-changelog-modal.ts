import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { faSpinner } from '../../../client/icons';
import { Model } from '../../services/model';

@Component({
	selector: 'dev-changelog-modal',
	templateUrl: 'dev-changelog-modal.pug',
	styleUrls: ['dev-changelog-modal.scss'],
})
export class DevChangelogModal implements OnInit {
	@Output() close = new EventEmitter<void>();

	readonly spinnerIcon = faSpinner;
	changelogResponse: any = null;

	constructor(public model: Model) {}

	get headerTitle() {
		return 'Dev Changelog';
	}

	get currentStatus() {
		if (this.changelogResponse && this.changelogResponse.dev && this.changelogResponse.dev.length > 0) {
			const firstEntry = this.changelogResponse.dev[0];
			const match = /\|\s*(.+)/.exec(firstEntry.version);
			return match ? match[1] : '';
		}
		return '';
	}

	ngOnInit() {
		this.model.fetchChangelog().then(response => {
			this.changelogResponse = response;
		}).catch(err => {
			console.error('Failed to fetch dev changelog:', err);
		});
	}

	closeModal() {
		this.close.emit();
	}
}
