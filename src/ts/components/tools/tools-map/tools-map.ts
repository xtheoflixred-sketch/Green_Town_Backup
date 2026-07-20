import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { saveCanvas, disableImageSmoothing, createCanvas } from '../../../client/canvasUtils';
import { loadAndInitSpriteSheets } from '../../../client/spriteUtils';
import { tileHeight, tileWidth, REGION_SIZE } from '../../../common/constants';
import { faHome, faSync, faImage, faSearch, faPlus, faMinus, faClock, faCog, faSpinner, faCopy } from '../../../client/icons';
import { updateMap, getTile, createWorldMap, setRegion, setTile } from '../../../common/worldMap';
import {
	Season, DrawOptions, defaultDrawOptions, EntityFlags, Entity, WorldMap, MapType, MapFlags
} from '../../../common/interfaces';
import { drawCanvas } from '../../../graphics/contextSpriteBatch';
import { paletteSpriteSheet } from '../../../generated/sprites';
import { createRegion } from '../../../common/region';
import { deserializeTiles } from '../../../common/compress';
import { createTileSets } from '../../../client/tileUtils';
import { createCamera } from '../../../common/camera';
import { mockPaletteManager } from '../../../common/ponyInfo';
import {
	createAnEntity, cloud
} from '../../../common/entities';
import { drawMap } from '../../../client/draw';
import { includes, observableToPromise, hasFlag } from '../../../common/utils';
import { getShadowColor, HOUR_LENGTH, createLightData, formatHourMinutes, DAY_LENGTH } from '../../../common/timeUtils';
import { StorageService } from '../../services/storageService';
import { Model } from '../../services/model';
import { getTileColor } from '../../../common/colors';
import { colorToCSS } from '../../../common/color';

export interface ToolsMapOtherInfo {
	season: Season;
	entities: { type: number; x: number; y: number; order: number; id: number; }[];
}

export interface ToolsMapInfo {
	width: number;
	height: number;
	defaultTile: number;
	tiles?: string;
	type: MapType;
	info: ToolsMapOtherInfo;
}

@Component({
	selector: 'tools-map',
	templateUrl: 'tools-map.pug',
	styleUrls: ['tools-map.scss'],
})
export class ToolsMap implements OnInit, OnDestroy {
	readonly homeIcon = faHome;
	readonly syncIcon = faSync;
	readonly imageIcon = faImage;
	readonly searchIcon = faSearch;
	readonly searchPlusIcon = faPlus;
	readonly searchMinusIcon = faMinus;
	readonly clockIcon = faClock;
	readonly cogIcon = faCog;
	readonly spinnerIcon = faSpinner;
	readonly copyIcon = faCopy;
	@ViewChild('canvas', { static: true }) canvas!: ElementRef;
	@ViewChild('canvasContainer', { static: false }) canvasContainer!: ElementRef;

	maps: string[] = [];
	mapPreviews: { [key: string]: string } = {}; // Кэш превьюшек карт (regular)
	mapMinimapPreviews: { [key: string]: string } = {}; // Кэш миникарт превьюшек
	previewsGenerating: Set<string> = new Set(); // Отслеживаем какие превьюшки генерируются
	selectedMap = '';
	grid = false;
	serverTime = '00:00';
	isStreaming = false;
	fpsCounter = 0;
	maxFpsLimit = 60; // Максимальный лимит FPS, установленный пользователем
	currentFps = 60; // Реальный текущий FPS
	fpsUpdateRate = 500;
	gameTime = '06:00';
	isMapLoaded = false;
	isMapLoading = false;
	showPlaceholder = true;
	showTimeOnMap = false; // Отображение времени суток на карте
	private gameTimeBase = 0;
	private frameCount = 0;
	private gameTimeStartOffset = 0;

	// Zoom & Pan
	zoomLevel = 1;
	offsetX = 0;
	offsetY = 0;
	minZoom = 0.5;
	maxZoom = 8;
	isDragging = false;
	lastMouseX = 0;
	lastMouseY = 0;
	lastTouchDistance = 0;
	cursorStyle = 'default';
	isAtMinZoom = false;
	isAtMaxZoom = false;

