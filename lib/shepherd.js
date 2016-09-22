/* jshint node: true */
'use strict';

var fs = require('fs'),
    util = require('util'),
    EventEmitter = require('events');

var Q = require('q'),
    _ = require('busyman'),
    Zive = require('zive'),
    zclId = require('zcl-id'),
    proving = require('proving'),
    Objectbox = require('objectbox'),
    ZSC = require('zstack-constants'),
    debug = require('debug')('zigbee-shepherd:init');

var af = require('./components/af'),
    zutils = require('./components/zutils'),
    loader = require('./components/object_loader'),
    Controller = require('./components/controller'),
    eventHandlers = require('./components/event_handlers');

var Device = require('./model/device'),
    Endpoint = require('./model/endpoint'),
    Coordinator = require('./model/coord'),
    Coordpoint = require('./model/coordpoint');

/*************************************************************************************************/
/*** ZShepherd Class                                                                           ***/
/*************************************************************************************************/
function ZShepherd(path, opts) {
    // opts: { sp: {}, net: {}, defaultDbPath: 'xxx' }

    var self = this,
        spCfg = {};

    EventEmitter.call(this);

    opts = opts || {};

    proving.string(path, 'path should be a string.');

    spCfg.path = path;

    proving.object(opts, 'opts should be an object if gieven.');

    if (opts.hasOwnProperty('sp'))
        spCfg.options = opts.sp;

    /***************************************************/
    /*** Protected Memebers                          ***/
    /***************************************************/
    this._startTime = 0;
    this._enabled = false;
    this._zApp = [];
    this.controller = new Controller(this, spCfg);    // controller is the main actor
    this.af = af(this.controller);

    this._dbPath = opts.defaultDbPath;

    if (!this._dbPath) {    // use default
        this._dbPath = __dirname + '/database/dev.db';
        // create default db folder if not there
        try {
            fs.statSync(__dirname + '/database');
        } catch (e) {
            fs.mkdirSync(__dirname + '/database');
        }
    }

    this._devbox = new Objectbox(this._dbPath);

    if (opts.hasOwnProperty('net'))
        this.controller.setNvParams(opts.net);

    this.controller.on('permitJoining', function (time) {
        self.emit('permitJoining', time);
    });

    eventHandlers.attachEventHandlers(this);

    /***************************************************/
    /*** Event Handlers (Ind Event Bridges)          ***/
    /***************************************************/
    this.on('_ready', function () {
        self._startTime = Math.floor(Date.now()/1000);
        self.emit('ready');
    });

    this.on('ind:incoming', function (dev) {
        var endpoints = [];

        _.forEach(dev.epList, function (epId) {
            endpoints.push(dev.getEndpoint(epId));
        });

        self.emit('ind', {
            type: 'devIncoming',
            endpoints: endpoints,
            data: dev.getIeeeAddr()
        });
    });

    this.on('ind:leaving', function (epList, ieeeAddr) {
        self.emit('ind', {
            type: 'devLeaving',
            endpoints: epList,
            data: ieeeAddr
        });
    });

    this.on('ind:changed', function (ep, ind) {
        self.emit('ind', {
            type: 'devChange',
            endpoints: [ ep ],
            data: ind
        });
    });

    this.on('ind:status', function (dev, status) {
        var endpoints = [];

        _.forEach(dev.epList, function (epId) {
            endpoints.push(dev.getEndpoint(epId));
        });

        self.emit('ind', {
            type: 'devStatus',
            endpoints: endpoints,
            data: status
        });
    });
}

util.inherits(ZShepherd, EventEmitter);

