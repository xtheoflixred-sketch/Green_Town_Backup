import * as fs from 'fs';
import * as moment from 'moment';
import {
	AdminState, eventFields, BaseValues, UpdateOrigin, UserCountStats, AccountDetails, SupporterInvite,
	InternalGameServerState, InternalLoginServerState, OtherStats, Settings, GameServerSettings, ChatLogQuery
} from '../../common/adminInterfaces';
import {
	IAccount, Account, Origin, Event, iterate, ISession, Session, SupporterInvite as DBSupporterInvite,
	findAccount, ISupporterInvite, ID
} from '../db';
import { servers, serverStatus, loginServers } from '../internal';
import { encodeEvent, BaseTimes, getBaseDate, getBaseTimes } from '../adminEncoders';
import { createLiveEndPoint, LiveEndPoint } from '../liveEndPoint';
import * as paths from '../paths';
import { logger } from '../logger';
import { AdminService } from '../services/adminService';
import { loadSettings, saveSettings } from '../settings';
import { flatten } from '../../common/utils';

function encodeItems<T>(items: T[], base: BaseValues, encode: (items: T, base: BaseTimes) => any[]): any[][] {
	const baseValues = getBaseTimes(base);
	return items.map(i => encode(i, baseValues));
}

const events = createLiveEndPoint({
	model: Event,
	fields: eventFields,
	encode(items, base) {
		base.createdAt = getBaseDate(items, i => i.createdAt!);
		base.updatedAt = getBaseDate(items, i => i.updatedAt);
		return encodeItems(items, base, encodeEvent);
	},
});

export interface EndPoints {
	events: LiveEndPoint;
}

export function createEndPoints(): EndPoints {
	return { events };
}

export function getAdminState(): AdminState {
	return {
		status: serverStatus,
		loginServers: loginServers.map(s => s.state),
		gameServers: servers.map(s => s.state),
	};
}

async function forAllLoginServers(
	action: (server: InternalLoginServerState) => any, filter = (_: InternalLoginServerState) => true
) {
	await Promise.all(loginServers.filter(filter).map(action));
}

export async function forAllGameServers(
	action: (server: InternalGameServerState) => any, filter = (_: InternalGameServerState) => true
) {
	const liveServers = servers.filter(s => !s.state.dead);
	await Promise.all(liveServers.filter(filter).map(action));
}

export function actionForAllServers(action: string, accountId: string) {
	return forAllGameServers(s => s.api.action(action, accountId));
}

export function kickFromAllServers(accountId: string) {
	return forAllGameServers(s => s.api.kick(accountId, undefined));
}

export function kickFromAllServersByCharacter(characterId: string) {
	return forAllGameServers(s => s.api.kick(undefined, characterId));
}

function createFilter(id: string) {
	return (server: { id: string; }) => id === '*' || server.id === id;
}

export async function notifyUpdate(server: string) {
	await Promise.all([
		forAllLoginServers(s => s.api.updateLiveSettings({ updating: true }), createFilter(server)),
		forAllGameServers(s => s.api.notifyUpdate(), createFilter(server)),
	]);
}

export function shutdownServers(server: string, value: boolean) {
	return forAllGameServers(s => s.api.shutdownServer(value), createFilter(server));
}

export async function resetUpdating(server: string) {
	await Promise.all([
		forAllLoginServers(s => s.api.updateLiveSettings({ updating: false }), createFilter(server)),
		forAllGameServers(s => s.api.cancelUpdate(), createFilter(server)),
		shutdownServers(server, false),
	]);
}

export async function announce(message: string, type: 'admin' | 'announcement', server: string) {
	await forAllGameServers(s => s.api.announce(message, type), createFilter(server));
}

export async function reloadSettingsOnAllServers() {
	await Promise.all([
		forAllLoginServers(s => s.api.reloadSettings()),
		forAllGameServers(s => s.api.reloadSettings()),
	]);
}

function escapeSearchPattern(search: string) {
	return search
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.replace(/\./g, '\\.')
		.replace(/\*/g, '\\*')
		.replace(/\$/g, '\\*')
		.replace(/\^/g, '\\*');
}

async function readChatLogFile(filePath: string, search: string, caseInsensitive: boolean, maxLines = 8192) {
	try {
		const content = await fs.readFileAsync(filePath, 'utf8');
		const lines = content.split(/\r?\n/);
		const query = escapeSearchPattern(search);
		const regex = new RegExp(query, caseInsensitive ? 'i' : '');
		const matchingLines = lines.filter(line => regex.test(line));

		if (matchingLines.length > maxLines) {
			return `... more lines ...\n${matchingLines.slice(-maxLines).join('\n')}`;
		}

		return matchingLines.join('\n');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return '';
		}

		throw error;
	}
}

export async function getChat(search: string, date: string, caseInsensitive: boolean) {
	try {
		if (!search) {
			return '';
		}

		if (date === 'all') {
			const logsDir = paths.pathTo('logs');
			const files = (await fs.readdirAsync(logsDir))
				.filter((file: string) => /^info\.[0-9]{8}\.log$/.test(file))
				.sort()
				.map((file: string) => paths.pathTo('logs', file));
			const chunks = await Promise.all(files.map(file => readChatLogFile(file, search, caseInsensitive)));
			return chunks.filter(Boolean).join('\n');
		}

		const logFile = paths.pathTo('logs', `info.${moment(date).format('YYYYMMDD')}.log`);
		return readChatLogFile(logFile, search, caseInsensitive);
	} catch (e) {
		console.error('Failed to fetch chatlog: ', e);
		return '<error>';
	}
}

