import { IAccount } from './db';
import { UAParser } from 'ua-parser-js';

export function addLoginSession(account: Partial<IAccount>, sessionId: string, userAgent: string, now = new Date()) {
	const parsed = new UAParser(userAgent).getResult();
	const browser = parsed.browser.name || 'Browser';
	const os = parsed.os.name || 'Unknown OS';
	const deviceType = parsed.device.type || 'desktop';
	const id = `${now.getTime()}-${Math.random().toString(36).slice(2)}`;
	const loginSession = {
		id, sessionId, createdAt: now, lastSeen: now, userAgent,
		browser, browserVersion: parsed.browser.version || '',
		os, osVersion: parsed.os.version || '', deviceType,
	};
	(account as any).loginSessions = [...((account as any).loginSessions || []), loginSession].slice(-20);
	return id;
}

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
