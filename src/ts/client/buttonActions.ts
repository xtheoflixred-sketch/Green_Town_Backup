import { compact } from 'lodash';
import {
	Expression, ExpressionButtonAction, CommandButtonAction, ActionButtonAction, ItemButtonAction,
	ColorShadow, Eye, Muzzle, Iris, ButtonActionSlot, ExpressionExtra, ButtonAction, ChatType, MessageType, BodyAnimation, EntityFlags,
	Action, isPartyChat, EntityButtonAction, defaultDrawOptions, HeadAnimationProperties, EntityState, NoDraw, MapFlags
} from '../common/interfaces';
import * as sprites from '../generated/sprites';
import { createExpression, getSaysTime } from './clientUtils';
import { encodeExpression, decodeExpression } from '../common/encoders/expressionEncoder';
import { PonyTownGame } from './game';
import { boopAction, dance1Action, upAction, downAction, turnHeadAction, interact, getInteractTarget } from './playerActions';
import { ACTIONS_LIMIT, COMMAND_ACTION_TIME_DELAY } from '../common/constants';
import { cloneDeep, hasFlag, toInt } from '../common/utils';
import { boop, defaultHeadFrame, stand, sneeze, yawn, lie, sit, fly, laugh, kiss, excite, dance1, trot } from './ponyAnimations';
import { createDefaultPony, syncLockedPonyInfo, toPalette, mockPaletteManager } from '../common/ponyInfo';
import { isFacingRight } from '../common/entityUtils';
import {
	ACTION_EXPRESSION_EYE_COLOR, ACTION_EXPRESSION_BG, ACTION_ACTION_COAT_COLOR, WHITE, HEARTS_COLOR,
	ACTION_COMMAND_BG, BLACK, ACTION_ACTION_BG, ACTION_ITEM_BG, blushColor, TRANSPARENT
} from '../common/colors';
import { resizeCanvasWithRatio, getPixelRatio, disableImageSmoothing } from './canvasUtils';
import { drawCanvas, ContextSpriteBatch } from '../graphics/contextSpriteBatch';
import { defaultPonyState, defaultDrawPonyOptions } from './ponyHelpers';
import { drawHead, drawPony } from './ponyDraw';
import { parseColor, toGrayscale, colorToHexRGB } from '../common/color';
import { rect, addRects, centerPoint } from '../common/rect';
import { drawTextAligned, HAlign, VAlign } from '../graphics/spriteFont';
import { fontPal } from '../client/fonts';
import { isPonyLying, isPonySitting, isPonyStanding, isPonyFlying, canBoop } from '../common/entityUtils';
import { canPonyFly } from '../common/pony';
import { apple2, banana, gift2, createAnEntity, getEntityType, hammer, shovel } from '../common/entities';
import { addChatBubble } from '../common/entityUtils';
import { fakePaletteManager } from '../common/mixins';
import { spriteSheetsLoaded } from './spriteUtils';
import { getEntityTypesFromName } from '../components/services/model';
import { toWorldY, toWorldX } from '../common/positionUtils';
import { changeWallHeight, changeWallMaterial, setWallHeight } from './BuildingUtils';
import { faUndo, faRedo, faHome, faDownload, faSave, faTimes, faSync } from './icons';

const CANVAS_SIZE = 29;
const ICON_SIZE = 16;

const LARGE_ENTITY_PREVIEW_SCALE: { [name: string]: number; } = {
	fullBoat: 0.9,
	fullGreenBoat: 0.9,
	fullBench: 0.95,
	fullBenchHigh: 0.9,
	fullBenchHighRight: 0.9,
	tree: 0.9,
	tree4: 0.95,
	tree5: 0.9,
	pine: 0.88,
	pine3: 0.95,
	pine4: 0.9,
	pine5: 0.88,
};

const headX = -26;
const headY = -30;
const headlessBoopFrame = { ...cloneDeep(boop.frames[7]), head: 0 };
const headlessBoop: BodyAnimation = { name: '', loop: false, fps: 1, frames: [headlessBoopFrame], disableHeadTurnFrames: 0 };

function createPony(coatColor: string, wings = false, horn = false) {
	const info = createDefaultPony();
	info.coatFill = coatColor;
	info.mane!.type = 0;
	info.backMane!.type = 0;
	info.tail!.type = 0;
	info.eyeColorRight = ACTION_EXPRESSION_EYE_COLOR;

	if (wings) {
		info.wings!.type = 1;
	}

	if (horn) {
		info.horn!.type = 1;
	}

	syncLockedPonyInfo(info);
	return toPalette(info, mockPaletteManager);
}

function createState() {
	const state = defaultPonyState();
	state.blushColor = blushColor(parseColor(ACTION_ACTION_COAT_COLOR));
	return state;
}

function colorToGrayscale(value: string) {
	return colorToHexRGB(toGrayscale(parseColor(value)));
}

const ACTION_ACTION_BG_DISABLED = toGrayscale(parseColor(ACTION_ACTION_BG));
const expressionPony = createPony(ACTION_EXPRESSION_BG);
const actionPony = createPony(ACTION_ACTION_COAT_COLOR);
const actionPonyWithHorn = createPony(ACTION_ACTION_COAT_COLOR, false, true);
const actionPonyWithWings = createPony(ACTION_ACTION_COAT_COLOR, true);
const actionPonyDisabled = createPony(colorToGrayscale(ACTION_ACTION_COAT_COLOR));
const actionPonyWithWingsDisabled = createPony(colorToGrayscale(ACTION_ACTION_COAT_COLOR), true);
const defaultPalette = mockPaletteManager.addArray(sprites.defaultPalette);
export const actionExpressionDefaultPalette = mockPaletteManager.add(Array.from(sprites.defaultPalette));
expressionPony.defaultPalette = actionExpressionDefaultPalette;
expressionPony.defaultPalette.colors[4] = 0xe16200ff; // tongue color

export function expressionButtonAction(expression: Expression | undefined): ExpressionButtonAction {
	return { type: 'expression', expression, title: expression ? '' : 'Reset expression' };
}

export function commandButtonAction(command: string, icon: string): CommandButtonAction {
	return { type: 'command', command, title: command, icon };
}

export function actionButtonAction(action: string, title: string, sendAction = Action.None, icon?: any, secondaryIcon?: any): ActionButtonAction {
	return { type: 'action', action, title, sendAction, icon, secondaryIcon };
}

