import { range, compact, escapeRegExp, random } from 'lodash';
// Speed and time command fixes
import {
	MessageType, ChatType, Expression, Eye, Muzzle, Action, Weather, toAnnouncementMessageType, EntityState, TileType,
} from '../common/interfaces';
import { hasRole } from '../common/accountUtils';
import { butterfly, bat, firefly, cloud, getEntityType, getEntityTypeName, createAnEntity, getEntityTypesAndNames, woodenWalls, BunnyAnimation } from '../common/entities';
import { emojis } from '../client/emoji';
import { mockPaletteManager } from '../common/ponyInfo';
import { IClient, ServerEntity, ServerMap } from './serverInterfaces';
import { World } from './world';
import { NotificationService } from './services/notification';
import { UserError } from './userError';
import { parseExpression, expression } from '../common/expressionUtils';
import { filterBadWords } from '../common/swears';
import { randomString } from '../common/stringUtils';
import {
	getCounter, holdToy, getCollectedToysCount, getCollectedToysList, holdItem, rareHoldTypeNames, playerSleep, playerBlush, playerLove, playerCry,
	setEntityExpression, execAction, teleportTo, openGift
} from './playerUtils';
import { updateEntityOptions, setEntityAnimation, updateEntityVelocity } from './entityUtils';
import { ServerLiveSettings, GameServerSettings } from '../common/adminInterfaces';
import { isCommand, processCommand, clamp, flatten, includes, randomPoint, parseSeason, parseHoliday, toInt, formatPlaytime, formatISODate, hasFlag } from '../common/utils';
import { formatHourMinutes } from '../common/timeUtils';
import { createNotifyUpdate, createShutdownServer } from './api/internal';
import { logger } from './logger';
import { pathTo } from './paths';
import { sayTo, sayToEveryone, sayToOthers, sayToAll, saySystem } from './chat';
import { resetTiles } from './serverRegion';
import { updateAccountState } from './accountUtils';
import {
	findEntities, updateMapState, loadMapFromFile, saveMapToFile, saveEntitiesToFile, loadEntitiesFromFile,
	removeEntitiesFromFile, getSizeOfMap, saveMapToFileBinaryAlt, saveRegionCollider, saveMap, loadMap
} from './serverMap';
import { PARTY_LIMIT, tileWidth, tileHeight, MAP_LOAD_SAVE_TIMEOUT } from '../common/constants';
import { PartyService } from './services/party';
import { getRegionGlobal } from '../common/worldMap';
import { swapCharacter } from './characterUtils';
import { writeFileAsync } from 'fs';
import { Account } from './db';
import { defaultHouseSave, removeToolbox, restoreToolbox } from './maps/houseMap';
import { createFollowerBunny } from './mapUtils';

const HOUSE_WALL_TOP = 3;
const HOUSE_WALL_Y_OFFSET = 3 / tileHeight;
const HOUSE_H_WALL_TYPES = [
	woodenWalls.wallH(0, 0).type,
	woodenWalls.wallHShort(0, 0).type,
	woodenWalls.wallCutL(0, 0).type,
	woodenWalls.wallCutR(0, 0).type,
];
const HOUSE_V_WALL_TYPES = [
	woodenWalls.wallV(0, 0).type,
	woodenWalls.wallVShort(0, 0).type,
];

const defaultBunnyRadius = 1.0;
const defaultBunnyCount = 5;
const maxBunnyCount = 1000;
const minBunnyRadius = 0.1;
const maxBunnyRadius = 15.0;
const summonedBunnies = new WeakMap<IClient, ServerEntity[]>();
const freeBunnies = new WeakMap<IClient, ServerEntity[]>();
const bunnyOptions = new WeakMap<IClient, { count: number; radius: number; mode: 'circle' | 'stay' | 'free'; shape: 'none' | 'circle' | 'triangle' | 'square' | 'diamond' | 'heart' }>();
const armyBattleStates = new WeakMap<IClient, { attacker: IClient; defender: IClient; attackerBunnies: ServerEntity[]; defenderBunnies: ServerEntity[]; settings: GameServerSettings; completed: boolean; outcome: 'attacker' | 'defender' | 'draw'; }>();

function resetMovementTracking(client: IClient) {
	client.lastX = client.pony.x;
	client.lastY = client.pony.y;
	client.lastVX = 0;
	client.lastVY = 0;
	client.lastTime = Date.now();
}

function getBunnyOptions(client: IClient) {
	let options = bunnyOptions.get(client);

	if (!options) {
		options = { count: defaultBunnyCount, radius: defaultBunnyRadius, mode: 'circle', shape: 'none' };
		bunnyOptions.set(client, options);
	}

	return options;
}

function findArmyTargetClient(world: World, query: string, excludeClient?: IClient) {
	const normalized = query.trim().toLowerCase();
	if (!normalized) {
		return undefined;
	}

	return world.clients.find(client => {
		if (excludeClient && client === excludeClient) {
			return false;
		}

		const accountName = (client.accountName || '').toLowerCase();
		const ponyName = (client.pony.name || '').toLowerCase();
		return accountName === normalized || ponyName === normalized || accountName.includes(normalized) || ponyName.includes(normalized);
	});
}

const MAX_REPEAT_COUNT = 10;

function parseRepeatCount(args: string): { count: number; rest: string } {
	const match = args.trim().match(/^(\d+)\s*(.*)/);
	if (match) {
		const count = clamp(parseInt(match[1], 10), 1, MAX_REPEAT_COUNT);
		return { count, rest: match[2] };
	}
	return { count: 1, rest: args };
}

function repeatAction(client: IClient, action: Action, settings: GameServerSettings, count: number) {
	if (count <= 1) {
		execAction(client, action, settings);
	} else {
		execAction(client, action, settings);
		for (let i = 1; i < count; i++) {
			setTimeout(() => execAction(client, action, settings), i * 800);
		}
	}
}

function transferArmyToClient(fromClient: IClient, toClient: IClient) {
	const summoned = summonedBunnies.get(fromClient) || [];
	const free = freeBunnies.get(fromClient) || [];
	const allBunnies = [...summoned, ...free];

	if (!allBunnies.length) {
		return false;
	}

	if (summonedBunnies.get(toClient) || freeBunnies.get(toClient)) {
		return false;
	}

	summonedBunnies.delete(fromClient);
	freeBunnies.delete(fromClient);

	if (summoned.length) {
		summonedBunnies.set(toClient, summoned);
	}

	if (free.length) {
		freeBunnies.set(toClient, free);
	}

	for (const bunny of allBunnies) {
		const entityState = bunny as any;
		entityState.bunnyArmyOwner = toClient;
		entityState.bunnyCaptainOwner = toClient;
		entityState.bunnyArmyFollowMode = true;
		entityState.bunnyArmyWanderUntil = 0;
		entityState.bunnyArmyWanderTargetX = entityState.bunnyArmyWanderTargetX || bunny.x;
		entityState.bunnyArmyWanderTargetY = entityState.bunnyArmyWanderTargetY || bunny.y;
		entityState.bunnyArmyForwardX = entityState.bunnyArmyForwardX || 1;
		entityState.bunnyArmyForwardY = entityState.bunnyArmyForwardY || 0;
		entityState.bunnyArmyCaptain = false;
		entityState.bunnyCaptainMessageShown = true;
	}

	return true;
}

function clearSummonedBunnies(client: IClient, world: World) {
	const bunnies = summonedBunnies.get(client);

	if (!bunnies || !bunnies.length) {
		return;
	}

	for (const bunny of bunnies) {
		world.removeEntityFromSomeMap(bunny);
	}

	summonedBunnies.delete(client);
}

function clearFreeBunnies(client: IClient, world: World) {
	const bunnies = freeBunnies.get(client);

	if (!bunnies || !bunnies.length) {
		return;
	}

	for (const bunny of bunnies) {
		world.removeEntityFromSomeMap(bunny);
	}

	freeBunnies.delete(client);
}

function getFormationOffsets(count: number, radius: number, shape: 'none' | 'circle' | 'triangle' | 'square' | 'diamond' | 'heart') {
	const offsets: { x: number; y: number }[] = [];

	if (shape === 'none') {
		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const dist = Math.random() * radius;
			offsets.push({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
		}
		return offsets;
	}

	if (shape === 'circle') {
		for (let i = 0; i < count; i++) {
			const angle = i * (Math.PI * 2) / count;
			offsets.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
		}
		return offsets;
	}

	if (shape === 'heart') {
		for (let i = 0; i < count; i++) {
			const t = i / count;
			const angle = t * Math.PI * 2;
			const x = 16 * Math.pow(Math.sin(angle), 3) * radius / 16;
			const y = (13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle)) * radius / 13;
			offsets.push({ x, y });
		}
		return offsets;
	}

	const sides = shape === 'triangle' ? 3 : 4;
	const rotation = shape === 'diamond' ? Math.PI / 4 : 0;
	const vertices = Array.from({ length: sides }, (_, i) => {
		const angle = rotation + i * (Math.PI * 2) / sides;
		return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
	});

	const edgeLengths = vertices.map((vertex, index) => {
		const next = vertices[(index + 1) % sides];
		return Math.sqrt((next.x - vertex.x) ** 2 + (next.y - vertex.y) ** 2);
	});

	const perimeter = edgeLengths.reduce((sum, len) => sum + len, 0);
	const step = perimeter / count;

	for (let i = 0; i < count; i++) {
		let distance = step * (i + 0.5);
		let edgeIndex = 0;
		while (distance > edgeLengths[edgeIndex] && edgeIndex < sides - 1) {
			distance -= edgeLengths[edgeIndex];
			edgeIndex++;
		}

		const start = vertices[edgeIndex];
		const end = vertices[(edgeIndex + 1) % sides];
		const t = edgeLengths[edgeIndex] === 0 ? 0 : distance / edgeLengths[edgeIndex];
		offsets.push({
			x: start.x + (end.x - start.x) * t,
			y: start.y + (end.y - start.y) * t,
		});
	}

	return offsets;
}

function getArmyFormationOffsets(count: number, spacing: number = 0.25, offsetX: number = 0, offsetY: number = 0) {
	const side = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, count))));
	const offsets: { x: number; y: number }[] = [];
	const halfSide = (side - 1) / 2;

	for (let i = 0; i < count; i++) {
		const row = Math.floor(i / side);
		const col = i % side;
		const x = (col - halfSide) * spacing + offsetX;
		const y = (row - halfSide) * spacing + offsetY;
		offsets.push({ x, y });
	}

	return offsets;
}

function getArmyLineFormationOffsets(count: number, spacing: number = 0.25, offsetX: number = 0, offsetY: number = 0) {
	const offsets: { x: number; y: number }[] = [];
	const halfCount = (count - 1) / 2;

	for (let i = 0; i < count; i++) {
		const x = (i - halfCount) * spacing + offsetX;
		offsets.push({ x, y: offsetY });
	}

	return offsets;
}

function applyArmyState(bunnies: ServerEntity[], mode: 'stay' | 'free') {
	for (const bunny of bunnies) {
		const entityState = bunny as any;
		entityState.bunnyMode = mode;
		entityState.bunnyArmyMode = mode;
		entityState.bunnyArmyFollowMode = true;
		entityState.bunnyArmyWanderUntil = 0;
	}
	return bunnies;
}

