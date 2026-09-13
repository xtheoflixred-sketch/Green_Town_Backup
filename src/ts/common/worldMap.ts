import {
	Entity, Point, TileType, Rect, MapInfo, Camera, Region, IMap, MapState, defaultMapState, Pony,
	MapType, EntityFlags, WorldMap, Weather, EntityState, canWalk, MapFlags, Says,
} from './interfaces';
import { contains, removeItem, boundsIntersect, array, pushUniq, containsPoint, removeItemFast } from './utils';
import { isBoundsVisible, } from './camera';
import {
	getRegionTile, setRegionTile, setRegionTileDirty, getRegionElevation, setRegionElevation,
	getRegionTileIndex, worldToRegionX, worldToRegionY, generateRegionCollider, invalidateRegionsCollider
} from './region';
import { cloud, rain, raindrop, splash, stormLight } from './entities';
import { releaseEntity, isMoving, isHidden, isDrawable, isPonyFlying, getChatBubbles } from './entityUtils';
import { updatePonyEntity, invalidatePalettesForPony, ensurePonyInfoDecoded, isPony, isPonyOnTheGround } from './pony';
import { getTileHeight, updateTileIndices, isInWater } from '../client/tileUtils';
import { toScreenX, toScreenY, toScreenYWithZ, rectToScreen, toWorldX, toWorldY, toWorldZ } from './positionUtils';
import { hasDrawLight, hasLightSprite } from '../client/draw';
import { PonyTownGame } from '../client/game';
import { WATER_FPS, PONY_TYPE, REGION_SIZE, tileElevation } from './constants';
import { updatePosition, canCollideWith } from './collision';
import { PaletteManager } from '../graphics/paletteManager';
import { timeEnd, timeStart } from '../client/timing';
import { playEffect } from '../client/handlers';
import { isFlyingDown } from '../client/ponyStates';

const CHAT_BUBBLE_HOVER_EXTRA_TIME = 5;

const defaultMapInfo: MapInfo = {
	type: MapType.None,
	flags: MapFlags.None,
	regionsX: 0,
	regionsY: 0,
	defaultTile: TileType.None,
};

export function createWorldMap(info = defaultMapInfo, state: MapState = { ...defaultMapState }): WorldMap {
	const { id, type, flags, regionsX, regionsY, defaultTile, editableArea } = info;
	const map: WorldMap = {
		id,
		type,
		flags,
		tileTime: 0,
		entities: [],
		entitiesDrawable: [],
		entitiesWithNames: [],
		entitiesWithChat: [],
		entitiesMoving: [],
		entitiesTriggers: [],
		entitiesLight: [],
		entitiesLightSprite: [],
		weatherClouds: [],
		entitiesById: new Map<number, Entity>(),
		poniesToDecode: [],
		regionsX,
		regionsY,
		regions: array(regionsX * regionsY, undefined),
		defaultTile,
		width: regionsX * REGION_SIZE,
		height: regionsY * REGION_SIZE,
		minRegionX: 0,
		minRegionY: 0,
		maxRegionX: 0,
		maxRegionY: 0,
		state,
		editableArea,
	};

	updateMinMaxRegion(map);

	return map;
}

function pickAny(entity: Entity, point: Point): boolean {
	const bounds = getAnyBounds(entity) || entity.interactBounds || entity.bounds;
	return !!bounds && (contains(entity.x, entity.y, bounds, point) ||
		contains(entity.x, entity.y + ((entity as any).offsetY || 0), bounds, point));
}

export function getAnyBounds(entity: Entity) {
	return [
		(entity as any).spriteBounds,
		entity.interactBounds,
		entity.bounds,
		entity.lightBounds,
		entity.lightSpriteBounds,
		entity.collidersBounds,
		entity.triggerBounds && rectToScreen(entity.triggerBounds),
	].filter(x => x && x.w > 0 && x.h > 0)[0];
}

function pickAnyEvenLights(entity: Entity, point: Point): boolean {
	const bounds = getAnyBounds(entity);
	return !!bounds && (contains(entity.x, entity.y, bounds, point) ||
		contains(entity.x, entity.y + ((entity as any).offsetY || 0), bounds, point));
}

function pickSprite(entity: Entity, point: Point): boolean {
	const bounds = (entity as any).spriteBounds || entity.bounds || entity.interactBounds;
	return !!bounds && (contains(entity.x, entity.y, bounds, point) ||
		contains(entity.x, entity.y + ((entity as any).offsetY || 0), bounds, point));
}

function pick(entity: Entity, point: Point, pickHidden: boolean, pickEditable: boolean): boolean {
	const editableOrInteractive = pickEditable ?
		(entity.type !== PONY_TYPE && ((entity.state & EntityState.Editable) !== 0)) :
		((entity.flags & EntityFlags.Interactive) !== 0);

	return editableOrInteractive && (!isHidden(entity) || pickHidden) && pickAny(entity, point);
}

function pickEntity(
	entity: Entity, point: Point, ignorePonies: boolean, pickHidden: boolean, pickEditable: boolean
): boolean {
	return (!ignorePonies || entity.type !== PONY_TYPE) && pick(entity, point, pickHidden, pickEditable);
}

function pickByBounds(entity: Entity, rect: Rect, pickHidden: boolean): boolean {
	if ((entity.flags & EntityFlags.Interactive) === 0 || (isHidden(entity) && !pickHidden)) {
		return false;
	} else {
		const bounds = (entity as any).spriteBounds || entity.interactBounds || entity.bounds;
		return !!bounds && boundsIntersect(entity.x, entity.y, bounds, 0, 0, rect);
	}
}

