/* jshint node: true */
'use strict';

var EventEmitter = require('events'),
    znp = require('cc-znp'),
    zcl = require('zcl-packet'),
    Q = require('q'),
    ZDEF = require('zstack-id'),
    Coordpoint = require('./coordpoint.js'),
    bridge = require('./event_bridge.js');

// CONSTANTS
var AREQ_TIMEOUT = 30;  // seconds

// [TODO] flow control
function Controller(shepherd, cfg) {    // cfg is serial port config
    EventEmitter.call(this);

    var self = this,
        seqNum = 0,
        transId = 0,
        permitJoinTime;

    this._shepherd = shepherd;
    this._coord = null;
    this._zdo = new Zdo(this);
    this._znp = znp;    // use init() to start, then fill up _coord, and register delegators
    this._cfg = cfg;

    this._net = {
        state: null,
        channel: null,
        panId: null,
        extPanId: null,
        ieeeAddr: null,
        nwkAddr: 0,
        permitRemainingTime: 0,
        numPendingAttribs: 0
    };

    this._delegators = [];  // [TODO] move to init()

    /*********************************************************************/
    /*** Facility                                                      ***/
    /*********************************************************************/
    this._areqCallbacks = {};
    this._areqTimeouts = {};

    /*********************************************************************/
    /*** Privileged Methods                                            ***/
    /*********************************************************************/
    this.nextZclSeqNum = function () {  // zcl sequence number
        if (++seqNum > 255)
            seqNum = 1;
        return seqNum;
    };

    this.nextTransId = function () {    // zigbee transection id
        if (++transId > 255)
            transId = 1;
        return transId;
    };

    this.setPermitJoinTime = function (argInst, callback) {};
    this.getPermitJoinTime = function (callback) {};
    this.joinTimeCountdown = function (callback) {};

    /*********************************************************************/
    /***Event Bridges                                                  ***/
    /*********************************************************************/
    this._znp.on('ready', function () {
        self._initCoordinator().then(function () {
            // all ok, check online running
            // if (!appload) => load all apps    [TODO] should load app at shepherd level
        }).fail(function (err) {
            self.emit('ZNP:INIT:FAIL');
        });
    }).done();

    this._znp.on('AREQ', function (msg) {
        bridge._areqEventBridge(self, msg);
    });

    this.on('ZDO:serverDiscRsp', function (rspMsg) {
        // rspMsg: { srcaddr, status, servermask }
        self.emit('zdoServiceDiscovery', rspMsg);
    });

    this.on('ZDO:endDeviceAnnceInd', function (msg) {
        self._shepherd.emit('ZNP:devIncoming', msg);    // { srcaddr, nwkaddr, ieeeaddr, capabilities }
    });
}

util.inherits(Controller, EventEmitter);

/*************************************************************************************************/
/*** Public ZigBee Utility APIs                                                                ***/
/*************************************************************************************************/
Controller.prototype.findDelegator = function (profId) {
    return this._shepherd.findDelegator(profId);    // [TODO] find in self?
};

Controller.prototype.getCoord = function () {
    return this._coord;
};


Controller.prototype.sendAfDataWithLocalEp = function (localEp, dstEp, cId, rawData, opt, callback) {
    var afParams;

    if (typeof opt === 'function') {
        callback = opt;
        opt = undefined;
    }

    opt = opt || {};

    if (!localEp) {
        callback(new Error('Local endpoint should be given.'));
    } else {
        afParams = this._generateAfParams(localEp, dstEp, cId, rawData, opt);

        this.afRequest('dataRequest', afParams, function (err, result) {
            if (err)
                callback(err);
            else if (result.status !== 0)   // unsuccessful
                callback(new Error('AfDataRequest failed. '));
            else
                callback(err, result);
        });
    }

    return this;
};

Controller.prototype.sendAfData = function (dstEp, cId, rawData, opt, callback) {
    var profId = dstEp.getProfId(),
        delegateEp = this.findDelegator(profId);

    if (!delegateEp)
        callback(new Error('Profile: ' + profId + ' is not supported at this moment.'));
    else
        this.sendAfDataWithLocalEp(delegateEp, dstEp, cId, rawData, opt, callback);

    return this;
};

Controller.prototype.broadcastAfDataWithLocalEp = function (localEp, addrMode, dstAddr, clusterId, rawData, opt, callback) {
    // (localEp, addrMode, dstAddr, clusterId, rawData, opt)
    var afParams = this._generateBroadcastAfParams(localEp, addrMode, dstAddr, clusterId, rawData, opt);

    this.afRequest('dataRequestExt', afParams, function (err, result) {
        if (err)
            callback(err);
        else if (result.status !== 0)   // not success
            callback(new Error('AfDataRequestExt failed. '));
        else
            callback(null, result);     // Broadcast (or Groupcast) has no AREQ confirm back, just resolve this transaction.
    });
};

Controller.prototype.groupcastAfData = function (localEp, groupId, clusterId, rawData, opt, callback) {
    // [TODO] Do we need local EP? or profile
    // ADDR_GROUP = 0x01
    return this.broadcastAfDataWithLocalEp(localEp, ZDEF.AF.ADDRESS_MODE.ADDR_GROUP, groupId, clusterId, rawData, opt, callback);
};

Controller.prototype.broadcastAfData = function (localEp, clusterId, rawData, opt, callback) {
    // [TODO] Do we need local EP? or profile
    // ADDR_BROADCAST = 0xFF
    return this.broadcastAfDataWithLocalEp(localEp, ZDEF.AF.ADDRESS_MODE.ADDR_BROADCAST, 0xFFFF, clusterId, rawData, opt, callback);
};

