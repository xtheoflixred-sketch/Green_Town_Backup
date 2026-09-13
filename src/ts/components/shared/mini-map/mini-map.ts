import { Component, ElementRef, Input, ViewChild, AfterViewChecked, OnInit, OnDestroy, SimpleChanges, OnChanges } from '@angular/core';
import { PonyTownGame } from '../../../client/game';
import { faMap, faPlus, faMinus, faUsers, faExpand } from '../../../client/icons';
import { PONY_TYPE } from '../../../common/constants';
import { Subscription } from 'rxjs';

@Component({
	selector: 'mini-map',
	templateUrl: 'mini-map.pug',
	styleUrls: ['mini-map.scss'],
})
export class MiniMap implements AfterViewChecked, OnInit, OnDestroy, OnChanges {
	@Input() game!: PonyTownGame;
	@Input() playing = false;
	@ViewChild('miniMapCanvas', { static: false }) miniMapCanvas?: ElementRef<HTMLCanvasElement>;

	miniMapSize = 180;
	miniMapHidePublicPlayers = false;
	miniMapZoom = 1;
	private lastRenderSignature = '';
	private minimapCameraX = 0;
	private minimapCameraY = 0;
	private knownPlayers = new Map<number, { x: number; y: number; }>();
	private lastMinimapSignature = '';
	private lastMinimapRef: any = undefined;
	private lastMinimapDataRef: any = undefined;
	private mapChangedSubscription: Subscription | undefined;
	private minimapUpdatedSubscription: Subscription | undefined;
	private forceNextRender = false;

	readonly mapIcon = faMap;
	readonly plusIcon = faPlus;
	readonly minusIcon = faMinus;
	readonly usersIcon = faUsers;
	readonly expandIcon = faExpand;

	get showPanel() {
		return this.playing && !!this.game && this.game.showMinimap && !!this.game.minimap;
	}

	toggleMiniMap() {
		if (this.game) this.game.debugToggleMinimap();
	}

	zoomMiniMapIn() {
		this.miniMapZoom = Math.min(12, this.miniMapZoom + 1);
		this.miniMapSize = Math.min(320, this.miniMapSize + 24);
	}

	zoomMiniMapOut() {
		this.miniMapZoom = Math.max(1, this.miniMapZoom - 1);
		this.miniMapSize = Math.max(180, this.miniMapSize - 24);
	}

	maximizeMiniMap() {
		this.miniMapZoom = 12;
		this.miniMapSize = 320;
	}

	toggleMiniMapPlayers() {
		this.miniMapHidePublicPlayers = !this.miniMapHidePublicPlayers;
	}

	ngOnInit() {
		if (this.game) {
			this.mapChangedSubscription = this.game.onMapChanged.subscribe(() => {
				this.resetMinimapState();
				this.forceNextRender = true;
			});
			this.minimapUpdatedSubscription = this.game.onMinimapUpdated.subscribe(() => {
				this.lastRenderSignature = '';
				this.minimapCameraX = 0;
				this.minimapCameraY = 0;
				this.knownPlayers.clear();
				this.forceNextRender = true;
			});
		}
	}

	ngOnChanges(changes: SimpleChanges) {
		if (changes['game'] && !changes['game'].firstChange) {
			this.resetMinimapState();
		}
	}

	ngOnDestroy() {
		if (this.mapChangedSubscription) {
			this.mapChangedSubscription.unsubscribe();
		}
		if (this.minimapUpdatedSubscription) {
			this.minimapUpdatedSubscription.unsubscribe();
		}
	}

	private resetMinimapState() {
		this.minimapCameraX = 0;
		this.minimapCameraY = 0;
		this.knownPlayers.clear();
		this.lastMinimapSignature = '';
		this.lastMinimapRef = undefined;
		this.lastMinimapDataRef = undefined;
		this.lastRenderSignature = '';
		this.forceNextRender = true;
	}

	ngAfterViewChecked() {
		this.syncPlayerCache();
		this.renderMiniMapCanvas();
	}

	private syncPlayerCache() {
		if (!this.game || !this.game.map || !this.game.map.entities) return;

		for (const entity of this.game.map.entities) {
			if ((entity as any).type === PONY_TYPE && entity.id !== this.game.playerId && entity.x !== undefined && entity.y !== undefined) {
				this.knownPlayers.set(entity.id, { x: entity.x, y: entity.y });
			}
		}
	}

