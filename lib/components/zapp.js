/* jshint node: true */
'use strict';

var Coordpoint = require('./coordpoint');

// epInfo = { profId, epId, devId, inCList, outCList }
function Zapp(name, coord, epInfo) {
    var self = this;

    this.name = name;
    this.coord = coord;
    this.endpoint = new Coordpoint(coord, epInfo);

    this.onAfIncomingMsg = function (msg) {};
    this.onAfDataConfirm = function (msg) {};
    this.onAfReflectError = function (msg) {};
    this.onAfIncomingMsgExt = function (msg) {};
    this.onZclFoundation = function (msg) {};
    this.onZclFunctional = function (msg) {};

    // Receive endpoint af messages
    this.endpoint._onAfIncomingMsg = function (msg) {
        process.nextTick(function () {
            return self.onAfIncomingMsg(msg);
        });
    };

    this.endpoint._onAfDataConfirm = function (msg) {
        process.nextTick(function () {
            return self.onAfDataConfirm(msg);
        });
    };

    this.endpoint._onAfReflectError = function (msg) {
        process.nextTick(function () {
            return self.onAfReflectError(msg);
        });
    };

    this.endpoint._onAfIncomingMsgExt = function (msg) {
        process.nextTick(function () {
            return self.onAfIncomingMsgExt(msg);
        });
    };

    this.endpoint._onZclFoundation = function (msg) {
        process.nextTick(function () {
            return self.onZclFoundation(msg);
        });
    };

    this.endpoint._onZclFunctional = function (msg) {
        process.nextTick(function () {
            return self.onZclFunctional(msg);
        });
    };
}

// attrs?