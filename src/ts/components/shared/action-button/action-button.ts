import { Component, Input, ViewChild, ElementRef, Output, EventEmitter, HostBinding, NgZone } from '@angular/core';
import { ButtonAction } from '../../../common/interfaces';
import { PonyTownGame, actionButtons } from '../../../client/game';
import { drawAction, adjustHeldItemOffsetSilent, isActionAvailable } from '../../../client/buttonActions';
import { removeItem } from '../../../common/utils';

const HOLD_MOVE_INTERVAL = 200;

function isHoldAction(action: ButtonAction | undefined): boolean {
	return !!action && action.type === 'action' && typeof action.action === 'string' && action.action.startsWith('hold-');
}

function getHoldDelta(action: string): [number, number] {
	switch (action) {
		case 'hold-right': return [1, 0];
		case 'hold-left': return [-1, 0];
		case 'hold-down': return [0, 1];
		case 'hold-up': return [0, -1];
		default: return [0, 0];
	}
}

@Component({
	selector: 'action-button',
	templateUrl: 'action-button.pug',
	styleUrls: ['action-button.scss'],
	host: {
		'[class.empty]': '!editable && !action',
	},
})
export class ActionButton {
	@Input() action?: ButtonAction;
	@Input() editable = false;
	@Input() active = false;
	@Input() shadow = true;
	@Input() shortcut = '';
	@Input() tooltipText = '';
	@Input() tooltipPlacement = 'top';
	@Input() tooltipClass = '';
	@Input() zoomClass = '';
	@Input() rare = false;
	@HostBinding('class.rare-item') get isRareItem() { return this.rare; }
	get isAvailable() { return isActionAvailable(this.game, this.action); }
	@HostBinding('class.disabled') get isDisabled() { return !this.isAvailable; }
	get isModStyled() {
		if (!this.game.mod || !this.action || this.action.type !== 'action') return false;
		const action = this.action.action;
		return action === 'switch-tool' || action.startsWith('switch-') || action.startsWith('tile-') ||
			action.startsWith('wall-') || action.startsWith('editor-') || action.startsWith('house-');
	}
	@Output() use = new EventEmitter<ButtonAction>();
	@ViewChild('canvas', { static: true }) canvas!: ElementRef;
	dirty = true;
	private state: any = {};
	private holdInterval: any = 0;
	private heldDown = false;
	private boundStopHold: () => void;
	constructor(private game: PonyTownGame, private zone: NgZone) {
		this.boundStopHold = this.stopHold.bind(this);
	}
	ngOnInit() {
		actionButtons.push(this);
		document.addEventListener('mouseup', this.boundStopHold);
		document.addEventListener('touchend', this.boundStopHold);
		document.addEventListener('touchcancel', this.boundStopHold);
	}
	ngOnDestroy() {
		this.stopHold();
		document.removeEventListener('mouseup', this.boundStopHold);
		document.removeEventListener('touchend', this.boundStopHold);
		document.removeEventListener('touchcancel', this.boundStopHold);
		removeItem(actionButtons, this);
	}
	ngOnChanges() {
		this.dirty = true;
	}
	click() {
		if (!this.heldDown && this.action && isActionAvailable(this.game, this.action)) {
			this.use.emit(this.action);
		}
		this.heldDown = false;
	}
	onPointerDown(e: MouseEvent | TouchEvent) {
		if (!this.action || !isHoldAction(this.action)) {
			return;
		}

		const actionName = (this.action as any).action as string;
		const [dx, dy] = getHoldDelta(actionName);

		if (dx === 0 && dy === 0) {
			return;
		}

		e.preventDefault();

		this.heldDown = true;

		// initial move with chat bubble
		this.use.emit(this.action);

		this.stopHold();

		this.zone.runOutsideAngular(() => {
			this.holdInterval = setInterval(() => {
				adjustHeldItemOffsetSilent(this.game, dx, dy);
			}, HOLD_MOVE_INTERVAL);
		});
	}
	private stopHold() {
		if (this.holdInterval) {
			clearInterval(this.holdInterval);
			this.holdInterval = 0;
		}
	}
	draw() {
		drawAction(this.canvas.nativeElement, this.action, this.state, this.game);
		this.dirty = false;
	}
}