Controller.prototype.sendZclData = function (dstEp, cId, rawData, opt, callback) {};
Controller.prototype.groupcastZclData = function (dstEp, cId, cmdId, zclObj, callback) {};
Controller.prototype.broadcastZclData = function (dstEp, cId, cmdId, zclObj, callback) {};

/*************************************************************************************************/
/*** Protected Methods                                                                         ***/
/*************************************************************************************************/
Controller.prototype._zdoRequest = function (cmdId, valObj, callback) {
    var deferred = Q.defer();

    this._zdo.request(cmdId, valObj, function (err, rsp) {
        if (err)
            deferred.reject(err);
        else if (rsp && rsp.hasOwnProperty('status') && rsp.status !== 0)   // unsuccessful
            deferred.reject(new Error('rsp error: ' + rsp.status));
        else
            deferred.resolve(rsp);
    });

    return deferred.promise.nodeify(callback);
};

Controller.prototype._znpRequest = function (subsys, cmdId, valObj, callback) {
    var deferred = Q.defer();

    this._znp.request(subsys, cmdId, valObj, function (err, rsp) {
        if (err)
            deferred.reject(err);
        else if (rsp && rsp.hasOwnProperty('status') && rsp.status !== 0)   // unsuccessful
            deferred.reject(new Error('rsp error: ' + rsp.status));
        else
            deferred.resolve(rsp);
    });

    return deferred.promise.nodeify(callback);
};

Controller.prototype._registerAreqTimeout = function (evtKey) {
    var self = this,
        timeout;

    timeout = setTimeout(function () {
        self._invokeAreqCallback(evtKey, new Error('timeout'), null);
    }, AREQ_TIMEOUT * 1000);

    this._areqTimeouts[evtKey] = this._areqTimeouts[evtKey] || [];
    this._areqTimeouts[evtKey].push(timeout);
};

Controller.prototype._clearAreqTimeout = function (evtKey) {
    var timeouts = this._areqTimeouts[evtKey],
        timeout;

    if (!timeouts || (timeouts.length === 0))
        return;

    timeout = timeouts.shift();

    if (timeout)
        clearTimeout(timeout);

    if (timeouts.length === 0) {
        this._areqTimeouts[evtKey] = null;
        delete this._areqTimeouts[evtKey];
    }
};

Controller.prototype._registerAreqCallback = function (evtKey, cb) {
    // for those requests requiring AREQ coming back, should regitser its callback to controller

    this._areqCallbacks[evtKey] = this._areqCallbacks[evtKey] || [];
    this._areqCallbacks[evtKey].push(cb);
    this._registerAreqTimeout(evtKey);
};

Controller.prototype._invokeAreqCallback = function (evtKey, err, rsp) {
    var cbs = this._areqCallbacks[evtKey],
        cb;

    this._clearAreqTimeout(evtKey);

    if (!cbs || (cbs.length === 0))
        return;

    cb = cbs.shift();

    if (cbs.length === 0) {
        this._areqCallbacks[evtKey] = null;
        delete this._areqCallbacks[evtKey];
    }

    if (cb)
        cb(err, rsp);
};

/*************************************************************************************************/
/*** Public APIs                                                                               ***/
/*************************************************************************************************/
Controller.prototype.init = function () {
    var self = this;

    this._znp.init(this._cfg, function (err) {
        if (err)
            self.emit('ZNP:ERROR', err);
    });
};

Controller.prototype.close = function () {
    this._znp.close(function (err) {
        if (err)
            self.emit('ZNP:ERROR', err);
    });
};

Controller.prototype.request = function (subsys, cmdId, valObj, callback) {
    if (subsys.toUpperCase() === 'ZDO' || subsys === 5)
        return this._zdoRequest(cmdId, valObj, callback);           // use wrapped zdo as the exported api
    else
        return this._znpRequest(subsys, cmdId, valObj, callback);   // SREQ has timeout inside znp
};

/*************************************************************************************************/
/*** Mandatory Public APIs                                                                     ***/
/*************************************************************************************************/
Controller.prototype.start = function () {};
Controller.prototype.reset = function (mode, callback) {};
Controller.prototype.coordInfoReq = function (callback) {};
Controller.prototype.devInfoReq = function (callback) {};
Controller.prototype.epInfoReq = function (callback) {};
Controller.prototype.clusterInfoReq = function (callback) {};
Controller.prototype.attrInfoReq = function (callback) {};

Controller.prototype.setNwkInfo = function (key, val) {
    var set = true;

    if (this._net.hasOwnProperty[key])
        this._net.hasOwnProperty[key] = val;
    else
        set = false;

    return set;
};

Controller.prototype.getNwkInfo = function (callback) {
    return _.cloneDeep(this._net);
};

// Controller.prototype.setPermitJoinTime = function (argInst, callback) {};
// Controller.prototype.getPermitJoinTime = function (callback) {};
// Controller.prototype.joinTimeCountdown = function (callback) {};

/*************************************************************************************************/
/*** Network Management Public APIs                                                            ***/
/*************************************************************************************************/
Controller.prototype.reset = function (mode, callback) {
};

Controller.prototype.init = function (callback) {
    // self._executeInitCmd
};

Controller.prototype.sleep = function (callback) {
     // <No_rsp_cmd>, <specific_conf>
};

Controller.prototype.wakeup = function (callback) {
     // <No_rsp_cmd>, <specific_conf>
};

