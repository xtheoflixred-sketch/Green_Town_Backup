import { ServerEntity, ServerMap, IClient } from './serverInterfaces';
import { World } from './world';
import { Rect, SignEntityOptions, MessageType, CreateEntityMethod, PonyOptions, Point } from '../common/interfaces';
import { roundPosition } from '../common/positionUtils';
import { getRegionGlobal } from '../common/worldMap';
import { addEntityToRegion, getRegionTiles, removeEntityFromRegion } from './serverRegion';
import * as entities from '../common/entities';
import { updateTileIndices } from '../client/tileUtils';
import { generateRegionCollider } from '../common/region';
import { PONY_TYPE, tileWidth, tileHeight } from '../common/constants';
import { sayTo, saySystem, sayToOthers } from './chat';

import { setEntityName, updateEntityVelocity, setEntityAnimation } from './entityUtils';
import { updateAccountState } from './accountUtils';
import { toInt, includes } from '../common/utils';
import { holdItem } from './playerUtils';
import { random, sample, clamp } from 'lodash';
import { findEntities } from './serverMap';
import { randomPosition } from './controllers/collectableController';
import { BunnyAnimation } from '../common/entities';
import { isStaticCollision } from '../common/collision';

function updateFreeBunny(entity: ServerEntity, now: number, map: ServerMap | undefined,
	currentAction: 'walk' | 'idle' | 'explore', nextActionChange: number, targetX: number, targetY: number,
	setCurrentAction: (action: 'walk' | 'idle' | 'explore') => void,
	setNextActionChange: (time: number) => void,
	setTarget: (x: number, y: number) => void): void {
	// Свободные кролики имеют свою логику поведения
	const bunnySpeed = 4 + random(-1, 1, true);

	// Проверяем, нужно ли выбрать новое действие
	if (now >= nextActionChange) {
		const rand = Math.random();

		if (rand < 0.4) {
			// Идти в случайном направлении
			setCurrentAction('walk');
			const angle = Math.random() * Math.PI * 2;
			const distance = random(2, 8, true);
			setTarget(entity.x + Math.cos(angle) * distance, entity.y + Math.sin(angle) * distance);
			setNextActionChange(now + random(3, 8, true));
		} else if (rand < 0.7) {
			// Стоять и выполнять случайное действие
			setCurrentAction('idle');
			setNextActionChange(now + random(2, 6, true));

			const actionRand = Math.random();
			if (actionRand < 0.4) {
				setEntityAnimation(entity, BunnyAnimation.Sit);
			} else if (actionRand < 0.7) {
				setEntityAnimation(entity, BunnyAnimation.Look);
			} else {
				setEntityAnimation(entity, BunnyAnimation.Clean);
			}
		} else {
			// Исследовать окрестности
			setCurrentAction('explore');
			const angle = Math.random() * Math.PI * 2;
			const distance = random(1, 4, true);
			setTarget(entity.x + Math.cos(angle) * distance, entity.y + Math.sin(angle) * distance);
			setNextActionChange(now + random(1, 4, true));
		}
	}

	// Выполняем текущее действие
	if (currentAction === 'walk' || currentAction === 'explore') {
		const dx = targetX - entity.x;
		const dy = targetY - entity.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist < 0.3) {
			// Достигли цели, останавливаемся
			updateEntityVelocity(entity, 0, 0, now);
			setEntityAnimation(entity, BunnyAnimation.Sit);
			setCurrentAction('idle');
			setNextActionChange(now + random(1, 3, true));
		} else {
			// Двигаемся к цели
			let vx = dx / dist * bunnySpeed;
			let vy = dy / dist * bunnySpeed;

			// Проверяем коллизии
			if (map) {
				const testEntity = { ...entity, x: entity.x + vx * 0.1, y: entity.y + vy * 0.1 };
				if (isStaticCollision(testEntity, map, true)) {
					// Есть препятствие, выбираем новое направление
					const angle = Math.random() * Math.PI * 2;
					const distance = random(1, 3, true);
					setTarget(entity.x + Math.cos(angle) * distance, entity.y + Math.sin(angle) * distance);
					setNextActionChange(now + random(0.5, 2, true));
					return;
				}
			}

			updateEntityVelocity(entity, vx, vy, now);
			setEntityAnimation(entity, BunnyAnimation.Walk, vx > 0);
		}
	}
}

