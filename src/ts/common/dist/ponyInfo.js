"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.releasePalettes = exports.toPaletteNumber = exports.toPalette = exports.toPaletteGeneric = exports.createToPaletteSet = exports.toPaletteSet = exports.getColorsForSetNumber = exports.getColorsForSet = exports.toColorListNumber = exports.getColorsFromSet = exports.darkenForOutline = exports.toColorList = exports.syncLockedPonyInfoNumber = exports.syncLockedPonyInfo = exports.syncLockedSpriteSet = exports.getBaseOutline = exports.getBaseFill = exports.createBasePony = exports.createDefaultPony = exports.spriteSet = exports.mockPaletteManager = void 0;
var sprites = require("../generated/sprites");
var paletteManager_1 = require("../graphics/paletteManager");
var utils_1 = require("./utils");
var constants_1 = require("./constants");
var color_1 = require("./color");
var colors_1 = require("./colors");
var ponyUtils_1 = require("../client/ponyUtils");
var MAX_COLORS = 6;
var FILLS = ['1e90ff', '32cd32', 'da70d6', 'dc143c', '7fffd4'];
var frontHooves = sprites.frontLegHooves[1];
var backHooves = sprites.backLegHooves[1];
var frontLegAccessories = sprites.frontLegAccessories[1];
var backLegAccessories = sprites.backLegAccessories[1];
var frontLegSleeves = sprites.frontLegSleeves[1];
exports.mockPaletteManager = {
    add: function (colors) {
        return this.addArray(new Uint32Array(colors));
    },
    addArray: function (colors) {
        return paletteManager_1.createPalette(colors);
    },
    init: function () {
    }
};
function spriteSet(type, lockFirstFill, fill, otherFills) {
    if (lockFirstFill === void 0) { lockFirstFill = true; }
    if (fill === void 0) { fill = 'ffd700'; }
    if (otherFills === void 0) { otherFills = FILLS; }
    if (otherFills.length !== (MAX_COLORS - 1))
        throw new Error('Invalid fills count');
    var fills = __spreadArrays([fill], otherFills);
    var outlines = fills.map(colors_1.fillToOutline);
    return {
        type: type,
        pattern: 0,
        fills: fills,
        outlines: outlines,
        lockFills: __spreadArrays([lockFirstFill], utils_1.array(MAX_COLORS - 1, false)),
        lockOutlines: utils_1.array(MAX_COLORS, true)
    };
}
exports.spriteSet = spriteSet;
function createDefaultPony() {
    var pony = createBasePony();
    pony.mane.type = 2;
    pony.backMane.type = 1;
    pony.tail.type = 1;
    return pony;
}
exports.createDefaultPony = createDefaultPony;
function createBasePony() {
    return syncLockedPonyInfo({
        body: spriteSet(0, true, 'ff0000'),
        bodyRight: spriteSet(0, true, 'ff0000'),
        bodyExtra: spriteSet(0, true, 'ff0000'),
        frontLegs: spriteSet(0, true, 'ff0000'),
        frontLegsRight: spriteSet(0, true, 'ff0000'),
        backLegs: spriteSet(0, true, 'ff0000'),
        backLegsRight: spriteSet(0, true, 'ff0000'),
        head: spriteSet(0, true, 'ff0000', ['800000', '32cd32', 'da70d6', 'dc143c', '7fffd4']),
        nose: spriteSet(0, true, 'ff0000', ['800000', '32cd32', 'da70d6', 'dc143c', '7fffd4']),
        ears: spriteSet(0, true, 'ff0000'),
        earsRight: spriteSet(0, true, 'ff0000'),
        horn: spriteSet(0, true, 'ff0000'),
        wings: spriteSet(0, true, 'ff0000'),
        wingsRight: spriteSet(0, true, 'ff0000'),
        frontHooves: spriteSet(0, false, 'ffa500', ['ffff00', '32cd32', 'da70d6', 'dc143c', '7fffd4']),
        frontHoovesRight: spriteSet(0, false, 'ffa500', ['ffff00', '32cd32', 'da70d6', 'dc143c', '7fffd4']),
        backHooves: spriteSet(0, true, 'ffa500'),
        backHoovesRight: spriteSet(0, true, 'ffa500'),
        mane: spriteSet(0, false),
        backMane: spriteSet(0),
        tail: spriteSet(0),
        facialHair: spriteSet(0),
        headAccessory: spriteSet(0, false, 'ee82ee'),
        earAccessory: spriteSet(0, false, '808080'),
        earAccessoryExtra: spriteSet(0, false, '808080'),
        faceAccessory: spriteSet(0, false, '000000'),
        faceAccessoryExtra: spriteSet(0, false, '000000'),
        neckAccessory: spriteSet(0, false, 'ee82ee'),
        frontLegAccessory: spriteSet(0, false, 'ee82ee'),
        backLegAccessory: spriteSet(0, false, 'ee82ee'),
        frontLegAccessoryRight: spriteSet(0, false, 'ee82ee'),
        backLegAccessoryRight: spriteSet(0, false, 'ee82ee'),
        lockBackLegAccessory: true,
        unlockFrontLegAccessory: false,
        unlockBackLegAccessory: false,
        lockBackHooves: true,
        unlockFrontHooves: false,
        unlockBackHooves: false,
        lockBackLegs: true,
        unlockBody: false,
        useExtraBody: false,
        unlockFrontLegs: false,
        unlockBackLegs: false,
        unlockEars: false,
        unlockWings: false,
        backAccessory: spriteSet(0, false, 'ee82ee'),
        waistAccessory: spriteSet(0, false, '95856f', ['674b43', '4f4f4f', '525252', 'c37850', '8a3d34']),
        waistAccessoryRight: spriteSet(0, false, '95856f', ['674b43', '4f4f4f', '525252', 'c37850', '8a3d34']),
        waistAccessoryExtra: spriteSet(0, false, '95856f', ['674b43', '4f4f4f', '525252', 'c37850', '8a3d34']),
        chestAccessory: spriteSet(0, false, 'ee82ee'),
        sleeveAccessory: spriteSet(0, true, 'ee82ee'),
        sleeveAccessoryRight: spriteSet(0, true, 'ee82ee'),
        neckAccessoryExtra: spriteSet(0, false, 'ee82ee'),
        facePatternExtra: spriteSet(0, true, 'ff0000', ['800000', '32cd32', 'da70d6', 'dc143c', '7fffd4']),
        extraAccessory: __assign(__assign({}, spriteSet(0, true, 'ff0000', ['daa520', 'ffd700', 'ffd700', 'ffd700', 'ffd700'])), { lockFills: utils_1.array(5, true) }),
        coatFill: 'ff0000',
        coatOutline: '8b0000',
        lockCoatOutline: true,
        eyelashes: 0,
        eyeColorLeft: 'daa520',
        eyeColorRight: 'daa520',
        eyeWhitesLeft: 'ffffff',
        eyeWhites: 'ffffff',
        eyeOpennessLeft: 1,
        eyeOpennessRight: 1,
        eyeshadow: false,
        eyeshadowLeft: false,
        eyeshadowColor: '000000',
        eyeshadowColorLeft: '000000',
        lockEyes: true,
        lockEyeColor: true,
        unlockEyeWhites: false,
        unlockEyeshadowColor: false,
        unlockEyelashColor: false,
        eyelashColor: '000000',
        eyelashColorLeft: '000000',
        fangs: 0,
        muzzle: 0,
        freckles: 0,
        frecklesColor: '8b0000',
        magicColor: 'ffffff',
        cm: [],
        cmFlip: false,
        flip: false,
        headTurned: false,
        headTurn: 0,
        // effect flags
        blush: false,
        blushColor: 'ff89ae',
        sleeping: false,
        tears: false,
        crying: false,
        hearts: false,
        // preview background color (hex without '#')
        previewBackground: '90ee90',
        customOutlines: false,
        freeOutlines: false,
        darkenLockedOutlines: false,
        unlockWaistAccessory: false,
        unlockSleeveAccessory: false,
        useExtraWaistAccessory: false,
        useExtraNeckAccessory: false,
        useExtraFacePattern: false
    });
}
exports.createBasePony = createBasePony;
function getBaseFill(set) {
    return set && set.fills && set.fills[0];
}
exports.getBaseFill = getBaseFill;
function getBaseOutline(set) {
    return set && set.outlines && set.outlines[0];
}
exports.getBaseOutline = getBaseOutline;
function syncLockedSpriteSet(set, customOutlines, fillToOutline, baseFill, baseOutline) {
    if (set === undefined)
        return;
    var fills = set.fills;
    if (!fills)
        return;
    var lockFills = set.lockFills;
    if (lockFills) {
        for (var i = 0; i < lockFills.length; i++) {
            if (lockFills[i]) {
                fills[i] = i === 0 ? baseFill : fills[0];
            }
        }
    }
    var outlines = set.outlines;
    var lockOutlines = set.lockOutlines;
    if (outlines && lockOutlines) {
        for (var i = 0; i < lockOutlines.length; i++) {
            if (!customOutlines) {
                lockOutlines[i] = true;
            }
            if (lockOutlines[i]) {
                if (i === 0 && baseOutline && lockFills && lockFills[i]) {
                    outlines[i] = baseOutline;
                }
                else {
                    outlines[i] = fillToOutline(fills[i]);
                }
            }
        }
    }
}
exports.syncLockedSpriteSet = syncLockedSpriteSet;
function syncLockedSpritesSet2(set, fillToOutline, baseFills, baseOutlines) {
    if (set && set.fills && set.lockFills) {
        set.lockFills.forEach(function (locked, i) {
            if (locked) {
                set.fills[i] = baseFills[i];
            }
        });
    }
    if (set && set.fills && set.outlines && set.lockOutlines) {
        set.lockOutlines.forEach(function (locked, i) {
            if (locked) {
                if (baseOutlines[i] && set.lockFills && set.lockFills[i]) {
                    set.outlines[i] = baseOutlines[i];
                }
                else {
                    set.outlines[i] = fillToOutline(set.fills[i]);
                }
            }
        });
    }
}
function getFillOf2(set, defaultColor) {
    return set && set.type && set.fills && set.fills[0] || defaultColor;
}
function getOutlineOf2(set, defaultColor) {
    return set && set.type && set.outlines && set.outlines[0] || defaultColor;
}
function copySpriteSet(target, source) {
    if (!source) {
        return undefined;
    }
    var next = target || {};
    next.type = source.type;
    next.pattern = source.pattern;
    next.fills = source.fills ? source.fills.slice() : undefined;
    next.outlines = source.outlines ? source.outlines.slice() : undefined;
    next.lockFills = source.lockFills ? source.lockFills.slice() : undefined;
    next.lockOutlines = source.lockOutlines ? source.lockOutlines.slice() : undefined;
    return next;
}
function createDefaultMarkingSet(fill, outline) {
    return {
        type: 0,
        pattern: 0,
        fills: [fill, fill, fill, fill, fill, fill],
        outlines: [outline, outline, outline, outline, outline, outline],
        lockFills: [true, true, true, true, true, true],
        lockOutlines: [true, true, true, true, true, true]
    };
}
function ensureMarkingSet(set, fill, outline) {
    return set || createDefaultMarkingSet(fill, outline);
}
function syncLockedBasePonyInfo(info, fillToOutline, defaultColor) {
    var customOutlines = !!info.customOutlines;
    if (!customOutlines || info.lockCoatOutline) {
        info.coatOutline = fillToOutline(info.coatFill);
    }
    info.body = ensureMarkingSet(info.body, info.coatFill, info.coatOutline);
    if (!info.unlockBody) {
        info.bodyRight = copySpriteSet(info.bodyRight, info.body);
    }
    else {
        info.bodyRight = ensureMarkingSet(info.bodyRight, info.coatFill, info.coatOutline);
    }
    if (!info.unlockFrontLegs) {
        info.frontLegsRight = copySpriteSet(info.frontLegsRight, info.frontLegs);
    }
    else if (info.frontLegsRight === info.frontLegs) {
        info.frontLegsRight = copySpriteSet(undefined, info.frontLegs);
    }
    if (info.lockBackLegs !== false) {
        info.backLegs = copySpriteSet(info.backLegs, info.frontLegs);
        var sourceRight = info.unlockFrontLegs ? info.frontLegsRight : info.frontLegs;
        info.backLegsRight = copySpriteSet(info.backLegsRight, sourceRight);
    }
    else {
        if (!info.unlockBackLegs) {
            info.backLegsRight = copySpriteSet(info.backLegsRight, info.backLegs);
        }
        else if (info.backLegsRight === info.backLegs) {
            info.backLegsRight = copySpriteSet(undefined, info.backLegs);
        }
    }
    if (info.lockEyes) {
        info.eyeOpennessLeft = info.eyeOpennessRight;
    }
    if (info.lockEyeColor) {
        info.eyeColorLeft = info.eyeColorRight;
    }
    if (!info.unlockEyeWhites) {
        info.eyeWhitesLeft = info.eyeWhites;
    }
    if (!info.unlockEyeshadowColor) {
        info.eyeshadowLeft = info.eyeshadow;
        info.eyeshadowColorLeft = info.eyeshadowColor;
    }
    else if (info.eyeshadowLeft === undefined) {
        // Backward compatibility for ponies saved before per-side eyeshadow toggle existed.
        info.eyeshadowLeft = info.eyeshadow;
    }
    if (!info.unlockEyelashColor) {
        info.eyelashColorLeft = info.eyelashColor;
    }
    if (!info.unlockFrontHooves) {
        info.frontHoovesRight = copySpriteSet(info.frontHoovesRight, info.frontHooves);
    }
    else if (info.frontHoovesRight === info.frontHooves) {
        info.frontHoovesRight = copySpriteSet(undefined, info.frontHooves);
    }
    if (info.lockBackHooves) {
        info.backHooves = copySpriteSet(info.backHooves, info.frontHooves);
        var sourceRight = info.unlockFrontHooves ? info.frontHoovesRight : info.frontHooves;
        info.backHoovesRight = copySpriteSet(info.backHoovesRight, sourceRight);
    }
    else {
        if (!info.unlockBackHooves) {
            info.backHoovesRight = copySpriteSet(info.backHoovesRight, info.backHooves);
        }
        else if (info.backHoovesRight === info.backHooves) {
            info.backHoovesRight = copySpriteSet(undefined, info.backHooves);
        }
    }
    if (!info.unlockEars) {
        info.earsRight = copySpriteSet(info.earsRight, info.ears);
    }
    else if (info.earsRight === info.ears) {
        info.earsRight = copySpriteSet(undefined, info.ears);
    }
    if (!info.unlockWings) {
        info.wingsRight = copySpriteSet(info.wingsRight, info.wings);
    }
    else if (info.wingsRight === info.wings) {
        info.wingsRight = copySpriteSet(undefined, info.wings);
    }
    if (!info.unlockWaistAccessory) {
        info.waistAccessoryRight = copySpriteSet(info.waistAccessoryRight, info.waistAccessory);
    }
    else if (info.waistAccessoryRight === info.waistAccessory) {
        info.waistAccessoryRight = copySpriteSet(undefined, info.waistAccessory);
    }
    if (!info.unlockSleeveAccessory) {
        info.sleeveAccessoryRight = copySpriteSet(info.sleeveAccessoryRight, info.sleeveAccessory);
    }
    else if (info.sleeveAccessoryRight === info.sleeveAccessory) {
        info.sleeveAccessoryRight = copySpriteSet(undefined, info.sleeveAccessory);
    }
    syncLockedSpriteSet(info.head, customOutlines, fillToOutline, info.coatFill, info.coatOutline);
    syncLockedSpriteSet(info.body, customOutlines, fillToOutline, info.coatFill, info.coatOutline);
    syncLockedSpriteSet(info.bodyRight, customOutlines, fillToOutline, getBaseFill(info.unlockBody ? info.bodyRight : info.body), getBaseOutline(info.unlockBody ? info.bodyRight : info.body));
    syncLockedSpriteSet(info.bodyExtra, customOutlines, fillToOutline, info.coatFill, info.coatOutline);
    syncLockedSpriteSet(info.frontLegs, customOutlines, fillToOutline, info.coatFill, info.coatOutline);
    syncLockedSpriteSet(info.frontLegsRight, customOutlines, fillToOutline, getBaseFill(info.unlockFrontLegs ? info.frontLegsRight : info.frontLegs), getBaseOutline(info.unlockFrontLegs ? info.frontLegsRight : info.frontLegs));
    syncLockedSpriteSet(info.backLegs, customOutlines, fillToOutline, getBaseFill(info.lockBackLegs !== false ? info.frontLegs : info.backLegs), getBaseOutline(info.lockBackLegs !== false ? info.frontLegs : info.backLegs));
    syncLockedSpriteSet(info.backLegsRight, customOutlines, fillToOutline, getBaseFill(info.lockBackLegs !== false ? (info.unlockFrontLegs ? info.frontLegsRight : info.frontLegs) : (info.unlockBackLegs ? info.backLegsRight : info.backLegs)), getBaseOutline(info.lockBackLegs !== false ? (info.unlockFrontLegs ? info.frontLegsRight : info.frontLegs) : (info.unlockBackLegs ? info.backLegsRight : info.backLegs)));
    syncLockedSpriteSet(info.nose, customOutlines, fillToOutline, info.coatFill, info.coatOutline);
    syncLockedSpriteSet(info.ears, customOutlines, fillToOutline, info.coatFill, info.coatOutline);
    syncLockedSpriteSet(info.earsRight, customOutlines, fillToOutline, info.coatFill, info.coatOutline);
    syncLockedSpriteSet(info.horn, customOutlines, fillToOutline, info.coatFill, info.coatOutline);
    syncLockedSpriteSet(info.wings, customOutlines, fillToOutline, info.coatFill, info.coatOutline);
    syncLockedSpriteSet(info.wingsRight, customOutlines, fillToOutline, info.coatFill, info.coatOutline);
    syncLockedSpriteSet(info.frontHooves, customOutlines, fillToOutline, info.coatFill, info.coatOutline);
    syncLockedSpriteSet(info.frontHoovesRight, customOutlines, fillToOutline, info.coatFill, info.coatOutline);
    syncLockedSpriteSet(info.backHooves, customOutlines, fillToOutline, getBaseFill(info.lockBackHooves ? info.frontHooves : info.backHooves), getBaseOutline(info.lockBackHooves ? info.frontHooves : info.backHooves));
    syncLockedSpriteSet(info.backHoovesRight, customOutlines, fillToOutline, getBaseFill(info.lockBackHooves ? (info.unlockFrontHooves ? info.frontHoovesRight : info.frontHooves) : info.backHoovesRight), getBaseOutline(info.lockBackHooves ? (info.unlockFrontHooves ? info.frontHoovesRight : info.frontHooves) : info.backHoovesRight));
    syncLockedSpriteSet(info.mane, customOutlines, fillToOutline);
    var baseManeFill = getBaseFill(info.mane);
    var baseManeOutline = getBaseOutline(info.mane);
    syncLockedSpriteSet(info.backMane, customOutlines, fillToOutline, baseManeFill, baseManeOutline);
    syncLockedSpriteSet(info.tail, customOutlines, fillToOutline, baseManeFill, baseManeOutline);
    syncLockedSpriteSet(info.facialHair, customOutlines, fillToOutline, baseManeFill, baseManeOutline);
    syncLockedSpriteSet(info.headAccessory, customOutlines, fillToOutline);
    syncLockedSpriteSet(info.earAccessory, customOutlines, fillToOutline);
    syncLockedSpriteSet(info.earAccessoryExtra, customOutlines, fillToOutline);
    syncLockedSpriteSet(info.faceAccessory, customOutlines, fillToOutline);
    syncLockedSpriteSet(info.faceAccessoryExtra, customOutlines, fillToOutline);
    syncLockedSpriteSet(info.neckAccessory, customOutlines, fillToOutline);
    syncLockedSpriteSet(info.frontLegAccessory, customOutlines, fillToOutline);
    syncLockedSpriteSet(info.backLegAccessory, customOutlines, fillToOutline);
    syncLockedSpriteSet(info.frontLegAccessoryRight, customOutlines, fillToOutline);
    syncLockedSpriteSet(info.backLegAccessoryRight, customOutlines, fillToOutline);
    syncLockedSpriteSet(info.backAccessory, customOutlines, fillToOutline);
    syncLockedSpriteSet(info.waistAccessory, customOutlines, fillToOutline);
    syncLockedSpriteSet(info.waistAccessoryRight, customOutlines, fillToOutline);
    syncLockedSpriteSet(info.waistAccessoryExtra, customOutlines, fillToOutline);
    syncLockedSpriteSet(info.chestAccessory, customOutlines, fillToOutline);
    syncLockedSpriteSet(info.neckAccessoryExtra, customOutlines, fillToOutline);
    syncLockedSpriteSet(info.facePatternExtra, customOutlines, fillToOutline, info.coatFill, info.coatOutline);
    if (info.chestAccessory && !info.sleeveAccessory && utils_1.includes(ponyUtils_1.SLEEVED_ACCESSORIES, info.chestAccessory.type)) {
        info.sleeveAccessory = {
            type: 0,
            pattern: 0,
            fills: [],
            outlines: [],
            lockFills: utils_1.array(MAX_COLORS, true),
            lockOutlines: utils_1.array(MAX_COLORS, true)
        };
    }
    syncLockedSpriteSet(info.sleeveAccessory, customOutlines, fillToOutline, getBaseFill(info.chestAccessory), getBaseOutline(info.chestAccessory));
    syncLockedSpriteSet(info.sleeveAccessoryRight, customOutlines, fillToOutline, getBaseFill(info.chestAccessory), getBaseOutline(info.chestAccessory));
    syncLockedSpritesSet2(info.extraAccessory, fillToOutline, [
        info.coatFill,
        info.eyeColorRight,
        getFillOf2(info.mane, defaultColor),
        getFillOf2(info.backMane, defaultColor),
        getFillOf2(info.tail, defaultColor),
    ], [
        info.coatOutline,
        info.eyeColorRight,
        getOutlineOf2(info.mane, defaultColor),
        getOutlineOf2(info.backMane, defaultColor),
        getOutlineOf2(info.tail, defaultColor),
    ]);
    return info;
}
function syncLockedPonyInfo(info) {
    var darkenLocked = !!info.freeOutlines && !!info.darkenLockedOutlines;
    var fillToOutlineFunc = darkenLocked ? colors_1.fillToOutlineWithDarken : colors_1.fillToOutline;
    return syncLockedBasePonyInfo(info, fillToOutlineFunc, '000000');
}
exports.syncLockedPonyInfo = syncLockedPonyInfo;
function fillToOutlineSafe(color) {
    return colors_1.fillToOutlineColor((color === undefined || color === 0) ? colors_1.BLACK : color);
}
function fillToOutlineSafeWithDarken(color) {
    return darkenForOutline(colors_1.fillToOutlineColor((color === undefined || color === 0) ? colors_1.BLACK : color));
}
function syncLockedPonyInfoNumber(info) {
    var darkenLocked = !!info.freeOutlines && !!info.darkenLockedOutlines;
    var fillToOutlineFunc = darkenLocked ? fillToOutlineSafeWithDarken : fillToOutlineSafe;
    return syncLockedBasePonyInfo(info, fillToOutlineFunc, colors_1.BLACK);
}
exports.syncLockedPonyInfoNumber = syncLockedPonyInfoNumber;
// PalettePonyInfo
function parseFast(color) {
    return color ? color_1.parseColorFast(color) : colors_1.BLACK;
}
function parseCMColor(color) {
    return color ? color_1.parseColorFast(color) : colors_1.TRANSPARENT;
}
function toColorList(colors) {
    var result = new Uint32Array(colors.length + 1);
    for (var i = 0; i < colors.length; i++) {
        result[i + 1] = parseFast(colors[i]);
    }
    return result;
}
exports.toColorList = toColorList;
function darkenForOutline(color) {
    var mult = (159 / 255);
    var r = (mult * color_1.getR(color)) | 0;
    var g = (mult * color_1.getG(color)) | 0;
    var b = (mult * color_1.getB(color)) | 0;
    var a = color_1.getAlpha(color);
    return color_1.colorFromRGBA(r, g, b, a);
}
exports.darkenForOutline = darkenForOutline;
function getColorsGeneric(fillColors, outlineColors, defaultColor, length, darken) {
    var fills = fillColors || [];
    var outlines = outlineColors || [];
    var colors = utils_1.array(length * 2, defaultColor);
    for (var i = 0; i < length; i++) {
        colors[i * 2] = fills[i] || defaultColor;
        if (darken) {
            colors[i * 2 + 1] = outlines[i] ? color_1.colorToHexRGB(darkenForOutline(color_1.parseColorFast(outlines[i]))) : defaultColor;
        }
        else {
            colors[i * 2 + 1] = outlines[i] || defaultColor;
        }
    }
    return colors;
}
function getColorsFromSet(_a, defaultColor, darken) {
    var fills = _a.fills, outlines = _a.outlines;
    var length = Math.max(fills ? fills.length : 0, outlines ? outlines.length : 0);
    return getColorsGeneric(fills, outlines, defaultColor, length, darken);
}
exports.getColorsFromSet = getColorsFromSet;
function toColorListNumber(colors) {
    var result = new Uint32Array(colors.length + 1);
    for (var i = 0; i < colors.length; i++) {
        result[i + 1] = colors[i] || colors_1.BLACK;
    }
    return result;
}
exports.toColorListNumber = toColorListNumber;
exports.getColorsForSet = function (set, count, darken) {
    var t = getColorsGeneric(set.fills, set.outlines, '000000', count, darken);
    return toColorList(t);
};
var emptyArray = [];
exports.getColorsForSetNumber = function (set, length, darken) {
    var fills = set.fills || emptyArray;
    var outlines = set.outlines || emptyArray;
    var result = new Uint32Array(length * 2 + 1);
    for (var i = 0; i < length; i++) {
        result[((i << 1) + 1) | 0] = i < fills.length ? (fills[i] || colors_1.BLACK) : colors_1.BLACK;
        if (darken) {
            result[((i << 1) + 2) | 0] = i < outlines.length ? darkenForOutline(outlines[i] || colors_1.BLACK) : colors_1.BLACK;
        }
        else {
            result[((i << 1) + 2) | 0] = i < outlines.length ? (outlines[i] || colors_1.BLACK) : colors_1.BLACK;
        }
    }
    return result;
};
function getExtraPalette(pattern, manager) {
    var extraPalette = pattern && pattern.palettes && pattern.palettes[0];
    return extraPalette && manager.addArray(new Uint32Array(extraPalette));
}
function createOutlinePalette(colors) {
    var outline = new Uint32Array(colors.length);
    for (var i = 1; i < colors.length; i++) {
        outline[i] = colors_1.WHITE;
    }
    return outline;
}
function toPaletteSet(set, sets, manager, getColorsForSet, hasExtra, darken) {
    var pattern = utils_1.att(utils_1.att(sets, set.type), set.pattern);
    var colorCount = pattern !== undefined && pattern.colors !== undefined ? ((pattern.colors - 1) >> 1) : 0;
    var colors = getColorsForSet(set, colorCount, darken);
    return {
        type: utils_1.toInt(set.type),
        pattern: utils_1.toInt(set.pattern),
        palette: manager.addArray(colors),
        outlinePalette: manager.addArray(createOutlinePalette(colors)),
        extraPalette: hasExtra ? getExtraPalette(pattern, manager) : undefined,
        outlineExtraPalette: hasExtra && pattern && pattern.palettes && pattern.palettes[0] ?
            manager.addArray(createOutlinePalette(new Uint32Array(pattern.palettes[0]))) : undefined
    };
}
exports.toPaletteSet = toPaletteSet;
function createCMPalette(cm, manager, parseColor) {
    var size = constants_1.CM_SIZE * constants_1.CM_SIZE;
    if (cm === undefined || cm.length === 0 || cm.length > size)
        return undefined;
    var result = new Uint32Array(size);
    for (var i = 0; i < cm.length; i++) {
        result[i] = parseColor(cm[i]);
    }
    return manager.addArray(result);
}
var defaultPalette = new Uint32Array(sprites.defaultPalette);
exports.createToPaletteSet = function (manager, getColorsForSet, extra, darken) {
    return function (set, sets) { return set === undefined ? undefined : toPaletteSet(set, sets, manager, getColorsForSet, extra, darken); };
};
function toPaletteGeneric(info, manager, toColorList, getColorsForSet, blackColor, whiteColor, parseCMColor) {
    var darken = !info.freeOutlines;
    var toSet = exports.createToPaletteSet(manager, getColorsForSet, false, darken);
    var toSetExtra = exports.createToPaletteSet(manager, getColorsForSet, true, darken);
    var defaultSet = { type: 0, pattern: 0, fills: [info.coatFill], outlines: [info.coatOutline] };
    var bodySet = info.body || defaultSet;
    var bodyRightSet = info.unlockBody ? (info.bodyRight || bodySet) : bodySet;
    var frontLegsSet = info.frontLegs || defaultSet;
    var frontLegsRightSet = info.unlockFrontLegs ? (info.frontLegsRight || frontLegsSet) : frontLegsSet;
    var backLegsSet = (info.lockBackLegs !== false) ? frontLegsSet : (info.backLegs || frontLegsSet);
    var backLegsRightSet = info.lockBackLegs !== false ?
        frontLegsRightSet :
        (info.unlockBackLegs ? (info.backLegsRight || backLegsSet) : backLegsSet);
    // const defaultSet = { type: 0, pattern: 1, fills: [info.coatFill, whiteColor], outlines: [info.coatOutline, blackColor] };
    return {
        body: toSet(bodySet, sprites.body[1]),
        bodyRight: toSet(bodyRightSet, sprites.body[1]),
        bodyExtra: toSet(info.useExtraBody ? info.bodyExtra : undefined, sprites.body[1]),
        head: toSet(info.head || defaultSet, sprites.head0[1]),
        nose: toSet(info.nose, sprites.noses[0]),
        ears: toSet(info.ears || defaultSet, sprites.ears),
        earsRight: toSet((info.unlockEars ? info.earsRight : info.ears) || defaultSet, sprites.ears),
        horn: toSet(info.horn, sprites.horns),
        wings: toSet(info.wings, sprites.wings[0]),
        wingsRight: toSet(info.unlockWings ? info.wingsRight : info.wings, sprites.wings[0]),
        frontLegs: toSet(frontLegsSet, sprites.frontLegs[1]),
        frontLegsRight: toSet(frontLegsRightSet, sprites.frontLegs[1]),
        backLegs: toSet(backLegsSet, sprites.backLegs[1]),
        backLegsRight: toSet(backLegsRightSet, sprites.backLegs[1]),
        frontHooves: toSet(info.frontHooves, frontHooves),
        frontHoovesRight: toSet(info.unlockFrontHooves ? info.frontHoovesRight : info.frontHooves, frontHooves),
        backHooves: toSet(info.lockBackHooves ? info.frontHooves : info.backHooves, backHooves),
        backHoovesRight: toSet(info.lockBackHooves ?
            (info.unlockFrontHooves ? info.frontHoovesRight : info.frontHooves) :
            (info.unlockBackHooves ? info.backHoovesRight : info.backHooves), backHooves),
        mane: toSet(info.mane, ponyUtils_1.mergedManes),
        backMane: toSet(info.backMane, ponyUtils_1.mergedBackManes),
        tail: toSet(info.tail, sprites.tails[0]),
        facialHair: toSet(info.facialHair, ponyUtils_1.mergedFacialHair),
        headAccessory: toSet(info.headAccessory, ponyUtils_1.mergedHeadAccessories),
        earAccessory: toSet(info.earAccessory, ponyUtils_1.mergedEarAccessories),
        earAccessoryExtra: toSet(info.earAccessoryExtra, ponyUtils_1.mergedEarAccessories),
        faceAccessory: toSetExtra(info.faceAccessory, sprites.faceAccessories),
        faceAccessoryExtra: toSetExtra(info.faceAccessoryExtra, sprites.faceAccessories),
        // faceAccessoryExtraPalette: getExtraPartPalette(info.faceAccessory, sprites.faceAccessoriesExtra, manager),
        neckAccessory: toSet(info.neckAccessory, sprites.neckAccessories[1]),
        neckAccessoryExtra: toSet(info.useExtraNeckAccessory ? info.neckAccessoryExtra : undefined, sprites.neckAccessories[1]),
        frontLegAccessory: toSet(info.frontLegAccessory, frontLegAccessories),
        backLegAccessory: toSet(info.lockBackLegAccessory ? info.frontLegAccessory : info.backLegAccessory, backLegAccessories),
        frontLegAccessoryRight: toSet(info.unlockFrontLegAccessory ? info.frontLegAccessoryRight : info.frontLegAccessory, frontLegAccessories),
        backLegAccessoryRight: toSet(info.lockBackLegAccessory ?
            (info.unlockFrontLegAccessory ? info.frontLegAccessoryRight : info.frontLegAccessory) :
            (info.unlockBackLegAccessory ? info.backLegAccessoryRight : info.backLegAccessory), backLegAccessories),
        lockBackLegAccessory: info.lockBackLegAccessory,
        unlockFrontLegAccessory: info.unlockFrontLegAccessory,
        unlockBackLegAccessory: info.unlockBackLegAccessory,
        lockBackHooves: info.lockBackHooves,
        unlockFrontHooves: info.unlockFrontHooves,
        unlockBackHooves: info.unlockBackHooves,
        lockBackLegs: info.lockBackLegs,
        unlockBody: info.unlockBody,
        useExtraBody: info.useExtraBody,
        unlockFrontLegs: info.unlockFrontLegs,
        unlockBackLegs: info.unlockBackLegs,
        unlockEars: info.unlockEars,
        unlockWings: info.unlockWings,
        backAccessory: toSet(info.backAccessory, ponyUtils_1.mergedBackAccessories),
        waistAccessory: toSet(info.waistAccessory, sprites.waistAccessories[1]),
        waistAccessoryExtra: toSet(info.useExtraWaistAccessory ? info.waistAccessoryExtra : undefined, sprites.waistAccessories[1]),
        waistAccessoryRight: toSet(info.unlockWaistAccessory ? info.waistAccessoryRight : info.waistAccessory, sprites.waistAccessories[1]),
        chestAccessory: toSet(info.chestAccessory, ponyUtils_1.mergedChestAccessories),
        sleeveAccessory: toSet(info.sleeveAccessory, frontLegSleeves),
        sleeveAccessoryRight: toSet(info.unlockSleeveAccessory ? info.sleeveAccessoryRight : info.sleeveAccessory, frontLegSleeves),
        extraAccessory: toSet(info.extraAccessory, ponyUtils_1.mergedExtraAccessories),
        facePatternExtra: toSet(info.useExtraFacePattern ? info.facePatternExtra : undefined, sprites.head0[1]),
        unlockWaistAccessory: info.unlockWaistAccessory,
        unlockSleeveAccessory: info.unlockSleeveAccessory,
        useExtraWaistAccessory: info.useExtraWaistAccessory,
        useExtraNeckAccessory: info.useExtraNeckAccessory,
        useExtraFacePattern: info.useExtraFacePattern,
        coatPalette: manager.addArray(toColorList([info.coatFill, info.coatOutline])),
        coatFill: undefined,
        coatOutline: undefined,
        lockCoatOutline: !!info.lockCoatOutline,
        eyelashes: utils_1.toInt(info.eyelashes),
        eyePaletteLeft: manager.addArray(toColorList([
            info.eyeWhitesLeft || whiteColor,
            info.eyelashColor || blackColor
        ])),
        eyePalette: manager.addArray(toColorList([
            info.eyeWhites || whiteColor,
            (info.unlockEyelashColor ? info.eyelashColorLeft : info.eyelashColor) || blackColor
        ])),
        eyeColorLeft: manager.addArray(toColorList([info.eyeColorLeft])),
        eyeColorRight: manager.addArray(toColorList([info.eyeColorRight])),
        eyeWhitesLeft: undefined,
        eyeWhites: undefined,
        eyeOpennessLeft: utils_1.toInt(info.eyeOpennessLeft),
        eyeOpennessRight: utils_1.toInt(info.eyeOpennessRight),
        eyeshadow: info.eyeshadow,
        eyeshadowLeft: info.unlockEyeshadowColor ? info.eyeshadowLeft : info.eyeshadow,
        eyeshadowColor: manager.addArray(toColorList([info.eyeshadowColor])),
        eyeshadowColorLeft: manager.addArray(toColorList([info.eyeshadowColorLeft])),
        blush: !!info.blush,
        lockEyes: !!info.lockEyes,
        lockEyeColor: !!info.lockEyeColor,
        unlockEyeWhites: !!info.unlockEyeWhites,
        unlockEyeshadowColor: !!info.unlockEyeshadowColor,
        unlockEyelashColor: !!info.unlockEyelashColor,
        eyelashColor: undefined,
        eyelashColorLeft: undefined,
        blushColor: manager.addArray(toColorList([info.blushColor])),
        fangs: utils_1.toInt(info.fangs),
        muzzle: utils_1.toInt(info.muzzle),
        freckles: 0,
        frecklesColor: undefined,
        magicColor: undefined,
        magicColorValue: typeof info.magicColor === 'string' ? color_1.parseColorFast(info.magicColor) : utils_1.toInt(info.magicColor),
        cm: undefined,
        cmFlip: !!info.cmFlip,
        flip: !!info.flip,
        headTurned: !!info.headTurned,
        headTurn: utils_1.toInt(info.headTurn),
        cmPalette: createCMPalette(info.cm, manager, parseCMColor),
        customOutlines: !!info.customOutlines,
        freeOutlines: !!info.freeOutlines,
        darkenLockedOutlines: !!info.darkenLockedOutlines,
        defaultPalette: manager.addArray(defaultPalette),
        waterPalette: manager.addArray(sprites.pony_wake_1.palette),
        outlineWaterPalette: manager.addArray(createOutlinePalette(sprites.pony_wake_1.palette))
    };
}
exports.toPaletteGeneric = toPaletteGeneric;
function toPalette(info, manager) {
    if (manager === void 0) { manager = exports.mockPaletteManager; }
    return toPaletteGeneric(info, manager, toColorList, exports.getColorsForSet, '000000', 'ffffff', parseCMColor);
}
exports.toPalette = toPalette;
function toPaletteNumber(info, manager) {
    if (manager === void 0) { manager = exports.mockPaletteManager; }
    return toPaletteGeneric(info, manager, toColorListNumber, exports.getColorsForSetNumber, colors_1.BLACK, colors_1.WHITE, function (x) { return x; });
}
exports.toPaletteNumber = toPaletteNumber;
function releasePalettes(info) {
    for (var _i = 0, _a = Object.keys(info); _i < _a.length; _i++) {
        var key = _a[_i];
        var value = info[key]; // undefined | number | string | PaletteSpriteSet | Palette;
        if (value && typeof value === 'object') {
            if ('refs' in value) {
                var palette = value;
                paletteManager_1.releasePalette(palette);
            }
            else if ('palette' in value) {
                var set = value;
                paletteManager_1.releasePalette(set.palette);
                paletteManager_1.releasePalette(set.outlinePalette);
                paletteManager_1.releasePalette(set.extraPalette);
                paletteManager_1.releasePalette(set.outlineExtraPalette);
            }
        }
    }
}
exports.releasePalettes = releasePalettes;
