import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { faTimes, faPlay } from '../../../client/icons';
import { setFlag } from '../../../common/utils';
import { Action, EntityPlayerState } from '../../../common/interfaces';
import { Character } from '../../app/character/character';
import { GameService } from '../../services/gameService';
import { Model } from '../../services/model';
import { StorageService } from '../../services/storageService';
import { BsModalService } from 'ngx-bootstrap/modal';

@Component({
	selector: 'game-character-modal',
	templateUrl: 'game-character.pug',
	styleUrls: ['game-character.scss'],
	encapsulation: ViewEncapsulation.None,
})
export class GameCharacterModal extends Character implements OnInit, OnDestroy {
	readonly closeIcon = faTimes;
	readonly playIcon = faPlay;

	@Input() modalRef?: BsModalRef;
	@Output() play = new EventEmitter<void>();

	constructor(gameService: GameService, model: Model, storage: StorageService, modalService: BsModalService) {
		super(gameService, model, storage, modalService);
	}

	get playing() {
		return false;
	}

	private setEditingFlag(flag: boolean) {
		const player = (window as any).game && (window as any).game.player;
		if (player) {
			player.options = player.options || {};
			player.options.editingCharacter = flag;
			player.editingCharacter = flag;
			player.playerState = setFlag(player.playerState, EntityPlayerState.EditingCharacter, flag);
			var game = (window as any).game;
			if (game && typeof game.send === 'function') {
				game.send((server: any) => server.actionParam(Action.EditingCharacter, flag));
				// При открытии Game-Character сбросить modal статус на сервере для полной аналогии с папкой
				if (flag) {
					game.send((server: any) => server.actionParam(Action.ModalState, false));
				}
			}
			if (flag) {
				player.inModal = false;
				player.modal = false;
				player.options.modal = false;
			}
		}
	}

	ngOnInit() {
		this.setEditingFlag(true);
		return super.ngOnInit();
	}

	ngOnDestroy() {
		this.setEditingFlag(false);
		super.ngOnDestroy();
	}

	close() {
		if (this.modalRef) {
			this.modalRef.hide();
		}
	}

	onPlay() {
		this.play.emit();
	}
}
