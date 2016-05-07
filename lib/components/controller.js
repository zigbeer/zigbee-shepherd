var EventEmitter = require('events');

var znp = require('cc-znp'),
    Zcl = require('zcl-packet'),
    zclFoundation = new Zcl('foundation');

var bridge = require('./event_bridge.js');

function Controller(shepherd, cfg) {      // cfg is serial port config
    EventEmitter.call(this);

    var self = this;

    // flow control
    this._threshold = 6;  // max pending is 6 - 1 = 5
    this._requestPoll = [];

    this._shepherd = shepherd;
    this._zdo = new Zdo();
    this._znp = znp;
    this._cfg = cfg;

    // zdo.sendRequest() is always be znp.zdoRequest()
    this._zdo.sendRequest = this._znp.zdoRequest;

    this._znp.on('ready', function () {
        self.emit('ZNP:INIT');
    });

    this._requestCosumer = null;

    this._znp.on('AREQ', this._areqEventBridge);
    // {
    // subsys: 'ZDO',
    // ind: 'endDeviceAnnceInd',
    // data: { srcaddr: 63536, nwkaddr: 63536, ieeeaddr: '0x00124b0001ce3631', capabilities: 142 }
    // }
}

util.inherits(Controller, EventEmitter);

Controller.prototype._registerAreqCallback = function (evtKey, cb) {
    this.once(evtKey, cb);
};

Controller.prototype._areqEventBridge = function (msg) {
    var mandatoryEvent = msg.subsys + ':' + msg.ind, // SYS:resetInd, SYS:osalTimerExpired
        targetDev,
        targetEp,
        bridgedEvent;

    bridgedEvent = bridge.generateEvent(this, msg);

    this.emit('ind', msg);                  // bridge 'AREQ' to 'ind'
    this.emit(mandatoryEvent, msg.data);    // bridge to subsystem events

    if (bridgedEvent)
        this.emit(bridgedEvent, msg.data);  // bridge to AF, ZDO events
};

Controller.prototype.zclDataSend = function (dstIeeeAddr, dstEpId, dstCId, zclPacket, callback) {
    var dstEp = this._shepherd.findEp(dstIeeeAddr, dstEpId);
    if (!dst)
        return callback(new Error('endpoint not found'));

    var profId = dstEp.profId,
        dstDev = dstEp.device,
        dstDevType = dstDev.type,
        coord = this._shepherd.getCoord();
    //     afOpt_ApsAck = ZDEFS.AfOptions.get('ACK_REQUEST').value,
    //     afOpt_DiscvRoute = ZDEFS.AfOptions.get('DISCV_ROUTE').value,
    //     afOpt_SkipRoute = ZDEFS.AfOptions.get('SKIP_ROUTING').value,
    //     afOpts = afOpt_ApsAck | afOpt_DiscvRoute,

    var afArg = {
        dstaddr: dstDev.nwkAddr,
        destendpoint: dstEp.id,
        srcendpoint: null,
        clusterid: dstCId,
        transid: null,
        options: afOpts,
        radius: ZDEFS.AF_DEFAULT_RADIUS,
        len: zclPacket.length,
        data: zclPacket
    };
};


    // var targetProfileId = targetEp.info.profileId,
    //     targetDev = targetEp.ownerDevice,
    //     targetDevType = targetDev.devType,
    //     zbCoord = targetDev.ownerDevmgr.zbCoord,        
    //     delegateCoordEp,
    //     senderEp,
    //     afOpt_ApsAck = ZDEFS.AfOptions.get('ACK_REQUEST').value,
    //     afOpt_DiscvRoute = ZDEFS.AfOptions.get('DISCV_ROUTE').value,
    //     afOpt_SkipRoute = ZDEFS.AfOptions.get('SKIP_ROUTING').value,
    //     afOpts = afOpt_ApsAck | afOpt_DiscvRoute,
    //     afArg = {
    //         dstaddr: targetDev.nwkAddr,
    //         destendpoint: targetEp.endpointId,
    //         srcendpoint: null,     // assigned later by finding the delegate/local ep from coord.
    //         clusterid: cId,
    //         transid: null,         // assigned later by the delegate/local ep by calling its sendAfData()
    //         options: afOpts,
    //         radius: ZDEFS.AF_DEFAULT_RADIUS,
    //         len: rawData.length,
    //         data: rawData
    //     };

    // if (zutil.isLocalEp(this)) {    // for local ep, sender is himself
    //     senderEp = this;
    // } else {                        // for remote ep, sender is the delegator
    //     senderEp = zutil.findDelegateEp(zbCoord.zbEndpoints, targetProfileId);
    // }
    // afArg.srcendpoint = senderEp.endpointId;

    // return senderEp.sendAfData(targetEp, afArg, callback);

