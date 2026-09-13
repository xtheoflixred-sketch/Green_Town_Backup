import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { decodePonyInfo } from '../../../common/compressPony';
import { mockPaletteManager, toPalette } from '../../../common/ponyInfo';
import { getConfiguredDefaultPony } from '../../../client/defaultPonyClient';
import { faEllipsisV } from '../../../client/icons';

export interface TeleportPlayer {
	id: string;
	accountName: string;
	name: string;
	ponyInfo?: string;
}

@Component({
	selector: 'teleport-modal',
	templateUrl: 'teleport-modal.pug',
	styleUrls: ['teleport-modal.scss'],
})
export class TeleportModal implements OnInit {
	@Output() close = new EventEmitter<void>();
	readonly ellipsisIcon = faEllipsisV;
	players: TeleportPlayer[] = [];
	filteredPlayers: TeleportPlayer[] = [];
	selectedIds: string[] = [];
	targetId: string | undefined;
	selectAll = false;
	search = '';
	loading = false;
	error = '';

	constructor(private http: HttpClient) {}

	ngOnInit() {
		this.loadPlayers();
	}

	loadPlayers() {
		this.loading = true;
		this.error = '';
		this.http.get<TeleportPlayer[]>('/api2/mod/teleport-players').subscribe(
			players => {
				this.players = players;
				this.updatePlayers();
				this.loading = false;
			},
			() => {
				this.error = 'Could not load players';
				this.loading = false;
			},
		);
	}

	updatePlayers() {
		const query = this.search.trim().toLowerCase();
		this.filteredPlayers = this.players.filter(player =>
			!query || player.name.toLowerCase().includes(query) || player.accountName.toLowerCase().includes(query) || player.id.toLowerCase().includes(query));
	}

	getPony(player: TeleportPlayer) {
		if (player.ponyInfo) {
			return decodePonyInfo(player.ponyInfo, mockPaletteManager);
		}
		return toPalette(getConfiguredDefaultPony());
	}

	select(id: string) {
		if (this.selectAll) {
			this.selectAll = false;
			this.selectedIds = this.players.filter(player => player.id !== id).map(player => player.id);
			return;
		}
		if (this.selectedIds.indexOf(id) === -1) {
			this.selectedIds = this.selectedIds.concat(id);
		} else {
			this.selectedIds = this.selectedIds.filter(selectedId => selectedId !== id);
		}
	}

	setTarget(id: string) {
		this.targetId = this.targetId === id ? undefined : id;
	}

	setSelectAll(value: boolean) {
		this.selectAll = value;
		if (value) {
			this.selectedIds = this.players.map(player => player.id);
		} else {
			this.selectedIds = [];
		}
	}

	isSelected(id: string) {
		return this.selectAll || this.selectedIds.indexOf(id) !== -1;
	}

	get canTeleportTo() {
		return !this.loading && !!this.targetId;
	}

	get canTeleportHere() {
		return !this.loading && (this.selectAll || this.selectedIds.length > 0 || !!this.targetId);
	}

	teleport(action: 'self' | 'bring' | 'players-to-target' | 'group', playerIds: string[] = this.selectedIds, targetId = this.targetId, selectAll = this.selectAll) {
		if (this.loading) return;
		this.loading = true;
		this.error = '';
		this.http.post('/api2/mod/teleport-players', {
			action,
			targetId,
			playerIds,
			selectAll,
		}).subscribe(
			() => {
				this.loading = false;
				this.close.emit();
			},
			() => {
				this.error = 'The player is no longer online';
				this.loading = false;
			},
		);
	}

	onClose() {
		this.close.emit();
	}
}
