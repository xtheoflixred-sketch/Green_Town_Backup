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
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.ServerActions = exports.clearClientToolVisuals = void 0;
var ag_sockets_1 = require("ag-sockets");
var interfaces_1 = require("../common/interfaces");
var constants_1 = require("../common/constants");
var utils_1 = require("../common/utils");
var adminUtils_1 = require("../common/adminUtils");
var accountUtils_1 = require("../common/accountUtils");
var entities = require("../common/entities");
var accountUtils_2 = require("./accountUtils");
var world_1 = require("./world");
var playerUtils_1 = require("./playerUtils");
var account_1 = require("./api/account");
var expressionEncoder_1 = require("../common/encoders/expressionEncoder");
var entityUtils_1 = require("./entityUtils");
var logger_1 = require("./logger");
var db_1 = require("./db");
var chat_1 = require("./chat");
var worldMap_1 = require("../common/worldMap");
var regionUtils_1 = require("./regionUtils");
var serverMap_1 = require("./serverMap");
var friends_1 = require("./services/friends");
var camera_1 = require("../common/camera");
var characterUtils_1 = require("./characterUtils");
var collision_1 = require("../common/collision");
var entities_1 = require("../common/entities");
var ponyInfo_1 = require("../common/ponyInfo");
var modActionNames = ['None', 'Report', 'Mute', 'Shadow', 'Kick', 'Ban'];
var playerActionNames = [
    'None',
    'Ignore',
    'Unignore',
    'InviteToParty',
    'RemoveFromParty',
    'PromotePartyLeader',
    'HidePlayer',
    'InviteToSupporterServers',
    'AddFriend',
    'RemoveFriend',
    'SendItem',
    'TradeItem',
    'PickUpItem',
    'SendToy',
    'TradeToy',
    'PickUpToy',
];
var editorAdded = new Map();
var debugRate = DEVELOPMENT ? '1000/s' : '';
function clearToolHover(client, world, map) {
    if (map === void 0) { map = client.map; }
    var hoverEntity = client.toolHoverEntity;
    if (hoverEntity) {
        hoverEntity.selected = false;
        world.removeEntity(hoverEntity, map);
        client.toolHoverEntity = undefined;
    }
}
function clearToolPreview(client, world, map) {
    if (map === void 0) { map = client.map; }
    var previewEntity = client.toolPreviewEntity;
    if (previewEntity) {
        world.removeEntity(previewEntity, map);
        client.toolPreviewEntity = undefined;
    }
}
function clearClientToolVisuals(client, world, map) {
    if (map === void 0) { map = client.map; }
    clearToolHover(client, world, map);
    clearToolPreview(client, world, map);
}
exports.clearClientToolVisuals = clearClientToolVisuals;
function typingMessageTypeToChatType(type) {
    switch (type) {
        case 0 /* Chat */: return 0 /* Say */;
        case 4 /* Party */: return 1 /* Party */;
        case 5 /* Thinking */: return 2 /* Think */;
        case 6 /* PartyThinking */: return 3 /* PartyThink */;
        case 9 /* Supporter1 */: return 5 /* Supporter1 */;
        case 10 /* Supporter2 */: return 6 /* Supporter2 */;
        case 11 /* Supporter3 */: return 7 /* Supporter3 */;
        case 12 /* Supporter4 */: return 8 /* Supporter4 */;
        case 13 /* Whisper */:
        case 14 /* WhisperTo */:
        case 15 /* WhisperAnnouncement */:
        case 16 /* WhisperToAnnouncement */:
            return 10 /* Whisper */;
        default:
            return undefined;
    }
}
var ServerActions = /** @class */ (function () {
    function ServerActions(client, world, notificationService, partyService, supporterInvites, holdItemService, getSettings, server, chatSay, moveFunc, hiding, states, accountService, ignorePlayer, findClientByEntityId, friends) {
        this.client = client;
        this.world = world;
        this.notificationService = notificationService;
        this.partyService = partyService;
        this.supporterInvites = supporterInvites;
        this.holdItemService = holdItemService;
        this.getSettings = getSettings;
        this.server = server;
        this.chatSay = chatSay;
        this.moveFunc = moveFunc;
        this.hiding = hiding;
        this.states = states;
        this.accountService = accountService;
        this.ignorePlayer = ignorePlayer;
        this.findClientByEntityId = findClientByEntityId;
        this.friends = friends;
    }
    ServerActions.prototype.getSelectedWallMaterial = function () {
        if (this.wallMaterialMap !== this.map || !this.wallMaterial) {
            this.wallMaterialMap = this.map;
            // Use 'wood' as default material
            this.wallMaterial = 'wood';
        }
        return this.wallMaterial;
    };
    Object.defineProperty(ServerActions.prototype, "account", {
        get: function () {
            return this.client.account;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ServerActions.prototype, "pony", {
        get: function () {
            return this.client.pony;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ServerActions.prototype, "map", {
        get: function () {
            return this.client.map;
        },
        enumerable: false,
        configurable: true
    });
    ServerActions.prototype.connected = function () {
        var _this = this;
        this.client.connectedTime = Date.now();
        this.client.lastPacket = Date.now();
        this.client.loading = true;
        this.client.reporter.systemLog("joined [" + this.server.id + "] as \"" + this.client.characterName + "\" [" + this.client.ip + "]");
        if (DEVELOPMENT && /slow/.test(this.client.characterName)) {
            setTimeout(function () { return _this.world.joinClientToQueue(_this.client); }, 5000);
        }
        else {
            this.world.joinClientToQueue(this.client);
        }
    };
    ServerActions.prototype.disconnected = function () {
        return __awaiter(this, void 0, void 0, function () {
            var state, duration, leaveReason;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        state = playerUtils_1.createCharacterState(this.pony, this.client.map);
                        duration = Date.now() - this.client.connectedTime;
                        leaveReason = this.client.leaveReason || 'disconnected';
                        if (this.client.logDisconnect) {
                            logger_1.logger.warn("disconnected (" + leaveReason + ") account: " + this.client.account.name + " [" + this.client.accountId + "]");
                        }
                        this.client.offline = true;
                        this.client.offlineAt = new Date();
                        this.client.reporter.systemLog("left [" + this.server.id + "] (" + leaveReason + ") (" + utils_1.formatDuration(duration) + ")");
                        this.world.leaveClient(this.client);
                        this.partyService.clientDisconnected(this.client);
                        this.friends.clientDisconnected(this.client);
                        this.holdItemService.clientDisconnected(this.client);
                        this.states.add(this.client.characterId, state);
                        return [4 /*yield*/, Promise.all([
                                this.accountService.updateAccount(this.client.accountId, { lastVisit: new Date(), state: this.account.state }),
                                this.accountService.updateCharacterState(this.client.characterId, state),
                                // increment playtime (stored in seconds in counters.playtime)
                                db_1.updateAccount(this.client.accountId, { $inc: (_a = {}, _a['counters.playtime'] = Math.round(duration / 1000), _a) })["catch"](function () { }),
                            ])];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ServerActions.prototype.say = function (entityId, text, chatType) {
        validateNumber(entityId, 'entityId');
        validateString(text, 'text');
        validateNumber(chatType, 'chatType');
        this.updateLastAction();
        if (this.client.isSwitchingMap)
            return;
        var target = entityId ? this.world.getEntityById(entityId) : undefined;
        this.chatSay(this.client, text, chatType, target && target.client, this.getSettings());
    };
    ServerActions.prototype.typing = function (entityId, type, active) {
        validateNumber(entityId, 'entityId');
        validateNumber(type, 'type');
        this.updateLastAction();
        if (this.client.isSwitchingMap)
            return;
        var target = entityId ? this.world.getEntityById(entityId) : undefined;
        var chatType = typingMessageTypeToChatType(type);
        if (chatType !== undefined) {
            this.chatSay(this.client, active ? interfaces_1.typingIndicatorMessage : '.', chatType, target && target.client, this.getSettings());
        }
        else {
            chat_1.sayToOthers(this.client, active ? interfaces_1.typingIndicatorMessage : '.', type, target && target.client, this.getSettings(), true);
        }
    };
    ServerActions.prototype.select = function (entityId, flags) {
        validateNumber(entityId, 'entityId');
        this.updateLastAction();
        if (this.client.isSwitchingMap)
            return;
        var entity = entityId === 0 ? undefined : (this.world.getEntityById(entityId) || this.getEntityFromClients(entityId));
        var mod = this.client.isMod;
        this.client.selected = entity;
        if (entity && entity.client) {
            if (flags) {
                var baseOptions = mod ? { modInfo: accountUtils_2.getModInfo(entity.client) } : {};
                var modalOption = entity.options && ('modal' in entity.options)
                    ? { modal: !!entity.options.modal }
                    : {};
                var options = __assign(__assign(__assign({}, baseOptions), entity.extraOptions), modalOption);
                if (utils_1.hasFlag(flags, 2 /* FetchInfo */)) {
                    var playerState = playerUtils_1.getPlayerState(this.client, entity);
                    var flags_1 = 32 /* Options */ | 256 /* Name */ | 64 /* Info */ | 1024 /* PlayerState */;
                    entityUtils_1.pushUpdateEntityToClient(this.client, { entity: entity, flags: flags_1, options: options, playerState: playerState });
                }
                else if (utils_1.hasFlag(flags, 1 /* FetchEx */) || mod) {
                    entityUtils_1.pushUpdateEntityToClient(this.client, { entity: entity, flags: 32 /* Options */, options: options });
                }
            }
        }
        else if (entityId) {
            this.client.updateSelection(entityId, 0);
        }
    };
    ServerActions.prototype.interact = function (entityId, x, y) {
        validateNumber(entityId, 'entityId');
        validateNumber(x, 'x');
        validateNumber(y, 'y');
        this.updateLastAction();
        if (this.client.isSwitchingMap)
            return;
        playerUtils_1.interactWith(this.client, this.world.getEntityById(entityId), x, y, this.world);
    };
    ServerActions.prototype.use = function () {
        this.updateLastAction();
        if (this.client.isSwitchingMap)
            return;
        playerUtils_1.useHeldItem(this.client);
    };
    ServerActions.prototype.action = function (action) {
        validateNumber(action, 'action');
        this.updateLastAction();
        switch (action) {
            case 21 /* KeepAlive */:
                break;
            case 9 /* UnhideAllHiddenPlayers */:
                this.hiding.requestUnhideAll(this.client);
                break;
            case 43 /* TransformBat */: {
                if (this.client.isSwitchingMap)
                    return;
                var next = !(this.pony.options && this.pony.options.batForm);
                entityUtils_1.updateEntityOptions(this.pony, {
                    batForm: next,
                    speedMultiplier: next ? 0.6 : 1
                });
                entityUtils_1.sendAction(this.pony, 43 /* TransformBat */);
                break;
            }
            default:
                if (this.client.isSwitchingMap)
                    return;
                playerUtils_1.execAction(this.client, action, this.getSettings());
                break;
        }
    };
    ServerActions.prototype.actionParam = function (action, param) {
        var _this = this;
        validateNumber(action, 'action');
        switch (action) {
            case 19 /* CancelSupporterInvite */:
                validateString(param, 'param');
                // TODO: ...
                break;
            case 11 /* SwapCharacter */: {
                validateString(param, 'param');
                this.updateLastAction();
                characterUtils_1.swapCharacter(this.client, this.world, { account: this.client.account._id, _id: param })["catch"](function (e) { return _this.client.reporter.error(e); });
                break;
            }
            case 22 /* RemoveFriend */: {
                validateString(param, 'param');
                this.updateLastAction();
                var target = world_1.findClientByAccountId(this.world, param);
                if (target) {
                    this.friends.remove(this.client, target);
                }
                else {
                    this.friends.removeByAccountId(this.client, param);
                }
                break;
            }
            case 23 /* FriendsCRC */: {
                validateNumber(param, 'param');
                var crc = param >>> 0;
                if (this.client.friendsCRC === undefined) {
                    this.client.friendsCRC = utils_1.computeFriendsCRC(Array.from(this.client.friends.values()));
                }
                if (this.client.friendsCRC !== crc) {
                    db_1.findFriends(this.client.accountId, true)
                        .then(function (friends) {
                        _this.client.updateFriends(friends.map(function (f) {
                            var client = world_1.findClientByAccountId(_this.world, f.accountId);
                            return {
                                accountId: f.accountId,
                                accountName: f.accountName,
                                entityId: client && client.pony.id,
                                status: client ? 1 /* Online */ : 0 /* None */,
                                name: f.name,
                                nameBad: f.nameBad,
                                info: f.pony
                            };
                        }), true);
                    })["catch"](function (e) { return logger_1.logger.error(e); });
                }
                break;
            }
            case 41 /* EditingCharacter */: {
                if (typeof param !== 'boolean') {
                    return;
                }
                this.updateLastAction();
                if (!!this.client.editingCharacter === param) {
                    break;
                }
                this.client.editingCharacter = param;
                playerUtils_1.updateEntityPlayerState(this.client, this.pony);
                for (var _i = 0, _a = this.world.clients; _i < _a.length; _i++) {
                    var other = _a[_i];
                    if (other !== this.client) {
                        playerUtils_1.updateEntityPlayerState(other, this.pony);
                    }
                }
                break;
            }
            case 42 /* Typing */: {
                if (typeof param !== 'boolean') {
                    return;
                }
                this.updateLastAction();
                if (!!this.client.typing === param) {
                    break;
                }
                this.client.typing = param;
                playerUtils_1.updateEntityPlayerState(this.client, this.pony);
                for (var _b = 0, _c = this.world.clients; _b < _c.length; _b++) {
                    var other = _c[_b];
                    if (other !== this.client) {
                        playerUtils_1.updateEntityPlayerState(other, this.pony);
                    }
                }
                break;
            }
            case 39 /* ModalState */: {
                if (typeof param !== 'boolean') {
                    return;
                }
                entityUtils_1.updateEntityOptions(this.pony, { modal: param });
                for (var _d = 0, _e = this.world.clients; _d < _e.length; _d++) {
                    var c = _e[_d];
                    if (c !== this.client && c.selected && c.selected.id === this.pony.id) {
                        entityUtils_1.pushUpdateEntityToClient(c, { entity: this.pony, flags: 32 /* Options */, options: { modal: param } });
                    }
                }
                break;
            }
            case 43 /* TransformBat */: {
                if (this.client.isSwitchingMap)
                    return;
                var next = !(this.pony.options && this.pony.options.batForm);
                entityUtils_1.updateEntityOptions(this.pony, { batForm: next });
                entityUtils_1.sendAction(this.pony, 43 /* TransformBat */);
                break;
            }
            case 28 /* RemoveEntity */: {
                validateNumber(param, 'param');
                this.updateLastAction();
                var entity_1 = this.world.getEntityById(param | 0);
                if (entity_1 && utils_1.hasFlag(entity_1.state, 8 /* Editable */) && this.pony.options.hold === entities.broom.type &&
                    entity_1.type !== entities.poof.type && entity_1.type !== entities.poof2.type &&
                    this.map.regions.some(function (r) { return utils_1.includes(r.entities, entity_1); })) {
                    if (this.isHouseLocked()) {
                        chat_1.saySystem(this.client, "House is locked");
                    }
                    else {
                        this.world.removeEntity(entity_1, this.map);
                    }
                }
                break;
            }
            case 29 /* PlaceEntity */: {
                if (!param || typeof param !== 'object' || typeof param.x !== 'number' || typeof param.y !== 'number' ||
                    typeof param.type !== 'number') {
                    return;
                }
                this.updateLastAction();
                clearToolPreview(this.client, this.world);
                var _f = param, x = _f.x, y = _f.y, type_1 = _f.type;
                var isModEditor = this.server.flags.editor && (this.client.isMod || accountUtils_1.hasRole(this.client.account, 'builder'));
                if (collision_1.isOutsideMap(x, y, this.map) ||
                    (!isModEditor && (!entities.placeableEntities.some(function (x) { return x.type === type_1; }) || !utils_1.hasFlag(this.map.flags, 2 /* EditableEntities */)))) {
                    return chat_1.saySystem(this.client, "Cannot place object");
                }
                if (this.isHouseLocked()) {
                    return chat_1.saySystem(this.client, "House is locked");
                }
                var totalEditableEntities = 0;
                // TODO: optimize
                for (var _g = 0, _h = this.map.regions; _g < _h.length; _g++) {
                    var region = _h[_g];
                    for (var _j = 0, _k = region.entities; _j < _k.length; _j++) {
                        var entity_2 = _k[_j];
                        if (utils_1.hasFlag(entity_2.state, 8 /* Editable */)) {
                            totalEditableEntities++;
                        }
                    }
                }
                if (!isModEditor && totalEditableEntities >= this.map.editableEntityLimit) {
                    return chat_1.saySystem(this.client, "Object limit reached");
                }
                var entity = entities_1.createAnEntity(type_1, 0, x, y, {}, ponyInfo_1.mockPaletteManager, this.world);
                entity.state |= 8 /* Editable */;
                this.world.addEntity(entity, this.map);
                break;
            }
            case 15 /* DropToy */: {
                validateNumber(param, 'param');
                this.updateLastAction();
                var toy = param | 0;
                playerUtils_1.holdToy(this.pony, toy);
                break;
            }
            default:
                throw new Error("Invalid Action (" + action + ")");
        }
    };
    ServerActions.prototype.actionParam2 = function (action, param) {
        validateNumber(action, 'action');
        switch (action) {
            case 20 /* Info */:
                validateNumber(param, 'param');
                this.client.incognito = utils_1.hasFlag(param, 1 /* Incognito */);
                this.client.supportsWasm = utils_1.hasFlag(param, 2 /* SupportsWASM */);
                this.client.supportsLetAndConst = utils_1.hasFlag(param, 4 /* SupportsLetAndConst */);
                break;
            case 24 /* RequestEntityInfo */: {
                validateNumber(param, 'param');
                var entity = this.world.getEntityById(param | 0);
                if (entity && entity.client) {
                    this.client.entityInfo(entity.id, entity.name || '', entity.crc || 0, !!entity.nameBad);
                }
                break;
            }
            default:
                throw new Error("Invalid Action (" + action + ")");
        }
    };
    ServerActions.prototype.getInvites = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, [
                        { id: 'a', info: constants_1.OFFLINE_PONY, name: 'Offline Pony', active: true },
                        { id: 'b', info: constants_1.OFFLINE_PONY, name: 'Fuzzy', active: true },
                        { id: 'c', info: constants_1.OFFLINE_PONY, name: 'Molly', active: false },
                    ]];
            });
        });
    };
    ServerActions.prototype.expression = function (expression) {
        validateNumber(expression, 'expression');
        this.updateLastAction();
        var expr = expressionEncoder_1.decodeExpression(expression);
        var cancellable = !!expr && expressionEncoder_1.isCancellableExpression(expr);
        if (cancellable) {
            playerUtils_1.setEntityExpression(this.pony, expr, 0, true);
        }
        else {
            this.pony.exprPermanent = expr;
            playerUtils_1.setEntityExpression(this.pony, undefined, 0);
        }
    };
    ServerActions.prototype.playerAction = function (entityId, action, param) {
        validateNumber(entityId, 'entityId');
        validateNumber(action, 'action');
        this.updateLastAction();
        var target = this.getClientByEntityId(entityId);
        if (!target) {
            this.client.reporter.warnLog("No client for: " + playerActionNames[action] + " [" + action + "], id: " + entityId);
            return;
        }
        switch (action) {
            case 1 /* Ignore */:
            case 2 /* Unignore */:
                this.ignorePlayer(this.client, target, action === 1 /* Ignore */);
                break;
            case 3 /* InviteToParty */:
                this.partyService.invite(this.client, target);
                break;
            case 4 /* RemoveFromParty */:
                this.partyService.remove(this.client, target);
                break;
            case 10 /* SendItem */:
                this.holdItemService.requestSendItem(this.client, target);
                break;
            case 11 /* TradeItem */:
                this.holdItemService.requestTradeItem(this.client, target);
                break;
            case 12 /* PickUpItem */:
                this.holdItemService.requestPickupItem(this.client, target);
                break;
            case 13 /* SendToy */:
                this.holdItemService.requestSendToy(this.client, target);
                break;
            case 14 /* TradeToy */:
                this.holdItemService.requestTradeToy(this.client, target);
                break;
            case 15 /* PickUpToy */:
                this.holdItemService.requestPickupToy(this.client, target);
                break;
            case 5 /* PromotePartyLeader */:
                this.partyService.promoteLeader(this.client, target);
                break;
            case 6 /* HidePlayer */:
                var hideFor = utils_1.toInt(param);
                if (hideFor === 0) {
                    this.hiding.requestHide(this.client, target, 0);
                }
                else {
                    this.hiding.requestHide(this.client, target, utils_1.clamp(hideFor, constants_1.MIN_HIDE_TIME, constants_1.MAX_HIDE_TIME));
                }
                break;
            case 7 /* InviteToSupporterServers */:
                this.supporterInvites.requestInvite(this.client, target);
                break;
            case 8 /* AddFriend */:
                this.friends.add(this.client, target);
                break;
            case 9 /* RemoveFriend */:
                this.friends.remove(this.client, target);
                break;
            default:
                throw new Error("Invalid player action (" + playerActionNames[action] + ") [" + action + "]");
        }
    };
    ServerActions.prototype.leaveParty = function () {
        this.updateLastAction();
        if (this.client.isSwitchingMap)
            return;
        if (this.client.party) {
            this.partyService.remove(this.client.party.leader, this.client);
        }
    };
    ServerActions.prototype.otherAction = function (entityId, action, param) {
        return __awaiter(this, void 0, void 0, function () {
            var target, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        validateNumber(entityId, 'entityId');
                        validateNumber(action, 'action');
                        validateNumber(param, 'param');
                        this.updateLastAction();
                        target = this.getClientForModAction(entityId, modActionNames[action]);
                        _a = action;
                        switch (_a) {
                            case 1 /* Report */: return [3 /*break*/, 1];
                            case 2 /* Mute */: return [3 /*break*/, 3];
                            case 3 /* Shadow */: return [3 /*break*/, 5];
                            case 5 /* Ban */: return [3 /*break*/, 7];
                            case 4 /* Kick */: return [3 /*break*/, 9];
                        }
                        return [3 /*break*/, 11];
                    case 1: return [4 /*yield*/, this.logModAction(target, 'Reported')];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 12];
                    case 3: return [4 /*yield*/, this.setBan(target, 'mute', param)];
                    case 4:
                        _b.sent();
                        return [3 /*break*/, 12];
                    case 5: return [4 /*yield*/, this.setBan(target, 'shadow', param)];
                    case 6:
                        _b.sent();
                        return [3 /*break*/, 12];
                    case 7: return [4 /*yield*/, this.setBan(target, 'ban', -1)];
                    case 8:
                        _b.sent();
                        return [3 /*break*/, 12];
                    case 9: return [4 /*yield*/, this.world.kick(target, 'mod kick')];
                    case 10:
                        _b.sent();
                        return [3 /*break*/, 12];
                    case 11: throw new Error("Invalid mod action (" + action + ")");
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    ServerActions.prototype.setBan = function (target, field, value) {
        var _a;
        var timeout = value > 0 ? Date.now() + value : value;
        this.logModAction(target, adminUtils_1.banMessage(field, timeout));
        return this.accountService.update(target.accountId, (_a = {}, _a[field] = timeout, _a));
    };
    ServerActions.prototype.setNote = function (entityId, text) {
        return __awaiter(this, void 0, void 0, function () {
            var client;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        validateNumber(entityId, 'entityId');
                        validateString(text, 'text', true);
                        this.updateLastAction();
                        client = this.getClientForModAction(entityId, 'setNote');
                        return [4 /*yield*/, this.accountService.update(client.accountId, { note: text })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ServerActions.prototype.saveSettings = function (settings) {
        return __awaiter(this, void 0, void 0, function () {
            var previousSettings, _i, _a, friend, wasHiddenForFriend, isHiddenForFriend;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.updateLastAction();
                        previousSettings = __assign(__assign({}, this.client.accountSettings), { showAsOfflineFor: __spreadArrays((this.client.accountSettings.showAsOfflineFor || [])) });
                        return [4 /*yield*/, this.accountService.updateSettings(this.account, settings)];
                    case 1:
                        _b.sent();
                        this.client.accountSettings = __assign({}, this.account.settings);
                        this.client.reporter.systemLog("Saved settings");
                        for (_i = 0, _a = world_1.findAllOnlineFriends(this.world, this.client); _i < _a.length; _i++) {
                            friend = _a[_i];
                            wasHiddenForFriend = friends_1.isShownOfflineForAccount(previousSettings, friend.accountId);
                            isHiddenForFriend = friends_1.isShownOfflineForAccount(this.client.accountSettings, friend.accountId);
                            if (wasHiddenForFriend !== isHiddenForFriend) {
                                friend.updateFriends([friends_1.toFriend(this.client, friend)], false);
                                playerUtils_1.updateEntityPlayerState(friend, this.client.pony);
                            }
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    ServerActions.prototype.acceptNotification = function (id) {
        validateNumber(id, 'id');
        this.updateLastAction();
        this.notificationService.acceptNotification(this.client, id);
    };
    ServerActions.prototype.rejectNotification = function (id) {
        validateNumber(id, 'id');
        this.updateLastAction();
        this.notificationService.rejectNotification(this.client, id);
    };
    ServerActions.prototype.getPonies = function (ids) {
        var _this = this;
        var party = this.client.party;
        var createPonyData = function (_a) {
            var pony = _a.pony;
            return [
                pony.id,
                pony.options,
                pony.encodedName,
                pony.encryptedInfoSafe,
                playerUtils_1.getPlayerState(_this.client, pony),
                !!pony.nameBad,
            ];
        };
        if (party && ids && ids.length && ids.length <= constants_1.PARTY_LIMIT) {
            var ponies = party.clients
                .filter(function (c) { return utils_1.includes(ids, c.pony.id); })
                .map(createPonyData);
            this.client.updatePonies(ponies);
        }
    };
    ServerActions.prototype.loaded = function () {
        this.client.loading = false;
    };
    ServerActions.prototype.fixedPosition = function () {
        this.client.fixingPosition = false;
    };
    ServerActions.prototype.updateCamera = function (x, y, width, height) {
        validateNumber(x, 'x');
        validateNumber(y, 'y');
        validateNumber(width, 'width');
        validateNumber(height, 'height');
        this.updateLastAction();
        camera_1.setupCamera(this.client.camera, x, y, width, height, this.client.map);
    };
    ServerActions.prototype.move = function (a, b, c, d, e) {
        validateNumber(a, 'a');
        validateNumber(b, 'b');
        validateNumber(c, 'c');
        validateNumber(d, 'd');
        validateNumber(e, 'e');
        this.updateLastAction();
        this.moveFunc(this.client, Date.now(), a, b, c, d, e, this.getSettings());
    };
    ServerActions.prototype.isHouseLocked = function () {
        return this.map.editingLocked && this.client.party && this.client.party.leader !== this.client;
    };
    ServerActions.prototype.changeTile = function (x, y, type) {
        validateNumber(x, 'x');
        validateNumber(y, 'y');
        validateNumber(type, 'type');
        this.updateLastAction();
        if (this.client.isSwitchingMap)
            return;
        var wallTile = type === 100 /* WallH */ || type === 101 /* WallV */ || type === 104 /* WallHTall */ || type === 105 /* WallVTall */;
        var wallMaterialTile = type === 102 /* WallMaterialWood */ || type === 103 /* WallMaterialStone */;
        var isEditorWallBypass = (this.client.isMod || accountUtils_1.hasRole(this.client.account, 'builder')) && this.client.editorBypassWalls;
        // Аналогичная логика для стен и тайлов
        if ((utils_1.hasFlag(this.map.flags, 1 /* EditableWalls */) && (wallTile || wallMaterialTile)) || (this.server.flags.editor && (this.client.isMod || accountUtils_1.hasRole(this.client.account, 'builder')) && (wallTile || wallMaterialTile)) || (isEditorWallBypass && (wallTile || wallMaterialTile))) {
            if (this.isHouseLocked()) {
                chat_1.saySystem(this.client, "House is locked");
            }
            else {
                if (wallMaterialTile) {
                    this.wallMaterialMap = this.map;
                    this.wallMaterial = type === 103 /* WallMaterialStone */ ? 'stone' : 'wood';
                }
                else {
                    var tallWall = type === 104 /* WallHTall */ || type === 105 /* WallVTall */;
                    var baseWallType = type === 104 /* WallHTall */ ? 100 /* WallH */ : (type === 105 /* WallVTall */ ? 101 /* WallV */ : type);
                    if (tallWall) {
                        this.world.toggleWallWithHeight(this.map, x, y, baseWallType, true, this.getSelectedWallMaterial());
                    }
                    else {
                        this.world.toggleWallWithHeight(this.map, x, y, baseWallType, false, this.getSelectedWallMaterial());
                    }
                }
            }
        }
        else if (utils_1.hasFlag(this.map.flags, 4 /* EditableTiles */) || (this.server.flags.editor && (this.client.isMod || accountUtils_1.hasRole(this.client.account, 'builder')))) {
            // Теперь можно менять любые тайлы, если есть editor-флаг или EditableTiles
            this.world.setTile(this.map, x, y, type);
        }
        else if (BETA && this.client.isMod && interfaces_1.isValidModTile(type)) {
            this.world.setTile(this.map, x, y, type);
        }
        else if (interfaces_1.isValidTile(type)) {
            if ((BETA || utils_1.distanceXY(x, y, this.pony.x, this.pony.y) < constants_1.TILE_CHANGE_RANGE)) {
                var tile = worldMap_1.getTile(this.map, x, y);
                if (tile === 1 /* Dirt */ || tile === 2 /* Grass */) {
                    if (this.client.shadowed) {
                        entityUtils_1.pushUpdateTileToClient(this.client, x, y, type);
                    }
                    else {
                        this.world.setTile(this.map, x, y, type);
                    }
                }
            }
        }
    };
    ServerActions.prototype.leave = function () {
        this.client.leaveReason = 'leave';
        this.client.left(0 /* None */);
    };
    ServerActions.prototype.editorAction = function (action) {
        var _this = this;
        var isModEditor = this.server.flags.editor && (this.client.isMod || (this.client.account && accountUtils_1.hasRole(this.client.account, 'builder')));
        if (action.type === 'place' || action.type === 'remove' || action.type === 'move' || action.type === 'tile') {
            console.log("[EDITOR] User: " + (this.client.accountName || this.client.accountId) + ", Action: " + action.type + ", isMod: " + this.client.isMod + ", roles: " + ((this.client.account && this.client.account.roles) || 'NO_ROLES') + ", isModEditor: " + isModEditor);
        }
        var isPlayerRopeMove = action.type === 'move' &&
            !action.preview &&
            utils_1.hasFlag(this.map.flags, 2 /* EditableEntities */) &&
            (this.pony.options.hold === entities.rope.type || this.pony.options.hold === entities.hammer.type);
        if (!isModEditor && !isPlayerRopeMove) {
            return;
        }
        if (!isModEditor && action.type === 'move') {
            if (this.isHouseLocked() || !Array.isArray(action.entities)) {
                return;
            }
            var _loop_1 = function (id, x, y) {
                var entity = this_1.world.getEntityById(id);
                if (entity &&
                    entity.type !== constants_1.PONY_TYPE &&
                    utils_1.hasFlag(entity.state, 8 /* Editable */) &&
                    this_1.map.regions.some(function (r) { return utils_1.includes(r.entities, entity); })) {
                    entity.x = x;
                    entity.y = y;
                    entity.coverLifting = 0;
                    entity.selected = false;
                    entityUtils_1.updateEntity(entity, false);
                    regionUtils_1.updateRegion(entity, this_1.client.map);
                    regionUtils_1.getExpectedRegion(entity, this_1.client.map).colliderDirty = true;
                }
            };
            var this_1 = this;
            for (var _i = 0, _a = action.entities; _i < _a.length; _i++) {
                var _b = _a[_i], id = _b.id, x = _b.x, y = _b.y;
                _loop_1(id, x, y);
            }
            return;
        }
        if (isModEditor) {
            var added = editorAdded.get(this.client.accountId) || [];
            editorAdded.set(this.client.accountId, added);
            switch (action.type) {
                case 'place':
                    if (action.preview === false) {
                        clearToolPreview(this.client, this.world);
                        break;
                    }
                    if (action.preview) {
                        if (typeof action.entityType === 'number' || utils_1.includes(account_1.allEntities, action.entity)) {
                            var created = (typeof action.entityType === 'number')
                                ? entities_1.createAnEntity(action.entityType, 0, action.x, action.y, {}, ponyInfo_1.mockPaletteManager, this.world)
                                : entities[action.entity](action.x, action.y);
                            var preview = Array.isArray(created) ? created[0] : created;
                            if (preview) {
                                clearToolPreview(this.client, this.world);
                                preview.flags &= ~128 /* CanCollideWith */;
                                preview.colliders = undefined;
                                preview.selected = true;
                                preview.coverLifting = 0.85;
                                this.client.toolPreviewEntity = this.world.addEntity(preview, this.map);
                            }
                        }
                        break;
                    }
                    clearToolPreview(this.client, this.world);
                    if (utils_1.includes(account_1.allEntities, action.entity)) {
                        var name = action.entity;
                        var entity = entities[name](action.x, action.y);
                        var toAdd = Array.isArray(entity) ? entity : [entity];
                        toAdd.forEach(function (e) { return _this.world.addEntity(e, _this.map); });
                        added.push({ name: name, entities: toAdd });
                    }
                    else {
                        chat_1.saySystem(this.client, 'Invalid entity');
                    }
                    break;
                case 'move':
                    if (action.preview) {
                        for (var _c = 0, _d = action.entities; _c < _d.length; _c++) {
                            var _e = _d[_c], id = _e.id, x = _e.x, y = _e.y;
                            var entity = this.world.getEntityById(id);
                            if (entity && entity.type !== constants_1.PONY_TYPE) {
                                entity.x = x;
                                entity.y = y;
                                entity.coverLifting = 0.85;
                                entityUtils_1.updateEntity(entity, false);
                                regionUtils_1.updateRegion(entity, this.client.map);
                                regionUtils_1.getExpectedRegion(entity, this.client.map).colliderDirty = true;
                            }
                        }
                        break;
                    }
                    for (var _f = 0, _g = action.entities; _f < _g.length; _f++) {
                        var _h = _g[_f], id = _h.id, x = _h.x, y = _h.y;
                        var entity = this.world.getEntityById(id);
                        if (entity && entity.type !== constants_1.PONY_TYPE) {
                            entity.x = x;
                            entity.y = y;
                            entity.coverLifting = 0;
                            entity.selected = false;
                            entityUtils_1.updateEntity(entity, false);
                            regionUtils_1.updateRegion(entity, this.client.map);
                            regionUtils_1.getExpectedRegion(entity, this.client.map).colliderDirty = true;
                        }
                    }
                    break;
                case 'hover': {
                    var hoverEntity = this.world.getEntityById(action.entityId);
                    if (hoverEntity && hoverEntity.type !== constants_1.PONY_TYPE) {
                        if (this.client.toolHoverEntity && this.client.toolHoverEntity !== hoverEntity) {
                            this.client.toolHoverEntity.selected = false;
                            this.client.toolHoverEntity.coverLifting = 0;
                            entityUtils_1.updateEntity(this.client.toolHoverEntity, false);
                        }
                        hoverEntity.selected = !!action.active;
                        hoverEntity.coverLifting = action.active ? 0.35 : 0;
                        this.client.toolHoverEntity = action.active ? hoverEntity : undefined;
                        entityUtils_1.updateEntity(hoverEntity, false);
                    }
                    break;
                }
                case 'undo':
                    var remove = added.pop();
                    remove && remove.entities.forEach(function (e) { return _this.world.removeEntityFromSomeMap(e); });
                    break;
                case 'clear':
                    added.forEach(function (x) { return x.entities.forEach(function (e) { return _this.world.removeEntityFromSomeMap(e); }); });
                    added.length = 0;
                    break;
                case 'list':
                    var existingEntities = added
                        .filter(function (_a) {
                        var entities = _a.entities;
                        return entities.some(function (e) { return !!_this.world.getEntityById(e.id); });
                    })
                        .map(function (_a) {
                        var name = _a.name, _b = _a.entities[0], x = _b.x, y = _b.y;
                        return ({ name: name, x: x, y: y });
                    });
                    this.client.entityList(existingEntities);
                    break;
                case 'remove':
                    for (var _j = 0, _k = action.entities; _j < _k.length; _j++) {
                        var id = _k[_j];
                        var entity = this.world.getEntityById(id);
                        if (entity && entity.type !== constants_1.PONY_TYPE) {
                            this.world.removeEntityFromSomeMap(entity);
                        }
                    }
                    break;
                case 'tile': {
                    var x = action.x, y = action.y, tile = action.tile, size = action.size;
                    if (interfaces_1.isValidModTile(tile)) {
                        for (var iy = 0; iy < size; iy++) {
                            for (var ix = 0; ix < size; ix++) {
                                this.world.setTile(this.map, x + ix, y + iy, tile);
                            }
                        }
                    }
                    break;
                }
                case 'party': {
                    var entities_2 = serverMap_1.findEntities(this.map, function (e) { return !!e.client && /^debug/.test(e.name || ''); });
                    for (var _l = 0, _m = entities_2.slice(0, constants_1.PARTY_LIMIT - 1); _l < _m.length; _l++) {
                        var e = _m[_l];
                        this.partyService.invite(this.client, e.client);
                    }
                    break;
                }
                default:
                    throw new Error("Invalid editor action (" + action + ")");
            }
        }
    };
    ServerActions.prototype.logModAction = function (client, title) {
        client.reporter.system(title + " by " + this.account.name);
    };
    ServerActions.prototype.getClientForModAction = function (entityId, action) {
        if (!this.client.isMod) {
            this.client.disconnect(true, true);
            throw new Error("Action not allowed (" + action + ")");
        }
        var client = this.world.getClientByEntityId(entityId);
        if (!client) {
            throw new Error("Client does not exist (" + action + ")");
        }
        if (client.accountId === this.client.accountId) {
            throw new Error("Cannot perform action on self (" + action + ")");
        }
        return client;
    };
    ServerActions.prototype.getEntityFromClients = function (entityId) {
        var client = this.getClientByEntityId(entityId);
        return client && client.pony;
    };
    ServerActions.prototype.getClientByEntityId = function (entityId) {
        return this.world.getClientByEntityId(entityId) || this.findClientByEntityId(this.client, entityId);
    };
    ServerActions.prototype.updateLastAction = function () {
        this.client.lastPacket = Date.now();
    };
    __decorate([
        ag_sockets_1.Method({ rateLimit: '2/s', binary: [ag_sockets_1.Bin.U32, ag_sockets_1.Bin.Str, ag_sockets_1.Bin.U8] })
    ], ServerActions.prototype, "say");
    __decorate([
        ag_sockets_1.Method({ rateLimit: '6/s', binary: [ag_sockets_1.Bin.U32, ag_sockets_1.Bin.U8, ag_sockets_1.Bin.Bool] })
    ], ServerActions.prototype, "typing");
    __decorate([
        ag_sockets_1.Method({ rateLimit: '3/s', binary: [ag_sockets_1.Bin.U32, ag_sockets_1.Bin.U8] })
    ], ServerActions.prototype, "select");
    __decorate([
        ag_sockets_1.Method({ rateLimit: '10/s', serverRateLimit: '20/s', binary: [ag_sockets_1.Bin.U32, ag_sockets_1.Bin.F32, ag_sockets_1.Bin.F32] })
    ], ServerActions.prototype, "interact");
    __decorate([
        ag_sockets_1.Method({ rateLimit: '2/s', binary: [] })
    ], ServerActions.prototype, "use");
    __decorate([
        ag_sockets_1.Method({ rateLimit: '3/s', serverRateLimit: '8/s', binary: [ag_sockets_1.Bin.U8] })
    ], ServerActions.prototype, "action");
    __decorate([
        ag_sockets_1.Method({ rateLimit: '2/s', serverRateLimit: '4/s', binary: [ag_sockets_1.Bin.U8, ag_sockets_1.Bin.Obj] })
    ], ServerActions.prototype, "actionParam");
    __decorate([
        ag_sockets_1.Method({ rateLimit: '10/s', serverRateLimit: '20/s', binary: [ag_sockets_1.Bin.U8, ag_sockets_1.Bin.Obj] })
    ], ServerActions.prototype, "actionParam2");
    __decorate([
        ag_sockets_1.Method({ promise: true, rateLimit: '1/s', binary: [] })
    ], ServerActions.prototype, "getInvites");
    __decorate([
        ag_sockets_1.Method({ rateLimit: '2/s', serverRateLimit: '4/s', binary: [ag_sockets_1.Bin.U32] })
    ], ServerActions.prototype, "expression");
    __decorate([
        ag_sockets_1.Method({ rateLimit: '3/s', binary: [ag_sockets_1.Bin.U32, ag_sockets_1.Bin.U8, ag_sockets_1.Bin.Obj] })
    ], ServerActions.prototype, "playerAction");
    __decorate([
        ag_sockets_1.Method({ rateLimit: '1/s', binary: [] })
    ], ServerActions.prototype, "leaveParty");
    __decorate([
        ag_sockets_1.Method({ promise: true, rateLimit: '10/s', binary: [ag_sockets_1.Bin.U32, ag_sockets_1.Bin.U8, ag_sockets_1.Bin.I32] })
    ], ServerActions.prototype, "otherAction");
    __decorate([
        ag_sockets_1.Method({ promise: true, binary: [ag_sockets_1.Bin.U32, ag_sockets_1.Bin.Str] })
    ], ServerActions.prototype, "setNote");
    __decorate([
        ag_sockets_1.Method({ rateLimit: '5/s', binary: [ag_sockets_1.Bin.Obj] })
    ], ServerActions.prototype, "saveSettings");
    __decorate([
        ag_sockets_1.Method({ binary: [ag_sockets_1.Bin.U16] })
    ], ServerActions.prototype, "acceptNotification");
    __decorate([
        ag_sockets_1.Method({ binary: [ag_sockets_1.Bin.U16] })
    ], ServerActions.prototype, "rejectNotification");
    __decorate([
        ag_sockets_1.Method({ binary: [[ag_sockets_1.Bin.U32]] })
    ], ServerActions.prototype, "getPonies");
    __decorate([
        ag_sockets_1.Method({ binary: [] })
    ], ServerActions.prototype, "loaded");
    __decorate([
        ag_sockets_1.Method({ binary: [] })
    ], ServerActions.prototype, "fixedPosition");
    __decorate([
        ag_sockets_1.Method({ binary: [ag_sockets_1.Bin.U32, ag_sockets_1.Bin.U32, ag_sockets_1.Bin.U16, ag_sockets_1.Bin.U16] })
    ], ServerActions.prototype, "updateCamera");
    __decorate([
        ag_sockets_1.Method({ binary: [ag_sockets_1.Bin.U32, ag_sockets_1.Bin.U32, ag_sockets_1.Bin.U32, ag_sockets_1.Bin.U32, ag_sockets_1.Bin.U16] })
    ], ServerActions.prototype, "move");
    __decorate([
        ag_sockets_1.Method({ rateLimit: debugRate || '3/s', serverRateLimit: debugRate || '7/s', binary: [ag_sockets_1.Bin.U16, ag_sockets_1.Bin.U16, ag_sockets_1.Bin.U8] })
    ], ServerActions.prototype, "changeTile");
    __decorate([
        ag_sockets_1.Method({ rateLimit: '1/s', binary: [] })
    ], ServerActions.prototype, "leave");
    __decorate([
        ag_sockets_1.Method({ binary: [ag_sockets_1.Bin.Obj] })
    ], ServerActions.prototype, "editorAction");
    ServerActions = __decorate([
        ag_sockets_1.Socket({
            id: 'game',
            debug: false,
            connectionTokens: true,
            pingInterval: 3000,
            connectionTimeout: 10000,
            reconnectTimeout: 500,
            transferLimit: 4000,
            perMessageDeflate: false,
            keepOriginalRequest: true
        })
    ], ServerActions);
    return ServerActions;
}());
exports.ServerActions = ServerActions;
function validateNumber(value, fieldName) {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
        throw new Error("Not a number (" + fieldName + ")");
    }
}
function validateString(value, fieldName, allowNull) {
    if (allowNull === void 0) { allowNull = false; }
    if (typeof value !== 'string' && !(allowNull && value === null)) {
        throw new Error("Not a string (" + fieldName + ")");
    }
}
if (DEVELOPMENT) {
    /* istanbul ignore next */
    ag_sockets_1.getMethods(ServerActions)
        .forEach(function (m) { return m.options.binary || console.error("Missing binary encoding for ServerActions." + m.name + "()"); });
}
