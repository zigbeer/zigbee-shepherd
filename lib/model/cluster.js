/* jshint node: true */
'use strict';

var _ = require('lodash');

// cInfo: { cId, dir, attrList }
function Cluster(endpoint, cInfo) {
    // this.epId = cInfo.epId;
    this.endpoint = endpoint;
    this.cId = cInfo.cId;
    this.name = 'xxx';      // find from zcl defs, if not found, give it 'manuSpecificCluster'
    this.dir = cInfo.dir;
    this.attrList = cInfo.attrList; // should discover all attibute ids first
    this.cmdList = [];  // can recover? or find in spec?
    // use attrList to get attrs object
    this.attrs = {};                // readStatusRec: { attrId, status[, dataType, attrData] } should have attrId -> string name

    // find if in endpoint, in inlist, in outlist, in full list?
    // new dir | old dir

    // cluster already there
    //      zclSupport && isLocalEp?
    //          endpoint.clusters[this.name] = cluster => if is out cluster => push to funtional
    //          cluster.addClusterCmd()?
    //      zclSupport && !isLocalEp?
    //          endpoint.clusters[this.name] = cluster => if is in cluster => push to funtional
    //          cluster.addClusterCmd()?

    // cluster not there (msghub.emit('EPMGR:DEVICE_ANNCE_IND', { indType: 'CLUSTER_NEW', info: cInfo });)
    //      new Cluster
    //          isLocal
    //              dir !== in  // only put 'out' clusters to functional (it is client)
    //                  zclSupport: this.functional[clstName] = newClst;
    //                              this.functional[clstName].addClusterCmd();
    //                  push to ep.clusters (out clusters)
    //              dir !== out
    //                  push to ep.clusters (in clusters)
    //          not Local
    //              dir !== out // only put 'in' clusters to functional (we have to create clients for them)
    //                  zclSupport: this.functional[clstName] = newClst;
    //                              this.functional[clstName].addClusterCmd();
    //                  push to ep.clusters (in clusters)
    //              dir !== in
    //                  push to ep.clusters (out clusters)
}

Cluster.prototype.getEpId = function () {
    return this.endpoint;
};

Cluster.prototype.getClusterId = function () {
    return this.cId;
};

Cluster.prototype.addAttrs = function (cluster) {
    var added = false,
        hasCluster;

    if (1 === cluster.dir)
        hasCluster = this.findInCluster(cluster.getClusterId());
    else if (2 === cluster.dir)
        hasCluster = this.findOutCluster(cluster.getClusterId());

    if (!hasCluster) {
        this.clusters.push(cluster);
        added = true;
    }

    return added;
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

// { cId, cmdList, attrList, attrs }
module.exports = Cluster;