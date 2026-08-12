import { Component, DoCheck, OnInit, OnDestroy, ViewChild, HostListener, Input, ViewEncapsulation, TemplateRef } from '@angular/core';
import { Subscription } from 'rxjs';

import { clamp } from 'lodash';
import { PLAYER_NAME_MAX_LENGTH, PLAYER_DESC_MAX_LENGTH } from '../../../common/constants';
import {
	PonyInfo, PonyObject, PonyState, SocialSiteInfo, ColorExtraSet, ColorExtra, CharacterTag, PonyEye, Eye, Muzzle,
	Entity, defaultWorldState,
	Iris, ExpressionExtra, PonySupportChatType
} from '../../../common/interfaces';
import { findById, toInt, cloneDeep, delay } from '../../../common/utils';
import {
	SLEEVED_ACCESSORIES, frontHooves, mergedBackManes, mergedManes, mergedFacialHair, mergedEarAccessories,
	mergedChestAccessories, mergedFaceAccessories, mergedBackAccessories, mergedExtraAccessories, mergedHeadAccessories,
	ponytails,
} from '../../../client/ponyUtils';
import { defaultPonyState, defaultDrawPonyOptions } from '../../../client/ponyHelpers';
import { toPalette, getBaseFill, syncLockedPonyInfo } from '../../../common/ponyInfo';
import * as sprites from '../../../generated/sprites';
import { boop, trot, stand, sitDownUp, lieDownUp, fly, flyBug } from '../../../client/ponyAnimations';
import { drawCanvas } from '../../../graphics/contextSpriteBatch';
import { Model, getPonyTag } from '../../services/model';
import { StorageService } from '../../services/storageService';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { loadAndInitSpriteSheets, addTitles, createEyeSprite, addLabels } from '../../../client/spriteUtils';
import { GameService } from '../../services/gameService';
import { TRANSPARENT, BLACK, blushColor } from '../../../common/colors';
import { precompressPony, compressPonyString, decompressPony, decompressPonyString } from '../../../common/compressPony';
import { saveCanvas } from '../../../client/canvasUtils';
import { drawPony } from '../../../client/ponyDraw';
import { getProviderIcon } from '../../shared/sign-in-box/sign-in-box';
import { faPlay, faLock, faRedo, faSave, faCode, faInfoCircle, faPaintBrush, faHorseHead, faRetweet, faSearch, faUndo, faEraser, faSlash, faFont, faStar, faHandHolding } from '../../../client/icons';
import { isFileSaverSupported, createExpression, readFileAsText } from '../../../client/clientUtils';
import { isMobile } from '../../../client/data';
import { emptyTag, getAvailableTags } from '../../../common/tags';
import { ButtMarkEditorState } from '../../shared/butt-mark-editor/butt-mark-editor';
import { parseColorWithAlpha } from '../../../common/color';
import { createAnEntity } from '../../../common/entities';
import { mockPaletteManager } from '../../../common/ponyInfo';

const frontHoofTitles = ['', 'Fetlocks', 'Paws', 'Claws', ''];
const backHoofTitles = ['', 'Fetlocks', 'Paws', '', ''];

const horns = addLabels(sprites.horns, [
	'None', 'Unicorn horn', 'Short unicorn horn', 'Curved unicorn horn', 'Tiny deer antlers',
	'Short deer antlers', 'Medium deer antlers', 'Large deer antlers', 'Raindeer antlers', 'Goat horns',
	'Ram horns', 'Buffalo horns', 'Moose horns', 'Bug antenna', 'Long unicorn horn',
]);

const wings = addLabels(sprites.wings[0]!, [
	'None', 'Pegasus wings', 'Bat wings', 'Gryphon wings', 'Bug wings'
]);

const ears = addLabels(sprites.ears, [
	'Regular ears', 'Fluffy ears', 'Long feathered ears', 'Bug ears', 'Short feathered ears', 'Deer ears',
]);

const noses = addTitles(sprites.noses[0], ['Pony muzzle', 'Gryphon beak', 'Deer nose']);

const flyAnimations = [{ ...stand, name: 'fly' }, fly, fly, fly, { ...flyBug, name: 'fly' }];

function eyeSprite(e: PonyEye | undefined) {
	return createEyeSprite(e, 0, sprites.defaultPalette);
}

interface CharacterUndoState {
	pony: PonyObject;
	previewScale: number;
	hidePreviewName: boolean;
	hidePreviewTag: boolean;
	showBackground: boolean;
	previewHoldItem: boolean;
}

@Component({
	selector: 'character',
	templateUrl: 'character.pug',
	styleUrls: ['character.scss'],
	encapsulation: ViewEncapsulation.None,
})
export class Character implements DoCheck, OnInit, OnDestroy {
	@ViewChild('characterPreview', { static: true }) characterPreview!: any;
	@ViewChild('unsavedCharacterModal', { static: true }) unsavedCharacterModalTpl!: TemplateRef<any>;
	@Input() inGameMode = false;
	readonly debug = DEVELOPMENT || BETA;
	previewScale: number = 4;
	showBackground = false;
	hidePreviewName = false;
	hidePreviewTag = false;

