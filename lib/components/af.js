'use strict';
var Q = require('q'),
    _ = require('busyman'),
    ZSC = require('zstack-constants');

var zcl = reuqire('./zcl');

var _apsAckListeners = {},
    _zclRspListeners = {},
    AREQ_TIMEOUT = 30,  // seconds
    seqNumber = 0;

var af = {
    controller: null,
    nextSeqNum: nextSeqNum
};

af.send = function (srcEp, dstEp, cId, rawPayload, opt, callback) {
    // srcEp maybe a local app ep, or a remote ep
    var deferred = Q.defer(),
        controller = af.controller,
        profId = srcEp.getProfId(),
        afParams,
        afEventCnf,
        apsAck = false,
        senderEp;

    if (typeof opt === 'function') {
        callback = opt;
        opt = undefined;
    }

    opt = opt || {};

    senderEp = srcEp.isLocal() ? srcEp : controller.getCoord().getDelegator(profId);

    if (!senderEp) {
        // only occurs if srcEp is a remote one
        deferred.reject(new Error('Profile: ' + profId + ' is not supported at this moment.'));
    } else {
        afParams = makeAfParams(senderEp, dstEp, cId, rawPayload, opt);
        afEventCnf = 'AF:dataConfirm:' + senderEp.getEpId() + ':' + afParams.transid;
        apsAck = afParams.options & ZSC.AF.options.ACK_REQUEST;

        while (isApsAckEventPending(afEventCnf)) {
            afParams.transid = controller.nextTransId();
            afEventCnf = 'AF:dataConfirm:' + senderEp.getEpId() + ':' + afParams.transid;
        }

        if (apsAck) // if has aps acknowledgement
            createApsAckListener(afEventCnf, deferred);

        controller.request('AF', 'dataRequest', afParams).then(function (rsp) {
            if (rsp.status !== 0 && rsp.status !== 'SUCCESS' ) { // unsuccessful
                clearApsAckListener(afEventCnf);
                deferred.reject(new Error('AF data request failed, status code: ' + rsp.status + '.'));    
            } else if (!apsAck) {
                clearApsAckListener(afEventCnf);
                deferred.resolve(rsp);
            }
        }).fail(function (err) {
            clearApsAckListener(afEventCnf);
            deferred.reject(err);
        }).done();
    }

    return deferred.promise.nodeify(callback);
};

af.sendExt = function (srcEp, addrMode, dstAddrOrGrpId, cId, rawPayload, opt, callback) {
    // srcEp must be a local ep
    var deferred = Q.defer(),
        controller = af.controller,
        profId = srcEp.getProfId(),
        afParamsExt,
        afEventCnf,
        apsAck = false,
        senderEp = srcEp;


    if (typeof opt === 'function') {
        callback = opt;
        opt = undefined;
    }

    opt = opt || {};

    if (!senderEp.isLocal()) {
        deferred.reject(new Error('Only a local endpoint can groupcast, broadcast, and send extend message.'));
        return deferred.promise.nodeify(callback);
    }

    afParamsExt = makeAfParamsExt(senderEp, addrMode, dstAddrOrGrpId, cId, rawPayload, opt);

    if (!afParamsExt) {
        deferred.reject(new Error('Unknown address mode. Cannot send.'));
        return deferred.promise.nodeify(callback);
    }

    if (addrMode === ZSC.addressMode.ADDR_GROUP || addrMode === ZSC.addressMode.ADDR_BROADCAST) {
        // no ack
        controller.request('AF', 'dataRequestExt', afParamsExt).then(function (rsp) {
            if (rsp.status !== 0 && rsp.status !== 'SUCCESS')   // unsuccessful
                deferred.reject(new Error('AF data extend request failed, status code: ' + rsp.status + '.'));
            else
                deferred.resolve(rsp);  // Broadcast (or Groupcast) has no AREQ confirm back, just resolve this transaction.
        }).fail(function (err) {
            deferred.reject(err);
        }).done();

    } else {
        apsAck = afParamsExt.options & ZSC.AF.options.ACK_REQUEST;

        if (apsAck) {
            afEventCnf = 'AF:dataConfirm:' + senderEp.getEpId() + ':' + afParamsExt.transid;    // only AF_DATA_CONFIRM, no EXT AF_DATA_CONFIRM
            createApsAckListener(afEventCnf, deferred);
        }

        controller.request('AF', 'dataRequestExt', afParamsExt).then(function (rsp) {
            if (rsp.status !== 0 && rsp.status !== 'SUCCESS') {   // unsuccessful
                clearApsAckListener(afEventCnf);
                deferred.reject(new Error('AF data extend request failed, status code: ' + rsp.status + '.'));
            } else if (!apsAck) {
                clearApsAckListener(afEventCnf);
                deferred.resolve(rsp);
            }
        }).fail(function (err) {
            clearApsAckListener(afEventCnf);
            deferred.reject(err);
        }).done();
    }

    return deferred.promise.nodeify(callback);
};

