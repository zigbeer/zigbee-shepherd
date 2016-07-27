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

* [new ZigbeeShepherd()](#API_ZigbeeShepherd) 
* [.start()](#API_start)  
* [.stop()](#API_stop)  
* [.reset()](#API_reset)  
* [.permitjoin()](#API_permitjoin)  
* [.registerZApp()](#API_registerZApp)  
* [.listDevices()](#API_listDevices)  
* [.find()](#API_find)  
* [.bind()](#API_bind)  
* [.unbind()](#API_unbind)  
* [.remove()](#API_remove)  

*************************************************
<br />

## ZigbeeShepherd Class
Exposed by `require('zigbee-shepherd')`  

*************************************************
<br />

<a name="API_ZigbeeShepherd"></a>
### new ZigbeeShepherd(cfg)

**Arguments:**  

1. `cfg` (_Object_): This value-object has two properties `path` and `options` to configure the serial port.  
    - `path`: A string that refers to the serial port system path, e.g., `'/dev/ttyUSB0'`  
    - `options`: An object to set up the [seiralport](https://www.npmjs.com/package/serialport#serialport-path-options-opencallback).  

**Returns:**  

**Examples:**  

*************************************************
<br />

<a name="API_start"></a>
### .start(app[, callback])

**Arguments:**  

1. `app` (_Function_): App which will be called after initialization completes.  
2. `callback` (_Function_): `function (err) { }`. Get called after the initializing procedure is done.  

**Returns:**  

**Examples:**  

*************************************************
<br />

<a name="API_stop"></a>
### .stop([callback])

**Arguments:**  

1. `callback` (_Function_): `function (err) { }`. Get called when stop to running.  

**Returns:**  

**Examples:**  

*************************************************
<br />

<a name="API_reset"></a>
### .reset(mode[, callback])

**Arguments:**  

1. `mode` (_String_ | _Number_): hard reset `'hard'` or `0`, soft reset `'soft'` or `1`.  
2. `callback` (_Function_): `function (err) { }`. Get called when reset completes.  

**Returns:**  

**Examples:**  

*************************************************
<br />

<a name="API_permitjoin"></a>
### .permitjoin(type, time[, callback])

**Arguments:**  

1. `type` (_String_ | _Number_): coord `'coord'` or `0`, coord and routers `'all'` or `1`  
2. `time` (_Number_): Jointime. Range from  0 to 255.  
3. `callback` (_Function_): `function (err, rsp) { }`.  

**Returns:**  

**Examples:**  

*************************************************
<br />

<a name="API_registerZApp"></a>
### .registerZApp(zApp, callback)

**Arguments:**  

1. `zApp` (_Object_): instance of Zive class.  
2. `callback` (_Function_): `function (err, zApp) { }`.  

**Returns:**  

**Examples:**  

*************************************************
<br />

<a name="API_listDevices"></a>
### .listDevices()

**Arguments:**  

1. none  

**Returns:**  

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
        endpoints: { '8': { profId: 'HA', devId: 'onOffLight' } }
    },
    {
        type: 'EndDevice',
        ieeeAddr: '0x00124b0001ce3631',
        nwkAddr: 11698,
        status: 'offline',
        joinTime: 1469528238,
        manufId: 0,
        epList: [ 8 ],
        endpoints: { '8': { profId: 'HA', devId: 'onOffSwitch' } }
    }
]
```

*************************************************
<br />

<a name="API_find"></a>
### .find(ieeeAddr)

**Arguments:**  

1. `ieeeAddr` (_String_): Ieee Address, `'0x00124b0001ce3631'`.  

**Returns:**  

* (_Object_): device. Returns `undefined` if not found.  

**Examples:**  

*************************************************
<br />

<a name="API_bind"></a>
### .bind(srcEp, dstEp, cId[, grpId][, callback])

**Arguments:**  

1. `srcEp` (_Object_): source endpoint.  
2. `dstEp` (_Object_): destination endpoint.  
3. `cId` (_String_ | _Number_): Specifies the cluster Id.  
4. `grpId` (_Number_): group Id.  
5. `callback` (_Function_): `function (err, rsp) { }`.  

**Returns:**  

**Examples:**  

*************************************************
<br />

<a name="API_unbind"></a>
### .unbind(srcEp, dstEp, cId[, grpId][, callback])

**Arguments:**  

1. `srcEp` (_Object_): source endpoint.  
2. `dstEp` (_Object_): destination endpoint.  
3. `cId` (_String_ | _Number_): Specifies the cluster Id.  
4. `grpId` (_Number_): group Id.  
5. `callback` (_Function_): `function (err, rsp) { }`.  

**Returns:**  

**Examples:**  

*************************************************
<br />

<a name="API_remove"></a>
### .remove(dev, cfg[, callback])

**Arguments:**  

1. `dev` (_Object_): device.  
2. `cfg` (_Object_): This value-object has two properties `path` and `options`  
    - `rejoin` (_Boolean_):  
    - `rmchildren` (_Boolean_):  
3. `callback` (_Function_): `function (err, rsp) { }`.  

**Returns:**  

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

<br />

<a name="Contributors"></a>
## 6. Contributors  

* [Simen Li](https://www.npmjs.com/~simenkid)  
* [Hedy Wang](https://www.npmjs.com/~hedywings)  
* [Jack Wu](https://www.npmjs.com/~jackchased)  
