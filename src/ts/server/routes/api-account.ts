import { Router } from 'express';
import { offline as createOffline, validAccount as createValidAccount, hash, wrap, limit } from '../requestUtils';
import {
	createUpdateAccount, createRemoveSite, createUpdateSettings, createGetAccountCharacters, removeHide, getHides, getFriends
} from '../api/account';
import { findAccountSafe, findAuth, findAllCharacters, countAllVisibleAuths, IAccount } from '../db';
import { system } from '../logger';
import { Settings, ServerConfig } from '../../common/adminInterfaces';
import { updateEntityPlayerState } from '../playerUtils';
import { isShownOfflineForAccount, toFriend } from '../services/friends';
import { World, findAllOnlineFriends, findClientByAccountId } from '../world';

function syncShowAsOffline(world: World | undefined, account: IAccount, previousSettings: IAccount['settings']) {
	if (!world) {
		return;
	}

	const client = findClientByAccountId(world, account._id.toString());

	if (!client) {
		return;
	}

	client.account.settings = account.settings;
	client.accountSettings = { ...account.settings };

	for (const friend of findAllOnlineFriends(world, client)) {
		const wasHiddenForFriend = isShownOfflineForAccount(previousSettings, friend.accountId);
		const isHiddenForFriend = isShownOfflineForAccount(client.accountSettings, friend.accountId);

		if (wasHiddenForFriend !== isHiddenForFriend) {
			friend.updateFriends([toFriend(client, friend)], false);
			updateEntityPlayerState(friend, client.pony);
		}
	}
}

export default function (server: ServerConfig, settings: Settings, world?: World) {
	const validAccount = createValidAccount(server);
	const offline = createOffline(settings);
	const app = Router();

	const getAccountCharacters = createGetAccountCharacters(findAllCharacters);
	const updateAccount = createUpdateAccount(findAccountSafe, system);
	const updateSettings = createUpdateSettings(findAccountSafe);
	const removeSite = createRemoveSite(findAuth, countAllVisibleAuths, system);

	app.post('/account-characters', offline, hash, validAccount, limit(60, 60), wrap(server, req =>
		getAccountCharacters(req.user as IAccount)));
	app.post('/account-update', offline, hash, validAccount, limit(60, 60), wrap(server, req =>
		updateAccount(req.user as IAccount, req.body.account)));
	app.post('/account-settings', offline, hash, validAccount, limit(60, 60), wrap(server, async req => {
		const account = req.user as IAccount;
		const previousSettings = {
			...(account.settings || {}),
			showAsOfflineFor: [...((account.settings && account.settings.showAsOfflineFor) || [])],
		};
		const result = await updateSettings(account, req.body.settings);
		syncShowAsOffline(world, account, previousSettings);
		return result;
	}));
	app.post('/remove-site', offline, hash, validAccount, limit(60, 60), wrap(server, req =>
		removeSite(req.user as IAccount, req.body.siteId)));
	app.post('/remove-hide', offline, hash, validAccount, limit(60, 60), wrap(server, req =>
		removeHide(req.user as IAccount, req.body.hideId)));
	app.post('/get-hides', offline, hash, validAccount, limit(60, 60), wrap(server, req =>
		getHides(req.user as IAccount, req.body.page || 0)));
	app.post('/get-friends', offline, hash, validAccount, limit(120, 60), wrap(server, req =>
		getFriends(req.user as IAccount)));

	return app;
}
