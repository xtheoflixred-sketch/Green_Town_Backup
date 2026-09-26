import {
	PonyEye, PonyState, PalettePonyInfo, PaletteSpriteSet, Palette, HeadAnimationFrame, ColorExtra,
	Eye, Iris, ColorExtraSets, ExpressionExtra, BodyAnimationFrame, DrawPonyOptions, Muzzle, BodyShadow, DrawOptions,
	NoDraw, PaletteSpriteBatch, defaultDrawOptions, PonyStateFlags, PaletteManager, Matrix2D, HeadAnimationProperties,
	getEyeOpenness, Expression, getMuzzleOpenness,
} from '../common/interfaces';
import { WHITE, SHINES_COLOR, FAR_COLOR, TRANSPARENT, fillToOutlineColor } from '../common/colors';
import { toInt, hasFlag, repeat, flatten, point } from '../common/utils';
import * as sprites from '../generated/sprites';
import * as offsets from '../common/offsets';
import { defaultHeadAnimation, defaultBodyFrame, defaultHeadFrame } from './ponyAnimations';
import { toWorldX, toWorldY, toScreenX, toScreenYWithZ } from '../common/positionUtils';
import {
	frontHooves, PONY_WIDTH, PONY_HEIGHT, wings, chestBehind, tails, ponytails, chest, neckAccessories, waistAccessories,
	SLEEVED_ACCESSORIES, blinkFrames, flipIris, claws, Sets, backAccessories, SLEEVED_BACK_ACCESSORIES,
	CHEST_ACCESSORIES_IN_FRONT, flipFaceAccessoryType, flipFaceAccessoryPattern, backLegSleeves,
	NO_MANE_HEAD_ACCESSORIES, backHoovesInFront, frontHoovesInFront
} from './ponyUtils';
import { HEAD_ACCESSORY_OFFSETS, EAR_ACCESSORY_OFFSETS, EXTRA_ACCESSORY_OFFSETS } from '../common/offsets';
import { createMat2D, identityMat2D, translateMat2D, copyMat2D, rotateMat2D, scaleMat2D } from '../common/mat2d';
import { darkenForOutline, createDefaultPony, syncLockedPonyInfo, toPalette, mockPaletteManager } from '../common/ponyInfo';
import { defaultPonyState, defaultDrawPonyOptions } from './ponyHelpers';
import { drawCanvas } from '../graphics/contextSpriteBatch';

type Batch = PaletteSpriteBatch;
type Info = Readonly<PalettePonyInfo>;
type State = Readonly<PonyState>;
type Options = Readonly<DrawPonyOptions>;

const holdingDrawOptions: DrawOptions = {
	...defaultDrawOptions,
	shadowColor: TRANSPARENT,
};

const holdingOutlineDrawOptions: DrawOptions = {
	...defaultDrawOptions,
	shadowColor: TRANSPARENT,
	outlineMode: true,
};

function checker(parts: number[]) {
	const set = new Set(parts);
	return (part: number) => set.has(part);
}

function partChecker(parts: number[]) {
	const check = checker(parts);
	return (set: PaletteSpriteSet | undefined) => set !== undefined && !!set.type && check(set.type);
}

const SHADOW_OX = 20;
const SHADOW_OY = 64;
const FAR_OX = -3;
const FAR_OY = -1;
const FAR_WING_OX = -4;
const FAR_WING_OY = 0;

const hasNoMane = checker(NO_MANE_HEAD_ACCESSORIES);
const behindBackAccessory = partChecker([1]);
const sleevedAccessory = partChecker(SLEEVED_ACCESSORIES);
const sleevedBackAccessory = partChecker(SLEEVED_BACK_ACCESSORIES);
const chestAccessoryInFront = partChecker(CHEST_ACCESSORIES_IN_FRONT);

const pointZero = point(0, 0);

const headFlipOffsetX = 35.5;
const headFlipOffsetY = 42;

const headTransform = createMat2D();

function clamp(value: number, min: number, max: number): number {
	return value > min ? (value < max ? value : max) : min;
}

function at<T>(items: T[], index: any): T | undefined {
	// if (DEVELOPMENT) {
	// 	if (items.length === 0) {
	// 		console.warn(`Empty array at: ${getStackLocation(2)} / ${getStackLocation(3)}`);
	// 	} else if (index < 0 || index >= items.length) {
	// 		console.warn(`Index out of range ${index} of 0..${items.length} at: ${getStackLocation(2)} / ${getStackLocation(3)}`);
	// 	}
	// }

	return items[clamp(index | 0, 0, items.length - 1)];
}

function att<T>(items: T[] | undefined, index: any): T | undefined {
	return items && items[clamp(index | 0, 0, items.length - 1)];
}

function atDef<T>(items: T[] | undefined, index: number, def: T): T {
	return (items && items.length > 0 && index >= 0 && index < items.length) ? items[index | 0] : def;
}

export function getPonyAnimationFrame<T>({ frames }: { frames: T[] }, frame: number, defaultFrame: T): T {
	return frames.length > 0 ? frames[Math.max(0, frame) % frames.length] : defaultFrame;
}

function getHeadXY(x: number, y: number, turned: boolean, frame: BodyAnimationFrame, headFrame: HeadAnimationFrame) {
	const headOffset = at(offsets.headOffsets, frame.body)!;
	const headX = x + frame.headX + (headFrame.headX * (turned ? -1 : 1)) + headOffset.x;
	const headY = y + frame.headY + headFrame.headY + headOffset.y;
	return { headX, headY };
}

export function getPonyHeadPosition(state: State, ponyX: number, ponyY: number) {
	const baseFrame = getPonyAnimationFrame(state.animation, state.animationFrame, defaultBodyFrame);
	const wingFrame = state.wingAnimation && getPonyAnimationFrame(
		state.wingAnimation, state.wingAnimationFrame || 0, defaultBodyFrame);
	const frame = wingFrame ? { ...baseFrame, wing: wingFrame.wing, wingX: wingFrame.wingX, wingY: wingFrame.wingY } : baseFrame;
	const headFrame = getPonyAnimationFrame(state.headAnimation || defaultHeadAnimation, state.headAnimationFrame, defaultHeadFrame);
	const baseX = ponyX - PONY_WIDTH / 2;
	const baseY = ponyY - PONY_HEIGHT;
	const x = baseX + frame.bodyX;
	const y = baseY + frame.bodyY;
	const headTurned = state.headTurnedOverride === undefined
		? (frame.headTurned === undefined ? state.headTurned : frame.headTurned)
		: state.headTurnedOverride;
	const { headX, headY } = getHeadXY(x, y, headTurned, frame, headFrame);
	return { x: headX, y: headY };
}

export function createHeadTransform(
	originalTransform: Matrix2D | undefined, headX: number, headY: number, { headTilt, headTurned }: State
) {
	if (originalTransform !== undefined) {
		copyMat2D(headTransform, originalTransform);
	} else {
		identityMat2D(headTransform);
	}

	translateMat2D(headTransform, headTransform, headX + headFlipOffsetX, headY + headFlipOffsetY);

	if (headTilt) {
		rotateMat2D(headTransform, headTransform, headTilt * 0.1);
	}

	scaleMat2D(headTransform, headTransform, headTurned ? -1 : 1, 1);
	translateMat2D(headTransform, headTransform, -headFlipOffsetX, -headFlipOffsetY);
	return headTransform;
}

export function getHeadY(frame: BodyAnimationFrame, headFrame: HeadAnimationFrame): number {
	const headOffset = offsets.headOffsets[frame.body];
	return frame.bodyY + frame.headY + headFrame.headY + headOffset.y;
}