	private map?: WorldMap;
	private info?: ToolsMapOtherInfo;
	private renderedMapCanvas?: HTMLCanvasElement;
	private streamInterval?: any;
	private timeInterval?: any;
	private nextFrameTime = 0; // Для точного контроля FPS

	constructor(private http: HttpClient, private storage: StorageService, private model: Model) {
	}
	get scale() {
		return this.storage.getInt('tools-map-scale') || 1;
	}
	set scale(value) {
		this.storage.setInt('tools-map-scale', value);
		this.renderedMapCanvas = undefined; // invalidate cache
		this.renderMapToBuffer();
		this.redraw();
	}
	get type() {
		return this.storage.getItem('tools-map-type') || 'regular';
	}
	set type(value) {
		this.storage.setItem('tools-map-type', value);
	}
	get isBuilderOnly() {
		const roles = (this.model.account && this.model.account.roles) || [];
		return this.model.isBuilder && !this.model.isMod &&
			!roles.includes('dev') &&
			!roles.includes('admin');
	}
	async ngOnInit() {
		await loadAndInitSpriteSheets();
		await this.fetchList();
		await this.fetch();
		this.setupInteractivity();
		this.startServerTimeUpdate();
		this.startFpsCounter();
	}

	ngOnDestroy() {
		this.stopStream();
		if (this.timeInterval) {
			clearInterval(this.timeInterval);
		}
	}

	private setupInteractivity() {
		const container = this.canvasContainer && this.canvasContainer.nativeElement;
		if (!container) return;

		// Mouse wheel zoom
		container.addEventListener('wheel', (e: WheelEvent) => this.onMouseWheel(e), { passive: false });

		// Mouse drag
		container.addEventListener('mousedown', (e: MouseEvent) => this.onMouseDown(e));
		container.addEventListener('mousemove', (e: MouseEvent) => this.onMouseMove(e));
		container.addEventListener('mouseup', (e: MouseEvent) => this.onMouseUp(e));
		container.addEventListener('mouseleave', (e: MouseEvent) => this.onMouseLeave(e));

		// Double click reset
		container.addEventListener('dblclick', () => this.resetZoomPan());

		// Touch events
		container.addEventListener('touchstart', (e: TouchEvent) => this.onTouchStart(e), { passive: false });
		container.addEventListener('touchmove', (e: TouchEvent) => this.onTouchMove(e), { passive: false });
		container.addEventListener('touchend', (e: TouchEvent) => this.onTouchEnd(e));
	}

