import { NotificationFlags } from '../../common/interfaces';
import { getEntityName } from '../entityUtils';
import { IClient } from '../serverInterfaces';
import { NotificationService } from './notification';
import { holdItem, unholdItem } from '../playerUtils';
import { saySystem } from '../chat';
import { getEntityTypeName } from '../../common/entities';
import { distanceXY } from '../../common/utils';
import { TILE_CHANGE_RANGE } from '../../common/constants';

type HoldItemAction = 'send' | 'trade' | 'pickup';

interface PendingHoldItemRequest {
	id: number;
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

export class HoldItemService {
	private readonly pending = new Map<number, PendingHoldItemRequest>();

	constructor(private readonly notificationService: NotificationService) {
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
		const { from, to, action, id } = request;

		if (from.map !== to.map) {
			saySystem(from, `Item ${action} failed because players are no longer on the same map`);
			saySystem(to, `Item ${action} failed because players are no longer on the same map`);
			this.pending.delete(id);
			return false;
		}

		if (distanceXY(from.pony.x, from.pony.y, to.pony.x, to.pony.y) >= TILE_CHANGE_RANGE) {
			const actionText = action === 'send' ? 'transfer' : action === 'pickup' ? 'pickup' : 'trade';
			saySystem(from, `Item ${actionText} failed because players are too far apart`);
			saySystem(to, `Item ${actionText} failed because players are too far apart`);
			this.pending.delete(id);
			return false;
		}

		return true;
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
		const fromHold = from.pony.options?.hold || 0;
		const targetHold = to.pony.options?.hold || 0;

		if (from === to) {
			return saySystem(from, 'Cannot send item to yourself');
		}

		if (!from.isConnected || !to.isConnected) {
			return saySystem(from, 'Cannot send item request right now');
		}

		if (!fromHold) {
			return saySystem(from, 'You are not holding any item to send');
		}

		if (!this.isRequestAllowed(from, to, 'send an item')) {
			return;
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

	requestTradeItem(from: IClient, to: IClient) {
		const fromHold = from.pony.options?.hold || 0;
		const targetHold = to.pony.options?.hold || 0;

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

	requestPickupItem(from: IClient, to: IClient) {
		const fromHold = from.pony.options?.hold || 0;
		const targetHold = to.pony.options?.hold || 0;

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

		if (this.hasPendingRequest(from, to, 'pickup')) {
			return saySystem(from, 'Item pickup request is already pending');
		}

		const toItemName = prettyItemName(targetHold);
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

	private hasPendingRequest(from: IClient, to: IClient, action: HoldItemAction) {
		for (const request of Array.from(this.pending.values())) {
			if (request.action === action && request.from === from && request.to === to) {
				return true;
			}
		}

		return false;
	}

	private acceptRequest(id: number) {
		const request = this.pending.get(id);

		if (!request) {
			return;
		}

		if (!this.validatePendingRequest(request)) {
			return;
		}

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

	private rejectRequest(id: number) {
		const request = this.pending.get(id);

		if (!request) {
			return;
		}

		const { from, to, action, fromItemName, toItemName } = request;

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

		this.pending.delete(id);
	}

	private completeSendItem(request: PendingHoldItemRequest) {
		const { id, from, to, fromHold, fromItemName } = request;

		if (!from.isConnected || !to.isConnected) {
			saySystem(from, 'Item transfer could not be completed');
			this.pending.delete(id);
			return;
		}

		const currentHold = from.pony.options?.hold || 0;
		const targetHold = to.pony.options?.hold || 0;

		if (currentHold !== fromHold || targetHold) {
			saySystem(from, 'Item transfer failed because player state changed');
			saySystem(to, 'Item transfer failed because player state changed');
			this.pending.delete(id);
			return;
		}

		unholdItem(from.pony);
		holdItem(to.pony, fromHold);

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

		const currentFromHold = from.pony.options?.hold || 0;
		const currentToHold = to.pony.options?.hold || 0;

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

		const currentFromHold = from.pony.options?.hold || 0;
		const currentToHold = to.pony.options?.hold || 0;

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
}