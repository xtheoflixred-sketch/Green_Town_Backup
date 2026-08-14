import { Component, ElementRef, NgZone, QueryList, TemplateRef, ViewChild, ViewChildren, OnInit, OnDestroy } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Subscription } from 'rxjs';
import { uniq } from 'lodash';
import { entityButtonAction } from '../../../client/buttonActions';
import { faBroom, faTools, faArrowsAlt, faCog, faExchangeAlt, faDrawPolygon, faTrash, emptyIcon, faCheck, faClone, faCopy, faArchway, faHammer, faGlobeAsia, faUpload, faPalette, faSnowflake } from '../../../client/icons';
import { PonyTownGame, engines } from '../../../client/game';
import { StorageService } from '../../services/storageService';
import { Model, getEntityNameFromType, getEntityNames, getEntityTypesFromName } from '../../services/model';
import { getAlpha, withAlpha, colorToHexRGB, parseColor } from '../../../common/color';
import { BLACK } from '../../../common/colors';
import { Entity, Engine, EngineInfo, DebugFlags, tileTypeNames, EntityButtonAction, Action, TileType, houseTiles } from '../../../common/interfaces';
import { CUSTOM_IMAGE_TYPE } from '../../../common/entities';

@Component({
	selector: 'editor-box',
	templateUrl: 'editor-box.pug',
	styleUrls: ['editor-box.scss'],
})
export class EditorBox implements OnInit, OnDestroy {
	readonly dev = DEVELOPMENT;
	readonly cogIcon = faCog;
	readonly editIcon = faTools;
	readonly selectIcon = faDrawPolygon;
	readonly deleteIcon = faTrash;
	readonly broomIcon = faBroom;
	readonly ropeIcon = faArrowsAlt;
	readonly pickaxeIcon = faCopy;
	readonly sawIcon = faArchway;
	readonly shovelIcon = faGlobeAsia;
	readonly hammerIcon = faHammer;
	readonly scrapIcon = faExchangeAlt;
	readonly recolorIcon = faPalette;
	readonly seasonIcon = faSnowflake;
	readonly duplicateIcon = faClone;
	readonly uploadIcon = faUpload;
	readonly showFields: Array<{ field: keyof DebugFlags; label: string }> = [
		{ field: 'id', label: 'id' },
		{ field: 'bounds', label: 'bounds' },
		{ field: 'collider', label: 'collider' },
		{ field: 'cover', label: 'cover' },
		{ field: 'interact', label: 'interact' },
		{ field: 'trigger', label: 'trigger' },
		{ field: 'itemTrigger', label: 'item trigger' },
	];
	duplicateEntities() {
		const entities = this.editor.selectedEntities.map(e => e.id);
		this.game.send(server => server.editorAction({ type: 'duplicate', entities }));
	}
	readonly checkIcon = faCheck;
	readonly emptyIcon = emptyIcon;
	readonly tiles = ['---', ...tileTypeNames];
	readonly engines = engines;
	readonly editorEntities: string[];
	readonly entityPreviewActions = new Map<string, EntityButtonAction>();
	@ViewChild('entityPickerModal', { static: true }) entityPickerModalTpl!: TemplateRef<any>;
	@ViewChildren('entityItemButton') entityItemButtons?: QueryList<ElementRef<HTMLElement>>;
	entityPickerModalRef?: BsModalRef;
	entitySearch = '';
	pendingEditorEntity = '';
	private showEditor = false;
	private scaleSendTimer: any = null;
	private opacitySendTimer: any = null;
	private spriteTintSendTimer: any = null;
	private _originalBounds = new WeakMap<any, any>();
	private _originalInteractBounds = new WeakMap<any, any>();
	private _originalChatBounds = new WeakMap<any, any>();
	private _originalLightBounds = new WeakMap<any, any>();
	private _originalLightSpriteBounds = new WeakMap<any, any>();
	private _leftSubscription?: Subscription;
	constructor(
		public model: Model,
		private game: PonyTownGame,
		private storage: StorageService,
		private zone: NgZone,
		private modalService: BsModalService,
	) {
		this.game.editor.type = this.storage.getItem('editor-entity') || 'rock';
		this.showEditor = this.storage.getBoolean('show-editor');
		if (!this.showEditor) {
			this.game.editor.useEditorHammer = false;
		}
		this.editorEntities = getEntityNames().slice().sort();
		this.game.editor.entityNames = [...this.editorEntities];
		const entityTypesByName: { [name: string]: number[]; } = {};
		for (const entity of this.editorEntities) {
			const types = getEntityTypesFromName(entity);
			if (types && types.length) {
				entityTypesByName[entity] = [...types];
			}
		}
		this.game.editor.entityTypesByName = entityTypesByName;

		for (const entity of this.editorEntities) {
			this.entityPreviewActions.set(entity, entityButtonAction(entity));
		}
	}
	ngOnInit() {
		this._leftSubscription = this.game.onLeft.subscribe(() => this.closeEditor());
	}
	ngOnDestroy() {
		this._leftSubscription && this._leftSubscription.unsubscribe();
	}
	private closeEditor() {
		if (this.showEditor) {
			this.zone.run(() => {
				this.showEditor = false;
				this.game.editor.useEditorHammer = false;
				this.game.editor.useEditorBroom = false;
				this.game.editor.useEditorRope = false;
				this.game.editor.useEditorPickaxe = false;
				this.game.editor.useEditorSaw = false;
				this.game.editor.useEditorScrap = false;
				this.game.editor.useEditorRecolor = false;
				this.game.editor.useEditorSeason = false;
				this.game.editor.useEditorShovel = false;
				this.game.editor.tile = -1;
				this.game.editor.selectingEntities = false;
				this.game.editor.selectedEntities.length = 0;
				this.storage.setBoolean('show-editor', false);
			});
		}
	}
	get editor() {
		return this.game.editor;
	}
	get hasElevation() {
		return this.game.engine === Engine.LayeredTiles;
	}
	get editorElevation() {
		return this.game.editor.elevation;
	}
	get editorSpecial() {
		return this.game.editor.special;
	}
	get editorEntity() {
		return this.game.editor.type;
	}
	set editorEntity(value: string) {
		this.game.editor.type = value;
		this.game.editor.useEditorHammer = true;
		this.game.editor.useEditorBroom = false;
		this.game.editor.useEditorRope = false;
		this.game.editor.useEditorPickaxe = false;
		this.game.editor.useEditorSaw = false;
		this.game.editor.useEditorScrap = false;
		this.game.editor.useEditorRecolor = false;
		this.game.editor.useEditorSeason = false;
		this.storage.setItem('editor-entity', value);
	}
	get useEditorBroom() {
		return this.game.editor.useEditorBroom;
	}
	set useEditorBroom(value: boolean) {
		this.game.editor.useEditorBroom = value;
		if (value) {
			this.game.editor.useEditorHammer = false;
			this.game.editor.useEditorRope = false;
			this.game.editor.useEditorPickaxe = false;
			this.game.editor.useEditorSaw = false;
			this.game.editor.useEditorScrap = false;
		this.game.editor.useEditorRecolor = false;
		this.game.editor.useEditorSeason = false;
			this.game.send(server => server.action(Action.SwitchToBroomTool));
		} else {
			this.game.send(server => server.action(Action.Drop));
		}
	}
	get useEditorRope() {
		return this.game.editor.useEditorRope;
	}
	set useEditorRope(value: boolean) {
		this.game.editor.useEditorRope = value;
		if (value) {
			this.game.editor.useEditorHammer = false;
			this.game.editor.useEditorBroom = false;
			this.game.editor.useEditorPickaxe = false;
			this.game.editor.useEditorSaw = false;
			this.game.editor.useEditorScrap = false;
		this.game.editor.useEditorRecolor = false;
		this.game.editor.useEditorSeason = false;
			this.game.send(server => server.action(Action.SwitchToRopeTool));
		} else {
			this.game.send(server => server.action(Action.Drop));
		}
	}
	get useEditorPickaxe() {
		return this.game.editor.useEditorPickaxe;
	}
	set useEditorPickaxe(value: boolean) {
		this.game.editor.useEditorPickaxe = value;
		if (value) {
			this.game.editor.useEditorHammer = false;
			this.game.editor.useEditorBroom = false;
			this.game.editor.useEditorRope = false;
			this.game.editor.useEditorSaw = false;
			this.game.editor.useEditorScrap = false;
		this.game.editor.useEditorRecolor = false;
		this.game.editor.useEditorSeason = false;
			this.game.send(server => server.action(Action.SwitchToPickaxeTool));
		} else {
			this.game.send(server => server.action(Action.Drop));
		}
	}
	get useEditorSaw() {
		return this.game.editor.useEditorSaw;
	}
	set useEditorSaw(value: boolean) {
		this.game.editor.useEditorSaw = value;
		if (value) {
			this.game.editor.useEditorHammer = false;
			this.game.editor.useEditorBroom = false;
			this.game.editor.useEditorRope = false;
			this.game.editor.useEditorPickaxe = false;
			this.game.editor.useEditorScrap = false;
		this.game.editor.useEditorRecolor = false;
		this.game.editor.useEditorSeason = false;
			this.game.send(server => server.action(Action.SwitchToSawTool));
		} else {
			this.game.send(server => server.action(Action.Drop));
		}
	}
	get useEditorScrap() {
		return this.game.editor.useEditorScrap;
	}
	set useEditorScrap(value: boolean) {
		this.game.editor.useEditorScrap = value;
		if (value) {
			this.game.editor.useEditorHammer = false;
			this.game.editor.useEditorBroom = false;
			this.game.editor.useEditorRope = false;
			this.game.editor.useEditorPickaxe = false;
			this.game.editor.useEditorSaw = false;
			this.game.editor.useEditorRecolor = false;
			this.game.editor.useEditorSeason = false;
			this.game.send(server => server.action(Action.SwitchToScrapTool));
		} else {
			this.game.send(server => server.action(Action.Drop));
		}
	}
	get useEditorRecolor() {
		return this.game.editor.useEditorRecolor;
	}
	set useEditorRecolor(value: boolean) {
		this.game.editor.useEditorRecolor = value;
		if (value) {
			this.game.editor.useEditorHammer = false;
			this.game.editor.useEditorBroom = false;
			this.game.editor.useEditorRope = false;
			this.game.editor.useEditorPickaxe = false;
			this.game.editor.useEditorSaw = false;
			this.game.editor.useEditorScrap = false;
			this.game.send(server => server.action(Action.SwitchToRecolorTool));
		} else {
			this.game.send(server => server.action(Action.Drop));
		}
	}
	get useEditorSeason() {
		return this.game.editor.useEditorSeason;
	}
	set useEditorSeason(value: boolean) {
		this.game.editor.useEditorSeason = value;
		if (value) {
			this.game.editor.useEditorHammer = false;
			this.game.editor.useEditorBroom = false;
			this.game.editor.useEditorRope = false;
			this.game.editor.useEditorPickaxe = false;
			this.game.editor.useEditorSaw = false;
			this.game.editor.useEditorScrap = false;
			this.game.send(server => server.action(Action.SwitchToSeasonTool));
		} else {
			this.game.send(server => server.action(Action.Drop));
		}
	}
	get useEditorShovel() {
		return this.game.editor.useEditorShovel;
	}
	set useEditorShovel(value: boolean) {
		this.game.editor.useEditorShovel = value;
		if (value) {
			this.game.editor.useEditorHammer = false;
			this.game.editor.useEditorBroom = false;
			this.game.editor.useEditorRope = false;
			this.game.editor.useEditorPickaxe = false;
			this.game.editor.useEditorSaw = false;
			this.game.editor.useEditorScrap = false;
		this.game.editor.useEditorRecolor = false;
		this.game.editor.useEditorSeason = false;
			const tileIndex = houseTiles.findIndex(tile => tile.type === this.game.editor.tile);

			if (tileIndex === -1) {
				this.game.placeTile = 0;
				this.game.editor.tile = TileType.Dirt;
			} else {
				this.game.placeTile = tileIndex;
			}
			this.game.send(server => server.action(Action.SwitchToTileTool));
		} else {
			this.game.editor.tile = -1;
			this.game.send(server => server.action(Action.Drop));
		}
	}
		get useEditorHammer() {
			return this.game.editor.useEditorHammer;
		}
		set useEditorHammer(value: boolean) {
			this.game.editor.useEditorHammer = value;
			if (value) {
				this.game.editor.useEditorBroom = false;
				this.game.editor.useEditorRope = false;
				this.game.editor.useEditorPickaxe = false;
				this.game.editor.useEditorSaw = false;
				this.game.editor.useEditorScrap = false;
		this.game.editor.useEditorRecolor = false;
		this.game.editor.useEditorSeason = false;
				this.game.send(server => server.action(Action.SwitchToPlaceTool));
			} else {
				this.game.send(server => server.action(Action.Drop));
			}
		}
	get filteredEditorEntities() {
		const query = this.entitySearch.trim().toLowerCase();

		if (!query) {
			return this.editorEntities;
		}

		return this.editorEntities.filter(e => e.toLowerCase().includes(query));
	}
	       get editorTile() {
		       // Гарантируем, что значение всегда в допустимых границах
		       const tile = this.game.editor.tile;
		       if (typeof tile !== 'number' || isNaN(tile) || tile < -1 || tile >= tileTypeNames.length) {
			       // fallback и логирование
			       console.warn('[EditorBox] Некорректное значение editorTile:', tile, ' — сброс на -1');
			       this.game.editor.tile = -1;
			       return -1;
		       }
		       return tile;
	       }
	       set editorTile(value: number) {
		       // Валидация входящего значения
		       if (typeof value !== 'number' || isNaN(value) || value < -1 || value >= tileTypeNames.length) {
			       console.warn('[EditorBox] Попытка установить некорректный editorTile:', value, ' — сброс на -1');
			       this.game.editor.tile = -1;
		       } else {
			       this.game.editor.tile = value;
		       }
	       }
	get hasEditor() {
		return (this.model.isMod || this.model.isBuilder) && this.showEditor;
	}
	get oneEntity() {
		return this.editor.selectedEntities[0];
	}
	get singleEntity() {
		return this.editor.selectedEntities.length === 1;
	}
	get hasSelectedEntities() {
		return this.editor.selectedEntities.length > 0;
	}
	get isLightEntity() {
		return this.editor.selectedEntities.some(e => !!e.drawLight);
	}
	get isLightSpriteEntity() {
		return this.editor.selectedEntities.some(e => !!e.drawLightSprite);
	}
	get selectingEntities() {
		return this.game.editor.selectingEntities;
	}
	set selectingEntities(value) {
		this.game.editor.selectingEntities = value;
	}
	get shadowOpacity() {
		return getAlpha(this.game.shadowColor);
	}
	set shadowOpacity(value) {
		this.game.shadowColor = withAlpha(this.game.shadowColor, value);
	}
	private getEntityName(type: number) {
		return getEntityNameFromType(type);
	}
	private getEntityValue<T>(map: (entity: Entity) => T) {
		const entity = this.editor.selectedEntities[0] as any;
		return map(entity);
	}
	get entityName() {
		const entities = this.editor.selectedEntities;
		const types = entities.map(e => e.type);
		const names = uniq(types).map(type => this.getEntityName(type)).join(', ');
		return types.length === 1 ? `${names} [${entities[0].id}]` : names;
	}
	get entityLightColor() {
		return colorToHexRGB(this.getEntityValue(e => e && e.lightColor || BLACK));
	}
	       set entityLightColor(value) {
		       const color = parseColor(value);
		       const ids = this.editor.selectedEntities.map(e => e.id);
		       this.editor.selectedEntities.forEach(e => e.lightColor = color);
		       this.game.send(server => server.editorAction({ type: 'setLightColor', entities: ids, color }));
	       }
	get entityLightSpriteColor() {
		const entity = this.editor.selectedEntities[0];
		return colorToHexRGB(entity && entity.lightSpriteColor || BLACK);
	}
	       set entityLightSpriteColor(value) {
		       const color = parseColor(value);
		       const ids = this.editor.selectedEntities.map(e => e.id);
		       this.editor.selectedEntities.forEach(e => e.lightSpriteColor = color);
		       this.game.send(server => server.editorAction({ type: 'setLightSpriteColor', entities: ids, color }));
	       }
	get entityLightSpriteX() {
		const entity = this.editor.selectedEntities[0];
		return entity && entity.lightSpriteX || 0;
	}
	       set entityLightSpriteX(value) {
		       const ids = this.editor.selectedEntities.map(e => e.id);
		       this.editor.selectedEntities.forEach(e => e.lightSpriteX = value);
		       this.game.send(server => server.editorAction({ type: 'setLightSpriteX', entities: ids, x: value }));
	       }
	get entityLightSpriteY() {
		const entity = this.editor.selectedEntities[0];
		return entity && entity.lightSpriteY || 0;
	}
	       set entityLightSpriteY(value) {
		       const ids = this.editor.selectedEntities.map(e => e.id);
		       this.editor.selectedEntities.forEach(e => e.lightSpriteY = value);
		       this.game.send(server => server.editorAction({ type: 'setLightSpriteY', entities: ids, y: value }));
	       }
	get entityLightScale() {
		return this.editor.selectedEntities.length ? this.editor.selectedEntities[0].lightScaleAdjust : 1;
	}
		       set entityLightScale(value) {
			       const ids = this.editor.selectedEntities.map(e => e.id);
			       this.editor.selectedEntities.forEach(e => e.lightScaleAdjust = value);
			       // Приведение к number для строгой типизации
			       this.game.send(server => server.editorAction({ type: 'setLightScale', entities: ids, scale: Number(value) }));
		       }
	get entityX() {
		return this.oneEntity.x;
	}
	set entityX(value) {
		this.oneEntity.x = value;
		const { id, x, y } = this.oneEntity;
		this.game.send(server => server.editorAction({
			type: 'move',
			entities: [{ id, x, y }],
		}));
	}
	get entityY() {
		return this.oneEntity.y;
	}
	set entityY(value) {
		this.oneEntity.y = value;
		const { id, x, y } = this.oneEntity;
		this.game.send(server => server.editorAction({
			type: 'move',
			entities: [{ id, x, y }],
		}));
	}

