// Определяет режим irisMode для глаза по expression (можно расширять под любые кастомные выражения)
function getIrisModeForEye(expr: Expression | undefined, side: EyeSide): IrisMode {
	if (!expr) return 'normal';
	// Если iris уже shocked — всегда shocked
	var iris = side === 'left' ? expr.leftIris : expr.rightIris;
	if (
		iris === Iris.Shocked ||
		iris === Iris.ShockedUp ||
		iris === Iris.ShockedUpLeft ||
		iris === Iris.ShockedUpRight ||
		iris === Iris.ShockedLeft ||
		iris === Iris.ShockedRight ||
		iris === Iris.ShockedDown ||
		iris === Iris.ShockedDownLeft ||
		iris === Iris.ShockedDownRight ||
		iris === Iris.ShockedDown2 ||
		iris === Iris.ShockedDownLeft2 ||
		iris === Iris.ShockedDownRight2
	) return 'shocked';
	// Можно расширить под любые условия expression
	const eye = side === 'left' ? expr.left : expr.right;
	if (eye === Eye.Sad4 || eye === Eye.Angry2) return 'shocked';
	return 'normal';
}
// --- Узкие глаза для iris-адаптации ---
const NARROW_EYES = new Set<Eye>([
	Eye.Neutral4,
	Eye.Neutral3,
	Eye.Frown3,
	Eye.Frown2,
	Eye.Sad4,
	Eye.Sad3,
	Eye.Angry2,
	Eye.Angry,
]);

function adjustIrisForEye(eye: Eye, iris: Iris): Iris {
	if (!NARROW_EYES.has(eye)) return iris;
	switch (iris) {
		 // normal
		 case Iris.Down: return Iris.Down2;
		 case Iris.DownLeft: return Iris.DownLeft2;
		 case Iris.DownRight: return Iris.DownRight2;
		 // shocked
		 case Iris.ShockedDown: return Iris.ShockedDown2;
		 case Iris.ShockedDownLeft: return Iris.ShockedDownLeft2;
		 case Iris.ShockedDownRight: return Iris.ShockedDownRight2;
		 default: return iris;
	}
}

function normalizeIrisForUI(iris: Iris): Iris {
	switch (iris) {
		case Iris.Down2: return Iris.Down;
		case Iris.DownLeft2: return Iris.DownLeft;
		case Iris.DownRight2: return Iris.DownRight;
		default: return iris;
	}
}
// --- Iris адаптация под тип глаза ---


// --- IrisMode: normal/shocked ---
export type IrisMode = 'normal' | 'shocked';
export type EyeSide = 'left' | 'right';
export type EyeIrisMode = {
	left: IrisMode;
	right: IrisMode;
};

// Цвет для UI-индикатора режима iris
export function getIrisModeColor(mode: IrisMode | EyeIrisMode, side?: EyeSide): string {
	if (typeof mode === 'string') {
		return mode === 'normal' ? 'green' : 'red';
	} else if (side) {
		return mode[side] === 'normal' ? 'green' : 'red';
	}
	return 'gray';
}

// Маппинг: normal → shocked
const NORMAL_TO_SHOCKED: Partial<Record<Iris, Iris>> = {
	[Iris.Forward]: Iris.Shocked,
	[Iris.Up]: Iris.ShockedUp,
	[Iris.UpLeft]: Iris.ShockedUpLeft,
	[Iris.UpRight]: Iris.ShockedUpRight,
	[Iris.Left]: Iris.ShockedLeft,
	[Iris.Right]: Iris.ShockedRight,
	[Iris.Down]: Iris.ShockedDown,
	[Iris.DownLeft]: Iris.ShockedDownLeft,
	[Iris.DownRight]: Iris.ShockedDownRight,
	[Iris.Down2]: Iris.ShockedDown2,
	[Iris.DownLeft2]: Iris.ShockedDownLeft2,
	[Iris.DownRight2]: Iris.ShockedDownRight2,
};

export function applyIrisMode(iris: Iris, mode: IrisMode): Iris {
	    if (mode === 'shocked') {
		    var shocked = (NORMAL_TO_SHOCKED as any)[iris] as Iris | undefined;
		    return shocked !== undefined ? shocked as Iris : iris;
	    }
	// If switching back to normal and iris is a shocked variant, map it back to the normal equivalent
	for (const [k, v] of Object.entries(NORMAL_TO_SHOCKED) as [string, Iris | undefined][]) {
		const key = Number(k) as Iris;
		if (v !== undefined && v === iris) return key;
	}
	return iris;
}
import { Injectable, NgZone } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { debounce } from 'lodash';
import {
	EntityState, Pony, Notification, TileType, Action, IServerActions, Season, WorldState, Holiday,
	TileSets, ChatMessage, PartyInfo, Entity, DrawOptions, Engine, defaultDrawOptions, PonyStateFlags,
	DoAction, ChatType, WorldStateFlags, DebugFlags, MessageType, AccountSettings, Matrix4,
	FakeEntity, SelectFlags, WorldMap, MapType, MapFlags, EntityFlags, isValidTile, GraphicsQuality, houseTiles,
	Iris, Eye, Muzzle, ExpressionExtra, Expression
} from '../common/interfaces';
import { encodeExpression } from '../common/encoders/expressionEncoder';
import {
	clamp, lengthOfXY, setFlag, hasFlag, boundsIntersect, point, lerpColor, distanceXY
} from '../common/utils';
import {
	OFFLINE_PONY, SUPPORTER_PONY, DISCORD_PONY, HOUR, CAMERA_WIDTH_MIN, CAMERA_WIDTH_MAX,
	CAMERA_HEIGHT_MIN, CAMERA_HEIGHT_MAX, SECOND, TILE_CHANGE_RANGE, MINUTE, PONY_TYPE,
	REGION_SIZE, tileWidth, tileHeight, ZOOM_PRESETS, getZoomScaleBounds
} from '../common/constants';
import {
	ensureAllVisiblePoniesAreDecoded, invalidatePalettes, updateMap, updateEntities,
	getMapHeightAt, updateEntitiesWithNames, updateEntitiesCoverLifted, getTile,
	pickEntities, updateEntitiesTriggers, getElevation, setElevation, createWorldMap
} from '../common/worldMap';
import { updateCamera, centerCameraOn, screenToWorld, createCamera } from '../common/camera';
import { WHITE, BLACK, SHADOW_COLOR, getTileColor, RED, CAVE_LIGHT, CAVE_SHADOW, HOVER_OUTLINE_COLOR, CYAN } from '../common/colors';
import { formatHourMinutes, getLightColor, getShadowColor, createLightData } from '../common/timeUtils';
import { toggleWalls } from '../common/mixins';
import { getEntityTypeName, woodenWalls, stoneWalls } from '../common/entities';
import { hasExtendedInfo, setHeadAnimation, createPony } from '../common/pony';
import { PaletteManager } from '../graphics/paletteManager';
import { isWebGL2 } from '../graphics/webgl/webglUtils';
import { drawFullScreenMessage, drawNames, drawChat, getChatEntityAt, getChatBubbleAt, drawPixelText, drawBoundsOutline } from '../graphics/graphicsUtils';
import { Key } from './input/input';
import { loadAndInitSpriteSheets } from './spriteUtils';
import { version, isMobile } from './data';
import { Game } from './gameLoop';
import { Audio } from '../components/services/audio';
import { getPixelRatio } from './canvasUtils';
import { colorToFloatArray, parseColor, colorToExistingFloatArray, makeTransparent } from '../common/color';
import { nom } from './ponyAnimations';
import { InputManager } from './input/inputManager';
import { roundPositionX, roundPositionY, toScreenX, toScreenY, toWorldX, toWorldY } from '../common/positionUtils';
import { StorageService } from '../components/services/storageService';
import { SettingsService } from '../components/services/settingsService';
import {
	isPonyLying, isPonySitting, setPonyState, getInteractBounds, entityInRange, isFacingRight,
	isHidden, updateEntityVelocity, releaseEntity, compareEntities
} from '../common/entityUtils';
import { vectorToDir, dirToVector, flagsToSpeed, encodeMovement, isMovingRight } from '../common/movementUtils';
import { createDefaultButtonActions, useAction, deserializeActions } from './buttonActions';
import { ClientSocketService } from '../components/services/gameService';
import { attachDebugMethod, initFeatureFlags, updateRangeIndicator, initLogger, log } from './clientUtils';
import { restorePlayerPosition, savePlayerPosition } from './sec';
import { drawEntityLights, drawEntityLightSprites, drawMap, drawDebugRegions } from './draw';
import { updateTileSets, initializeTileHeightmaps, getTilePreviewTileSetIndex, getTilePreviewSpriteIndex } from './tileUtils';
import {
	downAction, upAction, turnHeadAction, boopAction, interact,
	editorSelectEntities, editorDragEntities
} from './playerActions';
import {
	updateWallPlaceholder, updateBuildingPreviews, handleDragTool, handleBuildingActionClick, handleEditorBroomClick,
	handleBuildingRightClick, handleBuildingWheel, changePlaceEntity as changePlaceEntityTool, changePlaceTile as changePlaceTileTool,
	removeEntitiesTool, placeEntitiesTool, changeTileTool, toggleWallsTool, dragEntityTool, cloneEntityTool,
	handleTilePaintDrag, handleWallPaintDrag, getTilePaintPreviewState, getWallPaintPreviewState, getBuildingDragVisualState, getSelectedWallMaterial, isSelectedWallTall, isEditorSawActive
} from './BuildingUtils';
import { fontSmallPal, fontSmall, font, fontMono } from './fonts';
import { drawText, drawOutlinedText, measureText } from '../graphics/spriteFont';
import { getPonyHeadPosition, initializeToys } from './ponyDraw';
import { ErrorReporter } from '../components/services/errorReporter';
import { mockPaletteManager } from '../common/ponyInfo';
import { timeStart, timeEnd, timingCollate, timeReset } from './timing';
import { createFrameBuffer, bindFrameBuffer, unbindFrameBuffer, disposeFrameBuffer } from '../graphics/webgl/frameBuffer';
import { WebGL, initWebGL, disposeWebGL, initWebGLResources } from './webgl';
import { bindTexture } from '../graphics/webgl/texture2d';
import { normalSpriteSheet, paletteSpriteSheet, defaultPalette } from '../generated/sprites';
import { createMat4, ortho } from '../common/mat4';
import { Model } from '../components/services/model';
import { filterEntityName } from './handlers';

interface Minimap {
	width: number;
	height: number;
	data: Uint32Array;
}

interface IncompleteSay {
	id: number;
	message: string;
	type: MessageType;
	time: number;
}

const LOG_POSITION = false;
const CONNECTION_ISSUE_TIMEOUT = 10 * SECOND;
const WALL_HOVER_PREVIEW_DELAY_MS = 500;
const WALL_HOVER_POINTER_EPS = 0.5;
const white = colorToFloatArray(WHITE);
const light = colorToFloatArray(WHITE);
const WALL_Y_OFFSET = 3 / tileHeight;

const wallTypeGroups = [woodenWalls, stoneWalls];
const wallHShortTypes = new Set<number>(wallTypeGroups.map(w => w.wallHShort.type));
const wallHFullTypes = new Set<number>([
	...wallTypeGroups.map((w: typeof woodenWalls) => w.wallH.type),
	...wallTypeGroups.map((w: typeof woodenWalls) => w.wallCutL.type),
	...wallTypeGroups.map((w: typeof woodenWalls) => w.wallCutR.type),
]);
const wallVShortTypes = new Set<number>(wallTypeGroups.map(w => w.wallVShort.type));
const wallVFullTypes = new Set<number>(wallTypeGroups.map(w => w.wallV.type));
const woodHorizontalWallTypes = new Set<number>([
	woodenWalls.wallHShort.type,
	woodenWalls.wallH.type,
	woodenWalls.wallCutL.type,
	woodenWalls.wallCutR.type,
]);
const stoneHorizontalWallTypes = new Set<number>([
	stoneWalls.wallHShort.type,
	stoneWalls.wallH.type,
	stoneWalls.wallCutL.type,
	stoneWalls.wallCutR.type,
]);
const woodVerticalWallTypes = new Set<number>([
	woodenWalls.wallVShort.type,
	woodenWalls.wallV.type,
]);
const stoneVerticalWallTypes = new Set<number>([
	stoneWalls.wallVShort.type,
	stoneWalls.wallV.type,
]);
const wallCornerTypes = new Set<number>([
	...woodenWalls.wallCorners.map(w => w.type),
	...woodenWalls.wallCornersShort.map(w => w.type),
	...stoneWalls.wallCorners.map(w => w.type),
	...stoneWalls.wallCornersShort.map(w => w.type),
]);

function wallPreviewKey(x: number, y: number) {
	return `${x},${y}`;
}

function getWallTopForMap(map: WorldMap) {
	return map.type === MapType.House || map.type === MapType.Cave ? 3 : 0;
}

function isTallWallArea(map: WorldMap, x: number, y: number) {
	if (map.type !== MapType.Cave) {
		return false;
	}

	if (y === 10 && x >= 17 && x <= 23)
		return true;

	if (x >= 31 && x <= 39 && y >= 22 && y <= 25)
		return true;

	if (y === 31 && x >= 33 && x <= 34)
		return true;

	return false;
}

function collectWallPreviewState(map: WorldMap) {
	const hWalls = new Set<string>();
	const vWalls = new Set<string>();
	const hTallWalls = new Set<string>();
	const vTallWalls = new Set<string>();
	const hEntities = new Map<string, Entity>();
	const vEntities = new Map<string, Entity>();
	const cornerEntities = new Map<string, Entity>();

	for (const entity of map.entities) {
		if (wallHShortTypes.has(entity.type)) {
			const x = Math.floor(entity.x);
			const y = Math.floor(entity.y - WALL_Y_OFFSET + 0.001);
			const key = wallPreviewKey(x, y);
			hWalls.add(key);
			hEntities.set(key, entity);
		} else if (wallHFullTypes.has(entity.type)) {
			const x = Math.floor(entity.x);
			const y = Math.floor(entity.y - WALL_Y_OFFSET + 0.001);
			const key = wallPreviewKey(x, y);
			hWalls.add(key);
			hTallWalls.add(key);
			hEntities.set(key, entity);
		} else if (wallVShortTypes.has(entity.type)) {
			const x = Math.floor(entity.x + 0.001);
			const y = Math.floor(entity.y);
			const key = wallPreviewKey(x, y);
			vWalls.add(key);
			vEntities.set(key, entity);
		} else if (wallVFullTypes.has(entity.type)) {
			const x = Math.floor(entity.x + 0.001);
			const y = Math.floor(entity.y);
			const key = wallPreviewKey(x, y);
			vWalls.add(key);
			vTallWalls.add(key);
			vEntities.set(key, entity);
		} else if (wallCornerTypes.has(entity.type)) {
			const x = Math.floor(entity.x + 0.001);
			const y = Math.floor(entity.y - WALL_Y_OFFSET + 0.001);
			cornerEntities.set(wallPreviewKey(x, y), entity);
		}
	}

	return { hWalls, vWalls, hTallWalls, vTallWalls, hEntities, vEntities, cornerEntities };
}

function isTallHorizontalWallPreview(map: WorldMap, hTallWalls: Set<string>, x: number, y: number, wallTop: number) {
	return y <= wallTop || isTallWallArea(map, x, y) || hTallWalls.has(wallPreviewKey(x, y));
}

function getHorizontalWallPreviewEntity(
	map: WorldMap,
	walls: typeof woodenWalls,
	hTallWalls: Set<string>,
	x: number,
	y: number,
	wallTop: number,
) {
	if (isTallHorizontalWallPreview(map, hTallWalls, x, y, wallTop)) {
		return walls.wallH(x + 0.5, y + WALL_Y_OFFSET);
	}

	const hasTallLeft = x === 0 || isTallHorizontalWallPreview(map, hTallWalls, x - 1, y, wallTop);
	const hasTallRight = x === (map.width - 1) || isTallHorizontalWallPreview(map, hTallWalls, x + 1, y, wallTop);

	if (hasTallLeft !== hasTallRight) {
		return hasTallLeft
			? walls.wallCutL(x + 0.5, y + WALL_Y_OFFSET)
			: walls.wallCutR(x + 0.5, y + WALL_Y_OFFSET);
	}

	return walls.wallHShort(x + 0.5, y + WALL_Y_OFFSET);
}


export const engines = [
	{ name: 'Default', engine: Engine.Default },
	{ name: 'LayeredTiles', engine: Engine.LayeredTiles },
	{ name: 'Whiteness', engine: Engine.Whiteness },
	// { name: 'NewLighting', engine: Engines.NewLighting },
];

