import { Component, ElementRef, NgZone, QueryList, TemplateRef, ViewChild, ViewChildren } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { uniq } from 'lodash';
import { entityButtonAction } from '../../../client/buttonActions';
import { faEdit, faCog, faDrawPolygon, faTrash, emptyIcon, faCheck, faClone, faEraser, faRetweet, faCopy, faWrench, faHammer, faPaintBrush } from '../../../client/icons';
import { PonyTownGame, engines } from '../../../client/game';
import { StorageService } from '../../services/storageService';
import { Model, getEntityNameFromType, getEntityNames, getEntityTypesFromName } from '../../services/model';
import { getAlpha, withAlpha, colorToHexRGB, parseColor } from '../../../common/color';
import { BLACK } from '../../../common/colors';
import { Entity, Engine, EngineInfo, DebugFlags, tileTypeNames, EntityButtonAction, Action } from '../../../common/interfaces';

@Component({
	selector: 'editor-box',
	templateUrl: 'editor-box.pug',
	styleUrls: ['editor-box.scss'],
})
export class EditorBox {
	readonly dev = DEVELOPMENT;
	readonly cogIcon = faCog;
	readonly editIcon = faEdit;
	readonly selectIcon = faDrawPolygon;
	readonly deleteIcon = faTrash;
	readonly broomIcon = faEraser;
	readonly ropeIcon = faRetweet;
	readonly pickaxeIcon = faCopy;
	readonly sawIcon = faWrench;
	readonly shovelIcon = faPaintBrush;
	readonly hammerIcon = faHammer;
	readonly duplicateIcon = faClone;
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
	constructor(
		public model: Model,
		private game: PonyTownGame,
		private storage: StorageService,
		private zone: NgZone,
		private modalService: BsModalService,
	) {
		this.game.editor.type = this.storage.getItem('editor-entity') || 'rock';
		this.showEditor = this.storage.getBoolean('show-editor');
		this.game.editor.useEditorHammer = this.showEditor;
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
			this.game.send(server => server.action(Action.SwitchToSawTool));
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
			if (this.game.editor.tile === -1) {
				this.game.editor.tile = 0;
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
		this.entitySearch = '';
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
	toggleShow(field: keyof DebugFlags) {
		(this.game.debug as any)[field] = !this.isShow(field);
		this.game.saveDebug();
	}
	isShow(field: keyof DebugFlags) {
		return !!this.game.debug[field];
	}
}
