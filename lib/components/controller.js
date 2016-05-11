var EventEmitter = require('events'),
    znp = require('cc-znp'),
    zcl = require('zcl-packet'),
    zdoHelper = require('./zdo_helper.js');

var BEACON_MAX_DEPTH = 0x0F;
var DEF_NWK_RADIUS = 2 * BEACON_MAX_DEPTH;
var AF_DEFAULT_RADIUS = DEF_NWK_RADIUS;
var AF_OPTIONS = {
    PREPROCESS: 0x04,
    LIMIT_CONCENTRATOR: 0x08,
    ACK_REQUEST: 0x10,
    DISCV_ROUTE: 0x20,
    EN_SECURITY: 0x40,
    SKIP_ROUTING: 0x80
};

var AF_ADDR_MODE = {
    AddrNotPresent: 0,
    AddrGroup: 1,
    Addr16Bit: 2,
    Addr64Bit: 3,
    AddrBroadcast: 15
};

function Controller(shepherd, cfg) {      // cfg is serial port config
    EventEmitter.call(this);

    var self = this,
        seqNum = 0,
        transId = 0;

    // flow control
    // this._threshold = 6;  // max pending is 6 - 1 = 5
    // this._requestPoll = [];

    this._shepherd = shepherd;
    this._zdo = new Zdo(this);
    this._znp = znp;
    this._cfg = cfg;

    // nwkInfo = {
    //     state: 0,
    //     networkChannel: 0,
    //     panId: 0,
    //     extPanId: [],
    //     ieeeAddr: [],
    //     nwkAddr: 0,
    //     permitRemainingTime: permitJoinTime,    // default time? need a timer to update this.
    //     numPendingAttribs: 0
    // };

    this._delegators = [];
    // this.newEndpointInfo = function (epId, profileId, deviceId, numIpClusters, ipClusterList, numOpClusters, opClusterList) {
    // sysMgrEpInfo = new zdb.newEndpointInfo(1, 0x0104, 0x0005, 0, [], 0, []);
    // { epId: 1, profId: 0x0101, devId: 0x0005, inCList: [], outCList: [] }    // 'IPM': 0x0101, Industrial Plant Monitoring
    // { epId: 2, profId: 0x0104, devId: 0x0005, inCList: [], outCList: [] }    // 'HA': 0x0104, Home Automation
    // { epId: 3, profId: 0x0105, devId: 0x0005, inCList: [], outCList: [] }    // 'CBA': 0x0105, Commercial Building Automation
    // { epId: 4, profId: 0x0107, devId: 0x0005, inCList: [], outCList: [] }    // 'TA': 0x0107, Telecom Applications
    // { epId: 5, profId: 0x0108, devId: 0x0005, inCList: [], outCList: [] }    // 'PHHC': 0x0108, Personal Home & Hospital Care
    // { epId: 5, profId: 0x0019, devId: 0x0005, inCList: [], outCList: [] }    // 'SE': 0x0019, Smart Energy

    this._znp.on('ready', function () {
        self.emit('ZNP:INIT');
    });

    this._requestCosumer = null;

    this._znp.on('AREQ', this._areqEventBridge);

    // zcl sequence number
    this.nextZclSeqNum = function () {
        if (++seqNum > 255)
            seqNum = 1;

        return seqNum;
    };

    // zigbee transection id
    this.nextTransId = function () {
        if (++transId > 255)
            transId = 1;

        return transId;
    };

    this.findDelegator = this._shepherd.findDelegator;
}

util.inherits(Controller, EventEmitter);

