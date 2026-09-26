import { compact, escapeRegExp, repeat } from 'lodash';
import { createBinaryReader, readUint8, readUint32, readUint16 } from 'ag-sockets/dist/browser';
import { decodeString } from 'ag-sockets/dist/utf8';
import {
	Entity, Region, Pony, EntityState, PonyOptions, MessageType, isNonIgnorableMessage, EntityPlayerState,
	EntityOrPonyOptions, isPublicMessage, FakeEntity, Action, WorldMap, DoAction, UpdateType, DecodedUpdate,
	PonyData, WorldStateFlags, FriendStatusData, FriendStatusFlags, isWhisper, isWhisperTo,
	isTypingIndicatorMessage, typingIndicatorDuration,
} from '../common/interfaces';
import { bitmask, setFlag, findById, distance, hasFlag, distanceXY, invalidEnum, removeItem } from '../common/utils';
import { isChatVisible } from '../common/camera';
import { getTagGradient } from '../common/tags';
import { createRegion, worldToRegionX, worldToRegionY } from '../common/region';
import { createAnEntity, poof, poof2, getEntityType } from '../common/entities';
import { getPonyState, setPonyState, isPonyFlying, addChatBubble, isHidden, getChatBubbleLimit, isFacingRight } from '../common/entityUtils';
import { toWorldX, toWorldY } from '../common/positionUtils';
import {
	isPony, createPony, setPonyExpression, updatePonyInfo, updatePonyHold, doPonyAction, hasHeadAnimation,
	setHeadAnimation,
	doBoopPonyAction,
	isPonyBug
} from '../common/pony';
import { PonyTownGame } from './game';
import { setupPlayer, savePlayerPosition } from './sec';
import { PONY_INFO_KEY, FLY_DELAY, isChatlogRangeUnlimited, SECOND, PONY_TYPE, OPEN_TOY_MODAL_MESSAGE } from '../common/constants';
import { getSaysTime, containsCyrillic } from './clientUtils';
import { dismissSays } from '../graphics/graphicsUtils';
import { decodeUpdate, readOneUpdate } from '../common/encoders/updateDecoder';
import { updateEntityVelocity } from '../common/entityUtils';
import { decodePonyInfo } from '../common/compressPony';
import { mockPaletteManager } from '../common/ponyInfo';
import { yawn, laugh, sneeze, kiss, kissFly, kissFlyBug, excite } from './ponyAnimations';
import {
	findEntityById, getRegionGlobal, setTile, removeEntity, addEntity, removeEntityDirectly, setRegion,
	addEntityToMapRegion, switchEntityRegion, getRegionUnsafe, addOrRemoveFromEntityList,
} from '../common/worldMap';
import { isSelected } from './gameUtils';
import { compareFriends } from '../components/services/model';
import { canCollideWith } from '../common/collision';
import { hasDrawLight, hasLightSprite } from './draw';

function log(message: string) {
	if (DEVELOPMENT && !TESTS) {
		console.error(message);
	}
}

function handleAddEntity(game: PonyTownGame, region: Region, update: DecodedUpdate, initial: boolean) {
	const {
		id, type = 0, x = 0, y = 0, vx = 0, vy = 0, state = 0, playerState = 0, options = {},
		name, filterName, info, crc = 0, action // , expression
	} = update;

	const filteredName = filterEntityName(game, name, filterName);
	const entity = createEntityOrPony(game, type, id, x, y, options, crc, filteredName, info, state);

	entity.id = id;
	entity.x = x;
	entity.y = y;
	entity.vx = vx;
	entity.vy = vy;
	entity.playerState = playerState || EntityPlayerState.None;

	addEntityToMapRegion(game.map, region, entity);

	const editorSelectionIndex = game.editor.selectedEntities.findIndex(selected => selected.id === id);
	if (editorSelectionIndex >= 0) {
		const previousEntity = game.editor.selectedEntities[editorSelectionIndex];
		entity.draggingStart = previousEntity.draggingStart;
		game.editor.selectedEntities[editorSelectionIndex] = entity;
	}

	if (isPony(entity)) {
		if (id === game.playerId) {
			game.apply(() => setupPlayer(game, entity));
		}

		if (isSelected(game, id)) {
			game.select(entity);
		}

		if (game.whisperTo && game.whisperTo.id === id) {
			game.whisperTo = entity;
		}

		if (!initial) {
			game.onPonyAddOrUpdate.next(entity);
		}
	}

	reconcileEntityFriendState(game, entity);

	if (action !== undefined) {
		handleAction(game, id, action);
	}
}