export function itemButtonAction(icon: ColorShadow, count?: number): ItemButtonAction {
	return { type: 'item', icon, count };
}

export function entityButtonAction(entity: string): EntityButtonAction {
	return { type: 'entity', entity, title: entity };
}

const emoteActions = [
	actionButtonAction('sneeze', 'Sneeze', Action.Sneeze),
	actionButtonAction('sleep', 'Sleep', Action.Sleep),
	actionButtonAction('yawn', 'Yawn', Action.Yawn),
	actionButtonAction('love', 'Love', Action.Love),
	actionButtonAction('laugh', 'Laugh', Action.Laugh),
	actionButtonAction('excite', 'Excite', Action.Excite),
	actionButtonAction('blush', 'Blush', Action.Blush),
	actionButtonAction('kiss', 'Kiss', Action.Kiss),
];

const bodyActions = [
	actionButtonAction('boop', 'Boop'),
	actionButtonAction('down', 'Sit down / Land'),
	actionButtonAction('up', 'Stand up / Fly up'),
	actionButtonAction('turn-head', 'Turn head'),
	actionButtonAction('magic', 'Magic', Action.Magic),
	actionButtonAction('zoom-out', 'Zoom out'),
	actionButtonAction('zoom-in', 'Zoom in'),
	actionButtonAction('drop-toy', 'Drop toy', Action.DropToy),
	actionButtonAction('drop', 'Drop item', Action.Drop),
	actionButtonAction('hold-right', 'Right'),
	actionButtonAction('hold-left', 'Left'),
	actionButtonAction('hold-down', 'Down'),
	actionButtonAction('hold-up', 'Up'),
	actionButtonAction('speed-up', 'Speed up'),
	actionButtonAction('speed-down', 'Speed down'),
	actionButtonAction('no-clip', 'No clip'),
	actionButtonAction('players', 'Players'),
	actionButtonAction('maps', 'Maps'),
	actionButtonAction('map', 'Map info'),
	actionButtonAction('interact', 'Interact'),
	actionButtonAction('open', 'Open gift'),
	actionButtonAction('open-own-profile', 'Open own profile'),
	actionButtonAction('dance-1', 'Dance 1'),
];

const buildingToolActions = [
	actionButtonAction('switch-tool', 'Switch tool', Action.SwitchTool),
	actionButtonAction('switch-entity', 'Next item to place'),
	actionButtonAction('switch-entity-rev', 'Previous item to place'),
	actionButtonAction('switch-tile', 'Next tile to place'),
	actionButtonAction('tile-next', 'Next editor tile'),
	actionButtonAction('tile-prev', 'Previous editor tile'),
	actionButtonAction('wall-next', 'Next wall material'),
	actionButtonAction('wall-prev', 'Previous wall material'),
	actionButtonAction('wall-height', 'Toggle wall height'),
	actionButtonAction('wall-high', 'Make wall high'),
	actionButtonAction('editor-hammer', 'Editor hammer', Action.SwitchToPlaceTool),
	actionButtonAction('editor-shovel', 'Editor shovel', Action.SwitchToTileTool),
	actionButtonAction('editor-broom', 'Editor broom', Action.SwitchToBroomTool),
	actionButtonAction('editor-rope', 'Editor rope', Action.SwitchToRopeTool),
	actionButtonAction('editor-pickaxe', 'Editor pickaxe', Action.SwitchToPickaxeTool),
	actionButtonAction('editor-wrench', 'Editor wrench', Action.SwitchToWrenchTool),
	actionButtonAction('editor-saw', 'Editor saw', Action.SwitchToSawTool),
	actionButtonAction('editor-scrap', 'Editor scrap', Action.SwitchToScrapTool),
	actionButtonAction('editor-recolor', 'Editor recolor', Action.SwitchToRecolorTool),
	actionButtonAction('editor-season', 'Editor season', Action.SwitchToSeasonTool),
	actionButtonAction('editor-undo', 'Undo', Action.None, faUndo),
	actionButtonAction('editor-redo', 'Redo', Action.None, faRedo),
	actionButtonAction('house-save', 'Save house', Action.None, faHome, faSave),
	actionButtonAction('house-load', 'Load house', Action.None, faHome, faDownload),
	actionButtonAction('house-reset', 'Reset house', Action.None, faHome, faSync),
	actionButtonAction('house-clear', 'Clear house', Action.None, faHome, faTimes),
];

const actionActions = [...bodyActions, ...emoteActions, ...buildingToolActions];

const commandActions = [
	commandButtonAction('/roll', '🎲'),
	commandButtonAction('/gifts', '🎁'),
	commandButtonAction('/candies', '🍬'),
	commandButtonAction('/clovers', '🍀'),
	commandButtonAction('/toys', '🎅'),
	commandButtonAction('/eggs', '🥚'),
];

const additionalActionsActions = [
	expressionButtonAction(undefined),
];

function getActionAction(action: string) {
	return actionActions.find(a => a.action === action);
}

function getCommandAction(command: string) {
	return commandActions.find(a => a.command === command);
}

export function createButtionActionActions() {
	return [...actionActions, ...additionalActionsActions];
}

export function createEmoteActions() {
	return [...additionalActionsActions, ...emoteActions];
}

export function createBodyActions() {
	return bodyActions.filter(action => !isModAction(action.action));
}

export function createModActions() {
	return [
		...bodyActions.filter(action => isModAction(action.action)),
		actionButtonAction('ban-hammer', 'Hold Ban Hammer', Action.HoldBanHammer),
	];
}

function isModAction(action: string) {
	return action.startsWith('hold-') || action.startsWith('speed-') ||
		action === 'no-clip' || action === 'players' || action === 'maps' || action === 'map';
}

function isBuilderAction(action: string) {
	return action === 'switch-tool' || action === 'switch-entity' || action === 'switch-entity-rev' ||
		action === 'switch-tile' || action === 'tile-next' || action === 'tile-prev' ||
		action === 'wall-next' || action === 'wall-prev' || action === 'wall-height' || action === 'wall-high' ||
		action.startsWith('editor-') || action.startsWith('house-');
}

export function createBuildingActions() {
	return [...buildingToolActions];
}

export function createButtonCommandActions() {
	return [...commandActions];
}

