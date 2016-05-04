'use strict';
var NWK_MAX_DEVICES = ZDEFS.CONFIG_CONST.NWK_MAX_DEVICES,
    ZDO_MGMT_MAX_NWKDISC_ITEMS = ZDEFS.CONFIG_CONST.ZDO_MGMT_MAX_NWKDISC_ITEMS;

function Zdo(znp) {
    this._zdoCallbacks = {};
    this._znp = znp;
}

Zdo.prototype.registerCallback = function (evtKey, cb) {
    var cbs = this._zdoCallbacks[evtKey];

    if (!cbs)
        this._zdoCallbacks[evtKey] = [];

    if (Array.isArray(cb))
        cbs.push(cb);
};

Zdo.prototype.invokeCallback = function (evtKey, err, rsp) {
    var cbs = this._zdoCallbacks[evtKey],
        cb;

    if (cbs)
        cb = cbs.shift();

    if (cbs.length === 0) {
        this._zdoCallbacks[evtKey] = null;
        delete this._zdoCallbacks[evtKey];
    }

    if (typeof cb === 'function')
        cb(err, rsp);
};


module.exports = Zdo;


function convertReqToRsp() {

}


Zdo.prototype.nwkAddrReq = function (args, callback) {
    // need concat
    var cmd = 'nwkAddrReq',
        arsp = 'nwkAddrRsp',
        evtId = args.ieeeaddr,
        evtId2 = args.startindex;
};

Zdo.prototype.ieeeAddrReq = function (args, callback) {
    // need concat
    var cmd = 'ieeeAddrReq',
        arsp = 'ieeeAddrRsp',
        evtId = args.shortaddr,
        evtId2 = args.startindex;
};

Zdo.prototype.nodeDescReq = function (args, callback) {  // 'dstaddr', 'nwkaddrofinterest'
    var cmd = 'nodeDescReq',
        arsp = 'nodeDescRsp',
        evtId = args.nwkaddrofinterest;
};

Zdo.prototype.powerDescReq = function (args, callback) {
    var cmd = 'powerDescReq',
        arsp = 'powerDescRsp',
        evtId = args.nwkaddrofinterest;
};

Zdo.prototype.simpleDescReq = function (args, callback) {
    var cmd = 'simpleDescReq',
        arsp = 'simpleDescRsp',
        evtId = args.nwkaddrofinterest,
        evtId2 = args.endpoint;
};

Zdo.prototype.activeEpReq = function (args, callback) {
    var cmd = 'activeEpReq',
        arsp = 'activeEpRsp',
        evtId = args.nwkaddrofinterest;
};

Zdo.prototype.matchDescReq = function (args, callback) {
    var cmd = 'matchDescReq',
        arsp = 'matchDescRsp',
        evtId = args.nwkaddrofinterest;
};

Zdo.prototype.complexDescReq = function (args, callback) {
    var cmd = 'complexDescReq',
        arsp = 'complexDescRsp',
        evtId = args.nwkaddrofinterest;
};

Zdo.prototype.userDescReq = function (args, callback) {
    var cmd = 'userDescReq',
        arsp = 'userDescRsp',
        evtId = args.nwkaddrofinterest;
};

Zdo.prototype.endDeviceAnnce = function (args, callback) {   // 'nwkaddr', 'ieeeaddr', 'capability'
    // just call
    return msghub.callZpi('ZdoEndDeviceAnnce', args, callback);
};

Zdo.prototype.userDescSet = function (args, callback) {
    var cmd = 'userDescSet',
        arsp = 'userDescConf',
        evtId = args.nwkaddrofinterest;
};

Zdo.prototype.serverDiscReq = function (argInstance, callback) {    // broadcast, remote device may not response when no bits match in mask
    // 'servermask'
    // Listener in Constructor: eventName = 'ZDO:SERVER_DISC_RSP'
    return msghub.callZpi('ZdoServerDiscReq', argInstance, callback);
};

Zdo.prototype.endDeviceBindReq = function (args, callback) {
    var cmd = 'endDeviceBindReq',
        arsp = 'endDeviceBindRsp',
        evtId = args.dstaddr;
};

Zdo.prototype.bindReq = function (argInstance, callback) {
    var deferred = Q.defer(),
        dstAddr = argInstance.addr_short_long,
        dstAddrArray = [];

    if (argInstance.dstaddrmode === ZDEFS.AddressMode.Addr16Bit.value) {
        deferred.reject(new Error('TI not support address 16bit mode.'));
    } else if (argInstance.dstaddrmode === ZDEFS.AddressMode.Addr64Bit.value) {
        if (!Array.isArray(dstAddr)) {
            deferred.reject(new Error('The destination address must be an array.'));
        }
    } else { 
        if (typeof dstAddr === 'number') {
            dstAddrArray.push(0);
            dstAddrArray.push(dstAddr);
            argInstance.addr_short_long = dstAddrArray;
        }
    }
    return applyReq('bindReq', argInstance, deferred, 'dstaddr', null, callback);
};

