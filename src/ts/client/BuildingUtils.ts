import {
	Action, MapFlags, MessageType, TileType, houseTiles, editorTiles, MapType,
} from '../common/interfaces';
import { clamp, hasFlag, point, contains } from '../common/utils';
import { pickAnyEntities, pickEntities, getTile } from '../common/worldMap';
import { createAnEntity, getEntityType, getEntityTypeName, hammer, broom, saw, rope, pickaxe, poof, poof2, placeableEntities, shovel, scrap, recolor, season, isRecolorable } from '../common/entities';
import { isOutsideMap } from '../common/collision';
import { Key } from './input/input';
import { toggleWall, editorMoveEntities } from './playerActions';
import { addChatBubble } from '../common/entityUtils';
import { PONY_TYPE } from '../common/constants';
import { getSaysTime } from './clientUtils';

export const toggleWallsTool = saw;
export const removeEntitiesTool = broom;
export const placeEntitiesTool = hammer;
export const changeTileTool = shovel;
export const dragEntityTool = rope;
export const cloneEntityTool = pickaxe;
export const scrapAlignTool = scrap;
export const recolorTool = recolor;
export const seasonTool = season;
export type WallMaterial = 'wood' | 'stone';
export type WallHeight = 'low' | 'high';

let draggingEntityPreview = false;
let draggingEntityId: number | undefined = undefined;
let draggingEntities: any[] = [];
let draggingOffsets = new Map<number, { x: number; y: number; }>();
let draggingCloneMode = false;
let multiDragSelection = new Map<number, any>();
let multiDragPressState: { x: number; y: number; } | undefined;
let multiDragPendingToggleEntityId: number | undefined;
let multiMoveModeEnabled = false;
let multiCloneModeEnabled = false;
let lastMultiDragEmptyClickTime = 0;
let tilePaintDragActive = false;
let tilePaintStart: { x: number; y: number; } | undefined;
let tilePaintCurrent: { x: number; y: number; } | undefined;
let wallPaintDragActive = false;
let wallPaintStart: { x: number; y: number; horizontal: boolean; } | undefined;
let wallPaintCurrent: { x: number; y: number; horizontal: boolean; } | undefined;
let selectedWallMaterial: WallMaterial = 'wood';
let selectedWallMaterialMap: any | undefined;
let selectedWallHeight: WallHeight = 'low';
let selectedWallHeightMap: any | undefined;
const MULTI_DRAG_START_DISTANCE = 0.05;
const MULTI_DRAG_CLEAR_DOUBLE_CLICK_MS = 350;
type EditorMode = 'tile' | 'wall';
let editorMode: EditorMode = 'tile';


function isEditorHammerActive(game: any, player: any) {
	const editorPlayer = player;
	void editorPlayer;
	return !!(BETA && game && game.mod && game.editor && game.editor.useEditorHammer);
}

function isEditorBroomActive(game: any, player: any) {
	const editorPlayer = player;
	void editorPlayer;
	return !!(BETA && game && game.mod && game.editor && game.editor.useEditorBroom);
}

function isEditorRopeActive(game: any, player: any) {
	const editorPlayer = player;
	void editorPlayer;
	return !!(BETA && game && game.mod && game.editor && game.editor.useEditorRope);
}

function isEditorPickaxeActive(game: any, player: any) {
	const editorPlayer = player;
	void editorPlayer;
	return !!(BETA && game && game.mod && game.editor && game.editor.useEditorPickaxe);
}

function isEditorShovelActive(game: any, player: any) {
	const editorPlayer = player;
	void editorPlayer;
	return !!(BETA && game && game.mod && game.editor && game.editor.useEditorShovel);
}

function getSelectedTileType(game: any, player: any) {
	const tileIndex = clamp(game.placeTile || 0, 0, houseTiles.length - 1);
	void player;
	return houseTiles[tileIndex].type;
}

function isRemovableEntity(entity: any) {
	return entity.type !== poof.type && entity.type !== poof2.type;
}

function isEntityAtPoint(entity: any, point: any) {
	const bounds = entity.spriteBounds || entity.interactBounds || entity.bounds;
	return !!bounds && contains(entity.x, entity.y, bounds, point);
}

export function isEditorSawActive(game: any, player: any) {
	const editorPlayer = player;
	void editorPlayer;
	return !!(BETA && game && game.mod && game.editor && game.editor.useEditorSaw);
}

