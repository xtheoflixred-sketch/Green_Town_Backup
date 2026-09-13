import { Component, Input, OnDestroy } from '@angular/core';
import { Subscription } from '../../../../common/interfaces';
import { AdminModel } from '../../../services/adminModel';
import { faTrash, faArrowRight, faCopy, faDownload } from '../../../../client/icons';
import { Character, PonyIdDateName, DuplicateResult } from '../../../../common/adminInterfaces';

@Component({
	selector: 'pony-list-remote',
	templateUrl: 'pony-list-remote.pug',
	styleUrls: ['pony-list-remote.scss'],
})
export class PonyListRemote implements OnDestroy {
	readonly trashIcon = faTrash;
	readonly assignIcon = faArrowRight;
	readonly duplicateIcon = faCopy;
	readonly exportIcon = faDownload;
	@Input() limit = 10;
	@Input() expanded = false;
	@Input() deletable = false;
	@Input() highlight: (pony: Character) => boolean = () => false;
	@Input() duplicates?: DuplicateResult[];
	@Input() manageDetails = false;
	full = false;
	ponies: string[] = [];
	loading = false;
	private ponyInfos: PonyIdDateName[] = [];
	private _accountId?: string;
	private subscription?: Subscription;
	constructor(private model: AdminModel) {
	}
	get limitTo() {
		return this.full ? 999999 : this.limit;
	}
	get accountId() {
		return this._accountId;
	}
	@Input() set accountId(value: string | undefined) {
		if (this.accountId !== value) {
			this._accountId = value;
			this.ponies = [];
			this.ponyInfos = [];
			this.loading = true;
			this.subscription && this.subscription.unsubscribe();
			this.subscription = value ? this.model.accountPonies.subscribe(value, (x = []) => {
				this.ponyInfos = x;
				this.updatePonies();
				this.loading = false;
			}) : undefined;
		}
	}
	ngOnDestroy() {
		this.subscription && this.subscription.unsubscribe();
	}
	remove(characterId: string) {
		if (confirm('Are you sure?')) {
			this.model.removePony(characterId);
		}
	}
	toggleFull() {
		this.full = !this.full;
		this.updatePonies();
	}
	assignTo(pony: string, account: string) {
		this.model.assignPony(pony, account);
	}
	duplicate(characterId: string) {
		if (!this._accountId || !confirm('Duplicate this character into the account?')) return;
		this.model.getPony(characterId).then(pony => {
			if (pony && pony.info) this.model.createPony(this._accountId!, `${pony.name} copy`, pony.info);
		});
	}
	export(characterId: string) {
		this.model.getPony(characterId).then(pony => {
			if (!pony || !pony.info) return;
			const blob = new Blob([pony.info], { type: 'text/plain;charset=utf-8' });
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = `${pony.name || 'pony'}.pony.txt`;
			link.click();
			URL.revokeObjectURL(link.href);
		});
	}
	private updatePonies() {
		const compare = this.full ? compareNames : compareDates;
		this.ponies = this.ponyInfos.sort(compare).map(p => p.id);
	}
}

export function compareNames(a: { name: string }, b: { name: string }) {
	return a.name.localeCompare(b.name);
}

export function compareDates(a: { date: number }, b: { date: number }) {
	return b.date - a.date;
}
