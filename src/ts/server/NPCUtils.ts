import { Action, EntityState, MessageType, PonyInfo } from '../common/interfaces';
import { createDefaultPony } from '../common/ponyInfo';
import { compressPonyString } from '../common/compressPony';
import { pony as ponyEntity } from '../common/entities';
import { DISCORD_PONY, OFFLINE_PONY, SUPPORTER_PONY } from '../common/constants';
import { ServerEntity, ServerMap } from './serverInterfaces';
import { World } from './world';
import { setEntityName, updateEntityState, updateEntityVelocity, sendAction } from './entityUtils';
import { setEntityExpression } from './playerUtils';
import { encryptInfo } from './characterUtils';
import { setPonyState, isPonyLying, isPonySitting } from '../common/entityUtils';
import { parseExpression } from '../common/expressionUtils';
import { sayToAll } from './chat';
import { GameServerSettings } from '../common/adminInterfaces';

export interface NPCBehavior {
	waypoints: { x: number; y: number }[];
	phrases: string[];
	actions?: Action[];
	expressions?: string[];
	sitPoint?: { x: number; y: number };
	liePoint?: { x: number; y: number };
	restTime?: [number, number];
	lyingTime?: [number, number];
	speakInterval?: [number, number];
}

export interface NPCDefinition {
	id: string;
	name: string;
	x: number;
	y: number;
	map: ServerMap;
	ponyInfo?: PonyInfo;
	info?: string;
	chatText?: string;
	options?: Record<string, any>;
	behavior?: NPCBehavior;
}

export interface NPCEntity extends ServerEntity {
	npcId: string;
	isNPC: true;
	chatText?: string;
}

const defaultChatSettings = {} as GameServerSettings;

export class NPCUtils {
	private readonly npcs = new Map<string, NPCEntity>();

	constructor(private readonly world: World) {
	}

	createAndRegisterNPC(definition: NPCDefinition): NPCEntity {
		const entity = this.createNPCEntity(definition);
		entity.serverUpdate = this.createNPCUpdate(entity, definition);
		this.registerNPC(entity, definition.map);
		return entity;
	}

	createNPCEntity(definition: NPCDefinition): NPCEntity {
		const entity = ponyEntity(definition.x, definition.y) as NPCEntity;
		entity.type = entity.type || 1;
		entity.id = 0;
		entity.npcId = definition.id;
		entity.isNPC = true;
		entity.name = definition.name;
		entity.chatText = definition.chatText;
		if (definition.info) {
			entity.info = definition.info;
			entity.infoSafe = definition.info;
			entity.encryptedInfoSafe = encryptInfo(definition.info);
		} else {
			const ponyInfo = definition.ponyInfo || createDefaultPony();
			entity.info = compressPonyString(ponyInfo);
			entity.infoSafe = entity.info;
			entity.encryptedInfoSafe = encryptInfo(entity.info);
		}
		entity.crc = 0;
		entity.options = { ...(definition.options || {}) };
		(entity.options as any).tag = 'npc';
		(entity.options as any).ex = true;
		setEntityName(entity, definition.name);
		entity.serverFlags = entity.serverFlags || 0;
		entity.state = setPonyState(entity.state, EntityState.PonyStanding);
		entity.serverUpdate = undefined;
		return entity;
	}

	registerNPC(entity: NPCEntity, map: ServerMap) {
		this.npcs.set(entity.npcId, entity);
		this.world.addEntity(entity, map);
		return entity;
	}

	getNPC(id: string) {
		return this.npcs.get(id);
	}

	getNPCs() {
		return Array.from(this.npcs.values());
	}

	removeNPC(id: string, map: ServerMap) {
		const npc = this.npcs.get(id);
		if (!npc) {
			return false;
		}
		this.npcs.delete(id);
		this.world.removeEntity(npc, map);
		return true;
	}

	spawnDefaultNPCs(map: ServerMap) {
		const definitions: NPCDefinition[] = [
			{
				id: 'npc-sleepy',
				name: 'Offline Pony',
				x: 15,
				y: 17,
				map,
				info: OFFLINE_PONY,
				behavior: {
					waypoints: [
						{ x: 15, y: 17 },
						{ x: 19, y: 17 },
						{ x: 20, y: 20 },
						{ x: 16, y: 22 },
						{ x: 13, y: 19 },
					],
					phrases: ['Мне нужен короткий отдых.', 'Здесь так спокойно, что хочется вздремнуть.', 'Лучшее место для сна — в тишине.'],
					liePoint: { x: 13, y: 19 },
					restTime: [28, 42],
					lyingTime: [30, 48],
					speakInterval: [18, 30],
					actions: [Action.Sleep, Action.Yawn, Action.Lie],

				},
			},
			{
				id: 'npc-support',
				name: 'Support Pony',
				x: 12,
				y: 18,
				map,
				info: SUPPORTER_PONY,
				behavior: {
					waypoints: [
						{ x: 12, y: 18 },
						{ x: 18, y: 16 },
						{ x: 22, y: 18 },
						{ x: 20, y: 22 },
						{ x: 14, y: 22 },
					],
					phrases: [
						'Ты отлично справляешься!',
						'Я всегда готов помочь.',
						'Здесь очень уютно, заходи ещё.',
					],
					sitPoint: { x: 20, y: 22 },
					restTime: [22, 32],
					speakInterval: [8, 16],
					actions: [Action.Laugh, Action.Blush, Action.TurnHead],

				},
			},
			{
				id: 'npc-discord',
				name: 'Discord Pony',
				x: 18,
				y: 12,
				map,
				info: DISCORD_PONY,
				behavior: {
					waypoints: [
						{ x: 18, y: 12 },
						{ x: 24, y: 14 },
						{ x: 20, y: 20 },
						{ x: 15, y: 16 },
						{ x: 18, y: 22 },
					],
					phrases: [
						'Заходи в наш Discord — там весело!',
						'Там всегда найдётся компания для беседы.',
						'Новые друзья ждут тебя прямо сейчас.',
					],
					sitPoint: { x: 18, y: 22 },
					restTime: [20, 30],
					speakInterval: [10, 18],
					actions: [Action.TurnHead, Action.Laugh, Action.Excite],

				},
			},
		];

		return definitions.map(definition => this.createAndRegisterNPC(definition));
	}

