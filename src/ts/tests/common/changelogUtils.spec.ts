import '../lib';
import { expect } from 'chai';
import { getServerChangelog, mergeChangelog, isPrivilegedAccount, buildSeasonGroups } from '../../common/changelogUtils';
import { account } from '../mocks';

describe('changelogUtils', () => {
	it('preserves markdown formatting in changelog entries', () => {
		const groups = buildSeasonGroups([
			{ version: 'Season 1 — Patch 1 | Stable', changes: [
				'Added the **Imported Character** window',
				'Added `/collections` and `/col`',
			] },
		]);
		expect(groups[0].patches[0].changes[0]).to.contain('<strong>Imported Character</strong>');
		expect(groups[0].patches[0].changes[1]).to.contain('<code>/collections</code>');
		expect(groups[0].patches[0].changes[1]).to.contain('<code>/col</code>');
	});

	it('preserves H3 changelog sections', () => {
		const groups = buildSeasonGroups([
			{ version: 'Season 1 — Patch 1', changes: [
				{ title: 'Редактор персонажа', changes: ['Добавлены новые паттерны.'] },
			] },
		]);
		const section = groups[0].patches[0].changes[0];
		expect(section).to.deep.equal({
			title: 'Редактор персонажа',
			changes: ['Добавлены новые паттерны.'],
		});
	});

	it('returns only public changelog entries for anonymous account', () => {
		const response = getServerChangelog();
		const changelog = mergeChangelog(response);
		expect(changelog.every((entry: any) => !entry.dev)).true;
	});

	it('returns dev changelog entries for dev account', () => {
		const response = getServerChangelog(account({ roles: ['dev'] }));
		const changelog = mergeChangelog(response);
		expect(changelog.some((entry: any) => entry.dev)).true;
	});

	it('isPrivilegedAccount returns true for admin/mod/dev', () => {
		expect(isPrivilegedAccount(account({ roles: ['admin'] }))).true;
		expect(isPrivilegedAccount(account({ roles: ['mod'] }))).true;
		expect(isPrivilegedAccount(account({ roles: ['dev'] }))).true;
	});

	it('isPrivilegedAccount returns false for regular accounts', () => {
		expect(isPrivilegedAccount(account({ roles: ['supporter'] }))).false;
		expect(isPrivilegedAccount(undefined)).false;
	});
});