const defaultShadow: BodyShadow = { frame: 0, offset: 0 };
const hairOffsets = [
	0, 0, 0, 0,
	-1, -1, 0, 0,
	0, 0, 0, -1,
	-1, 0, 0, 0,
	0, 0, 0, 0,
	...repeat(100, 0),
];

function draw(options: Options, flag: NoDraw) {
	if (TOOLS) {
		return !hasFlag(options.no, flag);
	} else {
		return true;
	}
}

const headOffsetsX = [0, 1, 1, 1, 1, 1, 0];
const headOffsetsY = [0, 0, 1, 1, 0, 0, 0];

let toys: (PaletteSpriteSet | undefined)[] = [];

export function initializeToys(paletteManager: PaletteManager) {
	function set(type: number, pattern: number, colors: number[]): PaletteSpriteSet {
		const palette = [
			TRANSPARENT,
			...flatten(colors.map(color => [color, darkenForOutline(fillToOutlineColor(color))]))
		];
		const outlinePalette = palette.map((_, index) => index === 0 ? TRANSPARENT : WHITE);

		return {
			type,
			pattern,
			palette: paletteManager.add(palette),
			outlinePalette: paletteManager.add(outlinePalette),
		};
	}

	toys = [
		undefined,
		// hat
		set(2, 0, [0xffffffff, 0xff2525ff]),
		set(2, 0, [0xffffffff, 0x22ac22ff]),
		set(2, 0, [0xffffffff, 0x2e58f4ff]),
		set(2, 0, [0xffffffff, 0xff71ffff]),
		// snowpony
		set(3, 0, [0xffffffff, 0x000000ff, 0xff9100ff, 0xff0000ff]),
		set(4, 0, [0xffffffff, 0x000000ff, 0xff9100ff, 0xff0000ff]),
		set(4, 0, [0x404040ff, 0xff0000ff, 0x000000ff, 0xff0000ff]),
		// gift
		set(6, 0, [0xcf1717ff, 0xecd132ff]),
		set(6, 0, [0xdfc588ff, 0xe7559bff]),
		set(6, 0, [0x7fc484ff, 0x4a79daff]),
		set(6, 0, [0xd56a69ff, 0x62ab64ff]),
		set(6, 0, [0xe586dfff, 0x9553c1ff]),
		// hanging thing
		set(5, 0, [0x91622fff, 0xc02455ff, 0x429a51ff, 0xb9c0d8ff, 0xffd94fff, 0xeca242ff]), // bell
		set(7, 0, [0x91622fff, 0xc02455ff, 0x429a51ff, 0xb9c0d8ff, 0xc0ccc4ff]), // mistletoe
		set(17, 0, [0x91622fff, 0xc02455ff, 0x429a51ff, 0x000000ff, 0xe7b86fff, 0x3f1d0fff]), // cookie
		set(10, 0, [0x91622fff, 0xc02455ff, 0x429a51ff, 0x000000ff]), // spider
		// teddy
		set(8, 0, [0xa86230ff, 0xdfbe8bff, TRANSPARENT, TRANSPARENT]), // brown
		set(8, 0, [0xa86230ff, 0xdfbe8bff, 0xffa500ff, 0xffffffff]), // brown angel
		set(8, 0, [0x474444ff, 0x96623eff, TRANSPARENT, TRANSPARENT]), // black
		set(8, 0, [0x474444ff, 0x96623eff, 0xffa500ff, 0xffffffff]), // black angel
		set(9, 1, [0xa86230ff, 0xdfbe8bff, 0xff0000ff, TRANSPARENT, 0xf5f5f5ff]), // brown clothes
		set(9, 1, [0x474444ff, 0x96623eff, 0xff0000ff, TRANSPARENT, 0xf5f5f5ff]), // black clothes
		set(9, 0, [0xdce5edff, 0xffffffff, 0xff0000ff, 0xdfbe8bff, 0x645137ff]), // white santa
		// xmas tree
		set(11, 0, [0x1a9b2fff, 0x56c7ffff, 0xde4d68ff, 0xf1d224ff]),
		set(11, 1, [0x1a9b2fff, 0xf1d224ff, 0x1a9b2fff, 0xde4d68ff]),
		// deer
		set(12, 0, [0x7b4b24ff, 0xcf0e0eff, 0xbfaa8cff]),
		set(16, 0, [0x7b4b24ff, 0xcf0e0eff, 0xbfaa8cff, 0xffffffff, 0x56c7ffff, 0xf1d224ff]),
		// candy horns
		set(13, 0, [0xffffffff, 0xff1b1bff, TRANSPARENT, TRANSPARENT]), // one
		set(13, 0, [0xffffffff, 0xff1b1bff, 0xffffffff, 0xff1b1bff]), // two
		set(13, 0, [0x58df6aff, 0xffffffff, 0x3387e9ff, 0xffffffff]), // two (alt)
		// star
		set(14, 0, [0xffd94fff, 0xeca242ff]),
		// halo
		set(15, 0, [0xffd94fff, 0xeca242ff]),
	];

	if (DEVELOPMENT && toys.length > 33) {
		console.error('too many toys', toys.length);
	}
}

// export accessor for toy data
export function getToySprite(id: number): PaletteSpriteSet | undefined {
	return toys[id];
}

export function getToyColorExtra(id: number): ColorExtra | undefined {
	const toySet = getToySprite(id);
	if (!toySet) return undefined;

	const layers = [
		sprites.extraAccessoriesBehind[toySet.type],
		sprites.extraAccessories[toySet.type],
	]
		.map(patterns => patterns && patterns[toySet.pattern])
		.filter((pattern): pattern is NonNullable<typeof pattern> => !!pattern);
	const colors = layers
		.map(layer => layer.color)
		.filter((color): color is NonNullable<typeof color> => !!color);
	const firstColor = colors[0];
	if (!firstColor) return undefined;
	const item: ColorExtra = { color: firstColor };
	if (colors.length > 1) item.colorMany = colors;
	const extra = layers.map(layer => layer.extra).find(value => !!value);
	if (extra) item.extra = extra;
	if (toySet.palette && toySet.palette.colors) {
		item.palette = toySet.palette.colors;
		item.palettes = [toySet.palette.colors];
	}
	return colors.length > 0 ? item : undefined;
}

// Draw a preview of a toy on a pony's head for icon rendering
export function drawToyPreview(toyId: number, size: number = 30): HTMLCanvasElement {
	const toySet = getToySprite(toyId);
	if (!toySet) {
		// Return empty canvas if toy not found
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		return canvas;
	}

	// Create a simple pony for preview
	const info = createDefaultPony();
	info.coatFill = '#e0e0e0';
	info.mane!.type = 0;
	info.backMane!.type = 0;
	info.tail!.type = 0;
	syncLockedPonyInfo(info);
	const palettePony = toPalette(info, mockPaletteManager);

	// Create state
	const state = defaultPonyState();

	// Draw pony with toy
	const options = { ...defaultDrawPonyOptions(), toy: toyId };
	return drawCanvas(size, size, sprites.paletteSpriteSheet, undefined, batch => {
		// Position pony to show toy clearly
		drawPony(batch, palettePony, state, 15, 40, options);
	});
}

// const zeroPoint = point(0, 0);
const wakes = [
	{ ox: 21, oy: 60, behind: sprites.pony_wake_4, front: sprites.pony_wake_3 },
	{ ox: 24, oy: 60, behind: sprites.pony_wake_6, front: sprites.pony_wake_5 },
	{ ox: 18, oy: 51, behind: sprites.pony_wake_2, front: sprites.pony_wake_1 },
];

// swimming effects of different size; add value per tail
const wakeIndices = [0, 2, 1, 0, 2, 2, 2, 0, 2, 2, 2, 1, 2, 2, 2, 1, 1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 2, 2, 2, 1];

