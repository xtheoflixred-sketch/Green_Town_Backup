import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

@Component({
	selector: 'on-off-switch',
	templateUrl: 'on-off-switch.pug',
	styleUrls: ['on-off-switch.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnOffSwitch {
	@Input() on = false;
	@Input() disabled = false;
	@Input() label = '';
	@Output() toggle = new EventEmitter<boolean>();

	onToggle(value: boolean) {
		if (value !== this.on && !this.disabled) {
			this.toggle.emit(value);
		}
	}
}
