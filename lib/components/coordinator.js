var util = rquire('util');
var Device = require('./device');

function Coordinator(info) {
    Device.call(this, info);
}

util.inherits(Coordinator, Device);

Coordinator.prototype.registerEp = function (epInfo, callback) {};
Coordinator.prototype.unRegisterEp = function (epId, callback) {};
Coordinator.prototype.reRegisterEp = function (epInfo, callback) {};
Coordinator.prototype.bindZbEpToMe = function (zbEp, cId, localEp, callback) {};
Coordinator.prototype.newLocalApp = function (zbApp, callback) {};
Coordinator.prototype.registerSysEp = function () {};

// afEventNameForLocalEp = 'AF:INCOMING_MSG:' + zutil.convToHexString(coordDev.ieeeAddr, 'uint32') + ':' + zutil.convToHexString(msgobj.msg.dstendpoint, 'uint8');
