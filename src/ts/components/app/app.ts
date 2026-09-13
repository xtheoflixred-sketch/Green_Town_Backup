import { Component, OnInit, OnDestroy, DoCheck, HostListener, ViewChild, ElementRef, TemplateRef } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { TooltipConfig } from 'ngx-bootstrap/tooltip';
import { PopoverConfig } from 'ngx-bootstrap/popover';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Subscription } from 'rxjs';
import { GameService } from '../services/gameService';
import { Model, Friend } from '../services/model';
import { version, host, contactEmail, discordLink, copyrightName, contactDiscord, telegramLink, tiktokLink } from '../../client/data';
import { PonyTownGame } from '../../client/game';
import { faPatreon, faDiscord, faEnvelope, faCog, faHome, faInfoCircle, faHorseHead, faQuestionCircle, faTiktok, faPaperPlane, faSuitcaseRolling, faSignInAlt, faMapMarkerAlt, faClock, faMap } from '../../client/icons';
import { OAuthProvider, Entity, FakeEntity, Pony, Action, ScreenEntityOptions } from '../../common/interfaces';
import { registerServiceWorker, isBrowserOutdated, checkIframeKey, initLoader } from '../../client/clientUtils';
import { ErrorReporter } from '../services/errorReporter';
import { SECOND, PONY_TYPE } from '../../common/constants';
import { ChatBox } from '../shared/chat-box/chat-box';
import { ChatLog, ChatLogMessage } from '../shared/chat-log/chat-log';
import { isPony } from '../../common/pony';
import { canOpenProfile } from '../../common/entityUtils';
import { findEntityById } from '../../common/worldMap';
import { isSelected } from '../../client/gameUtils';
import { AgDragEvent } from '../shared/directives/agDrag';
import { FriendsBox } from '../shared/friends-box/friends-box';
import { SettingsBox } from '../shared/settings-box/settings-box';
import { isDevChangelogVisible } from '../../common/changelogUtils';

interface Tier4Profile {
	id: number;
	pony: Pony;
	x: number;
	y: number;
}

function findPonyById(map: any, id: number): any {
	return map.entities.find((e: any) => e.id === id && e.type === PONY_TYPE);
}

export function tooltipConfig() {
	return Object.assign(new TooltipConfig(), { container: 'body' });
}

export function popoverConfig() {
	return Object.assign(new PopoverConfig(), { container: 'body' });
}