	get entityCustomImageScale() {
		const entity = this.editor.selectedEntities[0];
		return entity ? ((entity as any).customImageScale || 1) : 1;
	}

	set entityCustomImageScale(value) {
		this.editor.selectedEntities.forEach(e => {
			(e as any).customImageScale = value;
			const w = ((e as any).customImageWidth || 48) * value;
			const h = ((e as any).customImageHeight || 48) * value;
			if (e.bounds) {
				e.bounds = { x: -w / 2, y: -h, w, h };
			}
		});
		if (this.scaleSendTimer) clearTimeout(this.scaleSendTimer);
		this.scaleSendTimer = setTimeout(() => {
			this.game.send(server => server.editorAction({
				type: 'setCustomImage',
				entities: this.editor.selectedEntities.map(e => e.id),
				customImageScale: value,
			}));
		}, 100);
	}

	get entityCustomImageZOrder() {
		const entity = this.editor.selectedEntities[0];
		return entity ? ((entity as any).customImageZOrder || 'above') : 'above';
	}

	set entityCustomImageZOrder(value: 'above' | 'below') {
		this.editor.selectedEntities.forEach(e => {
			(e as any).customImageZOrder = value;
		});
		this.game.send(server => server.editorAction({
			type: 'setCustomImage',
			entities: this.editor.selectedEntities.map(e => e.id),
			customImageZOrder: value,
		}));
	}

