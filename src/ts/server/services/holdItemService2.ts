import { NotificationFlags } from '../../common/interfaces';
import { getEntityName } from '../entityUtils';
import { IClient } from '../serverInterfaces';
import { NotificationService } from './notification';
import { holdItem, unholdItem, holdToy, unholdToy } from '../playerUtils';
import { saySystem, sayToOthers } from '../chat';
import { getEntityTypeName } from '../../common/entities';
import { distanceXY, toInt } from '../../common/utils';
import { TILE_CHANGE_RANGE } from '../../common/constants';
import { MessageType } from '../../common/interfaces';
import { updateAccountState } from '../accountUtils';

type RequestType = 'item' | 'toy';
type HoldItemAction = 'send' | 'trade' | 'pickup';

interface PendingHoldItemRequest {
	id: number;
	type: RequestType;
	action: HoldItemAction;
	from: IClient;
	to: IClient;
	fromHold: number;
	toHold: number;
	fromItemName: string;
	toItemName: string;
}

function prettyItemName(type: number) {
	const name = getEntityTypeName(type);
	return name.replace(/_/g, ' ');
}

function prettyToyName(type: number) {
	return `toy #${type}`;
}

function hasToyUnlocked(client: IClient, toy: number) {
	if (!toy || toy <= 0) {
		return false;
	}
	return !!(toInt(client.account.state && client.account.state.toys) & (1 << (toy - 1)));
}

function unlockToy(client: IClient, toy: number) {
	if (!toy || toy <= 0) {
		return;
	}
	updateAccountState(client.account, state => {
		const current = toInt(state.toys);
		state.toys = current | (1 << (toy - 1));
	});
}

function announceNewToy(client: IClient, toy: number) {
	const name = client.pony.name || 'Unknown';
	sayToOthers(client, `${name} получил игрушку #${toy}!`, MessageType.Announcement, undefined, {} as any);
}

const RECENT_SEND_RETURN_WINDOW = 2 * 60 * 1000; // 2 minutes

export class HoldItemService {
	private readonly pending = new Map<number, PendingHoldItemRequest>();
	private readonly recentSendItemReturns = new Map<number, { item: number; recipientId: number; timestamp: number }>();
	private readonly recentSendToyReturns = new Map<number, { toy: number; recipientId: number; timestamp: number }>();

	constructor(private readonly notificationService: NotificationService) {
	}

	clientDisconnected(client: IClient) {
		for (const [id, request] of Array.from(this.pending.entries())) {
			if (request.from === client || request.to === client) {
				const other = request.from === client ? request.to : request.from;
				this.notificationService.removeNotification(other, id);
				this.pending.delete(id);
			}
		}
	}

	requestSendItem(from: IClient, to: IClient) {
		const fromHold = (from.pony.options && from.pony.options.hold) || 0;
		const targetHold = (to.pony.options && to.pony.options.hold) || 0;

		if (from === to) {
			return saySystem(from, 'Cannot send item to yourself');
		}

		if (!from.isConnected || !to.isConnected) {
			return saySystem(from, 'Cannot send item request right now');
		}

		if (!fromHold) {
			return saySystem(from, 'You are not holding any item to send');
		}

		if (targetHold) {
			return saySystem(from, 'The other player is already holding an item');
		}

		if (!this.isRequestAllowed(from, to, 'send an item')) {
			return;
		}

		if (this.hasPendingRequest(from, to, 'send')) {
			return saySystem(from, 'Item transfer request is already pending');
		}

		const fromItemName = prettyItemName(fromHold);
		const notificationId = this.notificationService.addNotification(to, {
			id: 0,
			sender: from,
			name: from.pony.name || '',
			entityId: from.pony.id,
			message: `<div class="text-items"><b>Item transfer request</b></div><b>#NAME#</b> wants to send you <b>${fromItemName}</b>. Accept?`,
			flags: NotificationFlags.Accept | NotificationFlags.Reject | NotificationFlags.Ignore |
				(from.pony.nameBad ? NotificationFlags.NameBad : 0),
			accept: () => this.acceptRequest(notificationId),
			reject: () => this.rejectRequest(notificationId),
		});

		if (!notificationId) {
			return saySystem(from, 'Cannot send item request');
		}

		this.pending.set(notificationId, {
			id: notificationId,
			type: 'item',
			action: 'send',
			from,
			to,
			fromHold,
			toHold: targetHold,
			fromItemName,
			toItemName: '',
		});

		saySystem(from, `Item transfer request sent to ${getEntityName(to.pony, from)} for ${fromItemName}`);
	}

