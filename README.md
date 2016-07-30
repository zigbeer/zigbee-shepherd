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
4. [APIs and Events](#APIs)  
    * ZShepherd Class
    * Endpoint Class
5. [Contributors](#Contributors)  
6. [License](#License)  

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

```js
var ZShepherd = require('zigbee-shepherd');
var shepherd = new ZShepherd('/dev/ttyUSB0');    // create a ZigBee server

shepherd.on('ready', function () {
    console.log('Server is ready.');

    // allow devices to join the network within 60 secs
    shepherd.permitJoin(60, function (err) {
        if (err)
            console.log(err);
    }); 
});

shepherd.start(function (err) {    // start the server
    if (err)
        console.log(err);
});
```

<br />

<a name="APIs"></a>
## 4. APIs and Events  
This module provides you with **ZShepherd** and **Endpoint** classes.  

* The **ZShepherd** class brings you a ZigBee Server with network managing facilities, i.e., start/stop the Server, permit device joining, find an joined endpoint. This document uses `shepherd` to denote the instance of this class.  

* The **Endpoint** is the class for creating a software endpoint to represent the remote or local endpoint at server-side. This document uses `ep` to denote the instance of this class. You can invoke methods on an `ep` to operate the endpoint.  

* ZShepherd APIs  
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

* Endpoint APIs  
    * [.getSimpleDesc()](#API_getSimpleDesc)  
    * [.getIeeeAddr()](#API_getIeeeAddr)  
    * [.getNwkAddr()](#API_getNwkAddr)  
    * [.foundation()](#API_foundation)  
    * [.functional()](#API_functional)  
    * [.bind()](#API_bind)  
    * [.unbind()](#API_unbind)  
    * [.dump()](#API_dump)  

<br />
*************************************************
## ZShepherd Class
Exposed by `require('zigbee-shepherd')`  

<br />
*************************************************
<a name="API_ZShepherd"></a>
### new ZShepherd(path[, opts])
Create a new instance of the `ZShepherd` class. The created instance is a Zigbee server.  

**Arguments:**  

1. `path` (_String_): A string that refers to the serial port system path, e.g., `'/dev/ttyUSB0'`.  
2. `opts` (_Object_): This value-object has two properties `sp` and `net` to configure serial port and network.  
    - `sp` (_Object_): An object to set up the [seiralport configuration options](https://www.npmjs.com/package/serialport#serialport-path-options-opencallback). The following example shows the options with its default value.  
    - `net` (_Object_): An object to set up the network configuration with properties shown in the following table.  

| Property         | Type    | Mandatory | Description                                                                                                                                                    | Default value                                                                                      |
|------------------|---------|-----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| panId            | Number  | Optional  | Identifies the ZigBee network. This should be set to a value between 0 and 0x3FFF or set to a special value of 0xFFFF to indicate “don’t care”.                | 0xFFFF                                                                                             |
| channelList      | Array   | Optional  | Select the channels on which this network can operate. If multiple channels are selected, the coordinator will pick one of the channels for network operation. | [ 14 ]                                                                                             |
| precfgkey        | Array   | Optional  | This is used for securing and un-securing packets in the network.                                                                                              | [ 0x01, 0x03, 0x05, 0x07, 0x09, 0x0B, 0x0D, 0x0F, 0x00, 0x02, 0x04, 0x06, 0x08, 0x0A, 0x0C, 0x0D ] |
| precfgkeysEnable | Boolean | Optional  | Distribute the security key to all devices in the network or not.                                                                                              | true                                                                                               |

**Returns:**  

* (_Object_): shepherd  

**Examples:**  

```js
var ZShepherd = require('zigbee-shepherd');

var path = '/dev/ttyUSB0',
    opts = {
        sp: {
            baudrate: 115200, 
            rtscts: true
        },
        net: {
            panId: 0x1234,
            channelList: [ 12, 14 ],    //select CH12 and CH14
            precfgkey: [ 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
                         0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f ],
            precfgkeysEnable: true
        }
    };

var shepherd = new ZShepherd(path, opts);
```

<br />
*************************************************
<a name="API_start"></a>
### .start([callback])
Connect to the SoC and start ths shepherd.  

**Arguments:**  

1. `callback` (_Function_): `function (err) { }`. Get called when `shepherd` start to running.  

**Returns:**  

* _none_  

**Examples:**  

```js
shepherd.start(function (err) {
    if (!err)
        console.log('shepherd is running.');
});
```

<br />
*************************************************
<a name="API_stop"></a>
### .stop([callback])
Disconnect to the SoC and stop to run the shepherd.  

**Arguments:**  

1. `callback` (_Function_): `function (err) { }`. Get called when `shepherd` stop to running.  

**Returns:**  

* _none_  

**Examples:**  

```js
shepherd.stop(function (err) {
    if (!err)
        console.log('shepherd stop running.');
});
```

<br />
*************************************************
<a name="API_reset"></a>
### .reset(mode[, callback])
Reset the coordinator.  

**Arguments:**  

1. `mode` (_String_ | _Number_): Set mode to `'hard'` or `0` will reset the device by using a hardware reset, otherwise set to `'soft'` or `1` will reset by using a software reset.  
2. `callback` (_Function_): `function (err) { }`.  Get called when reset completes.  

**Returns:**  

* _none_  

**Examples:**  

```js
shepherd.reset(0, function (err) {
    if (!err)
        console.log('reset success');
})
```

<br />
*************************************************
<a name="API_permitJoin"></a>
### .permitJoin(time[, type][, callback])
Allow or disallow devices to join the network.  

**Arguments:**  

1. `time` (_Number_): Time in seconds for shepherd allowing devices to join the network. Range from  `0` to `255`, set to `0` can immediately close the admission and set to `255` can remain open the admission.  
2. `type` (_String_ | _Number_): Set type to `'coord'` or `0` will only opens the permissiom for coordinater, otherwise set to `'all'` or `1` will opens the permission for coordinate and all routers in the network. 'all' will be used by default.  
3. `callback` (_Function_): `function (err) { }`. Get called when setting completes.  

**Returns:**  

* _none_  

**Examples:**  

```js
shepherd.permitJoin(60, function (err) {
    if (!err)
        console.log('permit devices to join for 60 seconds ');
})
```

<br />
*************************************************
<a name="API_mount"></a>
### .mount(zApp, callback)
Mounts a zigbee application `zApp` that will be registered to the coordinator as a local endpoint, where `zApp` is an instance created by the ZCL framework [zive](https://github.com/zigbeer/zive). With **zive**, all you have to do is to plan your clusters well and **zive** itself will handle all ZCL messages for you.  

**Arguments:**  

1. `zApp` (_Object_): instance of Zive class.  
2. `callback` (_Function_): `function (err, epId) { }`. When `zApp` mounts to coordinator successfully, shepherd will return you a registered endpoint id. This `epId` is something that helps shepherd route all messages going to the `zApp`.  

**Returns:**  

* _none_  

**Examples:**  

```js
var myZbApp = require('./lib/myZbApp.js');  // myZbApp is an instance of Zive

shepherd.mount(myZbApp, function (err, epId) {
    if (!err)
        console.log(epId);  // 12
});
```

<br />
*************************************************
<a name="API_list"></a>
### .list([ieeeAddrs])
Lists the information of devices managed by shepherd. The argument accepts a single ieee address or an array of ieee addresses, and the output will always be an array of the corresponding records. All device records will be listed out if `ieeeAddrs` is not given.  

**Arguments:**  

1. `ieeeAddrs` (_String_ | _String[]_): The ieee address(es) of device(s) you'd like to list.  

**Returns:**  

* (_Array_): An array of the devices records. Each record is a data object or `null` if device is not found.  

**Examples:**  

```js
shepherd.list();    // list all

// [ 
//     {
//         type: 'Router',
//         ieeeAddr: '0x00124b0001ce4beb',
//         nwkAddr: 55688,
//         status: 'online',
//         joinTime: 1469528238,
//         manufId: 0,
//         epList: [ 8 ],
//     },
//     {
//         type: 'EndDevice',
//         ieeeAddr: '0x00124b0001ce3631',
//         nwkAddr: 11698,
//         status: 'offline',
//         joinTime: 1469528238,
//         manufId: 0,
//         epList: [ 8 ],
//     },
//     ...
// ]

shepherd.list('0x00124b0001ce4beb');    // equivalent to shepherd.list([ '0x00124b0001ce4beb' ]);
// [ 
//     {
//         type: 'Router',
//         ieeeAddr: '0x00124b0001ce4beb',
//         nwkAddr: 55688,
//         ...
//     }
// ]

shepherd.list('no_such_device');    // equivalent to shepherd.list([ 'no_such_device' ]);
// [ null ]

shepherd.list( [ '0x00124b0001ce4beb', 'no_such_device', '0x00124b0001ce3631'] );
// [ 
//     {
//         type: 'Router',
//         ieeeAddr: '0x00124b0001ce4beb',
//         nwkAddr: 55688,
//         ...
//     },
//     null,
//     {
//         type: 'EndDevice',
//         ieeeAddr: '0x00124b0001ce3631',
//         nwkAddr: 11698,
//         ...
//     }
// ]
```

<br />
*************************************************
<a name="API_find"></a>
### .find(addr, epId)
Find an endpoint instance by address and endpoint id.  

**Arguments:**  

1. `addr` (_String_ | _Number_): Find by ieee address if `addr` is given with a string, or find by network address if it is given with a number.  
2. `epId` (_Number_): The endpoint id to find with.  

**Returns:**  

* (_Object_): Returns the found endpoint, otherwise `undefined`.  

**Examples:**  

```js
shepherd.find('no_such_ieee_addr', 10);  // undefined, find no device by this ieee address
shepherd.find('0x00124b0001ce4beb', 7);  // undefined, find no device by this endpoint id
shepherd.find(1244, 10);                 // undefined, find no device by this network address
shepherd.find(1200, 7);                  // undefined, find no device by this endpoint id

shepherd.find(1200, 10);                 // object, the endpoint instance
shepherd.find('0x00124b0001ce4beb', 10); // object, the endpoint instance
```

<br />
*************************************************
<a name="API_lqi"></a>
### .lqi(ieeeAddr, callback)
Query the link quality index from a certain device by its ieee address.  

**Arguments:**  

1. `ieeeAddr` (_String_): Ieee address of the device.  
2. `callback` (_Function_): `function (err, data) { }`. This method returns you the link quality index via `data`. An error occurs if device not found.  

**Returns:**  

* _none_  

**Examples:**  

```js
shepherd.lqi('0x00124b0001ce4beb', function (err, data) {
    if (!err)
        console.log(data);  // 62
});
```

<br />
*************************************************
<a name="API_remove"></a>
### .remove(ieeeAddr[, cfg][, callback])
Remove the device from the network.  

**Arguments:**  

1. `ieeeAddr` (_String_): Ieee address of the device.  
2. `cfg` (_Object_):  
    - `reJoin` (_Boolean_): Set to `true` if device is allowed for re-joining, otherwise `false`. Deafult is `true`.  
    - `rmChildren` (_Boolean_): Set to `true` will remove all children of this device as well. Deafult is `false`.  
3. `callback` (_Function_): `function (err) { }`.  

**Returns:**  

* _none_  

**Examples:**  

```js
shepherd.remove('0x00124b0001ce4beb', function (err) {
    if (!err)
        console.log('Successfully removed!');
});

// remove and ban [TODO: how to unban????]
shepherd.remove('0x00124b0001ce4beb', { reJoin: false },function (err) {
    if (!err)
        console.log('Successfully removed!');
});
```

<br />
*************************************************
## Endpoint Class
This class provides you with methods to operate the remote endpoint or local endpoint. Such an instance of this class is denoted as `ep` in this document.  

<br />
*************************************************
<a name="API_getSimpleDesc"></a>
### .getSimpleDesc()
Returns the simple descriptor of the endpoint.  

**Arguments:**  

1. none  

**Returns:**  

* (_Object_): An object that contains information about the endpoint. Fields in this object are given in the following table.  

| Property       | Type   | Description                                                 |
|----------------|--------|-------------------------------------------------------------|
| profId         | Number | Profile id for this endpoint                                |
| epId           | Number | Endpoint id                                                 |
| devId          | Number | Device description id for this endpoint                     |
| inClusterList  | Array  | List of input cluster Ids                                   |
| outClusterList | Array  | List of output cluster Ids                                  |

**Examples:**  

```js
console.log(ep.getSimpleDesc());

// {
//     profId: 260,
//     epId: 8,
//     devId: 0,
//     inClusterList: [ 0, 3 ],
//     outClusterList: [ 3, 6 ]
// }
```

<br />
*************************************************
<a name="API_getIeeeAddr"></a>
### .getIeeeAddr()
Returns the ieee address for the owner of this endpoint.  

**Arguments:**  

1. none  

**Returns:**  

* (_String_): The ieee address of the device.  

**Examples:**  

```js
console.log(ep1.getIeeeAddr());    // '0x00124b0001ce4beb'
console.log(ep2.getIeeeAddr());    // '0x00124b0001ce3631'
```

<br />
*************************************************
<a name="API_getNwkAddr"></a>
### .getNwkAddr()
Returns the network address for the owner of this endpoint.  

**Arguments:**  

1. none  

**Returns:**  

* (_Number_): The network address of the device.  

**Examples:**  

```js
console.log(ep1.getIeeeAddr());    // 55688
console.log(ep2.getIeeeAddr());    // 11698
```

<br />
*************************************************
<a name="API_foundation"></a>
### .foundation(cId, cmd, zclData[, cfg], callback)
Send foundation command to this endpoint.  Response will be passed through second argument of the callback.  

**Arguments:**  

1. `cId` (_String_ | _Number_): [Cluster id](https://github.com/zigbeer/zcl-id#Table).  
2. `cmd` (_String_ | _Number_):  [Foundation command id](https://github.com/zigbeer/zcl-packet#FoundCmdTbl).
3. `zclData` (_Object_ | _Array_): [zclData](https://github.com/zigbeer/zcl-packet#FoundCmdTbl) depending on the given command.  
4. `cfg` (_Object_):  
    - `manufSpec` (_Number_): Manufacturer specific. Deafult is `0`.  
    - `disDefaultRsp` (_Number_): Disable default response. Deafult is `0`.  
5. `callback` (_Function_): `function (err, rsp) { }`.  

**Returns:**  

* _none_  

**Examples:**  

```js
ep.foundation('genBasic', 'read', [ { attrId: 3 }, { attrId: 4 } ], function (err, rsp) {
    if (!err)
        console.log(rsp);
// [
//     {
//         attrId: 3,     // hwVersion
//         status: 0,     // success
//         dataType: 32,  // uint8
//         attrData: 0
//     },
//     {
//         attrId: 3,     // manufacturerName
//         status: 0,     // success
//         dataType: 66,  // charStr
//         attrData: 'TexasInstruments'
//     }
// ]
});
```

<br />
*************************************************
<a name="API_functional"></a>
### .functional(cId, cmd, zclData[, cfg], callback)
Send functional command to this endpoint. The response will be passed through the callback.  

**Arguments:**  

1. `cId` (_String_ | _Number_): [Cluster id](https://github.com/zigbeer/zcl-id#Table).  
2. `cmd` (_String_ | _Number_): [Functional command id](https://github.com/zigbeer/zcl-packet#FuncCmdTbl).  
3. `zclData` (_Object_ | _Array_): [zclData](https://github.com/zigbeer/zcl-packet#FuncCmdTbl) depending on the given command.  
4. `cfg` (_Object_):  
    - `manufSpec` (_Number_): Manufacturer specific. Deafult is `0`.  
    - `disDefaultRsp` (_Number_): Disable default response. Deafult is `0`.  
5. `callback` (_Function_): `function (err, rsp) { }`.  

**Returns:**  

* _none_  

**Examples:**  

```js
ep.functional('genOnOff', 'toggle', { }, function (err, rsp) {
    if (!err)
        console.log(rsp);
// {
//     cmdId: 2,
//     statusCode: 0
// }
});
```

<br />
*************************************************
<a name="API_bind"></a>
### .bind(cId, dstEpOrGrpId[, callback])

**Arguments:**  

1. `cId` (_String_ | _Number_): [Cluster id](https://github.com/zigbeer/zcl-id#Table).  
2. `dstEpOrGrpId` (_Object_ | _Number_): Bind with endpoint if `dstEpOrGrpId` is given with an instance of this class , or bind with group id if it is given with a number.  
3. `callback` (_Function_): `function (err) { }`.  

**Returns:**  

* _none_  

**Examples:**  

```js
ep1.bind('genOnOff', ep2, function (err) {
    if (!err)
        console.log('Successfully binded with ep2!');
});

ep1.bind('genOnOff', 3, function (err) {
    if (!err)
        console.log('Successfully binded with groupId: 3!');
});
```

<br />
*************************************************
<a name="API_unbind"></a>
### .unbind(cId, dstEpOrGrpId[, callback])

**Arguments:**  

1. `cId` (_String_ | _Number_): [Cluster id](https://github.com/zigbeer/zcl-id#Table).  
2. `dstEpOrGrpId` (_Object_ | _Number_): Unbind with endpoint if `dstEpOrGrpId` is given with an instance of this class , or unbind with group id if it is given with a number.  
3. `callback` (_Function_): `function (err) { }`.  

**Returns:**  

* _none_  

**Examples:**  

```js
ep1.unbind('genOnOff', ep2, function (err) {
    if (!err)
        console.log('Successfully unbinded with ep2!');
});

ep1.unbind('genOnOff', 3, function (err) {
    if (!err)
        console.log('Successfully unbinded with groupId: 3!');
});
```

<br />
*************************************************
<a name="API_dump"></a>
### .dump()
Dump record of the Endpoint.

**Arguments:**  

1. none  

**Returns:**  

* (_Object_): A data object of endpoint record.  

| Property       | Type   | Description                                                 |
|----------------|--------|-------------------------------------------------------------|
| profId         | Number | Profile id for this endpoint                                |
| epId           | Number | Endpoint id                                                 |
| devId          | Number | Device description id for this endpoint                     |
| inClusterList  | Array  | List of input cluster Ids                                   |
| outClusterList | Array  | List of output cluster Ids                                  |
| clusters       | Object | Clusters information                                        |

**Examples:**  

```js
console.log(ep.dump());

// {
//     profId: 260,
//     epId: 8,
//     devId: 0,
//     inClusterList: [ 0, 3 ],
//     outClusterList: [ 3, 6 ],
//     clusters: {
//         genBasic: {
//             dir: 1,
//             attrs: {
//                 hwVersion: { value: 0 },
//                 manufacturerName: { value: 'TexasInstruments' },
//                 modelId: { value: 'TI0001          ' },
//                 dateCode: { value: '20060831        ' },
//                 powerSource: { value: 1 },
//                 locationDesc: { value: '                ' },
//                 physicalEnv: { value: 0 },
//                 deviceEnabled: { value: 1 }
//             }
//         },
//         genIdentify: {
//             dir: 3,
//             attrs: {
//                 identifyTime: { value: 0 }
//             }
//         },
//         genOnOff:{
//             dir: 2,
//             attrs: {
//                 onOff: { value: 0 }
//             }
//         }
//     }
// }
```

*************************************************

<br />

<a name="Contributors"></a>
## 5. Contributors  

* [Simen Li](https://www.npmjs.com/~simenkid)  
* [Hedy Wang](https://www.npmjs.com/~hedywings)  
* [Jack Wu](https://www.npmjs.com/~jackchased)  

<br />

<a name="License"></a>
## 6. License  

The MIT License (MIT)

Copyright (c) 2016  
Jack Wu <jackchased@gmail.com>, Hedy Wang <hedywings@gmail.com>, and Simen Li <simenkid@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
