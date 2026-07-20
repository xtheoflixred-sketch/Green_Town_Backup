import { expect } from 'chai';
import { updateAccountSessionInfo } from '../../server/auth';

describe('auth session tracking', () => {
	it('records login timestamps on the account', () => {
		const account: any = {};

		updateAccountSessionInfo(account, 'login');

		expect(account.lastVisit).to.be.instanceOf(Date);
		expect(account.lastOnline).to.be.instanceOf(Date);
		expect(account.lastLogin).to.be.instanceOf(Date);
	});

	it('records logout timestamps on the account', () => {
		const account: any = {};

		updateAccountSessionInfo(account, 'logout');

		expect(account.lastLogout).to.be.instanceOf(Date);
	});
});
