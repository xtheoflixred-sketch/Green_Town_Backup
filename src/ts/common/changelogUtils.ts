import { CHANGELOG_PUBLIC, CHANGELOG_DEV } from '../generated/changelog';
import { AccountRoles, hasRole, isAdmin, isDev, isMod } from './accountUtils';

export interface ChangelogRawEntry {
	version: string;
	changes: string[];
}

export interface ChangelogParsedEntry extends ChangelogRawEntry {
	season: number;
	patch: number;
	status?: string;
	shortVersion: string;
	extraTitle: string;
	hiddenIndex?: number;
}

export interface ChangelogSeasonGroup {
	season: number;
	patches: ChangelogParsedEntry[];
}

export interface ChangelogResponse {
	public: ChangelogRawEntry[];
	dev: ChangelogRawEntry[];
}

const VERSION_REGEX = /^\s*Season\s+(\d+)\s*[—-]\s*Patch\s+(\d+)(?:\s*\|\s*(.+))?/i;

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

export function markdownToHtml(value: string): string {
	const raw = (value || '').trim();
	if (!raw) return '';
	if (/<\/?[a-z][\s\S]*>/i.test(raw)) return raw;

	let html = escapeHtml(raw);
	html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
	html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
	html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
	html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
	html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+|\/[^)]+)\)/g,
		'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

	return html;
}

export function parseChangelogVersion(version: string): {
	season: number;
	patch: number;
	status?: string;
	shortVersion: string;
	extraTitle: string;
} {
	const match = VERSION_REGEX.exec(version);

	if (match) {
		const season = Number(match[1]);
		const patch = Number(match[2]);
		const status = match[3] ? match[3].trim() : undefined;
		const shortVersion = `S${season}-P${patch}`;
		const extraTitle = `Season ${season} — Patch ${patch}${status ? ` | ${status}` : ''}`;

		return { season, patch, status, shortVersion, extraTitle };
	}

	// fallback for unstructured entries
	return {
		season: 0,
		patch: 0,
		shortVersion: 'S0-P0',
		extraTitle: version,
	};
}

export function isPrivilegedAccount(account?: AccountRoles | undefined): boolean {
	return !!account && (isAdmin(account as any) || isMod(account as any) || isDev(account as any));
}

export function isDevChangelogVisible(account?: AccountRoles | undefined): boolean {
	return !!account && (hasRole(account, 'builder') || isAdmin(account) || isMod(account) || isDev(account));
}

export function getServerChangelog(account?: AccountRoles | undefined): ChangelogResponse {
	const allowDev = isDevChangelogVisible(account);
	return {
		public: CHANGELOG_PUBLIC,
		dev: allowDev ? CHANGELOG_DEV : [],
	};
}

export function mergeChangelog(r: ChangelogResponse): ChangelogRawEntry[] {
	return [...r.public, ...r.dev];
}

export function buildSeasonGroups(entries: ChangelogRawEntry[]): ChangelogSeasonGroup[] {
	const parsed = entries.map(e => ({
		...e,
		changes: (e.changes || []).map(change => markdownToHtml(change)),
		...parseChangelogVersion(e.version),
	}));
	const sorted = parsed.sort((a, b) => {
		if (b.season !== a.season) return b.season - a.season;
		if (b.patch !== a.patch) return b.patch - a.patch;
		return 0;
	});

	const resultMap = new Map<number, ChangelogParsedEntry[]>();
	for (const entry of sorted) {
		if (!resultMap.has(entry.season)) {
			resultMap.set(entry.season, []);
		}
		resultMap.get(entry.season)!.push(entry);
	}

	let hiddenCounter = 0;

	// Only show the latest patch per season by default. Older patches are hidden
	// and revealed with the "show previous" control. Also hide patches that
	// have no changes (empty list) to avoid rendering empty headings.
	const VISIBLE_PER_SEASON = 1;

	for (const season of Array.from(resultMap.values())) {
		for (let i = 0; i < season.length; i++) {
			const patch = season[i];
			const hasChanges = !!(patch.changes && patch.changes.length > 0);

			if (i >= VISIBLE_PER_SEASON || !hasChanges) {
				season[i].hiddenIndex = hiddenCounter++;
			}
		}
	}

	return Array.from(resultMap.entries()).map(([season, patches]) => ({ season, patches }));
}

