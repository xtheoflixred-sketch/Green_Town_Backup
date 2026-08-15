import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { PlayerAction, Pony, EntityPlayerState, Entity } from '../../../common/interfaces';
import { getPaletteInfo } from '../../../common/pony';
import { Model } from '../../services/model';
import { GameService } from '../../services/gameService';
import { PonyTownGame } from '../../../client/game';
import {
	partyLeaderIcon, faUserPlus, faUserTimes, faCheck, faMicrophoneSlash, faEyeSlash, faStar, faUserMinus,
	faUserCog, faUserCircle, faComment, faUserCheck, faUserFriends, faPlug, faFolderOpen, faClock, faUndo, faPencilAlt, faComments,
	faSignOutAlt,
	faExchangeAlt, faArrowRight, faArrowLeft, faHorseHead, faStickyNote, faThumbtack, faEllipsisV
} from '../../../client/icons';
import { DAY, TILE_CHANGE_RANGE } from '../../../common/constants';
import { isPonyInParty, isPartyLeader } from '../../../client/partyUtils';
import { getTag, getTagTooltip } from '../../../common/tags';
import { isIgnored, isHidden, isFriend, isTyping, isEditingCharacter, isNpcEntity } from '../../../common/entityUtils';
import { hasFlag, setFlag, distanceXY } from '../../../common/utils';
import { AgDragEvent } from '../directives/agDrag';