function assignArmyCaptain(client: IClient, bunnies: ServerEntity[], settings: GameServerSettings) {
	if (!bunnies.length) {
		return undefined;
	}

	const captain = bunnies[Math.floor(Math.random() * bunnies.length)];
	const side = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, bunnies.length))));
	const halfSide = (side - 1) / 2;
	const spacing = 0.35;
	const captainMessages = [
		'Вперёд, за мной!',
		'Собираю строй!'
	];
	const followerMessages = [
		'Пух-пух, рядом!',
		'За командира!'
	];

	for (let index = 0; index < bunnies.length; index++) {
		const bunny = bunnies[index];
		const entityState = bunny as any;
		entityState.bunnyArmyCaptain = bunny === captain;
		entityState.bunnyCaptainOwner = client;
		entityState.bunnyArmyOwner = client;
		entityState.bunnyArmyLeader = captain;
		entityState.bunnyArmyFollowMode = true;
		entityState.bunnyArmyMode = entityState.bunnyArmyMode || 'stay';
		entityState.bunnyCaptainMessageShown = true;
		entityState.bunnyArmyWanderUntil = 0;
		entityState.bunnyArmyAnchorX = entityState.bunnyArmyAnchorX !== undefined ? entityState.bunnyArmyAnchorX : bunny.x;
		entityState.bunnyArmyAnchorY = entityState.bunnyArmyAnchorY !== undefined ? entityState.bunnyArmyAnchorY : bunny.y;
		entityState.bunnyArmyWanderTargetX = bunny.x;
		entityState.bunnyArmyWanderTargetY = bunny.y;
		entityState.bunnyArmyForwardX = entityState.bunnyArmyForwardX !== undefined ? entityState.bunnyArmyForwardX : 1;
		entityState.bunnyArmyForwardY = entityState.bunnyArmyForwardY !== undefined ? entityState.bunnyArmyForwardY : 0;
		entityState.bunnyAiNextMessageAt = entityState.bunnyAiNextMessageAt || (Date.now() / 1000 + random(30, 45, true));

		const row = Math.floor(index / side);
		const col = index % side;
		entityState.bunnyArmyOffsetX = (col - halfSide) * spacing;
		entityState.bunnyArmyOffsetY = (row - halfSide) * spacing;

		const originalUpdate = bunny.serverUpdate;
		bunny.serverUpdate = (_delta: number, now: number) => {
			if (entityState.bunnyAiNextMessageAt && now >= entityState.bunnyAiNextMessageAt) {
				entityState.bunnyAiNextMessageAt = now + random(35, 55, true);
				if (Math.random() < 0.04) {
					const phrases = bunny === captain ? captainMessages : followerMessages;
					const phrase = phrases[Math.floor(Math.random() * phrases.length)];
					sayToAll(bunny, phrase, phrase, MessageType.Chat, settings);
				}
			}

			if (bunny === captain) {
				let targetX = captain.x + 1.4;
				let targetY = captain.y;

				if (entityState.bunnyArmyMode === 'free') {
					if (!entityState.bunnyArmyWanderUntil || now >= entityState.bunnyArmyWanderUntil) {
						const forwardX = entityState.bunnyArmyForwardX !== undefined ? entityState.bunnyArmyForwardX : 1;
						const forwardY = entityState.bunnyArmyForwardY !== undefined ? entityState.bunnyArmyForwardY : 0;
						const length = Math.sqrt(forwardX * forwardX + forwardY * forwardY) || 1;
						const dirX = forwardX / length;
						const dirY = forwardY / length;
						const lateral = (Math.random() - 0.5) * 0.35;
						const distance = 1.2 + Math.random() * 0.7;
						entityState.bunnyArmyWanderTargetX = captain.x + dirX * distance + 1.2 + lateral;
						entityState.bunnyArmyWanderTargetY = captain.y + dirY * distance * 0.6 + (Math.random() - 0.5) * 0.2;
						entityState.bunnyArmyWanderUntil = now + random(4.2, 7.0, true);
						entityState.bunnyArmyForwardX = dirX;
						entityState.bunnyArmyForwardY = dirY;
					}
					targetX = entityState.bunnyArmyWanderTargetX;
					targetY = entityState.bunnyArmyWanderTargetY;
				}

				const dx2 = targetX - captain.x;
				const dy2 = targetY - captain.y;
				const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
				if (dist2 > 0.2) {
					const speed = entityState.bunnyArmyMode === 'free' ? 2.4 : 2.0;
					updateEntityVelocity(captain, (dx2 / dist2) * speed, (dy2 / dist2) * speed, now);
					setEntityAnimation(captain, BunnyAnimation.Walk, dx2 > 0);
				} else {
					updateEntityVelocity(captain, 0, 0, now);
					setEntityAnimation(captain, BunnyAnimation.Sit);
				}
				return;
			}

			const leader = entityState.bunnyArmyLeader as ServerEntity | undefined;
			if (!leader || !entityState.bunnyArmyFollowMode || leader === bunny) {
				if (originalUpdate) {
					originalUpdate(_delta, now);
				}
				return;
			}

			if (!entityState.bunnyArmyWanderUntil || now >= entityState.bunnyArmyWanderUntil) {
				const leaderState = leader as any;
				const forwardX = leaderState && leaderState.bunnyArmyForwardX !== undefined ? leaderState.bunnyArmyForwardX : (entityState.bunnyArmyForwardX !== undefined ? entityState.bunnyArmyForwardX : 1);
				const forwardY = leaderState && leaderState.bunnyArmyForwardY !== undefined ? leaderState.bunnyArmyForwardY : (entityState.bunnyArmyForwardY !== undefined ? entityState.bunnyArmyForwardY : 0);
				const length = Math.sqrt(forwardX * forwardX + forwardY * forwardY) || 1;
				const dirX = forwardX / length;
				const dirY = forwardY / length;
				const driftX = (Math.random() - 0.5) * 0.2;
				const driftY = (Math.random() - 0.5) * 0.1;
				entityState.bunnyArmyWanderTargetX = leader.x + entityState.bunnyArmyOffsetX * 1.4 + dirX * 0.55 + driftX;
				entityState.bunnyArmyWanderTargetY = leader.y + entityState.bunnyArmyOffsetY * 1.4 + dirY * 0.35 + driftY;
				entityState.bunnyArmyForwardX = dirX;
				entityState.bunnyArmyForwardY = dirY;
				entityState.bunnyArmyWanderUntil = now + random(4.5, 7.5, true);
			}

			const targetX = entityState.bunnyArmyWanderTargetX;
			const targetY = entityState.bunnyArmyWanderTargetY;
			const dx2 = targetX - bunny.x;
			const dy2 = targetY - bunny.y;
			const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

			if (dist2 > 0.25) {
				const speed = entityState.bunnyArmyMode === 'free' ? 2.9 : 2.6;
				updateEntityVelocity(bunny, (dx2 / dist2) * speed, (dy2 / dist2) * speed, now);
				setEntityAnimation(bunny, BunnyAnimation.Walk, dx2 > 0);
			} else {
				updateEntityVelocity(bunny, 0, 0, now);
				setEntityAnimation(bunny, BunnyAnimation.Sit);
			}
		};
	}

	return captain;
}

function createFormationBunnies(
	client: IClient,
	world: World,
	map: ServerMap,
	player: IClient['pony'],
	offsets: { x: number; y: number }[],
	mode: 'circle' | 'stay' | 'free',
	radius: number,
	shape: 'none' | 'circle' | 'triangle' | 'square' | 'diamond' | 'heart',
	preserveOffsets: boolean,
) {
	const created: ServerEntity[] = [];

	for (let i = 0; i < offsets.length; i++) {
		const offset = offsets[i];
		const initialPhase = offsets.length > 1 ? (i / offsets.length) * Math.PI * 2 : 0;
		const bunnyEntities = createFollowerBunny(player, offset.x, offset.y, mode, radius, shape, initialPhase, false, client.map, preserveOffsets);

		for (const bunny of bunnyEntities) {
			world.addEntity(bunny, map);
			created.push(bunny);
		}
	}

	return created;
}

function getSummonedBunnies(client: IClient): ServerEntity[] {
	return summonedBunnies.get(client) || [];
}

function resolveArmyOutcome(attackerCount: number, defenderCount: number) {
	const total = attackerCount + defenderCount;
	const strengthDiff = (attackerCount - defenderCount) / Math.max(1, total);
	const randomBias = random(-0.16, 0.16, true);
	const score = strengthDiff + randomBias;

	if (score > 0.06) {
		return 'attacker' as const;
	}

	if (score < -0.06) {
		return 'defender' as const;
	}

	return 'draw' as const;
}

function getNearbyArmyTargets(client: IClient, world: World): IClient[] {
	const myBunnies = getSummonedBunnies(client);
	if (!myBunnies.length) {
		return [];
	}

	const { x, y } = client.pony;
	return world.clients.filter(other => {
		if (other === client || other.map !== client.map) {
			return false;
		}

		const otherBunnies = getSummonedBunnies(other);
		if (!otherBunnies.length) {
			return false;
		}

		const dx = other.pony.x - x;
		const dy = other.pony.y - y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		return dist <= 12;
	});
}

function attachBattleBehavior(entity: ServerEntity, side: 'attacker' | 'defender', battleState: { attacker: IClient; defender: IClient; attackerBunnies: ServerEntity[]; defenderBunnies: ServerEntity[]; settings: GameServerSettings; completed: boolean; outcome: 'attacker' | 'defender' | 'draw'; }, world: World) {
	const entityState = entity as any;
	let lastAnimationAt = 0;

	entityState.battleSession = battleState;
	entity.serverUpdate = (_delta, now) => {
		if (battleState.completed) {
			return;
		}

		const targetClient = side === 'attacker' ? battleState.defender : battleState.attacker;
		const target = targetClient.pony;
		const midpointX = (target.x + (side === 'attacker' ? battleState.attacker.pony.x : battleState.defender.pony.x)) / 2;
		const midpointY = (target.y + (side === 'attacker' ? battleState.attacker.pony.y : battleState.defender.pony.y)) / 2;
		const dx = midpointX - entity.x;
		const dy = midpointY - entity.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (now >= lastAnimationAt) {
			lastAnimationAt = now + random(0.3, 1.2, true);
			const animations = [BunnyAnimation.Blink, BunnyAnimation.Look, BunnyAnimation.Clean, BunnyAnimation.Sit, BunnyAnimation.Walk];
			const animation = animations[Math.floor(Math.random() * animations.length)];
			setEntityAnimation(entity, animation);
		}

		if (dist < 0.8) {
			world.removeEntityFromSomeMap(entity);
			entityState.battleDead = true;
			entity.serverUpdate = undefined;

			const list = side === 'attacker' ? battleState.attackerBunnies : battleState.defenderBunnies;
			const index = list.indexOf(entity);
			if (index !== -1) {
				list.splice(index, 1);
			}

			const attackerRemaining = battleState.attackerBunnies.length;
			const defenderRemaining = battleState.defenderBunnies.length;
			if (attackerRemaining === 0 || defenderRemaining === 0) {
				battleState.completed = true;
				const attackerName = battleState.attacker.pony.name || 'Армия A';
				const defenderName = battleState.defender.pony.name || 'Армия B';
				const outcome = battleState.outcome;
				if (outcome === 'draw') {
					const message = `Ничья между ${attackerName} и ${defenderName}!`;
					sayToOthers(battleState.attacker, message, MessageType.Announcement, undefined, battleState.settings);
					sayToOthers(battleState.defender, message, MessageType.Announcement, undefined, battleState.settings);
				} else if (outcome === 'attacker') {
					const message = `${attackerName} победили!`;
					sayToOthers(battleState.attacker, message, MessageType.Announcement, undefined, battleState.settings);
					sayToOthers(battleState.defender, `${defenderName} проиграли.`, MessageType.Announcement, undefined, battleState.settings);
				} else {
					const message = `${defenderName} победили!`;
					sayToOthers(battleState.defender, message, MessageType.Announcement, undefined, battleState.settings);
					sayToOthers(battleState.attacker, `${attackerName} проиграли.`, MessageType.Announcement, undefined, battleState.settings);
				}
			}
			return;
		}

		const speed = 4.5 + random(0.2, 0.9, true);
		const vx = (dx / dist) * speed;
		const vy = (dy / dist) * speed;
		updateEntityVelocity(entity, vx, vy, now);
	};
}

function startArmyBattle(client: IClient, world: World, opponent: IClient, settings: GameServerSettings) {
	const attackerBunnies = getSummonedBunnies(client).slice();
	const defenderBunnies = getSummonedBunnies(opponent).slice();
	if (!attackerBunnies.length || !defenderBunnies.length) {
		return false;
	}

	const battleState = {
		attacker: client,
		defender: opponent,
		attackerBunnies,
		defenderBunnies,
		settings,
		completed: false,
		outcome: resolveArmyOutcome(attackerBunnies.length, defenderBunnies.length),
	};

	summonedBunnies.delete(client);
	freeBunnies.delete(client);
	summonedBunnies.delete(opponent);
	freeBunnies.delete(opponent);
	armyBattleStates.set(client, battleState as any);
	armyBattleStates.set(opponent, battleState as any);

	for (const bunny of attackerBunnies) {
		attachBattleBehavior(bunny, 'attacker', battleState as any, world);
	}

	for (const bunny of defenderBunnies) {
		attachBattleBehavior(bunny, 'defender', battleState as any, world);
	}

	return true;
}

function setSummonedBunnyAnimation(client: IClient, animation: BunnyAnimation) {
	const bunnies = getSummonedBunnies(client);
	const now = Date.now() / 1000;

	for (const bunny of bunnies) {
		(bunny as any).bunnyActionAnimation = animation;
		(bunny as any).bunnyActionUntil = now + 1.5;
		setEntityAnimation(bunny, animation);
	}

	return bunnies.length;
}

export function transferSummonedBunnies(client: IClient, world: World, newMap: ServerMap, newX: number, newY: number) {
	const oldBunnies = summonedBunnies.get(client);

	if (!oldBunnies || !oldBunnies.length) {
		return;
	}

	const options = getBunnyOptions(client);
	const offsets = getFormationOffsets(options.count, options.radius, options.shape);
	const created: ServerEntity[] = [];

	// Remove old bunnies from old map
	for (const bunny of oldBunnies) {
		world.removeEntityFromSomeMap(bunny);
	}

	// Create new bunnies on new map
	for (let i = 0; i < offsets.length; i++) {
		const offset = offsets[i];
		const initialPhase = (i / offsets.length) * Math.PI * 2;
		const bunnyEntities = createFollowerBunny(client.pony, offset.x, offset.y, options.mode, options.radius, options.shape, initialPhase, true, client.map);

		for (const bunny of bunnyEntities) {
			bunny.x = newX + offset.x;
			bunny.y = newY + offset.y;
			world.addEntity(bunny, newMap);
			created.push(bunny);
		}
	}

	summonedBunnies.set(client, created);
}

export function transferFreeBunnies(client: IClient, world: World, newMap: ServerMap) {
	const oldBunnies = freeBunnies.get(client);

	if (!oldBunnies || !oldBunnies.length) {
		return;
	}

	// Remove old free bunnies from old map
	for (const bunny of oldBunnies) {
		world.removeEntityFromSomeMap(bunny);
	}

	// Add free bunnies to new map (they keep their positions)
	for (const bunny of oldBunnies) {
		world.addEntity(bunny, newMap);
	}
}

export interface CommandContext {
	world: World;
	notifications: NotificationService;
	liveSettings: ServerLiveSettings;
	party: PartyService;
	random: (min: number, max: number, floating?: boolean) => number;
}

export type CommandHandler = (
	context: CommandContext, client: IClient, message: string, type: ChatType, target: IClient | undefined,
	settings: GameServerSettings
) => any;

export interface Command {
	names: string[];
	help: string;
	role: string;
	category?: string;
	spam?: boolean;
	handler: CommandHandler;
}