@Component({
	selector: 'pony-town-app',
	templateUrl: 'app.pug',
	styleUrls: ['app.scss'],
	providers: [
		{ provide: TooltipConfig, useFactory: tooltipConfig },
		{ provide: PopoverConfig, useFactory: popoverConfig },
	]
})
export class App implements OnInit, OnDestroy, DoCheck {
	@ViewChild('announcer', { static: true }) announcer!: ElementRef;
	@ViewChild('announcerText', { static: true }) announcerText!: ElementRef;
	@ViewChild('reloadModal', { static: true }) reloadModal!: TemplateRef<any>;
	@ViewChild('signInModal', { static: true }) signInModal!: TemplateRef<any>;
	@ViewChild('changelogModal', { static: true }) changelogModal!: TemplateRef<any>;
	@ViewChild('devChangelogModal', { static: true }) devChangelogModal!: TemplateRef<any>;
	@ViewChild('settingsModal', { static: true }) settingsModal!: TemplateRef<any>;
	@ViewChild('teleportModal', { static: true }) teleportModal!: TemplateRef<any>;
	@ViewChild('timeModal', { static: true }) timeModal!: TemplateRef<any>;
	@ViewChild('screenEntityModal', { static: true }) screenEntityModal!: TemplateRef<any>;
	@ViewChild('gameCharacterModal', { static: true }) gameCharacterModal!: TemplateRef<any>;
	@ViewChild('friendsBox', { static: false }) friendsBox?: FriendsBox;
	@ViewChild('chatLogComp', { static: false }) chatLogComp?: ChatLog;
	@ViewChild(SettingsBox, { static: false }) settingsBox?: SettingsBox;
	changelogModalRef?: BsModalRef;
	devChangelogModalRef?: BsModalRef;
	settingsModalRef?: BsModalRef;
	teleportModalRef?: BsModalRef;
	timeModalRef?: BsModalRef;
	screenEntityModalRef?: BsModalRef;
	screenEntityModalEntity?: Entity;
	gameCharacterModalRef?: BsModalRef;
	readonly version = version;
	readonly date = new Date();
	readonly emailIcon = faEnvelope;
	readonly patreonIcon = faPatreon;
	readonly discordIcon = faDiscord;
	readonly cogIcon = faCog;
	readonly homeIcon = faHome;
	readonly helpIcon = faQuestionCircle;
	readonly aboutIcon = faInfoCircle;
	readonly charactersIcon = faHorseHead;
	readonly welcomeIcon = faSignInAlt;
	readonly telegramIcon = faPaperPlane;
	readonly tiktokIcon = faTiktok;
	readonly inventoryIcon = faSuitcaseRolling;
	readonly teleportIcon = faMapMarkerAlt;
	readonly timeIcon = faClock;
	readonly mapIcon = faMap;
	readonly contactEmail = contactEmail;
	readonly contactDiscord = contactDiscord;
	readonly discordLink = discordLink;
	readonly tiktokLink = tiktokLink;
	readonly telegramLink = telegramLink;
	readonly copyright = copyrightName;
	private url = location.pathname;
	private reloadModalRef?: BsModalRef;
	private reloadInterval?: any;
	private subscriptions: Subscription[] = [];
	private announcerTimeout?: any;
	signOutLoading = false;
	signOutError?: string;
	inventoryOpen = false;
	private lastSelectedId = 0;
	private appliedBackgroundPowerSave?: boolean;
	private dragStartByProfileId = new Map<number, { x: number; y: number; }>();
	private documentMouseDownCapture = (event: MouseEvent) => this.onOutsideProfileMouseDown(event);
	private readonly gameTabEmoji = ' 🐴';
	private lastDocumentTitle = document.title;
	private lastPlayingState = false;
	tier4Profiles: Tier4Profile[] = [];
	constructor(
		private modalService: BsModalService,
		private gameService: GameService,
		private model: Model,
		private game: PonyTownGame,
		private router: Router,
		private activatedRoute: ActivatedRoute,
		private errorReporter: ErrorReporter,
	) {
	}
	get canInstall() {
		return false;
	}
	get loading() {
		return this.model.loading;
	}
	get account() {
		return this.model.account;
	}
	get isMod() {
		return this.model.isMod;
	}
	get isBuilder() {
		return this.model.isBuilder;
	}
	get canViewDevChangelog() {
		return isDevChangelogVisible(this.model.account);
	}
	get notifications() {
		return this.game.notifications;
	}
	get selected() {
		return this.gameService.selected;
	}
	get playing() {
		return this.gameService.playing;
	}
	get showActionBar() {
		return this.playing;
	}

	toggleMiniMap() {
		this.game.debugToggleMinimap();
	}

	openTeleportModal() {
		if (!this.isMod || this.teleportModalRef) return;
		this.teleportModalRef = this.modalService.show(this.teleportModal, { class: 'modal-lg', ignoreBackdropClick: true });
		const refAny: any = this.teleportModalRef as any;
		if (refAny && refAny.onHidden && refAny.onHidden.subscribe) {
			refAny.onHidden.subscribe(() => this.teleportModalRef = undefined);
		}
	}

	closeTeleportModal() {
		if (this.teleportModalRef) {
			this.teleportModalRef.hide();
			this.teleportModalRef = undefined;
		}
	}

	openTimeModal() {
		if (!this.isMod || this.timeModalRef) return;
		this.timeModalRef = this.modalService.show(this.timeModal, { class: 'modal-lg time-modal-wide', ignoreBackdropClick: true });
		const refAny: any = this.timeModalRef as any;
		if (refAny && refAny.onHidden && refAny.onHidden.subscribe) {
			refAny.onHidden.subscribe(() => this.timeModalRef = undefined);
		}
	}

	closeTimeModal() {
		if (this.timeModalRef) {
			this.timeModalRef.hide();
			this.timeModalRef = undefined;
		}
	}

	get isChatLogOpen() {
		return !!(this.chatLogComp && this.chatLogComp.open);
	}

	toggleInventory() {
		this.inventoryOpen = !this.inventoryOpen;
	}

	private get tabTitleSuffix() {
		return this.playing ? this.gameTabEmoji : '';
	}

	private updateDocumentTitle() {
		const currentTitle = document.title || this.lastDocumentTitle;
		const hasEmoji = currentTitle.endsWith(this.gameTabEmoji);
		const baseTitle = hasEmoji
			? currentTitle.slice(0, -this.gameTabEmoji.length)
			: currentTitle;

		const newTitle = baseTitle + this.tabTitleSuffix;
		if (newTitle !== currentTitle) {
			document.title = newTitle;
			this.lastDocumentTitle = baseTitle;
		}
	}

