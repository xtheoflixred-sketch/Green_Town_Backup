import {
    faCrown,
    faGamepad,
    faMobile,
    faPlug,
    faTablet,
    faTv,
} from '@fortawesome/free-solid-svg-icons';

export * from '@fortawesome/free-solid-svg-icons';
export {
    faTelegram,
    faBoosty,
    faCircleUserCirclePlus,
    faTiktok,
    faTwitch,
    faSteam,
    faCommentQuestion,
    faMasks,
    faNote,
    faBlush,
    faDroplet,
    faRaindrops,
    faSnooze,
    faSparkles,
} from '../generated/fa-icons';

import {
    faPatreon,
    faDeviantart,
    faTwitter,
    faTumblr,
    faFacebook,
    faGithub,
    faVk,
    faGoogle,
    faChrome,
    faInternetExplorer,
    faEdge,
    faAndroid,
    faFirefox,
    faSafari,
    faOpera,
    faWindows,
    faLinux,
    faAmilia,
    faYandexInternational,
    faApple,
    faDiscord
} from '../generated/fa-icons';

import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';

export {
    faPatreon,
    faDeviantart,
    faTwitter,
    faTumblr,
    faFacebook,
    faGithub,
    faVk,
    faGoogle,
    faChrome,
    faInternetExplorer,
    faEdge,
    faAndroid,
    faFirefox,
    faSafari,
    faOpera,
    faWindows,
    faLinux,
    faAmilia,
    faYandexInternational,
    faDiscord,
    faApple
} from '../generated/fa-icons';

export const partyLeaderIcon = faCrown;
export const offlineIcon = faPlug;
export const emptyIcon = {
    prefix: 'fas',
    iconName: 'empty-icon',
    icon: [512, 512, [], 'ffff', ''],
};

export const oauthIcons: { [key: string]: any; } = {
    patreon: faPatreon,
    deviantart: faDeviantart,
    twitter: faTwitter,
    tumblr: faTumblr,
    facebook: faFacebook,
    github: faGithub,
    vkontakte: faVk,
    google: faGoogle,
    discord: faDiscord,
    telegram: faPaperPlane
};

export const uaIcons: { [key: string]: any; } = {
    // browser
    'Chrome': faChrome,
    'Chromium': faChrome,
    'IE': faInternetExplorer,
    'Edge': faEdge,
    'Android Browser': faAndroid,
    'Firefox': faFirefox,
    'Safari': faSafari,
    'Mobile Safari': faSafari,
    'Opera': faOpera,
    'Opera Mini': faOpera,
    'Amigo': faAmilia,
    'YaBrowser': faYandexInternational,
    // os
    'Windows': faWindows,
    'Windows Phone': faWindows,
    'Android': faAndroid,
    'iOS': faApple,
    'Mac OS': faApple,
    'Arch': faLinux,
    'CentOS': faLinux,
    'Fedora': faLinux,
    'FreeBSD': faLinux,
    'OpenBSD': faLinux,
    'Debian': faLinux,
    'Ubuntu': faLinux,
    'Linux': faLinux,
    'Chromium OS': faChrome,
    'Firefox OS': faFirefox,
    'Playstation': faGamepad,
    'Nintendo': faGamepad,
    // device
    'console': faGamepad,
    'mobile': faMobile,
    'tablet': faTablet,
    'smarttv': faTv,
};