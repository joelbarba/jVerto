'use strict';

var bfVirtualPhoneApp = angular.module('bfVirtualPhoneApp', [
  'ui.bootstrap'
  ,'ngResource'
  // ,'angularUtils.directives.dirPagination'
]);

bfVirtualPhoneApp.run(function() {
  "ngInject";
  console.log('Virtual Phone is running');
});

bfVirtualPhoneApp.registeredControllers = {};


bfVirtualPhoneApp.directive('virtualPhoneBody', function() {
  "ngInject";
  return {
    restrict: 'AE',
    replace: true,
    templateUrl: 'views/virtual-phone-body.html',
    scope: {},
    link: function($scope, element, attr) {
        // console.log('ini virtual phone body');
    },
    controller: 'bfVirtualPhoneController'
  };
});


bfVirtualPhoneApp.controller('bfVirtualPhoneController', function($scope, VirtualPhone, $timeout, $resource) {
  "ngInject";

  var VP = VirtualPhone();

  // Initialize Virtual Phone
  $scope.currentStatus = 'disconnected';
  $scope.internalStatus = 1;

  // Display the status on callback
  VP.onStatusChange = function(newState) {
    $timeout(function() {
      switch(newState) {
        case 'disconnected':                                  $scope.internalStatus =  1; $scope.currentStatus = 'Disconnected'; break;
        case 'WSSconnecting':                                 $scope.internalStatus =  2; $scope.currentStatus = 'Connecting...'; break;
        case 'WSSconnected':                                  $scope.internalStatus =  3; $scope.currentStatus = 'Connecting...'; break;
        case 'FSconnecting':                                  $scope.internalStatus =  4; $scope.currentStatus = 'Connecting...'; break;
        case 'ready':                                         $scope.internalStatus =  5; $scope.currentStatus = 'Ready'; break;
        case 'creating call (establishing peer connection)':  $scope.internalStatus =  6; $scope.currentStatus = 'Calling...'; break;
        case 'creating call (ringing / waiting answer)':      $scope.internalStatus =  7; $scope.currentStatus = 'Ringing...'; break;
        case 'talking':                                       $scope.internalStatus =  8; $scope.currentStatus = 'In a call'; break;
        case 'hangingup':                                     $scope.internalStatus =  9; $scope.currentStatus = 'Hanging Up...'; break;
        case 'closing FSconnection':                          $scope.internalStatus = 10; $scope.currentStatus = 'Disconnecting...'; break;
        case 'closing WSSconnection':                         $scope.internalStatus = 11; $scope.currentStatus = 'Disconnecting...'; break;
        default: $scope.currentStatus = newState;
      }
    });
  };

  // Enlarge the screen on hang up
  VP.onHangUp = function() {
    window.resizeTo(399, 650);
    $scope.toggleVPSidebar('expand');
  };


  $scope.numToDial = '3520';
  $scope.userAlias = 'Joel Barba';


  // Get the Caller ID from the profile and user data
  $resource('/profile').get(function(profile){
    // console.log('this is the profile', profile);

    $resource('/api/v1/users/' + profile.user_id).get(function(userData){
      // console.log('this is the user data', userData);
      if (userData.caller_id_number_internal) {
        $scope.callerNum = userData.caller_id_number_internal;
      } else {
        $scope.callerNum = '1008';
      }

      $scope.callerNum = '1008';
      console.log('callerNum', $scope.callerNum);
      VP.init($scope.callerNum);
    });
  });



  $scope.isSideBarToggle = false;
  $scope.log = [];

  $scope.toggleVPSidebar = function(status) {
    if (!!status) {
      $scope.isSideBarToggle = !(status === 'expand');

    } else {
      $scope.isSideBarToggle = !$scope.isSideBarToggle;
    }
  };

  $scope.dialButtons = [
    {num: 1,  text: '1'}, {num: 2, text: '2'}, {num: 3,  text: '3'},
    {num: 4,  text: '4'}, {num: 5, text: '5'}, {num: 6,  text: '6'},
    {num: 7,  text: '7'}, {num: 8, text: '8'}, {num: 9,  text: '9'},
    {num: 10, text: '*'}, {num: 0, text: '0'}, {num: 11, text: '#'}
  ];

  $scope.callHistory = [
    {num: 3520, date: '2017-03-04 17:39', chat: '003'},
    {num: 3413, date: '2017-03-02 22:14', chat: '024'},
    {num: 3520, date: '2017-02-24 09:25', chat: '012'},
    {num: 4452, date: '2017-02-17 12:31', chat: '063'},
    {num: 5963, date: '2016-06-04 06:24', chat: '038'}
  ];

  $scope.dialButtonClick = function(dialButton) {
    $scope.numToDial += dialButton.text;
  };




  /* -------------------------------------------------------------------------------------- */

  // Make a voice call
  $scope.makeVoiceCall = function() {
    VP.makeNewCall(1005);
    window.resizeTo(399, 680);
  };

  // Make a video call
  $scope.makeVideoCall = function() {
    VP.makeNewCall();
    $scope.toggleVPSidebar('collapse');
    window.resizeTo(1220, 800);
  };

  $scope.makeScreenCall = function() {
    VP.addCall();
  };


  $scope.endCall = function() {
    VP.hangUp();
  };



 });



