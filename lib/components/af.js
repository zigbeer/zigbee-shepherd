'use strict';
var EventEmitter = require('events'),
    Q = require('q'),
    Areq = require('areq'),
    _ = require('busyman'),
    zclId = require('zcl-id'),
    ZSC = require('zstack-constants');

var zcl = reuqire('./zcl'),
    seqNumber = 0;

var af = {
    controller: null,
    areq: null,
    nextSeqNum: nextSeqNum
};

af.send = function (srcEp, dstEp, cId, rawPayload, opt, callback) {
    // srcEp maybe a local app ep, or a remote ep
    var deferred = Q.defer(),
        controller = af.controller,
        areq = af.areq,
        areqTimeout,
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
    areqTimeout = opt.hasOwnProperty('timeout') ? opt.timeout : undefined;

    senderEp = srcEp.isLocal() ? srcEp : controller.getCoord().getDelegator(profId);

    if (!senderEp) {
        // only occurs if srcEp is a remote one
        deferred.reject(new Error('Profile: ' + profId + ' is not supported at this moment.'));
        return deferred.promise.nodeify(callback);
    }

    afParams = makeAfParams(senderEp, dstEp, cId, rawPayload, opt);
    afEventCnf = 'AF:dataConfirm:' + senderEp.getEpId() + ':' + afParams.transid;
    apsAck = afParams.options & ZSC.AF.options.ACK_REQUEST;

    while (areq.isEventPending(afEventCnf)) {
        afParams.transid = controller.nextTransId();
        afEventCnf = 'AF:dataConfirm:' + senderEp.getEpId() + ':' + afParams.transid;
    }

    areq.register(afEventCnf, deferred, function (cnf) {
        var errText = 'AF data request fails, status code: ';

        if (cnf.status === 0 || cnf.status === 'SUCCESS')   // success
            areq.resolve(afEventCnf, cnf);
        else if (cnf.status === 0xcd || cnf.status === 'NWK_NO_ROUTE')
            areq.reject(afEventCnf, new Error(errText + '205. No network route. Please confirm that the device has (re)joined the network.'));
        else if (cnf.status === 0xe9 || cnf.status === 'MAC_NO_ACK')
            areq.reject(afEventCnf, new Error(errText + '233. MAC no ack.'));
        else if (cnf.status === 0xb7 || cnf.status === 'APS_NO_ACK')                // ZApsNoAck period is 20 secs
            areq.reject(afEventCnf, new Error(errText + '183. APS no ack.'));
        else if (cnf.status === 0xf0 || cnf.status === 'MAC_TRANSACTION_EXPIRED')   // ZMacTransactionExpired is 8 secs
            areq.reject(afEventCnf, new Error(errText + '240. MAC transaction expired.'));
        else
            areq.reject(afEventCnf, new Error(errText + cnf.status));
    }, areqTimeout);

    controller.request('AF', 'dataRequest', afParams).then(function (rsp) {
        if (rsp.status !== 0 && rsp.status !== 'SUCCESS' )  // unsuccessful
            areq.reject(afEventCnf, new Error('AF data request failed, status code: ' + rsp.status + '.'));
        else if (!apsAck)
            areq.resolve(afEventCnf, rsp);
    }).fail(function (err) {
        areq.reject(afEventCnf, err);
    }).done();

    return deferred.promise.nodeify(callback);
};

