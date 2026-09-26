import { Action, EntityState, MessageType, PonyInfo } from '../common/interfaces';
import { createServerDefaultPony } from '../common/ponyInfo';
import { compressPonyString } from '../common/compressPony';
import { pony as ponyEntity } from '../common/entities';
import {
	DISCORD_PONY, OFFLINE_PONY, TIKTOK_PONY, TELEGRAM_PONY, SUPPORTER_PONY, DEL_PONY, KOKOSIK_PONY, DEFAULT_PONY,
	HIKA_MIG_PONY, AALIK_PONY, SOFA_PONY, ENOT_PONY, LAI_PONY, KRIF_PONY, REY_SHLAPOCHNIK_PONY
} from '../common/constants';
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
			const ponyInfo = definition.ponyInfo || createServerDefaultPony();
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
		const eventWaypoints = (x: number, y: number) => [
			{ x, y },
			{ x: x + 2, y },
			{ x: x + 2, y: y + 2 },
			{ x: x - 1, y: y + 2 },
			{ x: x - 1, y },
		];
		const extraNPCs = [
			{
				id: 'npc-del', name: 'Del Pony', x: 44, y: 36, info: DEL_PONY,
				phrases: ['Я пришёл проверить подарки, а не подписываться на приключения.', 'Кто положил подарок прямо посреди дороги?', 'Ладно, один подарок я всё-таки возьму.', 'Надеюсь, это не проверка на внимательность.', 'Я всё вижу. Почти всё.'],
			},
			{
				id: 'npc-kokosik', name: 'Kokosik Pony', x: 91, y: 34, info: KOKOSIK_PONY,
				phrases: ['Ой, тут так красиво стало!', 'Я нашёл подарок! Правда, он уже чей-то?', 'Давайте устроим маленький праздник прямо здесь.', 'Кто-нибудь видел, куда убежал тот весёлый пони?', 'Мне нравится, когда на карте происходит что-то неожиданное.'],
			},
			{
				id: 'npc-default', name: 'Default Pony', x: 112, y: 48, info: DEFAULT_PONY,
				phrases: ['Я ничего не менял, оно само так получилось.', 'Праздник запущен. Настройки не найдены.', 'Интересно, это уже финальная версия или ещё тестовая?', 'Если что-то сломается, я просто постою рядом.', 'Выглядит знакомо. Но почему тогда подарки?'],
			},
			{
				id: 'npc-hika-mig', name: 'Hika Mig Pony', x: 126, y: 70, info: HIKA_MIG_PONY,
				phrases: ['Ого, какой сегодня движ!', 'Кто готов бежать наперегонки за подарками?', 'Я видел кое-что интересное на той стороне карты.', 'Не стой на месте, праздник сам себя не исследует.', 'Осень, Новый год и подарки. Сюжет становится интереснее.'],
			},
			{
				id: 'npc-aalik', name: 'Aalik Pony', x: 118, y: 105, info: AALIK_PONY,
				phrases: ['Тише, я пытаюсь понять, что происходит.', 'У этого праздника определённо есть какая-то тайна.', 'Подарки появились слишком аккуратно. Это подозрительно.', 'Мне кажется, кто-то наблюдает за всеми из-за дерева.', 'Я запишу всё, что увижу. На всякий случай.'],
			},
			{
				id: 'npc-sofa', name: 'Sofa Pony', x: 91, y: 123, info: SOFA_PONY,
				phrases: ['Я бы пошёл за подарками, но место уже идеально удобное.', 'Кто-нибудь может принести подарок сюда?', 'Праздник отличный. Особенно если смотреть на него сидя.', 'Я ненадолго прилёг. Возможно, до конца ивента.', 'Если меня ищут, скажите, что я занят отдыхом.'],
			},
			{
				id: 'npc-enot', name: 'Enot Pony', x: 52, y: 126, info: ENOT_PONY,
				phrases: ['Я нашёл подарок! А теперь он почему-то исчез.', 'Не знаю, кто это устроил, но тут явно есть чем поживиться.', 'Проверяю кусты на наличие сюрпризов.', 'Если подарок блестит, это ещё не значит, что его можно брать.', 'Я ничего не крал. Я проводил исследование.'],
			},
			{
				id: 'npc-lai', name: 'Lai Pony', x: 30, y: 104, info: LAI_PONY,
				phrases: ['Как тихо... и вдруг подарки.', 'Я люблю праздники, в которых можно просто гулять.', 'Карта сегодня выглядит совсем иначе.', 'Интересно, заметит ли кто-нибудь, если я возьму один подарок?', 'Пожалуй, останусь здесь ещё ненадолго.'],
			},
			{
				id: 'npc-krif', name: 'Krif Pony', x: 27, y: 66, info: KRIF_PONY,
				phrases: ['Так, кто включил Новый год раньше времени?', 'Я требую объяснений. И один подарок за ожидание.', 'Не переживайте, я всё контролирую.', 'Почему все бегают, будто началась распродажа?', 'Ладно, признаю: выглядит весело.'],
			},
			{
				id: 'npc-rey-shlapochnik', name: 'Rey Shlapochnik', x: 35, y: 28, info: REY_SHLAPOCHNIK_PONY,
				phrases: ['Шляпа говорит, что праздник начался.', 'Не спрашивайте, почему осень. Так задумано.', 'Я видел пони, который искал подарок под подарком.', 'Если услышите странный звук, это, скорее всего, я.', 'Очень достойное событие для небольшой юбилейной даты.'],
			},
			{
				id: 'npc-tiktok', name: 'TikTok Pony', x: 142, y: 42, info: TIKTOK_PONY,
				phrases: ['Так, это срочно надо снять!', 'Подарки, осень и Новый год одновременно? Контент сам себя не сделает.', 'Кто-нибудь, повторите этот момент, я не успел записать.', 'Если я сейчас станцую рядом с подарком, это станет трендом?', 'Подпишитесь на меня, пока я ищу самый красивый подарок.'],
			},
			{
				id: 'npc-telegram', name: 'Telegram Pony', x: 42, y: 140, info: TELEGRAM_PONY,
				phrases: ['Я уже отправил сообщение, но никто не ответил.', 'Кто-нибудь видел новости про этот праздник?', 'Сюда бы канал с расписанием появления подарков.', 'Не забудьте проверить закреплённое сообщение.', 'Осень подтверждена. Новогодний ивент тоже подтверждён.'],
			},
		];
		const definitions: NPCDefinition[] = [
			{
				id: 'npc-sleepy',
				name: 'Offline Pony',
				x: 73,
				y: 73,
				map,
				info: OFFLINE_PONY,
				behavior: {
					waypoints: [
						{ x: 73, y: 73 },
						{ x: 75, y: 73 },
						{ x: 75, y: 75 },
						{ x: 72, y: 75 },
						{ x: 72, y: 72 },
					],
					phrases: [
						'Я хотел немного поспать, но тут кто-то опять ищет подарки.',
						'А? Помочь собрать подарки? Нет, я лучше ещё полежу.',
						'Праздник хороший, если можно наблюдать за ним из удобного места.',
						'Я видел сон про Новый год. Странно, ведь на улице осень.',
						'Разбудите меня, если найдёте что-то действительно интересное.',
					],
					liePoint: { x: 72, y: 72 },
					restTime: [28, 42] as [number, number],
					lyingTime: [30, 48] as [number, number],
					speakInterval: [36, 60] as [number, number],
					actions: [Action.Sleep, Action.Yawn, Action.Lie],

				},
			},
			{
				id: 'npc-support',
				name: 'Support Pony',
				x: 73,
				y: 73,
				map,
				info: SUPPORTER_PONY,
				behavior: {
					waypoints: [
						{ x: 73, y: 73 },
						{ x: 76, y: 73 },
						{ x: 76, y: 76 },
						{ x: 73, y: 76 },
						{ x: 71, y: 74 },
					],
					phrases: [
						'Ого, сколько всего происходит! Давайте не будем стоять без дела.',
						'Если кому-то нужна помощь, зовите. Только сначала я закончу отдыхать.',
						'Подарки уже заметили? Отлично, значит праздник работает.',
						'Я не знаю, кто это устроил, но настроение стало заметно лучше.',
						'Давайте сделаем вид, что мы всё понимаем, и просто повеселимся.',
					],
					sitPoint: { x: 76, y: 76 },
					restTime: [22, 32] as [number, number],
					speakInterval: [16, 32] as [number, number],
					actions: [Action.Laugh, Action.Blush, Action.TurnHead],

				},
			},
			{
				id: 'npc-discord',
				name: 'Discord Pony',
				x: 58,
				y: 22,
				map,
				info: DISCORD_PONY,
				behavior: {
					waypoints: [
						{ x: 58, y: 22 },
						{ x: 61, y: 22 },
						{ x: 61, y: 25 },
						{ x: 57, y: 25 },
						{ x: 56, y: 22 },
					],
					phrases: [
						'Заходи в наш Discord, там можно обсудить, что здесь вообще происходит.',
						'Кто-нибудь уже написал про этот праздник в Discord?',
						'Если найдёшь странный подарок, расскажи всем. Такие истории нам нужны.',
						'Мне нравится, что весь мир сегодня немного не понимает сам себя.',
						'Осень с новогодним ивентом? Это точно стоит обсудить.',
					],
					sitPoint: { x: 61, y: 25 },
					restTime: [20, 30] as [number, number],
					speakInterval: [20, 36] as [number, number],
					actions: [Action.TurnHead, Action.Laugh, Action.Excite],

				},
			},
			...extraNPCs.map(npc => ({
				...npc,
				map,
				behavior: {
					waypoints: eventWaypoints(npc.x, npc.y),
					phrases: npc.phrases,
					sitPoint: { x: npc.x + 2, y: npc.y + 2 },
					restTime: [8, 16] as [number, number],
					speakInterval: [28, 56] as [number, number],
					actions: [Action.TurnHead, Action.Laugh, Action.Excite, Action.Dance1],
				},
			})),
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
