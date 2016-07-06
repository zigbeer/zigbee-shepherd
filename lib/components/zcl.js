/* jshint node: true */
'use strict';

// [TODO] waiting for zcl-packet api interface

var _ = require('busyman'),
    zclPacket = require('zcl-packet');

var zcl = {};

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
        zcl.functional[clusterId] = zcl.functional[clusterId] || new zclPacket('functional', clusterId);
        framer = zcl.functional[clusterId].frame;
    }

    return framer(frameCntl, manufCode, seqNum, cmd, zclPayload);
};

zcl.parse = function (rawBuf, cId, callback) {
    if (typeof cId === 'function') {
        callback = cId;
        cId = undefined;
    }

    if (_.isNil(cId))   // foundation
        zclPacket.parse(rawBuf, callback);
    else                // functional
        zclPacket.parse(rawBuf, cId, callback);
};

zcl.header = function (rawBuf) {
    var header = zclPacket.header(rawBuf);

    if (!header)
        return;

    if (header.frameCntl.frameType > 1) // 2, 3 are reserved
        return;

    if (header.cmd > 0x10)              // 0x11 - 0xff are reserved
        return;

    return header;
};

module.exports = zcl;