function resolveEditorPreviewType(game: any): number {
	if (!game || !game.editor) {
		return 0;
	}

	const name = game.editor.type;
	const directType = getEntityType(name);

	if (directType > 0) {
		return directType;
	}

	const map = game.editor.entityTypesByName as { [name: string]: number[]; } | undefined;
	const mapped = map && map[name];

	if (Array.isArray(mapped) && mapped.length > 0 && mapped[0] > 0) {
		return mapped[0];
	}

	return 0;
}

function getWallMaterialTileType(material: WallMaterial) {
	return material === 'stone' ? TileType.WallMaterialStone : TileType.WallMaterialWood;
}

function getDefaultWallMaterial(game: any): WallMaterial {
	return game.map && game.map.type === MapType.Cave ? 'stone' : 'wood';
}

function ensureWallMaterialState(game: any) {
	if (selectedWallMaterialMap !== game.map) {
		selectedWallMaterialMap = game.map;
		selectedWallMaterial = getDefaultWallMaterial(game);
	}
}

function ensureWallHeightState(game: any) {
	if (selectedWallHeightMap !== game.map) {
		selectedWallHeightMap = game.map;
		selectedWallHeight = 'low';
	}
}

export function getSelectedWallMaterial(game: any): WallMaterial {
	ensureWallMaterialState(game);
	return selectedWallMaterial;
}

export function getSelectedWallHeight(game: any): WallHeight {
	ensureWallHeightState(game);
	return selectedWallHeight;
}

export function isSelectedWallTall(game: any): boolean {
	return getSelectedWallHeight(game) === 'high';
}

function resetTilePaintDrag() {
	tilePaintDragActive = false;
	tilePaintStart = undefined;
	tilePaintCurrent = undefined;
}

function resetWallPaintDrag() {
	wallPaintDragActive = false;
	wallPaintStart = undefined;
	wallPaintCurrent = undefined;
}

function getWallSegmentFromHover(hover: any) {
	const x = hover.x | 0;
	const y = hover.y | 0;
	const dx = hover.x - x;
	const dy = hover.y - y;

	if (dx > dy) {
		if ((dx + dy) < 1) {
			return { x, y, horizontal: true };
		}

		return { x: x + 1, y, horizontal: false };
	}

	if ((dx + dy) < 1) {
		return { x, y, horizontal: false };
	}

	return { x, y: y + 1, horizontal: true };
}

function resolveWallDragCurrent(
	start: { x: number; y: number; horizontal: boolean; },
	candidate: { x: number; y: number; horizontal: boolean; },
) {
	const dx = Math.abs(candidate.x - start.x);
	const dy = Math.abs(candidate.y - start.y);
	const horizontal = (dx === 0 && dy === 0) ? start.horizontal : (dx >= dy);

	if (horizontal) {
		return { x: candidate.x, y: start.y, horizontal: true };
	}

	return { x: start.x, y: candidate.y, horizontal: false };
}

function tilePaintRect(a: { x: number; y: number; }, b: { x: number; y: number; }) {
	const minX = Math.min(a.x, b.x);
	const minY = Math.min(a.y, b.y);
	const maxX = Math.max(a.x, b.x);
	const maxY = Math.max(a.y, b.y);
	return { minX, minY, maxX, maxY, width: (maxX - minX + 1), height: (maxY - minY + 1) };
}

function getDragModes(player: any, input: any, game?: any) {
	const hold = player.hold;
	const shift = input.isPressed(Key.SHIFT);
	const ctrl = input.isPressed(Key.CTRL);
	const isRope = hold === dragEntityTool.type || !!(BETA && game && game.editor && game.editor.useEditorRope);
	const isScrap = hold === scrapAlignTool.type;
	const isHammer = hold === placeEntitiesTool.type || (!!(BETA && game && game.editor && game.editor.useEditorHammer));
	const isCloneTool = hold === cloneEntityTool.type || !!(BETA && game && game.editor && game.editor.useEditorPickaxe);
	return {
		canDragMove: isRope || (isHammer && shift),
		canDragClone: isCloneTool || (isHammer && ctrl),
		allowMultiDrag: (isRope && multiMoveModeEnabled) || (isCloneTool && multiCloneModeEnabled),
		isRope,
		isScrap,
		isCloneTool,
	};
}

function createDragGhost(entity: any, hover: any) {
	const offset = draggingOffsets.get(entity.id);

	if (!offset) {
		return undefined;
	}

	return {
		...entity,
		x: hover.x - offset.x,
		y: hover.y - offset.y,
		selected: false,
		coverLifting: 0.7,
	};
}