let pixelRatioEnabled = true;
let pixelRatioCache = 1;

function pixelRatio() {
	return pixelRatioEnabled ? pixelRatioCache : 1;
}

function integerPixelRatio() {
	return Math.max(1, Math.floor(pixelRatio()));
}

function getMovementFlag(x: number, y: number, walkKey: boolean) {
	const len = lengthOfXY(x, y);
	const walk = len < 0.5 || walkKey;
	return (x || y) ? (walk ? EntityState.PonyWalking : EntityState.PonyTrotting) : EntityState.None;
}

export const actionButtons: { dirty: boolean; draw(): void; }[] = [];

export function redrawActionButtons(force: boolean) {
	for (const button of actionButtons) {
		if (force || button.dirty) {
			button.draw();
		}
	}
}


@Injectable({ providedIn: 'root' })
export class PonyTownGame implements Game {
	private irisMode: EyeIrisMode = { left: 'normal', right: 'normal' };
	private irisModeActive = false;

	   getCurrentIrisMode(): EyeIrisMode {
			   // Для UI и логики: ручной режим всегда в приоритете только если он явно активен
			   var expr = this.player && this.player.ponyState && this.player.ponyState.expression;
			   if (this.irisModeActive) {
				   return {
					   left: this.irisMode.left,
					   right: this.irisMode.right,
				   };
			   }
			   return {
				   left: getIrisModeForEye(expr, 'left'),
				   right: getIrisModeForEye(expr, 'right'),
			   };
	   }
	fallbackPonies = new Map<number, Pony>();
	positions: { x: number; y: number; moved: boolean; }[] = [];
	lastChatMessageType = ChatType.Say;
	nextFriendsCRC = 0;
	editingActions = false;
	placeInQueue = 0;
	time = performance.now();
	lightData = createLightData(Season.Summer);
	worldState: WorldState | undefined = undefined;
	season = Season.Summer;
	holiday = Holiday.None;
	worldFlags = WorldStateFlags.None;
	showMinimap = false;
	minimap: Minimap | undefined = undefined;
	editor = {
		type: 'stoneWall',
		entityNames: [] as string[],
		entityTypesByName: {} as { [name: string]: number[]; },
		useEditorHammer: false,
		useEditorBroom: false,
		useEditorRope: false,
		useEditorPickaxe: false,
		useEditorSaw: false,
		useEditorShovel: false,
		brushSize: 1,
		tile: -1,
		elevation: '',
		special: '',
		draggingEntities: false,
		draggingStart: point(0, 0),
		selectingEntities: false,
		selectedEntities: [] as Entity[],
		customLight: false,
		lightColor: 'ffffff',
	};
	incompleteSays: IncompleteSay[] = [];
	shadowColor = SHADOW_COLOR;
	onChat = new Subject<void>();
	onToggleChat = new Subject<void>();
	onSearch = new Subject<void>();
	onCommand = new Subject<void>();
	onOpenTestModal = new Subject<void>();
	onOpenGameCharacter = new Subject<void>();
	onCancel = () => false;
	onClock = new BehaviorSubject<string>('');
	onJoined = new Subject<void>();
	onLeft = new Subject<void>();
	onFrame = new Subject<void>();
	onMessage = new Subject<ChatMessage>();
	messageQueue: ChatMessage[] = [];
	lastWhisperFrom: { entityId: number; accountId?: string; } | undefined = undefined;
	onPonyAddOrUpdate = new Subject<Pony>();
	onActionsUpdate = new Subject<void>();
	onPartyUpdate = new Subject<void>();
	announcements = new Subject<string>();
	onEntityIdUpdate = new Subject<{ old: number; new: number; }>();
	loaded = false;
	fullyLoaded = false;
	fps = 0;
	player: Pony | undefined = undefined;
	playerId: number | undefined = undefined;
	playerName: string | undefined = undefined;
	playerInfo: string | undefined = undefined;
	playerCRC: number | undefined = undefined;
	selected: Pony | undefined = undefined;
	party: PartyInfo | undefined = undefined;
	notifications: Notification[] = [];
	map = createWorldMap();
	camera = createCamera();
	paletteManager = new PaletteManager();
	tileSets?: TileSets;
	offlinePony = createPony(0, 0, OFFLINE_PONY, mockPaletteManager.addArray(defaultPalette), mockPaletteManager);
	supporterPony = createPony(0, 0, SUPPORTER_PONY, mockPaletteManager.addArray(defaultPalette), mockPaletteManager);
	discordPony = createPony(0, 0, DISCORD_PONY, mockPaletteManager.addArray(defaultPalette), mockPaletteManager);
	scale: number;
	rightOverride?: boolean;
	headTurnedOverride?: boolean;
	stateOverride?: EntityState;
	actions = createDefaultButtonActions();
	mod = false;
	webgl?: WebGL;
	actionsChanged = true;
	debug: DebugFlags = {};
	whisperTo: Entity | FakeEntity | undefined = undefined;
	findEntityFromChatLog: (id: number) => FakeEntity | undefined = () => undefined;
	findEntityFromChatLogByName: (name: string) => FakeEntity | undefined = () => undefined;
	private drawOptions: DrawOptions = {
		...defaultDrawOptions,
	};
	private input = new InputManager();
	socket?: ClientSocketService;
	private canvas?: HTMLCanvasElement;
	private statsText?: Text;
	private timeSize = 0;
	private lastStats = 0;
	private sent = 0;
	private recv = 0;
	private hideText = false;
	private hidePublicChat = false;
	private hover = point(0, 0);
	private wallHoverStillSince = performance.now();
	private wallHoverLastPointer = point(0, 0);
	private wallHoverHasPointerSample = false;
	private viewMatrix = createMat4();
	private fboMatrix = createMat4();
	private initialized = false;
	private changedScale = false;
	private baseTime = 0;
	private targetBaseTime = 0;
	private connectedTime = 0;
	private lastPixelRatio = pixelRatio();
	private resized = true;
	private resizedCamera = true;
	private bg = colorToFloatArray(BLACK);
	private deltaMultiplier = 1;
	private lastDraw = 0;
	private entitiesDrawn = 0;
	private lightEntitiesDrawn = 0;
	private lightSpriteEntitiesDrawn = 0;
	private lastFps = performance.now();
	private frames = 0;
	private drawFps = 0;
	private lastCanvasRatio = 0;
	private extraStats = '';
	private timingsText = '';
	private statsTextValue = '';
	private windowWidth = 0;
	private windowHeight = 0;
	private debugShortcuts: string[] = [];
	private cameraShiftOn = false;
	private cameraShiftTarget = 0;
	private debugShowingRange = false;
	private loseContext: WEBGL_lose_context | null = null;
	private showLookClickZones = false;
	private lastEyeClickTime = 0;
	private ignoreSelectionClearUntil = 0;
	private lastLookIris = Iris.Forward;
	private lastLookBaseLeft?: Eye;
	private lastLookBaseRight?: Eye;
	private lastIsKeyboardOpen = false;
	private element?: HTMLElement;
	private lastKeepAlive = 0;
	private showWallPlaceholder = false;
	private highlightEntity?: Entity;
	private _hoveredChatPony?: Pony;
	placeEntity = 0;
	placeTile = 0;
	constructor(
		public audio: Audio,
		private storage: StorageService,
		public settings: SettingsService,
		public model: Model,
		private errorReporter: ErrorReporter,
		private zone: NgZone,
	) {
		if (settings.browser.lowGraphicsMode !== undefined) {
			settings.browser.graphicsQuality = (settings.browser.lowGraphicsMode === true ? GraphicsQuality.Low : GraphicsQuality.High);
			settings.browser.lowGraphicsMode = undefined;
			settings.saveBrowserSettings();
		}
		if (settings.browser.graphicsQuality === undefined) {
			settings.browser.graphicsQuality = GraphicsQuality.High;
			settings.saveBrowserSettings();
		}

		this.scale = this.getScale();
		this.audio.initTracks(this.season, this.holiday, this.map.type);
		this.audio.setVolume(this.volume);
		this.debug = storage.getJSON('debug', {});
		this.showLookClickZones = !!this.settings.browser.showLookClickZones;
		this.drawOptions.error = message => errorReporter.reportError(message);
		this.onActionsUpdate.subscribe(() => this.actionsChanged = true);

		if (DEVELOPMENT) {
			attachDebugMethod('setScale', (x: number) => this.setScale(x));
			attachDebugMethod('game', this);
		}
	}
	get volume() {
		return this.settings.browser.volume || 0;
	}
	get disableLighting() {
		if (this.settings.browser.graphicsQuality === GraphicsQuality.Low) {
			return true;
		}
		if (this.webgl) {
			return this.webgl.failedFBO;
		}
		return false;
	}
	get disableLightMasksFixing() {
		if (this.settings.browser.graphicsQuality !== GraphicsQuality.High) {
			return true;
		}
		if (this.webgl) {
			return this.webgl.failedDepthBuffer;
		}
		return false;
	}
	get frameDelay() {
		return (this.settings.browser.powerSaving || this.editingActions) ? (1000 / 45) : 0;
	}
	get engine() {
		return BETA ? (this.debug.engine || Engine.Default) : Engine.Default;
	}
	set engine(value: Engine) {
		if (BETA) {
			this.debug.engine = value;
			this.saveDebug();
		}
	}
	get hoveredChatPony() {
		return this._hoveredChatPony;
	}
	apply = (func: () => void) => {
		return this.zone.run(func);
	}
	applyChanges = () => this.zone.run(() => { });
	private getZoomBounds() {
		return getZoomScaleBounds(this.model.supporter || 0);
	}

	private getScale() {
		const defaultScale = pixelRatio() > 1 ? 3 : 2;
		const raw = this.settings.browser.scale;
		const scale = raw !== undefined && raw !== null ? Number(raw) : defaultScale;
		const bounds = this.getZoomBounds();
		return clamp(Number.isFinite(scale) ? scale : defaultScale, bounds.min, bounds.max);
	}

	private getZoomPresets() {
		const bounds = this.getZoomBounds();
		return ZOOM_PRESETS.filter(z => z >= bounds.min && z <= bounds.max);
	}

