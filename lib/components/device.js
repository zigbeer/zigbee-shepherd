var Endpoint = require('./endpoint');

function Device(info) {
    this._id = null;
    this.type = info.type;
    this.epList = info.epList;
    this.address = {
        ieee: '',   // string
        nwk: '' // string
    };

    this.endpoints = [];
}



Device.prototype.hasEp = function (epId) {

};

Device.prototype._addEp = function (ep) {
    // new Endpoint, push to this.endpoints
};

Device.prototype._addClst = function (epId, dir, cluster) {
    var ep = this.findEp(epId);
    ep.addCluster(dir, cluster);
};

Device.prototype._addAttrToClst = function (epId, cId, attr) {

};

// what a device should have
// {
//     _id: db,
//     type: device type,  // distingush Coord(0), Router(1), and End Device(2, default)
//     endpoints: [],
//     address: {
//         ieee: 'xxxx',
//         network: 'xxxx'
//     },
// }

// what an endpoint should have
// {
//     inClisters: [],
//     outClusters: [],
//     epId: 3,
//     zclSupport: true,
//     publicProfile: true,    // standard ZigBee app profile : 0x0000-0x7FFFF

// }

// what a cluster should have
// {
//     cId: 3,
//     direction: 'in'
// }

/*************************************************************************************************/
/*** Remote                                                                                    ***/
/*************************************************************************************************/
// MAC: dataReq, disassociateReq
// AF: dataRequest, dataRequestExt, dataRequestSrcRtg
// ZDO: nwkAddrReq, ieeeAddrReq, nodeDescReq, powerDescReq, ... many
// SAPI: permitJoiningRequest, bindDevice, sendDataRequest


Device.prototype.nwkAddrReq = function () {

};

Device.prototype.readAttrReq = function () {

};

Device.prototype.routeTableReq = function () {

};