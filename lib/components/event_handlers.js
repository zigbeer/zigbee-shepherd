/* jshint node: true */
'use strict';

var Q = require('q'),
    _ = require('busyman'),
    Ziee = require('ziee'),
    ZSC = require('zstack-constants'),
    debug = {
        shepherd: require('debug')('zigbee-shepherd'),
        init: require('debug')('zigbee-shepherd:init')
    };

var Device = require('../model/device'),
    Endpoint = require('../model/endpoint');

var handlers = {};

handlers.attachEventHandlers = function (shepherd) {
    var controller = shepherd.controller,
        hdls = {};

    _.forEach(handlers, function (hdl, key) {
        if (key !== 'attachEventHandlers')
            hdls[key] = hdl.bind(shepherd);
    });

    controller.removeListener('SYS:resetInd',          hdls.resetInd);
    controller.removeListener('ZDO:devIncoming',       hdls.devIncoming);
    controller.removeListener('ZDO:tcDeviceInd',       hdls.tcDeviceInd);
    controller.removeListener('ZDO:stateChangeInd',    hdls.stateChangeInd);
    controller.removeListener('ZDO:matchDescRspSent',  hdls.matchDescRspSent);
    controller.removeListener('ZDO:statusErrorRsp',    hdls.statusErrorRsp);
    controller.removeListener('ZDO:srcRtgInd',         hdls.srcRtgInd);
    controller.removeListener('ZDO:beacon_notify_ind', hdls.beacon_notify_ind);
    controller.removeListener('ZDO:leaveInd',          hdls.leaveInd);
    controller.removeListener('ZDO:msgCbIncoming',     hdls.msgCbIncoming);
    controller.removeListener('ZDO:serverDiscRsp',     hdls.serverDiscRsp);
    // controller.removeListener('ZDO:permitJoinInd',     hdls.permitJoinInd);

    controller.on('SYS:resetInd',          hdls.resetInd);
    controller.on('ZDO:devIncoming',       hdls.devIncoming);
    controller.on('ZDO:tcDeviceInd',       hdls.tcDeviceInd);
    controller.on('ZDO:stateChangeInd',    hdls.stateChangeInd);
    controller.on('ZDO:matchDescRspSent',  hdls.matchDescRspSent);
    controller.on('ZDO:statusErrorRsp',    hdls.statusErrorRsp);
    controller.on('ZDO:srcRtgInd',         hdls.srcRtgInd);
    controller.on('ZDO:beacon_notify_ind', hdls.beacon_notify_ind);
    controller.on('ZDO:leaveInd',          hdls.leaveInd);
    controller.on('ZDO:msgCbIncoming',     hdls.msgCbIncoming);
    controller.on('ZDO:serverDiscRsp',     hdls.serverDiscRsp);
    // controller.on('ZDO:permitJoinInd',     hdls.permitJoinInd);
};

/*************************************************************************************************/
/*** Event Handlers                                                                            ***/
/*************************************************************************************************/
handlers.resetInd = function (msg) {
    var self = this;

    if (this.controller.isResetting()) return;

    if (msg !== '_reset')
        debug.shepherd('Starting a software reset...');

    this.stop().then(function () {
        return self.start();
    }).then(function () {
        if (msg === '_reset')
            return self.controller.emit('_reset');
    }).fail(function (err) {
        if (msg === '_reset') {
            return self.controller.emit('_reset', err);
        } else {
            debug.shepherd('Reset had an error', err);
            self.emit('error', err);
        }
    }).done();
};

