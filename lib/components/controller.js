function Controller(coord, zdo) {

}

Controller.prototype.init = function () {};
Controller.prototype.start = function () {};
Controller.prototype.callZpi = function (zpiName, argInstance, callback) {};

Controller.prototype.newLocalApp = function (zbApp, callback) {};
Controller.prototype.registerSysEp = function () {};
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


module.exports = Controller;