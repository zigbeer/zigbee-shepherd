/* jshint node: true */
'use strict';

var util = require('util'),
    EventEmitter = require('events');

var Q = require('q'),
    _ = require('busyman'),
    znp = require('cc-znp'),
    ZSC = require('zstack-constants');

var Zdo = require('./zdo'),
    querie = require('./querie'),
    bridge = require('./event_bridge.js'),
    nvParams = require('../config/nv_start_options.js'),    // CONSTANTS
    initController = require('../initializers/init_controller');

var Device = require('../model/device'),
    Coordpoint = require('../model/coordpoint');

function Controller(shepherd, cfg) {    // cfg is serial port config
    EventEmitter.call(this);

    var self = this,
        transId = 0,
        permitJoinTime = 0;

    if (!_.isPlainObject(cfg))
        throw new TypeError('cfg should be an object.');

    this.initCoord = initController(this).initCoord;

    this._shepherd = shepherd;
    this._coord = null;
    this._znp = znp;
    this._zdo = new Zdo(this);
    this._cfg = cfg;
    this._resetting = false;    // reset flag
    this._spinLock = false;
    this._joinQueue = [];

    this.querie = querie(this);

    this._net = {
        state: null,
        channel: null,
        panId: null,
        extPanId: null,
        ieeeAddr: null,
        nwkAddr: 0,
        joinTimeLeft: 0
    };

    /*********************************************************************/
    /*** Privileged Methods                                            ***/
    /*********************************************************************/
    this.nextTransId = function () {    // zigbee transection id
        if (++transId > 255)
            transId = 1;
        return transId;
    };

    this.setPermitJoinTime = function (time) {
        permitJoinTime = time;
        return permitJoinTime;
    };
    this.getPermitJoinTime = function () {
        return permitJoinTime;
    };
    this.joinTimeCountdown = function () {
        permitJoinTime = permitJoinTime > 0 ? permitJoinTime - 1 : 0;
        return permitJoinTime;
    };

    this._isRsetting = function () {
        return self._resetting;
    };

    /*********************************************************************/
    /***Event Bridges                                                  ***/
    /*********************************************************************/
    this._znp.on('ready', function () {
        self.initCoord().then(function () {
            // all ok, check online running
            // if (!appload) => load all apps    [TODO] should load app at shepherd level
            self.emit('ZNP:INIT');
        }).fail(function (err) {
            console.log('Coord Initialize error: ');
            console.log(err);
            self.emit('ZNP:INIT:FAIL');
        }).done();
    });

    this._znp.on('close', function () {
        self.emit('ZNP:CLOSE');
    });

    this._znp.on('AREQ', function (msg) {//console.log(msg);
        bridge._areqEventBridge(self, msg);
    });

    /*********************************************************************/
    /***Event Listener                                                 ***/
    /*********************************************************************/
    this.on('ZDO:endDeviceAnnceInd', function (data) {
        if (self._spinLock) {
            self._joinQueue.push(function () {
                self._endDeviceAnnceHdlr(data);
            });
            return;
        }

        self._spinLock = true;

        self._endDeviceAnnceHdlr(data);
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

Controller.prototype.getNwkInfo = function () {
    var net = _.cloneDeep(this._net);

    if (net.state === ZSC.ZDO.devStates.ZB_COORD)
        net.state = 'Coordinator';

    net.joinTimeLeft = this.getPermitJoinTime();

    return net;
};

Controller.prototype.setNetInfo = function (nwkInfo) {
    var self = this;

    if (!_.isPlainObject(nwkInfo))
        throw new TypeError('nwkInfo should be an object');

    _.forEach(this._net, function (val, key) {
        if (_.has(nwkInfo, key))
            self._net[key] = nwkInfo[key];
    });

    return this;
};

/*************************************************************************************************/
/*** Mandatory Public APIs                                                                     ***/
/*************************************************************************************************/
Controller.prototype.start = function (callback) {
    var deferred = Q.defer(),
        self = this,
        cfg = this._cfg,
        readyLsn;

    if (!cfg.hasOwnProperty('options'))
        cfg.options = { baudrate: 115200, rtscts: true };

    readyLsn = function () {
        deferred.resolve();
    };

    this.once('ZNP:INIT', readyLsn);

    this._znp.init(cfg, function (err) {
        if (err) {
            self.removeListener('ZNP:INIT', readyLsn);
            deferred.reject(err);
        }
    });

    return deferred.promise.nodeify(callback);
};

Controller.prototype.close = function (callback) {
    var deferred = Q.defer(),
        closeLsn;

    closeLsn = function () {
        deferred.resolve();
    };

    this.once('ZNP:CLOSE', closeLsn);

    this._znp.close(function (err) {
        if (err)
            deferred.reject(err);
    });

    return deferred.promise.nodeify(callback);
};

Controller.prototype.reset = function (mode, callback) {
    var self = this,
        deferred = Q.defer(),
        reqChain,
        steps;

    if ((!_.isNumber(mode) || _.isNaN(mode)) && !_.isString(mode))
        throw new TypeError('mode should be a number or a string.');

    if (mode === 'soft' || mode === 1) {
        this._resetting = true;

        this.request('SYS', 'resetReq', { type: 0x01 }).done(function () {
            self._resetting = false;
            self.emit('SYS:resetInd', 'soft');    // soft reset done.
            deferred.resolve();
        }, function (err) {
            deferred.reject(err);
        });
    } else if (mode === 'hard' || mode === 0) {
        console.log('Starting a hardware reset.');
        this._resetting = true;

        steps = [
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
         // function () { return self.request('ZDO', 'startupFromApp', { startdelay: 0 }).delay(10); },
            function () { return self.request('SYS', 'osalNvItemInit', nvParams.znpCfgItem).delay(10); },
            function () { return self.request('SYS', 'osalNvWrite', nvParams.znpHasConfigured).delay(10); }
        ];

        steps.reduce(function (soFar, fn) {
            return soFar.then(fn);
        }, Q(0)).then(function () {
            self._resetting = false;

            if (self._nvChanged) {
                self._nvChanged = null;
                delete self._nvChanged;
            } else {
                self.emit('SYS:resetInd', 'hard');    // hard reset done.
            }

            deferred.resolve();
        }).fail(function (err) {
            deferred.reject(err);
        }).done();
    } else {
        deferred.reject(new Error('Unknown reset mode.'));
    }

    return deferred.promise.nodeify(callback);
};

Controller.prototype.request = function (subsys, cmdId, valObj, callback) {
    var deferred = Q.defer(),
        rspHdlr;
// console.log(subsys + ':' + cmdId);console.log(valObj);
    if ((!_.isNumber(subsys) || _.isNaN(subsys)) && !_.isString(subsys))
        throw new TypeError('subsys should be a number or a string.');

    if ((!_.isNumber(cmdId) || _.isNaN(cmdId)) && !_.isString(cmdId))
        throw new TypeError('cmdId should be a number or a string.');

    if (!_.isPlainObject(valObj) && !_.isArray(valObj))
        throw new TypeError('valObj should be an object or an array.');

    if (_.isString(subsys))
        subsys = subsys.toUpperCase();

    rspHdlr = function (err, rsp) {
        if (err)
            deferred.reject(err);
        else if (!(subsys === 'ZDO' || subsys === 5) && rsp && rsp.hasOwnProperty('status') && rsp.status !== 0)   // unsuccessful
            deferred.reject(new Error('rsp error: ' + rsp.status));
        else
            deferred.resolve(rsp);
    };

    if (subsys === 'ZDO' || subsys === 5)
        this._zdo.request(cmdId, valObj, rspHdlr);          // use wrapped zdo as the exported api
    else
        this._znp.request(subsys, cmdId, valObj, rspHdlr);  // SREQ has timeout inside znp

    return deferred.promise.nodeify(callback);
};

Controller.prototype.permitJoin = function (joinTime, joinType, callback) {
    // joinTime: seconds, 0 disable, 0xFF always enable
    // joinType: 0 (coord)/ 1 (all)

    var self = this,
        deferred = Q.defer(),
        addrmode,
        dstaddr,
        joinTimeDownCounter;

    if ((!_.isNumber(joinType) || _.isNaN(joinType)) && !_.isString(joinType))
        throw new TypeError('joinType should be a number or a string.');

    if (!_.isNumber(joinTime) || _.isNaN(joinTime))
        throw new TypeError('joinTime should be a number.');

    if (joinType === 0 || 'coord') {
        addrmode = 0x02;
        dstaddr = 0x0000;
    } else if (joinType === 1 || 'all') {
        addrmode = 0xFF;
        dstaddr = 0xFFFC;   // all coord and routers
    } else {
        deferred.reject(new Error('Not a valid joinType.'));
    }

    if (joinTime > 255 || joinTime < 0)
        deferred.reject(new Error('Jointime can only range from  0 to 255.'));

    this.setPermitJoinTime(joinTime);

    this.request('ZDO', 'mgmtPermitJoinReq', {
        addrmode: addrmode,
        dstaddr: dstaddr ,
        duration: joinTime,
        tcsignificance: 0
    }).then(function (result) {
        if (joinTime === 0 || joinTime === 255) {
            self.emit('permitJoining', joinTime);
        } else {
            self.emit('permitJoining', self.getPermitJoinTime());
            joinTimeDownCounter = setInterval(function () {
                if (0 === self.joinTimeCountdown())
                    clearInterval(joinTimeDownCounter);
                self.emit('permitJoining', self.getPermitJoinTime());
            }, 1000);
        }
       deferred.resolve(result);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

Controller.prototype.simpleDescReq = function (nwkAddr, ieeeAddr, callback) {
    return this.querie.deviceWithEndpoints(nwkAddr, ieeeAddr, callback);
}; 

Controller.prototype.registerEp = function (loEp, callback) {
    var self = this,
        deferred = Q.defer(),
        reqArgObj;

    if (!(loEp instanceof Coordpoint))
        throw new TypeError('loEp should be an instance of Coordpoint class.');

    reqArgObj = {
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

    this.request('AF', 'register', reqArgObj).then(function (rsp) {
        deferred.resolve(rsp);
    }).fail(function (err) {
        if (err.message === 'rsp error: 184')
            return self.reRegisterEp(loEp);
        else 
            return err;
    }).done(function (rsp) {
        if (rsp instanceof Error)
            deferred.reject(rsp);
        else
            deferred.resolve(rsp);
    }, function (err) {
        deferred.reject(err);
    });

    return deferred.promise.nodeify(callback);
};

Controller.prototype.deregisterEp = function (loEp, callback) {
    var deferred = Q.defer(),
        coordEps = this.getCoord().endpoints;

    if (!(loEp instanceof Coordpoint))
        throw new TypeError('loEp should be an instance of Coordpoint class.');

    if (!_.includes(coordEps, loEp))
        deferred.reject(new Error('Endpoind not maintained by Coordinator, cannot be removed.'));
    else
        this.request('AF', 'delete', { endpoint: loEp.getEpId() }).done(function (rsp) {
            delete coordEps[loEp.getEpId()];
            deferred.resolve(rsp);
        }, function (err) {
            deferred.reject(err);
        });

    return deferred.promise.nodeify(callback);
};

Controller.prototype.reRegisterEp = function (loEp, callback) {
    var self = this,
        deferred = Q.defer(),
        reqArgObj;

    if (!(loEp instanceof Coordpoint))
        throw new TypeError('loEp should be an instance of Coordpoint class.');

    reqArgObj = {
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

    if (!_.includes(this.getCoord().endpoints, loEp))
        deferred.reject(new Error('Endpoind not maintained by Coordinator, cannot be re-register.'));
    else
        this.request('AF', 'delete', { endpoint: loEp.getEpId() }).then(function () {
            return self.request('AF', 'register', reqArgObj);
        }).done(function (rsp) {
            deferred.resolve(rsp);
        }, function (err) {
            deferred.reject(err);
        });

    return deferred.promise.nodeify(callback);
};

Controller.prototype.bind = function (srcEp, cId, dstEpOrGrpId, callback) {
    return this.querie.setBindingEntry('bind', srcEp, cId, dstEpOrGrpId, callback);
};

Controller.prototype.unbind = function (srcEp, cId, dstEpOrGrpId, callback) {
    return this.querie.setBindingEntry('unbind', srcEp, cId, dstEpOrGrpId, callback);
};

Controller.prototype.findEndpoint = function (addr, epId) {
    return this.getShepherd()._findEndpoint(addr, epId);
};

Controller.prototype.remove = function (dev, cfg, callback) {
    // cfg: { reJoin, rmChildren }
    var self = this,
        deferred = Q.defer(),
        reqArgObj;

    if (!(dev instanceof Device))
        throw new TypeError('dev should be an instance of Device class.');

    if (!_.isPlainObject(cfg))
        throw new TypeError('cfg should be an object.');

    if (cfg.hasOwnProperty('reJoin') && !_.isBoolean(cfg.reJoin))
        throw new TypeError('cfg.reJoin should be a boolean.');

    if (cfg.hasOwnProperty('rmChildren') && !_.isBoolean(cfg.rmChildren))
        throw new TypeError('cfg.rmChildren should be a boolean.');

    reqArgObj = {
        dstaddr: dev.getNwkAddr(),
        deviceaddress: dev.getIeeeAddr(),
        removechildren_rejoin: 0
    };

    if (_.isFunction(cfg)) {
        if (!_.isFunction(callback)) {
            callback = cfg;
            cfg = {};
        }
    } else {
        cfg = cfg || {};
    }

    cfg.reJoin = cfg.hasOwnProperty('reJoin') ? cfg.reJoin : true;                 // defaults to true
    cfg.rmChildren = cfg.hasOwnProperty('rmChildren') ? cfg.rmChildren : false;    // defaults to false

    reqArgObj.removechildren_rejoin = cfg.reJoin ? (reqArgObj.removechildren_rejoin | 0x01) : reqArgObj.removechildren_rejoin;
    reqArgObj.removechildren_rejoin = cfg.rmChildren ? (reqArgObj.removechildren_rejoin | 0x02) : reqArgObj.removechildren_rejoin;

    this.request('ZDO', 'mgmtLeaveReq', reqArgObj).then(function (rsp) {
        // rsp: { srcaddr, status }
        if (rsp.status === 0 || rsp.status === 'SUCCESS')
            deferred.resolve();
        else
            deferred.reject(rsp.status);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

Controller.prototype._checkOnline = function (dev, callback) {
    var self = this,
        deferred = Q.defer(),
        nwkAddr = dev.getNwkAddr(),
        ieeeAddr = dev.getIeeeAddr();

    this.request('ZDO', 'nodeDescReq', { dstaddr: nwkAddr, nwkaddrofinterest: nwkAddr }).timeout(5000).then(function (rsp) {
        // rsp: { srcaddr, status, nwkaddr, logicaltype_cmplxdescavai_userdescavai, ..., manufacturercode, ... }
        return rsp;
    }).fail(function () {
        return self.request('ZDO', 'nodeDescReq', { dstaddr: nwkAddr, nwkaddrofinterest: nwkAddr }).timeout(5000);
    }).then(function () {
        if (dev.status === 'offline')
            self.emit('ZDO:endDeviceAnnceInd', { srcaddr: nwkAddr, nwkaddr: nwkAddr, ieeeaddr: ieeeAddr, capabilities: {} });
        deferred.resolve();
    }).fail(function () {
        deferred.resolve();
    }).done();

    return deferred.promise.nodeify(callback);
};

Controller.prototype.setNvParams = function (net) {
    // net: { panId, channelList, precfgkey, precfgkeysEnable }

    if (!_.isPlainObject(net))
        throw new TypeError('opts.net should be an object.');

    _.forEach(net, function (val, param) {
        switch (param) {
            case 'panId':
                nvParams.panId.value = [val & 0xFF, (val >> 8) & 0xFF];
                break;
            case 'precfgkey':
                nvParams.precfgkey.value = val;
                break;
            case 'precfgkeysEnable':
                nvParams.precfgkeysEnable.value = val ? [0x01] : [0x00];
                break;
            case 'startoptClearState':
                nvParams.startupOption.value = val ? [0x03] : [0x02];
                break;
            case 'channelList':
                var chList = 0;

                val.forEach(function (ch) {
                    var channel = 'CH' + ch;
                    chList = chList | ZSC.ZDO.channelMask[channel];
                });

                nvParams.channelList.value = [chList & 0xFF, (chList >> 8) & 0xFF, (chList >> 16) & 0xFF, (chList >> 24) & 0xFF];
                break;
            default:
                break;
        }
    });
};

Controller.prototype.checkNvParams = function (callback) {
    var self = this,
        deferred = Q.defer(),
        needReset = false,
        steps;

    steps = [
        function () { return self.request('SYS', 'osalNvRead', nvParams.znpHasConfigured).delay(10).then(function (rsp) {
            if (!_.isEqual(bufToArray(rsp.value), nvParams.znpHasConfigured.value))
                needReset = true;
        }); },
        function () { return self.request('SAPI', 'readConfiguration', nvParams.panId).delay(10).then(function (rsp) {
            if (!_.isEqual(bufToArray(rsp.value), nvParams.panId.value))
                needReset = true;
        }); },
        function () { return self.request('SAPI', 'readConfiguration', nvParams.channelList).delay(10).then(function (rsp) {
            if (!_.isEqual(bufToArray(rsp.value), nvParams.channelList.value))
                needReset = true;
        }); },
        function () { return self.request('SAPI', 'readConfiguration', nvParams.precfgkey).delay(10).then(function (rsp) {
            if (!_.isEqual(bufToArray(rsp.value), nvParams.precfgkey.value))
                needReset = true;
        }); },
        function () { return self.request('SAPI', 'readConfiguration', nvParams.precfgkeysEnable).delay(10).then(function (rsp) {
            if (!_.isEqual(bufToArray(rsp.value), nvParams.precfgkeysEnable.value))
                needReset = true;
        }); }
    ];

    steps.reduce(function (soFar, fn) {
        return soFar.then(fn);
    }, Q(0)).then(function () {
        if (needReset) {
            self._nvChanged = true;
            console.log('nvParams is changed.');
            return self.reset('hard');
        } else {
            deferred.resolve();
        }
    }).then(function () {
        deferred.resolve();
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

Controller.prototype._endDeviceAnnceHdlr = function (data) {
    var self = this,
        joinTimeout,
        joinEvt = 'ind:incoming' + data.ieeeaddr,
        dev = this.getShepherd()._findDevByAddr(data.ieeeaddr);

    if (dev && dev.status === 'online')
        return;

    joinTimeout = setTimeout(function () {
        if (self.listenerCount(joinEvt))
            self.emit(joinEvt, '__timeout__');

        joinTimeout = null;
    }, 30000);

    this.once(joinEvt, function () {
        self._spinLock = false;

        // clear timeout controller if it is there
        if (joinTimeout) {
            clearTimeout(joinTimeout);
            joinTimeout = null;
        }

        if (self._joinQueue.length) {
            process.nextTick(function () {
                self._joinQueue.shift()();
            });
        }
    });

    this.simpleDescReq(data.nwkaddr, data.ieeeaddr).then(function (devInfo) {
        return devInfo;
    }).fail(function () {
        return self.simpleDescReq(data.nwkaddr, data.ieeeaddr);
    }).then(function (devInfo) {
        self.emit('ZDO:devIncoming', devInfo);
    }).fail(function (err) {
        console.log(err);
    }).done();
};

function bufToArray(buf) {
    var i,
        arr = [];

    for (i = 0; i < buf.length; i += 1) {
        arr.push(buf.readUInt8(i));
    }

    return arr;
}

module.exports = Controller;
