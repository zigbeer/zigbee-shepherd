/* jshint node: true */
'use strict';

var util = rquire('util');
var Endpoint = require('./endpoint');

// This class in not opened, should use a app creators
// epInfo = { device, profId, epId, devId, inCList, outCList }
function Coordpoint(coord, epInfo, isDelegator) {
    // coordpoint is a endpoint, but a "LOCAL" endpoint
    // This class is used to create delegators, local applications
    Endpoint.call(this, device, epInfo);
    this.device = coord;

    this._delegated = isDelegator || false;

    // pass to zapp
    this._onAfIncomingMsg = null;
    this._onAfDataConfirm = null;
    this._onAfReflectError = null;
    this._onAfIncomingMsgExt = null;
    this._onZclFoundation = null;
    this._onZclFunctional = null;

    this.onZclFoundation = function (msg) {};
    this.onZclFunctional = function (msg) {};

    this.onAfReflectError = function (msg) {};
    this.onAfIncomingMsgExt = function (msg) {};
    this.onAfIncomingMsg = function () {};
    this.onAfDataConfirm = function (cnfMsg) {

        // msghub.on(afCnfEventName, function (cnfMsg) {
        //     var oTransac = epSelf._transHolder[cnfMsg.transid],
        //         returnStatus = cnfMsg.status.key;

        //     if (oTransac) {
        //         if (returnStatus === 'ZSuccess') {
        //             oTransac.oDeferred.resolve(cnfMsg);
        //             epSelf._transHolder[cnfMsg.transid] = null;
        //             delete epSelf._transHolder[cnfMsg.transid];
        //         } else if (returnStatus === 'ZNwkNoRoute') {
        //             oTransac.oDeferred.reject(new Error('No network route. Please confirm that the device has (re)joined the network.'));
        //             epSelf._transHolder[cnfMsg.transid] = null;
        //             delete epSelf._transHolder[cnfMsg.transid];
        //         } else if (returnStatus === 'ZMacNoACK' || returnStatus === 'ZApsNoAck' || returnStatus === 'ZMacTransactionExpired') {
        //             // ZApsNoAck period is 20 secs
        //             // ZMacTransactionExpired is 8 secs
        //             reSendAfData(epSelf, oTransac, returnStatus, reSendTimeLimit);
        //         } else {
        //             oTransac.oDeferred.reject(new Error('Status ' + returnStatus + ' returns.'));
        //             epSelf._transHolder[cnfMsg.transid] = null;
        //             delete epSelf._transHolder[cnfMsg.transid];
        //         }
        //     } else {
        //         epSelf.emit('ZCL_CNF:UNHANDLED', cnfMsg);
        //     }
        // });

    };
}

util.inherits(Coordpoint, Endpoint);

Coordpoint.prototype.isRegistered = function () {

};

this.bindZbEpClusterToMe = function (zbEp, cId, callback) {
    return zbCoord.bindZbEpToLocalEp(zbEp, cId, epSelf, callback);   // bindZbEpToLocalEp() is a promise
};

// This is the send function of a delegator or local endpoint
this.sendAfData = function (targetEp, afArg, callback) {  // cId and raw data are in afArg
    return sendAfData(epSelf, targetEp, afArg, callback);
};

this.groupcastAfData = function (groupId, clusterId, cmdId, argInst, callback) {
    return sendAfDataBroadcast(epSelf, ZDEFS.AddressMode.AddrGroup.value, groupId, clusterId, cmdId, argInst, callback);
};

this.broadcastAfData = function (clusterId, cmdId, argInst, callback) {
    return sendAfDataBroadcast(epSelf, ZDEFS.AddressMode.AddrBroadcast.value, 0xFFFF, clusterId, cmdId, argInst, callback);
};