	private setScale(scale: number) {
		const bounds = this.getZoomBounds();
		const clamped = clamp(scale, bounds.min, bounds.max);
		if (this.scale !== clamped) {
			this.scale = clamped;
			this.settings.browser.scale = this.scale;
			this.settings.saveBrowserSettings();
			this.changedScale = true;
		}
	}
	private toggleDisableLighting() {
		if (!this.webgl) {
			return;
		}
		if (!this.webgl.failedFBO) {
			if (this.settings.browser.graphicsQuality === GraphicsQuality.Low) {
				this.settings.browser.graphicsQuality = GraphicsQuality.High;
			}
			else {
				this.settings.browser.graphicsQuality = GraphicsQuality.Low;
			}
			this.settings.saveBrowserSettings();
		}
	}
	debugEditorUndo() {
		if (BETA && this.mod) {
			this.send(server => server.editorAction({ type: 'undo' }));
		}
	}
	debugEditorRemoveSelected() {
		if (!BETA) return;

		this.apply(() => {
			const entities = this.editor.selectedEntities.map(e => e.id);
			this.send(server => server.editorAction({ type: 'remove', entities }));
			this.editor.selectedEntities.length = 0;
		});
	}
	debugEditorMoveSelected(dx: number, dy: number) {
		if (!BETA) return;

		this.editor.selectedEntities.forEach(({ id, x, y }) => {
			this.send(server => server.editorAction({
				type: 'move',
				entities: [{ id, x: x + dx, y: y + dy }],
			}));
		});
	}
	debugToggleMinimap() {
		if (BETA) {
			this.showMinimap = !this.showMinimap;
		}
	}
	debugRunHeadTurnTest(useShiftMode: boolean) {
		if (!BETA || !this.player) return;

		if (useShiftMode) {
			let faceDir = 0;
			let dir = 1;
			this.player.doAction = DoAction.Swing;
			const state = this.player.ponyState;

			const interval = setInterval(() => {
				faceDir += dir;

				if (faceDir < 0) {
					clearInterval(interval);
					return;
				}

				state.headTurn = faceDir;

				if (faceDir === 3) {
					turnHeadAction(this);
				}

				if (faceDir >= 6) {
					dir = -1;
				}
			}, 1000 / 24);
		} else {
			let faceDir = 0;
			const state = this.player.ponyState;

			const interval = setInterval(() => {
				faceDir++;
				state.headTurn = faceDir;

				if (faceDir === 3) {
					turnHeadAction(this);
				}

				if (faceDir >= 7) {
					clearInterval(interval);
				}
			}, 1000 / 24);
		}
	}
	debugToggleShowInfo() {
		if (!BETA) return;
		this.debug.showInfo = !this.debug.showInfo;
		this.saveDebug();
	}
	debugToggleWaterBounds() {
		if (BETA) {
			this.drawOptions.showHeightmap = !this.drawOptions.showHeightmap;
		}
	}
	debugToggleCollisionMap() {
		if (BETA) {
			this.drawOptions.showColliderMap = !this.drawOptions.showColliderMap;
		}
	}
	debugToggleHelpers() {
		if (!BETA) return;
		this.debug.showHelpers = !this.debug.showHelpers;
		this.saveDebug();
	}
	debugToggleTileIndices() {
		if (BETA) {
			this.drawOptions.tileIndices = !this.drawOptions.tileIndices;
		}
	}
	debugToggleTileGrid() {
		if (BETA) {
			this.drawOptions.tileGrid = !this.drawOptions.tileGrid;
		}
	}
	debugToggleGrayscale() {
		if (BETA) {
			document.documentElement.style.filter = document.documentElement.style.filter ? '' : 'grayscale(100%)';
		}
	}
	debugToggleRegions() {
		if (!BETA) return;
		this.debug.showRegions = !this.debug.showRegions;
		this.saveDebug();
	}
	debugToggleChatlogRange() {
		if (!DEVELOPMENT) return;
		this.debugShowingRange = !this.debugShowingRange;
		updateRangeIndicator(this.debugShowingRange ? this.settings.account.chatlogRange : undefined, this);
	}
	debugToggleCameraShift() {
		if (!DEVELOPMENT) return;
		this.cameraShiftOn = !this.cameraShiftOn;
		this.cameraShiftTarget = 400;
	}
	debugTogglePalette() {
		if (!DEVELOPMENT) return;
		this.debug.showPalette = !this.debug.showPalette;
		this.saveDebug();
	}
	debugToggleWebglContextLoss() {
		if (!DEVELOPMENT || !this.webgl) return;

		if (this.loseContext) {
			this.loseContext.restoreContext();
			this.loseContext = null;
		} else {
			this.loseContext = this.webgl.gl.getExtension('WEBGL_lose_context')!;
			this.loseContext.loseContext();
		}
	}
	debugToggleBrightNight() {
		if (DEVELOPMENT) {
			this.settings.browser.brightNight = !this.settings.browser.brightNight;
		}
	}
	debugRunActionR() {
		if (!DEVELOPMENT) return;

		this.apply(() => {
			if (!Date.now() && this.player) {
				const bounds = getInteractBounds(this.player);
				const entities = this.map.entities.filter(e =>
					e !== this.player && boundsIntersect(e.x, e.y, e.bounds, 0, 0, bounds));

				if (entities.length) {
					const entity = entities[0];
					const typeName = getEntityTypeName(entity.type);
					this.announce(`${typeName}${entities.length > 1 ? ` (1 of ${entities.length})` : ''}`);
				} else {
					this.announce('nothing');
				}
			}
		});
	}
	debugAdjustHeadTilt(delta: number) {
		if (!DEVELOPMENT || !this.player) return;
		this.player.ponyState.headTilt = (this.player.ponyState.headTilt || 0) + delta;
	}
	debugSetNomAnimation() {
		if (DEVELOPMENT && this.player) {
			setHeadAnimation(this.player, nom);
		}
	}
	debugLeaveServer() {
		if (DEVELOPMENT) {
			this.send(server => server.leave());
		}
	}
	debugToggleDisableLighting() {
		if (DEVELOPMENT) {
			this.toggleDisableLighting();
		}
	}
	debugLogPlayerPosition() {
		if (!DEVELOPMENT || !this.player) return;

		console.log(
			`position: ${this.player.x.toFixed(2)}, ${this.player.y.toFixed(2)} ` +
			`region: ${Math.floor(this.player.x / REGION_SIZE)}, ${Math.floor(this.player.y / REGION_SIZE)}`);
	}
	debugToggleCurlTail() {
		if (!DEVELOPMENT || !this.player) return;

		const state = this.player.ponyState;
		state.flags = setFlag(state.flags, PonyStateFlags.CurlTail, !hasFlag(state.flags, PonyStateFlags.CurlTail));
	}
	debugPlayRandomTrack() {
		if (DEVELOPMENT) {
			this.audio.playRandomTrack();
		}
	}
	debugToggleWalls() {
		if (DEVELOPMENT) {
			toggleWalls();
		}
	}
	debugSetDeltaMultiplier(value: number) {
		if (DEVELOPMENT) {
			this.deltaMultiplier = value;
		}
	}
	debugToggleLookClickZones() {
		this.showLookClickZones = !this.showLookClickZones;
		this.settings.browser.showLookClickZones = this.showLookClickZones;
		this.settings.saveBrowserSettings();
	}
	debugAreLookClickZonesEnabled() {
		return this.showLookClickZones;
	}
	send<T>(action: (server: IServerActions) => T) {
		if (this.socket && this.socket.isConnected) {
			return action(this.socket.server);
		} else {
			return undefined;
		}
	}
	changeScale() {
		const presets = this.getZoomPresets();
		const next = presets.find(z => z > this.scale + 1e-6);
		this.setScale(next !== undefined ? next : (presets[0] || this.scale));
		this.changedScale = true;
	}
	zoomIn() {
		const presets = this.getZoomPresets();
		const next = presets.find(z => z > this.scale + 1e-6);
		this.setScale(next !== undefined ? next : this.getZoomBounds().max);
	}
	zoomOut() {
		const presets = this.getZoomPresets().slice().reverse();
		const previous = presets.find(z => z < this.scale - 1e-6);
		this.setScale(previous !== undefined ? previous : this.getZoomBounds().min);
	}
	ignoreSelectionClear(duration = 150) {
		this.ignoreSelectionClearUntil = performance.now() + duration;
	}
	select(pony: Pony | undefined) {
		if (this.selected === pony)
			return;

		if (pony && isHidden(pony) && !this.mod)
			return;

		this.zone.run(() => {
			if (this.selected) {
				this.selected.selected = false;
			}

			this.selected = pony;

			if (pony && !pony.info && !pony.palettePonyInfo) {
				this.send(server => server.select(pony.id, SelectFlags.FetchEx | SelectFlags.FetchInfo));
			} else {
				this.sendSelected();
			}

			if (this.selected) {
				this.selected.selected = true;
			}
		});
	}
	private sendSelected = debounce(() => {
		const pony = this.selected;
		const id = pony ? pony.id : 0;
		const fetchEx = !!pony && !hasExtendedInfo(pony);
		this.send(server => server.select(id, fetchEx ? SelectFlags.FetchEx : SelectFlags.None));
	}, 300);
	load() {
		return loadAndInitSpriteSheets()
			.then(initializeTileHeightmaps);
	}
	init() {
		this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
		this.updateTileSets();
		this.input.initialize(this.canvas);

		if (!this.initialized) {
			this.canvas.addEventListener('webglcontextlost', e => {
				e.preventDefault();
				DEVELOPMENT && console.warn('Context lost');
				this.errorReporter.captureEvent({ name: 'Context lost' });
			});

			this.canvas.addEventListener('webglcontextrestored', () => {
				DEVELOPMENT && console.warn('Context restored');
				this.errorReporter.captureEvent({ name: 'Context restored' });

				if (this.webgl) {
					this.webgl = initWebGLResources(this.webgl.gl, this.paletteManager, this.camera);
				}
			});

			this.initialized = true;
			this.input.onAnyInput(() => this.resetAfk());
			this.input.onPressed(Key.ENTER, () => this.onChat.next());
			this.input.onPressed(Key.KEY_O, () => this.zoomOut());
			this.input.onPressed(Key.KEY_P, () => this.zoomIn());
			this.input.onPressed(Key.ESCAPE, () => this.escape());
			this.input.onPressed(Key.GAMEPAD_BUTTON_X, () => this.onToggleChat.next());
			// this.input.onPressed(Key.BACKSPACE, () => this.backspace());
			this.input.onPressed(Key.KEY_H, () => turnHeadAction(this));
			this.input.onPressed(Key.FORWARD_SLASH, () => this.onCommand.next());
			this.input.onPressed([Key.KEY_B, Key.GAMEPAD_BUTTON_B, Key.TOUCH_SECOND_CLICK], () => boopAction(this));
			this.input.onPressed([Key.KEY_E, Key.GAMEPAD_BUTTON_A], () => {
				interact(this, this.input.isPressed(Key.SHIFT));
			});
			this.input.onPressed([Key.KEY_X, Key.GAMEPAD_BUTTON_DOWN], () => downAction(this));
			this.input.onPressed([Key.KEY_C, Key.GAMEPAD_BUTTON_UP], () => {
				if (!this.input.isPressed(Key.CTRL)) {
					upAction(this);
				}
			});
			this.input.onPressed(Key.KEY_F, () => {
				if (this.input.isPressed(Key.CTRL)) {
					this.onSearch.next();
				}
			});
			this.input.onPressed(Key.F2, () => {
				if (!this.settings.browser.disableFKeys) {
					this.hideText = !this.hideText;
					this.hidePublicChat = false;
				}
			});
			this.input.onPressed(Key.F3, () => {
				if (!this.settings.browser.disableFKeys) {
					this.hideText = false;
					this.hidePublicChat = !this.hidePublicChat;
				}
			});
			this.input.onPressed(Key.F4, () => {
				if (!this.settings.browser.disableFKeys) {
					this.settings.account.seeThroughObjects = !this.settings.account.seeThroughObjects;
					this.settings.saveAccountSettings(this.settings.account);
					const message = this.settings.account.seeThroughObjects
						? 'Включён показ сквозь объекты'
						: 'Отключён показ сквозь объекты';
					this.announcements.next(message);
				}
			});

			this.input.onPressed(Key.F6, () => {
				if (!this.settings.browser.disableFKeys) {
					this.settings.account.disableUI = !this.settings.account.disableUI;
					this.settings.saveAccountSettings(this.settings.account);
					const message = this.settings.account.disableUI
						? 'Отключён интерфейс'
						: 'Включён интерфейс';
					this.announcements.next(message);
				}
			});

			this.input.onPressed(Key.F5, () => {
				if (!this.settings.browser.disableFKeys && this.settings.browser.enableTestModalHotkey !== false) {
					this.onOpenTestModal.next();
				}
			});

			[
				Key.KEY_1, Key.KEY_2, Key.KEY_3, Key.KEY_4, Key.KEY_5, Key.KEY_6,
				Key.KEY_7, Key.KEY_8, Key.KEY_9, Key.KEY_0, Key.DASH, Key.EQUALS,
			].forEach((key, index) => this.input.onPressed(key, () => {
				if (this.actions[index]) {
					this.zone.run(() => useAction(this, this.actions[index].action));
				}
			}));

			// also bind numpad 0 to the same action as top-row 0 (index 9)
			this.input.onPressed(Key.NUMPAD_0, () => {
				const index = 9;
				if (this.actions[index]) {
					this.zone.run(() => useAction(this, this.actions[index].action));
				}
			});

			this.debugShortcuts.length = 0;

			window.addEventListener('resize', () => {
				this.resized = true;
				DEVELOPMENT && log(`resized ${window.innerHeight} (${window.scrollY})`);
			});

			this.canvas.addEventListener('touchstart', () => this.audio.touch());
		}

		this.resized = true;

		if (!this.webgl) {
			this.initWebGL();
		}
	}
	leave() {
		if (this.socket) {
			if (this.socket.isConnected) {
				this.socket.server.leave();
			} else {
				this.socket.disconnect();
			}
		}
	}
	joined() {
		this.connectedTime = Math.round(performance.now());
		this.onJoined.next();
	}
	togglePixelRatio() {
		pixelRatioEnabled = !pixelRatioEnabled;
	}
	private escape() {
		if (this.socket && !this.onCancel()) {
			this.select(undefined);
		}
	}
	backspace() {
		if (this.player && this.player.says !== undefined) {
			this.send(server => server.say(0, '.', ChatType.Dismiss));
		}
	}
	private initWebGL() {
		this.errorReporter.captureEvent({ name: 'game.initWebGL' });

		if (!this.canvas) {
			throw new Error('Missing canvas');
		}

		try {
			this.resizeCamera();
			this.webgl = initWebGL(this.canvas, this.paletteManager, this.camera);
			const { failedFBO, palettes, renderer } = this.webgl;

			if (renderer) {
				this.errorReporter.configureData({ renderer });
			}

			if (failedFBO) {
				this.errorReporter.captureEvent({ name: 'game.initWebGL failed FBO' });
			}

			this.offlinePony = createPony(0, 0, OFFLINE_PONY, palettes.defaultPalette, this.paletteManager);
			this.supporterPony = createPony(0, 0, SUPPORTER_PONY, palettes.defaultPalette, this.paletteManager);
			this.discordPony = createPony(0, 0, DISCORD_PONY, palettes.defaultPalette, this.paletteManager);
			initializeToys(this.paletteManager);
		} catch (e) {
			const err: any = e as any;
			this.errorReporter.captureEvent({ name: 'failed game.initWebGL', error: err.message, stack: err.stack });
			this.releaseWebGL();
			DEVELOPMENT && console.error(err);
			throw new Error(`Failed to initialize graphics device (${err.message})`);
		}
	}
	private releaseWebGL() {
		this.errorReporter.captureEvent({ name: 'game.releaseWebGL' });

		if (this.webgl) {
			try {
				this.paletteManager.dispose(this.webgl.gl);
				disposeWebGL(this.webgl);
			} catch (e) {
				const err: any = e as any;
				DEVELOPMENT && console.error(err);
			}

			this.webgl = undefined;
		}
	}
	private resizeCamera() {
		if (this.canvas) {
			const actualScale = this.scale * integerPixelRatio();
			const w = clamp(Math.ceil(this.canvas.width / actualScale), CAMERA_WIDTH_MIN, CAMERA_WIDTH_MAX);
			const h = clamp(Math.ceil(this.canvas.height / actualScale), CAMERA_HEIGHT_MIN, CAMERA_HEIGHT_MAX);

			if (this.camera.w !== w || this.camera.h !== h) {
				this.camera.w = w;
				this.camera.h = h;
				this.resizedCamera = true;
			}
		}
	}
	release() {
		this.settings.saving(() => false);
		this.loaded = false;
		this.fullyLoaded = false;
		this.player = undefined;
		this.selected = undefined;
		this.party = undefined;
		this.rightOverride = undefined;
		this.headTurnedOverride = undefined;
		this.stateOverride = undefined;
		this.notifications = [];
		this.map = createWorldMap();
		this.camera = createCamera();

		if (this.socket) {
			this.socket.disconnect();
			this.socket = undefined;
		}
		this.audio.stop();
		this.input.release();
		this.releaseWebGL();
	}
	startup(socket: ClientSocketService, mod: boolean) {
		if (this.settings.account.actions) {
			this.actions = deserializeActions(this.settings.account.actions);
		} else {
			this.actions = createDefaultButtonActions();
		}

		const saveSettings = (settings: AccountSettings) => this.send(server => server.saveSettings(settings));
		const saveSettingsDebounced = debounce(saveSettings, 1500);

		this.element = document.getElementById('app-game')!;
		this.settings.saving(settings => (saveSettingsDebounced(settings), true));
		this.lastChatMessageType = ChatType.Say;
		this.selected = undefined;
		this.party = undefined;
		this.socket = socket;
		this.audio.setVolume(this.volume);
		// this.audio.play();
		this.mod = mod;
		this.nextFriendsCRC = performance.now() + 5 * SECOND;

		if (DEVELOPMENT) {
			initLogger(message => this.onMessage.next({
				id: 1, crc: 1, name: 'log', type: MessageType.System,
				message: `[${((performance.now() | 0) % 10000)}] ${message}`
			}));
		}

		if (DEVELOPMENT && LOG_POSITION) {
			this.positions.length = 0;
		}
	}
	private resetAfk() {
		if (!this.socket || !this.socket.isConnected) {
			return;
		}

		const now = performance.now();
		if (now - this.lastKeepAlive < 1000) {
			return;
		}

		this.lastKeepAlive = now;
		this.send(server => server.action(Action.KeepAlive));
	}
	private getPixelScale() {
		return this.scale * (integerPixelRatio() / pixelRatio());
	}
	update(delta: number, now: number, last: number) {
		TIMING && timeStart('update');
		delta *= this.deltaMultiplier;

		const shiftSpeed = delta * 10;

		if (this.cameraShiftOn && this.camera.shiftRatio !== 1) {
			this.camera.shiftRatio = Math.min(1, this.camera.shiftRatio + shiftSpeed);
		} else if (!this.cameraShiftOn && this.camera.shiftRatio !== 0) {
			this.camera.shiftRatio = Math.max(0, this.camera.shiftRatio - shiftSpeed);
		}

		const updateScale = this.getPixelScale();
		const updateScreenHover = point(this.input.pointerX / updateScale, this.input.pointerY / updateScale);
		const updateHover = screenToWorld(this.camera, updateScreenHover);

		if (this.input.usingTouch && !this.input.wasPressed(Key.TOUCH_CLICK) && !this.input.isPressed(Key.TOUCH)) {
			updateHover.x = -1;
			updateHover.y = -1;
		}

		const hoveredChatBubble = this.hideText ? undefined : getChatBubbleAt(
			this.map.entitiesWithChat,
			this.player,
			this.camera,
			this.mod,
			this.hidePublicChat,
			updateHover,
			updateScreenHover,
		);
		const hoveredChatEntity = this.hideText ? undefined : getChatEntityAt(
			this.map.entitiesWithChat,
			this.player,
			this.camera,
			this.mod,
			this.hidePublicChat,
			updateHover,
			updateScreenHover,
		);

		const canHoverChatBubbleProfile = (entity: Pony) => {
			const isOwnBubble = entity.id === (this.player ? this.player.id : undefined);
			return isOwnBubble
				? !!this.settings.account.showOwnChatBubbleProfile
				: !!this.settings.account.showChatBubbleProfiles;
		};

		// Update hover state only if entity actually changed
		const shouldHighlightChatBubble = hoveredChatEntity && hoveredChatEntity.type === PONY_TYPE && canHoverChatBubbleProfile(hoveredChatEntity as Pony);
		if (shouldHighlightChatBubble) {
			const newHoveredPony = hoveredChatEntity as Pony;
			// Reset old hovered pony if it changed
			if (this._hoveredChatPony && this._hoveredChatPony !== newHoveredPony) {
				this._hoveredChatPony.chatHovered = false;
				this._hoveredChatPony.chatHoverColor = undefined;
			}
			// Set new hovered pony
			this._hoveredChatPony = newHoveredPony;
			this._hoveredChatPony.chatHovered = true;
			this._hoveredChatPony.chatHoverColor = HOVER_OUTLINE_COLOR;
		} else if (hoveredChatEntity === undefined && this._hoveredChatPony) {
			// Only clear hover if no entity is hovered (not just different entity)
			this._hoveredChatPony.chatHovered = false;
			this._hoveredChatPony.chatHoverColor = undefined;
			this._hoveredChatPony = undefined;
		} else if (this._hoveredChatPony && (!hoveredChatEntity || hoveredChatEntity.type !== PONY_TYPE || !canHoverChatBubbleProfile(hoveredChatEntity as Pony))) {
			this._hoveredChatPony.chatHovered = false;
			this._hoveredChatPony.chatHoverColor = undefined;
			this._hoveredChatPony = undefined;
		}

		updateMap(this.map, delta);

		if (!this.socket || !this.socket.isConnected || !this.element)
			return;

		this.updateGameTime(delta);

		if (this.lastPixelRatio !== pixelRatio()) {
			this.lastPixelRatio = pixelRatio();
			this.resized = true;
		}

		if (this.resized) {
			this.resizeCanvas();
		}

		const player = this.player;
		const camera = this.camera;
		const input = this.input;
		const server = this.socket.server;

		restorePlayerPosition();

		input.disabledGamepad = !!this.settings.browser.disableGamepad;
		input.update();

		this.resizeCamera();
		this.updateCameraShift();

		const actualScale = this.scale * integerPixelRatio();
		this.camera.offset = this.cameraShiftTarget / actualScale;

		let moved = false;

		if (player && this.loaded) {
			if (BETA && this.editor.selectedEntities.length) {
				input.disableArrows = true;
			}

			updateWallPlaceholder(this, player);

			if (this.highlightEntity) {
				if (this.highlightEntity.id === 0) {
					releaseEntity(this.highlightEntity);
				}

				this.highlightEntity = undefined;
			}

			const shift = input.isPressed(Key.SHIFT);
			const x = this.fullyLoaded ? input.axisX : 0;
			const y = this.fullyLoaded ? input.axisY : 0;
			const dir = vectorToDir(x, y);
			const vec = (x || y) ? dirToVector(dir) : { x: 0, y: 0 };
			const walk = input.isMovementFromButtons ? (this.settings.browser.walkByDefault ? !shift : shift) : false;
			const flags = getMovementFlag(x, y, walk);
			// apply server-provided speed multiplier if present (default 1)
			// apply optional server-specified speed multiplier
		const speed = flagsToSpeed(flags) * (player.speedMultiplier || 1);
			const vx = vec.x * speed;
			const vy = vec.y * speed;

			if (BETA) {
				input.disableArrows = false;
			}

			if (player.vx !== vx || player.vy !== vy) {
				if (vx === 0) {
					player.x = roundPositionX(player.x) + 0.5 / tileWidth;
				}

				if (vy === 0) {
					player.y = roundPositionY(player.y) + 0.5 / tileHeight;
				}

				const time = (last - this.connectedTime) >>> 0;
				const [a, b, c, d, e] = encodeMovement(player.x, player.y, dir, flags, time, camera);
				server.move(a, b, c, d, e);
				moved = true;
				this.resizedCamera = false;
			}

			if ((vx || vy) && (isPonySitting(player) || isPonyLying(player))) {
				player.state = setPonyState(player.state, EntityState.PonyStanding);
			}

			updateEntityVelocity(this.map, player, vx, vy);

			const facingRight = isFacingRight(player);
			const right = isMovingRight(vx, facingRight);

			if (facingRight !== right) {
				player.state = setFlag(player.state, EntityState.FacingRight, right);
				player.state = setFlag(player.state, EntityState.HeadTurned, false);
				this.rightOverride = right;
			}

			updateCamera(camera, player, this.map);

			const scale = this.getPixelScale();
			const hover = screenToWorld(camera, point(input.pointerX / scale, input.pointerY / scale));

			if (input.usingTouch && !input.wasPressed(Key.TOUCH_CLICK) && !input.isPressed(Key.TOUCH)) {
				hover.x = -1;
				hover.y = -1;
			}

			this.hover = hover;

			const nowPointerTime = performance.now();
			if (!this.wallHoverHasPointerSample) {
				this.wallHoverHasPointerSample = true;
				this.wallHoverLastPointer.x = input.pointerX;
				this.wallHoverLastPointer.y = input.pointerY;
				this.wallHoverStillSince = nowPointerTime;
			} else {
				const movedX = Math.abs(input.pointerX - this.wallHoverLastPointer.x);
				const movedY = Math.abs(input.pointerY - this.wallHoverLastPointer.y);

				if (movedX > WALL_HOVER_POINTER_EPS || movedY > WALL_HOVER_POINTER_EPS) {
					this.wallHoverLastPointer.x = input.pointerX;
					this.wallHoverLastPointer.y = input.pointerY;
					this.wallHoverStillSince = nowPointerTime;
				}
			}

			if (this.fullyLoaded) {
				if (BETA && this.editor.draggingEntities) {
					editorDragEntities(this, hover, input.isPressed(Key.MOUSE_BUTTON2));
				}

				updateBuildingPreviews(this, player, hover, server, input);

				if (handleDragTool(this, player, hover, input)) {
					// handled in building utils
				} else if (handleWallPaintDrag(this, player, hover, server, input)) {
					// handled in building utils
				} else if (handleTilePaintDrag(this, player, hover, server, input)) {
					// handled in building utils
				} else if (input.wasPressed(Key.MOUSE_BUTTON1) || input.wasPressed(Key.TOUCH_CLICK)) {
					if (BETA && this.editor.useEditorHammer && this.mod) {
						server.editorAction({ type: 'place', entity: this.editor.type, x: hover.x, y: hover.y });
						console.log(`${this.editor.type}(${hover.x.toFixed(2)}, ${hover.y.toFixed(2)})`);
					} else if (BETA && this.editor.useEditorBroom && this.mod) {
						handleEditorBroomClick(this, hover);
					} else {
					   const pickedEntities = pickEntities(this.map, hover, shift, this.mod);
					   const pickedEntity = pickedEntities[(pickedEntities.indexOf(this.selected!) + 1) % pickedEntities.length];
					   const holdingRemoveTool = player.hold === removeEntitiesTool.type;
					   const holdingPlaceTool = player.hold === placeEntitiesTool.type;
					   const editableMap = hasFlag(this.map.flags, MapFlags.EditableEntities);
					   const holdingTool = holdingRemoveTool || holdingPlaceTool;

					   const nowClick = performance.now();
					   const isDouble = this.lastEyeClickTime > 0 && (nowClick - this.lastEyeClickTime) < 350;
					   const clickNearSelf = distanceXY(player.x, player.y, hover.x, hover.y) < TILE_CHANGE_RANGE;
					   const screenHover = point(input.pointerX / scale, input.pointerY / scale);
					   const chatEntity = getChatEntityAt(
						   this.map.entitiesWithChat,
						   this.player,
						   this.camera,
						   this.mod,
						   this.hidePublicChat,
						   hover,
						   screenHover,
					   );

					   if (BETA && this.editor.selectingEntities) {
						   editorSelectEntities(this, hover, shift);
					   } else if (chatEntity && chatEntity.type === PONY_TYPE) {
						   const playerId = this.player ? this.player.id : undefined;
								   const isOwnBubble = chatEntity.id === playerId;
						   const canOpenBubbleProfile = isOwnBubble
							   ? !!this.settings.account.showOwnChatBubbleProfile
							   : !!this.settings.account.showChatBubbleProfiles;
						   if (canOpenBubbleProfile) {
							   this.select(chatEntity as Pony);
						   } else if (pickedEntity && (!holdingTool || !editableMap || hasFlag(pickedEntity.flags, EntityFlags.IgnoreTool))) {
							   if (pickedEntity.type === PONY_TYPE) {
								   this.select(pickedEntity as Pony);
							   } else if (entityInRange(pickedEntity, player)) {
								   server.interact(pickedEntity.id, hover.x, hover.y);
							   }
						   } else if (this.selected && distanceXY(player.x, player.y, hover.x, hover.y) >= TILE_CHANGE_RANGE) {
							   if (nowClick >= this.ignoreSelectionClearUntil) {
								   this.select(undefined);
							   }
						   } else if (handleBuildingActionClick(
							   this,
							   player,
							   hover,
							   server,
							   holdingRemoveTool,
							   holdingPlaceTool,
							   editableMap,
						   )) {
						   } else if (clickNearSelf && isDouble) {
							   // Взгляд только если не выбран инструмент дома
							   const { x: headX, y: headY } = this.getHeadLookAnchor(player);
							   const iris = this.getLookIrisFromHeadDelta(hover.x - headX, hover.y - headY);
							   this.setIris(iris);
							   this.lastEyeClickTime = 0;
						   } else if (clickNearSelf && !isDouble) {
							   this.lastEyeClickTime = nowClick;
							   if (this.selected) {
								   if (nowClick >= this.ignoreSelectionClearUntil) {
									   this.select(undefined);
								   }
							   } else if (hasFlag(this.map.flags, MapFlags.EdibleGrass)) {
								   const tile = getTile(this.map, hover.x, hover.y);
								   if (isValidTile(tile) && distanceXY(player.x, player.y, hover.x, hover.y) < TILE_CHANGE_RANGE) {
									   const x = hover.x | 0;
									   const y = hover.y | 0;
									   let type = tile === TileType.Grass ? TileType.Dirt : TileType.Grass;
									   server.changeTile(x, y, type);
								   }
							   } else if (DEVELOPMENT && this.engine === Engine.LayeredTiles && this.editor.elevation) {
								   const value = getElevation(this.map, hover.x, hover.y);
								   setElevation(this.map, hover.x, hover.y, clamp(this.editor.elevation === 'up' ? value + 1 : value - 1, 0, 10));
							   }
						   }
					   } else if (pickedEntity && (!holdingTool || !editableMap || hasFlag(pickedEntity.flags, EntityFlags.IgnoreTool))) {
						   if (pickedEntity.type === PONY_TYPE) {
							   this.select(pickedEntity as Pony);
						   } else if (entityInRange(pickedEntity, player)) {
							   server.interact(pickedEntity.id, hover.x, hover.y);
						   }
					   } else if (this.selected && distanceXY(player.x, player.y, hover.x, hover.y) >= TILE_CHANGE_RANGE) {
						   if (nowClick >= this.ignoreSelectionClearUntil) {
							   this.select(undefined);
						   }
					   } else if (handleBuildingActionClick(
						   this,
						   player,
						   hover,
						   server,
						   holdingRemoveTool,
						   holdingPlaceTool,
						   editableMap,
					   )) {
					   } else if (clickNearSelf && isDouble) {
						   // Взгляд только если не выбран инструмент дома
						   const { x: headX, y: headY } = this.getHeadLookAnchor(player);
						   const iris = this.getLookIrisFromHeadDelta(hover.x - headX, hover.y - headY);
						   this.setIris(iris);
						   this.lastEyeClickTime = 0;
					   } else if (clickNearSelf && !isDouble) {
						   this.lastEyeClickTime = nowClick;
						   if (this.selected) {
							   if (nowClick >= this.ignoreSelectionClearUntil) {
								   this.select(undefined);
							   }
						   } else if (hasFlag(this.map.flags, MapFlags.EdibleGrass)) {
							   const tile = getTile(this.map, hover.x, hover.y);
							   if (isValidTile(tile) && distanceXY(player.x, player.y, hover.x, hover.y) < TILE_CHANGE_RANGE) {
								   const x = hover.x | 0;
								   const y = hover.y | 0;
								   let type = tile === TileType.Grass ? TileType.Dirt : TileType.Grass;
								   server.changeTile(x, y, type);
							   }
						   } else if (DEVELOPMENT && this.engine === Engine.LayeredTiles && this.editor.elevation) {
							   const value = getElevation(this.map, hover.x, hover.y);
							   setElevation(this.map, hover.x, hover.y, clamp(this.editor.elevation === 'up' ? value + 1 : value - 1, 0, 10));
						   }
					   }
					}
				   }

				   // --- Новый обработчик правой кнопки мыши ---
				handleBuildingRightClick(this, hover, input);

				if (BETA && input.wasPressed(Key.MOUSE_BUTTON3) && this.mod && !this.editor.useEditorHammer) {
						server.editorAction({ type: 'place', entity: this.editor.type, x: hover.x, y: hover.y });
						console.log(`${this.editor.type}(${hover.x.toFixed(2)}, ${hover.y.toFixed(2)})`);
				}

				handleBuildingWheel(this, input);

				const isHeadTurned = hasFlag(player.state, EntityState.HeadTurned);
				const isHeadFacingRight = right ? !isHeadTurned : isHeadTurned;

				if (((input.axis2X < 0 && isHeadFacingRight) || (input.axis2X > 0 && !isHeadFacingRight))) {
					if (server.action(Action.TurnHead) as any) {
						player.state = (player.state) ^ EntityState.HeadTurned;
					}
				}

								// взгляд по numpad
								if (input.wasPressed(Key.NUMPAD_4)) this.setIrisFromZone(-1, 0);
								if (input.wasPressed(Key.NUMPAD_6)) this.setIrisFromZone(1, 0);
								if (input.wasPressed(Key.NUMPAD_8)) this.setIrisFromZone(0, -1);
								if (input.wasPressed(Key.NUMPAD_2)) this.setIrisFromZone(0, 1);
								if (input.wasPressed(Key.NUMPAD_7)) this.setIrisFromZone(-1, -1);
								if (input.wasPressed(Key.NUMPAD_9)) this.setIrisFromZone(1, -1);
								if (input.wasPressed(Key.NUMPAD_1)) this.setIrisFromZone(-1, 1);
								if (input.wasPressed(Key.NUMPAD_3)) this.setIrisFromZone(1, 1);
								if (input.wasPressed(Key.NUMPAD_5)) this.setIris(Iris.Forward);
							// Переключатель ручного режима для обоих глаз взгляда
							if (input.wasPressed(Key.SUBTRACT)) {
								this.irisMode = {
									left: this.irisMode.left === 'shocked' ? 'normal' : 'shocked',
									right: this.irisMode.right === 'shocked' ? 'normal' : 'shocked',
								};
					this.irisModeActive = true;
					if (this.player) this.applyIrisToPlayer(this.player, this.lastLookIris);
				}

						if (input.wasPressed(Key.DECIMAL) || input.wasPressed(Key.COMMA)) this.setExpressionEffect(ExpressionExtra.Hearts);
						if (input.wasPressed(Key.ADD)) this.setExpressionEffect(ExpressionExtra.Blush);
						if (input.wasPressed(Key.DIVIDE)) this.setExpressionEffect(ExpressionExtra.Cry);
						if (input.wasPressed(Key.MULTIPLY)) this.setExpressionEffect(ExpressionExtra.Tears);
		if (player) {
			const safe = hasFlag(this.worldFlags, WorldStateFlags.Safe);
			updateEntities(this, this.time, delta, safe, hoveredChatBubble);
			savePlayerPosition();
		}

		if (this.changedScale) {
			this.changedScale = false;
			this.resizedCamera = true;

			if (player) {
				centerCameraOn(camera, player);
			}
		}

		if (player) {
			updateCamera(camera, player, this.map);
		}

		if (this.resizedCamera) {
			server.updateCamera(camera.x, camera.y, camera.w, camera.h);
			this.resizedCamera = false;
		}

		if (player) {
			updateEntitiesCoverLifted(this.map, player, !!this.settings.account.seeThroughObjects, delta);
			updateEntitiesWithNames(this.map, this.hover, player);
			updateEntitiesTriggers(this.map, player, this);
		}

		input.end();

		if (this.nextFriendsCRC < now) {
			this.send(server => server.actionParam(Action.FriendsCRC, this.model.computeFriendsCRC()));
			this.nextFriendsCRC = now + 15 * MINUTE;
		}

		const threshold = Date.now() - 10 * SECOND;

		for (let i = this.incompleteSays.length - 1; i >= 0; i--) {
			if (this.incompleteSays[i].time < threshold) {
				this.incompleteSays.splice(i, 1);
			}
		}

		this.updateSocketStats(delta);
		TIMING && timeEnd();

		if (DEVELOPMENT && LOG_POSITION) {
			if (this.player) {
				this.positions.push({ x: this.player.x, y: this.player.y, moved });
			}
		}
	}
	}
	}
	private updateGameTime(delta: number) {
		if (this.baseTime !== this.targetBaseTime) {
			const timeDelta = Math.floor(delta * 0.2 * HOUR);
			const baseTime = this.baseTime + timeDelta * (this.baseTime > this.targetBaseTime ? -1 : 1);

			if (Math.abs(this.targetBaseTime - baseTime) < timeDelta) {
				this.baseTime = this.targetBaseTime;
			} else {
				this.baseTime = baseTime;
			}
		}

		this.time = this.baseTime + performance.now();
	}
	private updateSocketStats(delta: number) {
		this.timeSize += delta;

		if (this.timeSize > 1) {
			this.sent = 8 * this.socket!.sentSize / this.timeSize / 1024;
			this.recv = 8 * this.socket!.receivedSize / this.timeSize / 1024;
			this.socket!.sentSize = 0;
			this.socket!.receivedSize = 0;
			this.timeSize = 0;
		}
	}
	setWorldState(state: WorldState, initial: boolean) {
		this.worldState = state;
		this.season = state.season;
		this.holiday = state.holiday;
		this.worldFlags = state.flags;
		this.lightData = createLightData(this.season);
		initFeatureFlags(state.featureFlags);

		const baseTime = state.time - performance.now();

		if (initial) {
			this.baseTime = this.targetBaseTime = baseTime;
		} else {
			this.targetBaseTime = baseTime;
		}

		this.updateTileSets();

		if (this.model.friends) {
			for (const friend of this.model.friends) {
				friend.actualName = filterEntityName(this, friend.name, friend.nameBad) || '';
			}
		}
	}
	setPlayer(player: Pony) {
		this.player = player;
		centerCameraOn(this.camera, player);
		this.send(server => server.loaded());
	}
	setupMap() {
		this.bg = colorToFloatArray(getTileColor(this.map.defaultTile, this.season));
		this.audio.initTracks(this.season, this.holiday, this.map.type);
		this.audio.playOrSwitchToRandomTrack();
		this.updateTileSets();
	}
	private updateTileSets() {
		this.tileSets = updateTileSets(this.paletteManager, this.tileSets, this.season, this.map.type);
	}
	draw() {
		redrawActionButtons(this.actionsChanged);
		this.actionsChanged = false;

		if (!this.webgl)
			return;

		if (this.webgl.gl.isContextLost()) {
			DEVELOPMENT && console.warn('Context is lost');
			return;
		}

		// start frame
		const now = performance.now();

		if ((now - this.lastDraw) < this.frameDelay) {
			return;
		}

		this.frames++;

		if ((now - this.lastFps) > 1000) {
			this.drawFps = this.frames * 1000 / (now - this.lastFps);
			this.frames = 0;
			this.lastFps = now;
		}

		this.lastDraw = now;

		// draw
		const { gl, frameBuffer, frameBuffer2, spriteBatch, paletteBatch, palettes, failedFBO,
			mergeShader, paletteShader, spriteShader, spriteShaderWithColor, lightShader } = this.webgl;

		TIMING && timeStart('draw');

		TIMING && timeStart('draw init');
		let lightColor = WHITE;
		let shadowColor = 0;

		if (this.map.type === MapType.Cave) {
			lightColor = CAVE_LIGHT;
			shadowColor = CAVE_SHADOW;
		} else {
			lightColor = getLightColor(this.lightData, this.time);
			shadowColor = getShadowColor(this.lightData, this.time);
		}

		if (BETA && this.editor.customLight) {
			lightColor = parseColor(this.editor.lightColor);
			shadowColor = this.shadowColor;
		}

		const camera = this.camera;
		const width = camera.w;
		const height = camera.h;
		const ratio = integerPixelRatio();
		const actualScale = this.scale * ratio;
		const bg = this.bg;

		colorToExistingFloatArray(light, lightColor);

		const drawOptions = this.drawOptions;
		drawOptions.gameTime = this.time;
		drawOptions.lightColor = lightColor;
		drawOptions.shadowColor = shadowColor;
		drawOptions.drawHidden = this.mod;
		drawOptions.season = this.season;

		if (DEVELOPMENT) {
			drawOptions.debug = this.debug;
		}

		if (DEVELOPMENT || BETA) {
			drawOptions.engine = this.engine;
		}

		ortho(this.fboMatrix, 0, gl.drawingBufferWidth / actualScale, gl.drawingBufferHeight / actualScale, 0, 0, 1000, false);
		TIMING && timeEnd();

		TIMING && timeStart('ensureAllVisiblePon...');
		ensureAllVisiblePoniesAreDecoded(this.map, camera, this.paletteManager);
		TIMING && timeEnd();

		TIMING && timeStart('commit+invalidatePalettes');
		if (this.paletteManager.commit(gl)) {
			invalidatePalettes(this.map.entitiesDrawable);
		}
		TIMING && timeEnd();

		if (this.settings.browser.brightNight) {
			lerpColor(light, white, 0.3);
		}

		// you'd draw directly onto the screen only when there's no framebuffer
		// or the graphics is low and framebuffer size matches screen size

		TIMING && timeStart('initializeFrameBuffers');
		this.initializeFrameBuffers(this.webgl, width, height, this.settings.browser.graphicsQuality === GraphicsQuality.High);
		TIMING && timeEnd();

		const useDepthBuffer =
			!failedFBO && (this.settings.browser.graphicsQuality === GraphicsQuality.High) && !!frameBuffer!.depthStencilRenderbuffer;
		const useLighting = !failedFBO && (this.settings.browser.graphicsQuality !== GraphicsQuality.Low);
		const drawSceneDirectlyOntoScreen =
			failedFBO || (useLighting === false);

		drawOptions.useDepthBuffer = useDepthBuffer;

		let matrixTop = camera.actualY;
		let matrixBottom = camera.actualY + camera.h;
		if (!drawSceneDirectlyOntoScreen) {
			[matrixTop, matrixBottom] = [matrixBottom, matrixTop];
		}

		ortho(this.viewMatrix, camera.x, camera.x + camera.w, matrixBottom, matrixTop, 0, 1000, false);

		let mapDrawingColor = white;
		if (!useLighting) {
			mapDrawingColor = light;
			lerpColor(mapDrawingColor, white, 0.1); // adjust lighting for missing lights
		}

		gl.clearColor(bg[0], bg[1], bg[2], bg[3]);
		gl.enable(gl.BLEND);
		gl.blendEquation(gl.FUNC_ADD);
		gl.depthFunc(gl.ALWAYS);

		if (drawSceneDirectlyOntoScreen) {
			TIMING && timeStart('color -> screen');
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			this.drawMap(this.webgl, this.map, this.viewMatrix, mapDrawingColor, drawOptions);
			TIMING && timeEnd();
		}
		else {
			// if (!isWebGL2(gl)) {
			// 	gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
			// 	gl.clear(gl.COLOR_BUFFER_BIT); // hack, doing this clear fixes black screen issues for some older devices
			// }

			let clearMask = gl.COLOR_BUFFER_BIT;
			if (useDepthBuffer) {
				gl.depthMask(true);
				clearMask |= gl.DEPTH_BUFFER_BIT;
			}

			TIMING && timeStart('color -> framebuffer');
			bindFrameBuffer(gl, frameBuffer!);
			gl.viewport(0, 0, frameBuffer!.width, frameBuffer!.height); // clearing the whole surface is preferable for most GPUs
			gl.clear(clearMask);
			gl.viewport(0, 0, width, height);
			this.drawMap(this.webgl, this.map, this.viewMatrix, mapDrawingColor, drawOptions);
			gl.depthMask(false);
			TIMING && timeEnd();

			if (useLighting) {
				TIMING && timeStart('light -> fbo');
				bindFrameBuffer(gl, frameBuffer2!);
				gl.viewport(0, 0, frameBuffer2!.width, frameBuffer2!.height); // clearing the whole surface is preferable for most GPUs
				gl.clearColor(light[0], light[1], light[2], light[3]);
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.viewport(0, 0, width, height);
				gl.blendFunc(gl.ONE, gl.ONE);

				gl.useProgram(lightShader.program);
				gl.uniformMatrix4fv(lightShader.uniforms.transform, false, this.viewMatrix);
				gl.uniform4fv(lightShader.uniforms.lighting, white);
				spriteBatch.begin();
				this.lightEntitiesDrawn = drawEntityLights(spriteBatch, this.map.entitiesLight, this.camera, drawOptions);
				spriteBatch.end();

				if (useDepthBuffer) {
					gl.depthFunc(gl.GEQUAL);
				}
				gl.useProgram(spriteShaderWithColor.program);
				gl.uniformMatrix4fv(spriteShaderWithColor.uniforms.transform, false, this.viewMatrix);
				gl.uniform4fv(spriteShaderWithColor.uniforms.lighting, white);
				gl.uniform2f(spriteShaderWithColor.uniforms.textureSize,
					normalSpriteSheet.texture!.width, normalSpriteSheet.texture!.height);
				bindTexture(gl, 0, normalSpriteSheet.texture);
				spriteBatch.begin();
				this.lightSpriteEntitiesDrawn = drawEntityLightSprites(spriteBatch, this.map.entitiesLightSprite, this.camera, drawOptions);
				spriteBatch.end();
				gl.depthFunc(gl.ALWAYS);
				if (isWebGL2(gl)) {
					(gl as WebGL2RenderingContext).invalidateFramebuffer(gl.FRAMEBUFFER, [gl.DEPTH_ATTACHMENT]);
				}
				TIMING && timeEnd();

				TIMING && timeStart('color + lights -> screen');
				unbindFrameBuffer(gl);
				gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
				gl.disable(gl.BLEND);

				gl.useProgram(mergeShader.program);
				gl.uniformMatrix4fv(mergeShader.uniforms.transform, false, this.fboMatrix);
				gl.uniform2f(mergeShader.uniforms.textureSize, frameBuffer!.colorTexture.width, frameBuffer!.colorTexture.height);
				bindTexture(gl, 0, frameBuffer!.colorTexture);
				bindTexture(gl, 1, frameBuffer2!.colorTexture);
				spriteBatch.begin();
				spriteBatch.drawImage(WHITE, 0, 0, width, height, 0, 0, width, height);
				spriteBatch.end();
				TIMING && timeEnd();
			}
			else {
				TIMING && timeStart('color framebuffer -> screen');
				unbindFrameBuffer(gl);
				gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
				gl.disable(gl.BLEND);

				gl.useProgram(spriteShader.program);
				gl.uniformMatrix4fv(spriteShader.uniforms.transform, false, this.fboMatrix);
				gl.uniform4fv(spriteShader.uniforms.lighting, white);
				gl.uniform2f(spriteShader.uniforms.textureSize, frameBuffer!.colorTexture.width, frameBuffer!.colorTexture.height);
				bindTexture(gl, 0, frameBuffer!.colorTexture);
				spriteBatch.begin();
				spriteBatch.drawImage(WHITE, 0, 0, width, height, 0, 0, width, height);
				spriteBatch.end();
				TIMING && timeEnd();
			}
		}

		// ui -> screen
		gl.enable(gl.BLEND);
		gl.blendEquation(gl.FUNC_ADD);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		TIMING && timeStart('drawNames+drawChat');
		gl.useProgram(paletteShader.program);
		gl.uniformMatrix4fv(paletteShader.uniforms.transform, false, this.fboMatrix);
		gl.uniform4fv(paletteShader.uniforms.lighting, white);
		gl.uniform1f(paletteShader.uniforms.pixelSize, this.paletteManager.pixelSize);
		gl.uniform1f(paletteShader.uniforms.textureSize, 1.0 / paletteSpriteSheet.texture!.width);
		bindTexture(gl, 0, paletteSpriteSheet.texture);
		bindTexture(gl, 1, this.paletteManager.texture);
		paletteBatch.begin();

		if (!this.hideText) {
			const textScale = this.getPixelScale();
			const nameEntities = !!this.settings.account.alwaysShowTags ? this.map.entities : this.map.entitiesWithNames;
			drawNames(
				paletteBatch, nameEntities, this.player, this.party, this.camera, this.hover, this.mod, palettes,
				!!this.settings.account.alwaysShowTags);
			const canHighlightBubble = (entity: Entity) => {
				if (entity.type !== PONY_TYPE) {
					return false;
				}
				const isOwnBubble = entity.id === (this.player ? this.player.id : undefined);
				return isOwnBubble
					? !!this.settings.account.showOwnChatBubbleProfile
					: !!this.settings.account.showChatBubbleProfiles;
			};
			drawChat(
					paletteBatch,
					this.map.entitiesWithChat,
					this.player,
					this.camera,
					this.mod,
					palettes,
					this.hidePublicChat,
					this.hover,
					point(this.input.pointerX / textScale, this.input.pointerY / textScale),
					canHighlightBubble);
		} else if (!this.loaded) {
			if (this.placeInQueue) {
				this.drawMessage(this.webgl, `Waiting in queue (${this.placeInQueue})`);
			} else {
				this.drawMessage(this.webgl, 'Loading...');
			}
		} else if (this.socket && (performance.now() - this.socket.lastPacket) > CONNECTION_ISSUE_TIMEOUT) {
			// this.drawMessage('Connection issues...');
		}

		if (BETA && this.debug.showInfo) {
			try {
				const scale = this.getPixelScale();
				const x = this.input.pointerX / scale + 5;
				const y = this.input.pointerY / scale;
				const height = getMapHeightAt(this.map, this.hover.x, this.hover.y, this.time);
				drawText(paletteBatch, `${height.toFixed(2)}`, fontSmallPal, BLACK, x, y);
			} catch (e) {
				const err: any = e as any;
				console.warn(err.message);
			}
		}

		   if (this.showWallPlaceholder) {
			   // --- Предпросмотр стены / тайла ---
			   const x = this.hover.x | 0;
			   const y = this.hover.y | 0;
			   const hold = this.player ? this.player.hold : 0;

			   if (x >= 0 && y >= 0 && x < this.map.width && y < this.map.height) {
				   if (hold === changeTileTool.type && this.tileSets) {
					   const tileType = houseTiles[this.placeTile].type;
					   const tileSetIndex = getTilePreviewTileSetIndex(tileType, this.map.tileTime);
					   const tileSpriteIndex = getTilePreviewSpriteIndex(tileType);
					   const tilePreview = getTilePaintPreviewState(this, this.hover);
					   const tileSet = this.tileSets[tileSetIndex];
					   if (tileSet && tileSet.sprites.length && tilePreview) {
						   const previewColor = makeTransparent(WHITE, 0.55);
						   const previewSprite = tileSet.sprites[Math.min(tileSpriteIndex, tileSet.sprites.length - 1)];

						   if (previewSprite) {
							   for (let py = tilePreview.minY; py <= tilePreview.maxY; py++) {
								   for (let px = tilePreview.minX; px <= tilePreview.maxX; px++) {
									   const previewX = toScreenX(px) - this.camera.x;
									   const previewY = toScreenY(py) - this.camera.actualY;
									   paletteBatch.drawSprite(previewSprite, previewColor, tileSet.palette, previewX, previewY);
								   }
							   }

							   const left = toScreenX(tilePreview.minX) - this.camera.x;
							   const right = toScreenX(tilePreview.maxX + 1) - this.camera.x;
							   const top = toScreenY(tilePreview.minY) - this.camera.actualY;
							   const bottom = toScreenY(tilePreview.maxY + 1) - this.camera.actualY;
							   const textWidth = (text: string) => (text.length * 4) - 1;
							   const textHeight = 5;
							   const clampScreenX = (value: number, width: number) => Math.max(0, Math.min(value, this.camera.w - width));
							   const clampScreenY = (value: number) => Math.max(0, Math.min(value, this.camera.h - textHeight));
							const fitInsideX = (outer: number, innerLeft: number, innerRight: number, width: number, preferRight: boolean) => {
								   if (outer >= 0 && (outer + width) <= this.camera.w) {
									   return clampScreenX(outer, width);
								   }

								const primary = preferRight ? innerRight : innerLeft;
								const secondary = preferRight ? innerLeft : innerRight;

								if (primary >= 0 && (primary + width) <= this.camera.w) {
									return clampScreenX(primary, width);
								}

								return clampScreenX(secondary, width);
							   };
							const fitInsideY = (outer: number, innerTop: number, innerBottom: number, preferBottom: boolean) => {
								   if (outer >= 0 && (outer + textHeight) <= this.camera.h) {
									   return clampScreenY(outer);
								   }

								const primary = preferBottom ? innerBottom : innerTop;
								const secondary = preferBottom ? innerTop : innerBottom;

								if (primary >= 0 && (primary + textHeight) <= this.camera.h) {
									return clampScreenY(primary);
								}

								return clampScreenY(secondary);
							   };

							   const widthText = `${tilePreview.width}`;
							   const heightText = `${tilePreview.height}`;
							   const showSizeLabels = tilePreview.width > 1 || tilePreview.height > 1;
							   const growsRight = tilePreview.current.x >= tilePreview.start.x;
							   const growsDown = tilePreview.current.y >= tilePreview.start.y;
							   const widthLabelWidth = textWidth(widthText);
							   const heightLabelWidth = textWidth(heightText);

							   const widthOuterX = growsRight ? (right + 2) : (left - widthLabelWidth - 2);
							   const widthInnerLeft = left + 2;
							   const widthInnerRight = right - widthLabelWidth - 2;
							const widthLabelX = fitInsideX(widthOuterX, widthInnerLeft, widthInnerRight, widthLabelWidth, growsRight);
							   const widthLabelY = clampScreenY(top + ((bottom - top) / 2) - 2);

							   const heightOuterY = growsDown ? (bottom + 2) : (top - textHeight - 2);
							   const heightInnerTop = top + 2;
							   const heightInnerBottom = bottom - textHeight - 2;
							const heightLabelY = fitInsideY(heightOuterY, heightInnerTop, heightInnerBottom, growsDown);
							   const heightLabelX = clampScreenX(left + ((right - left - heightLabelWidth) / 2), heightLabelWidth);

							   if (showSizeLabels) {
								   drawPixelText(paletteBatch, widthLabelX - 1, widthLabelY, WHITE, widthText);
								   drawPixelText(paletteBatch, widthLabelX + 1, widthLabelY, WHITE, widthText);
								   drawPixelText(paletteBatch, widthLabelX, widthLabelY - 1, WHITE, widthText);
								   drawPixelText(paletteBatch, widthLabelX, widthLabelY + 1, WHITE, widthText);
								   drawPixelText(paletteBatch, widthLabelX, widthLabelY, BLACK, widthText);

								   drawPixelText(paletteBatch, heightLabelX - 1, heightLabelY, WHITE, heightText);
								   drawPixelText(paletteBatch, heightLabelX + 1, heightLabelY, WHITE, heightText);
								   drawPixelText(paletteBatch, heightLabelX, heightLabelY - 1, WHITE, heightText);
								   drawPixelText(paletteBatch, heightLabelX, heightLabelY + 1, WHITE, heightText);
								   drawPixelText(paletteBatch, heightLabelX, heightLabelY, BLACK, heightText);
							   }
						   }
					   }
				   }
			   }
		   }


		paletteBatch.end();
		TIMING && timeEnd();

		gl.useProgram(spriteShaderWithColor.program);
		gl.uniformMatrix4fv(spriteShaderWithColor.uniforms.transform, false, this.fboMatrix);
		gl.uniform4fv(spriteShaderWithColor.uniforms.lighting, white);

		if (BETA && this.showMinimap && this.minimap) {
			gl.uniform2f(spriteShaderWithColor.uniforms.textureSize,
				normalSpriteSheet.texture!.width, normalSpriteSheet.texture!.height);
			bindTexture(gl, 0, normalSpriteSheet.texture);
			spriteBatch.begin();
			spriteBatch.save();

			const { width, height, data } = this.minimap;
			const scale = 4 / this.scale;

			spriteBatch.translate(100, 100);
			spriteBatch.scale(scale, scale);

			spriteBatch.drawRect(BLACK, -1, -1, width + 2, height + 2);

			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					spriteBatch.drawRect(data[x + y * width], x, y, 1, 1);
				}
			}

