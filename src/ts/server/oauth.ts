/// <reference path="../../typings/my.d.ts" />

import * as crypto from 'crypto';
import * as querystring from 'querystring';
import { Request } from 'express';
import { isString } from 'lodash';
import { Strategy as GoogleStrategy } from '@passport-next/passport-google-oauth2';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import { Strategy as FacebookStrategy } from '@passport-next/passport-facebook';
import { Strategy as GithubStrategy } from 'passport-github2';
import { Strategy as VKontakteStrategy } from 'passport-vkontakte';
import { Strategy as PatreonStrategy } from 'passport-patreon';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { Profile } from '../common/interfaces';
import { PATREON_COLOR } from '../common/colors';
import { colorToCSS } from '../common/color';
import { config } from './config';
import { IAccount } from './db';

export type OAuthProfileName = string | { familyName: string; givenName: string; };

export interface OAuthProfile {
	id?: string;
	name?: OAuthProfileName;
	username?: string;
	displayName?: string;
	email?: string; // discord
	emails?: { value: string; }[];
	provider: string;
	gender?: string;
	profileUrl?: string;
	_raw: string;
	_json: any;
}

export interface Strategy {
	new(
		options: any,
		callback: (
			req: Request,
			accessToken: string,
			refreshToken: string,
			profile: OAuthProfile,
			callback: (err: Error | null, user: IAccount | null) => void) => void): any;
}

export interface OAuthProviderInfo {
	id: string;
	name: string;
	color: string;
	strategy?: Strategy;
	auth?: any;
	connectOnly?: boolean;
	additionalOptions?: any;
}

function normalizeTelegramHost(host: string): string {
	const trimmedHost = (host || '').trim();
	if (!trimmedHost) {
		return '';
	}

	const normalizedHost = trimmedHost.endsWith('/') ? trimmedHost : `${trimmedHost}/`;
	try {
		return new URL(normalizedHost).origin;
	} catch (_e) {
		return trimmedHost.replace(/\/+$/, '').replace(/:(80|443)$/, '');
	}
}

export function createTelegramAuthRedirectUrl(host: string, auth: any) {
	const baseUrl = normalizeTelegramHost(host);
	const redirectUri = `${baseUrl}/auth/telegram/callback`;

	const params: any = {
		bot_id: auth && auth.botId,
		redirect_uri: redirectUri,
		request_access: 'write',
	};

	if (baseUrl) {
		params.origin = baseUrl;
	}

	return `https://oauth.telegram.org/auth?${querystring.stringify(params)}`;
}

export function verifyTelegramAuthData(data: any, botToken: string) {
	if (!data || !botToken || !data.hash) {
		return false;
	}

	const checkString = Object.keys(data)
		.filter(key => key !== 'hash')
		.sort()
		.map(key => `${key}=${data[key]}`)
		.join('\n');
	const secretKey = crypto.createHash('sha256').update(botToken).digest();
	const expectedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
	return expectedHash === data.hash;
}

function isProviderConfigured(provider: OAuthProviderInfo) {
	if (!provider.auth) {
		return false;
	}

	if (provider.id === 'telegram') {
		return !!provider.auth.botId && !!provider.auth.botToken;
	}

	return true;
}

const providerList: OAuthProviderInfo[] = [
	{
		id: 'google',
		name: 'Google',
		color: '#DC4A3D',
		strategy: GoogleStrategy,
	},
	{
		id: 'twitter',
		name: 'Twitter',
		color: '#55ACEE',
		strategy: TwitterStrategy,
	},
	{
		id: 'facebook',
		name: 'Facebook',
		color: '#3765A3',
		strategy: FacebookStrategy,
	},
	{
		id: 'github',
		name: 'GitHub',
		color: '#800080',
		strategy: GithubStrategy,
	},
	{
		id: 'vkontakte',
		name: 'VKontakte',
		color: '#4C75A3',
		strategy: VKontakteStrategy,
	},
	{
		id: 'patreon',
		name: 'Patreon',
		color: colorToCSS(PATREON_COLOR),
		strategy: PatreonStrategy,
	},
	{
		id: 'discord',
		name: 'Discord',
		color: '#7289DA',
		strategy: DiscordStrategy,
	},
	{
		id: 'telegram',
		name: 'Telegram',
		color: '#2CA5E0',
	},
];

providerList.forEach(p => p.auth = config.oauth[p.id]);
providerList.filter(p => p.auth && p.auth.connectOnly).forEach(p => p.connectOnly = true);

export const providers = providerList.filter(isProviderConfigured);

export function getProfileUrl(profile: OAuthProfile): string | undefined {
	if (profile.provider === 'twitter') {
		return profile.username ? `https://twitter.com/${profile.username}` : undefined;
	} else if (profile.provider === 'tumblr') {
		return profile.username ? `http://${profile.username}.tumblr.com/` : undefined;
	} else if (profile.provider === 'facebook') {
		return profile.id ? `http://www.facebook.com/${profile.id}` : undefined;
	} else if (profile.provider === 'discord') {
		return undefined;
	} else if (profile.provider === 'telegram') {
		const username = profile.username || profile.displayName || profile.id;
		if (!username || username === 'null' || username === 'undefined') {
			return profile.profileUrl || undefined;
		}
		const telegramUsername = String(username).replace(/^@/, '').trim();
		if (!telegramUsername) {
			return profile.profileUrl || undefined;
		}
		return profile.profileUrl || `https://t.me/${telegramUsername}`;
	} else if (profile._json && profile._json.attributes && profile._json.attributes.url) { // patreon
		return profile._json.attributes.url;
	} else {
		return profile.profileUrl || (profile._json && profile._json.url) || undefined;
	}
}

export function getProfileEmails(profile: OAuthProfile): string[] {
	if (profile.provider === 'discord') {
		// TODO: diagnose why we aren't receiving the email from Discord
		// for now, we just won't attempt to record an email if we don't receive one
		return profile.email ? [profile.email] : [];
	} else if (profile.emails && profile.emails.length) {
		return profile.emails.map(e => e.value);
	} else if (profile._json && profile._json.attributes && profile._json.attributes.email) { // patreon
		return [profile._json.attributes.email];
	} else {
		return [];
	}
}

export function getProfileUsername(profile: OAuthProfile): string | undefined {
	if (profile.provider === 'discord') return `${profile.username}`;
	return profile.username || profile.displayName || getProfileNameInternal(profile.name);
}

export function getProfileName(profile: OAuthProfile): string | undefined {
	if (profile.provider === 'discord') return `${profile.username}`;
	return profile.displayName || profile.username || getProfileNameInternal(profile.name);
}

function getProfileNameInternal(name: OAuthProfileName | undefined): string | undefined {
	if (!name || isString(name)) {
		return name;
	} else {
		return `${name.givenName} ${name.familyName}`.trim();
	}
}

export function getProfile(provider: string, profile: OAuthProfile): Profile {
	const emails = getProfileEmails(profile).map(e => e.toLowerCase());

	return {
		id: profile.id || profile.username || '',
		provider: profile.provider || provider,
		username: getProfileUsername(profile) || emails[0],
		name: getProfileName(profile) || emails[0],
		emails,
		url: getProfileUrl(profile),
		createdAt: profile._json && profile._json.created_at && new Date(profile._json.created_at),
		suspended: profile._json && profile._json.suspended,
	};
}
