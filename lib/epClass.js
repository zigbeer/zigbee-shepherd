/* jshint node: true */
'use strict';

var ccznp = require('cc-znp');

/*************************************************************************************************/
/*** Endpoint Class                                                                            ***/
/*************************************************************************************************/
function Endpoint(epInfo) {
    this.ep = epInfo.ep;
    this.profileId = epInfo.profileId;
    this.deviceId = epInfo.deviceId;
    this.numInClusters = epInfo.numInClusters;
    this.inClusterList = epInfo.inClusterList;
    this.numOutClusters = epInfo.numOutClusters;
    this.outClusterList = epInfo.outClusterList;
    this.zbInClusterList = [];
    this.zbOutClusterList = [];
}

Endpoint.prototype.sendCmd = function (clusterId, cmd) {

};

Endpoint.prototype.readAttr = function (clusterId, attr) {

};

Endpoint.prototype.writeAttr = function (clusterId, attr, data) {

};

Endpoint.prototype._loadEpFromDb = function () {

};

Endpoint.prototype._saveEpToDb = function () {

};

module.exports = Endpoint;
