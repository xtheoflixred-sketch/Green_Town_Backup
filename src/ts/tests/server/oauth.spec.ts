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
});