function pickEntityByBounds(entity: Entity, rect: Rect, ignorePonies: boolean, pickHidden: boolean): boolean {
	return (!ignorePonies || entity.type !== PONY_TYPE) && pickByBounds(entity, rect, pickHidden);
}

export function pickAnyEntities(map: WorldMap, point: Point) {
	return map.entities.filter(e => pickAnyEvenLights(e, point)).reverse();
}

export function pickSpriteEntities(map: WorldMap, point: Point) {
	return map.entities.filter(e => pickSprite(e, point)).reverse();
}

export function pickEntities(map: WorldMap, point: Point, ignorePonies: boolean, pickHidden: boolean, pickEditable = false) {
	return map.entities.filter(e => pickEntity(e, point, ignorePonies, pickHidden, pickEditable)).reverse();
}

export function pickEntitiesByRect(map: WorldMap, rect: Rect, ignorePonies: boolean, pickHidden: boolean) {
	return map.entities.filter(e => pickEntityByBounds(e, rect, ignorePonies, pickHidden)).reverse();
}

export function removeRegions(map: WorldMap, coords: number[]) {
	if (coords.length === 0)
		return;

	const entitiesToRemove = new Set<Entity>();

	for (let i = 0; i < coords.length; i += 2) {
		const x = coords[i];
		const y = coords[i + 1];
		const index = x + y * map.regionsX;
		const region = map.regions[index];

		if (region) {
			for (const entity of region.entities) {
				entitiesToRemove.add(entity);
				releaseEntity(entity);
				map.entitiesById.delete(entity.id);
			}
		}

		map.regions[index] = undefined;
		setTilesDirty(map, x * REGION_SIZE - 1, y * REGION_SIZE - 1, REGION_SIZE + 2, REGION_SIZE + 2);
	}

	removeEntitiesFromEntities(map, entitiesToRemove);
	updateMinMaxRegion(map);
}

export function setRegion(map: WorldMap, x: number, y: number, region: Region) {
	if (x >= 0 && y >= 0 && x < map.regionsX && y < map.regionsY) {
		const index = x + y * map.regionsX;
		const oldRegion = map.regions[index];

		if (oldRegion) {
			DEVELOPMENT && !TESTS && console.error(`Region already set (${x}, ${y})`);

			for (const e of oldRegion.entities.slice()) {
				releaseAndRemoveEntityFromMap(map, e);
			}
		}

		map.regions[index] = undefined;
		setTilesDirty(map, x * REGION_SIZE - 1, y * REGION_SIZE - 1, REGION_SIZE + 2, REGION_SIZE + 2);
		map.regions[index] = region;
		updateMinMaxRegion(map);
	} else {
		DEVELOPMENT && !TESTS && console.error(`Invalid region coords (${x}, ${y})`);
	}
}

export function findEntityById(map: WorldMap, id: number) {
	return map.entitiesById.get(id);
}

export function addEntity(map: WorldMap, entity: Entity) {
	const region = getRegionGlobal(map, entity.x, entity.y);

	if (!region) {
		throw new Error(`Missing region at ${entity.x} ${entity.y}`);
	} else {
		addEntityToMapRegion(map, region, entity);
	}
}

export function removeEntity(map: WorldMap, entity: Entity) {
	removeEntityFromMapRegion(map, entity);
	releaseAndRemoveEntityFromMap(map, entity);
}

function releaseAndRemoveEntityFromMap(map: WorldMap, entity: Entity) {
	releaseEntity(entity);
	removeEntityFromEntities(map, entity);
}

export function removeEntityDirectly(map: WorldMap, entity: Entity) {
	forEachRegion(map, region => {
		const removed = removeEntityFromRegion(region, entity, map);

		if (removed) {
			releaseEntity(entity);
			removeEntityFromEntities(map, entity);
			return false;
		} else {
			return true;
		}
	});
}

export function setTile(map: WorldMap, worldX: number, worldY: number, type: TileType) {
	const region = getRegionGlobal(map, worldX, worldY);

	if (!region)
		return;

	const x = Math.floor(worldX - region.x * REGION_SIZE);
	const y = Math.floor(worldY - region.y * REGION_SIZE);

	const old = getRegionTile(region, x, y);
	setRegionTile(region, x, y, type);

	setTilesDirty(map, worldX - 1, worldY - 1, 3, 3);

	if (canWalk(old) !== canWalk(type)) {
		setColliderDirty(map, region, x, y);
	}
}

export function setColliderDirty(map: IMap<Region | undefined>, region: Region, x: number, y: number) {
	region.colliderDirty = true;

	if (x === 0) {
		const r = getRegionUnsafe(map, region.x - 1, region.y);
		r && (r.colliderDirty = true);
	} else if (x === (REGION_SIZE - 1)) {
		const r = getRegionUnsafe(map, region.x + 1, region.y);
		r && (r.colliderDirty = true);
	}

	if (y === 0) {
		const r = getRegionUnsafe(map, region.x, region.y - 1);
		r && (r.colliderDirty = true);
	} else if (y === (REGION_SIZE - 1)) {
		const r = getRegionUnsafe(map, region.x, region.y + 1);
		r && (r.colliderDirty = true);
	}
}

