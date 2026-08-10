import { sample } from 'lodash';
import { ServerEntity, IClient, ServerMap, Interact } from './serverInterfaces';
import { sayTo } from './chat';
import { MessageType, CreateEntityMethod, EntityFlags, EntityState, setAnimationToEntityState, defaultWorldState } from '../common/interfaces';
import { World } from './world';
import * as entities from '../common/entities';
import { setEntityName, updateEntityState, updateEntityOptions, pushRemoveEntityToClient } from './entityUtils';
import { holdItem } from './playerUtils';
import { hasFlag, repeat, containsPoint } from '../common/utils';
import { pickEntity } from './mapUtils';
import { mockPaletteManager } from '../common/ponyInfo';
import { rect } from '../common/rect';
import { findEntities } from './serverMap';

const tableTypes = new Set([entities.table1.type, entities.table2.type, entities.table3.type]);
const couchTypes = new Set([
	entities.couch.type, entities.couchBlue.type, entities.couchGray.type, entities.couchGreen.type,
	entities.couchOrange.type, entities.couchPink.type, entities.couchPurple.type,
	entities.couchTurquoise.type, entities.couchWhite.type, entities.couchYellow.type,
]);
const benchTypes = new Set([
	entities.bench1.type, entities.benchSeat.type, entities.benchSeatH.type,
]);
const surfaceTypes = new Set([...tableTypes, ...couchTypes, ...benchTypes]);
const fruitTypes = new Set(entities.fruits.map(f => f.type));

function isSurface(entity: ServerEntity): boolean {
	return surfaceTypes.has(entity.type);
}

function isFruitType(type: number): boolean {
	return fruitTypes.has(type);
}

function getDropTypeForHeldType(holdType: number) {
	if (holdType === entities.cloverPick.type) {
		return entities.cloverPick2.type;
	}

	if (holdType === entities.carrotHeld.type) {
		return entities.carrot1.type;
	}

	if (holdType === entities.crystalHeld.type) {
		return entities.crystals1.type;
	}

	if (holdType === entities.scrapHeld.type) {
		return entities.scrap.type;
	}

	return holdType;
}

function unholdItem(entity: ServerEntity) {
	if (entity.options && entity.options.hold) {
		updateEntityOptions(entity, { hold: 0 });
		delete entity.options.hold;
	}
}

function getTriggerPickBounds(entity: ServerEntity) {
	return entity.itemTriggerBounds || entity.interactBounds || entity.bounds || rect(-8, -8, 16, 16);
}

function isCollectableEntity(entity: ServerEntity, trigger: ServerEntity) {
	if (entity === trigger) {
		return false;
	}

	if (entity.type === entities.pony.type) {
		return false;
	}

	return true;
}

function getEntityPickBounds(entity: ServerEntity) {
	return entity.bounds || entity.interactBounds || rect(-8, -8, 16, 16);
}

function findItemOnTrigger(map: ServerMap, trigger: ServerEntity, x?: number, y?: number) {
	// Require explicit cursor coordinates for picking items from a trigger.
	// This prevents accidental pickup when the interact was invoked without a real click.
	if (x === undefined || y === undefined) {
		return undefined;
	}

	const triggerBounds = getTriggerPickBounds(trigger);
	const clickInsideTrigger = containsPoint(trigger.x, trigger.y, triggerBounds, x, y);

	if (!clickInsideTrigger) {
		return undefined;
	}

	// Absolute rectangle for trigger
	const tLeft = trigger.x + triggerBounds.x;
	const tTop = trigger.y + triggerBounds.y;
	const tRight = tLeft + triggerBounds.w;
	const tBottom = tTop + triggerBounds.h;

	// prefer closest by click / trigger center when multiple collectables overlap
	let closest: ServerEntity | undefined;
	let closestDist = Number.MAX_VALUE;

	for (const entity of findEntities(map, e => isCollectableEntity(e, trigger))) {
		const eb = getEntityPickBounds(entity);
		const eLeft = entity.x + eb.x;
		const eTop = entity.y + eb.y;
		const eRight = eLeft + eb.w;
		const eBottom = eTop + eb.h;

		// rectangles intersect?
		if (!(tLeft >= eRight || tRight <= eLeft || tTop >= eBottom || tBottom <= eTop)) {
			let dist = Number.MAX_VALUE;

			if (x !== undefined && y !== undefined) {
				// Require exact click on entity's interactive bounds when cursor coords are provided.
				if (!containsPoint(entity.x, entity.y, eb, x, y)) {
					continue;
				}
				dist = 0;
			} else {
				const dx = trigger.x - entity.x;
				const dy = trigger.y - entity.y;
				dist = Math.sqrt(dx * dx + dy * dy);
			}

			if (dist < closestDist) {
				closest = entity;
				closestDist = dist;
			}
		}
	}

	return closest;
}

