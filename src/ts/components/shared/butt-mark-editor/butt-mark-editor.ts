import { Component, Input, ElementRef, ViewChild } from '@angular/core';
import { fill } from 'lodash';
import { PonyInfo } from '../../../common/interfaces';
import { CM_SIZE } from '../../../common/constants';
import { faTrash, faEraser, faPaintBrush, faEyeDropper, faUndo, faRedo, faSlash, faFillDrip } from '../../../client/icons';

export interface ButtMarkEditorState {
	brushType: string;
	brush: string;
}

@Component({
	selector: 'butt-mark-editor',
	templateUrl: 'butt-mark-editor.pug',
	styleUrls: ['butt-mark-editor.scss'],
})
export class ButtMarkEditor {
	readonly trashIcon = faTrash;
	readonly eraserIcon = faEraser;
	readonly eyeDropperIcon = faEyeDropper;
	readonly paintBrushIcon = faPaintBrush;
	readonly undoIcon = faUndo;
	readonly redoIcon = faRedo;
	readonly lineIcon = faSlash;
	readonly fillIcon = faFillDrip;
	readonly cmSize = CM_SIZE;
	@ViewChild('bitmapBox', { read: ElementRef, static: false }) bitmapBox?: ElementRef;
	@Input() info!: PonyInfo;
	@Input() state = {
		brushType: 'brush',
		brush: 'orange',
	};
	showColoredBackground = true;
	toolCursorVisible = false;
	toolCursorX = 0;
	toolCursorY = 0;
	private lastPaintTool = 'brush';
	private undoStack: string[][] = [];
	private redoStack: string[][] = [];
	private editSnapshot?: string[];
	get canUndo() { return this.undoStack.length > 0; }
	get canRedo() { return this.redoStack.length > 0; }
	startEdit() {
		this.editSnapshot = this.info.cm ? this.info.cm.slice() : undefined;
	}
	finishEdit() {
		if (!this.info.cm || !this.editSnapshot || this.editSnapshot.join('|') === this.info.cm.join('|')) return;
		this.undoStack.push(this.editSnapshot);
		this.redoStack = [];
		this.editSnapshot = undefined;
	}
	clearCM() {
		if (this.info.cm) this.undoStack.push(this.info.cm.slice());
		fill(this.info.cm!, '');
		this.redoStack = [];
	}
	undo() {
		if (!this.info.cm || !this.canUndo) return;
		this.redoStack.push(this.info.cm.slice());
		this.info.cm.splice(0, this.info.cm.length, ...this.undoStack.pop()!);
	}
	redo() {
		if (!this.info.cm || !this.canRedo) return;
		this.undoStack.push(this.info.cm.slice());
		this.info.cm.splice(0, this.info.cm.length, ...this.redoStack.pop()!);
	}
	rememberTool(tool: string) {
		if (tool !== 'eyedropper' && tool !== 'eraser') this.lastPaintTool = tool;
	}
	pickedColor(color: string) {
		this.state.brush = color;
		if (this.state.brushType === 'eyedropper') this.state.brushType = this.lastPaintTool;
	}
	get toolIcon() {
		switch (this.state.brushType) {
			case 'eraser': return this.eraserIcon;
			case 'eyedropper': return this.eyeDropperIcon;
			case 'fill': return this.fillIcon;
			case 'line': return this.lineIcon;
			default: return this.paintBrushIcon;
		}
	}
	get isRectangleTool() {
		return this.state.brushType === 'rectangle';
	}
	updateToolCursor(event: MouseEvent) {
		if (!this.bitmapBox) return;
		const host = this.bitmapBox.nativeElement as HTMLElement;
		const rect = host.getBoundingClientRect();
		const padding = 32;
		if (event.clientX < rect.left - padding || event.clientX > rect.right + padding || event.clientY < rect.top - padding || event.clientY > rect.bottom + padding) {
			this.toolCursorVisible = false;
			return;
		}
		const wrapper = (event.currentTarget as HTMLElement).getBoundingClientRect();
		this.toolCursorX = event.clientX - wrapper.left;
		this.toolCursorY = event.clientY - wrapper.top;
		this.toolCursorVisible = true;
	}
	hideToolCursor() {
		this.toolCursorVisible = false;
	}
}