export function setTileAtRegion(map: WorldMap, regionX: number, regionY: number, x: number, y: number, type: TileType) {
	setTile(map, regionX * REGION_SIZE + x, regionY * REGION_SIZE + y, type);
}

export function setTilesDirty(map: IMap<Region | undefined>, ox: number, oy: number, w: number, h: number) {
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			doRelativeToRegion(map, x + ox, y + oy, (region, x, y) => setRegionTileDirty(region, x, y));
		}
	}
}

function getTileIndex(map: IMap<Region | undefined>, x: number, y: number) {
	const region = getRegionGlobal(map, x, y);
	return region ? getRegionTileIndex(region, x - region.x * REGION_SIZE, y - region.y * REGION_SIZE) : 0;
}

export function getElevation(map: WorldMap, x: number, y: number) {
	const region = getRegionGlobal(map, x, y);
	return region ? getRegionElevation(region, x - region.x * REGION_SIZE, y - region.y * REGION_SIZE) : 0;
}

export function setElevation(map: WorldMap, x: number, y: number, value: number) {
	doRelativeToRegion(map, x, y, (region, x, y) => setRegionElevation(region, x, y, value));
}

export function forEachRegion(map: WorldMap, callback: (region: Region) => boolean | void) {
	for (let y = map.minRegionY; y <= map.maxRegionY; y++) {
		for (let x = map.minRegionX; x <= map.maxRegionX; x++) {
			const region = getRegion(map, x, y);

			if (region && callback(region) === false) {
				return;
			}
		}
	}
}

function updateMinMaxRegion(map: WorldMap) {
	map.minRegionX = map.regionsX;
	map.minRegionY = map.regionsY;
	map.maxRegionX = 0;
	map.maxRegionY = 0;

	for (let y = 0; y < map.regionsY; y++) {
		for (let x = 0; x < map.regionsX; x++) {
			if (getRegion(map, x, y)) {
				map.minRegionX = Math.min(x, map.minRegionX);
				map.minRegionY = Math.min(y, map.minRegionY);
				map.maxRegionX = Math.max(x, map.maxRegionX);
				map.maxRegionY = Math.max(y, map.maxRegionY);
			}
		}
	}

	map.maxRegionX = Math.min(map.maxRegionX, map.regionsX - 1);
	map.maxRegionY = Math.min(map.maxRegionY, map.regionsY - 1);
}

function doRelativeToRegion(
	map: IMap<Region | undefined>, x: number, y: number, action: (region: Region, x: number, y: number) => void
) {
	const region = getRegionGlobal(map, x, y);

	if (region) {
		const regionX = Math.floor(x - region.x * REGION_SIZE);
		const regionY = Math.floor(y - region.y * REGION_SIZE);
		action(region, regionX, regionY);
	}
}

function addEntityToRegion(region: Region, entity: Entity, map: WorldMap) {
	region.entities.push(entity);

	if (canCollideWith(entity)) {
		region.colliders.push(entity);
		invalidateRegionsCollider(region, map);
	}
}

function removeEntityFromRegion(region: Region, entity: Entity, map: WorldMap) {
	const removed = removeItemFast(region.entities, entity);

	if (removed && canCollideWith(entity)) {
		removeItemFast(region.colliders, entity);
		invalidateRegionsCollider(region, map);
	}

	return removed;
}

export function addEntityToMapRegion(map: WorldMap, region: Region, entity: Entity) {
	if (entity.id !== 0) {
		const existing = map.entitiesById.get(entity.id);

		if (existing) {
			DEVELOPMENT && !TESTS && console.error(`Adding duplicate entity ${entity.id} (` +
				`${worldToRegionX(existing.x, map)}, ${worldToRegionY(existing.y, map)} => ` +
				`${worldToRegionX(entity.x, map)}, ${worldToRegionY(entity.y, map)})`);

			removeEntity(map, existing);
		}

		map.entitiesById.set(entity.id, entity);
	}

	if (isPony(entity) && entity.palettePonyInfo === undefined) {
		map.poniesToDecode.push(entity);
	}

	addEntityToRegion(region, entity, map);

	map.entities.push(entity);

	if (isDrawable(entity)) {
		map.entitiesDrawable.push(entity);
	}

	if (isMoving(entity)) {
		map.entitiesMoving.push(entity);
	}

	if (hasDrawLight(entity)) {
		pushUniq(map.entitiesLight, entity);
	}

	if (hasLightSprite(entity)) {
		pushUniq(map.entitiesLightSprite, entity);
	}

	if (entity.triggerBounds !== undefined) {
		pushUniq(map.entitiesTriggers, entity);
	}
}

function removeEntityFromEntities(map: WorldMap, entity: Entity) {
	map.entitiesById.delete(entity.id);
	removeItemFast(map.entities, entity);
	removeItem(map.entitiesWithChat, entity);
	removeItem(map.entitiesWithNames, entity);

	if (isDrawable(entity)) {
		removeItem(map.entitiesDrawable, entity);
	}

	if (isMoving(entity)) {
		removeItemFast(map.entitiesMoving, entity);
	}

	if (isPony(entity)) {
		removeItemFast(map.poniesToDecode, entity);
	}

	if (hasDrawLight(entity)) {
		removeItemFast(map.entitiesLight, entity);
	}

	if (hasLightSprite(entity)) {
		removeItemFast(map.entitiesLightSprite, entity);
	}

	if (entity.triggerBounds !== undefined) {
		removeItemFast(map.entitiesTriggers, entity);
	}
}