function getWakeIndex(info: Info) {
	const tail = info.tail && info.tail.type || 0;
	return wakeIndices[tail];
}

export function drawPony(batch: Batch, info: Info, state: State, ponyX: number, ponyY: number, options: Options) {
	const drawOptions: Options = info.customShadows ? { ...options, shadowColor: info.shadowColor as unknown as number } : options;
	// Draw selection outline glow behind pony
	if (drawOptions.selected) {
		// Draw white offset outlines (1 pixel in cardinal directions) for selection highlight
		const outlineOffsets: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];

		for (const [ox, oy] of outlineOffsets) {
			batch.save();
			batch.translate(ox, oy);

			// Draw pony outline in white, without shadow and without selection to avoid recursion
			const outlineOptions: DrawPonyOptions = {
				...drawOptions,
				selected: false,
				shadow: false,
				shadowColor: TRANSPARENT,
				outlineMode: true, // Enable white outline rendering
			};
			drawPonyImpl(batch, info, state, ponyX, ponyY, outlineOptions);
			batch.restore();
		}
	}

	// Draw the actual pony on top
	drawPonyImpl(batch, info, state, ponyX, ponyY, drawOptions);
}

function drawPonyImpl(batch: Batch, info: Info, state: State, ponyX: number, ponyY: number, options: Options) {
	const outlineMode = !!options.outlineMode;
	const outlineColor = options.outlineColor || WHITE;
	const drawLocalSet = (
		spriteSets: ColorExtraSets,
		set: PaletteSpriteSet | undefined,
		x: number,
		y: number,
		tint: number,
	) => drawSet(batch, spriteSets, set, x, y, tint, outlineMode, outlineColor);

	const baseFrame = getPonyAnimationFrame(state.animation, state.animationFrame, defaultBodyFrame);
	const wingFrame = state.wingAnimation && getPonyAnimationFrame(
		state.wingAnimation, state.wingAnimationFrame || 0, defaultBodyFrame);
	const frame = wingFrame ? { ...baseFrame, wing: wingFrame.wing, wingX: wingFrame.wingX, wingY: wingFrame.wingY } : baseFrame;
	const headFrame = getPonyAnimationFrame(state.headAnimation || defaultHeadAnimation, state.headAnimationFrame, defaultHeadFrame);
	const headAnimationProperties = (state.headAnimation || defaultHeadAnimation).properties;
	const baseX = ponyX - PONY_WIDTH / 2;
	const baseY = ponyY - PONY_HEIGHT;
	const x = baseX + frame.bodyX;
	const y = baseY + frame.bodyY;
	const body = frame.body;
	const frameHeadTurned = state.headTurnedOverride === undefined
		? (frame.headTurned === undefined ? state.headTurned : frame.headTurned)
		: state.headTurnedOverride;
	const { headX, headY } = getHeadXY(x, y, frameHeadTurned, frame, headFrame);
	const frontLegOffset = at(offsets.frontLegOffsets, body)!;
	const backLegOffset = at(offsets.backLegOffsets, body)!;
	const wingOffset = at(offsets.wingOffsets, body)!;
	const chestOffset = at(offsets.chestAccessoryOffsets, body)!;
	const chestX = x + chestOffset.x;
	const chestY = y + chestOffset.y;
	const shadow = atDef(state.animation.shadow, state.animationFrame, defaultShadow);
	const backOffset = at(offsets.backAccessoryOffsets, body)!;
	const wing = at(wings, frame.wing);
	const flipped = options.flipped;
	const farWingSet = flipped ? info.wings : info.wingsRight;
	const closeWingSet = flipped ? info.wingsRight : info.wings;
	const farEarSet = flipped ? info.ears : info.earsRight;
	const farSleeveSet = flipped ? info.sleeveAccessory : info.sleeveAccessoryRight;
	const closeSleeveSet = flipped ? info.sleeveAccessoryRight : info.sleeveAccessory;
	const farWaistSet = flipped ? info.waistAccessory : info.waistAccessoryRight;
	const closeWaistSet = flipped ? info.waistAccessoryRight : info.waistAccessory;
	const farWaistExtraSet = flipped ? info.waistAccessoryExtra : info.waistAccessoryExtraRight;
	const closeWaistExtraSet = flipped ? info.waistAccessoryExtraRight : info.waistAccessoryExtra;
	const closeBodySet = flipped ? info.bodyRight : info.body;
	const farFrontLegSet = flipped ? info.frontLegs : info.frontLegsRight;
	const closeFrontLegSet = flipped ? info.frontLegsRight : info.frontLegs;
	const farBackLegSet = flipped ? info.backLegs : info.backLegsRight;
	const closeBackLegSet = flipped ? info.backLegsRight : info.backLegs;
	const farFrontHoofSet = flipped ? info.frontHooves : info.frontHoovesRight;
	const closeFrontHoofSet = flipped ? info.frontHoovesRight : info.frontHooves;
	const farBackHoofSet = flipped ? info.backHooves : info.backHoovesRight;
	const closeBackHoofSet = flipped ? info.backHoovesRight : info.backHooves;
	const farFrontLegExtraSet = flipped ? info.frontLegsExtra : info.frontLegsExtraRight;
	const closeFrontLegExtraSet = flipped ? info.frontLegsExtraRight : info.frontLegsExtra;
	const farBackLegExtraSet = flipped ? info.backLegsExtra : info.backLegsExtraRight;
	const closeBackLegExtraSet = flipped ? info.backLegsExtraRight : info.backLegsExtra;
	const farFrontHoofExtraSet = flipped ? info.frontHoovesExtra : info.frontHoovesExtraRight;
	const closeFrontHoofExtraSet = flipped ? info.frontHoovesExtraRight : info.frontHoovesExtra;
	const farBackHoofExtraSet = flipped ? info.backHoovesExtra : info.backHoovesExtraRight;
	const closeBackHoofExtraSet = flipped ? info.backHoovesExtraRight : info.backHoovesExtra;
	const farFrontLegAccessoryExtraSet = flipped ? info.frontLegAccessoryExtra : info.frontLegAccessoryExtraRight;
	const closeFrontLegAccessoryExtraSet = flipped ? info.frontLegAccessoryExtraRight : info.frontLegAccessoryExtra;
	const farBackLegAccessoryExtraSet = flipped ? info.backLegAccessoryExtra : info.backLegAccessoryExtraRight;
	const closeBackLegAccessoryExtraSet = flipped ? info.backLegAccessoryExtraRight : info.backLegAccessoryExtra;

	const headOffset = clamp(state.headTurn, 0, headOffsetsX.length - 1);
	const headOffsetX = headOffsetsX[headOffset];
	const headOffsetY = headOffsetsY[headOffset];

	const headTotalY = headY + headOffsetY;
	const headTransform = createHeadTransform(undefined, headX + headOffsetX, headTotalY, {
		...state,
		headTurned: frameHeadTurned,
	});
	const headCropY = 42 - ((headTotalY + headFlipOffsetY) - baseY);
	const cropW = 80;
	const cropH = 65;

	const shadowX = baseX + shadow.offset + SHADOW_OX;
	const shadowY = baseY + SHADOW_OY;

	const wake = wakes[getWakeIndex(info)];
	const wakeX = baseX + wake.ox;
	const wakeY = baseY + wake.oy;
	const wakeFrame = Math.floor(options.gameTime * 7 / 1000) % wake.behind.frames.length;
	const swimming = options.swimming;
	const wakePalette = outlineMode ? info.outlineWaterPalette : info.waterPalette;

	if (swimming) {
		batch.drawSprite(wake.behind.frames[wakeFrame], outlineColor, wakePalette, wakeX, wakeY);
		batch.crop(-40, -70, cropW, cropH);
	}

	// shadow (unchanged - stays black with transparency)
	if (options.shadow) {
		const sprite = at(sprites.ponyShadows, shadow.frame);
		sprite && batch.drawSprite(sprite, options.shadowColor, info.defaultPalette, shadowX, shadowY);
	}

	// shadow outline for selection
	if (options.selected && options.shadow) {
		const sprite = at(sprites.ponyShadows, shadow.frame);
		if (sprite) {
			const outlineOffsets: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
			for (const [ox, oy] of outlineOffsets) {
				batch.drawSprite(sprite, outlineColor, info.defaultPalette, shadowX + ox, shadowY + oy);
			}
		}
	}

	// head accessory
	const bounce = BETA && options.bounce;
	const maneOffsetY = 0;
	const maneBehindOffsetY = 0;
	const hatOffsetY = bounce ? hairOffsets[state.animationFrame] : 0;
	let hatOffset = at(HEAD_ACCESSORY_OFFSETS, info.mane ? info.mane.type : 0)!;
	const noMane = !info.mane || hasNoMane(info.mane.type);

	// temp front layer hat test
	// if (info.headAccessory !== undefined && info.headAccessory.type === 20) {
	//	hatOffset = zeroPoint;
	//}

	if (draw(options, NoDraw.Behind)) {
		// far wing
		drawLocalSet(wing, farWingSet, x + FAR_WING_OX + wingOffset.x + frame.wingX, y + FAR_WING_OY + wingOffset.y + frame.wingY, FAR_COLOR);

		batch.save();
		batch.multiplyTransform(headTransform);

		if (swimming) {
			// batch.drawRect(0xffff0066, 0, headCropY, cropW, cropH);
			batch.crop(0, headCropY, cropW, cropH);
		}

		if (noMane) {
			drawLocalSet(sprites.headAccessoriesBehind, info.headAccessory, hatOffset.x, hatOffset.y + hatOffsetY, WHITE);
		}

		if (draw(options, NoDraw.FarEar)) {
			drawLocalSet(sprites.earAccessoriesBehind, info.earAccessory, 0, 0, WHITE);
			drawLocalSet(sprites.earAccessoriesBehind, info.earAccessoryExtra, 0, 0, WHITE);
		}
	}

	if (draw(options, NoDraw.Body) && draw(options, NoDraw.FarEar)) {
		drawLocalSet(sprites.earsFar, farEarSet, 0, 0, draw(options, NoDraw.FarEarShade) ? FAR_COLOR : WHITE);
	}

	if (draw(options, NoDraw.Behind)) {
		drawLocalSet(sprites.hornsBehind, info.horn, 0, 0, WHITE);

		if (!noMane) {
			drawLocalSet(sprites.headAccessoriesBehind, info.headAccessory, hatOffset.x, hatOffset.y + hatOffsetY, WHITE);
		}

		drawLocalSet(sprites.backBehindManes, info.backMane, 0, maneBehindOffsetY, WHITE);

		drawLocalSet(ponytails, info.ponytail, 0, maneBehindOffsetY, WHITE);

		if (!frameHeadTurned) {
			drawLocalSet(sprites.behindManes, info.mane, 0, maneBehindOffsetY, WHITE);
		}

		batch.restore();

		// chest accessory behind
		drawLocalSet(chestBehind[body], info.chestAccessory, chestX, chestY, WHITE);
	}

	// legs
	const behindX = x + FAR_OX;
	const behindY = y + FAR_OY;
	const hasTailAccessory = behindBackAccessory(info.backAccessory);
	const hasTailAccessoryExtra = behindBackAccessory(info.backAccessoryExtra);
	const backAccessoryExtra = info.backAccessoryExtra;
	const hasSleeves = sleevedAccessory(info.chestAccessory);
	const hasBackSleeves = sleevedBackAccessory(info.backAccessory);
	const hasBackSleevesExtra = sleevedBackAccessory(info.backAccessoryExtra);

	const frontBehindX = behindX + frontLegOffset.x + frame.frontFarLegX;
	const frontBehindY = behindY + frontLegOffset.y + frame.frontFarLegY;
	const backBehindX = behindX + backLegOffset.x + frame.backFarLegX;
	const backBehindY = behindY + backLegOffset.y + frame.backFarLegY;
	const frontX = x + frontLegOffset.x + frame.frontLegX;
	const frontY = y + frontLegOffset.y + frame.frontLegY;
	const backX = x + backLegOffset.x + frame.backLegX;
	const backY = y + backLegOffset.y + frame.backLegY;
	const extraBackAccessoryInFront = !!info.backAccessoryExtraInFront;
	const deferExtraBackAccessory = !hasBackSleevesExtra && !hasTailAccessory;
	const extraBackSleevesBehindTail = !extraBackAccessoryInFront &&
		behindBackAccessory(info.backAccessory) && hasBackSleevesExtra;

	// far leg back
	if (draw(options, NoDraw.BackFarLeg)) {
		drawLeg(batch, backBehindX, backBehindY, frame.backFarLeg, sprites.backLegs,
			sprites.backLegHooves, sprites.backLegAccessories, farBackLegSet,
			flipped ? info.backLegAccessory : info.backLegAccessoryRight, farBackHoofSet, backHoovesInFront, FAR_COLOR,
			undefined, false, 0, 0, outlineMode, outlineColor);
		if (info.useExtraLegs || info.useExtraHooves || info.useExtraLegAccessory) {
			drawLeg(batch, backBehindX, backBehindY, frame.backFarLeg, sprites.backLegs,
				sprites.backLegHooves, sprites.backLegAccessories, info.useExtraLegs ? farBackLegExtraSet : undefined,
				info.useExtraLegAccessory ? farBackLegAccessoryExtraSet : undefined,
				info.useExtraHooves ? farBackHoofExtraSet : undefined, backHoovesInFront, FAR_COLOR,
				undefined, false, 0, 0, outlineMode, outlineColor);
		}
	}

	// far leg front
	if (draw(options, NoDraw.FrontFarLeg)) {
		drawLeg(batch, frontBehindX, frontBehindY, frame.frontFarLeg, sprites.frontLegs,
			frontHooves, sprites.frontLegAccessories, farFrontLegSet,
			flipped ? info.frontLegAccessory : info.frontLegAccessoryRight, farFrontHoofSet, frontHoovesInFront, FAR_COLOR,
			undefined, false, 0, 0, outlineMode, outlineColor);
		if (info.useExtraLegs || info.useExtraHooves || info.useExtraLegAccessory) {
			drawLeg(batch, frontBehindX, frontBehindY, frame.frontFarLeg, sprites.frontLegs,
				frontHooves, sprites.frontLegAccessories, info.useExtraLegs ? farFrontLegExtraSet : undefined,
				info.useExtraLegAccessory ? farFrontLegAccessoryExtraSet : undefined,
				info.useExtraHooves ? farFrontHoofExtraSet : undefined, frontHoovesInFront, FAR_COLOR,
				undefined, false, 0, 0, outlineMode, outlineColor);
		}
	}

	// far leg back sleeve
	if (draw(options, NoDraw.FarSleeves)) {
		const farBackSleeve = at(sprites.backLegSleeves, frame.backFarLeg);
		if (!extraBackAccessoryInFront && hasBackSleevesExtra) {
			drawLocalSet(farBackSleeve, info.backAccessoryExtra, backBehindX, backBehindY, FAR_COLOR);
		}
		if (hasBackSleeves) {
			drawLocalSet(farBackSleeve, info.backAccessory, backBehindX, backBehindY, FAR_COLOR);
		}
		if (extraBackAccessoryInFront && hasBackSleevesExtra) {
			drawLocalSet(farBackSleeve, info.backAccessoryExtra, backBehindX, backBehindY, FAR_COLOR);
		}
	}
	if (draw(options, NoDraw.CloseSleeves) && extraBackSleevesBehindTail) {
		drawLocalSet(at(backLegSleeves, frame.backLeg), info.backAccessoryExtra, backX, backY, WHITE);
		drawLocalSet(at(sprites.backLegSleeves2, frame.backLeg), info.backAccessoryExtra, backX, backY, WHITE);
	}

	// far leg front sleeve
	if (draw(options, NoDraw.FarSleeves) && hasSleeves) {
		drawLocalSet(at(sprites.frontLegSleeves, frame.frontFarLeg), farSleeveSet, frontBehindX, frontBehindY, FAR_COLOR);
	}

	// far waist accessory stays behind the tail
	if (draw(options, NoDraw.Body) && draw(options, NoDraw.BodyOnly)) {
		const waistFrame = frame.wing > 2 ? 16 : body;
		const waistOffset = at(offsets.waistAccessoryOffsets, waistFrame)!;
		drawLocalSet(waistAccessories[waistFrame], farWaistSet, x + waistOffset.x, y + waistOffset.y, FAR_COLOR);
		drawLocalSet(waistAccessories[waistFrame], farWaistExtraSet, x + waistOffset.x, y + waistOffset.y, FAR_COLOR);
	}

	// tail
	const tailOffset = at(offsets.tailOffsets, body)!;
	const tailX = x + tailOffset.x + frame.tailX;
	const tailY = y + tailOffset.y + frame.tailY;
	const failFrame = hasFlag(state.flags, PonyStateFlags.CurlTail) ? 1 : frame.tail;

	drawLocalSet(at(tails, failFrame), info.tail, tailX, tailY, WHITE);

	// tail accessory
	if (draw(options, NoDraw.BackAccessory)) {
		if (!extraBackAccessoryInFront && hasTailAccessoryExtra) {
			drawLocalSet(backAccessories[body], backAccessoryExtra, x + backOffset.x, y + backOffset.y, WHITE);
		}
		if (hasTailAccessory) {
			drawLocalSet(backAccessories[body], info.backAccessory, x + backOffset.x, y + backOffset.y, WHITE);
		}
		if (extraBackAccessoryInFront && hasTailAccessoryExtra) {
			drawLocalSet(backAccessories[body], backAccessoryExtra, x + backOffset.x, y + backOffset.y, WHITE);
		}
	}

	// body
	if (draw(options, NoDraw.Body) && draw(options, NoDraw.BodyOnly)) {
		drawLocalSet(sprites.body[body], closeBodySet, x, y, WHITE);
		drawLocalSet(sprites.body[body], flipped ? info.bodyExtraRight : info.bodyExtra, x, y, WHITE);
	}

	// neck accessory
	const frontNeckAccessory = true; // hasPart(info.neckAccessory, FRONT_NECK_ACCESSORIES);

	// if (!frontNeckAccessory) {
	// 	drawSpriteSet(context, neckAccessories[frame.body], info.neckAccessory, x, y);
	// }

	const cmOffset = at(offsets.cmOffsets, body)!;
	const hooves = (TOOLS && options.useAllHooves) ? sprites.frontLegHooves : frontHooves;

	// close legs back
	if (draw(options, NoDraw.BackLeg)) {
		drawLeg(
			batch, backX, backY, frame.backLeg, sprites.backLegs, sprites.backLegHooves, sprites.backLegAccessories,
			closeBackLegSet, flipped ? info.backLegAccessoryRight : info.backLegAccessory, closeBackHoofSet, backHoovesInFront, WHITE,
			info.cmPalette, flipped && !!info.cmFlip, x + cmOffset.x, y + cmOffset.y, outlineMode, outlineColor);
		if (info.useExtraLegs || info.useExtraHooves || info.useExtraLegAccessory) {
			drawLeg(
				batch, backX, backY, frame.backLeg, sprites.backLegs, sprites.backLegHooves, sprites.backLegAccessories,
				info.useExtraLegs ? closeBackLegExtraSet : undefined,
				info.useExtraLegAccessory ? closeBackLegAccessoryExtraSet : undefined,
				info.useExtraHooves ? closeBackHoofExtraSet : undefined, backHoovesInFront, WHITE,
				undefined, false, 0, 0, outlineMode, outlineColor);
		}
	}

	// back accessory
	if (draw(options, NoDraw.BackAccessory)) {
		if (!deferExtraBackAccessory && !extraBackAccessoryInFront && !hasTailAccessoryExtra) {
			drawLocalSet(backAccessories[body], backAccessoryExtra, x + backOffset.x, y + backOffset.y, WHITE);
		}
		if (!hasTailAccessory) {
			drawLocalSet(backAccessories[body], info.backAccessory, x + backOffset.x, y + backOffset.y, WHITE);
		}
		if (!deferExtraBackAccessory && extraBackAccessoryInFront && !hasTailAccessoryExtra) {
			drawLocalSet(backAccessories[body], backAccessoryExtra, x + backOffset.x, y + backOffset.y, WHITE);
		}
	}

	// close leg back sleeves
	if (draw(options, NoDraw.CloseSleeves)) {
		const closeBackSleeve = at(backLegSleeves, frame.backLeg);
		if (!extraBackSleevesBehindTail && !extraBackAccessoryInFront && hasBackSleevesExtra) {
			drawLocalSet(closeBackSleeve, info.backAccessoryExtra, backX, backY, WHITE);
		}
		if (hasBackSleeves) {
			drawLocalSet(closeBackSleeve, info.backAccessory, backX, backY, WHITE);
		}
		if (!extraBackSleevesBehindTail && extraBackAccessoryInFront && hasBackSleevesExtra) {
			drawLocalSet(closeBackSleeve, info.backAccessoryExtra, backX, backY, WHITE);
		}
	}

	const isChestAccessoryInFront = chestAccessoryInFront(info.chestAccessory);

	// chest accessory
	if (!isChestAccessoryInFront && draw(options, NoDraw.Front)) {
		drawLocalSet(chest[body], info.chestAccessory, chestX, chestY, WHITE);
	}

	// close legs front
	if (draw(options, NoDraw.FrontLeg)) {
		drawLeg(
			batch, frontX, frontY, frame.frontLeg, sprites.frontLegs, hooves, sprites.frontLegAccessories,
			closeFrontLegSet, flipped ? info.frontLegAccessoryRight : info.frontLegAccessory, closeFrontHoofSet, frontHoovesInFront, WHITE,
			undefined, false, 0, 0, outlineMode, outlineColor);
		if (info.useExtraLegs || info.useExtraHooves || info.useExtraLegAccessory) {
			drawLeg(
				batch, frontX, frontY, frame.frontLeg, sprites.frontLegs, hooves, sprites.frontLegAccessories,
				info.useExtraLegs ? closeFrontLegExtraSet : undefined,
				info.useExtraLegAccessory ? closeFrontLegAccessoryExtraSet : undefined,
				info.useExtraHooves ? closeFrontHoofExtraSet : undefined, frontHoovesInFront, WHITE,
				undefined, false, 0, 0, outlineMode, outlineColor);
		}
	}

	// close legs front sleeves
	if (draw(options, NoDraw.CloseSleeves) && hasSleeves) {
		drawLocalSet(at(sprites.frontLegSleeves, frame.frontLeg), closeSleeveSet, frontX, frontY, WHITE);
	}

	// chest accessory
	if (isChestAccessoryInFront && draw(options, NoDraw.Front)) {
		drawLocalSet(chest[body], info.chestAccessory, chestX, chestY, WHITE);
	}

	// close legs back (2)
	if (draw(options, NoDraw.BackLeg)) {
		drawLeg(
			batch, backX, backY, frame.backLeg, sprites.backLegs2, sprites.backLegHooves2, sprites.backLegAccessories2,
			closeBackLegSet, flipped ? info.backLegAccessoryRight : info.backLegAccessory, closeBackHoofSet, backHoovesInFront, WHITE,
			undefined, false, 0, 0, outlineMode, outlineColor);
		if (info.useExtraLegs || info.useExtraHooves || info.useExtraLegAccessory) {
			drawLeg(
				batch, backX, backY, frame.backLeg, sprites.backLegs2, sprites.backLegHooves2, sprites.backLegAccessories2,
				info.useExtraLegs ? closeBackLegExtraSet : undefined,
				info.useExtraLegAccessory ? closeBackLegAccessoryExtraSet : undefined,
				info.useExtraHooves ? closeBackHoofExtraSet : undefined, backHoovesInFront, WHITE,
				undefined, false, 0, 0, outlineMode, outlineColor);
		}
	}

	// close legs back sleeves (2)
	if (draw(options, NoDraw.CloseSleeves)) {
		const closeBackSleeve2 = at(sprites.backLegSleeves2, frame.backLeg);
		if (!extraBackSleevesBehindTail && !extraBackAccessoryInFront && hasBackSleevesExtra) {
			drawLocalSet(closeBackSleeve2, info.backAccessoryExtra, backX, backY, WHITE);
		}
		if (hasBackSleeves) {
			drawLocalSet(closeBackSleeve2, info.backAccessory, backX, backY, WHITE);
		}
		if (!extraBackSleevesBehindTail && extraBackAccessoryInFront && hasBackSleevesExtra) {
			drawLocalSet(closeBackSleeve2, info.backAccessoryExtra, backX, backY, WHITE);
		}
	}

	if (draw(options, NoDraw.BackAccessory) && deferExtraBackAccessory) {
		drawLocalSet(backAccessories[body], backAccessoryExtra, x + backOffset.x, y + backOffset.y, WHITE);
	}

	// neck accessory
	if (frontNeckAccessory) {
		const neckOffset = at(offsets.neckAccessoryOffsets, body)!;
		drawLocalSet(neckAccessories[body], info.neckAccessory, x + neckOffset.x, y + neckOffset.y, WHITE);
		drawLocalSet(neckAccessories[body], info.neckAccessoryExtra, x + neckOffset.x, y + neckOffset.y, WHITE);
	}

	// waist accessory
	const waistFrame = frame.wing > 2 ? 16 : body;
	const waistOffset = at(offsets.waistAccessoryOffsets, waistFrame)!;
	drawLocalSet(waistAccessories[waistFrame], closeWaistSet, x + waistOffset.x, y + waistOffset.y, WHITE);
	drawLocalSet(waistAccessories[waistFrame], closeWaistExtraSet, x + waistOffset.x, y + waistOffset.y, WHITE);

	// wings
	drawLocalSet(wing, closeWingSet, x + wingOffset.x + frame.wingX, y + wingOffset.y + frame.wingY, WHITE);

	// head
	const headFlip = frameHeadTurned ? !flipped : flipped;
	const headSprite = headFlip ? sprites.head0[frame.head] : sprites.head1[frame.head];

	if (swimming) {
		batch.clearCrop();
	}

	batch.save();
	batch.multiplyTransform(headTransform);

	if (swimming) {
		batch.crop(0, headCropY, cropW, cropH);
	}

	if (frameHeadTurned) {
		drawLocalSet(sprites.behindManes, info.mane, 0, maneBehindOffsetY, WHITE);
	}

	drawHead(batch, info, 0, 0, headSprite, headFrame, headAnimationProperties, state, options, headFlip, maneOffsetY);
	drawLocalSet(sprites.headAccessories, info.headAccessory, hatOffset.x, hatOffset.y + hatOffsetY, WHITE);

	batch.restore();

	if (swimming) {
		batch.drawSprite(wake.front.frames[wakeFrame], outlineColor, wakePalette, wakeX, wakeY);
	}
}

