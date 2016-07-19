/* jshint node: true */
'use strict';

var util = require('util'),
    Endpoint = require('./endpoint');

// This class in not opened, should use a app creators
// simpleDesc = { profId, epId, devId, inClusterList, outClusterList }
function Coordpoint(coord, simpleDesc, isDelegator) {
    // coordpoint is a endpoint, but a "LOCAL" endpoint
    // This class is used to create delegators, local applications
    Endpoint.call(this, coord, simpleDesc);

    this._isDelegator = isDelegator || false;

    this.isLocal = function () {
        return true;                   // this is a local enpoint, always return true
    };

    this.isDelegator = function () {
        return !!this._isDelegator;    // this local enpoint maybe a delegator
    };

    // this.device = coord;
    // this.profId = simpleDesc.profId;
    // this.epId = simpleDesc.epId;
    // this.devId = simpleDesc.devId;
    // this.inClusterList = simpleDesc.inClusterList;
    // this.outClusterList = simpleDesc.outClusterList;

    // this.clusters = {};

    // this.onAfDataConfirm = null;
    // this.onAfReflectError = null;
    // this.onAfIncomingMsg = null;
    // this.onAfIncomingMsgExt = null;
    // this.onZclFoundation = null;
    // this.onZclFunctional = null;
}
// Endpoint.prototype.dump = function () {};
// Endpoint.prototype.isZclSupported = function () {};
// Endpoint.prototype.getDevice = function () {};
// Endpoint.prototype.getProfId = function () {};
// Endpoint.prototype.getEpId = function () {};
// Endpoint.prototype.getDevId = function () {};
// Endpoint.prototype.getInClusterList = function () {};
// Endpoint.prototype.getOutClusterList = function () {};
// Endpoint.prototype.getClusterList = function () {};
// Endpoint.prototype.getNwkAddr = function () {};
// Endpoint.prototype.getManufId = function () {};
// Endpoint.prototype.update = function (simpleDesc) {};

util.inherits(Coordpoint, Endpoint);

// coordpoint.foundation = function (dstAddr, dstEpId, cId, cmd, zclData, cfg, callback) {};    // foundation method will be attached in shepherd
// coordpoint.functional = function (dstAddr, dstEpId, cId, cmd, zclData, cfg, callback) {};    // functional method will be attached in shepherd

module.exports = Coordpoint;