function removeEntitiesFromEntities(map: WorldMap, set: Set<Entity>) {
	if (set.size > 0) {
		const filter = (entity: Entity) => !set.has(entity);
		map.entities = map.entities.filter(filter);
		map.entitiesDrawable = map.entitiesDrawable.filter(filter);
		map.entitiesWithChat = map.entitiesWithChat.filter(filter);
		map.entitiesWithNames = map.entitiesWithNames.filter(filter);
		map.entitiesMoving = map.entitiesMoving.filter(filter);
		map.poniesToDecode = map.poniesToDecode.filter(filter);
		map.entitiesLight = map.entitiesLight.filter(filter);
		map.entitiesLightSprite = map.entitiesLightSprite.filter(filter);
		map.entitiesTriggers = map.entitiesTriggers.filter(filter);
	}
}

function removeEntityFromMapRegion(map: WorldMap, entity: Entity) {
	forEachRegion(map, region => !removeEntityFromRegion(region, entity, map));
}

export function getTile<T>(map: IMap<T>, x: number, y: number): TileType {
	const region = getRegionGlobal(map, x, y) as any as Region;

	if (region) {
		const regionX = Math.floor(x - region.x * REGION_SIZE);
		const regionY = Math.floor(y - region.y * REGION_SIZE);
		return getRegionTile(region, regionX, regionY);
	} else {
		return TileType.None;
	}
}

export function getRegionGlobal<T>(map: IMap<T>, x: number, y: number): T {
	const rx = worldToRegionX(x, map);
	const ry = worldToRegionY(y, map);
	return getRegion(map, rx, ry);
}

export function getRegion<T>(map: IMap<T>, x: number, y: number): T {
	if (x < 0 || y < 0 || x >= map.regionsX || y >= map.regionsY) {
		throw new Error(`Invalid region coords (${x}, ${y})`);
	} else {
		return map.regions[((x | 0) + (y | 0) * map.regionsX) | 0];
	}
}

export function getRegionUnsafe<T>(map: IMap<T>, x: number, y: number): T | undefined {
	if (x < 0 || y < 0 || x >= map.regionsX || y >= map.regionsY) {
		return undefined;
	} else {
		return map.regions[((x | 0) + (y | 0) * map.regionsX) | 0];
	}
}

export function addOrRemoveFromEntityList(list: Entity[], entity: Entity, had: boolean, has: boolean) {
	if (had !== has) {
		if (has) {
			pushUniq(list, entity);
		} else {
			removeItemFast(list, entity);
		}
	}
}

export function updateEntitiesWithNames(map: WorldMap, hover: Point, player: Entity) {
	for (let i = map.entitiesWithNames.length - 1; i >= 0; i--) {
		const entity = map.entitiesWithNames[i];

		if (!pickAny(entity, hover)) {
			map.entitiesWithNames.splice(i, 1);
		}
	}

	const regionX = worldToRegionX(hover.x, map);
	const regionY = worldToRegionY(hover.y, map);

	const minX = Math.max(0, regionX - 1) | 0;
	const minY = Math.max(0, regionY - 1) | 0;
	const maxX = Math.min(regionX + 1, map.regionsX - 1) | 0;
	const maxY = Math.min(regionY + 1, map.regionsY - 1) | 0;

	for (let ry = minY; ry <= maxY; ry++) {
		for (let rx = minX; rx <= maxX; rx++) {
			const region = getRegion(map, rx, ry);

			if (region !== undefined) {
				for (const e of region.entities) {
					if (e.name !== undefined && e !== player && pickAny(e, hover)) {
						pushUniq(map.entitiesWithNames, e);
					}
				}
			}
		}
	}
}

export function updateEntitiesCoverLifted(map: WorldMap, player: Entity, hideObjects: boolean, delta: number) {
	const playerX = toScreenX(player.x);
	const playerY = toScreenYWithZ(player.y, player.z);

	for (const e of map.entitiesDrawable) {
		if (e.coverBounds !== undefined) {
			e.coverLifted = hideObjects || containsPoint(toScreenX(e.x), toScreenY(e.y), e.coverBounds, playerX, playerY);

			const lifting = e.coverLifting || 0;

			if (e.coverLifted && lifting < 1) {
				e.coverLifting = Math.min(lifting + delta * 2, 1);
			} else if (!e.coverLifted && lifting > 0) {
				e.coverLifting = Math.max(lifting - delta * 2, 0);
			}
		}
	}
}

export function updateEntitiesTriggers(map: WorldMap, player: Pony, game: PonyTownGame) {
	for (const e of map.entitiesTriggers) {
		const on = (e.triggerTall || isPonyOnTheGround(player)) &&
			containsPoint(e.x, e.y, e.triggerBounds!, player.x, player.y);

		if (e.triggerOn !== on) {
			if (on) {
				game.send(server => server.interact(e.id, player.x, player.y));
			}

			e.triggerOn = on;
		}
	}
}

export function updateMap(map: WorldMap, delta: number) {
	map.tileTime += delta * WATER_FPS;

	forEachRegion(map, region => {
		if (region.tilesDirty) {
			updateTileIndices(region, map);
		}

		if (region.colliderDirty) {
			generateRegionCollider(region, map);
		}
	});
}

