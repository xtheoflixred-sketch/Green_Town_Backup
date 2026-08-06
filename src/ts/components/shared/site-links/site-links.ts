import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { faPaperPlane, faTiktok, faVk, faGoogle, faDiscord, faGithub, faFacebook, faPatreon, faDeviantart, faTwitter } from '../../../client/icons';

@Component({
	selector: 'site-links',
	templateUrl: 'site-links.pug',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteLinks {
	@Input() links: string[] = [];

	getLinkIcon(link: string) {
		const url = String(link).toLowerCase();
		if (/(?:telegram\.me|t\.me|telegram\.org|telegram\.chat)/.test(url)) return faPaperPlane;
		if (/(?:tiktok\.com|vm\.tiktok\.com|t\.iktok\.com)/.test(url)) return faTiktok;
		if (/(?:vk\.com|vkontakte\.ru|vkontakte\.com)/.test(url)) return faVk;
		if (/google\.com/.test(url)) return faGoogle;
		if (/(?:discord\.gg|discordapp\.com|discord\.com)/.test(url)) return faDiscord;
		if (/github\.com/.test(url)) return faGithub;
		if (/(?:facebook\.com|fb\.com)/.test(url)) return faFacebook;
		if (/patreon\.com/.test(url)) return faPatreon;
		if (/deviantart\.com/.test(url)) return faDeviantart;
		if (/twitter\.com/.test(url)) return faTwitter;
		return undefined;
	}
}