	readonly playIcon = faPlay;
	readonly resetIcon = faRedo;
	readonly undoIcon = faUndo;
	readonly redoIcon = faRedo;
	readonly saveIcon = faSave;
	readonly codeIcon = faCode;
	readonly lockIcon = faLock;
	readonly infoIcon = faInfoCircle;
	readonly paintBrushIcon = faPaintBrush;
	readonly horseHeadIcon = faHorseHead;
	readonly flipIcon = faRetweet;
	readonly searchIcon = faSearch;
	readonly eraserIcon = faEraser;
	readonly nameIcon = faFont;
	readonly tagIcon = faCode;
	readonly slashIcon = faSlash;
	readonly starIcon = faStar;
	readonly holdItemIcon = faHandHolding;
	readonly maxNameLength = PLAYER_NAME_MAX_LENGTH;
	readonly maxDescLength = PLAYER_DESC_MAX_LENGTH;
	readonly horns = horns;
	readonly manes = mergedManes;
	readonly backManes = mergedBackManes;
	readonly tails = sprites.tails[0];
	readonly ponytails = ponytails;
	readonly wings = wings;
	readonly ears = ears;
	readonly facialHair = mergedFacialHair;
	readonly headAccessories = mergedHeadAccessories;
	readonly earAccessories = mergedEarAccessories;
	readonly faceAccessories = mergedFaceAccessories;
	readonly neckAccessories = sprites.neckAccessories[1];
	readonly frontLegAccessories = sprites.frontLegAccessories[1];
	readonly backLegAccessories = sprites.backLegAccessories[1];
	readonly backAccessories = mergedBackAccessories;
	readonly chestAccessories = mergedChestAccessories;
	readonly sleeveAccessories = sprites.frontLegSleeves[1];
	readonly waistAccessories = sprites.waistAccessories[1];
	readonly extraAccessories = mergedExtraAccessories;
	readonly bodyPatterns = sprites.body[1];
	readonly frontLegPatterns = sprites.frontLegs[1];
	readonly backLegPatterns = sprites.backLegs[1];
	readonly frontHooves = addTitles(frontHooves[1], frontHoofTitles);
	readonly backHooves = addTitles(sprites.backLegHooves[1], backHoofTitles);
	readonly animations = [
		() => stand,
		() => trot,
		() => boop,
		() => sitDownUp,
		() => lieDownUp,
		() => flyAnimations[this.previewInfo!.wings!.type || 0],
	];
	readonly eyelashes: ColorExtraSet = sprites.eyeLeft[1]!.map(eyeSprite);
	readonly eyesLeft: ColorExtraSet = sprites.eyeLeft.map(e => e && e[0]).map(eyeSprite);
	readonly eyesRight: ColorExtraSet = sprites.eyeRight.map(e => e && e[0]).map(eyeSprite);
	private cachedIrisesLeftType = -1;
	private cachedIrisesRightType = -1;
	private cachedIrisesLeft?: ColorExtraSet;
	private cachedIrisesRight?: ColorExtraSet;
	get irisesLeft(): ColorExtraSet {
		const eyeType = this.info.eyeOpennessLeft || 1;
		if (eyeType !== this.cachedIrisesLeftType) {
			const eye = sprites.eyeLeft[eyeType] && sprites.eyeLeft[eyeType]![0];
			this.cachedIrisesLeft = eye ? eye.irises.map((_, iris) => createEyeSprite(eye, iris, sprites.defaultPalette)) : undefined;
			this.cachedIrisesLeftType = eyeType;
		}
		return this.cachedIrisesLeft;
	}
	get irisesRight(): ColorExtraSet {
		const eyeType = this.info.eyeOpennessRight || 1;
		if (eyeType !== this.cachedIrisesRightType) {
			const eye = sprites.eyeRight[eyeType] && sprites.eyeRight[eyeType]![0];
			this.cachedIrisesRight = eye ? eye.irises.map((_, iris) => createEyeSprite(eye, iris, sprites.defaultPalette)) : undefined;
			this.cachedIrisesRightType = eyeType;
		}
		return this.cachedIrisesRight;
	}
	readonly noses = noses;
	readonly heads = sprites.head1[1];
	readonly buttMarkState: ButtMarkEditorState = {
		brushType: 'brush',
		brush: 'orange',
	};
	muzzles: ColorExtraSet;
	fangs: ColorExtraSet;
	tags: CharacterTag[] = [
		emptyTag,
	];
	state = defaultPonyState();
	saved: PonyInfo[] = [];
	activeAnimation = 0;
	loaded = false;
	playAnimation = true;
	deleting = false;
	fixed = false;
	previewExtra = false;
	previewMagic = false;
	previewHoldItem = true;
	previewPony: PonyObject | undefined = undefined;
	private previewHoldItemType = 0;
	private previewHoldItemStateKey = '';
	sites: SocialSiteInfo[] = [];
	error?: string;
	canSaveFiles = isFileSaverSupported();
	private savingLocked = false;
	private interval?: any;
	private syncTimeout?: any;
	private animationTime = 0;
	private undoHistory: CharacterUndoState[] = [];
	private redoHistory: CharacterUndoState[] = [];
	private currentUndoState?: CharacterUndoState;
	private currentUndoStateKey = '';
	private applyingUndoRedo = false;
	private suppressUndoCapture = false;
	private colorDragActive = false;
	private colorDragStartState?: CharacterUndoState;
	private colorDragStartKey = '';
	private colorDragStartUndoLength = 0;
	private autosaveTimer?: any;
	private restoreDraftCandidate?: PonyObject;
	private modalContext: 'play' | 'restore' = 'play';
	public modalTitle = 'Your character has unsaved changes.';
	public modalPrompt = 'Would you like to save your changes or discard them for the original from the server?';
	public modalSaveLabel = 'Save changes';
	public modalDiscardLabel = 'Discard changes';
	public modalCurrentPony?: PonyInfo;
	public modalStoredPony?: PonyInfo;
	public modalPonyName?: string;
	private accountChangedSubscription?: Subscription;
	private unsavedChangesModalRef?: BsModalRef;
	private pendingPlayCallback?: (options?: { pony?: PonyObject; skipSave?: boolean }) => void;
	constructor(private gameService: GameService, private model: Model, private storage: StorageService, private modalService: BsModalService) {
		this.createMuzzles();
		this.updateMuzzles();
	}

