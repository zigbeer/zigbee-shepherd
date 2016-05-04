/* jshint node: true */
'use strict';

var util = require('util'),
    EventEmitter = require('events').EventEmitter;

var Znp = require('cc-znp'),
    ObjectBox = require('ObjectBox'),
    Controller = require('controller');

function ZShepherd(cfg) {
    var self = this;
    var znp = new Znp();

    EventEmitter.call(this);

    this._devbox = new ObjectBox();
    this._epbox = new ObjectBox();
    this._controller = new Controller(coord, znp);
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
}

ZShepherd.prototype.start = function () {

};


ZShepherd.prototype.getController = function () {
    return this._controller;
};