/*************************************************************************************************/
/*** Public ZigBee Utility APIs                                                                ***/
/*************************************************************************************************/
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
/*** Protected Methods                                                                         ***/
/*************************************************************************************************/
Controller.prototype._registerAreqCallback = function (evtKey, cb) {
    // for those requests requiring AREQ coming back, should regitser its callback to controller
    this.once(evtKey, cb);
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
    // if (bridge.hasAreq(subsys, cmdId))          // except zdo, zdo do this in its own module
    //     this._registerAreqCallback(callback);

    if (subsys.toUpperCase() === 'ZDO' || subsys === 5)
        return this._zdo.request(cmdId, valObj, callback);          // use wrapped zdo as the exported api
    else
        return this._znp.request(subsys, cmdId, valObj, callback);
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
Controller.prototype.setNwkInfo = function (argInst, callback) {};
Controller.prototype.getNwkInfo = function (callback) {};
// Controller.prototype.setPermitJoinTime = function (argInst, callback) {};
// Controller.prototype.getPermitJoinTime = function (callback) {};
// Controller.prototype.joinTimeCountdown = function (callback) {};

/*************************************************************************************************/
/*** Network Management Public APIs                                                            ***/
/*************************************************************************************************/
Controller.prototype.reset = function (mode, callback) {
};

Controller.prototype.init = function (callback) {
    // execInitCmd
};

Controller.prototype.sleep = function (callback) {
     // <No_rsp_cmd>, <specific_conf>
};

Controller.prototype.wakeup = function (callback) {
     // <No_rsp_cmd>, <specific_conf>
};

Controller.prototype.queryCoordInfo = function (callback) {

};

Controller.prototype.queryDevInfo = function (callback) {

};

Controller.prototype.queryNwkInfo = function (param, callback) {    // if not param, all
    // retrieveNwkInfo, retrieveSingleNwkInfo
};

Controller.prototype.queryNwkInfo = function (param, callback) {    // if not param, all

};

Controller.prototype.permitJoin = function (args, callback) {

};

Controller.prototype.queryRoutingTable = function (args, callback) {

};

Controller.prototype.queryNeighborTable = function (args, callback) {

};

Controller.prototype.getKey = function (args, callback) {

};

Controller.prototype.queryDevList = function (args, callback) {

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


/*************************************************************************************************/
/*** Private Functions                                                                         ***/
/*************************************************************************************************/
Controller.prototype._areqEventBridge = function (msg) {
    // msg: { subsys: 'ZDO', ind: 'endDeviceAnnceInd', data: { srcaddr: 63536, nwkaddr: 63536, ieeeaddr: '0x00124b0001ce3631', ... }
    var self = this,
        mandatoryEvent1 = 'ind',
        mandatoryEvent2 = msg.subsys + ':' + msg.ind;   // SYS:resetInd, SYS:osalTimerExpired

    this.emit(mandatoryEvent1, msg);                    // bridge 'AREQ' to 'ind' event
    this.emit(mandatoryEvent2, msg.data);               // bridge to subsystem events, like 'SYS:resetInd', 'SYS:osalTimerExpired'

    // dispatch to event bridge
    if (msg.subsys === 'AF')
        this._afIndicationEventBridge(msg);             // AF_INCOMING_MSG and AF_INCOMING_MSG_EXT require special handling that bridge cannot simply handle with
    else if (msg.subsys === 'ZDO')
        this._zdoIndicationEventBridge(msg);
    else if (msg.subsys === 'SAPI')
        this._sapiIndicationEventBridge(msg);
    // else: Do nothing. No need to bridge: SYS, MAC, NWK, UTIL, DBG, APP
};

Controller.prototype._afIndicationEventBridge = function (msg) {
//  - dataConfirm,      { status, endpoint, transid }
//  - reflectError,     { status, endpoint, transid, dstaddrmode, dstaddr }
//  - incomingMsg,      { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, securityuse, timestamp, transseqnumber, len, data }
//  - incomingMsgExt,   { groupid, clusterid, srcaddrmode, srcaddr, srcendpoint, srcpanid, dstendpoint, wasbroadcast, linkquality, securityuse, timestamp, transseqnumber, len, data }
    var shepherd = this._shepherd,
        coord = shepherd ? shepherd.coord : undefined,
        payload = msg.data,
        afEventHead = 'AF:' + msg.ind;

    switch (msg.ind) {
        case 'dataConfirm':
            var afEventCnf = afEventHead + ':' + payload.endpoint + ':' + payload.transid;
            this.emit(afEventCnf, payload);
            // remoteEp.onAfDataConfirm = function (cnfMsg) {};
            break;
        case 'reflectError':
            // reflectError: [ 'endpoint', 'transid' ]
            // remoteEp.onAfReflectError = function (msg) {};
            break;
        case 'incomingMsg':
            var remoteDev = shepherd.findDev({ nwAddr: payload.srcaddr }),
                remoteEpId = payload.srcendpoint,
                localEpId = payload.dstendpoint,
                remoteEp = remoteDev.findEpdpoint(remoteEpId),
                coordEp = this.coord.findEpdpoint(localEpId),
                afEventGeneric = afEventHead + ':' + payload.srcaddr + ':' + payload.clusterid + ':' + localEpId,   // why this?
                afEventToRemoteEp,
                afEventTLocalEp;

            this.emit(afEventGeneric, payload);

            if (!remoteDev) {
                // [TODO] message from unknown device
                remoteEp._onAfIncomingMsg(payload);
                remoteEp.onAfIncomingMsg(payload);
            } else {
                // afEventToRemoteEp = afEventHead + ':' + remoteDev.getIeeeAddr() + ':' + remoteEpId;
                // this.emit(afEventToRemoteEp, payload);
                remoteEp.onAfIncomingMsg(payload);
            }

            if (coord) {
                // afEventTLocalEp = afEventHead + ':' + coord.getIeeeAddr() + ':' + localEpId;
                // this.emit(afEventTLocalEp, payload);
            }

            if (coordEp) {
                coordEp._onAfIncomingMsg(payload);
                coordEp.onAfIncomingMsg(payload);
            }

            // zcl parsing
            this._zclIndicationEventBridge(msg);
            break;
        case 'incomingMsgExt':
            // remoteEp.onAfIncomingMsgExt = function (msg) {};

            break;
        default:
            break;
    }
};

Controller.prototype._zdoIndicationEventBridge = function (msg) {
    var payload = msg.data,
        zdoEventHead = 'ZDO:' + msg.ind,
        zdoBridgedEvent;

    if (msg.ind === 'stateChangeInd') { // this is a special event
        if (payload.state === 0x83 || payload.state === 'NOT_ACTIVE')                 // [TODO] is a string or a number?
            zdoBridgedEvent = zdoEventHead + ':' + payload.nwkaddr + ':NOT_ACTIVE';
        else if (payload.state === 0x82 || payload.state === 'INVALID_EP')            // [TODO] is a string or a number?
            zdoBridgedEvent = zdoEventHead + ':' + payload.nwkaddr + ':INVALID_EP';
        else if (!payload.hasOwnProperty('nwkaddr'))    // Coord itself
            console.log('Coord is now in state: ' + payload.state);
    } else {
        zdoBridgedEvent = zdoHelper.generateEventOfIndication(msg.ind, payload);
    }

    if (zdoBridgedEvent)
        this.emit(zdoBridgedEvent, payload);
};

Controller.prototype._sapiIndicationEventBridge = function (msg) {
    var payload = msg.data,
        afEventHead = 'SAPI:' + msg.ind,
        afBridgedEvent;

    switch (msg.ind) {
        case 'bindConfirm':
            afBridgedEvent = afEventHead + ':' + payload.commandid;
            break;
        case 'sendDataConfirm':
            afBridgedEvent = afEventHead + ':' + payload.handle;
            break;
        case 'receiveDataIndication':
            afBridgedEvent = afEventHead + ':' + payload.source + ':' + payload.command;
            break;
        case 'findDeviceConfirm':
            if (payload.hasOwnProperty('result'))
                afBridgedEvent = afEventHead + ':' + payload.result; // [TODO] payload.result is IEEE ADDR check if should transform
            break;
        default:    // startConfirm and allowBindConfirm need no bridging
            break;
    }

    if (afBridgedEvent)
        this.emit(afBridgedEvent, payload);
};

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

Controller.prototype._zclIndicationEventBridge = function (msg) {
    var self = this,
        remoteDev = shepherd.findDev({ nwAddr: payload.srcaddr }),  // remoteDev may be a local one
        remoteEpId = payload.srcendpoint,
        localEpId = payload.dstendpoint,
        afEventGeneric = afEventHead + ':' + payload.srcaddr + ':' + payload.clusterid + ':' + localEpId,   // why this?
        afEventToRemoteEp,
        afEventTLocalEp,
        remoteEp,
        isRemoteEp = false,
        isDstEpDelegator = false,
        clusterId = msg.clusterid,
        zclPayload = msg.data;

    if (!remoteDev)
        return;     // unknown device

    remoteEp = remoteDev.findEpdpoint(remoteEpId);

    if (!remoteEp)
        return;     // unknown endpoint

    isRemoteEp = !!remoteEp.isLocal();
    isDstEpDelegator = remoteEp.isDelegator();

    if (isRemoteEp && !isDstEpDelegator)
        return; // msg is from a remote ep, but this msg is to a local ep, just return and do nothing.
                // Local ep will handle this message, since the same message is also going to local ep.

    if (!remoteEp.isZclSupported())
        return; // unsupport zcl, no further parsing required

    // here, deal with public profile or private profile that supports zcl style
    zcl.parse(zclPayload, clusterId, function (err, zclMsg) {
        if (err)
            return;

        var frameType = zclMsg.frameCntl.frameType,
            direction = zclMsg.frameCntl.direction;

        if (frameType === 0) {          // FOUNDATION, across entire profile
            if (!isRemoteEp) {
                self.emit('ZCL:FOUNDATION', zclMsg);    // [TODO] zclMsg need new format?
            } else {
                if (direction === 0)                                    // zcl msg received from client side of node clusters
                    self.emit('ZCL:FOUNDATION:' + zclMsg.cmd, zclMsg);
                else if (direction === 1)                               // zcl msg received from server side of node clusters
                    self.emit('ZCL:FOUNDATION:' + zclMsg.cmd + ':' + zclMsg.seqNum, zclMsg);
            }
        } else if (frameType === 1) {   // FUNCTIONAL, cluster-specific
            if (!isRemoteEp) {
                self.emit('ZCL:FUNCTIONAL', zclMsg);    // [TODO] zclMsg need new format?
            } else {
                if (direction === 0)                                    // zcl msg received from server side of node clusters
                    console.log(zclMsg.cmd + ':TODO: Server side of Coord clusters has not been implemented yet!');     
                else if (direction === 1)                               // zcl msg received from client side of node clusters
                    self.emit('ZCL:FUNCTIONAL:' + zclMsg.cmd + ':' + zclMsg.seqNum, zclMsg);
            }
        } else {
            console.log('Unrecognized zcl frame type.');
        }
    });
};

module.exports = Controller;