export function drawHead(
	batch: Batch, info: Info, x: number, y: number, headSprites: ColorExtraSets, headFrame: HeadAnimationFrame,
	animationProperties: HeadAnimationProperties, { blinkFrame, expression, holding, blushColor, drawFaceExtra }: State,
	options: Options, flip: boolean, maneOffsetY: number,
) {
	const outlineMode = !!options.outlineMode;
	const outlineColor = options.outlineColor || WHITE;
	const drawLocalSet = (
		spriteSets: ColorExtraSets,
		set: PaletteSpriteSet | undefined,
		xPos: number,
		yPos: number,
		tint: number,
	) => drawSet(batch, spriteSets, set, xPos, yPos, tint, outlineMode, outlineColor);
	const extraOffset = at(EXTRA_ACCESSORY_OFFSETS, info.mane && info.mane.type) || pointZero;
	const extraX = x + extraOffset.x;
	const extraY = y + extraOffset.y;
	const toy = att(toys, options.toy);
	const toyScale = options.toyScale || 1;

	if (toy !== undefined) {
		if (toyScale !== 1) {
			batch.save();
			batch.translate(extraX, extraY);
			batch.scale(toyScale, toyScale);
			drawLocalSet(sprites.extraAccessoriesBehind, toy, 0, 0, WHITE);
			batch.restore();
		} else {
			drawLocalSet(sprites.extraAccessoriesBehind, toy, extraX, extraY, WHITE);
		}
	} else if (options.extra && draw(options, NoDraw.Behind)) {
		drawLocalSet(sprites.extraAccessoriesBehind, info.extraAccessory, extraX, extraY, WHITE);
	}

	if (draw(options, NoDraw.Body)) {
		if (draw(options, NoDraw.Head)) {
			drawLocalSet(headSprites, info.head, x, y, WHITE);
			drawLocalSet(headSprites, info.facePatternExtra, x, y, WHITE);
		}

		let shouldDrawBlush = !!info.blush;

		let eyeLeftBase = -1;
		let eyeRightBase = -1;
		let irisLeft = headFrame.leftIris != null ? headFrame.leftIris : Iris.Forward;
		let irisRight = headFrame.rightIris != null ? headFrame.rightIris : Iris.Forward;
		if (expression === undefined) {
			if (info.irisLeft != null) irisLeft = info.irisLeft;
			if (info.irisRight != null) irisRight = info.irisRight;
		}

		const expressionExtra = expression ? (expression.extra || 0) : 0;
		if (expression !== undefined) {
			if (!outlineMode && hasFlag(expressionExtra, ExpressionExtra.Blush)) {
				batch.drawSprite(sprites.blush, blushColor, info.defaultPalette, x, y);
				shouldDrawBlush = false;
			}

			if (expression.left != null) {
				eyeLeftBase = expression.left;
			}

			if (expression.right != null) {
				eyeRightBase = expression.right;
			}

			if (expression.leftIris != null) {
				irisLeft = expression.leftIris;
			}

			if (expression.rightIris != null) {
				irisRight = expression.rightIris;
			}

			// make sure eyes are closed if sleeping
			if (hasFlag(expressionExtra, ExpressionExtra.Zzz)) {
				if (getEyeOpenness(eyeLeftBase) !== 0) {
					eyeLeftBase = Eye.Closed;
				}

				if (getEyeOpenness(eyeRightBase) !== 0) {
					eyeRightBase = Eye.Closed;
				}
			}
		}

		if (!outlineMode && shouldDrawBlush) {
			batch.drawSprite(sprites.blush, blushColor, info.defaultPalette, x, y);
		}

		const eyeRight = getEyeFrame(info.eyeOpennessRight || 1, eyeRightBase, headFrame.right, animationProperties, blinkFrame);
		const eyeLeft = getEyeFrame(info.eyeOpennessLeft || 1, eyeLeftBase, headFrame.left, animationProperties, blinkFrame);
		const eyeFrameLeft = flip ? eyeRight : eyeLeft;
		const eyeFrameRight = flip ? eyeLeft : eyeRight;
		const eyeColorLeft = flip ? info.eyeColorRight : info.eyeColorLeft;
		const eyeColorRight = flip ? info.eyeColorLeft : info.eyeColorRight;
		const eyePaletteLeft = flip ? info.eyePalette : info.eyePaletteLeft;
		const eyePaletteRight = flip ? info.eyePaletteLeft : info.eyePalette;
		const eyeshadowEnabledLeft = !!(flip ? info.eyeshadow : (info.unlockEyeshadowColor ? info.eyeshadowLeft : info.eyeshadow));
		const eyeshadowEnabledRight = !!(flip ? (info.unlockEyeshadowColor ? info.eyeshadowLeft : info.eyeshadow) : info.eyeshadow);
		const eyeshadowColorLeft = flip ? info.eyeshadowColor : (info.unlockEyeshadowColor ? info.eyeshadowColorLeft : info.eyeshadowColor);
		const eyeshadowColorRight = flip ? (info.unlockEyeshadowColor ? info.eyeshadowColorLeft : info.eyeshadowColor) : info.eyeshadowColor;
		const eyeIrisLeft = flip ? flipIris(irisRight) : irisLeft;
		const eyeIrisRight = flip ? flipIris(irisLeft) : irisRight;
		const eyeLeftSprites = sprites.eyeLeft;
		const eyeRightSprites = sprites.eyeRight;

		if (!outlineMode && draw(options, NoDraw.Eyes)) {
			drawEye(
				batch, att(at(eyeLeftSprites, eyeFrameLeft), info.eyelashes),
				eyeIrisLeft, info, eyeColorLeft, eyePaletteLeft, eyeshadowColorLeft, eyeshadowEnabledLeft, x, y);
			drawEye(
				batch, att(at(eyeRightSprites, eyeFrameRight), info.eyelashes),
				eyeIrisRight, info, eyeColorRight, eyePaletteRight, eyeshadowColorRight, eyeshadowEnabledRight, x, y);
		}
	}

	if (draw(options, NoDraw.Front)) {
		drawLocalSet(sprites.facialHairBehind, info.facialHair, x, y, WHITE);
	}

	if (!outlineMode && drawFaceExtra !== undefined) {
		(drawFaceExtra as any)(batch, x, y, flip);
	}

	const faceAccessory = info.faceAccessory;
	const faceAccessoryExtra = info.faceAccessoryExtra;
	let faceAccessoryType = 0;
	let faceAccessoryPattern = 0;
	let faceAccessoryExtraType = 0;
	let faceAccessoryExtraPattern = 0;

	if (!outlineMode && faceAccessory !== undefined) {
		faceAccessoryType = flip ? flipFaceAccessoryType(faceAccessory.type) : faceAccessory.type;
		faceAccessoryPattern = flip ? flipFaceAccessoryPattern(faceAccessoryType, faceAccessory.pattern) : faceAccessory.pattern;

		if (draw(options, NoDraw.FaceAccessory1)) {
			drawTypePattern(
				batch, sprites.faceAccessories, faceAccessoryType, faceAccessoryPattern,
				faceAccessory.palette, faceAccessory.extraPalette, x, y, WHITE);

			// if (info.faceAccessoryExtraPalette) {
			// 	drawTypePattern(
			// 		batch, sprites.faceAccessoriesExtra, faceAccessoryType, faceAccessoryPattern,
			// 		info.faceAccessoryExtraPalette, x, y, WHITE);
			// }
		}
	}

	if (!outlineMode && faceAccessoryExtra !== undefined) {
		faceAccessoryExtraType = flip ? flipFaceAccessoryType(faceAccessoryExtra.type) : faceAccessoryExtra.type;
		faceAccessoryExtraPattern = flip ? flipFaceAccessoryPattern(faceAccessoryExtraType, faceAccessoryExtra.pattern) : faceAccessoryExtra.pattern;

		if (draw(options, NoDraw.FaceAccessory1)) {
			drawTypePattern(
				batch, sprites.faceAccessories, faceAccessoryExtraType, faceAccessoryExtraPattern,
				faceAccessoryExtra.palette, faceAccessoryExtra.extraPalette, x, y, WHITE);
		}
	}

	if (draw(options, NoDraw.Body) && draw(options, NoDraw.Nose)) {
		const muzzle = getMouthFrame(!!holding, expression, headFrame.mouth, info.muzzle, animationProperties);
		const noses = at(sprites.noses, muzzle);
		const nose = att(noses, info.nose && info.nose.type)![0];

		if (!outlineMode) {
			const mouthPalette = info.mouthColorPalette;
			nose.mouth && batch.drawSprite(nose.mouth, WHITE, mouthPalette || info.defaultPalette, x + headFrame.noseX, y + headFrame.noseY);
		}

		if (holding !== undefined && holding.draw !== undefined) {
			holding.x = toWorldX(x + toInt(holding.pickableX));
			holding.y = toWorldY(y + toInt(holding.pickableY));
			const holdingOptions = outlineMode ? { ...holdingOutlineDrawOptions, outlineColor } : holdingDrawOptions;
			const itemScale = options.itemScale || 1;

			if (itemScale !== 1) {
				const screenX = toScreenX(holding.x);
				const screenY = toScreenYWithZ(holding.y, holding.z);
				batch.save();
				batch.translate(screenX, screenY);
				batch.scale(itemScale, itemScale);
				batch.translate(-screenX, -screenY);
			}

			holding.draw(batch, holdingOptions);

			if (itemScale !== 1) {
				batch.restore();
			}
		}

		drawLocalSet(noses, info.nose, x + headFrame.noseX, y + headFrame.noseY, WHITE);

		if (!outlineMode && info.fangs && nose.fangs) {
			batch.drawSprite(nose.fangs, WHITE, info.teethColorPalette || info.fangsColorPalette || info.defaultPalette, x + headFrame.noseX, y + headFrame.noseY);
		}
	}

	if (draw(options, NoDraw.Front2)) {
		drawLocalSet(sprites.facialHair, info.facialHair, x, y, WHITE);
	}

	// temp front layer hat test
	// const skipTopAndFrontMane = info.headAccessory !== undefined && info.headAccessory.type === 20;

	if (draw(options, NoDraw.FrontMane)) {
		drawLocalSet(sprites.backFrontManes, info.backMane, x, y + maneOffsetY, WHITE);
	}

	if (draw(options, NoDraw.TopMane) /* && !skipTopAndFrontMane*/ ) {
		drawLocalSet(sprites.topManes, info.mane, x, y, WHITE);
	}

	if (toy !== undefined) {
		drawLocalSet(sprites.extraAccessories, toy, extraX, extraY, WHITE);
	} else if (options.extra && draw(options, NoDraw.Front)) {
		drawLocalSet(sprites.extraAccessories, info.extraAccessory, extraX, extraY, WHITE);
	}

	if (draw(options, NoDraw.Front)) {
		drawLocalSet(sprites.horns, info.horn, x, y, WHITE);
	}

	if (draw(options, NoDraw.Body) && draw(options, NoDraw.CloseEar) && !options.noEars) {
		const closeEarSet = flip ? info.earsRight : info.ears;
		drawLocalSet(sprites.ears, closeEarSet, x, y, WHITE);
	}

	if (!outlineMode && faceAccessory !== undefined && draw(options, NoDraw.FaceAccessory2)) {
		drawTypePattern(
			batch, sprites.faceAccessories2, faceAccessoryType, faceAccessoryPattern,
			faceAccessory.palette, faceAccessory.extraPalette, x, y, WHITE);

		// if (info.faceAccessoryExtraPalette) {
		// 	drawTypePattern(
		// 		batch, sprites.faceAccessories2Extra, faceAccessoryType, faceAccessoryPattern,
		// 		info.faceAccessoryExtraPalette, x, y, WHITE);
		// }
	}

	if (!outlineMode && faceAccessoryExtra !== undefined && draw(options, NoDraw.FaceAccessory2)) {
		drawTypePattern(
			batch, sprites.faceAccessories2, faceAccessoryExtraType, faceAccessoryExtraPattern,
			faceAccessoryExtra.palette, faceAccessoryExtra.extraPalette, x, y, WHITE);
	}

	const closeEarSet = flip ? info.earsRight : info.ears;
	const earAccessoryOffset = at(EAR_ACCESSORY_OFFSETS, closeEarSet && closeEarSet.type)!;
	const frontEarAccessory = false; // info.earAccessory !== undefined && info.earAccessory.type === 13;

	if (!frontEarAccessory && draw(options, NoDraw.Front) && draw(options, NoDraw.CloseEar)) {
		drawLocalSet(sprites.earAccessories, info.earAccessory, x + earAccessoryOffset.x, y + earAccessoryOffset.y, WHITE);
		drawLocalSet(sprites.earAccessories, info.earAccessoryExtra, x + earAccessoryOffset.x, y + earAccessoryOffset.y, WHITE);
	}

	if (draw(options, NoDraw.FrontMane) /* && !skipTopAndFrontMane */) {
		drawLocalSet(sprites.frontManes, info.mane, x, y + maneOffsetY, WHITE);
	}

	if (frontEarAccessory && draw(options, NoDraw.Front) && draw(options, NoDraw.CloseEar)) {
		drawLocalSet(sprites.earAccessories, info.earAccessory, x + earAccessoryOffset.x, y + earAccessoryOffset.y, WHITE);
		drawLocalSet(sprites.earAccessories, info.earAccessoryExtra, x + earAccessoryOffset.x, y + earAccessoryOffset.y, WHITE);
	}
}

