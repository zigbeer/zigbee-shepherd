/* jshint node: true */
'use strict';

var util = require('util'),
    EventEmitter = require('events').EventEmitter;

var _ = require('lodash'),
    ccznp = require('cc-znp');

var Device = require('./devClass'),
    Endpoint = require('./epClass');

function ZShepherd() {
    EventEmitter.call(this);

    this._channel = null;
    this._panId = null;

    this.zbDevices = [];
}

util.inherits(ZShepherd, EventEmitter);

var zshepherd = new ZShepherd();

ccznp.on('ready', initDoneHdlr);
ccznp.on('AREQ', ccZnpAreqHdlr);

/*************************************************************************************************/
/*** Public APIs                                                                               ***/
/*************************************************************************************************/
ZShepherd.prototype.init = function (channel, panId, spCfg) {
    this._channel = channel;
    this._panId = panId;

    ccznp.init(spCfg, function (err) {
        console.log(err);
    });
};

ZShepherd.prototype.findDev = function (ieeeAddr) {
    return _.find(this.zbDevices, {ieeeAddr:ieeeAddr});
};

ZShepherd.prototype.bind = function (srcEp, cId, dstEp, callback) {

};

ZShepherd.prototype.unbind = function (srcEp, cId, dstEp, callback) {

};

ZShepherd.prototype.permitJoin = function (time) {

};

/*************************************************************************************************/
/*** Protected Methods                                                                         ***/
/*************************************************************************************************/
ZShepherd.prototype._initCoord = function () {

};

ZShepherd.prototype._getDevInfo = function (nwkAddr, ieeeAddr, callback) {
    var devInfo = {};
};

ZShepherd.prototype._getEpInfo = function (nwkAddr, epId, callback) {
    var epInfo = {};
};

/*************************************************************************************************/
/*** Event Handlers                                                                            ***/
/*************************************************************************************************/
function initDoneHdlr(data) {
    zshepherd._initCoord();
}

function ccZnpAreqHdlr(areqMsg) {
    zshepherd.emit(areqMsg.cmd, areqMsg.payload);
}

/*************************************************************************************************/
/*** Export as a singleton                                                                     ***/
/*************************************************************************************************/
module.exports = zshepherd;
