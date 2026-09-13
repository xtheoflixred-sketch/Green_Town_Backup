import { Component, ElementRef, TemplateRef, ViewChild } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Account } from '../../../../common/adminInterfaces';
import { CharacterTag } from '../../../../common/interfaces';
import { PAST_SUPPORTER_REWARDS, SUPPORTER_REWARDS } from '../../../../common/constants';
import { supporterLevel } from '../../../../common/adminUtils';
import { isAdmin } from '../../../../common/accountUtils';
import { getTag, getTagGradient } from '../../../../common/tags';
import { AdminModel } from '../../../services/adminModel';
import { faBan, faCalendarAlt, faCheck, faCheckCircle, faCopy, faGift, faInfoCircle, faKey, faListAlt, faStar } from '../../../../client/icons';

@Component({
	selector: 'supporter-assignment-modal',
	templateUrl: 'supporter-assignment-modal.pug',
	styleUrls: ['supporter-assignment-modal.scss'],
})
export class SupporterAssignmentModal {
	@ViewChild('template', { static: true }) template!: TemplateRef<any>;
	@ViewChild('scrollBody', { static: false }) scrollBody?: ElementRef<HTMLElement>;
	modalRef?: BsModalRef;
	account?: Account;
	accountId?: string;
	selectedLevel = 1;
	durationDays = 30;
	generatedCode = '';
	copiedCode = false;
	generating = false;
	readonly levels = [1, 2, 3, 4];
	readonly rewards = SUPPORTER_REWARDS;
	readonly tierOptions = [
		{ level: 0, label: 'None', description: 'No active manual tier', benefits: [] as string[] },
		...this.levels.map(level => ({ level, label: `Tier ${level}`, description: 'Supporter access', benefits: SUPPORTER_REWARDS[level] })),
		{ level: -1, label: 'Past Supporter', description: 'Former supporter access', benefits: PAST_SUPPORTER_REWARDS },
	];
	readonly starIcon = faStar;
	readonly infoIcon = faInfoCircle;
	readonly keyIcon = faKey;
	readonly copyIcon = faCopy;
	readonly checkIcon = faCheck;
	readonly calendarIcon = faCalendarAlt;
	readonly benefitsIcon = faListAlt;
	readonly giftIcon = faGift;
	readonly disabledIcon = faBan;
	readonly currentIcon = faCheckCircle;

	constructor(private modalService: BsModalService, private model: AdminModel) { }

	open(account: Account, accountId: string) {
		this.account = account;
		this.accountId = accountId;
		this.selectedLevel = Math.max(1, supporterLevel(account) || 1);
		this.durationDays = 30;
		this.generatedCode = '';
		this.copiedCode = false;
		this.modalRef = this.modalService.show(this.template, { class: 'modal-lg supporter-assignment-modal-host' });
	}

	close() {
		this.modalRef && this.modalRef.hide();
		this.modalRef = undefined;
	}

	get currentLevel() { return this.account ? supporterLevel(this.account) : 0; }
	get canGenerate() { return !!this.model.account && isAdmin(this.model.account) && !this.generating; }
	get canGrantSelectedLevel() { return this.selectedLevel >= 1 && this.selectedLevel <= 4; }
	get selectedTag(): CharacterTag | undefined { return getTag(`sup${this.selectedLevel}`); }
	get selectedGradient() { return getTagGradient(this.selectedTag && this.selectedTag.id); }
	get selectedOption() { return this.tierOptions.find(option => option.level === this.selectedLevel) || this.tierOptions[0]; }
	get selectedBenefits() { return this.selectedOption.benefits; }

	selectLevel(level: number) {
		this.selectedLevel = level;
		this.copiedCode = false;
	}

	selectGeneratedCode(event: Event) {
		(event.target as HTMLInputElement).select();
	}

	generateCode() {
		if (!this.account || !this.accountId || !this.canGenerate || !this.canGrantSelectedLevel) return;
		if (!confirm(`Generate a one-time Supporter Tier ${this.selectedLevel} code for ${this.account.name}?`)) return;
		this.generating = true;
		this.model.generateSupporterCode(this.selectedLevel, this.durationDays)
			.then(code => {
				if (code) {
					this.generatedCode = code;
					setTimeout(() => this.scrollToBottom(), 0);
				}
			})
			.finally(() => this.generating = false);
	}

	private scrollToBottom() {
		const element = this.scrollBody && this.scrollBody.nativeElement;
		if (element) element.scrollTop = element.scrollHeight;
	}

	grantSupporter() {
		if (!this.account || !this.accountId || !this.canGenerate || !this.canGrantSelectedLevel) return;
		if (!confirm(`Grant Supporter Tier ${this.selectedLevel} to ${this.account.name} for ${this.durationDays} days?`)) return;
		this.generating = true;
		this.model.setSupporter(this.accountId, this.selectedLevel, this.durationDays)
			.then(() => this.account!.supporter = this.selectedLevel)
			.finally(() => this.generating = false);
	}

	revokeSupporter() {
		if (!this.account || !this.accountId || !this.canGenerate) return;
		if (!confirm(`Remove the manually granted supporter tag from ${this.account.name}? Patreon supporter status, if any, will remain active.`)) return;
		this.generating = true;
		this.model.clearSupporter(this.accountId)
			.then(() => {
				this.account!.supporter = undefined;
				this.account!.supporterExpiresAt = undefined;
			})
			.finally(() => this.generating = false);
	}

	async copyCode() {
		if (!this.generatedCode) return;
		try {
			let copied = false;
			if (navigator.clipboard && navigator.clipboard.writeText) {
				try {
					await navigator.clipboard.writeText(this.generatedCode);
					copied = true;
				} catch (_) {
					// Fall back to the legacy copy path below.
				}
			}
			if (!copied) {
				const input = document.createElement('textarea');
				input.value = this.generatedCode;
				input.setAttribute('readonly', '');
				input.style.position = 'fixed';
				input.style.left = '-9999px';
				document.body.appendChild(input);
				input.select();
				try {
					if (!document.execCommand('copy')) throw new Error('Copy command failed');
				} finally {
					document.body.removeChild(input);
				}
			}
			this.copiedCode = true;
			setTimeout(() => this.copiedCode = false, 1800);
		} catch (error) {
			this.copiedCode = false;
			console.error('Failed to copy supporter code', error);
		}
	}
}