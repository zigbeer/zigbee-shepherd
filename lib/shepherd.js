/* jshint node: true */
'use strict';

var util = require('util'),
    EventEmitter = require('events').EventEmitter;

var Q = require('q'),
    _ = require('busyman'),
    zclId = require('zcl-id'),
    ObjectBox = require('objectbox'),
    ZSC = require('zstack-constants');

var af = require('./components/af'),
    loader = require('./components/object_loader'),
    Controller = require('./components/controller'),
    initController = require('./initializers/init_controller');

var Device = require('./model/device'),
    Endpoint = require('./model/endpoint'),
    Coordinator = require('./model/coord'),
    Coordpoint = require('./model/coordpoint');

var devboxPath = __dirname + '/database/dev.db';

function ZShepherd(cfg) {
    EventEmitter.call(this);

    var self = this;

    this._devbox = new ObjectBox(devboxPath);       // db integration
    this.controller = new Controller(this, cfg);    // controller is the main actor
    initController = initController(this.controller);
    this.af = af(this.controller);

    this.app = null;

    this._innerHandlers = {
        resetIndHandler: function (msg) {
            self._resetIndHandler(msg);
        },
        devIncomingHandler: function (msg) {
            self._devIncomingHandler(msg);
        },
        tcDeviceIndHandler: function (msg) {
            self._tcDeviceIndHandler(msg);
        },
        stateChangeIndHandler: function (msg) {
            self._stateChangeIndHandler(msg);
        },
        matchDescRspSentHandler: function (msg) {
            self._matchDescRspSentHandler(msg);
        },
        statusErrorRspHandler: function (msg) {
            self._statusErrorRspHandler(msg);
        },
        srcRtgIndHandler: function (msg) {
            self._srcRtgIndHandler(msg);
        },
        beacon_notify_indHandler: function (msg) {
            self._beacon_notify_indHandler(msg);
        },
        leaveIndHandler: function (msg) {
            self._leaveIndHandler(msg);
        },
        msgCbIncomingHandler: function (msg) {
            self._msgCbIncomingHandler(msg);
        }
    };
}

util.inherits(ZShepherd, EventEmitter);

