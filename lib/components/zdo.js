/* jshint node: true */
'use strict';

var ZDEF = require('zstack-id'),
    zdoHelper = require('./zdo_helper'),
    ADDRESS_MODE = ZDEF.AF.ADDRESS_MODE;

function Zdo(controller) {
    this._controller = controller;
}

/*************************************************************************************************/
/*** Public APIs                                                                               ***/
/*************************************************************************************************/
Zdo.prototype.request = function (apiName, valObj, callback) {
    var requestType = zdoHelper.getRequestType(apiName);

    if (requestType === 'rspless')
        return this._rsplessRequest(apiName, valObj, callback);
    else if (requestType === 'generic')
        return this._genericRequest(apiName, valObj, callback);
    else if (requestType === 'concat')
        return this._concatRequest(apiName, valObj, callback);  // [TODO] concat addr request
    else if (requestType === 'special')
        return this._specialRequest(apiName, valObj, callback);
    else
        callback(new Error('Unknown request type.'));
};

/*************************************************************************************************/
/*** Protected Methods                                                                         ***/
/*************************************************************************************************/
Zdo.prototype._sendZdoRequestViaZnp = function (apiName, valObj, callback) {
    var controller = this._controller,
        zdoRequest = controller._znp.zdoRequest;    // bind zdo._sendZdoRequestViaZnp() to znp.zdoRequest()

    return zdoRequest(apiName, valObj, function (err, rsp) {
        var error = null;

        if (err)
            error = err;
        else if (rsp.status !== 0)
            error = new Error('request unsuccess: ' + rsp.status);

        callback(error, rsp);
    });
};

Zdo.prototype._rsplessRequest = function (apiName, valObj, callback) {
    return this._sendZdoRequestViaZnp(apiName, valObj, callback);
};

Zdo.prototype._genericRequest = function (apiName, valObj, callback) {
    var controller = this._controller,
        areqEvtKey = zdoHelper.generateEventOfRequest(apiName, valObj);

    if (areqEvtKey)
        controller._registerAreqCallback(areqEvtKey, callback);

    return this._sendZdoRequestViaZnp(apiName, valObj, function (err, rsp) {
        if (areqEvtKey)
            controller._invokeAreqCallback(areqEvtKey, err, rsp);   // he will also check if callback exists
    });
};

Zdo.prototype._specialRequest = function (apiName, valObj, callback) {
    if (apiName === 'serverDiscReq') {
        // broadcast, remote device may not response when no bits match in mask
        // listener at controller.on('ZDO:serverDiscRsp') => re-emit => controller.emit('zdoServiceDiscovery', rspMsg)
        return this._rsplessRequest('serverDiscReq', valObj, callback);
    } else if (apiName === 'bindReq') {

        if (valObj.dstaddrmode === ADDRESS_MODE.ADDR_16BIT)
            callback(new Error('TI not support address 16bit mode.'));
        else
            return this._genericRequest('bindReq', valObj, callback);

    } else if (apiName === 'mgmtPermitJoinReq') {

        if (valObj.dstaddr === 0xFFFC)  // broadcast to all routers (and coord), no waiting for AREQ rsp
            return this._rsplessRequest('mgmtPermitJoinReq', valObj, callback);
        else
            return this._genericRequest('mgmtPermitJoinReq', valObj, callback);

    } else {
        callback(new Error('No such request.'));
    }
};

Zdo.prototype._concatRequest = function (apiName, valObj, callback) {
    if (apiName === 'nwkAddrReq' || apiName === 'ieeeAddrReq')
        return this._concatAddrRequest(apiName, valObj, callback);
    else if (apiName === 'mgmtNwkDiscReq')
        return this._concatListRequest(apiName, valObj, {
            entries: 'networkcount',
            listcount: 'networklistcount',
            list: 'networklist'
        }, callback);
    else if (apiName === 'mgmtLqiReq')
        return this._concatListRequest(apiName, valObj, {
            entries: 'neighbortableentries',
            listcount: 'neighborlqilistcount',
            list: 'neighborlqilist'
        }, callback);
    else if (apiName === 'mgmtRtgReq')
        return this._concatListRequest(apiName, valObj, {
            entries: 'routingtableentries',
            listcount: 'routingtablelistcount',
            list: 'routingtablelist'
        }, callback);
    else if (apiName === 'mgmtBindRsp')
        return this._concatListRequest(apiName, valObj, {
            entries: 'bindingtableentries',
            listcount: 'bindingtablelistcount',
            list: 'bindingtablelist'
        }, callback);
    else
        callback(new Error('No such request.'));
};