	get canUseTier4Profiles() {
		return this.model.supporter >= 4;
	}
	get editingActions() {
		return this.game.editingActions;
	}
	ngOnInit() {
		this.inventoryOpen = false;
		this.lastDocumentTitle = document.title;
		this.lastPlayingState = this.playing;
		this.updateDocumentTitle();
		this.subscriptions.push(this.game.onScreenEntityClick.subscribe(entity => this.openScreenEntityModal(entity)));
		// Проверяем, существует ли ga в глобальном объекте window
		if (typeof (window as any)['ga'] !== 'undefined') {
			this.subscriptions.push(this.router.events.subscribe(event => {
				if (event instanceof NavigationEnd && this.url !== event.url) {
					(window as any)['ga']('set', 'page', this.url = event.url);
					(window as any)['ga']('send', 'pageview');
				}
			}));
		}

		if (isBrowserOutdated) {
			this.errorReporter.disable();
		}

		if (!DEVELOPMENT) {
			registerServiceWorker(`${host}sw.js`, () => {
				this.model.updating = true;
				setTimeout(() => {
					this.model.updatingTakesLongTime = true;
				}, 20 * SECOND);
			});
		}

		initLoader();

		this.subscriptions.push(this.game.announcements.subscribe(message => {
			const announcer = this.announcer.nativeElement as HTMLElement;
			const announcerText = this.announcerText.nativeElement as HTMLElement;
			announcerText.textContent = message;
			announcer.classList.add('show');

			if (this.announcerTimeout !== undefined) {
				clearTimeout(this.announcerTimeout);
			}

			this.announcerTimeout = setTimeout(() => {
				announcer.classList.remove('show');
				announcerText.textContent = '';
			}, 3000);
		}));

		this.activatedRoute.queryParams.subscribe(({ error, merged, alert }) => {
			this.model.authError = error;
			this.model.accountAlert = alert;
			this.model.mergedAccount = !!merged;
		});

		this.subscriptions.push(this.model.protectionErrors.subscribe(() => {
			this.openReloadModal();
		}));

		this.subscriptions.push(this.game.onOpenGameCharacter.subscribe(() => {
			if (!document.body.classList.contains('modal-open')) {
				this.openGameCharacterModal();
			}
		}));

		document.addEventListener('mousedown', this.documentMouseDownCapture, true);
	}

	openScreenEntityModal(entity: Entity) {
		if (this.screenEntityModalRef) return;
		this.screenEntityModalEntity = entity;
		this.screenEntityModalRef = this.modalService.show(this.screenEntityModal, { class: 'modal-lg' });
	}

	closeScreenEntityModal() {
		if (this.screenEntityModalRef) this.screenEntityModalRef.hide();
		this.screenEntityModalRef = undefined;
		this.screenEntityModalEntity = undefined;
	}

	saveScreenEntity(options: ScreenEntityOptions) {
		if (this.screenEntityModalEntity) this.game.updateScreenEntity(this.screenEntityModalEntity, options);
		this.closeScreenEntityModal();
	}

