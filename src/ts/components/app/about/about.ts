import { Component, OnInit } from '@angular/core';
import { emojis } from '../../../client/emoji';
import { CREDITS, CONTRIBUTORS, Credit, } from '../../../client/credits';
import { OFFLINE_PONY, DEL_PONY, KOKOSIK_PONY, HIKA_MIG_PONY, AALIK_PONY, SOFA_PONY, ENOT_PONY, LAI_PONY, KRIF_PONY } from '../../../common/constants';
import { decompressPonyString } from '../../../common/compressPony';
import { SUPPORTER_REWARDS_LIST } from '../../../common/constants';
import { discordLink, contactEmail, contactDiscord, version, shortVersion } from '../../../client/data';
import { isPrivilegedAccount } from '../../../common/changelogUtils';
import { Model } from '../../services/model';

function colorFromSkin(skin?: string) {
	if (!skin) return '#494242';
	// simple deterministic color from string (HSL)
	let h = 0;
	for (let i = 0; i < skin.length; i++) {
		h = (h * 31 + skin.charCodeAt(i)) % 360;
	}
	return `hsl(${h}, 18%, 36%)`;
}

const SKIN_MAP: { [key: string]: string } = {
	// map avatarSkin id -> compressed pony string (use existing constants as examples)
	'kokosik-pony': KOKOSIK_PONY,
	'del-pony': DEL_PONY,
	'hika-mig-pony': HIKA_MIG_PONY,
	'aalik-pony': AALIK_PONY,
	'sofa-pony': SOFA_PONY,
	'enot-pony': ENOT_PONY,
	'lai-pony': LAI_PONY,
	'krif-pony': KRIF_PONY,
};

function toCredit(credit: Credit) {
	const skin = (credit as any).avatarSkin as string | undefined;
	const candidate = SKIN_MAP[skin || ''];
	let ponyData: any;
	if (typeof candidate === 'string') {
		try {
			ponyData = decompressPonyString(candidate);
		} catch (e) {
			// If the stored string is invalid, fall back to the offline pony
			ponyData = decompressPonyString(OFFLINE_PONY);
		}
	} else {
		ponyData = decompressPonyString(OFFLINE_PONY);
	}

	return {
		...credit,
		backgroundColor: credit.avatarBgColor || colorFromSkin(skin),
		position: 'center',
		pony: ponyData,
		avatarSkin: skin,
	} as any;
}

@Component({
	selector: 'about',
	templateUrl: 'about.pug',
	styleUrls: ['about.scss'],
})
export class About implements OnInit {
	private tinyFaceVariants = ['tinyface--alt', 'tinyface--alt2', 'tinyface--alt3', 'tinyface--alt4', 'tinyface--logo'];

	constructor(public model: Model) {}

	readonly title = document.title;
	readonly emotes = emojis;
	readonly credits = CREDITS.map(toCredit);
	readonly contributors = CONTRIBUTORS;
	readonly rewards = SUPPORTER_REWARDS_LIST;
	readonly discordLink = discordLink;
	readonly contactEmail = contactEmail;
	readonly contactDiscord = contactDiscord;
	readonly version = version;
	readonly shortVersion = shortVersion;

	ponyExcite(preview: any) {
		if (preview) {
			preview.excite();
		}
	}

	ponyReset(preview: any) {
		if (preview) {
			preview.reset();
		}
	}
	changelogResponse: any = null;

	get isPrivileged() {
		return isPrivilegedAccount(this.model.account);
	}

	private setTinyFaceVariant(elementId: string, force?: boolean) {
		const element = document.getElementById(elementId);
		if (!element) return;

		for (const className of this.tinyFaceVariants) {
			element.classList.remove(className);
		}

		if (!force) {
			const variant = this.tinyFaceVariants[Math.floor(Math.random() * this.tinyFaceVariants.length)];
			element.classList.add(variant);
		}
	}

	onTinyFaceEnter() {
		this.setTinyFaceVariant('tinyFaceAbout');
	}

	onTinyFaceLeave() {
		this.setTinyFaceVariant('tinyFaceAbout', true);
	}

	ngOnInit() {
		// Fetch changelog from server
		this.model.fetchChangelog().then(response => {
			this.changelogResponse = response;
		}).catch(err => {
			console.error('Failed to fetch changelog:', err);
		});
	}
}
