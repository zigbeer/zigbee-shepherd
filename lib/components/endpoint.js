/* jshint node: true */
'use strict';

var _ = require('lodash');

function Endpoint(device, epId, inCList, outCList) { 
    var seqNum = 0;

    this.device = device;   // bind to device
    this.id = epId;
    this.profId = null;
    this.devId = null;
    this.inClusterList = null;
    this.outClusterList = null;

    this.clusters = [];
    // this.inClusters = [ { cId: 3, dir: 'in', attrs: [] } ];  // [ cInfo, ... ]
    // this.outClusters = [];

    // this is the zcl sequence number
    this.nextSeqNum = function () {
        if (++seqNum > 255)
            seqNum = 1;

        return seqNum;
    };
}




Endpoint.prototype.registerCluster = function (cId, dir, attrList, cmdList) {};
Endpoint.prototype.isZclSupported = function () {};
Endpoint.prototype.isPublicProfile = function () {};
Endpoint.prototype.isLocal = function () {
    return this.device.getNwkAddr() === 0;
};

Endpoint.prototype.send = function () {};
Endpoint.prototype.numInClusters = function () {};
Endpoint.prototype.numOutClusters = function () {};
Endpoint.prototype.inClusterList = function () {};
Endpoint.prototype.outClusterList = function () {};


// ep-manager
Endpoint.prototype.dump = function () {};
Endpoint.prototype.addCluster = function (cId, dir, attrs) {};

Endpoint.prototype.zclRequest = function (cId, valObj, callback) {};


// Foundation methods
// read, write, writeUndiv, writeNoRsp, configReport, readReportCfg, readStruct, discover, report
// readStruct and writeStrcut are not support by TI

var controller = this.device.getController();

util.inherits(Endpoint, EventEmitter);
