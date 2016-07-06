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
    var self = this;

    return this._initCoordAtConnected().then(function (nwkInfo) {
        return self._initCoordAfterConnected(nwkInfo);
    });
};

/*************************************************************************************************/
/*** Private APIs                                                                              ***/
/*************************************************************************************************/
initController._initCoordAtConnected = function () {
    var self = this;
    // check if znp coord has booted up
    return controller.querie.coordState().then(function (state) {
        if (state === 'ZB_COORD' || state === 0x09)
            return controller.querie.network(); // coord has started
        else
            return self._initBootCoordFromApp();
    }).then(function (nwkInfo) {
        controller.setNetInfo(nwkInfo);
        return nwkInfo; // { state, channel, panId, extPanId, ieeeAddr, nwkAddr }
    });
}; 

initController._initBootCoordFromApp = function () {
    var waitBootTime = 3000;

    return controller.request('ZDO', 'startupFromApp', { startdelay: 100 }).then(function (rsp) {
        return Q.delay(rsp, waitBootTime);
    }).then(function () {
        // all registered endpoints on coord are cleared when coord boots/reboots
        return controller.querie.network();
    });
};  // return nwkInfo

initController._initCoordAfterConnected = function (nwkInfo) {
    var isCoordRunning = !!controller.getCoord();

    return controller.querie.coord().then(function (coordInfo) {   // coordInfo = { type, ieeeAddr, nwkAddr, manufId, epList }
        var delegators,
            coord;

        if (!isCoordRunning) {
            coord = controller._coord = new Coordinator(coordInfo);   // create a new coord

            var dlgIPM = new Endpoint(coord, { profId: 0x0101, epId: 1, devId: 0x0005, inCList: [], outCList: [] }),  // 'IPM': 0x0101, Industrial Plant Monitoring
                dlgHA = new Endpoint(coord, { profId: 0x0104, epId: 2, devId: 0x0005, inCList: [], outCList: [] }),   // 'HA': 0x0104, Home Automation
                dlgCBA = new Endpoint(coord, { profId: 0x0105, epId: 3, devId: 0x0005, inCList: [], outCList: [] }),  // 'CBA': 0x0105, Commercial Building Automation
                dlgTA = new Endpoint(coord, { profId: 0x0107, epId: 4, devId: 0x0005, inCList: [], outCList: [] }),   // 'TA': 0x0107, Telecom Applications
                dlgPHHC = new Endpoint(coord, { profId: 0x0108, epId: 5, devId: 0x0005, inCList: [], outCList: [] }), // 'PHHC': 0x0108, Personal Home & Hospital Care
                dlgSE = new Endpoint(coord, { profId: 0x0109, epId: 6, devId: 0x0005, inCList: [], outCList: [] });   // 'SE': 0x0109, Smart Energy 'AMI': 0x0109, Advanced Metering Initiative, Smart Energy

            delegators = [ dlgIPM, dlgHA, dlgCBA, dlgTA, dlgPHHC, dlgSE ];
        }

        return delegators;
    }).then(function (dlgs) {
        var coord = controller.getCoord(),
            registerDlgs = [];

        _.forEach(dlgs, function (dlgEp) {
            dlgEp.isDelegator = function () { return true; };
            coord.endpoints[dlgEp.getEpId()] = dlgEp;
            registerDlgs.push(controller.reRegisterEndpoint(dlgEp));
        });

        return Q.all(registerDlgs);
    });
};

module.exports = function (cntl) {
    controller = cntl;
    return initController;
};
