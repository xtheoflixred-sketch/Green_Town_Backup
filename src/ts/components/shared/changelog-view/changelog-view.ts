import { Component, Input, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChangelogSeasonGroup, ChangelogParsedEntry, buildSeasonGroups } from '../../../common/changelogUtils';

@Component({
	selector: 'changelog-view',
	templateUrl: 'changelog-view.pug',
	styleUrls: ['changelog-view.scss'],
})
export class ChangelogView implements OnInit, OnChanges {
	@Input() rawEntries: { version: string; changes: string[]; }[] = [];
	@Input() changelogResponse: any;

	seasonGroups: ChangelogSeasonGroup[] = [];
	showAll = false;
	revealedPrevious = 0;

	constructor(private http: HttpClient) {}

	ngOnInit() {
		// If component mounted without inputs, try fetching changelog from server
		if ((!this.rawEntries || this.rawEntries.length === 0) && !this.changelogResponse) {
			this.http.get<any>('/api2/changelog').toPromise()
				.then(res => {
					if (!res) return;
					if (res.public || res.dev) {
						const entries = [ ...(res.public || []), ...(res.dev || []) ];
						this.seasonGroups = buildSeasonGroups(entries);
					} else {
						this.seasonGroups = res as any;
					}
				})
				.catch(() => {
					// ignore errors — component will stay empty
				});
		}
	}

	ngOnChanges(changes: SimpleChanges) {
		if (changes.rawEntries) {
			this.seasonGroups = buildSeasonGroups(this.rawEntries);
			this.showAll = false;
			this.revealedPrevious = 0;
		}
		if (changes.changelogResponse && this.changelogResponse) {
			// Handle API response format: { public: [...], dev: [...] }
			if (this.changelogResponse.public || this.changelogResponse.dev) {
				const entries = [
					...(this.changelogResponse.public || []),
					...(this.changelogResponse.dev || []),
				];
				this.seasonGroups = buildSeasonGroups(entries);
			} else {
				// Already processed season groups format
				this.seasonGroups = this.changelogResponse as ChangelogSeasonGroup[];
			}
			this.showAll = false;
			this.revealedPrevious = 0;
		}
	}

	get hiddenEntries() {
		const hidden: ChangelogParsedEntry[] = [];
		for (const season of this.seasonGroups) {
			season.patches.forEach(patch => {
				if (patch.hiddenIndex !== undefined && patch.hiddenIndex >= 0) {
					hidden.push(patch);
				}
			});
		}
		return hidden;
	}

	get canShowPrevious() {
		return this.revealedPrevious < this.hiddenEntries.length;
	}

	get canShowAll() {
		return !this.showAll && this.hiddenEntries.length > 0;
	}

	showPreviousPatch() {
		if (!this.canShowPrevious) {
			return;
		}

		this.revealedPrevious += 1;
	}

	showAllPatches() {
		this.showAll = true;
	}

	isPatchVisible(patch: ChangelogParsedEntry) {
		if (patch.hiddenIndex === undefined) {
			return true;
		}

		if (this.showAll) {
			return true;
		}

		return patch.hiddenIndex < this.revealedPrevious;
	}

	getSeasonImageUrl(season: number) {
		return `/assets/images/seasonal update previews/season${season}.png`;
	}
}
