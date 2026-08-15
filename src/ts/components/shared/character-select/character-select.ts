import { Component, Input, EventEmitter, Output, ViewChild, ElementRef, TemplateRef, AfterViewInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { Subscription } from 'rxjs';
import { PonyObject } from '../../../common/interfaces';
import { PLAYER_NAME_MAX_LENGTH } from '../../../common/constants';
import { VERSION_ERROR } from '../../../common/errors';
import { GameService } from '../../services/gameService';
import { Model, createDefaultPonyObject } from '../../services/model';
import { Dropdown } from '../directives/dropdown';
import { faSpinner, faTrash, faTimes, faCheck } from '../../../client/icons';
import { focusElementAfterTimeout } from '../../../client/htmlUtils';
import { delay } from '../../../common/utils';
import { sample } from 'lodash';
import { isMobile } from '../../../client/data';
import { toPalette } from '../../../common/ponyInfo';
import { emojis, hasEmojis, splitEmojis, findEmoji } from '../../../client/emoji';
import { loadAndInitSpriteSheets } from '../../../client/spriteUtils';
import { font } from '../../../client/fonts';
import { getCharacterSprite } from '../../../graphics/spriteFont';
import { getEmojiImageAsync } from '../../../client/emoji';

@Component({
	selector: 'character-select',
	templateUrl: 'character-select.pug',
	styleUrls: ['character-select.scss'],
})
export class CharacterSelect implements AfterViewInit, OnDestroy {
	readonly maxNameLength = PLAYER_NAME_MAX_LENGTH;
	readonly spinnerIcon = faSpinner;
	readonly deleteIcon = faTrash;
	readonly removeIcon = faTimes;
	readonly confirmIcon = faCheck;
	btnEmoji = emojis[0].names[0];
	showDeleteModal = false;
	@Input() newButton = false;
	@Input() editButton = false;
	@Input() removeButton = false;
	@Input() error?: string;
	@Output() errorChange = new EventEmitter<string | undefined>();
	@Output() change = new EventEmitter<PonyObject>();
	@Output() preview = new EventEmitter<PonyObject | undefined>();
	@ViewChild('nameInput', { static: true }) nameInput!: ElementRef;
	@ViewChild('ariaAnnounce', { static: true }) ariaAnnounce!: ElementRef;
	@ViewChild('dropdown', { static: true }) dropdown!: Dropdown;
	@ViewChild('deleteModal', { static: true }) deleteModalTpl!: TemplateRef<any>;
	@Input() emojiButton = true;
	readonly toPalette = toPalette;
	emojiBoxState = 'none';
	removing = false;
	currentModalRef?: BsModalRef;
	private locked = false;
	private updatingName = false;
	private initialized = false;
	private ponyChangedSub?: Subscription;
	constructor(
		private element: ElementRef,
		private router: Router,
		private model: Model,
		private gameService: GameService,
		private modalService: BsModalService,
	) {
	}

	ngAfterViewInit() {
		loadAndInitSpriteSheets().then(() => {
			this.initialized = true;
			this.syncEditorFromName();
		});
		this.ponyChangedSub = this.model.ponyChanged$.subscribe(() => {
			if (this.initialized) {
				this.syncEditorFromName();
			}
		});
	}

	ngOnDestroy() {
		this.ponyChangedSub && this.ponyChangedSub.unsubscribe();
	}

	private syncEditorFromName() {
		const el = this.nameInput && this.nameInput.nativeElement as HTMLElement;
		if (!el || this.updatingName) return;
		const name = (this.pony && this.pony.name) || '';
		if (hasEmojis(name)) {
			el.innerHTML = '';
			const parts = splitEmojis(name);
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
			el.textContent = name;
		}
		if (!name) {
			el.classList.add('empty');
		} else {
			el.classList.remove('empty');
		}
	}

	private extractNameFromEditor(): string {
		const el = this.nameInput && this.nameInput.nativeElement as HTMLElement;
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
		return result.replace(/[\u200B\u00A0]/g, ' ').replace(/\s+/g, ' ').trim();
	}

	onNameInput(_event: Event) {
		const el = this.nameInput && this.nameInput.nativeElement as HTMLElement;
		if (!el || !this.pony) return;
		const name = this.extractNameFromEditor();
		this.updatingName = true;
		if (name.length <= this.maxNameLength) {
			this.pony.name = name;
		}
		if (!name) {
			el.classList.add('empty');
		} else {
			el.classList.remove('empty');
		}
		this.updatingName = false;
	}

	onNameKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
		}
		const name = this.extractNameFromEditor();
		if (name.length >= this.maxNameLength && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) && !event.ctrlKey && !event.metaKey) {
			event.preventDefault();
		}
	}

	onNameBlur(_event: Event) {
		const el = this.nameInput && this.nameInput.nativeElement as HTMLElement;
		if (!el) return;
		const name = this.extractNameFromEditor();
		if (!name) {
			el.classList.add('empty');
		} else {
			el.classList.remove('empty');
		}
	}

	onNamePaste(event: ClipboardEvent) {
		event.preventDefault();
		const text = (event.clipboardData && event.clipboardData.getData('text')) || '';
		const cleaned = text.replace(/[^\w\s!@#$%^&*()\-+=<>?/\\|{}[\]~`]/g, '').substring(0, this.maxNameLength);
		document.execCommand('insertText', false, cleaned);
	}
	get joining() {
		return this.gameService.joining;
	}
	get pony() {
		return this.model.pony;
	}
	get canNew() {
		return !this.joining && this.model.account && this.model.account.characterCount < this.model.characterLimit;
	}
	get canEdit() {
		return !this.joining;
	}
	get canRemove() {
		return !this.joining && !this.locked && !this.model.pending && !!this.pony
			&& !!this.pony.id && this.error !== VERSION_ERROR;
	}
	get hasPonies() {
		return !!this.model.ponies.length;
	}
	select(pony: PonyObject) {
		if (pony) {
			this.removing = false;
			this.model.selectPony(pony);
			this.change.emit(pony);
			this.preview.emit(undefined);
		}

		this.dropdown.close();
		this.focusName();
	}
	createNew() {
		if (this.canNew) {
			this.removing = false;
			this.model.selectPony(createDefaultPonyObject());
			this.change.emit(this.pony);
			this.router.navigate(['/character']);
			this.focusName();
		}
	}
	edit() {
		if (this.canEdit) {
			this.removing = false;
			this.router.navigate(['/character']);
		}
	}
	remove() {
		if (this.canRemove) {
			// show delete modal as a template-based overlay so content is rendered inside modal container
			this.currentModalRef = this.modalService.show(this.deleteModalTpl, { class: 'modal-md' });
		}
	}
	cancelRemove() {
		this.removing = false;
		focusElementAfterTimeout(this.element.nativeElement, '.remove-button');
	}
	confirmRemove() {
		if (this.canRemove) {
			this.setError(undefined);
			this.removing = false;
			this.locked = true;

			this.model.removePony(this.pony)
				.then(() => this.change.emit(this.pony))
				.catch((e: Error) => this.setError(e.message))
				.then(() => this.ariaAnnounce.nativeElement.textContent = 'Character removed')
				.then(() => delay(2000))
				.then(() => this.locked = false)
				.then(() => this.focusName());
		}
	}
	onToggle(show: boolean) {
		if (!show) {
			this.preview.emit(undefined);
		}
	}
	private focusName() {
		if (!isMobile) {
			const el = this.nameInput && this.nameInput.nativeElement as HTMLElement;
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
	}
	private setError(error: string | undefined) {
		this.error = error;
		this.errorChange.emit(error);
	}

	addEmoji(emoji: string) {
		this.toggleEmojiBox();
		if (!this.pony) return;

		const el = this.nameInput && this.nameInput.nativeElement as HTMLElement;
		if (!el) return;

		const name = this.extractNameFromEditor();
		if (name.length >= this.maxNameLength) return;

		const sprite = font && getCharacterSprite(emoji, font);
		if (sprite) {
			const img = document.createElement('img');
			img.className = 'pixelart';
			img.style.display = 'inline-block';
			img.style.verticalAlign = 'middle';
			img.style.width = `${(sprite.w + sprite.ox) * 1.6}px`;
			img.style.height = `${10 * 1.6}px`;
			img.style.marginTop = '-3px';
			img.alt = emoji;
			getEmojiImageAsync(sprite, src => {
				img.src = src;
			});

			const sel = window.getSelection();
			if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
				const range = sel.getRangeAt(0);
				range.collapse(false);
				range.insertNode(img);
				range.setStartAfter(img);
				range.setEndAfter(img);
				sel.removeAllRanges();
				sel.addRange(range);
			} else {
				el.appendChild(img);
			}

			this.pony.name = this.extractNameFromEditor();
		} else {
			const sel = window.getSelection();
			if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
				const range = sel.getRangeAt(0);
				range.collapse(false);
				document.execCommand('insertText', false, emoji);
			} else {
				el.appendChild(document.createTextNode(emoji));
			}
			this.pony.name = this.extractNameFromEditor();
		}

		el.classList.remove('empty');
	}

	toggleEmojiBox() {
		if (this.emojiBoxState === 'none') {
			this.emojiBoxState = 'inline-block';
		} else {
			this.emojiBoxState = 'none';
		}
	}

	onMouseEnterEmojiButton(event: MouseEvent) {
		if (!event.target) return;
		const emoji = sample(emojis)!;
		this.btnEmoji = emoji.names[0];
	}
}
