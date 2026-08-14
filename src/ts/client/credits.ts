import { partyLeaderIcon, faStar, faUserCog, faCode, faPaintBrush, faDesktop, faIdBadge, faTiktok, faMusic, faTerminal, faHammer } from './icons';

export interface Badge {
	id: string;
	label: string;
	color: string;
	icon?: any; // FontAwesome icon or other icon data
}

export interface Credit {
	name: string;
	badges: Badge[];
	avatarSkin?: string;
	avatarBgColor?: string;
	links: string[];
}


export interface Creative {
	name: string;
	badges: Badge[];
	avatarSkin?: string;
	avatarBgColor?: string;
	links: string[];
}

export interface Mainconstructors {
	name: string;
	badges: Badge[];
	avatarSkin?: string;
	avatarBgColor?: string;
	links: string[];
}

export interface Mod {
	name: string;
	badges: Badge[];
	avatarSkin?: string;
	avatarBgColor?: string;
	links: string[];
}

export interface Contributor {
	name: string;
	links?: string[];
}

export interface Contributors {
	group: string;
	contributors: Contributor[];
}

// Пример заранее заданных бейджиков с иконками
const BADGES = {
	owner: {
		id: 'owner',
		label: 'Owner',
		color: '#d32f2f',
		icon: partyLeaderIcon,
	},
	admin: {
		id: 'admin',
		label: 'Administrator',
		color: '#d32f2f',
		icon: faIdBadge,
	},
	admin2: {
		id: 'admin2',
		label: 'Admin',
		color: '#f96955',
		icon: faIdBadge,
	},
	dev_code: {
		id: 'devCode',
		label: 'Dev Programmer',
		color: '#bd3e91',
		icon: faCode,
	},
	dev_music: {
		id: 'devMusic',
		label: 'Dev Musician',
		color: '#bd3e91',
		icon: faMusic,
	},
	dev: {
		id: 'dev',
		label: 'Developer',
		color: '#bd3e91',
		icon: faCode,
	},
	wibecoder: {
		id: 'wbcode',
		label: 'Wibe Coder',
		color: '#ff4242',
		icon: faTerminal,
	},
	gameDesigner: {
		id: 'gameDesigner',
		label: 'Game Designer',
		color: '#FF42AB',
		icon: faDesktop,
	},
	mainart: {
		id: 'mainart',
		label: 'Main Artist',
		color: '#da54da',
		icon: faPaintBrush,
	},
	artist: {
		id: 'artist',
		label: 'Artist',
		color: '#bd3e91',
		icon: faPaintBrush,
	},
	anim: {
		id: 'anim',
		label: 'Animator',
		color: 'rgb(116, 155, 8)',
		icon: faPaintBrush,
	},
	qa: {
		id: 'qa',
		label: 'Quality Assurance',
		color: '#00bcd4',
		icon: faDesktop,
	},
	mod: {
		id: 'mod',
		label: 'Moderator',
		color: '#5f2f8f',
		icon: faUserCog,
	},
	builder: {
		id: 'builder',
		label: 'Map Builder',
		color: '#00ffff',
		icon: faHammer,
	},
	oper: {
		id: 'oper',
		label: 'Server Operator',
		color: '#9c27b0',
		icon: faUserCog,
	},
	contributor: {
		id: 'contributor',
		label: 'Contributor',
		color: '#f7c900ff',
		icon: faStar,
	},
	tiktoker: {
		id: 'tiktoker',
		label: 'Tiktoker',
		color: '#212121',
		icon: faTiktok,
	},
	PR: {
		id: 'PR',
		label: 'PR Manager',
		color: '#212121',
		icon: faIdBadge,
	},
	trialMember: {
		id: 'trialMember',
		label: 'Trial Member',
		color: '#212121',
		icon: faUserCog,
	},
};

