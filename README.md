# zigbee-shepherd
An open source ZigBee gateway solution with node.js.  

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
**zigbee-shepherd** is an open source ZigBee gateway solution implemented with node.js. It uses TI's [CC253X](http://www.ti.com/lsds/ti/wireless_connectivity/zigbee/overview.page) wireless SoC as a [zigbee network processor(ZNP)](https://github.com/zigbeer/cc-znp#2-zigbee-network-processor), and takes the ZNP approach to run the CC253X as a coordinator.  
  
[TODO]
**zigbee-shepherd** can also integrate with **zive**, a ZigBee ZCL application framework, into your gateway. With **zive**, third-parties can independently and easily build their applications as plugins without knowing of the z-stack behavior. Plugins are node.js modules off-the-shelf, all you have to do is just to require a module and then register it to **zigbee-shepherd** to enable the zigbee application. For example, I'm now working on a CIE (Control and Indicating Equipment) plugin for the zigbee IAS (Intruder Alarm System) application.  

It is fun to create something with node.js, like your own RESTful APIs, dashboard, funny applications.
I hope you enjoy it.  

With node.js, back-end developers can have RESTful APIs to bring zigbee machines to web world easily, and can push machines to the cloud as well. For front-end developers, they can do more creative things with Javascript, and can build any fascinating GUI they want with many cool UI frameworks.


ble-shepherd has all the features you need in controlling your BLE network, monitoring and operating BLE pheripheral devices. This controller has carried many network managing things for you, i.e., auto scanning for pheripheral devices, storing(/reloading) connected devices records to(/from) the built-in database, configuring connection parameters, and notifying online/offline status of devices with auto reconnection.

```js
peripheral.read('0x1800', '0x2a00', function (err, value) {
    // value is remotely read from the peripheral device
});
peripheral.write('0x1800', '0x2a02', { flag: false }, function (err) {
    // value is remotely write to the peripheral device
});
```

With ble-shepherd, you can get rid of such networking things and focus on your application logics. It opens another way of implementing IoT applications with BLE devices. With node.js, you can build your own application console(or dashboard) and design your own RESTful APIs in seconds. It's easy to make your BLE devices happy on the cloud.

The goal of mqtt-shepherd is to let you build and manage an MQTT machine network with less efforts, it is implemented as a server-side application framework with functionality of network and devices management, e.g. permission of device joining, device authentication, reading resources, writing resources, observing resources, and executing a procedure on the remote Devices. Furthermore, thanks to the power of node.js, making your own RESTful APIs to interact with your machines is also possible.


**zigbee-shepherd** is not only as a gateway, 
* The goal of **zigbee-shepherd** is to let you build and manage a ZigBee machine network with less efforts.  

* It is provided many functionality of network and endpoints management, e.g. permission of device joining, invoke zcl foundation or functional command to operate the remote Endpoints.  