export function getMapHeightAt(map: WorldMap, x: number, y: number, gameTime: number) {
	for (const entity of map.entities) {
		const fixedBounds = (entity as any).boatSurfaceBounds2;
		if (fixedBounds && contains(entity.x, entity.y, fixedBounds, { x, y }) && isWaterSurfaceAt(map, x, y)) {
			return 0;
		}
		const bounds = (entity as any).boatSurfaceBounds;
		if (bounds && contains(entity.x, entity.y, bounds, { x, y }) && isWaterSurfaceAt(map, x, y)) {
			return (entity as any).boatSurfaceBobbing === false
				? 5 / tileElevation
				: getTileHeight(TileType.Boat, (12 << 8), x, y, gameTime, map.type) + (5 / tileElevation);
		}
	}
	return getTileHeight(getTile(map, x, y), getTileIndex(map, x, y), x, y, gameTime, map.type);
}

function isWaterSurfaceAt(map: IMap<Region | undefined>, x: number, y: number) {
	const tile = getTile(map, x, y);
	if (tile === TileType.Boat) {
		return true;
	}
	return tile === TileType.Water && isInWater(getTileIndex(map, x, y), x, y);
}

export function isBoatSurfaceAt(map: IMap<Region | undefined>, x: number, y: number) {
	for (const region of map.regions) {
		if (region) {
			for (const entity of (region as Region).entities) {
				const bounds = (entity as any).boatSurfaceBounds2;
				if (bounds && contains(entity.x, entity.y, bounds, { x, y }) && isWaterSurfaceAt(map, x, y)) {
					return true;
				}
			}
		}
	}
	return false;
}

function getBoatSurfaceHeight(gameTime: number, map: WorldMap) {
	return getTileHeight(TileType.Boat, (12 << 8), 0, 0, gameTime, map.type) + (5 / tileElevation);
}

export function isInWaterAt(map: IMap<Region | undefined>, x: number, y: number) {
	if (isBoatSurfaceAt(map, x, y)) {
		return false;
	}
	for (const region of map.regions) {
		if (region) {
			for (const entity of (region as Region).entities) {
				const fixedBounds = (entity as any).boatSurfaceBounds2;
				if (fixedBounds && contains(entity.x, entity.y, fixedBounds, { x, y }) && isWaterSurfaceAt(map, x, y)) {
					return false;
				}
				const bounds = (entity as any).boatSurfaceBounds;
				if (bounds && contains(entity.x, entity.y, bounds, { x, y }) && isWaterSurfaceAt(map, x, y)) {
					return false;
				}
			}
		}
	}
	return getTile(map, x, y) === TileType.Water && isInWater(getTileIndex(map, x, y), x, y);
}

export function updateEntities(game: PonyTownGame, gameTime: number, delta: number, safe: boolean, hoveredChatBubble?: Says) {
	TIMING && timeStart('updateEntities');

	const map = game.map;
	updateWeatherEffects(map, delta, game.camera, game.player);

	for (const entity of map.entitiesMoving) {
		updatePosition(entity, delta, map);
	}
	for (const entity of map.weatherClouds) {
		updatePosition(entity, delta, map);
		if (entity.x < -REGION_SIZE) {
			entity.x = map.width + REGION_SIZE;
		}
	}

	for (const entity of map.entities) {
		const flags = entity.flags;

		if ((entity as any).boatSurfaceBounds2 && isWaterSurfaceAt(map, entity.x, entity.y)) {
			entity.z = 0;
		} else if ((entity as any).boatSurfaceBounds && isWaterSurfaceAt(map, entity.x, entity.y) &&
			(entity as any).boatSurfaceBobbing !== false) {
			entity.z = getBoatSurfaceHeight(gameTime, map);
		} else if ((entity as any).boatSurfaceBounds) {
			entity.z = getMapHeightAt(map, entity.x, entity.y, gameTime);
		} else if ((flags & EntityFlags.Bobbing) !== 0) {
			const bobs = entity.bobs!;
			const frame = (((gameTime / 1000) * entity.bobsFps!) | 0) % bobs.length;
			entity.z = toWorldZ(bobs[frame]);
		} else if ((flags & EntityFlags.StaticY) === 0) {
			entity.z = getMapHeightAt(map, entity.x, entity.y, gameTime);
		}

		if (entity.type === PONY_TYPE) {
			const pony = entity as Pony;
			updatePonyEntity(pony, delta, gameTime, safe);

			const wasSwimming = pony.swimming;
			pony.swimming = !isPonyFlying(pony) && isInWaterAt(map, pony.x, pony.y);

			if (wasSwimming !== pony.swimming) {
				if (isFlyingDown(pony.animator.state)) {
					setTimeout(() => playEffect(game, pony, splash.type), 400);
				} else {
					playEffect(game, pony, splash.type);
				}
			}
		} else if (entity.update !== undefined) {
			entity.update(delta, gameTime);
		}

		if ((flags & EntityFlags.OnOff) !== 0) {
			const on = (entity.state & EntityState.On) !== 0;

			if (entity.lightOn !== undefined) {
				entity.lightOn = on;
			}

			if (entity.lightSpriteOn !== undefined) {
				entity.lightSpriteOn = on;
			}
		}

		if ((flags & EntityFlags.Light) !== 0) {
			if (entity.lightOn) {
				const move = delta * 0.2;

				if (Math.abs(entity.lightScale! - entity.lightTarget!) < move) {
					entity.lightScale = entity.lightTarget;
					entity.lightTarget = 1 - Math.random() * 0.15;
				} else {
					entity.lightScale! += entity.lightScale! < entity.lightTarget! ? move : -move;
				}
			}
		}
	}

	for (let i = map.entitiesWithChat.length - 1; i >= 0; i--) {
		const entity = map.entitiesWithChat[i];
		const bubbles = getChatBubbles(entity).slice();

		for (let j = bubbles.length - 1; j >= 0; j--) {
			const says = bubbles[j];

			if (says.timer) {
				says.timer -= delta;

				if (says.timer < 0) {
					if (says !== hoveredChatBubble || says.timer < -CHAT_BUBBLE_HOVER_EXTRA_TIME) {
						says.timer = 0;
						bubbles.splice(j, 1);
					}
				}
			}
		}

		if (bubbles.length) {
			entity.chatBubbles = bubbles;
			entity.says = bubbles[0];
		} else {
			entity.chatBubbles = undefined;
			entity.says = undefined;
			map.entitiesWithChat.splice(i, 1);
		}
	}

	TIMING && timeEnd();
}