	private createNPCUpdate(entity: NPCEntity, definition: NPCDefinition) {
		const behavior = definition.behavior || {
			waypoints: [{ x: definition.x, y: definition.y }],
			phrases: [],
		};
		const getRandomExpression = () => {
			if (!behavior.expressions || !behavior.expressions.length) {
				return undefined;
			}
			return parseExpression(behavior.expressions[Math.floor(Math.random() * behavior.expressions.length)]);
		};
		let targetIndex = 0;
		let waitTime = 0;
		let speakDelay = this.randomInRange(behavior.speakInterval || [12, 24]);

		return (_delta: number, now: number) => {
			const delta = _delta;
			if (waitTime > 0) {
				waitTime -= delta;
			}

			const target = behavior.waypoints[targetIndex];
			const dx = target.x - entity.x;
			const dy = target.y - entity.y;
			const distanceSq = dx * dx + dy * dy;
			const isAtTarget = distanceSq < 0.16;

			if (isAtTarget) {
				updateEntityVelocity(entity, 0, 0, now);

				const isAtLiePoint = behavior.liePoint && behavior.liePoint.x === target.x && behavior.liePoint.y === target.y;
				const isAtSitPoint = behavior.sitPoint && behavior.sitPoint.x === target.x && behavior.sitPoint.y === target.y;

				if (isAtLiePoint) {
					if (!isPonyLying(entity)) {
						updateEntityState(entity, setPonyState(entity.state, EntityState.PonyLying));
						waitTime = this.randomInRange(behavior.lyingTime || behavior.restTime || [24, 32]);
						const expression = getRandomExpression();
						if (expression) {
							setEntityExpression(entity, expression, 14000, true);
						}
					}
				} else if (isAtSitPoint) {
					if (!isPonySitting(entity)) {
						updateEntityState(entity, setPonyState(entity.state, EntityState.PonySitting));
						waitTime = this.randomInRange(behavior.restTime || [20, 30]);
						const expression = getRandomExpression();
						if (expression) {
							setEntityExpression(entity, expression, 12000, true);
						}
					}
				} else if (waitTime <= 0 && (isPonySitting(entity) || isPonyLying(entity))) {
					// Stand up and immediately move to the next waypoint so NPCs don't remain stuck
					updateEntityState(entity, setPonyState(entity.state, EntityState.PonyStanding));
					if (behavior.waypoints && behavior.waypoints.length) {
						targetIndex = (targetIndex + 1) % behavior.waypoints.length;
						waitTime = this.randomInRange([0.6, 1.4]);
					}
				}

				if (waitTime <= 0 && !isPonySitting(entity) && !isPonyLying(entity)) {
					targetIndex = (targetIndex + 1) % behavior.waypoints.length;
					waitTime = this.randomInRange([6, 12]);

					if (behavior.actions && behavior.actions.length) {
						const action = behavior.actions[Math.floor(Math.random() * behavior.actions.length)];
						sendAction(entity, action);
					}

					const expression = getRandomExpression();
					if (expression) {
						setEntityExpression(entity, expression, 10000, true);
					}
				}
			} else {
				if (!isPonySitting(entity) && !isPonyLying(entity)) {
					updateEntityState(entity, setPonyState(entity.state, EntityState.PonyWalking));
				}
				updateEntityVelocity(entity, dx / Math.sqrt(distanceSq) * 1.2, dy / Math.sqrt(distanceSq) * 1.2, now);
			}

			speakDelay -= delta;
			if (speakDelay <= 0 && behavior.phrases.length) {
				const phrase = behavior.phrases[Math.floor(Math.random() * behavior.phrases.length)];
				sayToAll(entity, phrase, phrase, MessageType.NPC, defaultChatSettings);
				speakDelay = this.randomInRange(behavior.speakInterval || [12, 24]);
			}
		};
	}

	private randomInRange(range: [number, number]) {
		return Math.random() * (range[1] - range[0]) + range[0];
	}
}