@Component({
	selector: 'pony-box',
	templateUrl: 'pony-box.pug',
	styleUrls: ['pony-box.scss'],
})
export class PonyBox implements AfterViewChecked {
	readonly leaderIcon = partyLeaderIcon;
	readonly inviteIcon = faUserPlus;
	readonly removeIcon = faUserTimes;
	readonly cogIcon = faUserCog;
	readonly selfMenuIcon = faUserCircle;
	readonly checkIcon = faCheck;
	readonly ignoreIcon = faMicrophoneSlash;
	readonly hideIcon = faEyeSlash;
	readonly starIcon = faStar;
	readonly addFriendIcon = faUserPlus;
	readonly removeFriendIcon = faUserMinus;
	readonly messageIcon = faComment;
	readonly afkIcon = faClock;
	readonly offlineIcon = faPlug;
	readonly modalIcon = faFolderOpen;
	readonly resetWidthIcon = faUndo;
	readonly friendTagIcon = faUserCheck;
	readonly partyTagIcon = faUserFriends;
	readonly swapIcon = faExchangeAlt;
	readonly transferIcon = faArrowLeft;
	readonly takeIcon = faArrowRight;
	readonly ponyIcon = faHorseHead;
	readonly noteIcon = faStickyNote;
	readonly pinIcon = faThumbtack;
	readonly moreButtonsIcon = faEllipsisV;
	readonly typingIcon = faComments;
	readonly editingIcon = faPencilAlt;
	readonly leaveIcon = faSignOutAlt;
	readonly removeNoteIcon = faUserMinus;
	isIgnored = isIgnored;
	isFriend = isFriend;
	isTyping = isTyping;
	isEditingCharacter = isEditingCharacter;
	removingFriend = false;
	showMoreFriendButtons = false;
	editingFriendNoteMode: 'edit' | 'remove' | null = null;
	friendNoteText = '';
	rectWidthPx?: number;
	private autoRectWidthPx = 250;
	private resizeStartWidth = 0;
	private _pony?: Pony;
	@ViewChild('tagsBox', { static: false }) tagsBox?: ElementRef<HTMLElement>;
	@ViewChild('rectBox', { static: false }) rectBox?: ElementRef<HTMLElement>;
	@Input() set pony(val: Pony | undefined) {
		if (val !== this._pony) {
			this.removingFriend = false;
			this.showMoreFriendButtons = false;
			this.editingFriendNoteMode = null;
			this.friendNoteText = '';
			this._pony = val;
		}
	}
	get pony() { return this._pony; }
	@Output() sendMessage = new EventEmitter<Entity>();
	@Output() openFriendsList = new EventEmitter<void>();
	@Output() portraitDrag = new EventEmitter<AgDragEvent>();
	@Input() dragEnabled = false;
	@Input() dragging = false;
	constructor(private model: Model, private game: PonyTownGame, private gameService: GameService) {
	}
	ngAfterViewChecked() {
		this.updateAutoRectWidth();
	}
	get ignoredOrHidden() {
		return this.pony && (isIgnored(this.pony) || isHidden(this.pony));
	}
	get selectedFriendEntry() {
		const pony = this.pony as any;
		const friends = this.model.friends;

		if (!pony || !friends) {
			return undefined;
		}

		return friends.find(friend =>
			(friend.entityId && friend.entityId === pony.id) ||
			(pony.accountId && friend.accountId === pony.accountId));
	}
	get isSelectedFriend() {
		const pony = this.pony;
		if (!pony) {
			return false;
		}

		if (isFriend(pony)) {
			return true;
		}

		return !!this.selectedFriendEntry;
	}
	get canToggleShowAsOfflineForSelectedFriend() {
		const friend = this.selectedFriendEntry;
		return !!(friend && (friend.online || friend.hidden));
	}
	get isInteractionUnavailable() {
		return this.isOffline || this.isShowAsOffline;
	}
	get isWithinInteractionRange() {
		const player = this.game.player as any;
		return !!(player && this.pony && distanceXY(player.x, player.y, this.pony.x, this.pony.y) < TILE_CHANGE_RANGE);
	}
	get isShownOfflineForSelectedFriend() {
		const friend = this.selectedFriendEntry;
		const hiddenFor = this.model.account && this.model.account.settings && this.model.account.settings.showAsOfflineFor;
		return !!(friend && Array.isArray(hiddenFor) && hiddenFor.includes(friend.accountId));
	}
	get selectedFriendNote() {
		const friend = this.selectedFriendEntry;
		if (!friend) {
			return undefined;
		}

		return this.getFriendNotes()[friend.accountId];
	}
	get isEditingFriendNote() {
		return this.editingFriendNoteMode === 'edit';
	}
	get isRemovingFriendNote() {
		return this.editingFriendNoteMode === 'remove';
	}
	get isSelectedFriendPinned() {
		const friend = this.selectedFriendEntry;
		if (!friend) {
			return false;
		}

		return this.getPinnedFriends().includes(friend.accountId);
	}
	get hasExpandedFriendButtons() {
		return this.showMoreFriendButtons;
	}
	get isMod() {
		return this.model.isMod;
	}
	get canUseWideRect() {
		return this.model.supporter >= 3;
	}
	get maxRectWidth() {
		return Math.max(220, Math.min(760, window.innerWidth - 70));
	}
	get minRectWidth() {
		return 110;
	}
	get currentRectWidth() {
		if (this.rectWidthPx === undefined) {
			return Math.max(this.minRectWidth, Math.min(this.maxRectWidth, this.autoRectWidthPx));
		}

		return Math.max(this.minRectWidth, Math.min(this.maxRectWidth, this.rectWidthPx));
	}
	get isRectResized() {
		return this.rectWidthPx !== undefined;
	}
	get isCompactRect() {
		return this.canUseWideRect && this.currentRectWidth <= 170;
	}
	get isOwnPlayer() {
		const player = this.game.player;
		return !!(player && this.pony && this.pony.id === player.id);
	}
	get isNpcCharacter() {
		return !!(this.pony && isNpcEntity(this.pony));
	}
	get showInteractionDropdown() {
		return !this.isOwnPlayer && !this.isNpcCharacter;
	}
	get canInviteToParty() {
		return !this.isOwnPlayer && this.pony && (!this.game.party || (isPartyLeader(this.game) && !isPonyInParty(this.game.party, this.pony, true)));
	}
	get canRemoveFromParty() {
		return !this.isOwnPlayer && this.pony && isPartyLeader(this.game) && isPonyInParty(this.game.party, this.pony, true);
	}
	get canPromoteToLeader() {
		return !this.isOwnPlayer && this.pony && isPartyLeader(this.game) && isPonyInParty(this.game.party, this.pony, false);
	}
	get isPartyInvitePending() {
		return this.pony
			&& isPonyInParty(this.game.party, this.pony, true)
			&& !isPonyInParty(this.game.party, this.pony, false);
	}
	get isPartyMember() {
		return this.pony && isPonyInParty(this.game.party, this.pony, false);
	}
	get specialTag() {
		const pony = this.pony;
		return getTag(pony && pony.tag, pony && (pony as any).tagColor);
	}
	get specialClass() {
		const tag = this.specialTag;
		return tag && tag.tagClass;
	}
	get specialTagTooltip() {
		return getTagTooltip(this.specialTag);
	}
	get paletteInfo() {
		return this.pony && getPaletteInfo(this.pony);
	}
	get isAfk() {
		return !this.isOffline && !!(this.pony && hasFlag(this.pony.playerState, EntityPlayerState.Afk));
	}
	get isOffline() {
		const pony = this.pony as any;
		return !!(pony && !this.isShowAsOffline && (pony.offline || (pony.options && pony.options.offline)));
	}
	get isShowAsOffline() {
		const pony = this.pony as any;
		return !!(pony && (pony.showAsOffline || (pony.options && pony.options.showAsOffline)));
	}
	get isEditingModal(): boolean {
		const pony = this.pony as any;
		return !!(pony && isEditingCharacter(pony));
	}
	get isInModal(): boolean {
		const pony = this.pony as any;

		if (!pony || this.isOffline) {
			return false;
		}

		// Если редактирование персонажа — отдельный статус
		if (isEditingCharacter(pony)) {
			return false;
		}

		if (pony.inModal || pony.modal || (pony.options && pony.options.modal)) {
			return true;
		}

		const player = this.game.player as any;
		if (player && pony.id === player.id) {
			return document.body.classList.contains('modal-open');
		}

		return false;
	}
	inviteToParty() {
		this.playerAction(PlayerAction.InviteToParty);
	}
	removeFromParty() {
		this.playerAction(PlayerAction.RemoveFromParty);
	}
	promoteToLeader() {
		this.playerAction(PlayerAction.PromotePartyLeader);
	}
	get sourceHoldType() {
		const player = this.game.player as any;
		return (player && (player.hold || (player.options && player.options.hold))) || 0;
	}
	get sourceToyType() {
		const player = this.game.player as any;
		return (player && (player.toy || (player.options && player.options.toy))) || 0;
	}
	get targetHoldType() {
		return (this.pony && (this.pony.hold || (this.pony.options && this.pony.options.hold))) || 0;
	}
	get targetToyType() {
		return (this.pony && (this.pony.toy || (this.pony.options && this.pony.options.toy))) || 0;
	}
	get canSendItem() {
		return this.isWithinInteractionRange && !!this.sourceHoldType && !this.targetHoldType;
	}
	get canTradeItem() {
		return this.isWithinInteractionRange && !!this.sourceHoldType && !!this.targetHoldType;
	}
	get canPickupItem() {
		return this.isWithinInteractionRange && !this.sourceHoldType && !!this.targetHoldType;
	}
	get canSendToy() {
		return this.isWithinInteractionRange && !!this.sourceToyType && !this.targetToyType;
	}
	get canTradeToy() {
		return this.isWithinInteractionRange && !!this.sourceToyType && !!this.targetToyType;
	}
	get canPickupToy() {
		return this.isWithinInteractionRange && !this.sourceToyType && !!this.targetToyType;
	}
	sendItem() {
		this.playerAction(PlayerAction.SendItem);
	}
	tradeItem() {
		this.playerAction(PlayerAction.TradeItem);
	}
	pickupItem() {
		this.playerAction(PlayerAction.PickUpItem);
	}
	sendToy() {
		this.playerAction(PlayerAction.SendToy);
	}
	tradeToy() {
		this.playerAction(PlayerAction.TradeToy);
	}
	pickupToy() {
		this.playerAction(PlayerAction.PickUpToy);
	}
	toggleIgnore() {
		if (this.pony) {
			const ignored = isIgnored(this.pony);
			this.playerAction(ignored ? PlayerAction.Unignore : PlayerAction.Ignore);
			this.pony.playerState = setFlag(this.pony.playerState, EntityPlayerState.Ignored, !ignored);
		}
	}
	hidePlayer(days: number) {
		this.playerAction(PlayerAction.HidePlayer, days * DAY);
	}
	toggleShowAsOfflineForSelectedFriend() {
		const friend = this.selectedFriendEntry;

		if (!friend || !this.canToggleShowAsOfflineForSelectedFriend || !this.model.account) {
			return;
		}

		const current = this.model.account.settings.showAsOfflineFor || [];
		const next = current.includes(friend.accountId) ?
			current.filter(id => id !== friend.accountId) :
			[...current, friend.accountId];
		const settings = { ...this.model.account.settings, showAsOfflineFor: next };
		this.model.account.settings = settings;
		(this.model.saveSettings(settings) as Promise<unknown>).then(() => undefined);
	}
	togglePinSelectedFriend() {
		const friend = this.selectedFriendEntry;

		if (!friend) {
			return;
		}

		const pinned = this.getPinnedFriends();
		const next = pinned.includes(friend.accountId) ?
			pinned.filter(id => id !== friend.accountId) :
			[...pinned, friend.accountId];

		localStorage.setItem('pinnedFriends', JSON.stringify(next));
	}
	toggleMoreFriendButtons() {
		this.showMoreFriendButtons = !this.showMoreFriendButtons;

		if (!this.showMoreFriendButtons) {
			this.editingFriendNoteMode = null;
			this.friendNoteText = '';
		}
	}
	startEditSelectedFriendNote() {
		this.editingFriendNoteMode = 'edit';
		this.friendNoteText = this.selectedFriendNote || '';
	}
	startRemoveSelectedFriendNote() {
		if (!this.selectedFriendNote) {
			return;
		}

		this.editingFriendNoteMode = 'remove';
	}
	cancelEditSelectedFriendNote() {
		this.editingFriendNoteMode = null;
		this.friendNoteText = '';
	}
	cancelRemoveSelectedFriendNote() {
		this.editingFriendNoteMode = null;
	}
	saveSelectedFriendNote() {
		const friend = this.selectedFriendEntry;

		if (!friend) {
			return;
		}

		const notes = this.getFriendNotes();
		if (this.friendNoteText.trim()) {
			notes[friend.accountId] = this.friendNoteText.trim().substring(0, 100);
		} else {
			delete notes[friend.accountId];
		}

		localStorage.setItem('friendNotes', JSON.stringify(notes));
		this.editingFriendNoteMode = null;
		this.friendNoteText = '';
	}
	confirmRemoveSelectedFriendNote() {
		const friend = this.selectedFriendEntry;

		if (!friend) {
			return;
		}

		const notes = this.getFriendNotes();
		delete notes[friend.accountId];
		localStorage.setItem('friendNotes', JSON.stringify(notes));
		this.editingFriendNoteMode = null;
		this.friendNoteText = '';
	}
	addFriend() {
		this.playerAction(PlayerAction.AddFriend);
	}
	removeFriend() {
		this.playerAction(PlayerAction.RemoveFriend);
	}
	private playerAction(type: PlayerAction, param: any = undefined) {
		const ponyId = this.pony && this.pony.id;

		if (ponyId) {
			this.game.send(server => server.playerAction(ponyId, type, param));
		}
	}
	sendMessageTo() {
		if (this.pony) {
			this.sendMessage.emit(this.pony);
		}
	}
	editOwnCharacter() {
		this.game.onOpenGameCharacter.next();
	}
	leaveGame() {
		this.gameService.leave('From own profile');
	}
	requestOpenFriendsList() {
		this.openFriendsList.emit();
	}
	onPortraitDrag(event: AgDragEvent) {
		if (this.dragEnabled) {
			this.portraitDrag.emit(event);
		}
	}
	resizeRect({ type, dx }: AgDragEvent) {
		if (!this.canUseWideRect) return;

		if (type === 'start') {
			const element = this.rectBox && this.rectBox.nativeElement;
			this.resizeStartWidth = element ? element.offsetWidth : (this.rectWidthPx || 320);
			if (this.rectWidthPx === undefined) {
				this.rectWidthPx = this.resizeStartWidth;
			}
			return;
		}

		const width = this.resizeStartWidth + dx;
		this.rectWidthPx = Math.max(this.minRectWidth, Math.min(this.maxRectWidth, width));
	}
	resetRectWidth() {
		if (!this.canUseWideRect) return;
		this.rectWidthPx = undefined;
	}
	private getPinnedFriends(): string[] {
		const pinned = localStorage.getItem('pinnedFriends');
		return pinned ? JSON.parse(pinned) : [];
	}
	private getFriendNotes(): Record<string, string> {
		const notes = localStorage.getItem('friendNotes');
		return notes ? JSON.parse(notes) : {};
	}
	private updateAutoRectWidth() {
		const tags = this.tagsBox && this.tagsBox.nativeElement;
		const autoWidth = this.measureAutoRectWidth();

		if (!tags) {
			if (this.autoRectWidthPx !== autoWidth) {
				this.autoRectWidthPx = autoWidth;
			}
			return;
		}

		if (this.rectWidthPx === undefined) {
			this.applyTagCollapseLevel(tags, 0);
			this.autoRectWidthPx = autoWidth;
			return;
		}

		const manualWidth = Math.max(this.minRectWidth, Math.min(this.maxRectWidth, this.rectWidthPx));
		const collapseLevel = this.findCollapseLevelForWidth(tags, manualWidth);
		this.applyTagCollapseLevel(tags, collapseLevel);
	}
	private getDesiredRectWidth(tags: HTMLElement, useDefaultMinimum = false) {
		const tagsWidth = Math.ceil(tags.scrollWidth);
		const minimum = useDefaultMinimum ? 250 : this.minRectWidth;
		return Math.max(minimum, tagsWidth + 14);
	}
	private measureAutoRectWidth() {
		const pony = this.pony as any;
		const ponyName = pony && pony.name ? String(pony.name) : '';
		const siteName = pony && pony.site && pony.site.name ? String(pony.site.name) : '';
		const nameWidth = ponyName.length * 8.6;
		const siteWidth = siteName.length ? (siteName.length * 8.1) + 28 : 0;
		const statusWidth = (this.isAfk ? 42 : 0) + (this.isOffline ? 18 : 0) + (this.isInModal ? 18 : 0);
		const contentWidth = Math.max(nameWidth + statusWidth, siteWidth);
		const desiredWidth = Math.max(250, Math.round(contentWidth + 96));
		const autoMaxWidth = Math.min(this.maxRectWidth, this.canUseWideRect ? 540 : 460);
		return Math.min(autoMaxWidth, desiredWidth);
	}
	private findCollapseLevelForWidth(tags: HTMLElement, targetWidth: number) {
		const labelsCount = tags.querySelectorAll('.pony-box-tag-label').length;
		const maxCollapse = Math.min(6, labelsCount);

		for (let level = 0; level <= maxCollapse; level++) {
			this.applyTagCollapseLevel(tags, level);
			if (this.getDesiredRectWidth(tags, false) <= targetWidth) {
				return level;
			}
		}

		return maxCollapse;
	}
	private applyTagCollapseLevel(tags: HTMLElement, level: number) {
		for (let i = 0; i <= 6; i++) {
			tags.classList.remove(`tag-label-collapse-${i}`);
		}

		tags.classList.add(`tag-label-collapse-${Math.max(0, Math.min(6, level))}`);
	}
	// supporter servers
	get canInviteToSupporterServers() {
		return false; // DEVELOPMENT; // TODO: check if ignored or hidden
	}
	get isInvitedToSupporterServers() {
		return false;
	}
	inviteToSupporterServers() {
		this.playerAction(PlayerAction.InviteToSupporterServers);
	}
}
