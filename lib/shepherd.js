/* jshint node: true */
'use strict';

var util = require('util'),
    EventEmitter = require('events').EventEmitter;

var Q = require('q'),
    _ = require('busyman'),
    ObjectBox = require('objectbox');

var af = require('./components/af'),
    loader = require('./components/object_loader'),
    Controller = require('./components/controller');

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
    this.af = af(this.controller);
    // this.devices = {};

    this.app = null;

    this._innerHandlers = {
        devIncomingHandler: function (msg) {
            self._devIncomingHandler(msg);
        },
    };
}

util.inherits(ZShepherd, EventEmitter);

/*************************************************************************************************/
/*** Public Methods                                                                            ***/
/*************************************************************************************************/
ZShepherd.prototype.start = function (app, callback) {
    var self = this,
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
        resetIndHandler;

    controller.removeListener('ZDO:devIncoming',       devIncomingHandler);
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
    controller.on('ZDO:permitJoinInd',     permitJoinIndHandler);
    controller.on('SYS:resetInd',          resetIndHandler);*/

    controller.start(function (err) {
        if (err) {
            callback(err);
        } else {
            self.app = app;
            self.permitJoin('coord', 0, function (err) { console.log(err); });

            // reload all devices from database
            loader.reload(self, function (err) {
                if (err) {
                    callback(err);
                } else {
                    self.permitJoin('coord', 60, function (err) { console.log(err); });
                    callback(null);
                }
            });
        }
    });

    return this;
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
        simpleDesc = zApp._simpleDesc,
        controller = this.controller,
        coord = controller._coord,
        loEp;

    function max(array) {
        var max = 0,
            index = -1,
            length = array.length;

        while (++index < length) {
            var value = array[index];

            if (value > max)
                max = value;
        }

      return max;
    }

    if (coord)
        simpleDesc.epId = max(coord.epList) + 1;
    else
        throw new Error('Coordinator has not been initialized yet');

    loEp = new Coordpoint(coord, simpleDesc);
    coord.endpoints[loEp.getEpId()] = loEp;
    
    controller.registerEp(loEp).then(function (result) {
        if (result.status === 0 || result.status  === 'SUCCESS')
            return result;
        else
            return new Error('Registering endpoint fails.');
    }).then(function () {
        loEp._af = self.af;
        loEp.zclFoundation = function (dstEp, cId, cmd, zclData, cfg, callback) {
            return self.af.zclFoundation(loEp, dstEp, cId, cmd, zclData, cfg, callback);
        };
        loEp.zclFunctional = function (dstEp, cId, cmd, zclData, cfg, callback) {
            return self.af.zclFunctional(loEp, dstEp, cId, cmd, zclData, cfg, callback);
        };
        loEp.onZclFoundation = function (msg) {
            process.nextTick(function () {
                return zApp.onZclFoundation(msg);
            });
        };
        loEp.onZclFunctional = function (msg) {
            process.nextTick(function () {
                return zApp.onZclFunctional(msg);
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

ZShepherd.prototype._devIncomingHandler = function (devInfo) {
    // devInfo: { type, ieeeAddr, nwkAddr, manufId, epList, endpoints: [ simpleDesc, ... ] }
    var self = this,
        dev = this.findDevByAddr(devInfo.ieeeAddr),
        devIn = new Device(devInfo);

    function syncEndpoints(dev, callback) {
        var clusterReqs = [];

        devInfo.endpoints.forEach(function (simpleDesc) {
            var oldEp = dev.getEndpoint(simpleDesc.epId),
                ep;

            if (oldEp) {
                ep = oldEp;
                ep.update(simpleDesc);
            } else {
                ep = new Endpoint(dev, simpleDesc);
                // dev.addEndpoint(ep);
            }

            clusterReqs.push(
                self.af.zclClustersReq(ep).then(function (clusters) {

                    //ep.setClusters(clusters);
                })
            ); 
        });

        return Q.all(clusterReqs);
    }

    if (dev) {
        dev.update(devInfo);
        dev.setNetInfo({ status: 'online' });

        syncEndpoints(dev).then(function () {
            self._devbox.maintain();
        }).fail(function (err) {
            console.log('Asynchrnously Clusters error: ');
            console.log(err);
        }).done();   

    } else {
        devIn.setNetInfo({ status: 'online' });
        syncEndpoints(devIn).then(function () {
            this.registerDev(devIn, function (err, id) {
                if (err) {
                    dev = null;
                    console.log(err);
                }
            });
        }).fail(function (err) {
            console.log('Asynchrnously Clusters error: ');
            console.log(err);
        }).done(); 
    }

    // this.emit('IND', { type:'DEV_INCOMING', data: dev });
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

ZShepherd.prototype.registerDev = function (dev, callback) {
    var devId,
        oldDev;

    if (!(dev instanceof Device) && !(dev instanceof Coordinator))
        throw new Error('dev should be an instance of Device class.');

    callback = callback || function (err) { console.log(err); };
    devId = dev.getId();

    if (!_.isNil(devId))
        oldDev = this.findDevById(dev.getId());

    if (oldDev) {
        callback(new Error('dev exists, unregister it first.'));
    } else if (dev._recovered) {
        this._devbox.set(devId, dev, function (err, id) {
            if (!err) {
                dev._recovered = false;
                delete dev._recovered;
            }
            callback(err, id);
        });
    } else {
        dev.setNetInfo({
            joinTime: Math.floor(Date.now()/1000)
        });

        this._devbox.add(dev, function (err, id) {
            if (!err) {
                dev._setId(id);    // set id to dev, registered successfully
            }
            callback(err, id);
        });
    }

    return this;
};

ZShepherd.prototype.unregisterDev = function (dev, callback) {
    dev = this._devInstance(dev);
    callback = callback || function (err) { console.log(err); };

    if (!dev) {
        callback(new Error('dev is not found or not a instance of Device class.'));
    } else {
        this._devbox.remove(dev.getId(), function (err) {
            callback(err);
        });
    }

    return this;
};

ZShepherd.prototype.attachZclMethods = function (ep) {

};

module.exports = ZShepherd;
