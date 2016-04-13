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

Endpoint.prototype._loadEpFromDb = function (callback) {

};

Endpoint.prototype._saveEpToDb = function (callback) {

};

module.exports = Endpoint;
