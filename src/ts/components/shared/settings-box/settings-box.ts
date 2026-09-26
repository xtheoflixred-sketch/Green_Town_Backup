import { Component, OnInit, OnDestroy, NgZone, ViewChild, TemplateRef } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { Subscription, interval } from 'rxjs';
import { Action } from '../../../common/interfaces';
import { GameService } from '../../services/gameService';
import { Model } from '../../services/model';
import { PonyTownGame } from '../../../client/game';
import { isMobile } from '../../../client/data';
import { Dropdown } from '../directives/dropdown';
import {
	emptyIcon, faCog, faSearch, faSignOutAlt, faVolumeOff, faVolumeUp, faVolumeDown, faPlus, faMinus,
	faStepForward, faPause, faPlay, faChevronUp, faChevronDown, faStar, faClock, faCheck,
	faSun, faMoon, faCloudRain, faBolt,
} from '../../../client/icons';
import { SettingsService } from '../../services/settingsService';
import { Audio } from '../../services/audio';
import { getZoomScaleBounds, MIN_SCALE, MAX_SCALE } from '../../../common/constants';
import { EntityPlayerState, Holiday, Weather } from '../../../common/interfaces';
import { hasFlag } from '../../../common/utils';
import { formatHourMinutes, isDay } from '../../../common/timeUtils';

@Component({
	selector: 'settings-box',
	templateUrl: 'settings-box.pug',
	styleUrls: ['settings-box.scss'],
})
export class SettingsBox implements OnInit, OnDestroy {
	readonly cogIcon = faCog;
	readonly searchIcon = faSearch;
	readonly signOutIcon = faSignOutAlt;
	readonly volumeOffIcon = faVolumeOff;
	readonly volumeDownIcon = faVolumeDown;
	readonly volumeUpIcon = faVolumeUp;
	readonly emptyIcon = emptyIcon;
	readonly checkIcon = faCheck;
	readonly plusIcon = faPlus;
	readonly minusIcon = faMinus;
	readonly backwardIcon = faStepForward;
	readonly afkIcon = faClock;

	get isAfk(): boolean {
		const player = this.game.player;
		return !!(player && hasFlag(player.playerState, EntityPlayerState.Afk));
	}
	readonly pauseIcon = faPause;
	readonly playIcon = faPlay;
	readonly forwardIcon = faStepForward;
	readonly chevronUpIcon = faChevronUp;
	readonly chevronDownIcon = faChevronDown;
	readonly starIcon = faStar;

	modalRef?: BsModalRef;
	get time() {
		const timeMode = this.game.worldState && this.game.worldState.timeMode;
		if (timeMode === 'day') return 'Eternal day';
		if (timeMode === 'night') return 'Eternal night';
		if (timeMode === 'frozen' || this.game.worldState && this.game.worldState.timeFrozen) return 'Frozen';
		return formatHourMinutes(this.game.time);
	}

	get weatherIcon() {
		if (this.game.map.state.weather === Weather.Storm) {
			return faBolt;
		}
		if (this.game.map.state.weather === Weather.Rain) {
			return faCloudRain;
		}
		return isDay(this.game.time) ? faSun : faMoon;
	}


	// dynamic zoom based on supporter tier
	get scaleOptions() {
		return getZoomScaleBounds(this.model.supporter || 0);
	}

	musicExpanded = false;
	visualizerBars = [0, 0, 0, 0, 0];

	private updateSubscription?: Subscription;
	private modalLifecycleSubscription?: Subscription;
	private lastModalState?: boolean;
	private subscription?: Subscription;

	@ViewChild('dropdown', { static: true }) dropdown!: Dropdown;
	@ViewChild('actionsModal', { static: true }) actionsModal!: TemplateRef<any>;
	@ViewChild('settingsModal', { static: true }) settingsModal!: TemplateRef<any>;
	@ViewChild('invitesModal', { static: true }) invitesModal!: TemplateRef<any>;
	@ViewChild('toyModal', { static: true }) toyModal!: TemplateRef<any>;
	@ViewChild('testModal', { static: true }) testModal!: TemplateRef<any>;
	@ViewChild('builderToolsModal', { static: true }) builderToolsModal!: TemplateRef<any>;

	constructor(
		private model: Model,
		private modalService: BsModalService,
		private settingsService: SettingsService,
		private gameService: GameService,
		private game: PonyTownGame,
		private audio: Audio,
		private zone: NgZone,
	) {}

	// =====================
	// SCALE / ZOOM SYSTEM
	// =====================