// Credits
export const CREDITS: Credit[] = [
	{
		name: 'KOKOSIK',
		badges: [BADGES.owner, BADGES.tiktoker, BADGES.PR ],
		avatarSkin: 'kokosik-pony',
		avatarBgColor: 'rgb(134, 118, 98)',
		links: ['https://www.tiktok.com/@pupirka_67a6?_r=1&_t=ZS-98bHK9s6LTT'],
	},
	{
		name: 'Del',
		badges: [BADGES.dev, BADGES.gameDesigner, BADGES.wibecoder],
		avatarSkin: 'del-pony',
		avatarBgColor: 'rgb(43, 46, 53)',
		links: [],
	},
	{
		name: 'Trumentalise',
		badges: [BADGES.contributor, BADGES.dev_code ],
		avatarSkin: 'trumentalise-pony',
		avatarBgColor: 'rgb(159, 95, 199)',
		links: [],
	},
];


// Contributors
export const CONTRIBUTORS: Contributors[] = [
	{
		group: 'Music',
		contributors: [
			{
				name: 'Wandering Artist',
				links: [
					'https://wanderingartist.bandcamp.com/',
					'https://www.youtube.com/user/WanderingArtistMusic',
				],
			},
		],
	},
	{
		group: 'Programming',
		contributors: [
			{ name: 'Industrialice' },
			{ name: 'Thorn Rose', links: ['https://github.com/Thorn-Rose'] },
			{ name: 'Trumentalise' },
		],
	},
	{
		group: 'Artists and Animators',
		contributors: [
			{ name: 'Shino', links: ['https://www.deviantart.com/shinodage'] },
			{ name: 'ChiraChan', links: ['https://www.deviantart.com/chiramii-chan', 'https://chirachan-art.tumblr.com/'] },
			{ name: 'Goodly', links: ['https://www.deviantart.com/goodlyay'] },
			{ name: 'TioRafaJP', links: ['https://www.deviantart.com/tiorafajp', 'https://www.youtube.com/user/RafaelJP2'] },
			{ name: 'ShareMyShipment', links: ['https://www.deviantart.com/sharemyshipment'] },
			{ name: 'Velenor' },
			{ name: 'Meno', links: ['https://twitter.com/menojar', 'https://www.deviantart.com/menojar'] },
			{ name: 'OtakuAP', links: ['https://www.deviantart.com/otakuap'] },
			{ name: 'Disastral' },
			{ name: 'CyberPon3', links: ['https://twitter.com/CyberPon3'] },
			{ name: 'Paulpeoples', links: ['https://www.deviantart.com/paulpeopless'] },
			{ name: 'Velvet-Frost', links: ['https://www.deviantart.com/velvet-frost'] },
			{ name: 'Jet7Wave', links: ['https://www.deviantart.com/jetwave'] },
			{ name: 'Lalieri', links: ['https://lalieri.tumblr.com/'] },
			{ name: 'Ruef-bae', links: ['https://www.deviantart.com/ruef-bae'] },
			{ name: 'Alchemist3rd' },
			{ name: 'Firecracker' },
			{ name: 'ZippySqrl', links: ['https://www.deviantart.com/zippysqrl'] },
			{ name: 'Karnel333' },
			{ name: 'Wellfugzee' },
			{ name: 'ScribblesHeart', links: ['https://www.deviantart.com/scribblesdesu'] },
			{ name: 'dsp2003', links: ['https://dsp2003.tumblr.com/', 'http://www.deviantart.com/dsp2003'] },
			{ name: 'Towmacow Waffles', links: ['https://www.deviantart.com/towmacowwaffles'] },
			{ name: 'OrchidPony', links: ['https://www.deviantart.com/orchidpony'] },
			{ name: 'Cherry Cerise', links: ['https://www.deviantart.com/cherryceriseart'] },
			{ name: 'RADIOstations', links: ['https://twitter.com/stagbeeble'] },
			{ name: 'Ultimate Fluff' },
			{ name: 'SC', links: ['https://0somecunt0.tumblr.com/tagged/sfw'] },
			{ name: 'SailorDolpin', links: ['https://vk.com/id324582699'] },
			{ name: 'Deeraw', links: ['https://www.deviantart.com/deerdraw', 'https://twitter.com/TheOnlyDeeraw'] },
			{ name: 'Aviivix' },
			{ name: 'SnowFl8keAnge1' },
		],
	},
];