export function getBuildingDragVisualState(game: any) {
	const selectedForMove = Array.from(multiDragSelection.values());
	const draggedEntities = draggingEntityPreview && draggingEntities.length === 1 ? draggingEntities : [];
	const ghostEntities = draggingEntityPreview
		? draggingEntities
			.map(e => createDragGhost(e, game.hover))
			.filter((e: any) => !!e)
		: [];
	const isMultiDragPreview = draggingEntityPreview && draggingEntities.length > 1;
	const isClonePreview = draggingEntityPreview && draggingCloneMode;
	const { canDragClone, allowMultiDrag, isRope, isCloneTool } = getDragModes(game.player, game.input, game);
	const isMultiCloneMode = allowMultiDrag && canDragClone;

	return {
		selectedForMove,
		draggedEntities,
		ghostEntities,
		isMultiDragPreview,
		isClonePreview,
		isDragging: draggingEntityPreview,
		isMultiCloneMode,
		isMultiMoveMode: isRope && multiMoveModeEnabled,
		isMultiCloneToolMode: isCloneTool && multiCloneModeEnabled,
	};
}

if (typeof window !== 'undefined') {
	window.addEventListener('keydown', (e) => {
		if (e.code === 'KeyT' && !e.repeat) {
			editorMode = editorMode === 'tile' ? 'wall' : 'tile';
			console.log('[EditorMode]', editorMode);
		}
	});
}

export function updateWallPlaceholder(game: any, player: any) {
	const editorSaw = isEditorSawActive(game, player);
	const wallPreview = (player.hold === toggleWallsTool.type || editorSaw) &&
		(hasFlag(game.map.flags, MapFlags.EditableWalls) || editorSaw);
	const tilePreview = player.hold === changeTileTool.type && (hasFlag(game.map.flags, MapFlags.EditableTiles) || isEditorShovelActive(game, player));
	game.showWallPlaceholder = wallPreview || tilePreview;
}

export function updateBuildingPreviews(game: any, player: any, hover: any, server: any, input: any) {

	if (((player.hold === toggleWallsTool.type && hasFlag(game.map.flags, MapFlags.EditableWalls)) || isEditorSawActive(game, player)) && input.wasPressed(Key.SPACE)) {
		ensureWallHeightState(game);
		selectedWallHeight = selectedWallHeight === 'high' ? 'low' : 'high';
		const wallHeightName = selectedWallHeight === 'high' ? 'High wall' : 'Low wall';
		const total = getSaysTime(wallHeightName);
		addChatBubble(game.map, game.player, { message: wallHeightName, type: MessageType.System, total, timer: total, created: Date.now() });
	}

	if (hasFlag(game.map.flags, MapFlags.EditableEntities) || player.hold === scrapAlignTool.type || player.hold === recolorTool.type || player.hold === seasonTool.type || isEditorHammerActive(game, player) || isEditorBroomActive(game, player) || isEditorRopeActive(game, player) || isEditorPickaxeActive(game, player)) {
		if (isEditorBroomActive(game, player)) {
			game.highlightEntity = pickAnyEntities(game.map, hover).find(entity => entity.type !== PONY_TYPE && isRemovableEntity(entity));
			return;
		}
		const editorDragTool = isEditorRopeActive(game, player) || isEditorPickaxeActive(game, player);
			   if (player.hold === removeEntitiesTool.type || player.hold === dragEntityTool.type) {
				   game.highlightEntity = pickEntities(game.map, hover, true, false, true).find(isRemovableEntity);
			   } else if (player.hold === scrapAlignTool.type) {
				   game.highlightEntity = game.map.entities
					   .filter((e: any) => e.type !== PONY_TYPE && isRemovableEntity(e) && isEntityAtPoint(e, hover))
					   .reverse()[0];
			   } else if (player.hold === recolorTool.type) {
				   game.highlightEntity = game.map.entities
					   .filter((e: any) => e.type !== PONY_TYPE && isRemovableEntity(e) && isRecolorable(e.type) && isEntityAtPoint(e, hover))
					   .reverse()[0];
			   } else if (player.hold === seasonTool.type) {
				   game.highlightEntity = game.map.entities
					   .filter((e: any) => e.type !== PONY_TYPE && isRemovableEntity(e) && (e as any).isSeasonal && isEntityAtPoint(e, hover))
					   .reverse()[0];
			   } else if (player.hold === cloneEntityTool.type || editorDragTool) {
				   game.highlightEntity = pickAnyEntities(game.map, hover).find(entity => entity.type !== PONY_TYPE && isRemovableEntity(entity));
		} else if (player.hold === placeEntitiesTool.type || isEditorHammerActive(game, player)) {
			if (isEditorHammerActive(game, player)) {
				if (!isOutsideMap(hover.x, hover.y, game.map)) {
					const type = resolveEditorPreviewType(game);

					if (type > 0) {
						game.highlightEntity = createAnEntity(type, 0, hover.x, hover.y, {}, game.paletteManager, game);

						if (game.highlightEntity) {
							game.highlightEntity.coverLifting = 0.7;
						}
					} else {
						game.highlightEntity = undefined;
					}
				} else {
					game.highlightEntity = undefined;
				}

				return;
			}

			const { canDragMove, canDragClone } = getDragModes(player, input, game);
			if (canDragMove || canDragClone) {
				game.highlightEntity = pickEntities(game.map, hover, true, false, true)[0];
				void server;
				return;
			}

			if (!isOutsideMap(hover.x, hover.y, game.map)) {
				const { type } = placeableEntities[game.placeEntity];
				let { x, y } = hover;

				if (game.map.editableArea) {
					x = clamp(x, game.map.editableArea.x, game.map.editableArea.x + game.map.editableArea.w);
					y = clamp(y, game.map.editableArea.y, game.map.editableArea.y + game.map.editableArea.h);
				}

				game.highlightEntity = createAnEntity(type, 0, x, y, {}, game.paletteManager, game);
				if (game.highlightEntity) {
					game.highlightEntity.coverLifting = 0.7;
				}
			}
		}
	}

	void server;
}

