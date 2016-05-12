var EventEmitter = require('events'),
    znp = require('cc-znp'),
    zcl = require('zcl-packet'),
    Q = require('q'),
    Coordpoint = require('./coordpoint.js'),
    bridge = require('./event_bridge.js'),
    CONST = require('./constants.js') ;

// CONSTANTS
var AREQ_TIMEOUT = 30,      // seconds
    AF_DEFAULT_RADIUS = CONST.AF_DEFAULT_RADIUS,
    AF_OPTIONS = CONST.AF_OPTIONS,
    AF_ADDR_MODE = CONST.AF_ADDR_MODE,
    ZB_DEVICE_INFO = CONST.ZB_DEVICE_INFO;

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
    return this.broadcastAfDataWithLocalEp(localEp, AF_ADDR_MODE.AddrGroup, groupId, clusterId, rawData, opt, callback);
};

Controller.prototype.broadcastAfData = function (localEp, clusterId, rawData, opt, callback) {
    // [TODO] Do we need local EP? or profile
    return this.broadcastAfDataWithLocalEp(localEp, AF_ADDR_MODE.AddrBroadcast, 0xFFFF, clusterId, rawData, opt, callback);
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
        completed = 0;

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
    // this.request('SAPI', 'getDeviceInfo', { param: ZB_DEVICE_INFO.DEV_STATE }, callback);
    // this.request('SAPI', 'getDeviceInfo', { param: ZB_DEVICE_INFO.IEEE_ADDR }, callback);
    // this.request('SAPI', 'getDeviceInfo', { param: ZB_DEVICE_INFO.SHORT_ADDR }, callback);
    // this.request('SAPI', 'getDeviceInfo', { param: ZB_DEVICE_INFO.CHANNEL }, callback);
    // this.request('SAPI', 'getDeviceInfo', { param: ZB_DEVICE_INFO.PAN_ID }, callback);
    // this.request('SAPI', 'getDeviceInfo', { param: ZB_DEVICE_INFO.EXT_PAN_ID }, callback);
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
    // [TODO] not remote, not query

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

};

Controller.prototype.removeDevice = function (args, callback) {

};

Controller.prototype.setBindingEntry = function (args, callback) {

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



/*************************************************************************************************/
/*** Private Functions                                                                         ***/
/*************************************************************************************************/


Controller.prototype._generateAfParams = function (localEp, dstEp, cId, rawData, opt) {
    var afOptions = AF_OPTIONS.ACK_REQUEST | AF_OPTIONS.DISCV_ROUTE;
    opt = opt || {};

    return {
        dstaddr: dstEp.getNwkAddr(),
        destendpoint: dstEp.getEpId(),
        srcendpoint: localEp.getEpId(),
        clusterid: cId,
        transid: this.nextTransId(),
        options: opt.options || afOptions,
        radius: opt.radius || AF_DEFAULT_RADIUS,
        len: rawData.length,
        data: rawData
    };
};

Controller.prototype._generateBroadcastAfParams = function (localEp, addrMode, dstAddr, clusterId, rawData, opt) {
    var afOptions = AF_OPTIONS.DISCV_ROUTE;
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
        radius: opt.radius || AF_DEFAULT_RADIUS,
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
    return this._executeInitCmd('SYS', 'resetReq', { type: 0x01 }, 0, callback);
};

Controller.prototype._hardReset = function (callback) {
    var self = this;

    return this._executeInitCmd('SYS', 'resetReq', { type: 0x00 }, 0).then(function () {
        return self._executeInitCmd('SAPI', 'writeConfiguration', nvParams.startupOption, 4000);
    }).then(function () {
        return self._executeInitCmd('SYS', 'resetReq', { type: 0x00 }, 10);
    }).then(function () {
        return self._executeInitCmd('SAPI', 'writeConfiguration', nvParams.panId, 5000);
    }).then(function () {
        return self._executeInitCmd('SAPI','writeConfiguration', nvParams.extPanId, 10);
    }).then(function () {
        return self._executeInitCmd('SAPI','writeConfiguration', nvParams.channelList, 10);
    }).then(function () {
        return self._executeInitCmd('SAPI','writeConfiguration', nvParams.logicalType, 10);
    }).then(function () {
        return self._executeInitCmd('SAPI','writeConfiguration', nvParams.precfgkey, 10);
    }).then(function () {
        return self._executeInitCmd('SAPI','writeConfiguration', nvParams.precfgkeysEnable, 10);
    }).then(function () {
        return self._executeInitCmd('SYS', 'osalNvWrite', nvParams.securityMode, 10);
    // }).then(function () {
    //     return self._executeInitCmd('AF', 'register', nvParams.afRegister, 10);
    }).then(function () {
        return self._executeInitCmd('SAPI', 'writeConfiguration', nvParams.zdoDirectCb, 10);
    // }).then(function () {
    //     return self._executeInitCmd('ZDO', 'startupFromApp', { startdelay: 0 }, 10);
    }).then(function () {
        return self._executeInitCmd('SYS', 'osalNvItemInit', nvParams.znpCfgItem, 10);
    }).then(function () {
        return self._executeInitCmd('SYS', 'osalNvWrite', nvParams.znpHasConfigured, 10);
    });
    // .then(function (result) {
    //     setTimeout(function () {
    //         msghub.callNwkmgr('retrieveNwkInfo').then(function (nwkInfo) {
    //             return msghub.callNwkmgr('showNwkInfo');
    //         }).fail(function (err) {
    //             console.log(err);
    //         }).done();
    //     }, 3500);
    //     return result;
    // })
};

Controller.prototype._executeInitCmd = function (subsys, apiName, valObj, delay, callback) {
    var deferred = Q.defer();

    this.request(subsys, apiName, valObj).delay(delay).then(function (result) {
        deferred.resolve(result);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

module.exports = Controller;
