// epInfo = { device, profId, epId, devId, inCList, outCList }
function Endpoint(epInfo) { 
    var seqNum = 0;

    this._id = null;
    this.device = epInfo.device;        // bind to device
    this.profId = epInfo.profId;
    this.epId = epInfo.epId;
    this.devId = epInfo.devId;
    this.inCList = epInfo.inCList;      // numbered cluster ids
    this.outCList = epInfo.outCList;    // numbered cluster ids

    this.clusters = [];
    // this.inClusters = [ { cId: 3, dir: 'in', attrs: [] } ];  // [ cInfo, ... ]
    // this.outClusters = [];
}

Endpoint.prototype.dump = function () {
    var dumpOfClusters = [];

    this.clusters.forEach(function (clst) {
        dumpOfClusters.push(clst.dump());
    });

    return {
        profId: this.profId,
        epId: this.epId,
        devId: this.devId,
        numInClusters: this.inCList.length,
        inCList: this.inCList,
        numOutClusters: this.inCList.length,
        outCList: this.outCList.length,
        clusters: dumpOfClusters
    };
};

Endpoint.prototype.isRegistered = function () {
    return !_.isNil(this._id);
};

Endpoint.prototype.getDevice = function () {
    return this.device;
};

Endpoint.prototype.isZclSupported = function () {
    var shepherd = this.getDevice()._getController()._getShepherd();

    shepherd._checkZclSupport(this.profId, this.getDevice().getManufId(), this.devId);
};

Endpoint.prototype.isLocal = function () {
    return this.device.getNwkAddr() === 0;
};


//---------------------------------------------------------------------------------------------
Endpoint.prototype.registerCluster = function (cId, dir, attrList, cmdList) {};

Endpoint.prototype.send = function () {};

// ep-manager
Endpoint.prototype.addCluster = function (cId, dir, attrs) {};
Endpoint.prototype.zclRequest = function (cId, valObj, callback) {};

// Foundation methods
// read, write, writeUndiv, writeNoRsp, configReport, readReportCfg, readStruct, discover, report
// readStruct and writeStrcut are not support by TI

var controller = this.device.getController();

util.inherits(Endpoint, EventEmitter);