	controlScreenEntity(command: 'play' | 'pause') {
		if (this.screenEntityModalEntity) this.game.controlScreenEntity(this.screenEntityModalEntity, command);
	}
	ngDoCheck() {
		this.syncBackgroundModeClass();
		this.syncTier4Profiles();
		if (this.playing !== this.lastPlayingState) {
			this.lastPlayingState = this.playing;
			this.updateDocumentTitle();
		}
	}
	ngOnDestroy() {
		document.removeEventListener('mousedown', this.documentMouseDownCapture, true);
		this.subscriptions.forEach(s => s.unsubscribe());
	}
	trackByTier4Profile(_index: number, profile: Tier4Profile) {
		return profile.id;
	}
	isTier4ProfileDragging(profileId: number) {
		return this.dragStartByProfileId.has(profileId);
	}
	onTier4ProfileDrag(profileId: number, { type, dx, dy }: AgDragEvent) {
		const index = this.tier4Profiles.findIndex(p => p.id === profileId);

		if (index === -1) return;

		const profile = this.tier4Profiles[index];

		if (type === 'start') {
			this.dragStartByProfileId.set(profileId, { x: profile.x, y: profile.y });
			return;
		}

		const start = this.dragStartByProfileId.get(profileId);
		if (!start) return;

		const width = 430;
		const height = 110;
		const maxX = Math.max(10, window.innerWidth - width - 10);
		const maxY = Math.max(10, window.innerHeight - height - 10);
		profile.x = Math.min(maxX, Math.max(10, start.x + dx));
		profile.y = Math.min(maxY, Math.max(10, start.y + dy));

		if (type === 'end') {
			this.dragStartByProfileId.delete(profileId);
		}
	}
	private syncTier4Profiles() {
		if (!this.playing || !this.canUseTier4Profiles) {
			if (this.tier4Profiles.length) this.tier4Profiles = [];
			this.dragStartByProfileId.clear();
			this.lastSelectedId = 0;
			return;
		}

		const selected = this.selected;
		const selectedId = selected ? selected.id : 0;

		if (!selectedId && this.lastSelectedId && this.tier4Profiles.length) {
			this.closeOneTier4Profile();
		}

		if (selected && selectedId && selectedId !== this.lastSelectedId) {
			this.addOrMoveTier4Profile(selected as Pony);
		}

		this.lastSelectedId = selectedId;

		this.tier4Profiles = this.tier4Profiles.map(profile => {
			const current = findEntityById(this.game.map, profile.id);

			if (current) {
				const pony = current as Pony as any;
				if (pony.offline) {
					delete pony.offline;
				}
				if (pony.options && pony.options.offline) {
					delete pony.options.offline;
				}
				return { ...profile, pony: pony as Pony };
			}

			const offlinePony = { ...(profile.pony as any), offline: true } as Pony;
			return { ...profile, pony: offlinePony };
		});
	}
	private addOrMoveTier4Profile(pony: Pony) {
		const existingIndex = this.tier4Profiles.findIndex(p => p.id === pony.id);

		if (existingIndex !== -1) {
			const [existing] = this.tier4Profiles.splice(existingIndex, 1);
			existing.pony = pony;
			this.tier4Profiles.unshift(existing);
			return;
		}

		const offset = this.tier4Profiles.length;
		this.tier4Profiles.unshift({
			id: pony.id,
			pony,
			x: 10 + (offset * 24),
			y: 10 + (offset * 24),
		});

		if (this.tier4Profiles.length > 3) {
			const removed = this.tier4Profiles.pop();
			if (removed) {
				this.dragStartByProfileId.delete(removed.id);
			}
		}
	}

	private syncBackgroundModeClass() {
		const account = this.model.account;
		const settings = account && account.settings;
		const powerSaveMode = !settings || settings.powerSaveModeInBackground !== false;

		if (this.appliedBackgroundPowerSave === powerSaveMode) return;

		document.body.classList.toggle('background-style-new', !powerSaveMode);
		this.appliedBackgroundPowerSave = powerSaveMode;
	}
	private closeOneTier4Profile() {
		const removed = this.tier4Profiles.pop();
		if (removed) {
			this.dragStartByProfileId.delete(removed.id);
		}
	}
	private onOutsideProfileMouseDown(event: MouseEvent) {
		if (!this.playing || !this.canUseTier4Profiles || this.selected || !this.tier4Profiles.length) {
			return;
		}

		let target = event.target as Node | null;

		if (target && target.nodeType !== Node.ELEMENT_NODE) {
			target = target.parentNode;
		}

		const element = target as Element | null;
		if (!target) {
			return;
		}

		if (element && element.closest('.pony-box-floating')) {
			return;
		}

		this.closeOneTier4Profile();
	}
	@HostListener('window:focus')
	focus() {
		this.model.verifyAccount();
	}
	signIn(provider: OAuthProvider) {
		this.model.signIn(provider);
	}
	signOut() {
		if (this.signOutLoading) {
			return;
		}

		this.signOutLoading = true;
		this.signOutError = undefined;

		const signOutPromise = this.model.signOut()
			.then(() => ({ success: true } as const))
			.catch((error: any) => ({
				success: false,
				error: error && error.message ? error.message : 'Connection lost',
			}));

		signOutPromise
			.then(result => {
				if (!result.success) {
					this.signOutError = result.error || 'Connection lost';
				}
			})
			.finally(() => {
				this.signOutLoading = false;
			});
	}
	openReloadModal() {
		if (!this.reloadModalRef) {
			this.reloadModalRef = this.modalService.show(
				this.reloadModal, { class: 'modal-lg', ignoreBackdropClick: true, keyboard: false });

			this.reloadInterval = setInterval(() => {
				if (checkIframeKey('reload-frame', 'gep84r9jshge4g')) {
					this.cancelReloadModal();
				}
			}, 500);
		}
	}
	cancelReloadModal() {
		if (this.reloadModalRef) {
			this.reloadModalRef.hide();
			this.reloadModalRef = undefined;
		}

		clearInterval(this.reloadInterval);
	}