function getPositionOnShapePerimeter(shape: 'none' | 'circle' | 'triangle' | 'square' | 'diamond' | 'heart', radius: number, t: number): { x: number; y: number } {
	if (shape === 'none' || shape === 'circle') {
		const angle = t * Math.PI * 2;
		return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
	}

	if (shape === 'heart') {
		// Параметрическое уравнение сердца (перевернутое для правильной ориентации)
		const angle = t * Math.PI * 2;
		const x = 16 * Math.pow(Math.sin(angle), 3) * radius / 16;
		const y = -(13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle)) * radius / 13;
		return { x, y };
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
	const distance = t * perimeter;

	let edgeIndex = 0;
	let remainingDistance = distance;
	while (remainingDistance > edgeLengths[edgeIndex] && edgeIndex < sides - 1) {
		remainingDistance -= edgeLengths[edgeIndex];
		edgeIndex++;
	}

	const start = vertices[edgeIndex];
	const end = vertices[(edgeIndex + 1) % sides];
	const ratio = edgeLengths[edgeIndex] === 0 ? 0 : remainingDistance / edgeLengths[edgeIndex];
	return {
		x: start.x + (end.x - start.x) * ratio,
		y: start.y + (end.y - start.y) * ratio,
	};
}

export const worldForTemplates: any = {
	featureFlags: {},
	addEntity(entity: ServerEntity, map: ServerMap) {
		roundPosition(entity);
		const region = getRegionGlobal(map, entity.x, entity.y);
		entity.region = region;
		addEntityToRegion(region, entity, map);
		return entity;
	},
	removeEntity(entity: ServerEntity, map: ServerMap) {
		let removed = false;

		if (entity.region) {
			removed = removeEntityFromRegion(entity.region, entity, map);
		}

		return removed;
	},
};

export function addSpawnPointIndicators(world: World, map: ServerMap) {
	const addSpawn = ({ x, y, w, h }: Rect) => {
		world.addEntity(entities.spawnPole(x, y), map);

		if (w && h) {
			world.addEntity(entities.spawnPole(x + w, y), map);
			world.addEntity(entities.spawnPole(x, y + h), map);
			world.addEntity(entities.spawnPole(x + w, y + h), map);
		}
	};

	addSpawn(map.spawnArea);

	for (const spawn of Array.from(map.spawns.values())) {
		addSpawn(spawn);
	}
}

export function generateTileIndicesAndColliders(map: ServerMap) {
	for (const region of map.regions) {
		getRegionTiles(region); // initialize encodedTiles

		if (region.tilesDirty) {
			updateTileIndices(region, map);
		}
	}

	for (const region of map.regions) {
		if (region.colliderDirty) {
			generateRegionCollider(region, map);
		}
	}
}

export function removePonies(entities: ServerEntity[]) {
	for (let i = entities.length - 1; i >= 0; i--) {
		if (entities[i].type === PONY_TYPE) {
			entities.splice(i, 1);
		}
	}
}

export interface SignDirection {
	icon: number;
	name: string;
}

export interface SignConfig {
	r?: number;
	w?: (SignDirection | undefined)[];
	e?: (SignDirection | undefined)[];
	n?: (SignDirection | undefined)[];
	s?: (SignDirection | undefined)[];
}

