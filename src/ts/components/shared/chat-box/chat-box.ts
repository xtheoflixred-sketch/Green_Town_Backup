import { Component, ElementRef, NgZone, AfterViewInit, ViewChild, OnDestroy, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChatType, MessageType, isPartyChat, Entity, FakeEntity, isTypingIndicatorMessage } from '../../../common/interfaces';
import { SAY_MAX_LENGTH } from '../../../common/constants';
import { Key } from '../../../client/input/input';
import { PonyTownGame } from '../../../client/game';
import { cleanMessage, isSpamMessage } from '../../../client/clientUtils';
import { faComment, faAngleDoubleRight, faTimes } from '../../../client/icons';
import { isInParty } from '../../../client/partyUtils';
import { handleActionCommand } from '../../../client/playerActions';
import { hasHeadAnimation } from '../../../common/pony';
import { AutocompleteState, autocompleteMesssage, replaceEmojis, emojis, hasEmojis, splitEmojis, findEmoji, getEmojiImageAsync } from '../../../client/emoji';
import { replaceNodes } from '../../../client/htmlUtils';
import { invalidEnumReturn } from '../../../common/utils';
import { isAdmin, isMod } from '../../../common/accountUtils';
import { findMatchingEntityNames, findEntityOrMockByAnyMeans, findBestEntityByName } from '../../../client/handlers';
import { sample } from 'lodash';
import { CLIENT_COMMANDS, ClientCommand, TOBE_ENTITIES } from '../../../client/commands';
import { loadAndInitSpriteSheets } from '../../../client/spriteUtils';
import { font } from '../../../client/fonts';
import { getCharacterSprite } from '../../../graphics/spriteFont';
import { getTag } from '../../../common/tags';
import { isMobile } from '../../../client/data';
import { Model } from '../../services/model';
import { getToySprite, initializeToys } from '../../../client/ponyDraw';
import * as sprites from '../../../generated/sprites';
import { drawCanvas } from '../../../graphics/contextSpriteBatch';
import { mockPaletteManager } from '../../../common/ponyInfo';
import { WHITE } from '../../../common/colors';

interface ToyEntry {
	id: number;
	name: string;
	color: string;
	category: string;
}

const chatTypeNames: string[] = [];
const chatTypeClasses: string[] = [];

type ChatModeId = ChatType | 'mod' | 'admin' | 'owner' | 'dev' | 'builder' | 'npc';
type ChatTypeMenuCategory = 'developer' | 'supporter' | 'chats';
type ChatTypeMenuOption = {
	label: string;
	mode?: ChatModeId;
	badgeClass?: string;
	icon?: any;
	divider?: boolean;
	category?: ChatTypeMenuCategory;
	collapsed?: boolean;
	hidden?: boolean;
	selectableIndex?: number;
};

function setupChatType(type: ChatType, name: string) {
	chatTypeNames[type] = name;
	chatTypeClasses[type] = `chat-${name.replace(/ /, '-')}`;
}

chatTypeNames['owner' as any] = 'owner';
chatTypeClasses['owner' as any] = 'chat-owner';
chatTypeNames['dev' as any] = 'dev';
chatTypeClasses['dev' as any] = 'chat-dev';

setupChatType(ChatType.Say, 'say');
setupChatType(ChatType.Party, 'party');
setupChatType(ChatType.Supporter, 'sup');
setupChatType(ChatType.Supporter1, 'sup1');
setupChatType(ChatType.Supporter2, 'sup2');
setupChatType(ChatType.Supporter3, 'sup3');
setupChatType(ChatType.Whisper, 'whisper');
setupChatType(ChatType.Think, 'think');
setupChatType(ChatType.PartyThink, 'party think');

function isActionCommand(message: string) {
	return /^\/(yawn|sneeze|excite|tada|achoo|laugh|lol|haha|хаха|jaja)/i.test(message);
}

function canUseCommand(command: ClientCommand, account: { roles?: string[]; supporter?: number } | undefined) {
	const role = command.role;
	if (!role) return true;
	if (!account) return false;
	if (role === 'mod') return isMod(account);
	if (role === 'admin') return isAdmin(account);
	if (role === 'sup1' || role === 'sup2' || role === 'sup3' || role === 'sup4') {
		return isMod(account) || (account.supporter || 0) >= parseInt(role.substring(3), 10);
	}
	return !!account.roles && account.roles.indexOf(role) !== -1;
}

function getCommandCategory(command: ClientCommand): string {
	if (command.role === 'sup1' || command.role === 'sup2' || command.role === 'sup3' || command.role === 'sup4') return 'Supporters';
	if (command.role === 'mod') return 'Moderation';
	if (command.role === 'admin') return 'Administration';
	if (command.role === 'owner' || command.role === 'dev') return 'Developer';
	const name = command.name.toLowerCase();
	if (['w', 'whisper', 'r', 'reply', 's', 'say', 'p', 'party', 't', 'think', 'shrug', 'roll'].includes(name)) return 'Chat';
	if (['blush', 'love', 'sleep', 'cry', 'yawn', 'laugh', 'lol', 'haha', 'sneeze', 'achoo', 'excite', 'tada', 'magic', 'kiss', 'dance', 'dance1'].includes(name)) return 'Emotes';
	if (['accountdate', 'accountid', 'playtime', 'lastgame', 'lastsession', 'age', 'supporter', 'supinfo'].includes(name)) return 'Account';
	if (['savehouse', 'loadhouse', 'resethouse', 'clearhouse', 'lockhouse', 'unlockhouse', 'removetoolbox', 'restoretoolbox'].includes(name)) return 'House';
	if (['gifts', 'candies', 'eggs', 'clovers', 'toys', 'collections', 'achievements'].includes(name)) return 'Collections';
	if (['drop', 'droptoy', 'open', 'swap', 'bunnies', 'tobe'].includes(name)) return 'Gameplay';
	return 'Other';
}

const typingIndicatorShowDelay = 300;
const typingIndicatorHideDelay = 1000;
@Component({
	selector: 'chat-box',
	templateUrl: 'chat-box.pug',
	styleUrls: ['chat-box.scss'],
})
export class ChatBox implements AfterViewInit, OnDestroy {
	readonly maxSayLength = SAY_MAX_LENGTH;
	readonly commentIcon = faComment;
	readonly sendIcon = faAngleDoubleRight;
	readonly resetIcon = faTimes;
	readonly emotes = emojis;
	emojiBoxState = 'none';
	@ViewChild('inputElement', { static: true }) inputElement!: ElementRef;
	@ViewChild('typeBox', { static: true }) typeBox!: ElementRef;
	@ViewChild('typePrefix', { static: true }) typePrefix!: ElementRef;
	@ViewChild('typeName', { static: true }) typeName!: ElementRef;
	@ViewChild('chatBox', { static: true }) chatBox!: ElementRef;
	@ViewChild('chatBoxInput', { static: true }) chatBoxInput!: ElementRef;
	isOpen = false;
	message: string | undefined = '';
	chatType = ChatType.Say;
	btnEmoji = emojis[0].names[0];
	private pasted = false;
	private lastMessages: string[] = [];
	private state: AutocompleteState = {};
	private subscriptions: Subscription[];
	private _disabled = false;
	private chatModeOverride: 'mod' | 'admin' | 'owner' | 'dev' | 'builder' | 'npc' | undefined;
	private typingIndicatorActive = false;
	private typingIndicatorType = MessageType.Chat;
	private typingIndicatorEntityId = 0;
	private pendingTypingType = MessageType.Chat;
	private pendingTypingEntityId = 0;
	private typingShowTimeout: any;
	private typingHideTimeout: any;
	showCommandDropdown = false;
	commandQuery = '';
	selectedSubcommandIndex = 0;
	selectedCommandIndex = 0;
	tobeMode = false;
	tobeQuery = '';
	selectedTobeIndex = 0;
	showColorPicker = false;
	showChatTypeMenu = false;
	selectedChatTypeIndex = 0;
	chatTypeMenuStyle: any = {};
	msgColor = '#bbbbbb';
	colorPickerStyle: any = {};
	private lastColorSend = 0;
	private chatTypeMenuPressTimer: any;
	private documentClickHandler: (event: MouseEvent) => void = () => undefined;
	private documentKeydownHandler: (event: KeyboardEvent) => void = () => undefined;
	private chatTypePreviewMode: ChatModeId | undefined;
	private chatTypeMenuOptionsCache: ChatTypeMenuOption[] = [];
	private selectableChatTypeMenuOptionsCache: Array<ChatTypeMenuOption & { mode: ChatModeId }> = [];
	private chatTypeMenuCacheReady = false;
	chatTypeDeveloperCollapsed = false;
	chatTypeSupporterCollapsed = false;

	get chatTypeMenuOptions(): ChatTypeMenuOption[] {
		if (!this.chatTypeMenuCacheReady) {
			this.refreshChatTypeMenuOptions();
		}
		return this.chatTypeMenuOptionsCache;
	}

	get selectableChatTypeMenuOptions(): Array<ChatTypeMenuOption & { mode: ChatModeId }> {
		if (!this.chatTypeMenuCacheReady) {
			this.refreshChatTypeMenuOptions();
		}
		return this.selectableChatTypeMenuOptionsCache;
	}