af.zclAttrsReq = function (dstEp, callback) {
// callback:{
//     genBasic: {
//         dir: 1,    // 0: 'unknown', 1: 'in', 2: 'out'
//         attrs: {
//             hwVersion: { value: 0 }
//         }
//     }
// }
};

af.zclFoundation = function (srcEp, dstEp, cId, cmd, zclData, cfg, callback) {
    // callback(err[, rsp])
    var deferred = Q.defer(),
        dir = (srcEp === dstEp) ? 1 : 0,    // 1: client-to-server, 0: server-to-client
        manufCode = 0,
        frameCntl,
        seqNum,
        zclBuffer,
        mandatoryEvent;

    if (_.isFunction(cfg)) {
        callback = cfg;
        cfg = {};
    }

    frameCntl = {
        frameType: 0,       // command acts across the entire profile (foundation)
        manufSpec: cfg.hasOwnProperty('manufSpec') ? cfg.manufSpec : 0,
        direction: cfg.hasOwnProperty('direction') ? cfg.direction ? dir,
        disDefaultRsp: cfg.hasOwnProperty('disDefaultRsp') ? cfg.disDefaultRsp : 0  // enable deafult response command
    };

    if (frameCntl.manufSpec === 1)
        manufCode = dstEp.getManufCode();

    // .frame(frameCntl, manufCode, seqNum, cmd, zclPayload[, clusterId])
    seqNum = af.nextSeqNum();
    zclBuffer = zcl.frame(frameCntl, manufCode, seqNum, cmd, zclData);

    if (srcEp === dstEp)    // from remote to remote itself
        mandatoryEvent = 'ZCL:incomingMsg:' + dstEp.getNwkAddr() + ':' + dstEp.getEpId() + ':' + seqNum;
    else                    // from local ep to remote ep
        mandatoryEvent = 'ZCL:incomingMsg:' + dstEp.getNwkAddr() + ':' + dstEp.getEpId() + ':' + srcEp.getEpId() + ':' + seqNum;

    if (frameCntl.direction === 1)  // client-to-server, thus require getting the feedback response
        createZclRspListener(mandatoryEvent, deferred);

    // af.send(srcEp, dstEp, cId, rawPayload, opt, callback)
    af.send(srcEp, dstEp, cId, zclBuffer, function (err, cnf) {
        if (err) {
            clearZclRspListener(mandatoryEvent);
            deferred.reject(err);
        }
    });

    return deferred.promise.nodeify(callback);
};

af.zclFunctional= function (srcEp, dstEp, cId, cmd, valObj, cfg, callback) {
    // callback(err[, rsp])
    var dir = (srcEp === dstEp) ? 1 : 0,    // 1: client-to-server, 0: server-to-client
        manufCode = 0,
        seqNum,
        frameCntl,
        zclBuffer,
        mandatoryEvent;

    if (_.isFunction(cfg)) {
        callback = cfg;
        cfg = {};
    }

    frameCntl = {
        frameType: 1,       // functional command frame
        manufSpec: cfg.hasOwnProperty('manufSpec') ? cfg.manufSpec : 0,
        direction: cfg.hasOwnProperty('direction') ? cfg.direction ? dir,
        disDefaultRsp: cfg.hasOwnProperty('disDefaultRsp') ? cfg.disDefaultRsp : 0  // enable deafult response command
    };

    if (frameCntl.manufSpec === 1)
        manufCode = dstEp.getManufCode();
    // .frame(frameCntl, manufCode, seqNum, cmd, zclPayload[, clusterId])
    seqNum = af.nextSeqNum();
    zclBuffer = zcl.frame(frameCntl, manufCode, seqNum, cmd, zclData, cId);

    if (srcEp === dstEp)    // from remote to remote itself
        mandatoryEvent = 'ZCL:incomingMsg:' + dstEp.getNwkAddr() + ':' + dstEp.getEpId() + ':' + seqNum;
    else                    // from local ep to remote ep
        mandatoryEvent = 'ZCL:incomingMsg:' + dstEp.getNwkAddr() + ':' + dstEp.getEpId() + ':' + srcEp.getEpId() + ':' + seqNum;

    if (frameCntl.direction === 1)  // client-to-server, thus require getting the feedback response
        createZclRspListener(mandatoryEvent, deferred);

    // af.send(srcEp, dstEp, cId, rawPayload, opt, callback)
    af.send(srcEp, dstEp, cId, zclBuffer, function (err, cnf) {
        if (err) {
            clearZclRspListener(mandatoryEvent);
            deferred.reject(err);
        }
    });
};

