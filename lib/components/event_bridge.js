var zdoHelper = require('./zdo_helper.js');
var bridge = {};

bridge._areqEventBridge = function (controller, msg) {
    // msg: { subsys: 'ZDO', ind: 'endDeviceAnnceInd', data: { srcaddr: 63536, nwkaddr: 63536, ieeeaddr: '0x00124b0001ce3631', ... }
    var mandatoryEvent1 = 'ind',
        mandatoryEvent2 = msg.subsys + ':' + msg.ind;   // SYS:resetInd, SYS:osalTimerExpired

    controller.emit(mandatoryEvent1, msg);                    // bridge 'AREQ' to 'ind' event
    controller.emit(mandatoryEvent2, msg.data);               // bridge to subsystem events, like 'SYS:resetInd', 'SYS:osalTimerExpired'

    // dispatch to event bridge
    if (msg.subsys === 'AF')
        bridge._afIndicationEventBridge(controller, msg);     // AF_INCOMING_MSG and AF_INCOMING_MSG_EXT require special handling that bridge cannot simply handle with
    else if (msg.subsys === 'ZDO')
        bridge._zdoIndicationEventBridge(controller, msg);
    else if (msg.subsys === 'SAPI')
        bridge._sapiIndicationEventBridge(controller, msg);
    // else: Do nothing. No need to bridge: SYS, MAC, NWK, UTIL, DBG, APP
};

bridge._afIndicationEventBridge = function (controller, msg) {
//  - dataConfirm,      { status, endpoint, transid }
//  - reflectError,     { status, endpoint, transid, dstaddrmode, dstaddr }
//  - incomingMsg,      { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, securityuse, timestamp, transseqnumber, len, data }
//  - incomingMsgExt,   { groupid, clusterid, srcaddrmode, srcaddr, srcendpoint, srcpanid, dstendpoint, wasbroadcast, linkquality, securityuse, timestamp, transseqnumber, len, data }
    var shepherd = controller._shepherd,
        coord = shepherd ? shepherd.coord : undefined,
        payload = msg.data,
        afEventHead = 'AF:' + msg.ind;

    switch (msg.ind) {
        case 'dataConfirm':
            var afEventCnf = afEventHead + ':' + payload.endpoint + ':' + payload.transid;
            controller.emit(afEventCnf, payload);
            // remoteEp.onAfDataConfirm = function (cnfMsg) {};
            break;
        case 'reflectError':
            // reflectError: [ 'endpoint', 'transid' ]
            // remoteEp.onAfReflectError = function (msg) {};
            break;
        case 'incomingMsg':
            var remoteDev = shepherd.findDev({ nwAddr: payload.srcaddr }),
                remoteEpId = payload.srcendpoint,
                localEpId = payload.dstendpoint,
                remoteEp = remoteDev.findEpdpoint(remoteEpId),
                coordEp = controller.coord.findEpdpoint(localEpId),
                afEventGeneric = afEventHead + ':' + payload.srcaddr + ':' + payload.clusterid + ':' + localEpId,   // why this?
                afEventToRemoteEp,
                afEventTLocalEp;

            controller.emit(afEventGeneric, payload);

            if (!remoteDev) {
                // [TODO] message from unknown device
                remoteEp._onAfIncomingMsg(payload);
                remoteEp.onAfIncomingMsg(payload);
            } else {
                // afEventToRemoteEp = afEventHead + ':' + remoteDev.getIeeeAddr() + ':' + remoteEpId;
                // controller.emit(afEventToRemoteEp, payload);
                remoteEp.onAfIncomingMsg(payload);
            }

            if (coord) {
                // afEventTLocalEp = afEventHead + ':' + coord.getIeeeAddr() + ':' + localEpId;
                // controller.emit(afEventTLocalEp, payload);
            }

            if (coordEp) {
                coordEp._onAfIncomingMsg(payload);
                coordEp.onAfIncomingMsg(payload);
            }

            // zcl parsing
            controller._zclIndicationEventBridge(msg);
            break;
        case 'incomingMsgExt':
            // remoteEp.onAfIncomingMsgExt = function (msg) {};

            break;
        default:
            break;
    }
};