	private getMuzzleType() {
		return clamp(toInt(this.info && this.info.nose && this.info.nose.type), 0, sprites.noses[0].length);
	}
	createMuzzles() {
		const type = this.getMuzzleType();
		const happy = sprites.noses[0][type][0];

		this.muzzles = sprites.noses
			.slice()
			.map(n => n[type][0])
			.map(({ color, colors, mouth }) => ({ color, colors, extra: mouth, palettes: [sprites.defaultPalette] } as ColorExtra));

		this.fangs = [undefined, { color: happy.color, colors: 3, extra: happy.fangs, palettes: [sprites.defaultPalette] }];
	}
	updateMuzzles() {
		const type = this.getMuzzleType();
		const happy = sprites.noses[0][type][0];

		this.muzzles!.forEach((m, i) => {
			if (m) {
				const { color, colors, mouth } = sprites.noses[i][type][0];
				m.color = color;
				m.colors = colors;
				m.extra = mouth;
				m.timestamp = Date.now();
			}
		});

		const fangs = this.fangs![1]!;
		fangs.color = happy.color;
		fangs.extra = happy.fangs;
		fangs.timestamp = Date.now();
	}
	get account() {
		return this.model.account;
	}
	get loading() {
		return this.model.loading || this.model.updating;
	}
	get updateWarning() {
		return this.gameService.updateWarning;
	}
	get playing() {
		return !this.inGameMode && this.gameService.playing;
	}
	get previewInfo() {
		return this.previewPony ? this.previewPony.ponyInfo : this.pony.ponyInfo;
	}
	get previewName() {
		return this.previewPony ? this.previewPony.name : this.pony.name;
	}
	get previewTag() {
		return getPonyTag(this.previewPony || this.pony, this.account);
	}
	get supporterTagLabel() {
		if (this.pony.hideSupport || this.pony.supportTag === 'hidden') {
			return 'Hidden';
		}
		if (this.pony.supportTag && /^sup[1-4]$/.test(this.pony.supportTag)) {
			return this.pony.supportTag.toUpperCase();
		}
		return 'Auto';
	}
	get showSupporterOptions() {
		return this.model.supporter > 0 && this.model.isMod;
	}
	get supportChatOptions() {
		const options: Array<{ id?: PonySupportChatType, label: string }> = [
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
	}
	get supportChatLabel() {
		const option = this.supportChatOptions.find(option => option.id === this.pony.supportChat);
		return option ? option.label : 'Auto';
	}
	get supportTagPriority() {
		return this.pony.supportTagPriority !== false;
	}
	set supportTagPriority(value: boolean) {
		this.pony.supportTagPriority = value;
	}
	get customOutlines() {
		return this.info.customOutlines;
	}
	get hasCustomPreviewBackground() {
		return !!this.info.previewBackground && this.info.previewBackground !== '90ee90';
	}
	get hasCustomPreviewSettings() {
		return this.previewScale !== 4 || !!this.info.headTurned || !!this.info.flip || this.hidePreviewName || this.hidePreviewTag
			|| (this.canPreviewHoldItem && !this.previewHoldItem);
	}
	get hasCustomBlushColor() {
		return !!this.info.blushColor && this.info.blushColor !== 'ff89ae';
	}
	get hasCustomEffects() {
		return !!this.info.blush || !!this.info.sleeping || !!this.info.tears || !!this.info.crying || !!this.info.hearts || this.previewMagic;
	}
	get canUseMagicEffect() {
		return !!(this.info.horn && this.info.horn.type);
	}
	get canUseEffects() {
		return this.model.supporter >= 2;
	}
	resetPreview() {
		this.previewScale = 4;
		this.info.headTurned = false;
		this.info.flip = false;
		this.hidePreviewName = false;
		this.hidePreviewTag = false;
		this.previewHoldItem = true;
		this.syncPreviewHoldItem();
		this.changed();
	}
	get currentHoldItemType() {
		const player = (window as any).game && (window as any).game.player;
		return player && typeof player.hold === 'number' ? player.hold : 0;
	}
	get canPreviewHoldItem() {
		return this.currentHoldItemType > 0;
	}
	get isPreviewingHoldItem() {
		return this.canPreviewHoldItem && this.previewHoldItem;
	}
	togglePreviewHoldItem() {
		if (!this.canPreviewHoldItem) return;
		this.previewHoldItem = !this.previewHoldItem;
		this.syncPreviewHoldItem();
		this.renderChanged();
	}
	private syncPreviewHoldItem() {
		const type = this.currentHoldItemType;
		if (type !== this.previewHoldItemType) {
			this.previewHoldItemType = type;
			if (!type) this.previewHoldItem = false;
		}
		const stateKey = `${type}:${this.isPreviewingHoldItem}`;
		if (stateKey === this.previewHoldItemStateKey) return;
		this.previewHoldItemStateKey = stateKey;

		if (!this.isPreviewingHoldItem) {
			this.state.holding = undefined;
			return;
		}

		try {
			this.state.holding = createAnEntity(type, 0, 0, 0, {}, mockPaletteManager, defaultWorldState) as Entity;
		} catch {
			this.state.holding = undefined;
		}
	}
	resetEffects() {
		this.info.blush = false;
		this.info.sleeping = false;
		this.info.tears = false;
		this.info.crying = false;
		this.info.hearts = false;
		this.previewMagic = false;
		this.changed();
	}
	get canTogglePreviewTag() {
		return this.tags.length > 1 || !!(this.account && this.account.supporter);
	}
	get ponies() {
		return this.model.ponies;
	}
	get pony() {
		return this.model.pony;
	}
	set pony(value: PonyObject) {
		this.model.selectPony(value);
	}
	get info() {
		return this.pony.ponyInfo!;
	}
	get maneFill() {
		return getBaseFill(this.info.mane);
	}
	get coatFill() {
		return this.info.coatFill;
	}
	get hoovesFill() {
		return getBaseFill(this.info.frontHooves);
	}
	get canExport() {
		return DEVELOPMENT;
	}
	get site() {
		return findById(this.sites, this.pony.site) || this.sites[0];
	}
	set site(value: SocialSiteInfo) {
		this.pony.site = value.id;
	}
	get tag() {
		return findById(this.tags, this.pony.tag) || this.tags[0];
	}

	set tag(value: CharacterTag) {
		this.pony.tag = value.id;
	}

	get lockEyeWhites() {
		return !this.info.unlockEyeWhites;
	}

	set lockEyeWhites(value) {
		this.info.unlockEyeWhites = !value;
	}
	get darken() {
		return !this.info.freeOutlines;
	}
	get lockFrontLegAccessory() {
		return !this.info.unlockFrontLegAccessory;
	}
	set lockFrontLegAccessory(value) {
		this.info.unlockFrontLegAccessory = !value;
	}
	get lockBackLegAccessory() {
		return !this.info.unlockBackLegAccessory;
	}
	set lockBackLegAccessory(value) {
		this.info.unlockBackLegAccessory = !value;
	}
	get lockFrontHooves() {
		return !this.info.unlockFrontHooves;
	}
	set lockFrontHooves(value) {
		this.info.unlockFrontHooves = !value;
	}
	get lockBackHooves() {
		return !this.info.unlockBackHooves;
	}
	set lockBackHooves(value) {
		this.info.unlockBackHooves = !value;
	}
	get lockBackLegs() {
		return this.info.lockBackLegs !== false;
	}
	set lockBackLegs(value: boolean) {
		this.info.lockBackLegs = value;
	}
	get lockBodyMarkings() {
		return !this.info.unlockBody;
	}
	set lockBodyMarkings(value: boolean) {
		this.info.unlockBody = !value;
	}
	get lockFrontLegsMarkings() {
		return !this.info.unlockFrontLegs;
	}
	set lockFrontLegsMarkings(value: boolean) {
		this.info.unlockFrontLegs = !value;
	}
	get lockBackLegsMarkings() {
		return !this.info.unlockBackLegs;
	}
	set lockBackLegsMarkings(value: boolean) {
		this.info.unlockBackLegs = !value;
	}
	get useExtraEarAccessory() {
		return !!(this.info.earAccessoryExtra && this.info.earAccessoryExtra.type);
	}
	set useExtraEarAccessory(value) {
		if (value) {
			if (!this.info.earAccessoryExtra) {
				this.info.earAccessoryExtra = cloneDeep(this.info.earAccessory);
			}
			if (!this.info.earAccessoryExtra!.type) {
				this.info.earAccessoryExtra!.type = (this.info.earAccessory && this.info.earAccessory.type) || 1;
			}
		} else if (this.info.earAccessoryExtra) {
			this.info.earAccessoryExtra.type = 0;
			this.info.earAccessoryExtra.pattern = 0;
		}
	}
	get useExtraFaceAccessory() {
		return !!(this.info.faceAccessoryExtra && this.info.faceAccessoryExtra.type);
	}
	set useExtraFaceAccessory(value) {
		if (value) {
			if (!this.info.faceAccessoryExtra) {
				this.info.faceAccessoryExtra = cloneDeep(this.info.faceAccessory);
			}
			if (!this.info.faceAccessoryExtra!.type) {
				this.info.faceAccessoryExtra!.type = (this.info.faceAccessory && this.info.faceAccessory.type) || 1;
			}
		} else if (this.info.faceAccessoryExtra) {
			this.info.faceAccessoryExtra.type = 0;
			this.info.faceAccessoryExtra.pattern = 0;
		}
	}
	get lockEars() {
		return !this.info.unlockEars;
	}
	set lockEars(value) {
		this.info.unlockEars = !value;
	}
	get lockWings() {
		return !this.info.unlockWings;
	}
	set lockWings(value) {
		this.info.unlockWings = !value;
	}
	get lockSleeveAccessory() {
		return !this.info.unlockSleeveAccessory;
	}
	set lockSleeveAccessory(value) {
		this.info.unlockSleeveAccessory = !value;
	}
	get lockWaistAccessory() {
		return !this.info.unlockWaistAccessory;
	}
	set lockWaistAccessory(value) {
		this.info.unlockWaistAccessory = !value;
	}
	get lockEyelashColor() {
		return !this.info.unlockEyelashColor;
	}
	set lockEyelashColor(value) {
		this.info.unlockEyelashColor = !value;
	}
	get lockEyeshadowColor() {
		return !this.info.unlockEyeshadowColor;
	}
	set lockEyeshadowColor(value) {
		this.info.unlockEyeshadowColor = !value;
	}
	icon(id: string) {
		return getProviderIcon(id);
	}
	hasSleeves(type: number) {
		return SLEEVED_ACCESSORIES.indexOf(type) !== -1;
	}
	ngOnInit() {
		if (!this.state.expression) {
			this.state.expression = createExpression(Eye.Neutral, Eye.Neutral, Muzzle.Smile, Iris.Forward, Iris.Forward, ExpressionExtra.None);
		}

		// sync expression state from saved info (eye openness, muzzle)
		if (this.state.expression && this.info) {
			const right = (this.info.eyeOpennessRight != null ? this.info.eyeOpennessRight : Eye.Neutral) as Eye;
			const left = (this.info.eyeOpennessLeft != null ? this.info.eyeOpennessLeft : Eye.Neutral) as Eye;
			const muzzle = (this.info.muzzle != null ? this.info.muzzle : Muzzle.Smile) as Muzzle;
			this.state.expression = { ...this.state.expression, right, left, muzzle };
		}
		if (this.model.account) {
			this.tags.push(...getAvailableTags(this.model.account)
				.filter(t => !/^sup[1-4]$/.test(t.id) && t.id !== 'hidden'));
		}

		this.sites = this.model.sites.filter(s => !!s.name);
		this.updateMuzzles();
		this.syncPreviewHeadTurnState();
		this.syncPreviewHoldItem();
		this.tryRestoreAutosaveDraft();

		let last = Date.now();

		this.resetUndoHistory();
		this.accountChangedSubscription = this.model.accountChanged.subscribe(() => this.tryRestoreAutosaveDraft());

		return loadAndInitSpriteSheets().then(() => {
			this.loaded = true;
			this.interval = setInterval(() => {
				const now = Date.now();
				this.update((now - last) / 1000);
				last = now;
			}, 1000 / 24);
		});
	}
	setRightIris(iris: Iris) {
		if (this.state.expression) {
			this.state.expression.rightIris = iris;
			this.renderChanged();
		}
	}
	setLeftIris(iris: Iris) {
		if (this.state.expression) {
			this.state.expression.leftIris = iris;
			this.renderChanged();
		}
	}
	ngOnDestroy() {
		clearInterval(this.interval);
		this.accountChangedSubscription && this.accountChangedSubscription.unsubscribe();
	}
	ngDoCheck() {
		this.syncPreviewHoldItem();
		if (!this.applyingUndoRedo && !this.suppressUndoCapture && !this.colorDragActive) {
			this.captureUndoStep();
		}
	}
	get canUndo() {
		return this.undoHistory.length > 0;
	}
	get canRedo() {
		return this.redoHistory.length > 0;
	}
	get isMobile() {
		return isMobile;
	}
	private matchesKey(event: KeyboardEvent, code: string, keyCode: number) {
		return event.code === code || event.keyCode === keyCode || (event as any).which === keyCode;
	}
	@HostListener('window:keydown', ['$event'])
	onKeyDown(event: KeyboardEvent) {
		if (this.playing) return;
		const tag = ((event.target as HTMLElement) && (event.target as HTMLElement).tagName || '').toUpperCase();
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
		if (event.ctrlKey || event.metaKey) {
			if (this.matchesKey(event, 'KeyZ', 90)) {
				event.preventDefault();
				this.undo();
			} else if (this.matchesKey(event, 'KeyY', 89)) {
				event.preventDefault();
				this.redo();
			}
			return;
		}
		if (!this.info) return;

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
	}
	private createUndoPonySnapshot() {
		const pony = cloneDeep(this.pony);

		if (pony.ponyInfo) {
			pony.info = compressPonyString(pony.ponyInfo);
		}

		return pony;
	}
	private createUndoState(): CharacterUndoState {
		return {
			pony: this.createUndoPonySnapshot(),
			previewScale: this.previewScale,
			hidePreviewName: this.hidePreviewName,
			hidePreviewTag: this.hidePreviewTag,
			showBackground: this.showBackground,
			previewHoldItem: this.previewHoldItem,
		};
	}
	private getUndoStateKey(state: CharacterUndoState) {
		return JSON.stringify(state);
	}
	private resetUndoHistory() {
		this.undoHistory = [];
		this.redoHistory = [];
		this.suppressUndoCapture = false;
		this.colorDragActive = false;
		this.colorDragStartState = undefined;
		this.colorDragStartKey = '';
		this.colorDragStartUndoLength = 0;
		this.currentUndoState = this.createUndoState();
		this.currentUndoStateKey = this.getUndoStateKey(this.currentUndoState);
	}
	private captureUndoStep() {
		if (this.colorDragActive) {
			return;
		}

		const currentState = this.createUndoState();
		const currentStateKey = this.getUndoStateKey(currentState);

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
	}
	private applyUndoState(state: CharacterUndoState) {
		this.deleting = false;
		this.pony = cloneDeep(state.pony);
		this.previewScale = state.previewScale;
		this.hidePreviewName = state.hidePreviewName;
		this.hidePreviewTag = state.hidePreviewTag;
		this.showBackground = state.showBackground;
		this.previewHoldItem = state.previewHoldItem;
		this.syncPreviewHoldItem();
		this.updateMuzzles();
	}
	undo() {
		if (!this.canUndo) return;
		this.applyingUndoRedo = true;
		this.suppressUndoCapture = false;
		this.colorDragActive = false;
		if (this.currentUndoState) {
			this.redoHistory.push(cloneDeep(this.currentUndoState));
		}
		const snapshot = cloneDeep(this.undoHistory.pop()!);
		this.applyUndoState(snapshot);
		this.currentUndoState = this.createUndoState();
		this.currentUndoStateKey = this.getUndoStateKey(this.currentUndoState);
		this.changed();
		this.applyingUndoRedo = false;
	}
	redo() {
		if (!this.canRedo) return;
		this.applyingUndoRedo = true;
		this.suppressUndoCapture = false;
		this.colorDragActive = false;
		if (this.currentUndoState) {
			this.undoHistory.push(cloneDeep(this.currentUndoState));
			if (this.undoHistory.length > 100) {
				this.undoHistory.shift();
			}
		}
		const snapshot = cloneDeep(this.redoHistory.pop()!);
		this.applyUndoState(snapshot);
		this.currentUndoState = this.createUndoState();
		this.currentUndoStateKey = this.getUndoStateKey(this.currentUndoState);
		this.changed();
		this.applyingUndoRedo = false;
	}
	// called every tick during color drag — updates preview but does NOT push undo
	beginColorChange() {
		if (!this.colorDragActive) {
			const startState = this.currentUndoState ? cloneDeep(this.currentUndoState) : this.createUndoState();
			this.colorDragStartState = startState;
			this.colorDragStartKey = this.getUndoStateKey(startState);
			this.colorDragStartUndoLength = this.undoHistory.length;
		}
		this.colorDragActive = true;
		this.suppressUndoCapture = true;
	}
	colorChanged() {
		this.suppressUndoCapture = true;
		this.renderChanged();
	}
	// called when color drag ends or manual input commits — pushes undo step
	colorChangeDone() {
		this.suppressUndoCapture = false;
		const currentState = this.createUndoState();
		const currentStateKey = this.getUndoStateKey(currentState);

		if (this.colorDragActive && this.colorDragStartState) {
			if (this.undoHistory.length > this.colorDragStartUndoLength) {
				this.undoHistory.splice(this.colorDragStartUndoLength);
			}

			if (currentStateKey !== this.colorDragStartKey) {
				this.undoHistory.push(cloneDeep(this.colorDragStartState));
				if (this.undoHistory.length > 100) {
					this.undoHistory.shift();
				}
				this.redoHistory = [];
			}
			this.currentUndoState = currentState;
			this.currentUndoStateKey = currentStateKey;
		} else if (!this.applyingUndoRedo) {
			this.captureUndoStep();
		}

		this.colorDragActive = false;
		this.colorDragStartState = undefined;
		this.colorDragStartKey = '';
		this.colorDragStartUndoLength = 0;
		this.renderChanged();
	}

	beginMagicColorChange() {
		this.beginColorChange();
		this.previewMagic = true;
	}

	magicColorChangeDone() {
		this.colorChangeDone();
		this.previewMagic = false;
	}
	changed() {
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
	}

	private scheduleAutosaveDraft() {
		if (this.autosaveTimer) {
			clearTimeout(this.autosaveTimer);
		}
		this.autosaveTimer = setTimeout(() => {
			this.autosaveTimer = undefined;
			this.saveAutoSaveDraft();
		}, 1000);
	}
	private renderChanged() {
		// normalize a few fields to prevent invalid UI state (e.g. strings or out-of-range numbers)
		this.info.flip = !!this.info.flip;
		this.info.headTurned = !!this.info.headTurned;
		this.info.headTurn = Math.max(0, Math.min(6, (this.info.headTurn === undefined ? 0 : (this.info.headTurn as any) | 0)));
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

		// sync expression state from info so preview uses the correct eye/muzzle values
		if (this.state.expression) {
			const right = (this.info.eyeOpennessRight != null ? this.info.eyeOpennessRight : Eye.Neutral) as Eye;
			const left = (this.info.eyeOpennessLeft != null ? this.info.eyeOpennessLeft : Eye.Neutral) as Eye;
			const muzzle = (this.info.muzzle != null ? this.info.muzzle : Muzzle.Smile) as Muzzle;
			if (this.state.expression.right !== right || this.state.expression.left !== left || this.state.expression.muzzle !== muzzle) {
				this.state.expression = { ...this.state.expression, right, left, muzzle };
			}
		}

		if (!this.syncTimeout) {
			this.syncTimeout = requestAnimationFrame(() => {
				this.syncTimeout = undefined;
				this.syncPreviewHeadTurnState();
				// force preview redraw so flip/head settings apply immediately
				try { this.characterPreview && this.characterPreview.redraw && this.characterPreview.redraw(); } catch { }
				syncLockedPonyInfo(this.info);
			});
		}

		// Always keep preview state's blush color in sync with editor info so
		// the preview shows the correct custom/default color after roundtrips.
		this.state.blushColor = this.info.blushColor ? parseColorWithAlpha(this.info.blushColor, 1) : blushColor(parseColorWithAlpha(this.coatFill || '', 1));

		// If blush effect is disabled in the editor, ensure any transient
		// expression-based blush is cleared from the preview state so the
		// preview doesn't show an expression blush left over from gameplay.
		if (!this.info.blush && this.state.expression && this.state.expression.extra === ExpressionExtra.Blush) {
			this.state.expression = { ...this.state.expression, extra: ExpressionExtra.None };
		}
	}
	update(delta: number) {
		this.animationTime += delta;

		const animation = this.animations[this.activeAnimation]();
		this.state.animation = animation;

		if (this.playAnimation) {
			this.state.animationFrame = Math.floor(this.animationTime * animation.fps) % animation.frames.length;
		}
	}
	copyCoatColorToTail() {
		if (this.info.tail && this.info.tail.fills) {
			this.info.tail.fills[0] = this.info.coatFill;
			this.changed();
		}
	}

	copyCoatColorToPonytail() {
		if (this.info.ponytail && this.info.ponytail.fills) {
			this.info.ponytail.fills[0] = this.info.coatFill;
			this.changed();
		}
	}

	resetBackground() {
		// default green (matches GRASS_COLOR = 0x90ee90ff)
		this.info.previewBackground = '90ee90';
		this.changed();
	}

	resetBlush() {
		this.info.blushColor = 'ff89ae';
		this.changed();
	}

	toggleBlushEffect() {
		this.info.blush = !this.info.blush;
		this.changed();
	}

	toggleSleepingEffect() {
		this.info.sleeping = !this.info.sleeping;
		this.changed();
	}

	toggleTearsEffect() {
		this.info.tears = !this.info.tears;
		if (this.info.tears) {
			this.info.crying = false;
		}
		this.changed();
	}

	toggleCryingEffect() {
		this.info.crying = !this.info.crying;
		if (this.info.crying) {
			this.info.tears = false;
		}
		this.changed();
	}

	toggleHeartsEffect() {
		this.info.hearts = !this.info.hearts;
		this.changed();
	}

	toggleMagicEffect() {
		if (!this.canUseMagicEffect) return;
		this.previewMagic = !this.previewMagic;
		this.changed();
	}

	toggleBackground() {
		this.showBackground = !this.showBackground;
		this.changed();
	}

	toggleHidePreviewName() {
		this.hidePreviewName = !this.hidePreviewName;
		this.changed();
	}

	toggleHidePreviewTag() {
		this.hidePreviewTag = !this.hidePreviewTag;
		this.changed();
	}

	toggleHeadTurned() {
		this.info.headTurned = !this.info.headTurned;
		this.syncPreviewHeadTurnState();
		this.changed();
	}

	private syncPreviewHeadTurnState() {
		const turned = !!this.info.headTurned;
		this.state.headTurned = turned;
		if (turned) {
			this.state.headTurn = 0;
		}
	}

	toggleFlip() {
		this.info.flip = !this.info.flip;
		this.changed();
	}

	eyeColorLockChanged(locked: boolean) {
		if (locked) {
			this.info.eyeColorLeft = this.info.eyeColorRight;
		}
	}
	eyeWhiteLockChanged(locked: boolean) {
		if (locked) {
			this.info.eyeWhitesLeft = this.info.eyeWhites;
		}
	}
	eyeOpennessChanged(locked: boolean) {
		if (locked) {
			this.info.eyeOpennessLeft = this.info.eyeOpennessRight;
		}
		this.changed();
	}
	eyelashLockChanged(locked: boolean) {
		if (locked) {
			this.info.eyelashColorLeft = this.info.eyelashColor;
		}
	}
	eyeshadowLockChanged(locked: boolean) {
		if (locked) {
			this.info.eyeshadowLeft = this.info.eyeshadow;
			this.info.eyeshadowColorLeft = this.info.eyeshadowColor;
		}
	}
	earsLockChanged(locked: boolean) {
		if (locked) {
			this.info.earsRight = cloneDeep(this.info.ears);
		} else {
			this.info.earsRight = cloneDeep(this.info.earsRight || this.info.ears);
		}
	}
	wingsLockChanged(locked: boolean) {
		if (locked) {
			this.info.wingsRight = cloneDeep(this.info.wings);
		} else {
			this.info.wingsRight = cloneDeep(this.info.wingsRight || this.info.wings);
		}
	}
	sleeveLockChanged(locked: boolean) {
		if (locked) {
			this.info.sleeveAccessoryRight = cloneDeep(this.info.sleeveAccessory);
		} else {
			this.info.sleeveAccessoryRight = cloneDeep(this.info.sleeveAccessoryRight || this.info.sleeveAccessory);
		}
	}
	waistLockChanged(locked: boolean) {
		if (locked) {
			this.info.waistAccessoryRight = cloneDeep(this.info.waistAccessory);
		} else {
			this.info.waistAccessoryRight = cloneDeep(this.info.waistAccessoryRight || this.info.waistAccessory);
		}
	}
	bodyLockChanged(locked: boolean) {
		if (locked) {
			this.info.bodyRight = cloneDeep(this.info.body);
		} else {
			this.info.bodyRight = cloneDeep(this.info.bodyRight || this.info.body);
		}
	}
	frontLegsLockChanged(locked: boolean) {
		if (locked) {
			this.info.frontLegsRight = cloneDeep(this.info.frontLegs);
		} else {
			this.info.frontLegsRight = cloneDeep(this.info.frontLegsRight || this.info.frontLegs);
		}
	}
	frontHoovesLockChanged(locked: boolean) {
		if (locked) {
			this.info.frontHoovesRight = cloneDeep(this.info.frontHooves);
		} else {
			this.info.frontHoovesRight = cloneDeep(this.info.frontHoovesRight || this.info.frontHooves);
		}
	}
	backHoovesPairChanged(locked: boolean) {
		if (locked) {
			this.info.backHooves = cloneDeep(this.info.frontHooves);
			this.info.backHoovesRight = cloneDeep(this.lockFrontHooves ? this.info.frontHooves : this.info.frontHoovesRight);
		}
	}
	backHoovesLockChanged(locked: boolean) {
		if (locked) {
			this.info.backHoovesRight = cloneDeep(this.info.backHooves);
		} else {
			this.info.backHoovesRight = cloneDeep(this.info.backHoovesRight || this.info.backHooves);
		}
	}
	backLegsPairChanged(locked: boolean) {
		if (locked) {
			this.info.backLegs = cloneDeep(this.info.frontLegs);
			const sourceRight = this.lockFrontLegsMarkings ? this.info.frontLegs : this.info.frontLegsRight;
			this.info.backLegsRight = cloneDeep(sourceRight);
		} else {
			this.info.backLegs = cloneDeep(this.info.backLegs || this.info.frontLegs);

			if (this.lockBackLegsMarkings) {
				this.info.backLegsRight = cloneDeep(this.info.backLegs);
			} else {
				this.info.backLegsRight = cloneDeep(this.info.backLegsRight || this.info.backLegs);
			}
		}
	}
	backLegsLockChanged(locked: boolean) {
		if (locked) {
			this.info.backLegsRight = cloneDeep(this.info.backLegs);
		} else {
			this.info.backLegsRight = cloneDeep(this.info.backLegsRight || this.info.backLegs);
		}
	}
	select(pony: PonyObject | undefined) {
		if (pony) {
			this.deleting = false;
			this.pony = pony;
			this.resetUndoHistory();
		}
	}

	setActiveAnimation(index: number) {
		this.activeAnimation = index;
		this.animationTime = 0;
	}
	freeOutlinesChanged(_free: boolean) {
		this.changed();
	}
	darkenLockedOutlinesChanged(_darken: boolean) {
		this.changed();
	}
	get canSave() {
		return !this.model.pending && !!this.pony && !!this.pony.name && !this.savingLocked;
	}
	save() {
		if (this.canSave) {
			this.error = undefined;
			this.deleting = false;
			this.savingLocked = true;

			this.model.savePony(this.pony)
				.catch((e: Error) => this.error = e.message)
				.then((savedPony) => {
					if (savedPony) {
						this.resetUndoHistory();
						this.clearAutoSaveDraft(this.pony.id);
					}
					return savedPony;
				})
				.then(() => delay(2000))
				.then(() => this.savingLocked = false);
		}
	}
	get canRevert() {
		return !!findById(this.ponies, this.pony.id);
	}
	revert() {
		if (this.canRevert) {
			this.select(findById(this.ponies, this.pony.id));
			this.clearAutoSaveDraft(this.pony.id);
		}
	}
	get canDuplicate() {
		return this.ponies.length < this.model.characterLimit;
	}
	duplicate() {
		if (this.canDuplicate) {
			this.deleting = false;
			this.pony = cloneDeep(this.pony);
			this.pony.name = '';
			this.pony.id = '';
			this.resetUndoHistory();
		}
	}

	get storedPony() {
		return this.pony.id ? findById(this.ponies, this.pony.id) : undefined;
	}

	get storedPonyInfo() {
		const stored = this.storedPony;
		if (!stored) {
			return undefined;
		}
		if (stored.ponyInfo) {
			return stored.ponyInfo;
		}
		try {
			return decompressPonyString(stored.info, true);
		} catch {
			return undefined;
		}
	}

	get hasUnsavedCharacterChanges() {
		const stored = this.storedPony;
		if (!stored) {
			return false;
		}

		if (this.pony.name !== stored.name || this.pony.desc !== stored.desc || this.pony.site !== stored.site
			|| this.pony.tag !== stored.tag || this.pony.supportTag !== stored.supportTag
			|| this.pony.hideSupport !== stored.hideSupport || this.pony.respawnAtSpawn !== stored.respawnAtSpawn) {
			return true;
		}

		const currentInfo = this.pony.ponyInfo ? compressPonyString(this.pony.ponyInfo) : this.pony.info;
		return currentInfo !== stored.info;
	}

	onPlayRequest(playCallback: (options?: { pony?: PonyObject; skipSave?: boolean }) => void) {
		if (this.hasUnsavedCharacterChanges && this.storedPony) {
			this.openContextModal('play', playCallback);
			return;
		}

		playCallback();
	}

	private openContextModal(context: 'play' | 'restore', playCallback?: (options?: { pony?: PonyObject; skipSave?: boolean }) => void) {
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
		} else {
			this.modalTitle = 'A draft was found for this character.';
			this.modalPrompt = 'Restore the previous draft or discard it and continue with the current character data.';
			this.modalSaveLabel = 'Restore Draft';
			this.modalDiscardLabel = 'Discard Draft';
			this.modalCurrentPony = this.pony.ponyInfo;
			this.modalStoredPony = this.restoreDraftCandidate ? this.restoreDraftCandidate.ponyInfo : undefined;
		}
		this.unsavedChangesModalRef = this.modalService.show(this.unsavedCharacterModalTpl, { class: 'modal-lg', ignoreBackdropClick: true });
	}

