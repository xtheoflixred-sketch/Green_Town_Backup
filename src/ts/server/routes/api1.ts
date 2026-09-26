import { Router } from 'express';
import { noop } from 'lodash';
import { findAllCharacters, findAllVisibleAuths, IAccount, Account } from '../db';
import { offline, hash, handleJSON } from '../requestUtils';
import { createGetAccountData } from '../api/account';
import { Settings, ServerConfig } from '../../common/adminInterfaces';
import { includes } from '../../common/utils';

const blockApps: string[] = [];
const MAX_CONCURRENT_REQUESTS = 100;
let requests = 0;

export default function (server: ServerConfig, settings: Settings) {
	const app = Router();

	const getAccountData = createGetAccountData(findAllCharacters, findAllVisibleAuths);

	async function handleAccountRequest(account: IAccount, userAgent?: string, browserId?: string, sessionId?: string) {
		if (requests < MAX_CONCURRENT_REQUESTS) {
			requests++;

			try {
				const lastUserAgent = userAgent || account.lastUserAgent;
				const lastBrowserId = browserId || account.lastBrowserId;

				if ((lastUserAgent && account.lastUserAgent !== lastUserAgent) ||
					(lastBrowserId && account.lastBrowserId !== lastBrowserId)) {
					account.lastUserAgent = lastUserAgent;
					account.lastBrowserId = lastBrowserId;
					Account.updateOne({ _id: account._id }, { lastUserAgent, lastBrowserId }, noop);
				}
				const loginSession = ((account as any).loginSessions || []).find((session: any) => session.sessionId === sessionId);
				if (loginSession) {
					loginSession.lastSeen = new Date();
					Account.updateOne({ _id: account._id, 'loginSessions.id': loginSession.id }, { $set: { 'loginSessions.$.lastSeen': loginSession.lastSeen } }, noop);
				}
				(account as any).__currentSessionId = sessionId;

				return await getAccountData(account);
			} finally {
				requests--;
			}
		} else {
			return { limit: true };
		}
	}

	app.post('/account', offline(settings), hash, (req, res) => {
		req.session!.touch();

		let account = req.user as IAccount | undefined;
		const browserId = req.get('Api-Bid');
		const userAgent = req.get('User-Agent') || '';
		const requestedWith = req.get('X-Requested-With');
		const isWebViewUserAgent = /Chrome\/\d+\.0\.0\.0 Mobile|; wv\)/.test(userAgent);
		const isWebView = requestedWith || isWebViewUserAgent;

		if (!account || (settings.blockWebView && isWebView && includes(blockApps, requestedWith))) {
			handleJSON(server, req, res, null);
		} else {
			handleJSON(server, req, res, handleAccountRequest(account, userAgent, browserId, req.sessionID));
		}
	});

	app.post('/account/sessions/revoke', offline(settings), hash, (req, res) => {
		const account = req.user as IAccount | undefined;
		const sessionId = req.body && req.body.id;
		const sessions = account && (account as any).loginSessions || [];
		const session = sessions.find((value: any) => value.id === sessionId);
		if (!account || !session || session.sessionId === req.sessionID) {
			return res.status(400).json({ error: 'Invalid session' });
		}
		const store = (req as any).sessionStore;
		if (!store) {
			return res.status(500).json({ error: 'Session store unavailable' });
		}
		return store.destroy(session.sessionId, (error: any) => {
			if (error) {
				return res.status(500).json({ error: 'Unable to revoke session' });
			}
			(account as any).loginSessions = sessions.filter((value: any) => value.id !== sessionId);
			return account.save().then(() => res.json({ success: true })).catch(() => res.status(500).json({ error: 'Unable to save account' }));
		});
	});

	return app;
}
