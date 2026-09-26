import { Component, OnInit, OnDestroy } from '@angular/core';
import { ACCOUNT_NAME_MAX_LENGTH, ACCOUNT_NAME_MIN_LENGTH, HIDES_PER_PAGE, ROLE_PRIVILEGES, ROLE_DISPLAY_NAMES, ROLE_LINKS, ROLE_TAGS } from '../../../common/constants';
import { UpdateAccountData, SocialSiteInfo, OAuthProvider, HiddenPlayer, PonyInfo } from '../../../common/interfaces';
import { ROLES } from '../../../common/adminInterfaces';
import {
	toSocialSiteInfo, cleanName, supporterTitle, supporterClass, isSupporterOrPastSupporter, supporterRewards
} from '../../../client/clientUtils';
import { getRolePrivileges } from '../../../common/accountUtils';
import { getTag, getTagGradient } from '../../../common/tags';
import { oauthProviders } from '../../../client/data';
import { Model } from '../../services/model';
import { getProviderIcon } from '../../shared/sign-in-box/sign-in-box';
import { faStar, faExclamationCircle, faSync, faCopy, faDesktop, faMobile, faTablet, faQuestionCircle, faEyeSlash, faCheck, faSignOutAlt } from '../../../client/icons';
import { Router } from '@angular/router';
import { formatPlaytime } from '../../../common/utils';
import { AccountDataFlags } from '../../../common/interfaces';
import { hasFlag } from '../../../common/utils';
import { AccountSessionSummary, buildAccountSessionEntries, getActiveGameSessions, getLastGameSession } from '../../../common/accountSessionUtils';

@Component({

	selector: 'account',
	templateUrl: 'account.pug',
	styleUrls: ['account.scss'],
})
export class Account implements OnInit, OnDestroy {
	readonly refreshIcon = faSync;

	private accountInfoInterval: any;
	private sessionInfoInterval: any;
	private accountInfoRequest?: Promise<void>;
	private activeSessions: ReturnType<typeof getActiveGameSessions> = [];
	private activeSessionEntries: any[] = [];
	private activeSessionKey = '';
	private sessionEntriesCache: AccountSessionSummary[] = [];
	private sessionEntriesKey = '';
	private rolePrivilegesCache: string[] = [];
	private rolePrivilegesKey = '';
	private assignedRoleDetailsCache: any[] = [];
	private assignedRoleDetailsKey = '';
	currentTime = Date.now();
	readonly starIcon = faStar;
	readonly alertIcon = faExclamationCircle;
	readonly copyIcon = faCopy;
	readonly desktopIcon = faDesktop;
	readonly mobileIcon = faMobile;
	readonly tabletIcon = faTablet;
	readonly questionIcon = faQuestionCircle;
	readonly hiddenIcon = faEyeSlash;
	readonly checkIcon = faCheck;
	readonly signOutIcon = faSignOutAlt;
	expandedSocials = new Set<string>();
	idCopied = false;
	copiedSocialNames = new Set<string>();
	async copyId(id?: string) {
		if (!id) { return; }
		try {
			const nav = (navigator as any);
			if (nav.clipboard && nav.clipboard.writeText) {
				await nav.clipboard.writeText(id);
			} else {
				const ta = document.createElement('textarea');
				ta.value = id;
				ta.style.position = 'fixed';
				ta.style.left = '-9999px';
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				document.body.removeChild(ta);
			}
			this.idCopied = true;
			setTimeout(() => this.idCopied = false, 2000);
		} catch (e) {
			console.error('Copy failed', e);
		}
	}
	readonly providers = oauthProviders.filter(p => !p.disabled);
	readonly nameMinLength = ACCOUNT_NAME_MIN_LENGTH;
	readonly nameMaxLength = ACCOUNT_NAME_MAX_LENGTH;
	readonly hidesPerPage = HIDES_PER_PAGE;
	data: UpdateAccountData = {
		name: '',
		birthdate: '',
	};
	sites?: SocialSiteInfo[];
	password?: string;
	removingSite?: boolean;
	mergeError?: string;
	removedAccount?: boolean;
	accountError?: string;
	accountSaved = false;
	supporterCode = '';
	supporterCodeError = '';
	supporterCodeSuccess = '';
	isNewAccount = false;
	hides: HiddenPlayer[] | undefined = undefined;
	page = 0;
	constructor(private model: Model, private router: Router) {
	}
	ngOnInit() {
		const account = this.account!;
		this.sites = account.sites && account.sites.map(toSocialSiteInfo);
		this.data = {
			name: account.name,
			birthdate: account.birthdate,
		};
		this.isNewAccount = account.birthdate === '';

		this.pageChanged();

		this.updateSessionInfo();
		this.sessionInfoInterval = setInterval(() => this.updateSessionInfo(), 1000);
		this.accountInfoInterval = setInterval(() => this.refreshAccountInfo(), 30000);
	}
	ngOnDestroy() {
		this.model.mergedAccount = false;
		if (this.accountInfoInterval) {
			clearInterval(this.accountInfoInterval);
		}
		if (this.sessionInfoInterval) {
			clearInterval(this.sessionInfoInterval);
		}
	}
	private refreshAccountInfo() {
		if (this.accountInfoRequest) return;
		this.accountInfoRequest = this.model.getAccount().then(account => {
			if (!account || 'limit' in account) return;
			this.model.account = account;
			this.model.ponies = account.ponies || [];
			this.sites = account.sites && account.sites.map(toSocialSiteInfo);
		}).catch(() => { /* keep the last visible account data */ }).then(() => {
			this.accountInfoRequest = undefined;
		});
	}
	private updateSessionInfo() {
		this.currentTime = Date.now();
		const account = this.account;
		this.activeSessions = account ? getActiveGameSessions(account.id, this.currentTime) : [];
		const sessionKey = this.activeSessions.map(session => `${session.id}:${session.startedAt}`).join('|');
		if (sessionKey !== this.activeSessionKey) {
			this.activeSessionKey = sessionKey;
			this.activeSessionEntries = this.activeSessions.map(session => ({
				gameSessionId: session.id,
				title: 'Other active session',
				subtitle: 'Game session',
				detail: `Started ${new Date(session.startedAt).toLocaleString()}`,
				location: 'This account',
				authoritative: true,
				icon: 'desktop',
			}));
		}
	}
	pageChanged() {
		this.model.getHides(this.page)
			.then(result => this.hides = result);
	}
	get authError() {
		return this.model.authError;
	}
	get mergedAccount() {
		return this.model.mergedAccount;
	}
	get account() {
		return this.model.account;
	}

