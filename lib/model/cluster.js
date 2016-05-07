function Cluster(endpoint, clusterId, direction, attrList) {
    this.epId = info.epId;
    this.cId = info.cId;
    this.dir = info.dir;
    this.numAttrs = info.numAttrs;
    this.attrs = [];
}

// Cluster.prototype.readAttrs = function (attrIds, callback) {};
// Cluster.prototype.addClusterCmd = function () {};
// Cluster.prototype.plugFunc = function (cmdName, zclHeader) {};
// Cluster.prototype.save = function (cInfo, callback) {};
// Cluster.prototype.update = function (cInfo, callback) {};
// Cluster.prototype.isInDataBase = function (callback) {};
// Cluster.prototype.bindToCoord = function (callback) {};

// { cId, cmdList, attrList, attrs }
module.exports = Cluster;