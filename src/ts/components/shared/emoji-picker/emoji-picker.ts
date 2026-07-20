import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, AfterViewChecked, HostListener } from '@angular/core';
import { emojis, Emoji } from '../../../client/emoji';
import { AgDragEvent } from '../directives/agDrag';
import {
	RubberPanelController,
	RubberPanelState,
	rubberPanelResizeEdgesFromCorner,
} from '../shared-physics/rubber-panel-controller';

interface EmojiCategory {
	name: string;
	emotes: Emoji[];
}

const MIN_PICKER_WIDTH = 220;
const MAX_PICKER_WIDTH = 320;
const MIN_PICKER_HEIGHT = 160;
const MAX_PICKER_HEIGHT = 260;
const DEFAULT_PICKER_WIDTH = 220;
const DEFAULT_PICKER_HEIGHT = 190;
const RESET_AFTER_OVER_LIMIT_DRAGS = 3;

@Component({
	selector: 'emoji-picker',
	templateUrl: 'emoji-picker.pug',
	styleUrls: ['emoji-picker.scss'],
})
export class EmojiPickerComponent implements AfterViewInit, AfterViewChecked {
	private displayValue = false;
	renderedDisplay = false;
	@Input()
	get display() {
		return this.displayValue;
	}
	set display(value: boolean) {
		if (value && !this.displayValue) {
			this.getPanelController().stopAnimation();
			this.renderedDisplay = true;
			this.pendingOpenAnimation = true;
		} else if (!value && this.displayValue) {
			this.pendingOpenAnimation = false;
			this.runCloseAnimation();
		}

		this.displayValue = value;
	}
	@Input() resizeCorner: 'bottom-left' | 'top-left' = 'bottom-left';
	@Output() emojiSelected = new EventEmitter<string>();
	@Output() closed = new EventEmitter<void>();
	@ViewChild('pickerBox', { static: false }) pickerBox?: ElementRef;
	@ViewChild('scrollContainer', { static: false }) scrollContainer?: ElementRef;
	pickerWidth?: number;
	pickerHeight?: number;
	pickerTop?: number;
	pickerMinWidth = MIN_PICKER_WIDTH;
	pickerMinHeight = MIN_PICKER_HEIGHT;
	physicsOffsetX = 0;
	physicsOffsetY = 0;
	physicsStretchX = 1;
	physicsStretchY = 1;
	isOverLimit = false;
	private isResizing = false;
	private ignoreOutsideClickUntil = 0;
	private defaultPickerTop?: number;
	private pendingOpenAnimation = false;
	private panelController?: RubberPanelController;
	private panelControllerCorner?: 'bottom-left' | 'top-left';
	constructor(private el: ElementRef) {}

	@HostListener('document:click', ['$event'])
	onDocumentClick(event: MouseEvent) {
		if (!this.display) return;
		if (this.isResizing || Date.now() < this.ignoreOutsideClickUntil) return;
		const target = event.target as HTMLElement;
		if (!target) return;
		// Click inside picker — ignore
		if (this.el.nativeElement.contains(target)) return;
		// Click on emoji buttons that toggle the picker — ignore to avoid immediate close
		if (target.closest && target.closest('.character-emoji-button, .chat-emoji-button')) return;
		// Otherwise, close the picker
		this.closed.emit();
	}

	categories: EmojiCategory[] = [];
	filteredCategories: EmojiCategory[] = [];
	searchQuery = '';
	allEmotes = emojis;

	private categoryMap: { name: string; symbols: string[] }[] = [
		{
			name: 'Tiny faces',
			symbols: ['🙂', '😵', '😠', '😐', '😑', '😆', '😍', '😟', '🤔', '🙃', '😈', '👿', '👃'],
		},
		{
			name: 'Cat faces',
			symbols: ['🐱', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'],
		},
		{
			name: 'Hearts',
			symbols: ['❤', '💙', '💚', '💛', '💜', '🖤', '💔', '💖', '💗', '💕'],
		},
		{
			name: 'Food & objects',
			symbols: ['🥌', '🍕', '🍎', '🍏', '🍊', '🍐', '🥭', '🥕', '🍇', '🍌', '⛏', '🥚', '💮', '🌸', '🍬', '🍡', '🍭', '⭐', '🌟', '🌠', '⚡', '❄', '⛄', '🏀', '🎃', '🌲', '🎄', '🕯', '🎅', '💐', '🌿', '🎲', '✨', '🎁', '🔥', '🎵', '🎶', '🌈', '🐾', '👑', '💎', '☘', '🍀', '🍪'],
		},
		{
			name: 'Animals',
			symbols: ['🦋', '🦇', '🕷', '👻', '🐈'],
		},
		{
			name: 'Symbols',
			symbols: ['™', '♂', '♀', '⚧'],
		},
		{
			name: 'Zodiac',
			symbols: ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '⛎'],
		},
	];


	ngAfterViewInit() {
		this.initializeCategories();
	}

	ngAfterViewChecked() {
		if (this.pendingOpenAnimation && this.pickerBox) {
			this.pendingOpenAnimation = false;
			this.runOpenAnimation();
		}
	}

	private initializeCategories() {
		this.categories = this.categoryMap.map((cat: { name: string; symbols: string[] }) => ({
			name: cat.name,
			emotes: this.allEmotes.filter((e: Emoji) => cat.symbols.indexOf(e.symbol) !== -1),
		}));

		this.filteredCategories = this.categories;
	}