	openChangelog() {
		if (this.changelogModalRef) {
			this.changelogModalRef.hide();
			this.changelogModalRef = undefined;
		}
		this.changelogModalRef = this.modalService.show(this.changelogModal, { class: 'modal-lg' });
		const refAny: any = this.changelogModalRef as any;
		if (refAny && refAny.onHidden && refAny.onHidden.subscribe) {
			refAny.onHidden.subscribe(() => {
				this.changelogModalRef = undefined;
			});
		}
	}

	openDevChangelog() {
		if (this.devChangelogModalRef) {
			this.devChangelogModalRef.hide();
		}
		this.devChangelogModalRef = this.modalService.show(this.devChangelogModal, { class: 'modal-lg' });
	}

	openSettings() {
		if (this.settingsBox) {
			this.settingsBox.openSettings();
		}
	}
	chatLogNameClick(chatBox: ChatBox, message: ChatLogMessage) {
		if (!message.entityId) {
			return;
		}

		let entity = findEntityById(this.game.map, message.entityId);

		if (entity && (!isPony(entity) || entity === this.game.player)) {
			return;
		}

		if (!entity) {
			entity = { fake: true, type: PONY_TYPE, id: message.entityId, name: message.name } as FakeEntity as any;
		}

		if (isSelected(this.game, message.entityId)) {
			this.game.whisperTo = entity;
			chatBox.setChatType('whisper');
		} else {
			this.game.select(entity as Pony);
		}
	}
	messageToFriend(chatBox: ChatBox, friend: Friend) {
		if (friend.entityId) {
			const entity: any = { id: friend.entityId, name: friend.actualName || 'unknown' };
			this.messageToPony(chatBox, entity);
		}
	}
	messageToPony(chatBox: ChatBox, pony: Entity) {
		setTimeout(() => {
			this.game.whisperTo = pony;
			chatBox.setChatType('whisper');
		});
	}
	openFriendsList() {
		if (this.friendsBox) {
			this.friendsBox.openList();
		}
	}
	openGameCharacterModal() {
		if (this.gameCharacterModalRef) {
			this.gameCharacterModalRef.hide();
			this.gameCharacterModalRef = undefined;
		}
		this.gameCharacterModalRef = this.modalService.show(
			this.gameCharacterModal, { class: 'modal-xl', ignoreBackdropClick: false });
		const refAny: any = this.gameCharacterModalRef as any;
		const clearRef = () => { this.gameCharacterModalRef = undefined; };
		if (refAny) {
			if (refAny.onHide && refAny.onHide.subscribe) {
				refAny.onHide.subscribe(clearRef);
			} else if (refAny.onHidden && refAny.onHidden.subscribe) {
				refAny.onHidden.subscribe(clearRef);
			}
		}
	}
	openSettingsModal() {
        if (this.settingsModalRef) {
            this.settingsModalRef.hide();
            this.settingsModalRef = undefined;
        }
        
        // Проверяем, существует ли шаблон перед открытием
        if (this.settingsModal) {
            this.settingsModalRef = this.modalService.show(this.settingsModal, { class: 'modal-lg' });
            
            // Подписка на закрытие модалки, чтобы очистить ссылку
            const refAny: any = this.settingsModalRef as any;
            const clearRef = () => { 
                this.settingsModalRef = undefined; 
            };
            
            if (refAny && refAny.onHide) {
                refAny.onHide.subscribe(clearRef);
            }
        }
    }

    closeSettingsModal() {
        if (this.settingsModalRef) {
            this.settingsModalRef.hide();
            this.settingsModalRef = undefined;
        }
    }
	playAndSwapCharacter() {
		const pony = this.model.pony;
		if (!pony) return;
		this.model.savePony(pony)
			.then(newPony => {
				const id = (newPony && newPony.id) || pony.id;
				if (id) {
					this.game.send(server => server.actionParam(Action.SwapCharacter, id));
					if (newPony) {
						newPony.lastUsed = (new Date()).toISOString();
					}
					this.model.sortPonies();
				}
				if (this.gameCharacterModalRef) {
					this.gameCharacterModalRef.hide();
				}
			})
			.catch((e: Error) => {
				console.error('Failed to save pony:', e);
			});
	}
	openProfile(friend: Friend) {
		if (friend.entityId) {
			const pony = findPonyById(this.game.map, friend.entityId);
			if (pony && canOpenProfile(pony, this.game.mod)) {
				this.game.select(pony);
				return;
			}
		}
		// Создать фейковый Pony для оффлайн или скрытого друга
		const fakePony = {
			fake: true,
			type: PONY_TYPE,
			id: friend.entityId || 0,
			accountId: friend.accountId,
			name: friend.actualName,
			offline: !friend.hidden,
			showAsOffline: !!friend.hidden,
		} as any;
		this.game.select(fakePony);
	}
}