export function handleDragTool(game: any, player: any, hover: any, input: any): boolean {
	if (!hasFlag(game.map.flags, MapFlags.EditableEntities) && !isEditorHammerActive(game, player) && !isEditorRopeActive(game, player) && !isEditorPickaxeActive(game, player)) {
		return false;
	}
	const editorDragMode = isEditorRopeActive(game, player) || isEditorPickaxeActive(game, player);

	const { canDragMove, canDragClone, allowMultiDrag, isRope, isCloneTool } = getDragModes(player, input, game);

	if (!draggingEntityPreview && input.wasPressed(Key.SHIFT)) {
		if (isRope) {
			multiMoveModeEnabled = !multiMoveModeEnabled;
			const message = multiMoveModeEnabled
				? 'Multi object move mode enabled'
				: 'Multi object move mode disabled';
			const total = getSaysTime(message);
			addChatBubble(game.map, game.player, { message, type: MessageType.System, total, timer: total, created: Date.now() });
		} else if (isCloneTool) {
			multiCloneModeEnabled = !multiCloneModeEnabled;
			const message = multiCloneModeEnabled
				? 'Multi object clone mode enabled'
				: 'Multi object clone mode disabled';
			const total = getSaysTime(message);
			addChatBubble(game.map, game.player, { message, type: MessageType.System, total, timer: total, created: Date.now() });
		}
	}

	if (!(canDragMove || canDragClone)) {
		multiDragPressState = undefined;
		return false;
	}

	if (input.wasPressed(Key.MOUSE_BUTTON1)) {
		let picked: any[];
		if (editorDragMode) {
			picked = pickAnyEntities(game.map, hover).filter(entity => entity.type !== PONY_TYPE && isRemovableEntity(entity));
		} else {
			picked = pickEntities(game.map, hover, true, false, true).filter(isRemovableEntity);
		}
		if (allowMultiDrag) {
			if (picked.length) {
				const pickedEntity = picked[0];
				if (multiDragSelection.has(pickedEntity.id)) {
					// Delay deselect until release to distinguish click from drag start.
					multiDragPendingToggleEntityId = pickedEntity.id;
					multiDragPressState = point(hover.x, hover.y);
				} else {
					multiDragSelection.set(pickedEntity.id, pickedEntity);
					multiDragPendingToggleEntityId = undefined;
					multiDragPressState = point(hover.x, hover.y);
				}
				lastMultiDragEmptyClickTime = 0;
			} else {
				multiDragPressState = undefined;
				multiDragPendingToggleEntityId = undefined;
				const now = performance.now();
				const isDoubleEmptyClick = lastMultiDragEmptyClickTime > 0 && (now - lastMultiDragEmptyClickTime) < MULTI_DRAG_CLEAR_DOUBLE_CLICK_MS;

				if (isDoubleEmptyClick) {
					if (multiDragSelection.size > 0) {
						multiDragSelection.clear();
						const message = 'Multi object selection cleared';
						const total = getSaysTime(message);
						addChatBubble(game.map, game.player, { message, type: MessageType.System, total, timer: total, created: Date.now() });
					}
					lastMultiDragEmptyClickTime = 0;
				} else {
					lastMultiDragEmptyClickTime = now;
				}
			}
		} else if (picked.length) {
			const selected = [picked[0]];
			draggingEntityPreview = true;
			draggingEntityId = selected[0].id;
			draggingEntities = selected;
			draggingCloneMode = canDragClone;
			draggingOffsets = new Map<number, { x: number; y: number; }>();

			for (const entity of selected) {
				draggingOffsets.set(entity.id, point(hover.x - entity.x, hover.y - entity.y));
			}
		}
	}

	if (allowMultiDrag && !draggingEntityPreview && multiDragPressState && input.isPressed(Key.MOUSE_BUTTON1)) {
		const dx = Math.abs(hover.x - multiDragPressState.x);
		const dy = Math.abs(hover.y - multiDragPressState.y);

		if (dx + dy >= MULTI_DRAG_START_DISTANCE && multiDragSelection.size) {
			multiDragPendingToggleEntityId = undefined;
			const selected = Array.from(multiDragSelection.values());
			void editorDragMode;
			draggingEntityPreview = true;
			draggingEntityId = selected[0].id;
			draggingEntities = selected;
			draggingCloneMode = canDragClone;
			draggingOffsets = new Map<number, { x: number; y: number; }>();

			for (const entity of selected) {
				draggingOffsets.set(entity.id, point(hover.x - entity.x, hover.y - entity.y));
			}

			multiDragPressState = undefined;
		}
	}

	if (draggingEntityPreview && !input.isPressed(Key.MOUSE_BUTTON1)) {
		draggingEntityPreview = false;
		if (draggingEntityId !== undefined && draggingEntities.length) {
			const editorHammer = isEditorHammerActive(game, player);

			if (draggingCloneMode) {
				for (const ent of draggingEntities) {
					const offset = draggingOffsets.get(ent.id);
					if (!offset) {
						continue;
					}

					let x = hover.x - offset.x;
					let y = hover.y - offset.y;

					   if (editorHammer) {
						   const entityName = getEntityTypeName(ent.type);
						   if (ent.type !== PONY_TYPE && entityName) {
							   game.send((s: any) => s.editorAction({ type: 'place', entity: entityName, x, y }));
						   } else {
							   const message = 'Этот объект нельзя скопировать';
							   const total = getSaysTime(message);
							   addChatBubble(game.map, game.player, { message, type: MessageType.System, total, timer: total, created: Date.now() });
						   }
					   } else {
						   game.send((s: any) => s.actionParam(Action.PlaceEntity, { x, y, type: ent.type }));
					   }
				}
			} else {
				const entities = draggingEntities.map((ent: any) => {
					const offset = draggingOffsets.get(ent.id)!;
					const x = hover.x - offset.x;
					const y = hover.y - offset.y;

					return { id: ent.id, x, y };
				});

				if (editorHammer) {
					game.send((s: any) => s.editorAction({
						type: 'move',
						entities,
					}));
				} else {
					game.send((s: any) => s.editorAction({
						type: 'move',
						entities,
					}));
				}
			}
			draggingEntityId = undefined;
			draggingEntities = [];
			draggingOffsets.clear();
			draggingCloneMode = false;
			multiDragPressState = undefined;
			multiDragPendingToggleEntityId = undefined;
		}
	} else if (!input.isPressed(Key.MOUSE_BUTTON1) && multiDragPressState) {
		if (allowMultiDrag && multiDragPendingToggleEntityId !== undefined) {
			multiDragSelection.delete(multiDragPendingToggleEntityId);
		}
		multiDragPendingToggleEntityId = undefined;
		multiDragPressState = undefined;
	}

	if (draggingEntityPreview && draggingEntities.length) {
		void game;
	}

	return true;
}

