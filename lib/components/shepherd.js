/* jshint node: true */
'use strict';

var util = require('util'),
    EventEmitter = require('events').EventEmitter;

var ObjectBox = require('ObjectBox'),
    Coordinator = require('coordinator'),
    Controller = require('controller');

function ZShepherd(cfg) {
    EventEmitter.call(this);

    var self = this;

    this._devbox = new ObjectBox();         // db integration
    this._epbox = new ObjectBox();          // db integration
    this.coord = new Coordinator();         // coord is just a device, but with local endpoint and applications
    this.controller = new Controller(cfg);  // controller is the main actor

    this.request = this.controller.request; // the request method is exported by controller

    // many basic events
    this.on('devIncoming');
    this.on('devLeaving');
    this.on('epIncoming');
    this.on('epLeaving');
    this.on('devChanged');
    this.on('epChanged');
}

util.inherits(Controller, EventEmitter);

/*************************************************************************************************/
/*** Public APIs                                                                               ***/
/*************************************************************************************************/
ZShepherd.prototype.start = function () {

};

ZShepherd.prototype.getController = function () {
    return this._controller;
};

ZShepherd.prototype.createLocalApp = function () {

};

module.exports = ZShepherd;


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