export function createDirectionSign(x: number, y: number, config: SignConfig) {
	const result: ServerEntity[] = [];
	const options: SignEntityOptions = { sign: {} };
	const lines: string[] = [];
	const { w = [], e = [], s = [], n = [] } = config;
	const max = clamp(Math.max(w.length, e.length, s.length, n.length), 3, 5);
	const skip = 5 - max;

	function parse(entries: (SignDirection | undefined)[], arrow: string, plates: CreateEntityMethod[], ox: number) {
		for (let i = 0; i < entries.length; i++) {
			const e = entries[i];

			if (e) {
				lines.push(`${arrow} ${e.name}`);
				const nameplate = plates[i](x + ox / tileWidth, y);
				setEntityName(nameplate, e.name);
				result.push(nameplate);
			}
		}
	}

	if (config.r) {
		options.sign.r = config.r;
	}

	const ups = config.r ? entities.directionSignUpsRight : entities.directionSignUpsLeft;
	const downs = config.r ? entities.directionSignDownsLeft : entities.directionSignDownsRight;

	if (config.n) {
		options.sign.n = config.n.map(x => x ? x.icon : -1);
		parse(config.n, '↑', ups.slice(skip), 0);
	}

	if (config.w) {
		options.sign.w = config.w.map(x => x ? x.icon : -1);
		parse(config.w, '←', entities.directionSignLefts.slice(skip), -10);
	}

	if (config.e) {
		options.sign.e = config.e.map(x => x ? x.icon : -1);
		parse(config.e, '→', entities.directionSignRights.slice(skip), 10);
	}

	if (config.s) {
		options.sign.s = config.s.map(x => x ? x.icon : -1);
		parse(config.s, '↓', downs.slice(skip), 0);
	}

	const text = lines.join('\n');
	const entity = entities.directionSign(x, y, options) as ServerEntity;
	entity.interact = (entity, client) => sayTo(client, entity, text, MessageType.System);
	result.push(entity);
	return result;
}

const patchTypes = [
	entities.cloverPatch3, entities.cloverPatch4, entities.cloverPatch5, entities.cloverPatch6, entities.cloverPatch7
].map(x => x.type);

const eggBasketTypes = entities.eggBaskets.map(b => b.type);

export function pickCandy(client: IClient) {
	let count = 0;
	updateAccountState(client.account, state => state.candies = count = toInt(state.candies) + 1);
	saySystem(client, `${count} 🍬`);

	// announce every 75 candies
	if (count % 75 === 0) {
		sayToOthers(client, `Вы собрали ${count}🍬!`, MessageType.Announcement, undefined, {} as any);
	}
}

export function pickGift(client: IClient) {
	let count = 0;
	updateAccountState(client.account, state => state.gifts = count = toInt(state.gifts) + 1);
	saySystem(client, `${count} 🎁`);

	// announce every 100 gifts
	if (count % 100 === 0) {
		sayToOthers(client, `Вы собрали ${count}🎁!`, MessageType.Announcement, undefined, {} as any);
	}

	holdItem(client.pony, entities.gift2.type);
}

export function pickClover(client: IClient) {
	let count = 0;
	updateAccountState(client.account, state => state.clovers = count = toInt(state.clovers) + 1);
	saySystem(client, `${count} 🍀`);

	// announce every 25 clovers
	if (count % 25 === 0) {
		sayToOthers(client, `Вы собрали ${count}🍀!`, MessageType.Announcement, undefined, {} as any);
	}

	holdItem(client.pony, entities.cloverPick.type);
}

// egg announce
export function pickEgg(client: IClient) {
	let count = 0;
	updateAccountState(client.account, state => state.eggs = count = toInt(state.eggs) + 1);
	saySystem(client, `${count} 🥚`);

	// announce every 50 eggs
	if (count % 50 === 0) {
		sayToOthers(client, `Вы собрали ${count}🥚!`, MessageType.Announcement, undefined, {} as any);
	}

	if (Math.random() < 0.05) {
		const options = client.pony.options as PonyOptions;
		const basketIndex = eggBasketTypes.indexOf(options.hold || 0);

		if (basketIndex >= 0 && basketIndex < (eggBasketTypes.length - 1)) {
			holdItem(client.pony, eggBasketTypes[basketIndex + 1]);
		}
	}
}

const carrotDropTypes = [
	entities.carrot1.type,
	entities.carrot1b.type,
	entities.carrot2.type,
	entities.carrot2b.type,
	entities.carrot3.type,
	entities.carrot4.type,
];

const crystalDropTypes = [
	entities.crystals1.type,
	entities.crystals2.type,
	entities.crystals3.type,
	entities.crystals4.type,
	entities.crystals5.type,
	entities.crystals6.type,
	entities.crystals7.type,
	entities.crystals8.type,
	entities.crystals9.type,
	entities.crystals10.type,
];