	get entityCustomImageOpacity() {
		const entity = this.editor.selectedEntities[0];
		return entity ? ((entity as any).customImageOpacity !== undefined ? (entity as any).customImageOpacity : 1) : 1;
	}

	set entityCustomImageOpacity(value) {
		this.editor.selectedEntities.forEach(e => {
			(e as any).customImageOpacity = value;
		});
		if (this.opacitySendTimer) clearTimeout(this.opacitySendTimer);
		this.opacitySendTimer = setTimeout(() => {
			this.game.send(server => server.editorAction({
				type: 'setCustomImage',
				entities: this.editor.selectedEntities.map(e => e.id),
				customImageOpacity: value,
			}));
		}, 100);
	}

	get isCustomImageEntity() {
		return this.editor.selectedEntities.some(e => (e as any).type === CUSTOM_IMAGE_TYPE);
	}

	get entityCustomImageUrl() {
		const entity = this.editor.selectedEntities[0];
		return entity ? ((entity as any).customImageUrl || '') : '';
	}

	set entityCustomImageUrl(value: string) {
		this.editor.selectedEntities.forEach(e => {
			(e as any).customImageUrl = value;
			(e as any).customImageLoaded = false;
			(e as any).customImageLoadedImg = undefined;
			(e as any).customImageElement = undefined;
		});
		this.game.send(server => server.editorAction({
			type: 'setCustomImage',
			entities: this.editor.selectedEntities.map(e => e.id),
			customImageUrl: value,
		}));
	}