af.sendExt = function (srcEp, addrMode, dstAddrOrGrpId, cId, rawPayload, opt, callback) {
    // srcEp must be a local ep
    var deferred = Q.defer(),
        controller = af.controller,
        areq = af.areq,
        areqTimeout,
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
    areqTimeout = opt.hasOwnProperty('timeout') ? opt.timeout : undefined;

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

        while (areq.isEventPending(afEventCnf)) {
            afParamsExt.transid = controller.nextTransId();
            afEventCnf = 'AF:dataConfirm:' + senderEp.getEpId() + ':' + afParamsExt.transid;
        }

        areq.register(afEventCnf, deferred, function (cnf) {
            var errText = 'AF data request fails, status code: ';

            if (cnf.status === 0 || cnf.status === 'SUCCESS')   // success
                areq.resolve(afEventCnf, cnf);
            else if (cnf.status === 0xcd || cnf.status === 'NWK_NO_ROUTE')
                areq.reject(afEventCnf, new Error(errText + '205. No network route. Please confirm that the device has (re)joined the network.'));
            else if (cnf.status === 0xe9 || cnf.status === 'MAC_NO_ACK')
                areq.reject(afEventCnf, new Error(errText + '233. MAC no ack.'));
            else if (cnf.status === 0xb7 || cnf.status === 'APS_NO_ACK')                // ZApsNoAck period is 20 secs
                areq.reject(afEventCnf, new Error(errText + '183. APS no ack.'));
            else if (cnf.status === 0xf0 || cnf.status === 'MAC_TRANSACTION_EXPIRED')   // ZMacTransactionExpired is 8 secs
                areq.reject(afEventCnf, new Error(errText + '240. MAC transaction expired.'));
            else
                areq.reject(afEventCnf, new Error(errText + cnf.status));
        }, areqTimeout);

        controller.request('AF', 'dataRequestExt', afParamsExt).then(function (rsp) {
            if (rsp.status !== 0 && rsp.status !== 'SUCCESS')   // unsuccessful
                areq.reject(afEventCnf, new Error('AF data request failed, status code: ' + rsp.status + '.'));
            else if (!apsAck)
                areq.resolve(afEventCnf, rsp);
        }).fail(function (err) {
            areq.reject(afEventCnf, err);
        }).done();
    }

    return deferred.promise.nodeify(callback);
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

