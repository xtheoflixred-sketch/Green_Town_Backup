import { Component, TemplateRef, ViewChild } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Account } from '../../../../common/adminInterfaces';
import { ROLES } from '../../../../common/adminInterfaces';
import { CharacterTag } from '../../../../common/interfaces';
import { hasRole } from '../../../../common/accountUtils';
import { getTag } from '../../../../common/tags';
import { AdminModel } from '../../../services/adminModel';
import {
	faCheckCircle, faInfoCircle, faShieldAlt, faTags, faUserCog, faComments, faPaintBrush,
} from '../../../../client/icons';

@Component({
	selector: 'role-assignment-modal',
	templateUrl: 'role-assignment-modal.pug',
	styleUrls: ['role-assignment-modal.scss'],
})
export class RoleAssignmentModal {
	@ViewChild('template', { static: true }) template!: TemplateRef<any>;
	modalRef?: BsModalRef;
	account?: Account;
	accountId?: string;
	readonly roles = ROLES;
	readonly infoIcon = faInfoCircle;
	readonly roleIcon = faShieldAlt;
	readonly tagsIcon = faTags;
	readonly activeIcon = faCheckCircle;
	readonly fallbackIcon = faUserCog;
	readonly chatIcon = faComments;
	readonly customTagIcon = faPaintBrush;

	constructor(private modalService: BsModalService, private model: AdminModel) {
	}

	open(account: Account, accountId: string) {
		this.account = account;
		this.accountId = accountId;
		this.modalRef = this.modalService.show(this.template, { class: 'modal-xl role-assignment-modal-host' });
	}

	close() {
		this.modalRef && this.modalRef.hide();
		this.modalRef = undefined;
	}

	hasRole(role: string) {
		return hasRole(this.account, role);
	}

	canToggleRole() {
		return hasRole(this.model.account, 'owner');
	}

	toggleRole(role: string, event: Event) {
		if (!this.account || !this.accountId || !this.canToggleRole()) return;
		const input = event.target as HTMLInputElement;
		const enabled = input.checked;
		if (role === 'owner' && !confirm(
			enabled
				? `Grant server owner access to ${this.account.name}? This gives the player full administrative control.`
				: `Remove server owner access from ${this.account.name}? This may remove their ability to manage the server.`
		)) {
			input.checked = this.hasRole(role);
			return;
		}
		this.model.setRole(this.accountId, role, enabled);
		this.account.roles = enabled
			? [...(this.account.roles || []), role]
			: (this.account.roles || []).filter(currentRole => currentRole !== role);
	}

	getTag(role: string): CharacterTag | undefined {
		return getTag(role);
	}

	get assignedRoles() {
		return this.roles.filter(role => this.hasRole(role));
	}

	get assignedTags() {
		return this.assignedRoles.map(role => this.getTag(role)).filter(tag => !!tag) as CharacterTag[];
	}

	getCharactersForRole(role: string) {
		return (this.account && this.account.ponies || []).filter(pony => pony.tag === role || pony.supportTag === role);
	}

	getRoleTagCount(role: string) {
		return this.getCharactersForRole(role).length;
	}

	hasRoleChat(role: string) {
		return this.getCharactersForRole(role).some(pony => pony.supportChat !== undefined);
	}

	hasCustomRoleTag(role: string) {
		return this.getCharactersForRole(role).some(pony => !!(
			pony.tagColor || (pony.tagGradientStart && pony.tagGradientEnd)
		));
	}

	getRoleTagStyle(role: string) {
		const pony = this.getCharactersForRole(role).find(item => item.tag === role && (
			item.tagColor || (item.tagGradientStart && item.tagGradientEnd)
		));
		if (!pony) return {};
		if (pony.tagGradientStart && pony.tagGradientEnd) {
			return {
				background: `linear-gradient(${pony.tagGradientDirection === 'vertical' ? 'to bottom' : 'to right'}, #${pony.tagGradientStart}, #${pony.tagGradientEnd})`,
				color: '#fff',
			};
		}
		return { 'background-color': `#${pony.tagColor}` };
	}

	getRoleTagDestination(role: string) {
		const overrides = this.account && this.account.roleTagOverrides;
		return overrides && Object.prototype.hasOwnProperty.call(overrides, role) ? overrides[role] : role;
	}

	setRoleTagDestination(role: string, event: Event) {
		if (!this.account || !this.accountId || !this.canToggleRole()) return;
		const value = (event.target as HTMLSelectElement).value;
		const tag = value === '__disabled' ? null : value;
		this.model.setRoleTag(this.accountId, role, tag);
		this.account.roleTagOverrides = { ...(this.account.roleTagOverrides || {}), [role]: tag };
	}
}