/* jshint node: true */
'use strict';
var Q = require('q'),
    ZDEF = require('zstack-id');

// CONSTANTS
var AREQ_TIMEOUT = 30;  // seconds
var afSender = {};

afSender._generateAfParams = function (controller, localEp, dstEp, cId, rawData, opt) {
    var afOptions = ZDEF.AF.OPTIONS.ACK_REQUEST | ZDEF.AF.OPTIONS.DISCV_ROUTE;    // ACK_REQUEST (0x10), DISCV_ROUTE (0x20)
    opt = opt || {};

    return {
        dstaddr: dstEp.getNwkAddr(),
        destendpoint: dstEp.getEpId(),
        srcendpoint: localEp.getEpId(),
        clusterid: cId,
        transid: controller.nextTransId(),
        options: opt.hasOwnProperty('options') ? opt.options : afOptions,
        radius: opt.radius || ZDEF.AF_DEFAULT_RADIUS,
        len: rawData.length,
        data: rawData
    };
};

// [TODO] check dstAddr -> destAddr -> should be long addr '0x123456'
afSender._generateBroadcastAfParams = function (controller, localEp, addrMode, dstAddr, clusterId, rawData, opt) {
    var afOptions = ZDEF.AF.OPTIONS.DISCV_ROUTE;
    opt = opt || {};

    return  {
        dstaddrmode: addrMode,
        dstaddr: destAddr,
        destendpoint: 0xFF,
        dstpanid: 0,
        srcendpoint: localEp.getEpId(),
        clusterid: clusterId,
        transid: controller.nextTransId(),
        options: opt.options || afOptions,
        radius: opt.radius || ZDEF.AF_DEFAULT_RADIUS,
        len: rawData.length,
        data: rawData
    };
};

afSender._generateRegisterAfParams = function (ep) {
    var inCList = ep.getInCList(),
        outCList = ep.getOutCList();

    return  {
        endpoint: ep.getEpId(),
        appprofid: ep.getProfId(),
        appdeviceid: ep.getDevId(),
        appdevver: 0,
        latencyreq: ZDEF.AF.NETWORK_LATENCY_REQ.NO_LATENCY_REQS,
        appnuminclusters: inCList.length,
        appinclusterlist: inCList,
        appnumoutclusters: outCList.length,
        appoutclusterlist: outCList
    };
};

afSender.afDataSendByLocalEp = function (controller, localEp, dstEp, cId, rawData, opt, callback) {
    var deferred = Q.defer(),
        afParams,
        apsAck = false,
        apsAckListener,
        clear,
        afEventCnf = 'AF:dataConfirm:',
        timeout;

    if (typeof opt === 'function') {
        callback = opt;
        opt = undefined;
    }

    opt = opt || {};

    clear = function () {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }

        if (apsAckListener) {
            controller.removeListener(afEventCnf, apsAckListener);
            apsAckListener = null;
        }
    };

    if (!localEp || !localEp.isLocal()) {
        deferred.reject(new Error('Local endpoint should be given.'));
    } else {
        afParams = afSender._generateAfParams(controller, localEp, dstEp, cId, rawData, opt);
        afEventCnf = afEventCnf + localEp.getEpId() + ':' + afParams.transid;
        apsAck = afParams.options & ZDEF.AF.OPTIONS.ACK_REQUEST;

        if (apsAck) {   // if has aps acknowledgement
            timeout = setTimeout(function () {
                clear();
                deferred.reject(new Error('Request timeout.'));
            }, AREQ_TIMEOUT);

            apsAckListener = function (cnf) {
                clear();

                if (cnf.status === 0 || cnf.status === 'SUCCESS')   // success
                    deferred.resolve(cnf);
                else if (cnf.status === 0xcd || cnf.status === 'NWK_NO_ROUTE')
                    deferred.reject(new Error('No network route. Please confirm that the device has (re)joined the network.'));
                else if (cnf.status === 0xe9 || cnf.status === 'MAC_NO_ACK')
                    deferred.reject(new Error('MAC no ack.'));
                else if (cnf.status === 0xb7 || cnf.status === 'APS_NO_ACK')                // ZApsNoAck period is 20 secs
                    deferred.reject(new Error('APS no ack.'));
                else if (cnf.status === 0xf0 || cnf.status === 'MAC_TRANSACTION_EXPIRED')   // ZMacTransactionExpired is 8 secs
                    deferred.reject(new Error('MAC transaction expired.'));
                else
                    deferred.reject(new Error('AF request fails, status code: ' + cnf.status));
            };

            controller.once(afEventCnf, apsAckListener);
        }

        controller.request('AF', 'dataRequest', afParams).then(function (rsp) {
            if (rsp.status !== 0) { // unsuccessful
                clear();
                deferred.reject(new Error('AfDataRequest failed.'));
            } else if (!apsAck) {
                clear();
                deferred.resolve(rsp);
            }
        }).fail(function (err) {
            clear();
            deferred.reject(err);
        }).done();
    }

    return deferred.promise.nodeify(callback);
};

