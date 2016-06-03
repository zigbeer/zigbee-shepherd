/* jshint node: true */
'use strict';
var zclId = require('zcl-id'),
    _ = require('busyman');

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


    this.isLocal = function () {
        return false;   // this is a remote enpoint, always return false
    };

    this.isDelegator = function () {
        return false;   // this is a remote enpoint, can never be a delegator on coord
    };

    this._receiveAfIncominfMsg = function (msg) {
        // dispatch to onAfIncomingMsg, ...
    };

    this._receiveZclMsg = function (msg) {
        // msg: { frameCntl: { frameType, manufSpec, direction, disDefaultRsp }, manufCode, seqNum, cmd, payload }
        // dispatch to onZclFoundation, onZclFunctional
        if (0 === msg.frameCntl.frameType)
            this.onZclFoundation(msg);
        else if (1 === msg.frameCntl.frameType)
            this.onZclFunctional(msg);
    };

    this.onZclFoundation = function (msg) {};
    this.onZclFunctional = function (msg) {};

    this.onAfReflectError = function (msg) {};
    this.onAfIncomingMsgExt = function (msg) {};
    this.onAfIncomingMsg = function () {};
    this.onAfDataConfirm = function (cnfMsg) {};

    this.afDataSend = function (cId, rawData, opt, callback) {
        return this.getController().afDataSend(this, cId, rawData, opt, callback);
    };
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
        numOutClusters: this.outCList.length,
        outCList: this.outCList,
        clusters: dumpOfClusters
    };
};

Endpoint.prototype.isRegistered = function () {
    return !_.isNil(this._id);
};

Endpoint.prototype.getDevice = function () {
    return this.device;
};

Endpoint.prototype.getController = function () {
    return this.device.getController();
};

Endpoint.prototype.getProfId = function () {
    return this.profId;
};

Endpoint.prototype.getEpId = function () {
    return this.epId;
};



Endpoint.prototype.isZclSupported = function () {
    var shepherd = this.getDevice().getController().getShepherd();

    return shepherd._checkZclSupport(this.profId, this.getDevice().getManufId(), this.devId);
};

Endpoint.prototype.syncCluster = function () {
    var self = this;

    this.inCList.forEach(function (cId) {
        self.getController.querie.clusterWithAttributes(self, cId).then(function (cInfo) {
            var cluster;
            cInfo.dir = 1;    // in cluster
            cluster = new Cluster(self, cInfo);
            cluster.attrs = cInfo.attributes;
            self.addCluster(cluster);
        });
    });

    this.outCList.forEach(function (cId) {
        self.getController.querie.clusterWithAttributes(self, cId).then(function (cInfo) {
            var cluster;
            cInfo.dir = 2;    // out cluster
            cluster = new Cluster(self, cInfo);
            cluster.attrs = cInfo.attributes;
            self.addCluster(cluster);
        });
    });
};

Endpoint.prototype.hasCluster = function (cId) {
    return this.clusters.find(function (cluster) {
        return cluster.getClusterId() === cId;
    });
};

Endpoint.prototype.hasOutCluster = function (cId) {
};

Endpoint.prototype.hasInCluster = function (cId) {
};

//---------------------------------------------------------------------------------------------
Endpoint.prototype.registerCluster = function (cId, dir, attrList, cmdList) {};

Endpoint.prototype.send = function () {};

// ep-manager
Endpoint.prototype.addCluster = function (cluster) {
    var added = false;

    if (!this.getCluster(cluster.getClusterId())) {
        this.clusters.push(cluster);
        added = true;
    }

    return added;
};

Endpoint.prototype.zclRequest = function (cId, valObj, callback) {};

Endpoint.prototype.foundationReq = function(cId, valObj, callback) {};
Endpoint.prototype.functionalReq = function(cId, cmdId, valObj, callback) {};

Endpoint.prototype.zclRead = function (cId, attrIdArray, callback) {
    return this.getController.zclRead(this, cId, attrIdArray, callback);
};

Endpoint.prototype.zclWrite = function (cId, recArray, callback) {
    return this.getController.zclWrite(this, cId, recArray, callback);
};

Endpoint.prototype.zclConfigReport = function (cId, recArray, callback) {
    return this.getController.zclConfigReport(this, cId, recArray, callback);
};

Endpoint.prototype.zclReadReportConfig = function (cId, recArray, callback) {
    return this.getController.zclReadReportConfig(this, cId, recArray, callback);
};

Endpoint.prototype.zclReport = function (cId, recArray, callback) {
    return this.getController.zclReport(this, cId, recArray, callback);
};

Endpoint.prototype.zclReadStruct = function (cId, recArray, callback) {
    return this.getController.zclReadStruct(this, cId, recArray, callback);
};

Endpoint.prototype.zclWriteStrcut = function (cId, recArray, callback) {
    return this.getController.zclWriteStrcut(this, cId, recArray, callback);
};

Endpoint.prototype.zclDiscover = function (cId, startAttrId, maxAttrIds, callback) {
    return this.getController.zclDiscover(this, startAttrId, maxAttrIds, callback);
};

Endpoint.prototype.zclFunctional = function(cId, cmdId, valObj, callback) {
    return this.getController.zclCommand(this, cId, cmdId, valObj, callback);
};

// Foundation methods
// read, write, writeUndiv, writeNoRsp, configReport, readReportCfg, discover, report
// readStruct and writeStrcut are not support by TI

var controller = this.device.getController();

util.inherits(Endpoint, EventEmitter);