function getHoldTypeForEntity(entity: ServerEntity) {
	// Preserve the exact entity type for items like clover-pick-2
	// (previously clover-pick-2 was mapped to clover-pick when picked up,
	//  which caused inventory to store the base type instead of the actual one).
	if (entity.type === entities.cloverPick2.type) {
		return entities.cloverPick2.type;
	}

	if (carrotDropTypes.includes(entity.type)) {
		return entities.carrotHeld.type;
	}

	if (crystalDropTypes.includes(entity.type)) {
		return entities.crystalHeld.type;
	}

	return entity.type;
}

export function pickEntity(client: IClient, entity: ServerEntity) {
	const options = entity.options as any;
	const hold = (options && options.dropHoldType) || getHoldTypeForEntity(entity);
	holdItem(client.pony, hold);
}

export function checkLantern(client: IClient) {
	const options = client.pony.options as PonyOptions;
	const canPick = options.hold === entities.jackoLanternOn.type || options.hold === entities.jackoLanternOff.type;

	if (!canPick) {
		saySystem(client, 'Get a lantern to collect candies');
	}

	return canPick;
}

export function checkBasket(client: IClient) {
	const options = client.pony.options as PonyOptions;
	const canPick = includes(eggBasketTypes, options.hold);

	if (!canPick) {
		saySystem(client, 'Get a basket to collect eggs');
	}

	return canPick;
}

export function checkNotCollecting(client: IClient) {
	const options = client.pony.options as PonyOptions;
	const canPick = includes(eggBasketTypes, options.hold) ||
		options.hold === entities.jackoLanternOn.type ||
		options.hold === entities.jackoLanternOff.type;
	return !canPick;
}

export function positionClover(map: ServerMap) {
	const patch = sample(findEntities(map, e => includes(patchTypes, e.type)));

	if (patch && patch.bounds) {
		const bounds = patch.bounds;
		const position = {
			x: patch.x + bounds.x / tileWidth + random(0, bounds.w / tileWidth, true),
			y: patch.y + bounds.y / tileHeight + random(0, bounds.h / tileHeight, true),
		};
		return position;
	} else {
		return randomPosition(map);
	}
}

export function createBunny(waypoints: Point[]) {
	const { x, y } = waypoints[0];
	const entity = entities.bunny(x, y) as ServerEntity;
	const bunnySpeed = 2;

	let waypoint = 0;
	let sleepUntil = 0;

	entity.serverUpdate = (_delta, now) => {
		if (sleepUntil > now)
			return;

		const { x, y } = waypoints[waypoint];
		const reachedX = Math.abs(entity.x - x) < 0.2;
		const reachedY = Math.abs(entity.y - y) < 0.2;

		if (reachedX && reachedY) {
			const rand = Math.random();
			updateEntityVelocity(entity, 0, 0, now);

			if (rand < 0.1) {
				setEntityAnimation(entity, BunnyAnimation.Clean);
				sleepUntil = now + 2;
			} else if (rand < 0.2) {
				setEntityAnimation(entity, BunnyAnimation.Look);
				sleepUntil = now + 2;
			} else if (rand < 0.3) {
				setEntityAnimation(entity, BunnyAnimation.Blink);
				sleepUntil = now + 2;
			} else if (rand < 0.6) {
				setEntityAnimation(entity, BunnyAnimation.Sit);
				sleepUntil = now + 2;
			} else {
				waypoint = (waypoint + 1) % waypoints.length;
				setEntityAnimation(entity, BunnyAnimation.Sit);
				sleepUntil = now + random(0.2, 2, true);
			}
		} else {
			const vx = reachedX ? 0 : (x < entity.x ? -bunnySpeed : bunnySpeed);
			const vy = reachedY ? 0 : (y < entity.y ? -bunnySpeed : bunnySpeed);

			if (entity.vx !== vx || entity.vy !== vy) {
				updateEntityVelocity(entity, vx, vy, now);

				let dir: boolean | undefined;
				if (vx === 0) {
					dir = undefined;
				} else {
					dir = vx > 0;
				}

				setEntityAnimation(entity, BunnyAnimation.Walk, dir);
			}
		}
	};

	if (DEVELOPMENT && false) {
		return [entity, ...waypoints.map(({ x, y }) => entities.routePole(x, y))];
	} else {
		return [entity];
	}
}