Controller.prototype.queryCoordState = function (callback) {
    return this.querySingleNwkInfo('DEV_STATE');
};

Controller.prototype.queryCoordInfo = function (callback) {
    var nwkInfo = this.getNwkInfo(),
        devInfo = {
            ieeeAddr: nwkInfo.ieeeAddr,
            nwkAddr: nwkInfo.nwkAddr
        };

    // [TODO]
    if (nwkInfo.state === null)
        devInfo.devStatus = 0;
    else if (nwkInfo.state === 1)   // TODO 255 – not applicable (this value is returned when the gateway application request information about the local gateway device)
        devInfo.devStatus = 255;    // 'NOT_APPLICABLE', Coord itself


    return this.queryDevInfo(devInfo.ieeeAddr, devInfo.nwkAddr);     // devInfo = { type: 0, ieeeAddr: ieeeAddr, nwkAddr: nwkAddr, manufId: null, epList: null };
};  // return devInfo = { type, ieeeAddr, nwkAddr, manufId, epList }

Controller.prototype.queryDevFullInfo = function (ieeeAddr, nwkAddr, callback) {
    var self = this,
        devFullInfo,
        epRspCount = 0,
        epRspCountUp,
        epQueries = [],
        epQueriesChecker,
        notActiveEpEvent = 'ZDO:stateChangeInd:' + nwkAddr + ':NOT_ACTIVE',
        fakeSimpDescEventHead = 'ZDO:simpleDescRsp:' + nwkAddr + ':';

    epRspCountUp = function () {
        epRspCount += 1;
    };

    epQueriesChecker = setInterval(function () {
        if (epRspCount < devInfo.epList.length)
            return;

        epQueries.forEach(function (qry, idx) {
            var epId = devInfo.epList[idx];
            if (Q.isPromise(qry) && qry.isPending())               // use profileid= 0xFFFF to notify that this ep is not active!
                self.emit(fakeSimpDescEventHead + epId, { endpoint: epId, profileid: 0xFFFF }); // emit a fake and empty endpoint
        });

        clearInterval(epQueriesChecker);
        epQueriesChecker = null;
    }, 1000);

    self.on(notActiveEpEvent, epRspCountUp);

    return this.queryDevInfo(ieeeAddr, nwkAddr).then(function (devInfo) {
        devFullInfo = devInfo;

        devInfo.epList.forEach(function (epId) {
            var epQuery = self.queryEpInfo(nwkAddr, epId).then(function (epInfo) {
                epRspCount += 1;
                return epInfo;
            });
            epQueries.push(self.queryEpInfo(nwkAddr, epId));
        });

        return Q.all(epQueries);
    }).then(function (epInfos) {
        epRspCount = 0;
        self.removeListener(notActiveEpEvent, epRspCountUp);
        devFullInfo.endpoints = epInfos;

        return devFullInfo;
    });
};

Controller.prototype.queryDevInfo = function (ieeeAddr, nwkAddr, callback) {
    var self = this,
        devInfo = {
            type: 0,                // 'NONE'
            ieeeAddr: ieeeAddr,
            nwkAddr: nwkAddr,
            manufId: null,
            epList: null
        };

    return this.request('ZDO', 'nodeDescReq', { dstaddr: nwkAddr, nwkaddrofinterest: nwkAddr }).then(function (nodeRsp) {
        // nodeRsp: { srcaddr, status, nwkaddr, logicaltype_cmplxdescavai_userdescavai, apsflags_freqband, maccapflags, manufacturercode, maxbuffersize, maxintransfersize, servermask, maxouttransfersize, descriptorcap }
        devInfo.type = nodeRsp.logicaltype_cmplxdescavai_userdescavai;
        devInfo.manufId = nodeRsp.manufacturercode;
        return self.request('ZDO', 'activeEpReq', { dstaddr: nwkAddr, nwkaddrofinterest: nwkAddr });
    }).then(function (epRsp) {
        // epRsp: { srcaddr, status, nwkaddr, activeepcount, activeeplist }
        var numEps = epRsp.activeepcount;
        devInfo.epList = epRsp.activeeplist;

        return devInfo;
    });
};

Controller.prototype.queryEpInfo = function (nwkAddr, epId) {
    var epInfo = { 
        profId: null,
        epId: null,
        devId: null,
        inCList: null,
        outCList: null
    };

    return this.request('ZDO', 'simpleDescReq', { dstaddr: nwkAddr, nwkaddrofinterest: nwkAddr, endpoint: epId }).then(function (epRsp) {
        // epRsp: { srcaddr, status, nwkaddr, len, endpoint, profileid, deviceid, deviceversion, numinclusters, inclusterlist, numoutclusters, outclusterlist }
        epInfo.profId = epRsp.profileid || 0;
        epInfo.epId = epRsp.endpoint;
        epInfo.devId = epRsp.deviceid || 0;
        epInfo.inCList = epRsp.inclusterlist || [];
        epInfo.outCList = epRsp.outclusterlist || [];

        return epInfo;
    });
};