export function handleUpdateEntity(game: PonyTownGame, update: DecodedUpdate) {
	const {
		id, x, y, vx, vy, state, playerState, expression, options, switchRegion,
		name, filterName, info, crc = 0, action
	} = update;

	const filteredName = filterEntityName(game, name, filterName);
	const entity = findEntityByIdInGame(game, id);

	if (entity) {
		const isPlayer = id === game.playerId;

		if (x !== undefined && y !== undefined) {
			if (switchRegion) {
				if (DEVELOPMENT && isPlayer && !getRegionGlobal(game.map, x, y)) {
					console.error(`Switching player to unsubscribed region`);
				}

				switchEntityRegion(game.map, entity, x, y);
			}

			if (!isPlayer) {
				// if (DEVELOPMENT && isPony(entity)) {
				// 	const dx = entity.x - x;
				// 	const dy = entity.y - y;
				// 	console.log(`adjust x: [${num(dx)}] (${ms(dx)}) y: [${num(dy)}] (${ms(dy)})`);
				// }

				entity.x = x;
				entity.y = y;
				updateEntityVelocity(game.map, entity, vx, vy);

				if (canCollideWith(entity)) {
					const rx = worldToRegionX(entity.x, game.map);
					const ry = worldToRegionY(entity.y, game.map);

					for (let y = -1; y <= 1; y++) {
						for (let x = -1; x <= 1; x++) {
							const region = getRegionUnsafe(game.map, rx + x, ry + y);

							if (region) {
								region.colliderDirty = true;
							}
						}
					}
				}
			} else if (distanceXY(entity.x, entity.y, x, y) > 8) {
				log(`Fixing player position (${entity.x}, ${entity.y}) => (${x}, ${y})`);
				entity.x = x;
				entity.y = y;
				savePlayerPosition();
			}

			// Update velocity for both player and other entities to sync server-calculated speed
			if (vx !== undefined && vy !== undefined) {
				updateEntityVelocity(game.map, entity, vx, vy);
			}
		}

		if (state !== undefined) {
			updateEntityStateInternal(game, entity, state);
		}

		if (playerState !== undefined) {
			updateEntityPlayerStateInternal(game, entity, playerState);
		}

		if (expression !== undefined && isPony(entity)) {
			setPonyExpression(entity, expression);
		}

		if (options != null) {
			updateEntityOptionsInternal(entity, options, game);
		}

		if (filteredName !== undefined && !isPlayer) {
			entity.name = filteredName;
		}

		if (info !== undefined && !isPlayer) {
			const ponyInfo = bitmask(info, PONY_INFO_KEY);

			if (entity.fake) {
				(entity as Pony).palettePonyInfo = decodePonyInfo(ponyInfo, mockPaletteManager);
			} else {
				updatePonyInfoWithPoof(game, entity, ponyInfo, crc);
			}
		}

		if (action !== undefined) {
			handleAction(game, id, action);
		}

		reconcileEntityFriendState(game, entity);

		applyIfSelected(game, id);
	} else {
		log(`handleUpdateEntity: missing entity: ${id}`);
	}
}

export function handleUpdatePonies(game: PonyTownGame, ponies: PonyData[]) {
	for (const [id, options = {}, name, info, playerState, nameBad] of ponies) {
		const decodedName = name && decodeString(name) || undefined;
		const filteredName = filterEntityName(game, decodedName, nameBad);
		const decodedInfo = info ? bitmask(info, PONY_INFO_KEY) : '';
		const pony = createPonyEntity(game, id, options, filteredName, decodedInfo, EntityState.None);
		pony.playerState = playerState;
		game.fallbackPonies.set(pony.id, pony);
	}

	const missing = game.party && game.party.members.filter(p => !p.pony);

	if (missing && missing.length) {
		game.apply(() => missing.forEach(p => p.pony = game.fallbackPonies.get(p.id)));
	}
}

function createPonyEntity(
	game: PonyTownGame, id: number, options: PonyOptions, name: string | undefined, info: string | Uint8Array,
	state: EntityState
) {
	if (!game.webgl) {
		throw new Error('WebGL not initialized');
	}

	const pony = createPony(id, state, info, game.webgl.palettes.defaultPalette, game.paletteManager);

	if (name) {
		pony.name = name;
	}

	updateEntityOptionsInternal(pony, options, game);

	// bypass name/info filtering for player pony
	if (id === game.playerId) {
		if (game.playerName) {
			pony.name = game.playerName;
		}

		if (game.playerInfo) {
			pony.crc = game.playerCRC;
			updatePonyInfo(pony, game.playerInfo, game.applyChanges);
		}
	}

	return pony;
}