export function createDefaultButtonActions(): ButtonActionSlot[] {
	return [
		{ action: getActionAction('boop') },
		{ action: getActionAction('down') },
		{ action: getActionAction('up') },
		{ action: getActionAction('turn-head') },

		{ action: getActionAction('magic') },
		{ action: getActionAction('zoom-out') },
		{ action: getActionAction('zoom-in') },

		{ action: expressionButtonAction(createExpression(Eye.Closed, Eye.Closed, Muzzle.Smile)) },
		{ action: expressionButtonAction(createExpression(Eye.Neutral, Eye.Neutral3, Muzzle.Smile)) },
		{ action: expressionButtonAction(createExpression(Eye.Neutral, Eye.Neutral, Muzzle.Scrunch, Iris.Forward, Iris.Up)) },
		{ action: expressionButtonAction(createExpression(Eye.Angry, Eye.Angry, Muzzle.Scrunch)) },
		{ action: expressionButtonAction(createExpression(Eye.Neutral3, Eye.Neutral3, Muzzle.Flat, Iris.Left, Iris.Left)) },
		{ action: expressionButtonAction(createExpression(Eye.X, Eye.X, Muzzle.Flat)) },
		{ action: expressionButtonAction(createExpression(Eye.Neutral4, Eye.Neutral4, Muzzle.Flat)) },

		{ action: undefined },

		{ action: expressionButtonAction(createExpression(Eye.Neutral, Eye.Neutral, Muzzle.Flat, Iris.Shocked, Iris.Shocked)) },
		{ action: expressionButtonAction(createExpression(Eye.Neutral2, Eye.Neutral2, Muzzle.Flat, Iris.Right, Iris.Left)) },

		{ action: getCommandAction('/roll') },
		{ action: getCommandAction('/gifts') },
		{ action: getCommandAction('/clovers') },
		{ action: getCommandAction('/eggs') },
		{ action: getCommandAction('/toys') },

		{ action: getActionAction('sneeze') },
		{ action: getActionAction('yawn') },
		{ action: getActionAction('interact') },
		{ action: getActionAction('excite') },
		{ action: getActionAction('kiss') },
		{ action: getActionAction('laugh') },
		{ action: getActionAction('sleep') },

		{ action: getActionAction('drop-toy') },
		{ action: getActionAction('drop') },
		{ action: getActionAction('hold-right') },
		{ action: getActionAction('hold-left') },
		{ action: getActionAction('hold-down') },
		{ action: getActionAction('hold-up') },
		{ action: getActionAction('open') },

		{ action: getActionAction('switch-tool') },
		{ action: getActionAction('switch-entity') },
		{ action: getActionAction('switch-entity-rev') },
		{ action: getActionAction('dance-1') },

		{ action: entityButtonAction('rope') },

		{ action: itemButtonAction(sprites.flower_2, 14) },
		{ action: itemButtonAction(sprites.apple_1, 5) },
		{ action: itemButtonAction(sprites.pumpkin_default) },
		{ action: itemButtonAction(sprites.tree_1, 2) },

		{
			action: expressionButtonAction(
				createExpression(
					Eye.Neutral,
					Eye.Neutral,
					Muzzle.Flat,
					Iris.Shocked,
					Iris.Shocked,
					ExpressionExtra.Tears
				)
			)
		},
		{
			action: expressionButtonAction(
				createExpression(
					Eye.Neutral2,
					Eye.Neutral2,
					Muzzle.Flat,
					Iris.Right,
					Iris.Left,
					ExpressionExtra.Cry
				)
			)
		},
		{
			action: expressionButtonAction(
				createExpression(
					Eye.Neutral2,
					Eye.Neutral2,
					Muzzle.Flat,
					Iris.Right,
					Iris.Left,
					ExpressionExtra.Hearts
				)
			)
		},
		{
			action: expressionButtonAction(
				createExpression(
					Eye.Neutral2,
					Eye.Neutral2,
					Muzzle.Flat,
					Iris.Right,
					Iris.Left,
					ExpressionExtra.Zzz
				)
			)
		},
		{
			action: expressionButtonAction(
				createExpression(
					Eye.Neutral2,
					Eye.Neutral2,
					Muzzle.Flat,
					Iris.Right,
					Iris.Left,
					ExpressionExtra.Zzz |
					ExpressionExtra.Cry |
					ExpressionExtra.Hearts |
					ExpressionExtra.Blush
				)
			)
		},
	];
}

export function serializeActions(slots: ButtonActionSlot[]): string {
	const serialized = slots.slice(0, ACTIONS_LIMIT).map(serializeAction);

	while (serialized.length && !serialized[serialized.length - 1]) {
		serialized.pop();
	}

	return JSON.stringify(serialized);
}

export function deserializeActions(data: string): ButtonActionSlot[] {
	try {
		const json = JSON.parse(data);
		return json.slice(0, ACTIONS_LIMIT).map(deserializeAction);
	} catch (e) {
		DEVELOPMENT && console.error(e);
		return [];
	}
}

function serializeAction({ action }: ButtonActionSlot): any {
	if (action) {
		switch (action.type) {
			case 'action':
				return { act: action.action };
			case 'command':
				return { cmd: action.command };
			case 'expression':
				return { exp: encodeExpression(action.expression) };
			case 'entity':
				return { ent: action.entity };
			default:
				DEVELOPMENT && console.warn(`Missing serialization for ${JSON.stringify(action)}`);
				return null;
		}
	} else {
		return null;
	}
}

function deserializeAction(data: any): ButtonActionSlot {
	if (data) {
		if ('act' in data || 'action' in data) {
			return { action: getActionAction(data.act || data.action) };
		} else if ('cmd' in data || 'command' in data) {
			return { action: getCommandAction(data.cmd || data.command) };
		} else if ('exp' in data || 'expression' in data) {
			const expression = decodeExpression(data.exp || data.expression | 0);
			return { action: expressionButtonAction(expression) };
		} else if ('ent' in data || 'entity' in data) {
			return { action: entityButtonAction(data.ent || data.entity) };
		} else {
			DEVELOPMENT && console.warn(`Missing deserialization for ${JSON.stringify(data)}`);
		}
	}

	return { action: undefined };
}

const lastCommandCalls: { [key: string]: number; } = {};

let heldOffsetDebounceTimer: number | undefined = undefined;
let heldOffsetPending: { game: PonyTownGame; message: string; total: number } | undefined;

