var EventEmitter = require('events');

var znp = require('cc-znp');
var zdoHelper = require('./zdo_helper');

function Controller(cfg) {      // cfg is serial port config
    EventEmitter.call(this);

    var self = this;

    // flow control
    this._threshold = 6;  // max pending is 6 - 1 = 5
    this._requestPoll = [];

    this._zdo = new Zdo();
    this._znp = znp;
    this._cfg = cfg;

    // zdo.sendRequest() is always be znp.zdoRequest()
    this._zdo.sendRequest = this._znp.zdoRequest;

    this._znp.on('ready', function () {
        self.emit('ZNP:INIT');
    });

    this._requestCosumer = null;
}

util.inherits(Controller, EventEmitter);

/*************************************************************************************************/
/*** Protected Methods                                                                         ***/
/*************************************************************************************************/
Controller.prototype._startRequestConsumer = function () {
    // var poll = this._requestPoll,
    //     pollLength = this._requestPoll.length,
    //     req;

    // if (pollLength === 0) {         // nothing to send
    //     if (this._requestCosumer) {
    //         clearInterval(this._requestCosumer);
    //         this._requestCosumer = null;
    //     }
    //     return;
    // }

    // if (pollLength && (pollLength < this._threshold)) {   // pendings < 5
    //     req = poll.shift();
    //     req();
    // } else if (!this._requestCosumer) { // pendings > 5, and consumer is not started
    //     this._requestCosumer = setInterval(function () {
    //         var req;
    //         if (self._pendingRequests.length) {
    //             req = self._pendingRequests.shift();
    //             if (req)
    //                 req();
    //         } else {
    //             clearInterval(this._requestCosumer);
    //             this._requestCosumer = null;
    //         }
    //     }, 100);
    // }
};

Controller.prototype._enPoll = function (fn) {
    this._requestQueue.push(fn);
};

Controller.prototype._dePoll = function (fn) {
    // remove from poll
};

/*************************************************************************************************/
/*** Public APIs                                                                               ***/
/*************************************************************************************************/
Controller.prototype.init = function () {
    var self = this;
    this._znp.init(this._cfg, function (err) {
        if (err)
            self.emit('ZNP:ERROR', err);
    });
};

Controller.prototype.close = function () {
    this._znp.close(function (err) {
        if (err)
            self.emit('ZNP:ERROR', err);
    });
};

Controller.prototype.request = function (subsys, cmdId, valObj, callback) {
    // var self = this,
    //     req;

    // req = function () {
    //     return this._znp.request(subsys, cmdId, valObj, function (err, rsp) {
    //         self._dePoll(req);
    //         callback(err, rsp);
    //     });
    // };

    // this._enPoll(req);
    // this._startRequestConsumer();

    // if (subsys.toUpperCase() === 'ZDO' || subsys === 5)
    //     return this._zdo.request(cmdId, valObj, callback);          // use wrapped zdo as the exported api
    // else
    //     return this._znp.request(subsys, cmdId, valObj, callback);
};


Controller.prototype.start = function () {};
Controller.prototype.reset = function (mode, callback) {};
Controller.prototype.coordInfoReq = function (callback) {};
Controller.prototype.devInfoReq = function (callback) {};
Controller.prototype.epInfoReq = function (callback) {};
Controller.prototype.clusterInfoReq = function (callback) {};
Controller.prototype.attrInfoReq = function (callback) {};

Controller.prototype.setNwkInfo = function (argInst, callback) {};
Controller.prototype.getNwkInfo = function (callback) {};
// Controller.prototype.setPermitJoinTime = function (argInst, callback) {};
// Controller.prototype.getPermitJoinTime = function (callback) {};
// Controller.prototype.joinTimeCountdown = function (callback) {};


// retrieveNwkInfo(cb)
// retrieveSingleNwkInfo(param, callback)
// showNwkInfo(cb)
// getRoutingTable(argInst, callback)
// setPermitJoin(argInst, callback) 

// mtoRouteStart() // TODO
// mtoRouteStop()  // TODO

// getNeighborTable(dstaddr, startindex, callback) // TODO
// getRoutingTable(dstaddr, startindex, callback)  // TODO


// changeKey(argInst, callback)
// getKey(argInst, callback)
// getDevList(addrObj, callback)

// devListMaintain(addrObj, callback)
// removeDevice(argInst, callback)
// setBindingEntry(argInst, callback)


/*************************************************************************************************/
/*** Forward the event to nwkmgr for zpis who need to handle AREQ                              ***/
/*** This is done by "listen old event, and then emit a new one"                               ***/
/*************************************************************************************************/

