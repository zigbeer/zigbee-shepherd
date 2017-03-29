/* jshint node: true */
'use strict';

var util = require('util'),
    EventEmitter = require('events');

var Q = require('q'),
    _ = require('busyman'),
    znp = require('cc-znp'),
    proving = require('proving'),
    ZSC = require('zstack-constants'),
    debug = {
        shepherd: require('debug')('zigbee-shepherd'),
        init: require('debug')('zigbee-shepherd:init'),
        request: require('debug')('zigbee-shepherd:request'),
        response: require('debug')('zigbee-shepherd:response')
    };

var Zdo = require('./zdo'),
    querie = require('./querie'),
    bridge = require('./event_bridge.js'),
    init = require('../initializers/init_controller'),
    nvParams = require('../config/nv_start_options.js');

var Device = require('../model/device'),
    Coordpoint = require('../model/coordpoint');

function Controller(shepherd, cfg) {
    // cfg is serial port config
    var self = this,
        transId = 0;

    EventEmitter.call(this);

    if (!_.isPlainObject(cfg))
        throw new TypeError('cfg should be an object.');

    /***************************************************/
    /*** Protected Members                           ***/
    /***************************************************/
    this._shepherd = shepherd;
    this._coord = null;
    this._znp = znp;
    this._cfg = cfg;
    this._zdo = new Zdo(this);
    this._resetting = false;
    this._spinLock = false;
    this._joinQueue = [];
    this._permitJoinTime = 0;

    this._net = {
        state: null,
        channel: null,
        panId: null,
        extPanId: null,
        ieeeAddr: null,
        nwkAddr: null,
        joinTimeLeft: 0
    };

    /***************************************************/
    /*** Public Members                              ***/
    /***************************************************/
    this.querie = querie(this);

    this.nextTransId = function () {  // zigbee transection id
        if (++transId > 255)
            transId = 1;
        return transId;
    };

    this.permitJoinCountdown = function () {
        return self._permitJoinTime -= 1;
    };

    this.isResetting = function () {
        return self._resetting;
    };

    /***************************************************/
    /*** Event Handlers                              ***/
    /***************************************************/
    this._znp.on('ready', function () {
        init.setupCoord(self).then(function () {
            self.emit('ZNP:INIT');
        }).fail(function (err) {
            self.emit('ZNP:INIT', err);
            debug.init('Coordinator initialize had an error:', err);
        }).done();
    });

    this._znp.on('close', function () {
        self.emit('ZNP:CLOSE');
    });

    this._znp.on('AREQ', function (msg) {
        bridge._areqEventBridge(self, msg);
    });

    this.on('ZDO:endDeviceAnnceInd', function (data) {
        if (self._spinLock) {
            self._joinQueue.push(function () {
                self.endDeviceAnnceHdlr(data);
            });
        } else {
            self._spinLock = true;
            self.endDeviceAnnceHdlr(data);
        }
    });
}

util.inherits(Controller, EventEmitter);

/*************************************************************************************************/
/*** Public ZigBee Utility APIs                                                                ***/
/*************************************************************************************************/
Controller.prototype.getShepherd = function () {
    return this._shepherd;
};

Controller.prototype.getCoord = function () {
    return this._coord;
};

Controller.prototype.getNetInfo = function () {
    var net = _.cloneDeep(this._net);

    if (net.state === ZSC.ZDO.devStates.ZB_COORD)
        net.state = 'Coordinator';

    net.joinTimeLeft = this._permitJoinTime;

    return net;
};

Controller.prototype.setNetInfo = function (netInfo) {
    var self = this;

    _.forEach(netInfo, function (val, key) {
        if (_.has(self._net, key))
            self._net[key] = val;
    });
};