function hasRoleNull(client: IClient, role: string) {
	if (!role) return true; // No role requirement
	if (hasRole(client.account, role)) return true; // Has exact role

	// Role hierarchy: supporter levels
	if (role.startsWith('sup')) {
		const level = parseInt(role.charAt(3), 10);
		return (client.supporterLevel >= level || client.isMod);
	}

	// Role hierarchy: mod < admin < owner
	if (client.isMod) return role === 'mod';
	if (hasRole(client.account, 'admin')) return role === 'admin' || role === 'mod';
	if (hasRole(client.account, 'owner')) return role === 'owner' || role === 'admin' || role === 'mod';

	return false;
}

function command(names: string[], help: string, role: string, handler: CommandHandler, spam = false, category?: string): Command {
	return { names, help, role, handler, spam, category };
}

function emote(names: string[], expr: Expression, timeout?: number, cancellable?: boolean, category?: string) {
	return command(names, '', '', ({ }, { pony }) => setEntityExpression(pony, expr, timeout, cancellable), false, category);
}

function action(names: string[], actionName: Action, category?: string) {
	return command(names, '', '', ({ }, client, _, __, ___, settings) => execAction(client, actionName, settings), false, category);
}

function adminModChat(names: string[], help: string, role: string, type: MessageType, category?: string) {
	return command(names, help, role, ({ }, client, message, _, __, settings) => {
		sayToEveryone(client, message, filterBadWords(message), type, settings);
	}, false, category);
}

function parseWeather(value: string): Weather | undefined {
	switch (value.toLowerCase()) {
		case 'none': return Weather.None;
		case 'rain': return Weather.Rain;
		default: return undefined;
	}
}

function getSpawnTarget(map: ServerMap, message: string) {
	if (message === 'spawn') {
		return randomPoint(map.spawnArea);
	}

	const spawn = map.spawns.get(message);

	if (spawn) {
		return randomPoint(spawn);
	}

	// allow coordinates with decimal separator dot or comma
	const match = /^(\d+(?:[\.,]\d+)?)\s+(\d+(?:[\.,]\d+)?)$/.exec(message.trim());

	if (!match) {
		throw new UserError('invalid parameters');
	}

	let tx = match[1].replace(',', '.');
	let ty = match[2].replace(',', '.');
	const x = clamp(+tx, 0, map.width - 0.5 / tileWidth);
	const y = clamp(+ty, 0, map.height - 0.5 / tileHeight);
	return { x, y };
}

function execWithFileName(client: IClient, message: string, action: (fileName: string) => Promise<any>) {
	const fileName = message.replace(/[^a-zA-Z0-9_-]/g, '');

	if (!fileName) {
		throw new UserError('invalid file name');
	}

	action(fileName)
		.catch(e => (logger.error(e), e.message))
		.then(error => saySystem(client, error || 'saved'));
}

function shouldNotBeCalled() {
	throw new Error('Should not be called');
}

function isValidMapForEditing(map: ServerMap, client: IClient, checkTimeout: boolean, onlyLeader: boolean) {
	if (map.id !== 'house') {
		saySystem(client, 'Can only be done inside the house');
		return false;
	}

	if (checkTimeout && ((Date.now() - client.lastMapLoadOrSave) < MAP_LOAD_SAVE_TIMEOUT)) {
		saySystem(client, `You need to wait ${Math.floor(MAP_LOAD_SAVE_TIMEOUT / 1000)} seconds before loading or saving again`);
		return false;
	}

	if (onlyLeader && client.party && client.party.leader !== client) {
		saySystem(client, 'Only party leader can do this');
		return false;
	}

	return true;
}

function clearHouseEditableEntities(world: World, map: ServerMap) {
	for (const region of map.regions) {
		for (const entity of [...region.entities]) {
			if (hasFlag(entity.state, EntityState.Editable)) {
				world.removeEntity(entity, map);
			}
		}
	}
}

function clearHouseInnerWalls(world: World, map: ServerMap) {
	for (const region of map.regions) {
		for (const entity of [...region.entities]) {
			if (includes(HOUSE_H_WALL_TYPES, entity.type)) {
				const x = Math.round(entity.x - 0.5);
				const y = Math.round(entity.y - HOUSE_WALL_Y_OFFSET);

				if (y > HOUSE_WALL_TOP && y < map.height) {
					world.toggleWall(map, x, y, TileType.WallH);
				}
			} else if (includes(HOUSE_V_WALL_TYPES, entity.type)) {
				const x = Math.round(entity.x);
				const y = Math.round(entity.y - 0.5);

				if (x > 0 && x < map.width && y >= HOUSE_WALL_TOP && y < map.height) {
					world.toggleWall(map, x, y, TileType.WallV);
				}
			}
		}
	}
}

function clearHouseTiles(map: ServerMap) {
	for (const region of map.regions) {
		resetTiles(map, region);
	}
}

let interval: any;

// backups for admin adjustments, allow reset to pre-change value
const playtimeBackup = new WeakMap<IClient, number>();
const createdBackup = new WeakMap<IClient, Date | undefined>();