export function invalidatePalettes(entities: Entity[]) {
	for (const entity of entities) {
		if (isPony(entity)) {
			invalidatePalettesForPony(entity);
		}
	}
}

export function ensureAllVisiblePoniesAreDecoded(map: WorldMap, camera: Camera, paletteManager: PaletteManager) {
	const poniesToDecode = map.poniesToDecode;

	if (!poniesToDecode.length)
		return;

	const decode = new Set<number>();

	for (let i = 0; i < poniesToDecode.length; i++) {
		const pony = poniesToDecode[i];

		if (isBoundsVisible(camera, pony.bounds, pony.x, pony.y)) {
			decode.add(i);
		}
	}

	if (!decode.size)
		return;

	if (decode.size > 100) {
		paletteManager.deduplicate = false;
	}

	map.poniesToDecode = poniesToDecode.filter((pony, i) => {
		if (pony.palettePonyInfo !== undefined) {
			return false;
		} else if (decode.has(i)) {
			ensurePonyInfoDecoded(pony);
			return false;
		} else {
			return true;
		}
	});

	if (decode.size > 100) {
		paletteManager.deduplicate = true;
	}
}

export function switchEntityRegion(map: WorldMap, entity: Entity, x: number, y: number) {
	removeEntityFromMapRegion(map, entity);

	const region = getRegionGlobal(map, x, y);

	if (region) {
		addEntityToRegion(region, entity, map);
	} else {
		releaseAndRemoveEntityFromMap(map, entity);
	}
}

export function updateMapState(map: WorldMap, prevState: MapState, newState: MapState) {
	if (prevState.weather !== newState.weather) {
		const weatherState = getWeatherEffectsState(map);
		weatherState.target = newState.weather === Weather.None ? 0 : 1;
		weatherState.initialized = true;
	}
}

interface WeatherEffectsState {
	intensity: number;
	target: number;
	lightning?: Entity;
	lightningTime: number;
	lightningCooldown: number;
	initialized: boolean;
}

const WEATHER_FADE_TIME = 3;
const MAX_RAIN_SPRITES = 306;
const MAX_RAINDROP_EFFECTS = 250;
const STORM_EFFECT_MULTIPLIER = 2;
const RAIN_HORIZONTAL_PADDING = 32;
const RAIN_VERTICAL_PADDING = 18;
const CLOUD_FLOCK_SIZE = 4;
const MAX_WEATHER_CLOUDS = 96;
const STORM_MAX_WEATHER_CLOUDS = MAX_WEATHER_CLOUDS * STORM_EFFECT_MULTIPLIER;
const WEATHER_CLOUD_SLOT_SIZE = CLOUD_FLOCK_SIZE + 1;
const WEATHER_CLOUD_SLOT_COUNT = Math.ceil(STORM_MAX_WEATHER_CLOUDS / WEATHER_CLOUD_SLOT_SIZE);
const WEATHER_CLOUD_SPAWN_DELAY = 0.45;
const WEATHER_EFFECT_DELAY = 0.45;
const STORM_LIGHTNING_DURATION = 0.16;
const STORM_LIGHTNING_INTERVAL = 60;
const STORM_LIGHTNING_MIN_DISTANCE = 24;
const STORM_LIGHTNING_MAX_DISTANCE = 40;
const weatherEffectsStates = new WeakMap<WorldMap, WeatherEffectsState>();

export function getWeatherIntensity(map: WorldMap) {
	return getWeatherEffectsState(map).intensity;
}

function getWeatherEffectsState(map: WorldMap) {
	let state = weatherEffectsStates.get(map);
	if (!state) {
		state = {
			intensity: map.state.weather === Weather.None ? 0 : 1,
			target: map.state.weather === Weather.None ? 0 : 1,
			lightningTime: 0,
			lightningCooldown: 0,
			initialized: false,
		};
		weatherEffectsStates.set(map, state);
	}
	return state;
}