function updateEntityStateInternal(game: PonyTownGame, entity: Entity, state: EntityState) {
	if (entity === game.player) {
		const right = game.rightOverride;
		const headTurned = game.headTurnedOverride;
		const stateOverride = game.stateOverride;

		if (right !== undefined) {
			state = setFlag(state, EntityState.FacingRight, right);
			game.rightOverride = undefined;
		}

		if (headTurned !== undefined) {
			state = setFlag(state, EntityState.HeadTurned, headTurned);
			game.headTurnedOverride = undefined;
		}

		if (stateOverride !== undefined) {
			if (stateOverride !== getPonyState(state)) {
				state = setPonyState(state, stateOverride);
			}

			game.stateOverride = undefined;
		}

		game.onActionsUpdate.next();
	}

	const wasPonyFlying = isPonyFlying(entity);
	const hadLight = hasDrawLight(entity);
	const hadLightSprite = hasLightSprite(entity);
	const wasFacingRight = isFacingRight(entity);

	entity.state = state;

	if (!isPony(entity) && wasFacingRight !== isFacingRight(entity)) {
		if (entity.collidersBounds) {
			entity.collidersBounds = { ...entity.collidersBounds };
			entity.collidersBounds.x = -entity.collidersBounds.x - entity.collidersBounds.w;
		}
		if (Array.isArray(entity.colliders)) {
			entity.colliders = entity.colliders.map(c => c ? { ...c, x: -c.x - c.w } : c);
		}
	}

	if (!wasPonyFlying && isPonyFlying(entity) && isPony(entity)) {
		entity.inTheAirDelay = FLY_DELAY;
	}

	const hasLight = hasDrawLight(entity);
	const hasLightSprite1 = hasLightSprite(entity);

	addOrRemoveFromEntityList(game.map.entitiesLight, entity, hadLight, hasLight);
	addOrRemoveFromEntityList(game.map.entitiesLightSprite, entity, hadLightSprite, hasLightSprite1);
}

function updateEntityPlayerStateInternal(game: PonyTownGame, entity: Entity, playerState: EntityPlayerState) {
	if (!entity.fake && !isHidden(entity) && hasFlag(playerState, EntityPlayerState.Hidden)) {
		playEffect(game, entity, poof.type);

		if (isSelected(game, entity.id)) {
			game.select(undefined);
		}
	}

	entity.playerState = playerState;

	const selected = game.selected;
	if (selected && selected !== entity && selected.id === entity.id) {
		selected.playerState = playerState;
	}
}

function findEntityByIdInGame(game: PonyTownGame, id: number) {
	let entity = findEntityById(game.map, id);

	if (!entity && isSelected(game, id)) {
		entity = game.selected;
	}

	return entity;
}

function updateFriendFlagForEntity(game: PonyTownGame, entityId: number | undefined, isFriend: boolean) {
	if (!entityId) {
		return;
	}

	const entity = findEntityByIdInGame(game, entityId);

	if (!entity) {
		return;
	}

	const playerState = setFlag(entity.playerState || EntityPlayerState.None, EntityPlayerState.Friend, isFriend);
	updateEntityPlayerStateInternal(game, entity, playerState);
	applyIfSelected(game, entityId);
}

function shouldHaveFriendState(game: PonyTownGame, entityId: number) {
	const friends = game.model.friends;
	return !!(friends && friends.some(friend => friend.online && friend.entityId === entityId));
}

function reconcileEntityFriendState(game: PonyTownGame, entity: Entity) {
	const playerState = setFlag(
		entity.playerState || EntityPlayerState.None,
		EntityPlayerState.Friend,
		shouldHaveFriendState(game, entity.id)
	);

	if (playerState !== entity.playerState) {
		updateEntityPlayerStateInternal(game, entity, playerState);
	}
}

function applyIfSelected(game: PonyTownGame, id: number) {
	if (isSelected(game, id)) {
		game.applyChanges();
	}
}

export function handleUpdates(game: PonyTownGame, updates: Uint8Array) {
	const reader = createBinaryReader(updates);

	while (reader.offset < reader.view.byteLength) {
		const type = readUint8(reader) as UpdateType;

		switch (type) {
			case UpdateType.None:
				log(`handleUpdates (none)`);
				break;
			case UpdateType.AddEntity: {
				const update = readOneUpdate(reader)!;
				const { x = 0, y = 0 } = update;
				const region = getRegionGlobal(game.map, x, y);

				if (region) {
					handleAddEntity(game, region, update, false);
				} else {
					log(`handleUpdates (add): missing region at ${x} ${y}`);
				}
				break;
			}
			case UpdateType.UpdateEntity: {
				const update = readOneUpdate(reader)!;
				handleUpdateEntity(game, update);
				break;
			}
			case UpdateType.RemoveEntity: {
				const id = readUint32(reader);
				handleRemoveEntity(game, id);
				break;
			}
			case UpdateType.UpdateTile: {
				const x = readUint16(reader);
				const y = readUint16(reader);
				const type = readUint8(reader);
				setTile(game.map, x, y, type);
				break;
			}
			default:
				invalidEnum(type);
		}
	}
}