// AF:INCOMING_MSG:srcaddr:clusterid:dstendpoint
// AF:DATA_CONFIRM:endpoint:transid
// SAPI:FIND_DEV_CNF:result  (if has result)
// ZDO:NODE_DESC_RSP:nwkaddr
// ZDO:POWER_DESC_RSP:nwkaddr
// ZDO:SIMPLE_DESC_RSP:nwkaddr:endpoint
// ZDO:ACTIVE_EP_RSP:nwkaddr
// ZDO:MATCH_DESC_RSP:nwkaddr
// ZDO:COMPLEX_DESC_RSP:nwkaddr
// ZDO:USER_DESC_RSP:nwkaddr
// ZDO:USER_DESC_CONF:nwkaddr
// ZDO:SERVER_DISC_RSP:srcaddr
// ZDO:END_DEVICE_BIND_RSP:srcaddr
// ZDO:BIND_RSP:srcaddr
// ZDO:UNBIND_RSP:srcaddr
// ZDO:MGMT_LEAVE_RSP:srcaddr
// ZDO:MGMT_DIRECT_JOIN_RSP:srcaddr
// ZDO:MGMT_PERMIT_JOIN_RSP:srcaddr
// ZDO:NWK_DISCOVERY_CNF
// ZDO:JOIN_CNF

// ZDO:STATE_CHANGE_IND
// ZDO:STATE_CHANGE_IND:nwkaddr:NOT_ACTIVE
// ZDO:STATE_CHANGE_IND:nwkaddr:INVALID_EP
// !msgobj.msg['nwkaddr'] Coord itself

// ZDO:END_DEVICE_ANNCE_IND
// ZDO:MATCH_DESC_RSP_SENT
// ZDO:STATUS_ERROR_RSP
// ZDO:SRC_RTG_IND
// ZDO:BEACON_NOTIFY_IND
// ZDO:LEAVE_IND
// ZDO:MSG_CB_INCOMING
// ZDO:TC_DEVICE_IND

// ZDO:NWK_ADDR_RSP:ieeeaddr:startindex
// ZDO:IEEE_ADDR_RSP:nwkaddr:startindex
// ZDO:MGMT_NWK_DISC_RSP:srcaddr:startindex
// ZDO:MGMT_LQI_RSP:srcaddr:startindex
// ZDO:MGMT_RTG_RSP:srcaddr:startindex
// ZDO:MGMT_BIND_RSP:srcaddr:startindex

msghub.on('AREQ:AF_INCOMING_MSG', function (msgobj) {
    msghub.emit('AF:INCOMING_MSG:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16') + ':' + zutil.convToHexString(msgobj.msg.clusterid, 'uint16') + ':' + zutil.convToHexString(msgobj.msg.dstendpoint, 'uint8'), msgobj.msg);
    // Emit to devmgr, and devmgr will emit another event named by the ieeeAddr
    msghub.emit('AF:INCOMING_MSG', msgobj);
    //console.log(msgobj);
});

msghub.on('AREQ:AF_DATA_CONFIRM', function (msgobj) {
    msghub.emit('AF:DATA_CONFIRM:' + zutil.convToHexString(msgobj.msg.endpoint, 'uint8') + ':' + zutil.convToHexString(msgobj.msg.transid, 'uint8'), msgobj.msg);
    msghub.emit('AF:DATA_CONFIRM:' + zutil.convToHexString(msgobj.msg.endpoint, 'uint8'), msgobj.msg);
   // console.log(msgobj);
});

msghub.on('AREQ:SAPI_FIND_DEV_CNF', function (msgobj) {
    if (Object.prototype.hasOwnProperty.call(msgobj.msg, 'result')) {
        msghub.emit('SAPI:FIND_DEV_CNF:' + zutil.convToHexString(msgobj.msg.result, 'uint32'), msgobj.msg);
    }
});