* With **zigbee-shepherd**, you can implement a server-side zigbee application easily with the ZCL framework [zive](https://github.com/zigbeer/zive). It opens another way of implementing applications with zigbee coordinator.

#### Features
* Building your machine network with ZigBee devices.
* Creating zigbee application on coordinator is simple and quick.
* ZCL operations to read and write attributes.
* Based-on node.js. It's easy to integrate shepherd's application with other services or frameworks, e.g. http server, express, React.js, Angular.js.

<br />

<a name="Installation"></a>
## 2. Installation  

> $ npm install zigbee-shepherd --save

To use CC2530/31 as the coordinator, please download this [pre-built ZNP image](#) to your chip first. The pre-built image has compiled with things we need, such as ZDO callback and ZCL supports.  

<br />

<a name="Usage"></a>
## 3. Usage  

```js
var ZShepherd = require('zigbee-shepherd');
var shepherd = new ZShepherd('/dev/ttyUSB0');   // create a ZigBee server

shepherd.on('ready', function () {
    console.log('Server is ready.');

    // allow devices to join the network within 60 secs
    shepherd.permitJoin(60, function (err) {
        if (err)
            console.log(err);
    }); 
});

shepherd.start(function (err) {                 // start the server
    if (err)
        console.log(err);
});
```

<br />

<a name="APIs"></a>
## 4. APIs and Events  
This module provides you with **ZShepherd** and **Endpoint** classes.  

* **ZShepherd** class brings you a ZigBee Server with network managing facilities, i.e., start/stop the Server, permit device joining, find an joined endpoint. This document uses `shepherd` to denote the instance of this class.  

* **Endpoint** is the class for creating a software endpoint to represent the remote or local endpoint at server-side. This document uses `ep` to denote the instance of this class. You can invoke methods on an `ep` to operate the endpoint.  

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
Create a new instance of the `ZShepherd` class. The created instance is a Zigbee gateway that runs with node.js.  

**Arguments:**  

1. `path` (_String_): A string that refers to system path of the serial port connecting to your ZNP (CC253X), e.g., `'/dev/ttyUSB0'`.  
2. `opts` (_Object_): This value-object has two properties `sp` and `net` to configure the serial port and zigbee network settings.  
    - `sp` (_Object_): An optional object to [configure the seiralport](https://www.npmjs.com/package/serialport#serialport-path-options-opencallback). The following example shows the options with its default value.  
    - `net` (_Object_): An object to configure the network settings, and all properties in this object are optional. The descriptions are shown in the following table.  

| Property         | Type    | Mandatory | Description                                                                                                                                                    | Default value                                                                                      |
|------------------|---------|-----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| panId            | Number  | Optional  | Identifies the ZigBee PAN. This id should be a value between 0 and 0x3FFF. You can also set it to 0xFFFF to let ZNP choose a random PAN-ID on its own.         | 0xFFFF                                                                                             |
| channelList      | Array   | Optional  | Picks possible channels for your ZNP to start a PAN with. If only a single channel is given, ZNP will start a PAN with the channel you've picked.              | [ 14 ]                                                                                             |
| precfgkey        | Array   | Optional  | This is for securing and un-securing packets. It must be an array with 16 uint8 integers.                                                                      | [ 0x01, 0x03, 0x05, 0x07, 0x09, 0x0B, 0x0D, 0x0F, 0x00, 0x02, 0x04, 0x06, 0x08, 0x0A, 0x0C, 0x0D ] |
| precfgkeysEnable | Boolean | Optional  | To distribute the security key to all devices in the network or not.                                                                                           | true                                                                                               |

**Returns:**  

* (_Object_): shepherd  

**Examples:**  

```js
var ZShepherd = require('zigbee-shepherd');

var shepherd = new ZShepherd('/dev/ttyUSB0', {
    sp: {
        baudrate: 115200, 
        rtscts: true
    },
    net: {
        panId: 0x1234,
        channelList: [ 12, 14 ],    // pick CH12 and CH14
        precfgkey: [ 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
                     0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f ],
        precfgkeysEnable: true
    }
});
```

<br />
*************************************************
<a name="API_start"></a>
### .start([callback])
Connect to the ZNP and start shepherd.  

**Arguments:**  

1. `callback` (_Function_): `function (err) { }`. Get called when `shepherd` starts.  

**Returns:**  

* _none_  

**Examples:**  

```js
shepherd.start(function (err) {
    if (!err)
        console.log('shepherd is now running.');
});
```

<br />
*************************************************
<a name="API_stop"></a>
### .stop([callback])
Disconnect from the ZNP and stop shepherd.  

**Arguments:**  

1. `callback` (_Function_): `function (err) { }`. Get called when `shepherd` stops.  

**Returns:**  

* _none_  

**Examples:**  

```js
shepherd.stop(function (err) {
    if (!err)
        console.log('shepherd is stopped.');
});
```

<br />
*************************************************
<a name="API_reset"></a>
### .reset(mode[, callback])
Reset the ZNP.  

**Arguments:**  

1. `mode` (_String_ | _Number_): Set to `'hard'` or `0` to trigger the hardware reset (SoC resets), and set to `'soft'` or `1` to trigger the software reset (zstack resets).  
2. `callback` (_Function_): `function (err) { }`.  Get called when reset completes.  

**Returns:**  

* _none_  

**Examples:**  

```js
shepherd.reset(0, function (err) {
    if (!err)
        console.log('reset successfully.');
})
```

<br />
*************************************************
<a name="API_permitJoin"></a>
### .permitJoin(time[, type][, callback])
Allow or disallow devices to join the network.  

**Arguments:**  

1. `time` (_Number_): Time in seconds for shepherd to allow devices to join the network. This property accepts a value ranging from  `0` to `255`. Given with `0` can immediately close the admission and given with `255` will always allow devices to join in.  
2. `type` (_String_ | _Number_): Set it to `'coord'` or `0` to let devices join the network through the coordinater, and set it to `'all'` or `1` to let devices join the network through the coordinater or routers. The default value is `'all'`.  
3. `callback` (_Function_): `function (err) { }`. Get called when permitJoining process starts.  

**Returns:**  

* _none_  

**Examples:**  

```js
shepherd.permitJoin(60, function (err) {
    if (!err)
        console.log('ZNP is now allowing devices to join the network for 60 seconds.');
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

* (_Array_): An array of the devices records. Each record is a data object or `undefined` if device is not found.  

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
// [ undefined ]

shepherd.list( [ '0x00124b0001ce4beb', 'no_such_device', '0x00124b0001ce3631'] );
// [ 
//     {
//         type: 'Router',
//         ieeeAddr: '0x00124b0001ce4beb',
//         nwkAddr: 55688,
//         ...
//     },
//     undefined,
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
This class provides you with methods to operate the remote endpoints or local endpoints. An instance of this class is denoted as `ep` in this document.  

<br />
*************************************************
<a name="API_getSimpleDesc"></a>
### .getSimpleDesc()
Returns simple descriptor of the endpoint.  

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
var ep = shepherd.find('0x00124b0001ce4beb', 8);
ep.getSimpleDesc();

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
Returns ieee address of the device holding this endpoint.  

**Arguments:**  

1. none  

**Returns:**  

* (_String_): Ieee address of the device.  

**Examples:**  

```js
ep1.getIeeeAddr();    // '0x00124b0001ce4beb'
ep2.getIeeeAddr();    // '0x00124b0001ce3631'
```

<br />
*************************************************
<a name="API_getNwkAddr"></a>
### .getNwkAddr()
Returns network address of the device holding this endpoint.  

**Arguments:**  

1. none  

**Returns:**  

* (_Number_): Network address of the device.  

**Examples:**  

```js
ep1.getIeeeAddr();    // 55688
ep2.getIeeeAddr();    // 11698
```

<br />
*************************************************
<a name="API_foundation"></a>
### .foundation(cId, cmd, zclData[, cfg], callback)
Send ZCL foundation command to this endpoint. Response will be passed through second argument of the callback.  

**Arguments:**  

1. `cId` (_String_ | _Number_): [Cluster id](https://github.com/zigbeer/zcl-id#Table), i.e. `'genBasic'`, `0`, `'genOnOff'`, 6.  
2. `cmd` (_String_ | _Number_):  [ZCL foundation command id](https://github.com/zigbeer/zcl-packet#FoundCmdTbl), i.e. `'read'`, `0`, `'discover'`, `12`.  
3. `zclData` (_Object_ | _Array_): [zclData](https://github.com/zigbeer/zcl-packet#FoundCmdTbl), which depends on the specified command.  
4. `cfg` (_Object_):  
    - `manufSpec` (_Number_): Tells if this is a manufacturer-specific command. Deafult is `0`.  
    - `disDefaultRsp` (_Number_): Disable default response. Deafult is `0` to enable the default response.  
5. `callback` (_Function_): `function (err, rsp) { }`. Please refer to [**Playload** in foundation command table](https://github.com/zigbeer/zcl-packet#FoundCmdTbl) to learn more about the `rsp` object.  

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
Send ZCL functional command to this endpoint. The response will be passed to the second argument of the callback.  

**Arguments:**  

1. `cId` (_String_ | _Number_): [Cluster id](https://github.com/zigbeer/zcl-id#Table).  
2. `cmd` (_String_ | _Number_): [Functional command id](https://github.com/zigbeer/zcl-packet#FuncCmdTbl).  
3. `zclData` (_Object_ | _Array_): [zclData](https://github.com/zigbeer/zcl-packet#FuncCmdTbl) depending on the given command.  
4. `cfg` (_Object_):  
    - `manufSpec` (_Number_): Tells if this is a manufacturer-specific command. Deafult is `0`.  
    - `disDefaultRsp` (_Number_): Disable default response. Deafult is `0` to enable the default response.  
5. `callback` (_Function_): `function (err, rsp) { }`. Please refer to [**Arguments** in functional command table](https://github.com/zigbeer/zcl-packet#FuncCmdTbl) to learn more about the functional command `rsp` object.  

**Returns:**  

* _none_  

**Examples:**  

```js
ep.functional('genOnOff', 'toggle', {}, function (err, rsp) {
    if (!err)
        console.log(rsp);
// This example receives a 'defaultRsp'
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
Bind this endpoint to the other endpoint or to a group with the specified cluster.  

**Arguments:**  

1. `cId` (_String_ | _Number_): [Cluster id](https://github.com/zigbeer/zcl-id#Table).  
2. `dstEpOrGrpId` (_Object_ | _Number_): Bind this endpoint to the other endpoint if `dstEpOrGrpId` is given with an instance of the Endpoint class, or bind this endpoint to a group if it is given with a numeric id.  
3. `callback` (_Function_): `function (err) { }`. An error will occur if binding fails.  

**Returns:**  

* _none_  

**Examples:**  

```js
var ep1 = shepherd.find('0x00124b0001ce4beb', 8);
var ep2 = shepherd.find('0x00124b00014a7dd2', 12);

// bind ep1 to ep2
ep1.bind('genOnOff', ep2, function (err) {
    if (!err)
        console.log('Successfully bind ep1 to ep2!');
});

ep1.bind('genOnOff', 3, function (err) {
    if (!err)
        console.log('Successfully bind ep1 to group of id 3.');
});
```

<br />
*************************************************
<a name="API_unbind"></a>
### .unbind(cId, dstEpOrGrpId[, callback])
Unbind this endpoint from the other endpoint or from a group with the specified cluster.  

**Arguments:**  

1. `cId` (_String_ | _Number_): [Cluster id](https://github.com/zigbeer/zcl-id#Table).  
2. `dstEpOrGrpId` (_Object_ | _Number_): Unbind with endpoint if `dstEpOrGrpId` is given with an instance of the Endpoint class , or unbind this endpoint from a group if it is given with a numeric id.  
3. `callback` (_Function_): `function (err) { }`. An error will occur if unbinding fails.   

**Returns:**  

* _none_  

**Examples:**  

```js
ep1.unbind('genOnOff', ep2, function (err) {
    if (!err)
        console.log('Successfully unbind ep1 from ep2!');
});

ep1.unbind('genOnOff', 3, function (err) {
    if (!err)
        console.log('Successfully unbind ep1 from group of id 3.');
});
```

<br />
*************************************************
<a name="API_dump"></a>
### .dump()
Dump the endpoint record.  

**Arguments:**  

1. none  

**Returns:**  

* (_Object_): A data object, which is the endpoint record.  

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
ep.dump();

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

* [Jack Wu](https://www.npmjs.com/~jackchased)  
* [Hedy Wang](https://www.npmjs.com/~hedywings)  
* [Simen Li](https://www.npmjs.com/~simenkid)  

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
