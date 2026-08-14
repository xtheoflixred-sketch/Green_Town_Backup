import { Router } from 'express';
import { offline as createOffline, validAccount as createValidAccount, hash, wrap } from '../requestUtils';
import { createFromRequest } from '../reporter';
import { createSavePony, createRemovePony } from '../api/pony';
import { findAuth, findCharacter, characterCount, createCharacter, removeCharacter, IAccount } from '../db';
import { updateCharacterCount } from '../accountUtils';
import { system } from '../logger';
import { kickFromAllServersByCharacter } from '../api/admin';
import { createIsSuspiciousName, createIsSuspiciousPony } from '../../common/security';
import { Settings, ServerConfig } from '../../common/adminInterfaces';
import { RemovedDocument } from '../internal';
import { logRemovedCharacter, updatePony } from '../characterUtils';
import { World, findClientByCharacterId } from '../world';
import { pushUpdateEntity } from '../entityUtils';
import { UpdateFlags } from '../../common/interfaces';

export default function (server: ServerConfig, settings: Settings, removedDocument: RemovedDocument, world?: World) {
	const offline = createOffline(settings);
	const validAccount = createValidAccount(server);
	const app = Router();

	const isSuspiciousName = createIsSuspiciousName(settings);
	const isSuspiciousPony = createIsSuspiciousPony(settings);

	const refreshPonyOptions = world
		? (characterId: string) => {
			const client = findClientByCharacterId(world, characterId);
			if (client) {
				updatePony(client.pony, client.account, client.character);
				const options = client.pony.options;
				pushUpdateEntity({ entity: client.pony, flags: UpdateFlags.Options, options });
			}
		}
		: undefined;

	const savePonyHandler = createSavePony(
		findCharacter, findAuth, characterCount, updateCharacterCount, createCharacter, system,
		isSuspiciousName, isSuspiciousPony, refreshPonyOptions);

	const removePonyHandler = createRemovePony(
		kickFromAllServersByCharacter, removeCharacter, updateCharacterCount,
		id => removedDocument('ponies', id), logRemovedCharacter);

	app.post('/pony/save', offline, hash, validAccount, wrap(server, req =>
		savePonyHandler(req.user as IAccount, req.body.pony, createFromRequest(server, req))));

	app.post('/pony/remove', offline, hash, validAccount, wrap(server, req =>
		removePonyHandler(req.body.id, (req.user as IAccount).id)));

	return app;
}
