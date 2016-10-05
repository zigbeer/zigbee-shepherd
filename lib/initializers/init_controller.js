/* jshint node: true */
'use strict';

var Q = require('q'),
    _ = require('busyman'),
    Ziee = require('ziee'),
    debug = require('debug')('zigbee-shepherd:init');

var Coordinator = require('../model/coord'),
    Coordpoint = require('../model/coordpoint');

var init = {};

/*************************************************************************************************/
/*** Public APIs                                                                               ***/
/*************************************************************************************************/
init.setupCoord = function (controller, callback) {
    return controller.checkNvParams().then(function () {
        return init._bootCoordFromApp(controller);
    }).then(function (netInfo) {
        return init._registerDelegators(controller, netInfo);
    }).nodeify(callback);
};

/*************************************************************************************************/
/*** Private APIs                                                                              ***/
/*************************************************************************************************/
init._bootCoordFromApp = function (controller) {
    return controller.querie.coordState().then(function (state) {
        if (state !== 'ZB_COORD' && state !== 0x09) {
            debug('Start the ZNP as a coordinator...');
            return init._startupCoord(controller);
        }
    }).then(function () {
        debug('Now the ZNP is a coordinator.');
        return controller.querie.network();
    }).then(function (netInfo) {
        // netInfo: { state, channel, panId, extPanId, ieeeAddr, nwkAddr }
        controller.setNetInfo(netInfo);
        return netInfo;
    });
};

init._startupCoord = function (controller) {
    var deferred = Q.defer(),
        stateChangeHdlr;

    stateChangeHdlr = function (data) {
        if (data.state === 9) {
            deferred.resolve();
            controller.removeListener('ZDO:stateChangeInd', stateChangeHdlr);
        }
    };

    controller.on('ZDO:stateChangeInd', stateChangeHdlr);
    controller.request('ZDO', 'startupFromApp', { startdelay: 100 });

    return deferred.promise;
};

init._registerDelegators = function (controller, netInfo) {
    var coord = controller.getCoord(),
        dlgInfos =  [
            { profId: 0x0101, epId: 1 }, { profId: 0x0104, epId: 2 }, { profId: 0x0105, epId: 3 },
            { profId: 0x0107, epId: 4 }, { profId: 0x0108, epId: 5 }, { profId: 0x0109, epId: 6 }
        ];

    return controller.simpleDescReq(0, netInfo.ieeeAddr).then(function (devInfo) {
        var registerDlgs = [];

        if (!coord)
            coord = controller._coord = new Coordinator(devInfo);
        else
            coord.endpoints = {};

        _.forEach(dlgInfos, function (dlgInfo) {
            var dlgDesc = { profId: dlgInfo.profId, epId: dlgInfo.epId, devId: 0x0005, inClusterList: [], outClusterList: [] },
                dlgEp = new Coordpoint(coord, dlgDesc, true),
                simpleDesc;

            dlgEp.clusters = new Ziee();
            coord.endpoints[dlgEp.getEpId()] = dlgEp;

            simpleDesc = _.find(devInfo.endpoints, function (ep) {
                return ep.epId === dlgInfo.epId;
            });

            if (!_.isEqual(dlgDesc, simpleDesc)) {
                registerDlgs.push(function () {
                    return controller.registerEp(dlgEp).delay(10).then(function () {
                        debug('Register delegator, epId: %s, profId: %s ', dlgEp.getEpId(), dlgEp.getProfId());
                    });
                });
            }
        });

        return registerDlgs.reduce(function (soFar, fn) {
            return soFar.then(fn);
        }, Q(0));
    }).then(function () {
        return controller.querie.coordInfo().then(function (coordInfo) {
            coord.update(coordInfo);
        });
    });
};

module.exports = init;
