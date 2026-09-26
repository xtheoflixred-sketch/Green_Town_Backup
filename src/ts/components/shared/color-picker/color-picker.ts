import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { clamp } from '../../../common/utils';
import { colorNames, parseColor, parseColorFast, colorToCSS, colorFromHSVA, colorToHSVA, colorToHexRGB, colorToHexRGBA, colorToRGBA, colorFromRGBA, getAlpha, rgb2hsl, rgb2hsv } from '../../../common/color';
import { AgDragEvent } from '../directives/agDrag';
import { faChevronDown, faChevronUp, faCopy, faPaste } from '../../../client/icons';

type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'hsv';

function hslToRGB(h: number, s: number, l: number) {
	s /= 100;
	l /= 100;
	const chroma = (1 - Math.abs(2 * l - 1)) * s;
	const hue = h / 60;
	const x = chroma * (1 - Math.abs(hue % 2 - 1));
	let r = 0;
	let g = 0;
	let b = 0;
	if (hue < 1) { r = chroma; g = x; }
	else if (hue < 2) { r = x; g = chroma; }
	else if (hue < 3) { g = chroma; b = x; }
	else if (hue < 4) { g = x; b = chroma; }
	else if (hue < 5) { r = x; b = chroma; }
	else { r = chroma; b = x; }
	const m = l - chroma / 2;
	return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

@Component({
	selector: 'color-picker',
	templateUrl: 'color-picker.pug',
	styleUrls: ['color-picker.scss'],
})
export class ColorPicker implements OnDestroy {
	readonly colorNames = colorNames;
	readonly chevronIcon = faChevronDown;
	readonly brightnessDownIcon = faChevronDown;
	readonly brightnessUpIcon = faChevronUp;
	readonly copyIcon = faCopy;
	readonly pasteIcon = faPaste;
	readonly colorFormats: { value: ColorFormat; label: string; }[] = [
		{ value: 'hex', label: 'HEX' }, { value: 'rgb', label: 'RGB' },
		{ value: 'hsl', label: 'HSL' }, { value: 'hsv', label: 'HSV' },
	];
	clipboardFormat: ColorFormat = 'hex';
	clipboardMessage = '';
	@ViewChild('menu', { static: false }) menu?: ElementRef;
	private openState = false;
	@Input()
	set isOpen(value: boolean) {
		this.openState = !!value;
		if (!this.openState) this.brightnessOpen = false;
		if (this.openState) this.schedulePlacement();
	}
	get isOpen() {
		return this.openState;
	}
	@Input() isDisabled = false;
	@Input() disabledColor = '';
	@Input() color = '';
	@Input() indicatorColor = '';
	@Input() label?: string = undefined;
	@Input() labelledBy?: string = undefined;
	private requestedOpenUp = false;
	private placementOpenUp = false;
	private placementTimer: any;
	private inputText = '';
	private inputFocused = false;
	colorDropTarget = false;
	brightnessOpen = false;
	@Input()
	set openUp(value: boolean) {
		this.requestedOpenUp = !!value;
		if (this.isOpen) this.schedulePlacement();
	}
	get openUp() {
		return this.placementOpenUp;
	}
	@Output() colorChange = new EventEmitter<string>();
	@Output() colorChangeStart = new EventEmitter<void>();
	@Output() colorChangeEnd = new EventEmitter<string>();
	s = 0;
	v = 0;
	h = 0;
	alpha = 1;
	private lastColor = '';
	private closeHandler = () => this.close();
	private repositionHandler = () => this.schedulePlacement();
	constructor(private element: ElementRef) {}
	get inputColor() {
		return this.isDisabled && this.disabledColor ? this.disabledColor : this.color;
	}
	set inputColor(value) {
		if (!this.isDisabled) {
			this.color = value;
		}
	}
	get bg() {
		return colorToCSS(parseColorFast(this.inputColor));
	}
	get formattedInputColor() {
		if (this.isDisabled && this.disabledColor) return this.disabledColor;
		return this.inputFocused ? this.inputText : this.clipboardValue;
	}
	get namedColorSuggestions() {
		const query = this.inputText.trim().toLowerCase();
		if (!this.inputFocused || !query || colorNames[query]) return [];
		return Object.keys(colorNames)
			.filter(name => name.indexOf(query) === 0)
			.slice(0, 8);
	}
	get svLeft() {
		this.updateHsv();
		return this.s * 100;
	}
	get svTop() {
		this.updateHsv();
		return (1 - this.v) * 100;
	}
	get hueTop() {
		this.updateHsv();
		return this.h * 100 / 360;
	}
	get hueLeft() {
		this.updateHsv();
		return this.h * 100 / 360;
	}
	get saturationLeft() {
		this.updateHsv();
		return this.s * 100;
	}
	get hue() {
		this.updateHsv();
		return colorToCSS(colorFromHSVA(this.h, 1, 1, 1));
	}
	get brightnessGradient() {
		this.updateHsv();
		return `linear-gradient(to right, #000, ${colorToCSS(colorFromHSVA(this.h, this.s, 1, 1))})`;
	}
	get hueHorizontalGradient() {
		return 'linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)';
	}
	get saturationGradient() {
		this.updateHsv();
		return `linear-gradient(to right, ${colorToCSS(colorFromHSVA(this.h, 0, this.v, 1))}, ${colorToCSS(colorFromHSVA(this.h, 1, this.v, 1))})`;
	}
	get brightnessLeft() {
		this.updateHsv();
		return this.v * 100;
	}
	get brightnessIcon() {
		return this.brightnessOpen ? this.brightnessUpIcon : this.brightnessDownIcon;
	}
	get clipboardValue() {
		const color = parseColorFast(this.color);
		const rgba = colorToRGBA(color);
		const hex = rgba.a === 255 ? colorToHexRGB(color) : colorToHexRGBA(color);
		if (this.clipboardFormat === 'hex') return hex;
		if (this.clipboardFormat === 'rgb') return rgba.a === 255 ? `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})` : `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${this.formatAlpha(rgba.a)})`;
		const hsl = rgb2hsl(rgba);
		if (this.clipboardFormat === 'hsl') return rgba.a === 255 ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${this.formatAlpha(rgba.a)})`;
		const hsv = rgb2hsv(rgba.r, rgba.g, rgba.b, rgba.a / 255);
		return rgba.a === 255 ? `hsv(${Math.round(hsv.h)}, ${Math.round(hsv.s * 100)}%, ${Math.round(hsv.v * 100)}%)` : `hsva(${Math.round(hsv.h)}, ${Math.round(hsv.s * 100)}%, ${Math.round(hsv.v * 100)}%, ${this.formatAlpha(rgba.a)})`;
	}
	get alphaLeft() {
		this.updateHsv();
		return this.alpha * 100;
	}
	get alphaValue() {
		this.updateHsv();
		return this.alpha;
	}
	set alphaValue(value: number) {
		this.updateHsv();
		this.alpha = clamp(value, 0, 1);
		this.updateColor(false);
	}
	focus(e: Event) {
		this.inputFocused = true;
		this.inputText = this.clipboardValue;
		this.open();
		(e.target as HTMLInputElement).select();
	}
	dragSV({ event, x, y, width, height, type }: AgDragEvent) {
		event.preventDefault();

		if (type === 'start') {
			this.colorChangeStart.emit();
		}

		this.updateHsv();
		this.s = clamp(x / width, 0, 1);
		this.v = 1 - clamp(y / height, 0, 1);
		this.updateColor(type === 'end');
	}
	dragHue({ event, y, height, type }: AgDragEvent) {
		event.preventDefault();

		if (type === 'start') {
			this.colorChangeStart.emit();
		}

		this.updateHsv();
		this.h = clamp(360 * y / height, 0, 360);
		this.updateColor(type === 'end');
	}
	dragBrightness({ event, x, width, type }: AgDragEvent) {
		event.preventDefault();

		if (type === 'start') {
			this.colorChangeStart.emit();
		}

		this.updateHsv();
		this.v = clamp(x / width, 0, 1);
		this.updateColor(type === 'end');
	}
	dragHueHorizontal({ event, x, width, type }: AgDragEvent) {
		event.preventDefault();
		if (type === 'start') this.colorChangeStart.emit();
		this.updateHsv();
		this.h = clamp(360 * x / width, 0, 360);
		this.updateColor(type === 'end');
	}
	dragSaturation({ event, x, width, type }: AgDragEvent) {
		event.preventDefault();
		if (type === 'start') this.colorChangeStart.emit();
		this.updateHsv();
		this.s = clamp(x / width, 0, 1);
		this.updateColor(type === 'end');
	}
	updateHsv() {
		if (this.lastColor !== this.color) {
			const { h, s, v } = colorToHSVA(parseColorFast(this.color), this.h);
			this.h = h;
			this.s = s;
			this.v = v;
			this.alpha = getAlpha(parseColorFast(this.color)) / 255;
			this.lastColor = this.color;
		}
	}
	updateColor(commit = false) {
		const value = colorFromHSVA(this.h, this.s, this.v, this.alpha);
		const color = this.alpha === 1 ? colorToHexRGB(value) : colorToHexRGBA(value);
		const changed = this.color !== color;
		this.lastColor = this.color = color;

		if (changed) {
			this.colorChange.emit(color);
		}
		if (commit) {
			this.colorChangeEnd.emit(color);
		}
	}
	alphaChanged(value: string) {
		this.updateHsv();
		this.alpha = clamp(Number(value) / 100, 0, 1);
		this.updateColor(true);
	}
	inputChanged(value: string) {
		this.inputText = value;
		const parsed = this.parseClipboardColor(value);
		if (parsed === undefined) return;
		this.color = this.colorValue(parsed);
		this.lastColor = '';
		this.updateHsv();
		this.colorChange.emit(this.color);
		this.colorChangeEnd.emit(this.color);
	}
	startColorDrag(event: DragEvent) {
		if (this.isDisabled || !event.dataTransfer) return;
		event.dataTransfer.effectAllowed = 'copy';
		event.dataTransfer.setData('text/plain', this.colorValue(parseColorFast(this.color)));
		event.dataTransfer.setData('application/x-color-picker', this.colorValue(parseColorFast(this.color)));
	}
	allowColorDrop(event: DragEvent) {
		if (!this.isDisabled && event.dataTransfer) {
			event.preventDefault();
			this.colorDropTarget = true;
			event.dataTransfer.dropEffect = 'copy';
		}
	}
	leaveColorDrop() {
		this.colorDropTarget = false;
	}
	dropColor(event: DragEvent) {
		if (this.isDisabled || !event.dataTransfer) return;
		event.preventDefault();
		this.colorDropTarget = false;
		const value = event.dataTransfer.getData('application/x-color-picker') || event.dataTransfer.getData('text/plain');
		const parsed = this.parseClipboardColor(value);
		if (parsed === undefined) return;
		this.color = this.colorValue(parsed);
		this.lastColor = this.color;
		this.colorChange.emit(this.color);
		this.colorChangeEnd.emit(this.color);
	}
	blurInput() {
		this.inputFocused = false;
		this.inputText = '';
		setTimeout(() => this.close(), 150);
	}
	selectNamedColor(name: string) {
		const value = colorNames[name];
		if (!value) return;
		this.inputText = name;
		this.color = value;
		this.lastColor = this.color;
		this.colorChange.emit(this.color);
		this.colorChangeEnd.emit(this.color);
	}
	async copyColor() {
		try {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(this.clipboardValue);
			} else {
				const textarea = document.createElement('textarea');
				textarea.value = this.clipboardValue;
				textarea.style.position = 'fixed';
				textarea.style.left = '-9999px';
				document.body.appendChild(textarea);
				textarea.select();
				document.execCommand('copy');
				document.body.removeChild(textarea);
			}
			this.clipboardMessage = 'Copied';
		} catch (e) {
			this.clipboardMessage = 'Copy failed';
		}
	}
	async pasteColor() {
		try {
			if (!navigator.clipboard || !navigator.clipboard.readText) throw new Error('Clipboard read is unavailable');
			const value = await navigator.clipboard.readText();
			const color = this.parseClipboardColor(value);
			if (color === undefined) throw new Error('Unsupported color');
			this.color = this.colorValue(color);
			this.lastColor = this.color;
			this.colorChange.emit(this.color);
			this.colorChangeEnd.emit(this.color);
			this.clipboardMessage = 'Pasted';
		} catch (e) {
			this.clipboardMessage = 'Paste failed';
		}
	}
	setClipboardFormat(format: ColorFormat) {
		this.clipboardFormat = format;
		this.clipboardMessage = '';
	}
	private parseClipboardColor(value: string): number | undefined {
		const text = value.trim().toLowerCase();
		if (colorNames[text]) return parseColor(colorNames[text]!);
		if (/^#?(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(text) || /^(?:rgba?)\(/.test(text)) {
			return parseColor(text);
		}
		const match = /^(hsl|hsv)(a?)\(\s*([\d.-]+)[, ]+([\d.-]+)%[, ]+([\d.-]+)%(?:[, /]+([\d.]+%?))?\s*\)$/.exec(text);
		if (!match) return undefined;
		const h = ((parseFloat(match[3]) % 360) + 360) % 360;
		const s = Math.max(0, Math.min(100, parseFloat(match[4])));
		const third = Math.max(0, Math.min(100, parseFloat(match[5])));
		const alpha = match[6] ? (match[6].endsWith('%') ? parseFloat(match[6]) / 100 : parseFloat(match[6])) : 1;
		const rgb = match[1] === 'hsv' ? colorToRGBA(colorFromHSVA(h, s / 100, third / 100, 1)) : hslToRGB(h, s, third);
		return colorFromRGBA(rgb.r, rgb.g, rgb.b, clamp(alpha, 0, 1) * 255);
	}
	private formatAlpha(alpha: number) {
		return Math.round(alpha / 255 * 100) / 100;
	}
	private colorValue(color: number) {
		return getAlpha(color) === 255 ? colorToHexRGB(color) : colorToHexRGBA(color);
	}
	stopEvent(e: Event) {
		e.stopPropagation();
		e.preventDefault();
	}
	toggleBrightness() {
		if (!this.isDisabled) {
			this.brightnessOpen = !this.brightnessOpen;
		}
	}
	open() {
		if (!this.isOpen) {
			this.isOpen = true;
			this.placementOpenUp = this.requestedOpenUp;
			this.schedulePlacement();
			window.addEventListener('resize', this.repositionHandler);
			window.addEventListener('scroll', this.repositionHandler, true);

			setTimeout(() => {
				document.addEventListener('mousedown', this.closeHandler);
				document.addEventListener('touchstart', this.closeHandler);
			});
		}
	}
	close() {
		this.isOpen = false;
		this.brightnessOpen = false;
		if (this.placementTimer) {
			clearTimeout(this.placementTimer);
			this.placementTimer = undefined;
		}
		window.removeEventListener('resize', this.repositionHandler);
		window.removeEventListener('scroll', this.repositionHandler, true);
		document.removeEventListener('mousedown', this.closeHandler);
		document.removeEventListener('touchstart', this.closeHandler);
	}
	schedulePlacement() {
		if (this.placementTimer) clearTimeout(this.placementTimer);
		this.placementTimer = setTimeout(() => this.updatePlacement(), 0);
	}
	private updatePlacement() {
		this.placementTimer = undefined;
		if (!this.isOpen || !this.menu) return;
		const host = this.element.nativeElement as HTMLElement;
		const hostRect = host.getBoundingClientRect();
		const menuRect = (this.menu.nativeElement as HTMLElement).getBoundingClientRect();
		const gap = 10;
		const spaceAbove = hostRect.top - gap;
		const spaceBelow = window.innerHeight - hostRect.bottom - gap;
		this.placementOpenUp = this.requestedOpenUp || (spaceBelow < menuRect.height && spaceAbove > spaceBelow);
	}
	ngOnDestroy() {
		this.close();
	}
	toggleOpen() {
		if (!this.isDisabled) {
			if (this.isOpen) {
				this.close();
			} else {
				this.open();
			}
		}
	}
}