	private getAutoSaveDraftKey(ponyId?: string) {
		const accountId = this.model.account ? this.model.account.id : 'anonymous';
		return `character-editor-draft:${accountId}:${ponyId || 'new'}`;
	}

	private saveAutoSaveDraft() {
		const draftKey = this.getAutoSaveDraftKey(this.pony.id || 'new');
		this.storage.setJSON(draftKey, cloneDeep(this.pony));
	}

	private loadAutoSaveDraft(ponyId?: string) {
		return this.storage.getJSON<PonyObject | undefined>(this.getAutoSaveDraftKey(ponyId), undefined as any);
	}

	private clearAutoSaveDraft(ponyId?: string) {
		this.storage.removeItem(this.getAutoSaveDraftKey(ponyId));
	}

	private arePonyObjectsEqual(a: PonyObject | undefined, b: PonyObject | undefined) {
		if (!a || !b) {
			return a === b;
		}
		return JSON.stringify(a) === JSON.stringify(b);
	}

	private tryRestoreAutosaveDraft() {
		if (!this.pony) {
			return;
		}

		const draft = this.loadAutoSaveDraft(this.pony.id || 'new');
		if (!draft) {
			return;
		}

		if (this.arePonyObjectsEqual(draft, this.pony)) {
			return;
		}

		this.restoreDraftCandidate = draft;
		this.openContextModal('restore');
	}