	get scale() {
		return this.game.scale;
	}


	get supporterZoomActive() {
		return this.game.scale < MIN_SCALE || this.game.scale > MAX_SCALE;
	}

	get zoomIcon() {
		return this.supporterZoomActive ? this.starIcon : this.searchIcon;
	}

	get zoomIconClass() {
		if (!this.supporterZoomActive || !this.model.supporter) {
			return undefined;
		}

		const level = Math.max(1, Math.min(4, this.model.supporter));
		return `supporter-${level}`;
	}
    get showSeeThroughButtonInSettingsBox() {
        return this.settings.showSeeThroughObjectsButtonInSettingsBox !== false;
    }

    get showDisableUIButtonInSettingsBox() {
        return this.settings.showDisableUIButtonInSettingsBox !== false;
    }

    get seeThroughButtonText() {
        const label = this.settings.seeThroughObjects ? 'Hide obstacles' : 'Show obstacles';
        return !this.isMobile ? `${label} (F4)` : label;
    }

    get disableUIButtonText() {
        const label = this.settings.disableUI ? 'Enable UI' : 'Disable UI';
        return !this.isMobile ? `${label} (F6)` : label;
    }

    get testModalButtonText() {
        return !this.isMobile ? 'Testing modal' : 'Test modal';
    }

    toggleSeeThrough() {
        this.settings.seeThroughObjects = !this.settings.seeThroughObjects;
        this.settingsService.saveAccountSettings(this.settings);
        this.dropdown.close();
    }

    toggleDisableUI() {
        this.settings.disableUI = !this.settings.disableUI;
        this.settingsService.saveAccountSettings(this.settings);
        this.dropdown.close();
    }


	private clampZoom() {
		const { min, max } = this.scaleOptions;
		if (this.game.scale < min) this.game.scale = min;
		if (this.game.scale > max) this.game.scale = max;
	}

	// =====================
	// VOLUME
	// =====================

	get volume() {
		return this.game.volume;
	}

	set volume(value: number) {
		this.settingsService.browser.volume = value;
		this.settingsService.saveBrowserSettings();
		this.audio.setVolume(value);
	}

	get server() {
		return this.gameService.server && this.gameService.server.name || '';
	}

	get settings() {
		return this.model.account && this.model.account.settings || {};
	}

	get hasCollectedToys() {
		const account: any = this.model.account;
		const toys = account && account.state && account.state.toys;
		return (typeof toys === 'number' ? toys : parseInt(toys, 10) || 0) !== 0;
	}

	get showToysButton() {
		return this.hasCollectedToys || this.game.holiday === Holiday.Christmas;
	}

	get isMobile() {
		return isMobile;
	}

	// =====================
	// LIFECYCLE
	// =====================

	ngOnInit() {
		this.subscription = new Subscription();
		this.subscription.add(this.game.onOpenToyModal.subscribe(() => {
			if (!document.body.classList.contains('modal-open')) {
				this.zone.run(() => this.openToys());
			}
		}));

		this.subscription.add(this.game.onOpenTestModal.subscribe(() => {
			if (!document.body.classList.contains('modal-open')) {
				this.zone.run(() => this.openTestModal());
			}
		}));

		this.updateSubscription = interval(100).subscribe(() => {
			this.updateVisualizerBars();
			this.syncModalStateFromDom();
		});
	}

	ngOnDestroy() {
		if (this.subscription) {
			this.subscription.unsubscribe();
		}
		if (this.updateSubscription) {
			this.updateSubscription.unsubscribe();
		}
		if (this.modalLifecycleSubscription) {
			this.modalLifecycleSubscription.unsubscribe();
		}
		this.setPlayerModalState(false);
	}

	// =====================
	// ZOOM CONTROLS
	// =====================

	zoomOut() {
		this.game.zoomOut();
		this.clampZoom();
	}

	zoomIn() {
		this.game.zoomIn();
		this.clampZoom();
	}

	// =====================
	// (rest unchanged)
	// =====================

	get track() {
		return this.game.audio.trackName;
	}

	get trackProgress() {
		return this.audio.progress;
	}

	get trackCurrentTime() {
		return this.formatTime(this.audio.currentTime);
	}

	get trackDuration() {
		return this.formatTime(this.audio.duration);
	}

	get isPlaying() {
		return this.audio.isPlaying;
	}

	get volumeIcon() {
		return this.volume === 0 ? this.volumeOffIcon : (this.volume < 50 ? this.volumeDownIcon : this.volumeUpIcon);
	}

