/* jshint node: true */
'use strict';

var Coordpoint = require('./coordpoint'),
    zclId = require('zcl-id');

// CONSATNTS
var READ = ZCLID.AccessControl.READ.value,
    WRITE = ZCLID.AccessControl.WRITE.value,
    REPORTABLE = ZCLID.AccessControl.REPORTABLE.value,
    SERVER_GEN = ZCLID.CmdDir.SERVER_GENERATED.value,
    CLIENT_GEN = ZCLID.CmdDir.CLIENT_GENERATED.value,
    SERVER_RCV = ZCLID.CmdDir.SERVER_RECEIVED.value,
    CLIENT_RCV = ZCLID.CmdDir.CLIENT_RECEIVED.value;

var clusters = {
    genBasic: {
        dir: 0,
        attrs: {
            hwVersion: { acl: READ, value: 1 },
            zclVersion: { acl: READ, value: 1 },
            manufacturerName: { acl: READ, value: 'sivann inc.' },
            modelId: { acl: READ, value: 'hiver0001' },
            dateCode: { acl: READ, value: '20150311' },
            powerSource: { acl: READ, value: '20150311' },
            physicalEnv: { acl: READ | WRITE, value: 0 },
            locationDesc: { acl: READ | WRITE, value: '    ' },
            deviceEnabled: { acl: READ | WRITE, value: 1 }
        }
    },
    genIdentify: {
        identifyTime: { dir: 0, acl: READ | WRITE, value: 0 }
    },
    ssIasWd: {
        maxDuration: { dir: 0, acl: READ | WRITE, value: 240 }
    },
    ssIasZone: {
        zoneState: { dir: 0, acl: READ, value: 0 },     // default: ZCLDEFS.Cluster.SsIasZone.ZoneStateAttrValue.NotEnrolled.value = 0
        zoneType: { dir: 0, acl: READ, value: 0 },      // ZCLDEFS.Cluster.SsIasZone.ZoneTypeAttrValue.StandardCIE.value = 0x0000
        zoneStatus: { dir: 0, acl: READ, value: 0 },    // default: 0, flaggbale: ZCLDEFS.Cluster.SsIasZone.ZoneStatusAttrValue
        iasCieAddr: { dir: 0, acl: READ | WRITE, value: '0x124356' },
        zoneId: { dir: 0, acl: READ, value: 0 }
    },

};

var discvCmds = {
    ssIasZone: {
        enrollRsp: { dir: CLIENT_GEN },
        initNormalOpMode: { dir: CLIENT_GEN },
        initTestMode: { dir: CLIENT_GEN }
    }
};

// epInfo = { profId, epId, devId, inCList, outCList }
function ZApp(shepherd, ids, clusters, discCmds) {
    var self = this,
        coord = shepherd.getCoord(),
        epInfo = {
            profId: null,
            epId: null,
            devId: null
        };

    this.epInfo = {
        profId: ids.profId,
        epId: ids.epId,
        devId: ids.devId,
        inCList: [],
        outCList: []
    };


    this.shepherd = shepherd;

    // [TODO] find if epId is used
    this.endpoint = new Coordpoint(coord, epInfo);

    this.endpoint.createClusters(clusters);          // add cId to inCList and outCList
    this.endpoint.createDiscoverableCmds(discCmds);

    // this.name = name;
    // this.coord = coord;
    // this.endpoint = new Coordpoint(coord, epInfo);

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