function updateWeatherEffects(map: WorldMap, delta: number, camera: Camera, player?: Pony) {
	const state = getWeatherEffectsState(map);
	const step = delta / WEATHER_FADE_TIME;
	if (!state.initialized) {
		state.initialized = true;
	}
	state.intensity += (state.target - state.intensity) * Math.min(1, step);
	if (Math.abs(state.target - state.intensity) < 0.01) {
		state.intensity = state.target;
	}
	const isStorm = map.state.weather === Weather.Storm;
	state.lightningTime -= delta;
	state.lightningCooldown -= delta;
	if (state.lightning && (!isStorm || state.lightningTime <= 0)) {
		removeEntityDirectly(map, state.lightning);
		state.lightning = undefined;
	}

	const effects = map.entities.filter(e => e.id === 0 &&
		(e.type === rain.type || e.type === raindrop.type));
	const weatherClouds = map.weatherClouds;
	const rainEntities = effects.filter(entity => entity.type === rain.type);
	const raindropEntities = effects.filter(entity => entity.type === raindrop.type);
	const rainLimit = MAX_RAIN_SPRITES * (isStorm ? STORM_EFFECT_MULTIPLIER : 1);
	const raindropLimit = MAX_RAINDROP_EFFECTS * (isStorm ? STORM_EFFECT_MULTIPLIER : 1);
	const cloudLimit = MAX_WEATHER_CLOUDS * (isStorm ? STORM_EFFECT_MULTIPLIER : 1);
	for (const entity of rainEntities.slice(rainLimit)) {
		removeEntityDirectly(map, entity);
	}
	for (const entity of raindropEntities.slice(raindropLimit)) {
		removeEntityDirectly(map, entity);
	}
	for (const entity of weatherClouds) {
		const cloudKey = (entity as any).weatherCloudKey as string | undefined;
		const slot = cloudKey ? parseInt(cloudKey.split(':')[0], 10) : cloudLimit;
		if (state.intensity === 0 || slot >= Math.ceil(cloudLimit / WEATHER_CLOUD_SLOT_SIZE)) {
			removeWeatherCloud(map, entity);
		}
	}
	for (const entity of effects.concat(weatherClouds)) {
		const isCloud = entity.type === cloud.type;
		if (isCloud && (entity as any).entityOpacity === 0) {
			(entity as any).weatherCloudDelay = Math.max(0, (entity as any).weatherCloudDelay - delta);
			if ((entity as any).weatherCloudDelay <= 0) {
				(entity as any).entityOpacity = 1;
			}
		}
		if (isCloud) {
			continue;
		}
		if (!isCloud && (entity as any).weatherOpacityTarget === undefined) {
			const minOpacity = isCloud ? 0.25 :
				(entity.type === raindrop.type ? 0.2 : 0.3);
			const maxOpacity = isCloud ? 0.7 :
				(entity.type === raindrop.type ? 0.85 : 1);
			(entity as any).weatherOpacityTarget = minOpacity + Math.random() * (maxOpacity - minOpacity);
		}
		if (!isCloud && (entity as any).weatherOpacityDelay === undefined) {
			(entity as any).weatherOpacityDelay = Math.random() * WEATHER_EFFECT_DELAY;
			if ((entity as any).weatherOpacity === undefined) {
				(entity as any).weatherOpacity = 0;
			}
		}
		const delayed = !isCloud && (entity as any).weatherOpacityDelay > 0;
		if (!isCloud && (entity as any).weatherOpacityDelay !== undefined) {
			(entity as any).weatherOpacityDelay = Math.max(0, (entity as any).weatherOpacityDelay - delta);
		}
		const currentOpacity = (entity as any).weatherOpacity === undefined
			? (delayed ? 0 : state.intensity)
			: (entity as any).weatherOpacity;
		const targetOpacity = delayed ? 0 : state.intensity * ((entity as any).weatherOpacityTarget || 1);
		const fadeStep = Math.min(1, Math.max(0, delta) / 1.5);
		(entity as any).weatherOpacity = Math.max(0, Math.min(1,
			currentOpacity + (targetOpacity - currentOpacity) * fadeStep));
		if (!isCloud && state.intensity === 0 && (entity as any).weatherOpacity <= 0.001) {
			removeEntityDirectly(map, entity);
		}
	}

	if (state.intensity === 0) {
		return;
	}

	if (isStorm && state.intensity > 0.5 && !state.lightning && state.lightningCooldown <= 0) {
		const centerX = player ? player.x : toWorldX(camera.x + camera.w / 2);
		const centerY = player ? player.y : toWorldY(camera.actualY + camera.h / 2);
		const distance = STORM_LIGHTNING_MIN_DISTANCE +
			Math.random() * (STORM_LIGHTNING_MAX_DISTANCE - STORM_LIGHTNING_MIN_DISTANCE);
		const angle = Math.random() * Math.PI * 2;
		const lightning = stormLight(
			Math.max(0, Math.min(map.width, centerX + Math.cos(angle) * distance)),
			Math.max(0, Math.min(map.height, centerY + Math.sin(angle) * distance)),
		);
		state.lightning = lightning;
		state.lightningTime = STORM_LIGHTNING_DURATION;
		state.lightningCooldown = STORM_LIGHTNING_INTERVAL;
		addWeatherEntity(map, lightning);
	}

	if (state.intensity === 1) {
		addWeatherClouds(map, isStorm);
	}

	if (state.intensity > 0) {
		addRainEffects(map, camera, isStorm);
	}
}