function drawLeg(
	batch: Batch, x: number, y: number, frame: number, leg: Sets, hoof: Sets, sock: Sets,
	legSet: PaletteSpriteSet | undefined, sockSet: PaletteSpriteSet | undefined, hoofSet: PaletteSpriteSet | undefined,
	hoovesInFront: boolean[], color: number, cmPalette: Palette | undefined, cmFlip: boolean, cmX: number, cmY: number
	, outlineMode = false, outlineColor = WHITE
) {
	const hoofInFront = hoofSet !== undefined && !!hoovesInFront[hoofSet.type];

	drawSet(batch, at(leg, frame), legSet, x, y, color, outlineMode, outlineColor);

	if (!hoofInFront) {
		drawSet(batch, at(hoof, frame), hoofSet, x, y, color, outlineMode, outlineColor);
	}

	// CM
	if (!outlineMode && cmPalette !== undefined) {
		const cm = cmFlip ? sprites.cmsFlip : sprites.cms;
		batch.drawSprite(cm, WHITE, cmPalette, cmX, cmY);
	}

	drawSet(batch, at(sock, frame), sockSet, x, y, color, outlineMode, outlineColor);

	if (hoofInFront) {
		const hasClaws = hoofSet && hoofSet.type === 3 && hoof === frontHooves;
		const hasSocks = !!(sockSet && sockSet.type > 0);
		const hoofSprites = (hasClaws && hasSocks) ? claws : hoof;
		drawSet(batch, at(hoofSprites, frame), hoofSet, x, y, color, outlineMode, outlineColor);
	}
}

