import { Component, EventEmitter, Output } from '@angular/core';
import { faHammer, faUpload, faDownload, faTrash, faRedo } from '../../../client/icons';
import { ChatType } from '../../../common/interfaces';
import { PonyTownGame } from '../../../client/game';

@Component({
	selector: 'builder-tools-modal',
	templateUrl: 'builder-tools-modal.pug',
	styleUrls: ['builder-tools-modal.scss'],
})
export class BuilderToolsModal {
	@Output() close = new EventEmitter<void>();
	readonly hammerIcon = faHammer;
	readonly saveIcon = faUpload;
	readonly loadIcon = faDownload;
	readonly clearIcon = faTrash;
	readonly resetIcon = faRedo;
	fileName = 'builder-save';

	constructor(private game: PonyTownGame) {}

	private sendCommand(command: string, value?: string) {
		const message = value ? `${command} ${value}` : command;
		this.game.send(server => server.say(0, message, ChatType.Say));
	}

	savePlacedEntities() {
		this.sendCommand('/saveplacedentities', this.fileName);
		this.close.emit();
	}

	loadEntities() {
		this.sendCommand('/loadentities', this.fileName);
		this.close.emit();
	}

	clearEntities() {
		this.sendCommand('/clearentities');
		this.close.emit();
	}

	resetEntities() {
		this.sendCommand('/resetentities');
		this.close.emit();
	}

	saveTiles() {
		this.sendCommand('/savetiles', this.fileName);
		this.close.emit();
	}

	loadTiles() {
		this.sendCommand('/loadtiles', this.fileName);
		this.close.emit();
	}

	toggleMinimap() {
		this.game.debugToggleMinimap();
		this.close.emit();
	}

	onClose() {
		this.close.emit();
	}
}
