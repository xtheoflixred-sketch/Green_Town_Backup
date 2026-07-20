import { IAccount } from './db';

export type SessionEventType = 'login' | 'logout';

export function updateAccountSessionInfo(account: Partial<IAccount>, type: SessionEventType, now: Date = new Date()) {
	const timestamp = now;

	if (type === 'login') {
		account.lastVisit = timestamp;
		account.lastOnline = timestamp;
		account.lastLogin = timestamp;
	} else {
		account.lastLogout = timestamp;
		account.lastOnline = timestamp;
	}

	return account;
}