function getEyeFrame(base: Eye, expression: Eye, anim: Eye, animationProperties: HeadAnimationProperties, blinkFrame: number) {
	const frame = (expression as any) === -1 ? base : expression;

	if ((anim as any) !== -1) {
		if (hasFlag(animationProperties, HeadAnimationProperties.DontIncreaseEyeOpenness)) {
			if (getEyeOpenness(anim) > getEyeOpenness(frame)) {
				return frame;
			}
		}
		return anim;
	}

	const blink = blinkFrames[frame];

	if (blinkFrame > 1 && blink) {
		const frameOffset = 6 - blinkFrame;

		if (frameOffset < blink.length) {
			return blink[blink.length - frameOffset - 1];
		}
	}

	return frame;
}

function getMouthFrame(holding: boolean, expression: Expression | undefined, headFrameMuzzle: Muzzle,
	currentMuzzle: Muzzle | undefined, properties: HeadAnimationProperties) {
	if (holding) {
		return Muzzle.Neutral;
	}

	let applyMuzzle = currentMuzzle;
	if (expression && expression.muzzle != null) {
		applyMuzzle = expression.muzzle;
	}

	if ((headFrameMuzzle as any) !== -1) {
		if (applyMuzzle && hasFlag(properties, HeadAnimationProperties.DontDecreaseMouthOpenness)) {
			if (getMuzzleOpenness(headFrameMuzzle) < getMuzzleOpenness(applyMuzzle)) {
				return applyMuzzle;
			}
		}
		return headFrameMuzzle;
	}

	return applyMuzzle;
}