function saveHeldItemOffset(player: any, holding: any) {
	try {
		const key = `heldOffset:${player.id}:${holding.type}`;
		localStorage.setItem(key, JSON.stringify({ x: holding.pickableX, y: holding.pickableY }));
	} catch (_e) { }
}

function flushHeldOffsetMessage() {
	if (!heldOffsetPending) return;
	const { game, message, total } = heldOffsetPending;
	addChatBubble(game.map, game.player!, { message, type: MessageType.System, total, timer: total, created: Date.now() });
	heldOffsetPending = undefined;
	if (heldOffsetDebounceTimer !== undefined) {
		clearTimeout(heldOffsetDebounceTimer);
		heldOffsetDebounceTimer = undefined;
	}
}

function adjustHeldItemOffset(game: PonyTownGame, dx: number, dy: number) {
	const player = game.player;
	if (!player) {
		return;
	}

	const holding = player.ponyState.holding;
	if (!holding) {
		const message = 'Нет удерживаемого предмета';
		const total = getSaysTime(message);
		addChatBubble(game.map, player, { message, type: MessageType.System, total, timer: total, created: Date.now() });
		return;
	}

	const facingRight = isFacingRight(player);
	const flipX = facingRight ? -1 : 1;
	const pickableX = toInt(holding.pickableX !== undefined ? holding.pickableX : 37) + dx * flipX;
	const pickableY = toInt(holding.pickableY !== undefined ? holding.pickableY : 50) + dy;

	holding.pickableX = pickableX;
	holding.pickableY = pickableY;
	player.discardBatch = true;
	player.pickableX = pickableX;
	player.pickableY = pickableY;
	game.send(server => server.actionParam(Action.AdjustHeldItemOffset, { pickableX, pickableY }));

	saveHeldItemOffset(player, holding);

	const message = `высота ${pickableY} ширина ${pickableX}`;
	const total = getSaysTime(message);

	heldOffsetPending = { game, message, total };
	if (heldOffsetDebounceTimer !== undefined) {
		clearTimeout(heldOffsetDebounceTimer);
	}
	heldOffsetDebounceTimer = setTimeout(() => flushHeldOffsetMessage(), 250) as unknown as number;

}

export function adjustHeldItemOffsetSilent(game: PonyTownGame, dx: number, dy: number) {
	const player = game.player;
	if (!player) {
		return;
	}

	const holding = player.ponyState.holding;
	if (!holding) {
		return;
	}

	const facingRight = isFacingRight(player);
	const flipX = facingRight ? -1 : 1;
	const pickableX = toInt(holding.pickableX !== undefined ? holding.pickableX : 37) + dx * flipX;
	const pickableY = toInt(holding.pickableY !== undefined ? holding.pickableY : 50) + dy;

	holding.pickableX = pickableX;
	holding.pickableY = pickableY;
	player.discardBatch = true;
	player.pickableX = pickableX;
	player.pickableY = pickableY;

	saveHeldItemOffset(player, holding);
}

export function useAction(game: PonyTownGame, action: ButtonAction | undefined) {
	if (action && isActionAvailable(game, action)) {
		switch (action.type) {
			case 'expression':
				game.send(server => server.expression(encodeExpression(action.expression)));
				break;
			case 'action':
				if (action.action === 'editor-undo') {
					game.debugEditorUndo();
					break;
				}
				if (action.action === 'editor-redo') {
					game.debugEditorRedo();
					break;
				}
				if (action.action.startsWith('house-')) {
					const command = ({
						'house-save': '/savehouse',
						'house-load': '/loadhouse',
						'house-reset': '/resethouse',
						'house-clear': '/clearhouse',
					} as any)[action.action];
					game.send(server => server.say(0, command, ChatType.Say));
					break;
				}
				if (action.sendAction) {
					if (action.action.startsWith('editor-') || action.action.startsWith('tile-') || action.action.startsWith('wall-')) {
						game.editor.undoAvailable = true;
						game.editor.redoAvailable = false;
					}
					game.send(server => server.action(action.sendAction));
				} else {
					switch (action.action) {
						case 'boop':
							boopAction(game);
							break;
						case 'dance-1':
							dance1Action(game);
							break;
						case 'up':
							upAction(game);
							break;
						case 'down':
							downAction(game);
							break;
						case 'turn-head':
							turnHeadAction(game);
							break;
						case 'open-own-profile':
							if (game.player) {
								game.ignoreSelectionClear();
								game.select(game.player);
							}
							break;
						case 'switch-entity':
							game.send(server => server.action(Action.SwitchToPlaceTool));
							game.changePlaceEntity(false);
							break;
						case 'switch-entity-rev':
							game.send(server => server.action(Action.SwitchToPlaceTool));
							game.changePlaceEntity(true);
							break;
						case 'switch-tile':
							game.send(server => server.action(Action.SwitchToTileTool));
							game.changePlaceTile(false);
							break;
						case 'tile-next':
							game.changePlaceTile(false, (game as any).editorBox);
							break;
						case 'tile-prev':
							game.changePlaceTile(true, (game as any).editorBox);
							break;
						case 'wall-next':
							changeWallMaterial(game, false);
							break;
						case 'wall-prev':
							changeWallMaterial(game, true);
							break;
						case 'wall-height':
							changeWallHeight(game, false);
							break;
						case 'wall-high':
							setWallHeight(game, true);
							break;
						case 'interact': {
							interact(game, false);
							break;
						}
						case 'speed-up':
						case 'speed-down': {
							game.send(server => server.actionParam(
								action.action === 'speed-up' ? Action.SpeedUp : Action.SpeedDown, undefined));
							break;
						}
						case 'no-clip':
							game.send(server => server.action(Action.NoClip));
							break;
						case 'players':
						case 'maps':
						case 'map':
							game.send(server => server.actionParam(
								({ players: Action.Players, maps: Action.Maps, map: Action.MapInfo } as any)[action.action], undefined));
							break;
						case 'zoom-out': {
							game.zoomOut();
							break;
						}
						case 'zoom-in': {
							game.zoomIn();
							break;
						}
						case 'open': {
							// use held item (will open gift if holding one)
							game.send(server => server.use());
							break;
						}
					case 'hold-right': {
						adjustHeldItemOffset(game, 1, 0);
						break;
					}
					case 'hold-left': {
						adjustHeldItemOffset(game, -1, 0);
						break;
					}
					case 'hold-down': {
						adjustHeldItemOffset(game, 0, 1);
						break;
					}
					case 'hold-up': {
						adjustHeldItemOffset(game, 0, -1);
						break;
					}
						default:
							console.log('Action not supported: ', action.action);
					}
				}
				break;
			case 'command': {
				const now = performance.now();
				const lastCall = lastCommandCalls[action.command] | 0;

				if ((now - lastCall) > COMMAND_ACTION_TIME_DELAY) {
					lastCommandCalls[action.command] = now;
					const chatType = isPartyChat(game.lastChatMessageType) ? ChatType.Party : ChatType.Say;
					game.send(server => server.say(0, action.command, chatType));
				}
				break;
			}
			case 'entity':
				if (BETA) {
					game.editor.type = action.entity;
				}
				break;
			default:
				console.log('Action type not supported: ', action.type);
		}
	}
}

