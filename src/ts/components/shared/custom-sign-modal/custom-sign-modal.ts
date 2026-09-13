import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
	selector: 'custom-sign-modal',
	templateUrl: 'custom-sign-modal.pug',
})
export class CustomSignModal {
	@Input() name = '';
	@Input() message = '';
	@Output() cancel = new EventEmitter<void>();
	@Output() save = new EventEmitter<{ name: string; message: string }>();

	saveSign() {
		this.save.emit({
			name: this.name.substring(0, 60),
			message: this.message.substring(0, 500),
		});
	}
}
