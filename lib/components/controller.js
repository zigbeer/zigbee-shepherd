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
}

util.inherits(Controller, EventEmitter);

Controller.prototype._registerAreqCallback = function (evtKey, cb) {
    this.once(evtKey, cb);
};

Controller.prototype._areqEventBridge = function (msg) {
    // {
    //  subsys: 'ZDO',
    //  ind: 'endDeviceAnnceInd',
    //  data: { srcaddr: 63536, nwkaddr: 63536, ieeeaddr: '0x00124b0001ce3631', capabilities: 142 }
    // }

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

Controller.prototype.afDataSend = function (srcEp, dstEp, afArg, callback) {

};

Controller.prototype.afDataBroadcast = function (zbEp, addrMode, dstAddr, clusterId, cmdId, argInst, callback) {

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

Controller.prototype.zclWrite = function (ieeeAddr, epId, cId, recs) {};
Controller.prototype.zclWriteUndiv = function (ieeeAddr, epId, cId, recs) {};
Controller.prototype.zclWriteNoRsp = function (ieeeAddr, epId, cId, recs) {};
Controller.prototype.zclConfigReport = function (ieeeAddr, epId, cId, recs) {};
Controller.prototype.zclReadReportConfig = function (ieeeAddr, epId, cId, recs) {};
Controller.prototype.zclReadStruct = function (ieeeAddr, epId, cId, recs) {};
Controller.prototype.zclReport = function (ieeeAddr, epId, cId, recs) {};
Controller.prototype.zclWriteStrcut = function (ieeeAddr, epId, cId, recs) {};
Controller.prototype.zclDiscover = function (ieeeAddr, epId, cId, startIndex, maxNum) {};

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
