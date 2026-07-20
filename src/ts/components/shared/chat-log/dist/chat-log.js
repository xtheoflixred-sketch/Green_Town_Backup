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
exports.__esModule = true;
exports.ChatLog = exports.updateChatLogLine = exports.createChatLogLineDOM = void 0;
var core_1 = require("@angular/core");
var lodash_1 = require("lodash");
var interfaces_1 = require("../../../common/interfaces");
var htmlUtils_1 = require("../../../client/htmlUtils");
var constants_1 = require("../../../common/constants");
var icons_1 = require("../../../client/icons");
var fontawesome_svg_core_1 = require("@fortawesome/fontawesome-svg-core");
var tags_1 = require("../../../common/tags");
var colors_1 = require("../../../common/colors");
var debugData_1 = require("../../../common/debugData");
var worldMap_1 = require("../../../common/worldMap");
var entityUtils_1 = require("../../../common/entityUtils");
var color_1 = require("../../../common/color");
var moment = require("moment");
var data_1 = require("../../../client/data");
var rubber_panel_controller_1 = require("../shared-physics/rubber-panel-controller");
var GENERAL_CHAT_LIMIT = 100;
var PARTY_CHAT_LIMIT = 100;
var WHISPER_CHAT_LIMIT = 100;
var FORGET_INDEX_AFTER = 1000;
var SCROLL_END_THRESHOLD = 60;
var CHATLOG_FILTER_BOX_WIDTH = 80;
var CHATLOG_MIN_WIDTH = 200 + CHATLOG_FILTER_BOX_WIDTH;
var CHATLOG_DEFAULT_WIDTH = 500;
var CHATLOG_MIN_HEIGHT = 120;
var CHATLOG_DEFAULT_HEIGHT = 310;
var CHATLOG_MAX_SIZE = 2000;
var LABELS = [];
LABELS[1 /* System */] = 'system';
LABELS[2 /* Admin */] = 'admin';
LABELS[3 /* Mod */] = 'mod';
LABELS[4 /* Party */] = 'party';
LABELS[6 /* PartyThinking */] = 'party';
LABELS[8 /* PartyAnnouncement */] = 'party';
LABELS[13 /* Whisper */] = 'whisper';
LABELS[15 /* WhisperAnnouncement */] = 'whisper';
LABELS[14 /* WhisperTo */] = 'whisper';
LABELS[16 /* WhisperToAnnouncement */] = 'whisper';
LABELS[17 /* Builder */] = 'builder';
LABELS[18 /* NPC */] = 'npc';
var PREFIXES = [];
PREFIXES[14 /* WhisperTo */] = 'To ';
PREFIXES[16 /* WhisperToAnnouncement */] = 'To ';
var SUFFIXES = [];
SUFFIXES[5 /* Thinking */] = 'thinks';
SUFFIXES[6 /* PartyThinking */] = 'thinks';
SUFFIXES[13 /* Whisper */] = 'whispers';
SUFFIXES[15 /* WhisperAnnouncement */] = 'whispers';
var CLASSES = [];
CLASSES[1 /* System */] = 'chat-line-system';
CLASSES[2 /* Admin */] = 'chat-line-admin';
CLASSES[3 /* Mod */] = 'chat-line-mod';
CLASSES[4 /* Party */] = 'chat-line-party';
CLASSES[5 /* Thinking */] = 'chat-line-thinking';
CLASSES[6 /* PartyThinking */] = 'chat-line-party-thinking';
CLASSES[7 /* Announcement */] = 'chat-line-announcement';
CLASSES[8 /* PartyAnnouncement */] = 'chat-line-party-announcement';
CLASSES[9 /* Supporter1 */] = 'chat-line-supporter-1';
CLASSES[10 /* Supporter2 */] = 'chat-line-supporter-2';
CLASSES[11 /* Supporter3 */] = 'chat-line-supporter-3';
CLASSES[12 /* Supporter4 */] = 'chat-line-supporter-4';
CLASSES[13 /* Whisper */] = 'chat-line-whisper';
CLASSES[14 /* WhisperTo */] = 'chat-line-whisper';
CLASSES[15 /* WhisperAnnouncement */] = 'chat-line-whisper-announcement';
CLASSES[16 /* WhisperToAnnouncement */] = 'chat-line-whisper-announcement';
CLASSES[17 /* Builder */] = 'chat-line-builder';
CLASSES[18 /* NPC */] = 'chat-line-npc';
function createChatLogLineDOM(clickLabel, clickName) {
    var line = {};
    line.root = htmlUtils_1.element('div', 'chat-line', [
        htmlUtils_1.element('span', 'chat-line-lead'),
        line.time = htmlUtils_1.element('span', 'chat-line-name', [
            line.timeContent = htmlUtils_1.element('span', 'chat-line-time-content', [htmlUtils_1.textNode('')], undefined),
            line.index = htmlUtils_1.element('span', 'chat-line-time-index', [line.indexText = htmlUtils_1.textNode('')]),
        ]),
        line.label = htmlUtils_1.element('span', 'chat-line-label mr-1', [
            htmlUtils_1.textNode('['),
            line.labelIcon = htmlUtils_1.element('span', 'chat-line-label-icon'),
            line.labelText = htmlUtils_1.textNode(''),
            htmlUtils_1.textNode(']'),
        ], undefined, { click: function () { return clickLabel(line.entry); } }),
        line.prefixText = htmlUtils_1.textNode(''),
        line.name = htmlUtils_1.element('span', 'chat-line-name', [
            line.supporterIcon = htmlUtils_1.element('span', 'chat-line-supporter-icon'),
            htmlUtils_1.textNode('['),
            line.nameContent = htmlUtils_1.element('span', 'chat-line-name-content', [htmlUtils_1.textNode('')], undefined, { click: function () { return clickName(line.entry); } }),
            line.index = htmlUtils_1.element('span', 'chat-line-name-index', [line.indexText = htmlUtils_1.textNode('')], { title: 'duplicate name' }),
            htmlUtils_1.textNode(']'),
        ]),
        line.suffixText = htmlUtils_1.textNode(''),
        line.message = htmlUtils_1.element('span', 'chat-line-message', [htmlUtils_1.textNode('')]),
    ]);
    return line;
}
exports.createChatLogLineDOM = createChatLogLineDOM;
function updateChatLogLine(line, entry, hourMode) {
    var classes = entry.classes, label = entry.label, message = entry.message, prefix = entry.prefix, suffix = entry.suffix;
    var hasSpace = message.indexOf(' ') !== -1;
    line.entry = entry;
    line.root.className = ("chat-line " + (hasSpace ? '' : 'chat-line-break ') + classes).trim();
    line.label.style.display = label ? 'inline' : 'none';
    if (label) {
        var icons = [];
        var labelText = '';
        var labelTooltip = '';
        if (label === 'admin') {
            var tag = tags_1.getTag('dev');
            if (tag && tag.icon) {
                icons.push(tag.icon);
            }
            labelText = ' Admin';
            labelTooltip = 'admin';
        }
        else if (label === 'mod') {
            var tag = tags_1.getTag('mod');
            if (tag && tag.icon) {
                icons.push(tag.icon);
            }
            labelText = ' Mod';
            labelTooltip = 'moderator';
        }
        else if (label === 'party') {
            icons.push(icons_1.faUsers);
            labelText = ' Party';
            labelTooltip = 'party';
        }
        else if (label === 'whisper') {
            icons.push(icons_1.faComment);
            labelText = ' Whisper';
            labelTooltip = 'whisper';
        }
        else if (label === 'builder') {
            var tag = tags_1.getTag('builder');
            if (tag && tag.icon) {
                icons.push(tag.icon);
            }
            labelText = ' Builder';
            labelTooltip = 'map builder';
        }
        else if (label === 'npc') {
            var tag = tags_1.getTag('npc');
            if (tag && tag.icon) {
                icons.push(tag.icon);
            }
            labelText = ' NPC';
            labelTooltip = 'npc';
        }
        else {
            var tag = tags_1.getTag(label);
            if (tag && tag.icon) {
                icons.push(tag.icon);
            }
            labelTooltip = tags_1.getTagTooltipById(label) || label;
        }
        htmlUtils_1.removeAllNodes(line.labelIcon);
        if (icons.length > 0) {
            var created = false;
            for (var _i = 0, icons_2 = icons; _i < icons_2.length; _i++) {
                var iconDefinition = icons_2[_i];
                if (!iconDefinition)
                    continue;
                var iconElement = createChatLogLabelIcon(iconDefinition);
                if (iconElement) {
                    line.labelIcon.appendChild(iconElement);
                    created = true;
                }
            }
            if (created) {
                line.labelIcon.style.display = 'inline-flex';
                line.labelText.nodeValue = labelText;
            }
            else {
                line.labelIcon.style.display = 'none';
                line.labelText.nodeValue = label;
            }
        }
        else {
            line.labelIcon.style.display = 'none';
            line.labelText.nodeValue = label;
        }
        line.label.title = labelTooltip || label;
    }
    else {
        line.labelIcon.style.display = 'none';
        htmlUtils_1.removeAllNodes(line.labelIcon);
        line.labelText.nodeValue = '';
        line.label.title = '';
    }
    var isSupporter = classes && (classes.includes('chat-line-supporter-1') ||
        classes.includes('chat-line-supporter-2') ||
        classes.includes('chat-line-supporter-3') ||
        classes.includes('chat-line-supporter-4'));
    if (isSupporter && classes) {
        var supporterLevel = '';
        if (classes.includes('chat-line-supporter-1'))
            supporterLevel = 'sup1';
        else if (classes.includes('chat-line-supporter-2'))
            supporterLevel = 'sup2';
        else if (classes.includes('chat-line-supporter-3'))
            supporterLevel = 'sup3';
        else if (classes.includes('chat-line-supporter-4'))
            supporterLevel = 'sup4';
        if (supporterLevel) {
            line.supporterIcon.title = tags_1.getTagTooltipById(supporterLevel) || '';
            var tag = tags_1.getTag(supporterLevel);
            if (tag && tag.icon) {
                htmlUtils_1.removeAllNodes(line.supporterIcon);
                var iconElement = createChatLogLabelIcon(tag.icon);
                if (iconElement) {
                    line.supporterIcon.style.display = 'inline-flex';
                    var color = void 0;
                    switch (supporterLevel) {
                        case 'sup1':
                            color = colors_1.SUPPORTER1_COLOR;
                            break;
                        case 'sup2':
                            color = colors_1.SUPPORTER2_COLOR;
                            break;
                        case 'sup3':
                            color = colors_1.SUPPORTER3_COLOR;
                            break;
                        case 'sup4':
                            color = colors_1.SUPPORTER4_COLOR;
                            break;
                        default:
                            color = colors_1.WHITE;
                            break;
                    }
                    iconElement.style.color = '#' + color.toString(16).padStart(8, '0').slice(0, 6).toUpperCase();
                    line.supporterIcon.appendChild(iconElement);
                }
                else {
                    line.supporterIcon.style.display = 'none';
                }
            }
            else {
                line.supporterIcon.style.display = 'none';
                htmlUtils_1.removeAllNodes(line.supporterIcon);
            }
        }
        else {
            line.supporterIcon.style.display = 'none';
            htmlUtils_1.removeAllNodes(line.supporterIcon);
            line.supporterIcon.title = '';
        }
    }
    else {
        line.supporterIcon.style.display = 'none';
        htmlUtils_1.removeAllNodes(line.supporterIcon);
        line.supporterIcon.title = '';
    }
    updateChatLogName(line, entry);
    updateTime(line, hourMode);
    line.prefixText.nodeValue = prefix || '';
    line.suffixText.nodeValue = suffix ? " " + suffix + ": " : ': ';
    htmlUtils_1.replaceNodes(line.message, message);
}
exports.updateChatLogLine = updateChatLogLine;
function createChatLogLabelIcon(iconDefinition) {
    try {
        var rendered = fontawesome_svg_core_1.icon(iconDefinition);
        if (rendered && rendered.node && rendered.node[0]) {
            return rendered.node[0];
        }
    }
    catch (err) {
        // ignore icon render failures and fall back to text label
    }
    return undefined;
}
function updateTime(line, hourMode) {
    var momentFn = moment["default"] || moment;
    line.time.style.display = 'inline';
    if (!hourMode)
        return;
    if (hourMode === '24')
        htmlUtils_1.replaceNodes(line.timeContent, "[" + momentFn().format('HH:mm:ss') + "] ");
    if (hourMode === '12')
        htmlUtils_1.replaceNodes(line.timeContent, "[" + momentFn().format('LTS') + "] ");
}
function setNameColors(line, colors) {
    if (!colors || !line)
        return;
    if (colors[1])
        line.name.style.color = colors[1];
    if (colors[0])
        line.nameContent.style.color = colors[0];
}
function updateChatLogName(line, _a) {
    var name = _a.name, index = _a.index;
    if (name) {
        line.name.style.display = 'inline';
        htmlUtils_1.replaceNodes(line.nameContent, name);
        line.index.style.display = (index > 0) ? 'inline' : 'none';
        line.indexText.nodeValue = (index > 0) ? " #" + (index + 1) : '';
    }
    else {
        line.name.style.display = 'none';
    }
}
function isMatch(e, id, name, crc) {
    return e.name === name && (e.entityId === id || (e.crc === crc && crc !== undefined));
}
function addOrUpdatePony(pony, list) {
    for (var _i = 0, list_1 = list; _i < list_1.length; _i++) {
        var e = list_1[_i];
        if (isMatch(e, pony.id, pony.name, pony.crc)) {
            e.entityId = pony.id;
        }
    }
}
function updateEntityId(list, oldId, newId) {
    for (var _i = 0, list_2 = list; _i < list_2.length; _i++) {
        var e = list_2[_i];
        if (e.entityId === oldId) {
            e.entityId = newId;
        }
    }
}
function findUserIndex(users, id, crc) {
    for (var i = 0; i < users.length; i++) {
        var user = users[i];
        if (user.id === id || (crc !== undefined && user.crc === crc)) {
            user.id = id;
            return i;
        }
    }
    return -1;
}
var ChatLog = /** @class */ (function () {
    function ChatLog(game, settingsService, element, zone) {
        var _this = this;
        this.game = game;
        this.settingsService = settingsService;
        this.element = element;
        this.zone = zone;
        this.toBottomIcon = icons_1.faArrowDown;
        this.resizeIcon = icons_1.faCaretUp;
        this.searchIcon = icons_1.faSearch;
        this.toggleType = new core_1.EventEmitter();
        this.nameClick = new core_1.EventEmitter();
        this.innerWidth = 0;
        this.renderedOpen = false;
        // TODO: move to game ?
        this.local = [];
        this.party = [];
        this.personal = [];
        this.whisper = [];
        this.filterColor = this.inactiveBg;
        this.unread = 0;
        this.subscriptions = [];
        this.shouldScrollToEnd = false;
        this.scrolledToEnd = true;
        this.scrollingToEnd = false;
        this.scrollToEndAtFrame = false;
        this.indexes = new Map();
        this.messageCounter = 0;
        this.lastOpacity = 0;
        this.panelWidth = CHATLOG_DEFAULT_WIDTH;
        this.panelHeight = CHATLOG_DEFAULT_HEIGHT;
        this.panelMinWidth = CHATLOG_MIN_WIDTH;
        this.panelMinHeight = CHATLOG_MIN_HEIGHT;
        this.physicsOffsetX = 0;
        this.physicsOffsetY = 0;
        this.physicsStretchX = 1;
        this.physicsStretchY = 1;
        this.isOverLimit = false;
        this.applyPanelState = function (state) {
            _this.panelWidth = state.width;
            _this.panelHeight = state.height;
            _this.panelMinWidth = state.minWidth;
            _this.panelMinHeight = state.minHeight;
            _this.physicsOffsetX = state.contentOffsetX;
            _this.physicsOffsetY = state.contentOffsetY;
            _this.physicsStretchX = state.contentStretchX;
            _this.physicsStretchY = state.contentStretchY;
            _this.isOverLimit = state.isOverLimit;
            _this.updateChatlog();
            if (_this.renderedOpen) {
                _this.updateInnerWidth();
            }
        };
        this.panelController = new rubber_panel_controller_1.RubberPanelController({
            width: { min: CHATLOG_MIN_WIDTH, max: CHATLOG_MAX_SIZE, defaultValue: CHATLOG_DEFAULT_WIDTH },
            height: { min: CHATLOG_MIN_HEIGHT, max: CHATLOG_MAX_SIZE, defaultValue: CHATLOG_DEFAULT_HEIGHT },
            resizeEdges: rubber_panel_controller_1.rubberPanelResizeEdgesFromCorner('top-right'),
            tuning: {
                rubberBandFactor: 0.24,
                dragElasticity: 0,
                dragRangeForceFactor: 0,
                physicsSmoothing: 0.28,
                dragPhysicsFactor: 4,
                dragReleaseFactor: 8,
                releaseVelocityFactor: 0.22,
                forceScale: 0.09,
                forceClamp: 14,
                stretchMajorScale: 0.00115,
                stretchMinorScale: 0.0004,
                stretchMin: 0.95,
                stretchMax: 1.07
            },
            onUpdate: this.applyPanelState
        });
        this.scrollHandler = function () {
            _this.scrollingToEnd = true;
            _this.scroll.nativeElement.scrollTop = 99999;
        };
        this.clickNameHandler = function (message) {
            _this.zone.run(function () { return _this.nameClick.emit(message); });
        };
        this.clickLabel = function (message) {
            _this.zone.run(function () {
                if (message.label) {
                    _this.toggleType.emit(message.label);
                }
            });
        };
        this.findEntityFromMessages = function (id) {
            return findEntityFromMessages(id, _this.whisper) ||
                findEntityFromMessages(id, _this.party) ||
                findEntityFromMessages(id, _this.local);
        };
        this.findEntityFromMessagesByName = function (name) {
            return findEntityFromMessagesByName(name, _this.game.playerId, _this.whisper) ||
                findEntityFromMessagesByName(name, _this.game.playerId, _this.party) ||
                findEntityFromMessagesByName(name, _this.game.playerId, _this.local);
        };
        // TODO: just put reference to chatlog on game ???
        this.subscriptions.push(game.onFrame.subscribe(function () {
            if (_this.scrollToEndAtFrame) {
                _this.scrollToEndAtFrame = false;
                _this.scrollHandler();
            }
        }), game.onMessage.subscribe(function (message) {
            _this.addMessage(message);
        }), 
        // TODO: move to game ?
        game.onPonyAddOrUpdate.subscribe(function (pony) {
            addOrUpdatePony(pony, _this.local);
            addOrUpdatePony(pony, _this.party);
            addOrUpdatePony(pony, _this.whisper);
        }), game.onJoined.subscribe(function () {
            if (!DEVELOPMENT) {
                // TODO: move to game ?
                _this.local = [];
                _this.party = [];
                _this.whisper = [];
                _this.messageCounter = 0;
                _this.indexes = new Map();
                _this.clearList();
            }
        }), game.onEntityIdUpdate.subscribe(function (update) {
            updateEntityId(_this.local, update.old, update["new"]);
            updateEntityId(_this.party, update.old, update["new"]);
            updateEntityId(_this.whisper, update.old, update["new"]);
        }), this.game.onSearch.subscribe(function () {
            _this.focus();
        }));
    }
    Object.defineProperty(ChatLog.prototype, "linesElement", {
        get: function () {
            return this.lines.nativeElement;
        },
        enumerable: false,
        configurable: true
    });
    ChatLog.prototype.updateOpen = function () {
        if (this.open) {
            this.renderedOpen = true;
            this.panelController.sync(this.getTargetOpenLayout());
            this.updateChatlog();
            this.setUnread(0);
            this.regenerateList();
            this.scrollToEnd();
        }
        else {
            this.renderedOpen = false;
            this.updateChatlog();
            this.clearList();
        }
        this.updateInnerWidth();
    };
    ChatLog.prototype.animateOpen = function () {
        this.renderedOpen = true;
        this.updateChatlog();
        this.setUnread(0);
        this.regenerateList();
        this.scrollToEnd();
        this.panelController.open(this.getTargetOpenLayout());
        this.updateInnerWidth();
    };
    ChatLog.prototype.animateClose = function () {
        var _this = this;
        if (!this.renderedOpen) {
            this.updateChatlog();
            return;
        }
        this.panelController.close(this.readChatLogLayout(), function () {
            _this.renderedOpen = false;
            _this.updateChatlog();
            _this.clearList();
        });
    };
    ChatLog.prototype.updateChatlog = function () {
        if (!this.chatLog) {
            return;
        }
        var element = this.chatLog.nativeElement;
        element.style.display = this.renderedOpen ? 'flex' : 'none';
        element.classList.toggle('chat-log-over-limit', this.isOverLimit);
        element.style.setProperty('--chat-log-physics-offset-x', this.physicsOffsetX + "px");
        element.style.setProperty('--chat-log-physics-offset-y', this.physicsOffsetY + "px");
        element.style.setProperty('--chat-log-physics-stretch-x', "" + this.physicsStretchX);
        element.style.setProperty('--chat-log-physics-stretch-y', "" + this.physicsStretchY);
        if (this.renderedOpen) {
            element.style.width = this.panelWidth + "px";
            element.style.height = this.panelHeight + "px";
            element.style.minWidth = this.panelMinWidth + "px";
            element.style.minHeight = this.panelMinHeight + "px";
        }
    };
    ChatLog.prototype.getTargetOpenLayout = function () {
        return {
            width: this.width,
            height: this.height,
            top: this.readChatLogTop()
        };
    };
    ChatLog.prototype.readChatLogTop = function () {
        if (!this.chatLog) {
            return undefined;
        }
        return this.chatLog.nativeElement.getBoundingClientRect().top || undefined;
    };
    ChatLog.prototype.readChatLogLayout = function () {
        return {
            width: this.panelWidth || this.width,
            height: this.panelHeight || this.height,
            top: this.readChatLogTop()
        };
    };
    ChatLog.prototype.ngAfterViewInit = function () {
        var _this = this;
        var canvas = document.getElementById('canvas');
        canvas.addEventListener('click', function () { return _this.unFocus(); });
        this.game.findEntityFromChatLog = this.findEntityFromMessages;
        this.game.findEntityFromChatLogByName = this.findEntityFromMessagesByName;
        this.updateTabs();
        this.updateOpen();
        this.zone.runOutsideAngular(function () {
            var scroll = _this.scroll.nativeElement;
            scroll.addEventListener('scroll', function () {
                if (_this.scrollingToEnd) {
                    _this.scrolledToEnd = true;
                    _this.scrollingToEnd = false;
                }
                else {
                    var clientHeight = scroll.getBoundingClientRect().height;
                    _this.scrolledToEnd = scroll.scrollTop >= (scroll.scrollHeight - clientHeight - SCROLL_END_THRESHOLD);
                }
            });
        });
        setTimeout(function () {
            _this.scrollToEnd();
            _this.updateInnerWidth();
        });
        if (DEVELOPMENT) {
            debugData_1.sampleMessages.forEach(function (_a) {
                var name = _a.name, id = _a.id, message = _a.message, type = _a.type;
                return _this.addMessage({ id: id || 999999, crc: undefined, name: name, message: message, type: type || 0 /* Chat */ });
            });
        }
    };
    ChatLog.prototype.ngOnDestroy = function () {
        if (this.game.findEntityFromChatLog === this.findEntityFromMessages) {
            this.game.findEntityFromChatLog = function () { return undefined; };
        }
        if (this.game.findEntityFromChatLogByName === this.findEntityFromMessagesByName) {
            this.game.findEntityFromChatLogByName = function () { return undefined; };
        }
        this.panelController.destroy();
        this.subscriptions.forEach(function (s) { return s.unsubscribe(); });
        this.subscriptions = [];
    };
    ChatLog.prototype.ngDoCheck = function () {
        if (this.lastOpacity !== this.opacity) {
            this.lastOpacity = this.opacity;
            this.contentElement.nativeElement.style.backgroundColor = this.bg;
            this.updateTabs();
        }
    };
    ChatLog.prototype.updateInnerWidth = function () {
        var _this = this;
        if (!this.renderedOpen || !this.linesElement) {
            return;
        }
        var maxWidth = this.element.nativeElement.getBoundingClientRect().width;
        var baseWidth = this.panelWidth || this.width;
        var innerWidth = Math.min(maxWidth || baseWidth, baseWidth) - 40;
        if (this.innerWidth !== innerWidth) {
            this.innerWidth = innerWidth;
            this.linesElement.style.width = innerWidth + "px";
        }
        if (!maxWidth) {
            setTimeout(function () { return _this.updateInnerWidth(); }, 10);
        }
    };
    Object.defineProperty(ChatLog.prototype, "messages", {
        get: function () {
            return this[this.activeTab];
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ChatLog.prototype, "settings", {
        get: function () {
            return this.settingsService.browser;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ChatLog.prototype, "settings2", {
        get: function () {
            return this.settingsService.account;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ChatLog.prototype, "activeTab", {
        get: function () {
            var tab = this.settings.chatlogTab;
            return (tab === 'local' || tab === 'party' || tab === 'personal' || tab === 'whisper') ? tab : 'local';
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ChatLog.prototype, "open", {
        get: function () {
            if (this.settings.chatlogClosed === undefined) {
                return !data_1.isMobile; // closed by default on mobile
            }
            return this.settings.chatlogClosed === false;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ChatLog.prototype, "width", {
        get: function () {
            return this.settings.chatlogWidth || CHATLOG_DEFAULT_WIDTH;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ChatLog.prototype, "height", {
        get: function () {
            return this.settings.chatlogHeight || CHATLOG_DEFAULT_HEIGHT;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ChatLog.prototype, "opacity", {
        get: function () {
            return this.settings2.chatlogOpacity === undefined ? constants_1.DEFAULT_CHATLOG_OPACITY : this.settings2.chatlogOpacity;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ChatLog.prototype, "bg", {
        get: function () {
            return "rgba(0, 0, 0, " + this.opacity / 100 + ")";
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ChatLog.prototype, "inactiveBg", {
        get: function () {
            return "rgba(0, 0, 0, " + (this.opacity / 200) * 0.5 + ")";
        },
        enumerable: false,
        configurable: true
    });
    ChatLog.prototype.createEntry = function (_a) {
        var id = _a.id, crc = _a.crc, name = _a.name, message = _a.message, type = _a.type;
        var system = type === 1 /* System */;
        var entry = {
            entityId: system ? 0 : id,
            name: system ? '' : name,
            index: 0,
            crc: crc,
            message: message,
            label: LABELS[type] || '',
            prefix: PREFIXES[type] || '',
            suffix: SUFFIXES[type] || '',
            classes: CLASSES[type] || ''
        };
        if (!system) {
            entry.index = this.findOrCreateIndex(name, id, crc);
        }
        return entry;
    };
    ChatLog.prototype.findOrCreateIndex = function (name, id, crc) {
        var found = this.indexes.get(name);
        if (!found || (this.messageCounter - found.counter) > FORGET_INDEX_AFTER) {
            found = {
                users: [{ id: id, crc: crc }],
                counter: 0
            };
            this.indexes.set(name, found);
        }
        found.counter = this.messageCounter;
        var index = findUserIndex(found.users, id, crc);
        if (index === -1) {
            index = found.users.length;
            found.users.push({ id: id, crc: crc });
        }
        return index;
    };
    ChatLog.prototype.filterChat = function () {
        var _this = this;
        this.clearTimeOutAutoClear();
        this.clearTimeOutAutoUnfocus();
        var value = this.filterInput.nativeElement.value;
        if (!value) {
            this.clearTimeOutAutoClear();
            this.filterChatLogLines('', false);
            return;
        }
        else {
            this.filterColor = this.bg;
        }
        this.autoClear = setTimeout(function () {
            _this.filterInput.nativeElement.value = '';
            _this.filterChat();
            _this.unFocus();
        }, constants_1.SECOND * 30);
        this.autoUnfocus = setTimeout(function () {
            _this.unFocus();
        }, constants_1.SECOND * 3);
        var toLowerCase = false;
        this.filterInput.nativeElement.style.color = '';
        if (value.startsWith('#')) {
            value = value.slice(1);
        }
        else if (value.startsWith('/')) {
            value = value.slice(1);
            try {
                var regExp = new RegExp(value);
                this.filterChatLogLines(regExp, toLowerCase);
            }
            catch (err) {
                if (DEVELOPMENT)
                    console.error(err);
                this.filterInput.nativeElement.style.color = '#ff6666';
            }
            return;
        }
        else {
            value = value.toLowerCase();
            toLowerCase = true;
        }
        this.filterChatLogLines(value, toLowerCase);
    };
    ChatLog.prototype.filterChatLogLines = function (content, caseSensitive) {
        var lines = this.linesElement.getElementsByTagName('div');
        for (var i = 0; i < lines.length; i++) {
            var textContent = lines[i].textContent;
            if (textContent) {
                textContent = textContent.slice(10);
                if (typeof content === 'string') {
                    if (caseSensitive) {
                        lines[i].hidden = !textContent.toLowerCase().includes(content);
                    }
                    else {
                        lines[i].hidden = !textContent.includes(content);
                    }
                }
                else {
                    lines[i].hidden = !textContent.match(content);
                }
            }
        }
    };
    ChatLog.prototype.unhideAllLines = function () {
        var lines = this.linesElement.getElementsByTagName('div');
        for (var i = 0; i < lines.length; i++) {
            lines[i].hidden = false;
        }
    };
    ChatLog.prototype.brightenDarkColors = function (hsl) {
        if (hsl.l < 40) {
            if (hsl.l > 20 && hsl.l < 40) {
                hsl.l += 20;
                if (hsl.s > 11)
                    hsl.s -= 11;
            }
            else {
                hsl.l = 40;
                if (hsl.s > 11)
                    hsl.s = 0;
            }
        }
        return hsl;
    };
    ChatLog.prototype.getCharacterColors = function (id) {
        if (!id)
            return;
        var entity = worldMap_1.findEntityById(this.game.map, id);
        if (!entity || !entity.palettePonyInfo)
            return;
        var colors = [];
        var _a = entity.palettePonyInfo, body = _a.body, mane = _a.mane;
        if (body && body.palette && body.palette.colors[1]) {
            var rgb = color_1.colorToRGBA(body.palette.colors[1]);
            var hsl = color_1.rgb2hsl(rgb);
            this.brightenDarkColors(hsl);
            colors.push(color_1.hsl2CSS(hsl));
        }
        if (mane && mane.palette && mane.palette.colors[1]) {
            var rgb = color_1.colorToRGBA(mane.palette.colors[1]);
            var hsl = color_1.rgb2hsl(rgb);
            this.brightenDarkColors(hsl);
            colors.push(color_1.hsl2CSS(hsl));
        }
        else if (colors && colors[0]) {
            colors.push((colors[0]));
        }
        return colors;
    };
    ChatLog.prototype.clearTimeOutAutoClear = function () {
        if (this.autoClear)
            clearTimeout(this.autoClear);
        this.autoClear = undefined;
        this.filterColor = this.inactiveBg;
    };
    ChatLog.prototype.clearTimeOutAutoUnfocus = function () {
        if (this.autoUnfocus)
            clearTimeout(this.autoUnfocus);
        this.autoUnfocus = undefined;
    };
    ChatLog.prototype.focus = function () {
        this.clearTimeOutAutoUnfocus();
        if (this.filterInput.nativeElement)
            this.filterInput.nativeElement.focus();
    };
    ChatLog.prototype.unFocus = function () {
        this.clearTimeOutAutoUnfocus();
        if (this.filterInput.nativeElement)
            this.filterInput.nativeElement.blur();
    };
    ChatLog.prototype.addMessage = function (message) {
        if (message.name && message.message) {
            var entry = this.createEntry(message);
            var party = interfaces_1.isPartyMessage(message.type);
            var whisper = interfaces_1.isWhisper(message.type) || interfaces_1.isWhisperTo(message.type);
            var open = this.open;
            var scrolledToEnd = open ? this.scrolledToEnd : false;
            var tab = this.activeTab;
            var colors = this.getCharacterColors(message.id);
            this.addEntryToList(this.local, GENERAL_CHAT_LIMIT, open && tab === 'local', entry);
            setNameColors(entry.dom, colors);
            if (party || whisper) {
                var partyEntry = __assign({}, entry);
                partyEntry.dom = undefined;
                partyEntry.label = whisper ? partyEntry.label : undefined;
                this.addEntryToList(this.party, PARTY_CHAT_LIMIT, open && tab === 'party', partyEntry);
                setNameColors(partyEntry.dom, colors);
            }
            if (whisper) {
                var whisperEntry = __assign({}, entry);
                whisperEntry.dom = undefined;
                whisperEntry.label = undefined;
                this.addEntryToList(this.whisper, WHISPER_CHAT_LIMIT, open && tab === 'whisper', whisperEntry);
                setNameColors(whisperEntry.dom, colors);
            }
            if (message.id) {
                var entity = worldMap_1.findEntityById(this.game.map, message.id);
                if (entity && entityUtils_1.isFriend(entity)) {
                    var personalEntry = __assign({}, entry);
                    personalEntry.dom = undefined;
                    personalEntry.label = undefined;
                    this.addEntryToList(this.personal, GENERAL_CHAT_LIMIT, open && tab === 'personal', personalEntry);
                    setNameColors(personalEntry.dom, colors);
                }
            }
            if (message.id) {
                var entity = worldMap_1.findEntityById(this.game.map, message.id);
                if (entity && entityUtils_1.isFriend(entity)) {
                    var personalEntry = __assign({}, entry);
                    personalEntry.dom = undefined;
                    personalEntry.label = undefined;
                    this.addEntryToList(this.personal, GENERAL_CHAT_LIMIT, open && tab === 'personal', personalEntry);
                    setNameColors(personalEntry.dom, colors);
                }
            }
            if (message.type === 13 /* Whisper */ && !this.open) {
                this.setUnread(this.unread + 1);
            }
            if (scrolledToEnd) {
                this.scrollToEnd();
            }
            if (tab !== 'whisper' && interfaces_1.isWhisper(message.type)) {
                this.whisperTab.nativeElement.classList.add('unread');
                this.whisperTab.nativeElement.style.backgroundColor = "rgba(225, 161, 223, " + this.opacity / 100 + ")";
            }
            if (tab !== 'party' && party) {
                this.partyTab.nativeElement.classList.add('unread');
                this.partyTab.nativeElement.style.backgroundColor = "rgba(184, 227, 255, " + this.opacity / 100 + ")";
            }
            this.filterChat();
            this.messageCounter++;
        }
    };
    ChatLog.prototype.addEntryToList = function (list, limit, isOpen, entry) {
        var removedDom;
        while (list.length >= limit) {
            var removed = list.shift();
            if (isOpen && removed && removed.dom) {
                if (removed.dom.root.parentElement) {
                    removed.dom.root.parentElement.removeChild(removed.dom.root);
                }
                removedDom = removed.dom;
                removed.dom = undefined;
            }
        }
        list.push(entry);
        if (isOpen) {
            entry.dom = removedDom || createChatLogLineDOM(this.clickLabel, this.clickNameHandler);
            updateChatLogLine(entry.dom, entry, this.settings.timestamp);
            this.linesElement.appendChild(entry.dom.root);
        }
    };
    ChatLog.prototype.toggle = function () {
        this.settings.chatlogClosed = this.open;
        this.settingsService.saveBrowserSettings();
        if (this.open) {
            this.animateOpen();
        }
        else {
            this.animateClose();
        }
    };
    ChatLog.prototype.switchTab = function (tab) {
        if (this.activeTab !== tab) {
            this.settings.chatlogTab = tab;
            this.settingsService.saveBrowserSettings();
            this.regenerateList();
            this.scrollToEnd();
            this.updateTabs();
            this.filterChat();
        }
    };
    ChatLog.prototype.updateTabs = function () {
        this.setActiveTab(this.localTab.nativeElement, this.activeTab === 'local');
        this.setActiveTab(this.partyTab.nativeElement, this.activeTab === 'party');
        this.setActiveTab(this.personalTab.nativeElement, this.activeTab === 'personal');
        this.setActiveTab(this.whisperTab.nativeElement, this.activeTab === 'whisper');
    };
    ChatLog.prototype.setActiveTab = function (tab, active) {
        if (active) {
            tab.classList.add('active');
            tab.classList.remove('unread');
            tab.style.backgroundColor = this.bg;
        }
        else {
            tab.classList.remove('active');
            if (!tab.classList.contains('unread'))
                tab.style.backgroundColor = this.inactiveBg;
        }
    };
    ChatLog.prototype.scrollToEnd = function () {
        // requestAnimationFrame(this.scrollHandler);
        this.scrollToEndAtFrame = true;
    };
    ChatLog.prototype.clearList = function () {
        htmlUtils_1.removeAllNodes(this.linesElement);
    };
    ChatLog.prototype.regenerateList = function () {
        var _this = this;
        this.clearList();
        var lines = this.linesElement;
        this.messages.forEach(function (entry) {
            if (!entry.dom) {
                entry.dom = createChatLogLineDOM(_this.clickLabel, _this.clickNameHandler);
                setNameColors(entry.dom, _this.getCharacterColors(entry.entityId));
                updateChatLogLine(entry.dom, entry, _this.settings.timestamp);
            }
            lines.appendChild(entry.dom.root);
        });
    };
    ChatLog.prototype.drag = function (_a, resizeY, resizeX) {
        var _this = this;
        var dx = _a.dx, dy = _a.dy, type = _a.type, event = _a.event;
        event.preventDefault();
        if (type === 'start') {
            this.shouldScrollToEnd = this.scrolledToEnd;
            this.panelController.beginResize(this.readChatLogLayout());
        }
        this.panelController.resizeBy(resizeX ? dx : 0, resizeY ? dy : 0);
        if (type === 'end') {
            this.panelController.endResize(function () {
                _this.settings.chatlogWidth = Math.round(_this.panelWidth);
                _this.settings.chatlogHeight = Math.round(_this.panelHeight);
                _this.settingsService.saveBrowserSettings();
            });
        }
        if (this.shouldScrollToEnd) {
            this.scrollToEnd();
        }
    };
    ChatLog.prototype.setUnread = function (value) {
        if (this.unread !== value) {
            this.unread = value;
            var count = this.countElement.nativeElement;
            var toggle = this.toggleButton.nativeElement;
            if (value) {
                count.textContent = value > 99 ? '99+' : "" + value;
                toggle.classList.add('has-unread');
            }
            else {
                count.textContent = '';
                toggle.classList.remove('has-unread');
            }
        }
    };
    __decorate([
        core_1.ViewChild('chatLog', { static: true })
    ], ChatLog.prototype, "chatLog");
    __decorate([
        core_1.ViewChild('scroll', { static: true })
    ], ChatLog.prototype, "scroll");
    __decorate([
        core_1.ViewChild('lines', { static: true })
    ], ChatLog.prototype, "lines");
    __decorate([
        core_1.ViewChild('localTab', { static: true })
    ], ChatLog.prototype, "localTab");
    __decorate([
        core_1.ViewChild('partyTab', { static: true })
    ], ChatLog.prototype, "partyTab");
    __decorate([
        core_1.ViewChild('personalTab', { static: true })
    ], ChatLog.prototype, "personalTab");
    __decorate([
        core_1.ViewChild('whisperTab', { static: true })
    ], ChatLog.prototype, "whisperTab");
    __decorate([
        core_1.ViewChild('filterInput', { static: true })
    ], ChatLog.prototype, "filterInput");
    __decorate([
        core_1.ViewChild('toggleButton', { static: true })
    ], ChatLog.prototype, "toggleButton");
    __decorate([
        core_1.ViewChild('count', { static: true })
    ], ChatLog.prototype, "countElement");
    __decorate([
        core_1.ViewChild('content', { static: true })
    ], ChatLog.prototype, "contentElement");
    __decorate([
        core_1.Output()
    ], ChatLog.prototype, "toggleType");
    __decorate([
        core_1.Output()
    ], ChatLog.prototype, "nameClick");
    __decorate([
        core_1.HostListener('window:resize')
    ], ChatLog.prototype, "updateInnerWidth");
    ChatLog = __decorate([
        core_1.Component({
            selector: 'chat-log',
            templateUrl: 'chat-log.pug',
            styleUrls: ['chat-log.scss']
        })
    ], ChatLog);
    return ChatLog;
}());
exports.ChatLog = ChatLog;
function findEntityFromMessages(id, messages) {
    for (var i = messages.length - 1; i >= 0; i--) {
        if (messages[i].entityId === id) {
            return { fake: true, id: id, type: constants_1.PONY_TYPE, name: messages[i].name, crc: messages[i].crc };
        }
    }
    return undefined;
}
function findEntityFromMessagesByName(name, playerId, messages) {
    var regex = new RegExp("^" + lodash_1.escapeRegExp(name) + "$", 'i');
    for (var i = messages.length - 1; i >= 0; i--) {
        var message = messages[i];
        if (message.name && message.entityId && message.entityId !== playerId && regex.test(message.name)) {
            return { fake: true, id: message.entityId, type: constants_1.PONY_TYPE, name: message.name, crc: message.crc };
        }
    }
    return undefined;
}