function ensurePickableEntity(entity: ServerEntity) {
	if (!entity.interactBounds) {
		entity.interactBounds = entity.bounds || rect(-8, -8, 16, 16);
	}

	if (!entity.interactRange) {
		entity.interactRange = 1.5;
	}
}

function getItemTriggerSpawnPosition(trigger: ServerEntity, x?: number, y?: number) {
	const bounds = trigger.itemTriggerBounds || trigger.interactBounds || trigger.bounds;

	if ((trigger.itemTriggerType === entities.itemTriggerArea.type || trigger.type === entities.itemTriggerArea.type) && bounds && bounds.w > 0 && bounds.h > 0) {
		const minX = trigger.x + bounds.x;
		const minY = trigger.y + bounds.y;
		const maxX = minX + bounds.w;
		const maxY = minY + bounds.h;

		if (x !== undefined && y !== undefined && x >= minX && x <= maxX && y >= minY && y <= maxY) {
			return {
				x,
				y,
			};
		}

		return {
			x: minX + Math.random() * bounds.w,
			y: minY + Math.random() * bounds.h,
		};
	}

	return {
		x: trigger.x,
		y: trigger.y,
	};
}

export function handleItemTriggerInteract(world: World, map: ServerMap, entity: ServerEntity, client: IClient, x?: number, y?: number, onEmpty?: Interact) {
	if (x === undefined || y === undefined) {
		return false;
	}

	const pony = client.pony;

	if ((client as any)._itemTriggerLock) {
		return true;
	}

	(client as any)._itemTriggerLock = true;

	try {
		const held = pony.options && pony.options.hold;

		if (!held) {
			const picked = findItemOnTrigger(map, entity, x, y);

			if (picked) {
				if (isSurface(entity) && !isFruitType(picked.type)) {
					return false;
				}

				if (client.shadowed) {
					pushRemoveEntityToClient(client, picked);
				} else {
					world.removeEntity(picked, map);
					pickEntity(client, picked);
				}

				return true;
			}

			if (onEmpty) {
				onEmpty(entity, client);
				return true;
			}

			return false;
		}

		if (isSurface(entity) && !isFruitType(held)) {
			return false;
		}

		let created: ServerEntity | ServerEntity[];
		const spawnType = getDropTypeForHeldType(held);
		const spawn = getItemTriggerSpawnPosition(entity, x, y);

		try {
			created = entities.createAnEntity(spawnType, 0, spawn.x, spawn.y, {}, mockPaletteManager, defaultWorldState) as ServerEntity;
		} catch (error) {
			DEVELOPMENT && console.error('ItemTrigger spawn failed for type', held, error);
			return true;
		}

		if (!created) {
			return true;
		}

		const toAdd = Array.isArray(created) ? created : [created];

		for (const e of toAdd) {
			e.x = spawn.x;
			e.y = spawn.y;
			if (surfaceTypes.has(entity.type)) {
				e.options = Object.assign({}, e.options as any, { sortY: entity.y });
			}
			ensurePickableEntity(e);
			e.flags |= EntityFlags.Interactive;
			e.options = Object.assign({}, e.options as any, { dropHoldType: held });

			e.interact = (spawned: ServerEntity, cl: IClient) => {
				if (cl.shadowed) {
					pushRemoveEntityToClient(cl, spawned);
				} else {
					world.removeEntity(spawned, map);
					pickEntity(cl, spawned);
				}
			};

			world.addEntity(e, map);
		}

		unholdItem(pony);

		return true;
	} finally {
		setTimeout(() => { (client as any)._itemTriggerLock = false; }, 0);
	}
}

// create an item trigger which transfers player's held item into the world via collectable-like pipeline
export function createItemTrigger(world: World, map: ServerMap, x: number, y: number, name?: string, onEmpty?: Interact, createEntity: CreateEntityMethod = entities.itemTriggerPoint) {
	const ent = createEntity(x, y) as ServerEntity;

	if (name) {
		setEntityName(ent, name);
	}

	ent.state |= EntityState.Editable;
ent.interact = (entity: ServerEntity, client: IClient, x?: number, y?: number) =>
	handleItemTriggerInteract(world, map, entity, client, x, y, onEmpty);
	return ent;
}

