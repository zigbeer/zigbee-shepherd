// cInfo: { cId, dir, attrList }
function Cluster(endpoint, cInfo) {
    // this.epId = cInfo.epId;
    this.endpoint = endpoint;
    this.cId = cInfo.cId;
    this.dir = cInfo.dir;
    this.attrList = cInfo.attrList; // should discover all attibute ids first
    this.cmdList = [];  // can recover? or find in spec?
    // use attrList to get attrs object
    this.attrs = {};                // readStatusRec: { attrId, status[, dataType, attrData] } should have attrId -> string name
}

Cluster.prototype.getEpId = function () {
    return this.endpoint;
};

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