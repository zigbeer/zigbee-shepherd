/* jshint node: true */
'use strict';

var EventEmitter = require('events'),
    util = require('util'),
    Q = require('q'),
    _ = require('busyman'),
    znp = require('cc-znp'),
    ZDEF = require('zstack-constants'),
    Zdo = require('./zdo'),
    bridge = require('./event_bridge.js'),
    querie = require('./querie'),
    initController = require('../initializers/init_controller');

// CONSTANTS
var nvParams = require('./config/nv_start_options.js'),
    AREQ_TIMEOUT = 30;  // seconds;

function Controller(shepherd, cfg) {    // cfg is serial port config
    EventEmitter.call(this);

    var self = this,
        transId = 0,
        permitJoinTime = 0;

    this._znp = znp;
    this._zdo = new Zdo(this);
    this._shepherd = shepherd;
    this._coord = null;
    this._cfg = cfg;
    this.querie = querie(this);

    this._net = {
        state: null,            // ZDEF.COMMON.DEV_STATES
        channel: null,
        panId: null,
        extPanId: null,
        ieeeAddr: null,
        nwkAddr: 0,
        permitRemainingTime: this.getPermitJoinTime(),
        numPendingAttribs: 0
    };

    /*********************************************************************/
    /*** Facility                                                      ***/
    /*********************************************************************/
    this._areqCallbacks = {};
    this._areqTimeouts = {};

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

    /*********************************************************************/
    /***Event Bridges                                                  ***/
    /*********************************************************************/
    this._znp.on('ready', function () {
        self._initCoordinator().then(function () {
            // all ok, check online running
            // if (!appload) => load all apps    [TODO] should load app at shepherd level
            self.emit('ZNP:INIT');
        }).fail(function (err) {
            self.emit('ZNP:INIT:FAIL');
        }).done();
    });

    this._znp.on('AREQ', function (msg) {
        bridge._areqEventBridge(self, msg);
    });

    /*********************************************************************/
    /***Event Listener                                                 ***/
    /*********************************************************************/
    this.on('ZDO:endDeviceAnnceInd', function (data) {
        self.simpleDescReq(data.nwkaddr, data.ieeeaddr).done(function (devInfo) {
            self.emit('ZDO:devIncoming', devInfo);
        });
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
    return _.cloneDeep(this._net);
};

Controller.prototype.setNetInfo = function (nwkInfo) {
    if (!_.isPlainObject(nwkInfo))
        throw new TypeError('nwkInfo should be an object');

    _.forEach(this._net, function (val, key) {
        if (_.has(nwkInfo, key))
            this._net[key] = nwkInfo[key];
    });

    return this;
};

/*************************************************************************************************/
/*** Mandatory Public APIs                                                                     ***/
/*************************************************************************************************/
Controller.prototype.start = function (callback) {
    var deferred = Q.defer,
        self = this,
        readyLsn;

    readyLsn = function () {
        deferred.resolve();
    };

    this.once('ZNP:INIT', readyLsn);  // event fired by _initCoordinator();

    this._znp.init(this._cfg, function (err) {
        if (err) {
            self.removeListener('ZNP:INIT', readyLsn);
            deferred.reject(err);
        }
    });

    return deferred.promise.nodeify(callback);
};

Controller.prototype.close = function (callback) {
    var deferred = Q.defer();

    this._znp.close(function (err) {
        if (err)
            deferred.reject(err);
        else
            deferred.resolve();
    });

    return deferred.promise.nodeify(callback);
};

Controller.prototype.reset = function (mode, callback) {
    var self = this,
        deferred = Q.defer(),
        reqChain,
        steps;

    if (mode === 'soft' || mode === 1) {
        return this.request('SYS', 'resetReq', { type: 0x01 }, function (err) {
            if (err)
                deferred.reject(err);
            else
                deferred.resolve();
        });
    } else if (mode === 'hard' || mode === 0) {
        steps = [
            function () { return self.request('SYS', 'resetReq', { type: 0x00 }).delay(0); },
            function () { return self.request('SAPI', 'writeConfiguration', nvParams.startupOption).delay(4000); },
            function () { return self.request('SYS', 'resetReq', { type: 0x00 }).delay(10); },
            function () { return self.request('SAPI', 'writeConfiguration', nvParams.panId).delay(5000); },
            function () { return self.request('SAPI', 'writeConfiguration', nvParams.extPanId).delay(10); },
            function () { return self.request('SAPI', 'writeConfiguration', nvParams.channelList).delay(10); },
            function () { return self.request('SAPI', 'writeConfiguration', nvParams.logicalType).delay(10); },
            function () { return self.request('SAPI', 'writeConfiguration', nvParams.precfgkey).delay(10); },
            function () { return self.request('SAPI', 'writeConfiguration', nvParams.precfgkeysEnable).delay(10); },
            function () { return self.request('SYS', 'osalNvWrite', nvParams.securityMode).delay(10); },
         // function () { return self.request('AF', 'register', nvParams.afRegister).delay(10); },
            function () { return self.request('SAPI', 'writeConfiguration', nvParams.zdoDirectCb).delay(10); },
         // function () { return self.request('ZDO', 'startupFromApp', { startdelay: 0 }).delay(10); },
            function () { return self.request('SYS', 'osalNvItemInit', nvParams.znpCfgItem).delay(10); },
            function () { return self.request('SYS', 'osalNvWrite', nvParams.znpHasConfigured).delay(10); }
        ];

        reqChain = steps.reduce(function (soFar, fn) {
            return soFar.then(fn);
        }, Q(0));

        reqChain.then(function () {
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

    rspHdlr = function (err, rsp) {
        if (err)
            deferred.reject(err);
        else if (rsp && rsp.hasOwnProperty('status') && rsp.status !== 0)   // unsuccessful
            deferred.reject(new Error('rsp error: ' + rsp.status));
        else
            deferred.resolve(rsp);
    };

    if (subsys.toUpperCase() === 'ZDO' || subsys === 5)
        this._zdo.request(cmdId, valObj, rspHdlr);          // use wrapped zdo as the exported api
    else
        this._znp.request(subsys, cmdId, valObj, rspHdlr);  // SREQ has timeout inside znp

    return deferred.promise.nodeify(callback);
};

Controller.prototype.permitJoin = function (joinType, joinTime, callback) {
    // ZDO_MGMT_PERMIT_JOIN_REQ
    // joinType: 0 (coord)/ 1 (all)
    // joinTime: seconds, 0 disable, 0xFF always enable
    var self = this,
        deferred = Q.defer(),
        addrmode,
        dstaddr,
        joinTimeDownCounter;

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
        joinTimeDownCounter = setInterval(function () {
            if (0 === self.joinTimeCountdown())
                clearInterval(joinTimeDownCounter);
        }, 1000);
       deferred.resolve(result);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

Controller.prototype.simpleDescReq = function (nwkAddr, ieeeAddr, callback) {
    return this.querie.deviceWithEndpoints(ieeeAddr, nwkAddr, callback);
}; 

Controller.prototype.registerEp = function (loEp, callback) {
    var deferred = Q.defer(),
        reqArgObj = {
            endpoint: loEp.getEpId(),
            appprofid: loEp.getProfId(),
            appdeviceid: loEp.getDevId(),
            appdevver: 0,
            latencyreq: ZDEF.AF.networkLatencyReq.NO_LATENCY_REQS,
            appnuminclusters: loEp.inClusterList.length,
            appinclusterlist: loEp.inClusterList,
            appnumoutclusters: loEp.outClusterList.length,
            appoutclusterlist: loEp.outClusterList
        };

    this.request('AF', 'register', reqArgObj).done(function (rsp) {
        if (rsp.status !== 0) // unsuccessful
            deferred.reject(new Error('AfRegister error: ' + rsp.status));
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

    if (!_.find(coordEps, loEp))
        deferred.reject(new Error('Endpoind not maintained by Coordinator, cannot be removed.'));
    else
        this.request('AF', 'delete', { endpoint: loEp.getEpId() }).done(function (rsp) {
            if (rsp.status !== 0) // unsuccessful
                deferred.reject(new Error('AfDelete error: ' + rsp.status));
            else {
                delete coordEps[loEp.getEpId()];
                deferred.resolve(rsp);
            }
        }, function (err) {
            deferred.reject(err);
        });

    return deferred.promise.nodeify(callback);
};

Controller.prototype.reRegisterEndpoint = function (loEp, callback) {
    var self = this,
        deferred = Q.defer(),
        reqArgObj = {
            endpoint: loEp.getEpId(),
            appprofid: loEp.getProfId(),
            appdeviceid: loEp.getDevId(),
            appdevver: 0,
            latencyreq: ZDEF.AF.networkLatencyReq.NO_LATENCY_REQS,
            appnuminclusters: loEp.inClusterList.length,
            appinclusterlist: loEp.inClusterList,
            appnumoutclusters: loEp.outClusterList.length,
            appoutclusterlist: loEp.outClusterList
        };

    if (!_.find(this.getCoord().endpoints, loEp))
        deferred.reject(new Error('Endpoind not maintained by Coordinator, cannot be re-register.'));
    else
        this.request('AF', 'delete', { endpoint: loEp.getEpId() }).then(function () {
            return self.request('AF', 'register', reqArgObj);
        }).done(function (rsp) {
            if (rsp.status !== 0) // unsuccessful
                deferred.reject(new Error('AfRegister error: ' + rsp.status));
            else 
                deferred.resolve(rsp);
        }, function (err) {
            deferred.reject(err);
        });

    return deferred.promise.nodeify(callback);
};

Controller.prototype.bind = function (srcEp, dstEp, cId, callback) {
    return this.querie.setBindingEntry(0, srcEp, dstEp, cId, callback);
};

Controller.prototype.unbind = function (srcEp, dstEp, cId, callback) {
    return this.setBindingEntry(1, srcEp, dstEp, cId, callback);
};

/*************************************************************************************************/
/*** Protected Methods                                                                         ***/
/*************************************************************************************************/
Controller.prototype._registerAreqTimeout = function (evtKey) {
    var self = this,
        timeout;

    timeout = setTimeout(function () {
        self._invokeAreqCallback(evtKey, new Error('timeout'), null);
    }, AREQ_TIMEOUT * 1000);

    this._areqTimeouts[evtKey] = this._areqTimeouts[evtKey] || [];
    this._areqTimeouts[evtKey].push(timeout);
};

Controller.prototype._clearAreqTimeout = function (evtKey) {
    var timeouts = this._areqTimeouts[evtKey],
        timeout;

    if (!timeouts || (timeouts.length === 0))
        return;

    timeout = timeouts.shift();

    if (timeout)
        clearTimeout(timeout);

    if (timeouts.length === 0) {
        this._areqTimeouts[evtKey] = null;
        delete this._areqTimeouts[evtKey];
    }
};

Controller.prototype._registerAreqCallback = function (evtKey, cb) {
    // for those requests requiring AREQ coming back, should regitser its callback to controller
    this._areqCallbacks[evtKey] = this._areqCallbacks[evtKey] || [];
    this._areqCallbacks[evtKey].push(cb);
    this._registerAreqTimeout(evtKey);
};

Controller.prototype._invokeAreqCallback = function (evtKey, err, rsp) {
    var cbs = this._areqCallbacks[evtKey],
        cb;

    this._clearAreqTimeout(evtKey);

    if (!cbs || (cbs.length === 0))
        return;

    cb = cbs.shift();

    if (cbs.length === 0) {
        this._areqCallbacks[evtKey] = null;
        delete this._areqCallbacks[evtKey];
    }

    if (cb)
        cb(err, rsp);
};

module.exports = Controller;