	requestSendToy(from: IClient, to: IClient) {
		const fromToy = (from.pony.options && from.pony.options.toy) || 0;
		const targetToy = (to.pony.options && to.pony.options.toy) || 0;

		if (from === to) {
			return saySystem(from, 'Cannot send toy to yourself');
		}

		if (!from.isConnected || !to.isConnected) {
			return saySystem(from, 'Cannot send toy request right now');
		}

		if (!fromToy) {
			return saySystem(from, 'You are not holding any toy to send');
		}

		if (targetToy) {
			return saySystem(from, 'The other player is already holding a toy');
		}

		if (!this.isRequestAllowed(from, to, 'send a toy')) {
			return;
		}

		if (this.hasPendingRequest(from, to, 'send')) {
			return saySystem(from, 'Toy transfer request is already pending');
		}

		const fromToyName = prettyToyName(fromToy);
		const notificationId = this.notificationService.addNotification(to, {
			id: 0,
			sender: from,
			name: from.pony.name || '',
			entityId: from.pony.id,
			message: `<div class="text-items"><b>Toy transfer request</b></div><b>#NAME#</b> wants to send you <b>${fromToyName}</b>. Accept?`,
			flags: NotificationFlags.Accept | NotificationFlags.Reject | NotificationFlags.Ignore |
				(from.pony.nameBad ? NotificationFlags.NameBad : 0),
			accept: () => this.acceptRequest(notificationId),
			reject: () => this.rejectRequest(notificationId),
		});

		if (!notificationId) {
			return saySystem(from, 'Cannot send toy request');
		}

		this.pending.set(notificationId, {
			id: notificationId,
			type: 'toy',
			action: 'send',
			from,
			to,
			fromHold: fromToy,
			toHold: targetToy,
			fromItemName: fromToyName,
			toItemName: '',
		});

		saySystem(from, `Toy transfer request sent to ${getEntityName(to.pony, from)} for ${fromToyName}`);
	}

	requestTradeItem(from: IClient, to: IClient) {
		const fromHold = (from.pony.options && from.pony.options.hold) || 0;
		const targetHold = (to.pony.options && to.pony.options.hold) || 0;

		if (from === to) {
			return saySystem(from, 'Cannot trade items with yourself');
		}

		if (!from.isConnected || !to.isConnected) {
			return saySystem(from, 'Cannot send trade request right now');
		}

		if (!fromHold || !targetHold) {
			return saySystem(from, 'Both players must be holding an item to trade');
		}

		if (!this.isRequestAllowed(from, to, 'trade items')) {
			return;
		}

		if (this.hasPendingRequest(from, to, 'trade')) {
			return saySystem(from, 'Trade request is already pending');
		}

		const fromItemName = prettyItemName(fromHold);
		const toItemName = prettyItemName(targetHold);
		const notificationId = this.notificationService.addNotification(to, {
			id: 0,
			sender: from,
			name: from.pony.name || '',
			entityId: from.pony.id,
			message: `<div class="text-items"><b>Item trade request</b></div><b>#NAME#</b> wants to swap your <b>${toItemName}</b> with their <b>${fromItemName}</b>. Accept?`,
			flags: NotificationFlags.Accept | NotificationFlags.Reject | NotificationFlags.Ignore |
				(from.pony.nameBad ? NotificationFlags.NameBad : 0),
			accept: () => this.acceptRequest(notificationId),
			reject: () => this.rejectRequest(notificationId),
		});

		if (!notificationId) {
			return saySystem(from, 'Cannot send trade request');
		}

		this.pending.set(notificationId, {
			id: notificationId,
			type: 'item',
			action: 'trade',
			from,
			to,
			fromHold,
			toHold: targetHold,
			fromItemName,
			toItemName,
		});

		saySystem(from, `Trade request sent to ${getEntityName(to.pony, from)} to swap ${fromItemName} and ${toItemName}`);
	}