export function updatePonyInfoWithPoof(game: PonyTownGame, entity: Entity, info: string | Uint8Array, crc: number) {
	const update = (pony: Pony) => {
		pony.crc = crc;
		updatePonyInfo(pony, info, game.applyChanges);
		game.onPonyAddOrUpdate.next(pony);
	};

	if (entity && isPony(entity)) {
		if (isHidden(entity)) {
			update(entity);
		} else {
			playEffect(game, entity, poof2.type);
			setTimeout(() => update(entity), 100);
		}
	}
}

export function handleRemoveEntity(game: PonyTownGame, id: number) {
	const entity = findEntityById(game.map, id);

	if (entity) {
		removeEntity(game.map, entity);
	} else {
		log(`handleRemoveEntity: Missing entity: ${id}`);
	}

	if (id === game.playerId) {
		log(`handleRemoveEntity: Removing player`);
	}

	if (entity && entity.type === PONY_TYPE) {
		playEffect(game, entity, poof.type);
	}

	if (isSelected(game, id)) {
		const selected = game.selected as any;
		if (selected) {
			selected.offline = true;
			if (!selected.options) {
				selected.options = {};
			}
			selected.options.offline = true;
		}

		setTimeout(() => {
			if (isSelected(game, id)) {
				game.select(undefined);
			}
		}, 15 * SECOND);
	}
}

function findPonyById(map: WorldMap, id: number) {
	const entity = findEntityById(map, id);
	return entity && isPony(entity) ? entity : undefined;
}

export function handleAction(game: PonyTownGame, id: number, action: Action) {
	const pony = findPonyById(game.map, id);

	if (pony) {
		switch (action) {
			case Action.Boop:
				doBoopPonyAction(game, pony);
				break;
			case Action.Dance1:
				doPonyAction(pony, DoAction.Dance1);
				break;
			case Action.Dance2:
				doPonyAction(pony, DoAction.Dance2);
				break;
			case Action.Clapping1_0:
				doPonyAction(pony, DoAction.Clapping1_0);
				break;
			case Action.Dance3:
				doPonyAction(pony, DoAction.Dance3);
				break;
			case Action.WingToggle:
				pony.options = pony.options || {};
				pony.options.wingOpen = !pony.options.wingOpen;
				break;
			case Action.HoldPoof:
				doPonyAction(pony, DoAction.HoldPoof);
				break;
			case Action.Yawn:
				if (!hasHeadAnimation(pony)) {
					setHeadAnimation(pony, yawn);
				}
				break;
			case Action.Laugh:
				if (!hasHeadAnimation(pony)) {
					setHeadAnimation(pony, laugh);
				}
				break;
			case Action.Sneeze:
				if (!hasHeadAnimation(pony)) {
					setHeadAnimation(pony, sneeze);
				}
				break;
			case Action.Excite:
				if (!hasHeadAnimation(pony)) {
					setHeadAnimation(pony, excite);
				}
				break;
			case Action.Kiss:
				if (!pony.ponyState.headTurned) {
					doPonyAction(pony, DoAction.Kiss);
				}
				if (isPonyFlying(pony)) {
					if (isPonyBug(pony)) {
						setHeadAnimation(pony, kissFlyBug);
					}
					else {
						setHeadAnimation(pony, kissFly);
					}
				}
				else {
					setHeadAnimation(pony, kiss);
				}
				break;
			default:
				log(`handleAction: Invalid action: ${action}`);
		}
	} else {
		log(`handleAction: Missing entity: ${id}`);
	}
}

export function playEffect(game: PonyTownGame, target: Entity, type: number) {
	if (isHidden(target))
		return;

	try {
		const entity = createAnEntity(type, 0, target.x, target.y, {}, game.paletteManager, game);
		addEntity(game.map, entity);
		setTimeout(() => removeEntityDirectly(game.map, entity), 1000);
	} catch (e) {
		DEVELOPMENT && console.error(e);
	}
}

export function findEntityOrMockByAnyMeans(game: PonyTownGame, id: number) {
	if (!id) {
		return undefined;
	}

	let entity: Entity | FakeEntity | undefined = findEntityById(game.map, id);

	if (!entity && game.party) {
		const member = findById(game.party.members, id);
		entity = member && member.pony;
	}

	if (!entity) {
		const friend = game.model.friends && game.model.friends.find(f => f.entityId === id);

		if (friend) {
			entity = { fake: true, type: PONY_TYPE, id: friend.entityId, name: friend.actualName, crc: friend.crc };
		}
	}

	if (!entity) {
		entity = game.findEntityFromChatLog(id);
	}

	return entity;
}