	private closeUnsavedChangesModal() {
		if (this.unsavedChangesModalRef) {
			this.unsavedChangesModalRef.hide();
			this.unsavedChangesModalRef = undefined;
		}
		this.pendingPlayCallback = undefined;
		this.restoreDraftCandidate = undefined;
	}

	confirmSaveAndPlay() {
		if (this.modalContext === 'play' && !this.pendingPlayCallback) {
			return;
		}

		this.error = undefined;
		const draftKey = this.pony.id || 'new';
		this.model.savePony(this.pony)
			.then(savedPony => {
				if (savedPony) {
					this.resetUndoHistory();
					this.clearAutoSaveDraft(draftKey);
				}
				const callback = this.pendingPlayCallback;
				this.closeUnsavedChangesModal();
				if (this.modalContext === 'play') {
					callback!({ pony: savedPony, skipSave: true });
				} else {
					this.applyRestoreDraftCandidate();
				}
			})
			.catch((e: Error) => {
				this.error = e.message;
			})
			.finally(() => {
				this.pendingPlayCallback = undefined;
			});
	}

	private applyRestoreDraftCandidate() {
		if (!this.restoreDraftCandidate) {
			return;
		}
		this.pony = cloneDeep(this.restoreDraftCandidate);
		this.resetUndoHistory();
		this.restoreDraftCandidate = undefined;
	}