export function handleBuildingActionClick(game: any, player: any, hover: any, server: any, holdingRemoveTool: boolean, holdingPlaceTool: boolean, editableMap: boolean) {
	if (!(
		(BETA && game.editor.tile !== -1 && !isEditorShovelActive(game, player)) ||
		(player.hold === changeTileTool.type && (hasFlag(game.map.flags, MapFlags.EditableTiles) || isEditorShovelActive(game, player))) ||
		(player.hold === toggleWallsTool.type && hasFlag(game.map.flags, MapFlags.EditableWalls)) ||
		(player.hold === scrapAlignTool.type) ||
		(player.hold === recolorTool.type) ||
		(player.hold === seasonTool.type) ||
		isEditorSawActive(game, player) ||
		holdingRemoveTool || holdingPlaceTool
	)) {
		return false;
	}

	const nowClick = performance.now();
	game.lastEyeClickTime = nowClick;

	if (BETA && game.editor.tile !== -1 && !isEditorShovelActive(game, player)) {
		if (game.editor.brushSize > 1) {
			const x = Math.floor((hover.x - (game.editor.brushSize / 2)));
			const y = Math.floor((hover.y - (game.editor.brushSize / 2)));
			server.editorAction({ type: 'tile', x, y, tile: game.editor.tile, size: game.editor.brushSize });
		} else {
			const x = hover.x | 0;
			const y = hover.y | 0;
			const type = game.editor.tile === getTile(game.map, hover.x, hover.y) ? TileType.Dirt : game.editor.tile;
			server.changeTile(x, y, type);
		}
	} else if (player.hold === changeTileTool.type && (hasFlag(game.map.flags, MapFlags.EditableTiles) || isEditorShovelActive(game, player))) {
		const x = hover.x | 0;
		const y = hover.y | 0;
		server.changeTile(x, y, getSelectedTileType(game, player));
	} else if (player.hold === scrapAlignTool.type && game.highlightEntity) {
		const id = game.highlightEntity.id;
		if (game.highlightEntity.type !== PONY_TYPE && game.highlightEntity.type !== toggleWallsTool.type) {
			game.send((s: any) => s.editorAction({ type: 'mirror', entities: [id] }));
		}
	} else if (player.hold === recolorTool.type && game.highlightEntity) {
		const id = game.highlightEntity.id;
		if (game.highlightEntity.type !== PONY_TYPE) {
			game.send((s: any) => s.editorAction({ type: 'recolor', entities: [id] }));
		}
	} else if (player.hold === seasonTool.type && game.highlightEntity) {
		const id = game.highlightEntity.id;
		if (game.highlightEntity.type !== PONY_TYPE) {
			game.send((s: any) => s.editorAction({ type: 'season', entities: [id] }));
		}
	} else if ((player.hold === toggleWallsTool.type && hasFlag(game.map.flags, MapFlags.EditableWalls)) || isEditorSawActive(game, player)) {
		toggleWall(game, hover, isSelectedWallTall(game));
	} else if (isEditorSawActive(game, player)) {
		toggleWall(game, hover, isSelectedWallTall(game));
	} else if (holdingRemoveTool && game.highlightEntity && editableMap) {
		const id = game.highlightEntity.id;
		game.send((s: any) => s.actionParam(Action.RemoveEntity, id));
	} else if (holdingPlaceTool && editableMap) {
		if (isEditorHammerActive(game, player)) {
			game.send((s: any) => s.editorAction({ type: 'place', entity: game.editor.type, x: hover.x, y: hover.y }));
		} else if (game.highlightEntity) {
			const { x, y, type } = game.highlightEntity;
			game.send((s: any) => s.actionParam(Action.PlaceEntity, { x, y, type }));
		}
	}

	return true;
}

