/* jshint node: true */
'use strict';

var Q = require('q'),
    _ = require('busyman'),
    Coordinator = require('../model/device_coord'),
    Endpoint = require('../model/endpoint_coord');

var controller,
    initController = {};

/*************************************************************************************************/
/*** Public APIs                                                                               ***/
/*************************************************************************************************/
initController.initCoord = function (callback) {
    return initCoordAtConnected().then(function (nwkInfo) {
        return initCoordAfterConnected(nwkInfo);
    });
};

/*************************************************************************************************/
/*** Private APIs                                                                              ***/
/*************************************************************************************************/
function initCoordAtConnected () {
    // check if znp coord has booted up
    return controller.querie.coordState().then(function (state) {
        if (state === 'ZB_COORD' || state === 0x09)
            return controller.querie.network(); // coord has started
        else
            return initBootCoordFromApp();
    }).then(function (nwkInfo) {
        controller.setNetInfo(nwkInfo);
        return nwkInfo; // { state, channel, panId, extPanId, ieeeAddr, nwkAddr }
    });
}

function initBootCoordFromApp () {
    var deferred = Q.defer(),
        stateChangeHdlr;

    stateChangeHdlr = function (data) {
        if (data.state === 9) {
            controller.querie.network().done(function (nwkInfo) {
                deferred.resolve(nwkInfo);
            }, function (err) {
                deferred.rejece(err);
            });
            controller.removeListener('ZDO:stateChangeInd', stateChangeHdlr);
        }
    };

    controller.on('ZDO:stateChangeInd', stateChangeHdlr);
    controller.request('ZDO', 'startupFromApp', { startdelay: 100 });

    return deferred.promise;
}  // return nwkInfo

function initCoordAfterConnected (nwkInfo) {
    var coord = controller.getCoord(),
        isCoordRunning = !!coord;

    return controller.querie.coord().then(function (coordInfo) {
        var dlgInfos;

        if (!isCoordRunning) {
            coord = controller._coord = new Coordinator(coordInfo);
            dlgInfos = [
                { profId: 0x0101, epId: 1 }, { profId: 0x0104, epId: 2 }, { profId: 0x0105, epId: 3 }, 
                { profId: 0x0107, epId: 4 }, { profId: 0x0108, epId: 5 }, { profId: 0x0109, epId: 6 }
            ];

            _.forEach(dlgInfos, function (dlgInfo) {
                var dlgEp = new Endpoint(coord, { profId: dlgInfo.profId, epId: dlgInfo.epId, devId: 0x0005, inClusterList: [], outClusterList: [] });
                dlgEp.isDelegator = function () { return true; };
                coord.endpoints[dlgEp.getEpId()] = dlgEp;
            });
        }

        return coord.endpoints; 
    }).then(function (eps) {
        var registerDlgs = [];

        _.forEach(eps, function (ep) {
            if (ep.isDelegator())
                registerDlgs.push(controller.registerEp(ep));
        });

        return Q.all(registerDlgs);
    });
}

module.exports = function (cntl) {
    controller = cntl;
    return initController;
};