	get isMod() {
		return this.model.isMod;
	}

	get isBuilderOrMod() {
		return this.model.isBuilder || this.model.isMod;
	}

	get hasInvites() {
		return this.isMod;
	}

	get isEditingModal(): boolean {
		const player = this.game.player as any;
		return !!(player && hasFlag(player.playerState, EntityPlayerState.EditingCharacter));
	}

	// ---------------------
	// remaining original methods unchanged
	// (omitted here ONLY for brevity of patch application)
	// ---------------------

	updateVisualizerBars() {
		const playing = this.isPlaying && this.volume > 0;
		const volumeLevel = Math.min(1, Math.max(0, this.volume / 100));
		const minLevel = playing ? 0.22 + volumeLevel * 0.08 : 0.04;
		const swing = playing ? 0.26 + volumeLevel * 0.38 : 0.07;
		const smoothing = playing ? 0.28 : 0.16;
		const jitter = playing ? 0.08 : 0.02;

		this.visualizerBars = this.visualizerBars.map(value => {
			const target = Math.min(1, Math.max(0, minLevel + Math.random() * swing + (Math.random() - 0.5) * jitter));
			return value + (target - value) * smoothing;
		});
	}

	formatTime(seconds: number): string {
		if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
	}

	leave() {
		this.gameService.leave('From settings dropdown');
		this.dropdown.close();
	}

	toggleVolume() {
		this.volume = this.volume === 0 ? 50 : 0;
	}

	volumeStarted() {
		this.game.audio.forcePlay();
	}

	nextTrack() {
		this.audio.playNextTrack();
	}

	previousTrack() {
		this.audio.playPreviousTrack();
	}

	seek(event: MouseEvent) {
		const target = event.currentTarget as HTMLElement | null;
		if (!target || !this.audio.duration || !isFinite(this.audio.duration)) return;
		const rect = target.getBoundingClientRect();
		const percent = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
		this.audio.seekTo(percent * this.audio.duration);
	}

	togglePausePlay() {
		this.isPlaying ? this.audio.pause() : this.audio.play();
	}

	toggleMusicExpanded() {
		this.musicExpanded = !this.musicExpanded;
	}

	// modal + state sync unchanged below

	openModal(template: TemplateRef<any>) {
		this.modalRef = this.modalService.show(template, { ignoreBackdropClick: true });
		this.setPlayerModalState(true);

		if (this.modalLifecycleSubscription) {
			this.modalLifecycleSubscription.unsubscribe();
		}
		const onHidden: any = this.modalRef && (this.modalRef as any).onHidden;
		if (onHidden && onHidden.subscribe) {
			this.modalLifecycleSubscription = onHidden.subscribe(() => this.setPlayerModalState(false));
		}
	}

	private setPlayerModalState(value: boolean) {
		const player: any = this.game.player;
		if (!player) return;
		player.options = player.options || {};
		if (hasFlag(player.playerState, EntityPlayerState.EditingCharacter)) {
			return;
		}
		if (this.lastModalState === value) return;
		this.lastModalState = value;
		this.game.send(server => server.actionParam(Action.ModalState, value));
		player.inModal = value;
		player.options.modal = value;
		const selected: any = this.game.selected;
		if (selected && selected.id === player.id) {
			selected.options = selected.options || {};
			selected.inModal = value;
			selected.options.modal = value;
		}
	}

	private syncModalStateFromDom() {
		this.setPlayerModalState(document.body.classList.contains('modal-open'));
	}

	openSettings() {
		this.openModal(this.settingsModal);
		this.dropdown.close();
	}

	openActions() {
		this.openModal(this.actionsModal);
		this.dropdown.close();
	}

	openInvites() {
		if ((window as any).BETA) {
			this.openModal(this.invitesModal);
			this.dropdown.close();
		}
	}

	openToys() {
		if (!this.showToysButton || !this.hasCollectedToys) return;
		this.openModal(this.toyModal);
		this.dropdown.close();
	}

	openTestModal() {
		this.openModal(this.testModal);
		this.dropdown.close();
	}

	openBuilderTools() {
		if (!this.isBuilderOrMod) return;
		this.openModal(this.builderToolsModal);
		this.dropdown.close();
	}

	openGameCharacter() {
		this.game.onOpenGameCharacter.next();
		this.dropdown.close();
	}

	openOwnProfile(event?: MouseEvent) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}

		if (this.game.player) {
			this.game.ignoreSelectionClear();
			this.game.select(this.game.player);
		}
		this.dropdown.close();
	}
}