export function createFollowerBunny(targetEntity: ServerEntity, offsetX: number = 0, offsetY: number = 0, mode: 'circle' | 'stay' | 'free' = 'circle', radius: number = 1.0, shape: 'none' | 'circle' | 'triangle' | 'square' | 'diamond' | 'heart' = 'none', initialPhase: number = 0, forceStartMoving: boolean = false, map?: ServerMap) {
	const entity = entities.bunny(targetEntity.x + offsetX, targetEntity.y + offsetY) as ServerEntity;
	const baseBunnySpeed = 6;
	const bunnySpeed = baseBunnySpeed + random(-2, 2, true); // Варьировать скорость для реализма
	let sleepUntil = 0;
	let angle = initialPhase; // Начальная фаза для асинхронного движения
	const angularSpeed = Math.min(1.2, radius * 0.5); // Ограничение скорости кружения, чтобы не было слишком быстро при маленьком радиусе
	let currentOffsetX = offsetX;
	let currentOffsetY = offsetY;

	// Для отслеживания движения игрока и задержек
	let lastPlayerX = targetEntity.x;
	let lastPlayerY = targetEntity.y;
	let playerStartedMoving = forceStartMoving; // Для перенесённых кроликов сразу начать движение
	let moveDelay = random(0, 0.5, true); // Задержка перед началом движения

	// Для случайных анимаций в режиме stay
	let nextRandomAnimation = 0; // Будет инициализировано в первом serverUpdate
	let currentRandomAnimation: BunnyAnimation | null = null;
	let randomAnimationUntil = 0;

	// Для свободного режима
	let freeTargetX = entity.x;
	let freeTargetY = entity.y;
	let nextDirectionChange = 0;
	let currentFreeAction: 'walk' | 'idle' | 'explore' = 'idle';

	entity.bunnyMode = mode;

	entity.serverUpdate = (_delta, now) => {
		if (sleepUntil > now) {
			return;
		}

		// Инициализируем время первой случайной анимации
		if (nextRandomAnimation === 0) {
			nextRandomAnimation = now + random(15, 45, true);
		}

		// Логика для свободного режима
		if (entity.bunnyMode === 'free') {
			return updateFreeBunny(entity, now, map, currentFreeAction, nextDirectionChange, freeTargetX, freeTargetY,
				(action) => currentFreeAction = action,
				(time) => nextDirectionChange = time,
				(x, y) => { freeTargetX = x; freeTargetY = y; });
		}

		// Отслеживание движения игрока
		const playerMoved = Math.abs(targetEntity.x - lastPlayerX) > 0.1 || Math.abs(targetEntity.y - lastPlayerY) > 0.1;
		lastPlayerX = targetEntity.x;
		lastPlayerY = targetEntity.y;

		if (playerMoved && !playerStartedMoving) {
			playerStartedMoving = true;
			if ((shape === 'none' && entity.bunnyMode === 'stay') || (entity.bunnyMode === 'circle')) {
				// Рандомизировать позицию только при начале движения игрока
				const randomAngle = Math.random() * Math.PI * 2;
				const randomDist = Math.random() * radius;
				currentOffsetX = Math.cos(randomAngle) * randomDist;
				currentOffsetY = Math.sin(randomAngle) * randomDist;
			}
			moveDelay = random(0, 0.5, true); // Сбросить задержку с новой рандомной
		} else if (!playerMoved) {
			playerStartedMoving = false;
			if (entity.bunnyMode === 'circle') {
				// Когда игрок стоит, кролики в circle режиме стоят хаотично
				const randomAngle = Math.random() * Math.PI * 2;
				const randomDist = Math.random() * radius;
				currentOffsetX = Math.cos(randomAngle) * randomDist;
				currentOffsetY = Math.sin(randomAngle) * randomDist;
			}
		}

		// Задержка перед движением
		if (playerStartedMoving) {
			moveDelay -= _delta;
			if (moveDelay > 0) {
				// Ещё не время двигаться
				updateEntityVelocity(entity, 0, 0, now);
				setEntityAnimation(entity, BunnyAnimation.Sit);
				return;
			}
		}

		let targetX: number;
		let targetY: number;

		const actionUntil = (entity as any).bunnyActionUntil as number | undefined;
		const actionAnimation = (entity as any).bunnyActionAnimation as BunnyAnimation | undefined;
		if (actionUntil && actionAnimation && now < actionUntil) {
			updateEntityVelocity(entity, 0, 0, now);
			setEntityAnimation(entity, actionAnimation);
			return;
		}

		if (entity.bunnyMode === 'circle') {
			angle += angularSpeed * _delta;
			const t = (angle / (Math.PI * 2)) % 1;
			const position = getPositionOnShapePerimeter(shape, radius, t);
			targetX = targetEntity.x + position.x;
			targetY = targetEntity.y + position.y;
		} else {
			targetX = targetEntity.x + currentOffsetX;
			targetY = targetEntity.y + currentOffsetY;
		}

		const dx = targetX - entity.x;
		const dy = targetY - entity.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist < 0.3) {
			updateEntityVelocity(entity, 0, 0, now);

			if (entity.bunnyMode === 'stay') {
				// Проверяем, не активна ли случайная анимация
				if (currentRandomAnimation && now < randomAnimationUntil) {
					setEntityAnimation(entity, currentRandomAnimation);
				} else if (now >= nextRandomAnimation) {
					// Время для новой случайной анимации
					const rand = Math.random();
					let animation: BunnyAnimation;
					let duration: number;

					if (rand < 0.6) {
						// Часто моргаем (60% вероятность)
						animation = BunnyAnimation.Blink;
						duration = random(0.1, 0.3, true);
					} else if (rand < 0.85) {
						// Иногда смотрим (25% вероятность)
						animation = BunnyAnimation.Look;
						duration = random(1.0, 3.0, true);
					} else {
						// Редко чистимся (15% вероятность)
						animation = BunnyAnimation.Clean;
						duration = random(2.0, 4.0, true);
					}

					currentRandomAnimation = animation;
					randomAnimationUntil = now + duration;
					nextRandomAnimation = now + random(20, 60, true); // Следующая через 20-60 сек
					setEntityAnimation(entity, animation);
				} else {
					// Просто сидим
					setEntityAnimation(entity, BunnyAnimation.Sit);
				}
				// Для 'none' рандомизация уже произошла при начале движения игрока
			} else {
				const rand = Math.random();
				if (rand < 0.3) {
					setEntityAnimation(entity, BunnyAnimation.Sit);
					sleepUntil = now + random(0.3, 1.0, true);
				} else {
					setEntityAnimation(entity, BunnyAnimation.Look);
					sleepUntil = now + random(0.2, 0.5, true);
				}
			}

			return;
		}

		// Двигаться к цели
		const speed = Math.min(bunnySpeed, dist * 2);
		let vx = dx / dist * speed;
		let vy = dy / dist * speed;

		// Проверяем коллизию в направлении движения
		const testEntity = { ...entity, x: entity.x + vx * 0.1, y: entity.y + vy * 0.1 };
		if (map && isStaticCollision(testEntity, map, true)) {
			// Есть препятствие, пытаемся обойти
			const avoidAngle = Math.PI / 6; // 30 градусов
			const leftVx = vx * Math.cos(avoidAngle) - vy * Math.sin(avoidAngle);
			const leftVy = vx * Math.sin(avoidAngle) + vy * Math.cos(avoidAngle);
			const rightVx = vx * Math.cos(-avoidAngle) - vy * Math.sin(-avoidAngle);
			const rightVy = vx * Math.sin(-avoidAngle) + vy * Math.cos(-avoidAngle);

			const leftTest = { ...entity, x: entity.x + leftVx * 0.1, y: entity.y + leftVy * 0.1 };
			const rightTest = { ...entity, x: entity.x + rightVx * 0.1, y: entity.y + rightVy * 0.1 };

			if (!isStaticCollision(leftTest, map, true)) {
				vx = leftVx;
				vy = leftVy;
			} else if (!isStaticCollision(rightTest, map, true)) {
				vx = rightVx;
				vy = rightVy;
			} else {
				// Оба направления заблокированы, останавливаемся
				updateEntityVelocity(entity, 0, 0, now);
				setEntityAnimation(entity, BunnyAnimation.Sit);
				return;
			}
		}

		updateEntityVelocity(entity, vx, vy, now);
		setEntityAnimation(entity, BunnyAnimation.Walk, vx > 0);
	};

	return [entity];
}