handlers.devIncoming = function (devInfo) {
    // devInfo: { type, ieeeAddr, nwkAddr, manufId, epList, endpoints: [ simpleDesc, ... ] }
    var self = this,
        dev = this._findDevByAddr(devInfo.ieeeAddr),
        clustersReqs = [];

    function syncEndpoints(dev) {
        devInfo.endpoints.forEach(function (simpleDesc) {
            var ep = dev.getEndpoint(simpleDesc.epId);

            if (ep) {
                ep.update(simpleDesc);
            } else {
                ep = new Endpoint(dev, simpleDesc);
                ep.clusters = new Ziee();
                self._attachZclMethods(ep);
                dev.endpoints[ep.getEpId()] = ep;
            }
        });
    }

    Q.fcall(function () {
        if (dev) {
            dev.update(devInfo);
            dev.update({ status: 'online', joinTime: Math.floor(Date.now()/1000) });
            syncEndpoints(dev);
            return dev;
        } else {
            dev = new Device(devInfo);
            dev.update({ status: 'online' });
            syncEndpoints(dev);
            return self._registerDev(dev).then(function () {
                return dev;
            });
        }
    }).then(function (dev) {
        _.forEach(dev.endpoints, function (ep) {
            // if (ep.isZclSupported())
                clustersReqs.push(function () {
                    return self.af.zclClustersReq(ep).then(function (clusters) {
                        _.forEach(clusters, function (cInfo, cid) {
                            ep.clusters.init(cid, 'dir', { value: cInfo.dir });
                            ep.clusters.init(cid, 'attrs', cInfo.attrs, false);
                        });
                    });
                });
        });

        return clustersReqs.reduce(function (soFar, fn) {
            return soFar.then(fn);
        }, Q(0));
    }).then(function () {
        if (_.isFunction(self.acceptDevIncoming)) {
            var info = {
                ieeeAddr: dev.getIeeeAddr(),
                endpoints: []
            };

            _.forEach(dev.epList, function (epId) {
                info.endpoints.push(dev.getEndpoint(epId));
            });

            return Q.ninvoke(self, 'acceptDevIncoming', info).timeout(60000);
        } else {
            return true;
        }
    }).then(function (accepted) {
        if (accepted) {
            Q.ninvoke(self._devbox, 'sync', dev._getId());
            debug.shepherd('Device: %s join the network.', dev.getIeeeAddr());

            self.emit('ind:incoming', dev);
            self.emit('ind:status', dev, 'online');
            self.controller.emit('ind:incoming' + ':' + dev.getIeeeAddr());
        } else {
            self.remove(dev.getIeeeAddr(), { reJoin: false }).then(function () {
                Q.ninvoke(self._devbox, 'remove', dev._getId());
            });
        }
    }).fail(function (err) {
        self.emit('error', err);
    }).done();
};

handlers.leaveInd = function (msg) {
    // { srcaddr, extaddr, request, removechildren, rejoin }
    var dev = this._findDevByAddr(msg.extaddr);

    if (dev) {
        var ieeeAddr = dev.getIeeeAddr(),
            epList = _.cloneDeep(dev.epList);

        if (msg.request)    // request
            this._unregisterDev(dev);
        else                // indication
            this._devbox.remove(dev._getId(), function () {});

        debug.shepherd('Device: %s leave the network.', ieeeAddr);
        this.emit('ind:leaving', epList, ieeeAddr);
    }
};

handlers.stateChangeInd = function (msg) {
    // { state[, nwkaddr] }
    if (!msg.hasOwnProperty('nwkaddr'))
        return;

    var devStates = msg.state;

    _.forEach(ZSC.ZDO.devStates, function (statesCode, states) {
        if (msg.state === statesCode)
            devStates = states;
    });

    debug.shepherd('Device: %d is now in state: %s', msg.nwkaddr, devStates);
};

handlers.statusErrorRsp = function (msg) {
    // { srcaddr, status }
    debug.shepherd('Device: %d status error: %d', msg.srcaddr, msg.status);
};

handlers.tcDeviceInd = function (msg) {
    // { nwkaddr, extaddr, parentaddr }
};

handlers.matchDescRspSent = function (msg) {
    // { nwkaddr, numinclusters, inclusterlist, numoutclusters, outclusterlist }
};

handlers.srcRtgInd = function (msg) {
    // { dstaddr, relaycount, relaylist }
};

handlers.beacon_notify_ind = function (msg) {
    // { beaconcount, beaconlist }
};

handlers.msgCbIncoming = function (msg) {
    // { srcaddr, wasbroadcast, clusterid, securityuse, seqnum, macdstaddr, msgdata }
};

handlers.serverDiscRsp = function (msg) {
    // { srcaddr, status, servermask }
};

module.exports = handlers;