function addWeatherClouds(map: WorldMap, isStorm: boolean) {
	const maxClouds = isStorm ? STORM_MAX_WEATHER_CLOUDS : MAX_WEATHER_CLOUDS;
	const cloudSlots = Math.ceil(maxClouds / WEATHER_CLOUD_SLOT_SIZE);
	const seedSlotCount = WEATHER_CLOUD_SLOT_COUNT;
	const existingClouds = new Map<string, Entity>();
	const oldClouds = map.entities.filter(entity => entity.id === 0 && entity.type === cloud.type);
	for (const entity of oldClouds) {
		removeEntityDirectly(map, entity);
	}
	const weatherClouds = map.weatherClouds;
	for (const entity of weatherClouds) {
		const cloudKey = (entity as any).weatherCloudKey as string | undefined;
		if (!cloudKey) {
			removeWeatherCloud(map, entity);
		} else {
			(entity as any).weatherCloudFadeOut = false;
			existingClouds.set(cloudKey, entity);
		}
	}

	for (let slot = 0; slot < cloudSlots; slot++) {
		const slotSeed = weatherCloudRandom(map, 0, slot);
		const slotX = Math.floor(slotSeed * Math.max(map.width, 1));
		const slotY = Math.floor(weatherCloudRandom(map, 0, slot + seedSlotCount) * Math.max(map.height, 1));
		const flockSize = CLOUD_FLOCK_SIZE + Math.floor(weatherCloudRandom(map, 0, slot + seedSlotCount * 2) * 3);
		for (let i = 0; i < flockSize && i < WEATHER_CLOUD_SLOT_SIZE && existingClouds.size < maxClouds; i++) {
			const cloudKey = `${slot}:${i}`;
			if (existingClouds.has(cloudKey)) {
				continue;
			}
			const x = slotX + weatherCloudRandom(map, 0, slot * WEATHER_CLOUD_SLOT_SIZE + i + 1) * REGION_SIZE;
			const y = slotY + weatherCloudRandom(map, 0, slot * WEATHER_CLOUD_SLOT_SIZE + i + seedSlotCount + 1) * REGION_SIZE;
			const entity = cloud(x, y);
			entity.vx = -0.5 - weatherCloudRandom(map, 0, slot * WEATHER_CLOUD_SLOT_SIZE + i + seedSlotCount * 3) * 0.5;
			(entity as any).weatherCloudKey = cloudKey;
			(entity as any).entityOpacity = 0;
			(entity as any).weatherCloudDelay = weatherCloudRandom(map, 0, slot * WEATHER_CLOUD_SLOT_SIZE + i + seedSlotCount * 5) * WEATHER_CLOUD_SPAWN_DELAY;
			weatherClouds.push(entity);
			existingClouds.set(cloudKey, entity);
		}
	}
}

function removeWeatherCloud(map: WorldMap, entity: Entity) {
	removeItemFast(map.weatherClouds, entity);
	releaseEntity(entity);
}

function weatherCloudRandom(map: WorldMap, weatherKey: number, index: number) {
	let value = (map.width * 73856093) ^ (map.height * 19349663) ^ (weatherKey * 83492791) ^ (index * 2654435761);
	value = Math.imul(value ^ (value >>> 16), 2246822519);
	value = Math.imul(value ^ (value >>> 13), 3266489917);
	return ((value ^ (value >>> 16)) >>> 0) / 0x100000000;
}

function addWeatherEntity(map: WorldMap, entity: Entity) {
	if (getRegionGlobal(map, entity.x, entity.y)) {
		addEntity(map, entity);
	}
}

function addRainEffects(map: WorldMap, camera: Camera, isStorm: boolean) {
	const minX = Math.max(0, toWorldX(camera.x) - RAIN_HORIZONTAL_PADDING);
	const maxX = Math.min(map.width, toWorldX(camera.x + camera.w) + RAIN_HORIZONTAL_PADDING);
	const minY = Math.max(0, toWorldY(camera.actualY) - RAIN_VERTICAL_PADDING);
	const maxY = Math.min(map.height, toWorldY(camera.actualY + camera.h) + RAIN_VERTICAL_PADDING);
	let rainEffects = 0;
	let raindropEffects = 0;

	forEachRegion(map, region => {
		for (const entity of region.entities) {
			if (entity.id !== 0 || (entity.type !== rain.type && entity.type !== raindrop.type)) {
				continue;
			}
			if (entity.x < minX || entity.x > maxX || entity.y < minY || entity.y > maxY) {
				removeEntityDirectly(map, entity);
				continue;
			}

			if (entity.type === rain.type) {
				rainEffects++;
			} else {
				raindropEffects++;
			}
		}
	});

	const rainLimit = MAX_RAIN_SPRITES * (isStorm ? STORM_EFFECT_MULTIPLIER : 1);
	const raindropLimit = MAX_RAINDROP_EFFECTS * (isStorm ? STORM_EFFECT_MULTIPLIER : 1);
	while (rainEffects < rainLimit) {
		const rainEntity = rain(
			minX + Math.random() * Math.max(maxX - minX, 0),
			minY + Math.random() * Math.max(maxY - minY, 0),
		);
		(rainEntity as any).fadeTime = 100;
		rainEntity.entityOpacity = 1;
		(rainEntity as any).weatherOpacity = 0;
		(rainEntity as any).weatherOpacityDelay = Math.random() * WEATHER_EFFECT_DELAY;
		addWeatherEntity(map, rainEntity);
		rainEffects++;
	}

	while (raindropEffects < raindropLimit) {
		const raindropEntity = raindrop(
			minX + Math.random() * Math.max(maxX - minX, 0),
			minY + Math.random() * Math.max(maxY - minY, 0),
		);
		(raindropEntity as any).fadeTime = 100;
		raindropEntity.entityOpacity = 1;
		(raindropEntity as any).weatherOpacity = 0;
		(raindropEntity as any).weatherOpacityDelay = Math.random() * WEATHER_EFFECT_DELAY;
		addWeatherEntity(map, raindropEntity);
		raindropEffects++;
	}
}