	requestTradeToy(from: IClient, to: IClient) {
		const fromToy = (from.pony.options && from.pony.options.toy) || 0;
		const targetToy = (to.pony.options && to.pony.options.toy) || 0;

		if (from === to) {
			return saySystem(from, 'Cannot trade toys with yourself');
		}

		if (!from.isConnected || !to.isConnected) {
			return saySystem(from, 'Cannot send toy trade request right now');
		}

		if (!fromToy || !targetToy) {
			return saySystem(from, 'Both players must be holding a toy to trade');
		}

		if (!this.isRequestAllowed(from, to, 'trade toys')) {
			return;
		}

		if (this.hasPendingRequest(from, to, 'trade')) {
			return saySystem(from, 'Toy trade request is already pending');
		}

		const fromToyName = prettyToyName(fromToy);
		const toToyName = prettyToyName(targetToy);
		const notificationId = this.notificationService.addNotification(to, {
			id: 0,
			sender: from,
			name: from.pony.name || '',
			entityId: from.pony.id,
			message: `<div class="text-items"><b>Toy trade request</b></div><b>#NAME#</b> wants to swap your <b>${toToyName}</b> with their <b>${fromToyName}</b>. Accept?`,
			flags: NotificationFlags.Accept | NotificationFlags.Reject | NotificationFlags.Ignore |
				(from.pony.nameBad ? NotificationFlags.NameBad : 0),
			accept: () => this.acceptRequest(notificationId),
			reject: () => this.rejectRequest(notificationId),
		});

		if (!notificationId) {
			return saySystem(from, 'Cannot send toy trade request');
		}

		this.pending.set(notificationId, {
			id: notificationId,
			type: 'toy',
			action: 'trade',
			from,
			to,
			fromHold: fromToy,
			toHold: targetToy,
			fromItemName: fromToyName,
			toItemName: toToyName,
		});

		saySystem(from, `Toy trade request sent to ${getEntityName(to.pony, from)} to swap ${fromToyName} and ${toToyName}`);
	}

	requestPickupItem(from: IClient, to: IClient) {
		const fromHold = (from.pony.options && from.pony.options.hold) || 0;
		const targetHold = (to.pony.options && to.pony.options.hold) || 0;

		if (from === to) {
			return saySystem(from, 'Cannot take item from yourself');
		}

		if (!from.isConnected || !to.isConnected) {
			return saySystem(from, 'Cannot send take request right now');
		}

		if (fromHold) {
			return saySystem(from, 'You must free your hands before taking an item');
		}

		if (!this.isRequestAllowed(from, to, 'take an item')) {
			return;
		}

		if (!targetHold) {
			return saySystem(from, 'The other player is not holding any item to take');
		}

		const toItemName = prettyItemName(targetHold);
		if (this.canRecallRecentSendItem(from, to, targetHold)) {
			this.completeRecallItem(from, to, targetHold, toItemName);
			return;
		}

		if (this.hasPendingRequest(from, to, 'pickup')) {
			return saySystem(from, 'Item pickup request is already pending');
		}
		const notificationId = this.notificationService.addNotification(to, {
			id: 0,
			sender: from,
			name: from.pony.name || '',
			entityId: from.pony.id,
			message: `<div class="text-items"><b>Item take request</b></div><b>#NAME#</b> wants to take your <b>${toItemName}</b>. Accept?`,
			flags: NotificationFlags.Accept | NotificationFlags.Reject | NotificationFlags.Ignore |
				(from.pony.nameBad ? NotificationFlags.NameBad : 0),
			accept: () => this.acceptRequest(notificationId),
			reject: () => this.rejectRequest(notificationId),
		});

		if (!notificationId) {
			return saySystem(from, 'Cannot send take request');
		}

		this.pending.set(notificationId, {
			id: notificationId,
			type: 'item',
			action: 'pickup',
			from,
			to,
			fromHold,
			toHold: targetHold,
			fromItemName: '',
			toItemName,
		});

		saySystem(from, `Request sent to take ${toItemName} from ${getEntityName(to.pony, from)}`);
	}

