## **MQTT Communication Protocol Specification** 

## **60GHz Millimeter Wave Radar** 

Version: V1.1 

## **DALIAN IFLABEL TECHNOLOGY CO., LTD** 

## **Table of Contents** 

1. Document Overview 

2. MQTT Topic Definition 

3. General JSON Message Standard Format 

4. Full Device Property Dictionary (Report / Query / Config) 

5. Restrict Real-Time Reporting Function 

6. MQTT QoS Configuration Instruction 

7. OTA Firmware Upgrade Protocol 

8. Version Change Log 

9. Operation Notes for Middle East Deployment 

This specification defines complete MQTT communication rules for 

ST-FDVT3-WT ceiling-mounted millimeter wave fall detection radar sensor. All upstream and downstream data uses UTF-8 JSON payload over standard MQTT 3.1.1 / MQTT 5.0. 

Purpose: Help system integrators, facility engineers and cloud developers read real-time radar status, configure sensor parameters remotely and perform over-the-air firmware updates. Applicable Scenarios: Elderly care homes, hospitals, residential villas, assisted living facilities in Saudi Arabia. 

Key Product Capabilities: Human presence detection, static stay alert, fall alarm, voice emergency call, night light linkage, voice command learning, real-time motion metric output. 

## **Core Communication Logic** 

 Device →Cloud / Client: Publish status, events, heartbeat, OTA 

progress via **post topic** 

 Cloud / Client →Device: Send query or configuration commands via **set** 

## **topic** 

 All command responses will be pushed back to post topic for confirmation 

## **2. MQTT Fixed Topic Definition** 

Replace {DeviceID} with unique serial ID of each radar hardware. 

Upstream Report Topic (Device Publish) 

/Radar60FL/{DeviceID}/sys/property/post Usage: Device auto-push state changes, heartbeat, periodic metrics, OTA download progress, response feedback of config/query commands. 

Downstream Control Topic (Client Publish) 

/Radar60FL/{DeviceID}/sys/property/set Usage: Send parameter query requests, parameter setting commands, OTA upgrade instructions, reporting limit rules, QoS adjustment orders. 

## **Important Note for Saudi Deployment** 

Local MQTT brokers (on-premises server / cloud in KSA) must enable persistent session to avoid disconnection loss during unstable Wi-Fi common in residential buildings. 

## **3. Universal JSON Message Structure** 

## **3.1 Upstream Auto-Report Format (method: post)** 

Trigger: State change, periodic cycle, power-on initialization json 

{ 

"version": "1.0", 

"method": "post", 

"params": { 

"target_property": "value" 

}} 

## **3.2 Downstream Query Format (method: get)** 

Client sends to set topic to read current value of target attribute json 

{ 

"version": "1.0", 

"method": "get", 

"params": { 

"target_property": "?" 

}} 

## **3.3 Query Response Format (device reply via post topic, opt: get)** 

json 

{ 

"version": "1.0", 

"opt": "get", "res": "success", 

"params": { 

"target_property": "returned_value" 

}} 

 res: success: Query completed normally  res: fail: Query failed (invalid property / device offline) 

## **3.4 Downstream Parameter Setting Format (method: set)** 

Client send config command json 

{ 

"version": "1.0", 

"method": "set", "params": { 

"target_property": "target_value" 

}} 

## **3.5 Setting Response Format (device reply via post topic, opt: set)** 

json 

{ 

"version": "1.0", 

"opt": "set", "res": "success", "params": { 

"target_property": "applied_value" 

}} 

- res: success: Parameter saved to flash memory 

- res: fail: Invalid value range / locked parameter / invalid trigger condition 

   - (e.g. voice learning when no human detected) 

## **3.6 Special Command Method Codes** 

- limit_get / limit_set: Restrict real-time attribute reporting switch 

- qos_get / qos_set: MQTT QoS level read/write 

- ota_set: OTA upgrade instruction 

## **4. Complete Device Property Dictionary** 

## **4.1 Online Status (online)** 

- Report Mode: Auto report on connect / disconnect 

- Value Definition: 0 = Offline, 1 = Online 