/*************************************************************************************************/
/*** Private Functions: Message Dispatcher                                                     ***/
/*************************************************************************************************/
dispatchIncomingMsg = function (type, msg) {
    var targetEp,
        dispatchTo,
        zclHeader,
        frameType,
        mandatoryEvent;

    if (msg.hasOwnProperty('endpoint')) {
        targetEp = af.controller.getCoord().getEndpoint(msg.endpoint);
    } else if (msg.hasOwnProperty('srcaddr') && msg.hasOwnProperty('srcendpoint')) {
        targetEp = af.controller.findEndpoint(msg.srcaddr, msg.srcendpoint);
    }

    if (!targetEp)
        return;

    switch (type) {
        case 'dataConfirm':
            mandatoryEvent = 'AF:dataConfirm:' + msg.endpoint + ':' + msg.transid;
            dispatchTo = targetEp.onAfDataConfirm;
            break;
        case 'reflectError':
            mandatoryEvent = 'AF:reflectError:' + msg.endpoint + ':' + msg.transid;
            dispatchTo = targetEp.onAfReflectError;
            break;
        case 'incomingMsg':
            zclHeader = zcl.header(msg.data);
            dispatchTo = targetEp.onAfIncomingMsg;
            break;
        case 'incomingMsgExt':
            zclHeader = zcl.header(msg.data);
            dispatchTo = targetEp.onAfIncomingMsgExt;
            break;
        case 'zclIncomingMsg':
            if (targetEp.isLocal()) {
                if (!targetEp.isDelegator())
                    mandatoryEvent = 'ZCL:incomingMsg:' + msg.srcaddr + ':' + msg.srcendpoint + ':' + msg.dstendpoint + ':' + msg.data.seqNum;
            } else {
                mandatoryEvent = 'ZCL:incomingMsg:' + msg.srcaddr + ':' + msg.srcendpoint + ':' + msg.data.seqNum;
            }

            frameType = msg.data.frameCntl.frameType;
            if (frameType === 0)            // foundation
                dispatchTo = targetEp.onZclFoundation;
            else if (frameType === 1)       // functional
                dispatchTo = targetEp.onZclFunctional;
            break;
    }

    if (mandatoryEvent)
        af.controller.emit(mandatoryEvent, msg);

    if (_.isFunction(dispatchTo)) {
        process.nextTick(function () {
            dispatchTo(msg);
        });
    }

    // further parse for ZCL packet
    if (zclHeader && targetEp.isZclSupported()) {
        if (zclHeader.frameCntl.frameType === 0) {          // foundation
            zcl.parse(msg.data, cId, function (err, result) {
                if (!err)
                    zclIncomingParsedMsgEmitter(msg, result);
            });
        } else if (zclHeader.frameCntl.frameType === 1) {   // functional
            zcl.parse(msg.data, msg.clusterid, function (err, result) {
                if (!err)
                    zclIncomingParsedMsgEmitter(msg, result);
            });
        }
    }
};

/*************************************************************************************************/
/*** Private Functions: Af and Zcl Incoming Message Handlers                                   ***/
/*************************************************************************************************/
function dataConfirmHandler(msg) {
    // msg: { status, endpoint, transid }
    dispatchIncomingMsg('dataConfirm', msg);
};

function reflectErrorHandler(msg) {
    // msg: { status, endpoint, transid, dstaddrmode, dstaddr }
    dispatchIncomingMsg('reflectError', msg);
};

function incomingMsgHandler(msg) {
    // msg: { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, 
    //        securityuse, timestamp, transseqnumber, len, data }
    dispatchIncomingMsg('incomingMsg', msg);
};

function incomingMsgExtHandler(msg) {
    // msg: { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, 
    //        securityuse, timestamp, transseqnumber, len, data }
    dispatchIncomingMsg('incomingMsgExt', msg);
};

function zclIncomingMsgHandler(msg) {
    // { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, 
    //   securityuse, timestamp, transseqnumber, zclMsg }
    dispatchIncomingMsg('zclIncomingMsg', msg);
};

