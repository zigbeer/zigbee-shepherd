/* jshint node: true */
'use strict';

var util = require('util'),
    EventEmitter = require('events');

var Q = require('q'),
    _ = require('busyman'),
    Zive = require('zive'),
    zclId = require('zcl-id'),
    Objectbox = require('objectbox'),
    ZSC = require('zstack-constants');

var af = require('./components/af'),
    zutils = require('./components/zutils'),
    loader = require('./components/object_loader'),
    Controller = require('./components/controller'),
    eventHandlers = require('./components/event_handlers');

var Device = require('./model/device'),
    Endpoint = require('./model/endpoint'),
    Coordinator = require('./model/coord'),
    Coordpoint = require('./model/coordpoint');

var devboxPath = __dirname + '/database/dev.db';

/*************************************************************************************************/
/*** ZShepherd Class                                                                           ***/
/*************************************************************************************************/
function ZShepherd(path, opts) {    // opts: { sp: {}, net: {} }
    var self = this,
        spCfg = {};

    EventEmitter.call(this);

    opts = opts || {};

    if (!_.isString(path))
        throw new TypeError ('path should be a string.');

    spCfg.path = path;

    if (!_.isPlainObject(opts))
        throw new TypeError('opts should be an object.');

    if (opts.hasOwnProperty('sp'))
        spCfg.options = opts.sp;

    this._zApp = [];
    this._devbox = new Objectbox(devboxPath);         // db integration
    this.controller = new Controller(this, spCfg);    // controller is the main actor
    this.af = af(this.controller);

    if (opts.hasOwnProperty('net'))
        this.controller.setNvParams(opts.net);

    this.controller.on('permitJoining', function (time) {
        self.emit('permitJoining', time);
    });

    eventHandlers.attachEventHandlers(this);
}

util.inherits(ZShepherd, EventEmitter);