/*************************************************************************************************/
/*** Public Methods                                                                            ***/
/*************************************************************************************************/
ZShepherd.prototype.start = function (app, callback) {
    var self = this,
        deferred = Q.defer(),
        controller = this.controller;

    if (!_.isFunction(app))
        throw new TypeError('app should be a function.');

    var resetIndHandler = this._innerHandlers.resetIndHandler,
        devIncomingHandler = this._innerHandlers.devIncomingHandler,
        tcDeviceIndHandler = this._innerHandlers.tcDeviceIndHandler,
        stateChangeIndHandler = this._innerHandlers.stateChangeIndHandler,
        matchDescRspSentHandler = this._innerHandlers.matchDescRspSentHandler,
        statusErrorRspHandler = this._innerHandlers.statusErrorRspHandler,
        srcRtgIndHandler = this._innerHandlers.srcRtgIndHandler,
        beacon_notify_indHandler = this._innerHandlers.beacon_notify_indHandler,
        leaveIndHandler = this._innerHandlers.leaveIndHandler,
        msgCbIncomingHandler = this._innerHandlers.msgCbIncomingHandler;
        // permitJoinIndHandler = this._innerHandlers.permitJoinIndHandler;

    controller.removeListener('SYS:resetInd',          resetIndHandler);
    controller.removeListener('ZDO:devIncoming',       devIncomingHandler);
    controller.removeListener('ZDO:tcDeviceInd',       tcDeviceIndHandler);
    controller.removeListener('ZDO:stateChangeInd',    stateChangeIndHandler);
    controller.removeListener('ZDO:matchDescRspSent',  matchDescRspSentHandler);
    controller.removeListener('ZDO:statusErrorRsp',    statusErrorRspHandler);
    controller.removeListener('ZDO:srcRtgInd',         srcRtgIndHandler);
    controller.removeListener('ZDO:beacon_notify_ind', beacon_notify_indHandler);
    controller.removeListener('ZDO:leaveInd',          leaveIndHandler);
    controller.removeListener('ZDO:msgCbIncoming',     msgCbIncomingHandler);
    // controller.removeListener('ZDO:permitJoinInd',     permitJoinIndHandler);

    controller.on('SYS:resetInd',          resetIndHandler);
    controller.on('ZDO:devIncoming',       devIncomingHandler);
    controller.on('ZDO:tcDeviceInd',       tcDeviceIndHandler);
    controller.on('ZDO:stateChangeInd',    stateChangeIndHandler);
    controller.on('ZDO:matchDescRspSent',  matchDescRspSentHandler);
    controller.on('ZDO:statusErrorRsp',    statusErrorRspHandler);
    controller.on('ZDO:srcRtgInd',         srcRtgIndHandler);
    controller.on('ZDO:beacon_notify_ind', beacon_notify_indHandler);
    controller.on('ZDO:leaveInd',          leaveIndHandler);
    controller.on('ZDO:msgCbIncoming',     msgCbIncomingHandler);
    // controller.on('ZDO:permitJoinInd',     permitJoinIndHandler);

    controller.start().then(function () {
        self.app = app;
        return self.permitJoin('coord', 0);
    }).then(function () {
        return self.registerDev(controller.getCoord());
    }).then(function () {
        return loader.reload(self);    // reload all devices from database
    }).then(function () {
        var devs = self._devbox.exportAllObjs(),
            checkOnlineReqs = [];

        devs.forEach(function(dev) {
            checkOnlineReqs.push(function () {
                return self.controller._checkOnline(dev);
            });
        });

        return checkOnlineReqs.reduce(function (soFar, fn) {
            return soFar.then(fn);
        }, Q(0));

    }).then(function() {
        deferred.resolve();
        return self.permitJoin('coord', 0xff);
    }).then(function () {
        console.log('>> Starting zApp.');
        self.app();
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

ZShepherd.prototype.stop = function (callback) {
    return this.controller.close(callback);
};

ZShepherd.prototype.reset = function (mode, callback) {
    return this.controller.reset(mode, callback);
};

ZShepherd.prototype.permitJoin = function (joinType, joinTime, callback) {
    return this.controller.permitJoin(joinType, joinTime, callback);
};

ZShepherd.prototype.registerZApp = function (zApp, callback) {
    var self = this,
        deferred = Q.defer(),
        controller = this.controller,
        coord = controller._coord,
        simpleDesc = zApp._simpleDesc,
        loEp;

    function nextEpId() {
        var max = 0,
            index = -1,
            length = coord.epList.length;

        while (++index < length) {
            var value = coord.epList[index];

            if (value > max)
                max = value;
        }

      return max + 1;
    }

    if (coord)
        simpleDesc.epId = nextEpId();
    else
        throw new Error('Coordinator has not been initialized yet');

    loEp = new Coordpoint(coord, simpleDesc);
    coord.endpoints[loEp.getEpId()] = loEp;

    controller.registerEp(loEp).then(function () {
        return controller.querie.coord();
    }).then(function (coordInfo) {
        coord.update(coordInfo);
    }).then(function () {
        self.attachZclMethods(loEp);

        loEp.onZclFoundation = function (msg) {
            process.nextTick(function () {
                return zApp.foundationHandler(msg);
            });
        };
        loEp.onZclFunctional = function (msg) {
            process.nextTick(function () {
                return zApp.functionalHandler(msg);
            });
        };

        loEp.clusters = zApp.clusters;
        zApp.endpoint = loEp;
    }).fail(function (err) {
        deferred.reject(err);
    }).done(function () {
        deferred.resolve(zApp);
    });

    return deferred.promise.nodeify(callback);
};

ZShepherd.prototype.listDevices = function () {
    var devs = this._devbox.exportAllObjs(),
        foundDevs = [];

    devs.forEach(function (dev) {
        var devInfo = dev.dump();

        delete devInfo.id;

        _.forEach(devInfo.endpoints, function (ep, epId) {
            var profId = zclId.profile(ep.profId),
                devId = zclId.device(ep.profId, ep.devId);
            if (profId)
                ep.profId = profId.key;
            if (devId)
                ep.devId = devId.key;

            devInfo.endpoints[epId] = { profId: ep.profId, devId: ep.devId };
        });

        foundDevs.push(devInfo);
    });

    return foundDevs;
};

ZShepherd.prototype.find = function (addr) {
    if (_.isString(addr))
        addr = addr.toLowerCase();
    return this.findDevByAddr(addr);
};

/*************************************************************************************************/
/*** Event Handlers                                                                            ***/
/*************************************************************************************************/
ZShepherd.prototype._resetIndHandler = function (msg) {
    var self = this,
        devbox = this._devbox,
        controller = this.controller,
        devboxIds = devbox.exportAllIds();

    if (this.controller._isRsetting())
        return;

    if (msg !== 'hard')
        console.log('Starting a software reset.');

    devboxIds.forEach(function (id) {
        devbox.removeElement(id);
    });

    initController.initCoord().then(function () {
        return self.permitJoin('coord', 0);
    }).then(function () {
        return self.registerDev(controller.getCoord());
    }).then(function () {
        return loader.reload(self);    // reload all devices from database
    }).then(function() {
        return self.permitJoin('coord', 0xff);
    }).then(function () {
        console.log('>> Starting zApp.');
        self.app();
    }).fail(function (err) {
        console.log('Reset error: ' + err);
    }).done();
};

ZShepherd.prototype._devIncomingHandler = function (devInfo) {
    // devInfo: { type, ieeeAddr, nwkAddr, manufId, epList, endpoints: [ simpleDesc, ... ] }
    var self = this,
        af = this.af,
        devbox = this._devbox,
        dev = this.findDevByAddr(devInfo.ieeeAddr),
        clustersReqs = [];

    function syncEndpoints(dev) {
        devInfo.endpoints.forEach(function (simpleDesc) {
            var ep = dev.getEndpoint(simpleDesc.epId);

            if (ep) {
                ep.update(simpleDesc);
            } else {
                ep = new Endpoint(dev, simpleDesc);
                self.attachZclMethods(ep);
                dev.endpoints[ep.getEpId()] = ep;
            }
        });
    }

    if (dev) {
        dev.update(devInfo);
        dev.setNetInfo({ status: 'online',
                         joinTime: Math.floor(Date.now()/1000) });
        syncEndpoints(dev);

        _.forEach(dev.endpoints, function (ep) {
            clustersReqs.push(function () {
                return af.zclClustersReq(ep).then(function (clusters) {
                    ep.clusters = clusters;
                });
            });
        });

        var allReqs = clustersReqs.reduce(function (soFar, fn) {
            return soFar.then(fn);
        }, Q(0));

        allReqs.then(function () {
            devbox.maintain(function (err){ if (err) console.log(err); });
            console.log('Device: ' + dev.getIeeeAddr() + ' join the network.');
            self.emit('ind', { type:'devStatus', data: dev });
            self.emit('ind', { type:'devIncoming', data: dev });
        }).fail(function (err) {
            console.log('Asynchrnously Clusters error: ' + err);
        }).done();
    } else {
        dev = new Device(devInfo);
        dev.setNetInfo({ status: 'online' });
        syncEndpoints(dev);

        this.registerDev(dev).then(function () {
            _.forEach(dev.endpoints, function (ep) {
                clustersReqs.push(function () {
                    return af.zclClustersReq(ep).then(function (clusters) {
                        ep.clusters = clusters;
                    });
                });
            });

            var allReqs = clustersReqs.reduce(function (soFar, fn) {
                return soFar.then(fn);
            }, Q(0));

            return allReqs;
        }).then(function () {
            devbox.maintain(function (err){ if (err) console.log(err); });
            console.log('Device: ' + dev.getIeeeAddr() + ' join the network.');
            self.emit('ind', { type:'devStatus', data: dev });
            self.emit('ind', { type:'devIncoming', data: dev });
        }).fail(function (err) {
            console.log('Asynchrnously Clusters error: ' + err);
        }).done();
    }
};

ZShepherd.prototype._tcDeviceIndHandler = function (msg) {
    // { nwkaddr, extaddr, parentaddr }
};

ZShepherd.prototype._stateChangeIndHandler = function (msg) {
    // { state[, nwkaddr] }
    if (!msg.hasOwnProperty(msg.nwkaddr))
        return;

    var devStates = msg.state;

    _.forEach(ZSC.ZDO.devStates, function (statesCode, states) {
        if (msg.state === statesCode)
            devStates = states;
    });

    console.log('Device: ' + msg.nwkaddr + ' is now in state: ' + devStates);
};

ZShepherd.prototype._matchDescRspSentHandler = function (msg) {
    // { nwkaddr, numinclusters, inclusterlist, numoutclusters, outclusterlist }
};

ZShepherd.prototype._statusErrorRsp = function (msg) {
    // { srcaddr, status }
    console.log('Device: ' + msg.srcaddr + ' status error: ' + msg.status);
};

ZShepherd.prototype._srcRtgIndHandler = function (msg) {
    // { dstaddr, relaycount, relaylist }
};

ZShepherd.prototype._beacon_notify_indHandler = function (msg) {
    // { beaconcount, beaconlist }
};

ZShepherd.prototype._leaveIndHandler = function (msg) {
    // { srcaddr, extaddr, request, removechildren, rejoin }
    var dev = this.findDevByAddr(msg.extaddr),
        ieeeAddr;

    if (dev) {
        ieeeAddr = dev.getIeeeAddr();

        if (msg.request)    // request
            this.unregisterDev(dev);
        else                // indication
            this._devbox.removeElement(dev.getId());

        console.log('Device: ' + ieeeAddr + ' leave the network.');
        this.emit('ind', { type: 'devLeaving', data: ieeeAddr });
    }
};

ZShepherd.prototype._msgCbIncomingHandler = function (msg) {
    // { srcaddr, wasbroadcast, clusterid, securityuse, seqnum, macdstaddr, msgdata }
};

/*************************************************************************************************/
/*** Protected Methods                                                                         ***/
/*************************************************************************************************/
ZShepherd.prototype.findDev = function (pred) {
    return this._devbox.find(pred);
};

ZShepherd.prototype.findDevById = function (id) {
    return this._devbox.get(id);
};

ZShepherd.prototype.findDevByAddr = function (addr) {
    // addr: ieeeAddr(String) or nwkAddr(Number)
    var isIeeeAddr = _.isString(addr);

    return this.findDev(function (dev) {
        if (isIeeeAddr)
            return dev.getIeeeAddr() === addr;
        else
            return dev.getNwkAddr() === addr;
    });
};

ZShepherd.prototype.findEndpoint = function (addr, epId) {
    var dev = this.findDevByAddr(addr);

    if (dev)
        return dev.getEndpoint(epId);
};

ZShepherd.prototype.registerDev = function (dev, callback) {
    var deferred = Q.defer(),
        devId,
        oldDev;

    if (!(dev instanceof Device) && !(dev instanceof Coordinator))
        throw new Error('dev should be an instance of Device class.');

    devId = dev.getId();

    if (!_.isNil(devId))
        oldDev = this.findDevById(dev.getId());

    if (oldDev) {
        deferred.reject(new Error('dev exists, unregister it first.'));
    } else if (dev._recovered) {
        this._devbox.set(devId, dev, function (err, id) {
            if (!err) {
                dev._recovered = false;
                delete dev._recovered;
                deferred.resolve(id);
            } else {
                deferred.reject(err);
            }
        });
    } else {
        dev.setNetInfo({
            joinTime: Math.floor(Date.now()/1000)
        });

        this._devbox.add(dev, function (err, id) {
            if (!err) {
                dev._setId(id);    // set id to dev, registered successfully
                deferred.resolve(id);
            } else {
                deferred.reject(err);
            }
        });
    }

    return deferred.promise.nodeify(callback);
};

ZShepherd.prototype.unregisterDev = function (dev, callback) {
    var deferred = Q.defer();

    this._devbox.remove(dev.getId(), function (err) {
        if (err)
            deferred.reject(err);
        else
            deferred.resolve();
    });

    return deferred.promise.nodeify(callback);
};

ZShepherd.prototype.attachZclMethods = function (ep) {
    var self = this,
        af = this.af;

    if (ep.isLocal()) {    // local app
        ep.foundation = function (dstAddr, dstEpId, cId, cmd, zclData, cfg, callback) {
            var dstEp = self.findEndpoint(dstAddr, dstEpId);

            if (!dstEp)
                return callback(new Error('dstEp is not found.'));

            if (_.isFunction(cfg)) {
                if (!_.isFunction(callback)) {
                    callback = cfg;
                    cfg = {};
                }
            } else {
                cfg = cfg || {};
            }

            return af.zclFoundation(ep, dstEp, cId, cmd, zclData, cfg, callback);
        };
        ep.functional = function (dstAddr, dstEpId, cId, cmd, zclData, cfg, callback) {
            var dstEp = self.findEndpoint(dstAddr, dstEpId);

            if (!dstEp)
                return callback(new Error('dstEp is not found.'));

            if (_.isFunction(cfg)) {
                if (!_.isFunction(callback)) {
                    callback = cfg;
                    cfg = {};
                }
            } else {
                cfg = cfg || {};
            }

            return af.zclFunctional(ep, dstEp, cId, cmd, zclData, cfg, callback);
        };
    } else {    // remote ep
        ep.foundation = function (cId, cmd, zclData, cfg, callback) {
            var deferred = Q.defer();

            if (_.isFunction(cfg)) {
                if (!_.isFunction(callback)) {
                    callback = cfg;
                    cfg = {};
                }
            } else {
                cfg = cfg || {};
            }

            af.zclFoundation(ep, ep, cId, cmd, zclData, cfg).then(function (msg) {
                var cIdString = zclId.cluster(cId);
                cIdString = cIdString ? cIdString.key : cId;

                af.zclClusterAttrsReq(ep, cId).then(function (attrs) {
                    ep.setAttrs(cIdString, attrs);
                });

                deferred.resolve(msg);
            }).fail(function (err) {
                deferred.reject(err);
            }).done();

            return deferred.promise.nodeify(callback);
        };

        ep.functional = function (cId, cmd, zclData, cfg, callback) {
            var deferred = Q.defer();

            if (_.isFunction(cfg)) {
                if (!_.isFunction(callback)) {
                    callback = cfg;
                    cfg = {};
                }
            } else {
                cfg = cfg || {};
            }

            af.zclFunctional(ep, ep, cId, cmd, zclData, cfg).then(function (msg) {
                var cIdString = zclId.cluster(cId);
                cIdString = cIdString ? cIdString.key : cId;

                af.zclClusterAttrsReq(ep, cId).then(function (attrs) {
                    ep.setAttrs(cIdString, attrs);
                });

                deferred.resolve(msg);
            }).fail(function (err) {
                deferred.reject(err);
            }).done();

            return deferred.promise.nodeify(callback);
        };
    }
};

module.exports = ZShepherd;
