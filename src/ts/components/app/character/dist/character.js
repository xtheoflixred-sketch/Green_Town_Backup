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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.Character = void 0;
var core_1 = require("@angular/core");
var lodash_1 = require("lodash");
var constants_1 = require("../../../common/constants");
var utils_1 = require("../../../common/utils");
var ponyUtils_1 = require("../../../client/ponyUtils");
var ponyHelpers_1 = require("../../../client/ponyHelpers");
var ponyInfo_1 = require("../../../common/ponyInfo");
var sprites = require("../../../generated/sprites");
var ponyAnimations_1 = require("../../../client/ponyAnimations");
var contextSpriteBatch_1 = require("../../../graphics/contextSpriteBatch");
var model_1 = require("../../services/model");
var spriteUtils_1 = require("../../../client/spriteUtils");
var colors_1 = require("../../../common/colors");
var compressPony_1 = require("../../../common/compressPony");
var canvasUtils_1 = require("../../../client/canvasUtils");
var ponyDraw_1 = require("../../../client/ponyDraw");
var sign_in_box_1 = require("../../shared/sign-in-box/sign-in-box");
var icons_1 = require("../../../client/icons");
var clientUtils_1 = require("../../../client/clientUtils");
var data_1 = require("../../../client/data");
var tags_1 = require("../../../common/tags");
var color_1 = require("../../../common/color");
var frontHoofTitles = ['', 'Fetlocks', 'Paws', 'Claws', ''];
var backHoofTitles = ['', 'Fetlocks', 'Paws', '', ''];
var horns = spriteUtils_1.addLabels(sprites.horns, [
    'None', 'Unicorn horn', 'Short unicorn horn', 'Curved unicorn horn', 'Tiny deer antlers',
    'Short deer antlers', 'Medium deer antlers', 'Large deer antlers', 'Raindeer antlers', 'Goat horns',
    'Ram horns', 'Buffalo horns', 'Moose horns', 'Bug antenna', 'Long unicorn horn',
]);
var wings = spriteUtils_1.addLabels(sprites.wings[0], [
    'None', 'Pegasus wings', 'Bat wings', 'Gryphon wings', 'Bug wings'
]);
var ears = spriteUtils_1.addLabels(sprites.ears, [
    'Regular ears', 'Fluffy ears', 'Long feathered ears', 'Bug ears', 'Short feathered ears', 'Deer ears',
]);
var noses = spriteUtils_1.addTitles(sprites.noses[0], ['Pony muzzle', 'Gryphon beak', 'Deer nose']);
var flyAnimations = [__assign(__assign({}, ponyAnimations_1.stand), { name: 'fly' }), ponyAnimations_1.fly, ponyAnimations_1.fly, ponyAnimations_1.fly, __assign(__assign({}, ponyAnimations_1.flyBug), { name: 'fly' })];
function eyeSprite(e) {
    return spriteUtils_1.createEyeSprite(e, 0, sprites.defaultPalette);
}
var Character = /** @class */ (function () {
    function Character(gameService, model, storage, modalService) {
        var _this = this;
        this.gameService = gameService;
        this.model = model;
        this.storage = storage;
        this.modalService = modalService;
        this.inGameMode = false;
        this.debug = DEVELOPMENT || BETA;
        this.previewScale = 3;
        this.showBackground = false;
        this.hidePreviewName = false;
        this.hidePreviewTag = false;
        this.playIcon = icons_1.faPlay;
        this.resetIcon = icons_1.faRedo;
        this.undoIcon = icons_1.faUndo;
        this.redoIcon = icons_1.faRedo;
        this.saveIcon = icons_1.faSave;
        this.codeIcon = icons_1.faCode;
        this.lockIcon = icons_1.faLock;
        this.infoIcon = icons_1.faInfoCircle;
        this.paintBrushIcon = icons_1.faPaintBrush;
        this.horseHeadIcon = icons_1.faHorseHead;
        this.flipIcon = icons_1.faRetweet;
        this.searchIcon = icons_1.faSearch;
        this.eraserIcon = icons_1.faEraser;
        this.nameIcon = icons_1.faFont;
        this.tagIcon = icons_1.faCode;
        this.slashIcon = icons_1.faSlash;
        this.starIcon = icons_1.faStar;
        this.maxNameLength = constants_1.PLAYER_NAME_MAX_LENGTH;
        this.maxDescLength = constants_1.PLAYER_DESC_MAX_LENGTH;
        this.horns = horns;
        this.manes = ponyUtils_1.mergedManes;
        this.backManes = ponyUtils_1.mergedBackManes;
        this.tails = sprites.tails[0];
        this.wings = wings;
        this.ears = ears;
        this.facialHair = ponyUtils_1.mergedFacialHair;
        this.headAccessories = ponyUtils_1.mergedHeadAccessories;
        this.earAccessories = ponyUtils_1.mergedEarAccessories;
        this.faceAccessories = ponyUtils_1.mergedFaceAccessories;
        this.neckAccessories = sprites.neckAccessories[1];
        this.frontLegAccessories = sprites.frontLegAccessories[1];
        this.backLegAccessories = sprites.backLegAccessories[1];
        this.backAccessories = ponyUtils_1.mergedBackAccessories;
        this.chestAccessories = ponyUtils_1.mergedChestAccessories;
        this.sleeveAccessories = sprites.frontLegSleeves[1];
        this.waistAccessories = sprites.waistAccessories[1];
        this.extraAccessories = ponyUtils_1.mergedExtraAccessories;
        this.bodyPatterns = sprites.body[1];
        this.frontLegPatterns = sprites.frontLegs[1];
        this.backLegPatterns = sprites.backLegs[1];
        this.frontHooves = spriteUtils_1.addTitles(ponyUtils_1.frontHooves[1], frontHoofTitles);
        this.backHooves = spriteUtils_1.addTitles(sprites.backLegHooves[1], backHoofTitles);
        this.animations = [
            function () { return ponyAnimations_1.stand; },
            function () { return ponyAnimations_1.trot; },
            function () { return ponyAnimations_1.boop; },
            function () { return ponyAnimations_1.sitDownUp; },
            function () { return ponyAnimations_1.lieDownUp; },
            function () { return flyAnimations[_this.previewInfo.wings.type || 0]; },
        ];
        this.eyelashes = sprites.eyeLeft[1].map(eyeSprite);
        this.eyesLeft = sprites.eyeLeft.map(function (e) { return e && e[0]; }).map(eyeSprite);
        this.eyesRight = sprites.eyeRight.map(function (e) { return e && e[0]; }).map(eyeSprite);
        this.noses = noses;
        this.heads = sprites.head1[1];
        this.buttMarkState = {
            brushType: 'brush',
            brush: 'orange'
        };
        this.tags = [
            tags_1.emptyTag,
        ];
        this.state = ponyHelpers_1.defaultPonyState();
        this.saved = [];
        this.activeAnimation = 0;
        this.loaded = false;
        this.playAnimation = true;
        this.deleting = false;
        this.fixed = false;
        this.previewExtra = false;
        this.previewMagic = false;
        this.previewPony = undefined;
        this.sites = [];
        this.canSaveFiles = clientUtils_1.isFileSaverSupported();
        this.savingLocked = false;
        this.animationTime = 0;
        this.undoHistory = [];
        this.redoHistory = [];
        this.currentUndoStateKey = '';
        this.applyingUndoRedo = false;
        this.suppressUndoCapture = false;
        this.colorDragActive = false;
        this.colorDragStartKey = '';
        this.colorDragStartUndoLength = 0;
        this.modalContext = 'play';
        this.modalTitle = 'Your character has unsaved changes.';
        this.modalPrompt = 'Would you like to save your changes or discard them for the original from the server?';
        this.modalSaveLabel = 'Save changes';
        this.modalDiscardLabel = 'Discard changes';
        this.createMuzzles();
        this.updateMuzzles();
    }
    Character.prototype.getMuzzleType = function () {
        return lodash_1.clamp(utils_1.toInt(this.info && this.info.nose && this.info.nose.type), 0, sprites.noses[0].length);
    };
    Character.prototype.createMuzzles = function () {
        var type = this.getMuzzleType();
        var happy = sprites.noses[0][type][0];
        this.muzzles = sprites.noses
            .slice()
            .map(function (n) { return n[type][0]; })
            .map(function (_a) {
            var color = _a.color, colors = _a.colors, mouth = _a.mouth;
            return ({ color: color, colors: colors, extra: mouth, palettes: [sprites.defaultPalette] });
        });
        this.fangs = [undefined, { color: happy.color, colors: 3, extra: happy.fangs, palettes: [sprites.defaultPalette] }];
    };
    Character.prototype.updateMuzzles = function () {
        var type = this.getMuzzleType();
        var happy = sprites.noses[0][type][0];
        this.muzzles.forEach(function (m, i) {
            if (m) {
                var _a = sprites.noses[i][type][0], color = _a.color, colors = _a.colors, mouth = _a.mouth;
                m.color = color;
                m.colors = colors;
                m.extra = mouth;
                m.timestamp = Date.now();
            }
        });
        var fangs = this.fangs[1];
        fangs.color = happy.color;
        fangs.extra = happy.fangs;
        fangs.timestamp = Date.now();
    };
    Object.defineProperty(Character.prototype, "account", {
        get: function () {
            return this.model.account;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "loading", {
        get: function () {
            return this.model.loading || this.model.updating;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "updateWarning", {
        get: function () {
            return this.gameService.updateWarning;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "playing", {
        get: function () {
            return !this.inGameMode && this.gameService.playing;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "previewInfo", {
        get: function () {
            return this.previewPony ? this.previewPony.ponyInfo : this.pony.ponyInfo;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "previewName", {
        get: function () {
            return this.previewPony ? this.previewPony.name : this.pony.name;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "previewTag", {
        get: function () {
            return model_1.getPonyTag(this.previewPony || this.pony, this.account);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "supporterTagLabel", {
        get: function () {
            if (this.pony.hideSupport || this.pony.supportTag === 'hidden') {
                return 'Hidden';
            }
            if (this.pony.supportTag && /^sup[1-4]$/.test(this.pony.supportTag)) {
                return this.pony.supportTag.toUpperCase();
            }
            return 'Auto';
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "showSupporterOptions", {
        get: function () {
            return this.model.supporter > 0 && this.model.isMod;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "supportChatOptions", {
        get: function () {
            var options = [
                { id: undefined, label: 'Auto' },
                { id: 'say', label: 'Say' },
                { id: 'party', label: 'Party' },
                { id: 'supporter', label: 'Supporter' },
                { id: 'think', label: 'Think' },
                { id: 'partyThink', label: 'Party think' },
                { id: 'whisper', label: 'Whisper' },
            ];
            if (this.model.supporter >= 1) {
                options.splice(4, 0, { id: 'supporter1', label: 'Supporter 1' });
            }
            if (this.model.supporter >= 2) {
                options.splice(5, 0, { id: 'supporter2', label: 'Supporter 2' });
            }
            if (this.model.supporter >= 3) {
                options.splice(6, 0, { id: 'supporter3', label: 'Supporter 3' });
            }
            if (this.model.supporter >= 4) {
                options.splice(7, 0, { id: 'supporter4', label: 'Supporter 4' });
            }
            return options;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "supportChatLabel", {
        get: function () {
            var _this = this;
            var option = this.supportChatOptions.find(function (option) { return option.id === _this.pony.supportChat; });
            return option ? option.label : 'Auto';
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "supportTagPriority", {
        get: function () {
            return this.pony.supportTagPriority !== false;
        },
        set: function (value) {
            this.pony.supportTagPriority = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "customOutlines", {
        get: function () {
            return this.info.customOutlines;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "hasCustomPreviewBackground", {
        get: function () {
            return !!this.info.previewBackground && this.info.previewBackground !== '90ee90';
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "hasCustomPreviewSettings", {
        get: function () {
            return this.previewScale !== 3 || !!this.info.headTurned || !!this.info.flip || this.hidePreviewName || this.hidePreviewTag;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "hasCustomBlushColor", {
        get: function () {
            return !!this.info.blushColor && this.info.blushColor !== 'ff89ae';
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "hasCustomEffects", {
        get: function () {
            return !!this.info.blush || !!this.info.sleeping || !!this.info.tears || !!this.info.crying || !!this.info.hearts || this.previewMagic;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "canUseMagicEffect", {
        get: function () {
            return !!(this.info.horn && this.info.horn.type);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "canUseEffects", {
        get: function () {
            return this.model.supporter >= 2;
        },
        enumerable: false,
        configurable: true
    });
    Character.prototype.resetPreview = function () {
        this.previewScale = 3;
        this.info.headTurned = false;
        this.info.flip = false;
        this.hidePreviewName = false;
        this.hidePreviewTag = false;
        this.changed();
    };
    Character.prototype.resetEffects = function () {
        this.info.blush = false;
        this.info.sleeping = false;
        this.info.tears = false;
        this.info.crying = false;
        this.info.hearts = false;
        this.previewMagic = false;
        this.changed();
    };
    Object.defineProperty(Character.prototype, "canTogglePreviewTag", {
        get: function () {
            return this.tags.length > 1 || !!(this.account && this.account.supporter);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "ponies", {
        get: function () {
            return this.model.ponies;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "pony", {
        get: function () {
            return this.model.pony;
        },
        set: function (value) {
            this.model.selectPony(value);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "info", {
        get: function () {
            return this.pony.ponyInfo;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "maneFill", {
        get: function () {
            return ponyInfo_1.getBaseFill(this.info.mane);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "coatFill", {
        get: function () {
            return this.info.coatFill;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "hoovesFill", {
        get: function () {
            return ponyInfo_1.getBaseFill(this.info.frontHooves);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "canExport", {
        get: function () {
            return DEVELOPMENT;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "site", {
        get: function () {
            return utils_1.findById(this.sites, this.pony.site) || this.sites[0];
        },
        set: function (value) {
            this.pony.site = value.id;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "tag", {
        get: function () {
            return utils_1.findById(this.tags, this.pony.tag) || this.tags[0];
        },
        set: function (value) {
            this.pony.tag = value.id;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "lockEyeWhites", {
        get: function () {
            return !this.info.unlockEyeWhites;
        },
        set: function (value) {
            this.info.unlockEyeWhites = !value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "darken", {
        get: function () {
            return !this.info.freeOutlines;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "lockFrontLegAccessory", {
        get: function () {
            return !this.info.unlockFrontLegAccessory;
        },
        set: function (value) {
            this.info.unlockFrontLegAccessory = !value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "lockBackLegAccessory", {
        get: function () {
            return !this.info.unlockBackLegAccessory;
        },
        set: function (value) {
            this.info.unlockBackLegAccessory = !value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "lockFrontHooves", {
        get: function () {
            return !this.info.unlockFrontHooves;
        },
        set: function (value) {
            this.info.unlockFrontHooves = !value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "lockBackHooves", {
        get: function () {
            return !this.info.unlockBackHooves;
        },
        set: function (value) {
            this.info.unlockBackHooves = !value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "lockBackLegs", {
        get: function () {
            return this.info.lockBackLegs !== false;
        },
        set: function (value) {
            this.info.lockBackLegs = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "lockBodyMarkings", {
        get: function () {
            return !this.info.unlockBody;
        },
        set: function (value) {
            this.info.unlockBody = !value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "lockFrontLegsMarkings", {
        get: function () {
            return !this.info.unlockFrontLegs;
        },
        set: function (value) {
            this.info.unlockFrontLegs = !value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "lockBackLegsMarkings", {
        get: function () {
            return !this.info.unlockBackLegs;
        },
        set: function (value) {
            this.info.unlockBackLegs = !value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "useExtraEarAccessory", {
        get: function () {
            return !!(this.info.earAccessoryExtra && this.info.earAccessoryExtra.type);
        },
        set: function (value) {
            if (value) {
                if (!this.info.earAccessoryExtra) {
                    this.info.earAccessoryExtra = utils_1.cloneDeep(this.info.earAccessory);
                }
                if (!this.info.earAccessoryExtra.type) {
                    this.info.earAccessoryExtra.type = (this.info.earAccessory && this.info.earAccessory.type) || 1;
                }
            }
            else if (this.info.earAccessoryExtra) {
                this.info.earAccessoryExtra.type = 0;
                this.info.earAccessoryExtra.pattern = 0;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "useExtraFaceAccessory", {
        get: function () {
            return !!(this.info.faceAccessoryExtra && this.info.faceAccessoryExtra.type);
        },
        set: function (value) {
            if (value) {
                if (!this.info.faceAccessoryExtra) {
                    this.info.faceAccessoryExtra = utils_1.cloneDeep(this.info.faceAccessory);
                }
                if (!this.info.faceAccessoryExtra.type) {
                    this.info.faceAccessoryExtra.type = (this.info.faceAccessory && this.info.faceAccessory.type) || 1;
                }
            }
            else if (this.info.faceAccessoryExtra) {
                this.info.faceAccessoryExtra.type = 0;
                this.info.faceAccessoryExtra.pattern = 0;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "lockEars", {
        get: function () {
            return !this.info.unlockEars;
        },
        set: function (value) {
            this.info.unlockEars = !value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "lockWings", {
        get: function () {
            return !this.info.unlockWings;
        },
        set: function (value) {
            this.info.unlockWings = !value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "lockSleeveAccessory", {
        get: function () {
            return !this.info.unlockSleeveAccessory;
        },
        set: function (value) {
            this.info.unlockSleeveAccessory = !value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "lockWaistAccessory", {
        get: function () {
            return !this.info.unlockWaistAccessory;
        },
        set: function (value) {
            this.info.unlockWaistAccessory = !value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "lockEyelashColor", {
        get: function () {
            return !this.info.unlockEyelashColor;
        },
        set: function (value) {
            this.info.unlockEyelashColor = !value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "lockEyeshadowColor", {
        get: function () {
            return !this.info.unlockEyeshadowColor;
        },
        set: function (value) {
            this.info.unlockEyeshadowColor = !value;
        },
        enumerable: false,
        configurable: true
    });
    Character.prototype.icon = function (id) {
        return sign_in_box_1.getProviderIcon(id);
    };
    Character.prototype.hasSleeves = function (type) {
        return ponyUtils_1.SLEEVED_ACCESSORIES.indexOf(type) !== -1;
    };
    Character.prototype.ngOnInit = function () {
        var _a;
        var _this = this;
        if (this.model.account) {
            (_a = this.tags).push.apply(_a, tags_1.getAvailableTags(this.model.account)
                .filter(function (t) { return !/^sup[1-4]$/.test(t.id) && t.id !== 'hidden'; }));
        }
        this.sites = this.model.sites.filter(function (s) { return !!s.name; });
        this.updateMuzzles();
        this.syncPreviewHeadTurnState();
        this.tryRestoreAutosaveDraft();
        var last = Date.now();
        this.resetUndoHistory();
        this.accountChangedSubscription = this.model.accountChanged.subscribe(function () { return _this.tryRestoreAutosaveDraft(); });
        return spriteUtils_1.loadAndInitSpriteSheets().then(function () {
            _this.loaded = true;
            _this.interval = setInterval(function () {
                var now = Date.now();
                _this.update((now - last) / 1000);
                last = now;
            }, 1000 / 24);
        });
    };
    Character.prototype.ngOnDestroy = function () {
        clearInterval(this.interval);
        this.accountChangedSubscription && this.accountChangedSubscription.unsubscribe();
    };
    Character.prototype.ngDoCheck = function () {
        if (!this.applyingUndoRedo && !this.suppressUndoCapture && !this.colorDragActive) {
            this.captureUndoStep();
        }
    };
    Object.defineProperty(Character.prototype, "canUndo", {
        get: function () {
            return this.undoHistory.length > 0;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "canRedo", {
        get: function () {
            return this.redoHistory.length > 0;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "isMobile", {
        get: function () {
            return data_1.isMobile;
        },
        enumerable: false,
        configurable: true
    });
    Character.prototype.matchesKey = function (event, code, keyCode) {
        return event.code === code || event.keyCode === keyCode || event.which === keyCode;
    };
    Character.prototype.onKeyDown = function (event) {
        if (this.playing)
            return;
        var tag = (event.target && event.target.tagName || '').toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
            return;
        if (event.ctrlKey || event.metaKey) {
            if (this.matchesKey(event, 'KeyZ', 90)) {
                event.preventDefault();
                this.undo();
            }
            else if (this.matchesKey(event, 'KeyY', 89)) {
                event.preventDefault();
                this.redo();
            }
            return;
        }
        if (!this.info)
            return;
        if (this.matchesKey(event, 'KeyH', 72)) {
            event.preventDefault();
            this.toggleHeadTurned();
            return;
        }
        if (this.matchesKey(event, 'KeyA', 65)) {
            if (this.info.flip) {
                event.preventDefault();
                this.info.flip = false;
                this.changed();
            }
            return;
        }
        if (this.matchesKey(event, 'KeyD', 68)) {
            if (!this.info.flip) {
                event.preventDefault();
                this.info.flip = true;
                this.changed();
            }
            return;
        }
        if (this.matchesKey(event, 'KeyG', 71)) {
            event.preventDefault();
            this.previewScale = this.previewScale >= 7 ? 1 : this.previewScale + 1;
            this.changed();
            return;
        }
        if (this.matchesKey(event, 'KeyF', 70)) {
            event.preventDefault();
            this.previewScale = this.previewScale <= 1 ? 7 : this.previewScale - 1;
            this.changed();
            return;
        }
        if (this.matchesKey(event, 'KeyY', 89)) {
            event.preventDefault();
            this.toggleHidePreviewName();
            return;
        }
        if (this.matchesKey(event, 'KeyT', 84)) {
            event.preventDefault();
            this.toggleHidePreviewTag();
            return;
        }
    };
    Character.prototype.createUndoPonySnapshot = function () {
        var pony = utils_1.cloneDeep(this.pony);
        if (pony.ponyInfo) {
            pony.info = compressPony_1.compressPonyString(pony.ponyInfo);
        }
        return pony;
    };
    Character.prototype.createUndoState = function () {
        return {
            pony: this.createUndoPonySnapshot(),
            previewScale: this.previewScale,
            hidePreviewName: this.hidePreviewName,
            hidePreviewTag: this.hidePreviewTag,
            showBackground: this.showBackground
        };
    };
    Character.prototype.getUndoStateKey = function (state) {
        return JSON.stringify(state);
    };
    Character.prototype.resetUndoHistory = function () {
        this.undoHistory = [];
        this.redoHistory = [];
        this.suppressUndoCapture = false;
        this.colorDragActive = false;
        this.colorDragStartState = undefined;
        this.colorDragStartKey = '';
        this.colorDragStartUndoLength = 0;
        this.currentUndoState = this.createUndoState();
        this.currentUndoStateKey = this.getUndoStateKey(this.currentUndoState);
    };
    Character.prototype.captureUndoStep = function () {
        if (this.colorDragActive) {
            return;
        }
        var currentState = this.createUndoState();
        var currentStateKey = this.getUndoStateKey(currentState);
        if (!this.currentUndoState) {
            this.currentUndoState = currentState;
            this.currentUndoStateKey = currentStateKey;
            return;
        }
        if (currentStateKey === this.currentUndoStateKey) {
            return;
        }
        this.undoHistory.push(this.currentUndoState);
        if (this.undoHistory.length > 100) {
            this.undoHistory.shift();
        }
        this.redoHistory = [];
        this.currentUndoState = currentState;
        this.currentUndoStateKey = currentStateKey;
    };
    Character.prototype.applyUndoState = function (state) {
        this.deleting = false;
        this.pony = utils_1.cloneDeep(state.pony);
        this.previewScale = state.previewScale;
        this.hidePreviewName = state.hidePreviewName;
        this.hidePreviewTag = state.hidePreviewTag;
        this.showBackground = state.showBackground;
        this.updateMuzzles();
    };
    Character.prototype.undo = function () {
        if (!this.canUndo)
            return;
        this.applyingUndoRedo = true;
        this.suppressUndoCapture = false;
        this.colorDragActive = false;
        if (this.currentUndoState) {
            this.redoHistory.push(utils_1.cloneDeep(this.currentUndoState));
        }
        var snapshot = utils_1.cloneDeep(this.undoHistory.pop());
        this.applyUndoState(snapshot);
        this.currentUndoState = this.createUndoState();
        this.currentUndoStateKey = this.getUndoStateKey(this.currentUndoState);
        this.changed();
        this.applyingUndoRedo = false;
    };
    Character.prototype.redo = function () {
        if (!this.canRedo)
            return;
        this.applyingUndoRedo = true;
        this.suppressUndoCapture = false;
        this.colorDragActive = false;
        if (this.currentUndoState) {
            this.undoHistory.push(utils_1.cloneDeep(this.currentUndoState));
            if (this.undoHistory.length > 100) {
                this.undoHistory.shift();
            }
        }
        var snapshot = utils_1.cloneDeep(this.redoHistory.pop());
        this.applyUndoState(snapshot);
        this.currentUndoState = this.createUndoState();
        this.currentUndoStateKey = this.getUndoStateKey(this.currentUndoState);
        this.changed();
        this.applyingUndoRedo = false;
    };
    // called every tick during color drag — updates preview but does NOT push undo
    Character.prototype.beginColorChange = function () {
        if (!this.colorDragActive) {
            var startState = this.currentUndoState ? utils_1.cloneDeep(this.currentUndoState) : this.createUndoState();
            this.colorDragStartState = startState;
            this.colorDragStartKey = this.getUndoStateKey(startState);
            this.colorDragStartUndoLength = this.undoHistory.length;
        }
        this.colorDragActive = true;
        this.suppressUndoCapture = true;
    };
    Character.prototype.colorChanged = function () {
        this.suppressUndoCapture = true;
        this.renderChanged();
    };
    // called when color drag ends or manual input commits — pushes undo step
    Character.prototype.colorChangeDone = function () {
        this.suppressUndoCapture = false;
        var currentState = this.createUndoState();
        var currentStateKey = this.getUndoStateKey(currentState);
        if (this.colorDragActive && this.colorDragStartState) {
            if (this.undoHistory.length > this.colorDragStartUndoLength) {
                this.undoHistory.splice(this.colorDragStartUndoLength);
            }
            if (currentStateKey !== this.colorDragStartKey) {
                this.undoHistory.push(utils_1.cloneDeep(this.colorDragStartState));
                if (this.undoHistory.length > 100) {
                    this.undoHistory.shift();
                }
                this.redoHistory = [];
            }
            this.currentUndoState = currentState;
            this.currentUndoStateKey = currentStateKey;
        }
        else if (!this.applyingUndoRedo) {
            this.captureUndoStep();
        }
        this.colorDragActive = false;
        this.colorDragStartState = undefined;
        this.colorDragStartKey = '';
        this.colorDragStartUndoLength = 0;
        this.renderChanged();
    };
    Character.prototype.changed = function () {
        this.suppressUndoCapture = false;
        this.colorDragActive = false;
        this.colorDragStartState = undefined;
        this.colorDragStartKey = '';
        this.colorDragStartUndoLength = 0;
        if (!this.applyingUndoRedo) {
            this.captureUndoStep();
        }
        this.renderChanged();
        this.scheduleAutosaveDraft();
    };
    Character.prototype.scheduleAutosaveDraft = function () {
        var _this = this;
        if (this.autosaveTimer) {
            clearTimeout(this.autosaveTimer);
        }
        this.autosaveTimer = setTimeout(function () {
            _this.autosaveTimer = undefined;
            _this.saveAutoSaveDraft();
        }, 1000);
    };
    Character.prototype.renderChanged = function () {
        var _this = this;
        // normalize a few fields to prevent invalid UI state (e.g. strings or out-of-range numbers)
        this.info.flip = !!this.info.flip;
        this.info.headTurned = !!this.info.headTurned;
        this.info.headTurn = Math.max(0, Math.min(6, (this.info.headTurn === undefined ? 0 : this.info.headTurn | 0)));
        if (!this.canUseMagicEffect) {
            this.previewMagic = false;
        }
        if (!this.canUseEffects) {
            this.info.blush = false;
            this.info.sleeping = false;
            this.info.tears = false;
            this.info.crying = false;
            this.info.hearts = false;
            this.previewMagic = false;
        }
        // if head is forced turned by default, keep headTurn at 0 to avoid large offsets
        if (this.info.headTurned) {
            this.info.headTurn = 0;
        }
        if (!this.syncTimeout) {
            this.syncTimeout = requestAnimationFrame(function () {
                _this.syncTimeout = undefined;
                _this.syncPreviewHeadTurnState();
                // force preview redraw so flip/head settings apply immediately
                try {
                    _this.characterPreview && _this.characterPreview.redraw && _this.characterPreview.redraw();
                }
                catch (_a) { }
                ponyInfo_1.syncLockedPonyInfo(_this.info);
            });
        }
        // Always keep preview state's blush color in sync with editor info so
        // the preview shows the correct custom/default color after roundtrips.
        this.state.blushColor = this.info.blushColor ? color_1.parseColorWithAlpha(this.info.blushColor, 1) : colors_1.blushColor(color_1.parseColorWithAlpha(this.coatFill || '', 1));
        // If blush effect is disabled in the editor, ensure any transient
        // expression-based blush is cleared from the preview state so the
        // preview doesn't show an expression blush left over from gameplay.
        if (!this.info.blush && this.state.expression && this.state.expression.extra === 1 /* Blush */) {
            this.state.expression = __assign(__assign({}, this.state.expression), { extra: 0 /* None */ });
        }
    };
    Character.prototype.update = function (delta) {
        this.animationTime += delta;
        var animation = this.animations[this.activeAnimation]();
        this.state.animation = animation;
        if (this.playAnimation) {
            this.state.animationFrame = Math.floor(this.animationTime * animation.fps) % animation.frames.length;
        }
    };
    Character.prototype.copyCoatColorToTail = function () {
        if (this.info.tail && this.info.tail.fills) {
            this.info.tail.fills[0] = this.info.coatFill;
            this.changed();
        }
    };
    Character.prototype.resetBackground = function () {
        // default green (matches GRASS_COLOR = 0x90ee90ff)
        this.info.previewBackground = '90ee90';
        this.changed();
    };
    Character.prototype.resetBlush = function () {
        this.info.blushColor = 'ff89ae';
        this.changed();
    };
    Character.prototype.toggleBlushEffect = function () {
        this.info.blush = !this.info.blush;
        this.changed();
    };
    Character.prototype.toggleSleepingEffect = function () {
        this.info.sleeping = !this.info.sleeping;
        this.changed();
    };
    Character.prototype.toggleTearsEffect = function () {
        this.info.tears = !this.info.tears;
        if (this.info.tears) {
            this.info.crying = false;
        }
        this.changed();
    };
    Character.prototype.toggleCryingEffect = function () {
        this.info.crying = !this.info.crying;
        if (this.info.crying) {
            this.info.tears = false;
        }
        this.changed();
    };
    Character.prototype.toggleHeartsEffect = function () {
        this.info.hearts = !this.info.hearts;
        this.changed();
    };
    Character.prototype.toggleMagicEffect = function () {
        if (!this.canUseMagicEffect)
            return;
        this.previewMagic = !this.previewMagic;
        this.changed();
    };
    Character.prototype.toggleBackground = function () {
        this.showBackground = !this.showBackground;
        this.changed();
    };
    Character.prototype.toggleHidePreviewName = function () {
        this.hidePreviewName = !this.hidePreviewName;
        this.changed();
    };
    Character.prototype.toggleHidePreviewTag = function () {
        this.hidePreviewTag = !this.hidePreviewTag;
        this.changed();
    };
    Character.prototype.toggleHeadTurned = function () {
        this.info.headTurned = !this.info.headTurned;
        this.syncPreviewHeadTurnState();
        this.changed();
    };
    Character.prototype.syncPreviewHeadTurnState = function () {
        var turned = !!this.info.headTurned;
        this.state.headTurned = turned;
        if (turned) {
            this.state.headTurn = 0;
        }
    };
    Character.prototype.toggleFlip = function () {
        this.info.flip = !this.info.flip;
        this.changed();
    };
    Character.prototype.eyeColorLockChanged = function (locked) {
        if (locked) {
            this.info.eyeColorLeft = this.info.eyeColorRight;
        }
    };
    Character.prototype.eyeWhiteLockChanged = function (locked) {
        if (locked) {
            this.info.eyeWhitesLeft = this.info.eyeWhites;
        }
    };
    Character.prototype.eyeOpennessChanged = function (locked) {
        if (locked) {
            this.info.eyeOpennessLeft = this.info.eyeOpennessRight;
        }
    };
    Character.prototype.eyelashLockChanged = function (locked) {
        if (locked) {
            this.info.eyelashColorLeft = this.info.eyelashColor;
        }
    };
    Character.prototype.eyeshadowLockChanged = function (locked) {
        if (locked) {
            this.info.eyeshadowLeft = this.info.eyeshadow;
            this.info.eyeshadowColorLeft = this.info.eyeshadowColor;
        }
    };
    Character.prototype.earsLockChanged = function (locked) {
        if (locked) {
            this.info.earsRight = utils_1.cloneDeep(this.info.ears);
        }
        else {
            this.info.earsRight = utils_1.cloneDeep(this.info.earsRight || this.info.ears);
        }
    };
    Character.prototype.wingsLockChanged = function (locked) {
        if (locked) {
            this.info.wingsRight = utils_1.cloneDeep(this.info.wings);
        }
        else {
            this.info.wingsRight = utils_1.cloneDeep(this.info.wingsRight || this.info.wings);
        }
    };
    Character.prototype.sleeveLockChanged = function (locked) {
        if (locked) {
            this.info.sleeveAccessoryRight = utils_1.cloneDeep(this.info.sleeveAccessory);
        }
        else {
            this.info.sleeveAccessoryRight = utils_1.cloneDeep(this.info.sleeveAccessoryRight || this.info.sleeveAccessory);
        }
    };
    Character.prototype.waistLockChanged = function (locked) {
        if (locked) {
            this.info.waistAccessoryRight = utils_1.cloneDeep(this.info.waistAccessory);
        }
        else {
            this.info.waistAccessoryRight = utils_1.cloneDeep(this.info.waistAccessoryRight || this.info.waistAccessory);
        }
    };
    Character.prototype.bodyLockChanged = function (locked) {
        if (locked) {
            this.info.bodyRight = utils_1.cloneDeep(this.info.body);
        }
        else {
            this.info.bodyRight = utils_1.cloneDeep(this.info.bodyRight || this.info.body);
        }
    };
    Character.prototype.frontLegsLockChanged = function (locked) {
        if (locked) {
            this.info.frontLegsRight = utils_1.cloneDeep(this.info.frontLegs);
        }
        else {
            this.info.frontLegsRight = utils_1.cloneDeep(this.info.frontLegsRight || this.info.frontLegs);
        }
    };
    Character.prototype.frontHoovesLockChanged = function (locked) {
        if (locked) {
            this.info.frontHoovesRight = utils_1.cloneDeep(this.info.frontHooves);
        }
        else {
            this.info.frontHoovesRight = utils_1.cloneDeep(this.info.frontHoovesRight || this.info.frontHooves);
        }
    };
    Character.prototype.backHoovesPairChanged = function (locked) {
        if (locked) {
            this.info.backHooves = utils_1.cloneDeep(this.info.frontHooves);
            this.info.backHoovesRight = utils_1.cloneDeep(this.lockFrontHooves ? this.info.frontHooves : this.info.frontHoovesRight);
        }
    };
    Character.prototype.backHoovesLockChanged = function (locked) {
        if (locked) {
            this.info.backHoovesRight = utils_1.cloneDeep(this.info.backHooves);
        }
        else {
            this.info.backHoovesRight = utils_1.cloneDeep(this.info.backHoovesRight || this.info.backHooves);
        }
    };
    Character.prototype.backLegsPairChanged = function (locked) {
        if (locked) {
            this.info.backLegs = utils_1.cloneDeep(this.info.frontLegs);
            var sourceRight = this.lockFrontLegsMarkings ? this.info.frontLegs : this.info.frontLegsRight;
            this.info.backLegsRight = utils_1.cloneDeep(sourceRight);
        }
        else {
            this.info.backLegs = utils_1.cloneDeep(this.info.backLegs || this.info.frontLegs);
            if (this.lockBackLegsMarkings) {
                this.info.backLegsRight = utils_1.cloneDeep(this.info.backLegs);
            }
            else {
                this.info.backLegsRight = utils_1.cloneDeep(this.info.backLegsRight || this.info.backLegs);
            }
        }
    };
    Character.prototype.backLegsLockChanged = function (locked) {
        if (locked) {
            this.info.backLegsRight = utils_1.cloneDeep(this.info.backLegs);
        }
        else {
            this.info.backLegsRight = utils_1.cloneDeep(this.info.backLegsRight || this.info.backLegs);
        }
    };
    Character.prototype.select = function (pony) {
        if (pony) {
            this.deleting = false;
            this.pony = pony;
            this.resetUndoHistory();
        }
    };
    Character.prototype.setActiveAnimation = function (index) {
        this.activeAnimation = index;
        this.animationTime = 0;
    };
    Character.prototype.freeOutlinesChanged = function (_free) {
        this.changed();
    };
    Character.prototype.darkenLockedOutlinesChanged = function (_darken) {
        this.changed();
    };
    Object.defineProperty(Character.prototype, "canSave", {
        get: function () {
            return !this.model.pending && !!this.pony && !!this.pony.name && !this.savingLocked;
        },
        enumerable: false,
        configurable: true
    });
    Character.prototype.save = function () {
        var _this = this;
        if (this.canSave) {
            this.error = undefined;
            this.deleting = false;
            this.savingLocked = true;
            this.model.savePony(this.pony)["catch"](function (e) { return _this.error = e.message; })
                .then(function (savedPony) {
                if (savedPony) {
                    _this.resetUndoHistory();
                    _this.clearAutoSaveDraft(_this.pony.id);
                }
                return savedPony;
            })
                .then(function () { return utils_1.delay(2000); })
                .then(function () { return _this.savingLocked = false; });
        }
    };
    Object.defineProperty(Character.prototype, "canRevert", {
        get: function () {
            return !!utils_1.findById(this.ponies, this.pony.id);
        },
        enumerable: false,
        configurable: true
    });
    Character.prototype.revert = function () {
        if (this.canRevert) {
            this.select(utils_1.findById(this.ponies, this.pony.id));
            this.clearAutoSaveDraft(this.pony.id);
        }
    };
    Object.defineProperty(Character.prototype, "canDuplicate", {
        get: function () {
            return this.ponies.length < this.model.characterLimit;
        },
        enumerable: false,
        configurable: true
    });
    Character.prototype.duplicate = function () {
        if (this.canDuplicate) {
            this.deleting = false;
            this.pony = utils_1.cloneDeep(this.pony);
            this.pony.name = '';
            this.pony.id = '';
            this.resetUndoHistory();
        }
    };
    Object.defineProperty(Character.prototype, "storedPony", {
        get: function () {
            return this.pony.id ? utils_1.findById(this.ponies, this.pony.id) : undefined;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "storedPonyInfo", {
        get: function () {
            var stored = this.storedPony;
            if (!stored) {
                return undefined;
            }
            if (stored.ponyInfo) {
                return stored.ponyInfo;
            }
            try {
                return compressPony_1.decompressPonyString(stored.info, true);
            }
            catch (_a) {
                return undefined;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Character.prototype, "hasUnsavedCharacterChanges", {
        get: function () {
            var stored = this.storedPony;
            if (!stored) {
                return false;
            }
            if (this.pony.name !== stored.name || this.pony.desc !== stored.desc || this.pony.site !== stored.site
                || this.pony.tag !== stored.tag || this.pony.supportTag !== stored.supportTag
                || this.pony.hideSupport !== stored.hideSupport || this.pony.respawnAtSpawn !== stored.respawnAtSpawn) {
                return true;
            }
            var currentInfo = this.pony.ponyInfo ? compressPony_1.compressPonyString(this.pony.ponyInfo) : this.pony.info;
            return currentInfo !== stored.info;
        },
        enumerable: false,
        configurable: true
    });
    Character.prototype.onPlayRequest = function (playCallback) {
        if (this.hasUnsavedCharacterChanges && this.storedPony) {
            this.openContextModal('play', playCallback);
            return;
        }
        playCallback();
    };
    Character.prototype.openContextModal = function (context, playCallback) {
        this.modalContext = context;
        this.pendingPlayCallback = playCallback;
        this.modalPonyName = this.pony.name;
        if (context === 'play') {
            this.modalTitle = 'Your character has unsaved changes.';
            this.modalPrompt = 'Save your edits before playing, or discard them and use the stored character version.';
            this.modalSaveLabel = 'Save & Play';
            this.modalDiscardLabel = 'Discard Changes';
            this.modalCurrentPony = this.pony.ponyInfo;
            this.modalStoredPony = this.storedPonyInfo;
        }
        else {
            this.modalTitle = 'A draft was found for this character.';
            this.modalPrompt = 'Restore the previous draft or discard it and continue with the current character data.';
            this.modalSaveLabel = 'Restore Draft';
            this.modalDiscardLabel = 'Discard Draft';
            this.modalCurrentPony = this.pony.ponyInfo;
            this.modalStoredPony = this.restoreDraftCandidate ? this.restoreDraftCandidate.ponyInfo : undefined;
        }
        this.unsavedChangesModalRef = this.modalService.show(this.unsavedCharacterModalTpl, { "class": 'modal-lg', ignoreBackdropClick: true });
    };
    Character.prototype.getAutoSaveDraftKey = function (ponyId) {
        var accountId = this.model.account ? this.model.account.id : 'anonymous';
        return "character-editor-draft:" + accountId + ":" + (ponyId || 'new');
    };
    Character.prototype.saveAutoSaveDraft = function () {
        var draftKey = this.getAutoSaveDraftKey(this.pony.id || 'new');
        this.storage.setJSON(draftKey, utils_1.cloneDeep(this.pony));
    };
    Character.prototype.loadAutoSaveDraft = function (ponyId) {
        return this.storage.getJSON(this.getAutoSaveDraftKey(ponyId), undefined);
    };
    Character.prototype.clearAutoSaveDraft = function (ponyId) {
        this.storage.removeItem(this.getAutoSaveDraftKey(ponyId));
    };
    Character.prototype.arePonyObjectsEqual = function (a, b) {
        if (!a || !b) {
            return a === b;
        }
        return JSON.stringify(a) === JSON.stringify(b);
    };
    Character.prototype.tryRestoreAutosaveDraft = function () {
        if (!this.pony) {
            return;
        }
        var draft = this.loadAutoSaveDraft(this.pony.id || 'new');
        if (!draft) {
            return;
        }
        if (this.arePonyObjectsEqual(draft, this.pony)) {
            return;
        }
        this.restoreDraftCandidate = draft;
        this.openContextModal('restore');
    };
    Character.prototype.closeUnsavedChangesModal = function () {
        if (this.unsavedChangesModalRef) {
            this.unsavedChangesModalRef.hide();
            this.unsavedChangesModalRef = undefined;
        }
        this.pendingPlayCallback = undefined;
        this.restoreDraftCandidate = undefined;
    };
    Character.prototype.confirmSaveAndPlay = function () {
        var _this = this;
        if (this.modalContext === 'play' && !this.pendingPlayCallback) {
            return;
        }
        this.error = undefined;
        var draftKey = this.pony.id || 'new';
        this.model.savePony(this.pony)
            .then(function (savedPony) {
            if (savedPony) {
                _this.resetUndoHistory();
                _this.clearAutoSaveDraft(draftKey);
            }
            var callback = _this.pendingPlayCallback;
            _this.closeUnsavedChangesModal();
            if (_this.modalContext === 'play') {
                callback({ pony: savedPony, skipSave: true });
            }
            else {
                _this.applyRestoreDraftCandidate();
            }
        })["catch"](function (e) {
            _this.error = e.message;
        })["finally"](function () {
            _this.pendingPlayCallback = undefined;
        });
    };
    Character.prototype.applyRestoreDraftCandidate = function () {
        if (!this.restoreDraftCandidate) {
            return;
        }
        this.pony = utils_1.cloneDeep(this.restoreDraftCandidate);
        this.resetUndoHistory();
        this.restoreDraftCandidate = undefined;
    };
    Character.prototype.restoreStoredPony = function () {
        var stored = this.storedPony;
        if (!stored) {
            return;
        }
        this.pony = utils_1.cloneDeep(stored);
        this.resetUndoHistory();
    };
    Character.prototype.confirmDiscardAndPlay = function () {
        if (this.modalContext === 'play') {
            if (!this.pendingPlayCallback) {
                return;
            }
            var stored = this.storedPony;
            var callback = this.pendingPlayCallback;
            this.restoreStoredPony();
            this.closeUnsavedChangesModal();
            this.clearAutoSaveDraft(this.pony.id || 'new');
            if (stored) {
                callback({ pony: stored, skipSave: true });
            }
            else {
                callback();
            }
            return;
        }
        this.restoreStoredPony();
        this.clearAutoSaveDraft(this.pony.id || 'new');
        this.closeUnsavedChangesModal();
    };
    Character.prototype.cancelPlay = function () {
        this.restoreStoredPony();
        this.closeUnsavedChangesModal();
    };
    Character.prototype["export"] = function (index) {
        var frameWidth = 80;
        var frameHeight = 90;
        var animations = index === undefined ? this.animations.map(function (a) { return a(); }) : [this.animations[index]()];
        var frames = animations.reduce(function (sum, a) { return sum + a.frames.length; }, 0);
        var info = ponyInfo_1.toPalette(this.info);
        var options = ponyHelpers_1.defaultDrawPonyOptions();
        var canvas = contextSpriteBatch_1.drawCanvas(frameWidth * frames, frameHeight, sprites.paletteSpriteSheet, colors_1.TRANSPARENT, function (batch) {
            var i = 0;
            animations.forEach(function (a) {
                for (var f = 0; f < a.frames.length; f++, i++) {
                    var state = __assign(__assign({}, ponyHelpers_1.defaultPonyState()), { animation: a, animationFrame: f, blinkFrame: 1 });
                    ponyDraw_1.drawPony(batch, info, state, i * frameWidth + frameWidth / 2, frameHeight - 10, options);
                }
            });
        });
        var name = animations.length === 1 ? animations[0].name : 'all';
        canvasUtils_1.saveCanvas(canvas, this.pony.name + "-" + name + ".png");
    };
    Character.prototype["import"] = function () {
        if (DEVELOPMENT) {
            var data = prompt('enter data');
            if (data) {
                this.importPony(data);
            }
        }
    };
    Character.prototype.importPony = function (data) {
        if (DEVELOPMENT) {
            this.pony.ponyInfo = compressPony_1.decompressPonyString(data, true);
            var t = compressPony_1.decompressPonyString(data, false);
            console.log(JSON.stringify(t, undefined, 2));
        }
    };
    Character.prototype.addBlush = function () {
        if (DEVELOPMENT || BETA) {
            this.state = __assign(__assign({}, this.state), { expression: clientUtils_1.createExpression(1 /* Neutral */, 1 /* Neutral */, 0 /* Smile */, 0 /* Forward */, 0 /* Forward */, 1 /* Blush */) });
            this.changed();
        }
    };
    Character.prototype.testSize = function () {
        function stringifyValues(values) {
            return values.map(function (x) { return JSON.stringify(x); }).join(typeof values[0] === 'object' ? ',\n\t' : ', ');
        }
        if (DEVELOPMENT) {
            var compressed = compressPony_1.compressPonyString(this.info);
            var regularSize = JSON.stringify(this.info).length;
            var ponyInfoNumber = compressPony_1.decompressPony(compressed);
            var precomp_1 = compressPony_1.precompressPony(ponyInfoNumber, colors_1.BLACK, function (x) { return x; });
            var details = Object.keys(precomp_1)
                .filter(function (key) { return key !== 'version'; })
                .map(function (key) { return ({ key: key, values: precomp_1[key] || [] }); })
                .map(function (_a) {
                var key = _a.key, values = _a.values;
                return key + ": [\n\t" + stringifyValues(values) + "\n]";
            })
                .join(',\n');
            var serialized = compressPony_1.compressPonyString(this.info);
            console.log(serialized);
            console.log(details);
            console.log(serialized.length + " / " + regularSize);
        }
    };
    Character.prototype.testJSON = function () {
        if (DEVELOPMENT) {
            console.log(JSON.stringify(this.info, undefined, 2));
        }
    };
    Character.prototype.exportPony = function () {
        var data = ponyToExport(this.pony) + '\r\n';
        saveAs(new Blob([data], { type: 'text/plain;charset=utf-8' }), this.pony.name + ".txt");
    };
    Character.prototype.exportPonies = function () {
        var data = this.ponies.map(ponyToExport).join('\r\n') + '\r\n';
        saveAs(new Blob([data], { type: 'text/plain;charset=utf-8' }), 'ponies.txt');
    };
    Character.prototype.importPonies = function (file) {
        return __awaiter(this, void 0, void 0, function () {
            var text, lines, _i, lines_1, line, _a, name, info, _b, desc, pony, e_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!file) return [3 /*break*/, 8];
                        return [4 /*yield*/, clientUtils_1.readFileAsText(file)];
                    case 1:
                        text = _c.sent();
                        lines = text.split(/\r?\n/g);
                        _i = 0, lines_1 = lines;
                        _c.label = 2;
                    case 2:
                        if (!(_i < lines_1.length)) return [3 /*break*/, 8];
                        line = lines_1[_i];
                        _c.label = 3;
                    case 3:
                        _c.trys.push([3, 6, , 7]);
                        _a = line.split(/\t/g), name = _a[0], info = _a[1], _b = _a[2], desc = _b === void 0 ? '' : _b;
                        if (!(name && info)) return [3 /*break*/, 5];
                        pony = {
                            name: name,
                            id: '',
                            info: info,
                            desc: desc,
                            ponyInfo: compressPony_1.decompressPonyString(info, true)
                        };
                        return [4 /*yield*/, this.model.savePony(pony, true)];
                    case 4:
                        _c.sent();
                        _c.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        e_1 = _c.sent();
                        DEVELOPMENT && console.error(e_1);
                        return [3 /*break*/, 7];
                    case 7:
                        _i++;
                        return [3 /*break*/, 2];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    __decorate([
        core_1.ViewChild('characterPreview', { static: true })
    ], Character.prototype, "characterPreview");
    __decorate([
        core_1.ViewChild('unsavedCharacterModal', { static: true })
    ], Character.prototype, "unsavedCharacterModalTpl");
    __decorate([
        core_1.Input()
    ], Character.prototype, "inGameMode");
    __decorate([
        core_1.HostListener('window:keydown', ['$event'])
    ], Character.prototype, "onKeyDown");
    Character = __decorate([
        core_1.Component({
            selector: 'character',
            templateUrl: 'character.pug',
            styleUrls: ['character.scss'],
            encapsulation: core_1.ViewEncapsulation.None
        })
    ], Character);
    return Character;
}());
exports.Character = Character;
function ponyToExport(pony) {
    return (pony.name + "\t" + pony.info + "\t" + (pony.desc || '')).trim();
}