	requestPickupToy(from: IClient, to: IClient) {
		const fromToy = (from.pony.options && from.pony.options.toy) || 0;
		const targetToy = (to.pony.options && to.pony.options.toy) || 0;

		if (from === to) {
			return saySystem(from, 'Cannot take toy from yourself');
		}

		if (!from.isConnected || !to.isConnected) {
			return saySystem(from, 'Cannot send toy take request right now');
		}

		if (fromToy) {
			return saySystem(from, 'You must free your hands before taking a toy');
		}

		if (!targetToy) {
			return saySystem(from, 'The other player is not holding any toy to take');
		}

		if (!this.isRequestAllowed(from, to, 'take a toy')) {
			return;
		}

		const toToyName = prettyToyName(targetToy);
		if (this.canRecallRecentSendToy(from, to, targetToy)) {
			this.completeRecallToy(from, to, targetToy, toToyName);
			return;
		}

		if (this.hasPendingRequest(from, to, 'pickup')) {
			return saySystem(from, 'Toy pickup request is already pending');
		}
		const notificationId = this.notificationService.addNotification(to, {
			id: 0,
			sender: from,
			name: from.pony.name || '',
			entityId: from.pony.id,
			message: `<div class="text-items"><b>Toy take request</b></div><b>#NAME#</b> wants to take your <b>${toToyName}</b>. Accept?`,
			flags: NotificationFlags.Accept | NotificationFlags.Reject | NotificationFlags.Ignore |
				(from.pony.nameBad ? NotificationFlags.NameBad : 0),
			accept: () => this.acceptRequest(notificationId),
			reject: () => this.rejectRequest(notificationId),
		});

		if (!notificationId) {
			return saySystem(from, 'Cannot send toy take request');
		}

		this.pending.set(notificationId, {
			id: notificationId,
			type: 'toy',
			action: 'pickup',
			from,
			to,
			fromHold: fromToy,
			toHold: targetToy,
			fromItemName: '',
			toItemName: toToyName,
		});

		saySystem(from, `Request sent to take ${toToyName} from ${getEntityName(to.pony, from)}`);
	}

	private hasPendingRequest(from: IClient, to: IClient, action: HoldItemAction) {
		let pending = false;
		this.pending.forEach(request => {
			if (request.action === action && request.from === from && request.to === to) {
				pending = true;
			}
		});

		return pending;
	}

	private acceptRequest(id: number) {
		const request = this.pending.get(id);

		if (!request) {
			return;
		}

		if (!this.validatePendingRequest(request)) {
			return;
		}

		if (request.type === 'toy') {
			switch (request.action) {
				case 'send':
					this.completeSendToy(request);
					break;
				case 'trade':
					this.completeTradeToy(request);
					break;
				case 'pickup':
					this.completePickupToy(request);
					break;
			}
		} else {
			switch (request.action) {
				case 'send':
					this.completeSendItem(request);
					break;
				case 'trade':
					this.completeTradeItem(request);
					break;
				case 'pickup':
					this.completePickupItem(request);
					break;
			}
		}
	}