	get entityNameInput() {
		const entity = this.editor.selectedEntities[0];
		return entity ? (entity.name || '') : '';
	}

	set entityNameInput(value: string) {
		this.editor.selectedEntities.forEach(e => {
			e.name = value;
		});
		this.game.send(server => server.editorAction({
			type: 'setname',
			entities: this.editor.selectedEntities.map(e => e.id),
			name: value,
		}));
	}

	get entityMessageInput() {
		const entity = this.editor.selectedEntities[0];
		return entity ? ((entity as any).entityMessage || '') : '';
	}

	set entityMessageInput(value: string) {
		this.editor.selectedEntities.forEach(e => {
			(e as any).entityMessage = value;
		});
		this.game.send(server => server.editorAction({
			type: 'setname',
			entities: this.editor.selectedEntities.map(e => e.id),
			entityMessage: value,
		}));
	}

	get entityMessageColor() {
		const entity = this.editor.selectedEntities[0];
		return entity ? (entity.messageColor || '#ffffff') : '#ffffff';
	}

	set entityMessageColor(value: string) {
		this.editor.selectedEntities.forEach(e => {
			e.messageColor = value;
		});
		this.game.send(server => server.editorAction({
			type: 'setname',
			entities: this.editor.selectedEntities.map(e => e.id),
			messageColor: value,
		}));
	}

