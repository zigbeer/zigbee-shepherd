var util = rquire('util');

// var Device = require('./device');

function Coordinator(info) {
    this._id = null;            // zutil.convToHexString(devInfo.ieeeAddr, 'uint32').slice(2);
    this.type = 0;              //     this.devType = 0;    // distingush Coord, Router, and End Device
    this.epList = info.epList || [];
    this.address = {
        ieee: info.ieeeAddr,   // string
        nwk: info.nwkAddr      // string
    };

    this.endpoints = [];
}

// util.inherits(Coordinator, Device);

Coordinator.prototype.registerEp = function (epInfo, callback) {};
Coordinator.prototype.reRegisterEp = function (epInfo, callback) {};
Coordinator.prototype.unRegisterEp = function (epId, callback) {};
Coordinator.prototype.bindZbEpToLocalEp = function (zbEp, cId, localEp, callback) {};

// zdo methods