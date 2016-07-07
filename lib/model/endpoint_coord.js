/* jshint node: true */
'use strict';

var util = require('util');
var Endpoint = require('./endpoint');
var Cluster = require('./cluster');
var zclId = require('zcl-id');
var _ = require('busyman');

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
    this.discoverableCmds = [];
    this._receiveAfIncominfMsg = function (msg) {
        // dispatch to onAfIncomingMsg, ...
    };

    this._receiveAfIndMsg = function (ind, msg) {
        switch (ind) {
            case 'dataConfirm':
                this.onAfDataConfirm(msg);
                this._onAfDataConfirm(msg);
                break;
            case 'reflectError':
                this.onAfReflectError(msg);
                this._onAfReflectError(msg);
                break;
            case 'incomingMsg':
                this.onAfIncomingMsg(msg);
                this._onAfIncomingMsg(msg);
                break;
            case 'incomingMsgExt':
                this.onAfIncomingMsgExt(msg);
                this._onAfIncomingMsgExt(msg);
                break;
            default:
                break;
        }
    };

    this._receiveZclMsg = function (msg) {
        // msg: { frameCntl: { frameType, manufSpec, direction, disDefaultRsp }, manufCode, seqNum, cmd, payload }
        // dispatch to onZclFoundation, onZclFunctional
        if (0 === msg.frameCntl.frameType) {
            this.onZclFoundation(msg);
            this._onZclFoundation(msg);
        } else if (1 === msg.frameCntl.frameType) {
            this.onZclFunctional(msg);
            this._onZclFunctional(msg);
        }
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

    this.onAfDataConfirm = function (cnfMsg) {};
    this.onAfReflectError = function (msg) {};
    this.onAfIncomingMsg = function (msg) {};
    this.onAfIncomingMsgExt = function (msg) {};
    this.onZclFoundation = function (msg) {};
    this.onZclFunctional = function (msg) {};

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
    var self = this,
        cIdItem = zclId.getClusterId(cId),
        attrList = [];

    if (!cIdItem)
        throw new Error('Illegal cluster id: ' + cId);

    this.clusters = this.clusters || {};
    // this.clusters[cIdItem.key] = {};

// // cInfo: { cId, dir, attrList }
// function Cluster(endpoint, cInfo) {

    // this._acl[cIdItem.key] = this._acl[cIdItem.key] || {};

    var cluster = new Cluster(this, {
        cId: cIdItem.value,
        dir: dir,
        attrList: null
    });

    _.forEach(attrs, function (attr, attrId) {
        var attributeId = self.addSingleAttribute(cluster, attrId, attr.acl, attr.value);
        attrList.push(attributeId);
    });

    cluster.attrList = attrList;
    // cluster.addAttrs(attrs);
    // cluster.attrs = {};
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

    return attrIdItem.value;
};

Coordpoint.prototype.createDiscoverableCmds = function (discCmds) {
    var self = this;

    _.forEach(discCmds, function (cmds, cId) {
        var cIdItem = zclId.getClusterId(cId);
        self.discoverableCmds[cIdItem.key] = self.discoverableCmds[cIdItem.key] || {};
        _.forEach(cmds, function(dir, cmd) {
            var cmdItem = zclId.getClusterCmd(cId, cmd, dir);
            self.discoverableCmds[cIdItem.key][cmdItem.key] = self.discoverableCmds[cIdItem.key][cmdItem.key] || {};
            self.discoverableCmds[cIdItem.key][cmdItem.key].dir = dir;
        });
    });
};

// Coordpoint.prototype.isRegistered = function () {};

Coordpoint.prototype.bindZbEpClusterToMe = function (zbEp, cId, callback) {
    return this.getController().querie.setBindingEntry('bind', zbEp, this, cId, callback);
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

Coordpoint.prototype.broadcastAfData = function (clusterId, rawData, opt, callback) {
    var ADDR_BROADCAST = ZDEF.AF.ADDRESS_MODE.ADDR_BROADCAST;
    return this.getController().afDataBroadcastByLocalEp(this, ADDR_BROADCAST, 0xFFFF, clusterId, rawData, opt, callback);

    // return sendAfDataBroadcast(epSelf, ZDEFS.AddressMode.AddrBroadcast.value, 0xFFFF, clusterId, cmdId, argInst, callback);
};

// Controller.prototype.zclCommand = function (dstEp, cId, cmd, valObj, callback)  {
//     // .frame(frameCntl, manufCode, seqNum, cmd, zclPayload[, clusterId])
//     var deferred = Q.defer(),
//         dev = dstEp.getDev(),
//         frameCntl = { frameType: 1, manufSpec: 0, direction: 0, disDefaultRsp: 0 },
//         manufId,
//         seqNum,
//         zclPacket;

//     if (!dev) {
//         deferred.reject(new Error('device not found.'));
//         return deferred.promise.nodeify(callback);
//     }

//     manufId = dev.getManufId();
//     seqNum = msg.seqNum;

//     zclPacket = zcl.frame(frameCntl, manufId, seqNum, cmd, valObj, cId);

//     this.afDataSend(dstEp, cId, zclPacket, {}).fail(function (err) {
//         deferred.reject(err);
//     }).done();

//     return deferred.promise.nodeify(callback);
// };

module.exports = Coordpoint;