			if (this.player) {
				spriteBatch.drawRect(RED, Math.floor(this.player.x), Math.floor(this.player.y), 1, 1);
			}

			spriteBatch.restore();
			spriteBatch.end();
		}

		if (BETA && this.debug.showRegions && this.player) {
			gl.uniform2f(spriteShaderWithColor.uniforms.textureSize,
				normalSpriteSheet.texture!.width, normalSpriteSheet.texture!.height);
			bindTexture(gl, 0, normalSpriteSheet.texture);
			spriteBatch.begin();
			drawDebugRegions(spriteBatch, this.map, this.player, this.camera);
			spriteBatch.end();
		}

		if (this.showLookClickZones && this.player) {
			gl.uniform2f(spriteShaderWithColor.uniforms.textureSize,
				normalSpriteSheet.texture!.width, normalSpriteSheet.texture!.height);
			bindTexture(gl, 0, normalSpriteSheet.texture);
			spriteBatch.begin();

			const anchor = this.getHeadLookAnchor(this.player);
			const cx = toScreenX(anchor.x) - this.camera.x;
			const cy = toScreenY(anchor.y) - this.camera.actualY;
			const zoneSize = 12;
			const centerZoneSize = 28;
			const zoneStepX = 15;
			const zoneStepY = 13;
			// Для UI: используем raw iris и режим
			const currentIris = this.lastLookIris;
			const mode = this.getCurrentIrisMode();
			const activeColor = getIrisModeColor(mode);

			for (let iy = -1; iy <= 1; iy++) {
				for (let ix = -1; ix <= 1; ix++) {
					// For UI, don't invert sides when shocked overlays are active
					const invertSides = !(mode.left === 'shocked' || mode.right === 'shocked');
					const zoneIris = this.getLookIrisFromZone(ix, iy, invertSides);
					const isCenter = ix === 0 && iy === 0;
					// Сравниваем только нормализованные значения
					const isActive = normalizeIrisForUI(currentIris) === normalizeIrisForUI(zoneIris);
					const size = isCenter ? centerZoneSize : zoneSize;
					// Цвет активной клетки зависит от режима
					let color: any = isActive ? activeColor : (isCenter ? 0x33aaff88 : 0xffffff55);
					// Преобразуем строку цвета в hex
					if (typeof color === 'string') {
						color = color === 'red' ? 0xff3333cc : 0x33ff33cc;
					}
					spriteBatch.drawRect(
						color,
						Math.round(cx + ix * zoneStepX - size * 0.5),
						Math.round(cy + iy * zoneStepY - size * 0.5),
						size,
						size,
					);
				}
			}

			spriteBatch.end();
		}

		const showFPS = !!this.settings.browser.showFps;
		const showHelp = BETA && this.input.isPressed(Key.F1);
		const showPalette = DEVELOPMENT && this.debug.showPalette;
		const showAdditionalStats = false;

		if (showFPS || showHelp || showPalette || showAdditionalStats) {
			// 1 to 1 pixel scale drawing
			TIMING && timeStart('showFps');
			const scale = 2;
			ortho(this.fboMatrix, 0, gl.drawingBufferWidth / ratio, gl.drawingBufferHeight / ratio, 0, 0, 1000, false);
			gl.uniformMatrix4fv(spriteShaderWithColor.uniforms.transform, false, this.fboMatrix);
			gl.uniform2f(spriteShaderWithColor.uniforms.textureSize,
				normalSpriteSheet.texture!.width, normalSpriteSheet.texture!.height);
			bindTexture(gl, 0, normalSpriteSheet.texture);
			spriteBatch.begin();
			spriteBatch.save();
			spriteBatch.scale(scale, scale);

			if (showFPS) {
				drawOutlinedText(spriteBatch, this.drawFps.toFixed(), fontSmall, WHITE, BLACK, 2, 2);

				if (this.timingsText) {
					const size = measureText(this.timingsText, fontMono);
					spriteBatch.drawRect(0x000000aa, 2, 26, 220, size.h + 8);
					drawText(spriteBatch, this.timingsText, fontMono, WHITE, 2, 30);
				}
			}

			if (BETA && showHelp) {
				let y = 25;

				for (const shortcut of this.debugShortcuts) {
					drawOutlinedText(spriteBatch, shortcut, font, WHITE, BLACK, 5, y);
					y += 10;
				}
			}

			if (showAdditionalStats) {
				const width = gl.drawingBufferWidth / (ratio * scale);
				const text =
					`entities ${this.entitiesDrawn}/${this.map.entitiesDrawable.length}\n` +
					`light enitities ${this.lightEntitiesDrawn}/${this.map.entitiesLight.length}\n` +
					`light sprite entities ${this.lightSpriteEntitiesDrawn}/${this.map.entitiesLightSprite.length}`;
				const size = measureText(text, fontMono);
				const x = width - Math.max(160, size.w);
				const y = 26;
				spriteBatch.drawRect(0x000000aa, x, y, 150, size.h + 10);
				drawText(spriteBatch, text, fontMono, WHITE, x + 5, y + 5);
			}

			spriteBatch.restore();
			spriteBatch.end();

			if (DEVELOPMENT && showPalette) {
				const paletteTexture = this.paletteManager.texture!;
				const { width, height } = paletteTexture;

				gl.uniform2f(spriteShaderWithColor.uniforms.textureSize,
					normalSpriteSheet.texture!.width, normalSpriteSheet.texture!.height);
				bindTexture(gl, 0, normalSpriteSheet.texture);
				spriteBatch.begin();
				spriteBatch.drawRect(0x00000066, 20, 20, width, height);
				spriteBatch.end();

				gl.uniform2f(spriteShaderWithColor.uniforms.textureSize, width, height);
				bindTexture(gl, 0, paletteTexture);
				spriteBatch.begin();
				spriteBatch.drawImage(WHITE, 0, 0, width, height, 20, 20, width, height);
				spriteBatch.end();
			}

			TIMING && timeEnd();
		}

		bindTexture(gl, 0, undefined);
		bindTexture(gl, 1, undefined);
		gl.useProgram(null);

		TIMING && timeEnd();
		this.updateStatsText();

		TIMING && timeStart('messageQueue');
		while (this.messageQueue.length) {
			this.onMessage.next(this.messageQueue.shift()!);
		}
		TIMING && timeEnd();

		TIMING && timeStart('onFrame');
		this.onFrame.next();
		TIMING && timeEnd();
	}
	private drawMessage({ paletteBatch, palettes }: WebGL, message: string) {
		drawFullScreenMessage(paletteBatch, this.camera, message, palettes.mainFont.white);
	}
	private drawMap(webgl: WebGL, map: WorldMap, viewMatrix: Matrix4, lighting: Float32Array, options: DrawOptions) {
		const { gl, paletteBatch, paletteShader, paletteShaderWithDepth } = webgl;

		const mapPaletteShader = options.useDepthBuffer ? paletteShaderWithDepth : paletteShader;

		TIMING && timeStart('drawMap');
		if (this.tileSets && this.player) {
			const dragVisual = getBuildingDragVisualState(this);
			const hideSelectionOutline = this.editor.draggingEntities && this.player.hold === dragEntityTool.type;
			const selectedEntities = hideSelectionOutline ? [] : this.editor.selectedEntities;

			gl.useProgram(mapPaletteShader.program);
			gl.uniformMatrix4fv(mapPaletteShader.uniforms.transform, false, viewMatrix);
			gl.uniform4fv(mapPaletteShader.uniforms.lighting, lighting);
			gl.uniform1f(mapPaletteShader.uniforms.pixelSize, this.paletteManager.pixelSize);
			gl.uniform1f(mapPaletteShader.uniforms.textureSize, 1.0 / paletteSpriteSheet.texture!.width);
			bindTexture(gl, 0, paletteSpriteSheet.texture);
			bindTexture(gl, 1, this.paletteManager.texture);
			for (const entity of dragVisual.selectedForMove) {
				entity.outlineColor = dragVisual.isMultiCloneMode ? CYAN : 0xffcc00ff;
			}
			const showHoverOutline = !hideSelectionOutline && !dragVisual.ghostEntities.length && this.highlightEntity;
			const hoverTool = this.player.hold;
			const hammerShift = hoverTool === placeEntitiesTool.type && this.input.isPressed(Key.SHIFT);
			const hammerCtrl = hoverTool === placeEntitiesTool.type && this.input.isPressed(Key.CTRL);
			const ropeMultiMode = dragVisual.isMultiMoveMode;
			const pickaxeMultiMode = dragVisual.isMultiCloneToolMode;
			const singleDragOutlineColor = dragVisual.isClonePreview ? CYAN : ((hoverTool === dragEntityTool.type || hammerShift) ? 0xffcc00ff : WHITE);
			for (const entity of dragVisual.draggedEntities) {
				entity.outlineColor = singleDragOutlineColor;
			}
			const brooomHighlight = (showHoverOutline && hoverTool === removeEntitiesTool.type) ? this.highlightEntity : undefined;
			const editorBroomHighlight = (showHoverOutline && this.editor.useEditorBroom) ? this.highlightEntity : undefined;
			const ropeHighlight = (showHoverOutline && hoverTool === dragEntityTool.type && !ropeMultiMode) ? this.highlightEntity : undefined;
			const ropeShiftHighlight = (showHoverOutline && hoverTool === dragEntityTool.type && ropeMultiMode) ? this.highlightEntity : undefined;
			const editorRopeHighlight = (showHoverOutline && this.editor.useEditorRope && !ropeMultiMode) ? this.highlightEntity : undefined;
			const editorRopeShiftHighlight = (showHoverOutline && this.editor.useEditorRope && ropeMultiMode) ? this.highlightEntity : undefined;
			const hammerShiftHighlight = (showHoverOutline && hammerShift) ? this.highlightEntity : undefined;
			const cloneHighlight = (showHoverOutline && hoverTool === cloneEntityTool.type && !pickaxeMultiMode) ? this.highlightEntity : undefined;
			const pickaxeShiftHighlight = (showHoverOutline && hoverTool === cloneEntityTool.type && pickaxeMultiMode) ? this.highlightEntity : undefined;
			const editorPickaxeHighlight = (showHoverOutline && this.editor.useEditorPickaxe && !pickaxeMultiMode) ? this.highlightEntity : undefined;
			const editorPickaxeShiftHighlight = (showHoverOutline && this.editor.useEditorPickaxe && pickaxeMultiMode) ? this.highlightEntity : undefined;
			const hammerCtrlHighlight = (showHoverOutline && hammerCtrl) ? this.highlightEntity : undefined;
			if (brooomHighlight) {
				brooomHighlight.outlineColor = 0xff3b30ff;
			}
			if (editorBroomHighlight) {
				editorBroomHighlight.outlineColor = 0xff3b30ff;
			}
			if (ropeHighlight) {
				ropeHighlight.outlineColor = 0xffcc00ff;
			}
			if (ropeShiftHighlight) {
				ropeShiftHighlight.outlineColor = 0xffe680ff; // светло-жёлтый для multi-drag
			}
			if (editorRopeHighlight) {
				editorRopeHighlight.outlineColor = 0xffcc00ff;
			}
			if (editorRopeShiftHighlight) {
				editorRopeShiftHighlight.outlineColor = 0xffe680ff;
			}
			if (hammerShiftHighlight) {
				hammerShiftHighlight.outlineColor = 0xffcc00ff; // жёлтый как у верёвки
			}
			if (cloneHighlight) {
				cloneHighlight.outlineColor = CYAN;
			}
			if (pickaxeShiftHighlight) {
				pickaxeShiftHighlight.outlineColor = 0x80ffffff; // светло-циановый для multi-clone
			}
			if (editorPickaxeHighlight) {
				editorPickaxeHighlight.outlineColor = CYAN;
			}
			if (editorPickaxeShiftHighlight) {
				editorPickaxeShiftHighlight.outlineColor = 0x80ffffff;
			}
			if (hammerCtrlHighlight) {
				hammerCtrlHighlight.outlineColor = CYAN;
			}

			paletteBatch.begin();
			this.entitiesDrawn = drawMap(
				paletteBatch, map, this.camera, this.player, options, this.tileSets, selectedEntities);

			for (const entity of dragVisual.selectedForMove) {
				entity.outlineColor = undefined;
			}
			for (const entity of dragVisual.draggedEntities) {
				entity.outlineColor = undefined;
			}
			if (brooomHighlight) {
				brooomHighlight.outlineColor = undefined;
			}
			if (editorBroomHighlight) {
				editorBroomHighlight.outlineColor = undefined;
			}
			if (ropeHighlight) {
				ropeHighlight.outlineColor = undefined;
			}
			if (ropeShiftHighlight) {
				ropeShiftHighlight.outlineColor = undefined;
			}
			if (editorRopeHighlight) {
				editorRopeHighlight.outlineColor = undefined;
			}
			if (editorRopeShiftHighlight) {
				editorRopeShiftHighlight.outlineColor = undefined;
			}
			if (hammerShiftHighlight) {
				hammerShiftHighlight.outlineColor = undefined;
			}
			if (cloneHighlight) {
				cloneHighlight.outlineColor = undefined;
			}
			if (pickaxeShiftHighlight) {
				pickaxeShiftHighlight.outlineColor = undefined;
			}
			if (editorPickaxeHighlight) {
				editorPickaxeHighlight.outlineColor = undefined;
			}
			if (editorPickaxeShiftHighlight) {
				editorPickaxeShiftHighlight.outlineColor = undefined;
			}
			if (hammerCtrlHighlight) {
				hammerCtrlHighlight.outlineColor = undefined;
			}

			if (dragVisual.ghostEntities.length) {
				paletteBatch.depth = 0;
				const ghostOutlineColor = dragVisual.isClonePreview ? CYAN : 0xffcc00ff;
				const outlineAlpha = 0.24;
				const previewAlpha = dragVisual.isMultiDragPreview ? 0.9 : 0.35;

				for (const ghost of dragVisual.ghostEntities) {
					if (ghost.draw) {
						const previousAlpha = paletteBatch.globalAlpha;

						if (dragVisual.isDragging) {
							const outlineOffsets: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
							paletteBatch.globalAlpha = outlineAlpha;

							for (const [ox, oy] of outlineOffsets) {
								paletteBatch.save();
								paletteBatch.translate(ox, oy);
								ghost.draw(paletteBatch, { ...this.drawOptions, outlineMode: true, outlineColor: ghostOutlineColor });
								paletteBatch.restore();
							}
						}

						paletteBatch.globalAlpha = previewAlpha;
						ghost.draw(paletteBatch, { ...this.drawOptions });
						paletteBatch.globalAlpha = previousAlpha;
					}
				}
			}

			if (this.showWallPlaceholder && hoverTool === toggleWallsTool.type && (hasFlag(this.map.flags, MapFlags.EditableWalls) || isEditorSawActive(this, this.player))) {
				const x = this.hover.x | 0;
				const y = this.hover.y | 0;

				if (x >= 0 && y >= 0 && x < this.map.width && y < this.map.height) {
					const wallMaterial = getSelectedWallMaterial(this);
					const wallTall = isSelectedWallTall(this);
					const walls = wallMaterial === 'stone' ? stoneWalls : woodenWalls;
					const wallTop = getWallTopForMap(this.map);
					const wallState = collectWallPreviewState(this.map);
					const hasH = (wx: number, wy: number) => wallState.hWalls.has(wallPreviewKey(wx, wy));
					const hasV = (wx: number, wy: number) => wallState.vWalls.has(wallPreviewKey(wx, wy));
					const hasHTall = (wx: number, wy: number) => wallState.hTallWalls.has(wallPreviewKey(wx, wy));
					const hasVTall = (wx: number, wy: number) => wallState.vTallWalls.has(wallPreviewKey(wx, wy));
					const hasTallHorizontalConnection = (vx: number, vy: number) =>
						((hasH(vx, vy) && hasHTall(vx, vy)) || (hasH(vx - 1, vy) && hasHTall(vx - 1, vy)));
					const isBaseTallHorizontal = (vx: number, vy: number) =>
						vy <= wallTop || isTallWallArea(this.map, vx, vy) || hasHTall(vx, vy);
					const isResolvedTallHorizontal = (vx: number, vy: number) => {
						if (isBaseTallHorizontal(vx, vy)) {
							return true;
						}

						const hasLeft = hasH(vx - 1, vy);
						const hasRight = hasH(vx + 1, vy);

						if (hasLeft && hasRight) {
							const leftTall = isBaseTallHorizontal(vx - 1, vy);
							const rightTall = isBaseTallHorizontal(vx + 1, vy);

							if (leftTall === rightTall) {
								return leftTall;
							}
						}

						return false;
					};
					const isBaseTallVertical = (vx: number, vy: number) =>
						vx === 0
						|| vx === this.map.width
						|| isTallWallArea(this.map, vx, vy)
						|| hasVTall(vx, vy)
						|| hasTallHorizontalConnection(vx, vy)
						|| hasTallHorizontalConnection(vx, vy + 1);
					const isResolvedTallVertical = (vx: number, vy: number) => {
						if (isBaseTallVertical(vx, vy)) {
							return true;
						}

						const hasUp = hasV(vx, vy - 1);
						const hasDown = hasV(vx, vy + 1);

						if (hasUp && hasDown) {
							const upTall = isBaseTallVertical(vx, vy - 1);
							const downTall = isBaseTallVertical(vx, vy + 1);

							if (upTall === downTall) {
								return upTall;
							}
						}

						return false;
					};

					const wallPaintPreview = getWallPaintPreviewState(this, this.hover);
					const previewSegments: Array<{ x: number; y: number; horizontal: boolean; }> = [];
					let wallDragPreviewCount = 0;
					let wallDragMinX = Number.POSITIVE_INFINITY;
					let wallDragMinY = Number.POSITIVE_INFINITY;
					let wallDragMaxX = Number.NEGATIVE_INFINITY;
					let wallDragMaxY = Number.NEGATIVE_INFINITY;

					if (wallPaintPreview && wallPaintPreview.active) {
						if (wallPaintPreview.horizontal) {
							for (let sx = wallPaintPreview.min; sx <= wallPaintPreview.max; sx++) {
								previewSegments.push({ x: sx, y: wallPaintPreview.start.y, horizontal: true });
							}
						} else {
							for (let sy = wallPaintPreview.min; sy <= wallPaintPreview.max; sy++) {
								previewSegments.push({ x: wallPaintPreview.start.x, y: sy, horizontal: false });
							}
						}
					} else {
						// In single mode draw a manual pixel plus marker at the wall intersection.
						const anchorX = clamp(Math.round(this.hover.x), 0, this.map.width);
						const anchorY = clamp(Math.round(this.hover.y), 0, this.map.height);
						const anchorScreenX = Math.round(toScreenX(anchorX));
						const anchorScreenY = Math.round(toScreenY(anchorY));
						const canShowSingleHoverWall = (performance.now() - this.wallHoverStillSince) >= WALL_HOVER_PREVIEW_DELAY_MS;

						// Black outline (thickness 1) around the plus shape
						paletteBatch.drawRect(BLACK, anchorScreenX - 3, anchorScreenY - 1, 7, 3);
						paletteBatch.drawRect(BLACK, anchorScreenX - 1, anchorScreenY - 3, 3, 7);

						// White plus core
						paletteBatch.drawRect(WHITE, anchorScreenX - 2, anchorScreenY, 5, 1);
						paletteBatch.drawRect(WHITE, anchorScreenX, anchorScreenY - 2, 1, 5);

						if (canShowSingleHoverWall && wallPaintPreview) {
							previewSegments.push({
								x: wallPaintPreview.current.x,
								y: wallPaintPreview.current.y,
								horizontal: wallPaintPreview.current.horizontal,
							});
						}
					}

					for (const segment of previewSegments) {
						const segmentX = segment.x;
						const segmentY = segment.y;
						const segmentHorizontal = segment.horizontal;
						const isLockedOuterWallPreview = this.map.type === MapType.House && (
							segmentHorizontal
								? (segmentY <= wallTop || segmentY === this.map.height)
								: (segmentX === 0 || segmentX === this.map.width || segmentY < wallTop)
						);

						if (isLockedOuterWallPreview) {
							continue;
						}

						if (wallPaintPreview && wallPaintPreview.active) {
							wallDragPreviewCount++;
							if (segmentX < wallDragMinX) wallDragMinX = segmentX;
							if (segmentY < wallDragMinY) wallDragMinY = segmentY;
							if (segmentX > wallDragMaxX) wallDragMaxX = segmentX;
							if (segmentY > wallDragMaxY) wallDragMaxY = segmentY;
						}

						const targetKey = wallPreviewKey(segmentX, segmentY);
						let previewMainEntity: Entity | undefined;
						const previewCornerEntities: Entity[] = [];
						let previewOutlineColor: number | undefined;

						const hasSegment = segmentHorizontal ? wallState.hWalls.has(targetKey) : wallState.vWalls.has(targetKey);
						const currentEntity = segmentHorizontal ? wallState.hEntities.get(targetKey) : wallState.vEntities.get(targetKey);
						const selectedMaterial: 'wood' | 'stone' = wallMaterial;
						const currentMaterial = (() => {
							if (!currentEntity) {
								return undefined;
							}

							if (segmentHorizontal) {
								if (woodHorizontalWallTypes.has(currentEntity.type)) {
									return 'wood';
								}
								if (stoneHorizontalWallTypes.has(currentEntity.type)) {
									return 'stone';
								}
							} else {
								if (woodVerticalWallTypes.has(currentEntity.type)) {
									return 'wood';
								}
								if (stoneVerticalWallTypes.has(currentEntity.type)) {
									return 'stone';
								}
							}

							return undefined;
						})();

						if (segmentHorizontal) {
							const currentIsTall = wallState.hTallWalls.has(targetKey);
							const sameHeight = currentIsTall === wallTall;
							const sameMaterial = currentMaterial === selectedMaterial;
							const isDeletion = hasSegment && sameHeight && sameMaterial;

							if (isDeletion) {
								previewOutlineColor = 0xff3b30ff;
								wallState.hWalls.delete(targetKey);
								wallState.hTallWalls.delete(targetKey);
								previewMainEntity = currentIsTall
									? walls.wallH(segmentX + 0.5, segmentY + WALL_Y_OFFSET)
									: walls.wallHShort(segmentX + 0.5, segmentY + WALL_Y_OFFSET);
							} else {
								if (hasSegment) {
									previewOutlineColor = 0xffcc00ff;
								}
								if (!hasSegment) {
									wallState.hWalls.add(targetKey);
								}
								wallState.hTallWalls.delete(targetKey);
								if (wallTall) {
									wallState.hTallWalls.add(targetKey);
								}
								const forceTall = isResolvedTallHorizontal(segmentX, segmentY);
								if (forceTall) {
									wallState.hTallWalls.add(targetKey);
								} else {
									wallState.hTallWalls.delete(targetKey);
								}
								previewMainEntity = getHorizontalWallPreviewEntity(this.map, walls, wallState.hTallWalls, segmentX, segmentY, wallTop);
							}
						} else {
							const currentIsTall = wallState.vTallWalls.has(targetKey);
							const sameHeight = currentIsTall === wallTall;
							const sameMaterial = currentMaterial === selectedMaterial;
							const isDeletion = hasSegment && sameHeight && sameMaterial;

							if (isDeletion) {
								previewOutlineColor = 0xff3b30ff;
								wallState.vWalls.delete(targetKey);
								wallState.vTallWalls.delete(targetKey);
								previewMainEntity = currentIsTall
									? walls.wallV(segmentX, segmentY + 0.5)
									: walls.wallVShort(segmentX, segmentY + 0.5);
							} else {
								if (hasSegment) {
									previewOutlineColor = 0xffcc00ff;
								}
								if (!hasSegment) {
									wallState.vWalls.add(targetKey);
								}
								wallState.vTallWalls.delete(targetKey);
								if (wallTall) {
									wallState.vTallWalls.add(targetKey);
								}
								const forceTall = isResolvedTallVertical(segmentX, segmentY);
								if (forceTall) {
									wallState.vTallWalls.add(targetKey);
									previewMainEntity = walls.wallV(segmentX, segmentY + 0.5);
								} else {
									wallState.vTallWalls.delete(targetKey);
									previewMainEntity = walls.wallVShort(segmentX, segmentY + 0.5);
								}
							}
						}

						const calcCorner = (cx: number, cy: number) => {
							return (hasV(cx, cy - 1) ? 8 : 0)
								+ (hasH(cx, cy) ? 4 : 0)
								+ (hasV(cx, cy) ? 2 : 0)
								+ (hasH(cx - 1, cy) ? 1 : 0);
						};

						const hasTallAdjacent = (cx: number, cy: number) => {
							return hasHTall(cx, cy)
								|| hasHTall(cx - 1, cy)
								|| hasVTall(cx, cy)
								|| hasVTall(cx, cy - 1);
						};

						const affectedCorners = [
							[segmentX, segmentY],
							[segmentX + 1, segmentY],
							[segmentX, segmentY + 1],
						] as const;

						for (const [cx, cy] of affectedCorners) {
							const mask = calcCorner(cx, cy);
							if (!mask) {
								continue;
							}

							const outside = cx === 0 || cy <= wallTop || cx === this.map.width || isTallWallArea(this.map, cx, cy);
							const cornerSet = (outside || hasTallAdjacent(cx, cy))
								? walls.wallCorners
								: walls.wallCornersShort;
							const nextCorner = cornerSet[mask](cx, cy + WALL_Y_OFFSET);
							const existingCorner = wallState.cornerEntities.get(wallPreviewKey(cx, cy));

							// Don't overlay unchanged corners; it can make nearby walls look semi-transparent.
							if (!existingCorner || existingCorner.type !== nextCorner.type) {
								previewCornerEntities.push(nextCorner);
							}
						}

						const previewEntities: Entity[] = [];
						if (previewMainEntity) {
							previewEntities.push(previewMainEntity);
						}
						for (const cornerEntity of previewCornerEntities) {
							previewEntities.push(cornerEntity);
						}
						previewEntities.sort(compareEntities);

						const previousAlpha = paletteBatch.globalAlpha;
						const previewOpacity = 0.75;
						const previewCoverLifting = clamp((1 - previewOpacity) / 0.6, 0, 1);
						paletteBatch.globalAlpha = previewOpacity;
						for (const previewEntity of previewEntities) {
							if (previewEntity.draw) {
								const previousCoverLifting = previewEntity.coverLifting;
								previewEntity.coverLifting = previewCoverLifting;
								previewEntity.draw(paletteBatch, { ...this.drawOptions });
								if (previewOutlineColor !== undefined) {
									drawBoundsOutline(paletteBatch, previewEntity, previewEntity.bounds, previewOutlineColor, 1);
								}
								previewEntity.coverLifting = previousCoverLifting;
							}
						}
						paletteBatch.globalAlpha = previousAlpha;
					}

					if (wallPaintPreview && wallPaintPreview.active && wallDragPreviewCount > 0) {
						const left = toScreenX(wallDragMinX);
						const right = toScreenX(wallDragMaxX + 1);
						const top = toScreenY(wallDragMinY);
						const bottom = toScreenY(wallDragMaxY + 1);
						const text = `${wallDragPreviewCount}`;
						const textW = (text.length * 4) - 1;
						const textH = 5;
						const rawLabelX = Math.round(left + ((right - left - textW) / 2));
						const rawLabelY = Math.round(top + ((bottom - top - textH) / 2));
						const labelX = rawLabelX;
						const labelY = rawLabelY;

						drawPixelText(paletteBatch, labelX - 1, labelY, WHITE, text);
						drawPixelText(paletteBatch, labelX + 1, labelY, WHITE, text);
						drawPixelText(paletteBatch, labelX, labelY - 1, WHITE, text);
						drawPixelText(paletteBatch, labelX, labelY + 1, WHITE, text);
						drawPixelText(paletteBatch, labelX, labelY, BLACK, text);
					}
				}
			}

			const showDragCountLabel = hoverTool === dragEntityTool.type || hoverTool === cloneEntityTool.type || hammerShift || hammerCtrl;
			const countSource = dragVisual.isDragging ? dragVisual.ghostEntities : dragVisual.selectedForMove;

			if (showDragCountLabel && countSource.length > 1) {
				let minX = Number.POSITIVE_INFINITY;
				let minY = Number.POSITIVE_INFINITY;
				let maxX = Number.NEGATIVE_INFINITY;
				let maxY = Number.NEGATIVE_INFINITY;

				for (const entity of countSource) {
					if (entity.x < minX) minX = entity.x;
					if (entity.y < minY) minY = entity.y;
					if (entity.x > maxX) maxX = entity.x;
					if (entity.y > maxY) maxY = entity.y;
				}

				const left = toScreenX(minX);
				const right = toScreenX(maxX + 1);
				const top = toScreenY(minY);
				const bottom = toScreenY(maxY + 1);
				const text = `${countSource.length}`;
				const textW = (text.length * 4) - 1;
				const textH = 5;
				const labelX = Math.round(left + ((right - left - textW) / 2));
				const labelY = Math.round(top + ((bottom - top - textH) / 2));

				drawPixelText(paletteBatch, labelX - 1, labelY, WHITE, text);
				drawPixelText(paletteBatch, labelX + 1, labelY, WHITE, text);
				drawPixelText(paletteBatch, labelX, labelY - 1, WHITE, text);
				drawPixelText(paletteBatch, labelX, labelY + 1, WHITE, text);
				drawPixelText(paletteBatch, labelX, labelY, BLACK, text);
			}
			paletteBatch.end();

			const hideRopeHighlight = this.editor.draggingEntities && this.player.hold === dragEntityTool.type;
			const hasMultiGhosts = dragVisual.ghostEntities.length > 0;

			if (!hideRopeHighlight && !hasMultiGhosts && this.highlightEntity && this.highlightEntity.draw) {
				paletteBatch.begin();
				paletteBatch.depth = 0;
				const previousAlpha = paletteBatch.globalAlpha;

				if (this.player.hold === placeEntitiesTool.type || this.editor.useEditorHammer) {
					paletteBatch.globalAlpha = 0.38;
					this.highlightEntity.draw(paletteBatch, { ...this.drawOptions });
				}

				paletteBatch.globalAlpha = previousAlpha;
				paletteBatch.end();
			}
		}
		TIMING && timeEnd();
	}
	private updateCameraShift() {
		if (isMobile) {
			const isKeyboardOpen = !!document.activeElement && /input/i.test(document.activeElement.tagName);

			if (this.lastIsKeyboardOpen !== isKeyboardOpen) {
				DEVELOPMENT && log(`keyboard open ${isKeyboardOpen}`);
				this.lastIsKeyboardOpen = isKeyboardOpen;
			}

			if (isKeyboardOpen) {
				if (!this.cameraShiftOn && window.scrollY > 100) {
					this.cameraShiftOn = true;
					this.cameraShiftTarget = window.scrollY;

					if (DEVELOPMENT) {
						log(`shift camera ${this.cameraShiftTarget} (${this.windowHeight} - ${window.innerHeight}, ${window.scrollY})`);
					}
				}
			} else {
				if (this.cameraShiftOn && window.scrollY < 100) {
					this.cameraShiftOn = false;
					DEVELOPMENT && log(`unshift camera`);
				}
			}
		}
	}
	private resizeCanvas() {
		pixelRatioCache = getPixelRatio();
		const canvas = this.canvas;
		const ratio = pixelRatio();
		const rect = this.element!.getBoundingClientRect();
		this.windowWidth = rect.width;
		this.windowHeight = rect.height;
		let w = Math.ceil(this.windowWidth * ratio);
		let h = Math.ceil(this.windowHeight * ratio);

		while ((w % 12) !== 0) {
			w++;
		}

		while ((h % 12) !== 0) {
			h++;
		}

		if (canvas && w && h && (canvas.width !== w || canvas.height !== h || this.lastCanvasRatio !== ratio)) {
			canvas.width = w;
			canvas.height = h;
			canvas.style.width = `${w / ratio}px`;
			canvas.style.height = `${h / ratio}px`;
			this.lastCanvasRatio = ratio;
			this.resized = false;
			DEVELOPMENT && log(`scrollY: ${window.scrollY}`);
		}
	}
	private initializeFrameBuffers(
		{ gl, frameBuffer, frameBuffer2 }: WebGL, width: number, height: number, useDepthBuffer: boolean
	) {
		if (!frameBuffer || !frameBuffer2) {
			return;
		}

		const hasDepth = frameBuffer.depthStencilRenderbuffer !== null;
		const isSizeChanged = width !== frameBuffer.width || height !== frameBuffer.height;
		const isDepthChanged = hasDepth !== useDepthBuffer;

		if (isSizeChanged || isDepthChanged) {
			const maxSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
			const isSizeTooBig = maxSize != null && (width > maxSize || height > maxSize);

			if (isSizeTooBig) {
				this.setScale(this.scale + 1); // should not happen, useDepthBuffer is also ignored if it does
				DEVELOPMENT && console.warn('Cannot resize framebuffer');
			} else {
				disposeFrameBuffer(gl, frameBuffer);
				disposeFrameBuffer(gl, frameBuffer2);
				createFrameBuffer(gl, frameBuffer, width, height, useDepthBuffer, null);
				createFrameBuffer(gl, frameBuffer2, width, height, false, frameBuffer.depthStencilRenderbuffer);
			}
		}
	}
	private announce(announcement: string) {
		this.announcements.next(announcement);
	}
	changePlaceEntity(reverse: boolean) {
		changePlaceEntityTool(this, reverse);
	}
	changePlaceTile(reverse: boolean) {
		changePlaceTileTool(this, reverse);
	}
	saveDebug() {
		this.storage.setJSON('debug', this.debug);
	}
	private updateStatsText() {
		const { gl, spriteBatch, paletteBatch } = this.webgl!;

		if ((performance.now() - this.lastStats) > SECOND) {
			TIMING && timingCollate();

			if (TIMING) {
				const timings = timingCollate();
				this.timingsText = timings
					.map(({ selfTime, selfPercent, totalPercent, count, name }) =>
						`${selfTime.toFixed(2).padStart(6)}ms` +
						`${selfPercent.toFixed(2).padStart(6)}%` +
						`${totalPercent.toFixed(2).padStart(6)}%` +
						`${count.toString().padStart(6)} ${name}`)
					.join('\n');
			}

			if (this.statsText) {
				let value = '';

				if (this.settings.browser.showStats) {
					const tris = spriteBatch.drawnTrisStats + paletteBatch.drawnTrisStats;
					const flush = paletteBatch.flushes;
					const sent = this.sent.toFixed();
					const recv = this.recv.toFixed();
					const drawn = this.entitiesDrawn;
					const total = this.map.entities.length;
					const ponies = this.map.entities.reduce((sum, e) => sum + (e.type === PONY_TYPE ? 1 : 0), 0);
					const extra = DEVELOPMENT ? `(${drawn}/${total}) ${tris} tris, ${flush} flush, ${this.audio.trackName}` : version;
					const gl2 = isWebGL2(gl) ? ' WebGL2' : '';
					const engine = this.engine === Engine.Default ? '' : Engine[this.engine].toUpperCase();
					const fps = this.drawFps.toFixed(0);
					const low = this.disableLighting ? ' LOW' : '';
					const extraStats = this.extraStats;
					const palSize = ` pal ${this.paletteManager.textureSize}`;
					const coords = this.player ? ` Your Cords: X${Math.round(this.player.x)} Y${Math.round(this.player.y)}` : '';
					value = `${extraStats}${engine} ${fps} fps ${sent}/${recv} kb/s ${ponies} ponies${coords} ${extra}${gl2}${low}${palSize}`.trim();
				}
				try {
					const parent = this.statsText && (this.statsText.parentElement || this.statsText.parentNode);
					const parentEl = parent instanceof HTMLElement ? parent : null;

					if (parentEl) {
						parentEl.style.right = '';
						parentEl.style.bottom = '';

						// Новое положение статы (вверху по центру)
						parentEl.style.position = 'absolute';
						parentEl.style.top = '8px';
						parentEl.style.left = '50%';
						parentEl.style.transform = 'translateX(-50%)';
						parentEl.style.textAlign = 'center';
						parentEl.style.pointerEvents = 'none';
						parentEl.style.zIndex = '9999';
					}
				} catch (e) {
					// fallback при ошибке
				}


				if (value !== this.statsTextValue) {
					this.statsText.nodeValue = value;
					this.statsTextValue = value;
				}
			}

			this.lastStats = performance.now();
			this.onClock.next(formatHourMinutes(this.time));
		}

		TIMING && timeReset();

		spriteBatch!.drawnTrisStats = 0;
		spriteBatch!.flushes = 0;
		paletteBatch!.drawnTrisStats = 0;
		paletteBatch!.flushes = 0;
	}

	   private setIris(iris: Iris) {
		   if (!this.player) return;
		   this.lastLookIris = iris; // RAW iris ONLY
		   this.applyIrisToPlayer(this.player, iris);
	   }

	   private setIrisFromZone(ix: number, iy: number) {
		   if (!this.player) return;
		   // If either eye is in shocked mode, don't invert sides for shocked overlays
		   const mode = this.getCurrentIrisMode();
		   const invertSides = !(mode.left === 'shocked' || mode.right === 'shocked');
		   const iris = this.getLookIrisFromZone(ix, iy, invertSides);
		   this.lastLookIris = iris; // RAW iris ONLY
		   this.applyIrisToPlayer(this.player, iris);
	   }

	private setExpressionEffect(extra: ExpressionExtra) {
		if (!this.player) return;
		const current = this.player.ponyState.expression;
		const palette = this.player.palettePonyInfo;
		const hasPersistentBlush = extra === ExpressionExtra.Blush && palette !== undefined && palette.blush;
		const expressionAlready = current && current.extra === extra;

		if (hasPersistentBlush && palette !== undefined) {
			palette.blush = false;
			if (!expressionAlready) {
				return;
			}
		}

		const next = current && current.extra === extra ? ExpressionExtra.None : extra;
		this.applyExtraToPlayer(this.player, next);
	}

	private getHeadLookAnchor(player: Pony) {
		const headPosition = getPonyHeadPosition(player.ponyState, 0, 0);
		const headTurnOffsetX = [0, 1, 1, 1, 1, 1, 0][clamp(player.ponyState.headTurn, 0, 6)];
		const headTurnOffsetY = [0, 0, 1, 1, 0, 0, 0][clamp(player.ponyState.headTurn, 0, 6)];
		const localHeadX = headPosition.x + headTurnOffsetX + 35.5;
		const mirroredHeadX = isFacingRight(player) ? -localHeadX : localHeadX;
		const centerX = player.x + toWorldX(mirroredHeadX);
		const centerY = player.y + toWorldY(headPosition.y + headTurnOffsetY + 42);

		return { x: centerX, y: centerY };
	}

	private getLookIrisFromHeadDelta(dx: number, dy: number): Iris {
		const centerZoneX = toWorldX(24);
		const centerZoneY = toWorldY(20);
		const ix = Math.abs(dx) <= centerZoneX ? 0 : (dx < 0 ? -1 : 1);
		const iy = Math.abs(dy) <= centerZoneY ? 0 : (dy < 0 ? -1 : 1);
		// If either eye is in manual shocked mode, shocked overlays shouldn't be side-inverted.
		const mode = this.getCurrentIrisMode();
		const invertSides = !(mode.left === 'shocked' || mode.right === 'shocked');
		return this.getLookIrisFromZone(ix, iy, invertSides);
	}

	private getLookIrisFromZone(ix: number, iy: number, invertSides: boolean = true): Iris {
		// Единая мировая система: Left=-1, Right=+1
		// Для обычного режима: визуально Left/Right должны быть инвертированы (лево — справа, право — слева)
		// shocked режим работает через overlay и не зависит от этого
		if (ix === 0 && iy === 0) return Iris.Forward;
		if (invertSides) {
			if (ix === 1 && iy === 0) return Iris.Left;
			if (ix === -1 && iy === 0) return Iris.Right;
			if (ix === 1 && iy === -1) return Iris.UpLeft;
			if (ix === -1 && iy === -1) return Iris.UpRight;
			if (ix === 1 && iy === 1) return Iris.DownRight;
			if (ix === -1 && iy === 1) return Iris.DownLeft;
			if (ix === 0 && iy === -1) return Iris.Up;
			if (ix === 0 && iy === 1) return Iris.Down;
		} else {
			// world-coordinates mapping (no visual inversion) — used for shocked overlays
			if (ix === 1 && iy === 0) return Iris.Right;
			if (ix === -1 && iy === 0) return Iris.Left;
			if (ix === 1 && iy === -1) return Iris.UpRight;
			if (ix === -1 && iy === -1) return Iris.UpLeft;
			if (ix === 1 && iy === 1) return Iris.DownRight;
			if (ix === -1 && iy === 1) return Iris.DownLeft;
			if (ix === 0 && iy === -1) return Iris.Up;
			if (ix === 0 && iy === 1) return Iris.Down;
		}
		return Iris.Forward;
	}

	   // удалено: getCurrentLookIris (не используется)

	private visualIrisToEngineIris(iris: Iris): Iris {
		return iris;
	}

	   // удалено: engineIrisToVisualIris (не используется)

	private getBaseEyeForLook(currentEye: Eye, rememberedEye: Eye | undefined): Eye {
		if (rememberedEye !== undefined && currentEye === adjustEyeForIris(rememberedEye, this.lastLookIris)) {
			return rememberedEye;
		}

		return currentEye;
	}

		private createExpressionWithIris(player: Pony, iris: Iris): Expression {
		       const current = player.ponyState.expression;
		       const info = player.palettePonyInfo;
		       const currentLeft = current ? current.left :
			       ((info && info.eyeOpennessLeft !== undefined) ? info.eyeOpennessLeft : Eye.Neutral);
		       const currentRight = current ? current.right :
			       ((info && info.eyeOpennessRight !== undefined) ? info.eyeOpennessRight : Eye.Neutral);
		       const baseLeft = this.getBaseEyeForLook(currentLeft, this.lastLookBaseLeft);
		       const baseRight = this.getBaseEyeForLook(currentRight, this.lastLookBaseRight);


// Ручной режим работает только при явной активации
		   const leftIrisMode = this.irisModeActive ? this.irisMode.left : getIrisModeForEye(current, 'left');
		   const rightIrisMode = this.irisModeActive ? this.irisMode.right : getIrisModeForEye(current, 'right');

			   const leftModeIris = applyIrisMode(iris, leftIrisMode);
			   const rightModeIris = applyIrisMode(iris, rightIrisMode);

		       const adjustedIrisLeft = adjustIrisForEye(baseLeft, leftModeIris);
		       const adjustedIrisRight = adjustIrisForEye(baseRight, rightModeIris);

		       const isVertical = irisHasVertical(iris);
		       const left = isVertical ? adjustEyeForIris(baseLeft, iris) : baseLeft;
		       const right = isVertical ? adjustEyeForIris(baseRight, iris) : baseRight;

		       this.lastLookBaseLeft = baseLeft;
		       this.lastLookBaseRight = baseRight;

		       if (current) {
			       return { ...current, left, right, leftIris: adjustedIrisLeft, rightIris: adjustedIrisRight };
		       }

		       const muzzle = (info && info.muzzle !== undefined) ? info.muzzle : Muzzle.Neutral;

		       return {
			       left,
			       right,
			       leftIris: adjustedIrisLeft,
			       rightIris: adjustedIrisRight,
			       muzzle,
			       extra: ExpressionExtra.None,
		       };
	       }

	private createExpressionWithExtra(player: Pony, extra: ExpressionExtra): Expression {
		const current = player.ponyState.expression;

		if (current) {
			if (extra === ExpressionExtra.Zzz) {
				return { ...current, left: Eye.Closed, right: Eye.Closed, extra };
			}

			if (hasFlag(current.extra, ExpressionExtra.Zzz) && !hasFlag(extra, ExpressionExtra.Zzz)) {
				const info = player.palettePonyInfo;
				const left = (info && info.eyeOpennessLeft) || Eye.Neutral;
				const right = (info && info.eyeOpennessRight) || Eye.Neutral;
				return { ...current, left, right, extra };
			}

			return { ...current, extra };
		}

		const info = player.palettePonyInfo;
		const left = extra === ExpressionExtra.Zzz ? Eye.Closed : ((info && info.eyeOpennessLeft) || Eye.Neutral);
		const right = extra === ExpressionExtra.Zzz ? Eye.Closed : ((info && info.eyeOpennessRight) || Eye.Neutral);
		const muzzle = (info && info.muzzle !== undefined) ? info.muzzle : Muzzle.Neutral;
		const iris = this.visualIrisToEngineIris(this.lastLookIris);

		return {
			left,
			right,
			leftIris: iris,
			rightIris: iris,
			muzzle,
			extra,
		};
	}

	private applyIrisToPlayer(player: Pony | undefined, iris: Iris) {
		if (!player) return;
		// lastLookIris всегда raw iris!
		const engineIris = this.visualIrisToEngineIris(iris);
		const newExpr = this.createExpressionWithIris(player, engineIris);
		const encoded = encodeExpression(newExpr);

		player.ponyState.expression = newExpr;
		player.expr = encoded;
		this.send(server => server.expression(encoded));
		this.onActionsUpdate.next();
	}

	private applyExtraToPlayer(player: Pony, extra: ExpressionExtra) {
		const newExpr = this.createExpressionWithExtra(player, extra);
		const encoded = encodeExpression(newExpr);

		// Сброс ручного режима iris при применении эффекта
		this.irisMode = { left: 'normal', right: 'normal' };
		this.irisModeActive = false;

		this.lastLookBaseLeft = undefined;
		this.lastLookBaseRight = undefined;

		player.ponyState.expression = newExpr;
		player.expr = encoded;
		this.send(server => server.expression(encoded));
		this.onActionsUpdate.next();
	}
}

