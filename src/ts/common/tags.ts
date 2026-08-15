import { CharacterTag, FontPalettes } from './interfaces';
import { hasRole, AccountSupporter } from './accountUtils';
import { MOD_COLOR, ADMIN_COLOR, DEV_COLOR, PATREON_COLOR, ANNOUNCEMENT_COLOR, WHITE, OWNER_COLOR, CYAN, WCODE_COLOR } from './colors';
import { parseColorFast } from './color';
import {
	faUserCog,
	faCode,
	faPaintBrush,
	faVolumeUp,
	faStar,
	faEyeSlash,
	faBan,
	partyLeaderIcon,
	faHammer,
	faPlay,
	faDesktop,
	faTerminal,
	faIdBadge
} from '../client/icons';

const placeholder = { id: '', tagClass: '', label: '', icon: undefined };
const tags: { [key: string]: CharacterTag; } = {
	'owner': { ...placeholder, name: 'server owner', className: 'owner', color: OWNER_COLOR, icon: partyLeaderIcon },
	'admin': { ...placeholder, name: 'admin', className: 'admin', color: ADMIN_COLOR, icon: faIdBadge },
	'dev': { ...placeholder, name: 'developer', className: 'dev', color: DEV_COLOR, icon: faCode },
	'dev:prog': { ...placeholder, name: 'dev programmer', className: 'dev', color: DEV_COLOR, icon: faCode },
	'dev:animate': { ...placeholder, name: 'dev animator', className: 'dev', color: DEV_COLOR, icon: faPlay },
	'dev:art': { ...placeholder, name: 'dev artist', className: 'dev', color: DEV_COLOR, icon: faPaintBrush },
	'dev:design': { ...placeholder, name: 'dev designer', className: 'dev', color: DEV_COLOR, icon: faDesktop },
	'dev:music': { ...placeholder, name: 'dev musician', className: 'dev', color: DEV_COLOR, icon: faVolumeUp },
	'mod': { ...placeholder, name: 'moderator', className: 'mod', color: MOD_COLOR, icon: faUserCog },
	'wcode': { ...placeholder, name: 'wibe coder', className: 'wcode', color: WCODE_COLOR, icon: faTerminal },
	'builder': { ...placeholder, name: 'map builder', className: 'builder', color: CYAN, icon: faHammer },
	'npc': { ...placeholder, name: 'npc', className: 'npc', color: ANNOUNCEMENT_COLOR, icon: faUserCog },
	'sup1': { ...placeholder, name: 'supporter', className: 'sup1', color: PATREON_COLOR, icon: faStar },
	'sup2': { ...placeholder, name: 'supporter', className: 'sup2', color: WHITE, icon: faStar },
	'sup3': { ...placeholder, name: 'supporter', className: 'sup3', color: WHITE, icon: faStar },
	'sup4': { ...placeholder, name: 'supporter', className: 'sup4', color: WHITE, icon: faStar },
	'hidden': { ...placeholder, name: 'hidden', className: 'hidden', color: ANNOUNCEMENT_COLOR, icon: faEyeSlash },
};

Object.keys(tags).forEach(id => {
	const tag = tags[id];
	tag.id = id;
	tag.label = `<${tag.name.toUpperCase()}>`;
	tag.tagClass = `tag-${tag.className}`;
});

export const emptyTag: CharacterTag = { id: '', name: 'no tag', label: '', className: '', tagClass: '', color: 0, icon: faBan };

export function getAllTags() {
	return Object.keys(tags).map(key => tags[key]);
}

export function getTag(id: string | undefined, customColor?: string | number): CharacterTag | undefined {
	if (!id) return undefined;
	const tag = tags[id];
	if (!tag || !customColor) return tag;
	
	// Apply custom color override while preserving all other tag properties
	const color = typeof customColor === 'string' ? parseColorFast(customColor) : customColor;
	return { ...tag, color };
}

export function getTagTooltipById(id: string | undefined): string | undefined {
	if (!id) return undefined;
	const supporter = /^sup([1-4])$/.exec(id);
	if (supporter) {
		return `supporter tier ${supporter[1]}`;
	}
	const tag = getTag(id);
	return tag ? tag.name : id;
}

export function getTagTooltip(tag: CharacterTag | undefined): string | undefined {
	return getTagTooltipById(tag && tag.id);
}

export function getTagPalette(tag: CharacterTag, palettes: FontPalettes) {
	switch (tag.id) {
		case 'sup2': return palettes.supporter2;
		case 'sup3': return palettes.supporter3;
		case 'sup4': return palettes.supporter4;
		case 'owner': return palettes.owner;
		default: return palettes.white;
	}
}

export function canUseTag(account: AccountSupporter | undefined, tag: string) {
	const supporter = /^sup([1-4])$/.exec(tag);
	if (supporter) {
		return ((account && account.supporter) || 0) >= Number(supporter[1]);
	} else if (tag === 'owner') {
		return hasRole(account, 'owner');
	} else if (tag === 'mod') {
		return hasRole(account, 'mod');
	} else if (tag === 'dev' || /^dev:/.test(tag)) {
		return hasRole(account, 'dev');
	} else if (tag === 'admin' || tag === 'adminis') {
		return hasRole(account, 'admin');
	} else if (tag === 'wcode') {
		return hasRole(account, 'wcode');
	} else if (tag === 'builder') {
		return hasRole(account, 'builder');
	} else if (tag === 'npc') {
		return hasRole(account, 'npc');
	} else {
		return false;
	}
}

export function getAvailableTags(account: AccountSupporter | undefined): CharacterTag[] {
	return getAllTags().filter(tag => canUseTag(account, tag.id));
}
