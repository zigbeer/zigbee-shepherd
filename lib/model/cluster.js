function Cluster(cInfo) {
    this.epId = cInfo.epId;
    this.cId = cInfo.cId;
    this.dir = cInfo.dir;
    this.attrList = cInfo.attrList; // should discover all attibute ids first

    // use attrList to get attrs object
    this.attrs = {};                // readStatusRec: { attrId, status[, dataType, attrData] } should have attrId -> string name
}

Cluster.prototype.dump = function () {
    return {
        cId: this.cId,
        dir: this.dir,
        attrs: _.cloneDeep(this.attrs)
    };
};

// Cluster.prototype.readAttrs = function (attrIds, callback) {};
// Cluster.prototype.addClusterCmd = function () {};
// Cluster.prototype.plugFunc = function (cmdName, zclHeader) {};
// Cluster.prototype.save = function (cInfo, callback) {};
// Cluster.prototype.update = function (cInfo, callback) {};
// Cluster.prototype.isInDataBase = function (callback) {};
// Cluster.prototype.bindToCoord = function (callback) {};

// { cId, cmdList, attrList, attrs }
module.exports = Cluster;