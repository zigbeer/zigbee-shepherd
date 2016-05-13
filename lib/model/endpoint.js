/* jshint node: true */
'use strict';

// epInfo = { profId, epId, devId, inCList, outCList }
function Endpoint(device, epInfo) { 
    var seqNum = 0;

    this._id = null;
    this.device = device;               // bind to device
    this.profId = epInfo.profId;
    this.epId = epInfo.epId;
    this.devId = epInfo.devId;
    this.inCList = epInfo.inCList;      // numbered cluster ids
    this.outCList = epInfo.outCList;    // numbered cluster ids

    this.clusters = {};                 // key is clusterId in string, or number if cannot resolved
                                        // dir: 0 'unknown', 1: 'in', 2: 'out', 3: 'inout'
    // { genBasic: { dir: } }
    // this.inClusters = [ { cId: 3, dir: 'in', attrs: [] } ];  // [ cInfo, ... ]

    this.onZclFoundation = function (msg) {};
    this.onZclFunctional = function (msg) {};

    this.onAfReflectError = function (msg) {};
    this.onAfIncomingMsgExt = function (msg) {};
    this.onAfIncomingMsg = function () {};
    this.onAfDataConfirm = function (cnfMsg) {};
}

Endpoint.prototype.dump = function () {
    var dumpOfClusters = [];

    this.clusters.forEach(function (clst) {
        dumpOfClusters.push(clst.dump());
    });

    return {
        profId: this.profId,
        epId: this.epId,
        devId: this.devId,
        numInClusters: this.inCList.length,
        inCList: this.inCList,
        numOutClusters: this.inCList.length,
        outCList: this.outCList.length,
        clusters: dumpOfClusters
    };
};

Endpoint.prototype.isRegistered = function () {
    return !_.isNil(this._id);
};

Endpoint.prototype.getDevice = function () {
    return this.device;
};

Endpoint.prototype.getProfId = function () {
    return this.profId;
};

Endpoint.prototype.getEpId = function () {
    return this.epId;
};

Endpoint.prototype.isZclSupported = function () {
    var shepherd = this.getDevice()._getController()._getShepherd();

    shepherd._checkZclSupport(this.profId, this.getDevice().getManufId(), this.devId);
};

Endpoint.prototype.isLocal = function () {
    return this.device.getNwkAddr() === 0;
};

Endpoint.prototype.isDelegator = function () {
    return !!this._delegated;
};

Endpoint.prototype.syncCluster = function () {
};

Endpoint.prototype.hasCluster = function (cId) {
};

Endpoint.prototype.hasOutCluster = function (cId) {
};

Endpoint.prototype.hasInCluster = function (cId) {
};

//---------------------------------------------------------------------------------------------
Endpoint.prototype.registerCluster = function (cId, dir, attrList, cmdList) {};

Endpoint.prototype.send = function () {};

// ep-manager
Endpoint.prototype.addCluster = function (cId, dir, attrs) {};
Endpoint.prototype.zclRequest = function (cId, valObj, callback) {};

Endpoint.prototype.foundationReq = function(cId, valObj, callback) {};
Endpoint.prototype.functionalReq = function(cId, cmdId, valObj, callback) {};

// Foundation methods
// read, write, writeUndiv, writeNoRsp, configReport, readReportCfg, readStruct, discover, report
// readStruct and writeStrcut are not support by TI

var controller = this.device.getController();

util.inherits(Endpoint, EventEmitter);
