* [new ZShepherd()](#API_ZShepherd)  
* [.start()](#API_start)  
* [.stop()](#API_stop)  
* [.reset()](#API_reset)  
* [.permitJoin()](#API_permitJoin)  


<a name="API_ZShepherd"></a>
### new ZShepherd(path[, opts])  
Create a new instance of the `ZShepherd` class. The created instance is a Zigbee server.  

**Arguments:**  

1. `path` (_String_):  A string that refers to the serial port system path, e.g., `'/dev/ttyUSB0'`  
2. `opts` (_Object_):  This value-object has two properties `sp` and `net` to configure serial port and network.
    - `sp` (_Object_):  An object to set up the [seiralport configuration options](https://www.npmjs.com/package/serialport#serialport-path-options-opencallback). The following example shows the options with its default value.  
    - `net` (_Object_):  An object to set up the network configuration with properties shown in the following table.  

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
            precfgkey: [ 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x09, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f ],
            precfgkeysEnable: true
        }
    };

var shepherd = new ZShepherd(path, opts);
```

*************************************************
<br />

<a name="API_start"></a>
### .start([callback])  
Connect to the SoC and start ths shepherd.  

**Arguments:**  

2. `callback` (_Function_): `function (err) { }`. Get called when `shepherd` start to running.  

**Returns:**  

* _none_  

**Examples:**  

```js
shepherd.start(function (err) {
    if (!err)
        console.log('shepherd is running.');
});
```

*************************************************
<br />

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

*************************************************
<br />

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

*************************************************
<br />

<a name="API_permitJoin"></a>
### .permitJoin(time[, type][, callback])
Allow or disallow devices to join the network.

**Arguments:**  

2. `time` (_Number_): Time in seconds for shepherd allowing devices to join the network. Range from  `0` to `255`, set to `0` can immediately close the admission and set to `255` can remain open the admission.  
1. `type` (_String_ | _Number_): Set type to `'coord'` or `0` will only opens the permissiom for coordinater, otherwise set to `'all'` or `1` will opens the permission for coordinate and all routers in the network. 'all' will be used by default.  
3. `callback` (_Function_): `function (err) { }`.  Get called when setting completes.  

**Returns:**  

* _none_  

**Examples:**  

```js
shepherd.permitJoin(60, function (err) {
    if (!err)
        console.log('permit devices to join for 60 seconds ');
})
```

*************************************************
<br />