	private rejectRequest(id: number) {
		const request = this.pending.get(id);

		if (!request) {
			return;
		}

		const { from, to, type, action, fromItemName, toItemName } = request;

		if (type === 'toy') {
			if (action === 'send') {
				saySystem(from, `${getEntityName(to.pony, from)} declined your toy transfer of ${fromItemName}`);
				saySystem(to, `You declined ${getEntityName(from.pony, to)}'s toy transfer of ${fromItemName}`);
			} else if (action === 'trade') {
				saySystem(from, `${getEntityName(to.pony, from)} declined your toy trade request for ${toItemName}`);
				saySystem(to, `You declined ${getEntityName(from.pony, to)}'s toy trade request`);
			} else if (action === 'pickup') {
				saySystem(from, `${getEntityName(to.pony, from)} refused to give you ${toItemName}`);
				saySystem(to, `You refused ${getEntityName(from.pony, to)}'s request to take ${toItemName}`);
			}
		} else {
			if (action === 'send') {
				saySystem(from, `${getEntityName(to.pony, from)} declined your transfer of ${fromItemName}`);
				saySystem(to, `You declined ${getEntityName(from.pony, to)}'s transfer of ${fromItemName}`);
			} else if (action === 'trade') {
				saySystem(from, `${getEntityName(to.pony, from)} declined your trade request for ${toItemName}`);
				saySystem(to, `You declined ${getEntityName(from.pony, to)}'s trade request`);
			} else if (action === 'pickup') {
				saySystem(from, `${getEntityName(to.pony, from)} refused to give you ${toItemName}`);
				saySystem(to, `You refused ${getEntityName(from.pony, to)}'s request to take ${toItemName}`);
			}
		}

		this.pending.delete(id);
	}

	private rememberRecentSendItem(from: IClient, to: IClient, item: number) {
		this.recentSendItemReturns.set(from.pony.id, {
			item,
			recipientId: to.pony.id,
			timestamp: Date.now(),
		});
	}

	private rememberRecentSendToy(from: IClient, to: IClient, toy: number) {
		this.recentSendToyReturns.set(from.pony.id, {
			toy,
			recipientId: to.pony.id,
			timestamp: Date.now(),
		});
	}

	private canRecallRecentSendItem(from: IClient, to: IClient, item: number) {
		const record = this.recentSendItemReturns.get(from.pony.id);
		return !!record && record.recipientId === to.pony.id && record.item === item && Date.now() - record.timestamp <= RECENT_SEND_RETURN_WINDOW;
	}

	private canRecallRecentSendToy(from: IClient, to: IClient, toy: number) {
		const record = this.recentSendToyReturns.get(from.pony.id);
		return !!record && record.recipientId === to.pony.id && record.toy === toy && Date.now() - record.timestamp <= RECENT_SEND_RETURN_WINDOW;
	}

	private forgetRecentSendItemReturn(from: IClient) {
		this.recentSendItemReturns.delete(from.pony.id);
	}

	private forgetRecentSendToyReturn(from: IClient) {
		this.recentSendToyReturns.delete(from.pony.id);
	}

	private completeRecallItem(from: IClient, to: IClient, item: number, itemName: string) {
		unholdItem(to.pony);
		holdItem(from.pony, item);

		saySystem(from, `You immediately took back ${itemName} from ${getEntityName(to.pony, from)}`);
		saySystem(to, `${getEntityName(from.pony, to)} took back ${itemName} from you`);
		this.forgetRecentSendItemReturn(from);
	}

	private completeRecallToy(from: IClient, to: IClient, toy: number, toyName: string) {
		unholdToy(to.pony);
		holdToy(from.pony, toy);

		saySystem(from, `You immediately took back ${toyName} from ${getEntityName(to.pony, from)}`);
		saySystem(to, `${getEntityName(from.pony, to)} took back ${toyName} from you`);
		this.forgetRecentSendToyReturn(from);
	}

