var Endpoint = require('./endpoint');

function Device(ieeeAddr, nwkAddr, type, epList) {
    this.controller = null;
    this._registered = false;
    // this.lifeChecker = null;

    this._net = {
        type: type,
        ieeeAddr: ieeeAddr,
        nwkAddr: nwkAddr,
        status: 'offline',
        joinTime: null
    };

    this.epList = epList;
    this.endpoints = [];    // dev.registerEp();
}

Device.prototype._addEndpoint = function (ep) {
    // check if there
    this.endpoints.push(ep);
};

Device.prototype._getController = function () {
    return this._controller;
};


Device.prototype.getNetInfo = function () {
    return _.cloneDeep(this._net);
};

Device.prototype.setNetInfo = function () {
};

Device.prototype.getEndpoint = function (epId) {
};




Device.prototype.dump = function () {
    // call ep.dump
};

// Device.prototype.bindEp = function () {};
// Device.prototype.restore = function () {};
// Device.prototype.enableLifeChecker = function () {};
// Device.prototype.disableLifeChecker = function () {};
// Device.prototype.dbRead = function () {};
// Device.prototype.dbSave = function () {};
// Device.prototype.dbRemove = function () {};
// Device.prototype.getEp = function () {};
// Device.prototype.getCluster = function () {};
// Device.prototype.replaceEp = function () {};
// Device.prototype.updateEp = function () {};
// Device.prototype.updateCluster = function () {};
// Device.prototype.updateAttrs = function () {};

// Device.prototype.hasEp = function (epId) {};
// Device.prototype._addEp = function (ep) {
//     // new Endpoint, push to this.endpoints
// };

// Device.prototype._addClst = function (epId, dir, cluster) {
//     var ep = this.findEp(epId);
//     ep.addCluster(dir, cluster);
// };

// Device.prototype._addAttrToClst = function (epId, cId, attr) {};


/*************************************************************************************************/
/*** Remote                                                                                    ***/
/*************************************************************************************************/
// MAC: dataReq, disassociateReq
// AF: dataRequest, dataRequestExt, dataRequestSrcRtg
// ZDO: nwkAddrReq, ieeeAddrReq, nodeDescReq, powerDescReq, ... many
// SAPI: permitJoiningRequest, bindDevice, sendDataRequest

// Device.prototype.nwkAddrReq = function () {};
// Device.prototype.readAttrReq = function () {};
// Device.prototype.routeTableReq = function () {};