Controller.prototype.afDataSend = function (srcEp, dstEp, afArg, callback) {
    var deferred = Q.defer(),
        thisTransaction = {
            oDeferred: deferred,
            oAfArg: afArg,
            oTargetEp: targetEp,
            sendTimes: 0
        };

    afArg.transid = zbEp.nextTransId();
    zbEp._transHolder[afArg.transid] = thisTransaction;

    msghub.callZpi('AfDataRequest', afArg).then(function (result) {
        thisTransaction.sendTimes += 1;
        if (result.status.key !== 'ZSuccess') {
            deferred.reject(new Error('AfDataRequest failed!'));
            zbEp._transHolder[afArg.transid] = null;
            delete zbEp._transHolder[afArg.transid];
        }
        // The deferred will be resolved by the return confirm message asynchronously
    });

    // The deferred will be resolved in listener: msghub.on(afCnfEventName... 
    return deferred.promise.nodeify(callback);  
};

Controller.prototype.afDataBroadcast = function (zbEp, addrMode, dstAddr, clusterId, cmdId, argInst, callback) {
    var deferred = Q.defer(),
        destAddr = [0, dstAddr],
        afOpt_DiscvRoute = ZDEFS.AfOptions.get('DISCV_ROUTE').value,
        afOpts = afOpt_DiscvRoute,
        afArg = {
            dstaddrmode: addrMode,
            dstaddr: destAddr,
            destendpoint: 0xFF,
            dstpanid: 0,
            srcendpoint: zbEp.endpointId,
            clusterid: clusterId,
            transid: zbEp.nextTransId(),
            options: afOpts,
            radius: ZDEFS.AF_DEFAULT_RADIUS,
            len: null,
            data: null
        },
        clstName = ZCLDEFS.ClusterID.get(clusterId).key,
        cmdName = ZCLDEFS.Cluster[clstName].Cmd.get(cmdId).key,
        zclFrameCntl = zclFunc.newFrameCntl(1, 0, 0, 0),
        zclHeader = zclFunc.newZclHeader(zclFrameCntl, zbEp.ownerDevice.manufacturerId, afArg.transid, cmdId),
        argObj = zclFuncField[clstName + cmdName]().transToArgObj(argInst);
    
    afArg.data = zclFunc.buildFrame(zclHeader, argObj);
    afArg.len = afArg.data.length;

    msghub.callZpi('AfDataRequestExt', afArg).then(function (result) {
        if (result.status.key !== 'ZSuccess') {
            deferred.reject(new Error('AfDataRequest failed!'));
        } else {
            // Broadcast (or Groupcast) has no AREQ confirm back,
            // we can just resolve this transaction if message successfully send.
            deferred.resolve(result);
        }
    });

    return deferred.promise.nodeify(callback);
};


// .frame(frameCntl, manufCode, seqNum, cmd, zclPayload)
Controller.prototype.zclRead = function (ieeeAddr, epId, cId, attrIds, callback) {
    // build a ZCL raw buffer
    var dev = this._shepherd.findDev(ieeeAddr);

    if (!dev)
        return callback(new Error('device not found.'));

    var manufId = dev.getManufId();
    var seqNum = this.nextSeqNum();
    var zclPayload = attrIds.map(function (aId) {
        return { attrId: aId };
    });

    var zclBuf = zclFoundation.frame({ manufSpec: 0, direction: 0, disDefaultRsp: 0 }, manufId, seqNum, 'read', zclPayload);


};