/*************************************************************************************************/
/*** Public Methods                                                                            ***/
/*************************************************************************************************/
ZShepherd.prototype.start = function (callback) {
    var self = this,
        deferred = Q.defer(),
        controller = this.controller;

    controller.start().then(function () {
        return self.permitJoin(0x00, 'all');
    }).then(function () {
        return self._registerDev(controller.getCoord());
    }).then(function () {
        return loader.reload(self);    // reload all devices from database
    }).then(function() {
        self.emit('ready');
        deferred.resolve();
    }).then(function () {
        var devs = self._devbox.exportAllObjs(),
            checkOnlineReqs = [];

        devs.forEach(function(dev) {
            if (dev.getNwkAddr() !== 0)
                checkOnlineReqs.push(function () {
                    return self.controller._checkOnline(dev);
                });
        });

        return checkOnlineReqs.reduce(function (soFar, fn) {
            return soFar.then(fn);
        }, Q(0));
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

ZShepherd.prototype.stop = function (callback) {
    var self = this,
        deferred = Q.defer(),
        devboxIds = this._devbox.exportAllIds();

    devboxIds.forEach(function (id) {
        self._devbox.removeElement(id);
    });

    this._zApp = null;
    this._zApp = [];

    this.permitJoin(0x00, 'all').then(function () {
        return self.controller.close();
    }).then(function () {
        deferred.resolve();
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

ZShepherd.prototype.reset = function (mode, callback) {
    return this.controller.reset(mode, callback);
};

ZShepherd.prototype.permitJoin = function (time, type, callback) {
    if (_.isFunction(type)) {
        if (!_.isFunction(callback)) {
            callback = type;
            type = 'all';
        }
    } else {
        type = type || 'all';
    }

    return this.controller.permitJoin(type, time, callback);
};

ZShepherd.prototype.mount = function (zApp, callback) {
    var self = this,
        deferred = Q.defer(),
        controller = this.controller,
        coord = controller.getCoord(),
        simpleDesc = zApp._simpleDesc,
        loEp;

    if (!(zApp instanceof Zive))
        throw new TypeError('zApp should be an instance of Zive class.');

    this._zApp.forEach(function (app) {
        if (app === zApp)
            throw new TypeError('zApp already exists.');
    });

    this._zApp.push(zApp);

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
        throw new Error('Coordinator has not been initialized yet.');

    loEp = new Coordpoint(coord, simpleDesc);
    coord.endpoints[loEp.getEpId()] = loEp;

    controller.registerEp(loEp).then(function () {
        return controller.querie.coord();
    }).then(function (coordInfo) {
        coord.update(coordInfo);
    }).then(function () {
        self.attachZclMethods(loEp);
        self.attachZclMethods(zApp);

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
        zApp._endpoint = loEp;
    }).fail(function (err) {
        deferred.reject(err);
    }).done(function () {
        deferred.resolve(loEp.getEpId());
    });

    return deferred.promise.nodeify(callback);
};

ZShepherd.prototype.list = function (ieeeAddrs) {
    var self = this,
        devs = this._devbox.exportAllObjs(),
        foundDevs = [];

    if (_.isString(ieeeAddrs))
        ieeeAddrs = [ ieeeAddrs ];

    if (!_.isUndefined(ieeeAddrs) && !_.isArray(ieeeAddrs))
        throw new TypeError('ieeeAddrs should be a string or an array of strings if given.');

    if (!ieeeAddrs) {                     // list all
        devs.forEach(function (dev) {
            var devInfo = dev.dump();
            delete devInfo.id;
            delete devInfo.endpoints;
            foundDevs.push(devInfo);
        });
    } else if (_.isArray(ieeeAddrs)) {    // list according to cIds
        _.forEach(ieeeAddrs, function (ieeeAddr) {
            var devInfo,
                found = self.findDevByAddr(ieeeAddr);

            if (found)  {
                devInfo = found.dump();
                delete devInfo.id;
                delete devInfo.endpoints;

                foundDevs.push(devInfo);
            } else {
                foundDevs.push(undefined);
            }
        });
    }

    return foundDevs;
};

ZShepherd.prototype.find = function (addr, epId) {
    return this.findEndpoint(addr, epId);
};

ZShepherd.prototype.lqi = function (ieeeAddr, callback) {
    var deferred = Q.defer(),
        dev = this.findDevByAddr(ieeeAddr),
        nwkAddr;

    if (dev)
        nwkAddr = dev.getNwkAddr();
    else
        deferred.reject(new Error('device is not found.'));

    this.controller.request('ZDO', 'mgmtLqiReq', { dstaddr: nwkAddr, startindex: 0 }).then(function (rsp) {
        // { srcaddr, status, neighbortableentries, startindex, neighborlqilistcount, neighborlqilist }
        if (rsp.status === 0) {    // success
            var lqiList = [];
            rsp.neighborlqilist.forEach(function (neighbor) {
                lqiList.push({ ieeeAddr: neighbor.extAddr, lqi: neighbor.lqi });
            });
            deferred.resolve(lqiList);
        }
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

ZShepherd.prototype.remove = function (ieeeAddr, cfg, callback) {
    // cfg: { reJoin, rmChildren }
    var dev = this.findDevByAddr(ieeeAddr);

    if (_.isFunction(cfg)) {
        if (!_.isFunction(callback)) {
            callback = cfg;
            cfg = {};
        }
    } else {
        cfg = cfg || {};
    }

    if (!dev)
        return callback(new Error('device is not found.'));

    return this.controller.remove(dev, cfg, callback);
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

ZShepherd.prototype._registerDev = function (dev, callback) {
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

    if (ep instanceof Zive) {    // zApp
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

        ep.bind = function (cId, dstEpOrGrpId, callback) {
            return self.controller.bind(ep, dstEpOrGrpId, cId, callback);
        };

        ep.unbind = function (cId, dstEpOrGrpId, callback) {
            return self.controller.unbind(ep, dstEpOrGrpId, cId, callback);
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
                var cIdString = zclId.cluster(cId),
                    cmdString = zclId.foundation(cmd),
                    cluster = {},
                    diff;

                cIdString = cIdString ? cIdString.key : cId;
                cmdString = cmdString ? cmdString.key : cmd;
                cluster[cIdString] = {};

                if (cmdString === 'read') {
                    var payload = msg.payload,
                        attrs = {};

                    _.forEach(payload, function (rec) {  // { attrId, status, dataType, attrData }
                        var attrIdString = zclId.attr(cId, rec.attrId);

                        attrIdString = attrIdString ? attrIdString.key : rec.attrId;

                        attrs[attrIdString] = null;

                        if (rec.status === 0)
                            attrs[attrIdString] = rec.attrData;
                    });

                    cluster[cIdString].attrs = attrs;
                    diff = zutils.objectDiff(ep.getClusters().dumpSync(), cluster);

                    if (!_.isEmpty(diff)) {
                        _.forEach(diff[cIdString].attrs, function (val, attr) {
                            var setState = ep.getClusters().set(cIdString, 'attrs', attr, val);
                        });

                        self.emit('ind', { type: 'devChange', data: { ieeeAddr: ep.getIeeeAddr(), data: diff} });
                    }
                } else if (cmdString === 'write' || cmdString === 'writeUndiv' || cmdString === 'writeNoRsp') {
                    af.zclClusterAttrsReq(ep, cId).then(function (attrs) {
                        // attrs: { x1: 0, x2: 3, ... }
                        cluster[cIdString].attrs = attrs;
                        diff = zutils.objectDiff(ep.getClusters().dumpSync(), cluster);

                        if (!_.isEmpty(diff)) {
                            _.forEach(diff[cIdString].attrs, function (val, attr) {
                                var setState = ep.getClusters().set(cIdString, 'attrs', attr, val);
                            });

                            self.emit('ind', { type: 'devChange', data: { ieeeAddr: ep.getIeeeAddr(), data: diff} });
                        }
                    }).done();
                }

                deferred.resolve(msg.payload);
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
                    // attrs: { x1: 0, x2: 3, ... }
                    var cluster = {},
                        diff;

                    cluster[cIdString] = {};
                    cluster[cIdString].attrs = attrs;
                    diff = zutils.objectDiff(ep.getClusters().dumpSync(), cluster);

                    if (!_.isEmpty(diff)) {
                        _.forEach(diff[cIdString].attrs, function (val, attr) {
                            var setState = ep.getClusters().set(cIdString, 'attrs', attr, val);
                        });

                        self.emit('ind', { type: 'devChange', data: { ieeeAddr: ep.getIeeeAddr(), data: diff} });
                    }
                }).done();

                deferred.resolve(msg.payload);
            }).fail(function (err) {
                deferred.reject(err);
            }).done();

            return deferred.promise.nodeify(callback);
        };

        ep.bind = function (cId, dstEpOrGrpId, callback) {
            return self.controller.bind(ep, cId, dstEpOrGrpId, callback);
        };

        ep.unbind = function (cId, dstEpOrGrpId, callback) {
            return self.controller.unbind(ep, cId, dstEpOrGrpId, callback);
        };
    }
};

module.exports = ZShepherd;