	get displayPlaytime() {
		const acc = this.account;
		if (!acc || acc.playtimeSeconds == null) return '';
		return this.formatPlaytime(acc.playtimeSeconds);
	}
	get displayLastGameEntry() {
		const value = this.model.ponies
			.map(pony => pony.lastUsed)
			.filter((lastUsed): lastUsed is string => !!lastUsed)
			.sort((a, b) => Number(new Date(b)) - Number(new Date(a)))[0];
		if (!value) return '-';
		const timestamp = new Date(value).getTime();
		const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
		if (elapsedSeconds < 3600) {
			const minutes = Math.floor(elapsedSeconds / 60);
			return `${minutes} min ago`;
		}
		return new Date(value).toLocaleString();
	}
	get displayLastSessionPlaytime() {
		const account = this.account;
		let seconds = account && account.lastSessionSeconds;
		if (account) {
			const storedSession = getLastGameSession(account.id);
			if (storedSession != null) seconds = storedSession;
		}
		if (seconds == null && account && account.lastLogin && account.lastLogout) {
			seconds = Math.max(0, Math.round((new Date(account.lastLogout).getTime() - new Date(account.lastLogin).getTime()) / 1000));
		}
		if (seconds == null) return '-';
		return this.formatPlaytime(seconds);
	}
	get displayCurrentSessionPlaytime() {
		const account = this.account;
		if (!account) return '-';
		const sessions = this.activeSessions;
		if (!sessions.length) {
			const lastSession = getLastGameSession(account.id);
			return lastSession == null ? '-' : this.formatPlaytime(lastSession);
		}
		const seconds = sessions.reduce((total, session) => total + Math.max(0, Math.floor((this.currentTime - session.startedAt) / 1000)), 0);
		return this.formatPlaytime(seconds);
	}
	get displayPlaytimeWithActiveSessions() {
		return this.formatPlaytime(this.totalPlaytimeSeconds);
	}
	get totalPlaytimeSeconds() {
		const account = this.account;
		const stored = account && account.playtimeSeconds;
		if (stored == null) return undefined;
		const currentSeconds = this.activeSessions
			.reduce((total, session) => total + Math.max(0, Math.floor((this.currentTime - session.startedAt) / 1000)), 0);
		return stored + currentSeconds;
	}
	get supporter() {
		return this.model.supporter;
	}
	get showSupporter() {
		return isSupporterOrPastSupporter(this.account);
	}
	get isPastSupporter() {
		return !!this.account && hasFlag(this.account.flags, AccountDataFlags.PastSupporter) && !this.supporter;
	}
	get canSubmit() {
		return this.account && this.data.name && !!cleanName(this.data.name).length;
	}
	get supporterTitle() {
		return supporterTitle(this.account);
	}
	get supporterClass() {
		return supporterClass(this.account);
	}
	commandClass(level: number) {
		return `supporter-${level}`;
	}
	get supporterRewards() {
		return supporterRewards(this.account) || [];
	}
	redeemSupporterCode() {
		const code = this.supporterCode.trim();
		if (!code) return;
		this.supporterCodeError = '';
		this.supporterCodeSuccess = '';
		this.model.redeemSupporterCode(code)
			.then(() => {
				this.supporterCode = '';
				this.supporterCodeSuccess = 'Supporter access activated';
			})
			.catch(error => this.supporterCodeError = error && error.message || 'Unable to redeem supporter code');
	}
	get rolePrivileges() {
		const roles = this.account && this.account.roles || [];
		const key = roles.join('|');
		if (key !== this.rolePrivilegesKey) {
			this.rolePrivilegesKey = key;
			this.rolePrivilegesCache = getRolePrivileges(this.account);
		}
		return this.rolePrivilegesCache;
	}
	get assignedRoleDetails() {
		const roles = this.account && this.account.roles || [];
		const key = roles.join('|');
		if (key === this.assignedRoleDetailsKey) {
			return this.assignedRoleDetailsCache;
		}
		this.assignedRoleDetailsKey = key;
		this.assignedRoleDetailsCache = ROLES.filter(role => roles.includes(role)).map(role => {
			const tagColor = this.getRoleTagColor(role);
			const gradient = getTagGradient(role);
			const tagStyle = gradient ? {
				background: `linear-gradient(${gradient.direction === 'vertical' ? 'to bottom' : 'to right'}, #${gradient.start}, #${gradient.end})`,
				color: '#fff',
			} : { 'background-color': tagColor };
			return {
			id: role,
			name: ROLE_DISPLAY_NAMES[role] || role,
			tag: getTag(role),
			privileges: ROLE_PRIVILEGES[role] || [],
			links: ROLE_LINKS[role] || [],
			tags: ROLE_TAGS[role] || [],
			tagStyle,
			borderLeft: `4px solid ${tagColor}`,
			background: `linear-gradient(100deg, ${tagColor}12, rgba(255,255,255,.035) 42%)`,
		};
		});
		return this.assignedRoleDetailsCache;
	}
	getRoleTagColor(role: string) {
		const tag = getTag(role);
		return tag ? `#${((tag.color >>> 8) & 0xffffff).toString(16).padStart(6, '0')}` : undefined;
	}
	getRoleLinks(role: string) {
		return ROLE_LINKS[role] || [];
	}
	get supporterPonyInfo(): PonyInfo | undefined {
		return this.showSupporter ? this.model.pony.ponyInfo : undefined;
	}
	get supporterPonyTag(): string {
		if (this.supporter > 0) {
			return `sup${this.supporter}`;
		}
		return '';
	}
	get showSupporterTag(): boolean {
		return !!this.supporterPonyTag;
	}
	get supporterPonyName(): string {
		return this.showSupporter ? this.model.pony.name : '';
	}
	get showSupporterInfo() {
		const account = this.account;
		return !!(!this.supporter && account && account.sites && account.sites.some(s => s.provider === 'patreon'));
	}
	get showAccountAlert() {
		return this.model.missingBirthdate;
	}
	get saveButtonText() {
		return this.isNewAccount ? 'Save and continue' : 'Save';
	}
	get sessionEntries() {
		const account = this.account;
		const sessionAccount = account as { lastVisit?: string; lastLogin?: string; lastLogout?: string; lastUserAgent?: string } | undefined;
		const loginSessions = (account as any && (account as any).loginSessions || []) as any[];
		const loginSessionKey = loginSessions.map(session => `${session.id}:${session.lastSeen}:${session.current}`).join('|');
		const key = sessionAccount ? [sessionAccount.lastVisit, sessionAccount.lastLogin, sessionAccount.lastLogout, sessionAccount.lastUserAgent, navigator.userAgent, loginSessionKey].join('|') : '';
		if (key !== this.sessionEntriesKey) {
			this.sessionEntriesKey = key;
			this.sessionEntriesCache = buildAccountSessionEntries(account || {}, navigator.userAgent);
			const loginSessions = (account as any && (account as any).loginSessions || []) as any[];
			const loginSessionEntries: AccountSessionSummary[] = loginSessions.map(session => ({
				loginSessionId: session.id,
				current: !!session.current,
				title: session.current ? 'Current session' : 'Other browser session',
				subtitle: `${session.browser || 'Browser'}${session.browserVersion ? ` ${session.browserVersion}` : ''} · ${session.os || 'Unknown OS'}${session.osVersion ? ` ${session.osVersion}` : ''}`,
				detail: session.lastSeen ? `Last activity ${new Date(session.lastSeen).toLocaleString()}` : 'Activity not recorded yet',
				location: 'Account login',
				authoritative: true,
				deviceType: session.deviceType === 'mobile' ? 'mobile' : session.deviceType === 'tablet' ? 'tablet' : 'desktop',
				icon: session.deviceType === 'mobile' ? 'mobile' : session.deviceType === 'tablet' ? 'tablet' : 'desktop',
			}));
			this.sessionEntriesCache = this.sessionEntriesCache.concat(loginSessionEntries);
		}
		return this.sessionEntriesCache;
	}
	get allSessionEntries() {
		return this.sessionEntries.concat(this.activeSessionEntries);
	}
	revokeSession(sessionId: string) {
		if (!sessionId) return;
		this.model.revokeAccountSession(sessionId)
			.then(() => this.refreshAccountInfo());
	}
	getSessionIcon(summary: any) {
		if (summary.icon === 'mobile') return this.mobileIcon;
		if (summary.icon === 'tablet') return this.tabletIcon;
		if (summary.icon === 'desktop') return this.desktopIcon;
		return this.questionIcon;
	}
	icon(id: string) {
		return getProviderIcon(id);
	}
	formatPlaytime(seconds?: number) {
		return formatPlaytime(seconds);
	}
	submit() {
		if (this.canSubmit) {
			this.resetAllMessages();
			this.data.name = cleanName(this.data.name).substr(0, ACCOUNT_NAME_MAX_LENGTH);
			this.model.updateAccount(this.data)
				.then(() => this.accountSaved = true)
				.catch((e: Error) => this.accountError = e.message);
			if (this.isNewAccount) {
				this.router.navigate(['home']);
			}
		}
	}
	removeSite(site: SocialSiteInfo) {
		if (confirm('Are you sure you want to remove this social account ?')) {
			this.removingSite = true;
			this.resetAllMessages();
			this.model.removeSite(site.id)
				.then(() => this.sites = this.account!.sites!.map(toSocialSiteInfo))
				.then(() => this.removedAccount = true)
				.catch((e: Error) => this.mergeError = e.message)
				.then(() => this.removingSite = false);
		}
	}
	connectSite(provider: OAuthProvider) {
		this.model.connectSite(provider);
	}
	private resetAllMessages() {
		this.accountSaved = false;
		this.mergeError = undefined;
		this.accountError = undefined;
		this.removedAccount = false;
		this.model.authError = undefined;
		this.model.mergedAccount = false;
	}
	unhidePlayer(player: HiddenPlayer) {
		this.model.unhidePlayer(player.id)
			.then(() => this.pageChanged())
			.catch((e: Error) => console.error(e));
	}
	toggleSocialExpanded(siteId: string) {
		if (this.expandedSocials.has(siteId)) {
			this.expandedSocials.delete(siteId);
		} else {
			this.expandedSocials.add(siteId);
		}
	}
	isSocialExpanded(siteId: string): boolean {
		return this.expandedSocials.has(siteId);
	}
	navigateToSocial(site: SocialSiteInfo) {
		if (site.icon !== 'discord' && site.url) {
			window.open(site.url, '_blank', 'noopener noreferrer');
		}
	}
	getSocialIcon(icon: string) {
		const resolved = getProviderIcon(icon);
		return resolved || this.hiddenIcon;
	}
	async copySocialName(name: string, siteId: string) {
		try {
			const nav = (navigator as any);
			if (nav.clipboard && nav.clipboard.writeText) {
				await nav.clipboard.writeText(name);
			} else {
				const ta = document.createElement('textarea');
				ta.value = name;
				ta.style.position = 'fixed';
				ta.style.left = '-9999px';
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				document.body.removeChild(ta);
			}
			this.copiedSocialNames.add(siteId);
			setTimeout(() => this.copiedSocialNames.delete(siteId), 1000);
		} catch (e) {
			console.error('Copy failed', e);
		}
	}
	isSocialNameCopied(siteId: string): boolean {
		return this.copiedSocialNames.has(siteId);
	}
}
