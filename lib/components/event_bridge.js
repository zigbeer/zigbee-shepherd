/* jshint node: true */
'use strict';

var zcl = require('zcl-packet');
var zdoHelper = require('./zdo_helper.js');
var bridge = {};

bridge._areqEventBridge = function (controller, msg) {
    // msg: { subsys: 'ZDO', ind: 'endDeviceAnnceInd', data: { srcaddr: 63536, nwkaddr: 63536, ieeeaddr: '0x00124b0001ce3631', ... }
    var mandatoryEvent = msg.subsys + ':' + msg.ind;       // 'SYS:resetInd', 'SYS:osalTimerExpired'

    controller.emit(mandatoryEvent, msg.data);             // bridge to subsystem events, like 'SYS:resetInd', 'SYS:osalTimerExpired'

    // dispatch to specific event bridge
    if (msg.subsys === 'ZDO')
        bridge._zdoIndicationEventBridge(controller, msg);
    else if (msg.subsys === 'SAPI')
        bridge._sapiIndicationEventBridge(controller, msg);
    // else: Do nothing. No need to bridge: SYS, MAC, NWK, UTIL, DBG, APP
};

bridge._zdoIndicationEventBridge = function (controller, msg) {
    // msg: { subsys: 'ZDO', ind: 'endDeviceAnnceInd', data: { srcaddr: 63536, nwkaddr: 63536, ieeeaddr: '0x00124b0001ce3631', ... }
    var payload = msg.data,
        zdoEventHead = 'ZDO:' + msg.ind,
        zdoBridgedEvent;

    if (msg.ind === 'stateChangeInd') {     // this is a special event

        if (!payload.hasOwnProperty('nwkaddr')) // Coord itself
            zdoBridgedEvent = 'coordStateInd';  // console.log('Coord is now in state: ' + payload.state);
        else if (payload.state === 0x83 || payload.state === 'NOT_ACTIVE')
            zdoBridgedEvent = zdoEventHead + ':' + payload.nwkaddr + ':NOT_ACTIVE';
        else if (payload.state === 0x82 || payload.state === 'INVALID_EP')
            zdoBridgedEvent = zdoEventHead + ':' + payload.nwkaddr + ':INVALID_EP';

    } else {
        zdoBridgedEvent = zdoHelper.generateEventOfIndication(msg.ind, payload);
    }

    if (zdoBridgedEvent) {
        controller.emit(zdoBridgedEvent, payload);
        controller._invokeAreqCallback(zdoBridgedEvent, null, payload);
    }
};

bridge._sapiIndicationEventBridge = function (controller, msg) {
    var payload = msg.data,
        afEventHead = 'SAPI:' + msg.ind,
        afBridgedEvent;

    switch (msg.ind) {
        case 'bindConfirm':
            afBridgedEvent = afEventHead + ':' + payload.commandid;
            break;
        case 'sendDataConfirm':
            afBridgedEvent = afEventHead + ':' + payload.handle;
            break;
        case 'receiveDataIndication':
            afBridgedEvent = afEventHead + ':' + payload.source + ':' + payload.command;
            break;
        case 'findDeviceConfirm':
            if (payload.hasOwnProperty('result'))
                afBridgedEvent = afEventHead + ':' + payload.result; // [TODO] payload.result is IEEE ADDR check if should transform
            break;
        default:    // startConfirm and allowBindConfirm need no bridging
            break;
    }

    if (afBridgedEvent)
        controller.emit(afBridgedEvent, payload);
};

module.exports = bridge;