export function handleEditorBroomClick(game: any, hover: any): boolean {
	if (!game.highlightEntity) {
		return false;
	}

	const target = game.highlightEntity;
	if (!isRemovableEntity(target)) {
		return false;
	}
	const id = target.id;

	game.send((s: any) => s.editorAction({ type: 'remove', entities: [id] }));
	void hover;
	return true;
}

export function handleTilePaintDrag(game: any, player: any, hover: any, server: any, input: any) {
	const canPaintTiles = player.hold === changeTileTool.type && (hasFlag(game.map.flags, MapFlags.EditableTiles) || isEditorShovelActive(game, player));

	if (!canPaintTiles) {
		resetTilePaintDrag();
		return false;
	}

	const mouseDown = input.isPressed(Key.MOUSE_BUTTON1) || input.isPressed(Key.TOUCH);
	const x = clamp(hover.x | 0, 0, game.map.width - 1);
	const y = clamp(hover.y | 0, 0, game.map.height - 1);

	if (mouseDown) {
		if (!tilePaintDragActive) {
			tilePaintDragActive = true;
			tilePaintStart = point(x, y);
			tilePaintCurrent = point(x, y);
		} else {
			tilePaintCurrent = point(x, y);
		}

		return true;
	}

	if (!tilePaintDragActive || !tilePaintStart || !tilePaintCurrent) {
		return false;
	}

	const rect = tilePaintRect(tilePaintStart, tilePaintCurrent);
	const targetType = getSelectedTileType(game, player);

	for (let ty = rect.minY; ty <= rect.maxY; ty++) {
		for (let tx = rect.minX; tx <= rect.maxX; tx++) {
			if (getTile(game.map, tx, ty) !== targetType) {
				server.changeTile(tx, ty, targetType);
			}
		}
	}

	resetTilePaintDrag();
	return true;
}

