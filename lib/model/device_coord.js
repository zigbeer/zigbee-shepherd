/* jshint node: true */
'use strict';
var Q = require('q'),
    util = require('util');
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
Coordinator.prototype.findEndpointByEpId = function (epId) {
    return this.endpoints.find(function (ep) {
        return ep.getEpId() === epId;
    });
};

Coordinator.prototype.findEndpointByProfId = function (profId) {
    var eps = [];
    this.endpoints.forEach(function (ep) {
        if (ep.getProfId() === profId)
            eps.push(ep);
    });
    return eps;
};

Coordinator.prototype.findDelegatorByProfId = function (profId) {
    return this.endpoints.find(function (ep) {
        if (ep.isDelegator())
            return ep.getProfId() === profId;
    });
};

Coordinator.prototype.registerEndpointReq = function (ep, callback) {
    var deferred = Q.defer();

    this._controller.afRegister(ep).then(function (regRsp) {
        if (regRsp.status === 0) { // success
            this.epList.push(ep.getEpId());
            this.addEndpoint(ep);
        }
        deferred.resolve(regRsp);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

Coordinator.prototype.unRegisterEp = function (epId, callback) {
    var deferred = Q.defer();

    this._controller.afDelete(epId).then(function (unRegRsp) {
        if (unRegRsp.status === 0) { // success
            delete this.epList[epId];
            delete this.endpoints[this.findEndpointByEpId(epId)];
        }
        deferred.resolve(unRegRsp);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

Coordinator.prototype.reRegisterEp = function (ep, callback) {
    var deferred = Q.defer(),
        epId = ep.getEpId();

    if (!this.findEndpointByEpId(epId)) {
        this.registerEndpointReq(ep).then(function (rsp) {
            deferred.resolve(rsp);
        }).fail(function (err) {
            deferred.reject(err);
        }).done();
    } else {
        this.unRegisterEp(epId).then(function () {
            return this.registerEndpointReq(ep);
        }).then(function (rsp) {
            deferred.resolve(rsp);
        }).fail(function (err) {
            deferred.reject(err);
        }).done();
    }

    return deferred.promise.nodeify(callback);
};

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
