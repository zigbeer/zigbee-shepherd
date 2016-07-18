/* jshint node: true */
'use strict';

var _ = require('busyman');

// simpleDesc = { profId, epId, devId, inClusterList, outClusterList }
function Endpoint(device, simpleDesc) { 

    this.isLocal = function () {
        return false;    // this is a remote enpoint, always return false
    };

    //this._af = ;

    this.device = device;                   // bind to device
    this.profId = simpleDesc.profId;
    this.epId = simpleDesc.epId;
    this.devId = simpleDesc.devId;
    this.inClusterList = simpleDesc.inClusterList;      // numbered cluster ids
    this.outClusterList = simpleDesc.outClusterList;    // numbered cluster ids

    this.clusters = {};    // key is clusterId in string

    // this.clusters = {
    //     genBasic: {
    //         dir: 1,    // 0: 'unknown', 1: 'in', 2: 'out'
    //         attrs: {
    //             hwVersion: { value: 0, acl: READ }
    //         }
    //     }
    // };

    this.onAfDataConfirm = null;
    this.onAfReflectError = null;
    this.onAfIncomingMsg = null;
    this.onAfIncomingMsgExt = null;
    this.onZclFoundation = null;
    this.onZclFunctional = null;
}

Endpoint.prototype.dump = function () {
    return {
        profId: this.profId,
        epId: this.epId,
        devId: this.devId,
        inClusterList: _.cloneDeep(this.inClusterList),
        outClusterList: _.cloneDeep(this.outClusterList),
        clusters: _.cloneDeep(this.clusters)
    };
};

Endpoint.prototype.isZclSupported = function () {
    var zclSupport = false;
    if (this.profId < 0x8000 && this.devId < 0xc000)
        zclSupport = true;

    this.isZclSupported = function () {
        return zclSupport;
    };

    return zclSupport;
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

Endpoint.prototype.getDevId = function () {
    return this.devId;
};

Endpoint.prototype.getInClusterList = function () {
    return _.cloneDeep(this.inClusterList);
};

Endpoint.prototype.getOutClusterList = function () {
    return _.cloneDeep(this.outClusterList);
};

Endpoint.prototype.getClusterList = function () {
    var clusterList = this.getInClusterList();

    this.outClusterList.forEach(function (cId) {
        if (!_.includes(clusterList, cId)) 
            clusterList.push(cId);
    });

    return clusterList;
};

Endpoint.prototype.getNwkAddr = function () {
    return this.getDevice().getNwkAddr();
};

Endpoint.prototype.getManufId = function () {
    return this.getDevice().getManufId();
};

Endpoint.prototype.setAttrs = function (cIdString, attrs) {
    delete this.clusters[cIdString].attrs;
    this.clusters[cIdString].attrs = attrs;
};

Endpoint.prototype.update = function (simpleDesc) {
    this.profId = simpleDesc.profId;
    this.epId = simpleDesc.epId;
    this.devId = simpleDesc.devId;
    this.inClusterList = simpleDesc.inClusterList;
    this.outClusterList = simpleDesc.outClusterList;
};

// Endpoint.prototype.foundation = function (cId, cmd, payload, callback) {
//     return this._af.zclFoundation(this, this, cId, cmd, payload, callback);
// };

// Endpoint.prototype.functional = function (cId, cmd, valObj, callback) {
//     return this._af.zclFunctional(this, this, cId, cmd, valObj, callback);
// };

module.exports = Endpoint;
