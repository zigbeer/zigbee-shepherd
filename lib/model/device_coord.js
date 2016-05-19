/* jshint node: true */
'use strict';

var util = rquire('util');
var Device = require('./device');

function Coordinator(info) {
    // coordinator is a device, but a "LOCAL" device
    // this class distinguishes itself from Device
    Device.call(this, info);
}

util.inherits(Coordinator, Device);

/*************************************************************************************************/
/*** Public APIs                                                                               ***/
/*************************************************************************************************/
Coordinator.prototype.findEndpointByEpId = function (epId) {};
Coordinator.prototype.findEndpointByProfId = function (profId) {};
Coordinator.prototype.findDelegatorByProfId = function (profId) {};


Coordinator.prototype.registerEndpointReq = function (epInfo, callback) {};
Coordinator.prototype.unRegisterEp = function (epId, callback) {};
Coordinator.prototype.reRegisterEp = function (epInfo, callback) {};
Coordinator.prototype.bindZbEpToMe = function (zbEp, cId, localEp, callback) {};
Coordinator.prototype.newLocalApp = function (zbApp, callback) {};
Coordinator.prototype.registerSysEp = function () {};


Controller.prototype.registerEndpoint = function (ep, callback) {
    var inCList = ep.getInClusterList(),
        outCList = ep.getOutClusterList(),
        simpDesc = {
            endpoint: ep.getEpId(),
            appprofid: ep.getProfId(),
            appdeviceid: ep.getDevId(),
            appdevver: 0,
            latencyreq: ZDEF.AF.NETWORK_LATENCY_REQ.NO_LATENCY_REQS,    // 0
            appnuminclusters: inCList.length,
            appinclusterlist: inCList,
            appnumoutclusters: outCList.length,
            appoutclusterlist: outCList
        },
        ind = {
            nwkaddr: coordSelf.nwkAddr,
            ieeeaddr: coordSelf.ieeeAddr,
            simpleDesc: simpDesc
        };

    var zEp = coord.findEndpointByEpId(ep.getEpId());

    this.request('AF', 'register', simpDesc).then(function (regRsp) {
        if (reg.status === 0) { // success
            coordSelf.info.numEndpoints += 1;
            coordSelf.info.epList.push(zbEp.endpointId);
            coordSelf.update();
            msghub.emit('EPMGR:COORD_EP_REG_IND', indMsg);
            zbEp.enableAsLocalEndpoint();
            deferred.resolve(result);
        }
    });
};

Controller.prototype.unregisterEndpoint = function (ep, callback) {
    var eps = this.coord.endpoints,
        epId = ep.getEpId();

    var zEp = this.coord.findEndpointByEpId(epId);  // if not found cannot deregister
    // db remove
    this.request('AF', 'delete', { endpoint: epId }).then(function (deregRsp) {
        // remove from this.coord.endpoints
        // remove from epList
        coord.update();
        msghub.emit('EPMGR:COORD_EP_DEL_IND', { endpoint: endpointId });
        deferred.resolve(zbEpRemoved);
    });

};

Controller.prototype.reRegisterEndpoint = function (ep, callback) {
    var eps = this.coord.endpoints,
        epId = ep.getEpId();

    var zEp = this.coord.findEndpointByEpId(epId);  // if not found cannot deregister

    this.unregisterEndpoint().then(function () {
        return this.registerEndpoint();
    });
};

// afEventNameForLocalEp = 'AF:INCOMING_MSG:' + zutil.convToHexString(coordDev.ieeeAddr, 'uint32') + ':' + zutil.convToHexString(msgobj.msg.dstendpoint, 'uint8');
