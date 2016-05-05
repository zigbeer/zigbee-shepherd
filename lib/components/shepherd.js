/* jshint node: true */
'use strict';

var util = require('util'),
    EventEmitter = require('events').EventEmitter;

var Znp = require('cc-znp'),
    ObjectBox = require('ObjectBox'),
    Coordinator = require('coordinator'),
    Controller = require('controller');

function ZShepherd(cfg) {
    var self = this;

    EventEmitter.call(this);

    this._devbox = new ObjectBox();
    this._epbox = new ObjectBox();
    this.coord = new Coordinator();
    this.controller = new Controller(cfg);
    // attach everything to controller, or new class?

    // this._net = {       // get from controller
    //     channel: null,
    //     panId: null,
    //     extPanId: null,
    //     address: {
    //         ieee: '',
    //         nwk: ''
    //     }
    // };

    this.request = this.controller.request;
}
// listen: controller init done 
    // show network info, getCoordInfo, newZbDevice, newZbEndpoint, .zbSysMgrEp = zbEp, zbCoord.registerEndpoint(zbEp)
    // loadDevicesFromDb(), zbDev.loadEndpointsFromDb(), zbDev.checkOnline(), 
// listen: connect
    // retrieveSingleNwkInfo(devStateNvCode) -> readDevState.key === 'ZB_COORD' -> retrieveNwkInfo() -> .emit('COORD_INIT_DONE')
    //                                          (x) -> zdo.startupFromApp -> retrieveNwkInfo() -> zdb.getInfo('endpoint', nwkInfo.ieeeAddr, sysMgrEpId)
    //                                              -> resetSysEpRegistered() -> .emit('COORD_INIT_DONE')
// listen: endpoint register indication
// listen: epMgrDeviceAnnceListener
// listen: devMgrDeviceAnnceListener
// listen: zdoLeaveIndListener
// listen: zdoEdAnnceIndListener


ZShepherd.prototype.start = function () {

};

ZShepherd.prototype.getController = function () {
    return this._controller;
};

ZShepherd.prototype.createLocalApp = function () {

};