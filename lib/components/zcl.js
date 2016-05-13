/* jshint node: true */
'use strict';

// [TODO] waiting for zcl-packet api interface

var ZclPacket = require('zcl-packet');

var zcl = {
    foundation: new ZclPacket('foundation'),
    functional: {}  // cached functional framer/parser instances, clusterId as key
};

// [TODO] cache ranking?

zcl.frame = function (frmObj, clusterId) {
    // frmObj = { cntl, manuf, seq, cmd, payload };
    var frameCntl = frmObj.cntl,
        manufCode = frmObj.manuf,
        seqNum = frmObj.seq,
        cmd = frmObj.cmd,
        zclPayload = frmObj.payload,
        framer;

    // if no frame control given, use default setting: { frameType: X, manufSpec: 0, direction: 0, disDefaultRsp: 0 }
    frameCntl = frameCntl || {};
    // frameCntl.frameType = frameCntl.frameType || 0;
    // frameType will be given by zcl-packet module
    frameCntl.manufSpec = frameCntl.manufSpec || 0;
    frameCntl.direction = frameCntl.direction || 0;
    frameCntl.disDefaultRsp = frameCntl.disDefaultRsp || 0;

    // {
    //     manufSpec: 0,
    //     direction: 0,
    //     disDefaultRsp: 0
    // }
    if (clusterId === undefined || clusterId === null) {    // foundation
        framer = zcl.foundation.frame;
    } else {                                                // functional
        zcl.functional[clusterId] = zcl.functional[clusterId] || new ZclPacket('functional', clusterId);
        framer = zcl.functional[clusterId].frame;
    }

    return framer(frameCntl, manufCode, seqNum, cmd, zclPayload);
};

zcl.parse = function (rawBuf, clusterId, callback) {
    var parser;

    if (typeof clusterId === 'function') {
        callback = clusterId;
        clusterId = undefined;
    }

    if (clusterId === undefined || clusterId === null) {    // foundation
        parser = zcl.foundation.parse;
    } else {                                                // functional
        zcl.functional[clusterId] = zcl.functional[clusterId] || new ZclPacket('functional', clusterId);
        parser = zcl.functional[clusterId].parse;
    }

    return parser(rawBuf, callback);
};

module.exports = zcl;