// Iris направления с вертикальной составляющей (вверх или вниз)
function irisHasVertical(iris: Iris): boolean {
	return iris === Iris.Up ||
		iris === Iris.Down ||
		iris === Iris.Down2 ||
		iris === Iris.UpLeft ||
		iris === Iris.UpRight ||
		iris === Iris.DownLeft ||
		iris === Iris.DownRight ||
		iris === Iris.DownLeft2 ||
		iris === Iris.DownRight2 ||
		iris === Iris.ShockedUp ||
		iris === Iris.ShockedDown ||
		iris === Iris.ShockedDown2 ||
		iris === Iris.ShockedUpLeft ||
		iris === Iris.ShockedUpRight ||
		iris === Iris.ShockedDownLeft ||
		iris === Iris.ShockedDownRight ||
		iris === Iris.ShockedDownLeft2 ||
		iris === Iris.ShockedDownRight2;
}

// Пары: [низкий (narrow), высокий (open)]
const EYE_VERTICAL_PAIRS: ReadonlyArray<[Eye, Eye]> = [
	[Eye.Neutral4, Eye.Neutral3],
	[Eye.Frown3,   Eye.Frown2],
	[Eye.Sad4,     Eye.Sad3],
	[Eye.Angry2,   Eye.Angry],
];

// При взгляде вверх/вниз — расширить «низкий» глаз до «высокого» варианта,
// при взгляде в стороны/вперёд — вернуть обратно.
function adjustEyeForIris(eye: Eye, iris: Iris): Eye {
	const vertical = irisHasVertical(iris);
	if (vertical) {
		for (const [narrow, open] of EYE_VERTICAL_PAIRS) {
			if (eye === narrow) return open;
		}
	}
	return eye;
}