export function createCommands(world: World): Command[] {
	const commands = compact([
		// chat
		command(['help', 'h', '?'], '/help - show help', '', ({ }, client) => {
			const filtered = commands
				.filter((c: Command) => c.help && hasRoleNull(client, c.role));

			// Group commands by category
			const grouped: { [key: string]: Command[] } = {};
			filtered.forEach((cmd: Command) => {
				const cat = cmd.category || 'Other';
				if (!grouped[cat]) grouped[cat] = [];
				grouped[cat].push(cmd);
			});

			// Build help text with categories
			const helpLines: string[] = [];
			const categoryOrder = ['Chat', 'Actions', 'Pony states', 'Emotes', 'Expressions', 'House', 'Supporters', 'Debug', 'Other', 'Mod', 'Admin', 'Owner'];
// moved Other above Mod so generic commands show earlier


			for (const cat of categoryOrder) {
				if (grouped[cat]) {
					helpLines.push('\n' + cat);
					helpLines.push(grouped[cat].map((c: Command) => c.help).join('\n'));
				}
			}

			saySystem(client, helpLines.join('\n'));
		}, false, 'Chat'),
		command(['roll', 'rand', 'random'], '/roll [[min-]max] - randomize a number', '',
			({ random }, client, args, type, target, settings) => {
				const ROLL_MAX = 1000000;
				const [, min, max] = /^(?:(\d+)-)?(\d+)$/.exec(args) || ['', '', ''];
				const minValue = clamp((min ? parseInt(min, 10) : 1) | 0, 0, ROLL_MAX);
				const maxValue = clamp((max ? parseInt(max, 10) : 100) | 0, minValue, ROLL_MAX);
				const result = args === '🍎' ? args : random(minValue, maxValue);
				const message = `🎲 rolled ${result} of ${minValue !== 1 ? `${minValue}-` : ''}${maxValue}`;
				sayToOthers(client, message, toAnnouncementMessageType(type), target, settings);
			}, true, 'Chat'),

		command(['s', 'say'], '/s - say', '', shouldNotBeCalled, false, 'Chat'),
		command(['p', 'party'], '/p - party chat', '', shouldNotBeCalled, false, 'Chat'),
		command(['t', 'think'], '/t - thinking balloon', '', shouldNotBeCalled, false, 'Chat'),
		command(['w', 'whisper'], '/w <name> - whisper to player', '', shouldNotBeCalled, false, 'Chat'),
		command(['r', 'reply'], '/r - reply to whisper', '', shouldNotBeCalled, false, 'Chat'),
		command(['shrug'], '/shrug - ¯\\_(ツ)_/¯', '', shouldNotBeCalled, false, 'Chat'),
		command(['e'], '/e - set permanent expression', '', ({ }, { pony }, message) => {
			pony.exprPermanent = parseExpression(message, true);
			setEntityExpression(pony, undefined, 0);
		}, false, 'Chat'),

		// actions
		command(['turn'], '/turn - turn head', '', ({ }, client, _, __, ___, settings) => {
			execAction(client, Action.TurnHead, settings);
		}, false, 'Actions'),
		command(['boop', ')'], '/boop [count] or /) [count] - a boop (repeat up to 10x)', '', ({ }, client, message, _, __, settings) => {
			const { count, rest } = parseRepeatCount(message);
			const expression = parseExpression(rest);

			if (expression) {
				setEntityExpression(client.pony, expression, 800);
			}

			repeatAction(client, Action.Boop, settings, count);
		}, false, 'Actions'),
		command(['drop'], '/drop - drop held item', '', ({ }, client, _, __, ___, settings) => {
			execAction(client, Action.Drop, settings);
		}, false, 'Actions'),
		command(['droptoy'], '/droptoy - drop held toy', '', ({ }, client, _, __, ___, settings) => {
			execAction(client, Action.DropToy, settings);
		}, false, 'Actions'),
		command(['open'], '/open - open gift', '', ({ }, client) => {
			openGift(client);
		}, false, 'Actions'),

		// counters
		command(['gifts', 'giftscore'], '/gifts - show gift score', '', ({ }, client, _, type, target, settings) => {
			sayToOthers(client, `collected ${getCounter(client, 'gifts')} 🎁`, toAnnouncementMessageType(type), target, settings);
		}, true, 'Chat'),
		command(['candies', 'candy', 'sweets'], '/candies - show candy score', '', ({ }, client, _, type, target, settings) => {
			sayToOthers(client, `collected ${getCounter(client, 'candies')} 🍬`, toAnnouncementMessageType(type), target, settings);
		}, true, 'Chat'),
		command(['eggs', 'eggcount'], '/eggs - show egg score', '', ({ }, client, _, type, target, settings) => {
			sayToOthers(client, `collected ${getCounter(client, 'eggs')} 🥚`, toAnnouncementMessageType(type), target, settings);
		}, true, 'Chat'),
		command(['clovers', 'clover', 'clovercount'], '/clovers - show clover score', '', ({ }, client, _, type, target, settings) => {
			sayToOthers(client, `collected ${getCounter(client, 'clovers')} 🍀`, toAnnouncementMessageType(type), target, settings);
		}, true, 'Chat'),
		command(['toys', 'toylist'], '/toys [list] - show number of collected toys (use "/toys list" to list your toys)', '', ({ }, client, message, type, target, settings) => {
			const now = Date.now();
			const { collected, total } = getCollectedToysCount(client);
			const cmd = (message || '').trim().toLowerCase();

			if (cmd === 'list') {
				const list = getCollectedToysList(client);
				if (!list.length) {
					sayToOthers(client, `У вас пока нет игрушек соберите подарки что бы открыть одну из игрушек`, toAnnouncementMessageType(type), target, settings);
				} else {
					sayToOthers(client, `Your toys: ${list.map(n => `#${n}`).join(' ')}`, toAnnouncementMessageType(type), target, settings);
				}
			} else {
				if (collected === 0) {
					sayToOthers(client, `У вас пока нет игрушек соберите подарки что бы открыть одну из игрушек`, toAnnouncementMessageType(type), target, settings);
				} else if (client.lastToysCommandTime && (now - client.lastToysCommandTime) < 10000) {
					const list = getCollectedToysList(client);
					sayToOthers(client, `Your toys: ${list.map(n => `#${n}`).join(' ')}`, toAnnouncementMessageType(type), target, settings);
				} else {
					sayToOthers(client, `collected ${collected}/${total} toys`, toAnnouncementMessageType(type), target, settings);
				}

				client.lastToysCommandTime = now;
			}
		}, false, 'Chat'),

		// collections summary command (same channel behavior as /toys)
		command(['collections', 'col'], '/collections - show counts of toys, gifts, eggs, clovers, candies', '', ({ }, client, _message, type, target, settings) => {
			const { collected, total } = getCollectedToysCount(client);
			const gifts = getCounter(client, 'gifts');
			const eggs = getCounter(client, 'eggs');
			const clovers = getCounter(client, 'clovers');
			const candies = getCounter(client, 'candies');

			const lines: string[] = [
				`collected ${collected}/${total} toys`,
				`collected ${gifts} gifts 🎁`,
				`collected ${eggs} eggs 🥚`,
				`collected ${clovers} clovers 🍀`,
				`collected ${candies} candies 🍬`,
			];

			sayToOthers(client, lines.join('\n'), toAnnouncementMessageType(type), target, settings);
		}, true, 'Chat'),

		// achievements command
		command(['achievements', 'achs'], '/achievements - list collection milestones you have achieved', '', ({ }, client, _message, type, target, settings) => {
			const check = '✓ ';

			// helpers for formatting
			function ordinal(n: number) {
				const s = ['th', 'st', 'nd', 'rd'];
				const v = n % 100;
				return n + (s[(v - 20) % 10] || s[v] || s[0]);
			}

			function formatDate(d: Date) {
				const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
				return `${ordinal(d.getDate())} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
			}

			function formatPlayVerbose(seconds: number) {
				let s = Math.floor(seconds);
				const days = Math.floor(s / 86400); s %= 86400;
				const hours = Math.floor(s / 3600); s %= 3600;
				const mins = Math.floor(s / 60);
				const secs = s % 60;
				const parts: string[] = [];
				if (days) parts.push(`${days}day${days > 1 ? 's' : ''}`);
				if (hours) parts.push(`${hours}hour${hours > 1 ? 's' : ''}`);
				if (mins) parts.push(`${mins}min${mins > 1 ? 's' : ''}`);
				if (secs || parts.length === 0) parts.push(`${secs}sec${secs > 1 ? 's' : ''}`);
				return parts.join(' ');
			}

			// Section 1: account age + playtime titles
			const accountLines: string[] = [];
			if (client.account.createdAt) {
				const created = new Date(client.account.createdAt);
				accountLines.push(`${check}Joined on ${formatDate(created)}`);
				const ageMs = Date.now() - created.getTime();
				const days = Math.floor(ageMs / (1000 * 60 * 60 * 24));
				if (days >= 1) accountLines.push(`${check}Still fresh after just a day`);
				if (days >= 30) accountLines.push(`${check}A month has passed since signup`);
				if (days >= 182) accountLines.push(`${check}Half a year veteran`);
				if (days >= 365) accountLines.push(`${check}One year wanderer`);
				if (days >= 730) accountLines.push(`${check}Two years strong`);
			}

			// playtime titles
			const stored = (client.account.counters && (client.account.counters as any).playtime) ? (client.account.counters as any).playtime : 0;
			const session = Math.round((Date.now() - client.connectedTime) / 1000);
			const totalSeconds = stored + session;
			accountLines.push(`${check}Total playtime: ${formatPlayVerbose(totalSeconds)}`);
			if (totalSeconds >= 3600) accountLines.push(`${check}Played at least an hour`);
			if (totalSeconds >= 36000) accountLines.push(`${check}Over 10 hours in-game`);
			if (totalSeconds >= 360000) accountLines.push(`${check}Centuries? Nah, 100 hours`);
			if (totalSeconds >= 1800000) accountLines.push(`${check}Half a million seconds logged`);

			// Section 2: counter milestones
			const counterLines: string[] = [];
			const gifts = getCounter(client, 'gifts');
			for (let m = 100; m <= gifts; m += 100) {
				counterLines.push(`${check}Collected ${m} gifts`);
			}
			const eggs = getCounter(client, 'eggs');
			for (let m = 50; m <= eggs; m += 50) {
				counterLines.push(`${check}Collected ${m} eggs`);
			}
			const clovers = getCounter(client, 'clovers');
			for (let m = 50; m <= clovers; m += 50) {
				counterLines.push(`${check}Collected ${m} clovers`);
			}
			const candies = getCounter(client, 'candies');
			for (let m = 100; m <= candies; m += 100) {
				counterLines.push(`${check}Collected ${m} candies`);
			}

			// Section 3: toy achievements
			const toyLines: string[] = [];
			const { collected, total } = getCollectedToysCount(client);
			if (collected >= 1) {
				toyLines.push(`${check}First toy collected (${collected}/${total})`);
			}
			if (collected === total && total > 0) {
				toyLines.push(`${check}All possible toys collected (${total}/${total})`);
			}

			// assemble final output respecting empty sections
			const sections: string[][] = [];
			if (accountLines.length) sections.push(accountLines);
			if (counterLines.length) sections.push(counterLines);
			if (toyLines.length) sections.push(toyLines);

			if (sections.length === 0) {
				sayToOthers(client, 'No achievements yet', toAnnouncementMessageType(type), target, settings);
			} else {
				const output = sections.map(sec => sec.join('\n')).join('\n---------\n');
				sayToOthers(client, output, toAnnouncementMessageType(type), target, settings);
			}
		}, false, 'Chat'),

// account-related info commands moved out of the generic /account
	command(['accountdate', 'accdate', 'creation', 'created'], '/accountdate - show date when your account was created', '', ({ }, client, _message, type, target, settings) => {
		const created = client.account.createdAt ? formatISODate(client.account.createdAt).replace(/-/g, '.') : 'unknown';
		sayToOthers(client, `Creation Date: ${created}`, toAnnouncementMessageType(type), target, settings);
	}, false, 'Other'),
	command(['accountid', 'accid', 'id', 'whoami'], '/accountid - show your account ID', '', ({ }, client, _message, type, target, settings) => {
		sayToOthers(client, `Your ID: ${client.accountId}`, toAnnouncementMessageType(type), target, settings);
	}, false, 'Other'),
	command(['playtime', 'ptime', 'timeplayed'], '/playtime - show total playtime', '', ({ }, client, _message, type, target, settings) => {
		const stored = (client.account.counters && (client.account.counters as any).playtime) ? (client.account.counters as any).playtime : 0;
		const session = Math.round((Date.now() - client.connectedTime) / 1000);
		const totalSeconds = stored + session;
		const text = `Total Playtime: ${formatPlaytime(totalSeconds)}`;
		sayToOthers(client, text, toAnnouncementMessageType(type), target, settings);
	}, false, 'Other'),

	command(['age', 'birthage'], '/age - show your age based on birthdate in settings', '', ({ }, client, _message, type, target, settings) => {
		if (!client.account.birthdate) {
			throw new UserError('birthdate not set');
		}
		const bd = new Date(client.account.birthdate);
		const now = new Date();
		let age = now.getFullYear() - bd.getFullYear();
		const m = now.getMonth() - bd.getMonth();
		if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) {
			age--;
		}
		sayToOthers(client, `Age: ${age} year${age !== 1 ? 's' : ''}`, toAnnouncementMessageType(type), target, settings);
	}, false, 'Other'),
		command(['lie', 'lay'], '/lie - lie down or sit up', '', shouldNotBeCalled, false, 'Pony states'),
		command(['fly'], '/fly - fly up or fly down', '', shouldNotBeCalled, false, 'Pony states'),
		command(['stand'], '/stand - stand up', '', shouldNotBeCalled, false, 'Pony states'),

		// emotes
		command(['blush'], '', '', ({ }, { pony }, message) => playerBlush(pony, message), false, 'Emotes'),
		command(['love', '<3'], '', '', ({ }, { pony }, message) => playerLove(pony, message), false, 'Emotes'),
		command(['sleep', 'zzz'], '', '', ({ }, { pony }, message) => playerSleep(pony, message), false, 'Emotes'),
		command(['cry'], '', '', ({ }, { pony }, message) => playerCry(pony, message), false, 'Emotes'),

		// expressions
		emote(['smile', 'happy'], expression(Eye.Neutral, Eye.Neutral, Muzzle.Smile), undefined, undefined, 'Expressions'),
		emote(['frown'], expression(Eye.Neutral, Eye.Neutral, Muzzle.Frown), undefined, undefined, 'Expressions'),
		emote(['angry'], expression(Eye.Angry, Eye.Angry, Muzzle.Frown), undefined, undefined, 'Expressions'),
		emote(['sad'], expression(Eye.Sad, Eye.Sad, Muzzle.Frown), undefined, undefined, 'Expressions'),
		emote(['thinking'], expression(Eye.Neutral, Eye.Frown2, Muzzle.Concerned), undefined, undefined, 'Expressions'),

		// actions
		action(['yawn'], Action.Yawn, 'Actions'),
		action(['laugh', 'lol', 'haha', 'хаха', 'jaja'], Action.Laugh, 'Actions'),
		action(['sneeze', 'achoo'], Action.Sneeze, 'Actions'),
		action(['excite', 'tada'], Action.Excite, 'Actions'),
		action(['magic'], Action.Magic, 'Actions'),
		action(['kiss'], Action.Kiss, 'Actions'),
		action(['dance1', 'dance-1', 'dance'], Action.Dance1, 'Actions'),

		// house
		command(['savehouse'], '/savehouse - saves house setup (use ? for help)', '', async ({ }, client, message) => {
			if (!isValidMapForEditing(client.map, client, true, false))
				return;

			const subcommand = (message || '').trim().toLowerCase();

			if (subcommand === '?' || subcommand === 'help') {
				saySystem(client,
					'/savehouse - save entities, tiles, and walls\n' +
					'/savehouse entities - save only placed objects\n' +
					'/savehouse tiles - save only floor tiles\n' +
					'/savehouse walls - save only walls\n' +
					'/savehouse ? - show this help'
				);
				return;
			}

			client.lastMapLoadOrSave = Date.now();

			let saveEntities = true;
			let saveTiles = true;
			let saveWalls = true;
			let what = 'entities, tiles, and walls';

			switch (subcommand) {
				case '':
					break;
				case 'entities':
				case 'objects':
					saveTiles = false;
					saveWalls = false;
					what = 'entities';
					break;
				case 'tiles':
					saveEntities = false;
					saveWalls = false;
					what = 'tiles';
					break;
				case 'walls':
					saveEntities = false;
					saveTiles = false;
					what = 'walls';
					break;
				default:
					saySystem(client, 'Unknown subcommand. Use /savehouse ? for help');
					return;
			}

			const savedMap = JSON.stringify(saveMap(client.map, {
				saveTiles,
				saveEntities,
				saveWalls,
				saveOnlyEditableEntities: true,
			}));

			DEVELOPMENT && console.log(savedMap);

			client.account.savedMap = savedMap;
			await Account.updateOne({ _id: client.accountId }, { savedMap }).exec();

			saySystem(client, `Saved ${what}`);
			client.reporter.systemLog(`Saved house ${what}`);
		}, false, 'House'),
		command(['loadhouse'], '/loadhouse - loads saved house setup (use ? for help)', '', ({ world }, client, message) => {
			if (!isValidMapForEditing(client.map, client, true, true))
				return;

			if (!client.account.savedMap)
				return saySystem(client, 'No saved map state');

			const subcommand = (message || '').trim().toLowerCase();

			if (subcommand === '?' || subcommand === 'help') {
				saySystem(client,
					'/loadhouse - load all (entities, tiles, walls)\n' +
					'/loadhouse entities - load only placed objects\n' +
					'/loadhouse tiles - load only floor tiles\n' +
					'/loadhouse walls - load only walls\n' +
					'/loadhouse ? - show this help'
				);
				return;
			}

			client.lastMapLoadOrSave = Date.now();

			const savedData = JSON.parse(client.account.savedMap);

			if (subcommand === 'entities' || subcommand === 'objects') {
				loadMap(world, client.map, savedData,
					{ loadEntities: true, loadWalls: false, loadEntitiesAsEditable: true });
			} else if (subcommand === 'tiles') {
				loadMap(world, client.map, savedData,
					{ loadOnlyTiles: true });
			} else if (subcommand === 'walls') {
				loadMap(world, client.map, savedData,
					{ loadWalls: true, loadEntities: false });
			} else if (!subcommand) {
				// Load everything (default)
				loadMap(world, client.map, savedData,
					{ loadEntities: true, loadWalls: true, loadEntitiesAsEditable: true });
			} else {
				saySystem(client, 'Unknown subcommand. Use /loadhouse ? for help');
				return;
			}

			const what = !subcommand ? 'all (entities, tiles, walls)' : (subcommand === 'objects' ? 'entities' : subcommand);
			saySystem(client, `Loaded ${what}`);
			client.reporter.systemLog(`Loaded house ${what}`);
		}, false, 'House'),
		command(['resethouse'], '/resethouse - resets house setup (use ? for help)', '', ({ world }, client, message) => {
			if (!isValidMapForEditing(client.map, client, true, true))
				return;

			const subcommand = (message || '').trim().toLowerCase();

			if (subcommand === '?' || subcommand === 'help') {
				saySystem(client,
					'/resethouse - reset all (entities, tiles, walls) to default\n' +
					'/resethouse entities - reset only placed objects to default\n' +
					'/resethouse tiles - reset only floor tiles to default\n' +
					'/resethouse walls - reset only walls to default\n' +
					'/resethouse ? - show this help'
				);
				return;
			}

			if (!defaultHouseSave) {
				return saySystem(client, 'Default house save not available');
			}

			client.lastMapLoadOrSave = Date.now();

			if (subcommand === 'entities' || subcommand === 'objects') {
				clearHouseEditableEntities(world, client.map);
				loadMap(world, client.map, defaultHouseSave,
					{ loadEntities: true, loadWalls: false, loadEntitiesAsEditable: true });
			} else if (subcommand === 'tiles') {
				clearHouseTiles(client.map);
				loadMap(world, client.map, defaultHouseSave,
					{ loadOnlyTiles: true });
			} else if (subcommand === 'walls') {
				clearHouseInnerWalls(world, client.map);
				loadMap(world, client.map, defaultHouseSave,
					{ loadWalls: true, loadEntities: false });
			} else if (!subcommand) {
				// Reset everything to default
				loadMap(world, client.map, defaultHouseSave,
					{ loadEntities: true, loadWalls: true, loadEntitiesAsEditable: true });
			} else {
				saySystem(client, 'Unknown subcommand. Use /resethouse ? for help');
				return;
			}

			const what = !subcommand ? 'all (entities, tiles, walls)' : (subcommand === 'objects' ? 'entities' : subcommand);
			saySystem(client, `Reset ${what}`);
			client.reporter.systemLog(`Reset house ${what}`);
		}, false, 'House'),
		command(['clearhouse'], '/clearhouse - clears house setup (use ? for help)', '', ({ world }, client, message) => {
			if (!isValidMapForEditing(client.map, client, true, true))
				return;

			const subcommand = (message || '').trim().toLowerCase();

			if (subcommand === '?' || subcommand === 'help') {
				saySystem(client,
					'/clearhouse entities - clear all editable objects\n' +
					'/clearhouse objects - clear all editable objects\n' +
					'/clearhouse tiles - reset all tiles to default\n' +
					'/clearhouse walls - remove all inner walls\n' +
					'/clearhouse ? - show this help'
				);
				return;
			}

			client.lastMapLoadOrSave = Date.now();

			if (!subcommand) {
				clearHouseEditableEntities(world, client.map);
				clearHouseTiles(client.map);
				clearHouseInnerWalls(world, client.map);
				saySystem(client, 'Cleared all (entities, tiles, walls)');
				client.reporter.systemLog('Cleared house all (entities, tiles, walls)');
				return;
			}

			switch (subcommand) {
				case 'entities':
				case 'objects':
					clearHouseEditableEntities(world, client.map);
					saySystem(client, 'Cleared entities');
					client.reporter.systemLog(`Cleared house entities`);
					break;
				case 'tiles':
					clearHouseTiles(client.map);
					saySystem(client, 'Cleared tiles');
					client.reporter.systemLog(`Cleared house tiles`);
					break;
				case 'walls':
					clearHouseInnerWalls(world, client.map);
					saySystem(client, 'Cleared walls');
					client.reporter.systemLog(`Cleared house walls`);
					break;
				default:
					saySystem(client, 'Unknown subcommand. Use /clearhouse ? for help');
					break;
			}
		}, false, 'House'),
		command(['lockhouse'], '/lockhouse - prevents other people from changing the house', '', ({ }, client) => {
			if (!isValidMapForEditing(client.map, client, false, true))
				return;

			client.map.editingLocked = true;

			saySystem(client, 'House locked');
			client.reporter.systemLog(`House locked`);
		}, false, 'House'),
		command(['unlockhouse'], '/unlockhouse - enables editing by other people', '', ({ }, client) => {
			if (!isValidMapForEditing(client.map, client, false, true))
				return;

			client.map.editingLocked = false;

			saySystem(client, 'House unlocked');
			client.reporter.systemLog(`House unlocked`);
		}, false, 'House'),
		command(['removetoolbox'], '/removetoolbox - removes toolbox from the house', '', ({ world }, client) => {
			if (!isValidMapForEditing(client.map, client, true, true))
				return;

			client.lastMapLoadOrSave = Date.now();

			removeToolbox(world, client.map);

			saySystem(client, 'Toolbox removed');
			client.reporter.systemLog(`Toolbox removed`);
		}, false, 'House'),
		command(['restoretoolbox'], '/restoretoolbox - restores toolbox to the house', '', ({ }, client) => {
			if (!isValidMapForEditing(client.map, client, true, true))
				return;

			client.lastMapLoadOrSave = Date.now();

			restoreToolbox(world, client.map);

			saySystem(client, 'Toolbox restored');
			client.reporter.systemLog(`Toolbox restored`);
		}, false, 'House'),

		// supporters
		command(['swap'], '/swap <name> - swap character', '', async ({ world }, client, message) => {
			if (!message) {
				return saySystem(client, `You need to provide name of the character`);
			}

			const regex = new RegExp(`^${escapeRegExp(message)}$`, 'i');
			const query = { account: client.account._id, name: { $regex: regex } };
			await swapCharacter(client, world, query);
		}, false, 'Supporters'),

		// mod
		adminModChat(['m'], '/m - mod text', 'mod', MessageType.Mod, 'Mod'),
		command(['emotetest'], '/emotetest - print all emotes', 'mod', (_context, client) => {
			let text = '';

			for (let i = 0; i < emojis.length;) {
				if (text) {
					text += '\n';
				}

				for (let j = 0; i < emojis.length && j < 20; j++ , i++) {
					text += emojis[i].symbol;
				}
			}

			sayTo(client, client.pony, text, MessageType.Chat);
		}, false, 'Mod'),
		command(['rareitems', 'rare'], '/rareitems - show rare hold items', 'mod', ({ }, client) => {
			saySystem(client, `Rare items: ${rareHoldTypeNames.join(', ')}`);
		}, false, 'Mod'),
		command(['msgcolor'], '/msgcolor <#hex|reset> - set custom chat message color', '', ({ }, client, message) => {
			const color = message.trim().toLowerCase();

			if (!color || color === 'reset' || color === 'off' || color === 'clear') {
				(client.pony as any).messageColor = undefined;
				updateEntityOptions(client.pony, { messageColor: undefined } as any);
				saySystem(client, 'Message color reset to default');
				return;
			}

			const hex = color.startsWith('#') ? color.substring(1) : color;

			if (!/^[0-9a-f]{6}$/.test(hex)) {
				throw new UserError('Invalid color format. Use: /msgcolor #ff0000 or /msgcolor ff0000');
			}

			(client.pony as any).messageColor = hex;
			updateEntityOptions(client.pony, { messageColor: hex } as any);
			saySystem(client, `Message color set to #${hex}`);
		}, false, 'Mod'),
		command(['goto'], '/goto <map_id> [instance] - teleport to map spawn', 'mod', ({ world }, client, message) => {
			const parts = message.trim().split(/\s+/);

			if (parts.length === 0 || !parts[0]) {
				const mapsList = new Map<string, Set<string>>();
				for (const map of world.maps) {
					if (!mapsList.has(map.id)) {
						mapsList.set(map.id, new Set());
					}
					if (map.instance) {
						mapsList.get(map.id)!.add(map.instance);
					}
				}

				const lines = ['Available Maps:'];
				mapsList.forEach((instances, id) => {
					if (instances.size === 0) {
						lines.push(`  ${id}`);
					} else {
						lines.push(`  ${id} (instances: ${Array.from(instances).join(', ')})`);
					}
				});
				lines.push('', 'Usage: /goto <map_id> [instance]');
				saySystem(client, lines.join('\n'));
				return;
			}

			const [id, instance] = parts;
			const map = world.maps.find(map => map.id === id && (!instance || map.instance === instance));

			if (map) {
				const { x, y } = randomPoint(map.spawnArea);
				world.switchToMap(client, map, x, y);
				saySystem(client, `Teleported to ${id}${instance ? ` (${instance})` : ''}`);
			} else {
				throw new UserError(`Map "${id}" not found or instance mismatch`);
			}
		}, false, 'Mod'),
		command(['speed'], '/speed [0.1-7] - изменить скорость', 'mod', ({}, client, message) => {
			if (!client.pony) return;

			const input = (message || '').trim();

			if (!input || input.toLowerCase() === 'reset') {
				client.pony.speedMultiplier = 1;
				client.speedMultiplier = 1;
				updateEntityOptions(client.pony, { speedMultiplier: 1 });
				resetMovementTracking(client);
				saySystem(client, 'Скорость сброшена на 1x');
				return;
			}

			const value = parseFloat(input);

			if (isNaN(value) || value < 0.1 || value > 7) {
				saySystem(client, 'Использование: /speed [0.1-7] или /speed reset');
				return;
			}

			client.pony.speedMultiplier = value;
			client.speedMultiplier = value;
			updateEntityOptions(client.pony, { speedMultiplier: value });
			resetMovementTracking(client);
			saySystem(client, `Скорость установлена на ${value}x`);
		}, false, 'Mod'),
		command(['scale'], '/scale <value|reset> - manage player pony size (0.1-10)', 'mod', ({}, client, message) => {
			const parts = (message || '').trim().split(/\s+/);
			const arg = parts[0];

			if (!arg || arg.toLowerCase() === 'reset') {
				client.pony.scale = 1;
				updateEntityOptions(client.pony, { scale: 1 });
				saySystem(client, 'Scale reset to 1x');
				return;
			}

			const value = parseFloat(arg);

			if (isNaN(value) || value < 0.1 || value > 10) {
				saySystem(client, 'Invalid scale. Provide number >= 0.1 and <= 10, or "reset"');
				return;
			}

			client.pony.scale = value;
			updateEntityOptions(client.pony, { scale: value });
			saySystem(client, `Scale set to ${value}x`);
		}, false, 'Mod'),
		command(['noclip'], '/noclip - toggle collision (walk through walls)', 'mod', ({}, client) => {
			client.pony.noclip = !client.pony.noclip;
			updateEntityOptions(client.pony, { noclip: client.pony.noclip } as any);
			saySystem(client, `noclip: ${client.pony.noclip ? 'on' : 'off'}`);
		}, false, 'Mod'),
		command(['tobe'], '/tobe <type|none|list> - transform into entity', 'mod', ({ world }, client, message) => {
			const input = (message || '').trim().toLowerCase();

			if (input === 'list') {
				const types = getEntityTypesAndNames()
					.filter(e => e.name && e.type > 0)
					.map(e => e.name);
				saySystem(client, `Entity types: ${types.join(', ')}`);
				return;
			}

			if (input === 'none' || input === 'pony') {
				if (client.tobedPony) {
					world.removeEntity(client.pony, client.map);
					const pony = client.tobedPony;
					pony.x = client.pony.x;
					pony.y = client.pony.y;
					pony.client = client;
					world.addEntity(pony, client.map);
					client.pony = pony;
					client.tobedPony = undefined;
					saySystem(client, 'Restored to pony');
				} else {
					saySystem(client, 'Already a pony');
				}
				return;
			}

			if (input === 'npc') {
				const entityType = getEntityType('cat');
				if (!entityType) {
					saySystem(client, 'Failed to create NPC');
					return;
				}
				const x = client.pony.x;
				const y = client.pony.y;
				const entity = createAnEntity(entityType, 0, x, y, {}, mockPaletteManager, world) as ServerEntity;
				if (!entity) {
					saySystem(client, 'Failed to create entity');
					return;
				}
				client.tobedPony = client.pony;
				client.pony.client = undefined;
				world.removeEntity(client.pony, client.map);
				entity.client = client;
				world.addEntity(entity, client.map);
				client.pony = entity;
				client.safeX = entity.x;
				client.safeY = entity.y;
				saySystem(client, 'Transformed into NPC (cat)');
				return;
			}

			const entityType = getEntityType(input);
			if (!entityType) {
				saySystem(client, `Unknown entity type: "${input}". Use /tobe list to see available types`);
				return;
			}

			const x = client.pony.x;
			const y = client.pony.y;
			const entity = createAnEntity(entityType, 0, x, y, {}, mockPaletteManager, world) as ServerEntity;
			if (!entity) {
				saySystem(client, 'Failed to create entity');
				return;
			}
			client.tobedPony = client.pony;
			client.pony.client = undefined;
			world.removeEntity(client.pony, client.map);
			entity.client = client;
			world.addEntity(entity, client.map);
			client.pony = entity;
			client.safeX = entity.x;
			client.safeY = entity.y;
			saySystem(client, `Transformed into ${input}`);
		}, false, 'Mod'),
		command(['tp'], '/tp <location|x y|to <player>|here <player>|? - teleport around', 'mod', (_context, client, message) => {
		const input = message.trim();
		if (!input || input === '?') {
			const lines = [
				'Команда /tp — телепортация',
				'',
				'Использование:',
				'  /tp <location>                  - перейти к именованной точке спауна (см. /locations)',
				'  /tp <x> <y>                     - телепортироваться на указанные координаты (дробные значения допустимы)',
				'  /tp to <player>                 - телепортироваться к другому игроку',
				'  /tp to <player> <destination>   - телепортировать вас и указанного игрока к цели (ещё один игрок)',
				'  /tp here <player>               - вызвать указанного игрока к себе',
				'  /tp all                         - телепортировать всех игроков к вам',
				'  /tp map <name>                  - перейти на карту с именем <name> (аналогично /goto)',
				'  /tp ?                           - показать эту справку',
				'',
				'Примеры:',
				'  /tp spawn',
				'  /tp 22.1 42.5',
				'  /tp to player2',
				'  /tp to player2 destination',
				'  /tp here player2',
				'  /tp all                         - пример: телепортировать всех игроков к вам',
				'  /tp map "Cave"                  - см. /maps',
				'',
				"Подсказка: используйте /players для списка имён; включите 'Show stats', чтобы видеть свои координаты",
			];
			saySystem(client, lines.join('\n'));
			return;
		}

		// handle to/here/all subcommands
		const parts = input.split(/\s+/);
		const subcommand = parts[0].toLowerCase();
		if ((subcommand === 'all') || (subcommand === 'here' && parts[1] && parts[1].toLowerCase() === 'all')) {
			const senderName = client.pony.name || client.accountName;
			const others = _context.world.clients.filter(c => c !== client);
			if (others.length === 0) {
				saySystem(client, "You're the only one on the server right now");
				return;
			}

			for (const other of others) {
				if (other.map !== client.map) {
					_context.world.switchToMap(other, client.map, client.pony.x, client.pony.y);
				} else {
					teleportTo(other, client.pony.x, client.pony.y);
				}
				saySystem(other, `${senderName} teleported you to themselves`);
			}

			saySystem(client, `Teleported ${others.length} player${others.length === 1 ? '' : 's'} to you`);
			return;
		}

		if (subcommand === 'to' && parts[1]) {
			const targetName = parts.slice(1).join(' ');
			const destinationName = parts.slice(2).join(' ');
			if (parts.length >= 3 && destinationName) {
				const playerName = parts[1];
				const player = findArmyTargetClient(_context.world, playerName, client);
				const destination = findArmyTargetClient(_context.world, destinationName);
				if (!player) {
					saySystem(client, 'player not found, try /players to see online names');
					return;
				}
				if (!destination) {
					saySystem(client, 'destination player not found, try /players to see online names');
					return;
				}

				const clientName = client.pony.name || client.accountName;
				const playerNameOut = player.pony.name || player.accountName;
				const destinationNameOut = destination.pony.name || destination.accountName;

				if (client.map !== destination.map) {
					_context.world.switchToMap(client, destination.map, destination.pony.x, destination.pony.y);
				} else {
					teleportTo(client, destination.pony.x, destination.pony.y);
				}
				if (player.map !== destination.map) {
					_context.world.switchToMap(player, destination.map, destination.pony.x, destination.pony.y);
				} else {
					teleportTo(player, destination.pony.x, destination.pony.y);
				}

				saySystem(player, `${clientName} teleported you to ${destinationNameOut}`);
				saySystem(destination, `${clientName} and ${playerNameOut} teleported to you`);
				saySystem(client, `Teleported you and ${playerNameOut} to ${destinationNameOut}`);
				return;
			}

			const others = _context.world.clients.filter(c => (c.pony.name || '').toLowerCase() === targetName.toLowerCase());
			if (others.length === 0) {
				const byAccount = _context.world.clients.filter(c => c.accountName.toLowerCase() === targetName.toLowerCase());
				if (byAccount.length > 0) {
					const target = byAccount[0];
					if (client.map !== target.map) {
						_context.world.switchToMap(client, target.map, target.pony.x, target.pony.y);
					} else {
						teleportTo(client, target.pony.x, target.pony.y);
					}
					saySystem(client, `Teleported to ${target.accountName} (${target.pony.name || 'unnamed'})`);
					return;
				}
				saySystem(client, 'player not found, try /players to see online names');
				return;
			}
			const target = others[0];
			if (client.map !== target.map) {
				_context.world.switchToMap(client, target.map, target.pony.x, target.pony.y);
			} else {
				teleportTo(client, target.pony.x, target.pony.y);
			}
			saySystem(client, `Teleported to ${target.pony.name || 'unnamed'} (${target.accountName})`);
			return;
		}
		if (subcommand === 'here' && parts[1]) {
			const targetName = parts.slice(1).join(' ');
			const others = _context.world.clients.filter(c => (c.pony.name || '').toLowerCase() === targetName.toLowerCase());
			if (others.length === 0) {
				const byAccount = _context.world.clients.filter(c => c.accountName.toLowerCase() === targetName.toLowerCase());
				if (byAccount.length > 0) {
					const target = byAccount[0];
					if (target.map !== client.map) {
						_context.world.switchToMap(target, client.map, client.pony.x, client.pony.y);
					} else {
						teleportTo(target, client.pony.x, client.pony.y);
					}
					saySystem(client, `${target.accountName} (${target.pony.name || 'unnamed'}) has been teleported to you`);
					saySystem(target, `${client.pony.name || client.accountName} teleported you to themself`);
					return;
				}
				saySystem(client, 'player not found, try /players to see online names');
				return;
			}
			const target = others[0];
			if (target.map !== client.map) {
				_context.world.switchToMap(target, client.map, client.pony.x, client.pony.y);
			} else {
				teleportTo(target, client.pony.x, client.pony.y);
			}
			saySystem(client, `${target.pony.name || 'unnamed'} (${target.accountName}) has been teleported to you`);
			saySystem(target, `${client.pony.name || client.accountName} teleported you to themself`);
			return;
		}

		const { x, y } = getSpawnTarget(client.map, input);
		teleportTo(client, x, y);
		saySystem(client, `Teleported to (${x.toFixed(1)}, ${y.toFixed(1)})`);
	}, false, 'Mod'),

		command(['locations'], '/locations - show list all spawn locations on current map', 'mod', ({ }, client) => {
			const map = client.map;
			const locations = Array.from(map.spawns.keys());

			if (locations.length === 0) {
				saySystem(client, 'No named locations on this map');
			} else {
				const locNames = locations.concat(map.spawnArea ? ['spawn'] : []).join(', ');
				saySystem(client, `Locations on: ${locNames}`);
			}
		}, false, 'Mod'),

		command(['players'], '/players - list all players on this map and total', 'mod', ({ world }, client) => {
			const mapClients = world.clients.filter(c => c.map === client.map);
			const totalClients = world.clients.length;
			if (totalClients <= 1) {
				saySystem(client, "You're the only one on the server right now");
				return;
			}
			const lines: string[] = [
				`PLAYERS (${mapClients.length} here / ${totalClients} total)`,
				'',
			];
			if (mapClients.length === 0) {
				lines.push('No players on this map');
			} else {
				mapClients.forEach(c => {
					const afkStatus = c.lastPacket && (Date.now() - c.lastPacket) > 300000 ? ' (afk)' : '';
					lines.push(`  ${c.characterName} - ${c.accountName}${afkStatus}`);
				});
			}
			saySystem(client, lines.join('\n'));
		}, false, 'Mod'),

		command(['maps'], '/maps - list all maps on the server', 'mod', ({ world }, client) => {
			// Count unique maps and their players
			const mapData = new Map<string, { instances: number; players: number }>();

			for (const map of world.maps) {
				const key = map.id;
				const mapPlayers = world.clients.filter(c => c.map === map).length;
				if (!mapData.has(key)) {
					mapData.set(key, { instances: 0, players: 0 });
				}
				const data = mapData.get(key)!;
				data.instances++;
				data.players += mapPlayers;
			}

			const lines = [
				`Server Maps (${mapData.size} total)`,
				'---------------------',
			];

			let index = 1;
			mapData.forEach((data, id) => {
				const playerText = data.players === 1 ? 'pony' : 'ponies';
				if (data.players === 0) {
					lines.push(`${index}. ${id}`);
				} else {
					lines.push(`${index}. ${id}: ${data.players} ${playerText}`);
				}
				index++;
			});

			saySystem(client, lines.join('\n'));
		}, false, 'Mod'),
		command(['map'], '/map - show current map info', 'mod', ({ world }, client) => {
			const map = client.map;
			const { memory, entities } = getSizeOfMap(map);
			const players = world.clients.filter(c => c.map === map).length;
			const mapName = map.id || 'unknown';

			const lines = [
				'Map info',
				'-----------------',
				`Name:        ${mapName}${map.instance ? ` (${map.instance})` : ''}`,
				`Position:    ${client.pony.x.toFixed(1)}x, ${client.pony.y.toFixed(1)}y`,
				`Dimensions:  ${map.width}x | ${map.height}y tiles`,
				`Players:     ${players}`,
				`Regions:     ${map.regions.length}`,
				`Entities:    ${entities}`,
				`Memory:      ${(memory / 1024).toFixed(2)} KB`,
			];

			saySystem(client, lines.join('\n'));
		}, false, 'Mod'),

		// admin
		adminModChat(['a'], '/a - admin text', 'admin', MessageType.Admin, 'Admin'),
		command(['announce'], '/announce - global announcement', 'admin', ({ }, client, message, _, __, settings) => {
			findEntities(client.map, e => e.type === butterfly.type || e.type === bat.type || e.type === firefly.type)
				.forEach(e => sayToAll(e, message, filterBadWords(message), MessageType.Admin, settings));
		}, false, 'Admin'),

		// builder
		adminModChat(['build'], '/build - builder text', 'builder', MessageType.Builder, 'Builder'),

		// npc
		adminModChat(['npc'], '/npc - npc text', 'npc', MessageType.NPC, 'NPC'),

		command(['time'], '/time <HH:MM|day|night|?|<HH:MM> stop> - set server time, ? for help', DEVELOPMENT ? '' : 'admin', ({ world }, client, message) => {
			const input = message.trim();

			if (!input) {
				const currentTime = world.time;
				saySystem(client, `Current time: ${formatHourMinutes(currentTime)}`);
				return;
			}

			const args = input.split(/\s+/).filter(p => p);
			const subcommand = args[0].toLowerCase();

			// Check if it's a time setting (HH:MM or HH MM)
			const colonRegex = /^(\d{1,2}):(\d{2})$/;

			let isTimeInput = false;
			let targetHour = 0;
			let targetMinute = 0;

			if (colonRegex.test(args[0])) {
				const match = colonRegex.exec(args[0])!;
				targetHour = parseInt(match[1], 10);
				targetMinute = parseInt(match[2], 10);
				isTimeInput = true;
			} else if (/^\d{1,2}$/.test(args[0]) && args.length === 2 && /^\d{2}$/.test(args[1])) {
				targetHour = parseInt(args[0], 10);
				targetMinute = parseInt(args[1], 10);
				isTimeInput = true;
			}

			if (isTimeInput) {
				// if user added "stop" as second argument, freeze at that time
				if (args.length > 1 && args[1].toLowerCase() === 'stop') {
					if ((world as any).timeIntervalId) {
						clearInterval((world as any).timeIntervalId);
					}
					const targetTimeValue = targetHour + (targetMinute / 60);
					world.setTime(targetTimeValue);
					(world as any).timeIntervalId = setInterval(() => {
						world.setTime(targetTimeValue);
					}, 1000);
					saySystem(client, `Time frozen at ${formatHourMinutes(world.time)}`);
					return;
				}
				// Stop any running interval
				if ((world as any).timeIntervalId) {
					clearInterval((world as any).timeIntervalId);
					(world as any).timeIntervalId = null;
				}
				// Set time to HH:MM
				if (targetHour < 0 || targetHour > 23 || targetMinute < 0 || targetMinute > 59) {
					throw new UserError('Invalid time. Hours must be 0-23, minutes must be 0-59');
				}
				const targetTimeValue = targetHour + (targetMinute / 60);
				world.setTime(targetTimeValue);
				const newTime = world.time;
				saySystem(client, `Time set to ${formatHourMinutes(newTime)}`);
				return;
			}

			// Special commands: day and night - set time periodically every 2.5 seconds
			if (subcommand === 'day') {
				// Stop any running interval first
				if ((world as any).timeIntervalId) {
					clearInterval((world as any).timeIntervalId);
				}

				// Immediately set time to day
				world.setTime(12);

// Periodically re-set time every 1 seconds to maintain eternal day
			(world as any).timeIntervalId = setInterval(() => {
				world.setTime(12);
			}, 1000);

				saySystem(client, 'Time set to eternal day (12:00) - continuously enforced');
				return;
			}

			if (subcommand === 'night') {
				// Stop any running interval first
				if ((world as any).timeIntervalId) {
					clearInterval((world as any).timeIntervalId);
				}

				// Immediately set time to night
				world.setTime(0);

// Periodically re-set time every 1 seconds to maintain eternal night
			(world as any).timeIntervalId = setInterval(() => {
				world.setTime(0);
			}, 1000);

				saySystem(client, 'Time set to eternal night (00:00) - continuously enforced');
				return;
			}

			throw new UserError('Usage: /time HH:MM or /time day or /time night');
		}, false, 'Admin'),

	// admin counter modification
	command(['collect'], '/collect <kind> [amount|clear] - give/remove counters. Syntax: /collect gift 100 or /collect 100 gift', 'admin', ({ }, client, message) => {
		const parts = message.trim().split(/\s+/).filter(p => p);

		// Show help if no arguments
		if (parts.length === 0) {
			saySystem(client, 'Usage: /collect <kind> [amount|clear]');
			saySystem(client, 'Types: gift/gifts, egg/eggs, clover/clovers, candy/candies, toy/toys');
			saySystem(client, 'Examples:');
			saySystem(client, '  /collect gift 100 - give 100 gifts');
			saySystem(client, '  /collect 100 gift - give 100 gifts (order is flexible)');
			saySystem(client, '  /collect gift -50 - remove 50 gifts');
			saySystem(client, '  /collect gift clear - clear all gifts to 0');
			return;
		}

		// Parse arguments flexibly
		let kind: string | null = null;
		let amountStr: string | null = null;

		for (const part of parts) {
			// Check if it's a kind
			if (['gift', 'gifts', 'egg', 'eggs', 'clover', 'clovers', 'candy', 'candies', 'toy', 'toys'].includes(part.toLowerCase())) {
				if (kind !== null) {
					throw new UserError('Type specified twice');
				}
				kind = part.toLowerCase();
			} else if (part.toLowerCase() === 'clear') {
				if (amountStr !== null) {
					throw new UserError('Cannot specify amount and clear together');
				}
				amountStr = 'clear';
			} else if (!isNaN(parseInt(part, 10))) {
				if (amountStr !== null) {
					throw new UserError('Amount specified twice');
				}
				amountStr = part;
			} else {
				throw new UserError(`Unknown param: "${part}"`);
			}
		}

		if (kind === null) {
			throw new UserError('Type not specified (gift, egg, clover, candy or toy)');
		}

		// Normalize kind to singular/proper form
		const kindMap: any = {
			'gift': 'gifts', 'gifts': 'gifts',
			'egg': 'eggs', 'eggs': 'eggs',
			'clover': 'clovers', 'clovers': 'clovers',
			'candy': 'candies', 'candies': 'candies',
			'toy': 'toys', 'toys': 'toys'
		};
		const normalizedKind = kindMap[kind];

		if (normalizedKind === 'toys') {
			// Handle toys - output like /toys command
			if (amountStr === null) {
				throw new UserError('For toys specify amount or clear');
			}

			if (amountStr === 'clear') {
				updateAccountState(client.account, (state: any) => state.toys = 0);
				saySystem(client, 'Toys cleared');
			} else {
				const amount = parseInt(amountStr, 10);
				if (isNaN(amount)) {
					throw new UserError('Invalid amount');
				}

				const n = Math.abs(amount);
				const total = getCollectedToysCount(client).total;
				const m = Math.min(n, total);

				if (m === 0 && amount !== 0) {
					saySystem(client, 'No toys to remove');
					return;
				}

				updateAccountState(client.account, (state: any) => {
					let mask = toInt(state.toys);
					if (amount >= 0) {
						for (let i = 0; i < m; i++) mask |= (1 << i);
					} else {
						for (let i = 0; i < m; i++) mask &= ~(1 << i);
					}
					state.toys = mask;
				});

				const { collected } = getCollectedToysCount(client);
				saySystem(client, `${amount >= 0 ? 'Given' : 'Removed'} toys #1-${m}, total: ${collected}/${total}`);
			}
		} else {
			// Handle gifts, eggs, clovers, candies
			if (amountStr === null) {
				throw new UserError('Specify amount or clear');
			}

			let amount: number;

			if (amountStr === 'clear') {
				amount = -(toInt((client.account as any)[normalizedKind]) || 0);
			} else {
				amount = parseInt(amountStr, 10);
				if (isNaN(amount)) {
					throw new UserError('Invalid amount');
				}
			}

			const k = normalizedKind as 'gifts' | 'eggs' | 'clovers' | 'candies';

			updateAccountState(client.account, (state: any) => {
				state[k] = Math.max(0, toInt(state[k]) + amount);
			});

			if (amountStr === 'clear') {
				saySystem(client, `${k} cleared`);
			} else {
				saySystem(client, `${amount >= 0 ? 'Given' : 'Removed'} ${Math.abs(amount)} ${k}`);
			}
		}
	}, false, 'Admin'),

		// admin helpers to set playtime & creation date with undo
		command(['setplaytime'], '/setplaytime <seconds|reset> - set or restore your playtime', 'admin', ({ }, client, message) => {
			const arg = (message || '').trim().toLowerCase();
			if (!arg) {
				throw new UserError('provide seconds or reset');
			}
			if (arg === 'reset') {
				const prev = playtimeBackup.get(client);
				if (prev === undefined) {
					saySystem(client, 'no backup available');
					return;
				}
				updateAccountState(client.account, (state: any) => {
					state.counters = state.counters || {};
					state.counters.playtime = prev;
				});
				playtimeBackup.delete(client);
				saySystem(client, 'playtime restored');
				return;
			}
			const sec = parseInt(arg, 10);
			if (isNaN(sec) || sec < 0) {
				throw new UserError('invalid seconds');
			}
			if (!playtimeBackup.has(client)) {
				const stored = (client.account.counters && (client.account.counters as any).playtime) ? (client.account.counters as any).playtime : 0;
				playtimeBackup.set(client, stored);
			}
			updateAccountState(client.account, (state: any) => {
				state.counters = state.counters || {};
				state.counters.playtime = sec;
			});
			saySystem(client, `playtime set to ${sec}`);
		}, false, 'Admin'),

		command(['setcreated'], '/setcreated <YYYY-MM-DD|reset> - change or restore account creation date', 'admin', ({ }, client, message) => {
			const arg = (message || '').trim();
			if (!arg) {
				throw new UserError('provide date or reset');
			}
			if (arg.toLowerCase() === 'reset') {
				const prev = createdBackup.get(client);
				if (prev === undefined) {
					saySystem(client, 'no backup available');
					return;
				}
				client.account.createdAt = prev;
				Account.updateOne({ _id: client.accountId }, { createdAt: prev }).exec();
				createdBackup.delete(client);
				saySystem(client, 'creation date restored');
				return;
			}
			const d = new Date(arg);
			if (isNaN(d.getTime())) {
				throw new UserError('invalid date format');
			}
			if (!createdBackup.has(client)) {
				createdBackup.set(client, client.account.createdAt);
			}
			client.account.createdAt = d;
			Account.updateOne({ _id: client.accountId }, { createdAt: d }).exec();
			saySystem(client, `creation date set to ${d.toISOString().replace(/T.*$/, '')}`);
		}, false, 'Admin'),

		command(['togglerestore'], '/togglerestore - toggle terrain restoration', 'admin', ({ world: { options } }, client) => {
			options.restoreTerrain = !options.restoreTerrain;
			saySystem(client, `restoration is ${options.restoreTerrain ? 'on' : 'off'}`);
		}, false, 'Admin'),
		command(['resettiles'], '/resettiles - reset tiles to original state', 'admin', ({ }, client) => {
			for (const region of client.map.regions) {
				resetTiles(client.map, region);
			}
		}, false, 'Admin'),
		BETA && command(['season'], '/season <season> [<holiday>]', 'admin', ({ world }, _client, message) => {
			const [s = '', h = ''] = message.split(' ');
			const season = parseSeason(s);
			const holiday = parseHoliday(h);

			if (season === undefined) {
				throw new UserError('invalid season');
			} else {
				world.setSeason(season, holiday === undefined ? world.holiday : holiday);
			}
		}, false, 'Admin'),
		BETA && command(['weather'], '/weather <none|rain>', 'admin', ({ }, client, message) => {
			const weather = parseWeather(message);

			if (weather === undefined) {
				throw new UserError('invalid weather');
			} else {
				updateMapState(client.map, { weather });
			}
		}, false, 'Admin'),

		// owner
		command(['update'], '/update - prepare server for update', 'owner', ({ world, liveSettings }) => {
			createNotifyUpdate(world, liveSettings)();
		}, false, 'Owner'),
		command(['shutdown'], '/shutdown - shutdown server for update', 'owner', ({ world, liveSettings }) => {
			createShutdownServer(world, liveSettings)(true);
	}, false, 'Owner'),
		command(['loadmap'], '/loadmap <file name> - load map from file', 'owner', ({ world }, client, message) => {
			execWithFileName(client, message, fileName =>
				loadMapFromFile(world, client.map, pathTo('store', `${fileName}.json`), { loadOnlyTiles: true }));
		}, false, 'Owner'),
		command(['savemap'], '/savemap <file name> - save map to file', 'owner', (_, client, message) => {
			execWithFileName(client, message, async fileName => {
				await saveMapToFile(client.map, pathTo('store', `${fileName}.json`), { saveTiles: true });
				// await saveMapToFileBinary(client.map, pathTo('store', `${fileName}.bin`));
			});
		}, false, 'Owner'),
		command(['savemapbin'], '/savemapbin <file name> - save map to file', 'owner', (_, client, message) => {
			execWithFileName(client, message, fileName => saveMapToFileBinaryAlt(client.map, pathTo('store', `${fileName}.json`)));
		}, false, 'Owner'),
		command(['saveentities'], '/saveentities <file name> - save entities to file', 'owner', (_, client, message) => {
			execWithFileName(client, message, fileName => saveEntitiesToFile(client.map, pathTo('store', `${fileName}.txt`)));
		}, false, 'Owner'),
		command(['loadentities'], '/loadentities <file name> - load entities from file', 'owner', ({ world }, client, message) => {
			execWithFileName(client, message, fileName => loadEntitiesFromFile(world, client.map, pathTo('store', `${fileName}.txt`), { loadEntitiesAsEditable: true }));
		}, false, 'Owner'),
		command(['removeentities'], '/removeentities <file name> - remove entities from current map by file', 'owner', ({ world }, client, message) => {
			execWithFileName(client, message, fileName => removeEntitiesFromFile(world, client.map, pathTo('store', `${fileName}.txt`)));
		}, false, 'Owner'),
		command(['savehides'], '/savehides - save hides to file', 'owner', async ({ world }, client) => {
			const json = world.hidingService.serialize();
			await writeFileAsync(pathTo('store', 'hides.json'), json, 'utf8');
			saySystem(client, 'saved');
		}, false, 'Owner'),
		command(['throwerror'], '/throwerror <message> - throw test error', 'owner', (_, _client, message) => {
			throw new Error(message || 'test');
		}, false, 'Owner'),
		BETA && command(['test'], '', 'owner', ({ }, client) => {
			client.map.regions.forEach(region => {
				console.log(region.x, region.y, region.colliders.length);
			});
		}, false, 'Owner'),
		BETA && command(['spamchat'], '/spamchat - spam chat messages', 'owner',
			({ world, random }, client, _, __, ___, settings) => {
				if (interval) {
					clearInterval(interval);
					interval = undefined;
				} else {
					interval = setInterval(() => {
						if (includes(world.clients, client)) {
							const message = range(random(1, 10)).map(() => randomString(random(1, 10))).join(' ');
							sayToEveryone(client, message, message, MessageType.Chat, settings);
						} else {
							clearInterval(interval);
						}
					}, 100);
				}
			}, false, 'Owner'),
		BETA && command(['noclouds'], '/noclouds - remove clouds', 'owner', ({ world }, client) => {
			findEntities(client.map, e => e.type === cloud.type).forEach(e => world.removeEntity(e, client.map));
		}, false, 'Owner'),
		BETA && command(['msg'], '/msg - say random stuff', 'owner', ({ }, client, _, __, ___, settings) => {
			findEntities(client.map, e => !!e.options && e.name === 'debug 2')
				.forEach(e => sayToAll(e, 'Hello there!', 'Hello there!', MessageType.Chat, settings));
		}, false, 'Owner'),
		command(['hold'], '/hold <name> - hold item', 'owner', ({ }, client, message) => {
			holdItem(client.pony, getEntityType(message));
		}, false, 'Owner'),
		BETA && command(['toy'], '/toy <number> - hold toy', 'owner', ({ }, client, message) => {
			holdToy(client.pony, parseInt(message, 10) | 0);
		}, false, 'Owner'),
		BETA && command(['dc'], '/dc', 'owner', ({ }, client) => {
			client.disconnect(true, false);
		}, false, 'Owner'),
		BETA && command(['disconnect'], '/disconnect', 'owner', ({ }, client) => {
			client.disconnect(true, true);
		}, false, 'Owner'),
		BETA && command(['info'], '/info <id>', 'owner', ({ world }, client, message) => {
			const id = parseInt(message, 10) | 0;
			const entity = world.getEntityById(id);

			if (entity) {
				const { id, type, x, y, options } = entity;
				const info = { id, type: getEntityTypeName(type), x, y, options };
				saySystem(client, JSON.stringify(info, null, 2));
			} else {
				saySystem(client, 'undefined');
			}
		}, false, 'Owner'),
		BETA && command(['collider'], '/collider', 'owner', ({ }, client) => {
			const region = getRegionGlobal(client.map, client.pony.x, client.pony.y);

			if (region) {
				saveRegionCollider(region);
				saySystem(client, 'saved');
				// console.log(region.tileIndices);
			}
		}, false, 'Owner'),
		DEVELOPMENT && command(['testparty'], '', 'owner', ({ party }, client) => {
			const entities = findEntities(client.map, e => !!e.client && /^debug/.test(e.name || ''));

			for (const e of entities.slice(0, PARTY_LIMIT - 1)) {
				party.invite(client, e.client!);
			}
		}, false, 'Owner'),

		// Bunny summon command - manages follower bunnies around the player
		command(['bunnies', 'summonbunnies'], '/bunnies - вызов управления кроликами; подробности через help или ?', '', ({ world }, client, message, _, __, settings) => {
			const map = client.map;
			const player = client.pony;
			const options = getBunnyOptions(client);
			const args = (message || '').trim().split(/\s+/).filter(Boolean);
			const subcommand = args[0] ? args[0].toLowerCase() : '';

			if (!subcommand) {
				clearSummonedBunnies(client, world);
				clearFreeBunnies(client, world);
				const offsets = getFormationOffsets(options.count, options.radius, options.shape);
				const created: ServerEntity[] = [];

				let i = 0;
				for (const offset of offsets) {
					const initialPhase = (i / offsets.length) * Math.PI * 2;
					const bunnyEntities = createFollowerBunny(player, offset.x, offset.y, options.mode, options.radius, options.shape, initialPhase, false, client.map);
					bunnyEntities.forEach(bunny => {
						world.addEntity(bunny, map);
						created.push(bunny);
					});
					i++;
				}

				summonedBunnies.set(client, created);
				saySystem(client, `Кроликов:${created.length} r=${options.radius.toFixed(1)} s=${options.shape} m=${options.mode}`);
				return;
			}

			if (subcommand === '?' || subcommand === 'help') {
				saySystem(client, '/bunnies ? - управление кроликами:\ncount <n> - число кроликов\nshow - статус\nclear - убрать кроликов\nfree - освободить кроликов\nrecall - призвать свободных кроликов\nsize <0.1..15> - радиус разброса\nshape <none|circle|triangle|square|diamond|heart> - фигура\nmode <circle|stay|free> - поведение\naction <sit|look|blink|clean> - действие\narmy [count] - квадратная армия вокруг игрока\narmyfront [count] - квадратная армия перед игроком\narmy line [count] - шеренга\narmy captain - назначить командира\narmy transfer <player> - передать армию другому игроку\narmy stop - остановить взвод\narmy roam - дать взводу свободно гулять\narmy attack - бой между ближайшими армиями\nбольше команд в "/bunnies army ?"\ndefault: count 5, size 1, shape none, mode stay');
				return;
			}

			if (subcommand === 'show' || subcommand === 'count') {
				const created = summonedBunnies.get(client) || [];
				saySystem(client, `Кроликов:${created.length} r=${options.radius.toFixed(1)} s=${options.shape} m=${options.mode}`);
				return;
			}

			if (subcommand === 'clear' || subcommand === 'remove') {
				clearSummonedBunnies(client, world);
				clearFreeBunnies(client, world);
				saySystem(client, 'Кролики сняты');
				return;
			}

			if (subcommand === 'army' || subcommand === 'armyfront') {
				if (args[1] && (args[1].toLowerCase() === '?' || args[1].toLowerCase() === 'help')) {
					saySystem(client, '/bunnies army ? - управление армией:\narmy [count] - квадратная армия вокруг игрока\narmyfront [count] - квадратная армия перед игроком\narmy line [count] - шеренга\narmy captain - назначить командира\narmy transfer <player> - передать армию другому игроку\narmy stop - остановить взвод\narmy roam - дать взводу свободно гулять\narmy attack - бой между ближайшими армиями');
					return;
				}

				const action = args[1] ? args[1].toLowerCase() : '';
				const armyCountArg = args[2] ? parseInt(args[2], 10) : undefined;

				if (action === 'attack') {
					const targets = getNearbyArmyTargets(client, world);
					if (!targets.length) {
						saySystem(client, 'Рядом нет другой армии для атаки');
						return;
					}

					const opponent = targets[0];
					const isStarted = startArmyBattle(client, world, opponent, settings);
					if (!isStarted) {
						saySystem(client, 'Нельзя начать бой без армий');
						return;
					}

					saySystem(client, 'Армии вступили в бой!');
					return;
				}

				if (action === 'line') {
					const requestedCount = armyCountArg !== undefined ? armyCountArg : options.count;
					if (isNaN(requestedCount) || requestedCount <= 0) {
						throw new UserError('Usage: /bunnies army line [count]');
					}

					options.count = Math.min(requestedCount, maxBunnyCount);
					clearSummonedBunnies(client, world);
					clearFreeBunnies(client, world);
					const offsets = getArmyLineFormationOffsets(options.count, 0.25, subcommand === 'armyfront' ? 1.0 : 0, 0);
					const created = createFormationBunnies(client, world, map, player, offsets, 'stay', options.radius, 'none', true);
					summonedBunnies.set(client, created);
					applyArmyState(created, 'stay');
					saySystem(client, `Шеренга:${created.length}`);
					return;
				}

				if (action === 'captain') {
					const created = getSummonedBunnies(client);
					if (!created.length) {
						saySystem(client, 'Сначала сформируйте армию');
						return;
					}

					assignArmyCaptain(client, created, settings);
					saySystem(client, 'Командир назначен');
					return;
				}

				if (action === 'transfer' || action === 'give') {
					const created = getSummonedBunnies(client);
					const free = freeBunnies.get(client) || [];
					if (!created.length && !free.length) {
						saySystem(client, 'Сначала сформируйте армию');
						return;
					}

					const targetName = args.slice(2).join(' ').trim();
					if (!targetName) {
						throw new UserError('Usage: /bunnies army transfer <player>');
					}

					const targetClient = findArmyTargetClient(world, targetName, client);
					if (!targetClient) {
						saySystem(client, 'Игрок не найден');
						return;
					}

					const transferred = transferArmyToClient(client, targetClient);
					if (!transferred) {
						saySystem(client, 'Не удалось передать армию');
						return;
					}

					assignArmyCaptain(targetClient, getSummonedBunnies(targetClient), settings);
					saySystem(client, `Армия передана ${targetClient.pony.name || targetClient.accountName}`);
					saySystem(targetClient, 'Армия передана вам');
					return;
				}

				if (action === 'stop' || action === 'follow') {
					const created = getSummonedBunnies(client);
					if (!created.length) {
						saySystem(client, 'Сначала сформируйте армию');
						return;
					}
					applyArmyState(created, 'stay');
					saySystem(client, 'Взвод остановлен');
					return;
				}
				if (action === 'roam' || action === 'free') {
					const created = getSummonedBunnies(client);
					if (!created.length) {
						saySystem(client, 'Сначала сформируйте армию');
						return;
					}
					applyArmyState(created, 'free');
					saySystem(client, 'Взвод пошёл в свободный режим');
					return;
				}

				const requestedCount = action && !isNaN(parseInt(action, 10)) ? parseInt(action, 10) : options.count;
				if (isNaN(requestedCount) || requestedCount <= 0) {
					throw new UserError('Usage: /bunnies army [count] | /bunnies armyfront [count] | /bunnies army line [count] | /bunnies army captain | /bunnies army transfer <player> | /bunnies army stop | /bunnies army roam | /bunnies army attack');
				}

				options.count = Math.min(requestedCount, maxBunnyCount);
				options.mode = 'stay';
				options.shape = 'none';
				clearSummonedBunnies(client, world);
				clearFreeBunnies(client, world);

				const frontOffset = subcommand === 'armyfront' ? { x: 2.5, y: 0 } : { x: 0, y: 0 };
				const offsets = getArmyFormationOffsets(options.count, 0.25, frontOffset.x, frontOffset.y);
				const created = createFormationBunnies(client, world, map, player, offsets, options.mode, options.radius, options.shape, true);

				summonedBunnies.set(client, created);
				const targets = getNearbyArmyTargets(client, world);
				saySystem(client, `Армия:${created.length} ${subcommand === 'armyfront' ? 'front' : 'square'}${targets.length ? ' attack-ready' : ''}`);
				return;
			}

			if (subcommand === 'size' || subcommand === 'radius') {
				if (args.length < 2) {
					throw new UserError('Usage: /bunnies size <radius>');
				}

				const radius = parseFloat(args[1].replace(',', '.'));
				if (isNaN(radius) || radius < minBunnyRadius || radius > maxBunnyRadius) {
					throw new UserError(`Radius must be between ${minBunnyRadius.toFixed(1)} and ${maxBunnyRadius.toFixed(1)}`);
				}

				options.radius = radius;
				clearSummonedBunnies(client, world);
				clearFreeBunnies(client, world);

				const offsets = getFormationOffsets(options.count, options.radius, options.shape);
				const created: ServerEntity[] = [];

				let i = 0;
				for (const offset of offsets) {
					const initialPhase = (i / offsets.length) * Math.PI * 2;
					const bunnyEntities = createFollowerBunny(player, offset.x, offset.y, options.mode, options.radius, options.shape, initialPhase, false, client.map);
					bunnyEntities.forEach(bunny => {
						world.addEntity(bunny, map);
						created.push(bunny);
					});
					i++;
				}

				summonedBunnies.set(client, created);
				saySystem(client, `r=${radius.toFixed(1)} s=${options.shape}`);
				return;
			}

			if (subcommand === 'shape') {
				if (args.length < 2) {
					throw new UserError('Usage: /bunnies shape <none|circle|triangle|square|diamond|heart>');
				}

				const shape = args[1].toLowerCase();
				if (shape !== 'none' && shape !== 'circle' && shape !== 'triangle' && shape !== 'square' && shape !== 'diamond' && shape !== 'heart') {
					throw new UserError('Shape must be none, circle, triangle, square, diamond, or heart');
				}

				options.shape = shape as 'none' | 'circle' | 'triangle' | 'square' | 'diamond' | 'heart';
				clearSummonedBunnies(client, world);
				clearFreeBunnies(client, world);

				const offsets = getFormationOffsets(options.count, options.radius, options.shape);
				const created: ServerEntity[] = [];

				let i = 0;
				for (const offset of offsets) {
					const initialPhase = (i / offsets.length) * Math.PI * 2;
					const bunnyEntities = createFollowerBunny(player, offset.x, offset.y, options.mode, options.radius, options.shape, initialPhase);
					bunnyEntities.forEach(bunny => {
						world.addEntity(bunny, map);
						created.push(bunny);
					});
					i++;
				}

				summonedBunnies.set(client, created);
				saySystem(client, `s=${options.shape}`);
				return;
			}

			if (subcommand === 'mode') {
				if (args.length < 2) {
					throw new UserError('Usage: /bunnies mode <circle|stay|free>');
				}

				const mode = args[1].toLowerCase();
				if (mode !== 'circle' && mode !== 'stay' && mode !== 'free') {
					throw new UserError('Mode must be circle, stay, or free');
				}

				options.mode = mode as 'circle' | 'stay' | 'free';
				clearSummonedBunnies(client, world);
				clearFreeBunnies(client, world);

				const offsets = getFormationOffsets(options.count, options.radius, options.shape);
				const created: ServerEntity[] = [];

				let i = 0;
				for (const offset of offsets) {
					const initialPhase = (i / offsets.length) * Math.PI * 2;
					const bunnyEntities = createFollowerBunny(player, offset.x, offset.y, options.mode, options.radius, options.shape, initialPhase, false, client.map);
					bunnyEntities.forEach(bunny => {
						world.addEntity(bunny, map);
						created.push(bunny);
					});
					i++;
				}

				summonedBunnies.set(client, created);
				saySystem(client, `m=${options.mode}`);
				return;
			}

			if (subcommand === 'action') {
				if (args.length < 2) {
					throw new UserError('Usage: /bunnies action <sit|look|blink|clean>');
				}

				const action = args[1].toLowerCase();
				let anim: BunnyAnimation;

				switch (action) {
					case 'sit':
						anim = BunnyAnimation.Sit;
						break;
					case 'look':
						anim = BunnyAnimation.Look;
						break;
					case 'blink':
						anim = BunnyAnimation.Blink;
						break;
					case 'clean':
						anim = BunnyAnimation.Clean;
						break;
					default:
						throw new UserError('Action must be sit, look, blink, or clean');
				}

				const count = setSummonedBunnyAnimation(client, anim);
				if (!count) {
					saySystem(client, 'Нет кроликов');
					return;
				}

				saySystem(client, `cmd=${action} n=${count}`);
				return;
			}

			if (subcommand === 'free') {
				const created = summonedBunnies.get(client) || [];
				if (created.length === 0) {
					saySystem(client, 'Нет кроликов для освобождения');
					return;
				}

				// Освобождаем кроликов - переводим в режим free
				for (const bunny of created) {
					bunny.bunnyMode = 'free';
				}

				// Очищаем список призванных кроликов
				summonedBunnies.delete(client);
				freeBunnies.set(client, created);

				saySystem(client, `Освобождено кроликов: ${created.length}`);
				return;
			}

			if (subcommand === 'recall') {
				const free = freeBunnies.get(client) || [];
				if (free.length === 0) {
					saySystem(client, 'Нет свободных кроликов для призыва');
					return;
				}

				// Призываем кроликов обратно - переводим в режим stay
				const options = getBunnyOptions(client);
				for (const bunny of free) {
					bunny.bunnyMode = options.mode;
				}

				// Перемещаем в список призванных
				summonedBunnies.set(client, free);
				freeBunnies.delete(client);

				saySystem(client, `Призвано кроликов: ${free.length}`);
				return;
			}

			const count = parseInt(subcommand, 10);
			if (!isNaN(count) && count > 0) {
				options.count = Math.min(count, maxBunnyCount);
				clearSummonedBunnies(client, world);
				clearFreeBunnies(client, world);

				const offsets = getFormationOffsets(options.count, options.radius, options.shape);
				const created: ServerEntity[] = [];

				let i = 0;
				for (const offset of offsets) {
					const initialPhase = (i / offsets.length) * Math.PI * 2;
					const bunnyEntities = createFollowerBunny(player, offset.x, offset.y, options.mode, options.radius, options.shape, initialPhase, false, client.map);
					bunnyEntities.forEach(bunny => {
						world.addEntity(bunny, map);
						created.push(bunny);
					});
					i++;
				}

				summonedBunnies.set(client, created);
				saySystem(client, `Кроликов:${created.length} r=${options.radius.toFixed(1)} s=${options.shape} m=${options.mode}`);
				return;
			}

			throw new UserError('Usage: /bunnies [count] | /bunnies show | /bunnies clear | /bunnies free | /bunnies recall | /bunnies size <radius> | /bunnies shape <none|circle|triangle|square|diamond|heart> | /bunnies mode <circle|stay|free> | /bunnies action <sit|look|blink|clean> | /bunnies army [count] | /bunnies armyfront [count] | /bunnies army line [count] | /bunnies army captain | /bunnies army stop | /bunnies army roam | /bunnies army attack');
		}, false, 'mod'),
	]);

	return commands;
}

export function getSpamCommandNames(commands: Command[]): string[] {
	return flatten(commands.filter(c => c.spam).map(c => c.names));
}

export type RunCommand = ReturnType<typeof createRunCommand>;

export const createRunCommand =
	(context: CommandContext, commands: Command[]) =>
		(client: IClient, command: string, args: string, type: ChatType, target: IClient | undefined, settings: GameServerSettings) => {
			command = command.toLowerCase().trim();
			const func = commands.find(c => c.names.indexOf(command) !== -1);

			try {
				if (func && hasRoleNull(client, func.role)) {
					func.handler(context, client, args, type, target, settings);
				} else {
					return false;
				}
			} catch (err) {
				const e: any = err;
				if (e && typeof e.message === 'string') {
					saySystem(client, e.message);
				} else {
					throw err;
				}
			}

			return true;
		};

const chatTypes = new Map<string, ChatType>();
chatTypes.set('p', ChatType.Party);
chatTypes.set('party', ChatType.Party);
chatTypes.set('s', ChatType.Say);
chatTypes.set('say', ChatType.Say);
chatTypes.set('t', ChatType.Think);
chatTypes.set('think', ChatType.Think);
chatTypes.set('ss', ChatType.Supporter);
chatTypes.set('s1', ChatType.Supporter1);
chatTypes.set('s2', ChatType.Supporter2);
chatTypes.set('s3', ChatType.Supporter3);
chatTypes.set('s4', ChatType.Supporter4);
chatTypes.set('r', ChatType.Whisper);
chatTypes.set('reply', ChatType.Whisper);
chatTypes.set('w', ChatType.Whisper);
chatTypes.set('whisper', ChatType.Whisper);

export function parseCommand(text: string, type: ChatType): { command?: string; args: string; type: ChatType; } {
	if (!isCommand(text) || text.toLowerCase().startsWith('/shrug')) {
		return { args: text, type };
	}

	const { command, args } = processCommand(text);

	if (command) {
		const chatType = chatTypes.get(command.toLowerCase());

		if (chatType !== undefined) {
			if (chatType === ChatType.Think) {
				type = type === ChatType.Party ? ChatType.PartyThink : ChatType.Think;
			} else {
				type = chatType;
			}

			return { args, type };
		}
	}

	return { command, args, type };
}

export function getChatPrefix(type: ChatType) {
	switch (type) {
		case ChatType.Party:
		case ChatType.PartyThink:
			return '/p ';
		case ChatType.Supporter:
			return '/ss ';
		case ChatType.Supporter4:
			return '';
		case ChatType.Dismiss:
			return '/dismiss ';
		case ChatType.Whisper:
			return '/w ';
		default:
			return '';
	}
}
