import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, HostListener, HostBinding } from '@angular/core';
import { parseColorFast, colorToCSS } from '../../../common/color';

@Component({
	selector: 'bitmap-box',
	templateUrl: 'bitmap-box.pug',
	styleUrls: ['bitmap-box.scss'],
})
export class BitmapBox implements OnChanges {
	@Input() width = 5;
	@Input() height = 5;
	@Input() bitmap?: string[];
	@Input() tool?: string;
	@Input() color = 'red';
	@Input() baseColor = 'white';
	@Input() showBackground = true;
	@HostBinding('class.bitmap-box-background')
	get hasBitmapBackground() {
		return this.showBackground;
	}
	@HostBinding('style.--bitmap-base-color')
	get bitmapBaseColor() {
		const color = parseColorFast(this.baseColor || 'ff0000');
		return colorToCSS(color || parseColorFast('ff0000'));
	}
	@Output() colorChange = new EventEmitter<string>();
	@Output() editStart = new EventEmitter<void>();
	@Output() bitmapChange = new EventEmitter<void>();
	rows?: number[][];
	dragging = false;
	private startIndex = -1;
	private editSnapshot?: string[];
	ngOnChanges(changes: SimpleChanges) {
		if (changes.width || changes.height) {
			this.rows = [];

			for (let y = 0; y < this.height; y++) {
				this.rows[y] = [];

				for (let x = 0; x < this.width; x++) {
					this.rows[y][x] = x + this.width * y;
				}
			}
		}
	}
	draw(index: number) {
		if (this.bitmap) {
			if (this.tool === 'eraser') {
				this.bitmap[index] = '';
			} else if (this.tool === 'brush') {
				this.bitmap[index] = this.color;
			} else if (this.tool === 'eyedropper') {
				this.color = this.bitmap[index];
				this.colorChange.emit(this.color);
			} else if (this.tool === 'fill') {
				this.fillRegion(index);
			}
		}
	}
	paint(index: number) {
		if (this.bitmap && this.tool === 'brush') {
			this.bitmap[index] = this.color;
		} else if (this.bitmap && this.tool === 'eraser') {
			this.bitmap[index] = '';
		}
		this.bitmapChange.emit();
	}
	startDraw(index: number) {
		this.dragging = true;
		this.startIndex = index;
		this.editSnapshot = this.bitmap ? this.bitmap.slice() : undefined;
		this.editStart.emit();
		if (this.tool === 'line' || this.tool === 'rectangle') {
			this.paintShape(index);
		} else {
			this.draw(index);
		}
	}
	dragDraw(index: number) {
		if (this.dragging) {
			if (this.tool === 'line' || this.tool === 'rectangle') this.paintShape(index);
			else this.paint(index);
		}
	}
	stopDraw() {
		if (this.dragging && this.bitmap && this.editSnapshot && this.editSnapshot.join('|') !== this.bitmap.join('|')) {
			this.bitmapChange.emit();
		}
		this.dragging = false;
		this.startIndex = -1;
		this.editSnapshot = undefined;
	}
	@HostListener('document:mouseup')
	onMouseUp() {
		this.dragging = false;
	}
	@HostListener('document:mouseleave')
	onMouseLeave() {
		this.dragging = false;
	}
	colorAt(index: number) {
		return this.bitmap && this.bitmap[index] ? colorToCSS(parseColorFast(this.bitmap[index])) : '';
	}
	private fillRegion(index: number) {
		if (!this.bitmap || !this.rows || !this.color) return;
		const target = this.bitmap[index] || '';
		if (target === this.color) return;
		const queue = [index];
		const visited: { [key: number]: boolean } = {};
		while (queue.length) {
			const current = queue.pop()!;
			if (visited[current] || (this.bitmap[current] || '') !== target) continue;
			visited[current] = true;
			this.bitmap[current] = this.color;
			const x = current % this.width;
			const y = Math.floor(current / this.width);
			if (x > 0) queue.push(current - 1);
			if (x < this.width - 1) queue.push(current + 1);
			if (y > 0) queue.push(current - this.width);
			if (y < this.height - 1) queue.push(current + this.width);
		}
	}
	private paintShape(endIndex: number) {
		if (!this.bitmap || this.startIndex < 0 || !this.editSnapshot) return;
		this.bitmap.splice(0, this.bitmap.length, ...this.editSnapshot);
		const startX = this.startIndex % this.width;
		const startY = Math.floor(this.startIndex / this.width);
		const endX = endIndex % this.width;
		const endY = Math.floor(endIndex / this.width);
		if (this.tool === 'line') {
			const steps = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));
			for (let step = 0; step <= steps; step++) {
				const x = Math.round(startX + (endX - startX) * step / Math.max(steps, 1));
				const y = Math.round(startY + (endY - startY) * step / Math.max(steps, 1));
				this.bitmap[x + y * this.width] = this.color;
			}
		} else {
			const left = Math.min(startX, endX);
			const right = Math.max(startX, endX);
			const top = Math.min(startY, endY);
			const bottom = Math.max(startY, endY);
			for (let y = top; y <= bottom; y++) {
				for (let x = left; x <= right; x++) {
					if (x === left || x === right || y === top || y === bottom) this.bitmap[x + y * this.width] = this.color;
				}
			}
		}
	}
}