	private renderMiniMapCanvas() {
		const canvas = this.miniMapCanvas && this.miniMapCanvas.nativeElement;
		if (!canvas || !this.game || !this.game.minimap) return;

		const { width, height, data } = this.game.minimap;
		const currentMinimapSignature = `${width}x${height}`;

		// Detect if minimap data reference changed (new map loaded)
		if (this.lastMinimapDataRef !== data) {
			this.lastMinimapDataRef = data;
			this.lastMinimapRef = this.game.minimap;
			this.lastMinimapSignature = '';
			this.minimapCameraX = 0;
			this.minimapCameraY = 0;
			this.knownPlayers.clear();
			this.lastRenderSignature = '';
			this.forceNextRender = true;
		}

		// Detect if minimap reference changed (new map loaded)
		if (this.lastMinimapRef !== this.game.minimap) {
			this.lastMinimapRef = this.game.minimap;
			this.lastMinimapSignature = '';
			this.minimapCameraX = 0;
			this.minimapCameraY = 0;
			this.knownPlayers.clear();
			this.lastRenderSignature = '';
			this.forceNextRender = true;
		}

		// Detect location change (minimap dimensions changed)
		if (this.lastMinimapSignature !== currentMinimapSignature) {
			this.lastMinimapSignature = currentMinimapSignature;
			// Reset camera on dimension change
			this.minimapCameraX = 0;
			this.minimapCameraY = 0;
			this.knownPlayers.clear();
			this.lastRenderSignature = '';
		}

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const player = this.game.player;
		const playerX = player ? player.x : width / 2;
		const playerY = player ? player.y : height / 2;
		if (player && (this.minimapCameraX === 0 && this.minimapCameraY === 0)) {
			this.minimapCameraX = player.x;
			this.minimapCameraY = player.y;
		}
		const renderSignature = [this.miniMapSize, this.miniMapZoom, width, height, playerX, playerY, this.miniMapHidePublicPlayers].join('|');
		if (!this.forceNextRender && this.lastRenderSignature === renderSignature && this.minimapCameraX !== 0 && this.minimapCameraY !== 0) return;
		this.forceNextRender = false;
		this.lastRenderSignature = renderSignature;

		const renderScale = 2;
		canvas.width = this.miniMapSize * renderScale;
		canvas.height = this.miniMapSize * renderScale;
		ctx.imageSmoothingEnabled = false;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = '#0d1d16';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		const targetZoom = Math.max(1, this.miniMapZoom);
		const cropWidth = Math.min(width, Math.max(32, Math.floor(width / targetZoom)));
		const cropHeight = Math.min(height, Math.max(32, Math.floor(height / targetZoom)));
		const followX = player ? player.x : width / 2;
		const followY = player ? player.y : height / 2;
		const smoothing = 0.18;
		this.minimapCameraX += (followX - this.minimapCameraX) * smoothing;
		this.minimapCameraY += (followY - this.minimapCameraY) * smoothing;
		const centerX = Math.max(cropWidth / 2, Math.min(this.minimapCameraX, width - cropWidth / 2));
		const centerY = Math.max(cropHeight / 2, Math.min(this.minimapCameraY, height - cropHeight / 2));
		const sourceX = Math.max(0, Math.min(width - cropWidth, centerX - cropWidth / 2));
		const sourceY = Math.max(0, Math.min(height - cropHeight, centerY - cropHeight / 2));
		const scale = Math.min(canvas.width / cropWidth, canvas.height / cropHeight);
		const drawWidth = cropWidth * scale;
		const drawHeight = cropHeight * scale;
		const offsetX = (canvas.width - drawWidth) / 2;
		const offsetY = (canvas.height - drawHeight) / 2;

		const renderCanvas = document.createElement('canvas');
		renderCanvas.width = cropWidth;
		renderCanvas.height = cropHeight;
		const renderCtx = renderCanvas.getContext('2d');
		if (!renderCtx) return;

		const imageData = renderCtx.createImageData(cropWidth, cropHeight);
		for (let y = 0; y < cropHeight; y++) {
			const worldY = Math.floor(sourceY + y);
			const rowBase = worldY * width;
			for (let x = 0; x < cropWidth; x++) {
				const worldX = Math.floor(sourceX + x);
				const color = data[rowBase + worldX] >>> 0;
				const index = (y * cropWidth + x) * 4;
				imageData.data[index] = (color >>> 24) & 0xff;
				imageData.data[index + 1] = (color >>> 16) & 0xff;
				imageData.data[index + 2] = (color >>> 8) & 0xff;
				imageData.data[index + 3] = color & 0xff;
			}
		}
		renderCtx.putImageData(imageData, 0, 0);
		ctx.drawImage(renderCanvas, offsetX, offsetY, drawWidth, drawHeight);

		const zoomFactor = Math.min(2.6, 0.9 + this.miniMapZoom * 0.35);
		const playerMarkerRadius = 5.5 * zoomFactor;
		const otherPlayerRadius = 4.8 * zoomFactor;
		const playerCoreRadius = 3.1 * zoomFactor;

		if (!this.miniMapHidePublicPlayers) {
			this.knownPlayers.forEach(player => {
				if (!player || player.x === undefined || player.y === undefined) return;
				const px = offsetX + (player.x - sourceX) * scale;
				const py = offsetY + (player.y - sourceY) * scale;
				ctx.beginPath();
				ctx.fillStyle = 'rgba(255,255,255,0.45)';
				ctx.arc(px, py, otherPlayerRadius, 0, Math.PI * 2);
				ctx.fill();
			});
		}

		if (player) {
			const px = offsetX + (player.x - sourceX) * scale;
			const py = offsetY + (player.y - sourceY) * scale;
			ctx.beginPath();
			ctx.fillStyle = 'rgba(255,255,255,0.9)';
			ctx.arc(px, py, playerMarkerRadius, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.fillStyle = '#f97316';
			ctx.arc(px, py, playerCoreRadius, 0, Math.PI * 2);
			ctx.fill();
		}
	}
}