/*************************************************************************************************/
/*** Public Methods                                                                            ***/
/*************************************************************************************************/
ZShepherd.prototype.start = function (callback) {
    var self = this,
        deferred = Q.defer(),
        controller = this.controller;

    debug('zigbee-shepherd booting...');

    controller.start().then(function () {
        self._enabled = true;
        return self.permitJoin(0x00, 'all');
    }).then(function () {
        return self._registerDev(controller.getCoord());
    }).then(function () {
        return loader.reload(self);    // reload all devices from database
    }).then(function() {
        debug('Loading devices from database done.');
        debug('zigbee-shepherd is up and ready.');
        self.emit('_ready');
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

    if (!self._enabled) {
        deferred.resolve();
        return deferred.promise.nodeify(callback);
    }

    devboxIds.forEach(function (id) {
        self._devbox.removeElement(id);
    });

    this._zApp = null;
    this._zApp = [];

    this.permitJoin(0x00, 'all').then(function () {
        return self.controller.close();
    }).then(function () {
        self._enabled = false;
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
    if (!this._enabled)
        throw new Error('Shepherd is not enabled.');

    if (_.isFunction(type) && !_.isFunction(callback)) {
        callback = type;
        type = 'all';
    } else {
        type = type || 'all';
    }

    return this.controller.permitJoin(time, type, callback);
};

ZShepherd.prototype.info = function () {
    var net = this.controller.getNwkInfo();

    return {
        enabled: this._enabled,
        net: {
            state: net.state,
            channel: net.channel,
            panId: net.panId,
            extPanId: net.extPanId,
            ieeeAddr: net.ieeeAddr,
            nwkAddr: net.nwkAddr,
        },
        startTime: this._startTime,
        joinTimeLeft: net.joinTimeLeft
    };
};

ZShepherd.prototype.mount = function (zApp, callback) {
    var self = this,
        deferred = Q.defer(),
        controller = this.controller,
        coord = controller.getCoord(),
        simpleDesc = zApp._simpleDesc,
        loEp;

    if (!(zApp.constructor.name === 'Zive'))
        throw new TypeError('zApp should be an instance of Zive class.');

    this._zApp.forEach(function (app) {
        if (app === zApp)
            throw new Error('zApp already exists.');
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
        self._attachZclMethods(loEp);
        self._attachZclMethods(zApp);

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
            proving.string(ieeeAddr, 'ieeeAddr should be a string.');

            var devInfo,
                found = self._findDevByAddr(ieeeAddr);

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
    return this._findEndpoint(addr, epId);
};

ZShepherd.prototype.lqi = function (ieeeAddr, callback) {
    proving.string(ieeeAddr, 'ieeeAddr should be a string.');

    var deferred = Q.defer(),
        dev = this._findDevByAddr(ieeeAddr),
        nwkAddr;

    if (dev) {
        nwkAddr = dev.getNwkAddr();
    } else {
        deferred.reject(new Error('device is not found.'));
        return deferred.promise.nodeify(callback);
    }

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
    proving.string(ieeeAddr, 'ieeeAddr should be a string.');

    var deferred = Q.defer(),
        dev = this._findDevByAddr(ieeeAddr);

    if (_.isFunction(cfg) && !_.isFunction(callback)) {
        callback = cfg;
        cfg = {};
    } else {
        cfg = cfg || {};
    }

    if (!dev) {
        deferred.reject(new Error('device is not found.'));
        return deferred.promise.nodeify(callback);
    }

    return this.controller.remove(dev, cfg, callback);
};

/*************************************************************************************************/
/*** Protected Methods                                                                         ***/
/*************************************************************************************************/
ZShepherd.prototype._findDev = function (pred) {
    return this._devbox.find(pred);
};

ZShepherd.prototype._findDevById = function (id) {
    return this._devbox.get(id);
};

ZShepherd.prototype._findDevByAddr = function (addr) {
    // addr: ieeeAddr(String) or nwkAddr(Number)
    proving.stringOrNumber(addr, 'addr should be a number or a string.');

    var isIeeeAddr = _.isString(addr);

    return this._findDev(function (dev) {
        if (isIeeeAddr)
            return dev.getIeeeAddr() === addr;
        else
            return dev.getNwkAddr() === addr;
    });
};

ZShepherd.prototype._findEndpoint = function (addr, epId) {
    var dev = this._findDevByAddr(addr);

    proving.number(epId, 'epId should be a number.');

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
        oldDev = this._findDevById(dev.getId());

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

ZShepherd.prototype._unregisterDev = function (dev, callback) {
    var deferred = Q.defer();

    this._devbox.remove(dev.getId(), function (err) {
        if (err)
            deferred.reject(err);
        else
            deferred.resolve();
    });

    return deferred.promise.nodeify(callback);
};

ZShepherd.prototype._attachZclMethods = function (ep) {
    var self = this,
        af = this.af;

    if (ep.constructor.name === 'Zive') {
        var zApp = ep;
        zApp.foundation = function (dstAddr, dstEpId, cId, cmd, zclData, cfg, callback) {
            var deferred = Q.defer(),
                dstEp = self._findEndpoint(dstAddr, dstEpId);

            if (typeof cfg === 'function') {
                callback = cfg;
                cfg = {};
            }

            if (!dstEp) {
                deferred.reject(new Error('dstEp is not found.'));
                return deferred.promise.nodeify(callback);
            }

            return self._foundation(zApp._endpoint, dstEp, cId, cmd, zclData, cfg, callback);
        };

        zApp.functional = function (dstAddr, dstEpId, cId, cmd, zclData, cfg, callback) {
            var deferred = Q.defer(),
                dstEp = self._findEndpoint(dstAddr, dstEpId);

            if (typeof cfg === 'function') {
                callback = cfg;
                cfg = {};
            }

            if (!dstEp) {
                deferred.reject(new Error('dstEp is not found.'));
                return deferred.promise.nodeify(callback);
            }

            return self._functional(zApp._endpoint, dstEp, cId, cmd, zclData, cfg, callback);
        };
    } else {
        ep.foundation = function (cId, cmd, zclData, cfg, callback) {
            return self._foundation(ep, ep, cId, cmd, zclData, cfg, callback);
        };
        ep.functional = function (cId, cmd, zclData, cfg, callback) {
            return self._functional(ep, ep, cId, cmd, zclData, cfg, callback);
        };
        ep.bind = function (cId, dstEpOrGrpId, callback) {
            return self.controller.bind(ep, cId, dstEpOrGrpId, callback);
        };
        ep.unbind = function (cId, dstEpOrGrpId, callback) {
            return self.controller.unbind(ep, cId, dstEpOrGrpId, callback);
        };
        ep.read = function (cId, attrId, callback) {
            var deferred = Q.defer(),
                attr = zclId.attr(cId, attrId);

            attr = attr ? attr.value : attrId;

            self._foundation(ep, ep, cId, 'read', [{ attrId: attr }]).then(function (readStatusRecsRsp) {
                var rec = readStatusRecsRsp[0];

                if (rec.status === 0) {
                    deferred.resolve(rec.attrData);
                } else {
                    deferred.reject(new Error('request unsuccess: ' + rec.status));
                }
            });

            return deferred.promise.nodeify(callback);
        };
    }
};

ZShepherd.prototype._foundation = function (srcEp, dstEp, cId, cmd, zclData, cfg, callback) {
    var self = this,
        deferred = Q.defer();

    if (_.isFunction(cfg) && !_.isFunction(callback)) {
        callback = cfg;
        cfg = {};
    } else {
        cfg = cfg || {};
    }

    this.af.zclFoundation(srcEp, dstEp, cId, cmd, zclData, cfg).then(function (msg) {
        var cmdString = zclId.foundation(cmd);
        cmdString = cmdString ? cmdString.key : cmd;

        if (cmdString === 'read') {
            self._updateFinalizer(dstEp, cId, msg.payload);
        } else if (cmdString === 'write' || cmdString === 'writeUndiv' || cmdString === 'writeNoRsp') {
            self._updateFinalizer(dstEp, cId);
        }

        deferred.resolve(msg.payload);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

ZShepherd.prototype._functional = function (srcEp, dstEp, cId, cmd, zclData, cfg, callback) {
    var self = this,
        deferred = Q.defer();

    if (_.isFunction(cfg) && !_.isFunction(callback)) {
        callback = cfg;
        cfg = {};
    } else {
        cfg = cfg || {};
    }

    this.af.zclFunctional(srcEp, dstEp, cId, cmd, zclData, cfg).then(function (msg) {
        self._updateFinalizer(dstEp, cId);
        deferred.resolve(msg.payload);
    }).fail(function (err) {
        deferred.reject(err);
    }).done();

    return deferred.promise.nodeify(callback);
};

ZShepherd.prototype._updateFinalizer = function (ep, cId, attrs) {
    var self = this,
        updateAttrs,
        cIdString = zclId.cluster(cId),
        clusters = ep.getClusters().dumpSync(),
        oldAttrs,
        diff;

    cIdString = cIdString ? cIdString.key : cId;
    oldAttrs = clusters[cIdString].attrs;

    updateAttrs = function (diff) {
        if (!_.isEmpty(diff)) {
            var ind = {
                cid: cIdString,
                data: diff
            };

            _.forEach(diff, function (val, attrId) {
                var setState = ep.getClusters().set(cIdString, 'attrs', attrId, val);
            });

            self.emit('ind:changed', ep, ind);
        }
    };

    if (attrs) {
        var newAttrs = {};

        _.forEach(attrs, function (rec) {  // { attrId, status, dataType, attrData }
            var attrIdString = zclId.attr(cId, rec.attrId);

            attrIdString = attrIdString ? attrIdString.key : rec.attrId;

            newAttrs[attrIdString] = null;

            if (rec.status === 0)
                newAttrs[attrIdString] = rec.attrData;
        });

        diff = zutils.objectDiff(oldAttrs, newAttrs);
        updateAttrs(diff);
    } else {
        this.af.zclClusterAttrsReq(ep, cId).then(function (attrs) {
            diff = zutils.objectDiff(oldAttrs, attrs);
            updateAttrs(diff);
        }).done();
    }
};

module.exports = ZShepherd;
