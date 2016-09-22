/* jshint node: true */
'use strict';

var zdoHelper = require('./zdo_helper.js'),
    debug = {
        msgHdlr: require('debug')('zigbee-shepherd:msgHdlr')
    };

var bridge = {};

bridge._areqEventBridge = function (controller, msg) {
    // msg: { subsys: 'ZDO', ind: 'endDeviceAnnceInd', data: { srcaddr: 63536, nwkaddr: 63536, ieeeaddr: '0x00124b0001ce3631', ... }
    var mandatoryEvent = msg.subsys + ':' + msg.ind;    // 'SYS:resetInd', 'SYS:osalTimerExpired'

    controller.emit(mandatoryEvent, msg.data);          // bridge to subsystem events, like 'SYS:resetInd', 'SYS:osalTimerExpired'

    if (msg.subsys === 'AF')
        debug.msgHdlr('%s <-- %s, transId: %d', msg.subsys, msg.ind, msg.data.transid || msg.data.transseqnumber);
    else
        debug.msgHdlr('%s <-- %s', msg.subsys, msg.ind);

    // dispatch to specific event bridge
    if (msg.subsys === 'ZDO')
        bridge._zdoIndicationEventBridge(controller, msg);
    else if (msg.subsys === 'SAPI')
        bridge._sapiIndicationEventBridge(controller, msg);
    // else: Do nothing. No need to bridge: SYS, MAC, NWK, UTIL, DBG, APP
};

bridge._zdoIndicationEventBridge = function (controller, msg) {
    var payload = msg.data,
        zdoEventHead = 'ZDO:' + msg.ind,
        zdoBridgedEvent;

    if (msg.ind === 'stateChangeInd') {    // this is a special event
        if (!payload.hasOwnProperty('nwkaddr'))    // Coord itself
            zdoBridgedEvent = 'coordStateInd';
        else if (payload.state === 0x83 || payload.state === 'NOT_ACTIVE')
            zdoBridgedEvent = zdoEventHead + ':' + payload.nwkaddr + ':NOT_ACTIVE';
        else if (payload.state === 0x82 || payload.state === 'INVALID_EP')
            zdoBridgedEvent = zdoEventHead + ':' + payload.nwkaddr + ':INVALID_EP';
    } else {
        zdoBridgedEvent = zdoHelper.generateEventOfIndication(msg.ind, payload);
    }

    if (zdoBridgedEvent) {
        controller.emit(zdoBridgedEvent, payload);
    }
};

bridge._sapiIndicationEventBridge = function (controller, msg) {
    var payload = msg.data,
        sapiEventHead = 'SAPI:' + msg.ind,
        sapiBridgedEvent;

    switch (msg.ind) {
        case 'bindConfirm':
            sapiBridgedEvent = sapiEventHead + ':' + payload.commandid;
            break;
        case 'sendDataConfirm':
            sapiBridgedEvent = sapiEventHead + ':' + payload.handle;
            break;
        case 'receiveDataIndication':
            sapiBridgedEvent = sapiEventHead + ':' + payload.source + ':' + payload.command;
            break;
        case 'findDeviceConfirm':
            if (payload.hasOwnProperty('result'))
                sapiBridgedEvent = sapiEventHead + ':' + payload.result;
            break;
        default:    // startConfirm and allowBindConfirm need no bridging
            break;
    }

    if (sapiBridgedEvent)
        controller.emit(sapiBridgedEvent, payload);
};

module.exports = bridge;