export function isActionAvailable(game: PonyTownGame, action: ButtonAction | undefined) {
	if (!action || action.type !== 'action') {
		return true;
	}

	const player = game.player;
	if (isBuilderAction(action.action)) {
		if (!player) return false;
		if (action.action.startsWith('house-')) {
			return (game.map as any).id === 'house';
		}
		if (action.action === 'editor-undo' || action.action === 'editor-redo') {
			const canEdit = game.mod || hasFlag(game.map.flags, MapFlags.EditableTiles) || hasFlag(game.map.flags, MapFlags.EditableWalls);
			return canEdit && (action.action === 'editor-undo' ? game.editor.undoAvailable : game.editor.redoAvailable);
		}
		if (game.mod) return true;
		const flags = game.map.flags;
		if (action.action === 'tile-next' || action.action === 'tile-prev' || action.action === 'editor-shovel') {
			return hasFlag(flags, MapFlags.EditableTiles);
		}
		if (action.action === 'wall-next' || action.action === 'wall-prev' || action.action === 'wall-height' || action.action === 'wall-high' || action.action === 'editor-saw') {
			return hasFlag(flags, MapFlags.EditableWalls);
		}
		if (action.action === 'editor-undo' || action.action === 'editor-redo') {
			return hasFlag(flags, MapFlags.EditableTiles) || hasFlag(flags, MapFlags.EditableWalls);
		}
		return hasFlag(flags, MapFlags.EditableEntities);
	}
	switch (action.action) {
		case 'zoom-in':
			return game.scale < game.getZoomBounds().max - 1e-6;
		case 'zoom-out':
			return game.scale > game.getZoomBounds().min + 1e-6;
		case 'dance-1':
			return !!player && canBoop(player);
		case 'interact':
			return !!player && (!!getInteractTarget(game) || player.hold === hammer.type || player.hold === shovel.type ||
				!!player.ponyState.holding && hasFlag(player.ponyState.holding.flags, EntityFlags.Usable));
		case 'hold-right':
		case 'hold-left':
		case 'hold-down':
		case 'hold-up':
			return !!player && game.mod;
		case 'speed-up':
			return !!player && game.mod && Math.max(1, Math.min(7, Math.round(player.speedMultiplier || 1))) < 7;
		case 'speed-down':
			return !!player && game.mod && Math.max(1, Math.min(7, Math.round(player.speedMultiplier || 1))) > 1;
		case 'no-clip':
			return !!player && game.mod;
		case 'players':
		case 'maps':
		case 'map':
			return !!player && game.mod;
		case 'drop-toy':
			return !!player;
		case 'drop':
			return !!player && !!player.ponyState.holding;
		case 'open':
			return !!player && !!player.ponyState.holding && hasFlag(player.ponyState.holding.flags, EntityFlags.Usable);
		default:
			return true;
	}
}

function shouldRedrawAction(action: ButtonAction | undefined, state: any, game: PonyTownGame) {
	if (action !== state.action) {
		return true;
	} else if (action) {
		switch (action.type) {
			case 'action': {
				if (state.disabled !== !isActionAvailable(game, action)) {
					return true;
				}
				switch (action.action) {
					case 'up':
						return state.draw !== getUpDrawFunc(game);
					case 'down':
						return state.draw !== getDownDrawFunc(game);
					case 'open-own-profile':
						return state.previewPony !== game.player
							|| state.previewInfo !== (game.player && game.player.info)
							|| state.previewPalette !== (game.player && game.player.palettePonyInfo);
					case 'turn-head': {
						const headTurned = !!game.player && hasFlag(game.player.state, EntityState.HeadTurned);
						return state.headTurned !== headTurned;
					}
					default:
						return false;
				}
			}
			default:
				return false;
		}
	} else {
		return false;
	}
}

const canvasCache = new Map<string, HTMLCanvasElement>();
const palette = mockPaletteManager.addArray(sprites.fontPalette);
const emojiPalette = mockPaletteManager.addArray(sprites.emojiPalette);

function drawCanvasCached(key: string, action: (batch: ContextSpriteBatch) => void) {
	const canvas = canvasCache.get(key) || drawCanvas(ICON_SIZE, ICON_SIZE, sprites.paletteSpriteSheet, undefined, action);
	canvasCache.set(key, canvas);
	return canvas;
}

