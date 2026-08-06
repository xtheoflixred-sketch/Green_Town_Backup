import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { hasFlag } from '../../../../common/utils';
import { Character, CharacterFlags, Account } from '../../../../common/adminInterfaces';
import { isForbiddenName } from '../../../../common/security';
import { AdminModel } from '../../../services/adminModel';
import { Subscription } from '../../../../common/interfaces';

@Component({
	selector: 'pony-info',
	templateUrl: 'pony-info.pug',
	styleUrls: ['pony-info.scss'],
})
export class PonyInfo implements OnChanges, OnDestroy {
	@Input() pony?: Character;
	@Input() highlight = false;
	labelClass = 'badge-none';
	account?: Account;
	private promise?: Promise<void>;
	private subscription?: Subscription;
	constructor(private model: AdminModel) {
	}
	get isBadCM() {
		return !!this.pony && hasFlag(this.pony.flags, CharacterFlags.BadCM);
	}
	ngOnChanges() {
		if (this.pony) {
			if (isForbiddenName(this.pony.name)) {
				this.labelClass = 'badge-forbidden';
			} else if (hasFlag(this.pony.flags, CharacterFlags.BadCM)) {
				this.labelClass = 'badge-danger';
			} else {
				this.labelClass = 'badge-none';
			}
		}
	}
	ngOnDestroy() {
		this.subscription && this.subscription.unsubscribe();
	}
	onShown() {
		if (this.pony) {
			if (!this.pony.ponyInfo && !this.promise) {
				this.promise = this.model.getPonyInfo(this.pony)
					.finally(() => this.promise = undefined);
			}
			if (this.pony.account && !this.account && !this.subscription) {
				this.subscription = this.model.accounts
					.subscribe(this.pony.account, account => this.account = account);
			}
		}
	}
	click() {
		console.log(this.pony);
	}
}