/*************************************************************************************************/
/*** Private Functions                                                                         ***/
/*************************************************************************************************/
function zclIncomingParsedMsgEmitter(msg, zclData) {
    var parsedMsg = _.cloneDeep(msg);
    parsedMsg.data = zclData;

    process.nextTick(function () {
        af.controller.emit('ZCL:incomingMsg', parsedMsg);
    });
}

function makeAfParams(loEp, dstEp, cId, rawPayload, opt) {
    // ACK_REQUEST (0x10), DISCV_ROUTE (0x20)
    var afOptions = ZSC.AF.options.ACK_REQUEST | ZSC.AF.options.DISCV_ROUTE;
    opt = opt || {};

    return {
        dstaddr: dstEp.getNwkAddr(),
        destendpoint: dstEp.getEpId(),
        srcendpoint: loEp.getEpId(),
        clusterid: cId,
        transid: af.controller ? af.controller.nextTransId() : null,
        options: opt.hasOwnProperty('options') ? opt.options : afOptions,
        radius: opt.radius || ZSC.AF_DEFAULT_RADIUS,
        len: rawPayload.length,
        data: rawPayload
    };
};

// opt = { options, radius, dstEpId, dstPanId }
function makeAfParamsExt(loEp, addrMode, dstAddrOrGrpId, cId, rawPayload, opt) {
    opt = opt || {};

    var afOptions = ZSC.AF.options.DISCV_ROUTE,
        afParamsExt = {
            dstaddrmode: addrMode,
            dstaddr: toLongAddrString(dstAddrOrGrpId),
            destendpoint: 0xFF,
            dstpanid: opt.dstPanId || 0,
            srcendpoint: loEp.getEpId(),
            clusterid: cId,
            transid: af.controller ? af.controller.nextTransId() : null,
            options: opt.options || afOptions,
            radius: opt.radius || ZSC.AF_DEFAULT_RADIUS,
            len: rawPayload.length,
            data: rawPayload
        };

    switch (addrMode) {
        case ZSC.addressMode.ADDR_NOT_PRESENT:
            break;
        case ZSC.addressMode.ADDR_GROUP:
            afParamsExt.destendpoint = 0xFF;
            break;
        case ZSC.addressMode.ADDR_16BIT:
        case ZSC.addressMode.ADDR_64BIT:
            afParamsExt.destendpoint = opt.hasOwnProperty('dstEpId') ? opt.dstEpId : 0xFF;
            break;
        case ZSC.addressMode.ADDR_BROADCAST:
            afParamsExt.destendpoint = 0xFF;
            afParamsExt.dstaddr = toLongAddrString(0xFFFF);
            break;
        default:
            afParamsExt = null;
            break;
    }

    return afParamsExt;
};

function isApsAckEventPending(evt) {
    return !!_apsAckListeners[evt];
};

function createApsAckListener(evt, apsDeferred) {
    var tout,
        apsAckLsn;

    tout = setTimeout(function () {
        var lsnRec = _apsAckListeners[evt],
            deferred = lsnRec ? lsnRec.deferred : null;

        clearApsAckListener(evt);

        if (deferred)
            deferred.reject(new Error('Request timeout.'));
    }, AREQ_TIMEOUT);

    apsAckLsn = function (cnf) {
        var errText = 'AF data request fails, status code: ',
            lsnRec = _apsAckListeners[evt],
            deferred = lsnRec ? lsnRec.deferred : null;

        clearApsAckListener(evt);

        if (deferred) {
            if (cnf.status === 0 || cnf.status === 'SUCCESS')   // success
                deferred.resolve(cnf);
            else if (cnf.status === 0xcd || cnf.status === 'NWK_NO_ROUTE')
                deferred.reject(new Error(errText + '205. No network route. Please confirm that the device has (re)joined the network.'));
            else if (cnf.status === 0xe9 || cnf.status === 'MAC_NO_ACK')
                deferred.reject(new Error(errText + '233. MAC no ack.'));
            else if (cnf.status === 0xb7 || cnf.status === 'APS_NO_ACK')                // ZApsNoAck period is 20 secs
                deferred.reject(new Error(errText + '183. APS no ack.'));
            else if (cnf.status === 0xf0 || cnf.status === 'MAC_TRANSACTION_EXPIRED')   // ZMacTransactionExpired is 8 secs
                deferred.reject(new Error(errText + '240. MAC transaction expired.'));
            else
                deferred.reject(new Error(errText + cnf.status));
        }
    }

    af.controller.once(evt, apsAckLsn);

    _apsAckListeners[evt] = {
        listener: apsAckLsn,
        deferred: apsDeferred,
        tout: tout
    };
};

