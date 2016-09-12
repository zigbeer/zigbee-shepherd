/* jshint node: true */
'use strict';

var EventEmitter = require('events');

var Q = require('q'),
    _ = require('busyman'),
    Areq = require('areq'),
    zclId = require('zcl-id'),
    ZSC = require('zstack-constants');

var zcl = require('./zcl'),
    Endpoint = require('../model/endpoint'),
    Coordpoint = require('../model/coordpoint'),
    seqNumber = 0;

var af = {
    controller: null,
    areq: null,
    _seq: 0
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

    if (!((srcEp instanceof Endpoint) || (srcEp instanceof Coordpoint)))
        throw new TypeError('srcEp should be an instance of Endpoint class.');

    if (_.isString(cId)) {
        var cIdItem = zclId.cluster(cId);
        if (_.isUndefined(cIdItem)) {
            deferred.reject(new Error('Invalid cluster id: ' + cId + '.'));
            return deferred.promise.nodeify(callback);
        } else {
            cId = cIdItem.value;
        }
    }

    if (!_.isBuffer(rawPayload))
        throw new TypeError('Af rawPayload should be a buffer.');

    if (typeof opt === 'function') {
        callback = opt;
        opt = undefined;
    }

    opt = opt || {};

    if (opt.hasOwnProperty('timeout') && (!_.isNumber(opt.timeout) || _.isNaN(opt.timeout)))
        throw new TypeError('opt.timeout should be a number.');

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

    if (!((srcEp instanceof Endpoint) || (srcEp instanceof Coordpoint)))
        throw new TypeError('srcEp should be an instance of Endpoint class.');

    if (!_.isNumber(addrMode) || _.isNaN(addrMode))
        throw new TypeError('Af addrMode should be a number.');

    if (addrMode === ZSC.AF.addressMode.ADDR_16BIT || addrMode === ZSC.AF.addressMode.ADDR_GROUP) {
        if (!_.isNumber(dstAddrOrGrpId) || _.isNaN(dstAddrOrGrpId)) 
            throw new TypeError('Af dstAddrOrGrpId should be a number for netwrok address or group id).');
    } else if (addrMode === ZSC.AF.addressMode.ADDR_64BIT) {
        if (!_.isString(dstAddrOrGrpId))
            throw new TypeError('Af dstAddrOrGrpId should be a string for long address.');
    }

    if (_.isString(cId)) {
        var cIdItem = zclId.cluster(cId);
        if (_.isUndefined(cIdItem)) {
            deferred.reject(new Error('Invalid cluster id: ' + cId + '.'));
            return deferred.promise.nodeify(callback);
        } else {
            cId = cIdItem.value;
        }
    }

    if (!_.isBuffer(rawPayload))
        throw new TypeError('Af rawPayload should be a buffer.');

    if (typeof opt === 'function') {
        callback = opt;
        opt = undefined;
    }

    opt = opt || {};

    if (opt.hasOwnProperty('timeout') && (!_.isNumber(opt.timeout) || _.isNaN(opt.timeout)))
        throw new TypeError('opt.timeout should be a number.');

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

    if (addrMode === ZSC.AF.addressMode.ADDR_GROUP || addrMode === ZSC.AF.addressMode.ADDR_BROADCAST) {
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
        afEventCnf = 'AF:dataConfirm:' + senderEp.getEpId() + ':' + afParamsExt.transid;
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
        areq = af.areq,
        dir = (srcEp === dstEp) ? 0 : 1,    // 0: client-to-server, 1: server-to-client
        manufCode = 0,
        frameCntl,
        seqNum,
        zclBuffer,
        mandatoryEvent;

    if (_.isFunction(cfg)) {
        if (!_.isFunction(callback)) {
            callback = cfg;
            cfg = {};
        }
    } else {
        cfg = cfg || {};
    }

    if ( (!_.isNumber(cmd) || _.isNaN(cmd)) && !_.isString(cmd))
        throw new TypeError('cmd should be a number or a string.');

    if (!_.isObject(cfg) || _.isArray(cfg))
        throw new TypeError('cfg should be a plain object if given.');

    frameCntl = {
        frameType: 0,       // command acts across the entire profile (foundation)
        manufSpec: cfg.hasOwnProperty('manufSpec') ? cfg.manufSpec : 0,
        direction: cfg.hasOwnProperty('direction') ? cfg.direction : dir,
        disDefaultRsp: cfg.hasOwnProperty('disDefaultRsp') ? cfg.disDefaultRsp : 0  // enable deafult response command
    };

    if (frameCntl.manufSpec === 1)
        manufCode = dstEp.getManufCode();

    // .frame(frameCntl, manufCode, seqNum, cmd, zclPayload[, clusterId])
    seqNum = cfg.hasOwnProperty('seqNum') ? cfg.seqNum : nextZclSeqNum();

    try {
        zclBuffer = zcl.frame(frameCntl, manufCode, seqNum, cmd, zclData);
    } catch (e) {
        if (e.message === 'Unrecognized command') {
            deferred.reject(e);
            return deferred.promise.nodeify(callback);
        } else {
            throw e;
        }
    }

    if (frameCntl.direction === 0) {    // client-to-server, thus require getting the feedback response

        if (srcEp === dstEp)    // from remote to remote itself
            mandatoryEvent = 'ZCL:incomingMsg:' + dstEp.getNwkAddr() + ':' + dstEp.getEpId() + ':' + seqNum;
        else                    // from local ep to remote ep
            mandatoryEvent = 'ZCL:incomingMsg:' + dstEp.getNwkAddr() + ':' + dstEp.getEpId() + ':' + srcEp.getEpId() + ':' + seqNum;

        areq.register(mandatoryEvent, deferred, function (msg) {
            // { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, securityuse, timestamp, transseqnumber, zclMsg }
            areq.resolve(mandatoryEvent, msg.zclMsg);
        });
    }

    af.send(srcEp, dstEp, cId, zclBuffer).fail(function (err) {
        if (mandatoryEvent && areq.isEventPending(mandatoryEvent))
            areq.reject(mandatoryEvent, err);
        else
            deferred.reject(err);
    }).then(function (rsp) {
        if (!mandatoryEvent)
            deferred.resolve(rsp);
    }).done();

    return deferred.promise.nodeify(callback);
};

af.zclFunctional = function (srcEp, dstEp, cId, cmd, zclData, cfg, callback) {
    // callback(err[, rsp])
    var deferred = Q.defer(),
        areq = af.areq,
        dir = (srcEp === dstEp) ? 0 : 1,    // 0: client-to-server, 1: server-to-client
        manufCode = 0,
        seqNum,
        frameCntl,
        zclBuffer,
        mandatoryEvent;

    if (_.isFunction(cfg)) {
        if (!_.isFunction(callback)) {
            callback = cfg;
            cfg = {};
        }
    } else {
        cfg = cfg || {};
    }

    if (!((srcEp instanceof Endpoint) || (srcEp instanceof Coordpoint)))
        throw new TypeError('srcEp should be an instance of Endpoint class.');

    if (!((dstEp instanceof Endpoint) || (dstEp instanceof Coordpoint)))
        throw new TypeError('dstEp should be an instance of Endpoint class.');

    if ((!_.isNumber(cmd) || _.isNaN(cmd)) && !_.isString(cmd))
        throw new TypeError('cmd should be a number or a string.');

    if (!_.isObject(cfg) || _.isArray(cfg))
        throw new TypeError('cfg should be a plain object if given.');

    frameCntl = {
        frameType: 1,       // functional command frame
        manufSpec: cfg.hasOwnProperty('manufSpec') ? cfg.manufSpec : 0,
        direction: cfg.hasOwnProperty('direction') ? cfg.direction : dir,
        disDefaultRsp: cfg.hasOwnProperty('disDefaultRsp') ? cfg.disDefaultRsp : 0  // enable deafult response command
    };

    if (frameCntl.manufSpec === 1)
        manufCode = dstEp.getManufCode();

    // .frame(frameCntl, manufCode, seqNum, cmd, zclPayload[, clusterId])
    seqNum = cfg.hasOwnProperty('seqNum') ? cfg.seqNum : nextZclSeqNum();

    try {
        zclBuffer = zcl.frame(frameCntl, manufCode, seqNum, cmd, zclData, cId);
    } catch (e) {
        if (e.message === 'Unrecognized command' || e.message === 'Unrecognized cluster') {
            deferred.reject(e);
            return deferred.promise.nodeify(callback);
        } else {
            throw e;
        }
    }

    if (frameCntl.direction === 0) {    // client-to-server, thus require getting the feedback response

        if (srcEp === dstEp)    // from remote to remote itself
            mandatoryEvent = 'ZCL:incomingMsg:' + dstEp.getNwkAddr() + ':' + dstEp.getEpId() + ':' + seqNum;
        else                    // from local ep to remote ep
            mandatoryEvent = 'ZCL:incomingMsg:' + dstEp.getNwkAddr() + ':' + dstEp.getEpId() + ':' + srcEp.getEpId() + ':' + seqNum;

        areq.register(mandatoryEvent, deferred, function (msg) {
            // { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, securityuse, timestamp, transseqnumber, zclMsg }
            areq.resolve(mandatoryEvent, msg.zclMsg);
        });
    }

    // af.send(srcEp, dstEp, cId, rawPayload, opt, callback)
    af.send(srcEp, dstEp, cId, zclBuffer).fail(function (err) {
        if (mandatoryEvent && areq.isEventPending(mandatoryEvent))
            areq.reject(mandatoryEvent, err);
        else
            deferred.reject(err);
    }).then(function (rsp) {
        if (!mandatoryEvent)
            deferred.resolve(rsp);
    }).done();

    return deferred.promise.nodeify(callback);
};

/*************************************************************************************************/
/*** ZCL Cluster and Attribute Requests                                                        ***/
/*************************************************************************************************/
af.zclClustersReq = function (dstEp, callback) {    // callback(err, clusters)
// clusters: {
//    genBasic: { dir: 1, attrs: { x1: 0, x2: 3, ... } },   // dir => 0: 'unknown', 1: 'in', 2: 'out'
//    fooClstr: { dir: 1, attrs: { x1: 0, x2: 3, ... } },
//    ...
// }
    var deferred = Q.defer(),
        clusters = {},
        clusterList = dstEp.getClusterList(),       // [ 1, 2, 3, 4, 5 ]
        inClusterList = dstEp.getInClusterList(),   // [ 1, 2, 3 ]
        outClusterList = dstEp.getOutClusterList(), // [ 1, 3, 4, 5 ]
        clusterAttrsReqs = [];  // functions
        // clusterAttrsRsps = [];  // { attr1: x }, ...

    // each request
    _.forEach(clusterList, function (cId) {
        var cIdString = zclId.cluster(cId);
        cIdString = cIdString ? cIdString.key : cId;

        clusterAttrsReqs.push(function (clusters) {
            return af.zclClusterAttrsReq(dstEp, cId).then(function (attrs) {
                clusters[cIdString] = clusters[cIdString] || { dir: 0, attrs: null };
                clusters[cIdString].dir = _.includes(inClusterList, cId) ? (clusters[cIdString].dir | 0x01) : clusters[cIdString].dir;
                clusters[cIdString].dir = _.includes(outClusterList, cId) ? (clusters[cIdString].dir | 0x02) : clusters[cIdString].dir;
                clusters[cIdString].attrs = attrs;
                return clusters;
            });
        });
    });

    // all clusters
    var allReqs = clusterAttrsReqs.reduce(function (soFar, f) {
        return soFar.then(f);
    }, Q(clusters));

    allReqs.then(function (clusters) {
        deferred.resolve(clusters);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

af.zclClusterAttrsReq = function (dstEp, cId, callback) {
    var deferred = Q.defer();

    af.zclClusterAttrIdsReq(dstEp, cId).then(function (attrIds) {
        var readReq = [],
            attrsReqs = [],
            attributes = [],
            attrIdsLen = attrIds.length;

        _.forEach(attrIds, function (id) {
            readReq.push({ attrId: id });

            if (readReq.length === 5 || readReq.length === attrIdsLen) {
                var req = _.cloneDeep(readReq);
                attrsReqs.push(function (attributes) {
                    return af.zclFoundation(dstEp, dstEp, cId, 'read', req).then(function (readStatusRecsRsp) {
                        attributes = _.concat(attributes, readStatusRecsRsp.payload);
                        return attributes;
                    });
                });
                attrIdsLen -= 5;
                readReq = [];
            }
        });

        return attrsReqs.reduce(function (soFar, f) {
            return soFar.then(f);
        }, Q(attributes));
    }).then(function (attributes) {
        var attrs = {};
        _.forEach(attributes, function (rec) {  // { attrId, status, dataType, attrData }
            var attrIdString = zclId.attr(cId, rec.attrId);

            attrIdString = attrIdString ? attrIdString.key : rec.attrId;

            attrs[attrIdString] = null;

            if (rec.status === 0)
                attrs[attrIdString] = rec.attrData;
        });

        return attrs;
    }).then(function (attrs) {
        deferred.resolve(attrs);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

af.zclClusterAttrIdsReq = function (dstEp, cId, callback) {
    var deferred = Q.defer(),
        attrsToRead = [];

    if (!((dstEp instanceof Endpoint) || (dstEp instanceof Coordpoint)))
        throw new TypeError('dstEp should be an instance of Endpoint class.');

    var discAttrs = function (startAttrId, defer) {
        af.zclFoundation(dstEp, dstEp, cId, 'discover', {
            startAttrId: startAttrId,
            maxAttrIds: 240
        }).then(function (discoverRsp) {
            // discoverRsp.payload: { discComplete, attrInfos: [ { attrId, dataType }, ... ] }
            var payload = discoverRsp.payload,
                discComplete = payload.discComplete,
                attrInfos = payload.attrInfos,
                nextReqIndex;

            _.forEach(attrInfos, function (info) {
                if (_.indexOf(attrsToRead, info.attrId) === -1)
                    attrsToRead.push(info.attrId);
            });

            if (discComplete === 0) {
                nextReqIndex = attrInfos[attrInfos.length - 1].attrId + 1;
                discAttrs(nextReqIndex, defer);
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
// 4 types of message: dataConfirm, reflectError, incomingMsg, incomingMsgExt, zclIncomingMsg
function dispatchIncomingMsg(type, msg) {
    var targetEp,       // remote ep, or a local ep (maybe a delegator)
        dispatchTo,     // which callback on targetEp
        zclHeader,
        frameType,      // check whether the msg is foundation(0) or functional(1)
        mandatoryEvent; // bridged event

    if (msg.hasOwnProperty('endpoint')) {                                               // dataConfirm, reflectError
        targetEp = af.controller.getCoord().getEndpoint(msg.endpoint);                  //  => find local ep, such a message is going to local ep
    } else if (msg.hasOwnProperty('srcaddr') && msg.hasOwnProperty('srcendpoint')) {    // incomingMsg, incomingMsgExt, zclIncomingMsg
        targetEp = af.controller.getCoord().getEndpoint(msg.dstendpoint);               //  => find local ep

        if (targetEp.isDelegator())
            targetEp = af.controller.findEndpoint(msg.srcaddr, msg.srcendpoint);        //  => find remote ep
    }

    if (!targetEp)      // if target not found, ignore this message
        return;

    switch (type) {
        case 'dataConfirm':
            // msg: { status, endpoint, transid }
            mandatoryEvent = 'AF:dataConfirm:' + msg.endpoint + ':' + msg.transid;  // sender(loEp) is listening, see af.send() and af.sendExt()
            dispatchTo = targetEp.onAfDataConfirm;
            break;
        case 'reflectError':
            // msg: { status, endpoint, transid, dstaddrmode, dstaddr }
            mandatoryEvent = 'AF:reflectError:' + msg.endpoint + ':' + msg.transid;
            dispatchTo = targetEp.onAfReflectError;
            break;
        case 'incomingMsg':
            // msg: { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, securityuse, timestamp, transseqnumber, len, data }
            zclHeader = zcl.header(msg.data);       // a zcl packet maybe, pre-parse it to get the header
            dispatchTo = targetEp.onAfIncomingMsg;
            break;
        case 'incomingMsgExt':
            // msg: { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, securityuse, timestamp, transseqnumber, len, data }
            zclHeader = zcl.header(msg.data);       // a zcl packet maybe, pre-parse it to get the header
            dispatchTo = targetEp.onAfIncomingMsgExt;
            break;
        case 'zclIncomingMsg':
            // { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, securityuse, timestamp, transseqnumber, zclMsg }
            if (targetEp.isLocal()) {
                // to local app ep, receive zcl command or zcl command response. see af.zclFoudation() and af.zclFunctional()
                if (!targetEp.isDelegator())
                    mandatoryEvent = 'ZCL:incomingMsg:' + msg.srcaddr + ':' + msg.srcendpoint + ':' + msg.dstendpoint + ':' + msg.zclMsg.seqNum;
            } else {
                var localEp = af.controller.findEndpoint(0, msg.dstendpoint),
                    toLocalApp = false;

                if (localEp)
                    toLocalApp = localEp.isLocal() ? !localEp.isDelegator() : false;

                if (toLocalApp) {
                    mandatoryEvent = 'ZCL:incomingMsg:' + msg.srcaddr + ':' + msg.srcendpoint + ':' + msg.dstendpoint + ':' + msg.zclMsg.seqNum;
                } else {
                    // to remote ep, receive the zcl command response 
                    mandatoryEvent = 'ZCL:incomingMsg:' + msg.srcaddr + ':' + msg.srcendpoint + ':' + msg.zclMsg.seqNum;
                }
            }

            // msg.data is now msg.zclMsg
            frameType = msg.zclMsg.frameCntl.frameType;
            if (frameType === 0)            // foundation
                dispatchTo = targetEp.onZclFoundation;
            else if (frameType === 1)       // functional
                dispatchTo = targetEp.onZclFunctional;
            break;
    }

    if (_.isFunction(dispatchTo)) {
        process.nextTick(function () {
            dispatchTo(msg);
        });
    }

    if (mandatoryEvent)
        af.controller.emit(mandatoryEvent, msg);

    if (type === 'zclIncomingMsg')  // no need for further parsing
        return;

    // further parse for ZCL packet from incomingMsg and incomingMsgExt
    if (zclHeader && targetEp.isZclSupported()) {
        if (zclHeader.frameCntl.frameType === 0) {          // foundation
            zcl.parse(msg.data, function (err, zclData) {
                if (!err)
                    zclIncomingParsedMsgEmitter(msg, zclData);
            });
        } else if (zclHeader.frameCntl.frameType === 1) {   // functional
            zcl.parse(msg.data, msg.clusterid, function (err, zclData) {
                if (!err)
                    zclIncomingParsedMsgEmitter(msg, zclData);
            });
        }
    }
}

/*************************************************************************************************/
/*** Private Functions: Af and Zcl Incoming Message Handlers                                   ***/
/*************************************************************************************************/
function dataConfirmHandler(msg) {
    return dispatchIncomingMsg('dataConfirm', msg);
}

function reflectErrorHandler(msg) {
    return dispatchIncomingMsg('reflectError', msg);
}

function incomingMsgHandler(msg) {
    return dispatchIncomingMsg('incomingMsg', msg);
}

function incomingMsgExtHandler(msg) {
    return dispatchIncomingMsg('incomingMsgExt', msg);
}

function zclIncomingMsgHandler(msg) {
    return dispatchIncomingMsg('zclIncomingMsg', msg);
}

/*************************************************************************************************/
/*** Private Functions                                                                         ***/
/*************************************************************************************************/
function zclIncomingParsedMsgEmitter(msg, zclData) {        // after zcl packet parsed, re-emit it
    var parsedMsg = _.cloneDeep(msg);
    parsedMsg.zclMsg = zclData;

    process.nextTick(function () {
        af.controller.emit('ZCL:incomingMsg', parsedMsg);
    });
}

function makeAfParams(loEp, dstEp, cId, rawPayload, opt) {
    opt = opt || {};    // opt = { options, radius }

    if (!_.isNumber(cId) || _.isNaN(cId))
        throw new TypeError('cId should be a number.');

    if (opt.hasOwnProperty('options') && (!_.isNumber(opt.options) || _.isNaN(opt.options)))
        throw new TypeError('opt.options should be a number.');

    if (opt.hasOwnProperty('radius') && (!_.isNumber(opt.radius) || _.isNaN(opt.radius)))
        throw new TypeError('opt.radius should be a number.');

    var afOptions = ZSC.AF.options.ACK_REQUEST | ZSC.AF.options.DISCV_ROUTE,    // ACK_REQUEST (0x10), DISCV_ROUTE (0x20)
        afParams = {
            dstaddr: dstEp.getNwkAddr(),
            destendpoint: dstEp.getEpId(),
            srcendpoint: loEp.getEpId(),
            clusterid: cId,
            transid: af.controller ? af.controller.nextTransId() : null,
            options: opt.hasOwnProperty('options') ? opt.options : afOptions,
            radius: opt.hasOwnProperty('radius') ? opt.radius : ZSC.AF_DEFAULT_RADIUS,
            len: rawPayload.length,
            data: rawPayload
        };

    return afParams;
}

function makeAfParamsExt(loEp, addrMode, dstAddrOrGrpId, cId, rawPayload, opt) {
    opt = opt || {};    // opt = { options, radius, dstEpId, dstPanId }

    if (!_.isNumber(cId) || _.isNaN(cId))
        throw new TypeError('cId should be a number.');

    if (opt.hasOwnProperty('options') && (!_.isNumber(opt.options) || _.isNaN(opt.options)))
        throw new TypeError('opt.options should be a number.');

    if (opt.hasOwnProperty('radius') && (!_.isNumber(opt.radius) || _.isNaN(opt.radius)))
        throw new TypeError('opt.radius should be a number.');

    var afOptions = ZSC.AF.options.DISCV_ROUTE,
        afParamsExt = {
            dstaddrmode: addrMode,
            dstaddr: toLongAddrString(dstAddrOrGrpId),
            destendpoint: 0xFF,
            dstpanid: opt.hasOwnProperty('dstPanId') ? opt.dstPanId : 0,
            srcendpoint: loEp.getEpId(),
            clusterid: cId,
            transid: af.controller ? af.controller.nextTransId() : null,
            options: opt.hasOwnProperty('options') ? opt.options : afOptions,
            radius: opt.hasOwnProperty('radius') ? opt.radius : ZSC.AF_DEFAULT_RADIUS,
            len: rawPayload.length,
            data: rawPayload
        };

    switch (addrMode) {
        case ZSC.AF.addressMode.ADDR_NOT_PRESENT:
            break;
        case ZSC.AF.addressMode.ADDR_GROUP:
            afParamsExt.destendpoint = 0xFF;
            break;
        case ZSC.AF.addressMode.ADDR_16BIT:
        case ZSC.AF.addressMode.ADDR_64BIT:
            afParamsExt.destendpoint = opt.hasOwnProperty('dstEpId') ? opt.dstEpId : 0xFF;
            afParamsExt.options = opt.hasOwnProperty('options') ? opt.options : afOptions | ZSC.AF.options.ACK_REQUEST;
            break;
        case ZSC.AF.addressMode.ADDR_BROADCAST:
            afParamsExt.destendpoint = 0xFF;
            afParamsExt.dstaddr = toLongAddrString(0xFFFF);
            break;
        default:
            afParamsExt = null;
            break;
    }

    return afParamsExt;
}

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

function nextZclSeqNum() {
    seqNumber += 1; // seqNumber is a private var on the top of this module
    if (seqNumber > 255 || seqNumber < 0 )
        seqNumber = 0;

    af._seq = seqNumber;
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

    if (!(controller instanceof EventEmitter))
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