export function findBestEntityByName(game: PonyTownGame, name: string): Entity | FakeEntity | undefined {
	const regex = new RegExp(`^${escapeRegExp(name)}$`, 'i');

	if (game.model.friends) {
		for (const friend of game.model.friends) {
			if (friend.online && friend.entityId && regex.test(friend.actualName)) {
				return { fake: true, type: PONY_TYPE, id: friend.entityId, name: friend.actualName, crc: friend.crc };
			}
		}
	}

	let result: Entity | FakeEntity | undefined = undefined;

	if (game.player) {
		for (const entity of game.map.entities) {
			if (entity.type === PONY_TYPE && entity.id !== game.playerId && !isHidden(entity) && entity.name && regex.test(entity.name)) {
				if (!result || (distance(game.player, entity) < distance(game.player, result))) {
					result = entity;
				}
			}
		}
	}

	if (!result) {
		result = game.findEntityFromChatLogByName(name);
	}

	return result;
}

export function findMatchingEntityNames(game: PonyTownGame, match: string): string[] {
	const result: string[] = [];
	const ids = new Set<number>();
	const regex = new RegExp(`^${escapeRegExp(match)}`, 'i');

	if (game.model.friends) {
		for (const friend of game.model.friends) {
			if (friend.online && friend.entityId && friend.actualName && regex.test(friend.actualName)) {
				ids.add(friend.entityId);
				result.push(friend.actualName);
			}
		}
	}

	for (const entity of game.map.entities) {
		if (
			entity.type === PONY_TYPE &&
			entity.id !== game.playerId &&
			entity.name &&
			!isHidden(entity) &&
			regex.test(entity.name) &&
			!ids.has(entity.id)
		) {
			result.push(entity.name);
		}
	}

	return result;
}

let cachedFilter: string | undefined = undefined;
let cachedRegex: RegExp | undefined = undefined;

export function containsFilteredWords(message: string, filter: string | undefined) {
	if (cachedFilter !== filter) {
		if (filter) {
			const words = compact(filter.replace(/[,]/g, ' ').split(/[\r\n\t ]+/g).map(x => x.trim()));
			cachedRegex = new RegExp(`(^| )(${words.map(escapeRegExp).join('|')})($| )`, 'i');
		} else {
			cachedRegex = undefined;
		}

		cachedFilter = filter;
	}

	return cachedRegex && cachedRegex.test(message);
}

export function handleSays(game: PonyTownGame, id: number, message: string, type: MessageType) {
	const entity = findEntityOrMockByAnyMeans(game, id);

	if (entity) {
		handleSay(game, entity, message, type);
	} else {
		DEVELOPMENT && console.warn('incomplete say');
		game.incompleteSays.push({ id, message, type, time: Date.now() });
		game.send(server => server.actionParam2(Action.RequestEntityInfo, id));
	}
}

function isFriendEntityId(game: PonyTownGame, id: number) {
	if (game.model.friends) {
		for (const friend of game.model.friends) {
			if (friend.entityId === id) {
				return true;
			}
		}
	}

	return false;
}

function shouldShowChatMessage(game: PonyTownGame, entity: Entity | FakeEntity, message: string, type: MessageType): boolean {
	if (entity === game.player)
		return true;

	if (isWhisperTo(type))
		return true;

	if (isWhisper(type) && isFriendEntityId(game, entity.id))
		return true;

	if (isPublicMessage(type) && !entity.fake && !isChatVisible(game.camera, entity))
		return false;

	if (isNonIgnorableMessage(type))
		return true;

	if (game.settings.account.filterCyrillic && containsCyrillic(message))
		return false;

	if (game.settings.account.ignorePublicChat && isPublicMessage(type))
		return false;

	if (isWhisper(type) && game.settings.account.ignoreNonFriendWhispers)
		return false;

	if (containsFilteredWords(message, game.settings.account.filterWords))
		return false;

	return true;
}

function isChatInRange(entity: Entity, player: Entity | undefined, range: number | undefined) {
	return player === undefined || isChatlogRangeUnlimited(range) || distance(entity, player) < range!;
}

function shouldShowChatMessageInChatlog(game: PonyTownGame, entity: Entity | FakeEntity, type: MessageType): boolean {
	if (entity.type !== PONY_TYPE)
		return false;
	if (type === MessageType.NPC)
		return false;
	if (entity.fake)
		return true;
	if (!isPublicMessage(type))
		return true;
	if (!isChatInRange(entity as Entity, game.player, game.settings.account.chatlogRange))
		return false;
	return true;
}