	private refreshChatTypeMenuOptions() {
		const options = getChatTypeMenuOptions(this.game);
		let selectableIndex = 0;

		for (const option of options) {
			if (option.divider) {
				option.collapsed = option.category === 'developer'
					? this.chatTypeDeveloperCollapsed
					: option.category === 'supporter'
						? this.chatTypeSupporterCollapsed
						: false;
				option.hidden = false;
				continue;
			}

			const collapsed = option.category === 'developer'
				? this.chatTypeDeveloperCollapsed
				: option.category === 'supporter'
					? this.chatTypeSupporterCollapsed
					: false;

			option.hidden = collapsed;
			option.selectableIndex = collapsed ? -1 : selectableIndex++;
		}

		this.chatTypeMenuOptionsCache = options;
		this.selectableChatTypeMenuOptionsCache = options.filter(
			(option): option is ChatTypeMenuOption & { mode: ChatModeId } =>
				!option.divider && !option.hidden && option.mode !== undefined
		);
		this.chatTypeMenuCacheReady = true;
	}

	private invalidateChatTypeMenuOptions() {
		this.chatTypeMenuCacheReady = false;
	}

	toggleChatTypeCategory(category: ChatTypeMenuCategory) {
		this.clearChatTypePreview();
		if (category === 'developer') {
			this.chatTypeDeveloperCollapsed = !this.chatTypeDeveloperCollapsed;
		} else if (category === 'supporter') {
			this.chatTypeSupporterCollapsed = !this.chatTypeSupporterCollapsed;
		} else {
			return;
		}

		this.invalidateChatTypeMenuOptions();
		this.refreshChatTypeMenuOptions();

		const currentIndex = this.getSelectableChatTypeIndex(this.currentChatMode);
		if (currentIndex >= 0) {
			this.selectedChatTypeIndex = currentIndex;
		} else if (this.selectableChatTypeMenuOptions.length > 0) {
			this.selectedChatTypeIndex = 0;
		}
	}
	private initialized = false;
	private updatingMessage = false;
	showToyDropdown = false;
	seasonMode = false;
	seasonPhase: 'season' | 'holiday' = 'season';
	seasonQuery = '';
	selectedSeasonIndex = 0;
	private readonly _seasonValues = ['spring', 'summer', 'autumn', 'winter'];
	private readonly _holidayValues = ['none', 'christmas', 'halloween', 'stpatricks', 'easter'];
	get filteredSeasonItems(): string[] {
		const q = this.seasonQuery.toLowerCase();
		if (this.seasonPhase === 'holiday') {
			return this._holidayValues.filter(h => h.startsWith(q));
		}
		return this._seasonValues.filter(s => s.startsWith(q));
	}
	private readonly _allToys: ToyEntry[] = [
		{ id: 1, name: 'Red Hat', color: '#ff2525', category: 'hat' },
		{ id: 2, name: 'Green Hat', color: '#22ac22', category: 'hat' },
		{ id: 3, name: 'Blue Hat', color: '#2e58f4', category: 'hat' },
		{ id: 4, name: 'Pink Hat', color: '#ff71ff', category: 'hat' },
		{ id: 5, name: 'Snowpony', color: '#ffffff', category: 'snowpony' },
		{ id: 6, name: 'Snowpony (Clothes)', color: '#ff9100', category: 'snowpony' },
		{ id: 7, name: 'Evil Snowpony', color: '#404040', category: 'snowpony' },
		{ id: 8, name: 'Gift (Red)', color: '#cf1717', category: 'gift' },
		{ id: 9, name: 'Gift (Pink)', color: '#dfc588', category: 'gift' },
		{ id: 10, name: 'Gift (Green)', color: '#7fc484', category: 'gift' },
		{ id: 11, name: 'Gift (Rose)', color: '#d56a69', category: 'gift' },
		{ id: 12, name: 'Gift (Purple)', color: '#e586df', category: 'gift' },
		{ id: 13, name: 'Bell', color: '#ffd94f', category: 'hanging' },
		{ id: 14, name: 'Mistletoe', color: '#429a51', category: 'hanging' },
		{ id: 15, name: 'Cookie', color: '#e7b86f', category: 'hanging' },
		{ id: 16, name: 'Spider', color: '#000000', category: 'hanging' },
		{ id: 17, name: 'Teddy (Brown)', color: '#a86230', category: 'teddy' },
		{ id: 18, name: 'Teddy (Brown Angel)', color: '#dfbe8b', category: 'teddy' },
		{ id: 19, name: 'Teddy (Black)', color: '#474444', category: 'teddy' },
		{ id: 20, name: 'Teddy (Black Angel)', color: '#96623e', category: 'teddy' },
		{ id: 21, name: 'Teddy (Brown Clothes)', color: '#ff0000', category: 'teddy' },
		{ id: 22, name: 'Teddy (Black Clothes)', color: '#ff0000', category: 'teddy' },
		{ id: 23, name: 'Teddy (Santa)', color: '#dce5ed', category: 'teddy' },
		{ id: 24, name: 'Xmas Tree', color: '#1a9b2f', category: 'xmas' },
		{ id: 25, name: 'Xmas Tree (Alt)', color: '#f1d224', category: 'xmas' },
		{ id: 26, name: 'Reindeer', color: '#7b4b24', category: 'reindeer' },
		{ id: 27, name: 'Reindeer (Clothes)', color: '#cf0e0e', category: 'reindeer' },
		{ id: 28, name: 'Candy Horn (One)', color: '#ff1b1b', category: 'candy' },
		{ id: 29, name: 'Candy Horn (Two)', color: '#ff1b1b', category: 'candy' },
		{ id: 30, name: 'Candy Horn (Alt)', color: '#58df6a', category: 'candy' },
		{ id: 31, name: 'Star', color: '#ffd94f', category: 'star' },
		{ id: 32, name: 'Halo', color: '#ffd94f', category: 'halo' },
	];
	get filteredToys(): ToyEntry[] {
		return this._allToys;
	}
	isToyCollected(toyId: number): boolean {
		const bitmask = this.getToyBitmask();
		return !!(bitmask & (1 << (toyId - 1)));
	}
	private getToyBitmask(): number {
		const acct: any = this.model && this.model.account;
		const state = acct && acct.state;
		const toysValue = state && state.toys;
		if (toysValue !== undefined) {
			return typeof toysValue === 'number' ? toysValue : parseInt(toysValue, 10) || 0;
		}
		return 0;
	}
	selectToyById(toyId: number) {
		this.message = `/toy ${toyId}`;
		this.showToyDropdown = false;
		this.showCommandDropdown = false;
		this.syncEditorFromMessage();
		this.focusInput();
	}
	private toySpriteUrls = new Map<number, string>();
	getToySpriteUrl(toyId: number): string | undefined {
		return this.toySpriteUrls.get(toyId);
	}
	private initToyPreviewActions() {
		if (this.toySpriteUrls.size > 0) return;
		const size = 30;
		const pad = 2;
		const fit = size - pad * 2;

		const sheetDataOk = !!sprites.paletteSpriteSheet.data;
		if (!sheetDataOk) {
			console.warn('[toy preview] paletteSpriteSheet.data is not loaded');
		}

		for (const toy of this._allToys) {
			const toySet = getToySprite(toy.id);
			if (!toySet) continue;
			const patterns = (sprites.extraAccessoriesBehind as any)[toySet.type]
				|| (sprites.extraAccessories as any)[toySet.type];
			
			// Fallback for palette-only toys (no sprite geometry)
			if (!patterns || !patterns[toySet.pattern] || !patterns[toySet.pattern].color) {
				if (toySet.palette && toySet.palette.colors && toySet.palette.colors.length > 1) {
					const rgbaArray = new Uint32Array(toySet.palette.colors);
					const color = rgbaArray[1] || 0xFFFFFFFF;
					const colorHex = '#' + ((color >>> 8) & 0xFFFFFF).toString(16).padStart(6, '0');
					
					const final = drawCanvas(size, size, sprites.paletteSpriteSheet, undefined, batch => {
						const ctx = batch.canvas.getContext('2d')!;
						ctx.globalAlpha = 0.7;
						ctx.fillStyle = colorHex;
						const rectSize = Math.min(size - 4, 24);
						const x = Math.round((size - rectSize) / 2);
						const y = Math.round((size - rectSize) / 2);
						ctx.fillRect(x, y, rectSize, rectSize);
						ctx.globalAlpha = 1.0;
					});
					this.toySpriteUrls.set(toy.id, final.toDataURL());
				}
				continue;
			}

			const patternSprite = patterns[toySet.pattern];
			const sprite = patternSprite.color;
			const palette = mockPaletteManager.addArray(toySet.palette!.colors!);

			if (sprite.w === 0 || sprite.h === 0) {
				console.warn(`[toy preview] toy ${toy.id} has zero-size sprite`);
				continue;
			}

			const tmp = drawCanvas(sprite.w, sprite.h, sprites.paletteSpriteSheet, undefined, batch => {
				batch.drawSprite(sprite, WHITE, palette, 0, 0);
			});
			const ctx = tmp.getContext('2d')!;
			const imgData = ctx.getImageData(0, 0, sprite.w, sprite.h);
			const d = imgData.data;
			let x0 = sprite.w, y0 = sprite.h, x1 = 0, y1 = 0;
			for (let r = 0; r < sprite.h; r++) {
				for (let c = 0; c < sprite.w; c++) {
					const a = d[(r * sprite.w + c) * 4 + 3];
					if (a > 0) {
						if (c < x0) x0 = c;
						if (r < y0) y0 = r;
						if (c > x1) x1 = c;
						if (r > y1) y1 = r;
					}
				}
			}
			if (x1 < x0 || y1 < y0) {
				console.warn(`[toy preview] toy ${toy.id} (${toy.name}): no visible pixels, sprite: w=${sprite.w} h=${sprite.h} ox=${sprite.ox} oy=${sprite.oy} type=${sprite.type}, palette colors: ${palette.colors.length}`);
				if (toySet.palette && toySet.palette.colors && toySet.palette.colors.length > 1) {
					const rgbaArray = new Uint32Array(toySet.palette.colors);
					const color = rgbaArray[1] || 0xFFFFFFFF;
					const colorHex = '#' + ((color >>> 8) & 0xFFFFFF).toString(16).padStart(6, '0');

					const final = drawCanvas(size, size, sprites.paletteSpriteSheet, undefined, batch => {
						const ctx = batch.canvas.getContext('2d')!;
						ctx.globalAlpha = 0.7;
						ctx.fillStyle = colorHex;
						const rectSize = Math.min(size - 4, 24);
						const x = Math.round((size - rectSize) / 2);
						const y = Math.round((size - rectSize) / 2);
						ctx.fillRect(x, y, rectSize, rectSize);
						ctx.globalAlpha = 1.0;
					});
					this.toySpriteUrls.set(toy.id, final.toDataURL());
				}
				continue;
			}

			const cw = x1 - x0 + 1;
			const ch = y1 - y0 + 1;
			const sc = Math.min(1, fit / Math.max(cw, ch));
			const sw = Math.round(cw * sc);
			const sh = Math.round(ch * sc);
			const ox = Math.round((size - sw) / 2) - x0;
			const oy = Math.round((size - sh) / 2) - y0;

			const final = drawCanvas(size, size, sprites.paletteSpriteSheet, undefined, batch => {
				batch.drawSprite(sprite, WHITE, palette, ox, oy);
			});
			this.toySpriteUrls.set(toy.id, final.toDataURL());
		}
	}
	get filteredCommands(): ClientCommand[] {
		if (this.isSubcommandMode) return [];
		const query = this.commandQuery.toLowerCase();
		return CLIENT_COMMANDS.filter((c: ClientCommand) =>
			canUseCommand(c, this.game.model.account) && c.name.toLowerCase().startsWith(query));
	}
	get filteredCommandGroups(): Array<{ category: string; commands: ClientCommand[] }> {
		const groups: Array<{ category: string; commands: ClientCommand[] }> = [];
		for (const command of this.filteredCommands) {
			const category = getCommandCategory(command);
			let group = groups.find(item => item.category === category);
			if (!group) {
				group = { category, commands: [] };
				groups.push(group);
			}
			group.commands.push(command);
		}
		return groups;
	}
	isSelectedCommand(command: ClientCommand) {
		return this.filteredCommands[this.selectedCommandIndex] === command;
	}
	get isSubcommandMode() {
		return /\s/.test(this.commandQuery);
	}
	get activeCommand(): ClientCommand | undefined {
		const name = this.commandQuery.trim().split(/\s+/)[0].toLowerCase();
		return CLIENT_COMMANDS.find(command => command.name.toLowerCase() === name && canUseCommand(command, this.game.model.account));
	}
	get filteredSubcommands(): string[] {
		const command = this.activeCommand;
		if (!command || !command.subcommands) return [];
		const query = this.commandQuery.trim().split(/\s+/).slice(1).join(' ').toLowerCase();
		return command.subcommands.filter(subcommand => subcommand.toLowerCase().startsWith(query));
	}
	get filteredTobeEntities(): string[] {
		const query = this.tobeQuery.toLowerCase();
		return TOBE_ENTITIES.filter((e: string) => e.toLowerCase().startsWith(query));
	}
	selectCommand(cmd: ClientCommand) {
		this.showCommandDropdown = false;
		this.commandQuery = '';
		this.selectedCommandIndex = 0;
		this.selectedSubcommandIndex = 0;
		if (cmd.name === 'tobe') {
			this.message = '/tobe ';
			this.tobeMode = true;
		} else if (cmd.name === 'season') {
			this.message = '/season ';
			this.seasonMode = true;
			this.seasonPhase = 'season';
		} else {
			this.message = `/${cmd.name} `;
			this.tobeMode = false;
		}
		this.syncEditorFromMessage();
		this.focusInput();
	}
	selectSubcommand(subcommand: string) {
		const command = this.activeCommand;
		if (!command) return;
		this.showCommandDropdown = false;
		this.commandQuery = '';
		this.selectedSubcommandIndex = 0;
		this.message = `/${command.name} ${subcommand} `;
		this.syncEditorFromMessage();
		this.focusInput();
	}
	selectTobeEntity(entity: string) {
		this.showCommandDropdown = false;
		this.tobeMode = false;
		this.tobeQuery = '';
		this.selectedTobeIndex = 0;
		this.message = `/tobe ${entity} `;
		this.syncEditorFromMessage();
		this.focusInput();
	}
	selectSeasonItem(value: string) {
		if (this.seasonPhase === 'season') {
			this.message = `/season ${value} `;
			this.seasonPhase = 'holiday';
			this.seasonQuery = '';
			this.selectedSeasonIndex = 0;
			this.syncEditorFromMessage();
			this.focusInput();
		} else {
			const seasonMatch = this.message && this.message.match(/\/season\s+(\w+)/);
			const season = seasonMatch ? seasonMatch[1] : 'spring';
			this.message = `/season ${season} ${value}`;
			this.seasonMode = false;
			this.seasonPhase = 'season';
			this.seasonQuery = '';
			this.selectedSeasonIndex = 0;
			this.showCommandDropdown = false;
			this.syncEditorFromMessage();
			this.focusInput();
		}
	}
	private selectHighlightedCommand() {
		if (this.showCommandDropdown) {
			if (this.seasonMode) {
				const matches = this.filteredSeasonItems;
				if (matches.length > 0) {
					this.selectSeasonItem(matches[this.selectedSeasonIndex] || matches[0]);
				}
			} else if (this.tobeMode) {
				const matches = this.filteredTobeEntities;
				if (matches.length > 0) {
					this.selectTobeEntity(matches[this.selectedTobeIndex] || matches[0]);
				}
			} else {
				const matches = this.isSubcommandMode ? this.filteredSubcommands : this.filteredCommands;
				if (matches.length > 0) {
					if (this.isSubcommandMode) {
						this.selectSubcommand(matches[this.selectedSubcommandIndex] || matches[0]);
					} else {
						this.selectCommand(matches[this.selectedCommandIndex] || matches[0]);
					}
				}
			}
		}
	}
	onColorChange(color: string) {
		this.msgColor = color;
		this.updateChatType();
		const now = Date.now();
		if (now - this.lastColorSend > 200) {
			this.lastColorSend = now;
			this.game.send(server => server.say(0, `/msgcolor ${color}`, ChatType.Say));
		}
	}
	resetColor() {
		this.msgColor = '#bbbbbb';
		this.updateChatType();
		this.game.send(server => server.say(0, `/msgcolor reset`, ChatType.Say));
		this.showColorPicker = false;
		this.close();
	}
	onResetSayColorFromMenu(event: Event) {
		event.preventDefault();
		event.stopPropagation();
		this.msgColor = '#bbbbbb';
		this.updateChatType();
		this.game.send(server => server.say(0, `/msgcolor reset`, ChatType.Say));
	}
	private updateColorPickerPosition() {
		this.colorPickerStyle = {
			left: '60px',
			bottom: '230px',
		};
	}
	private updateChatTypeMenuPosition() {
		const typeBox = this.typeBox && this.typeBox.nativeElement as HTMLElement | undefined;
		if (!typeBox) {
			this.chatTypeMenuStyle = { left: '0px', top: '0px' };
			return;
		}
		const rect = typeBox.getBoundingClientRect();
		this.chatTypeMenuStyle = {
			left: `${Math.max(12, rect.left - 10)}px`,
			top: `${Math.max(10, rect.top - 12)}px`,
			transform: 'translateY(-100%)',
		};
	}
	private normalizeMessageColor(color: string | undefined): string {
		if (!color) {
			return '#bbbbbb';
		}
		const hex = String(color).replace(/^#/, '');
		return /^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? `#${hex}` : '#bbbbbb';
	}
	private syncMessageColorFromPlayer() {
		if (this.game.player && (this.game.player as any).messageColor !== undefined) {
			this.msgColor = this.normalizeMessageColor((this.game.player as any).messageColor);
		} else {
			this.msgColor = '#bbbbbb';
		}
	}
	private scrollActiveCommandIntoView() {
		const activeItem = document.querySelector('.command-dropdown-item.active') as HTMLElement | null;
		if (activeItem) {
			activeItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		}
	}
	constructor(private game: PonyTownGame, private model: Model, zone: NgZone) {
		this.subscriptions = [
			this.game.onChat.subscribe(() => zone.run(() => this.chat(undefined))),
			this.game.onToggleChat.subscribe(() => zone.run(() => this.toggle())),
			this.game.onCommand.subscribe(() => zone.run(() => this.command())),
			this.game.onLeft.subscribe(() => {
				this.chatType = ChatType.Say;
				this.chatModeOverride = undefined;
				this.close();
			}),
		];

		this.game.onCancel = () => this.isOpen ? (zone.run(() => this.close()), true) : false;
	}
	@Input() get disabled() {
		return this._disabled;
	}
	set disabled(value) {
		this._disabled = value;

		if (value) {
			this.close();
		}
	}
	get input() {
		return this.inputElement.nativeElement as HTMLElement;
	}

	focusInput() {
		const el = this.input;
		if (el) {
			el.focus();
			const range = document.createRange();
			const sel = window.getSelection();
			range.selectNodeContents(el);
			range.collapse(false);
			if (sel) {
				sel.removeAllRanges();
				sel.addRange(range);
			}
		}
	}

	get currentChatMode(): ChatModeId {
		return this.chatModeOverride || this.chatType;
	}
	get remainingCharacters() {
		return Math.max(0, this.maxSayLength - (this.message || '').length);
	}
	get showRemainingCharacters() {
		return (this.message || '').length >= Math.ceil(this.maxSayLength * 0.8);
	}
	get remainingCharactersDanger() {
		return (this.message || '').length >= Math.ceil(this.maxSayLength * 0.9);
	}
	private setCurrentChatMode(mode: ChatModeId) {
		if (mode === 'mod' || mode === 'admin' || mode === 'owner' || mode === 'dev' || mode === 'builder' || mode === 'npc') {
			this.chatModeOverride = mode;
			this.chatType = ChatType.Say;
		} else {
			this.chatModeOverride = undefined;
			this.chatType = mode as ChatType;
		}

		this.updateChatType();
	}
	ngAfterViewInit() {
		this.chatBox.nativeElement.hidden = true;
		this.input.addEventListener('paste', () => this.pasted = true);
		this.documentClickHandler = (event: MouseEvent) => {
			if (!this.showChatTypeMenu) {
				return;
			}
			const target = event.target as Node | null;
			if (!target) {
				return;
			}
			const menu = document.querySelector('.chat-type-menu') as HTMLElement | null;
			const trigger = this.typeBox && this.typeBox.nativeElement as HTMLElement | null;
			const clickedInsideMenu = !!(menu && menu.contains(target));
			const clickedTrigger = !!(trigger && trigger.contains(target));
			if (!clickedInsideMenu && !clickedTrigger) {
				this.closeChatTypeMenu();
			}
		};
		document.addEventListener('mousedown', this.documentClickHandler);

		this.documentKeydownHandler = (event: KeyboardEvent) => {
			if (event.keyCode === Key.ESCAPE && this.showChatTypeMenu) {
				this.closeChatTypeMenu();
				event.preventDefault();
				event.stopPropagation();
			}
		};
		document.addEventListener('keydown', this.documentKeydownHandler);
		loadAndInitSpriteSheets().then(() => {
			this.initialized = true;
			initializeToys(this.game.paletteManager);
			this.initToyPreviewActions();
			this.syncEditorFromMessage();
		});
	}
	ngOnDestroy() {
		this.clearTypingTimers();
		if (this.documentClickHandler) {
			document.removeEventListener('mousedown', this.documentClickHandler);
		}
		if (this.documentKeydownHandler) {
			document.removeEventListener('keydown', this.documentKeydownHandler);
		}
		if (this.isOpen) {
			this.game.setKeyboardDisabled(false);
		}
		this.subscriptions.forEach(s => s.unsubscribe());
	}
	onEditorBlur(_event: FocusEvent) {
		if (this.isOpen) {
			setTimeout(() => this.focusInput(), 0);
		}
	}
	addEmoji(emoji: string) {
		this.toggleEmojiBox();
		if (!this.message) {
			this.message = emoji;
		} else if (this.maxSayLength > this.message.length) {
			this.message += emoji;
		}
		this.syncEditorFromMessage();
		this.updateTypingIndicator();
	}

	private syncEditorFromMessage() {
		const el = this.inputElement && this.inputElement.nativeElement as HTMLElement;
		if (!el || this.updatingMessage || !this.initialized) return;
		const msg = this.message || '';
		if (hasEmojis(msg)) {
			el.innerHTML = '';
			const parts = splitEmojis(msg);
			for (const part of parts) {
				const emoji = hasEmojis(part) && findEmoji(part);
				const sprite = emoji && font && getCharacterSprite(part, font);
				if (sprite && emoji) {
					const img = document.createElement('img');
					img.className = 'pixelart';
					img.style.display = 'inline-block';
					img.style.verticalAlign = 'middle';
					img.style.width = `${(sprite.w + sprite.ox) * 1.6}px`;
					img.style.height = `${10 * 1.6}px`;
					img.style.marginTop = '-3px';
					img.alt = part;
					getEmojiImageAsync(sprite, src => {
						img.src = src;
					});
					el.appendChild(img);
				} else {
					el.appendChild(document.createTextNode(part));
				}
			}
		} else {
			el.textContent = msg;
		}
		if (!msg) {
			el.classList.add('empty');
		} else {
			el.classList.remove('empty');
		}
	}

	private extractMessageFromEditor(): string {
		const el = this.inputElement && this.inputElement.nativeElement as HTMLElement;
		if (!el) return '';
		let result = '';
		for (const node of Array.from(el.childNodes)) {
			if (node.nodeType === Node.TEXT_NODE) {
				result += node.textContent || '';
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				const elem = node as HTMLElement;
				if (elem.tagName === 'IMG' && (elem as HTMLImageElement).alt) {
					result += (elem as HTMLImageElement).alt;
				} else if (elem.tagName !== 'BR') {
					result += elem.textContent || '';
				}
			}
		}
		return result.replace(/[\u200B\u00A0]/g, ' ').replace(/\s+/g, ' ');
	}
	toggleEmojiBox() {
		if (this.emojiBoxState === 'none') {
			this.emojiBoxState = 'inline-block';
		} else {
			this.emojiBoxState = 'none';
		}
	}
	onMessageChange() {
		this.updatingMessage = true;
		let extracted = this.extractMessageFromEditor();
		if (extracted.length > this.maxSayLength) {
			extracted = extracted.substring(0, this.maxSayLength);
			this.message = extracted;
			this.syncEditorFromMessage();
		} else {
			this.message = extracted;
		}
		this.updatingMessage = false;
		this.updateTypingIndicator();

		const msg = this.message || '';

		if (msg === '/msgcolor ' || msg === '/msgcolor') {
			this.showColorPicker = true;
			this.showCommandDropdown = false;
			this.updateColorPickerPosition();
			const playerColor = this.game.player && (this.game.player as any).messageColor;
			this.msgColor = this.normalizeMessageColor(playerColor || this.msgColor);
			return;
		} else {
			this.showColorPicker = false;
		}

		const msgcolorMatch = /^\/msgcolor\s+(#[0-9a-f]{6}|[0-9a-f]{6}|reset)\s*$/i.exec(msg);
		if (msgcolorMatch) {
			const value = msgcolorMatch[1].toLowerCase();
			this.msgColor = value === 'reset' ? '#bbbbbb' : this.normalizeMessageColor(value);
		}

		if (this.tobeMode && msg.startsWith('/tobe ')) {
			this.tobeQuery = msg.substring(6);
			this.selectedTobeIndex = 0;
			this.showCommandDropdown = true;
			this.showToyDropdown = false;
		} else if (msg.startsWith('/tobe ')) {
			this.tobeMode = true;
			this.tobeQuery = msg.substring(6);
			this.selectedTobeIndex = 0;
			this.showCommandDropdown = true;
			this.showToyDropdown = false;
		} else if (msg === '/toy' || msg === '/toy ') {
			this.tobeMode = false;
			this.seasonMode = false;
			this.commandQuery = '';
			this.showCommandDropdown = false;
			this.showToyDropdown = true;
		} else if (msg.startsWith('/toy ')) {
			this.tobeMode = false;
			this.seasonMode = false;
			this.commandQuery = '';
			this.showCommandDropdown = false;
			this.showToyDropdown = true;
		} else if (this.seasonMode && msg.startsWith('/season ')) {
			const afterSeason = msg.substring(8);
			const spaceIdx = afterSeason.indexOf(' ');
			if (spaceIdx !== -1) {
				this.seasonPhase = 'holiday';
				this.seasonQuery = afterSeason.substring(spaceIdx + 1);
			} else {
				this.seasonPhase = 'season';
				this.seasonQuery = afterSeason;
			}
			this.selectedSeasonIndex = 0;
			this.showCommandDropdown = true;
		} else if (msg === '/season' || msg === '/season ') {
			this.tobeMode = false;
			this.seasonMode = true;
			this.seasonPhase = 'season';
			this.seasonQuery = '';
			this.selectedSeasonIndex = 0;
			this.showCommandDropdown = true;
			this.showToyDropdown = false;
		} else if (msg.startsWith('/season ')) {
			this.tobeMode = false;
			this.seasonMode = true;
			this.seasonPhase = 'season';
			const afterSeason = msg.substring(8);
			const spaceIdx = afterSeason.indexOf(' ');
			if (spaceIdx !== -1) {
				this.seasonPhase = 'holiday';
				this.seasonQuery = afterSeason.substring(spaceIdx + 1);
			} else {
				this.seasonQuery = afterSeason;
			}
			this.selectedSeasonIndex = 0;
			this.showCommandDropdown = true;
			this.showToyDropdown = false;
		} else if (msg.startsWith('/')) {
			this.tobeMode = false;
			this.seasonMode = false;
			this.commandQuery = msg.substring(1);
			this.selectedCommandIndex = 0;
			this.selectedSubcommandIndex = 0;
			this.showCommandDropdown = true;
			this.showToyDropdown = false;
		} else {
			this.tobeMode = false;
			this.seasonMode = false;
			this.seasonPhase = 'season';
			this.commandQuery = '';
			this.tobeQuery = '';
			this.seasonQuery = '';
			this.selectedCommandIndex = 0;
			this.selectedTobeIndex = 0;
			this.selectedSeasonIndex = 0;
			this.showCommandDropdown = false;
			this.showToyDropdown = false;
		}
	}

	onEditorInput(_event: Event) {
		if (this.showChatTypeMenu) {
			this.showChatTypeMenu = false;
			this.selectedChatTypeIndex = 0;
		}
		this.onMessageChange();
	}

	onEditorKeydown(e: KeyboardEvent) {
		this.keydown(e);
	}

	onEditorPaste(_event: ClipboardEvent) {
		this.pasted = true;
	}
	send(_event: Event | undefined) {
		const { chatType, message, entityId } = this.getMessageState();
		const handled = handleActionCommand(message, this.game);
		const spam = this.pasted && chatType !== ChatType.Party && isSpamMessage(message, this.lastMessages);
		const empty = !this.game.player || !message;
		const ignoreAction = isActionCommand(message) && this.game.player && hasHeadAnimation(this.game.player);

		if (empty && !handled) {
			this.close();
			return;
		}

		const sent = !handled && !spam && !empty && !ignoreAction ? (this.stopTypingIndicator(true), this.say(message, chatType, entityId)) : false;

		if (sent || handled) {
			if (sent) {
				this.lastMessages.push(message);

				if (this.lastMessages.length > 10) {
					this.lastMessages.shift();
				}
			}

			this.close();
		}
	}
	keydown(e: KeyboardEvent) {
		if (e.keyCode !== Key.TAB && e.keyCode !== Key.SHIFT) {
			this.state.lastEmoji = undefined;
		}

		if (this.showChatTypeMenu && (e.keyCode === Key.UP || e.keyCode === Key.DOWN || e.keyCode === Key.TAB)) {
			const options = this.selectableChatTypeMenuOptions;
			const count = options.length;
			if (count > 0) {
				if (e.keyCode === Key.TAB) {
					const option = options[this.selectedChatTypeIndex] || options[0];
					if (option) {
						this.selectChatType(option.mode);
					}
				} else {
					this.selectedChatTypeIndex = (this.selectedChatTypeIndex + (e.keyCode === Key.UP ? -1 : 1) + count) % count;
					const option = options[this.selectedChatTypeIndex];
					if (option) {
						this.previewChatType(option.mode);
					}
					this.scrollSelectedChatTypeIntoView();
				}
			}
			e.preventDefault();
			return;
		}

		if (this.showCommandDropdown && (e.keyCode === Key.UP || e.keyCode === Key.DOWN)) {
			if (this.seasonMode) {
				const count = this.filteredSeasonItems.length;
				if (count > 0) {
					this.selectedSeasonIndex = (this.selectedSeasonIndex + (e.keyCode === Key.UP ? -1 : 1) + count) % count;
					this.scrollActiveCommandIntoView();
				}
			} else if (this.tobeMode) {
				const count = this.filteredTobeEntities.length;
				if (count > 0) {
					this.selectedTobeIndex = (this.selectedTobeIndex + (e.keyCode === Key.UP ? -1 : 1) + count) % count;
					this.scrollActiveCommandIntoView();
				}
			} else {
				const count = this.isSubcommandMode ? this.filteredSubcommands.length : this.filteredCommands.length;
				if (count > 0) {
					if (this.isSubcommandMode) {
						this.selectedSubcommandIndex = (this.selectedSubcommandIndex + (e.keyCode === Key.UP ? -1 : 1) + count) % count;
					} else {
						this.selectedCommandIndex = (this.selectedCommandIndex + (e.keyCode === Key.UP ? -1 : 1) + count) % count;
					}
					this.scrollActiveCommandIntoView();
				}
			}
			e.preventDefault();
			return;
		}

		if (e.keyCode === Key.TAB) {
			if (this.showChatTypeMenu) {
				const options = this.selectableChatTypeMenuOptions;
				const option = options[this.selectedChatTypeIndex] || options[0];
				if (option) {
					this.selectChatType(option.mode);
				}
				e.preventDefault();
				return;
			}
			if (this.showCommandDropdown) {
				this.selectHighlightedCommand();
				e.preventDefault();
				return;
			}
			if (this.message) {
				if (/^\/(w|whisper) .+$/i.test(this.message)) {
					const space = this.message.indexOf(' ');
					const names = findMatchingEntityNames(this.game, this.message.substr(space + 1));

					if (names.length === 1) {
						this.message = `${this.message.substring(0, space)} ${names[0]}`;
						this.syncEditorFromMessage();
					}
				} else {
					this.message = autocompleteMesssage(this.message, e.shiftKey, this.state);
					this.syncEditorFromMessage();
				}
			}

			e.preventDefault();
		} else if (e.keyCode === Key.ENTER && this.isOpen) {
			if (this.showChatTypeMenu) {
				const options = this.selectableChatTypeMenuOptions;
				if (options.length > 0) {
					const option = options[this.selectedChatTypeIndex];
					if (option) {
						this.selectChatType(option.mode);
					}
				}
				e.preventDefault();
			} else if (this.showColorPicker) {
				this.showColorPicker = false;
				this.message = '';
				this.syncEditorFromMessage();
				this.close();
				e.preventDefault();
			} else {
				this.send(e);
			}
		} else if (e.keyCode === Key.ESCAPE) {
			if (this.showChatTypeMenu) {
				this.showChatTypeMenu = false;
				this.selectedChatTypeIndex = 0;
			} else if (this.showCommandDropdown) {
				this.showCommandDropdown = false;
				this.commandQuery = '';
			} else {
				this.close();
			}
			e.preventDefault();
		} else if (e.keyCode === Key.SPACE) {
			const modeSwitch = this.getModeSwitchFromCommand();

			if (modeSwitch) {
				if (modeSwitch.whisperTo) {
					this.game.whisperTo = modeSwitch.whisperTo;
				}

				this.changeChatType(e, modeSwitch.mode);
			}
		}

		if (this.message && this.message.length >= this.maxSayLength &&
			![Key.BACKSPACE, Key.DELETE, Key.LEFT, Key.RIGHT, Key.HOME, Key.END].includes(e.keyCode) &&
			!e.ctrlKey && !e.metaKey) {
			e.preventDefault();
		}
	}
	private getModeSwitchFromCommand(): { mode: ChatModeId; whisperTo?: Entity | FakeEntity; } | undefined {
		const message = this.message || '';
		const supporter = this.game.model.supporter || 0;
		const account = this.game.model.account;

		if (/^\/(s|say)\s$/i.test(message)) {
			return { mode: ChatType.Say };
		} else if (/^\/(o|owner)\s$/i.test(message)) {
			return { mode: 'owner' };
		} else if (/^\/(d|dev)\s$/i.test(message)) {
			return { mode: 'dev' };
		} else if (/^\/(p|party)\s$/i.test(message)) {
			return { mode: isInParty(this.game) ? ChatType.Party : ChatType.Say };
		} else if (/^\/(t|think)\s$/i.test(message)) {
			return { mode: isPartyChat(this.chatType) ? ChatType.PartyThink : ChatType.Think };
		} else if (/^\/ss\s$/i.test(message)) {
			return { mode: supporter > 0 ? ChatType.Supporter : ChatType.Say };
		} else if (/^\/s1\s$/i.test(message)) {
			return { mode: supporter >= 1 ? ChatType.Supporter1 : ChatType.Say };
		} else if (/^\/s2\s$/i.test(message)) {
			return { mode: supporter >= 2 ? ChatType.Supporter2 : ChatType.Say };
		} else if (/^\/s3\s$/i.test(message)) {
			return { mode: supporter >= 3 ? ChatType.Supporter3 : ChatType.Say };
		} else if (/^\/m\s$/i.test(message) && account && isMod(account)) {
			return { mode: 'mod' };
		} else if (/^\/a\s$/i.test(message) && account && isAdmin(account)) {
			return { mode: 'admin' };
		} else if (/^\/build\s$/i.test(message) && account && account.roles && account.roles.indexOf('builder') !== -1) {
			return { mode: 'builder' };
		} else if (/^\/npc\s$/i.test(message) && account && account.roles && account.roles.indexOf('npc') !== -1) {
			return { mode: 'npc' };
		} else if (/^\/(r|reply)\s$/i.test(message)) {
			const lastWhisperFrom = this.game.lastWhisperFrom;
			const entity = lastWhisperFrom && findEntityOrMockByAnyMeans(this.game, lastWhisperFrom.entityId);
			return entity ? { mode: ChatType.Whisper, whisperTo: entity } : { mode: ChatType.Say };
		} else if (/^\/(w|whisper) .+\s$/i.test(message)) {
			const name = message.substr(/^\/w /i.test(message) ? 3 : 9).trim();
			const entity = findBestEntityByName(this.game, name);

			if (entity) {
				return { mode: ChatType.Whisper, whisperTo: entity };
			}
		}

		return undefined;
	}
	private getMessageState() {
		const mode = this.currentChatMode;
		let chatType = (mode === 'mod' || mode === 'admin' || mode === 'owner' || mode === 'dev' || mode === 'builder' || mode === 'npc') ? ChatType.Say : mode;
		let message = replaceEmojis(cleanMessage(this.message || '')).substr(0, SAY_MAX_LENGTH);
		const whisperTo = this.game.whisperTo;
		let entityId = whisperTo && whisperTo.id || 0;

		if (mode === 'mod' && message && !/^\//.test(message)) {
			message = `/m ${message}`;
		} else if (mode === 'admin' && message && !/^\//.test(message)) {
			message = `/a ${message}`;
		} else if (mode === 'owner' && message && !/^\//.test(message)) {
			message = `/o ${message}`;
		} else if (mode === 'dev' && message && !/^\//.test(message)) {
			message = `/dev ${message}`;
		} else if (mode === 'builder' && message && !/^\//.test(message)) {
			message = `/build ${message}`;
		} else if (mode === 'npc' && message && !/^\//.test(message)) {
			message = `/npc ${message}`;
		}

		if (/^\/(w|whisper) .+$/i.test(message)) {
			chatType = ChatType.Whisper;
			message = message.substr(/^\/w /i.test(message) ? 3 : 9);

			let offset = 0;
			let entity: Entity | FakeEntity | undefined = undefined;

			do {
				offset = message.indexOf(' ', offset);

				if (offset === -1)
					break;

				const name = message.substr(0, offset);
				entity = findBestEntityByName(this.game, name);
				offset++;
			} while (!entity);

			if (entity) {
				message = message.substr(offset);
				entityId = entity.id;
			} else {
				entityId = 0;
			}
		}

		return { chatType, message, entityId };
	}
	private clearTypingStartTimeout() {
		if (this.typingShowTimeout !== undefined) {
			clearTimeout(this.typingShowTimeout);
			this.typingShowTimeout = undefined;
		}

		this.pendingTypingType = MessageType.Chat;
		this.pendingTypingEntityId = 0;
	}
	private clearTypingHideTimeout() {
		if (this.typingHideTimeout !== undefined) {
			clearTimeout(this.typingHideTimeout);
			this.typingHideTimeout = undefined;
		}
	}
	private clearTypingTimers() {
		this.clearTypingStartTimeout();
		this.clearTypingHideTimeout();
	}
	private closeChatTypeMenu() {
		this.showChatTypeMenu = false;
		this.selectedChatTypeIndex = 0;
		this.clearChatTypePreview();
	}

	getSelectableChatTypeIndex(mode: ChatModeId): number {
		const options = this.selectableChatTypeMenuOptions;
		for (let i = 0; i < options.length; i++) {
			if (options[i].mode === mode) {
				return i;
			}
		}
		return -1;
	}

	previewChatType(mode: ChatModeId) {
		if (!isValidChatMode(mode, this.game)) {
			return;
		}
		this.chatTypePreviewMode = mode;
		this.updateChatType();
	}

	clearChatTypePreview() {
		if (this.chatTypePreviewMode !== undefined) {
			this.chatTypePreviewMode = undefined;
			this.updateChatType();
			if (this.isOpen) {
				this.updateChatTypeInputPadding();
			}
		}
	}

	onChatTypeMenuHover(mode: ChatModeId) {
		const index = this.getSelectableChatTypeIndex(mode);
		if (index >= 0) {
			this.selectedChatTypeIndex = index;
			this.previewChatType(mode);
		}
	}
	private scrollSelectedChatTypeIntoView() {
		const activeItem = document.querySelector('.chat-type-menu li.active') as HTMLElement | null;
		if (activeItem) {
			activeItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		}
	}
	private getTypingMessageType(chatType: ChatType) {
		switch (chatType) {
			case ChatType.Party:
				return MessageType.Party;
			case ChatType.Think:
				return MessageType.Thinking;
			case ChatType.PartyThink:
				return MessageType.PartyThinking;
			case ChatType.Supporter:
				switch (this.game.model.supporter) {
					case 1: return MessageType.Supporter1;
					case 2: return MessageType.Supporter2;
					case 3: return MessageType.Supporter3;
					default: return MessageType.Chat;
				}
			case ChatType.Supporter1:
				return this.game.model.supporter >= 1 ? MessageType.Supporter1 : MessageType.Chat;
			case ChatType.Supporter2:
				return this.game.model.supporter >= 2 ? MessageType.Supporter2 : MessageType.Chat;
			case ChatType.Supporter3:
				return this.game.model.supporter >= 3 ? MessageType.Supporter3 : MessageType.Chat;
			case ChatType.Whisper:
				return MessageType.Whisper;
			default:
				return MessageType.Chat;
		}
	}
	private getTypingPreviewState(): { entityId: number; type: MessageType; } | undefined {
		const mode = this.currentChatMode;
		const { chatType, message, entityId } = this.getMessageState();
		const rawMessage = replaceEmojis(cleanMessage(this.message || '')).substr(0, SAY_MAX_LENGTH);
		const trimmedMessage = message.trim();

		if (!rawMessage) {
			return undefined;
		}

		if (!/^\//.test(rawMessage)) {
			if (mode === 'mod') {
				return { entityId: 0, type: MessageType.Mod };
			} else if (mode === 'admin') {
				return { entityId: 0, type: MessageType.Admin };
			} else if (mode === 'owner') {
				return { entityId: 0, type: MessageType.Owner };
			} else if (mode === 'dev') {
				return { entityId: 0, type: MessageType.Dev };
			} else if (mode === 'builder') {
				return { entityId: 0, type: MessageType.Builder };
			} else if (mode === 'npc') {
				return { entityId: 0, type: MessageType.NPC };
			}
		}

		if (/^\//.test(rawMessage)) {
			const commandMatch = /^\/([^\s]+)(?:\s+(.*))?$/.exec(rawMessage);
			const command = commandMatch && commandMatch[1].toLowerCase();
			const args = (commandMatch && commandMatch[2] || '').trim();

			switch (command) {
				case 's':
				case 'say':
					return args ? { entityId: 0, type: MessageType.Chat } : undefined;
				case 'p':
				case 'party':
					return args ? { entityId: 0, type: MessageType.Party } : undefined;
				case 't':
				case 'think':
					return args ? { entityId: 0, type: isPartyChat(this.chatType) ? MessageType.PartyThinking : MessageType.Thinking } : undefined;
				case 'ss':
					return args ? { entityId: 0, type: this.getTypingMessageType(ChatType.Supporter) } : undefined;
				case 's1':
					return args ? { entityId: 0, type: this.getTypingMessageType(ChatType.Supporter1) } : undefined;
				case 's2':
					return args ? { entityId: 0, type: this.getTypingMessageType(ChatType.Supporter2) } : undefined;
				case 's3':
					return args ? { entityId: 0, type: this.getTypingMessageType(ChatType.Supporter3) } : undefined;
				case 'm':
					return args ? { entityId: 0, type: MessageType.Mod } : undefined;
				case 'a':
					return args ? { entityId: 0, type: MessageType.Admin } : undefined;
				case 'o':
					return args ? { entityId: 0, type: MessageType.Owner } : undefined;
				case 'dev':
					return args ? { entityId: 0, type: MessageType.Dev } : undefined;
				case 'build':
					return args ? { entityId: 0, type: MessageType.Builder } : undefined;
				case 'npc':
					return args ? { entityId: 0, type: MessageType.NPC } : undefined;
				case 'w':
				case 'whisper':
					return trimmedMessage && entityId ? { entityId, type: MessageType.Whisper } : undefined;
				case 'r':
				case 'reply': {
					const lastWhisperFrom = this.game.lastWhisperFrom;
					const target = lastWhisperFrom && findEntityOrMockByAnyMeans(this.game, lastWhisperFrom.entityId);
					return args && target ? { entityId: target.id, type: MessageType.Whisper } : undefined;
				}
				default:
					return undefined;
			}
		}

		if (!trimmedMessage) {
			return undefined;
		}

		if (chatType === ChatType.Whisper && !entityId) {
			return undefined;
		}

		return { entityId, type: this.getTypingMessageType(chatType) };
	}
	private scheduleTypingIndicatorStart(entityId: number, type: MessageType) {
		if (
			this.typingShowTimeout !== undefined &&
			this.pendingTypingType === type &&
			this.pendingTypingEntityId === entityId
		) {
			return;
		}

		this.clearTypingStartTimeout();
		this.pendingTypingType = type;
		this.pendingTypingEntityId = entityId;
		this.typingShowTimeout = setTimeout(() => {
			this.typingShowTimeout = undefined;
			this.pendingTypingType = MessageType.Chat;
			this.pendingTypingEntityId = 0;
			const preview = this.getTypingPreviewState();

			if (!preview || preview.type !== type || preview.entityId !== entityId || this.typingIndicatorActive) {
				return;
			}

			if (this.game.send(server => server.typing(entityId, type, true))) {
				this.typingIndicatorActive = true;
				this.typingIndicatorType = type;
				this.typingIndicatorEntityId = entityId;
				this.scheduleTypingIndicatorHide();
			}
		}, typingIndicatorShowDelay);
	}
	private scheduleTypingIndicatorHide() {
		this.clearTypingHideTimeout();

		if (this.typingIndicatorActive) {
			this.typingHideTimeout = setTimeout(() => this.stopTypingIndicator(), typingIndicatorHideDelay);
		}
	}
	private dismissLocalTypingIndicator() {
		const player = this.game.player;
		const says = player && player.says;

		if (says && isTypingIndicatorMessage(says.message)) {
			says.timer = 0;
		}
	}
	private updateTypingIndicator() {
		if (!this.isOpen || this.disabled || !this.game.player || this.game.settings.account.showTypingIndicator === false) {
			this.stopTypingIndicator();
			return;
		}

		const preview = this.getTypingPreviewState();

		if (!preview) {
			this.clearTypingStartTimeout();
			this.scheduleTypingIndicatorHide();
			return;
		}

		if (this.typingIndicatorActive) {
			if (this.typingIndicatorType !== preview.type || this.typingIndicatorEntityId !== preview.entityId) {
				this.stopTypingIndicator();
				this.scheduleTypingIndicatorStart(preview.entityId, preview.type);
			} else {
				this.scheduleTypingIndicatorHide();
			}
		} else {
			this.scheduleTypingIndicatorStart(preview.entityId, preview.type);
		}
	}
	private stopTypingIndicator(immediately = false) {
		this.clearTypingTimers();

		if (immediately) {
			this.dismissLocalTypingIndicator();
		}

		if (this.typingIndicatorActive) {
			const type = this.typingIndicatorType;
			const entityId = this.typingIndicatorEntityId;
			this.typingIndicatorActive = false;
			this.typingIndicatorType = MessageType.Chat;
			this.typingIndicatorEntityId = 0;
			this.game.send(server => server.typing(entityId, type, false));
		}
	}
	private say(message: string, chatType: ChatType, entityId: number): boolean {
		this.game.lastChatMessageType = chatType;
		if (message.toLowerCase().startsWith('/shrug')) {
			var rawMessage = message.substring(6);
			return !!this.game.send(server =>
				server.say(entityId, ((rawMessage !== '') ? rawMessage + ' ' : '') + `¯\\_(ツ)_/¯`,
				chatType));
		} else {
			return !!this.game.send(server => server.say(entityId, message, chatType));
		}
	}
	private changeChatType(e: KeyboardEvent, chatType: ChatModeId) {
		this.stopTypingIndicator();
		this.setCurrentChatMode(chatType);
		this.message = '';
		this.syncEditorFromMessage();
		e.preventDefault();
	}
	private chat(event: Event | undefined) {
		if (this.isOpen) {
			this.send(event);
		} else {
			this.open();
		}
	}
	private command() {
		if (!this.isOpen) {
			this.chat(undefined);
			this.message = '/';
			this.syncEditorFromMessage();
			this.focusInput();
		}
	}
	private open() {
		if (!this.isOpen) {
			this.isOpen = true;
			this.chatBox.nativeElement.hidden = false;
			this.game.setKeyboardDisabled(true);
		}

		this.syncMessageColorFromPlayer();
		const chatMode = isValidChatMode(this.currentChatMode, this.game) ? this.currentChatMode : ChatType.Say;
		this.setCurrentChatMode(chatMode);
		this.syncEditorFromMessage();
		this.focusInput();
		this.updateTypingIndicator();
	}
	private close() {
		if (this.isOpen) {
			this.stopTypingIndicator();
			this.emojiBoxState = 'none';
			this.showCommandDropdown = false;
			this.commandQuery = '';
			this.tobeMode = false;
			this.tobeQuery = '';
			this.seasonMode = false;
			this.seasonPhase = 'season';
			this.seasonQuery = '';
			this.showColorPicker = false;
			this.showChatTypeMenu = false;
			this.selectedChatTypeIndex = 0;
			this.clearChatTypePreview();
			this.input.blur();
			this.isOpen = false;
			this.chatBox.nativeElement.hidden = true;
			this.message = '';
			this.syncEditorFromMessage();
			this.pasted = false;
			this.game.setKeyboardDisabled(false);
		}
	}
	toggle() {
		if (this.isOpen) {
			this.close();
		} else {
			this.open();
		}
	}
	onInputClick(event: MouseEvent) {
		event.stopPropagation();
		event.preventDefault();
		if (this.isOpen) {
			this.focusInput();
		}
	}
	onInputMouseDown(event: MouseEvent) {
		event.stopPropagation();
		if (!this.isOpen) {
			this.open();
		}
	}
	onChatBoxMouseDown(event: MouseEvent) {
		event.stopPropagation();
		if (this.isOpen && event.target &&
			!(event.target as HTMLElement).closest('button') &&
			!(event.target as HTMLElement).closest('emote-box') &&
			!(event.target as HTMLElement).closest('emoji-picker') &&
			!(event.target as HTMLElement).closest('.chat-box-type') &&
			!(event.target as HTMLElement).closest('.command-dropdown-menu') &&
			!(event.target as HTMLElement).closest('.chat-type-menu') &&
			!(event.target as HTMLElement).closest('.msgcolor-picker')) {
			this.showChatTypeMenu = false;
			this.selectedChatTypeIndex = 0;
			this.focusInput();
		}
	}
	onChatBoxClick(event: MouseEvent) {
		event.stopPropagation();
	}
	onChatTypeContextMenu(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (this.showChatTypeMenu) {
			this.closeChatTypeMenu();
			return;
		}
		this.showChatTypeMenu = true;
		this.invalidateChatTypeMenuOptions();
		this.refreshChatTypeMenuOptions();
		const currentIndex = this.getSelectableChatTypeIndex(this.currentChatMode);
		this.selectedChatTypeIndex = currentIndex >= 0 ? currentIndex : 0;
		this.updateChatTypeMenuPosition();
		const option = this.selectableChatTypeMenuOptions[this.selectedChatTypeIndex];
		if (option) {
			this.previewChatType(option.mode);
		}
	}
	selectChatType(mode: ChatModeId) {
		this.showChatTypeMenu = false;
		this.selectedChatTypeIndex = 0;
		this.chatTypePreviewMode = undefined;
		this.setCurrentChatMode(mode);
		this.updateChatType();
		this.focusInput();
		this.updateTypingIndicator();
	}
	selectChatTypeByIndex(index: number, mode: ChatModeId) {
		const options = this.selectableChatTypeMenuOptions;
		if (index < 0 || index >= options.length) {
			return;
		}

		const option = options[index];
		if (!option || option.mode !== mode) {
			return;
		}

		this.selectedChatTypeIndex = index;
		this.selectChatType(option.mode);
	}
	onMouseEnterEmojiButton(event: MouseEvent) {
		if (!event.target) return;
		const emoji = sample(emojis)!;
		this.btnEmoji = emoji.names[0];
	}
	startChatTypeMenuLongPress() {
		if (!isMobile) {
			return;
		}
		this.clearChatTypeMenuLongPress();
		this.chatTypeMenuPressTimer = setTimeout(() => {
			this.showChatTypeMenu = true;
			const currentIndex = this.getSelectableChatTypeIndex(this.currentChatMode);
			this.selectedChatTypeIndex = currentIndex >= 0 ? currentIndex : 0;
			this.updateChatTypeMenuPosition();
			const option = this.selectableChatTypeMenuOptions[this.selectedChatTypeIndex];
			if (option) {
				this.previewChatType(option.mode);
			}
		}, 350);
	}
	clearChatTypeMenuLongPress() {
		if (this.chatTypeMenuPressTimer !== undefined) {
			clearTimeout(this.chatTypeMenuPressTimer);
			this.chatTypeMenuPressTimer = undefined;
		}
	}
	onTypeBoxPressStart(event?: Event) {
		if (event) {
			event.preventDefault();
		}
		this.startChatTypeMenuLongPress();
	}
	onTypeBoxPressEnd() {
		this.clearChatTypeMenuLongPress();
	}
	toggleChatType(event?: MouseEvent) {
		if (event && event.button !== 0) {
			return;
		}
		if (isMobile) {
			if (this.showChatTypeMenu) {
				this.showChatTypeMenu = false;
				this.selectedChatTypeIndex = 0;
				return;
			}
			this.showChatTypeMenu = true;
			const currentIndex = this.getSelectableChatTypeIndex(this.currentChatMode);
			this.selectedChatTypeIndex = currentIndex >= 0 ? currentIndex : 0;
			this.updateChatTypeMenuPosition();
			const option = this.selectableChatTypeMenuOptions[this.selectedChatTypeIndex];
			if (option) {
				this.previewChatType(option.mode);
			}
			return;
		}

		const chatTypes = getChatTypes(this.game);
		const currentMode = this.currentChatMode;
		const index = chatTypes.indexOf(currentMode);
		const next = chatTypes[(index === -1 ? 0 : (index + 1)) % chatTypes.length];
		this.setCurrentChatMode(next);
		this.focusInput();
		this.updateTypingIndicator();
	}
	setChatType(type: 'say' | 'party' | 'whisper') {
		if (type === 'say') {
			this.setCurrentChatMode(ChatType.Say);
			this.open();
		} else if (type === 'party' && isInParty(this.game)) {
			this.setCurrentChatMode(ChatType.Party);
			this.open();
		} else if (type === 'whisper') {
			this.setCurrentChatMode(ChatType.Whisper);
			this.open();
		}

		this.updateTypingIndicator();
	}
	private currentTypeClass = '';
	private currentTypePrefix = '';
	private currentTypeName = '';
	private updateChatTypeInputPadding() {
		const chatBox = (this.chatBox.nativeElement as HTMLElement).getBoundingClientRect();
		const typeBox = (this.typeBox.nativeElement as HTMLElement).getBoundingClientRect();
		if (chatBox.width > 0 && typeBox.width > 0) {
			const padding = Math.ceil(typeBox.right - chatBox.left) + 4;
			(this.inputElement.nativeElement as HTMLElement).style.paddingLeft = `${padding}px`;
		}
	}

	private updateChatType() {
		let typeName: string;
		let typePrefix: string;
		let changed = false;

		const currentMode = this.chatTypePreviewMode !== undefined ? this.chatTypePreviewMode : this.currentChatMode;
		const typeClass = chatTypeClass(currentMode, this.game.model.supporter);

		if (this.currentTypeClass !== typeClass) {
			this.currentTypeClass = typeClass;
			(this.chatBoxInput.nativeElement as HTMLElement).className = typeClass;
		}

		if (currentMode === ChatType.Whisper) {
			typePrefix = 'To ';
			typeName = this.game.whisperTo && this.game.whisperTo.name || 'unknown';
		} else {
			typePrefix = '';
			typeName = getChatModeName(currentMode);
		}

		if (this.currentTypePrefix !== typePrefix) {
			changed = true;
			this.currentTypePrefix = typePrefix;
			(this.typePrefix.nativeElement as HTMLElement).textContent = typePrefix;
		}

		if (this.currentTypeName !== typeName) {
			changed = true;
			this.currentTypeName = typeName;
			replaceNodes(this.typeName.nativeElement, typeName);
		}

		if (currentMode === ChatType.Say) {
			const playerColor = this.game.player && (this.game.player as any).messageColor;
			const sayColor = this.msgColor || this.normalizeMessageColor(playerColor);
			(this.typeBox.nativeElement as HTMLElement).style.color = sayColor;
		} else {
			(this.typeBox.nativeElement as HTMLElement).style.color = '';
		}

		// Hover preview must not force a synchronous layout/reflow on every mousemove.
		// Recalculate the input padding only for the real selected mode.
		if ((changed || this.isOpen) && this.chatTypePreviewMode === undefined) {
			this.updateChatTypeInputPadding();
		}
	}
}

function getChatModeName(mode: ChatModeId) {
	switch (mode) {
		case 'mod': return 'mod';
		case 'admin': return 'admin';
		case 'owner': return 'owner';
		case 'dev': return 'dev';
		case 'builder': return 'builder';
		case 'npc': return 'npc';
		default: return chatTypeNames[mode as ChatType];
	}
}

function chatTypeClass(chatType: ChatModeId, supporter: number) {
	if (chatType === 'mod') {
		return 'chat-mod';
	} else if (chatType === 'admin') {
		return 'chat-admin';
	} else if (chatType === 'owner') {
		return 'chat-owner';
	} else if (chatType === 'dev') {
		return 'chat-dev';
	} else if (chatType === 'builder') {
		return 'chat-builder';
	} else if (chatType === 'npc') {
		return 'chat-npc';
	} else if (chatType === ChatType.Supporter) {
		switch (supporter) {
			case 1: return 'chat-sup chat-sup1';
			case 2: return 'chat-sup chat-sup2';
			case 3: return 'chat-sup chat-sup3';
		}
	}

	return chatTypeClasses[chatType as ChatType];
}

function isValidChatType(type: ChatType, game: PonyTownGame) {
	const supporter = game.model.supporter;

	switch (type) {
		case ChatType.Say:
		case ChatType.Think:
		case ChatType.Whisper:
			return true;
		case ChatType.Party:
		case ChatType.PartyThink:
			return isInParty(game);
		case ChatType.Supporter:
			return supporter > 0;
		case ChatType.Supporter1:
			return supporter >= 1;
		case ChatType.Supporter2:
			return supporter >= 2;
		case ChatType.Supporter3:
			return supporter >= 3;
		case ChatType.Supporter4:
			return supporter >= 4;
		case ChatType.Dismiss:
			return false;
		default:
			return invalidEnumReturn(type, false);
	}
}

function isValidChatMode(type: ChatModeId, game: PonyTownGame) {
	const account = game.model.account;

	if (type === 'mod') {
		return !!account && isMod(account);
	} else if (type === 'admin') {
		return !!account && isAdmin(account);
	} else if (type === 'owner') {
		return !!account && !!(account.roles && account.roles.indexOf('owner') !== -1);
	} else if (type === 'dev') {
		return !!account && !!(account.roles && account.roles.indexOf('dev') !== -1);
	} else if (type === 'builder') {
		return !!account && account.roles && account.roles.indexOf('builder') !== -1;
	} else if (type === 'npc') {
		return !!account && account.roles && account.roles.indexOf('npc') !== -1;
	} else {
		return isValidChatType(type as ChatType, game);
	}
}

function getChatTypes(game: PonyTownGame): ChatModeId[] {
	const chatTypes: ChatModeId[] = [ChatType.Say];
	const supporter = game.model.supporter;

	if (isInParty(game)) {
		chatTypes.push(ChatType.Party);
	}

	if (supporter) {
		chatTypes.push(ChatType.Supporter);
	}

	return chatTypes;
}

function getChatTypeMenuOptions(game: PonyTownGame): ChatTypeMenuOption[] {
	const options: ChatTypeMenuOption[] = [];
	const account = game.model.account;
	const supporter = game.model.supporter;

	const addMode = (mode: ChatModeId, category: ChatTypeMenuCategory) => {
		if (!isValidChatMode(mode, game)) {
			return false;
		}
		if (mode === ChatType.Supporter1 && supporter < 1) return false;
		if (mode === ChatType.Supporter2 && supporter < 2) return false;
		if (mode === ChatType.Supporter3 && supporter < 3) return false;
		if (mode === ChatType.Supporter4 && supporter < 4) return false;
		if (mode === ChatType.Supporter && supporter < 1) return false;
		if (mode === 'mod' && !(account && isMod(account))) return false;
		if (mode === 'admin' && !(account && isAdmin(account))) return false;
		if (mode === 'owner' && !(account && account.roles && account.roles.indexOf('owner') !== -1)) return false;
		if (mode === 'dev' && !(account && account.roles && account.roles.indexOf('dev') !== -1)) return false;
		if (mode === 'builder' && !(account && account.roles && account.roles.indexOf('builder') !== -1)) return false;
		if (mode === 'npc' && !(account && account.roles && account.roles.indexOf('npc') !== -1)) return false;
		if (mode === ChatType.Party && !isInParty(game)) return false;
		if (mode === ChatType.Think && !isValidChatType(ChatType.Think, game)) return false;

		const tagId = getChatTypeTagId(mode);
		const tag = tagId ? getTag(tagId) : undefined;
		options.push({
			label: getChatModeName(mode),
			mode,
			category,
			badgeClass: tag ? tag.className : 'none',
			icon: tag && tag.icon,
		});
		return true;
	};

	const roleModes: ChatModeId[] = ['owner', 'admin', 'mod', 'builder', 'dev', 'npc'];
	if (roleModes.some(mode => isValidChatMode(mode, game))) {
		options.push({ label: 'Developer chats', divider: true, category: 'developer' });
		for (const mode of roleModes) {
			addMode(mode, 'developer');
		}
	}

	const supporterModes: ChatModeId[] = [
		ChatType.Supporter4,
		ChatType.Supporter3,
		ChatType.Supporter2,
		ChatType.Supporter1,
		ChatType.Supporter,
	];
	if (supporterModes.some(mode => isValidChatMode(mode, game))) {
		options.push({ label: 'Supporter chats', divider: true, category: 'supporter' });
		for (const mode of supporterModes) {
			addMode(mode, 'supporter');
		}
	}

	if (isValidChatMode(ChatType.Think, game) || isInParty(game) || isValidChatMode(ChatType.Say, game)) {
		options.push({ label: 'Chats', divider: true, category: 'chats' });
		if (isValidChatMode(ChatType.Think, game)) {
			addMode(ChatType.Think, 'chats');
		}
		if (isInParty(game)) {
			addMode(ChatType.Party, 'chats');
		}
		addMode(ChatType.Say, 'chats');
	}

	return options;
}

function getChatTypeTagId(mode: ChatModeId): string | undefined {
	switch (mode) {
		case ChatType.Say: return undefined;
		case ChatType.Party: return 'owner';
		case ChatType.Think: return undefined;
		case ChatType.Whisper: return undefined;
		case ChatType.Supporter:
			return 'sup1';
		case ChatType.Supporter1:
			return 'sup1';
		case ChatType.Supporter2:
			return 'sup2';
		case ChatType.Supporter3:
			return 'sup3';
		case ChatType.Supporter4:
			return 'sup4';
		case 'mod': return 'mod';
		case 'admin': return 'admin';
		case 'owner': return 'owner';
		case 'dev': return 'dev';
		case 'builder': return 'builder';
		case 'npc': return 'npc';
		default: return undefined;
	}
}