	get entityScale() {
		const entity = this.editor.selectedEntities[0];
		return entity ? ((entity as any).entityScale || 1) : 1;
	}

	set entityScale(value: number) {
		const scaleValue = Math.round(value * 100) / 100;
		this.editor.selectedEntities.forEach(e => {
			(e as any).entityScale = scaleValue;
			if (e.bounds) {
				if (!this._originalBounds.has(e)) {
					this._originalBounds.set(e, { ...e.bounds });
				}
				const base = this._originalBounds.get(e);
				e.bounds = {
					x: base.x * scaleValue,
					y: base.y * scaleValue,
					w: base.w * scaleValue,
					h: base.h * scaleValue,
				};
			}
			if (e.interactBounds) {
				if (!this._originalInteractBounds.has(e)) {
					this._originalInteractBounds.set(e, { ...e.interactBounds });
				}
				const base = this._originalInteractBounds.get(e);
				e.interactBounds = {
					x: base.x * scaleValue,
					y: base.y * scaleValue,
					w: base.w * scaleValue,
					h: base.h * scaleValue,
				};
			}
			if (e.chatBounds) {
				if (!this._originalChatBounds.has(e)) {
					this._originalChatBounds.set(e, { ...e.chatBounds });
				}
				const base = this._originalChatBounds.get(e);
				e.chatBounds = {
					x: base.x * scaleValue,
					y: base.y * scaleValue,
					w: base.w * scaleValue,
					h: base.h * scaleValue,
				};
			}
			if (e.lightBounds) {
				if (!this._originalLightBounds.has(e)) {
					this._originalLightBounds.set(e, { ...e.lightBounds });
				}
				const base = this._originalLightBounds.get(e);
				e.lightBounds = {
					x: base.x * scaleValue,
					y: base.y * scaleValue,
					w: base.w * scaleValue,
					h: base.h * scaleValue,
				};
			}
			if (e.lightSpriteBounds) {
				if (!this._originalLightSpriteBounds.has(e)) {
					this._originalLightSpriteBounds.set(e, { ...e.lightSpriteBounds });
				}
				const base = this._originalLightSpriteBounds.get(e);
				e.lightSpriteBounds = {
					x: base.x * scaleValue,
					y: base.y * scaleValue,
					w: base.w * scaleValue,
					h: base.h * scaleValue,
				};
			}
		});
		if (this.scaleSendTimer) clearTimeout(this.scaleSendTimer);
		this.scaleSendTimer = setTimeout(() => {
			this.game.send(server => server.editorAction({
				type: 'settint',
				entities: this.editor.selectedEntities.map(e => e.id),
				entityScale: scaleValue,
			}));
		}, 100);
	}

