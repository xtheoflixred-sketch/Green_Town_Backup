import { Component, Input, Output, EventEmitter } from '@angular/core';
import { PonyInfo } from '../../../common/interfaces';
import { faSave, faRetweet, faInfoCircle } from '../../../client/icons';

@Component({
	selector: 'unsaved-character-modal',
	templateUrl: 'unsaved-character-modal.pug',
	styleUrls: ['unsaved-character-modal.scss'],
})
export class UnsavedCharacterModal {
	@Input() title = 'Your character has unsaved changes.';
	@Input() prompt = 'Would you like to save your changes or discard them for the original from the server?';
	@Input() saveLabel = 'Save changes';
	@Input() discardLabel = 'Discard changes';
	@Input() ponyName?: string;
	@Input() currentPony?: PonyInfo;
	@Input() storedPony?: PonyInfo;
	@Output() save = new EventEmitter<void>();
	@Output() discard = new EventEmitter<void>();
	@Output() cancel = new EventEmitter<void>();

	readonly saveIcon = faSave;
	readonly discardIcon = faRetweet;
	readonly infoIcon = faInfoCircle;

	confirmSave() {
		this.save.emit();
	}

	confirmDiscard() {
		this.discard.emit();
	}

	close() {
		this.cancel.emit();
	}
}