export function drawAction(canvas: HTMLCanvasElement, action: ButtonAction | undefined, state: any, game: PonyTownGame) {
	if (resizeCanvasWithRatio(canvas, CANVAS_SIZE, CANVAS_SIZE)) {
		state.action = 0;
	}

	if (!spriteSheetsLoaded || !shouldRedrawAction(action, state, game))
		return;

	const context = canvas.getContext('2d');

	if (!context)
		return;
	if (action && action.type === 'action' && action.icon) {
		state.disabled = !isActionAvailable(game, action);
		return;
	}

	state.action = action;

	context.save();
	context.clearRect(0, 0, canvas.width, canvas.height);
	disableImageSmoothing(context);

	const scale = 2 * getPixelRatio();
	const bufferSize = ICON_SIZE;

	if (action) {
		switch (action.type) {
			case 'expression': {
				const buffer = drawCanvas(bufferSize, bufferSize, sprites.paletteSpriteSheet, undefined, batch => {
					const state = { ...createState(), expression: action.expression };
					const options = { ...defaultDrawPonyOptions(), noEars: true };
					drawHead(batch, expressionPony, headX, headY, undefined,
						defaultHeadFrame, HeadAnimationProperties.None, state, options, false, 0);

					if (action.expression) {
						const extra = action.expression.extra;

						if (hasFlag(extra, ExpressionExtra.Zzz)) {
							batch.drawSprite(sprites.emote_sleep1.frames[13], WHITE, defaultPalette, headX + 15, headY + 3);
						}

						if (hasFlag(extra, ExpressionExtra.Hearts)) {
							batch.drawSprite(sprites.emote_hearts.frames[41], HEARTS_COLOR, defaultPalette, headX + 8, headY + 22);
						}

						if (hasFlag(extra, ExpressionExtra.Cry)) {
							batch.drawSprite(sprites.emote_cry2.frames[4], WHITE, defaultPalette, headX, headY);
						} else if (hasFlag(extra, ExpressionExtra.Tears)) {
							batch.drawSprite(sprites.emote_tears.frames[0], WHITE, defaultPalette, headX, headY);
						}
					} else {
						const color = parseColor(ACTION_EXPRESSION_BG);
						batch.drawRect(color, 0, 3, 15, 5);
						batch.drawRect(color, 0, 8, 3, 1);
						batch.drawRect(color, 8, 8, 4, 1);
					}
				});

				context.fillStyle = ACTION_EXPRESSION_BG;
				context.fillRect(0, 0, canvas.width, canvas.height);
				context.scale(scale, scale);
				context.drawImage(buffer, 0, 0);
				break;
			}
			case 'command': {
				const buffer = drawCanvasCached(`command:${action.icon}`, batch => {
					const bounds = rect(0, 0, 15, 15);
					const options = { palette, emojiPalette };
					drawTextAligned(batch, action.icon, fontPal, BLACK, bounds, HAlign.Center, VAlign.Middle, options);
				});

				context.fillStyle = ACTION_COMMAND_BG;
				context.fillRect(0, 0, canvas.width, canvas.height);
				context.scale(scale, scale);
				context.drawImage(buffer, -0.5, 0.5);
				break;
			}
			case 'action': {
				let buffer: HTMLCanvasElement;
				const disabled = !isActionAvailable(game, action);
				state.disabled = disabled;

				if (action.action === 'up' || action.action === 'down') {
					state.draw = action.action === 'up' ? getUpDrawFunc(game) : getDownDrawFunc(game);

					buffer = drawCanvasCached(`action:${action.action}:${state.draw}`, batch => {
						state.draw && getDrawFuncByName(state.draw)(batch);
					});
				} else if (action.action === 'open-own-profile') {
					const previewPony = game.player && game.player.palettePonyInfo ? game.player.palettePonyInfo : actionPony;
					state.previewPony = game.player;
					state.previewInfo = game.player && game.player.info;
					state.previewPalette = game.player && game.player.palettePonyInfo;

					buffer = drawCanvas(bufferSize, bufferSize, sprites.paletteSpriteSheet, undefined, batch => {
						const ponyState = { ...createState(), animation: stand };
						drawPony(batch, previewPony, ponyState, 15, 40, defaultDrawPonyOptions());
					});
				} else {
					const cacheKey = action.action === 'turn-head'
						? `action:${action.action}:${!!game.player && hasFlag(game.player.state, EntityState.HeadTurned)}`
						: `action:${action.action}`;
					buffer = drawCanvasCached(cacheKey, batch => {
						switch (action.action) {
							case 'boop': {
								const state = { ...createState(), animation: headlessBoop, animationFrame: 0 };
								drawPony(batch, actionPony, state, 25, 32, defaultDrawPonyOptions());
								break;
							}
							case 'dance-1': {
								const state = { ...createState(), animation: dance1, animationFrame: 5 };
								drawPony(batch, actionPony, state, 18, 40, defaultDrawPonyOptions());
								break;
							}
							case 'turn-head': {
								const headTurned = !!game.player && hasFlag(game.player.state, EntityState.HeadTurned);
								const ponyState = { ...createState(), animation: stand, headTurned };
								drawPony(batch, actionPony, ponyState, 15, 40, defaultDrawPonyOptions());
								break;
							}
							case 'no-clip': {
								const ponyState = { ...createState(), animation: stand };
								batch.globalAlpha = 0.5;
								drawPony(batch, actionPony, ponyState, 15, 40, defaultDrawPonyOptions());
								batch.globalAlpha = 1;
								break;
							}
							case 'players':
							case 'maps':
							case 'map': {
								const icon = action.action === 'players' ? 'P' : action.action === 'maps' ? 'M' : 'I';
								const bounds = rect(0, 0, 15, 15);
								drawTextAligned(batch, icon, fontPal, BLACK, bounds, HAlign.Center, VAlign.Middle, { palette });
								break;
							}
							case 'sneeze': {
								const state = { ...createState(), headAnimation: sneeze, headAnimationFrame: 3 };
								drawPony(batch, actionPony, state, 17, 40, defaultDrawPonyOptions());
								break;
							}
							case 'excite': {
								const state = { ...createState(), headAnimation: excite, headAnimationFrame: 3 };
								drawPony(batch, actionPony, state, 17, 40, defaultDrawPonyOptions());
								break;
							}
							case 'sleep': {
								const state = { ...createState(), expression: createExpression(Eye.Closed, Eye.Closed, Muzzle.Neutral) };
								drawPony(batch, actionPony, state, 18, 40, defaultDrawPonyOptions());
								batch.drawSprite(sprites.emote_sleep1.frames[13], WHITE, defaultPalette, headX + 15, headY + 3);
								break;
							}
							case 'drop': {
								const state = { ...createState(), holding: fakePaletteManager(() => apple2(0, 0)) };
								drawPony(batch, actionPony, state, 20, 40, defaultDrawPonyOptions());
								batch.drawSprite(sprites.arrow_down, BLACK, defaultPalette, 1, 3);
								break;
							}
							case 'hold-right':
							case 'hold-left':
							case 'hold-down':
							case 'hold-up': {
								const state = { ...createState(), holding: fakePaletteManager(() => banana(0, 0)) };
								drawPony(batch, actionPony, state, 20, 40, defaultDrawPonyOptions());
								const arrow = {
									'hold-right': sprites.arrow_right,
									'hold-left': sprites.arrow_left,
									'hold-down': sprites.arrow_down,
									'hold-up': sprites.arrow_up,
								}[action.action];
								batch.drawSprite(arrow, BLACK, defaultPalette, 1, 3);
								break;
							}
							case 'speed-up':
							case 'speed-down': {
								const options = { ...defaultDrawPonyOptions(), no: ~NoDraw.AllLegs };
								const state = { ...createState(), animation: trot, animationFrame: 1 };
								drawPony(batch, actionPony, state, 3, 15, options);
								batch.drawSprite(
									action.action === 'speed-up' ? sprites.arrow_up : sprites.arrow_down,
									BLACK, defaultPalette, 11, 1);
								break;
							}
					case 'zoom-out': {
						batch.drawRect(BLACK, 4, 7, 8, 2);
						break;
					}
					case 'zoom-in': {
						batch.drawRect(BLACK, 3, 7, 8, 2);
						batch.drawRect(BLACK, 6, 4, 2, 8);
						break;
					}
							case 'interact':
							case 'open': {
								const state = { ...createState(), animation: boop, animationFrame: 7, headTurned: true };
												const isGiftPreview = action.action === 'open';
												const previewItem = isGiftPreview ? gift2(0, 0) : apple2(0, 0);
												previewItem.x = toWorldX(isGiftPreview ? 8 : 5);
												previewItem.y = toWorldY(isGiftPreview ? 12 : 10);
												previewItem.draw && previewItem.draw(batch, { ...defaultDrawOptions, shadowColor: TRANSPARENT });
								drawPony(batch, actionPony, state, 28, 36, defaultDrawPonyOptions());
								break;
							}
							case 'drop-toy': {
								const state = { ...createState() };
								const options = { ...defaultDrawPonyOptions(), toy: 17 };
								drawPony(batch, actionPony, state, 18, 52, options);
								batch.drawSprite(sprites.arrow_down, BLACK, defaultPalette, 1, 3);
								break;
							}
							case 'yawn': {
								const state = { ...createState(), headAnimation: yawn, headAnimationFrame: 3 };
								drawPony(batch, actionPony, state, 17, 40, defaultDrawPonyOptions());
								break;
							}
							case 'laugh': {
								const state = { ...createState(), headAnimation: laugh, headAnimationFrame: 3 };
								drawPony(batch, actionPony, state, 17, 38, defaultDrawPonyOptions());
								break;
							}
							case 'blush': {
								const state = {
									...createState(), expression: createExpression(
										Eye.Neutral, Eye.Neutral, Muzzle.Smile, Iris.Forward, Iris.Forward, ExpressionExtra.Blush)
								};
								drawPony(batch, actionPony, state, 17, 40, defaultDrawPonyOptions());
								break;
							}
							case 'love': {
								batch.drawSprite(sprites.emote_hearts.frames[10], 0xbc414fff, defaultPalette, headX + 2, headY + 18);
								break;
							}
							case 'magic': {
								const state = { ...createState(), headAnimation: laugh, headAnimationFrame: 3 };
								drawPony(batch, actionPonyWithHorn, state, 17, 48, defaultDrawPonyOptions());
								batch.drawSprite(sprites.magic_icon, WHITE, defaultPalette, 4, 2);
								break;
							}
							case 'kiss': {
								const state = { ...createState(), headAnimation: kiss, headAnimationFrame: 9 };
								drawPony(batch, actionPony, state, 17, 40, defaultDrawPonyOptions());
								break;
							}
							case 'switch-tool': {
								const palette = mockPaletteManager.addArray(sprites.tools_icon.palettes![0]);
								batch.drawSprite(sprites.tools_icon.color, WHITE, palette, 0, 2);
								break;
							}
							case 'switch-entity': {
								const palette = mockPaletteManager.addArray(sprites.hammer.palettes![0]);
								batch.drawSprite(sprites.hammer.color, WHITE, palette, 2, 2);
								batch.drawSprite(sprites.arrow_right, BLACK, defaultPalette, 10, 1);
								break;
							}
							case 'switch-entity-rev': {
								const palette = mockPaletteManager.addArray(sprites.hammer.palettes![0]);
								batch.drawSprite(sprites.hammer.color, WHITE, palette, 2, 3);
								batch.drawSprite(sprites.arrow_left, BLACK, defaultPalette, 1, 1);
								break;
							}
							case 'switch-tile': {
								const palette = mockPaletteManager.addArray(sprites.shovel.palettes![0]);
								batch.drawSprite(sprites.shovel.color, WHITE, palette, 2, 2);
								batch.drawSprite(sprites.arrow_right, BLACK, defaultPalette, 1, 1);
								break;
							}
							case 'editor-shovel': {
								const palette = mockPaletteManager.addArray(sprites.shovel.palettes![0]);
								batch.drawSprite(sprites.shovel.color, WHITE, palette, 2, 2);
								break;
							}
							case 'ban-hammer': {
								const palette = mockPaletteManager.addArray(sprites.ban_hammer.palettes![0]);
								batch.drawSprite(sprites.ban_hammer.color, WHITE, palette, 2, 2);
								break;
							}
							case 'editor-hammer':
							{
								const palette = mockPaletteManager.addArray(sprites.hammer.palettes![0]);
								batch.drawSprite(sprites.hammer.color, WHITE, palette, 2, 2);
								break;
							}
							case 'editor-broom':
							case 'editor-rope':
							case 'editor-pickaxe':
							case 'editor-wrench':
							case 'editor-saw':
							case 'editor-scrap':
							case 'editor-recolor':
							case 'editor-season':
							case 'wall-next':
							case 'wall-prev':
							case 'wall-height':
							case 'wall-high':
							case 'tile-next':
							case 'tile-prev': {
									const isWallAction = action.action === 'wall-next' || action.action === 'wall-prev' ||
										action.action === 'wall-height' || action.action === 'wall-high';
									const tool = isWallAction ? sprites.saw : action.action === 'editor-broom' ? sprites.broom :
									action.action === 'editor-pickaxe' ? sprites.pickaxe :
									action.action === 'editor-wrench' ? sprites.double_ended_wrench :
									action.action === 'editor-saw' ? sprites.saw :
										action.action === 'editor-scrap' ? sprites.scrap :
										action.action === 'editor-recolor' ? sprites.brush :
										action.action === 'editor-season' ? sprites.forest_axe :
									action.action === 'editor-rope' ? sprites.rope_rack : sprites.shovel;
								const palette = mockPaletteManager.addArray(tool.palettes![0]);
								batch.drawSprite(tool.color, WHITE, palette, 2, 2);
								if (action.action === 'tile-next' || action.action === 'tile-prev' ||
									action.action === 'wall-next' || action.action === 'wall-prev' ||
									action.action === 'wall-height' || action.action === 'wall-high') {
									const arrow = action.action === 'tile-prev' || action.action === 'wall-prev'
										? sprites.arrow_left
										: action.action === 'wall-height' || action.action === 'wall-high'
											? sprites.arrow_up
											: sprites.arrow_right;
									batch.drawSprite(arrow, isWallAction ? WHITE : BLACK, defaultPalette, 1, 1);
								}
								break;
							}
							default:
								throw new Error(`Invalid action: ${action.action}`);
						}
					});
				}

				const actionBackground = game.mod && isBuilderAction(action.action) ? '#c399ff' : ACTION_ACTION_BG;
				context.fillStyle = disabled ? `#${colorToHexRGB(ACTION_ACTION_BG_DISABLED)}` : actionBackground;
				context.fillRect(0, 0, canvas.width, canvas.height);
				context.scale(scale, scale);
				if (disabled) {
					context.filter = 'grayscale(1)';
				}
				context.drawImage(buffer, 0, 0);
				break;
			}
			case 'item': {
				const buffer = drawCanvas(bufferSize, bufferSize, sprites.paletteSpriteSheet, undefined, batch => {
					const palette = mockPaletteManager.addArray(action.icon.palettes![0]);
					const sprite = action.icon.color;
					batch.drawSprite(sprite, WHITE, palette,
						Math.round((15 - sprite.w) / 2), Math.round((15 - sprite.h) / 2) + 1);
				});

				context.fillStyle = ACTION_ITEM_BG;
				context.fillRect(0, 0, canvas.width, canvas.height);
				context.scale(scale, scale);
				context.drawImage(buffer, -0.5, -0.5);
				break;
			}
			case 'entity': {
				let types = getEntityTypesFromName(action.entity) || [];
				if (!types || types.length === 0) {
					const fallbackType = getEntityType(action.entity);
					if (fallbackType) {
						types = [fallbackType];
					}
				}

				if (!types || types.length === 0) {
					drawQuestionMark(context, canvas);
					break;
				}

				const entities = types.map(type => createAnEntity(type, 0, 0, 0, {}, mockPaletteManager, game));
				const bounds = compact(entities.map(e => e.bounds)).reduce(addRects, rect(0, 0, 0, 0));

				if (!bounds.w || !bounds.h) {
					drawQuestionMark(context, canvas);
					break;
				}

				const previewSize = ICON_SIZE;
				const buffer = drawCanvas(previewSize, previewSize, sprites.paletteSpriteSheet, undefined, batch => {
					const center = centerPoint(bounds);
					const offsetX = previewSize / 2 - center.x;
					const offsetY = previewSize / 2 - center.y;
					const fitScale = Math.min(1, (previewSize - 1) / Math.max(bounds.w, bounds.h));
					const individualScale = LARGE_ENTITY_PREVIEW_SCALE[action.entity] || 1;
					const previewScale = fitScale * individualScale;
					batch.save();
					batch.translate(previewSize / 2, previewSize / 2);
					batch.scale(previewScale, previewScale);
					batch.translate(-previewSize / 2, -previewSize / 2);

					for (const entity of entities) {
						if (entity.draw) {
							entity.x += toWorldX(offsetX);
							entity.y += toWorldY(offsetY);
							entity.draw(batch, { ...defaultDrawOptions, shadowColor: TRANSPARENT });
						}
					}
					batch.restore();
				});

				context.scale(scale, scale);
				context.drawImage(buffer, 0, 0);
				break;
			}
		}
	}

	context.restore();
}

