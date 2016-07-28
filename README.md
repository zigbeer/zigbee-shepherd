# zigbee-shepherd

<br />

[![NPM](https://nodei.co/npm/zigbee-shepherd.png?downloads=true)](https://nodei.co/npm/zigbee-shepherd/)  

[![Travis branch](https://img.shields.io/travis/zigbeer/zigbee-shepherd/develop.svg?maxAge=2592000)](https://travis-ci.org/zigbeer/zigbee-shepherd)
[![npm](https://img.shields.io/npm/v/zigbee-shepherd.svg?maxAge=2592000)](https://www.npmjs.com/package/zigbee-shepherd)
[![npm](https://img.shields.io/npm/l/zigbee-shepherd.svg?maxAge=2592000)](https://www.npmjs.com/package/zigbee-shepherd)

<br />

## Table of Contents  

1. [Overview](#Overview)  
2. [Installation](#Installation)  
3. [Usage](#Usage)  
4. [APIs](#APIs)  
5. [Events](#Events)  
6. [Contributors](#Contributors)  

<br />

<a name="Overview"></a>
## 1. Overview  

<br />

<a name="Installation"></a>
## 2. Installation  

> $ npm install zigbee-shepherd --save

<br />

<a name="Usage"></a>
## 3. Usage  

<br />

<a name="APIs"></a>
## 4. APIs  

* [new ZShepherd()](#API_ZShepherd)  
* [.start()](#API_start)  
* [.stop()](#API_stop)  
* [.reset()](#API_reset)  
* [.permitJoin()](#API_permitJoin)  
* [.mount()](#API_mount)  
* [.list()](#API_list)  
* [.find()](#API_find)  
* [.lqi()](#API_lqi)  
* [.remove()](#API_remove)  

*************************************************
<br />

## ZShepherd Class
Exposed by `require('zigbee-shepherd')`  

*************************************************
<br />

<a name="API_ZShepherd"></a>
### new ZShepherd(path[, opts])

**Arguments:**  

1. `path` (_String_):  
2. `opts` (_Object_):  
    - `sp` (_Object_):  
    - `net` (_Object_):  

**Returns:**  

* (_Object_)  

**Examples:**  

*************************************************
<br />

<a name="API_start"></a>
### .start([callback])

**Arguments:**  

2. `callback` (_Function_): `function (err) { }`.  

**Returns:**  

* _none_  

**Examples:**  

*************************************************
<br />

<a name="API_stop"></a>
### .stop([callback])

**Arguments:**  

1. `callback` (_Function_): `function (err) { }`.  

**Returns:**  

* _none_  

**Examples:**  

*************************************************
<br />

<a name="API_reset"></a>
### .reset(mode[, callback])

**Arguments:**  

1. `mode` (_String_ | _Number_): hard reset `'hard'` or `0`, soft reset `'soft'` or `1`.  
2. `callback` (_Function_): `function (err) { }`.  

**Returns:**  

* _none_  

**Examples:**  

*************************************************
<br />

<a name="API_permitJoin"></a>
### .permitJoin(time[, type][, callback])

**Arguments:**  

2. `time` (_Number_): Jointime. Range from  0 to 255.  
1. `type` (_String_ | _Number_): coord `'coord'` or `0`, coord and routers `'all'` or `1`  (default 'all')
3. `callback` (_Function_): `function (err) { }`.  

**Returns:**  

* _none_  

**Examples:**  

*************************************************
<br />

<a name="API_mount"></a>
### .mount(zApp, callback)

**Arguments:**  

1. `zApp` (_Object_): instance of Zive class.  
2. `callback` (_Function_): `function (err, epId) { }`.  

**Returns:**  

* _none_  

**Examples:**  

*************************************************
<br />

<a name="API_list"></a>
### .list([ieeeAddrs])

**Arguments:**  

1. `ieeeAddrs` (_Array_):  

**Returns:**  

* (_Array_):  

**Examples:**  

```js
[ 
    {
        type: 'Router',
        ieeeAddr: '0x00124b0001ce4beb',
        nwkAddr: 55688,
        status: 'online',
        joinTime: 1469528238,
        manufId: 0,
        epList: [ 8 ],
    },
    {
        type: 'EndDevice',
        ieeeAddr: '0x00124b0001ce3631',
        nwkAddr: 11698,
        status: 'offline',
        joinTime: 1469528238,
        manufId: 0,
        epList: [ 8 ],
    }
]
```

*************************************************
<br />

<a name="API_find"></a>
### .find(addr, epId)

**Arguments:**  

1. `addr` (_String_ | _Number_): ieee(string) or nwk(number).  
2. `epId` (_Number_):  

**Returns:**  

* (_Object_): endpoint.  

**Examples:**  

*************************************************
<br />

<a name="API_lqi"></a>
### .lqi(ieeeAddr, callback)

**Arguments:**  

1. `ieeeAddr` (_String_):  
3. `callback` (_Function_): `function (err, rsp) { }`.  

**Returns:**  

* _none_  

**Examples:**  

*************************************************
<br />

<a name="API_remove"></a>
### .remove(ieeeAddr[, cfg][, callback])

**Arguments:**  

1. `ieeeAddr` (_String_):  
2. `cfg` (_Object_):  
    - `reJoin` (_Boolean_):  
    - `rmChildren` (_Boolean_):  
3. `callback` (_Function_): `function (err) { }`.  

**Returns:**  

* _none_  

**Examples:**  

*************************************************

<br />

<a name="Events"></a>
## 5. Events  

* [ind](#EVT_ind)  
* [zdo](#EVT_zdo)  

<br />

* ##### devIncoming  

    * msg.type: `'devIncoming'`  
    * msg.data: device  

* ##### devLeaving  

    * msg.type: `'devLeaving'`  
    * msg.data: `'0x00124b0001ce3631'`  

* ##### devOnline  

    * msg.type: `'devOnline'`  
    * msg.data: `'0x00124b0001ce3631'`  

* ##### devOffline  

    * msg.type: `'devOffline'`  
    * msg.data: `'0x00124b0001ce3631'`  

*************************************************

<br />

## Device Class

* [.getEndpoint()](#API_getEndpoint)  
* [.getIeeeAddr()](#API_getIeeeAddr)  
* [.getNwkAddr()](#API_getNwkAddr)  
* [.dump()](#API_dump)  

*************************************************

<br />

*************************************************

<br />

## Endpoint Class

* [.getDevice()](#API_getDevice)  
* [.getProfId()](#API_getProfId)  
* [.getEpId()](#API_getEpId)  
* [.getDevId()](#API_getDevId)  
* [.getInClusterList()](#API_getInClusterList)  
* [.getOutClusterList()](#API_getOutClusterList)  
* [.getIeeeAddr()](#API_getIeeeAddr)  
* [.getNwkAddr()](#API_getNwkAddr)  
* [.foundation()](#API_foundation)  
* [.functional()](#API_functional)  
* [.dump()](#API_dump)  

*************************************************

<br />

<br />

<a name="Contributors"></a>
## 6. Contributors  

* [Simen Li](https://www.npmjs.com/~simenkid)  
* [Hedy Wang](https://www.npmjs.com/~hedywings)  
* [Jack Wu](https://www.npmjs.com/~jackchased)  
