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
exports.ToolsMap = void 0;
var core_1 = require("@angular/core");
var canvasUtils_1 = require("../../../client/canvasUtils");
var spriteUtils_1 = require("../../../client/spriteUtils");
var constants_1 = require("../../../common/constants");
var icons_1 = require("../../../client/icons");
var worldMap_1 = require("../../../common/worldMap");
var interfaces_1 = require("../../../common/interfaces");
var contextSpriteBatch_1 = require("../../../graphics/contextSpriteBatch");
var sprites_1 = require("../../../generated/sprites");
var region_1 = require("../../../common/region");
var compress_1 = require("../../../common/compress");
var tileUtils_1 = require("../../../client/tileUtils");
var camera_1 = require("../../../common/camera");
var ponyInfo_1 = require("../../../common/ponyInfo");
var entities_1 = require("../../../common/entities");
var draw_1 = require("../../../client/draw");
var utils_1 = require("../../../common/utils");
var timeUtils_1 = require("../../../common/timeUtils");
var colors_1 = require("../../../common/colors");
var color_1 = require("../../../common/color");
var ToolsMap = /** @class */ (function () {
    function ToolsMap(http, storage, model) {
        this.http = http;
        this.storage = storage;
        this.model = model;
        this.homeIcon = icons_1.faHome;
        this.syncIcon = icons_1.faSync;
        this.imageIcon = icons_1.faImage;
        this.searchIcon = icons_1.faSearch;
        this.searchPlusIcon = icons_1.faPlus;
        this.searchMinusIcon = icons_1.faMinus;
        this.clockIcon = icons_1.faClock;
        this.cogIcon = icons_1.faCog;
        this.spinnerIcon = icons_1.faSpinner;
        this.copyIcon = icons_1.faCopy;
        this.maps = [];
        this.mapPreviews = {}; // Кэш превьюшек карт (regular)
        this.mapMinimapPreviews = {}; // Кэш миникарт превьюшек
        this.previewsGenerating = new Set(); // Отслеживаем какие превьюшки генерируются
        this.selectedMap = '';
        this.grid = false;
        this.serverTime = '00:00';
        this.isStreaming = false;
        this.fpsCounter = 0;
        this.maxFpsLimit = 60; // Максимальный лимит FPS, установленный пользователем
        this.currentFps = 60; // Реальный текущий FPS
        this.fpsUpdateRate = 500;
        this.gameTime = '06:00';
        this.isMapLoaded = false;
        this.isMapLoading = false;
        this.showPlaceholder = true;
        this.showTimeOnMap = false; // Отображение времени суток на карте
        this.gameTimeBase = 0;
        this.frameCount = 0;
        this.gameTimeStartOffset = 0;
        // Zoom & Pan
        this.zoomLevel = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.minZoom = 0.5;
        this.maxZoom = 8;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.lastTouchDistance = 0;
        this.cursorStyle = 'default';
        this.isAtMinZoom = false;
        this.isAtMaxZoom = false;
        this.nextFrameTime = 0; // Для точного контроля FPS
    }
    Object.defineProperty(ToolsMap.prototype, "scale", {
        get: function () {
            return this.storage.getInt('tools-map-scale') || 1;
        },
        set: function (value) {
            this.storage.setInt('tools-map-scale', value);
            this.renderedMapCanvas = undefined; // invalidate cache
            this.renderMapToBuffer();
            this.redraw();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ToolsMap.prototype, "type", {
        get: function () {
            return this.storage.getItem('tools-map-type') || 'regular';
        },
        set: function (value) {
            this.storage.setItem('tools-map-type', value);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ToolsMap.prototype, "isBuilderOnly", {
        get: function () {
            var roles = (this.model.account && this.model.account.roles) || [];
            return this.model.isBuilder && !this.model.isMod &&
                !roles.includes('dev') &&
                !roles.includes('admin');
        },
        enumerable: false,
        configurable: true
    });
    ToolsMap.prototype.ngOnInit = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, spriteUtils_1.loadAndInitSpriteSheets()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.fetchList()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.fetch()];
                    case 3:
                        _a.sent();
                        this.setupInteractivity();
                        this.startServerTimeUpdate();
                        this.startFpsCounter();
                        return [2 /*return*/];
                }
            });
        });
    };
    ToolsMap.prototype.ngOnDestroy = function () {
        this.stopStream();
        if (this.timeInterval) {
            clearInterval(this.timeInterval);
        }
    };
    ToolsMap.prototype.setupInteractivity = function () {
        var _this = this;
        var container = this.canvasContainer && this.canvasContainer.nativeElement;
        if (!container)
            return;
        // Mouse wheel zoom
        container.addEventListener('wheel', function (e) { return _this.onMouseWheel(e); }, { passive: false });
        // Mouse drag
        container.addEventListener('mousedown', function (e) { return _this.onMouseDown(e); });
        container.addEventListener('mousemove', function (e) { return _this.onMouseMove(e); });
        container.addEventListener('mouseup', function (e) { return _this.onMouseUp(e); });
        container.addEventListener('mouseleave', function (e) { return _this.onMouseLeave(e); });
        // Double click reset
        container.addEventListener('dblclick', function () { return _this.resetZoomPan(); });
        // Touch events
        container.addEventListener('touchstart', function (e) { return _this.onTouchStart(e); }, { passive: false });
        container.addEventListener('touchmove', function (e) { return _this.onTouchMove(e); }, { passive: false });
        container.addEventListener('touchend', function (e) { return _this.onTouchEnd(e); });
    };
    ToolsMap.prototype.onMouseWheel = function (e) {
        e.preventDefault();
        var container = this.canvasContainer && this.canvasContainer.nativeElement;
        if (!container)
            return;
        var rect = container.getBoundingClientRect();
        var mouseX = e.clientX - rect.left;
        var mouseY = e.clientY - rect.top;
        // Конвертируем позицию мыши в координаты карты (учитывая текущий масштаб и смещение)
        var mapX = (mouseX - this.offsetX) / this.zoomLevel;
        var mapY = (mouseY - this.offsetY) / this.zoomLevel;
        var zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        var newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * zoomFactor));
        // Пересчитываем смещение так, чтобы масштабирование происходило относительно курсора
        this.offsetX = mouseX - mapX * newZoom;
        this.offsetY = mouseY - mapY * newZoom;
        this.zoomLevel = newZoom;
        this.updateZoomState();
        this.constrainPan();
        this.redraw();
    };
    ToolsMap.prototype.onMouseDown = function (e) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.cursorStyle = 'grabbing';
    };
    ToolsMap.prototype.onMouseMove = function (e) {
        if (this.isDragging) {
            var deltaX = e.clientX - this.lastMouseX;
            var deltaY = e.clientY - this.lastMouseY;
            this.offsetX += deltaX;
            this.offsetY += deltaY;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.constrainPan();
            this.redraw();
        }
        else {
            this.cursorStyle = this.zoomLevel < this.maxZoom ? 'grab' : 'default';
        }
    };
    ToolsMap.prototype.onMouseUp = function (_e) {
        this.isDragging = false;
        this.cursorStyle = 'grab';
    };
    ToolsMap.prototype.onMouseLeave = function (_e) {
        this.isDragging = false;
        this.cursorStyle = 'default';
    };
    ToolsMap.prototype.onTouchStart = function (e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.lastMouseX = e.touches[0].clientX;
            this.lastMouseY = e.touches[0].clientY;
        }
        else if (e.touches.length === 2) {
            this.isDragging = false;
            this.lastTouchDistance = this.getDistance(e.touches[0], e.touches[1]);
        }
    };
    ToolsMap.prototype.onTouchMove = function (e) {
        e.preventDefault();
        if (e.touches.length === 1 && this.isDragging) {
            var deltaX = e.touches[0].clientX - this.lastMouseX;
            var deltaY = e.touches[0].clientY - this.lastMouseY;
            this.offsetX += deltaX;
            this.offsetY += deltaY;
            this.lastMouseX = e.touches[0].clientX;
            this.lastMouseY = e.touches[0].clientY;
            this.constrainPan();
            this.redraw();
        }
        else if (e.touches.length === 2) {
            var distance = this.getDistance(e.touches[0], e.touches[1]);
            var zoomFactor = distance / this.lastTouchDistance;
            var newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * zoomFactor));
            this.zoomLevel = newZoom;
            this.lastTouchDistance = distance;
            this.constrainPan();
            this.redraw();
        }
    };
    ToolsMap.prototype.onTouchEnd = function (e) {
        if (e.touches.length < 2) {
            this.isDragging = false;
        }
    };
    ToolsMap.prototype.getDistance = function (touch1, touch2) {
        var dx = touch1.clientX - touch2.clientX;
        var dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };
    ToolsMap.prototype.constrainPan = function () {
        if (!this.renderedMapCanvas)
            return;
        var container = this.canvasContainer && this.canvasContainer.nativeElement;
        if (!container)
            return;
        var mapWidth = this.renderedMapCanvas.width * this.zoomLevel;
        var mapHeight = this.renderedMapCanvas.height * this.zoomLevel;
        var containerWidth = container.clientWidth;
        var containerHeight = container.clientHeight;
        // Если карта больше, чем контейнер, позволяем полную прокрутку
        // Если карта меньше контейнера, центрируем её
        var maxOffsetX = Math.max(0, mapWidth - containerWidth);
        var maxOffsetY = Math.max(0, mapHeight - containerHeight);
        var minOffsetX = -maxOffsetX;
        var minOffsetY = -maxOffsetY;
        this.offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, this.offsetX));
        this.offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, this.offsetY));
    };
    ToolsMap.prototype.updateZoomState = function () {
        this.isAtMinZoom = this.zoomLevel <= this.minZoom + 0.01;
        this.isAtMaxZoom = this.zoomLevel >= this.maxZoom - 0.01;
    };
    ToolsMap.prototype.resetZoomPan = function () {
        this.zoomLevel = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.updateZoomState();
        this.redraw();
    };
    ToolsMap.prototype.renderMapToBuffer = function () {
        if (!this.map || !this.info)
            return;
        var canvas = canvasUtils_1.createCanvas(this.map.width * constants_1.tileWidth, this.map.height * constants_1.tileHeight);
        if (this.type === 'regular') {
            drawTheMap(canvas, this.map, this.info, this.scale, this.grid);
        }
        else if (this.type === 'minimap') {
            drawMinimap(canvas, this.map, this.info, this.scale);
        }
        this.renderedMapCanvas = canvas;
    };
    ToolsMap.prototype.setType = function (type) {
        this.type = type;
        this.renderMapToBuffer();
        this.redraw();
    };
    ToolsMap.prototype.fetchList = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this;
                        return [4 /*yield*/, utils_1.observableToPromise(this.http.get('/api-tools/maps'))];
                    case 1:
                        _a.maps = _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // Публичный метод для генерации всех превьюшек при открытии дропдауна
    ToolsMap.prototype.generateAllPreviews = function () {
        var _this = this;
        var _loop_1 = function (map) {
            if (!this_1.mapPreviews[map] && !this_1.previewsGenerating.has(map)) {
                // Добавляем небольшую задержку между генерацией для избежания перегрузки
                setTimeout(function () { return _this.generateMapPreview(map); }, 50);
            }
        };
        var this_1 = this;
        for (var _i = 0, _a = this.maps; _i < _a.length; _i++) {
            var map = _a[_i];
            _loop_1(map);
        }
    };
    ToolsMap.prototype.generateMapPreview = function (mapName) {
        var _this = this;
        // Если превьюшка уже генерируется или кэширована, ничего не делаем
        if (this.previewsGenerating.has(mapName) || this.mapPreviews[mapName]) {
            return;
        }
        this.previewsGenerating.add(mapName);
        this.http.get('/api-tools/map', { params: { map: mapName } }).subscribe(function (mapData) {
            try {
                // Маленькие квадратики (50x50), но карта БОЛЬШАЯ внутри!
                var previewSize = 50;
                var mapWidth = mapData.width * constants_1.tileWidth;
                var mapHeight = mapData.height * constants_1.tileHeight;
                // Масштаб - карта БОЛЬШАЯ, не меньшил! Просто вписываем в квадрат
                var scale = previewSize / Math.min(mapWidth, mapHeight);
                // --- REGULAR VERSION ---
                var fullCanvas = canvasUtils_1.createCanvas(mapWidth, mapHeight);
                drawTheMap(fullCanvas, _this.createMapForPreview(mapData), mapData.info, 2, false);
                var regularPreviewCanvas = canvasUtils_1.createCanvas(previewSize, previewSize);
                var regularCtx = regularPreviewCanvas.getContext('2d');
                regularCtx.imageSmoothingEnabled = false;
                regularCtx.fillStyle = '#222222';
                regularCtx.fillRect(0, 0, previewSize, previewSize);
                // Карта БОЛЬШАЯ в левом верхнем углу
                regularCtx.scale(scale, scale);
                regularCtx.drawImage(fullCanvas, 0, 0);
                _this.mapPreviews[mapName] = regularPreviewCanvas.toDataURL('image/png');
                // --- MINIMAP VERSION ---
                var minimapCanvas = canvasUtils_1.createCanvas(mapWidth, mapHeight);
                drawMinimap(minimapCanvas, _this.createMapForPreview(mapData), mapData.info, 1);
                var minimapPreviewCanvas = canvasUtils_1.createCanvas(previewSize, previewSize);
                var minimapCtx = minimapPreviewCanvas.getContext('2d');
                minimapCtx.imageSmoothingEnabled = false;
                minimapCtx.fillStyle = '#222222';
                minimapCtx.fillRect(0, 0, previewSize, previewSize);
                // Мини-карта БОЛЬШАЯ в левом верхнем углу
                minimapCtx.scale(scale, scale);
                minimapCtx.drawImage(minimapCanvas, 0, 0);
                _this.mapMinimapPreviews[mapName] = minimapPreviewCanvas.toDataURL('image/png');
            }
            catch (error) {
                console.error("Failed to generate preview for map " + mapName + ":", error);
            }
            finally {
                _this.previewsGenerating["delete"](mapName);
            }
        }, function (error) {
            console.error("Failed to fetch map data for " + mapName + ":", error);
            _this.previewsGenerating["delete"](mapName);
        });
    };
    ToolsMap.prototype.createMapForPreview = function (mapData) {
        var regionsX = mapData.width / constants_1.REGION_SIZE;
        var regionsY = mapData.height / constants_1.REGION_SIZE;
        var type = mapData.type, defaultTile = mapData.defaultTile;
        var map = worldMap_1.createWorldMap({ type: type, flags: 0 /* None */, defaultTile: defaultTile, regionsX: regionsX, regionsY: regionsY });
        var tiles = compress_1.deserializeTiles(mapData.tiles);
        for (var y = 0, i = 0; y < regionsX; y++) {
            for (var x = 0; x < regionsY; x++, i++) {
                worldMap_1.setRegion(map, x, y, region_1.createRegion(x, y));
            }
        }
        for (var y = 0, i = 0; y < mapData.height; y++) {
            for (var x = 0; x < mapData.width; x++, i++) {
                worldMap_1.setTile(map, x, y, tiles[i]);
            }
        }
        return map;
    };
    ToolsMap.prototype.fetch = function () {
        var _this = this;
        this.http.get('/api-tools/map', { params: { map: this.selectedMap } }).subscribe(function (map) {
            _this.info = map.info;
            var regionsX = map.width / constants_1.REGION_SIZE;
            var regionsY = map.height / constants_1.REGION_SIZE;
            var type = map.type, defaultTile = map.defaultTile;
            _this.map = worldMap_1.createWorldMap({ type: type, flags: 0 /* None */, defaultTile: defaultTile, regionsX: regionsX, regionsY: regionsY });
            var tiles = compress_1.deserializeTiles(map.tiles);
            for (var y = 0, i = 0; y < regionsX; y++) {
                for (var x = 0; x < regionsY; x++, i++) {
                    worldMap_1.setRegion(_this.map, x, y, region_1.createRegion(x, y));
                }
            }
            for (var y = 0, i = 0; y < map.height; y++) {
                for (var x = 0; x < map.width; x++, i++) {
                    worldMap_1.setTile(_this.map, x, y, tiles[i]);
                }
            }
            _this.resetZoomPan();
            _this.renderMapToBuffer();
            _this.redraw(); // Немедленно перерисовываем экран с новой картой
            // Плавное отображение новой карты с crossfade эффектом
            _this.isMapLoading = false;
            // Даем время CSS переходу для отображения карты
            setTimeout(function () {
                _this.isMapLoaded = true;
            }, 50);
        });
    };
    ToolsMap.prototype.selectMap = function (map) {
        var _this = this;
        this.selectedMap = map;
        // Начинаем плавное исчезновение старой карты
        this.isMapLoaded = false;
        // Ждем завершения анимации исчезновения, потом загружаем новую
        setTimeout(function () {
            _this.isMapLoading = true;
            _this.showPlaceholder = false;
            _this.fetch();
        }, 300); // Время анимации исчезновения
    };
    ToolsMap.prototype.onGridChange = function (value) {
        this.grid = value;
        this.renderedMapCanvas = undefined; // invalidate cache
        this.renderMapToBuffer();
        this.redraw();
    };
    ToolsMap.prototype.zoomIn = function () {
        var newZoom = Math.min(this.maxZoom, this.zoomLevel * 1.2);
        this.zoomLevel = newZoom;
        this.updateZoomState();
        this.constrainPan();
        this.redraw();
    };
    ToolsMap.prototype.zoomOut = function () {
        var newZoom = Math.max(this.minZoom, this.zoomLevel * 0.8);
        this.zoomLevel = newZoom;
        this.updateZoomState();
        this.constrainPan();
        this.redraw();
    };
    ToolsMap.prototype.streamLive = function () {
        this.isStreaming = !this.isStreaming;
        if (this.isStreaming) {
            this.startStream();
        }
        else {
            this.stopStream();
        }
    };
    ToolsMap.prototype.startStream = function () {
        var _this = this;
        // Используем requestAnimationFrame для точного контроля FPS
        this.nextFrameTime = Date.now();
        var frameTime = 1000 / this.maxFpsLimit;
        var streamFrame = function () {
            var now = Date.now();
            // Проверяем, пришло ли время для следующего кадра
            if (now >= _this.nextFrameTime) {
                if (_this.selectedMap) {
                    _this.http.get('/api-tools/map', { params: { map: _this.selectedMap } }).subscribe(function (map) {
                        _this.info = map.info;
                        _this.updateGameTime();
                        // Перерисовываем только сущности без перезагрузки плиток
                        _this.renderMapToBuffer();
                        _this.redraw();
                        _this.frameCount++;
                    });
                }
                // Обновляем время следующего кадра с учетом текущего времени (предотвращает дрейф)
                _this.nextFrameTime = now + frameTime;
            }
            // Продолжаем поток, если он еще активен
            if (_this.isStreaming) {
                _this.streamInterval = requestAnimationFrame(streamFrame);
            }
        };
        this.streamInterval = requestAnimationFrame(streamFrame);
    };
    ToolsMap.prototype.stopStream = function () {
        if (this.streamInterval) {
            cancelAnimationFrame(this.streamInterval);
            this.streamInterval = undefined;
        }
    };
    ToolsMap.prototype.updateGameTime = function () {
        var elapsed = Date.now() - this.gameTimeBase;
        var gameTimeMs = (this.gameTimeStartOffset + elapsed) % timeUtils_1.DAY_LENGTH;
        this.gameTime = timeUtils_1.formatHourMinutes(gameTimeMs);
    };
    ToolsMap.prototype.startFpsCounter = function () {
        var _this = this;
        setInterval(function () {
            var fpsInterval = _this.fpsUpdateRate / 1000;
            _this.currentFps = Math.round(_this.frameCount / fpsInterval);
            _this.frameCount = 0;
        }, 1000);
    };
    ToolsMap.prototype.updateFps = function (newFps) {
        if (newFps >= 1 && newFps <= 60) {
            this.maxFpsLimit = newFps; // Обновляем лимит FPS
            this.fpsUpdateRate = Math.round(1000 / newFps);
            // Если стрим активен, перезапускаем его с новыми настройками FPS
            if (this.isStreaming) {
                this.stopStream();
                this.startStream();
            }
        }
    };
    ToolsMap.prototype.startServerTimeUpdate = function () {
        this.gameTimeBase = Date.now();
        this.gameTimeStartOffset = 6 * timeUtils_1.HOUR_LENGTH;
        this.updateGameTime();
    };
    ToolsMap.prototype.redraw = function () {
        this.draw();
    };
    ToolsMap.prototype.png = function () {
        if (this.renderedMapCanvas) {
            canvasUtils_1.saveCanvas(this.renderedMapCanvas, "map-" + (this.selectedMap || 'main') + ".png");
        }
    };
    ToolsMap.prototype.draw = function () {
        if (!this.renderedMapCanvas)
            return;
        var canvas = this.canvas.nativeElement;
        var ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        // Get container dimensions
        var container = this.canvasContainer && this.canvasContainer.nativeElement;
        var containerWidth = container && container.clientWidth || canvas.clientWidth || 800;
        var containerHeight = container && container.clientHeight || canvas.clientHeight || 600;
        // Set canvas size to container
        canvas.width = containerWidth;
        canvas.height = containerHeight;
        // Clear canvas
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Save and apply transform
        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.zoomLevel, this.zoomLevel);
        // Draw the rendered map
        ctx.drawImage(this.renderedMapCanvas, 0, 0);
        // Draw game time overlay if enabled
        if (this.showTimeOnMap) {
            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.lineWidth = 3;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            var timeText = this.gameTime;
            var x = this.renderedMapCanvas.width - 10;
            var y = 10;
            ctx.strokeText(timeText, x, y);
            ctx.fillText(timeText, x, y);
        }
        // Restore context
        ctx.restore();
    };
    ToolsMap.prototype.copyCanvasToClipboard = function () {
        if (this.renderedMapCanvas) {
            this.renderedMapCanvas.toBlob(function (blob) {
                if (blob) {
                    var clipboardData = { 'image/png': blob };
                    navigator.clipboard.write([
                        new window.ClipboardItem(clipboardData)
                    ]).then(function () {
                        console.log('Full map copied to clipboard!');
                    })["catch"](function (err) {
                        console.error('Failed to copy map to clipboard:', err);
                    });
                }
            }, 'image/png');
        }
    };
    __decorate([
        core_1.ViewChild('canvas', { static: true })
    ], ToolsMap.prototype, "canvas");
    __decorate([
        core_1.ViewChild('canvasContainer', { static: false })
    ], ToolsMap.prototype, "canvasContainer");
    ToolsMap = __decorate([
        core_1.Component({
            selector: 'tools-map',
            templateUrl: 'tools-map.pug',
            styleUrls: ['tools-map.scss']
        })
    ], ToolsMap);
    return ToolsMap;
}());
exports.ToolsMap = ToolsMap;
function drawTheMap(canvas, map, info, scale, grid) {
    var mapCanvas = contextSpriteBatch_1.drawCanvas(map.width * constants_1.tileWidth, map.height * constants_1.tileHeight, sprites_1.paletteSpriteSheet, 0x222222ff, function (batch) {
        var camera = camera_1.createCamera();
        camera.w = map.width * constants_1.tileWidth;
        camera.h = map.height * constants_1.tileHeight;
        var tileSets = tileUtils_1.createTileSets(ponyInfo_1.mockPaletteManager, info.season, map.type);
        var lightData = timeUtils_1.createLightData(info.season);
        var drawOptions = __assign(__assign({}, interfaces_1.defaultDrawOptions), { tileGrid: grid, shadowColor: timeUtils_1.getShadowColor(lightData, timeUtils_1.HOUR_LENGTH * 12), season: info.season });
        var ignoreTypes = [entities_1.cloud.type];
        var shouldDraw = function (e) {
            return !utils_1.hasFlag(e.flags, 16 /* Debug */) && !utils_1.includes(ignoreTypes, e.type);
        };
        map.entitiesDrawable = info.entities
            .map(function (_a) {
            var type = _a.type, id = _a.id, x = _a.x, y = _a.y;
            return entities_1.createAnEntity(type, id, x, y, {}, ponyInfo_1.mockPaletteManager, { season: info.season });
        })
            .filter(shouldDraw);
        worldMap_1.updateMap(map, 0);
        draw_1.drawMap(batch, map, camera, {}, drawOptions, tileSets, []);
    });
    canvas.width = Math.floor(mapCanvas.width / scale);
    canvas.height = Math.floor(mapCanvas.height / scale);
    var context = canvas.getContext('2d');
    // disableImageSmoothing(context);
    context.scale(1 / scale, 1 / scale);
    context.drawImage(mapCanvas, 0, 0);
}
function drawMinimap(canvas, map, info, scale) {
    var tileWidth = 1;
    var tileHeight = 1;
    var mapCanvas = canvasUtils_1.createCanvas(map.width * tileWidth, map.height * tileHeight);
    var mapContext = mapCanvas.getContext('2d');
    worldMap_1.updateMap(map, 0);
    for (var x = 0; x < map.width; x++) {
        for (var y = 0; y < map.height; y++) {
            var tile = worldMap_1.getTile(map, x, y);
            var color = colors_1.getTileColor(tile, info.season);
            mapContext.fillStyle = color_1.colorToCSS(color);
            mapContext.fillRect(x, y, 1, 1);
        }
    }
    map.entities = info.entities
        .map(function (_a) {
        var type = _a.type, id = _a.id, x = _a.x, y = _a.y;
        return entities_1.createAnEntity(type, id, x, y, {}, ponyInfo_1.mockPaletteManager, { season: info.season });
    });
    for (var i = 1; i <= 2; i++) {
        for (var _i = 0, _a = map.entities; _i < _a.length; _i++) {
            var e = _a[_i];
            if (e.minimap && e.minimap.order === i) {
                var _b = e.minimap, color = _b.color, rect = _b.rect;
                mapContext.fillStyle = color_1.colorToCSS(color);
                mapContext.fillRect(Math.round(e.x + rect.x), Math.round(e.y + rect.y), rect.w, rect.h);
            }
        }
    }
    canvas.width = mapCanvas.width * scale;
    canvas.height = mapCanvas.height * scale;
    var context = canvas.getContext('2d');
    context.save();
    if (scale >= 1) {
        canvasUtils_1.disableImageSmoothing(context);
    }
    context.scale(scale, scale);
    context.drawImage(mapCanvas, 0, 0);
    context.restore();
}
