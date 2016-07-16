/* jshint node: true */
'use strict';

var util = require('util'),
    _ = require('busyman');

var Device = require('./device');

// devInfo = { type, ieeeAddr, nwkAddr, manufId, epList }
function Coordinator(devInfo) {
    Device.call(this, devInfo);

    // this.type = devInfo.type;
    // this.ieeeAddr = devInfo.ieeeAddr;
    // this.nwkAddr = devInfo.nwkAddr;
    // this.status = 'offline';
    // this.joinTime = null;

    // this.manufId = devInfo.manufId;
    // this.epList = devInfo.epList;
    // this.endpoints = {};
}
// Device.prototype.dump = function () {};
// Device.prototype.getEndpoint = function (epId) {};
// Device.prototype.getIeeeAddr = function () {};
// Device.prototype.getNwkAddr = function () {};
// Device.prototype.getManufId = function () {};
// Device.prototype.update = function (devInfo) {};

util.inherits(Coordinator, Device);

Coordinator.prototype.getDelegator = function (profId) {
    var delEp = null;

    _.forEach(this.endpoints, function (ep) {
        if (ep.isDelegator() && ep.getProfId() === profId)
            delEp = ep;
    });

    return delEp;
};

module.exports = Coordinator;
