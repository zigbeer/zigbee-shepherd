function Cluster(info) {
    this.epId = info.epId;
    this.cId = info.cId;
    this.dir = info.dir;
    this.numAttrs = info.numAttrs;
    this.attrs = [];
}

Cluster.prototype.readAttrs = function (attrIds, callback) {};
ZbCluster.prototype.addClusterCmd = function () {};
ZbCluster.prototype.plugFunc = function (cmdName, zclHeader) {};
ZbCluster.prototype.save = function (cInfo, callback) {};
ZbCluster.prototype.update = function (cInfo, callback) {};
ZbCluster.prototype.isInDataBase = function (callback) {};
ZbCluster.prototype.bindToCoord = function (callback) {};

module.exports = Cluster;