- Query Supported: Yes 

- Sample Auto Report 

json 

{ 

"version": "1.0", 

"method": "post", 

"params": { 

"online": "1" 

}} 

## **4.2 Initialization Completion Flag (initFinish)** 

- Report Mode: No auto push; query only 

- Value: 0 = Initializing, 1 = Initialization finished 

- Value Range: 0 / 1 

## **4.3 Heartbeat Status (heartBeat)** 

 Report Mode: Auto push when heartbeat state flips 

 

Value: 0 = Abnormal communication, 1 = Normal heartbeat 

## **4.4 Product Model (productMode)** 

- Report Mode: No auto push; query only 

- Data Type: String, fixed hardware model ID 

## **4.5 Unique Device ID (productId)** 

 Report Mode: No auto push; query only 

 Data Type: String serial number 

## **4.6 Hardware Model (hardwareModel)** 

- Report Mode: No auto push; query only 

- Data Type: String hardware revision 

## **4.7 Wi-Fi Firmware Version (firmwareVersionWiFi)** 

- Report Mode: Auto push after Wi-Fi broker connection 

- Data Type: Version string 

## **4.8 Radar Main Firmware Version (firmwareVersion)** 

- Report Mode: Auto push on network connect 

- Data Type: Version string 

## **4.9 Application Software Version (firmwareVersionProduct)** 

- Report Mode: Auto push on power-up network connection 

- Sample Payload 

json 

{ 

"version": "1.0", 

"method": "post", 

"params": { 

"firmwareVersionProduct": "YF_60GFL_tongyongWIFI_2024.1.3_V2.0.0" 

}} 

## **4.10 Installation Height (installHeight)** 

- Report Mode: No auto push 

- Value Range: 170 ~ 310 (Unit: cm) 

- Support: Query + Remote Set 

- Usage Note for Saudi Projects: Standard ceiling height in local villas is 

- 240cm, recommended default value = 240 

## **4.11 Position Out-of-Bounds Flag (locationOutOfBounds)** 

- Report Mode: Auto state change push 

- Value: 0 = Target outside detection zone, 1 = Target within zone 

## **4.12 Human Detection Master Switch (humanSwitch)** 

- Report Mode: No auto push 

- Value: 0 = Disable all human sensing, 1 = Enable full radar detection 

- Support: Query + Set 

## **4.13 Human Presence Flag (someoneExists)** 

- Report Mode: Auto push on presence / vacancy switch 

- Value: 0 = No human detected, 1 = Human detected in coverage 

## **4.14 Motion Status (motionStatus)** 

- Report Mode: Auto push on state change 

- Value: 0 = No motion, 1 = Static human, 2 = Active moving human 

## **4.15 Motion Vital Sign Value (movementSigns)** 

- Report Mode: Periodic auto upload 

- Range: Integer 0 ~ 100 (higher = stronger body micro-movement) 

## **4.16 Sitting Horizontal Distance (sittingHorizontalDistance)** 

- Report Mode: No auto push 

- Unit: cm; Range: 0 ~ 300 

- Support: Query + Set 

## **4.17 Moving Horizontal Distance (horizontalDistanceOfMovement)** 

- Report Mode: No auto push 

- Unit: cm; Range: 0 ~ 300 

- Support: Query + Set 

## **4.18 Human Presence Judgment Method** 

## **(humanExistenceJudgmentMethod)** 

- Description: Reserved interface, unused in V1.1 

- Value Range: 0 / 1 (1 Byte) 

- Support: Query + Set 

## **4.19 Presence Sensitivity Threshold** 

## **(humanPresenceJudgmentThreshold)** 

- Report Mode: No auto push 

- Data Range: 0 ~ 0xFFFFFFFF (4 Byte unsigned integer) 

- Support: Query + Set 

- Deployment Tip for Saudi: Lower threshold value reduces false alarm 

   - caused by air conditioner vibration common in local buildings 

## **4.20 Human Motion Energy Value (humanPresenceEnergyValue)** 

- Report Mode: Periodic auto upload 

- Range: 0 ~ 100 

