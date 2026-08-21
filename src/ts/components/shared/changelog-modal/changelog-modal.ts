import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { faSpinner } from '../../../client/icons';
import { SettingsService } from '../../services/settingsService';
import { Model } from '../../services/model';
import { isDevChangelogVisible } from '../../../common/changelogUtils';

@Component({
	selector: 'changelog-modal',
	templateUrl: 'changelog-modal.pug',
	styleUrls: ['changelog-modal.scss'],
})
export class ChangelogModal implements OnInit {
	@Output() close = new EventEmitter<void>();

	readonly spinnerIcon = faSpinner;
	readonly debug = (typeof DEVELOPMENT !== 'undefined' && (DEVELOPMENT || typeof BETA !== 'undefined' && BETA));

	alwaysShowAfterLoad = true;
	changelogResponse: any = null;

	constructor(
		public settingsService: SettingsService,
		public model: Model,
	) {}

	get headerTitle() {
		if (this.changelogResponse && this.changelogResponse.public && this.changelogResponse.public.length > 0) {
			const firstEntry = this.changelogResponse.public[0];
			return `Welcome to ${firstEntry.version}!`;
		}
		return 'Changelog';
	}

	get currentStatus() {
		if (this.changelogResponse && this.changelogResponse.public && this.changelogResponse.public.length > 0) {
			const firstEntry = this.changelogResponse.public[0];
			// Extract status from version string if present (e.g., "Season 1 — Patch 5 | Exp. Stable")
			const match = /\|\s*(.+)/.exec(firstEntry.version);
			return match ? match[1] : '';
		}
		return '';
	}

	get isPrivileged() {
		return isDevChangelogVisible(this.model.account);
	}
	ngOnInit() {
		// Load saved preference (default to true if not set)
		this.alwaysShowAfterLoad = !this.settingsService.browser.hideChangelogModal;

		// Fetch changelog from server
		this.model.fetchChangelog().then(response => {
			this.changelogResponse = response;
		}).catch(err => {
			console.error('Failed to fetch changelog:', err);
		});
	}
	closeModal() {
		this.close.emit();
	}
}
