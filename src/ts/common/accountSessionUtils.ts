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
