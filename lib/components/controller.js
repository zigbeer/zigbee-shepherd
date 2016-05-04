function Controller(coord, znp) {
    this.zdo = new Zdo(znp);
    this.request = znp.request;



}

Controller.prototype.init = function () {};
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


retrieveNwkInfo(cb)
retrieveSingleNwkInfo(param, callback)
showNwkInfo(cb)
getRoutingTable(argInst, callback)
setPermitJoin(argInst, callback) 

mtoRouteStart() // TODO
mtoRouteStop()  // TODO

getNeighborTable(dstaddr, startindex, callback) // TODO
getRoutingTable(dstaddr, startindex, callback)  // TODO


changeKey(argInst, callback)
getKey(argInst, callback)
getDevList(addrObj, callback)

devListMaintain(addrObj, callback)
removeDevice(argInst, callback)
setBindingEntry(argInst, callback)


/*************************************************************************************************/
/*** Forward the event to nwkmgr for zpis who need to handle AREQ                              ***/
/*** This is done by "listen old event, and then emit a new one"                               ***/
/*************************************************************************************************/
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