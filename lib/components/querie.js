/* jshint node: true */
'use strict';

var Q = require('q'),
    _ = require('busyman'),
    zclId = require('zcl-id'),
    proving = require('proving'),
    ZSC = require('zstack-constants');

var Endpoint  = require('../model/endpoint'),
    Coordpoint  = require('../model/coordpoint'),
    zutils = require('./zutils');

var controller,
    querie = {};

/*************************************************************************************************/
/*** Public APIs                                                                               ***/
/*************************************************************************************************/
querie.coordInfo = function (callback) {
    var info = controller.getNetInfo();
    return querie.device(info.ieeeAddr, info.nwkAddr, callback);
};

querie.coordState = function (callback) {
    return querie.network('DEV_STATE', callback);
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

querie.device = function (ieeeAddr, nwkAddr, callback) {
    var devInfo = {
            type: null,
            ieeeAddr: ieeeAddr,
            nwkAddr: nwkAddr,
            manufId: null,
            epList: null
        };

    proving.string(ieeeAddr, 'ieeeAddr should be a string.');
    proving.number(nwkAddr, 'nwkAddr should be a number.');

    return controller.request('ZDO', 'nodeDescReq', { dstaddr: nwkAddr, nwkaddrofinterest: nwkAddr }).then(function (rsp) {
        // rsp: { srcaddr, status, nwkaddr, logicaltype_cmplxdescavai_userdescavai, ..., manufacturercode, ... }
        devInfo.type = devType(rsp.logicaltype_cmplxdescavai_userdescavai & 0x07);  // logical type: bit0-2
        devInfo.manufId = rsp.manufacturercode;
        return controller.request('ZDO', 'activeEpReq', { dstaddr: nwkAddr, nwkaddrofinterest: nwkAddr });
    }).then(function(rsp) {
        // rsp: { srcaddr, status, nwkaddr, activeepcount, activeeplist }
        devInfo.epList = bufToArray(rsp.activeeplist, 'uint8');
        return devInfo;
    }).nodeify(callback);
};

querie.endpoint = function (nwkAddr, epId, callback) {
    proving.number(nwkAddr, 'nwkAddr should be a number.');

    return controller.request('ZDO', 'simpleDescReq', { dstaddr: nwkAddr, nwkaddrofinterest: nwkAddr, endpoint: epId }).then(function (rsp) {
        // rsp: { ..., endpoint, profileid, deviceid, deviceversion, numinclusters, inclusterlist, numoutclusters, outclusterlist }
        return {
            profId: rsp.profileid || 0,
            epId: rsp.endpoint,
            devId: rsp.deviceid || 0,
            inClusterList: bufToArray(rsp.inclusterlist, 'uint16'),
            outClusterList: bufToArray(rsp.outclusterlist, 'uint16')
        };
    }).nodeify(callback);
};

querie.deviceWithEndpoints = function (nwkAddr, ieeeAddr, callback) {
    var deferred = Q.defer(),
        epQueries = [],
        fullDev;

    querie.device(ieeeAddr, nwkAddr).then(function (devInfo) {
        fullDev = devInfo;

        _.forEach(fullDev.epList, function (epId) {
            var epQuery = querie.endpoint(nwkAddr, epId);
            epQueries.push(epQuery);
        });

        return Q.all(epQueries);
    }).then(function (epInfos) {
        fullDev.endpoints = epInfos;
        deferred.resolve(fullDev);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

querie.setBindingEntry = function (bindMode, srcEp, cId, dstEpOrGrpId, callback) {
    var deferred = Q.defer(),
        cIdItem = zclId.cluster(cId),
        bindParams,
        dstEp,
        grpId,
        req;

    if (!((srcEp instanceof Endpoint) || (srcEp instanceof Coordpoint)))
        throw new TypeError('srcEp should be an instance of Endpoint class.');

    proving.defined(cIdItem, 'Invalid cluster id: ' + cId + '.');

    if (_.isNumber(dstEpOrGrpId) && !_.isNaN(dstEpOrGrpId))
        grpId = dstEpOrGrpId;
    else if (dstEpOrGrpId instanceof Endpoint || dstEpOrGrpId instanceof Coordpoint)
        dstEp = dstEpOrGrpId;
    else
        throw new TypeError('dstEpOrGrpId should be an instance of Endpoint class or a number of group id.');

    bindParams = {
        dstaddr: srcEp.getNwkAddr(),
        srcaddr: srcEp.getIeeeAddr(),
        srcendpoint: srcEp.getEpId(),
        clusterid: cIdItem.value,
        dstaddrmode: dstEp ? ZSC.AF.addressMode.ADDR_64BIT : ZSC.AF.addressMode.ADDR_GROUP,
        addr_short_long: dstEp ? dstEp.getIeeeAddr() : zutils.toLongAddrString(grpId),
        dstendpoint: dstEp ? dstEp.getEpId() : 0xFF
    };

    if (bindMode === 0 || bindMode === 'bind') {
        req = function () { return controller.request('ZDO', 'bindReq', bindParams); };
    } else if (bindMode === 1 || bindMode === 'unbind') {
        req = function () { return controller.request('ZDO', 'unbindReq', bindParams); };
    }

	(function performReq(retryAttempts) {
		if (typeof retryAttempts === 'undefined') retryAttempts = 0;
		req().then(function (rsp) {
			deferred.resolve();
		}).fail(function (err) {
			if(retryAttempts >= 4) return deferred.reject(err);
			else performReq(++retryAttempts);
		}).done();
	})();

    return deferred.promise.nodeify(callback);
};

/*************************************************************************************************/
/*** Protected Methods                                                                         ***/
/*************************************************************************************************/
querie._network = function (param, callback) {
    var prop = ZSC.SAPI.zbDeviceInfo[param];

    return Q.fcall(function () {
        if (_.isNil(prop))
            return Q.reject(new Error('Unknown network property.'));
        else
            return controller.request('SAPI', 'getDeviceInfo', { param: prop });
    }).then(function (rsp) {
        switch (param) {
            case 'DEV_STATE':
            case 'CHANNEL':
                return rsp.value.readUInt8(0);
            case 'IEEE_ADDR':
            case 'PARENT_IEEE_ADDR':
            case 'EXT_PAN_ID':
                return addrBuf2Str(rsp.value);
            case 'SHORT_ADDR':
            case 'PARENT_SHORT_ADDR':
                return rsp.value.readUInt16LE(0);
            case 'PAN_ID':
                return zutils.toHexString(rsp.value.readUInt16LE(0), 'uint16');
        }
    }).nodeify(callback);
};

querie._networkAll = function (callback) {
    var paramsInfo = [
            { param: 'DEV_STATE',  name: 'state'   }, { param: 'IEEE_ADDR',  name: 'ieeeAddr' },
            { param: 'SHORT_ADDR', name: 'nwkAddr' }, { param: 'CHANNEL',    name: 'channel'  },
            { param: 'PAN_ID',     name: 'panId'   }, { param: 'EXT_PAN_ID', name: 'extPanId' }
        ],
        net = {
            state: null,
            channel: null,
            panId: null,
            extPanId: null,
            ieeeAddr: null,
            nwkAddr: null
        },
        steps = [];

    _.forEach(paramsInfo, function (paramInfo) {
        steps.push(function (net) {
            return querie._network(paramInfo.param).then(function (value) {
                net[paramInfo.name] = value;
                return net;
            });
        });
    });

    return steps.reduce(function (soFar, fn) {
        return soFar.then(fn);
    }, Q(net)).nodeify(callback);
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
    var val,
        bufLen = buf.length,
        strChunk = '0x';

    for (var i = 0; i < bufLen; i += 1) {
        val = buf.readUInt8(bufLen - i - 1);

        if (val <= 15)
            strChunk += '0' + val.toString(16);
        else
            strChunk += val.toString(16);
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

module.exports = function (cntl) {
    controller = cntl;
    return querie;
};