	get entityOpacity() {
		const entity = this.editor.selectedEntities[0];
		return entity ? ((entity as any).entityOpacity !== undefined ? (entity as any).entityOpacity : 1) : 1;
	}

	set entityOpacity(value: number) {
		this.editor.selectedEntities.forEach(e => {
			(e as any).entityOpacity = value;
		});
		if (this.opacitySendTimer) clearTimeout(this.opacitySendTimer);
		this.opacitySendTimer = setTimeout(() => {
			this.game.send(server => server.editorAction({
				type: 'settint',
				entities: this.editor.selectedEntities.map(e => e.id),
				entityOpacity: value,
			}));
		}, 100);
	}

	get entitySpriteTint() {
		const entity = this.editor.selectedEntities[0];
		const tint = entity ? ((entity as any).spriteTint || 0xffffffff) : 0xffffffff;
		return '#' + ((tint >> 8) & 0xFFFFFF).toString(16).padStart(6, '0');
	}

	set entitySpriteTint(value: string) {
		const hex = parseInt(value.replace('#', ''), 16);
		const tint = ((hex & 0xFFFFFF) << 8) | 0xFF;
		this.editor.selectedEntities.forEach(e => {
			(e as any).spriteTint = tint;
		});
		if (this.spriteTintSendTimer) clearTimeout(this.spriteTintSendTimer);
		this.spriteTintSendTimer = setTimeout(() => {
			this.game.send(server => server.editorAction({
				type: 'settint',
				entities: this.editor.selectedEntities.map(e => e.id),
				spriteTint: tint,
			}));
		}, 100);
	}

