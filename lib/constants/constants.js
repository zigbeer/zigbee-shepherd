var CONSTANTS = {};

CONSTANTS.BEACON_MAX_DEPTH = 0x0F;
CONSTANTS.DEF_NWK_RADIUS = 2 * CONSTANTS.BEACON_MAX_DEPTH;
CONSTANTS.AF_DEFAULT_RADIUS = CONSTANTS.DEF_NWK_RADIUS;
CONSTANTS.AF_OPTIONS = {
    PREPROCESS: 0x04,
    LIMIT_CONCENTRATOR: 0x08,
    ACK_REQUEST: 0x10,
    DISCV_ROUTE: 0x20,
    EN_SECURITY: 0x40,
    SKIP_ROUTING: 0x80
};

CONSTANTS.AF_ADDR_MODE = {
    AddrNotPresent: 0,
    AddrGroup: 1,
    Addr16Bit: 2,
    Addr64Bit: 3,
    AddrBroadcast: 15
};

CONSTANTS.ZB_DEVICE_INFO = {
    'DEV_STATE': 0,
    'IEEE_ADDR': 1,
    'SHORT_ADDR': 2,
    'PARENT_SHORT_ADDR': 3,
    'PARENT_IEEE_ADDR': 4,
    'CHANNEL': 5,
    'PAN_ID': 6,
    'EXT_PAN_ID': 7
};


// ZDApp.h
CONSTANTS.DEV_STATE = {
    'HOLD': 0x00,                           // Initialized - not started automatically
    'INIT': 0x01,                           // Initialized - not connected to anything
    'NWK_DISC': 0x02,                       // Discovering PAN's to join
    'NWK_JOINING': 0x03,                    // Joining a PAN
    'NWK_REJOIN': 0x04,                     // ReJoining a PAN, only for end devices
    'END_DEVICE_UNAUTH': 0x05,              // Joined but not yet authenticated by trust center
    'END_DEVICE': 0x06,                     // Started as device after authentication
    'ROUTER': 0x07,                         // Device joined, authenticated and is a router
    'COORD_STARTING': 0x08,                 // Started as Zigbee Coordinator
    'ZB_COORD': 0x09,                       // Started as Zigbee Coordinator
    'NWK_ORPHAN': 0x0A,                     // Device has lost information about its parent..
    // Below are ZdoStatus that are also used by ZDO_STATE_CHANGE_IND
    'INVALID_REQTYPE': 0x80,        // The supplied request type was invalid
    'DEVICE_NOT_FOUND': 0x81,       // Reserved
    'INVALID_EP': 0x82,             // Invalid endpoint value
    'NOT_ACTIVE': 0x83,             // Endpoint not described by a simple desc.
    'NOT_SUPPORTED': 0x84,          // Optional feature not supported
    'TIMEOUT': 0x85,                // Operation has timed out
    'NO_MATCH': 0x86,               // No match for end device bind
    'NO_ENTRY': 0x88,               // Unbind request failed, no entry
    'NO_DESCRIPTOR': 0x89,          // Child descriptor not available
    'INSUFFICIENT_SPACE': 0x8a,     // Insufficient space to support operation
    'NOT_PERMITTED': 0x8b,          // Not in proper state to support operation
    'TABLE_FULL': 0x8c,             // No table space to support operation
    'NOT_AUTHORIZED': 0x8d,         // Permissions indicate request not authorized
    'BINDING_TABLE_FULL': 0x8e      // No binding table space to support operation
};

CONSTANTS.AfNetworkLatencyReq = {
    'noLatencyReqs': 0,
    'fastBeacons': 1,
    'slowBeacons': 2
};


module.exports = CONSTANTS;