	private completeSendItem(request: PendingHoldItemRequest) {
		const { id, from, to, fromHold, fromItemName } = request;

		if (!from.isConnected || !to.isConnected) {
			saySystem(from, 'Item transfer could not be completed');
			this.pending.delete(id);
			return;
		}

		const currentHold = (from.pony.options && from.pony.options.hold) || 0;
		const targetHold = (to.pony.options && to.pony.options.hold) || 0;

		if (currentHold !== fromHold || targetHold) {
			saySystem(from, 'Item transfer failed because player state changed');
			saySystem(to, 'Item transfer failed because player state changed');
			this.pending.delete(id);
			return;
		}

		unholdItem(from.pony);
		holdItem(to.pony, fromHold);
		this.rememberRecentSendItem(from, to, fromHold);

		saySystem(from, `You successfully sent ${fromItemName} to ${getEntityName(to.pony, from)}`);
		saySystem(to, `You received ${fromItemName} from ${getEntityName(from.pony, to)}`);
		this.pending.delete(id);
	}

	private completeTradeItem(request: PendingHoldItemRequest) {
		const { id, from, to, fromHold, toHold, fromItemName, toItemName } = request;

		if (!from.isConnected || !to.isConnected) {
			saySystem(from, 'Item trade could not be completed');
			this.pending.delete(id);
			return;
		}

		const currentFromHold = (from.pony.options && from.pony.options.hold) || 0;
		const currentToHold = (to.pony.options && to.pony.options.hold) || 0;

		if (currentFromHold !== fromHold || currentToHold !== toHold) {
			saySystem(from, 'Trade failed because item state changed');
			saySystem(to, 'Trade failed because item state changed');
			this.pending.delete(id);
			return;
		}

		unholdItem(from.pony);
		unholdItem(to.pony);
		holdItem(from.pony, toHold);
		holdItem(to.pony, fromHold);

		saySystem(from, `Trade completed with ${getEntityName(to.pony, from)}: ${fromItemName} for ${toItemName}`);
		saySystem(to, `Trade completed with ${getEntityName(from.pony, to)}: ${toItemName} for ${fromItemName}`);
		this.pending.delete(id);
	}

	private completePickupItem(request: PendingHoldItemRequest) {
		const { id, from, to, toHold, toItemName } = request;

		if (!from.isConnected || !to.isConnected) {
			saySystem(from, 'Item pickup could not be completed');
			this.pending.delete(id);
			return;
		}

		const currentFromHold = (from.pony.options && from.pony.options.hold) || 0;
		const currentToHold = (to.pony.options && to.pony.options.hold) || 0;

		if (currentFromHold || currentToHold !== toHold) {
			saySystem(from, 'Pickup failed because item state changed');
			saySystem(to, 'Pickup failed because item state changed');
			this.pending.delete(id);
			return;
		}

		unholdItem(to.pony);
		holdItem(from.pony, toHold);

		saySystem(from, `You took ${toItemName} from ${getEntityName(to.pony, from)}`);
		saySystem(to, `You gave ${toItemName} to ${getEntityName(from.pony, to)}`);
		this.pending.delete(id);
	}

	private completeSendToy(request: PendingHoldItemRequest) {
		const { id, from, to, fromHold, fromItemName } = request;

		if (!from.isConnected || !to.isConnected) {
			saySystem(from, 'Toy transfer could not be completed');
			this.pending.delete(id);
			return;
		}

		const currentToy = (from.pony.options && from.pony.options.toy) || 0;
		const targetToy = (to.pony.options && to.pony.options.toy) || 0;

		if (currentToy !== fromHold || targetToy) {
			saySystem(from, 'Toy transfer failed because player state changed');
			saySystem(to, 'Toy transfer failed because player state changed');
			this.pending.delete(id);
			return;
		}

		unholdToy(from.pony);
		holdToy(to.pony, fromHold);
		this.rememberRecentSendToy(from, to, fromHold);

		if (!hasToyUnlocked(to, fromHold)) {
			unlockToy(to, fromHold);
			announceNewToy(to, fromHold);
		}

		saySystem(from, `You successfully sent ${fromItemName} to ${getEntityName(to.pony, from)}`);
		saySystem(to, `You received ${fromItemName} from ${getEntityName(from.pony, to)}`);
		this.pending.delete(id);
	}