	private onMouseWheel(e: WheelEvent) {
		e.preventDefault();
		const container = this.canvasContainer && this.canvasContainer.nativeElement;
		if (!container) return;

		const rect = container.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		// Конвертируем позицию мыши в координаты карты (учитывая текущий масштаб и смещение)
		const mapX = (mouseX - this.offsetX) / this.zoomLevel;
		const mapY = (mouseY - this.offsetY) / this.zoomLevel;

		const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
		const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * zoomFactor));

		// Пересчитываем смещение так, чтобы масштабирование происходило относительно курсора
		this.offsetX = mouseX - mapX * newZoom;
		this.offsetY = mouseY - mapY * newZoom;

		this.zoomLevel = newZoom;
		this.updateZoomState();
		this.constrainPan();
		this.redraw();
	}

	private onMouseDown(e: MouseEvent) {
		this.isDragging = true;
		this.lastMouseX = e.clientX;
		this.lastMouseY = e.clientY;
		this.cursorStyle = 'grabbing';
	}

	private onMouseMove(e: MouseEvent) {
		if (this.isDragging) {
			const deltaX = e.clientX - this.lastMouseX;
			const deltaY = e.clientY - this.lastMouseY;
			this.offsetX += deltaX;
			this.offsetY += deltaY;
			this.lastMouseX = e.clientX;
			this.lastMouseY = e.clientY;
			this.constrainPan();
			this.redraw();
		} else {
			this.cursorStyle = this.zoomLevel < this.maxZoom ? 'grab' : 'default';
		}
	}

	private onMouseUp(_e: MouseEvent) {
		this.isDragging = false;
		this.cursorStyle = 'grab';
	}

	private onMouseLeave(_e: MouseEvent) {
		this.isDragging = false;
		this.cursorStyle = 'default';
	}

	private onTouchStart(e: TouchEvent) {
		e.preventDefault();
		if (e.touches.length === 1) {
			this.isDragging = true;
			this.lastMouseX = e.touches[0].clientX;
			this.lastMouseY = e.touches[0].clientY;
		} else if (e.touches.length === 2) {
			this.isDragging = false;
			this.lastTouchDistance = this.getDistance(e.touches[0], e.touches[1]);
		}
	}

	private onTouchMove(e: TouchEvent) {
		e.preventDefault();
		if (e.touches.length === 1 && this.isDragging) {
			const deltaX = e.touches[0].clientX - this.lastMouseX;
			const deltaY = e.touches[0].clientY - this.lastMouseY;
			this.offsetX += deltaX;
			this.offsetY += deltaY;
			this.lastMouseX = e.touches[0].clientX;
			this.lastMouseY = e.touches[0].clientY;
			this.constrainPan();
			this.redraw();
		} else if (e.touches.length === 2) {
			const distance = this.getDistance(e.touches[0], e.touches[1]);
			const zoomFactor = distance / this.lastTouchDistance;
			const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * zoomFactor));
			this.zoomLevel = newZoom;
			this.lastTouchDistance = distance;
			this.constrainPan();
			this.redraw();
		}
	}

	private onTouchEnd(e: TouchEvent) {
		if (e.touches.length < 2) {
			this.isDragging = false;
		}
	}

	private getDistance(touch1: Touch, touch2: Touch): number {
		const dx = touch1.clientX - touch2.clientX;
		const dy = touch1.clientY - touch2.clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}

	private constrainPan() {
		if (!this.renderedMapCanvas) return;

		const container = this.canvasContainer && this.canvasContainer.nativeElement;
		if (!container) return;

		const mapWidth = this.renderedMapCanvas.width * this.zoomLevel;
		const mapHeight = this.renderedMapCanvas.height * this.zoomLevel;
		const containerWidth = container.clientWidth;
		const containerHeight = container.clientHeight;

		// Если карта больше, чем контейнер, позволяем полную прокрутку
		// Если карта меньше контейнера, центрируем её
		const maxOffsetX = Math.max(0, mapWidth - containerWidth);
		const maxOffsetY = Math.max(0, mapHeight - containerHeight);
		const minOffsetX = -maxOffsetX;
		const minOffsetY = -maxOffsetY;

		this.offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, this.offsetX));
		this.offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, this.offsetY));
	}

	private updateZoomState() {
		this.isAtMinZoom = this.zoomLevel <= this.minZoom + 0.01;
		this.isAtMaxZoom = this.zoomLevel >= this.maxZoom - 0.01;
	}

	resetZoomPan() {
		this.zoomLevel = 1;
		this.offsetX = 0;
		this.offsetY = 0;
		this.updateZoomState();
		this.redraw();
	}

	private renderMapToBuffer() {
		if (!this.map || !this.info) return;

		const canvas = createCanvas(this.map.width * tileWidth, this.map.height * tileHeight);
		if (this.type === 'regular') {
			drawTheMap(canvas, this.map, this.info, this.scale, this.grid);
		} else if (this.type === 'minimap') {
			drawMinimap(canvas, this.map, this.info, this.scale);
		}

		this.renderedMapCanvas = canvas;
	}

	setType(type: string) {
		this.type = type;
		this.renderMapToBuffer();
		this.redraw();
	}
	async fetchList() {
		this.maps = await observableToPromise(this.http.get<string[]>('/api-tools/maps'));
		// НЕ генерируем превьюшки сразу - это вызовет лаги
		// Превьюшки будут генерироваться лениво при открытии дропдауна
	}

	// Публичный метод для генерации всех превьюшек при открытии дропдауна
	generateAllPreviews() {
		for (const map of this.maps) {
			if (!this.mapPreviews[map] && !this.previewsGenerating.has(map)) {
				// Добавляем небольшую задержку между генерацией для избежания перегрузки
				setTimeout(() => this.generateMapPreview(map), 50);
			}
		}
	}

	private generateMapPreview(mapName: string) {
		// Если превьюшка уже генерируется или кэширована, ничего не делаем
		if (this.previewsGenerating.has(mapName) || this.mapPreviews[mapName]) {
			return;
		}

		this.previewsGenerating.add(mapName);

		this.http.get<ToolsMapInfo>('/api-tools/map', { params: { map: mapName } }).subscribe(mapData => {
			try {
				// Маленькие квадратики (50x50), но карта БОЛЬШАЯ внутри!
				const previewSize = 50;
				
				const mapWidth = mapData.width * tileWidth;
				const mapHeight = mapData.height * tileHeight;
				
				// Масштаб - карта БОЛЬШАЯ, не меньшил! Просто вписываем в квадрат
				const scale = previewSize / Math.min(mapWidth, mapHeight);

				// --- REGULAR VERSION ---
				const fullCanvas = createCanvas(mapWidth, mapHeight);
				drawTheMap(fullCanvas, this.createMapForPreview(mapData), mapData.info, 2, false);

				const regularPreviewCanvas = createCanvas(previewSize, previewSize);
				const regularCtx = regularPreviewCanvas.getContext('2d')!;
				regularCtx.imageSmoothingEnabled = false;
				regularCtx.fillStyle = '#222222';
				regularCtx.fillRect(0, 0, previewSize, previewSize);

				// Карта БОЛЬШАЯ в левом верхнем углу
				regularCtx.scale(scale, scale);
				regularCtx.drawImage(fullCanvas, 0, 0);

				this.mapPreviews[mapName] = regularPreviewCanvas.toDataURL('image/png');

				// --- MINIMAP VERSION ---
				const minimapCanvas = createCanvas(mapWidth, mapHeight);
				drawMinimap(minimapCanvas, this.createMapForPreview(mapData), mapData.info, 1);

				const minimapPreviewCanvas = createCanvas(previewSize, previewSize);
				const minimapCtx = minimapPreviewCanvas.getContext('2d')!;
				minimapCtx.imageSmoothingEnabled = false;
				minimapCtx.fillStyle = '#222222';
				minimapCtx.fillRect(0, 0, previewSize, previewSize);

				// Мини-карта БОЛЬШАЯ в левом верхнем углу
				minimapCtx.scale(scale, scale);
				minimapCtx.drawImage(minimapCanvas, 0, 0);

				this.mapMinimapPreviews[mapName] = minimapPreviewCanvas.toDataURL('image/png');
			} catch (error) {
				console.error(`Failed to generate preview for map ${mapName}:`, error);
			} finally {
				this.previewsGenerating.delete(mapName);
			}
		}, error => {
			console.error(`Failed to fetch map data for ${mapName}:`, error);
			this.previewsGenerating.delete(mapName);
		});
	}

	private createMapForPreview(mapData: ToolsMapInfo): WorldMap {
		const regionsX = mapData.width / REGION_SIZE;
		const regionsY = mapData.height / REGION_SIZE;
		const { type, defaultTile } = mapData;

		const map = createWorldMap({ type, flags: MapFlags.None, defaultTile, regionsX, regionsY });
		const tiles = deserializeTiles(mapData.tiles!);

		for (let y = 0, i = 0; y < regionsX; y++) {
			for (let x = 0; x < regionsY; x++ , i++) {
				setRegion(map, x, y, createRegion(x, y));
			}
		}

		for (let y = 0, i = 0; y < mapData.height; y++) {
			for (let x = 0; x < mapData.width; x++ , i++) {
				setTile(map, x, y, tiles[i]);
			}
		}

		return map;
	}
	fetch() {
		this.http.get<ToolsMapInfo>('/api-tools/map', { params: { map: this.selectedMap } }).subscribe(map => {
			this.info = map.info;

			const regionsX = map.width / REGION_SIZE;
			const regionsY = map.height / REGION_SIZE;
			const { type, defaultTile } = map;

			this.map = createWorldMap({ type, flags: MapFlags.None, defaultTile, regionsX, regionsY });
			const tiles = deserializeTiles(map.tiles!);

			for (let y = 0, i = 0; y < regionsX; y++) {
				for (let x = 0; x < regionsY; x++ , i++) {
					setRegion(this.map, x, y, createRegion(x, y));
				}
			}

			for (let y = 0, i = 0; y < map.height; y++) {
				for (let x = 0; x < map.width; x++ , i++) {
					setTile(this.map, x, y, tiles[i]);
				}
			}

			this.resetZoomPan();
			this.renderMapToBuffer();
			this.redraw(); // Немедленно перерисовываем экран с новой картой
			// Плавное отображение новой карты с crossfade эффектом
			this.isMapLoading = false;
			// Даем время CSS переходу для отображения карты
			setTimeout(() => {
				this.isMapLoaded = true;
			}, 50);
		});
	}

	selectMap(map: string) {
		this.selectedMap = map;
		// Начинаем плавное исчезновение старой карты
		this.isMapLoaded = false;
		// Ждем завершения анимации исчезновения, потом загружаем новую
		setTimeout(() => {
			this.isMapLoading = true;
			this.showPlaceholder = false;
			this.fetch();
		}, 300); // Время анимации исчезновения
	}

	onGridChange(value: boolean) {
		this.grid = value;
		this.renderedMapCanvas = undefined; // invalidate cache
		this.renderMapToBuffer();
		this.redraw();
	}

	zoomIn() {
		const newZoom = Math.min(this.maxZoom, this.zoomLevel * 1.2);
		this.zoomLevel = newZoom;
		this.updateZoomState();
		this.constrainPan();
		this.redraw();
	}

	zoomOut() {
		const newZoom = Math.max(this.minZoom, this.zoomLevel * 0.8);
		this.zoomLevel = newZoom;
		this.updateZoomState();
		this.constrainPan();
		this.redraw();
	}

	streamLive() {
		this.isStreaming = !this.isStreaming;
		if (this.isStreaming) {
			this.startStream();
		} else {
			this.stopStream();
		}
	}

	private startStream() {
		// Используем requestAnimationFrame для точного контроля FPS
		this.nextFrameTime = Date.now();
		const frameTime = 1000 / this.maxFpsLimit;
		
		const streamFrame = () => {
			const now = Date.now();
			
			// Проверяем, пришло ли время для следующего кадра
			if (now >= this.nextFrameTime) {
				if (this.selectedMap) {
					this.http.get<ToolsMapInfo>('/api-tools/map', { params: { map: this.selectedMap } }).subscribe(map => {
						this.info = map.info;
						this.updateGameTime();
						// Перерисовываем только сущности без перезагрузки плиток
						this.renderMapToBuffer();
						this.redraw();
						this.frameCount++;
					});
				}
				
				// Обновляем время следующего кадра с учетом текущего времени (предотвращает дрейф)
				this.nextFrameTime = now + frameTime;
			}
			
			// Продолжаем поток, если он еще активен
			if (this.isStreaming) {
				this.streamInterval = requestAnimationFrame(streamFrame);
			}
		};
		
		this.streamInterval = requestAnimationFrame(streamFrame);
	}

	private stopStream() {
		if (this.streamInterval) {
			cancelAnimationFrame(this.streamInterval);
			this.streamInterval = undefined;
		}
	}

	private updateGameTime() {
		const elapsed = Date.now() - this.gameTimeBase;
		const gameTimeMs = (this.gameTimeStartOffset + elapsed) % DAY_LENGTH;
		this.gameTime = formatHourMinutes(gameTimeMs);
	}

	private startFpsCounter() {
		setInterval(() => {
			const fpsInterval = this.fpsUpdateRate / 1000;
			this.currentFps = Math.round(this.frameCount / fpsInterval);
			this.frameCount = 0;
		}, 1000);
	}

	updateFps(newFps: number) {
		if (newFps >= 1 && newFps <= 60) {
			this.maxFpsLimit = newFps; // Обновляем лимит FPS
			this.fpsUpdateRate = Math.round(1000 / newFps);
			
			// Если стрим активен, перезапускаем его с новыми настройками FPS
			if (this.isStreaming) {
				this.stopStream();
				this.startStream();
			}
		}
	}

	private startServerTimeUpdate() {
		this.gameTimeBase = Date.now();
		this.gameTimeStartOffset = 6 * HOUR_LENGTH;
		this.updateGameTime();
	}

	redraw() {
		this.draw();
	}
	png() {
		if (this.renderedMapCanvas) {
			saveCanvas(this.renderedMapCanvas, `map-${this.selectedMap || 'main'}.png`);
		}
	}
	private draw() {
		if (!this.renderedMapCanvas) return;

		const canvas = this.canvas.nativeElement as HTMLCanvasElement;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Get container dimensions
		const container = this.canvasContainer && this.canvasContainer.nativeElement;
		const containerWidth = container && container.clientWidth || canvas.clientWidth || 800;
		const containerHeight = container && container.clientHeight || canvas.clientHeight || 600;

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
			const timeText = this.gameTime;
			const x = this.renderedMapCanvas.width - 10;
			const y = 10;
			
			ctx.strokeText(timeText, x, y);
			ctx.fillText(timeText, x, y);
		}

		// Restore context
		ctx.restore();
	}

	copyCanvasToClipboard() {
		if (this.renderedMapCanvas) {
			this.renderedMapCanvas.toBlob(blob => {
				if (blob) {
					const clipboardData = { 'image/png': blob } as Record<string, Blob>;
					(navigator.clipboard as any).write([
						new (window as any).ClipboardItem(clipboardData)
					]).then(() => {
						console.log('Full map copied to clipboard!');
					}).catch((err: Error) => {
						console.error('Failed to copy map to clipboard:', err);
					});
				}
			}, 'image/png');
		}
	}
}