function getRoleChatColor(entity: Entity | FakeEntity, type: MessageType): string | undefined {
	const messageColor = (entity as any).messageColor as string | undefined;
	if (messageColor) return messageColor;

	const tag = ((entity as any).tagRole || (entity as any).tag) as string | undefined;
	const matchesTag = type === MessageType.Dev ? !!tag && (tag === 'dev' || tag.indexOf('dev:') === 0)
		: type === MessageType.Admin ? tag === 'admin'
			: type === MessageType.Mod ? tag === 'mod'
				: type === MessageType.Owner ? tag === 'owner'
					: type === MessageType.Builder ? tag === 'builder'
						: type === MessageType.NPC ? tag === 'npc'
								: type === MessageType.Supporter1 ? tag === 'sup1'
									: type === MessageType.Supporter2 ? tag === 'sup2'
										: type === MessageType.Supporter3 ? tag === 'sup3'
											: type === MessageType.Supporter4 ? tag === 'sup4' : false;

	return matchesTag ? (entity as any).tagColor : undefined;
}

function getChatColor(entity: Entity | FakeEntity, type: MessageType): string | undefined {
	if (type === MessageType.Chat) {
		return (entity as any).messageColor || undefined;
	}
	return getRoleChatColor(entity, type);
}

function getRoleChatGradient(entity: Entity | FakeEntity, type: MessageType): { start: string; end: string; direction: 'horizontal' | 'vertical'; } | undefined {
	if ((entity as any).messageColor) return undefined;
	const tag = ((entity as any).tagRole || (entity as any).tag) as string | undefined;
	const matchesTag = type === MessageType.Dev ? !!tag && (tag === 'dev' || tag.indexOf('dev:') === 0)
		: type === MessageType.Admin ? tag === 'admin'
			: type === MessageType.Mod ? tag === 'mod'
				: type === MessageType.Owner ? tag === 'owner'
					: type === MessageType.Builder ? tag === 'builder'
						: type === MessageType.NPC ? tag === 'npc'
							: type === MessageType.Supporter1 ? tag === 'sup1'
								: type === MessageType.Supporter2 ? tag === 'sup2'
									: type === MessageType.Supporter3 ? tag === 'sup3'
										: type === MessageType.Supporter4 ? tag === 'sup4' : false;
	const builtInGradient = getTagGradient(tag);
	const start = (entity as any).tagGradientStart || (builtInGradient && builtInGradient.start);
	const end = (entity as any).tagGradientEnd || (builtInGradient && builtInGradient.end);
	const direction = (entity as any).tagGradientDirection || (builtInGradient && builtInGradient.direction) || 'horizontal';
	return matchesTag && start && end ? { start, end, direction } : undefined;
}

function getChatGradient(entity: Entity | FakeEntity, type: MessageType): { start: string; end: string; direction: 'horizontal' | 'vertical'; } | undefined {
	if ((entity as any).messageColor) return undefined;
	if (type === MessageType.Chat) {
		return undefined;
	}
	return getRoleChatGradient(entity, type);
}

export function handleSay(game: PonyTownGame, entity: Entity | FakeEntity, message: string, type: MessageType) {
	if (message === OPEN_TOY_MODAL_MESSAGE && type === MessageType.System && entity.id !== game.playerId) {
		game.onOpenToyModal.next();
		return;
	}

	if (!shouldShowChatMessage(game, entity, message, type))
		return;

	const typingIndicator = isTypingIndicatorMessage(message);

	if (typingIndicator) {
		if (game.settings.account.showTypingIndicator === false) {
			return;
		}

		const bubbleEntity = isWhisperTo(type) ? game.player : entity;

		if (bubbleEntity && !bubbleEntity.fake && game.map.entitiesById.has(bubbleEntity.id)) {
			const total = typingIndicatorDuration;
			const customColor = getChatColor(entity, type);
			addChatBubble(game.map, bubbleEntity, {
				message, type, total, timer: total, created: Date.now(),
				color: customColor,
			}, getChatBubbleLimit(game.settings.account.chatBubbleLimit));
		}
	} else if (type === MessageType.Dismiss || message === '.') {
		if (!entity.fake && entity.says) {
			dismissSays(entity.says);
		}
	} else {
		const bubbleEntity = isWhisperTo(type) ? game.player : entity;

		if (bubbleEntity && !bubbleEntity.fake && game.map.entitiesById.has(bubbleEntity.id)) {
			const total = getSaysTime(message);
			const customColor = getChatColor(entity, type);
			const gradient = getChatGradient(entity, type);
			addChatBubble(game.map, bubbleEntity, {
				message, type, total, timer: total, created: Date.now(),
				color: customColor,
				gradientStart: gradient && gradient.start,
				gradientEnd: gradient && gradient.end,
				gradientDirection: gradient && gradient.direction,
			}, getChatBubbleLimit(game.settings.account.chatBubbleLimit));
		}

		if (isWhisper(type)) {
			const friend = game.model.friends && game.model.friends.find(f => f.entityId === entity.id);
			game.lastWhisperFrom = { entityId: entity.id, accountId: friend && friend.accountId };
		}

		if (shouldShowChatMessageInChatlog(game, entity, type)) {
			const { id, name = '', crc } = entity;
			const customColor = getChatColor(entity, type);
			const gradient = getChatGradient(entity, type);
			game.messageQueue.push({ id, crc, name, message, type, color: customColor,
				gradient: gradient && `linear-gradient(${gradient.direction === 'vertical' ? 'to bottom' : 'to right'}, #${gradient.start}, #${gradient.end})` });
		}
	}
}