function drawQuestionMark(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
	disableImageSmoothing(context);
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.font = 'bold 13px "Courier New", monospace';
	context.fillStyle = 'white';
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillText('?', canvas.width / 2, canvas.height / 2 + 1);
}

function drawLie(batch: ContextSpriteBatch) {
	const state = { ...createState(), animation: lie };
	drawPony(batch, actionPony, state, -6, 15, defaultDrawPonyOptions());
}

function drawLieDisabled(batch: ContextSpriteBatch) {
	const state = { ...createState(), animation: lie };
	batch.drawRect(ACTION_ACTION_BG_DISABLED, 0, 0, 50, 50);
	drawPony(batch, actionPonyDisabled, state, -6, 15, defaultDrawPonyOptions());
}

function drawSit(batch: ContextSpriteBatch) {
	const state = { ...createState(), animation: sit };
	drawPony(batch, actionPony, state, -6, 15, defaultDrawPonyOptions());
}

function drawStand(batch: ContextSpriteBatch) {
	const state = { ...createState(), animation: stand };
	drawPony(batch, actionPony, state, -1, 15, defaultDrawPonyOptions());
}

function drawFly(batch: ContextSpriteBatch) {
	const state = { ...createState(), animation: fly };
	drawPony(batch, actionPonyWithWings, state, 0, 30, defaultDrawPonyOptions());
}

