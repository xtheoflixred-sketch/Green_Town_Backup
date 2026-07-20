import { Component, Input, Output, EventEmitter, HostListener, OnChanges, OnDestroy, SimpleChanges, ViewChild, TemplateRef } from '@angular/core';
import { AccountData, OAuthProvider, PalettePonyInfo } from '../../../common/interfaces';
import { signUpProviders, signInProviders } from '../../../client/data';
import { getProviderIcon } from '../sign-in-box/sign-in-box';
import { faStar, faSpinner, faUser, faExclamationCircle, faCog, faCircle, faIdBadge, faPaintBrush, faUserCog, faPlay, faWrench, faSignOutAlt, faPlug, faHammer, faClock } from '../../../client/icons';
import { Model } from '../../services/model';
import { supporterClass, supporterTitle, isSupporterOrPastSupporter } from '../../../client/clientUtils';
import { SettingsService } from '../../services/settingsService';
import { REQUEST_DATE_OF_BIRTH } from '../../../common/constants';
import { isAdmin, isDev } from '../../../common/accountUtils';
import { createDefaultPony, mockPaletteManager } from '../../../common/ponyInfo';
import { decodePonyInfo } from '../../../common/compressPony';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';

@Component({
	selector: 'menu-bar',
	templateUrl: 'menu-bar.pug',
	styleUrls: ['menu-bar.scss'],
})
export class MenuBar implements OnChanges, OnDestroy {
	readonly signUpProviders = signUpProviders;
	readonly signInProviders = signInProviders;
	readonly starIcon = faStar;
	readonly spinnerIcon = faSpinner;
	readonly userIcon = faUser;
	readonly alertIcon = faExclamationCircle;
	readonly cogIcon = faCog;
	readonly statusIcon = faCircle;
	readonly idBadgeIcon = faIdBadge;
	readonly animatorIcon = faPlay;
	readonly artistIcon = faPaintBrush;
	readonly developerIcon = faWrench;
	readonly userCogIcon = faUserCog;
	readonly signOutIcon = faSignOutAlt;
	readonly plugIcon = faPlug;
	readonly builderIcon = faHammer;
	readonly clockIcon = faClock;
	lastLoginLabel = 'not recorded yet';
	lastLogoutLabel = 'not recorded yet';
	currentPony?: PalettePonyInfo;
	signOutModalRef?: BsModalRef;
	@ViewChild('signOutModal', { static: true }) signOutModalTpl!: TemplateRef<any>;
	private timerInterval?: any;
	@Input() logo = false;
	@Input() loading = false;
	@Input() loadingError = false;
	@Input() account?: AccountData;
	@Input() signOutLoading = false;
	@Input() signOutError?: string;
	@Output() signOut = new EventEmitter();
	@Output() signIn = new EventEmitter<OAuthProvider>();
	@Output() openSettings = new EventEmitter<void>();
	constructor(
		private model: Model,
		private settings: SettingsService,
		private modalService: BsModalService,
	) {
		this.syncSessionLabels();
		this.startTimer();
	}
	ngOnDestroy() {
		if (this.timerInterval) {
			clearInterval(this.timerInterval);
		}
	}
	private startTimer() {
		this.timerInterval = setInterval(() => {
			this.syncSessionLabels();
		}, 1000);
	}
	get hasSupporterIcon() {
		return isSupporterOrPastSupporter(this.account);
	}
	get supporterTitle() {
		return supporterTitle(this.account);
	}
	get supporterClass() {
		return supporterClass(this.account);
	}
	get showAccountAlert() {
		return this.model.missingBirthdate && REQUEST_DATE_OF_BIRTH;
	}
	get hidden() {
		return !!this.settings.account.hidden;
	}
	get isPrivileged() {
		return isAdmin(this.account as any) || isDev(this.account as any) || this.hasRole('mod');
	}
	get canOpenAdminPanel() {
		return this.isPrivileged;
	}
	get canOpenAnimatorTools() {
		return isDev(this.account as any) || this.hasRole('animator');
	}
	get canOpenArtistStudio() {
		return isDev(this.account as any) || this.hasRole('artist');
	}
	get canOpenMapBuilder() {
		return isDev(this.account as any) || this.hasRole('builder');
	}
	hasRole(role: string) {
		return !!(this.account && this.account.roles && this.account.roles.indexOf(role) !== -1);
	}
	ngOnChanges(changes: SimpleChanges) {
		this.syncCurrentPony();
		this.syncSessionLabels();

		if (changes && changes.signOutLoading) {
			const prev = !!(changes.signOutLoading.previousValue);
			const curr = !!(changes.signOutLoading.currentValue);

			// If signOut loading finished and there's no error, close the modal
			if (prev && !curr && !this.signOutError) {
				this.closeSignOutModal();
			}
		}
	}
	private syncCurrentPony() {
		if (!this.account || !this.account.ponies || !this.account.ponies.length) {
			this.currentPony = undefined;
			return;
		}

		const latest = this.account.ponies
			.slice()
			.sort((a, b) => (b.lastUsed || '').localeCompare(a.lastUsed || ''))[0];

		if (!latest) {
			this.currentPony = undefined;
			return;
		}

		try {
			if (latest.ponyInfo) {
				this.currentPony = latest.ponyInfo as any;
			} else if (latest.info) {
				this.currentPony = decodePonyInfo(latest.info, mockPaletteManager) as any;
			} else {
				this.currentPony = createDefaultPony() as any;
			}
		} catch {
			this.currentPony = createDefaultPony() as any;
		}
	}
	private syncSessionLabels() {
		const loginTs = this.getSessionTimestamp(this.account && (this.account as any).lastLogin);
		const logoutTs = this.getSessionTimestamp(this.account && (this.account as any).lastLogout);

		this.lastLoginLabel = this.formatSessionValue(loginTs);
		this.lastLogoutLabel = this.formatSessionValue(logoutTs);
	}
	private getSessionTimestamp(value?: string | Date) {
		if (!value) {
			return 0;
		}

		const date = value instanceof Date ? value : new Date(value);
		return isNaN(date.getTime()) ? 0 : date.getTime();
	}
	private formatSessionValue(timestamp: number) {
		if (!timestamp) {
			return 'not recorded yet';
		}

		const diffMs = Date.now() - timestamp;
		const diffSeconds = Math.max(1, Math.floor(diffMs / 1000));
		const diffMinutes = Math.floor(diffSeconds / 60);
		const diffHours = Math.floor(diffMinutes / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMinutes < 1) {
			return 'just now';
		}
		if (diffMinutes < 60) {
			return `${diffMinutes} min ago`;
		}
		if (diffHours < 24) {
			return `${diffHours}h ago`;
		}
		return `${diffDays}d ago`;
	}
	openSignOutModal() {
		this.signOutModalRef = this.modalService.show(this.signOutModalTpl, { class: 'modal-md', ignoreBackdropClick: true });
	}
	closeSignOutModal() {
		if (this.signOutModalRef) {
			this.signOutModalRef.hide();
			this.signOutModalRef = undefined;
		}
	}
	confirmSignOut() {
		if (this.signOutLoading) {
			return;
		}

		this.signOut.emit();
	}
	icon(id: string) {
		return getProviderIcon(id);
	}
	signInTo(provider: OAuthProvider) {
		this.signIn.emit(provider);
	}
	@HostListener('window:resize')
	resize() {
	}
	setStatus(status: string) {
		this.settings.account.hidden = status === 'invisible';
		this.settings.saveAccountSettings(this.settings.account);
	}
}