function drawTheMap(
	canvas: HTMLCanvasElement,
	map: WorldMap,
	info: ToolsMapOtherInfo,
	scale: number,
	grid: boolean
) {
	const mapCanvas = drawCanvas(map.width * tileWidth, map.height * tileHeight, paletteSpriteSheet, 0x222222ff, batch => {
		const camera = createCamera();
		camera.w = map.width * tileWidth;
		camera.h = map.height * tileHeight;

		const tileSets = createTileSets(mockPaletteManager, info.season, map.type);
		const lightData = createLightData(info.season);

		const drawOptions: DrawOptions = {
			...defaultDrawOptions,
			tileGrid: grid,
			shadowColor: getShadowColor(lightData, HOUR_LENGTH * 12),
			season: info.season
		};

		const ignoreTypes: number[] = [cloud.type];

		const shouldDraw = (e: Entity) => {
			return !hasFlag(e.flags, EntityFlags.Debug) && !includes(ignoreTypes, e.type);
		};

		map.entitiesDrawable = info.entities
			.map(({ type, id, x, y }) => createAnEntity(type, id, x, y, {}, mockPaletteManager, { season: info.season }))
			.filter(shouldDraw);

		updateMap(map, 0);
		drawMap(batch, map, camera, {} as any, drawOptions, tileSets, []);
	});

	canvas.width = Math.floor(mapCanvas.width / scale);
	canvas.height = Math.floor(mapCanvas.height / scale);
	const context = canvas.getContext('2d')!;
	// disableImageSmoothing(context);
	context.scale(1 / scale, 1 / scale);
	context.drawImage(mapCanvas, 0, 0);
}

