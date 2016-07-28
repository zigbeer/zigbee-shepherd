* [.mount()](#API_mount)  
* [.list()](#API_list)  
* [.find()](#API_find)  
* [.lqi()](#API_lqi)  
* [.remove()](#API_remove)  


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

*************************************************
<br />

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

*************************************************
<br />

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
<br />

<a name="API_lqi"></a>
### .lqi(ieeeAddr, callback)
Query the link quality index from a certain device by its ieee address.  

**Arguments:**  

1. `ieeeAddr` (_String_): Ieee address of the device.  
3. `callback` (_Function_): `function (err, data) { }`. This method returns you the link quality index via `data`. An error occurs if device not found.  

**Returns:**  

* _none_  

**Examples:**  

```js
shepherd.lqi('0x00124b0001ce4beb', function (err, data) {
    if (!err)
        console.log(data);  // 62
});
```
*************************************************
<br />

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