msghub.on('AREQ:ZDO_NODE_DESC_RSP', function (msgobj) {
    msghub.emit('ZDO:NODE_DESC_RSP:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_POWER_DESC_RSP', function (msgobj) {
    msghub.emit('ZDO:POWER_DESC_RSP:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_SIMPLE_DESC_RSP', function (msgobj) {
    msghub.emit('ZDO:SIMPLE_DESC_RSP:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16') + ':' + msgobj.msg.endpoint, msgobj.msg);
});

msghub.on('AREQ:ZDO_ACTIVE_EP_RSP', function (msgobj) {
    msghub.emit('ZDO:ACTIVE_EP_RSP:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_MATCH_DESC_RSP', function (msgobj) {
    msghub.emit('ZDO:MATCH_DESC_RSP:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_COMPLEX_DESC_RSP', function (msgobj) {
    msghub.emit('ZDO:COMPLEX_DESC_RSP:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_USER_DESC_RSP', function (msgobj) {
    msghub.emit('ZDO:USER_DESC_RSP:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_USER_DESC_CONF', function (msgobj) {
    msghub.emit('ZDO:USER_DESC_CONF:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_SERVER_DISC_RSP', function (msgobj) {
    msghub.emit('ZDO:SERVER_DISC_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_END_DEVICE_BIND_RSP', function (msgobj) {
    msghub.emit('ZDO:END_DEVICE_BIND_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_BIND_RSP', function (msgobj) {
    msghub.emit('ZDO:BIND_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_UNBIND_RSP', function (msgobj) {
    msghub.emit('ZDO:UNBIND_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_MGMT_LEAVE_RSP', function (msgobj) {
    msghub.emit('ZDO:MGMT_LEAVE_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_MGMT_DIRECT_JOIN_RSP', function (msgobj) {
    msghub.emit('ZDO:MGMT_DIRECT_JOIN_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_MGMT_PERMIT_JOIN_RSP', function (msgobj) {
    msghub.emit('ZDO:MGMT_PERMIT_JOIN_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_NWK_DISCOVERY_CNF', function (msgobj) {
    msghub.emit('ZDO:NWK_DISCOVERY_CNF', msgobj.msg);
});

msghub.on('AREQ:ZDO_JOIN_CNF', function (msgobj) {
    msghub.emit('ZDO:JOIN_CNF', msgobj.msg);
});



// emit to Zdo Listener
msghub.on('AREQ:ZDO_STATE_CHANGE_IND', function (msgobj) {
    if (msgobj.msg.state.key === 'NOT_ACTIVE') {
       msghub.emit('ZDO:STATE_CHANGE_IND' + ':' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16') + ':NOT_ACTIVE', msgobj.msg);
    } else if (msgobj.msg.state.key === 'INVALID_EP') {
        msghub.emit('ZDO:STATE_CHANGE_IND' + ':' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16') + ':INVALID_EP', msgobj.msg);
    } else {
        msghub.emit('ZDO:STATE_CHANGE_IND', msgobj.msg);
        if (!msgobj.msg['nwkaddr']) {   // Coord itself
            console.log('Coord is now in state: ' + msgobj.msg.state.key);
        }
    }
});

msghub.on('AREQ:ZDO_END_DEVICE_ANNCE_IND', function (msgobj) {
    msghub.emit('ZDO:END_DEVICE_ANNCE_IND', msgobj.msg);
});

msghub.on('AREQ:ZDO_MATCH_DESC_RSP_SENT', function (msgobj) {
    msghub.emit('ZDO:MATCH_DESC_RSP_SENT', msgobj.msg);
});

msghub.on('AREQ:ZDO_STATUS_ERROR_RSP', function (msgobj) {
    msghub.emit('ZDO:STATUS_ERROR_RSP', msgobj.msg);
});

msghub.on('AREQ:ZDO_SRC_RTG_IND', function (msgobj) {
    msghub.emit('ZDO:SRC_RTG_IND', msgobj.msg);
});

msghub.on('AREQ:ZDO_BEACON_NOTIFY_IND', function (msgobj) {
    msghub.emit('ZDO:BEACON_NOTIFY_IND', msgobj.msg);
});

msghub.on('AREQ:ZDO_LEAVE_IND', function (msgobj) {
    msghub.emit('ZDO:LEAVE_IND', msgobj.msg);
});

msghub.on('AREQ:ZDO_MSG_CB_INCOMING', function (msgobj) {
    msghub.emit('ZDO:MSG_CB_INCOMING', msgobj.msg);
});

msghub.on('AREQ:ZDO_TC_DEVICE_IND', function (msgobj) {
    msghub.emit('ZDO:TC_DEVICE_IND', msgobj.msg);
});



/*************************************************************************************************/
/*** Forward the event to nwkmgr for zpis who need to handle startindex                        ***/
/*************************************************************************************************/
msghub.on('AREQ:ZDO_NWK_ADDR_RSP', function (msgobj) {
    msghub.emit('ZDO:NWK_ADDR_RSP:' + zutil.convToHexString(msgobj.msg.ieeeaddr, 'uint32') + ':' + msgobj.msg.startindex, msgobj.msg);
});

msghub.on('AREQ:ZDO_IEEE_ADDR_RSP', function (msgobj) {
    msghub.emit('ZDO:IEEE_ADDR_RSP:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16') + ':' + msgobj.msg.startindex, msgobj.msg);
});

msghub.on('AREQ:ZDO_MGMT_NWK_DISC_RSP', function (msgobj) {
    msghub.emit('ZDO:MGMT_NWK_DISC_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16') + ':' + msgobj.msg.startindex, msgobj.msg);
});

msghub.on('AREQ:ZDO_MGMT_LQI_RSP', function (msgobj) {
    msghub.emit('ZDO:MGMT_LQI_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16') + ':' + msgobj.msg.startindex, msgobj.msg);
});

msghub.on('AREQ:ZDO_MGMT_RTG_RSP', function (msgobj) {
    msghub.emit('ZDO:MGMT_RTG_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16') + ':' + msgobj.msg.startindex, msgobj.msg);
});

msghub.on('AREQ:ZDO_MGMT_BIND_RSP', function (msgobj) {
    msghub.emit('ZDO:MGMT_BIND_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16') + ':' + msgobj.msg.startindex, msgobj.msg);
});

module.exports = Controller;