Controller.prototype.queryNwkInfo = function (param, callback) {    // if not param, all
    var multiQuery = false,
        completed = 0,
        DEV_INFO = ZDEF.SAPI.ZB_DEVICE_INFO;

    if (_.isFunction(param)) {
        callback = param;
        param = [ 'DEV_STATE', 'IEEE_ADDR', 'SHORT_ADDR', 'CHANNEL', 'PAN_ID', 'EXT_PAN_ID' ];
        multiQuery = true;
    } else if (_.isString(param) || _.isNumber(param)) {
        return this.request('SAPI', 'getDeviceInfo', { param: param }, callback);
    } else {
        callback(new Error('param should be a string or a number.'));
    }

    if (!multiQuery)
        return;

    // todo
    // this.request('SAPI', 'getDeviceInfo', { param: DEV_INFO.DEV_STATE }, callback);
    // this.request('SAPI', 'getDeviceInfo', { param: DEV_INFO.IEEE_ADDR }, callback);
    // this.request('SAPI', 'getDeviceInfo', { param: DEV_INFO.SHORT_ADDR }, callback);
    // this.request('SAPI', 'getDeviceInfo', { param: DEV_INFO.CHANNEL }, callback);
    // this.request('SAPI', 'getDeviceInfo', { param: DEV_INFO.PAN_ID }, callback);
    // this.request('SAPI', 'getDeviceInfo', { param: DEV_INFO.EXT_PAN_ID }, callback);
};

Nwkmgr.prototype.displayNwkInfo = function () {
    var nwkInfo = this.getNwkInfo();    // { state, channel, panId, extPanId, ieeeAddr, nwkAddr }

    console.log(' ');
    console.log('>> Network Information:');
    console.log(' : State: ' + nwkInfo.state);
    console.log(' : Channel: ' + nwkInfo.channel);
    console.log(' : PanID: ' + nwkInfo.panId);
    console.log(' : Network Addr: ' + nwkInfo.nwkAddr);
    console.log(' : IEEE Addr: ' + nwkInfo.ieeeAddr);
    console.log(' : Extended PanID: ' + nwkInfo.extPanId);
    console.log(' ');

    return nwkInfo;
};

Controller.prototype.querySingleNwkInfo = function (param, callback) {
    var self = this,
        nwkNameToSet,
        paramValue;

    switch (param) {
        case 'DEV_STATE':
        case 0:
            nwkNameToSet = 'state';
            paramValue = 0;
            break;
        case 'IEEE_ADDR':
        case 1:
            nwkNameToSet = 'ieeeAddr';
            paramValue = 1;
            break;
        case 'SHORT_ADDR':
        case 2:
            nwkNameToSet = 'nwkAddr';
            paramValue = 2;
            break;
        case 'PARENT_SHORT_ADDR':
        case 3:
            paramValue = 3;
            break;
        case 'PARENT_IEEE_ADDR':
        case 4:
            paramValue = 4;
            break;
        case 'CHANNEL':
        case 5:
            nwkNameToSet = 'channel';
            paramValue = 5;
            break;
        case 'PAN_ID':
        case 6:
            nwkNameToSet = 'panId';
            paramValue = 6;
            break;
        case 'EXT_PAN_ID':
        case 7:
            nwkNameToSet = 'extPanId';
            paramValue = 7;
            break;
        default:
            paramValue = null;
            break;
    }

    if (paramValue === null) {
        callback(new Error('Unknown network property.'));
    } else {
        this.request('SAPI', 'getDeviceInfo', { param: paramValue }, function (err, rsp) {
            if (err) {
                callback(err);
            } else {
                if (nwkNameToSet)
                    self.setNwkInfo(nwkNameToSet, rsp.value);

                callback(null, rsp.value);
            }
        });
    }
};