## **4.21 Energy Value Output Switch (humanEnergyValueSwitch)** 

- Report Mode: No auto push 

- Value: 0 = Disable energy data upload, 1 = Enable 

## **4.22 Vacancy Delay Time (unmannedTime)** 

- Report Mode: No auto push 

- Unit: second; Range: 10 ~ 1800 

- Definition: Radar judges area vacant after continuous no motion for this 

- duration 

## **4.23 Fall Height Threshold (fallingAndBreakingHeight)** 

- Report Mode: No auto push 

- Unit: cm; Range: 0 ~ 150 

- Meaning: Vertical height threshold to trigger fall logic 

## **4.24 Fall Detection Master Switch (fallSwitch)** 

- Report Mode: No auto push 

- Value: 0 = Fall alarm off, 1 = Fall alarm enabled 

## **4.25 Fall Event Flag (fallStatus)** 

- Report Mode: Auto push immediately when fall posture detected 

- Value: 0 = Normal standing/sitting, 1 = Fall posture detected 

## **4.26 Static Dwell Flag (residentStatus)** 

- Report Mode: Auto push on state flip 

- Value: 0 = No long static stay, 1 = Human stationary over dwell 

- threshold 

 Sample Report 

json 

{ 

"version": "1.0", 

"method": "post", 

"params": { 

"residentStatus": "1" 

}} 

## **4.27 Dwell Alarm Duration Threshold (residentWarningDuration)** 

- Report Mode: No auto push 

- Unit: second; Range: 0 ~ 65535 

## **4.28 Dwell Alarm Enable Switch (residentWarningDurationSwitch)** 

 Report Mode: No auto push 

- Value: 0 = Dwell alert off, 1 = Dwell alert on 

## **4.29 Fall Hold Delay (fallDuration)** 

- Report Mode: No auto push 

- Unit: second; Range: 0 ~ 65535 

- Definition: Hold fall state for N seconds before sending alarm to cloud 

## **4.30 Voice Function Master Switch (US518FunctionSwitch)** 

 Report Mode: No auto push 

 Value: 0 = All voice prompt disabled, 1 = Voice inquiry & emergency call enabled (default) 

- Logic: If disabled, radar only push fall event without voice prompt to 

- local room 

## **4.31 Voice Command Learning Mode Trigger (US518LearningFunction)** 

- Report Mode: No auto push 

- Value: 0 = Exit learning, 1 = Enter voice learning flow 

- Special Restriction: 

- Set command will return "nobody" response if someoneExists = 

   - 0 (no human in zone, cannot learn voice keywords) 

- Learning function can only be triggered once within 60 seconds 

- to avoid conflict 

- Support: Query + Set 

## **4.32 Night Light Auto Switch (nightLightSwitch)** 

- Report Mode: No auto push 

- Value: 0 = Force light off, 1 = Force light on 

- Restriction: If no human detected, set command returns "nobody" 

- failure response 

## **4.33 Custom Raw Radar Data Channel (custom_protocol)** 

- Report Mode: Auto push once raw radar binary data received 

- Value Range: 0 / 1 

- Hex raw payload comment in original doc is retained for secondary 

- development 

## **5. Restrict Real-Time Reporting Function** 

## **Function Introduction** 

For attributes that upload data frequently (motionStatus, movementSigns), developer can disable auto reporting to reduce MQTT traffic cost (critical for Saudi cellular IoT SIM usage). 

- Value 0: Allow automatic report 

- Value 1: Block automatic report upload 

## **Supported Restrict Attributes List** 

motionStatus, movementSigns, humanDistance, humanPosition, heartBeat 

## **5.1 Query Reporting Limit Configuration (method: limit_get)** 

json 

{ 

"version": "1.0", 

"method": "limit_get", "params": { "motionStatus": "?", "movementSigns": "?", "humanDistance": "?", "humanPosition": "?", "heartBeat": "?" }} 

**5.2 Query Response Sample** json { "version": "1.0", "opt": "limit_get", "res": "success", "params": { 

"motionStatus": "0", "movementSigns": "0", "humanDistance": "0", "humanPosition": "0", "heartBeat": "0" 

}} 

