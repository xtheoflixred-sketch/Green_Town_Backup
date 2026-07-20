import { RequestHandler } from 'express';
import { Account, Character } from '../db';
import { createCharacter } from './ponies';
import { compressPonyString } from '../../common/compressPony';
import { createDefaultPony } from '../../common/ponyInfo';

export const getMockAccounts: RequestHandler = async (_req, res, next) => {
	try {
		// include lastCharacter so we can fetch stored pony data for portraits
		const accounts = await Account.find({}, '_id name lastVisit lastCharacter').sort({ lastVisit: -1 }).limit(30).lean().exec() as Array<{ _id: any; name?: string; lastVisit?: Date; lastCharacter?: any }>;

		// Collect character ids referenced by accounts
		const charIds = accounts.map(a => a.lastCharacter).filter(Boolean) as any[];
		let charMap: Record<string, any> = {};
		if (charIds.length) {
			const chars = await Character.find({ _id: { $in: charIds } }, '_id info').lean().exec();
			charMap = chars.reduce((m: Record<string, any>, c: any) => {
				m[c._id.toString()] = c;
				return m;
			}, {});
		}

		res.json(accounts.map((account: { _id: any; name?: string; lastVisit?: Date; lastCharacter?: any }) => ({
			id: account._id.toString(),
			name: account.name || `Account ${account._id.toString().slice(-6)}`,
			lastVisit: account.lastVisit ? account.lastVisit.toISOString() : undefined,
			ponyInfo: account.lastCharacter ? (charMap[account.lastCharacter.toString()] && charMap[account.lastCharacter.toString()].info) : undefined,
		})));
	} catch (error) {
		// log and return error to help debugging client-side failures
		// eslint-disable-next-line no-console
		console.error('mock-login:createMockAccount error', error && (error.stack || error));
		try {
			res.status(500).json({ error: (error && (error.message || String(error))) || 'Unknown error' });
		} catch (e) {
			next(error);
		}
	}
};

export const createMockAccount: RequestHandler = async (_req, res, next) => {
	try {
		const { id, name, birthdate, ponyName } = _req.body as { id?: string; name?: string; birthdate?: string; ponyName?: string };
		const accountName = name ? String(name).trim() : `Player ${Math.random().toString(36).slice(2, 8)}`;
		const createData: any = {
			name: accountName,
			birthdate: birthdate ? new Date(birthdate) : undefined,
			lastVisit: new Date(),
		};
		if (id) {
			createData._id = String(id).trim();
		}
		const acc = await Account.create(createData);

		// create a character for the account so portraits can render
		let ponyInfo: any = undefined;
		try {
			const pony = ponyName ? String(ponyName).trim() : `${accountName}'s Pony`;
			await createCharacter(acc._id.toString(), pony, compressPonyString(createDefaultPony()));
			// fetch latest character and return a similar shape as getMockAccounts
			const characters = await Character.find({ account: acc._id }, '_id info').sort('-lastUsed').limit(1).lean().exec();
			ponyInfo = characters && characters[0] && characters[0].info;
		} catch (e) {
			// If character creation fails, log but continue — return account without ponyInfo
			// eslint-disable-next-line no-console
			console.error('mock-login:createCharacter failed', e && (e.stack || e));
			ponyInfo = undefined;
		}

		res.json({
			id: acc._id.toString(),
			name: acc.name || `Account ${acc._id.toString().slice(-6)}`,
			lastVisit: acc.lastVisit ? acc.lastVisit.toISOString() : undefined,
			ponyInfo,
		});
	} catch (error) {
		// log and return error to help debugging client-side failures
		// eslint-disable-next-line no-console
		console.error('mock-login:createMockAccount error', error && (error.stack || error));
		try {
			res.status(500).json({ error: (error && (error.message || String(error))) || 'Unknown error' });
		} catch (e) {
			next(error);
		}
	}
};
