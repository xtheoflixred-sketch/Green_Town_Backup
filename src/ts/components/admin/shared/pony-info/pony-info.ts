import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { hasFlag } from '../../../../common/utils';
import { Character, CharacterFlags, Account } from '../../../../common/adminInterfaces';
import { faStar } from '../../../../client/icons';
import { getTag, getTagTooltip } from '../../../../common/tags';
import { getContrastTextColor } from '../../../../common/color';
import { isForbiddenName } from '../../../../common/security';
import { AdminModel } from '../../../services/adminModel';
import { Subscription } from '../../../../common/interfaces';

@Component({
	selector: 'pony-info',
	templateUrl: 'pony-info.pug',
	styleUrls: ['pony-info.scss'],
})
export class PonyInfo implements OnChanges, OnDestroy {
	readonly starIcon = faStar;
	readonly getTagTooltip = getTagTooltip;
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
	get characterTag() {
		return this.pony && getTag(this.pony.tag, this.pony.tagColor);
	}
	get characterTagBackground() {
		if (this.pony && this.pony.tagGradientStart && this.pony.tagGradientEnd) {
			return `linear-gradient(${this.pony.tagGradientDirection === 'vertical' ? 'to bottom' : 'to right'}, #${this.pony.tagGradientStart}, #${this.pony.tagGradientEnd})`;
		}
		return this.pony && this.pony.tagColor ? `#${this.pony.tagColor}` : undefined;
	}
	get characterTagTextColor() {
		return this.pony && this.pony.tagColor ? getContrastTextColor(this.pony.tagColor) : undefined;
	}
	get supporterTag() {
		if (!this.pony || this.pony.supportTag === 'hidden') return undefined;
		return this.pony.supportTag && /^sup[1-4]$/.test(this.pony.supportTag) ? this.pony.supportTag : undefined;
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