/* Public Methods:
   - init(callerNum) : Connect to a Verto server. If you are already connected it throws an error.
                       callerNum = Internal number of the user who is using the phone.
                       It creates the connection opening the web socket and authenticating to Verto.
                       Once the connection and login is established successfully, it changes the status to "ready"

   - makeNewCall()   : Start a new call. It can only be done if the current status is "ready"
                       It first prepare the media to share via WebRTC,

   - hangUp()        : Finish the current call

   - onStatusChange  : Callback function. It is called every time the status changes. It gets the new status as parameter
*/

bfVirtualPhoneApp.factory('VirtualPhone', VirtualPhoneFactory);
function VirtualPhoneFactory(BfWebRCT, $timeout) {
  "ngInject";

  return function() {

    var bfVP = {
      WSSObj         : null,              // websocket
      socketUrl      : null,              // websocket url (wss://...)
      callerNum      : null,              // Internal number of the user
      sessionId      : null,              // freeSwticth session id
      currentCallId  : null,              // freeSwticth call id
      lastReqId      : null,
      params         : null,
      status         : 'disconnected',    // current status
      onStatusChange : null,
      onHangUp       : null
    };
    var bfWebRCT;
    var bfWebRCT2;

    /* Possible statuses: */
      // disconnected
      // WSSconnecting
      // WSSconnected
      // FSconnecting
      // ready
      // creating call (establishing peer connection)
      // creating call (ringing / waiting answer)
      // talking
      // hangingup
      // closing FSconnection
      // closing WSSconnection


    // Custom function to init the WSS
    bfVP.init = function(callerNum) {

      // The current status must be disconnected
      if (bfVP.status !== 'disconnected') {
        console.warn('You are currently connected', bfVP.status);
        return false;
      }

      // Set configuration values
      bfVP.WSSObj        = null;
      bfVP.callerNum     = callerNum;

      bfVP.socketUrl     = 'wss://cantina.freeswitch.org:8082';
      bfVP.login         = "@cantina.freeswitch.org";
      bfVP.passwd        = "1234";

      // bfVP.socketUrl     = 'wss://webrtc.blueface.com:8082';
      // bfVP.login         = "@webrtc.blueface.com";
      // bfVP.passwd        = "jenga1598";

      bfVP.sessionId     = null;
      bfVP.currentCallId = null;
      bfVP.lastReqId     = 1;
      bfVP.params        = {
        ringFile      : 'sounds/bell_ring2.wav',
        iceServers    : true,
        containerElem : "video-container",
        deviceParams  : {
          useCamera   : 'any',
          useMic      : 'any',
          useSpeak    : 'any',
          onResCheck  : null
        },
        localTag      : null,
        videoParams   : {},
        audioParams   : {},
        loginParams   : {},
        userVariables : {},
        ringSleep     : 6000,
        sessid        : generateGUID()
      };

      if (!("WebSocket" in window)) {
        console.error('No websockets allowed');
        changeStatus('disconnected');
        return false;
      }

      changeStatus('WSSconnecting');

      // Create the Web Socket and connect
      bfVP.WSSObj = new WebSocket(bfVP.socketUrl);
      if (bfVP.WSSObj) {
        bfVP.WSSObj.onmessage = onWSmessage;
        bfVP.WSSObj.onclose = function () {
          console.error("Websocket Lost");
        };
        bfVP.WSSObj.onopen = function () {
          // Once the WSS connection is ready, login automatically to the freeSwitch server
          changeStatus('FSconnecting');
          var request = {
            id      : bfVP.lastReqId++,
            jsonrpc : '2.0',
            method  : 'login',
            params  : {
              login  : bfVP.callerNum + bfVP.login,
              passwd : bfVP.passwd
            }
          };
          bfVP.WSSObj.send(JSON.stringify(request));
        };

      } else {
        changeStatus('disconnected');
        return false;
      }

      return true;
    };

    // Create a new voice call
    bfVP.makeNewCall = function() {

      if (bfVP.status !== 'ready') {
        console.warn('It is not possible to make a call when the status is not ready. Now status is', bfVP.status);
        return false;
      }

      // Initialize the webRTC peer connection with the current media
      bfWebRCT = BfWebRCT('input-video-container');

      bfWebRCT.onCallAnswered = function(src) {
        console.log('onCallAnswered');
        bfWebRCT.inputMediaElem.src = src;
        bfWebRCT.inputMediaElem.play();
      };

      // This callback function is triggered when webRTC is ready to connect
      bfWebRCT.onConnectionReady = function(sessionDescription, localStream) {
        // console.log('onCallCreated', sessionDescription);
        joinConference(sessionDescription, localStream);
      };

      changeStatus('creating call (establishing peer connection)');
      bfWebRCT.createConnection();  // Create the peer connection

    };





    // Create a new voice call
    bfVP.addCall = function() {

      // Initialize the webRTC peer connection with the current media
      bfWebRCT2 = BfWebRCT('input-video-container');

      // bfWebRCT2.onCallAnswered = function(src) {
      //   console.log('bfWebRCT2', 'onCallAnswered');
        // bfWebRCT2.inputMediaElem.src = src;
        // bfWebRCT2.inputMediaElem.play();
      // };

      // This callback function is triggered when webRTC is ready to connect
      bfWebRCT2.onConnectionReady = function(sessionDescription, localStream) {
        console.log('bfWebRCT2', 'onCallCreated', sessionDescription);
        // joinConference(sessionDescription, localStream);

        var request = {
          id       : bfVP.lastReqId++,
          jsonrpc  : '2.0',
          method   : 'verto.invite',
          params   : {
            sessid       : bfVP.sessionId,
            sdp          : sessionDescription.sdp,
            dialogParams : {
              callID                  : generateGUID(),
              caller_id_name          : "Joel SCREEN",
              caller_id_number        : "1008",
              dedEnc                  : false,
              destination_number      : "3521-admin",
              incomingBandwidth       : "default",
              localTag                : null,
              login                   : bfVP.callerNum + bfVP.login,
              mirrorInput             : true,
              outgoingBandwidth       : "default",
              remote_caller_id_name   : "Outbound Call",
              remote_caller_id_number : "1008",
              screenShare             : false,
              tag                     : "video-container",
              useCamera               : "any",
              useMic                  : "any",
              useSpeak                : "any",
              useStereo               : true,
              useVideo                : true,
              userVariables           : { email: "test@test.com" },
              videoParams             : {}
            }
          }
        };

        bfVP.WSSObj.send(JSON.stringify(request));

      };

      bfWebRCT2.createConnection();  // Create the peer connection

    };







    bfVP.hangUp = function() {

      if (bfVP.status !== 'talking') {
        console.warn('You are not in a call. Your status is', bfVP.status);
        return false;
      }
      if (!bfVP.currentCallId) {
        console.warn('There is no call ID');
        return false;
      }

      var request = {
        id: bfVP.lastReqId++,
        jsonrpc: '2.0',
        method: 'verto.bye',
        params: {
          sessid: bfVP.sessionId,
          dialogParams: {
            callID: bfVP.currentCallId,
            caller_id_name: "Joel Barba",
            caller_id_number: bfVP.callerId,
            dedEnc: false,
            destination_number: "1008",
            incomingBandwidth: "default",
            localTag: null,
            login: bfVP.callerId + bfVP.login,
            mirrorInput: true,
            outgoingBandwidth: "default",
            remote_caller_id_name: "Outbound Call",
            remote_caller_id_number: "1008",
            screenShare: false,
            tag: "video-container",
            useCamera: "any",
            useMic: "any",
            useSpeak: "any",
            useStereo: true,
            useVideo: true,
            userVariables: { email: "test@test.com" },
            videoParams: {}
          }
        }
      };

      changeStatus('hangingup');
      // bfVP.WSSObj.send($.toJSON(request));
      bfVP.WSSObj.send(JSON.stringify(request));

    };

    // ------------- Private functions ----------------

    // Internal function to change status
    function changeStatus(newStatus) {
      // console.log('changin status to ', newStatus);
      bfVP.status = newStatus;
      if (bfVP.onStatusChange) {  // If there is callback function, trigger it
        bfVP.onStatusChange(bfVP.status);
      }
    }

    // Makes a call to a destination ()
    function callDestination() {

    }

    // Asks to join a conference room (verto.invite)
    function joinConference(sessionDescription) {
      changeStatus('creating call (ringing / waiting answer)');

      var request = {
        id       : bfVP.lastReqId++,
        jsonrpc  : '2.0',
        method   : 'verto.invite',
        params   : {
          sessid       : bfVP.sessionId,
          sdp          : sessionDescription.sdp,
          dialogParams : {
            callID                  : generateGUID(),
            caller_id_name          : "Joel Barba ADMIN",
            caller_id_number        : bfVP.callerNum,
            dedEnc                  : false,
            destination_number      : "3521-admin",
            incomingBandwidth       : "default",
            localTag                : null,
            login                   : bfVP.callerNum + bfVP.login,
            mirrorInput             : true,
            outgoingBandwidth       : "default",
            remote_caller_id_name   : "Outbound Call",
            remote_caller_id_number : "1008",
            screenShare             : false,
            tag                     : "video-container",
            useCamera               : "any",
            useMic                  : "any",
            useSpeak                : "any",
            useStereo               : true,
            useVideo                : true,
            userVariables           : { email: "test@test.com" },
            videoParams             : {}
          }
        }
      };

      bfVP.WSSObj.send(JSON.stringify(request));
    }

    // This function is triggered after sending a message to the WSS server with bfVP.WSSObj.send()
    // It handles all the responses from the WebSocket:
    //     - Login successfully     result: { message: "logged in", sessid: "c9757835-bca6-43c4-9ce2-2a2daa2515f6" }
    //     - Login unsuccessfully   error: { code: -32000, message: "Authentication Required" }
    //
    function onWSmessage(event) {
      // console.log('WSS Verto event', event);

      // Check response
      if (!event.data) {
        console.error('jsonrpc invalid response');
        return false;
      }
      var response = JSON.parse(event.data);
      if (response.hasOwnProperty('error')) {
        console.error('login error', response.error.code, response.error.message);
        changeStatus('Connection error');
        return false;
      }

      // Responses of a sent request
      if (!!response.result) {
        if (response.result.message === 'logged in') {
          // console.log('logged in properly', 'session id: ', response.result.sessid);
          bfVP.sessionId = response.result.sessid;
          changeStatus('ready');
        }
        if (response.result.message === 'CALL CREATED') {
          // console.log('The call has been answered');
        }
        if (response.result.message === 'CALL ENDED') {
          // console.log('The call has been hanged up');
          bfVP.currentCallId = null;
          bfWebRCT.inputMediaElem.src = null;
          changeStatus('ready');
          if (bfVP.onHangUp) { bfVP.onHangUp(); }
        }
      }

      // Responses of a triggered event (no request pair)
      if (response.method === 'verto.answer') {
        console.log('VERTO', 'verto.answer');
        var remoteOffer = {
          sdp: response.params.sdp,
          type: 'answer'
        };
        if (bfVP.status !== 'talking') {
          // bfWebRCT.peerConn.setRemoteDescription(remoteOffer).then(function(resp) {
          bfWebRCT.peerConn.setRemoteDescription(new window.RTCSessionDescription(remoteOffer)).then(function(resp) {
            console.log('after setRemoteDescription', resp)
          });
        } else {
          bfWebRCT2.peerConn.setRemoteDescription(new window.RTCSessionDescription(remoteOffer));
        }

        bfVP.currentCallId = response.params.callID;
        changeStatus('talking');

        var request = {
          id       : response.id,
          jsonrpc  : '2.0',
          result   : {
            method   : 'verto.answer'
          }
        };
        bfVP.WSSObj.send(JSON.stringify(request));

      }
      // Responses of a triggered event (no request pair)
      if (response.method === 'verto.display') {
        console.log('VERTO', 'verto.display', response.params);
        var request = {
          id       : response.id,
          jsonrpc  : '2.0',
          result   : {
            method   : 'verto.display'
          }
        };
        bfVP.WSSObj.send(JSON.stringify(request));

      }

      // bfVP.status = 'disconnected';
      // bfVP.status = 'WSSconnecting';
      // bfVP.status = 'WSSconnected';
      // bfVP.status = 'FSconnecting';
      // bfVP.status = 'ready';
      // bfVP.status = 'creating call (establishing peer connection)';
      // bfVP.status = 'creating call (ringing / waiting answer)';
      // bfVP.status = 'talking';
      // bfVP.status = 'hangingup';
      // bfVP.status = 'closing FSconnection';
      // bfVP.status = 'closing WSSconnection';


    }


    // UUID generator
    var generateGUID;
    if (typeof(window.crypto) !== 'undefined' && typeof(window.crypto.getRandomValues) !== 'undefined') {
      generateGUID = function() {  // If we have a cryptographically secure PRNG, use that (http://stackoverflow.com/questions/6906916/collisions-when-generating-uuids-in-javascript)
        var buf = new Uint16Array(8);
        window.crypto.getRandomValues(buf);
        var S4 = function (num) {
          var ret = num.toString(16);
          while (ret.length < 4) {
            ret = "0" + ret;
          }
          return ret;
        };
        return (S4(buf[0]) + S4(buf[1]) + "-" + S4(buf[2]) + "-" + S4(buf[3]) + "-" + S4(buf[4]) + "-" + S4(buf[5]) + S4(buf[6]) + S4(buf[7]));
      };
    } else {
      generateGUID = function () { // Otherwise, just use Math.random (http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/2117523#2117523)
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
    }

    return bfVP;
  };
}


/* Object to handle the Web RTC resources

   Parameters
     - mediaElementId : Id of the html element where to link the video output

   Methods:
     - createConnection() : Initiates the media elements, collects the ICE candidates, and triggers "onConnectionReady" when the media sharing is ready

   Callback functions:
     - onConnectionReady : Triggered when the peer connection is ready to be sent. 2 params: The descriptor + the stream
     - onCallAnswered    : Triggered when ... never for now
*/
bfVirtualPhoneApp.factory('BfWebRCT', function() {
  "ngInject";

  return function(mediaElementId) {

    var webRTCObj = {};

    webRTCObj.peerConn = null;

    window.RTCPeerConnection     = window.mozRTCPeerConnection      || window.webkitRTCPeerConnection;
    window.RTCSessionDescription = window.mozRTCSessionDescription  || window.RTCSessionDescription;
    window.RTCIceCandidate       = window.mozRTCIceCandidate        || window.RTCIceCandidate;
    window.URL                   = window.webkitURL                 || window.URL;

    navigator.getMedia     = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

    var ICECandidates = [];
    var status = 0;


    var mediaConstraints = {
      // optional: [{DtlsSrtpKeyAgreement: true}],
      optional: [],
      mandatory: {
        OfferToReceiveAudio: true,
        OfferToReceiveVideo: true
      }
    };
    var videoConstraints = {
        mandatory: {},
        optional: []
    };

    var peerConfig = { iceServers: [{ url: 'stun:stun.l.google.com:19302' }, { url: 'stun:23.21.150.121' }] };
    var peerOpConfig = { optional: [{ DtlsSrtpKeyAgreement: true }, {RtpDataChannels: false}] };

    webRTCObj.onConnectionReady = function() {};
    webRTCObj.onCallAnswered = function() {};
    webRTCObj.inputMediaElem = document.getElementById(mediaElementId);



    // Create a new peer offer getting the media stream from the browser
    webRTCObj.createConnection = function() {

      navigator.getMedia({ audio: true, video: videoConstraints }, onSucces, onError);

      function onSucces(stream) {
        console.log('WebRTC', 'addStream');
        webRTCObj.peerConn = new RTCPeerConnection(peerConfig, peerOpConfig);  // Creates the Peer connection
        webRTCObj.peerConn.addStream(stream);  // Adds the current stream to the connection

        // This event is triggered when somebody else adds a new stream (it means that somebody is answering the call)
        webRTCObj.peerConn.onaddstream = function(event) {
          console.log('WebRTC', 'onaddStream');
          if (webRTCObj.inputMediaElem) {
            webRTCObj.inputMediaElem.src = URL.createObjectURL(event.stream);
            webRTCObj.inputMediaElem.play();
          }
        };

        // This event is triggered when a new ICE Candidate is added to the peer connection
        webRTCObj.peerConn.onicecandidate = function (event) {
          console.log('new ICE Candidate');
          if (event && event.candidate) {
            ICECandidates.push(event.candidate);
          }
          if (status !== 2 && (!event || !event.candidate || ICECandidates.length === 5)) { // This means there are no more candidates to add
            console.log('onConnectionReady');
            status = 2;
            webRTCObj.onConnectionReady(webRTCObj.peerConn.localDescription, stream);
          }
        };

        console.log('WebRTC', 'Calling createOffer');
        webRTCObj.peerConn.createOffer(mediaConstraints).then(
          function onSuccess(offer) {
            console.log('WebRTC', 'createOffer - onSuccess - Calling setLocalDescription');
            return webRTCObj.peerConn.setLocalDescription(offer);
          },
          function onError(err) { console.error(err); }
        );

      }

      function onError(err) {
        console.error('Media error. It was not possible to access the media', err);
      }
    };

    return webRTCObj;
  };
});