	private restoreStoredPony() {
		const stored = this.storedPony;
		if (!stored) {
			return;
		}
		this.pony = cloneDeep(stored);
		this.resetUndoHistory();
	}

	confirmDiscardAndPlay() {
		if (this.modalContext === 'play') {
			if (!this.pendingPlayCallback) {
				return;
			}

			const stored = this.storedPony;
			const callback = this.pendingPlayCallback;
			this.restoreStoredPony();
			this.closeUnsavedChangesModal();
			this.clearAutoSaveDraft(this.pony.id || 'new');
			if (stored) {
				callback!({ pony: stored, skipSave: true });
			} else {
				callback!();
			}
			return;
		}

		this.restoreStoredPony();
		this.clearAutoSaveDraft(this.pony.id || 'new');
		this.closeUnsavedChangesModal();
	}

	cancelPlay() {
		this.restoreStoredPony();
		this.closeUnsavedChangesModal();
	}

	export(index?: number) {
		const frameWidth = 80;
		const frameHeight = 90;
		const animations = index === undefined ? this.animations.map(a => a()) : [this.animations[index]()];
		const frames = animations.reduce((sum, a) => sum + a.frames.length, 0);
		const info = toPalette(this.info);
		const options = defaultDrawPonyOptions();

		const canvas = drawCanvas(frameWidth * frames, frameHeight, sprites.paletteSpriteSheet, TRANSPARENT, batch => {
			let i = 0;

			animations.forEach(a => {
				for (let f = 0; f < a.frames.length; f++ , i++) {
					const state: PonyState = {
						...defaultPonyState(),
						animation: a,
						animationFrame: f,
						blinkFrame: 1,
					};

					drawPony(batch, info, state, i * frameWidth + frameWidth / 2, frameHeight - 10, options);
				}
			});
		});

		const name = animations.length === 1 ? animations[0].name : 'all';
		saveCanvas(canvas, `${this.pony.name}-${name}.png`);
	}
	import() {
		if (DEVELOPMENT) {
			const data = prompt('enter data');

			if (data) {
				this.importPony(data);
			}
		}
	}
	private importPony(data: string) {
		if (DEVELOPMENT) {
			this.pony.ponyInfo = decompressPonyString(data, true);
			const t = decompressPonyString(data, false);
			console.log(JSON.stringify(t, undefined, 2));
		}
	}
	addBlush() {
		if (DEVELOPMENT || BETA) {
			this.state = {
				...this.state,
				expression: createExpression(Eye.Neutral, Eye.Neutral, Muzzle.Smile, Iris.Forward, Iris.Forward, ExpressionExtra.Blush),
			};
			this.changed();
		}
	}
	testSize() {
		function stringifyValues(values: any[]): string {
			return values.map(x => JSON.stringify(x)).join(typeof values[0] === 'object' ? ',\n\t' : ', ');
		}

		if (DEVELOPMENT) {
			const compressed = compressPonyString(this.info);
			const regularSize = JSON.stringify(this.info).length;
			const ponyInfoNumber = decompressPony(compressed);
			const precomp = precompressPony(ponyInfoNumber, BLACK, x => x) as any;
			const details = Object.keys(precomp)
				.filter(key => key !== 'version')
				.map(key => ({ key, values: precomp[key] || [] as any[] }))
				.map(({ key, values }) => `${key}: [\n\t${stringifyValues(values)}\n]`)
				.join(',\n');
			const serialized = compressPonyString(this.info);

			console.log(serialized);
			console.log(details);
			console.log(`${serialized.length} / ${regularSize}`);
		}
	}
	testJSON() {
		if (DEVELOPMENT) {
			console.log(JSON.stringify(this.info, undefined, 2));
		}
	}
	exportPony() {
		const data = ponyToExport(this.pony) + '\r\n';
		saveAs(new Blob([data], { type: 'text/plain;charset=utf-8' }), `${this.pony.name}.txt`);
	}
	exportPonies() {
		const data = this.ponies.map(ponyToExport).join('\r\n') + '\r\n';
		saveAs(new Blob([data], { type: 'text/plain;charset=utf-8' }), 'ponies.txt');
	}
	async importPonies(file: File | undefined) {
		if (file) {
			const text = await readFileAsText(file);
			const lines = text.split(/\r?\n/g);

			for (const line of lines) {
				try {
					const [name, info, desc = ''] = line.split(/\t/g);

					if (name && info) {
						const pony: PonyObject = {
							name,
							id: '',
							info,
							desc,
							ponyInfo: decompressPonyString(info, true),
						};

						await this.model.savePony(pony, true);
					}
				} catch (e) {
					DEVELOPMENT && console.error(e);
				}
			}
		}
	}
}

function ponyToExport(pony: PonyObject) {
	return `${pony.name}\t${pony.info}\t${pony.desc || ''}`.trim();
}