export function handleWallPaintDrag(game: any, player: any, hover: any, server: any, input: any) {
	const canPaintWalls = (player.hold === toggleWallsTool.type && hasFlag(game.map.flags, MapFlags.EditableWalls)) || isEditorSawActive(game, player);

	if (!canPaintWalls) {
		resetWallPaintDrag();
		return false;
	}

	const mouseDown = input.isPressed(Key.MOUSE_BUTTON1) || input.isPressed(Key.TOUCH);
	const wallSegment = getWallSegmentFromHover(hover);

	if (mouseDown) {
		if (!wallPaintDragActive) {
			wallPaintDragActive = true;
			wallPaintStart = wallSegment;
			wallPaintCurrent = wallSegment;
		} else if (wallPaintStart) {
			wallPaintCurrent = resolveWallDragCurrent(wallPaintStart, wallSegment);
		}

		return true;
	}

	if (!wallPaintDragActive || !wallPaintStart || !wallPaintCurrent) {
		return false;
	}

	const tall = isSelectedWallTall(game);
	const wallType = wallPaintCurrent.horizontal
		? (tall ? TileType.WallHTall : TileType.WallH)
		: (tall ? TileType.WallVTall : TileType.WallV);

	if (wallPaintCurrent.horizontal) {
		const minX = Math.min(wallPaintStart.x, wallPaintCurrent.x);
		const maxX = Math.max(wallPaintStart.x, wallPaintCurrent.x);
		const y = wallPaintStart.y;

		for (let x = minX; x <= maxX; x++) {
			server.changeTile(x, y, wallType);
		}
	} else {
		const minY = Math.min(wallPaintStart.y, wallPaintCurrent.y);
		const maxY = Math.max(wallPaintStart.y, wallPaintCurrent.y);
		const x = wallPaintStart.x;

		for (let y = minY; y <= maxY; y++) {
			server.changeTile(x, y, wallType);
		}
	}

	resetWallPaintDrag();
	return true;
}

export function getTilePaintPreviewState(game: any, hover: any) {
	if (!(game && game.map)) {
		return undefined;
	}

	const hx = clamp(hover.x | 0, 0, game.map.width - 1);
	const hy = clamp(hover.y | 0, 0, game.map.height - 1);
	const start = tilePaintDragActive && tilePaintStart ? tilePaintStart : point(hx, hy);
	const current = tilePaintDragActive && tilePaintCurrent ? tilePaintCurrent : point(hx, hy);
	const rect = tilePaintRect(start, current);

	return {
		active: tilePaintDragActive,
		start,
		current,
		...rect,
	};
}

export function getWallPaintPreviewState(game: any, hover: any) {
	if (!(game && game.map)) {
		return undefined;
	}

	const currentSegment = getWallSegmentFromHover(hover);
	const start = wallPaintDragActive && wallPaintStart ? wallPaintStart : currentSegment;
	const current = wallPaintDragActive && wallPaintCurrent ? wallPaintCurrent : resolveWallDragCurrent(start, currentSegment);

	if (current.horizontal) {
		const min = Math.min(start.x, current.x);
		const max = Math.max(start.x, current.x);
		return {
			active: wallPaintDragActive,
			horizontal: true,
			start,
			current,
			min,
			max,
		};
	}

	const min = Math.min(start.y, current.y);
	const max = Math.max(start.y, current.y);
	return {
		active: wallPaintDragActive,
		horizontal: false,
		start,
		current,
		min,
		max,
	};
}

export function handleBuildingRightClick(game: any, hover: any, input: any) {
	if (BETA && input.wasPressed(Key.MOUSE_BUTTON2)) {
		if (game.editor.selectingEntities) {
			editorMoveEntities(game, hover);
		} else if (game.mod) {
			if (editorMode === 'wall') {
				toggleWall(game, hover, isSelectedWallTall(game));
			} else if (editorMode === 'tile') {
				if (game.editor.tile !== -1) {
					if (game.editor.brushSize > 1) {
						const x = Math.floor((hover.x - (game.editor.brushSize / 2)));
						const y = Math.floor((hover.y - (game.editor.brushSize / 2)));
						game.socket.server.editorAction({ type: 'tile', x, y, tile: game.editor.tile, size: game.editor.brushSize });
					} else {
						const x = hover.x | 0;
						const y = hover.y | 0;
						const type = game.editor.tile === getTile(game.map, hover.x, hover.y) ? TileType.Dirt : game.editor.tile;
						game.socket.server.changeTile(x, y, type);
					}
				}
			}
		}
	}
}

