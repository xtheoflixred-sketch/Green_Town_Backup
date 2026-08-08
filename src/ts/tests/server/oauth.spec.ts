import '../lib';
import { expect } from 'chai';
import { createHash, createHmac } from 'crypto';
import { createTelegramAuthRedirectUrl, verifyTelegramAuthData } from '../../server/oauth';

describe('telegram oauth helpers', () => {
	it('verifies Telegram auth payloads with the bot token', () => {
		const token = '123456:ABCDEF';
		const data = {
			id: '42',
			first_name: 'Pony',
			auth_date: '1700000000',
		};
		const secretKey = createHash('sha256').update(token).digest();
		const dataCheckString = Object.keys(data).sort().map(key => `${key}=${data[key as keyof typeof data]}`).join('\n');
		const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
		const isValid = verifyTelegramAuthData({ ...data, hash }, token);

		expect(isValid).to.equal(true);
	});

	it('builds a Telegram auth redirect URL for the widget', () => {
		const url = createTelegramAuthRedirectUrl('http://localhost:8090/', { botId: '12345' });

		expect(url).to.contain('https://oauth.telegram.org/auth');
		expect(url).to.contain('bot_id=12345');
		expect(url).to.contain(encodeURIComponent('http://localhost:8090/auth/telegram/callback'));
		expect(url).to.contain(encodeURIComponent('http://localhost:8090'));
	});

	it('normalizes default ports in Telegram redirect URLs', () => {
		const url = createTelegramAuthRedirectUrl('http://26.50.189.235:80/', { botId: '8898986411' });

		expect(url).to.contain(encodeURIComponent('http://26.50.189.235/auth/telegram/callback'));
		expect(url).not.to.contain(':%2F%2F26.50.189.235:80');
		expect(url).to.contain(encodeURIComponent('http://26.50.189.235'));
	});

	it('accepts Telegram payloads encoded as base64url JSON in tgAuthResult', () => {
		const token = '8898986411:AAHc4rews6obsJhNTIexr4DQy0BL_4JylqE';
		const data = {
			id: '8508822968',
			first_name: '␤',
			username: 'Enylof1',
			photo_url: 'https://t.me/userpic/320/bwDRbZv2vEVUdlSolSpmxz3iDwfU6V_Q6rkA7wDXO19Z4mpoEzPh7CpUKtNy5Ks.jpg',
			auth_date: '1786164702',
		};
		const secretKey = createHash('sha256').update(token).digest();
		const dataCheckString = Object.keys(data).sort().map(key => `${key}=${(data as any)[key]}`).join('\n');
		const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
		const body = { ...data, hash };
		const encoded = Buffer.from(JSON.stringify(body)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
		const parsed = new URLSearchParams();
		parsed.set('tgAuthResult', encoded);

		const decoded = decodeURIComponent(parsed.get('tgAuthResult')!);
		const raw = /^\s*\{/.test(decoded) ? JSON.parse(decoded) : (() => {
			const nested = new URLSearchParams(decoded);
			const result: any = {};
			nested.forEach((value, key) => { result[key] = value; });
			return result;
		})();

		expect(verifyTelegramAuthData(raw, token)).to.equal(true);
	});
});