afSender.afDataBroadcastByLocalEp = function (controller, localEp, addrMode, dstAddr, clusterId, rawData, opt, callback) {
    // (localEp, addrMode, dstAddr, clusterId, rawData, opt)
    var deferred = Q.defer(),
        afParams;

    if (typeof opt === 'function') {
        callback = opt;
        opt = undefined;
    }

    opt = opt || {};

    if (!localEp || !localEp.isLocal()) {
        deferred.reject(new Error('Local endpoint should be given.'));
    } else {
        afParams = afSender._generateBroadcastAfParams(controller, localEp, addrMode, dstAddr, clusterId, rawData, opt);
        controller.request('AF', 'dataRequestExt', afParams).then(function (rsp) {
            if (rsp.status !== 0)   // unsuccessful
                deferred.reject(new Error('AfDataRequestExt failed.'));
            else
                deferred.resolve(rsp);  // Broadcast (or Groupcast) has no AREQ confirm back, just resolve this transaction.
        }).fail(function (err) {
            deferred.reject(err);
        }).done();
    }

    return deferred.promise.nodeify(callback);
};

afSender.afDataSend = function (controller, dstEp, cId, rawData, opt, callback) {
    var deferred = Q.defer(),
        profId = dstEp.getProfId(),
        delegateEp = controller.getDelegator(profId);

    if (!delegateEp || !delegateEp.isLocal()) {
        deferred.reject(new Error('Profile: ' + profId + ' is not supported at this moment.'));
    } else {
        afSender.afDataSendByLocalEp(controller, delegateEp, dstEp, cId, rawData, opt).then(function (rsp) {
            deferred.resolve(rsp);
        }).fail(function (err) {
            deferred.reject(err);
        }).done();
    }

    return deferred.promise.nodeify(callback);
};

afSender.afDataGroupcast = function (controller, profId, groupId, clusterId, rawData, opt, callback) {
    // ADDR_GROUP = 0x01
    var deferred = Q.defer(),
        delegateEp = controller.getDelegator(profId),
        ADDR_GROUP = ZDEF.AF.ADDRESS_MODE.ADDR_GROUP;

    if (!delegateEp || !delegateEp.isLocal()) {
        deferred.reject(new Error('Profile: ' + profId + ' is not supported at this moment.'));
    } else {
        afSender.afDataBroadcastByLocalEp(controller, delegateEp, ADDR_GROUP, groupId, clusterId, rawData, opt).then(function (rsp) {
            deferred.resolve(rsp);
        }).fail(function (err) {
            deferred.reject(err);
        }).done();
    }

    return deferred.promise.nodeify(callback);
};

afSender.afDataBroadcast = function (controller, profId, clusterId, rawData, opt, callback) {
    // ADDR_BROADCAST = 0xFF
    var deferred = Q.defer(),
        delegateEp = controller.getDelegator(profId),
        ADDR_BROADCAST = ZDEF.AF.ADDRESS_MODE.ADDR_BROADCAST;

    if (!delegateEp || !delegateEp.isLocal()) {
        deferred.reject(new Error('Profile: ' + profId + ' is not supported at this moment.'));
    } else {
        afSender.afDataBroadcastByLocalEp(controller, delegateEp, ADDR_BROADCAST, 0xFFFF, clusterId, rawData, opt).then(function (rsp) {
            deferred.resolve(rsp);
        }).fail(function (err) {
            deferred.reject(err);
        }).done();
    }

    return deferred.promise.nodeify(callback);
};

afSender.afRegister = function (controller, ep, callback) {
    var deferred = Q.defer(),
        afParams = afSender._generateRegisterAfParams(ep);

    controller.request('AF', 'register', afParams).then(function (rsp) {
        if (rsp.status !== 0) // unsuccessful
            deferred.reject(new Error('AfRegister failed.'));
        else
            deferred.resolve(rsp);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

afSender.afDelete = function (controller, epId, callback) {
    var deferred = Q.defer();

    controller.request('AF', 'delete', { endpoint: epId }).then(function (rsp) {
        if (rsp.status !== 0) // unsuccessful
            deferred.reject(new Error('AfDelete failed.'));
        else
            deferred.resolve(rsp);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

module.exports = afSender;
