import { Component, Input, Output, EventEmitter } from '@angular/core';
import { PalettePonyInfo } from '../../../common/interfaces';
import { faExclamationCircle, faSignOutAlt, faSpinner } from '../../../client/icons';

@Component({
	selector: 'sign-out-modal',
	templateUrl: 'sign-out-modal.pug',
	styleUrls: ['sign-out-modal.scss'],
})
export class SignOutModal {
	@Input() pony?: PalettePonyInfo;
	@Input() lastLogin = 'not recorded yet';
	@Input() lastLogout = 'not recorded yet';
	@Input() signOutLoading = false;
	@Input() signOutError?: string;

	@Output() close = new EventEmitter<void>();
	@Output() confirm = new EventEmitter<void>();

	readonly warningIcon = faExclamationCircle;
	readonly signOutIcon = faSignOutAlt;
	readonly spinnerIcon = faSpinner;
	closeModal() {
		this.close.emit();
	}

	confirmSignOut() {
		this.confirm.emit();
	}
}