export function handleEntityInfo(game: PonyTownGame, id: number, name: string, crc: number, nameBad: boolean) {
	name = filterEntityName(game, name, nameBad)!;

	for (let i = 0; i < game.incompleteSays.length;) {
		const say = game.incompleteSays[i];

		if (say.id === id) {
			game.incompleteSays.splice(i, 1);
			const entity: FakeEntity = { fake: true, type: PONY_TYPE, id, name, crc };
			handleSay(game, entity, say.message, say.type);
		} else {
			i++;
		}
	}
}

export function subscribeRegion(game: PonyTownGame, data: Uint8Array) {
	const { x, y, updates, tileData } = decodeUpdate(data);
	const region = createRegion(x, y, tileData!);
	const initial = !game.loaded;
	setRegion(game.map, x, y, region);

	for (const update of updates) {
		handleAddEntity(game, region, update, initial);
	}
}

export function filterEntityName({ settings, worldFlags }: PonyTownGame, name: string | undefined, nameBad: boolean) {
	if (name && nameBad && (settings.account.filterSwearWords || hasFlag(worldFlags, WorldStateFlags.Safe))) {
		return repeat('*', name.length);
	} else if (name && containsFilteredWords(name, settings.account.filterWords)) {
		return repeat('?', name.length);
	} else {
		return name;
	}
}

function createEntityOrPony(
	game: PonyTownGame, type: number, id: number, x: number, y: number, options: EntityOrPonyOptions,
	crc: number, name: string | undefined, info: Uint8Array | undefined, state: EntityState
): Entity {
	if (type === PONY_TYPE) {
		const entity = createPonyEntity(game, id, options, name, info ? bitmask(info, PONY_INFO_KEY) : '', state);
		const member = game.party && game.party.members.find(p => p.id === id);
		entity.crc = crc;

		if (member) {
			game.apply(() => member.pony = entity);
		}

		if (isSelected(game, id)) {
			game.select(entity);
		}

		return entity;
	} else {
		const entity = createAnEntity(type, id, x, y, options, game.paletteManager, game);

		entity.state = state;

		if (isFacingRight(entity)) {
			if (entity.collidersBounds) {
				entity.collidersBounds = { ...entity.collidersBounds };
				entity.collidersBounds.x = -entity.collidersBounds.x - entity.collidersBounds.w;
			}
			if (Array.isArray(entity.colliders)) {
				entity.colliders = entity.colliders.map(c => c ? { ...c, x: -c.x - c.w } : c);
			}
		}

		if (options && typeof options === 'object') {
			(entity as any).options = options;
			if ('offsetY' in options) (entity as any).offsetY = (options as any).offsetY;
			if ('entityScale' in options) (entity as any).entityScale = (options as any).entityScale;
			if ('entityOpacity' in options) (entity as any).entityOpacity = (options as any).entityOpacity;
			if ('spriteTint' in options) (entity as any).spriteTint = (options as any).spriteTint;
		}

		if (name) {
			entity.name = name;
		}

		return entity;
	}
}

function updateEntityOptionsInternal(entity: Entity, options: Partial<EntityOrPonyOptions>, game: PonyTownGame) {
	let converted = options as any;

	try {
		if (options && typeof options === 'object') {
			converted = { ...options } as any;

			if ('hold' in converted && typeof converted.hold === 'string') {
				converted.hold = getEntityType(converted.hold) || 0;
			}

			if ('toy' in converted && typeof converted.toy === 'string') {
				converted.toy = getEntityType(converted.toy) || 0;
			}

			if ('inventory' in converted && Array.isArray(converted.inventory)) {
				converted.inventory = converted.inventory.map((e: any) => {
					if (!e) return 0;
					if (typeof e === 'string') return getEntityType(e) || 0;
					if (typeof e === 'object') {
						const t = e.t;
						const c = e.c || 0;
						return { t: (typeof t === 'string' ? getEntityType(t) || 0 : (t || 0)), c };
					}
					return e;
				});
			}
		}
	} catch (e) {
		converted = options as any;
	}

	Object.assign(entity, converted);
	entity.options = Object.assign(entity.options || {}, converted);
	if ('offsetY' in options) entity.offsetY = (options as any).offsetY;
	// Явно применяем серверные свойства света
	if ('lightColor' in options) entity.lightColor = options.lightColor;
	if ('lightSpriteColor' in options) entity.lightSpriteColor = options.lightSpriteColor;
	if ('lightSpriteX' in options) entity.lightSpriteX = options.lightSpriteX;
	if ('lightSpriteY' in options) entity.lightSpriteY = options.lightSpriteY;
	if ('lightScaleAdjust' in options) entity.lightScaleAdjust = options.lightScaleAdjust;

	if (isPony(entity) && ('entityOpacity' in options || 'spriteTint' in options || 'entityScale' in options)) {
		(entity as Pony).discardBatch = true;
	}
	if (isPony(entity) && 'modal' in options && game.selected && game.selected.id === entity.id) {
		(game.selected as any).modal = (options as any).modal;
		game.applyChanges();
	}


	if ('tag' in options && !options.tag) {
		entity.tag = undefined;
	}

	if (isPony(entity) && ('pickableX' in options || 'pickableY' in options)) {
		const holding = entity.ponyState && entity.ponyState.holding;
		if (holding) {
			if ('pickableX' in options && typeof options.pickableX === 'number') {
				holding.pickableX = options.pickableX;
			}
			if ('pickableY' in options && typeof options.pickableY === 'number') {
				holding.pickableY = options.pickableY;
			}
			holding.x = toWorldX(holding.pickableX!);
			holding.y = toWorldY(holding.pickableY!);
		}
	}

	if (isPony(entity) && 'hold' in options) {
		updatePonyHold(entity, game);
	}
}

