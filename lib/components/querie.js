/* jshint node: true */
'use strict';
var Q = require('q'),
    _ = require('lodash'),
    ZDEF = require('zstack-id');

var controller,
    querie = {};

/*************************************************************************************************/
/*** Public APIs                                                                               ***/
/*************************************************************************************************/
querie.coordState = function (callback) {
    return querie.network('DEV_STATE', callback);
};

querie.coord = function (callback) {
    var nwkInfo = controller.getNwkInfo(),
        queryDev = function () {
            // info: { type, ieeeAddr, nwkAddr, manufId, epList }
            return querie.device(nwkInfo.ieeeAddr, nwkInfo.nwkAddr, callback);
        };

    if (!nwkInfo.ieeeAddr) {
        querie._network('IEEE_ADDR').then(function (rsp) {
            nwkInfo.ieeeAddr = rsp.value;
        }).then(queryDev);
    } else {
        queryDev();
    }
};

querie.network = function (param, callback) {
    if (_.isFunction(param)) {
        callback = param;
        param = null;
    }

    if (param)
        return querie._network(param, callback);    // return value
    else
        return querie._networkAll(callback);        // return { state, channel, panId, extPanId, ieeeAddr, nwkAddr }
};

querie.address = function (addr, callback) {
    var deferred = Q.defer(),
        findLong = false,
        apiName = null,
        valObj = null;

    if (_.isString(addr)) { // use long to find short
        apiName = 'addrmgrNwkAddrLookup';
        valObj = { nwkaddr: addr };
    } else if (_.isNumber(addr)) { // use short to find long
        apiName = 'addrmgrExtAddrLookup';
        valObj = { extaddr: addr };
        findLong = true;
    } else {
        deferred.reject(new Error('address should be string for ieeeAddr or number for nwkAddr.'));
    }

    controller.request('UTIL', apiName, valObj).then(function (rsp) {
        if (findLong)
            deferred.resolve(rsp.extaddr);
        else
            deferred.resolve(rsp.nwkaddr);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

querie.device = function (ieeeAddr, nwkAddr, callback) {
    var deferred = Q.defer(),
        devInfo = {
            type: null,
            ieeeAddr: ieeeAddr,
            nwkAddr: nwkAddr,
            manufId: null,
            epList: null
        };

    controller.request('ZDO', 'nodeDescReq', { dstaddr: nwkAddr, nwkaddrofinterest: nwkAddr }).then(function (rsp) {
        // rsp: { srcaddr, status, nwkaddr, logicaltype_cmplxdescavai_userdescavai, ..., manufacturercode, ... }
        devInfo.type = rsp.logicaltype_cmplxdescavai_userdescavai & 0x07;   // logical type: bit0-2
        devInfo.manufId = rsp.manufacturercode;
        return controller.request('ZDO', 'activeEpReq', { dstaddr: nwkAddr, nwkaddrofinterest: nwkAddr });
    }).then(function(rsp) {
        // rsp: { srcaddr, status, nwkaddr, activeepcount, activeeplist }
        devInfo.epList = rsp.activeeplist;
        deferred.resolve(devInfo);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

querie.endpoint = function (nwkAddr, epId, callback) {
    var deferred = Q.defer();

    controller.request('ZDO', 'simpleDescReq', { dstaddr: nwkAddr, nwkaddrofinterest: nwkAddr, endpoint: epId }).then(function (rsp) {
        // rsp: { srcaddr, status, nwkaddr, len, endpoint, profileid, deviceid, deviceversion, numinclusters, inclusterlist, 
        //        numoutclusters, outclusterlist }
        return {
            profId: rsp.profileid || 0,
            epId: rsp.endpoint,
            devId: rsp.deviceid || 0,
            inCList: rsp.inclusterlist || [],
            outCList: rsp.outclusterlist || []
        };
    }).then(function (epInfo) {
        deferred.resolve(epInfo);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

querie.deviceWithEndpoints = function (ieeeAddr, nwkAddr, callback) {
    var deferred = Q.defer(),
        fullDev,
        epRspCount = 0,
        epRspCountUp,
        epQueries = [],
        epQueriesChecker,
        notActiveEpEvent = 'ZDO:stateChangeInd:' + nwkAddr + ':NOT_ACTIVE',
        fakeSimpDescEventHead = 'ZDO:simpleDescRsp:' + nwkAddr + ':';

    epRspCountUp = function () {
        epRspCount += 1;
    };

    controller.queryDevInfo(ieeeAddr, nwkAddr).then(function (devInfo) {
        fullDev = devInfo;
        return fullDev;
    }).then(function () {
        controller.on(notActiveEpEvent, epRspCountUp);
        epQueriesChecker = setInterval(function () {
            if (epRspCount < fullDev.epList.length)
                return;

            epQueries.forEach(function (qry, idx) {
                var epId = fullDev.epList[idx];
                if (Q.isPromise(qry) && qry.isPending())        // use profileid= 0xFFFF to notify that this ep is not active!
                    controller.emit(fakeSimpDescEventHead + epId, { endpoint: epId, profileid: 0xFFFF });   // emit a fake and empty endpoint
            });
            clearInterval(epQueriesChecker);
            epQueriesChecker = null;
        }, 10000);  // [FIXME] why 10 seconds? 

        return fullDev;
    }).then(function () {
        fullDev.epList.forEach(function (epId) {
            var epQuery = controller.endpoint(nwkAddr, epId).then(function (epInfo) {
                epRspCount += 1;
                return epInfo;
            });
            epQueries.push(epQuery);
        });
        return Q.all(epQueries);
    }).then(function (epInfos) {
        epRspCount = 0;
        controller.removeListener(notActiveEpEvent, epRspCountUp);
        fullDev.endpoints = epInfos;
        deferred.resolve(fullDev);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

querie.setBindingEntry = function (bindMode, remoteEp, localEp, cId, callback) {
    var deferred = Q.defer(),
        req,
        bindParams = {
            dstaddr: localEp.getDevice().getNwkAddr(),
            srcaddr: localEp.getDevice().getIeeeAddr(),
            srcendpoint: localEp.getEpId(),
            clusterid: cId,
            dstaddrmode: ZDEF.COMMON.ADDRESS_MODE.ADDR_64BIT,
            addr_short_long: remoteEp.getDevice().getIeeeAddr(),
            dstendpoint: remoteEp.getEpId
        };

    if (bindMode === 0 || bindMode === 'bind') {
        req = function () { return controller.request('ZDO', 'bindReq', bindParams); };
    } else if (bindMode === 1 || bindMode === 'unbind') {
        req = function () { return controller.request('ZDO', 'unbindReq', bindParams); };
    }

    req().then(function (rsp) {
        deferred.resolve(rsp);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

/*************************************************************************************************/
/*** Protected Methods                                                                         ***/
/*************************************************************************************************/
querie._network = function (param, callback) {
    var deferred = Q.defer(),
        prop = ZDEF.SAPI.get(param);

    if (!prop) {
        deferred.reject(new Error('Unknown network property.'));
    } else {
        controller.request('SAPI', 'getDeviceInfo', { param: prop.value }, function (err, rsp) {
            if (err)
                deferred.reject(err);
            else
                deferred.resolve(rsp.value);
        });
    }

    return deferred.promise.nodeify(callback);
};

querie._networkAll = function (callback) {
    var deferred = Q.defer(),
        net = {
            state: null,    // ZDEF.COMMON.DEV_STATES
            channel: null,
            panId: null,
            extPanId: null,
            ieeeAddr: null,
            nwkAddr: 0
        };

    var steps = [
        function () {
            return querie._network('DEV_STATE').then(function (rsp) {
                net.state = rsp.value;
            });
        },
        function () {
            return querie._network('IEEE_ADDR').then(function (rsp) {
                net.ieeeAddr = rsp.value;
            });
        },
        function () {
            return querie._network('SHORT_ADDR').then(function (rsp) {
                net.nwkAddr = rsp.value;
            });
        },
        function () {
            return querie._network('CHANNEL').then(function (rsp) {
                net.channel = rsp.value;
            });
        },
        function () {
            return querie._network('PAN_ID').then(function (rsp) {
                net.panId = rsp.value;
            });
        },
        function () {
            return querie._network('EXT_PAN_ID').then(function (rsp) {
                net.extPanId = rsp.value;
            });
        }
    ];

    steps.reduce(function (soFar, fn) {
        return soFar.then(fn);
    }, Q(0)).then(function () {
        deferred.resolve(net);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

module.exports = function (cntl) {
    controller = cntl;
    return querie;
};