## **5.3 Set Reporting Limit Rule (method: limit_set)** 

json 

{ 

"version": "1.0", 

"method": "limit_set", 

"params": { 

"motionStatus": "1", 

"movementSigns": "0" 

}} 

## **5.4 Set Command Response Format** 

Same structure as query response, opt = limit_set. 

## **6. MQTT QoS Configuration Instruction** 

## **QoS Value Mapping** 

- 0: QoS 0 At Most Once 

- 1: QoS 1 At Least Once (factory default) 

- 2: QoS 2 Exactly Once 

## **6.1 Read Current QoS Level (method: qos_get)** 

Request send to set topic: json 

{ 

"version": "1.0", "method": "qos_get"} 

## **6.2 Set QoS Level (method: qos_set)** 

json 

{ 

"version": "1.0", 

"method": "qos_set", 

"params": { 

"Qos_post": "1" 

}} 

## **6.3 Set QoS Response** 

json 

{ 

"version": "1.0", 

"opt": "qos_set", 

"res": "success", 

"params": { 

"Qos_post": "1" 

}} 

## **KSA Deployment Advice** 

For elderly care cloud systems, set QoS=1 to avoid alarm loss during temporary Wi-Fi disconnection common in Saudi residential buildings. 

## **7. OTA Firmware Upgrade Protocol** 

## **7.1 OTA Module Selection (otaModule)** 

 Value 0: Upgrade Wi-Fi communication firmware (default) 

 Value 1: Upgrade millimeter radar main firmware 

 Downstream Command Sample 

json 

{ 

"version": "1.0", 

"method": "ota_set", 

"params": { 

"module": "0" 

}} 

## **7.2 Send OTA Server Information (otaInform)** 

Client push firmware download URL & port to radar json 

{ 

"version": "1.0", 

"method": "ota_set", 

"params": { 

"otaInform": { 

"firmwareUrl": "http://192.168.31.88/app.rbl", 

"port": "8090" 

} 

}} 

Note for Saudi Integrators: Local HTTP firmware server must use stable fixed IP within KSA internet regulation. 

## **7.3 OTA Upgrade Progress Auto Report (downloadProgress)** 

- Report Mode: Periodic auto push during download 

- Value Range: Integer 0 ~ 100 (percentage) 

- Push via post topic 

## **7.4 OTA Failure Feedback Format** 

Device push error message to post topic 

json 

{ 

"version": "1.0", 

"opt": "otaInform", 

"res": "fail", 

"msg": "ota failed!"} 

Failure Causes: Wrong URL, network timeout, firmware CRC mismatch, insufficient flash space. 

## **7.5 OTA Completion Behavior** 

After download reaches 100%, radar automatically restarts and uploads new firmware version string via post topic. 

## **8. Critical Operation Notes for Saudi Arabia Deployment** 

1. Network Environment Adaptation Local household Wi-Fi frequently has weak signal; enable QoS=1 and persistent MQTT session to avoid missing fall alarms for elderly users. 

2. False Alarm Reduction Air conditioning units, ceiling fans create continuous micro-vibration. Adjust humanPresenceJudgmentThreshold to higher value to reduce false presence trigger. 

3. Voice Function Localization Voice learning mode supports Arabic custom emergency keywords. Always ensure at least one person stays under radar coverage when sending voice learning set commands, otherwise the device returns nobody error. 

4. IoT Data Traffic Cost Control Disable auto report of movementSigns and humanPresenceEnergyValue using limit_set function if using local cellular SIM MQTT brokers to lower monthly data consumption. 

5. OTA Local Compliance All firmware download servers must be hosted inside Saudi Arabia to comply with local data storage regulation. Cross-border foreign firmware download links may be blocked by ISPs. 

6. Installation Height Standard Most Saudi residential ceiling height = 240cm; set installHeight=240 by default for consistent fall detection accuracy. 

7. Alarm Time Configuration Set fallDuration=5s for nursing home real-time emergency notification; set longer delay (30~60s) for private villas to avoid false alarm from bending down. 