Controller.prototype.permitJoin = function (joinType, joinTime, callback) {
    // ZDO_MGMT_PERMIT_JOIN_REQ
    // joinType: 0 (local)/ 1 (all dev)
    // joinTime: seconds, 0 disable, 0xFF always enable
    var self = this,
        deferred = Q.defer(),
        dstaddr,
        joinTimeDownCounter;

    if (joinType === 0)
        dstaddr = 0x0000;
    else if (joinType === 1)
        dstaddr = 0xFFFC;   // all coord and routers
    else
        deferred.reject(new Error('Not a valid joinType.'));

    this.setPermitJoinTime({ time: joinTime }).done();  // [TODO]

    // 'dstaddr', 'duration', 'tcsignificance'
    this.request('ZDO', 'mgmtPermitJoinReq', {
        dstaddr: dstaddr ,
        duration: joinTime,
        tcsignificance: 0
    }).then(function (result) {
        var nowJoinTime;
        joinTimeDownCounter = setInterval(function () {
            nowJoinTime = self.joinTimeCountdown();     // [TODO]

            if ( nowJoinTime === 0)
                clearInterval(joinTimeDownCounter);
        }, 1000);
       deferred.resolve(result);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

Controller.prototype.queryRoutingTable = function (dstaddr, callback) {
    return this.request('ZDO', 'mgmtRtgReq', { dstaddr: dstaddr, startindex: 0 });
};

Controller.prototype.queryNeighborTable = function (args, callback) {

};

Controller.prototype.getKey = function (args, callback) {

};

Controller.prototype.getKey = function (args, callback) {

};

Controller.prototype.queryDev = function (addrObj, callback) {
    // [TODO] not remote, not query

    // var deferred = Q.defer(),
    //     devInfo,
    //     i;

    // var getDevInfo = function (ieeeAddr) {
    //     zdb.getInfo('device', ieeeAddr, function (err, foundDev) {
    //         if (err) {
    //             deferred.reject(err);
    //         }
    //         devInfo = foundDev;

    //         if (foundDev) {
    //             zdb.getInfo('endpoint', ieeeAddr, function (err, foundEps) {
    //                 if (err) {
    //                     deferred.reject(err);
    //                 }                    
    //                 devInfo.epInfoList = foundEps;
    //                 // TODO : get cluster List
    //                 for (i = 0; i < devInfo.numEndpoints; i += 1) {
    //                     zdb.getInfo('cluster', ieeeAddr, foundEps[i].endpointId, 'in', function (err, foundClsts) {
    //                         devInfo.epInfoList[i].ipClusterInfoList = foundClsts;
    //                     }
    //                     zdb.getInfo('cluster', ieeeAddr, foundEps[i].endpointId, 'out', function (err, foundClsts) {
    //                         devInfo.epInfoList[i].outClusterInfoList = foundClsts;
    //                     }
    //                 }
    //                 deferred.resolve(devInfo);
    //             });                
    //         }
    //     });    
    // };

    // if (addrObj.ieeeAddr) {
    //     getDevInfo(addrObj.ieeeAddr);
    // } else if (addrObj.nwkAddr) {
    //     zdb.find({ nwkAddr: devDbId,  owner: null }, null, null, null, function (err, foundDev) {
    //         getDevInfo(foundDev.ieeeAddr);
    //     });
    // }
    // return deferred.promise.nodeify(callback);
};

Controller.prototype.queryDevList = function (addrObj, callback) {
    // [TODO] not remote, not query =? getDevList

    // var deferred = Q.defer(),
    //     nwkSelf = this,
    //     devList = [],
    //     i;
    // if (addrObj.hasOwnProperty('ieeeAddr') || addrObj.hasOwnProperty('nwkAddr')) {
    //     getSingleDev(addrObj).then(function (devInfo) {
    //         deferred.resolve(devInfo);
    //     }, function (err) {
    //         deferred.reject(err);
    //     });
    // } else {
    //     zdb.getInfo('device').then(function (devs) {
    //         if (devs) {
    //             for (i = 0; i < devs.length; i++) {
    //                 getSingleDev({ ieeeAddr: devs[i].ieeeAddr }).then(function (dev) {
    //                     devList.push(dev);
    //                     if (devList.length === devs.length) {
    //                         deferred.resolve(devList);
    //                     }
    //                 }, function (err) {
    //                     deferred.reject(err);
    //                 });
    //             }
    //         }
    //     }, function (err) {
    //         deferred.reject(err);
    //     }); 
    // }
    // return deferred.promise.nodeify(callback);
};

Controller.prototype.devListMaintain = function (args, callback) {
    // var deferred = Q.defer(),
    //     nwkSelf = this,
    //     ieeeAddr = addrObj.ieeeAddr,
    //     nwkAddr,
    //     epInfoList = [],
    //     i,
    //     type,
    //     devInfoRet,
    //     devMatched = false;
     
    // zdb.getInfo('device', ieeeAddr).then(function (foundDev) {
    //     if (foundDev) {
    //         nwkAddr = foundDev.nwkAddr;
    //         msghub.callSysmgr('retrieveDevInfo', { ieeeaddr: ieeeAddr, nwkaddr: nwkAddr }).then(function (deviceInfo) {
    //             epInfoList  = deviceInfo.epInfoList;
    //             devInfoRet = _und.omit(deviceInfo, 'epInfoList');
    //             delete deviceInfo.epInfoList;
    //             devMatched = _und.isEqual(devInfoRet, foundDev);

    //             // TODO : deep comparison for endpoints
    //             if (!devMatched) {
    //                 type = 'DEV_UPDATE';
    //                 zdb.modSert('device', deviceInfo.ieeeAddr, deviceInfo).then(function (result) {
    //                     for (i = 0; i < deviceInfo.numEndpoints; i += 1) {
    //                         zdb.modSert('endpoint', deviceInfo.ieeeAddr, epInfoList[i]).then(function (result) {
    //                             if (i === deviceInfo.numEndpoints -1) {
    //                                 deferred.resolve(deviceInfo);
    //                                 msghub.emit('ZB_NWK_ZIGBEE_DEVICE_IND', { indType: type, info: deviceInfo });
    //                             }
    //                         }, function (err) {
    //                             deferred.reject(err);
    //                         });
    //                     }
    //                 }, function (err) {
    //                     deferred.reject(err);
    //                 });
    //             } else {
    //                 callback(null, "No need to update.");
    //             }
    //         }, function (err) {
    //             deferred.reject(err);
    //         });
    //     }
    // }, function (err) {
    //     deferred.reject(err);
    // });

    // return deferred.promise.nodeify(callback);
};

Controller.prototype.removeDevice = function (args, callback) {
    // 'dstaddr', 'deviceaddress', 'removechildren_rejoin'
    // var deferred = Q.defer(),
    //     rmvDevMsg = {},
    //     dstaddr = argInst.dstaddr || 0,         // if short addr not given, assign to coord.
    //     deviceaddress = argInst.deviceaddress,
    //     removechildren_rejoin = 0;
    // // find the device from database to retrieve its short addr.
    // // FIXME : when nwkaddr changed by directly switch off power onbaord and then turn it on again. problems occur. can't remove that device.
    // zdb.getInfo('device', deviceaddress).then(function (foundDev) {
    //     if (foundDev) {
    //         dstaddr = foundDev.nwkAddr;
    //     }
    //     zdo.mgmtLeaveReq({ dstaddr: dstaddr, deviceaddress: deviceaddress, removechildren_rejoin: removechildren_rejoin }).then(function (msg) {
    //         rmvDevMsg.seqNum = 'TODO';
    //         rmvDevMsg.srcaddress = zutil.convToHexString(msg.srcaddr, 'uint16'); //responder's address
    //         rmvDevMsg.status = msg.status.key;
    //         deferred.resolve(rmvDevMsg);
    //     }, function (err) {
    //         deferred.reject(err);
    //     });
    // }, function (err) {
    //     deferred.reject(err);
    // });
    // return deferred.promise.nodeify(callback);
};

Controller.prototype.setBindingEntry = function (remoteEp, localEp, cId, callback) {
    // SourceAddress{object} (U, E), ClusterID{uint16}, DestAddress{object} (U, E), BindingMode{uint8} (0: bind, 1: unbind)
    // 'dstaddr', 'srcaddr', 'srcendpoint', 'clusterid', 'dstaddrmode', 'addr_short_long'
    // var deferred = Q.defer(),
    //     bindMsg = {},
    //     dstaddr = argInst.dstaddr,
    //     srcaddr = argInst.srcaddr,
    //     srcendpoint = argInst.srcendpoint,
    //     clusterid = argInst.clusterid,
    //     dstaddrmode = argInst.dstaddrmode,
    //     addr_short_long = argInst.addr_short_long,
    //     dstendpoint = argInst.dstendpoint,
    //     bindingmode = argInst.bindingmode;

    // checkDstAddrMode(dstaddrmode, addr_short_long).then(function (addrInfo) {

    //     if (bindingmode === 0 ) {
    //         zdo.bindReq({ dstaddr: dstaddr, srcaddr: srcaddr, srcendpoint: srcendpoint, clusterid: clusterid, dstaddrmode: addrInfo.dstAddrMode, addr_short_long: addrInfo.dstAddr, dstendpoint: dstendpoint })
    //         .then(function (msg) {
    //             bindMsg.srcaddress = msg.srcaddr;
    //             bindMsg.status = msg.status,
    //             deferred.resolve(bindMsg);
    //         }, function (err) {
    //             deferred.reject(err);
    //         });
    //     } else if (bindingmode === 1 ) {
    //         // 'dstaddr', 'srcaddr', 'srcendpoint', 'clusterid', 'dstaddrmode', 'addr_short_long'
    //         zdo.unbindReq({ dstaddr: dstaddr, srcaddr: srcaddr, srcendpoint: srcendpoint, clusterid: clusterid, dstaddrmode: addrInfo.dstAddrMode, addr_short_long: addrInfo.dstAddr, dstendpoint: dstendpoint })
    //         .then(function (msg) {
    //             bindMsg.srcaddress = msg.srcaddr;
    //             bindMsg.status = msg.status,
    //             deferred.resolve(bindMsg);
    //         }, function (err) {
    //             deferred.reject(err);
    //         });
    //     }else {
    //         deferred.reject(new Error('Not a valid bindingMode.'));
    //     }

    // }); 
    // return deferred.promise.nodeify(callback);
};

Controller.prototype.setDevPermitJoin = function (args, callback) {

};
// mtoRouteStart() // TODO
// mtoRouteStop()  // TODO

Controller.prototype.changeKey = function (shortAddr, ieeeAddr, linkKey, callback) {
    return this.request('ZDO', 'setLinkKey', { shortaddr: shortAddr, ieeeaddr: ieeeAddr, linkkey: linkKey }, callback);
};

Controller.prototype.getKey = function (ieeeAddr, callback) {
    return this.request('ZDO', 'getLinkKey', { ieeeaddr: ieeeAddr }, callback);
};

Controller.prototype.queryNwkAddr = function (ieeeAddr, callback) {
    return this.request('UTIL', 'addrmgrExtAddrLookup', { extaddr: ieeeAddr });
};

Controller.prototype.checkOnline = function (ieeeAddr, callback) {
    var self = this,
        devInfo = {
            status: 'offline',  // { type, ieeeAddr, nwkAddr, manufId, epList }
            nwkAddr: dev.nwkAddr,   // [TOOD] where is dev
        };

    // FIXME: At this time, 5000 ms timeout is a magic number. Do we need to use retry?
    this.queryNwkAddr(ieeeAddr).then(function (nwkAddr) {
        return self.request('ZDO', 'nodeDescReq', {
            dstaddr: nwkAddr,
            nwkaddrofinterest: nwkAddr
        }).timeout(5000);
    }).then(function (nodeRsp) {
        devInfo.status = 'online';
        devInfo.nwkAddr = nodeRsp.srcaddr;
        dev.update(devInfo);

        self.emit('ZDO:END_DEVICE_ANNCE_IND', {
            srcaddr: devInfo.nwkAddr,
            nwkaddr: devInfo.nwkAddr,
            ieeeaddr: devInfo.ieeeAddr,
            capabilities: 14            // 'DEVICETYPE_FFD | POWER_AC | RCVR_ON_IDLE', value: 14
        });
    });
};

Controller.prototype.bindRemoteToLocalEndpoint = function (remoteEp, localEp, cId, callback) {
    var coord = this.getCoord(),
        bindValObj = {
            dstaddr: 0,
            srcaddr: coord.getIeeeAddr(),
            srcendpoint: localEp.getEpId(),
            clusterid: cId,
            dstaddrmode: ZDEF.AF.ADDRESS_MODE.ADDR_64BIT,   // 3
            addr_short_long: remoteEp.getIeeeAddr(),
            dstendpoint: remoteEp.getEpId(),            // no use when binding upon nwkAddr
            bindingmode: 0      // 0: bind, 1: unbind
        };


    doBinding = function () {
        msghub.callNwkmgr('setBindingEntry', bindArg).then(function (bindMsg) {
            deferred.resolve(bindMsg);
        }, function (err) {
            deferred.reject(err);
        });
    };

    if (!localEp.isLocal()) {
        // reject
    }

    if (remoteEp.getProfId() !== localEp.getProfId()) {
        // reject
    }

    if (!localEp.hasOutCluster(cId)) {  // opClusterList
        // not found, re-register the localEp to coord

        if (localEp.isDelegator()) {    // if localEp is a delegator, re-register it to zbCoord
            localEp.info.opClusterList.push(cId);
            localEp.info.numOpClusters += 1;
            coordSelf.reRegisterEndpoint(localEp).then(function (result) {
                doBinding();
            }).fail(function (err) {
                deferred.reject(err);
            }).done();
        } else {
            // reject, application should prepare that cluster for binding, developer is responsible for this
        }

    }

    var coordSelf = this,
        deferred = Q.defer(),
        doBinding,
        cIdIndexFound,



    // Check if zbEp and localEp have the same profile
    if (zbEp.info.profileId !== localEp.info.profileId) {
        deferred.reject(new Error('Cannot bind endpoints with different profile.'));
    } else {
        // Check if localEp has the target cluster
        cIdIndexFound = zutil.zbFindIndex(localEp.info.opClusterList, null, cId);
        if (cIdIndexFound === -1) { // not found, re-register the localEp to zbCoord
            if (localEp.isDelegator) {  // if localEp is a delegator, re-register it to zbCoord
                localEp.info.opClusterList.push(cId);
                localEp.info.numOpClusters += 1;
                coordSelf.reRegisterEndpoint(localEp).then(function (result) {
                    doBinding();
                }).fail(function (err) {
                    deferred.reject(err);
                }).done();   
            } else {    // if localEp is an application endpoint, reject to tell user to prepare right cluster for binding
                deferred.reject(new Error('No such cluster to bind to.'));
            }
        } else {
            doBinding();
        }
    }
    return deferred.promise.nodeify(callback);
};

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

/*************************************************************************************************/
/*** Private Functions                                                                         ***/
/*************************************************************************************************/
Controller.prototype._generateAfParams = function (localEp, dstEp, cId, rawData, opt) {
    var afOptions = ZDEF.AF.OPTIONS.ACK_REQUEST | ZDEF.AF.OPTIONS.DISCV_ROUTE;    // ACK_REQUEST (0x10), DISCV_ROUTE (0x20)
    opt = opt || {};

    return {
        dstaddr: dstEp.getNwkAddr(),
        destendpoint: dstEp.getEpId(),
        srcendpoint: localEp.getEpId(),
        clusterid: cId,
        transid: this.nextTransId(),
        options: opt.options || afOptions,
        radius: opt.radius || ZDEF.AF_DEFAULT_RADIUS,
        len: rawData.length,
        data: rawData
    };
};

Controller.prototype._generateBroadcastAfParams = function (localEp, addrMode, dstAddr, clusterId, rawData, opt) {
    var afOptions = ZDEF.AF.OPTIONS.DISCV_ROUTE;
    opt = opt || {};

    // [TODO] check dstAddr -> destAddr -> should be long addr '0x123456'

    return  {
        dstaddrmode: addrMode,
        dstaddr: destAddr,
        destendpoint: 0xFF,
        dstpanid: 0,
        srcendpoint: localEp.getEpId(),
        clusterid: clusterId,
        transid: this.nextTransId(),
        options: opt.options || afOptions,
        radius: opt.radius || ZDEF.AF_DEFAULT_RADIUS,
        len: rawData.length,
        data: rawData
    };
};


// .frame(frameCntl, manufCode, seqNum, cmd, zclPayload)
Controller.prototype.zclRead = function (dstEp, cId, attrIds, callback) {
    // build a ZCL raw buffer
    var dev = dstEp.getDev();

    if (!dev)
        return callback(new Error('device not found.'));

    var manufId = dev.getManufId();
    var seqNum = this.nextSeqNum();
    var zclPayload = attrIds.map(function (aId) {
        return { attrId: aId };
    });

    var zclBuf = zclFoundation.frame({ manufSpec: 0, direction: 0, disDefaultRsp: 0 }, manufId, seqNum, 'read', zclPayload);
};

Controller.prototype.zclWrite = function (dstEp, cId, recs) {};
Controller.prototype.zclWriteUndiv = function (dstEp, cId, recs) {};
Controller.prototype.zclWriteNoRsp = function (dstEp, cId, recs) {};
Controller.prototype.zclConfigReport = function (dstEp, cId, recs) {};
Controller.prototype.zclReadReportConfig = function (dstEp, cId, recs) {};
Controller.prototype.zclReadStruct = function (dstEp, cId, recs) {};
Controller.prototype.zclReport = function (dstEp, cId, recs) {};
Controller.prototype.zclWriteStrcut = function (dstEp, cId, recs) {};
Controller.prototype.zclDiscover = function (dstEp, cId, startIndex, maxNum) {};
Controller.prototype.zclCmd = function (dstEp, cId, startIndex, maxNum) {};


/*************************************************************************************************/
/*** Coordinator and Delegators Initialization [TODO] make private                             ***/
/*************************************************************************************************/
Controller.prototype._initCoordinator = function () {
    var self = this;

    return this._initCoordAtConnected().then(function (nwkInfo) {
        return self._initCoordAfterConnected(nwkInfo);
    }).then(function () {
        return self._recoverFromDataBase(); // [TODO]
    }).then(function () {
        return self._checkOnlineOfAll();
    });
};

Controller.prototype._initCoordAtConnected = function () {
    var self;
    // check if znp coord has booted up
    return this.queryCoordState().then(function (state) {
        if (state === 'ZB_COORD' || state === 0x09)
            return self.queryNwkInfo(); // coord has started
        else
            return self._initBootCoordFromApp();
    }).then(function (nwkInfo) {
        self.setNetInfo(nwkInfo);
        return nwkInfo;
    });
};  // return nwkInfo: { state, channel, panId, extPanId, ieeeAddr, nwkAddr }

Controller.prototype._initBootCoordFromApp = function () {
    var self = this,
        waitBootTime = 3000;

    return this.request('ZDO', 'startupFromApp', { startdelay: 100 }).then(function (rsp) {
        return Q.delay(rsp, waitBootTime);
    }).then(function () {
        // all registered endpoints on coord are cleared when coord boots/reboots
        return self.queryNwkInfo();
    });
};  // return nwkInfo

Controller.prototype._initCoordAfterConnected = function (nwkInfo) {
    var self = this,
        isCoordRunning = !!this.getCoord();

    this.queryCoordInfo().then(function (coordInfo) {   // coordInfo = { type, ieeeAddr, nwkAddr, manufId, epList }
        if (!isCoordRunning) {
            self._coord = new Coordinator(coordInfo);   // create a new coord
            self.delegators = null;                     // clear all delegators

            var dlgIPM = new Coordpoint(self._coord, { profId: 0x0101, epId: 1, devId: 0x0005, inCList: [], outCList: [] }, true),  // 'IPM': 0x0101, Industrial Plant Monitoring
                dlgHA = new Coordpoint(self._coord, { profId: 0x0104, epId: 2, devId: 0x0005, inCList: [], outCList: [] }, true),   // 'HA': 0x0104, Home Automation
                dlgCBA = new Coordpoint(self._coord, { profId: 0x0105, epId: 3, devId: 0x0005, inCList: [], outCList: [] }, true),  // 'CBA': 0x0105, Commercial Building Automation
                dlgTA = new Coordpoint(self._coord, { profId: 0x0107, epId: 4, devId: 0x0005, inCList: [], outCList: [] }, true),   // 'TA': 0x0107, Telecom Applications
                dlgPHHC = new Coordpoint(self._coord, { profId: 0x0108, epId: 5, devId: 0x0005, inCList: [], outCList: [] }, true), // 'PHHC': 0x0108, Personal Home & Hospital Care
                dlgSE = new Coordpoint(self._coord, { profId: 0x0109, epId: 6, devId: 0x0005, inCList: [], outCList: [] }, true);   // 'SE': 0x0109, Smart Energy 'AMI': 0x0109, Advanced Metering Initiative, Smart Energy

            self.delegators = [ dlgIPM, dlgHA, dlgCBA, dlgTA, dlgPHHC, dlgSE ];
        }

        return self._delegators;
    }).then(function (dlgs) {
        var registerResults = [];

        dlgs.forEach(function (dlgEp) {
            registerResults.push(self._coord.reRegisterEndpoint(dlgEp));
        });

        return Q.all(registerResults);
    }).fail(function () {
        self.emit('ZNP:INIT:FAIL');
    }).then(function () {
        self.emit('ZNP:INIT');
    });
};

Controller.prototype._recoverFromDataBase = function () {
    // should load at shepherd level
};

Controller.prototype._checkOnlineOfAll = function () {
    // should check online at shepherd level
    // if (!appload) then check
};

Controller.prototype.reset = function (mode, callback) {
    if (mode === 'soft' || mode === 1)
        return this._softReset(callback);
    else if (mode === 'hard' || mode === 0)
        return this._hardReset(callback);
};

Controller.prototype._softReset = function (callback) {
    return this.request('SYS', 'resetReq', { type: 0x01 }, callback);
};

Controller.prototype._hardReset = function (callback) {
    var self = this,
        steps = [
            function () { return self.request('SYS', 'resetReq', { type: 0x00 }).delay(0); },
            function () { return self.request('SAPI', 'writeConfiguration', nvParams.startupOption).delay(4000); },
            function () { return self.request('SYS', 'resetReq', { type: 0x00 }).delay(10); },
            function () { return self.request('SAPI', 'writeConfiguration', nvParams.panId).delay(5000); },
            function () { return self.request('SAPI', 'writeConfiguration', nvParams.extPanId).delay(10); },
            function () { return self.request('SAPI', 'writeConfiguration', nvParams.channelList).delay(10); },
            function () { return self.request('SAPI', 'writeConfiguration', nvParams.logicalType).delay(10); },
            function () { return self.request('SAPI', 'writeConfiguration', nvParams.precfgkey).delay(10); },
            function () { return self.request('SAPI', 'writeConfiguration', nvParams.precfgkeysEnable).delay(10); },
            function () { return self.request('SYS', 'osalNvWrite', nvParams.securityMode).delay(10); },
         // function () { return self.request('AF', 'register', nvParams.afRegister).delay(10); },
            function () { return self.request('SAPI', 'writeConfiguration', nvParams.zdoDirectCb).delay(10); },
         // function () { return self.request('ZDO', 'startupFromApp', { startdelay: 0 }).delay(10); },
            function () { return self.request('SYS', 'osalNvItemInit', nvParams.znpCfgItem).delay(10); },
            function () { return self.request('SYS', 'osalNvWrite', nvParams.znpHasConfigured).delay(10); }
        ];

    return steps.reduce(function (soFar, fn) {
        return soFar.then(fn);
    }, Q(0));
};

module.exports = Controller;