export function handleUpdateFriends(game: PonyTownGame, friends: FriendStatusData[], removeMissing: boolean) {
	if (!game.model.friends)
		return;

	let currentFriends = game.model.friends;

	for (const { accountId, accountName, status, entityId, name, info, crc, nameBad = false, lastOnline } of friends) {
		let friend = currentFriends.find(f => f.accountId === accountId);
		const previousEntityId = friend && friend.entityId;

		if (hasFlag(status, FriendStatusFlags.Remove)) {
			if (friend) {
				updateFriendFlagForEntity(game, previousEntityId, false);
				removeItem(currentFriends, friend);
			}
		} else {
			if (!friend) {
				friend = {
					accountId,
					accountName: '',
					online: false,
					name: undefined,
					nameBad: false,
					pony: undefined,
					entityId: 0,
					crc: 0,
					ponyInfo: undefined,
					actualName: '',
					lastSeen: undefined,
				};

				const current = currentFriends.slice();
				current.push(friend);
				game.model.friends$.next(current);
				game.model.friends = current;
				currentFriends = current;
			}

			const ensuredFriend = friend;
			if (!ensuredFriend) {
				continue;
			}

			ensuredFriend.online = hasFlag(status, FriendStatusFlags.Online);
			ensuredFriend.hidden = hasFlag(status, FriendStatusFlags.Hidden);

			if (ensuredFriend.online) {
				ensuredFriend.lastSeen = undefined;
			} else if (lastOnline) {
				ensuredFriend.lastSeen = new Date(lastOnline);
			} else if (ensuredFriend.lastSeen === undefined) {
				ensuredFriend.lastSeen = new Date();
			}

			if (accountName !== undefined) {
				ensuredFriend.accountName = accountName;
			}

			if (entityId !== undefined) {
				if (previousEntityId && previousEntityId !== entityId) {
					updateFriendFlagForEntity(game, previousEntityId, false);
				}

				if (game.lastWhisperFrom && game.lastWhisperFrom.accountId === ensuredFriend.accountId) {
					game.lastWhisperFrom.entityId = entityId;
				}

				game.onEntityIdUpdate.next({ old: ensuredFriend.entityId, new: entityId });

				ensuredFriend.entityId = entityId;
			}

			if (name !== undefined) {
				ensuredFriend.name = name;
				ensuredFriend.nameBad = nameBad;
				ensuredFriend.actualName = filterEntityName(game, name, nameBad) || '';
			}

			if (crc !== undefined) {
				ensuredFriend.crc = crc;
			}

			if (info !== undefined) {
				ensuredFriend.pony = info;
				ensuredFriend.ponyInfo = decodePonyInfo(info, mockPaletteManager);
			}

			if (ensuredFriend.entityId && game.whisperTo && game.whisperTo.id === ensuredFriend.entityId) {
				game.whisperTo.name = ensuredFriend.actualName;
				game.whisperTo.crc = ensuredFriend.crc;
			}

			updateFriendFlagForEntity(game, ensuredFriend.entityId, ensuredFriend.online);
		}
	}

	if (removeMissing) {
		for (let i = currentFriends.length - 1; i >= 0; i--) {
			if (!friends.find(f => f.accountId === currentFriends[i].accountId)) {
				currentFriends.splice(i, 1);
			}
		}

		DEVELOPMENT && console.log('Refreshing friend list');
	}

	currentFriends.sort(compareFriends);
	game.model.friends = currentFriends;
	game.model.friends$.next(currentFriends);
	game.apply(() => { });
}
