/* jshint node: true */
'use strict';

var util = require('util'),
    EventEmitter = require('events').EventEmitter;

var Q = require('q'),
    _ = require('busyman'),
    zclId = require('zcl-id'),
    ObjectBox = require('objectbox');

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
        devIncomingHandler: function (msg) {
            self._devIncomingHandler(msg);
        },
        resetIndHandler: function (msg) {
            self._resetIndHandler(msg);
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

    var devIncomingHandler = this._innerHandlers.devIncomingHandler,
        stateChangeIndHandler = this._innerHandlers.stateChangeIndHandler,
        matchDescRspSentHandler = this._innerHandlers.matchDescRspSentHandler,
        statusErrorRspHandler = this._innerHandlers.statusErrorRspHandler,
        srcRtgIndHandler = this._innerHandlers.srcRtgIndHandler,
        beacon_notify_indHandler = this._innerHandlers.beacon_notify_indHandler,
        leaveIndHandler = this._innerHandlers.leaveIndHandler,
        msgCbIncomingHandler = this._innerHandlers.msgCbIncomingHandler,
        tcDeviceIndHandler = this._innerHandlers.tcDeviceIndHandler,
        permitJoinIndHandler = this._innerHandlers.permitJoinIndHandler,
        resetIndHandler = this._innerHandlers.resetIndHandler;

    controller.removeListener('ZDO:devIncoming',       devIncomingHandler);
    controller.removeListener('SYS:resetInd',          resetIndHandler);
    /*controller.removeListener('ZDO:stateChangeInd',    stateChangeIndHandler);
    controller.removeListener('ZDO:matchDescRspSent',  matchDescRspSentHandler);
    controller.removeListener('ZDO:statusErrorRsp',    statusErrorRspHandler);
    controller.removeListener('ZDO:srcRtgInd',         srcRtgIndHandler);
    controller.removeListener('ZDO:beacon_notify_ind', beacon_notify_indHandler);
    controller.removeListener('ZDO:leaveInd',          leaveIndHandler);
    controller.removeListener('ZDO:msgCbIncoming',     msgCbIncomingHandler);
    controller.removeListener('ZDO:tcDeviceInd',       tcDeviceIndHandler);
    controller.removeListener('ZDO:permitJoinInd',     permitJoinIndHandler);
    // controller.removeListener('ZDO:serverDiscRsp',  serverDiscRspHandler);*/

    controller.on('ZDO:devIncoming',       devIncomingHandler);
    controller.on('SYS:resetInd',          resetIndHandler);
    /*controller.on('ZDO:stateChangeInd',    stateChangeIndHandler);
    controller.on('ZDO:matchDescRspSent',  matchDescRspSentHandler);
    controller.on('ZDO:statusErrorRsp',    statusErrorRspHandler);
    controller.on('ZDO:srcRtgInd',         srcRtgIndHandler);
    controller.on('ZDO:beacon_notify_ind', beacon_notify_indHandler);
    controller.on('ZDO:leaveInd',          leaveIndHandler);
    controller.on('ZDO:msgCbIncoming',     msgCbIncomingHandler);
    controller.on('ZDO:tcDeviceInd',       tcDeviceIndHandler);
    controller.on('ZDO:permitJoinInd',     permitJoinIndHandler);
    // controller.on('ZDO:serverDiscRsp',  serverDiscRspHandler);
    controller.on('ZDO:permitJoinInd',     permitJoinIndHandler);*/

    controller.start().then(function () {
        self.app = app;
        return self.permitJoin('coord', 0);
    }).then(function () {
        return self.registerDev(controller.getCoord());
    }).then(function () {
        return loader.reload(self);    // reload all devices from database
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
            self.emit('ind', { type:'devIncoming', data: dev });
        }).fail(function (err) {
            console.log('Asynchrnously Clusters error: ' + err);
        }).done();
    }
};

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

ZShepherd.prototype.find = function (addr) {
    if (_.isString(addr))
        addr = addr.toLowerCase();
    return this.findDevByAddr(addr);
};

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
