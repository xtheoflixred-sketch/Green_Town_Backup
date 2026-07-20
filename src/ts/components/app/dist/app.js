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
exports.App = exports.popoverConfig = exports.tooltipConfig = void 0;
var core_1 = require("@angular/core");
var router_1 = require("@angular/router");
var tooltip_1 = require("ngx-bootstrap/tooltip");
var popover_1 = require("ngx-bootstrap/popover");
var data_1 = require("../../client/data");
var icons_1 = require("../../client/icons");
var clientUtils_1 = require("../../client/clientUtils");
var constants_1 = require("../../common/constants");
var pony_1 = require("../../common/pony");
var entityUtils_1 = require("../../common/entityUtils");
var worldMap_1 = require("../../common/worldMap");
var gameUtils_1 = require("../../client/gameUtils");
var settings_box_1 = require("../shared/settings-box/settings-box");
function findPonyById(map, id) {
    return map.entities.find(function (e) { return e.id === id && e.type === constants_1.PONY_TYPE; });
}
function tooltipConfig() {
    return Object.assign(new tooltip_1.TooltipConfig(), { container: 'body' });
}
exports.tooltipConfig = tooltipConfig;
function popoverConfig() {
    return Object.assign(new popover_1.PopoverConfig(), { container: 'body' });
}
exports.popoverConfig = popoverConfig;
var App = /** @class */ (function () {
    function App(modalService, gameService, model, game, router, activatedRoute, errorReporter) {
        var _this = this;
        this.modalService = modalService;
        this.gameService = gameService;
        this.model = model;
        this.game = game;
        this.router = router;
        this.activatedRoute = activatedRoute;
        this.errorReporter = errorReporter;
        this.version = data_1.version;
        this.date = new Date();
        this.emailIcon = icons_1.faEnvelope;
        this.twitterIcon = icons_1.faTwitter;
        this.patreonIcon = icons_1.faPatreon;
        this.discordIcon = icons_1.faDiscord;
        this.cogIcon = icons_1.faCog;
        this.homeIcon = icons_1.faHome;
        this.helpIcon = icons_1.faQuestionCircle;
        this.aboutIcon = icons_1.faInfoCircle;
        this.charactersIcon = icons_1.faHorseHead;
        // readonly telegramIcon = faPaperPlane;
        this.contactEmail = data_1.contactEmail;
        this.contactDiscord = data_1.contactDiscord;
        this.discordLink = data_1.discordLink;
        this.twitterLink = data_1.twitterLink;
        this.telegramLink = data_1.telegramLink;
        this.copyright = data_1.copyrightName;
        this.url = location.pathname;
        this.subscriptions = [];
        this.lastSelectedId = 0;
        this.dragStartByProfileId = new Map();
        this.documentMouseDownCapture = function (event) { return _this.onOutsideProfileMouseDown(event); };
        this.tier4Profiles = [];
    }
    Object.defineProperty(App.prototype, "canInstall", {
        get: function () {
            return false;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(App.prototype, "loading", {
        get: function () {
            return this.model.loading;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(App.prototype, "account", {
        get: function () {
            return this.model.account;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(App.prototype, "isMod", {
        get: function () {
            return this.model.isMod;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(App.prototype, "isBuilder", {
        get: function () {
            return this.model.isBuilder;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(App.prototype, "notifications", {
        get: function () {
            return this.game.notifications;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(App.prototype, "selected", {
        get: function () {
            return this.gameService.selected;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(App.prototype, "playing", {
        get: function () {
            return this.gameService.playing;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(App.prototype, "showActionBar", {
        get: function () {
            return this.playing;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(App.prototype, "canUseTier4Profiles", {
        get: function () {
            return this.model.supporter >= 4;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(App.prototype, "editingActions", {
        get: function () {
            return this.game.editingActions;
        },
        enumerable: false,
        configurable: true
    });
    App.prototype.ngOnInit = function () {
        var _this = this;
        // Проверяем, существует ли ga в глобальном объекте window
        if (typeof window['ga'] !== 'undefined') {
            this.subscriptions.push(this.router.events.subscribe(function (event) {
                if (event instanceof router_1.NavigationEnd && _this.url !== event.url) {
                    window['ga']('set', 'page', _this.url = event.url);
                    window['ga']('send', 'pageview');
                }
            }));
        }
        if (clientUtils_1.isBrowserOutdated) {
            this.errorReporter.disable();
        }
        if (!DEVELOPMENT) {
            clientUtils_1.registerServiceWorker(data_1.host + "sw.js", function () {
                _this.model.updating = true;
                setTimeout(function () {
                    _this.model.updatingTakesLongTime = true;
                }, 20 * constants_1.SECOND);
            });
        }
        clientUtils_1.initLoader();
        this.subscriptions.push(this.game.announcements.subscribe(function (message) {
            var announcer = _this.announcer.nativeElement;
            var announcerText = _this.announcerText.nativeElement;
            announcerText.textContent = message;
            announcer.classList.add('show');
            if (_this.announcerTimeout !== undefined) {
                clearTimeout(_this.announcerTimeout);
            }
            _this.announcerTimeout = setTimeout(function () {
                announcer.classList.remove('show');
                announcerText.textContent = '';
            }, 3000);
        }));
        this.activatedRoute.queryParams.subscribe(function (_a) {
            var error = _a.error, merged = _a.merged, alert = _a.alert;
            _this.model.authError = error;
            _this.model.accountAlert = alert;
            _this.model.mergedAccount = !!merged;
        });
        this.subscriptions.push(this.model.protectionErrors.subscribe(function () {
            _this.openReloadModal();
        }));
        this.subscriptions.push(this.game.onOpenGameCharacter.subscribe(function () {
            if (!document.body.classList.contains('modal-open')) {
                _this.openGameCharacterModal();
            }
        }));
        document.addEventListener('mousedown', this.documentMouseDownCapture, true);
    };
    App.prototype.ngDoCheck = function () {
        this.syncBackgroundModeClass();
        this.syncTier4Profiles();
    };
    App.prototype.ngOnDestroy = function () {
        document.removeEventListener('mousedown', this.documentMouseDownCapture, true);
        this.subscriptions.forEach(function (s) { return s.unsubscribe(); });
    };
    App.prototype.trackByTier4Profile = function (_index, profile) {
        return profile.id;
    };
    App.prototype.isTier4ProfileDragging = function (profileId) {
        return this.dragStartByProfileId.has(profileId);
    };
    App.prototype.onTier4ProfileDrag = function (profileId, _a) {
        var type = _a.type, dx = _a.dx, dy = _a.dy;
        var index = this.tier4Profiles.findIndex(function (p) { return p.id === profileId; });
        if (index === -1)
            return;
        var profile = this.tier4Profiles[index];
        if (type === 'start') {
            this.dragStartByProfileId.set(profileId, { x: profile.x, y: profile.y });
            return;
        }
        var start = this.dragStartByProfileId.get(profileId);
        if (!start)
            return;
        var width = 430;
        var height = 110;
        var maxX = Math.max(10, window.innerWidth - width - 10);
        var maxY = Math.max(10, window.innerHeight - height - 10);
        profile.x = Math.min(maxX, Math.max(10, start.x + dx));
        profile.y = Math.min(maxY, Math.max(10, start.y + dy));
        if (type === 'end') {
            this.dragStartByProfileId["delete"](profileId);
        }
    };
    App.prototype.syncTier4Profiles = function () {
        var _this = this;
        if (!this.playing || !this.canUseTier4Profiles) {
            if (this.tier4Profiles.length)
                this.tier4Profiles = [];
            this.dragStartByProfileId.clear();
            this.lastSelectedId = 0;
            return;
        }
        var selected = this.selected;
        var selectedId = selected ? selected.id : 0;
        if (!selectedId && this.lastSelectedId && this.tier4Profiles.length) {
            this.closeOneTier4Profile();
        }
        if (selected && selectedId && selectedId !== this.lastSelectedId) {
            this.addOrMoveTier4Profile(selected);
        }
        this.lastSelectedId = selectedId;
        this.tier4Profiles = this.tier4Profiles.map(function (profile) {
            var current = worldMap_1.findEntityById(_this.game.map, profile.id);
            if (current) {
                var pony = current;
                if (pony.offline) {
                    delete pony.offline;
                }
                if (pony.options && pony.options.offline) {
                    delete pony.options.offline;
                }
                return __assign(__assign({}, profile), { pony: pony });
            }
            var offlinePony = __assign(__assign({}, profile.pony), { offline: true });
            return __assign(__assign({}, profile), { pony: offlinePony });
        });
    };
    App.prototype.addOrMoveTier4Profile = function (pony) {
        var existingIndex = this.tier4Profiles.findIndex(function (p) { return p.id === pony.id; });
        if (existingIndex !== -1) {
            var existing = this.tier4Profiles.splice(existingIndex, 1)[0];
            existing.pony = pony;
            this.tier4Profiles.unshift(existing);
            return;
        }
        var offset = this.tier4Profiles.length;
        this.tier4Profiles.unshift({
            id: pony.id,
            pony: pony,
            x: 10 + (offset * 24),
            y: 10 + (offset * 24)
        });
        if (this.tier4Profiles.length > 3) {
            var removed = this.tier4Profiles.pop();
            if (removed) {
                this.dragStartByProfileId["delete"](removed.id);
            }
        }
    };
    App.prototype.syncBackgroundModeClass = function () {
        var account = this.model.account;
        var settings = account && account.settings;
        var powerSaveMode = !settings || settings.powerSaveModeInBackground !== false;
        if (this.appliedBackgroundPowerSave === powerSaveMode)
            return;
        document.body.classList.toggle('background-style-new', !powerSaveMode);
        this.appliedBackgroundPowerSave = powerSaveMode;
    };
    App.prototype.closeOneTier4Profile = function () {
        var removed = this.tier4Profiles.pop();
        if (removed) {
            this.dragStartByProfileId["delete"](removed.id);
        }
    };
    App.prototype.onOutsideProfileMouseDown = function (event) {
        if (!this.playing || !this.canUseTier4Profiles || this.selected || !this.tier4Profiles.length) {
            return;
        }
        var target = event.target;
        if (target && target.nodeType !== Node.ELEMENT_NODE) {
            target = target.parentNode;
        }
        var element = target;
        if (!target) {
            return;
        }
        if (element && element.closest('.pony-box-floating')) {
            return;
        }
        this.closeOneTier4Profile();
    };
    App.prototype.focus = function () {
        this.model.verifyAccount();
    };
    App.prototype.signIn = function (provider) {
        this.model.signIn(provider);
    };
    App.prototype.signOut = function () {
        this.model.signOut();
    };
    App.prototype.openReloadModal = function () {
        var _this = this;
        if (!this.reloadModalRef) {
            this.reloadModalRef = this.modalService.show(this.reloadModal, { "class": 'modal-lg', ignoreBackdropClick: true, keyboard: false });
            this.reloadInterval = setInterval(function () {
                if (clientUtils_1.checkIframeKey('reload-frame', 'gep84r9jshge4g')) {
                    _this.cancelReloadModal();
                }
            }, 500);
        }
    };
    App.prototype.cancelReloadModal = function () {
        if (this.reloadModalRef) {
            this.reloadModalRef.hide();
            this.reloadModalRef = undefined;
        }
        clearInterval(this.reloadInterval);
    };
    App.prototype.openChangelog = function () {
        var _this = this;
        if (this.changelogModalRef) {
            this.changelogModalRef.hide();
            this.changelogModalRef = undefined;
        }
        this.changelogModalRef = this.modalService.show(this.changelogModal, { "class": 'modal-lg' });
        var refAny = this.changelogModalRef;
        if (refAny && refAny.onHidden && refAny.onHidden.subscribe) {
            refAny.onHidden.subscribe(function () {
                _this.changelogModalRef = undefined;
            });
        }
    };
    App.prototype.openSettings = function () {
        if (this.settingsBox) {
            this.settingsBox.openSettings();
        }
    };
    App.prototype.chatLogNameClick = function (chatBox, message) {
        if (!message.entityId) {
            return;
        }
        var entity = worldMap_1.findEntityById(this.game.map, message.entityId);
        if (entity && (!pony_1.isPony(entity) || entity === this.game.player)) {
            return;
        }
        if (!entity) {
            entity = { fake: true, type: constants_1.PONY_TYPE, id: message.entityId, name: message.name };
        }
        if (gameUtils_1.isSelected(this.game, message.entityId)) {
            this.game.whisperTo = entity;
            chatBox.setChatType('whisper');
        }
        else {
            this.game.select(entity);
        }
    };
    App.prototype.messageToFriend = function (chatBox, friend) {
        if (friend.entityId) {
            var entity = { id: friend.entityId, name: friend.actualName || 'unknown' };
            this.messageToPony(chatBox, entity);
        }
    };
    App.prototype.messageToPony = function (chatBox, pony) {
        var _this = this;
        setTimeout(function () {
            _this.game.whisperTo = pony;
            chatBox.setChatType('whisper');
        });
    };
    App.prototype.openFriendsList = function () {
        if (this.friendsBox) {
            this.friendsBox.openList();
        }
    };
    App.prototype.openGameCharacterModal = function () {
        var _this = this;
        if (this.gameCharacterModalRef) {
            this.gameCharacterModalRef.hide();
            this.gameCharacterModalRef = undefined;
        }
        this.gameCharacterModalRef = this.modalService.show(this.gameCharacterModal, { "class": 'modal-xl', ignoreBackdropClick: false });
        var refAny = this.gameCharacterModalRef;
        var clearRef = function () { _this.gameCharacterModalRef = undefined; };
        if (refAny) {
            if (refAny.onHide && refAny.onHide.subscribe) {
                refAny.onHide.subscribe(clearRef);
            }
            else if (refAny.onHidden && refAny.onHidden.subscribe) {
                refAny.onHidden.subscribe(clearRef);
            }
        }
    };
    App.prototype.openSettingsModal = function () {
        var _this = this;
        if (this.settingsModalRef) {
            this.settingsModalRef.hide();
            this.settingsModalRef = undefined;
        }
        // Проверяем, существует ли шаблон перед открытием
        if (this.settingsModal) {
            this.settingsModalRef = this.modalService.show(this.settingsModal, { "class": 'modal-lg' });
            // Подписка на закрытие модалки, чтобы очистить ссылку
            var refAny = this.settingsModalRef;
            var clearRef = function () {
                _this.settingsModalRef = undefined;
            };
            if (refAny && refAny.onHide) {
                refAny.onHide.subscribe(clearRef);
            }
        }
    };
    App.prototype.closeSettingsModal = function () {
        if (this.settingsModalRef) {
            this.settingsModalRef.hide();
            this.settingsModalRef = undefined;
        }
    };
    App.prototype.playAndSwapCharacter = function () {
        var _this = this;
        var pony = this.model.pony;
        if (!pony)
            return;
        this.model.savePony(pony)
            .then(function (newPony) {
            var id = (newPony && newPony.id) || pony.id;
            if (id) {
                _this.game.send(function (server) { return server.actionParam(11 /* SwapCharacter */, id); });
                if (newPony) {
                    newPony.lastUsed = (new Date()).toISOString();
                }
                _this.model.sortPonies();
            }
            if (_this.gameCharacterModalRef) {
                _this.gameCharacterModalRef.hide();
            }
        })["catch"](function (e) {
            console.error('Failed to save pony:', e);
        });
    };
    App.prototype.openProfile = function (friend) {
        if (friend.entityId) {
            var pony = findPonyById(this.game.map, friend.entityId);
            if (pony && entityUtils_1.canOpenProfile(pony, this.game.mod)) {
                this.game.select(pony);
                return;
            }
        }
        // Создать фейковый Pony для оффлайн или скрытого друга
        var fakePony = {
            fake: true,
            type: constants_1.PONY_TYPE,
            id: friend.entityId || 0,
            accountId: friend.accountId,
            name: friend.actualName,
            offline: !friend.hidden,
            showAsOffline: !!friend.hidden
        };
        this.game.select(fakePony);
    };
    __decorate([
        core_1.ViewChild('announcer', { static: true })
    ], App.prototype, "announcer");
    __decorate([
        core_1.ViewChild('announcerText', { static: true })
    ], App.prototype, "announcerText");
    __decorate([
        core_1.ViewChild('reloadModal', { static: true })
    ], App.prototype, "reloadModal");
    __decorate([
        core_1.ViewChild('signInModal', { static: true })
    ], App.prototype, "signInModal");
    __decorate([
        core_1.ViewChild('changelogModal', { static: true })
    ], App.prototype, "changelogModal");
    __decorate([
        core_1.ViewChild('settingsModal', { static: true })
    ], App.prototype, "settingsModal");
    __decorate([
        core_1.ViewChild('gameCharacterModal', { static: true })
    ], App.prototype, "gameCharacterModal");
    __decorate([
        core_1.ViewChild('friendsBox', { static: false })
    ], App.prototype, "friendsBox");
    __decorate([
        core_1.ViewChild(settings_box_1.SettingsBox, { static: false })
    ], App.prototype, "settingsBox");
    __decorate([
        core_1.HostListener('window:focus')
    ], App.prototype, "focus");
    App = __decorate([
        core_1.Component({
            selector: 'pony-town-app',
            templateUrl: 'app.pug',
            styleUrls: ['app.scss'],
            providers: [
                { provide: tooltip_1.TooltipConfig, useFactory: tooltipConfig },
                { provide: popover_1.PopoverConfig, useFactory: popoverConfig },
            ]
        })
    ], App);
    return App;
}());
exports.App = App;