export function give(type: number, message?: string) {
	return (e: ServerEntity, client: IClient) => {
		if (client.pony.options && client.pony.options.hold === type) {
			unholdItem(client.pony);
		} else {
			if (message) {
				sayTo(client, e, message, MessageType.Announcement);
			}

			holdItem(client.pony, type);
		}
	};
}

export function createBoxOfLanterns(x: number, y: number) {
	const boxOfLanterns = entities.boxLanterns(x, y) as ServerEntity;
	boxOfLanterns.interact = give(entities.lanternOn.type);
	setEntityName(boxOfLanterns, 'Box of lanterns');
	return boxOfLanterns;
}

export function createSign(x: number, y: number, name: string, interact: Interact, create = entities.sign) {
	const entity = create(x, y) as ServerEntity;
	setEntityName(entity, name);
	entity.interact = interact;
	return entity;
}

export function createSignWithText(x: number, y: number, name: string, text: string, create = entities.sign) {
	return createSign(x, y, name, (entity, client) => sayTo(client, entity, text, MessageType.System), create);
}

export function boopLight(this: ServerEntity) {
	setTimeout(() => {
		if (hasFlag(this.state, EntityState.On)) {
			turnOff(this);
			this.lightDelay = Date.now() + 3000;
		}
	}, 300);
}

export function createAddLight(world: World, map: ServerMap, createEntity: CreateEntityMethod) {
	return (x: number, y: number) => {
		const entity = world.addEntity(createEntity(x, y), map);
		entity.boop = boopLight;
		return entity;
	};
}

export function turnOff(entity: ServerEntity) {
	updateEntityState(entity, EntityState.None);
}

export function turnOn(entity: ServerEntity) {
	updateEntityState(entity, setAnimationToEntityState(EntityState.On, 1));
}

export function updateLights(entities: ServerEntity[], on: boolean) {
	for (const entity of entities) {
		if (hasFlag(entity.state, EntityState.On) !== on && Math.random() < 0.2) {
			if (entity.lightDelay === undefined || entity.lightDelay < Date.now()) {
				if (on) {
					turnOn(entity);
				} else {
					turnOff(entity);
				}
			}
		}
	}
}

export function createFenceMaker(
	world: World, map: ServerMap,
	size: number, poles: CreateEntityMethod[], beamsH: CreateEntityMethod[], beamsV: CreateEntityMethod[]
) {
	const add = (entity: ServerEntity) => world.addEntity(entity, map);

	return (x: number, y: number, length: number, horizontal = true, skipStart = false, skipEnd = false) => {
		const dx = horizontal ? size : 0;
		const dy = horizontal ? 0 : size;

		for (let i = 0; i < length; i++) {
			if (i || !skipStart) {
				add(sample(poles)!(x + dx * i, y + dy * i));
			}

			if (horizontal) {
				add(sample(beamsH)!(x + dx * i + (size / 2), y));
			} else {
				add(sample(beamsV)!(x, y + dy * i));
			}
		}

		if (!skipEnd) {
			add(sample(poles)!(x + dx * length, y + dy * length));
		}
	};
}

export function createWoodenFenceMaker(world: World, map: ServerMap) {
	return createFenceMaker(world, map, 1, [
		...repeat(2, entities.woodenFencePole1),
		...repeat(2, entities.woodenFencePole2),
		...repeat(2, entities.woodenFencePole3),
		...repeat(2, entities.woodenFencePole4),
		entities.woodenFencePole5,
	], [
			...repeat(5, entities.woodenFenceBeamH1),
			...repeat(5, entities.woodenFenceBeamH2),
			...repeat(5, entities.woodenFenceBeamH3),
			entities.woodenFenceBeamH4,
			entities.woodenFenceBeamH5,
			entities.woodenFenceBeamH6,
		], [
			entities.woodenFenceBeamV1,
			entities.woodenFenceBeamV2,
			entities.woodenFenceBeamV3,
		]);
}

export function createStoneWallFenceMaker(world: World, map: ServerMap) {
	return createFenceMaker(world, map, 2, [
		entities.stoneWallPole1,
	], [
			entities.stoneWallBeamH1,
		], [
			entities.stoneWallBeamV1,
		]);
}
