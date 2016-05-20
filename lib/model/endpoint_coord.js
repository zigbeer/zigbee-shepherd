/* jshint node: true */
'use strict';

var util = require('util');
var Endpoint = require('./endpoint');
var Cluster = require('./cluster');
var zclId = require('zcl-id');
var _ = require('lodash');

// This class in not opened, should use a app creators
// epInfo = { device, profId, epId, devId, inCList, outCList }
function Coordpoint(coord, epInfo, isDelegator) {
    // coordpoint is a endpoint, but a "LOCAL" endpoint
    // This class is used to create delegators, local applications
    var seqNum = 0;
    var delegated = isDelegator || false;

    Endpoint.call(this, coord, epInfo);
    this._acl = {    // access control
        // cId: {
        //     attrId: {
        //         access: READ,
        //         type: 'number'
        //     }
        // },
    };
    this._receiveAfIncominfMsg = function (msg) {
        // dispatch to onAfIncomingMsg, ...
    };
    // Endpoint
    // this._id = null;
    // this.device = device;               // bind to device
    // this.profId = epInfo.profId;
    // this.epId = epInfo.epId;
    // this.devId = epInfo.devId;
    // this.inCList = epInfo.inCList;      // numbered cluster ids
    // this.outCList = epInfo.outCList;    // numbered cluster ids

    // this.clusters = {};                 // key is clusterId in string, or number if cannot resolved
    //                                     // dir: 0 'unknown', 1: 'in', 2: 'out', 3: 'inout'
    // // { genBasic: { dir: } }
    // // this.inClusters = [ { cId: 3, dir: 'in', attrs: [] } ];  // [ cInfo, ... ]

    // this.onZclFoundation = function (msg) {};
    // this.onZclFunctional = function (msg) {};

    // this.onAfReflectError = function (msg) {};
    // this.onAfIncomingMsgExt = function (msg) {};
    // this.onAfIncomingMsg = function () {};
    // this.onAfDataConfirm = function (cnfMsg) {};

    this.isLocal = function () {
        return true;            // this is a local enpoint, always return true
    };

    this.isDelegator = function () {
        return !!delegated;     // this local enpoint maybe a delegator
    };

    this.isAttrReadable = function () {};
    this.isAttrWritable = function () {};

    // pass to zapp
    this._onAfIncomingMsg = null;
    this._onAfDataConfirm = null;
    this._onAfReflectError = null;
    this._onAfIncomingMsgExt = null;
    this._onZclFoundation = null;
    this._onZclFunctional = null;

    this.onZclFoundation = function (msg) {};
    this.onZclFunctional = function (msg) {};

    this.onAfReflectError = function (msg) {};
    this.onAfIncomingMsgExt = function (msg) {};
    this.onAfIncomingMsg = function () {};
    this.onAfDataConfirm = function (cnfMsg) {};

    this.afDataSend = function (dstEp, cId, rawData, opt, callback) {
        return this.getController().afDataSendByLocalEp(this, dstEp, cId, rawData, opt, callback);
    };
}

util.inherits(Coordpoint, Endpoint);

Coordpoint.prototype.createAcl = function (cId, attrId, access) {
    var cIdStr,
        aIdStr,
        acl;

    this._acl[cIdStr] = this._acl[cIdStr] || {};
    acl = this._acl[cIdStr][aIdStr] = this._acl[cIdStr][aIdStr] || {};
    acl.access = access;
    acl.type = zclId.getAttrType(cId, attrId);
};


Coordpoint.prototype.deleteAcl = function (cId, attrId, access) {
    var cIdStr,
        aIdStr;

    if (!this._acl[cIdStr])
        return false;

    if (!this._acl[cIdStr][aIdStr])
        return false;

    this._acl[cIdStr][aIdStr] = null;
    delete this._acl[cIdStr][aIdStr];

    return true;
};

Coordpoint.prototype.createClusters = function (clusters) {
    // clusters: { cId: { dir: x, attrs: { attrId: { acl, value }, ... } }, ... }
    var self = this,
        cIdItem = zclId.getClusterId();

    _.forEach(clusters, function (cluster, cId) {
        self.createSingleCluster(cId, cluster.dir, cluster.attrs);
    });

};

Coordpoint.prototype.createSingleCluster = function (cId, dir, attrs) {
    // clusters: { cId: { dir: x, attrs: { attrId: { acl, value } }, ... }, ... }
    var cIdItem = zclId.getClusterId(cId),
        attrList;

    if (!cIdItem)
        throw new Error('Illegal cluster id: ' + cId);

    this.clusters = this.clusters || {};
    this.clusters[cIdItem.key] = {};

// // cInfo: { cId, dir, attrList }
// function Cluster(endpoint, cInfo) {

    var cluster = new Cluster(this, {
        cId: cIdItem.value,
        dir: dir,
        attrList: null
    });

    this._acl[cIdItem.key] = this._acl[cIdItem.key] || {};

    cluster.attrs = {};
};

Coordpoint.prototype.addSingleAttribute = function (cluster, attrId, access, value) {
    var attrIdItem = zclId.getAttrId(cluster.cId, attrId),
        cIdStr = cluster.cId;

    if (!attrIdItem)
        throw new Error('Illegal attribute id: ' + attrId);

    this._acl[cIdStr] = this._acl[cIdStr] || {};
    this._acl[cIdStr][attrIdItem.key] = this._acl[cIdStr][attrIdItem.key] || {};
    this._acl[cIdStr][attrIdItem.key].access = access;
    this._acl[cIdStr][attrIdItem.key].type = 'find type';   // [TODO]

    cluster.addSingleAttribute(attrId, value);
};


Coordpoint.prototype.isRegistered = function () {

};

this.bindZbEpClusterToMe = function (zbEp, cId, callback) {
    return zbCoord.bindZbEpToLocalEp(zbEp, cId, epSelf, callback);   // bindZbEpToLocalEp() is a promise
};

// This is the send function of a delegator or local endpoint
this.sendAfData = function (targetEp, afArg, callback) {  // cId and raw data are in afArg
    return sendAfData(epSelf, targetEp, afArg, callback);
};

this.groupcastAfData = function (groupId, clusterId, cmdId, argInst, callback) {
    return sendAfDataBroadcast(epSelf, ZDEFS.AddressMode.AddrGroup.value, groupId, clusterId, cmdId, argInst, callback);
};

this.broadcastAfData = function (clusterId, cmdId, argInst, callback) {
    return sendAfDataBroadcast(epSelf, ZDEFS.AddressMode.AddrBroadcast.value, 0xFFFF, clusterId, cmdId, argInst, callback);
};
