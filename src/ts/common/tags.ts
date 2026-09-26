import { CharacterTag, FontPalettes, TagGradientDirection, MessageType } from './interfaces';
import { hasRole, AccountSupporter } from './accountUtils';
import { MOD_COLOR, ADMIN_COLOR, DEV_COLOR, PATREON_COLOR, ANNOUNCEMENT_COLOR, WHITE, OWNER_COLOR, WCODE_COLOR, LIGHT_GRAY } from './colors';
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
	'builder': { ...placeholder, name: 'map builder', className: 'builder', color: LIGHT_GRAY, icon: faHammer },
	'npc': { ...placeholder, name: 'npc', className: 'npc', color: ANNOUNCEMENT_COLOR, icon: faUserCog },
	'sup1': { ...placeholder, name: 'supporter', className: 'sup1', color: PATREON_COLOR, icon: faStar },
	'sup2': { ...placeholder, name: 'supporter', className: 'sup2', color: WHITE, icon: faStar },
	'sup3': { ...placeholder, name: 'supporter', className: 'sup3', color: WHITE, icon: faStar },
	'sup4': { ...placeholder, name: 'supporter', className: 'sup4', color: WHITE, icon: faStar },
	'hidden': { ...placeholder, name: 'hidden', className: 'hidden', color: ANNOUNCEMENT_COLOR, icon: faEyeSlash },
};

const russianTagTranslations: { [key: string]: string } = {
	owner: 'владелец сервера',
	admin: 'администратор',
	dev: 'разработчик',
	'dev:prog': 'программист',
	'dev:animate': 'аниматор',
	'dev:art': 'художник',
	'dev:design': 'дизайнер',
	'dev:music': 'музыкант',
	mod: 'модератор',
	wcode: 'вайб-кодер',
	builder: 'строитель карт',
	npc: 'НПС',
	sup1: 'поддержавший',
	sup2: 'поддержавший',
	sup3: 'поддержавший',
	sup4: 'поддержавший',
	hidden: 'скрыт',
};

export interface TagGradient {
	start: string;
	end: string;
	direction?: TagGradientDirection;
}

const tagGradients: { [key: string]: TagGradient } = {
	sup1: { start: 'f86754', end: 'd94b36', direction: 'vertical' },
	owner: { start: 'ff9999', end: 'cc0000' },
	admin: { start: 'ff0000', end: 'cc0000' },
	wcode: { start: 'ff4242', end: 'cc0000' },
	builder: { start: '8a8a8a', end: '5a5a5a' },
	npc: { start: 'f0e68c', end: 'b8ab2a' },
	sup2: { start: 'ffcd99', end: 'c77305', direction: 'vertical' },
	sup3: { start: 'fffda4', end: 'fdbb0b', direction: 'vertical' },
	sup4: { start: 'b8f2c8', end: '196f3d', direction: 'vertical' },
};

Object.keys(tags).forEach(id => {
	const tag = tags[id];
	tag.id = id;
	tag.label = `<${tag.name.toUpperCase()}>`;
	tag.tagClass = `tag-${tag.className}`;
});

export const emptyTag: CharacterTag = { id: '', name: 'no tag', label: '', className: '', tagClass: '', color: 0, icon: faBan };

export function getTagTranslation(id: string | undefined): string | undefined {
	return id ? russianTagTranslations[id] : undefined;
}

export function getTagGradient(id: string | undefined): TagGradient | undefined {
	return id ? tagGradients[id] : undefined;
}

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

export function getChatColorOverride(entity: {
	messageColor?: string;
	tag?: string;
	tagRole?: string;
	tagColor?: string;
	tagGradientStart?: string;
} | undefined, type: MessageType): string | undefined {
	if (!entity) return undefined;
	if (entity.messageColor) return entity.messageColor;
	if (type === MessageType.Chat) {
		return entity.tagColor || entity.tagGradientStart || undefined;
	}
	return undefined;
}

export function getChatGradientOverride(entity: { messageColor?: string; tag?: string; tagRole?: string; tagGradientStart?: string; tagGradientEnd?: string; tagGradientDirection?: TagGradientDirection; } | undefined, type: MessageType): TagGradient | undefined {
	if (!entity) return undefined;
	if (entity.messageColor) return undefined;

	if (type !== MessageType.Chat) return undefined;

	const tagId = entity.tagRole || entity.tag;
	const builtInGradient = getTagGradient(tagId);
	const start = entity.tagGradientStart || (builtInGradient && builtInGradient.start);
	const end = entity.tagGradientEnd || (builtInGradient && builtInGradient.end);
	const direction = entity.tagGradientDirection || (builtInGradient && builtInGradient.direction) || 'horizontal';

	if (!start || !end) return undefined;
	return { start, end, direction };
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
		case 'sup1': return palettes.supporter1;
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