af.zclFunctional = function (srcEp, dstEp, cId, cmd, valObj, cfg, callback) {
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

af.zclClustersReq = function (dstEp, callback) {
    var deferred = Q.defer(),
        clusters = {};

    var clusterList = dstEp.getClusterList(),   // [ 1, 2, 3, 4, 5 ]
        clusterAttrsReqs = [];

    _.forEach(clusterList, function (cId) {
        var cIdString = zclId.cluster(cId);
        cIdString = cIdString ? cIdString.key : cId;
        clusters[cIdString] = {
            dir: 0,
            attrs: null
        };

        clusterAttrsReqs.push(
            af.zclClusterAttrsReq(dstEp, cId).then(function (attrs) {
                clusters[cIdString].attrs = attrs;
                return attrs;
            });
        );
    });

    Q.all(clusterAttrsReqs).then(function () {
        // [TODO] in, out directions
        deferred.resolve(clusters);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

// callback: {
//     genBasic: {
//         dir: 1,    // 0: 'unknown', 1: 'in', 2: 'out'
//         attrs: {
//             hwVersion: { value: 0 }
//         }
//     },
//  ...,
//  ...,
// }

    return deferred.promise.nodeify(callback);
};

af.zclClusterAttrsReq = function (dstEp, cId, callback) {
    return af.zclClusterAttrIdsReq(dstEp, cId).then(function (attrIds) {
        var readRecs = _.map(attrIds, function (id) {
            return { attrId: id };
        });

        return af.zclFoundation(dstEp, dstEp, cId, 'read', readRecs);
    }).then(function (readStatusRecs) {
        var attrs = {};

        _.forEach(readStatusRecs, function (rec) {  // { attrId, status, dataType, attrData }
            var attrIdString = zclId.attr(cId, rec.attrId);
            attrIdString = attrIdString ? attrIdString.key : rec.attrId;

            attrs[attrIdString] = { value: null };

            if (rec.status === 0)
                attrs[attrIdString].value = rec.attrData;
        });

        return attrs;
    });
};

af.zclClusterAttrIdsReq = function (dstEp, cId, callback) {
    var deferred = Q.defer(),
        attrsToRead = [];

    var discAttrs = function (startAttrId, defer) {
        af.zclFoundation(dstEp, dstEp, cId, 'discover', {
            startAttrId: startAttrId,
            maxAttrIds: 240
        }).then(function (discoverRsp) {
            // discoverRsp: { discComplete, attrInfos: [ { attrId, dataType }, ... ] }
            var discComplete = discoverRsp.discComplete,
                attrInfos = discoverRsp.attrInfos,
                nextReqIndex;

            _.forEach(attrInfos, function (info) {
                if (_.indexOf(attrsToRead, info.attrId) === -1)
                    attrsToRead.push(info.attrId);
            });

            if (discComplete === 0) {
                nextReqIndex = attrInfos[attrInfos.length - 1].attrId + 1;
                discAttrs(nextReqIndex, defer)
            } else {
                defer.resolve(attrsToRead);
            }
        }).fail(function (err) {
            defer.reject(err);
        }).done();
    };

    discAttrs(0, deferred);
    
    return deferred.promise.nodeify(callback);
};

/*************************************************************************************************/
/*** Private Functions: Message Dispatcher                                                     ***/
/*************************************************************************************************/
function dispatchIncomingMsg(type, msg) {
    var targetEp,
        dispatchTo,
        zclHeader,
        frameType,
        mandatoryEvent;

    if (msg.hasOwnProperty('endpoint'))
        targetEp = af.controller.getCoord().getEndpoint(msg.endpoint);
    else if (msg.hasOwnProperty('srcaddr') && msg.hasOwnProperty('srcendpoint'))
        targetEp = af.controller.findEndpoint(msg.srcaddr, msg.srcendpoint);

    if (!targetEp)
        return;

    switch (type) {
        case 'dataConfirm':     // msg: { status, endpoint, transid }
            mandatoryEvent = 'AF:dataConfirm:' + msg.endpoint + ':' + msg.transid;
            dispatchTo = targetEp.onAfDataConfirm;
            break;
        case 'reflectError':    // msg: { status, endpoint, transid, dstaddrmode, dstaddr }
            mandatoryEvent = 'AF:reflectError:' + msg.endpoint + ':' + msg.transid;
            dispatchTo = targetEp.onAfReflectError;
            break;
        case 'incomingMsg':     // msg: { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, 
                                //        securityuse, timestamp, transseqnumber, len, data }
            zclHeader = zcl.header(msg.data);
            dispatchTo = targetEp.onAfIncomingMsg;
            break;
        case 'incomingMsgExt':  // msg: { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, 
                                //        securityuse, timestamp, transseqnumber, len, data }
            zclHeader = zcl.header(msg.data);
            dispatchTo = targetEp.onAfIncomingMsgExt;
            break;
        case 'zclIncomingMsg':  // { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, 
                                //   securityuse, timestamp, transseqnumber, zclMsg }
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
    dispatchIncomingMsg('dataConfirm', msg);
};

function reflectErrorHandler(msg) {
    dispatchIncomingMsg('reflectError', msg);
};

function incomingMsgHandler(msg) {
    dispatchIncomingMsg('incomingMsg', msg);
};

function incomingMsgExtHandler(msg) {
    dispatchIncomingMsg('incomingMsgExt', msg);
};

function zclIncomingMsgHandler(msg) {
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

function makeAfParamsExt(loEp, addrMode, dstAddrOrGrpId, cId, rawPayload, opt) {
    opt = opt || {};    // opt = { options, radius, dstEpId, dstPanId }

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

function toLongAddrString(addr) {
    var longAddr;

    if (_.isString(addr))
        longAddr = (_.startsWith(addr, '0x') || _.startsWith(addr, '0X')) ? addr.slice(2, addr.length).toLowerCase() : addr.toLowerCase();
    else if (_.isNumber(addr))
        longAddr = addr.toString(16);
    else
        throw new TypeError('Address can only be a number or a string.');

    for (var i = longAddr.length; i < 16; i++) {
        longAddr = '0' + longAddr;
    }

    return '0x' + longAddr;
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
    var msgHandlers = [
        { evt: 'AF:dataConfirm', hdlr: dataConfirmHandler },
        { evt: 'AF:reflectError', hdlr: reflectErrorHandler },
        { evt: 'AF:incomingMsg', hdlr: incomingMsgHandler },
        { evt: 'AF:incomingMsgExt', hdlr: incomingMsgExtHandler },
        { evt: 'ZCL:incomingMsg', hdlr: zclIncomingMsgHandler }

    ];

    if (!controller instanceof EventEmitter)
        throw new TypeError('Controller should be an EventEmitter.');

    af.controller = controller;
    af.areq = new Areq(controller);

    function isAttached(evt, lsn) {
        var has = false,
            lsns = af.controller.listeners(evt);

        if (_.isArray(lsns) && lsns.length) {
            has = _.find(lsns, function (n) {
                return n === lsn;
            });
        } else if (_.isFunction(lsns)) {
            has = (lsns === lsn);
        }

        return !!has;
    }

    // attach event listeners
    _.forEach(msgHandlers, function (rec) {
        if (!isAttached(rec.evt, rec.hdlr))
            af.controller.on(rec.evt, rec.hdlr);
    });

    return af;
};
