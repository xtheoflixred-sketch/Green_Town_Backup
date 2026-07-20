"use strict";
exports.__esModule = true;
exports.HoldItemService = void 0;
var entityUtils_1 = require("../entityUtils");
var playerUtils_1 = require("../playerUtils");
var chat_1 = require("../chat");
var entities_1 = require("../../common/entities");
var utils_1 = require("../../common/utils");
var constants_1 = require("../../common/constants");
function prettyItemName(type) {
    var name = entities_1.getEntityTypeName(type);
    return name.replace(/_/g, ' ');
}
var HoldItemService = /** @class */ (function () {
    function HoldItemService(notificationService) {
        this.notificationService = notificationService;
        this.pending = new Map();
    }
    HoldItemService.prototype.isRequestAllowed = function (from, to, actionName) {
        if (from.map !== to.map) {
            chat_1.saySystem(from, "Cannot " + actionName + " because the other player is not on the same map");
            return false;
        }
        if (utils_1.distanceXY(from.pony.x, from.pony.y, to.pony.x, to.pony.y) >= constants_1.TILE_CHANGE_RANGE) {
            chat_1.saySystem(from, "Cannot " + actionName + " because the other player is too far away");
            return false;
        }
        return true;
    };
    HoldItemService.prototype.validatePendingRequest = function (request) {
        var from = request.from, to = request.to, action = request.action, id = request.id;
        if (from.map !== to.map) {
            chat_1.saySystem(from, "Item " + action + " failed because players are no longer on the same map");
            chat_1.saySystem(to, "Item " + action + " failed because players are no longer on the same map");
            this.pending["delete"](id);
            return false;
        }
        if (utils_1.distanceXY(from.pony.x, from.pony.y, to.pony.x, to.pony.y) >= constants_1.TILE_CHANGE_RANGE) {
            var actionText = action === 'send' ? 'transfer' : action === 'pickup' ? 'pickup' : 'trade';
            chat_1.saySystem(from, "Item " + actionText + " failed because players are too far apart");
            chat_1.saySystem(to, "Item " + actionText + " failed because players are too far apart");
            this.pending["delete"](id);
            return false;
        }
        return true;
    };
    HoldItemService.prototype.clientDisconnected = function (client) {
        for (var _i = 0, _a = Array.from(this.pending.entries()); _i < _a.length; _i++) {
            var _b = _a[_i], id = _b[0], request = _b[1];
            if (request.from === client || request.to === client) {
                var other = request.from === client ? request.to : request.from;
                this.notificationService.removeNotification(other, id);
                this.pending["delete"](id);
            }
        }
    };
    HoldItemService.prototype.requestSendItem = function (from, to) {
        var _this = this;
        var _a, _b;
        var fromHold = ((_a = from.pony.options) === null || _a === void 0 ? void 0 : _a.hold) || 0;
        var targetHold = ((_b = to.pony.options) === null || _b === void 0 ? void 0 : _b.hold) || 0;
        if (from === to) {
            return chat_1.saySystem(from, 'Cannot send item to yourself');
        }
        if (!from.isConnected || !to.isConnected) {
            return chat_1.saySystem(from, 'Cannot send item request right now');
        }
        if (!fromHold) {
            return chat_1.saySystem(from, 'You are not holding any item to send');
        }
        if (!this.isRequestAllowed(from, to, 'send an item')) {
            return;
        }
        var fromItemName = prettyItemName(fromHold);
        var notificationId = this.notificationService.addNotification(to, {
            id: 0,
            sender: from,
            name: from.pony.name || '',
            entityId: from.pony.id,
            message: "<div class=\"text-items\"><b>Item transfer request</b></div><b>#NAME#</b> wants to send you <b>" + fromItemName + "</b>. Accept?",
            flags: 8 /* Accept */ | 16 /* Reject */ | 64 /* Ignore */ |
                (from.pony.nameBad ? 128 /* NameBad */ : 0),
            accept: function () { return _this.acceptRequest(notificationId); },
            reject: function () { return _this.rejectRequest(notificationId); }
        });
        if (!notificationId) {
            return chat_1.saySystem(from, 'Cannot send item request');
        }
        this.pending.set(notificationId, {
            id: notificationId,
            action: 'send',
            from: from,
            to: to,
            fromHold: fromHold,
            toHold: targetHold,
            fromItemName: fromItemName,
            toItemName: ''
        });
        chat_1.saySystem(from, "Item transfer request sent to " + entityUtils_1.getEntityName(to.pony, from) + " for " + fromItemName);
    };
    HoldItemService.prototype.requestTradeItem = function (from, to) {
        var _this = this;
        var _a, _b;
        var fromHold = ((_a = from.pony.options) === null || _a === void 0 ? void 0 : _a.hold) || 0;
        var targetHold = ((_b = to.pony.options) === null || _b === void 0 ? void 0 : _b.hold) || 0;
        if (from === to) {
            return chat_1.saySystem(from, 'Cannot trade items with yourself');
        }
        if (!from.isConnected || !to.isConnected) {
            return chat_1.saySystem(from, 'Cannot send trade request right now');
        }
        if (!fromHold || !targetHold) {
            return chat_1.saySystem(from, 'Both players must be holding an item to trade');
        }
        if (!this.isRequestAllowed(from, to, 'trade items')) {
            return;
        }
        var fromItemName = prettyItemName(fromHold);
        var toItemName = prettyItemName(targetHold);
        var notificationId = this.notificationService.addNotification(to, {
            id: 0,
            sender: from,
            name: from.pony.name || '',
            entityId: from.pony.id,
            message: "<div class=\"text-items\"><b>Item trade request</b></div><b>#NAME#</b> wants to swap your <b>" + toItemName + "</b> with their <b>" + fromItemName + "</b>. Accept?",
            flags: 8 /* Accept */ | 16 /* Reject */ | 64 /* Ignore */ |
                (from.pony.nameBad ? 128 /* NameBad */ : 0),
            accept: function () { return _this.acceptRequest(notificationId); },
            reject: function () { return _this.rejectRequest(notificationId); }
        });
        if (!notificationId) {
            return chat_1.saySystem(from, 'Cannot send trade request');
        }
        this.pending.set(notificationId, {
            id: notificationId,
            action: 'trade',
            from: from,
            to: to,
            fromHold: fromHold,
            toHold: targetHold,
            fromItemName: fromItemName,
            toItemName: toItemName
        });
        chat_1.saySystem(from, "Trade request sent to " + entityUtils_1.getEntityName(to.pony, from) + " to swap " + fromItemName + " and " + toItemName);
    };
    HoldItemService.prototype.requestPickupItem = function (from, to) {
        var _this = this;
        var _a, _b;
        var fromHold = ((_a = from.pony.options) === null || _a === void 0 ? void 0 : _a.hold) || 0;
        var targetHold = ((_b = to.pony.options) === null || _b === void 0 ? void 0 : _b.hold) || 0;
        if (from === to) {
            return chat_1.saySystem(from, 'Cannot take item from yourself');
        }
        if (!from.isConnected || !to.isConnected) {
            return chat_1.saySystem(from, 'Cannot send take request right now');
        }
        if (fromHold) {
            return chat_1.saySystem(from, 'You must free your hands before taking an item');
        }
        if (!this.isRequestAllowed(from, to, 'take an item')) {
            return;
        }
        if (this.hasPendingRequest(from, to, 'pickup')) {
            return chat_1.saySystem(from, 'Item pickup request is already pending');
        }
        var toItemName = prettyItemName(targetHold);
        var notificationId = this.notificationService.addNotification(to, {
            id: 0,
            sender: from,
            name: from.pony.name || '',
            entityId: from.pony.id,
            message: "<div class=\"text-items\"><b>Item take request</b></div><b>#NAME#</b> wants to take your <b>" + toItemName + "</b>. Accept?",
            flags: 8 /* Accept */ | 16 /* Reject */ | 64 /* Ignore */ |
                (from.pony.nameBad ? 128 /* NameBad */ : 0),
            accept: function () { return _this.acceptRequest(notificationId); },
            reject: function () { return _this.rejectRequest(notificationId); }
        });
        if (!notificationId) {
            return chat_1.saySystem(from, 'Cannot send take request');
        }
        this.pending.set(notificationId, {
            id: notificationId,
            action: 'pickup',
            from: from,
            to: to,
            fromHold: fromHold,
            toHold: targetHold,
            fromItemName: '',
            toItemName: toItemName
        });
        chat_1.saySystem(from, "Request sent to take " + toItemName + " from " + entityUtils_1.getEntityName(to.pony, from));
    };
    HoldItemService.prototype.hasPendingRequest = function (from, to, action) {
        for (var _i = 0, _a = Array.from(this.pending.values()); _i < _a.length; _i++) {
            var request = _a[_i];
            if (request.action === action && request.from === from && request.to === to) {
                return true;
            }
        }
        return false;
    };
    HoldItemService.prototype.acceptRequest = function (id) {
        var request = this.pending.get(id);
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
    };
    HoldItemService.prototype.rejectRequest = function (id) {
        var request = this.pending.get(id);
        if (!request) {
            return;
        }
        var from = request.from, to = request.to, action = request.action, fromItemName = request.fromItemName, toItemName = request.toItemName;
        if (action === 'send') {
            chat_1.saySystem(from, entityUtils_1.getEntityName(to.pony, from) + " declined your transfer of " + fromItemName);
            chat_1.saySystem(to, "You declined " + entityUtils_1.getEntityName(from.pony, to) + "'s transfer of " + fromItemName);
        }
        else if (action === 'trade') {
            chat_1.saySystem(from, entityUtils_1.getEntityName(to.pony, from) + " declined your trade request for " + toItemName);
            chat_1.saySystem(to, "You declined " + entityUtils_1.getEntityName(from.pony, to) + "'s trade request");
        }
        else if (action === 'pickup') {
            chat_1.saySystem(from, entityUtils_1.getEntityName(to.pony, from) + " refused to give you " + toItemName);
            chat_1.saySystem(to, "You refused " + entityUtils_1.getEntityName(from.pony, to) + "'s request to take " + toItemName);
        }
        this.pending["delete"](id);
    };
    HoldItemService.prototype.completeSendItem = function (request) {
        var _a, _b;
        var id = request.id, from = request.from, to = request.to, fromHold = request.fromHold, fromItemName = request.fromItemName;
        if (!from.isConnected || !to.isConnected) {
            chat_1.saySystem(from, 'Item transfer could not be completed');
            this.pending["delete"](id);
            return;
        }
        var currentHold = ((_a = from.pony.options) === null || _a === void 0 ? void 0 : _a.hold) || 0;
        var targetHold = ((_b = to.pony.options) === null || _b === void 0 ? void 0 : _b.hold) || 0;
        if (currentHold !== fromHold || targetHold) {
            chat_1.saySystem(from, 'Item transfer failed because player state changed');
            chat_1.saySystem(to, 'Item transfer failed because player state changed');
            this.pending["delete"](id);
            return;
        }
        playerUtils_1.unholdItem(from.pony);
        playerUtils_1.holdItem(to.pony, fromHold);
        chat_1.saySystem(from, "You successfully sent " + fromItemName + " to " + entityUtils_1.getEntityName(to.pony, from));
        chat_1.saySystem(to, "You received " + fromItemName + " from " + entityUtils_1.getEntityName(from.pony, to));
        this.pending["delete"](id);
    };
    HoldItemService.prototype.completeTradeItem = function (request) {
        var _a, _b;
        var id = request.id, from = request.from, to = request.to, fromHold = request.fromHold, toHold = request.toHold, fromItemName = request.fromItemName, toItemName = request.toItemName;
        if (!from.isConnected || !to.isConnected) {
            chat_1.saySystem(from, 'Item trade could not be completed');
            this.pending["delete"](id);
            return;
        }
        var currentFromHold = ((_a = from.pony.options) === null || _a === void 0 ? void 0 : _a.hold) || 0;
        var currentToHold = ((_b = to.pony.options) === null || _b === void 0 ? void 0 : _b.hold) || 0;
        if (currentFromHold !== fromHold || currentToHold !== toHold) {
            chat_1.saySystem(from, 'Trade failed because item state changed');
            chat_1.saySystem(to, 'Trade failed because item state changed');
            this.pending["delete"](id);
            return;
        }
        playerUtils_1.unholdItem(from.pony);
        playerUtils_1.unholdItem(to.pony);
        playerUtils_1.holdItem(from.pony, toHold);
        playerUtils_1.holdItem(to.pony, fromHold);
        chat_1.saySystem(from, "Trade completed with " + entityUtils_1.getEntityName(to.pony, from) + ": " + fromItemName + " for " + toItemName);
        chat_1.saySystem(to, "Trade completed with " + entityUtils_1.getEntityName(from.pony, to) + ": " + toItemName + " for " + fromItemName);
        this.pending["delete"](id);
    };
    HoldItemService.prototype.completePickupItem = function (request) {
        var _a, _b;
        var id = request.id, from = request.from, to = request.to, toHold = request.toHold, toItemName = request.toItemName;
        if (!from.isConnected || !to.isConnected) {
            chat_1.saySystem(from, 'Item pickup could not be completed');
            this.pending["delete"](id);
            return;
        }
        var currentFromHold = ((_a = from.pony.options) === null || _a === void 0 ? void 0 : _a.hold) || 0;
        var currentToHold = ((_b = to.pony.options) === null || _b === void 0 ? void 0 : _b.hold) || 0;
        if (currentFromHold || currentToHold !== toHold) {
            chat_1.saySystem(from, 'Pickup failed because item state changed');
            chat_1.saySystem(to, 'Pickup failed because item state changed');
            this.pending["delete"](id);
            return;
        }
        playerUtils_1.unholdItem(to.pony);
        playerUtils_1.holdItem(from.pony, toHold);
        chat_1.saySystem(from, "You took " + toItemName + " from " + entityUtils_1.getEntityName(to.pony, from));
        chat_1.saySystem(to, "You gave " + toItemName + " to " + entityUtils_1.getEntityName(from.pony, to));
        this.pending["delete"](id);
    };
    return HoldItemService;
}());
exports.HoldItemService = HoldItemService;
