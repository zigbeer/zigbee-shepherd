/* jshint node: true */
'use strict';

var Q = require('q'),
    _ = require('busyman'),
    ZSC = require('zstack-constants');

var controller,
    querie = {};

/*************************************************************************************************/
/*** Public APIs                                                                               ***/
/*************************************************************************************************/
querie.coordState = function (callback) {
    return querie.network('DEV_STATE', callback);
};

querie.coord = function (callback) {
    var nwkInfo = controller.getNwkInfo();

    return querie.device(nwkInfo.ieeeAddr, nwkInfo.nwkAddr, callback);
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

    if (_.isString(addr)) {           // use long to find short
        apiName = 'addrmgrNwkAddrLookup';
        valObj = { nwkaddr: addr };
    } else if (_.isNumber(addr)) {    // use short to find long
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
        devInfo.type = devType(rsp.logicaltype_cmplxdescavai_userdescavai & 0x07);   // logical type: bit0-2
        devInfo.manufId = rsp.manufacturercode;
        return controller.request('ZDO', 'activeEpReq', { dstaddr: nwkAddr, nwkaddrofinterest: nwkAddr });
    }).then(function(rsp) {
        // rsp: { srcaddr, status, nwkaddr, activeepcount, activeeplist }
        devInfo.epList = bufToArray(rsp.activeeplist, 'uint8');
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
        deferred.resolve({
            profId: rsp.profileid || 0,
            epId: rsp.endpoint,
            devId: rsp.deviceid || 0,
            inClusterList: bufToArray(rsp.inclusterlist, 'uint16'),
            outClusterList: bufToArray(rsp.outclusterlist, 'uint16')
        });
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

querie.deviceWithEndpoints = function (nwkAddr, ieeeAddr, callback) {
    var self = this,
        deferred = Q.defer(),
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

    this.device(ieeeAddr, nwkAddr).then(function (devInfo) {
        fullDev = devInfo;
        return;
    }).then(function () {
        controller.on(notActiveEpEvent, epRspCountUp);
        epQueriesChecker = setInterval(function () {
            if (epRspCount < fullDev.epList.length)
                return;

            epQueries.forEach(function (qry, idx) {
                var epId = fullDev.epList[idx];
                if (Q.isPromise(qry) && qry.isPending())    // use profileid= 0xFFFF to notify that this ep is not active!
                    controller.emit(fakeSimpDescEventHead + epId, { endpoint: epId, profileid: 0xFFFF });    // emit a fake and empty endpoint
            });
            clearInterval(epQueriesChecker);
            epQueriesChecker = null;
        }, 10000);    // [FIXME] why 10 seconds? 

        return;
    }).then(function () {
        fullDev.epList.forEach(function (epId) {
            var epQuery = self.endpoint(nwkAddr, epId).then(function (epInfo) {
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

querie.setBindingEntry = function (bindMode, srcEp, dstEp, cId, grpId, callback) {
    var deferred = Q.defer(),
        req,
        bindParams = {
            dstaddr: srcEp.getDevice().getNwkAddr(),
            srcaddr: srcEp.getDevice().getIeeeAddr(),
            srcendpoint: srcEp.getEpId(),
            clusterid: cId,
            dstaddrmode: ZSC.AF.addressMode.ADDR_64BIT,
            addr_short_long: dstEp.getDevice().getIeeeAddr(),
            dstendpoint: dstEp.getEpId()
        };

    if (grpId && (!_.isNumber(grpId) || _.isNaN(grpId)))
        throw new TypeError('grpId should be a number.');

    if (grpId) {
        bindParams.dstaddrmode = ZSC.AF.addressMode.ADDR_GROUP;
        bindParams.addr_short_long = toLongAddrString(3);
        bindParams.dstendpoint = 0xFF;
    }

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
        prop = ZSC.SAPI.zbDeviceInfo[param];

    if (_.isNil(prop)) {
        deferred.reject(new Error('Unknown network property.'));
    } else {
        controller.request('SAPI', 'getDeviceInfo', { param: prop }, function (err, rsp) {
            if (err)
                deferred.reject(err);
            else {
                switch (param) {
                    case 'DEV_STATE':
                    case 'CHANNEL':
                        deferred.resolve(rsp.value.readUInt8(0));
                        break;
                    case 'IEEE_ADDR':
                    case 'PARENT_IEEE_ADDR':
                    case 'EXT_PAN_ID':
                        deferred.resolve(addrBuf2Str(rsp.value));
                        break;
                    case 'SHORT_ADDR':
                    case 'PARENT_SHORT_ADDR':
                    case 'PAN_ID':
                        deferred.resolve(rsp.value.readUInt16LE(0));
                        break;
                }
            }
        });
    }

    return deferred.promise.nodeify(callback);
};

querie._networkAll = function (callback) {
    var deferred = Q.defer(),
        net = {
            state: null,
            channel: null,
            panId: null,
            extPanId: null,
            ieeeAddr: null,
            nwkAddr: 0
        },
        paramsInfo = [
            { param: 'DEV_STATE', name: 'state' }, { param: 'IEEE_ADDR', name: 'ieeeAddr' }, 
            { param: 'SHORT_ADDR', name: 'nwkAddr' }, { param: 'CHANNEL', name: 'channel' }, 
            { param: 'PAN_ID', name: 'panId' }, { param: 'EXT_PAN_ID', name: 'extPanId' }, 
        ],
        steps = [];

    _.forEach(paramsInfo, function (paramInfo) {
        steps.push(function () {
             return querie._network(paramInfo.param).then(function (value) {
                net[paramInfo.name] = value;
            });
        });
    });

    steps.reduce(function (soFar, fn) {
        return soFar.then(fn);
    }, Q(0)).then(function () {
        deferred.resolve(net);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

function devType(type) {
    var DEVTYPE = ZSC.ZDO.deviceLogicalType;

    switch (type) {
        case DEVTYPE.COORDINATOR:
            return 'Coordinator';
        case DEVTYPE.ROUTER:
            return 'Router';
        case DEVTYPE.ENDDEVICE:
            return 'EndDevice';
        case DEVTYPE.COMPLEX_DESC_AVAIL:
            return 'ComplexDescAvail';
        case DEVTYPE.USER_DESC_AVAIL:
            return 'UserDescAvail';
        default:
            break;
    }
}

function addrBuf2Str(buf) {
    var bufLen = buf.length,
        val,
        strChunk = '0x';

    for (var i = 0; i < bufLen; i += 1) {
        val = buf.readUInt8(bufLen - i - 1);
        if (val <= 15) {
            strChunk += '0' + val.toString(16);
        } else {
            strChunk += val.toString(16);
        }
    }

    return strChunk;
}

function bufToArray(buf, nip) {
    var i,
        nipArr = [];

    if (nip === 'uint8') {
        for (i = 0; i < buf.length; i += 1) {
            nipArr.push(buf.readUInt8(i));
        }
    } else if (nip === 'uint16') {
        for (i = 0; i < buf.length; i += 2) {
            nipArr.push(buf.readUInt16LE(i));
        }
    }

    return nipArr.sort(function (a, b) { return a - b; });
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

module.exports = function (cntl) {
    controller = cntl;
    return querie;
};
