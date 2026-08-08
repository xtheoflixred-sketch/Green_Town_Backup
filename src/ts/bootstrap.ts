import './bootstrap-common';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './components/app/app.module';
import { host, local } from './client/data';

function parseTelegramHashResult(hash: string) {
	if (!hash) {
		return undefined;
	}

	const fragment = hash.replace(/^#/, '');
	if (!fragment || !fragment.includes('tgAuthResult=')) {
		return undefined;
	}

	const params = new URLSearchParams(fragment);
	const rawValue = params.get('tgAuthResult');
	if (!rawValue) {
		return undefined;
	}

	try {
		const decoded = decodeURIComponent(rawValue);
		if (/^\s*\{/.test(decoded)) {
			return JSON.parse(decoded);
		}

		const normalized = decoded.replace(/-/g, '+').replace(/_/g, '/');
		const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
		const base64Decoded = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf8');
		const parsedJson = JSON.parse(base64Decoded);
		if (parsedJson && typeof parsedJson === 'object') {
			return parsedJson;
		}

		const parsed: any = {};
		const searchParams = new URLSearchParams(decoded);
		searchParams.forEach((value, key) => {
			parsed[key] = value;
		});
		return parsed;
	} catch (_e) {
		return undefined;
	}
}

if (location.hash && location.hash.includes('tgAuthResult=')) {
	const result = parseTelegramHashResult(location.hash);
	if (result) {
		const query = new URLSearchParams();
		for (const [key, value] of Object.entries(result)) {
			if (value !== undefined && value !== null) {
				query.set(key, String(value));
			}
		}
		window.location.replace(`/auth/telegram/callback?${query.toString()}`);
	} else {
		window.location.replace('/auth/telegram/callback');
	}
} else if (DEVELOPMENT || local || host === `${location.protocol}//${location.host}/`) {
	if (window.opener && window.opener.postMessage && window.URL) {
		const path = location.href.replace(host, '');
		window.opener.postMessage({ type: 'loaded-page', path }, '*');
	}

	platformBrowserDynamic().bootstrapModule(AppModule, { preserveWhitespaces: true });
}
