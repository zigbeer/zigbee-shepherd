/* jshint node: true */
'use strict';

var ccznp = require('cc-znp');

/*************************************************************************************************/
/*** Cluster Class                                                                            ***/
/*************************************************************************************************/
function Cluster(cluInfo) {
    this.endpointId = cluInfo.endpointId;
    this.clusterId = cluInfo.clusterId;
    this.direction = cluInfo.direction;
    this.numAttrs = cluInfo.numAttrs;
    this.attrList = cluInfo.attrList;
}

Cluster.prototype._loadCluFromDb = function () {

};

Cluster.prototype._saveCluToDb = function () {

};

module.exports = Cluster;
