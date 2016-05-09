// 'use strict';
// var NWK_MAX_DEVICES = ZDEFS.CONFIG_CONST.NWK_MAX_DEVICES,
//     ZDO_MGMT_MAX_NWKDISC_ITEMS = ZDEFS.CONFIG_CONST.ZDO_MGMT_MAX_NWKDISC_ITEMS;

var bridge = require('./event_bridge');

function Zdo(controller) {
    var zdoRequest = controller._znp.zdoRequest;
    this._controller = controller;

    // bind zdo._sendZdoRequestViaZnp() to znp.zdoRequest()
    // to let _zdo module send request by itself to avoid calling controller.request
    this._sendZdoRequestViaZnp = function (cmdId, valObj, callback) {
        var evtKey;

        if (bridge.hasAreq('ZDO', apiName)) {
            evtKey = bridge.getZdoEventFromRequest(apiName, valObj);
            if (evtKey)
                this._controller._registerAreqCallback(evtKey, callback);
        }

        return zdoRequest(cmdId, valObj, function (err, rsp) {
            // [TODO] expired timer
            if (err) {

            } else if (rsp.status !== 0) {
                //  self.invokeCallback(evt, new Error('fail'), rsp);    //callback(new Error('fail'));

            } else {

            }
        }); // call znp zdoRequest
    };
}

Zdo.prototype.request = function (apiName, valObj, callback) {
    var requestType = getApiRequestType(apiName);

    if (requestType === 'rspless')
        return this.rsplessRequest(apiName, valObj, callback);
    else if (requestType === 'generic')
        return this.genericRequest(apiName, valObj, callback);
    else if (requestType === 'concat')
        return this.concatRequest(apiName, valObj, callback);
    else if (requestType === 'special')
        return this.specialRequest(apiName, valObj, callback);
};

Zdo.prototype.rsplessRequest = function (apiName, valObj, callback) {
    return this._sendZdoRequestViaZnp(apiName, valObj, callback);
};

Zdo.prototype.genericRequest = function (apiName, valObj, callback) {
    return this._sendZdoRequestViaZnp(apiName, valObj, callback);
};

Zdo.prototype.concatRequest = function (apiName, valObj, callback) {
    var self = this,
        totalCount,
        concated = {
            srcaddr: null,
            status: null,
            entries: null,
            startindex: valObj.startindex,
            listcount: null,
            list: null
        },
        counter = {
            total: 0,
            stored: 0
        };

    this._concatEachRequest(apiName, valObj, counter, function (err, rsp) {
        callback(err, rsp);
    });
};

// { dstaddr, scanchannels, scanduration, startindex }
Zdo.prototype.concatAddrRequest = function (apiName, valObj, callback) {
    var self = this,
        totalToGet = 0,
        accum = 0,
        nextIndex = valObj.startindex,
        reqObj = {
            dstaddr: valObj.dstaddr,
            scanchannels: valObj.scanchannels,
            scanduration: valObj.scanduration,
            startindex: valObj.startindex       // start from 0
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
        self.genericRequest(apiName, reqObj, function (err, rsp) {
            if (err) {

            } else if (rsp.status !== 0) {

            } else {
                finalRsp.status = rsp.status;
                finalRsp.ieeeaddr = finalRsp.ieeeaddr || rsp.ieeeaddr;
                finalRsp.nwkaddr = finalRsp.nwkaddr || rsp.nwkaddr;
                finalRsp.numassocdev = finalRsp.numassocdev || rsp.numassocdev;
                finalRsp.assocdevlist = finalRsp.assocdevlist.concat(rsp.assocdevlist);

                totalToGet = finalRsp.numassocdev - finalRsp.startindex;
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

    recursiveRequest(reqObj);

};

// concat
// (1)
// nwkAddrRsp: { status, ieeeaddr, nwkaddr, startindex, numassocdev, assocdevlist }
// ieeeAddrRsp: { status, ieeeaddr, nwkaddr, startindex, numassocdev, assocdevlist }
// (2)
// mgmtNwkDiscRsp: { srcaddr, status, networkcount, startindex, networklistcount, networklist }
// mgmtLqiRsp: { srcaddr, status, neighbortableentries, startindex, neighborlqilistcount, neighborlqilist }
// mgmtRtgRsp: { srcaddr, status, routingtableentries, startindex, routingtablelistcount, routingtablelist }
// mgmtBindRsp: { srcaddr, status, bindingtableentries, startindex, bindingtablelistcount, bindingtablelist }

Zdo.prototype.concatListRequest = function (apiName, valObj, listKeys, callback) {
    // valObj = { dstaddr[, scanchannels, scanduration], startindex }

    // listKeys = { entries: 'networkcount', listcount: 'networklistcount', list: 'networklist' };
    var self = this,
        totalToGet = 0,
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

    // { srcaddr, status, networkcount, startindex, networklistcount, networklist }
    finalRsp[listKeys.entries] = null;      // finalRsp.networkcount = null
    finalRsp[listKeys.listcount] = null;    // finalRsp.networklistcount = null
    finalRsp[listKeys.list] = [];           // finalRsp.networklist = []

    if (apiName === 'mgmtNwkDiscReq') {
        reqObj.scanchannels = valObj.scanchannels;
        reqObj.scanduration = valObj.scanduration;
    }

    var recursiveRequest = function () {
        self.genericRequest(apiName, reqObj, function (err, rsp) {
            if (err) {

            } else if (rsp.status !== 0) {

            } else {
                finalRsp.status = rsp.status;
                finalRsp.srcaddr = finalRsp.srcaddr || rsp.srcaddr;
                finalRsp[listKeys.entries] = finalRsp[listKeys.entries] || rsp[listKeys.entries];
                finalRsp[listKeys.listcount] = rsp[listKeys.listcount];
                finalRsp[listKeys.list] = finalRsp[listKeys.list].concat(rsp[listKeys.list]);

                totalToGet = finalRsp[listKeys.entries] - finalRsp.startindex;
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

    recursiveRequest(reqObj);
};

Zdo.prototype.specialRequest = function (apiName, valObj, callback) {
    if (apiName === 'serverDiscReq') {
        // broadcast, remote device may not response when no bits match in mask
        // 'servermask'
        // Listener in Constructor: eventName = 'ZDO:SERVER_DISC_RSP'
    } else if (apiName === 'bindReq') {
        if (valObj.dstaddrmode === ZDEFS.AddressMode.Addr16Bit.value) {
            callback(new Error('TI not support address 16bit mode.'));
        } else {

        }
    } else if (apiName === 'mgmtPermitJoinReq') {
        if (valObj.dstaddr === 0xFFFC)  // broadcast to all routers (and coord), no waiting for AREQ rsp
            return this.rsplessRequest(apiName, valObj, callback);
        else
            return this.genericRequest(apiName, valObj, callback);
    }
    // return this._sendZdoRequestViaZnp(apiName, valObj, callback);
};

module.exports = Zdo;
