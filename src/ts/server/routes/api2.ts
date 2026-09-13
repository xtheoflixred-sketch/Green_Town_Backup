import { Router } from 'express';
import { GameStatus, ServerInfo, ServerInfoShort } from '../../common/interfaces';
import { InternalGameServerState, Settings, ServerLiveSettings } from '../../common/adminInterfaces';
import { createLoginServerStatus } from '../api/internal-login';
import { Account } from '../db';
import { offline } from '../requestUtils';
import { servers } from '../internal';
import { version } from '../config';
import { isServerOffline } from '../serverUtils';
import { StatsTracker } from '../stats';
import { MIN_ADULT_AGE } from '../../common/constants';
import { CHANGELOG_PUBLIC, CHANGELOG_DEV } from '../../generated/changelog';
import { isDevChangelogVisible } from '../../common/changelogUtils';
import { auth } from '../requestUtils';
import { isMod } from '../../common/accountUtils';
import { World, findClientByAccountId } from '../world';
import { teleportTo } from '../playerUtils';
import { formatHourMinutes } from '../../common/timeUtils';

function isServerSafe(server: InternalGameServerState) {
	return server.state.alert !== '18+';
}

function toServerState(server: InternalGameServerState): ServerInfo {
	const { name, path, desc, flag, flags, alert, online, settings, require, host } = server.state;

	return {
		id: server.id,
		name,
		path,
		desc,
		host,
		flag,
		flags,
		alert,
		dead: false,
		online,
		offline: isServerOffline(server),
		filter: !!settings.filterSwears,
		require,
	};
}

function toServerStateShort(server: InternalGameServerState): ServerInfoShort {
	return {
		id: server.id,
		online: server.state.online,
		offline: isServerOffline(server),
	};
}

function getGameStatus(
	servers: InternalGameServerState[], live: ServerLiveSettings, short: boolean, age: number
): GameStatus {
	const adult = age >= MIN_ADULT_AGE;

	return {
		version,
		update: live.updating ? true : undefined,
		servers: servers
			.filter(s => isServerSafe(s) || adult)
			.map(short ? toServerStateShort : toServerState),
	};
}

export default function (settings: Settings, live: ServerLiveSettings, statsTracker: StatsTracker, world?: World) {
	const app = Router();
	const modOnly = (req: any, res: any, next: any) => {
		const account = req.user as any;
		if (!account || !isMod(account)) {
			return res.sendStatus(403);
		}
		next();
	};

	app.get('/game/status', offline(settings), (req, res) => {
		const status = getGameStatus(servers, live, req.query.short === 'true', req.query.d | 0);
		res.json(status);
		statsTracker.logRequest(req, status);
	});

	app.get('/game/login-status', offline(settings), (_, res) => {
		(async () => {
			const status = createLoginServerStatus(settings, live);
			// if there are no accounts in DB, always enable mock login
			let accountCount = 0;
			try {
				accountCount = await Account.countDocuments().exec();
			} catch (e) {
				accountCount = 0;
			}

			res.json({
				showTestingWarning: !!status.showTestingWarning,
				mockLoginEnabled: !!status.mockLoginEnabled || accountCount === 0,
			});
		})();
	});

	app.get('/mod/teleport-players', auth, modOnly, (_req, res) => {
		if (!world) {
			res.json([]);
			return;
		}

		res.json(world.clients.map(client => ({
			id: client.accountId,
			accountName: client.accountName,
			name: client.characterName,
			mapName: client.map.id || 'Unknown map',
			ponyInfo: typeof client.pony.info === 'string' ? client.pony.info : undefined,
		})));
	});

	app.get('/mod/time', auth, modOnly, (_req, res) => {
		if (!world) {
			res.sendStatus(503);
			return;
		}

		res.json({ time: world.time, formattedTime: formatHourMinutes(world.time), ...world.getTimeStatus() });
	});

	app.post('/mod/time', auth, modOnly, (req, res) => {
		if (!world) {
			res.sendStatus(503);
			return;
		}

		const body = req.body || {};
		const action = String(body.action || '');
		const hour = Number(body.hour);
		if (action === 'set' && (!isFinite(hour) || hour < 0 || hour >= 24)) {
			res.status(400).json({ error: 'Time must be between 00:00 and 23:59' });
			return;
		}

		switch (action) {
			case 'set':
				world.setTime(hour);
				break;
			case 'freeze':
				if (isFinite(hour) && hour >= 0 && hour < 24) world.freezeTimeAtHour(hour);
				else world.freezeTime();
				break;
			case 'resume':
				world.unfreezeTime();
				break;
			case 'day':
				world.freezeTimeAtHour(12, 'day');
				break;
			case 'night':
				world.freezeTimeAtHour(0, 'night');
				break;
			default:
				res.status(400).json({ error: 'Unknown time action' });
				return;
		}

		res.json({ time: world.time, formattedTime: formatHourMinutes(world.time), ...world.getTimeStatus() });
	});

	app.post('/mod/teleport-players', auth, modOnly, (req, res) => {
		if (!world) {
			res.sendStatus(503);
			return;
		}

		const body = req.body || {};
		const admin = findClientByAccountId(world, (req.user as any)._id.toString());
		const action = body.action as 'self' | 'bring' | 'players-to-target' | 'group';
		const target = body.targetId ? findClientByAccountId(world, String(body.targetId)) : undefined;
		const selectedIds = Array.isArray(body.playerIds) ? body.playerIds.map(String) : [];
		const selected = world.clients.filter(client => selectedIds.indexOf(client.accountId) !== -1);

		if (!admin || (action !== 'bring' && !target) || (action !== 'self' && !selected.length && !body.selectAll)) {
			res.sendStatus(400);
			return;
		}

		const destination = action === 'bring' ? admin : target!;
		const sources = action === 'self'
			? [admin]
			: (body.selectAll
				? world.clients.filter(client => client !== destination)
				: selected.filter(client => client !== destination));
		if (action === 'group') {
			if (sources.indexOf(admin) === -1) {
				sources.push(admin);
			}
		}

		for (const source of sources) {
			if (source.map !== destination.map) {
				world.switchToMap(source, destination.map, destination.pony.x, destination.pony.y);
			} else {
				teleportTo(source, destination.pony.x, destination.pony.y);
			}
		}
		res.sendStatus(204);
		return;
	});

	app.post('/csp', offline(settings), (_, res) => {
		//logger.warn('CSP report', getIPFromRequest(req), req.body['csp-report']);
		res.sendStatus(200);
	});

	app.get('/changelog', offline(settings), (req, res) => {
		const account = req.user as any;
		res.json({
			public: CHANGELOG_PUBLIC,
			dev: isDevChangelogVisible(account) ? CHANGELOG_DEV : [],
		});
	});

	return app;
}