Zdo.prototype._concatAddrRequest = function (apiName, valObj, callback) {
    var self = this,
        totalToGet = null,
        accum = 0,
        nextIndex = valObj.startindex,
        reqObj = {
            dstaddr: valObj.dstaddr,
            scanchannels: valObj.scanchannels,
            scanduration: valObj.scanduration,
            startindex: valObj.startindex       // starts from 0
        },
        finalRsp = {
            status: null,
            ieeeaddr: null,
            nwkaddr: null,
            startindex: valObj.startindex,
            numassocdev: null,
            assocdevlist: []
        };

    var recursiveRequest = function () {
        self._genericRequest(apiName, reqObj, function (err, rsp) {
            if (err) {
                callback(err, finalRsp);
            } else if (rsp.status !== 0) {
                callback(new Error('request unsuccess: ' + rsp.status), finalRsp);
            } else {
                finalRsp.status = rsp.status;
                finalRsp.ieeeaddr = finalRsp.ieeeaddr || rsp.ieeeaddr;
                finalRsp.nwkaddr = finalRsp.nwkaddr || rsp.nwkaddr;
                finalRsp.numassocdev = finalRsp.numassocdev || rsp.numassocdev;
                finalRsp.assocdevlist = finalRsp.assocdevlist.concat(rsp.assocdevlist);

                totalToGet = totalToGet || (finalRsp.numassocdev - finalRsp.startindex);    // compute at 1st rsp back
                accum = accum + rsp.assocdevlist.length;

                if (accum < totalToGet) {
                    nextIndex = nextIndex + rsp.assocdevlist.length;
                    reqObj.startindex = nextIndex;
                    recursiveRequest();
                } else {
                    callback(null, finalRsp);
                }
            }
        });
    };

    recursiveRequest();
};

Zdo.prototype._concatListRequest = function (apiName, valObj, listKeys, callback) {
    // valObj = { dstaddr[, scanchannels, scanduration], startindex }
    // listKeys = { entries: 'networkcount', listcount: 'networklistcount', list: 'networklist' };
    var self = this,
        totalToGet = null,
        accum = 0,
        nextIndex = valObj.startindex,
        reqObj = {
            dstaddr: valObj.dstaddr,
            startindex: valObj.startindex       // start from 0
        },
        finalRsp = {
            srcaddr: null,
            status: null,
            startindex: valObj.startindex
        };

    finalRsp[listKeys.entries] = null;      // finalRsp.networkcount = null
    finalRsp[listKeys.listcount] = null;    // finalRsp.networklistcount = null
    finalRsp[listKeys.list] = [];           // finalRsp.networklist = []

    if (apiName === 'mgmtNwkDiscReq') {
        reqObj.scanchannels = valObj.scanchannels;
        reqObj.scanduration = valObj.scanduration;
    }

    var recursiveRequest = function () {
        self._genericRequest(apiName, reqObj, function (err, rsp) {
            if (err) {
                callback(err, finalRsp);
            } else if (rsp.status !== 0) {
                callback(new Error('request unsuccess: ' + rsp.status), finalRsp);
            } else {
                finalRsp.status = rsp.status;
                finalRsp.srcaddr = finalRsp.srcaddr || rsp.srcaddr;
                finalRsp[listKeys.entries] = finalRsp[listKeys.entries] || rsp[listKeys.entries];
                finalRsp[listKeys.listcount] = rsp[listKeys.listcount];
                finalRsp[listKeys.list] = finalRsp[listKeys.list].concat(rsp[listKeys.list]);

                totalToGet = totalToGet || (finalRsp[listKeys.entries] - finalRsp.startindex);
                accum = accum + rsp[listKeys.list].length;

                if (accum < totalToGet) {
                    nextIndex = nextIndex + rsp[listKeys.list].length;
                    reqObj.startindex = nextIndex;
                    recursiveRequest();
                } else {
                    callback(null, finalRsp);
                }
            }
        });
    };

    recursiveRequest();
};

module.exports = Zdo;
