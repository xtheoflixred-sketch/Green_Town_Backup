import '../../lib';
import { expect } from 'chai';
import { stub, assert } from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as adminApi from '../../../server/api/admin';
import * as paths from '../../../server/paths';
import * as serverUtils from '../../../server/serverUtils';

describe('admin chat log', () => {
	it('reads chat entries from local log files without shell usage', async () => {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bats-town-chat-'));
		const logsDir = path.join(tempRoot, 'logs');
		fs.mkdirSync(logsDir, { recursive: true });
		const logFile = path.join(logsDir, 'info.20260720.log');
		fs.writeFileSync(logFile, '00:00:01 [dev][Test] hello from local log\n', 'utf8');

		const pathStub = stub(paths, 'pathTo').callsFake((...parts: string[]) => path.join(tempRoot, ...parts));
		const execStub = stub(serverUtils, 'execAsync').rejects(new Error('shell not available'));

		try {
			const result = await adminApi.getChat('hello', '2026-07-20', true);
			expect(result).to.contain('hello from local log');
			assert.notCalled(execStub);
		} finally {
			pathStub.restore();
			execStub.restore();
			if (fs.existsSync(tempRoot)) {
				fs.rmdirSync(tempRoot);
			}
		}
	});
});