export function handleBuildingWheel(game: any, input: any) {
	if (!(game.player && input.wheelY)) {
		return;
	}

	if (input.isPressed(Key.SHIFT)) {
		if (hasFlag(game.map.flags, MapFlags.EditableEntities) || game.mod) {
			const action = input.wheelY < 0 ? Action.SwitchTool : Action.SwitchToolRev;
			game.send((server: any) => server.action(action));
		}
		return;
	}

	if (game.player.hold === scrapAlignTool.type) {
		return;
	}

	if (game.player.hold === placeEntitiesTool.type) {
		if (isEditorHammerActive(game, game.player)) {
			changeEditorHammerEntity(game, input.wheelY < 0);
		} else {
			changePlaceEntity(game, input.wheelY < 0);
		}
	} else if (game.player.hold === changeTileTool.type) {
		// Передаём editorBox для синхронизации (доступна через game.editorBox)
		changePlaceTile(game, input.wheelY < 0, (game as any).editorBox);
	} else if ((game.player.hold === toggleWallsTool.type && hasFlag(game.map.flags, MapFlags.EditableWalls)) || isEditorSawActive(game, game.player)) {
		changeWallMaterial(game, input.wheelY < 0);
	}
}

function changeEditorHammerEntity(game: any, reverse: boolean) {
	const names = (game.editor && Array.isArray(game.editor.entityNames) ? game.editor.entityNames : [])
		.filter((n: any) => typeof n === 'string' && n.length > 0);

	if (!names.length) {
		return;
	}

	const current = game.editor.type;
	let index = names.indexOf(current);

	if (index === -1) {
		index = 0;
	}

	if (reverse) {
		index = index === 0 ? (names.length - 1) : (index - 1);
	} else {
		index = (index + 1) % names.length;
	}

	game.editor.type = names[index];
	const total = getSaysTime(game.editor.type);
	addChatBubble(game.map, game.player, { message: game.editor.type, type: MessageType.System, total, timer: total, created: Date.now() });
}

export function changePlaceEntity(game: any, reverse: boolean) {
	if (reverse) {
		game.placeEntity = game.placeEntity === 0 ? (placeableEntities.length - 1) : (game.placeEntity - 1);
	} else {
		game.placeEntity = (game.placeEntity + 1) % placeableEntities.length;
	}

	const { name } = placeableEntities[game.placeEntity];
	const total = getSaysTime(name);
	addChatBubble(game.map, game.player, { message: name, type: MessageType.System, total, timer: total, created: Date.now() });
}

export function changePlaceTile(game: any, reverse: boolean, editorBox?: any) {
	if (reverse) {
		game.placeTile = game.placeTile === 0 ? (houseTiles.length - 1) : (game.placeTile - 1);
	} else {
		game.placeTile = (game.placeTile + 1) % houseTiles.length;
	}

	const { name, type } = houseTiles[game.placeTile];

	if (isEditorShovelActive(game, game.player)) {
		// Находим соответствующий тайл в editorTiles по типу
		const editorTileIndex = editorTiles.findIndex(t => t.type === type);
		if (editorTileIndex >= 0) {
			// Обновляем editor.tile через editorBox для синхронизации
			if (editorBox && typeof editorBox.editorTile === 'number') {
				// Устанавливаем индекс в editorTiles — сеттер обновит placeTile
				editorBox.editorTile = editorTileIndex;
			} else {
				// Fallback: присваиваем TileType напрямую
				game.editor.tile = type;
			}
		} else {
			// Fallback: просто используем тип из houseTiles
			game.editor.tile = type;
		}
	}

	const total = getSaysTime(name);
	addChatBubble(game.map, game.player, { message: name, type: MessageType.System, total, timer: total, created: Date.now() });
}

export function changeWallMaterial(game: any, reverse: boolean) {
	ensureWallMaterialState(game);
	const materials: WallMaterial[] = ['wood', 'stone'];
	const currentIndex = materials.indexOf(selectedWallMaterial);
	const safeIndex = currentIndex >= 0 ? currentIndex : 0;
	const nextIndex = reverse
		? (safeIndex === 0 ? (materials.length - 1) : (safeIndex - 1))
		: ((safeIndex + 1) % materials.length);
	selectedWallMaterial = materials[nextIndex];
	selectedWallMaterialMap = game.map;
	game.send((server: any) => server.changeTile(0, 0, getWallMaterialTileType(selectedWallMaterial)));

	const name = selectedWallMaterial === 'stone' ? 'Stone walls' : 'Wood walls';
	const total = getSaysTime(name);
	addChatBubble(game.map, game.player, { message: name, type: MessageType.System, total, timer: total, created: Date.now() });
}

export function resetBuildingTransientState(game: any) {
	resetTilePaintDrag();
	resetWallPaintDrag();
	void game;
}
