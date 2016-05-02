function Cluster(info) {
    this.epId = info.epId;
    this.cId = info.cId;
    this.dir = info.dir;
    this.numAttrs = info.numAttrs;
    this.attrs = [];
}

module.exports = Cluster;