/* jshint node: true */
'use strict';

var Q = require('q'),
    debug = require('debug')('zigbee-shepherd:init');

var loader = require('../components/loader');

var init = {};

init.setupShepherd = function (shepherd, callback) {
    var deferred = Q.defer(),
        controller = shepherd.controller;

    debug('zigbee-shepherd booting...');

    controller.start().then(function () {
        return controller.request('ZDO', 'mgmtPermitJoinReq', { addrmode: 0x02, dstaddr: 0 , duration: 0, tcsignificance: 0 });
    }).then(function () {
        return shepherd._registerDev(controller.getCoord());
    }).then(function () {
        return loader.reload(shepherd);    // reload all devices from database
    }).then(function() {
        debug('Loading devices from database done.');
    }).fail(function (err) {
        deferred.reject(err);
    }).done(function () {
        debug('zigbee-shepherd is up and ready.');
        deferred.resolve();

        var devs = shepherd._devbox.exportAllObjs();
        devs.forEach(function(dev) {
            if (dev.getNwkAddr() !== 0) return controller._checkOnline(dev);
        });
    });

    return deferred.promise.nodeify(callback);
};

module.exports = init;
