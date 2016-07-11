/* jshint node: true */
'use strict';

var util = require('util');
var Endpoint = require('./endpoint');

// This class in not opened, should use a app creators
// simpleDesc = { device, profId, epId, devId, inCList, outCList }
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

    // this._af = ;
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

// Coordpoint.prototype.foundation = function (dstEp, cId, cmd, payload, callback) {
//     return this._af.zclFoundation(this, dstEp, cId, cmd, payload, callback);
// };

// Coordpoint.prototype.functional = function (dstEp, cId, cmd, valObj, callback) {
//     return this._af.zclFunctional(this, dstEp, cId, cmd, valObj, callback);
// };

module.exports = Coordpoint;