function drawEye(
	batch: Batch, eye: PonyEye | undefined, iris: Iris, info: Info, palette: Palette | undefined, eyePalette: Palette,
	eyeshadowPalette: Palette | undefined, eyeshadowEnabled: boolean, x: number, y: number
) {
	if (eye !== undefined) {
		if (eyeshadowEnabled === true) {
			eye.shadow && batch.drawSprite(eye.shadow, WHITE, eyeshadowPalette || info.eyeshadowColor, x, y);
			eye.shine && batch.drawSprite(eye.shine, SHINES_COLOR, info.defaultPalette, x, y);
		}

		eye.base && batch.drawSprite(eye.base, WHITE, eyePalette, x, y);
		const sprite = at(eye.irises, iris);
		sprite && batch.drawSprite(sprite, WHITE, palette, x, y);
	}
}

function drawSet(
	batch: Batch, sprites: ColorExtraSets, set: PaletteSpriteSet | undefined, x: number, y: number, tint: number,
	outlineMode?: boolean, outlineColor?: number
) {
	if (set !== undefined) {
		const patterns = att(sprites, set.type);

		if (patterns !== undefined) {
			const patternSprite = at(patterns, set.pattern);

			if (patternSprite !== undefined) {
				const finalTint = outlineMode ? (outlineColor || WHITE) : tint;
				const finalPalette = outlineMode ? (set.outlinePalette || set.palette) : set.palette;
				batch.drawSprite(patternSprite.color, finalTint, finalPalette, x, y);
			}
		}
	}
}

function drawTypePattern(
	batch: Batch, sprites: ColorExtraSets, type: number, pattern: number, palette: Palette, extraPalette: Palette | undefined,
	x: number, y: number, tint: number
) {
	const patterns = att(sprites, type);

	if (patterns !== undefined) {
		const patternSprite = at(patterns, pattern);

		if (patternSprite !== undefined) {
			batch.drawSprite(patternSprite.color, tint, palette, x, y);

			if (patternSprite.extra !== undefined && extraPalette !== undefined) {
				batch.drawSprite(patternSprite.extra, WHITE, extraPalette, x, y);
			}
		}
	}
}