	// Note: Explicit types added to lambdas earlier to avoid implicit any errors in older TypeScript versions
	// and loops used instead of flatMap to support older lib targets.

	onSearchChange(query: string) {
		this.searchQuery = query.toLowerCase();

		if (!this.searchQuery) {
			this.filteredCategories = this.categories;
			return;
		}

		this.filteredCategories = this.categories
			.map((category: EmojiCategory) => ({
				...category,
				emotes: category.emotes.filter((emote: Emoji) =>
					emote.names.some((name: string) => name.includes(this.searchQuery)) ||
					(emote.symbol && emote.symbol.includes(this.searchQuery)),
				),
			}))
			.filter((category: EmojiCategory) => category.emotes.length > 0);
	}

	selectEmoji(emoji: Emoji) {
		this.emojiSelected.emit(emoji.symbol);
	}

	private applyPanelState = (state: RubberPanelState) => {
		this.pickerWidth = state.width;
		this.pickerHeight = state.height;
		this.pickerTop = state.top;
		this.pickerMinWidth = state.minWidth;
		this.pickerMinHeight = state.minHeight;
		this.physicsOffsetX = state.contentOffsetX;
		this.physicsOffsetY = state.contentOffsetY;
		this.physicsStretchX = state.contentStretchX;
		this.physicsStretchY = state.contentStretchY;
		this.isOverLimit = state.isOverLimit;
	}

	private getPanelController() {
		if (!this.panelController || this.panelControllerCorner !== this.resizeCorner) {
			if (this.panelController) {
				this.panelController.destroy();
			}

			this.panelControllerCorner = this.resizeCorner;
			this.panelController = new RubberPanelController({
				width: { min: MIN_PICKER_WIDTH, max: MAX_PICKER_WIDTH, defaultValue: DEFAULT_PICKER_WIDTH },
				height: { min: MIN_PICKER_HEIGHT, max: MAX_PICKER_HEIGHT, defaultValue: DEFAULT_PICKER_HEIGHT },
				resizeEdges: rubberPanelResizeEdgesFromCorner(this.resizeCorner),
				tuning: { resetAfterOverLimitDrags: RESET_AFTER_OVER_LIMIT_DRAGS },
				onUpdate: this.applyPanelState,
			});
		}

		return this.panelController;
	}

	private readPickerLayout(picker: HTMLElement) {
		return {
			width: this.pickerWidth === undefined ? picker.offsetWidth : this.pickerWidth,
			height: this.pickerHeight === undefined ? picker.offsetHeight : this.pickerHeight,
			top: this.pickerTop === undefined ? (parseFloat(getComputedStyle(picker).top || '0') || 0) : this.pickerTop,
		};
	}

	private ensureDefaultLayout(layout: { width: number; height: number; top?: number; }) {
		if (this.defaultPickerTop === undefined) {
			this.defaultPickerTop = layout.top;
		}

		this.getPanelController().setDefaultLayout({
			width: DEFAULT_PICKER_WIDTH,
			height: DEFAULT_PICKER_HEIGHT,
			top: this.defaultPickerTop,
		});
	}

	private finishCloseAnimation() {
		this.getPanelController().stopAnimation();
		this.renderedDisplay = false;
		this.pickerWidth = undefined;
		this.pickerHeight = undefined;
		this.pickerTop = undefined;
		this.pickerMinWidth = MIN_PICKER_WIDTH;
		this.pickerMinHeight = MIN_PICKER_HEIGHT;
		this.isOverLimit = false;
		this.physicsOffsetX = 0;
		this.physicsOffsetY = 0;
		this.physicsStretchX = 1;
		this.physicsStretchY = 1;
	}

	private runOpenAnimation() {
		const picker = this.pickerBox && this.pickerBox.nativeElement as HTMLElement;

		if (!picker) {
			return;
		}

		const layout = this.readPickerLayout(picker);
		this.ensureDefaultLayout(layout);
		this.getPanelController().open(layout);
	}

	private runCloseAnimation() {
		const picker = this.pickerBox && this.pickerBox.nativeElement as HTMLElement;

		if (!picker) {
			this.finishCloseAnimation();
			return;
		}

		const layout = this.readPickerLayout(picker);
		this.ensureDefaultLayout(layout);
		this.getPanelController().close(layout, () => this.finishCloseAnimation());
	}

	dragResize({ event, type, dx, dy }: AgDragEvent) {
		event.preventDefault();
		const panelController = this.getPanelController();

		if (type === 'start') {
			panelController.stopAnimation();
			this.isResizing = true;
			const picker = this.pickerBox && this.pickerBox.nativeElement as HTMLElement;

			if (!picker) {
				return;
			}

			const layout = this.readPickerLayout(picker);
			this.ensureDefaultLayout(layout);
			panelController.beginResize(layout);
		}

		panelController.resizeBy(dx, dy);

		if (type === 'end') {
			this.isResizing = false;
			this.ignoreOutsideClickUntil = Date.now() + 150;
			panelController.endResize();
		}
	}

	ngOnDestroy() {
		if (this.panelController) {
			this.panelController.destroy();
		}
	}

	onMouseEnterEmojiButton(_event: MouseEvent) {
		// Sample random emoji for button display
		const randomEmoji = this.allEmotes[Math.floor(Math.random() * this.allEmotes.length)];
		if (randomEmoji) {
			// This would be emitted to parent component to update button emoji
		}
	}
}
