/* jshint node: true */
'use strict';

var _ = require('busyman');

// devInfo = { type, ieeeAddr, nwkAddr, manufId, epList }
function Device(devInfo) {
    this.type = devInfo.type;
    this.ieeeAddr = devInfo.ieeeAddr;
    this.nwkAddr = devInfo.nwkAddr;
    this.status = 'offline';    // 0: 'unknown', 1: 'offline', 2: 'online', 3: 'removed', 4: 'not_applicable'
    this.joinTime = null;

    this.manufId = devInfo.manufId;
    this.epList = devInfo.epList;
    this.endpoints = {};
    // { epId: epInst, epId: epInst, ... }
}

Device.prototype.dump = function () {
    var dumpOfEps = {};

    _.forEach(this.endpoints, function (ep, epId) {
        dumpOfEps[epId] = ep.dump();
    });

    return {
        type: this.type,
        ieeeAddr: this.ieeeAddr,
        nwkAddr: this.nwkAddr,
        status: this.status,
        joinTime: this.joinTime,
        manufId: this.manufId,
        epList: _.cloneDeep(this.epList),
        endpoints: dumpOfEps
    };
};

Device.prototype.getEndpoint = function (epId) {
    return this.endpoints[epId];
};

Device.prototype.getIeeeAddr = function () {
    return this.ieeeAddr;
};

Device.prototype.getNwkAddr = function () {
    return this.nwkAddr;
};

Device.prototype.getManufId = function () {
    return this.manufId;
};

Device.prototype.update = function (devInfo) {
    this.type = devInfo.type;
    this.ieeeAddr = devInfo.ieeeAddr;
    this.nwkAddr = devInfo.nwkAddr;
    this.manufId = devInfo.manufId;
    this.epList = devInfo.epList;
};

module.exports = Device;