	// CUSTOM_IMAGES_DISABLED: onCustomImageUpload
	// onCustomImageUpload(event: Event) {
	// 	const input = event.target as HTMLInputElement;
	// 	if (!input.files || !input.files.length) return;
	// 	const file = input.files[0];
	// 	const reader = new FileReader();
	// 	reader.onload = () => {
	// 		const dataUrl = reader.result as string;
	// 		fetch('/api-tools/upload-image', {
	// 			method: 'POST',
	// 			headers: { 'Content-Type': 'application/json' },
	// 			body: JSON.stringify({ image: dataUrl, width: 80, height: 80 }),
	// 		})
	// 		.then(r => r.json())
	// 		.then(result => {
	// 			if (result.url) {
	// 				this.entityCustomImageUrl = result.url;
	// 			} else if (result.error) {
	// 				console.error('Upload failed:', result.error);
	// 			}
	// 		})
	// 		.catch(err => console.error('Upload error:', err));
	// 	};
	// 	reader.readAsDataURL(file);
	// 	input.value = '';
	// }
	editorClear() {
		this.game.send(server => server.editorAction({ type: 'clear' }));
	}
	clearLocalStorage() {
		this.storage.clear();
	}
	setEngine(engine: EngineInfo) {
		this.game.engine = engine.engine;
	}
	isActiveEngine(engine: EngineInfo) {
		return this.game.engine === engine.engine;
	}
	toggleEditor() {
		this.zone.run(() => {
			this.showEditor = !this.showEditor;
			this.game.editor.useEditorHammer = this.showEditor;

			if (this.showEditor) {
				this.game.send(server => server.action(Action.SwitchToPlaceTool));
			} else {
				this.game.editor.useEditorHammer = false;
				this.game.editor.useEditorBroom = false;
				this.game.editor.useEditorRope = false;
				this.game.editor.useEditorPickaxe = false;
				this.game.editor.useEditorSaw = false;
				this.game.editor.useEditorScrap = false;
		this.game.editor.useEditorRecolor = false;
		this.game.editor.useEditorSeason = false;
				this.game.editor.useEditorShovel = false;
				this.game.editor.tile = -1;
				this.game.send(server => server.action(Action.Drop));
			}

			this.storage.setBoolean('show-editor', this.showEditor);
		});
	}
	toggleSelecting() {
		this.selectingEntities = !this.selectingEntities;

		if (!this.selectingEntities) {
			this.editor.selectedEntities.length = 0;
		}
	}
	listEntities() {
		this.game.send(server => server.editorAction({ type: 'list' }));
	}
	openEntityPicker() {
		this.pendingEditorEntity = this.editorEntity;
		this.entityPickerModalRef = this.modalService.show(this.entityPickerModalTpl, {
			class: 'modal-lg',
			ignoreBackdropClick: true,
			keyboard: false,
		});
	}
	onEntitySearchChange(value: string) {
		this.entitySearch = value;
		const query = value.trim().toLowerCase();

		if (!query) {
			this.pendingEditorEntity = this.editorEntity;
			return;
		}

		const exact = this.editorEntities.find(e => e.toLowerCase() === query);
		const startsWith = this.editorEntities.find(e => e.toLowerCase().startsWith(query));
		const includes = this.editorEntities.find(e => e.toLowerCase().includes(query));
		const match = exact || startsWith || includes;

		if (match) {
			this.pendingEditorEntity = match;
			this.scrollEntityIntoView(match);
		} else {
			this.pendingEditorEntity = '';
		}
	}
	clearEntitySearch() {
		this.onEntitySearchChange('');
	}
	getEntityPreviewAction(entity: string) {
		return this.entityPreviewActions.get(entity);
	}
	closeEntityPicker() {
		if (this.entityPickerModalRef) {
			this.entityPickerModalRef.hide();
			this.entityPickerModalRef = undefined;
		}
	}
	selectEditorEntity(value: string) {
		this.pendingEditorEntity = value;
	}
	applyEditorEntity() {
		if (this.pendingEditorEntity) {
			this.editorEntity = this.pendingEditorEntity;
			this.game.send(server => server.action(Action.SwitchToPlaceTool));
		}

		this.closeEntityPicker();
	}
	private scrollEntityIntoView(entity: string) {
		setTimeout(() => {
			const button = this.entityItemButtons && this.entityItemButtons.find(b => {
				const value = b.nativeElement.getAttribute('data-entity') || '';
				return value.toLowerCase() === entity.toLowerCase();
			});

			if (button) {
				button.nativeElement.scrollIntoView({ block: 'center' });
			}
		}, 0);
	}
	deleteEntities() {
		const entities = this.editor.selectedEntities.map(e => e.id);
		this.game.send(server => server.editorAction({ type: 'remove', entities }));
		this.editor.selectedEntities.length = 0;
	}
	showEntitiesInfo() {
		console.log(this.editor.selectedEntities);
	}
	saveEntityName() {
		const entities = this.editor.selectedEntities.map(e => e.id);
		this.game.send(server => server.editorAction({
			type: 'setname',
			entities,
			name: this.entityNameInput.substring(0, 30),
			entityMessage: this.entityMessageInput.substring(0, 100),
			messageColor: this.entityMessageColor,
		}));
	}
	holdSelectedItem() {
		const entities = this.editor.selectedEntities.map(e => e.id);
		if (entities.length) {
			this.game.send(server => server.editorAction({ type: 'holdentity', entities }));
		}
	}
	becomeSelectedItem() {
		const entities = this.editor.selectedEntities.map(e => e.id);
		if (entities.length) {
			this.game.send(server => server.editorAction({ type: 'becomeentity', entities }));
		}
	}
	loadEntityFields(entity: Entity) {
		const e = entity as any;
		this.entityNameInput = e.name || '';
		this.entityMessageInput = e.entityMessage || '';
		this.entityMessageColor = e.messageColor || '#bbbbbb';
	}
	toggleShow(field: keyof DebugFlags) {
		(this.game.debug as any)[field] = !this.isShow(field);
		this.game.saveDebug();
	}
	isShow(field: keyof DebugFlags) {
		return !!this.game.debug[field];
	}

	// CUSTOM_IMAGES_DISABLED: onImageFileSelected
	// onImageFileSelected(file: File) {
	// 	if (!file) return;
	// 	const dotIndex = file.name.lastIndexOf('.');
	// 	const ext = dotIndex >= 0 ? file.name.substring(dotIndex + 1).toLowerCase() : '';
	// 	const allowedExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'tiff'];
	// 	if (!allowedExts.includes(ext)) return;
	// 	if (file.size > 5 * 1024 * 1024) return;
	// 	const player = this.game.player;
	// 	if (!player) return;
	// 	const reader = new FileReader();
	// 	reader.onload = () => {
	// 		const base64 = reader.result as string;
	// 		this.game.uploadCustomImage(base64, file.type, player.x, player.y);
	// 	};
	// 	reader.readAsDataURL(file);
	// }
}