function clearApsAckListener(evt) {
    if (!evt)
        return;

    var lsnRec = _apsAckListeners[evt],
        controller = af.controller;

    if (lsnRec) {
        controller.removeListener(evt, lsnRec.listener);
        if (lsnRec.tout)
            clearTimeout(lsnRec.tout);

        lsnRec.listener = null;
        lsnRec.deferred = null;
        lsnRec.tout = null;
        _apsAckListeners[evt] = null;
        delete _apsAckListeners[evt];
    }
};

function isZclRspEventPending(evt) {
    return !!_zclRspListeners[evt];
};

function createZclRspListener(evt, zclDeferred) {
    var tout,
        zclRspLsn;

    tout = setTimeout(function () {
        var lsnRec = _zclRspListeners[evt],
            deferred = lsnRec ? lsnRec.deferred : null;

        clearZclRspListener(evt);

        if (deferred)
            deferred.reject(new Error('Request timeout.'));
    }, AREQ_TIMEOUT);

    zclRspLsn = function (msg) {
        var lsnRec = _zclRspListeners[evt],
            deferred = lsnRec ? lsnRec.deferred : null;

        clearZclRspListener(evt);

        if (deferred)
            deferred.resolve(msg.zclMsg.payload);   // resolve parsed zcl payload to foundation and functional commands
    }

    af.controller.once(evt, zclRspLsn);

    _zclRspListeners[evt] = {
        listener: zclRspLsn,
        deferred: zclDeferred,
        tout: tout
    };
};

function clearZclRspListener(evt) {
    if (!evt)
        return;

    var lsnRec = _zclRspListeners[evt],
        controller = af.controller;

    if (lsnRec) {
        controller.removeListener(evt, lsnRec.listener);
        if (lsnRec.tout)
            clearTimeout(lsnRec.tout);

        lsnRec.listener = null;
        lsnRec.deferred = null;
        lsnRec.tout = null;
        _zclRspListeners[evt] = null;
        delete _zclRspListeners[evt];
    }
};

function toLongAddrString(addr) {
    var toLongAddrString;

    if (_.isString(addr))
        toLongAddrString = (_.startsWith(addr, '0x') || _.startsWith(addr, '0X')) ? addr.slice(2, addr.length).toLowerCase() : addr.toLowerCase();
    else if (_.isNumber(addr))
        toLongAddrString = addr.toString(16);
    else
        throw new TypeError('Address can only be a number or a string.');

    for (var i = toLongAddrString.length; i < 16; i++) {
        toLongAddrString = '0' + toLongAddrString;
    }

    return '0x' + toLongAddrString;
}

function hasListenerOnController(controller, evt, lsn) {
    var has = false,
        lsns = controller.listeners(evt);

    if (_.isArray(lsns) && lsns.length) {
        has = _.find(lsns, function (n) {
            return n === lsn;
        });
    } else if (_.isFunction(lsns)) {
        has = (lsns === lsn);
    }

    return !!has;
}

function nextSeqNum() {
    // seqNumber is a private var on the top of this module
    seqNumber += 1;
    if (seqNumber > 255 || seqNumber < 0 )
        seqNumber = 0;

    return seqNumber;
}
/*************************************************************************************************/
/*** module.exports                                                                            ***/
/*************************************************************************************************/
module.exports = function (controller) {
    af.controller = controller;

    // attach event listeners
    if (!hasListenerOnController(controller, 'AF:dataConfirm', dataConfirmHandler))
        controller.on('AF:dataConfirm', af.dataConfirmHandler);

    if (!hasListenerOnController(controller, 'AF:reflectError', reflectErrorHandler))
        controller.on('AF:reflectError', af.reflectErrorHandler);

    if (!hasListenerOnController(controller, 'AF:incomingMsg', incomingMsgHandler))
        controller.on('AF:incomingMsg', af.incomingMsgHandler);

    if (!hasListenerOnController(controller, 'AF:incomingMsgExt', incomingMsgExtHandler))
        controller.on('AF:incomingMsgExt', af.incomingMsgExtHandler);

    if (!hasListenerOnController(controller, 'ZCL:incomingMsg', zclIncomingMsgHandler))
        controller.on('ZCL:incomingMsg', af.zclIncomingMsgHandler);

    return af;
};
