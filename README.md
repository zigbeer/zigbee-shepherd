# zigbee-shepherd
An open source ZigBee gateway solution with node.js.  

[![NPM](https://nodei.co/npm/zigbee-shepherd.png?downloads=true)](https://nodei.co/npm/zigbee-shepherd/)  

[![Travis branch](https://img.shields.io/travis/zigbeer/zigbee-shepherd/master.svg?maxAge=2592000)](https://travis-ci.org/zigbeer/zigbee-shepherd)
[![npm](https://img.shields.io/npm/v/zigbee-shepherd.svg?maxAge=2592000)](https://www.npmjs.com/package/zigbee-shepherd)
[![npm](https://img.shields.io/npm/l/zigbee-shepherd.svg?maxAge=2592000)](https://www.npmjs.com/package/zigbee-shepherd)

<br />

## Table of Contents  

1. [Overview](#Overview)  
2. [Installation](#Installation)  
3. [Usage](#Usage)  
4. [APIs and Events](#APIs)  
5. [Debug Messages](#Debug)  
6. [Contributors](#Contributors)  
7. [License](#License)  

<br />

<a name="Overview"></a>
## 1. Overview  

**zigbee-shepherd** is an open source ZigBee gateway solution with node.js. It uses TI's [CC253X](http://www.ti.com/lsds/ti/wireless_connectivity/zigbee/overview.page) wireless SoC as a [zigbee network processor (ZNP)](http://www.ti.com/lit/an/swra444/swra444.pdf), and takes the ZNP approach with [cc-znp](https://github.com/zigbeer/cc-znp) to run the CC253X as a coordinator and to run zigbee-shepherd as the host. zigbee-shepherd has carried many network managing things for you, i.e., storing(/reloading) connected devices and endpoints records to(/from) the built-in database, permission of device joining, endpoints binding, and indications of device incoming and leaving.  
  
This gateway solution also works well with the ZigBee ZCL application framework - [**_zive_**](https://github.com/zigbeer/zive) to help developers build zigbee application with a real endpoint firmed on the coordinator. With **_zive_**, third-parties can independently make their zigbee applications as plugins without knowing of the z-stack behavior. The concept of plugin is really cool. When you like a zigbee IAS (Intruder Alarm System) application on your gateway, just download the plugin and register it to zigbee-shepherd, and now you have an IAS service at your home in seconds. (I'm now working on a CIE (Control and Indicating Equipment) plugin for the zigbee IAS application.)  
  
zigbee-shepherd provides a nice environment for front-end and back-end web developers to use their familiar language - _**JavaScript**_, to build ZigBee applications. With node.js, they can have their own RESTful APIs to bring ZigBee machines to web world, can push machines to the cloud, can have a great machine database, can create an account system, and can build any fascinating GUI and dashboard with many cool UI frameworks. With zigbee-shepherd, now web developers can do a lot of IoT things with ZigBee! It brings opportunities for app developers as well as opens another way of implementing IoT applications with ZigBee devices.  
  
Let's do something fun with ZigBee! I hope you enjoy it!  

<br />

<a name="Installation"></a>
## 2. Installation  

* Install zigbee-shepherd

> $ npm install zigbee-shepherd --save

* Hardware
    - [SmartRF05EB (with CC2530EM)](http://www.ti.com/tool/cc2530dk)  
    - [CC2531 USB Stick](http://www.ti.com/tool/cc2531emk)  
    - CC2538 (Not tested. I don't have the kit.)  
    - CC2630/CC2650 (Not tested. I don't have the kit.)  

* Firmware
    - To use CC2530/31 as the coordinator, please download the [pre-built ZNP image](https://github.com/zigbeer/documents/tree/master/zigbee-shepherd) to your chip first. The pre-built image has compiled as a ZNP with ZDO callback, ZCL supports, and functions we need.  

<br />

<a name="Usage"></a>
## 3. Usage  

* Start the shepherd

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

* Interact with remote endpoints, here is a quick example:

```js
// find the joined endpoint by it's address and endpoint id
var ep = shepherd.find('0x00124b0001ce4beb', 6);    // returns undefined if not found

// use foundation command to read attributes from a remote endpoint
ep.foundation('genBasic', 'read', [ { attrId: 3 }, { attrId: 4 } ], function (err, rsp) {
    if (!err)
        console.log(rsp);
// [
//     { attrId: 3, status: 0, dataType: 32, attrData: 0 },
//     { attrId: 4, status: 0, dataType: 66, attrData: 'TexasInstruments' }
// ]
});

// or use the shorthand read() method to read a single attribute
ep.read('genBasic', 'manufacturerName', function (err, data) {
    if (!err)
        console.log(data);   // 'TexasInstruments'
});

// use functional command to operate a remote endpoint
ep.functional('genOnOff', 'toggle', {}, function (err, rsp) {
    if (!err)
        console.log(rsp); // { cmdId: 2, statusCode: 0 }
});
```

<br />

<a name="APIs"></a>
## 4. APIs and Events  
This module provides you with **ZShepherd** and **Endpoint** classes.  

* **ZShepherd** class brings you a ZigBee Server with network managing facilities, i.e., start/stop the Server, permit device joining, find a joined endpoint. This document uses `shepherd` to denote the instance of this class.  

* **Endpoint** is the class for creating a software endpoint to represent the remote or local endpoint at server-side. This document uses `ep` to denote the instance of this class. You can invoke methods on an `ep` to operate the endpoint.  

* **ZShepherd APIs**  
    * [new ZShepherd()](#API_ZShepherd)  
    * [.start()](#API_start)  
    * [.stop()](#API_stop)  
    * [.reset()](#API_reset)  
    * [.permitJoin()](#API_permitJoin)  
    * [.info()](#API_info)  
    * [.mount()](#API_mount)  
    * [.list()](#API_list)  
    * [.find()](#API_find)  
    * [.lqi()](#API_lqi)  
    * [.remove()](#API_remove)  
    * Events: [ready](#EVT_ready), [error](#EVT_error), [permitJoining](#EVT_permit), and [ind](#EVT_ind)  

* **Endpoint APIs**  
    * [.getSimpleDesc()](#API_getSimpleDesc)  
    * [.getIeeeAddr()](#API_getIeeeAddr)  
    * [.getNwkAddr()](#API_getNwkAddr)  
    * [.foundation()](#API_foundation)  
    * [.functional()](#API_functional)  
    * [.read()](#API_read)  
    * [.bind()](#API_bind)  
    * [.unbind()](#API_unbind)  
    * [.dump()](#API_dump)  

<br />

## ZShepherd Class
Exposed by `require('zigbee-shepherd')`  
  
*************************************************

<a name="API_ZShepherd"></a>
### new ZShepherd(path[, opts])
Create a new instance of the `ZShepherd` class. The created instance is a ZigBee gateway that runs with node.js.  

**Arguments:**  

1. `path` (_String_): A string that refers to system path of the serial port connecting to your ZNP (CC253X), e.g., `'/dev/ttyUSB0'`.  
2. `opts` (_Object_): This value-object has three properties `sp`, `net` and `dbPath` to configure the serial port, zigbee network settings and database file path.  
    - `sp` (_Object_): An optional object to [configure the seiralport](https://www.npmjs.com/package/serialport#serialport-path-options-opencallback). Default is `{ baudrate: 115200, rtscts: true }`.  
    - `net` (_Object_): An object to configure the network settings, and all properties in this object are optional. The descriptions are shown in the following table.  
    - `dbPath` (_String_): Set database file path, default is `__dirname + '/database/dev.db'`.

| Property           | Type    | Mandatory | Description                                                                                                                                                    | Default value                                                                                      |
|--------------------|---------|-----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| panId              | Number  | Optional  | Identifies the ZigBee PAN. This id should be a value between 0 and 0x3FFF. You can also set it to 0xFFFF to let ZNP choose a random PAN-ID on its own.         | 0xFFFF                                                                                             |
| channelList        | Array   | Optional  | Picks possible channels for your ZNP to start a PAN with. If only a single channel is given, ZNP will start a PAN with the channel you've picked.              | [ 11 ]                                                                                             |
| precfgkey          | Array   | Optional  | This is for securing and un-securing packets. It must be an array with 16 uint8 integers.                                                                      | [ 0x01, 0x03, 0x05, 0x07, 0x09, 0x0B, 0x0D, 0x0F, 0x00, 0x02, 0x04, 0x06, 0x08, 0x0A, 0x0C, 0x0D ] |
| precfgkeysEnable   | Boolean | Optional  | To distribute the security key to all devices in the network or not.                                                                                           | true                                                                                               |
| startoptClearState | Boolean | Optional  | If this option is set, the device will clear its previous network state. This is typically used during application development.                                | false                                                                                              |

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

*************************************************

<a name="API_start"></a>
### .start([callback])
Connect to the ZNP and start shepherd.  

**Arguments:**  

1. `callback` (_Function_): `function (err) { }`. Get called when `shepherd` starts.  

**Returns:**  

* (_Promise_): promise  

**Examples:**  

```js
// callback style
shepherd.start(function (err) {
    if (!err)
        console.log('shepherd is now running.');
});

// promise style
shepherd.start().then(function() {
    console.log('shepherd is now running.');
}).done();
```

*************************************************

<a name="API_stop"></a>
### .stop([callback])
Disconnect from the ZNP and stop shepherd.  

**Arguments:**  

1. `callback` (_Function_): `function (err) { }`. Get called when `shepherd` stops.  

**Returns:**  

* (_Promise_): promise  

**Examples:**  

```js
shepherd.stop(function (err) {
    if (!err)
        console.log('shepherd is stopped.');
});
```

*************************************************

<a name="API_reset"></a>
### .reset(mode[, callback])
Reset the ZNP.  

**Arguments:**  

1. `mode` (_String_ | _Number_): Set to `'hard'` or `0` to trigger the hardware reset (SoC resets), and set to `'soft'` or `1` to trigger the software reset (zstack resets).  
2. `callback` (_Function_): `function (err) { }`.  Get called when reset completes.  

**Returns:**  

* (_Promise_): promise  

**Examples:**  

```js
// hard reset
shepherd.reset(0, function (err) {
    if (!err)
        console.log('reset successfully.');
});

// soft reset
shepherd.reset('soft', function (err) {
    if (!err)
        console.log('reset successfully.');
});
```

*************************************************

<a name="API_permitJoin"></a>
### .permitJoin(time[, type][, callback])
Allow or disallow devices to join the network. A `permitJoining` event will be fired every tick of countdown (per second) when `shepherd` is allowing device to join its network.  

**Arguments:**  

1. `time` (_Number_): Time in seconds for shepherd to allow devices to join the network. This property accepts a value ranging from  `0` to `255`. Given with `0` can immediately close the admission and given with `255` will always allow devices to join in.  
2. `type` (_String_ | _Number_): Set it to `'coord'` or `0` to let devices join the network through the coordinator, and set it to `'all'` or `1` to let devices join the network through the coordinator or routers. The default value is `'all'`.  
3. `callback` (_Function_): `function (err) { }`. Get called when permitJoining process starts.  

**Returns:**  

* (_Promise_): promise  

**Examples:**  

```js
shepherd.on('permitJoining', function (joinTimeLeft) {
    console.log(joinTimeLeft);
});

// default is allow devices to join coordinator or routers
shepherd.permitJoin(60, function (err) {
    if (!err)
        console.log('ZNP is now allowing devices to join the network for 60 seconds.');
});

// allow devices only to join coordinator
shepherd.permitJoin(60, 'coord');
```

*************************************************

<a name="API_info"></a>
### .info()
Returns shepherd information.

**Arguments:**  

1. none  

**Returns:**  

* (_Object_): An object that contains information about the server. Properties in this object are given in the following table.  

    | Property       | Type    | Description                                                                   |
    |----------------|---------|-------------------------------------------------------------------------------|
    | enabled        | Boolean | Server is up(`true`) or down(`false`)                                         |
    | net            | Object  | Network information, `{ state, channel, panId, extPanId, ieeeAddr, nwkAddr }` |
    | startTime      | Number  | Unix Time (secs from 1970/1/1)                                                |
    | joinTimeLeft   | Number  | How many seconds left for allowing devices to join the Network                |

**Examples:**  

```js
shepherd.info();

/*
{
    enabled: true,
    net: {
        state: 'Coordinator',
        channel: 11,
        panId: '0x7c71',
        extPanId: '0xdddddddddddddddd',
        ieeeAddr: '0x00124b0001709887',
        nwkAddr: 0,
    },
    startTime: 1473415541,
    joinTimeLeft: 49
}
*/
```

*************************************************

<a name="API_mount"></a>
### .mount(zApp, callback)
Mounts a zigbee application `zApp` that will be registered to the coordinator as a local endpoint, where `zApp` is an instance created by the ZCL framework [zive](https://github.com/zigbeer/zive). With **zive**, all you have to do is to plan your clusters well and **zive** itself will handle all ZCL messages for you.  

**Arguments:**  

1. `zApp` (_Object_): instance of Zive class.  
2. `callback` (_Function_): `function (err, epId) { }`. When `zApp` mounts to coordinator successfully, shepherd will return you a registered endpoint id. This `epId` is something that helps shepherd route all messages going to the `zApp`.  

**Returns:**  

* (_Promise_): promise  

**Examples:**  

```js
var myZbApp = require('./lib/myZbApp.js');  // myZbApp is an instance of Zive

shepherd.mount(myZbApp, function (err, epId) {
    if (!err)
        console.log(epId);  // 12
});
```

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

*************************************************

<a name="API_lqi"></a>
### .lqi(ieeeAddr, callback)
Query the link quality index from a certain device by its ieee address.  

**Arguments:**  

1. `ieeeAddr` (_String_): Ieee address of the device.  
2. `callback` (_Function_): `function (err, data) { }`. This method returns you the link quality index via `data`. An error occurs if device not found.  

**Returns:**  

* (_Promise_): promise  

**Examples:**  

```js
shepherd.lqi('0x00124b0001ce4beb', function (err, data) {
    if (!err)
        console.log(data);
    // [
    //     {
    //         ieeeAddr: '0x00124b0001ce3631',
    //         lqi: 62
    //     },
    //     {
    //         ieeeAddr: '0x00124b00019c2ee9',
    //         lqi: 70
    //     }
    // ]
});
```

*************************************************

<a name="API_remove"></a>
### .remove(ieeeAddr[, cfg][, callback])
Remove the device from the network.  

**Arguments:**  

1. `ieeeAddr` (_String_): Ieee address of the device.  
2. `cfg` (_Object_):  
    - `reJoin` (_Boolean_): Set to `true` if device is allowed for re-joining, otherwise `false`. Default is `true`.  
    - `rmChildren` (_Boolean_): Set to `true` will remove all children of this device as well. Default is `false`.  
3. `callback` (_Function_): `function (err) { }`.  

**Returns:**  

* (_Promise_): promise  

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

*************************************************

<a name="EVT_ready"></a>
### Event: 'ready'  
Listener: `function () { }`  
Fired when Server is ready.  

*************************************************

<a name="EVT_error"></a>
### Event: 'error'  
Listener: `function (err) { }`  
Fired when there is an error occurs.  

*************************************************

<a name="EVT_permit"></a>
### Event: 'permitJoining'
Listener: `function (joinTimeLeft) {}`  
Fired when the Server is allowing for devices to join the network, where `joinTimeLeft` is number of seconds left to allow devices to join the network. This event will be triggered at each tick of countdown (per second).  

*************************************************

<a name="EVT_ind"></a>
### Event: 'ind'
Listener: `function (msg) { }`  
Fired when there is an incoming indication message. The `msg` is an object with the properties given in the table:  

| Property       | Type                 | Description                                                                                                                                                    |
|----------------|----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| type           | String               | Indication type, can be `'devIncoming'`, `'devLeaving'`, `'devChange'`, and `'devStatus'`.                                                                     |
| endpoints      | Object[] \| Number[] | An array of the endpoint instance, except that when `type === 'devLeaving'`, endpoints will be an array of the endpoint id (since endpoints have been removed) |
| data           | Depends              | Data along with the indication, which depends on the type of indication                                                                                        |


* ##### devIncoming  
    Fired when there is a ZigBee Device incoming to the network.  

    * msg.type: `'devIncoming'`  
    * msg.endpoints: `[ ep, ... ]`  
    * msg.data: `'0x00124b0001ce4beb'`, the ieee address of which device is incoming.  
    ```js
    {
        type: 'devIncoming',
        endpoints: [ ep_instance, ep_instance ],
        data: '0x00124b0001ce4beb'
    }
    ```

* ##### devLeaving  
    Fired when there is a ZigBee Device leaving the network.  

    * msg.type: `'devLeaving'`  
    * msg.endpoints: `[ epId, ... ]`, the endpoint id of which endpoint is leaving  
    * msg.data: `'0x00124b0001ce4beb'`, the ieee address of which device is leaving.  
    ```js
    {
        type: 'devLeaving',
        endpoints: [ epId, epId ],
        data: '0x00124b0001ce4beb'
    }
    ```

* ##### devChange  
    Fired when the Server perceives that there is any change of _Attributes_ from ZCL foundation/functional responses.  

    * msg.type: `'devChange'`  
    * msg.endpoints: `[ep]`  
    * msg.data: Content of the changes. This object has fields of `cid` and `data`.  
    ```js
    {
        type: 'devChange',
        endpoints: [ ep_instance ],
        data: {
            cid: 'genOnOff',
            data: {
                onOff: 1
            }
        }
    }
    ```

* ##### devStatus  
    Fired when there is a ZigBee Device going online or going offline.  

    * msg.type: `'devStatus'`  
    * msg.endpoints: `[ ep, ... ]`  
    * msg.data: `'online'` or `'offline'`  
    ```js
    {
        type: 'devStatus',
        endpoints: [ ep_instance, ep_instance ],
        data: 'online'
    }
    ```

*************************************************

<br />

## Endpoint Class
This class provides you with methods to operate the remote endpoints or local endpoints. An instance of this class is denoted as `ep` in this document.  

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
ep1.getNwkAddr();    // 55688
ep2.getNwkAddr();    // 11698
```

*************************************************

<a name="API_foundation"></a>
### .foundation(cId, cmd, zclData[, cfg], callback)
Send ZCL foundation command to this endpoint. Response will be passed through second argument of the callback.  

**Arguments:**  

1. `cId` (_String_ | _Number_): [Cluster id](https://github.com/zigbeer/zcl-id#Table), i.e. `'genBasic'`, `0`, `'genOnOff'`, `6`.  
2. `cmd` (_String_ | _Number_): [ZCL foundation command id](https://github.com/zigbeer/zcl-packet#FoundCmdTbl), i.e. `'read'`, `0`, `'discover'`, `12`.  
3. `zclData` (_Object_ | _Array_): [zclData](https://github.com/zigbeer/zcl-packet#FoundCmdTbl), which depends on the specified command.  
4. `cfg` (_Object_):  
    - `manufSpec` (_Number_): Tells if this is a manufacturer-specific command. Default is `0`.  
    - `disDefaultRsp` (_Number_): Disable default response. Default is `0` to enable the default response.  
5. `callback` (_Function_): `function (err, rsp) { }`. Please refer to [**Payload** in foundation command table](https://github.com/zigbeer/zcl-packet#FoundCmdTbl) to learn more about the `rsp` object.  

**Returns:**  

* (_Promise_): promise  

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
//         attrId: 4,     // manufacturerName
//         status: 0,     // success
//         dataType: 66,  // charStr
//         attrData: 'TexasInstruments'
//     }
// ]
});
```

*************************************************

<a name="API_functional"></a>
### .functional(cId, cmd, zclData[, cfg], callback)
Send ZCL functional command to this endpoint. The response will be passed to the second argument of the callback.  

**Arguments:**  

1. `cId` (_String_ | _Number_): [Cluster id](https://github.com/zigbeer/zcl-id#Table).  
2. `cmd` (_String_ | _Number_): [Functional command id](https://github.com/zigbeer/zcl-packet#FuncCmdTbl).  
3. `zclData` (_Object_ | _Array_): [zclData](https://github.com/zigbeer/zcl-packet#FuncCmdTbl) depending on the given command.  
4. `cfg` (_Object_):  
    - `manufSpec` (_Number_): Tells if this is a manufacturer-specific command. Default is `0`.  
    - `disDefaultRsp` (_Number_): Disable default response. Default is `0` to enable the default response.  
5. `callback` (_Function_): `function (err, rsp) { }`. Please refer to [**Arguments** in functional command table](https://github.com/zigbeer/zcl-packet#FuncCmdTbl) to learn more about the functional command `rsp` object.  

**Returns:**  

* (_Promise_): promise  

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

*************************************************

<a name="API_read"></a>
### .read(cId, attrId, callback)
The shorthand to read a single attribute.  

**Arguments:**  

1. `cId` (_String_ | _Number_): [Cluster id](https://github.com/zigbeer/zcl-id#Table).  
2. `attrId` (_Object_ | _Array_): [Attribute id](https://github.com/zigbeer/zcl-id/blob/master/definitions/cluster_defs.json) of which attribute you like to read.  
3. `callback` (_Function_): `function (err, data) { }`. This `data` is the attribute value.

**Returns:**  

* (_Promise_): promise  

**Examples:**  

```js
ep.read('genBasic', 'manufacturerName', function (err, data) {
    if (!err)
        console.log(data);    // 'TexasInstruments'
});
```

*************************************************

<a name="API_bind"></a>
### .bind(cId, dstEpOrGrpId[, callback])
Bind this endpoint to the other endpoint or to a group with the specified cluster.  

**Arguments:**  

1. `cId` (_String_ | _Number_): [Cluster id](https://github.com/zigbeer/zcl-id#Table).  
2. `dstEpOrGrpId` (_Object_ | _Number_): Bind this endpoint to the other endpoint if `dstEpOrGrpId` is given with an instance of the Endpoint class, or bind this endpoint to a group if it is given with a numeric id.  
3. `callback` (_Function_): `function (err) { }`. An error will occur if binding fails.  

**Returns:**  

* (_Promise_): promise  

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

*************************************************

<a name="API_unbind"></a>
### .unbind(cId, dstEpOrGrpId[, callback])
Unbind this endpoint from the other endpoint or from a group with the specified cluster.  

**Arguments:**  

1. `cId` (_String_ | _Number_): [Cluster id](https://github.com/zigbeer/zcl-id#Table).  
2. `dstEpOrGrpId` (_Object_ | _Number_): Unbind with endpoint if `dstEpOrGrpId` is given with an instance of the Endpoint class , or unbind this endpoint from a group if it is given with a numeric id.  
3. `callback` (_Function_): `function (err) { }`. An error will occur if unbinding fails.   

**Returns:**  

* (_Promise_): promise  

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
//             dir: { value: 1 },    // in Cluster
//             attrs: {
//                 hwVersion: 0,
//                 manufacturerName: 'TexasInstruments',
//                 modelId: 'TI0001          ',
//                 dateCode: '20060831        ',
//                 powerSource: 1,
//                 locationDesc: '                ',
//                 physicalEnv: 0,
//                 deviceEnabled: 1
//             }
//         },
//         genIdentify: {
//             dir: { value: 3 },    // in and out Cluster
//             attrs: {
//                 identifyTime: 0
//             }
//         },
//         genOnOff:{
//             dir: { value: 2 },    // out Cluster
//             attrs: {
//                 onOff: 0
//             }
//         }
//     }
// }
```

*************************************************

<br />

<a name="Debug"></a>
## 5. Debug Messages  

Like many node.js modules do, **zigbee-shepherd** utilizes [debug](https://www.npmjs.com/package/debug) module to print out messages that may help in debugging. The namespaces include `zigbee-shepherd`, `zigbee-shepherd:init`, `zigbee-shepherd:request`, and `zigbee-shepherd:msgHdlr`. The `zigbee-shepherd:request` logs requests that shepherd sends to ZNP, and `zigbee-shepherd:msgHdlr` logs the indications that comes from endpoints.  

If you like to print the debug messages, run your app.js with the DEBUG environment variable:

```sh
$ DEBUG=zigbee-shepherd* app.js          # use wildcard to print all zigbee-shepherd messages
$ DEBUG=zigbee-shepherd:msgHdlr app.js   # if you are only interested in zigbee-shepherd:msgHdlr messages
```

Example:

```sh
jack@ubuntu:~/zigbeer/zigbee-shepherd$ DEBUG=zigbee-shepherd* node server.js
  zigbee-shepherd:init zigbee-shepherd booting... +0ms
  ...
  zigbee-shepherd:init Start the ZNP as a coordinator... +1ms
  zigbee-shepherd:request REQ --> ZDO:startupFromApp +0ms
  zigbee-shepherd:msgHdlr IND <-- ZDO:stateChangeInd +839ms
  zigbee-shepherd:init Now the ZNP is a coordinator. +1ms
  zigbee-shepherd:request REQ --> SAPI:getDeviceInfo +2ms
  zigbee-shepherd:request RSP <-- SAPI:getDeviceInfo +25ms
  ...
  zigbee-shepherd:request REQ --> ZDO:nodeDescReq +0ms
  zigbee-shepherd:msgHdlr IND <-- ZDO:nodeDescRsp +28ms
  zigbee-shepherd:request REQ --> ZDO:activeEpReq +1ms
  zigbee-shepherd:msgHdlr IND <-- ZDO:activeEpRsp +19ms
  zigbee-shepherd:request REQ --> ZDO:mgmtPermitJoinReq +1ms
  zigbee-shepherd:msgHdlr IND <-- ZDO:permitJoinInd +23ms
  zigbee-shepherd:msgHdlr IND <-- ZDO:mgmtPermitJoinRsp +0ms
  zigbee-shepherd:init Loading devices from database done. +59ms
  zigbee-shepherd:init zigbee-shepherd is up and ready. +1ms
  ...
  zigbee-shepherd:request REQ --> AF:dataRequest, transId: 1 +12ms
  zigbee-shepherd:request RSP <-- AF:dataRequest, status: 0 +20ms
  zigbee-shepherd:msgHdlr IND <-- AF:dataConfirm, transId: 1 +24ms
  zigbee-shepherd:msgHdlr IND <-- AF:incomingMsg, transId: 0 +40ms
```

<br />

<a name="Contributors"></a>
## 6. Contributors  

* [Jack Wu](https://www.npmjs.com/~jackchased)  
* [Hedy Wang](https://www.npmjs.com/~hedywings)  
* [Simen Li](https://www.npmjs.com/~simenkid)  

<br />

<a name="License"></a>
## 7. License  

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