bridge._zdoIndicationEventBridge = function (controller, msg) {
    var payload = msg.data,
        zdoEventHead = 'ZDO:' + msg.ind,
        zdoBridgedEvent;

    if (msg.ind === 'stateChangeInd') { // this is a special event
        if (payload.state === 0x83 || payload.state === 'NOT_ACTIVE')                 // [TODO] is a string or a number?
            zdoBridgedEvent = zdoEventHead + ':' + payload.nwkaddr + ':NOT_ACTIVE';
        else if (payload.state === 0x82 || payload.state === 'INVALID_EP')            // [TODO] is a string or a number?
            zdoBridgedEvent = zdoEventHead + ':' + payload.nwkaddr + ':INVALID_EP';
        else if (!payload.hasOwnProperty('nwkaddr'))    // Coord itself
            console.log('Coord is now in state: ' + payload.state);
    } else {
        zdoBridgedEvent = zdoHelper.generateEventOfIndication(msg.ind, payload);
    }

    if (zdoBridgedEvent)
        controller.emit(zdoBridgedEvent, payload);
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

bridge._zclIndicationEventBridge = function (controller, msg) {
    var remoteDev = shepherd.findDev({ nwAddr: payload.srcaddr }),  // remoteDev may be a local one
        remoteEpId = payload.srcendpoint,
        localEpId = payload.dstendpoint,
        afEventGeneric = afEventHead + ':' + payload.srcaddr + ':' + payload.clusterid + ':' + localEpId,   // why this?
        afEventToRemoteEp,
        afEventTLocalEp,
        remoteEp,
        isRemoteEp = false,
        isDstEpDelegator = false,
        clusterId = msg.clusterid,
        zclPayload = msg.data;

    if (!remoteDev)
        return;     // unknown device

    remoteEp = remoteDev.findEpdpoint(remoteEpId);

    if (!remoteEp)
        return;     // unknown endpoint

    isRemoteEp = !!remoteEp.isLocal();
    isDstEpDelegator = remoteEp.isDelegator();

    if (isRemoteEp && !isDstEpDelegator)
        return; // msg is from a remote ep, but this msg is to a local ep, just return and do nothing.
                // Local ep will handle this message, since the same message is also going to local ep.

    if (!remoteEp.isZclSupported())
        return; // unsupport zcl, no further parsing required

    // here, deal with public profile or private profile that supports zcl style
    zcl.parse(zclPayload, clusterId, function (err, zclMsg) {
        if (err)
            return;

        var frameType = zclMsg.frameCntl.frameType,
            direction = zclMsg.frameCntl.direction;

        if (frameType === 0) {          // FOUNDATION, across entire profile
            if (!isRemoteEp) {
                controller.emit('ZCL:FOUNDATION', zclMsg);    // [TODO] zclMsg need new format?
            } else {
                if (direction === 0)                                    // zcl msg received from client side of node clusters
                    controller.emit('ZCL:FOUNDATION:' + zclMsg.cmd, zclMsg);
                else if (direction === 1)                               // zcl msg received from server side of node clusters
                    controller.emit('ZCL:FOUNDATION:' + zclMsg.cmd + ':' + zclMsg.seqNum, zclMsg);
            }
        } else if (frameType === 1) {   // FUNCTIONAL, cluster-specific
            if (!isRemoteEp) {
                controller.emit('ZCL:FUNCTIONAL', zclMsg);    // [TODO] zclMsg need new format?
            } else {
                if (direction === 0)                                    // zcl msg received from server side of node clusters
                    console.log(zclMsg.cmd + ':TODO: Server side of Coord clusters has not been implemented yet!');     
                else if (direction === 1)                               // zcl msg received from client side of node clusters
                    controller.emit('ZCL:FUNCTIONAL:' + zclMsg.cmd + ':' + zclMsg.seqNum, zclMsg);
            }
        } else {
            console.log('Unrecognized zcl frame type.');
        }
    });
};

module.exports = bridge;
