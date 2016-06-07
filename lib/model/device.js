/* jshint node: true */
'use strict';

var _ = require('busyman');

// devInfo = { type, ieeeAddr, nwkAddr, manufId, epList }
function Device(devInfo) {
    this._controller = null;
    this._id = null;

    this._net = {
        type: devInfo.type,
        ieeeAddr: devInfo.ieeeAddr,
        nwkAddr: devInfo.nwkAddr,
        status: 'offline',  // 0: 'unknown', 1: 'offline', 2: 'online', 3: 'removed', 4: 'not_applicable'
        joinTime: null
    };

    this.manufId = devInfo.manufId;
    this.epList = devInfo.epList;
    this.endpoints = [];    // dev.registerEp();
}

/*************************************************************************************************/
/*** Device Utility APIs                                                                       ***/
/*************************************************************************************************/
Device.prototype.isRegistered = function () {
    return !_.isNil(this._id) && this.getController();
};

Device.prototype.getController = function () {
    return this._controller;
};

Device.prototype.getIeeeAddr = function () {
    return this._net.ieeeAddr;
};

Device.prototype.getNwkAddr = function () {
    return this._net.nwkAddr;
};

Device.prototype.getStatus = function () {
    return this._net.status;
};

Device.prototype.getManufId = function () {
    return this.manufId;
};

Device.prototype.getEpList = function () {
    return _.cloneDeep(this.epList);
};

Device.prototype.findEndpoint = function (epId) {
    return this.endpoints.find(function (ep) {
        return ep.getEpId() === epId;
    });
};

Device.prototype.setController = function (controller) {
    this._controller = controller;
    return this;
};

/*************************************************************************************************/
/*** Public APIs                                                                               ***/
/*************************************************************************************************/
Device.prototype.dump = function () {
    var dumpOfEps = [];

    this.endpoints.forEach(function (ep) {
        dumpOfEps.push(ep.dump());
    });

    return {
        net: _.cloneDeep(this._net),
        manufId: this.manufId,
        //joinTime: this.joinTime,
        numEndpoints: this.epList.length,
        epList: _.cloneDeep(this.epList),
        endpoints: dumpOfEps,
    };
};

Device.prototype.addEndpoint = function (ep) {
    var added = false;

    if (!this.findEndpoint(ep.getEpId())) {
        this.endpoints.push(ep);
        added = true;
    }

    return added;
};

/*************************************************************************************************/
/*** Protected Methods                                                                         ***/
/*************************************************************************************************/
Device.prototype._notReadyEndpoints = function () {
    var self = this,
        epsNotReady = [];

    this.epList.forEach(function (epId) {
        if (!self.findEndpoint(epId))
            epsNotReady.push(epId);
    });

    return epsNotReady;
};

Device.prototype.getNetInfo = function () {
    return _.cloneDeep(this._net);
};

Device.prototype.setNetInfo = function (valObj) {
    _.forEach(function (val, arg) {
        this._net[arg] = val;
    });
};

module.exports = Device;

// Device.prototype.restore = function () {};
// Device.prototype.getCluster = function () {};
// Device.prototype.bindEp = function () {};
// Device.prototype.enableLifeChecker = function () {};
// Device.prototype.disableLifeChecker = function () {};
// Device.prototype.dbRead = function () {};
// Device.prototype.dbSave = function () {};
// Device.prototype.dbRemove = function () {};
// Device.prototype.replaceEp = function () {};
// Device.prototype.updateEp = function () {};
// Device.prototype.updateCluster = function () {};
// Device.prototype.updateAttrs = function () {};

// Device.prototype._addClst = function (epId, dir, cluster) {
//     var ep = this.findEp(epId);
//     ep.addCluster(dir, cluster);
// };

// Device.prototype._addAttrToClst = function (epId, cId, attr) {};

/*************************************************************************************************/
/*** Remote                                                                                    ***/
/*************************************************************************************************/
// MAC: dataReq, disassociateReq
// AF: dataRequest, dataRequestExt, dataRequestSrcRtg
// ZDO: nwkAddrReq, ieeeAddrReq, nodeDescReq, powerDescReq, ... many
// SAPI: permitJoiningRequest, bindDevice, sendDataRequest

// Device.prototype.nwkAddrReq = function () {};
// Device.prototype.readAttrReq = function () {};
// Device.prototype.routeTableReq = function () {};