Controller.prototype.zclWrite = function (ieeeAddr, epId, cId, recs) {
    
};

Controller.prototype.zclWriteUndiv = function (ieeeAddr, epId, cId, recs) {
    
};

Controller.prototype.zclWriteNoRsp = function (ieeeAddr, epId, cId, recs) {
    
};

Controller.prototype.zclConfigReport = function (ieeeAddr, epId, cId, recs) {
    
};

Controller.prototype.zclReadReportConfig = function (ieeeAddr, epId, cId, recs) {
    
};

Controller.prototype.zclReadStruct = function (ieeeAddr, epId, cId, recs) {
    
};

Controller.prototype.zclReport = function (ieeeAddr, epId, cId, recs) {
    
};

Controller.prototype.zclWriteStrcut = function (ieeeAddr, epId, cId, recs) {
    
};

Controller.prototype.zclDiscover = function (ieeeAddr, epId, cId, startIndex, maxNum) {
    
};
/*************************************************************************************************/
/*** Protected Methods                                                                         ***/
/*************************************************************************************************/
Controller.prototype._startRequestConsumer = function () {
    // var poll = this._requestPoll,
    //     pollLength = this._requestPoll.length,
    //     req;

    // if (pollLength === 0) {         // nothing to send
    //     if (this._requestCosumer) {
    //         clearInterval(this._requestCosumer);
    //         this._requestCosumer = null;
    //     }
    //     return;
    // }

    // if (pollLength && (pollLength < this._threshold)) {   // pendings < 5
    //     req = poll.shift();
    //     req();
    // } else if (!this._requestCosumer) { // pendings > 5, and consumer is not started
    //     this._requestCosumer = setInterval(function () {
    //         var req;
    //         if (self._pendingRequests.length) {
    //             req = self._pendingRequests.shift();
    //             if (req)
    //                 req();
    //         } else {
    //             clearInterval(this._requestCosumer);
    //             this._requestCosumer = null;
    //         }
    //     }, 100);
    // }
};

Controller.prototype._enPoll = function (fn) {
    this._requestQueue.push(fn);
};

Controller.prototype._dePoll = function (fn) {
    // remove from poll
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
    // var self = this,
    //     req;

    // req = function () {
    //     return this._znp.request(subsys, cmdId, valObj, function (err, rsp) {
    //         self._dePoll(req);
    //         callback(err, rsp);
    //     });
    // };

    // this._enPoll(req);
    // this._startRequestConsumer();

    // if (subsys.toUpperCase() === 'ZDO' || subsys === 5)
    //     return this._zdo.request(cmdId, valObj, callback);          // use wrapped zdo as the exported api
    // else
    //     return this._znp.request(subsys, cmdId, valObj, callback);
};


Controller.prototype.start = function () {};
Controller.prototype.reset = function (mode, callback) {};
Controller.prototype.coordInfoReq = function (callback) {};
Controller.prototype.devInfoReq = function (callback) {};
Controller.prototype.epInfoReq = function (callback) {};
Controller.prototype.clusterInfoReq = function (callback) {};
Controller.prototype.attrInfoReq = function (callback) {};

Controller.prototype.setNwkInfo = function (argInst, callback) {};
Controller.prototype.getNwkInfo = function (callback) {};
// Controller.prototype.setPermitJoinTime = function (argInst, callback) {};
// Controller.prototype.getPermitJoinTime = function (callback) {};
// Controller.prototype.joinTimeCountdown = function (callback) {};


// retrieveNwkInfo(cb)
// retrieveSingleNwkInfo(param, callback)
// showNwkInfo(cb)
// getRoutingTable(argInst, callback)
// setPermitJoin(argInst, callback) 

// mtoRouteStart() // TODO
// mtoRouteStop()  // TODO

// getNeighborTable(dstaddr, startindex, callback) // TODO
// getRoutingTable(dstaddr, startindex, callback)  // TODO


// changeKey(argInst, callback)
// getKey(argInst, callback)
// getDevList(addrObj, callback)

// devListMaintain(addrObj, callback)
// removeDevice(argInst, callback)
// setBindingEntry(argInst, callback)




module.exports = Controller;