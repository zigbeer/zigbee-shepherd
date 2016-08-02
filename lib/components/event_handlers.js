/* jshint node: true */
'use strict';

var Q = require('q'),
    _ = require('busyman'),
    Ziee = require('ziee'),
    ZSC = require('zstack-constants');

var loader = require('./object_loader');

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

    // self.removeAllListeners('ind');

    controller.initCoord().then(function () {
        return self.permitJoin(0x00, 'all');
    }).then(function () {
        return self.registerDev(controller.getCoord());
    }).then(function () {
        return loader.reload(self);    // reload all devices from database
    }).then(function () {
        self.emit('ready');
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
        console.log('Reset error: ' + err);
    }).done();
};

handlers.devIncoming = function (devInfo) {
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
                ep.clusters = new Ziee();
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
                    _.forEach(clusters, function (cInfo, cid) {
                        ep.clusters.init(cid, 'dir', { value: cInfo.dir });
                        ep.clusters.init(cid, 'attrs', cInfo.attrs);
                    });
                });
            });
        });

        var allReqs = clustersReqs.reduce(function (soFar, fn) {
            return soFar.then(fn);
        }, Q(0));

        allReqs.then(function () {
            devbox.maintain(function (err){ if (err) console.log(err); });
            console.log('Device: ' + dev.getIeeeAddr() + ' join the network.');
            self.emit('ind', { type: 'devOnline', data: dev.getIeeeAddr() });
            self.emit('ind', { type: 'devIncoming', data: dev });
            return;
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
                        _.forEach(clusters, function (cInfo, cid) {
                            ep.clusters.init(cid, 'dir', { value: cInfo.dir });
                            ep.clusters.init(cid, 'attrs', cInfo.attrs);
                        });
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
            self.emit('ind', { type: 'devOnline', data: dev.getIeeeAddr() });
            self.emit('ind', { type: 'devIncoming', data: dev });
            return;
        }).fail(function (err) {
            console.log('Asynchrnously Clusters error: ' + err);
        }).done();
    }
};

handlers.tcDeviceInd = function (msg) {
    // { nwkaddr, extaddr, parentaddr }
};

handlers.stateChangeInd = function (msg) {
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

handlers.matchDescRspSent = function (msg) {
    // { nwkaddr, numinclusters, inclusterlist, numoutclusters, outclusterlist }
};

handlers.statusErrorRsp = function (msg) {
    // { srcaddr, status }
    console.log('Device: ' + msg.srcaddr + ' status error: ' + msg.status);
};

handlers.srcRtgInd = function (msg) {
    // { dstaddr, relaycount, relaylist }
};

handlers.beacon_notify_ind = function (msg) {
    // { beaconcount, beaconlist }
};

handlers.leaveInd = function (msg) {
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
        this.emit('ind', { type: 'devOffline', data: ieeeAddr });
        this.emit('ind', { type: 'devLeaving', data: ieeeAddr });
    }
};

handlers.msgCbIncoming = function (msg) {
    // { srcaddr, wasbroadcast, clusterid, securityuse, seqnum, macdstaddr, msgdata }
};

handlers.serverDiscRsp = function (msg) {
    // { srcaddr, status, servermask }
};

module.exports = handlers;