function drawMinimap(canvas: HTMLCanvasElement, map: WorldMap, info: ToolsMapOtherInfo, scale: number) {
	const tileWidth = 1;
	const tileHeight = 1;

	const mapCanvas = createCanvas(map.width * tileWidth, map.height * tileHeight);
	const mapContext = mapCanvas.getContext('2d')!;

	updateMap(map, 0);

	for (let x = 0; x < map.width; x++) {
		for (let y = 0; y < map.height; y++) {
			const tile = getTile(map, x, y);
			const color = getTileColor(tile, info.season);
			mapContext.fillStyle = colorToCSS(color);
			mapContext.fillRect(x, y, 1, 1);
		}
	}

	map.entities = info.entities
		.map(({ type, id, x, y }) => createAnEntity(type, id, x, y, {}, mockPaletteManager, { season: info.season }));

	for (let i = 1; i <= 2; i++) {
		for (const e of map.entities) {
			if (e.minimap && e.minimap.order === i) {
				const { color, rect } = e.minimap;
				mapContext.fillStyle = colorToCSS(color);
				mapContext.fillRect(Math.round(e.x + rect.x), Math.round(e.y + rect.y), rect.w, rect.h);
			}
		}
	}

	canvas.width = mapCanvas.width * scale;
	canvas.height = mapCanvas.height * scale;
	const context = canvas.getContext('2d')!;
	context.save();

	if (scale >= 1) {
		disableImageSmoothing(context);
	}

	context.scale(scale, scale);
	context.drawImage(mapCanvas, 0, 0);
	context.restore();
}