Zdo.prototype.unbindReq = function (args, callback) {
    var cmd = 'unbindReq',
        arsp = 'unbindRsp',
        evtId = args.dstaddr;
};

Zdo.prototype.setLinkKey = function (argInstance, callback) {
    // just call
    // 'shortaddr', 'ieeeaddr', 'linkkey'
    return msghub.callZpi('ZdoSetLinkKey', argInstance, callback);
};

Zdo.prototype.removeLinkKey = function (argInstance, callback) {
    // just call
    // 'ieeeaddr'
    return msghub.callZpi('ZdoRemoveLinkKey', argInstance, callback);
};

Zdo.prototype.getLinkKey = function (argInstance, callback) {       // 'ieeeaddr'
    // just call
    return msghub.callZpi('ZdoGetLinkKey', argInstance, callback);
};

// CNF : Scan Completion
Zdo.prototype.nwkDiscoveryReq = function (argInstance, callback) {  // 'scanchannels', 'scanduration'
    var cmd = 'nwkDiscoveryReq',
        arsp = 'nwkDiscoveryCnf';
};

// CNF: join result
Zdo.prototype.joinReq = function (argInstance, callback) {    // request the device to join itself to a parent device on a network
    var cmd = 'joinReq',
        arsp = 'joinCnf';
};

Zdo.prototype.mgmtNwkDiscReq = function (args, callback) {  // 'dstaddr', 'scanchannels', 'scanduration', 'startindex'
    // need concat
    var cmd = 'mgmtNwkDiscReq',
        arsp = 'mgmtNwkDiscRsp',
        evtId = args.dstaddr,       // short
        evtId2 = args.startindex;
};

Zdo.prototype.mgmtLqiReq = function (args, callback) {   // 'dstaddr', 'startindex'
    // need concat
    var cmd = 'mgmtLqiReq',
        arsp = 'mgmtLqiRsp',
        evtId = args.dstaddr,       // short
        evtId2 = args.startindex;
};

Zdo.prototype.mgmtRtgReq = function (args, callback) {   // 'dstaddr', 'startindex'
    // need concat
    var cmd = 'mgmtRtgReq',
        arsp = 'mgmtRtgRsp',
        evtId = args.dstaddr,       // short
        evtId2 = args.startindex;
};

Zdo.prototype.mgmtBindReq = function (args, callback) {  // 'dstaddr', 'startindex'
    // need concat
    var cmd = 'mgmtBindReq',
        arsp = 'mgmtBindRsp',
        evtId = args.dstaddr,       // short
        evtId2 = args.startindex;
};

Zdo.prototype.mgmtLeaveReq = function (args, callback) {
    var cmd = 'mgmtLeaveReq',
        arsp = 'mgmtLeaveRsp',
        evtId = args.dstaddr;
};

Zdo.prototype.mgmtDirectJoinReq = function (args, callback) {
    var cmd = 'mgmtDirectJoinReq',
        arsp = 'mgmtDirectJoinRsp',
        evtId = args.dstaddr;
};

Zdo.prototype.mgmtPermitJoinRequest = function (argInstance, callback) {    // 'dstaddr', 'duration', 'tcsignificance'
    var cmd = 'mgmtPermitJoinReq',
        arsp = 'mgmtPermitJoinRsp',
        evtId = args.dstaddr;


    if (argInstance.dstaddr !== 0xFFFC) {
        return applyReq('mgmtPermitJoinRequest', argInstance, deferred, 'dstaddr', null, callback);
    } else {    // broadcast to all routers (and coord)
        msghub.callZpi('ZdoMgmtPermitJoinRequest', argInstance, function (err, result) {
            if (!err) {
                deferred.resolve(result);           // broadcast, no waiting for AREQ rsp
            }
        }).done();
    }
    return deferred.promise.nodeify(callback);
};

Zdo.prototype.mgmtNwkUpdateReq = function (arg, callback) {   // no ZDP_MgmtNwkUpdateNotify implemented in MT, take it as SRSP
    // just call
};

Zdo.prototype.msgCbRegister = function (arg, callback) {    // 'clusterid'
    // just call
};

Zdo.prototype.msgCbRemove = function (arg, callback) {      // 'clusterid'
    // just call
};

Zdo.prototype.startupFromApp = function (arg, callback) {   // 'startdelay'
    // just call
};

Zdo.prototype.autoFindDestination = function (argInstance, callback) {    // Nothing back (broadcast). Issue a Match Description Request for the requested endpoint outputs
    // 'endpoint'
    // just call
};