import { UAParser } from 'ua-parser-js';

export interface AccountSessionSummary {
	title: string;
	subtitle: string;
	detail: string;
	deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
	icon: 'desktop' | 'mobile' | 'tablet' | 'question';
	location: string;
	authoritative: boolean;
}

export interface ActiveGameSession {
	startedAt: number;
	updatedAt: number;
}

export const GAME_SESSION_KEY_PREFIX = 'pony-town-game-session:';
export const LAST_GAME_SESSION_KEY_PREFIX = 'pony-town-last-game-session:';
const GAME_SESSION_TIMEOUT = 10000;

export function setActiveGameSession(accountId: string, id: string, startedAt: number) {
	localStorage.setItem(`${GAME_SESSION_KEY_PREFIX}${accountId}:${id}`, JSON.stringify({ startedAt, updatedAt: Date.now() }));
}

export function removeActiveGameSession(accountId: string, id: string, startedAt: number) {
	localStorage.removeItem(`${GAME_SESSION_KEY_PREFIX}${accountId}:${id}`);
	localStorage.setItem(`${LAST_GAME_SESSION_KEY_PREFIX}${accountId}`, JSON.stringify({
		seconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
		endedAt: Date.now(),
	}));
}

export function getActiveGameSessions(accountId: string, now = Date.now()): ActiveGameSession[] {
	const sessions: ActiveGameSession[] = [];
	for (let index = 0; index < localStorage.length; index++) {
		const key = localStorage.key(index);
		if (!key || !key.startsWith(`${GAME_SESSION_KEY_PREFIX}${accountId}:`)) continue;
		try {
			const session = JSON.parse(localStorage.getItem(key) || '') as ActiveGameSession;
			if (now - session.updatedAt <= GAME_SESSION_TIMEOUT) {
				sessions.push(session);
			} else {
				localStorage.removeItem(key);
			}
		} catch {
			localStorage.removeItem(key);
		}
	}
	return sessions;
}

export function getLastGameSession(accountId: string): number | undefined {
	try {
		const value = JSON.parse(localStorage.getItem(`${LAST_GAME_SESSION_KEY_PREFIX}${accountId}`) || '') as { seconds?: number };
		return value.seconds;
	} catch {
		return undefined;
	}
}

export function buildAccountSessionSummary(account: { lastVisit?: string; lastLogin?: string; lastLogout?: string; lastUserAgent?: string }, currentUserAgent?: string): AccountSessionSummary {
	const userAgent = currentUserAgent || account.lastUserAgent || '';
	const parser = new UAParser(userAgent);
	const { browser, os, device } = parser.getResult();
	const lastActivity = account.lastLogin || account.lastVisit || account.lastLogout || '';
	const isMobile = !!(device.type && ['mobile', 'tablet'].includes(device.type));
	const deviceType = device.type === 'mobile' ? 'mobile' : device.type === 'tablet' ? 'tablet' : 'desktop';
	const browserName = browser.name || 'Browser';
	const browserVersion = browser.version ? ` ${browser.version}` : '';
	const osName = os.name ? ` · ${os.name}` : '';
	const defaultTitle = isMobile ? 'Mobile session' : 'Current device';
	const subtitle = `${browserName}${browserVersion}${osName}`.trim();
	const detail = lastActivity ? `Last visit ${new Date(lastActivity).toLocaleString()}` : 'Last visit not recorded yet';
	const location = 'Your current location';

	return {
		title: defaultTitle,
		subtitle,
		detail,
		deviceType: deviceType || 'unknown',
		icon: deviceType === 'mobile' ? 'mobile' : deviceType === 'tablet' ? 'tablet' : 'desktop',
		location,
		authoritative: true,
	};
}

export function buildAccountSessionEntries(account: { lastVisit?: string; lastLogin?: string; lastLogout?: string; lastUserAgent?: string }, currentUserAgent?: string): AccountSessionSummary[] {
	const entries: AccountSessionSummary[] = [buildAccountSessionSummary(account, currentUserAgent)];
	if (account.lastLogout && account.lastLogin && account.lastLogout !== account.lastLogin) {
		entries.push({
			...buildAccountSessionSummary({ ...account, lastLogin: account.lastLogout, lastLogout: undefined }, currentUserAgent),
			title: 'Previous session',
			detail: `Last logout ${new Date(account.lastLogout).toLocaleString()}`,
			authoritative: true,
		});
	}
	return entries;
}
