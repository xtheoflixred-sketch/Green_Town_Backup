import { expect } from 'chai';
import { buildAccountSessionSummary } from '../../common/accountSessionUtils';

describe('account session utils', () => {
	it('summarizes a current device session from account metadata', () => {
		const result = buildAccountSessionSummary({
			lastLogin: '2024-01-02T03:04:05.000Z',
			lastLogout: '2024-01-03T03:04:05.000Z',
			lastUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1'
		}, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

		expect(result.title).to.equal('Current device');
		expect(result.subtitle).to.contain('Chrome');
		expect(result.detail).to.contain('Last visit');
		expect(result.deviceType).to.equal('desktop');
	});
});