function drawFlyDisabled(batch: ContextSpriteBatch) {
	const state = { ...createState(), animation: fly };
	batch.drawRect(ACTION_ACTION_BG_DISABLED, 0, 0, 50, 50);
	drawPony(batch, actionPonyWithWingsDisabled, state, 0, 30, defaultDrawPonyOptions());
}

function getDrawFuncByName(name: string) {
	switch (name) {
		case 'lie': return drawLie;
		case 'sit': return drawSit;
		case 'stand': return drawStand;
		case 'fly': return drawFly;
		case 'flyDisabled': return drawFlyDisabled;
		case 'lieDisabled': return drawLieDisabled;
		default:
			throw new Error(`Invalid name: ${name}`);
	}
}

function getUpDrawFunc(game: PonyTownGame) {
	const player = game.player;

	if (player) {
		if (isPonyLying(player)) {
			return 'sit';
		} else if (isPonySitting(player)) {
			return 'stand';
		} else if (isPonyStanding(player) && canPonyFly(player)) {
			return 'fly';
		}
	}

	return 'flyDisabled';
}

function getDownDrawFunc(game: PonyTownGame) {
	const player = game.player;

	if (player) {
		if (isPonySitting(player)) {
			return 'lie';
		} else if (isPonyStanding(player)) {
			return 'sit';
		} else if (isPonyFlying(player)) {
			return 'stand';
		}
	}

	return 'lieDisabled';
}