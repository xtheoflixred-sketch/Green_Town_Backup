import { Component, Input, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChangelogChange, ChangelogSeasonGroup, ChangelogParsedEntry, buildSeasonGroups } from '../../../common/changelogUtils';

@Component({
	selector: 'changelog-view',
	templateUrl: 'changelog-view.pug',
	styleUrls: ['changelog-view.scss'],
})
export class ChangelogView implements OnInit, OnChanges {
	@Input() rawEntries: { version: string; changes: ChangelogChange[]; }[] = [];
	@Input() changelogResponse: any;
	@Input() isDev = false;

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

	isChangelogSection(change: ChangelogChange): change is { title: string; changes: string[] } {
		return typeof change !== 'string';
	}

	getSeasonImageUrl(season: number) {
		const folder = this.isDev ? 'dev_update_previews' : 'update_previews';
		return `/assets/images/${folder}/season${season}.png`;
	}

	isFirstVisibleWithContent(seasonIndex: number, patchIndex: number) {
		const season = this.seasonGroups[seasonIndex];
		if (!season) return false;
		const patch = season.patches[patchIndex];
		if (!patch) return false;
		// patch must be visible and have at least one change
		if (!this.isPatchVisible(patch) || !patch.changes || patch.changes.length === 0) return false;

		// ensure no earlier patch in the same season is visible with content
		for (let i = 0; i < patchIndex; i++) {
			const p = season.patches[i];
			if (p && this.isPatchVisible(p) && p.changes && p.changes.length > 0) return false;
		}

		return true;
	}

	// Returns true if the provided (seasonIndex, patchIndex) is the first visible patch
	// in the rendered order (scans seasonGroups from start to the given indices).
	isFirstVisiblePatch(seasonIndex: number, patchIndex: number) {
		for (let s = 0; s < this.seasonGroups.length; s++) {
			const season = this.seasonGroups[s];
			for (let p = 0; p < season.patches.length; p++) {
				const patch = season.patches[p];
				if (this.isPatchVisible(patch)) {
					return s === seasonIndex && p === patchIndex;
				}
			}
		}
		return false;
	}
}
