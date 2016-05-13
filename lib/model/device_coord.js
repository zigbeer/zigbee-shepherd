var util = rquire('util');
var Device = require('./device');

function Coordinator(info) {
    // coordinator is a device, but a "LOCAL" device
    // this class distinguishes itself from Device
    Device.call(this, info);
}

util.inherits(Coordinator, Device);

/*************************************************************************************************/
/*** Public APIs                                                                               ***/
/*************************************************************************************************/
Coordinator.prototype.findEndpointByEpId = function (epId) {};
Coordinator.prototype.findEndpointByProfId = function (profId) {};
Coordinator.prototype.findDelegatorByProfId = function (profId) {};


Coordinator.prototype.registerEndpointReq = function (epInfo, callback) {};
Coordinator.prototype.unRegisterEp = function (epId, callback) {};
Coordinator.prototype.reRegisterEp = function (epInfo, callback) {};
Coordinator.prototype.bindZbEpToMe = function (zbEp, cId, localEp, callback) {};
Coordinator.prototype.newLocalApp = function (zbApp, callback) {};
Coordinator.prototype.registerSysEp = function () {};

// afEventNameForLocalEp = 'AF:INCOMING_MSG:' + zutil.convToHexString(coordDev.ieeeAddr, 'uint32') + ':' + zutil.convToHexString(msgobj.msg.dstendpoint, 'uint8');
