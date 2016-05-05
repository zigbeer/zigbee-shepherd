var EventEmitter = require('events').EventEmitter,
    util = require('util');

function ZHub() {
    if (typeof ZHub.instance === "object")
        return ZHub.instance;

    EventEmitter.call(this);
    ZHub.instance = this;
}

util.inherits(ZHub, EventEmitter);

ZHub.prototype.areqBridge = function (subsys, ind, data) {
    var areqEvent = 'AREQ:' + subsys.toUpperCase() + ':' + ind; // AREQ:ZDO:endDeviceAnnceInd
    this.emit(areqEvent, data);
};


var zhub = new ZHub();

zhub.on('AREQ:AF:incomingMsg', function (data) {
    var evt = 'AREQ:AF:incomingMsg' + data.srcaddr.toString() + ':' + data.clusterid.toString() + ':' + data.dstendpoint.toString();
    zhub.emit(evt, data);
});



module.exports = zhub;

// znp.on('AREQ', function (msg) {
//     var zdoEvent;   // 'ZDO:XXXX:RSP', 'ZDO:XXXX:RSP'
//     // subsys: 'ZDO',
//     // ind: 'endDeviceAnnceInd',
//     // data: { srcaddr: 63536, nwkaddr: 63536, ieeeaddr: '0x00124b0001ce3631', capabilities: 142 } 
//     zhub.areqBridge(subsys, ind, data);
// };