export async function getChatForAccounts(accountIds: string[], date: string) {
	const accounts: Partial<IAccount>[] = await Account.find({ _id: { $in: accountIds } }, '_id merges').lean().exec();
	const map = new Map<string, string>();
	const ids = flatten(accounts.map(a => [a._id.toString(), ...(a.merges || []).map(a => a.id)]));

	for (const a of accounts) {
		const index = accountIds.indexOf(a._id.toString());
		map.set(a._id.toString(), index ? `[${index}]` : ``);

		(a.merges || []).forEach(({ id }) => {
			map.set(id, index ? `[${index}:merged]` : `[merged]`);
		});
	}

	const chat = await getChat(ids.join('|'), date, false);
	const fixed = chat.replace(/^([0-9:]+) \[([a-f0-9]{24})\]/gmu, (_, date, id) =>
		`${date} ${map.has(id) ? map.get(id) : `[${id}]`}`);

	return fixed;
}

export async function getChatRange(query: ChatLogQuery) {
	try {
		const from = moment(query.from, 'YYYY-MM-DD', true);
		const to = moment(query.to, 'YYYY-MM-DD', true);
		if (!from.isValid() || !to.isValid() || from.isAfter(to)) return '';

		const logsDir = paths.pathTo('logs');
		const files = (await fs.readdirAsync(logsDir))
			.filter((file: string) => /^info\.[0-9]{8}\.log$/.test(file))
			.filter((file: string) => {
				const date = moment(file.slice(5, 13), 'YYYYMMDD', true);
				return date.isBetween(from, to, 'day', '[]');
			})
			.sort();

		const filters = [query.server, query.map, query.user, query.search]
			.filter(value => !!value)
			.map(value => value!.toLowerCase());
		const lines: string[] = [];
		for (const file of files) {
			const content = await fs.readFileAsync(paths.pathTo('logs', file), 'utf8');
			for (const line of content.split(/\r?\n/)) {
				const lower = line.toLowerCase();
				if (filters.every(filter => lower.includes(filter))) lines.push(line);
			}
		}

		const maxLines = 50000;
		return lines.length > maxLines ? `... more lines ...\n${lines.slice(-maxLines).join('\n')}` : lines.join('\n');
	} catch (e) {
		console.error('Failed to fetch chatlog range: ', e);
		return '<error>';
	}
}

export async function clearSessions(accountId: string) {
	const clearIds: string[] = [];

	await iterate<ISession>(Session.find({ session: { $exists: true } }).lean() as any, session => {
		try {
			if (session.session) {
				const data = JSON.parse(session.session);
				const user = data && data.passport && data.passport.user;

				if (user === accountId) {
					clearIds.push(session._id);
				}
			}
		} catch (e) {
			logger.error('Error when claring session', e, session._id, session.session);
		}
	});

	await Session.deleteOne({ _id: { $in: clearIds } }).exec();
}

export async function updateOrigin(update: UpdateOrigin) {
	await Origin.updateOne({ ip: update.ip }, update, { upsert: true }).exec();
}

export async function getUserCounts(): Promise<UserCountStats[]> {
	const statsFile = paths.pathTo('settings', `user-counts.log`);

	try {
		const content = await fs.readFileAsync(statsFile, 'utf8');
		const lines = content.trim().split(/\n/);
		return lines.map(line => JSON.parse(line));
	} catch {
		return [];
	}
}

function convertInvite(invite: ISupporterInvite): SupporterInvite {
	return {
		_id: invite._id.toString(),
		name: invite.name,
		info: invite.info,
		source: invite.source.toHexString(),
		target: invite.target.toHexString(),
		active: invite.active,
		updatedAt: invite.updatedAt,
		createdAt: invite.createdAt,
	};
}

export async function getAccountDetails(accountId: ID): Promise<AccountDetails> {
	const [account, invitesReceived, invitesSent] = await Promise.all([
		findAccount(accountId, 'merges supporterLog banLog state'),
		DBSupporterInvite.find({ target: accountId }).exec(),
		DBSupporterInvite.find({ source: accountId }).exec(),
	]);

	return account ? {
		merges: account.merges || [],
		banLog: account.banLog || [],
		supporterLog: account.supporterLog || [],
		invitesReceived: invitesReceived.map(convertInvite),
		invitesSent: invitesSent.map(convertInvite),
		state: account.state || {},
	} : {
			merges: [],
			banLog: [],
			supporterLog: [],
			invitesReceived: [],
			invitesSent: [],
			state: {},
		};
}

export async function getOtherStats(service: AdminService): Promise<OtherStats> {
	let totalIgnores = 0;
	let authsWithEmptyAccount = 0;
	let authsWithMissingAccount = 0;

	for (const account of service.accounts.items) {
		totalIgnores += account.ignoresCount!;
	}

	for (const auth of service.auths.items) {
		if (!auth.account) {
			authsWithEmptyAccount++;
		} else if (!service.accounts.get(auth.account)) {
			authsWithMissingAccount++;
		}
	}

	return {
		totalIgnores,
		authsWithEmptyAccount,
		authsWithMissingAccount,
	};
}

export async function updateServerSettings(currentSettings: Settings, update: Partial<Settings>) {
	const settings = await Promise.resolve(loadSettings());
	Object.assign(currentSettings, settings, update);

	await saveSettings(currentSettings);
	await reloadSettingsOnAllServers();
}

export async function updateGameServerSettings(
	currentSettings: Settings, serverId: string, update: Partial<GameServerSettings>
) {
	const settings = await Promise.resolve(loadSettings());
	Object.assign(currentSettings, settings);

	const serverSettings = currentSettings.servers[serverId] = currentSettings.servers[serverId] || {};
	Object.assign(serverSettings, update);

	await saveSettings(currentSettings);
	await reloadSettingsOnAllServers();
}