	private completeTradeToy(request: PendingHoldItemRequest) {
		const { id, from, to, fromHold, toHold, fromItemName, toItemName } = request;

		if (!from.isConnected || !to.isConnected) {
			saySystem(from, 'Toy trade could not be completed');
			this.pending.delete(id);
			return;
		}

		const currentFromToy = (from.pony.options && from.pony.options.toy) || 0;
		const currentToToy = (to.pony.options && to.pony.options.toy) || 0;

		if (currentFromToy !== fromHold || currentToToy !== toHold) {
			saySystem(from, 'Toy trade failed because toy state changed');
			saySystem(to, 'Toy trade failed because toy state changed');
			this.pending.delete(id);
			return;
		}

		unholdToy(from.pony);
		unholdToy(to.pony);
		holdToy(from.pony, toHold);
		holdToy(to.pony, fromHold);

		if (!hasToyUnlocked(from, toHold)) {
			unlockToy(from, toHold);
			announceNewToy(from, toHold);
		}
		if (!hasToyUnlocked(to, fromHold)) {
			unlockToy(to, fromHold);
			announceNewToy(to, fromHold);
		}

		saySystem(from, `Trade completed with ${getEntityName(to.pony, from)}: ${fromItemName} for ${toItemName}`);
		saySystem(to, `Trade completed with ${getEntityName(from.pony, to)}: ${toItemName} for ${fromItemName}`);
		this.pending.delete(id);
	}

	private completePickupToy(request: PendingHoldItemRequest) {
		const { id, from, to, toHold, toItemName } = request;

		if (!from.isConnected || !to.isConnected) {
			saySystem(from, 'Toy pickup could not be completed');
			this.pending.delete(id);
			return;
		}

		const currentFromToy = (from.pony.options && from.pony.options.toy) || 0;
		const currentToToy = (to.pony.options && to.pony.options.toy) || 0;

		if (currentFromToy || currentToToy !== toHold) {
			saySystem(from, 'Toy pickup failed because toy state changed');
			saySystem(to, 'Toy pickup failed because toy state changed');
			this.pending.delete(id);
			return;
		}

		unholdToy(to.pony);
		holdToy(from.pony, toHold);

		if (!hasToyUnlocked(from, toHold)) {
			unlockToy(from, toHold);
			announceNewToy(from, toHold);
		}

		saySystem(from, `You took ${toItemName} from ${getEntityName(to.pony, from)}`);
		saySystem(to, `You gave ${toItemName} to ${getEntityName(from.pony, to)}`);
		this.pending.delete(id);
	}

	private isRequestAllowed(from: IClient, to: IClient, actionName: string) {
		if (from.map !== to.map) {
			saySystem(from, `Cannot ${actionName} because the other player is not on the same map`);
			return false;
		}

		if (distanceXY(from.pony.x, from.pony.y, to.pony.x, to.pony.y) >= TILE_CHANGE_RANGE) {
			saySystem(from, `Cannot ${actionName} because the other player is too far away`);
			return false;
		}

		return true;
	}

	private validatePendingRequest(request: PendingHoldItemRequest) {
		const { from, to, type, action, id } = request;
		const prefix = type === 'toy' ? 'Toy' : 'Item';

		if (from.map !== to.map) {
			saySystem(from, `${prefix} ${action} failed because players are no longer on the same map`);
			saySystem(to, `${prefix} ${action} failed because players are no longer on the same map`);
			this.pending.delete(id);
			return false;
		}

		if (distanceXY(from.pony.x, from.pony.y, to.pony.x, to.pony.y) >= TILE_CHANGE_RANGE) {
			const actionText = action === 'send' ? 'transfer' : action === 'pickup' ? 'pickup' : 'trade';
			saySystem(from, `${prefix} ${actionText} failed because players are too far apart`);
			saySystem(to, `${prefix} ${actionText} failed because players are too far apart`);
			this.pending.delete(id);
			return false;
		}

		return true;
	}
}
