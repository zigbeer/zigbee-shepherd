/* jshint node: true */
'use strict';

var _ = require('busyman');

// devInfo = { type, ieeeAddr, nwkAddr, manufId, epList }
function Device(devInfo) {
    this._id = null;

    this.type = devInfo.type;
    this.ieeeAddr = devInfo.ieeeAddr;
    this.nwkAddr = devInfo.nwkAddr;
    this.status = 'unknown';    // 0: 'unknown', 1: 'offline', 2: 'online', 3: 'removed', 4: 'not_applicable'
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
        id: this._id,
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

Device.prototype.getId = function () {
    return this._id;
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

Device.prototype.setNetInfo = function (info) {
    var self = this;

    if (!_.isPlainObject(info))
        throw new TypeError('info should be an object');

    _.forEach(this, function (val, key) {
        if (_.has(info, key))
            self[key] = info[key];
    });

    return this;
};

Device.prototype._setId = function (id) {
    this._id = id;
};

Device.prototype.recoverFromRecord = function (rec) {
    this._recovered = true;
    this.status = 'unknown';    // dev status should be 'unknown' when recovered
    // coord should be 'online'
    this._setId(rec.id);

    return this;
};

module.exports = Device;

// var devInfos = [ 'type', 'ieeeAddr', 'nwkAddr', 'manufId', 'epList' ];

// devInfos.forEach(function (info) {
//     if (_.has(devInfo, info))
//         this[info] = devInfo[info];
// });