/*************************************************************************************************/
/*** Mandatory Public APIs                                                                     ***/
/*************************************************************************************************/
Controller.prototype.start = function (callback) {
    var self = this,
        deferred = Q.defer(),
        readyLsn;

    readyLsn = function (err) {
        return err ? deferred.reject(err) : deferred.resolve();
    };

    this.once('ZNP:INIT', readyLsn);

    Q.ninvoke(this._znp, 'init', this._cfg).fail(function (err) {
        self.removeListener('ZNP:INIT', readyLsn);
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

Controller.prototype.close = function (callback) {
    var self = this,
        deferred = Q.defer(),
        closeLsn;

    closeLsn = function () {
        deferred.resolve();
    };

    this.once('ZNP:CLOSE', closeLsn);

    Q.ninvoke(this._znp, 'close').fail(function (err) {
        self.removeListener('ZNP:CLOSE', closeLsn);
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

Controller.prototype.reset = function (mode, callback) {
    var self = this,
        deferred = Q.defer(),
        startupOption = nvParams.startupOption.value[0];

    proving.stringOrNumber(mode, 'mode should be a number or a string.');

    Q.fcall(function () {
        if (mode === 'soft' || mode === 1) {
            debug.shepherd('Starting a software reset...');
            self._resetting = true;

            return self.request('SYS', 'resetReq', { type: 0x01 });
        } else if (mode === 'hard' || mode === 0) {
            debug.shepherd('Starting a hardware reset...');
            self._resetting = true;

            if (self._nvChanged && startupOption !== 0x02)
                nvParams.startupOption.value[0] = 0x02;

            var steps = [
                function () { return self.request('SYS', 'resetReq', { type: 0x01 }).delay(0); },
                function () { return self.request('SAPI', 'writeConfiguration', nvParams.startupOption).delay(10); },
                function () { return self.request('SYS', 'resetReq', { type: 0x01 }).delay(10); },
                function () { return self.request('SAPI', 'writeConfiguration', nvParams.panId).delay(10); },
                function () { return self.request('SAPI', 'writeConfiguration', nvParams.extPanId).delay(10); },
                function () { return self.request('SAPI', 'writeConfiguration', nvParams.channelList).delay(10); },
                function () { return self.request('SAPI', 'writeConfiguration', nvParams.logicalType).delay(10); },
                function () { return self.request('SAPI', 'writeConfiguration', nvParams.precfgkey).delay(10); },
                function () { return self.request('SAPI', 'writeConfiguration', nvParams.precfgkeysEnable).delay(10); },
                function () { return self.request('SYS', 'osalNvWrite', nvParams.securityMode).delay(10); },
                function () { return self.request('SAPI', 'writeConfiguration', nvParams.zdoDirectCb).delay(10); },
                function () { return self.request('SYS', 'osalNvItemInit', nvParams.znpCfgItem).delay(10).fail(function (err) {
                    return (err.message === 'rsp error: 9') ? null : Q.reject(err);  // Success, item created and initialized
                }); },
                function () { return self.request('SYS', 'osalNvWrite', nvParams.znpHasConfigured).delay(10); }
            ];

            return steps.reduce(function (soFar, fn) {
                return soFar.then(fn);
            }, Q(0));
        } else {
            return Q.reject(new Error('Unknown reset mode.'));
        }
    }).then(function () {
        self._resetting = false;
        if (self._nvChanged) {
            nvParams.startupOption.value[0] = startupOption;
            self._nvChanged = false;
            deferred.resolve();
        } else {
            self.once('_reset', function (err) {
                return err ? deferred.reject(err) : deferred.resolve();
            });
            self.emit('SYS:resetInd', '_reset');
        }
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

Controller.prototype.request = function (subsys, cmdId, valObj, callback) {
    var deferred = Q.defer(),
        rspHdlr;

    proving.stringOrNumber(subsys, 'subsys should be a number or a string.');
    proving.stringOrNumber(cmdId, 'cmdId should be a number or a string.');

    if (!_.isPlainObject(valObj) && !_.isArray(valObj))
        throw new TypeError('valObj should be an object or an array.');

    if (_.isString(subsys))
        subsys = subsys.toUpperCase();

    rspHdlr = function (err, rsp) {
        if (subsys !== 'ZDO' && subsys !== 5) {
            if (rsp && rsp.hasOwnProperty('status'))
                debug.request('RSP <-- %s, status: %d', subsys + ':' + cmdId, rsp.status);
            else
                debug.request('RSP <-- %s', subsys + ':' + cmdId);
        }

        if (err)
            deferred.reject(err);
        else if ((subsys !== 'ZDO' && subsys !== 5) && rsp && rsp.hasOwnProperty('status') && rsp.status !== 0)  // unsuccessful
            deferred.reject(new Error('rsp error: ' + rsp.status));
        else
            deferred.resolve(rsp);
    };

    if ((subsys === 'AF' || subsys === 4) && valObj.hasOwnProperty('transid'))
        debug.request('REQ --> %s, transId: %d', subsys + ':' + cmdId, valObj.transid);
    else
        debug.request('REQ --> %s', subsys + ':' + cmdId);

    if (subsys === 'ZDO' || subsys === 5)
        this._zdo.request(cmdId, valObj, rspHdlr);          // use wrapped zdo as the exported api
    else
        this._znp.request(subsys, cmdId, valObj, rspHdlr);  // SREQ has timeout inside znp

    return deferred.promise.nodeify(callback);
};

Controller.prototype.permitJoin = function (time, type, callback) {
    // time: seconds, 0x00 disable, 0xFF always enable
    // type: 0 (coord) / 1 (all)
    var self = this,
        addrmode,
        dstaddr;

    proving.number(time, 'time should be a number.');
    proving.stringOrNumber(type, 'type should be a number or a string.');

    return Q.fcall(function () {
        if (type === 0 || type === 'coord') {
            addrmode = 0x02;
            dstaddr = 0x0000;
        } else if (type === 1 || type === 'all') {
            addrmode = 0x0F;
            dstaddr = 0xFFFC;   // all coord and routers
        } else {
            return Q.reject(new Error('Not a valid type.'));
        }
    }).then(function () {
        if (time > 255 || time < 0)
            return Q.reject(new Error('Jointime can only range from  0 to 255.'));
        else
            self._permitJoinTime = Math.floor(time);
    }).then(function () {
        return self.request('ZDO', 'mgmtPermitJoinReq', { addrmode: addrmode, dstaddr: dstaddr , duration: time, tcsignificance: 0 });
    }).then(function (rsp) {
        self.emit('permitJoining', self._permitJoinTime);

        if (time !== 0 && time !== 255) {
            var timeDownCounter = setInterval(function () {
                if (self.permitJoinCountdown() === 0)
                    clearInterval(timeDownCounter);
                self.emit('permitJoining', self._permitJoinTime);
            }, 1000);
        }
       return rsp;
    }).nodeify(callback);
};

Controller.prototype.remove = function (dev, cfg, callback) {
    // cfg: { reJoin, rmChildren }
    var self = this,
        reqArgObj,
        rmChildren_reJoin = 0x00;

    if (!(dev instanceof Device))
        throw new TypeError('dev should be an instance of Device class.');
    else if (!_.isPlainObject(cfg))
        throw new TypeError('cfg should be an object.');

    cfg.reJoin = cfg.hasOwnProperty('reJoin') ? !!cfg.reJoin : true;               // defaults to true
    cfg.rmChildren = cfg.hasOwnProperty('rmChildren') ? !!cfg.rmChildren : false;  // defaults to false

    rmChildren_reJoin = cfg.reJoin ? (rmChildren_reJoin | 0x01) : rmChildren_reJoin;
    rmChildren_reJoin = cfg.rmChildren ? (rmChildren_reJoin | 0x02) : rmChildren_reJoin;

    reqArgObj = {
        dstaddr: dev.getNwkAddr(),
        deviceaddress: dev.getIeeeAddr(),
        removechildren_rejoin: rmChildren_reJoin
    };

    return this.request('ZDO', 'mgmtLeaveReq', reqArgObj).then(function (rsp) {
        if (rsp.status !== 0 && rsp.status !== 'SUCCESS')
            return Q.reject(rsp.status);
    }).nodeify(callback);
};

Controller.prototype.registerEp = function (loEp, callback) {
    var self = this;

    if (!(loEp instanceof Coordpoint))
        throw new TypeError('loEp should be an instance of Coordpoint class.');

    return this.request('AF', 'register', makeRegParams(loEp)).then(function (rsp) {
        return rsp;
    }).fail(function (err) {
        return (err.message === 'rsp error: 184') ? self.reRegisterEp(loEp) : Q.reject(err);
    }).nodeify(callback);
};

Controller.prototype.deregisterEp = function (loEp, callback) {
    var self = this,
        coordEps = this.getCoord().endpoints;

    if (!(loEp instanceof Coordpoint))
        throw new TypeError('loEp should be an instance of Coordpoint class.');

    return Q.fcall(function () {
        if (!_.includes(coordEps, loEp))
            return Q.reject(new Error('Endpoint not maintained by Coordinator, cannot be removed.'));
        else
            return self.request('AF', 'delete', { endpoint: loEp.getEpId() });
    }).then(function (rsp) {
        delete coordEps[loEp.getEpId()];
        return rsp;
    }).nodeify(callback);
};

Controller.prototype.reRegisterEp = function (loEp, callback) {
    var self = this;

    return this.deregisterEp(loEp).then(function () {
        return self.request('AF', 'register', makeRegParams(loEp));
    }).nodeify(callback);
};

Controller.prototype.simpleDescReq = function (nwkAddr, ieeeAddr, callback) {
    return this.querie.deviceWithEndpoints(nwkAddr, ieeeAddr, callback);
};

Controller.prototype.bind = function (srcEp, cId, dstEpOrGrpId, callback) {
    return this.querie.setBindingEntry('bind', srcEp, cId, dstEpOrGrpId, callback);
};

Controller.prototype.unbind = function (srcEp, cId, dstEpOrGrpId, callback) {
    return this.querie.setBindingEntry('unbind', srcEp, cId, dstEpOrGrpId, callback);
};

Controller.prototype.findEndpoint = function (addr, epId) {
    return this.getShepherd().find(addr, epId);
};

Controller.prototype.setNvParams = function (net) {
    // net: { panId, channelList, precfgkey, precfgkeysEnable, startoptClearState }
    net = net || {};
    proving.object(net, 'opts.net should be an object.');

    _.forEach(net, function (val, param) {
        switch (param) {
            case 'panId':
                proving.number(val, 'net.panId should be a number.');
                nvParams.panId.value = [ val & 0xFF, (val >> 8) & 0xFF ];
                break;
            case 'precfgkey':
                if (!_.isArray(val) || val.length !== 16)
                    throw new TypeError('net.precfgkey should be an array with 16 uint8 integers.');
                nvParams.precfgkey.value = val;
                break;
            case 'precfgkeysEnable':
                proving.boolean(val, 'net.precfgkeysEnable should be a bool.');
                nvParams.precfgkeysEnable.value = val ? [ 0x01 ] : [ 0x00 ];
                break;
            case 'startoptClearState':
                proving.boolean(val, 'net.startoptClearState should be a bool.');
                nvParams.startupOption.value = val ? [ 0x02 ] : [ 0x00 ];
                break;
            case 'channelList':
                proving.array(val, 'net.channelList should be an array.');
                var chList = 0;

                _.forEach(val, function (ch) {
                    if (ch >= 11 && ch <= 26)
                        chList = chList | ZSC.ZDO.channelMask['CH' + ch];
                });

                nvParams.channelList.value = [ chList & 0xFF, (chList >> 8) & 0xFF, (chList >> 16) & 0xFF, (chList >> 24) & 0xFF ];
                break;
            default:
                throw new TypeError('Unkown argument: ' + param + '.');
        }
    });
};

Controller.prototype.checkNvParams = function (callback) {
    var self = this,
        steps;

    function bufToArray(buf) {
        var arr = [];

        for (var i = 0; i < buf.length; i += 1) {
            arr.push(buf.readUInt8(i));
        }

        return arr;
    }

    steps = [
        function () { return self.request('SYS', 'osalNvRead', nvParams.znpHasConfigured).delay(10).then(function (rsp) {
            if (!_.isEqual(bufToArray(rsp.value), nvParams.znpHasConfigured.value)) return Q.reject('reset');
        }); },
        function () { return self.request('SAPI', 'readConfiguration', nvParams.panId).delay(10).then(function (rsp) {
            if (!_.isEqual(bufToArray(rsp.value), nvParams.panId.value)) return Q.reject('reset');
        }); },
        function () { return self.request('SAPI', 'readConfiguration', nvParams.channelList).delay(10).then(function (rsp) {
            if (!_.isEqual(bufToArray(rsp.value), nvParams.channelList.value)) return Q.reject('reset');
        }); },
        function () { return self.request('SAPI', 'readConfiguration', nvParams.precfgkey).delay(10).then(function (rsp) {
            if (!_.isEqual(bufToArray(rsp.value), nvParams.precfgkey.value)) return Q.reject('reset');
        }); },
        function () { return self.request('SAPI', 'readConfiguration', nvParams.precfgkeysEnable).delay(10).then(function (rsp) {
            if (!_.isEqual(bufToArray(rsp.value), nvParams.precfgkeysEnable.value)) return Q.reject('reset');
        }); }
    ];

    return steps.reduce(function (soFar, fn) {
        return soFar.then(fn);
    }, Q(0)).fail(function (err) {
        if (err === 'reset' || err.message === 'rsp error: 2') {
            self._nvChanged = true;
            debug.init('Non-Volatile memory is changed.');
            return self.reset('hard');
        } else {
            return Q.reject(err);
        }
    }).nodeify(callback);
};

Controller.prototype.checkOnline = function (dev, callback) {
    var self = this,
        nwkAddr = dev.getNwkAddr(),
        ieeeAddr = dev.getIeeeAddr();

    this.request('ZDO', 'nodeDescReq', { dstaddr: nwkAddr, nwkaddrofinterest: nwkAddr }).timeout(5000).fail(function () {
        return self.request('ZDO', 'nodeDescReq', { dstaddr: nwkAddr, nwkaddrofinterest: nwkAddr }).timeout(5000);
    }).then(function () {
        if (dev.status === 'offline')
            self.emit('ZDO:endDeviceAnnceInd', { srcaddr: nwkAddr, nwkaddr: nwkAddr, ieeeaddr: ieeeAddr, capabilities: {} });
    }).fail(function () {
        return;
    }).done();
};

Controller.prototype.endDeviceAnnceHdlr = function (data) {
    var self = this,
        joinTimeout,
        joinEvent = 'ind:incoming' + ':' + data.ieeeaddr,
        dev = this.getShepherd()._findDevByAddr(data.ieeeaddr);

    if (dev && dev.status === 'online')
        return;

    joinTimeout = setTimeout(function () {
        if (self.listenerCount(joinEvent))
            self.emit(joinEvent, '__timeout__');

        joinTimeout = null;
    }, 30000);

    this.once(joinEvent, function () {
        self._spinLock = false;

        if (joinTimeout) {
            clearTimeout(joinTimeout);
            joinTimeout = null;
        }

        if (self._joinQueue.length) {
            var func = self._joinQueue.shift();

            if (func)
                setImmediate(function () {
                    func();
                });
        }
    });

    this.simpleDescReq(data.nwkaddr, data.ieeeaddr).then(function (devInfo) {
        return devInfo;
    }).fail(function () {
        return self.simpleDescReq(data.nwkaddr, data.ieeeaddr);
    }).then(function (devInfo) {
        self.emit('ZDO:devIncoming', devInfo);
    }).fail(function () {
        self.getShepherd().emit('error', 'Cannot get the Node Descriptor of the Device: ' + data.ieeeaddr);
    }).done();
};

/*************************************************************************************************/
/*** Private Functions                                                                         ***/
/*************************************************************************************************/
function makeRegParams(loEp) {
    return {
        endpoint: loEp.getEpId(),
        appprofid: loEp.getProfId(),
        appdeviceid: loEp.getDevId(),
        appdevver: 0,
        latencyreq: ZSC.AF.networkLatencyReq.NO_LATENCY_REQS,
        appnuminclusters: loEp.inClusterList.length,
        appinclusterlist: loEp.inClusterList,
        appnumoutclusters: loEp.outClusterList.length,
        appoutclusterlist: loEp.outClusterList
    };
}

module.exports = Controller;
