(function ($) {
	function findLine(sdpLines, prefix, substr) {
		return findLineInRange(sdpLines, 0, -1, prefix, substr);
	}

	function findLineInRange(sdpLines, startLine, endLine, prefix, substr) {
		var realEndLine = (endLine != -1) ? endLine : sdpLines.length;
		for (var i = startLine; i < realEndLine; ++i) {
			if (sdpLines[i].indexOf(prefix) === 0) {
				if (!substr || sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
					return i;
				}
			}
		}
		return null;
	}

	function getCodecPayloadType(sdpLine) {
		var pattern = new RegExp('a=rtpmap:(\\d+) \\w+\\/\\d+');
		var result = sdpLine.match(pattern);
		return (result && result.length == 2) ? result[1] : null;
	}

	function setDefaultCodec(mLine, payload) {
		var elements = mLine.split(' ');
		var newLine = [];
		var index = 0;
		for (var i = 0; i < elements.length; i++) {
			if (index === 3) {
				newLine[index++] = payload;
			}
			if (elements[i] !== payload)
				newLine[index++] = elements[i];
		}
		return newLine.join(' ');
	}
	$.FSRTC = function (options) {
		this.options = $.extend({
			useVideo: null,
			useStereo: false,
			userData: null,
			localVideo: null,
			screenShare: false,
			useCamera: "any",
			iceServers: false,
			videoParams: {},
			audioParams: {},
			callbacks: {
				onICEComplete: function () {},
				onICE: function () {},
				onOfferSDP: function () {}
			},
		}, options);
		this.audioEnabled = true;
		this.videoEnabled = true;

		this.mediaData = {
			SDP: null,
			profile: {},
			candidateList: []
		};
		if (moz) {
			this.constraints = {
				offerToReceiveAudio: this.options.useSpeak === "none" ? false : true,
				offerToReceiveVideo: this.options.useVideo ? true : false,
			};
		} else {
			this.constraints = {
				optional: [{
					'DtlsSrtpKeyAgreement': 'true'
				}],
				mandatory: {
					OfferToReceiveAudio: this.options.useSpeak === "none" ? false : true,
					OfferToReceiveVideo: this.options.useVideo ? true : false,
				}
			};
		}
		if (self.options.useVideo) {
			self.options.useVideo.style.display = 'none';
		}
		setCompat();
		checkCompat();
	};
	$.FSRTC.validRes = [];
	$.FSRTC.prototype.useVideo = function (obj, local) {
		var self = this;
		if (obj) {
			self.options.useVideo = obj;
			self.options.localVideo = local;
			if (moz) {
				self.constraints.offerToReceiveVideo = true;
			} else {
				self.constraints.mandatory.OfferToReceiveVideo = true;
			}
		} else {
			self.options.useVideo = null;
			self.options.localVideo = null;
			if (moz) {
				self.constraints.offerToReceiveVideo = false;
			} else {
				self.constraints.mandatory.OfferToReceiveVideo = false;
			}
		}
		if (self.options.useVideo) {
			self.options.useVideo.style.display = 'none';
		}
	};
	$.FSRTC.prototype.useStereo = function (on) {
		var self = this;
		self.options.useStereo = on;
	};
	$.FSRTC.prototype.stereoHack = function (sdp) {
		var self = this;
		if (!self.options.useStereo) {
			return sdp;
		}
		var sdpLines = sdp.split('\r\n');
		var opusIndex = findLine(sdpLines, 'a=rtpmap', 'opus/48000'),
			opusPayload;
		if (!opusIndex) {
			return sdp;
		} else {
			opusPayload = getCodecPayloadType(sdpLines[opusIndex]);
		}
		var fmtpLineIndex = findLine(sdpLines, 'a=fmtp:' + opusPayload.toString());
		if (fmtpLineIndex === null) {
			sdpLines[opusIndex] = sdpLines[opusIndex] + '\r\na=fmtp:' + opusPayload.toString() + " stereo=1; sprop-stereo=1"
		} else {
			sdpLines[fmtpLineIndex] = sdpLines[fmtpLineIndex].concat('; stereo=1; sprop-stereo=1');
		}
		sdp = sdpLines.join('\r\n');
		return sdp;
	};

	function setCompat() {
		$.FSRTC.moz = !!navigator.mozGetUserMedia;
		if (!navigator.getUserMedia) {
			navigator.getUserMedia = navigator.mozGetUserMedia || navigator.webkitGetUserMedia || navigator.msGetUserMedia;
		}
	}

	function checkCompat() {
		if (!navigator.getUserMedia) {
			alert('This application cannot function in this browser.');
			return false;
		}
		return true;
	}

	function onStreamError(self, e) {
		// if (debugVerto) console.log('There has been a problem retrieving the streams - did you allow access? Check Device Resolution', e);
		// generateLog('There has been a problem retrieving the streams - did you allow access? Check Device Resolution', e);
		doCallback(self, "onError", e);
	}

	function onStreamSuccess(self, stream) {
		// if (debugVerto) console.log("Stream Success");
		// generateLog("Stream Success");
		doCallback(self, "onStream", stream);
	}

	function onICE(self, candidate) {
		self.mediaData.candidate = candidate;
		self.mediaData.candidateList.push(self.mediaData.candidate);
		doCallback(self, "onICE");
	}

	function doCallback(self, func, arg) {
		if (func in self.options.callbacks) {
			self.options.callbacks[func](self, arg);
		}
	}

	function onICEComplete(self, candidate) {
		// if (debugVerto) console.log("ICE Complete");
		// generateLog("ICE Complete");
		doCallback(self, "onICEComplete");
	}

	function onChannelError(self, e) {
		console.error("Channel Error", e);
		// generateLog("Channel Error" + e);
		doCallback(self, "onError", e);
	}

	function onICESDP(self, sdp) {
		self.mediaData.SDP = self.stereoHack(sdp.sdp);
		// if (debugVerto) console.log("ICE SDP");
		// generateLog("ICE SDP");									
		doCallback(self, "onICESDP");
	}

	function onAnswerSDP(self, sdp) {
		self.answer.SDP = self.stereoHack(sdp.sdp);
		// if (debugVerto) console.log("ICE ANSWER SDP");
		// generateLog("ICE ANSWER SDP");
		doCallback(self, "onAnswerSDP", self.answer.SDP);
	}

	function onMessage(self, msg) {
		// if (debugVerto) console.log("Message");
		// generateLog("Message");
		doCallback(self, "onICESDP", msg);
	}

	function onRemoteStream(self, stream) {
		if (self.options.useVideo) {
			self.options.useVideo.style.display = 'block';
		}
		var element = self.options.useAudio;
		// if (debugVerto) console.log("REMOTE STREAM", stream, element);
		// generateLog("REMOTE STREAM" + stream + element);
		if (typeof element.srcObject !== 'undefined') {
			element.srcObject = stream;
		} else if (typeof element.mozSrcObject !== 'undefined') {
			element.mozSrcObject = stream;
		} else if (typeof element.src !== 'undefined') {
			element.src = URL.createObjectURL(stream);
		} else {
			console.error('Error attaching stream to element.');
			// generateLog('Error attaching stream to element.');
		}
		self.options.useAudio.play();
		self.remoteStream = stream;
	}

	function onOfferSDP(self, sdp) {
		self.mediaData.SDP = self.stereoHack(sdp.sdp);
		// if (debugVerto) console.log("Offer SDP");
		// generateLog("Offer SDP");
		doCallback(self, "onOfferSDP");
	}
	$.FSRTC.prototype.answer = function (sdp, onSuccess, onError) {
		this.peer.addAnswerSDP({
			type: "answer",
			sdp: sdp
		}, onSuccess, onError);
	};
	$.FSRTC.prototype.stopPeer = function () {
		if (self.peer) {
			// if (debugVerto) console.log("stopping peer");
			// generateLog("stopping peer");
			self.peer.stop();
		}
	}
	$.FSRTC.prototype.stop = function () {
		var self = this;
		if (self.options.useVideo) {
			self.options.useVideo.style.display = 'none';
			if (moz) {
				self.options.useVideo['mozSrcObject'] = null;
			} else {
				self.options.useVideo['src'] = '';
			}
		}
		if (self.localStream) {
			if (typeof self.localStream.stop == 'function') {
				self.localStream.stop();
			} else {
				if (self.localStream.active) {
					var tracks = self.localStream.getTracks();
					//console.error(tracks);
					//generateLog(tracks);
					tracks.forEach(function (track, index) {
						// if (debugVerto) console.log(track);
						//generateLog(track);
						track.stop();
					})
				}
			}
			self.localStream = null;
		}
		if (self.options.localVideo) {
			self.options.localVideo.style.display = 'none';
			if (moz) {
				self.options.localVideo['mozSrcObject'] = null;
			} else {
				self.options.localVideo['src'] = '';
			}
		}
		if (self.options.localVideoStream) {
			if (typeof self.options.localVideoStream.stop == 'function') {
				self.options.localVideoStream.stop();
			} else {
				if (self.options.localVideoStream.active) {
					var tracks = self.options.localVideoStream.getTracks();
					console.error(tracks);
					// generateLog(tracks);
					tracks.forEach(function (track, index) {
						// if (debugVerto) console.log(track);
						// generateLog(track);
						track.stop();
					})
				}
			}
		}
		if (self.peer) {
			saveLog('receive', 'stopping peer');
			// if (debugVerto) console.log("stopping peer");
			// generateLog("stopping peer");
			self.peer.stop();
		}
	};
	$.FSRTC.prototype.getMute = function () {
		var self = this;
		return self.audioEnabled;
	}
	$.FSRTC.prototype.setMute = function (what) {
		var self = this;
		var audioTracks = self.localStream.getAudioTracks();
		for (var i = 0, len = audioTracks.length; i < len; i++) {
			switch (what) {
				case "on":
					audioTracks[i].enabled = true;
					break;
				case "off":
					audioTracks[i].enabled = false;
					break;
				case "toggle":
					audioTracks[i].enabled = !audioTracks[i].enabled;
				default:
					break;
			}
			self.audioEnabled = audioTracks[i].enabled;
		}
		return !self.audioEnabled;
	}
	$.FSRTC.prototype.getVideoMute = function () {
		var self = this;
		return self.videoEnabled;
	}
	$.FSRTC.prototype.setVideoMute = function (what) {
		var self = this;
		var videoTracks = self.localStream.getVideoTracks();
		for (var i = 0, len = videoTracks.length; i < len; i++) {
			switch (what) {
				case "on":
					videoTracks[i].enabled = true;
					break;
				case "off":
					videoTracks[i].enabled = false;
					break;
				case "toggle":
					videoTracks[i].enabled = !videoTracks[i].enabled;
				default:
					break;
			}
			self.videoEnabled = videoTracks[i].enabled;
		}
		return !self.videoEnabled;
	}
	$.FSRTC.prototype.createAnswer = function (params) {
		var self = this;
		self.type = "answer";
		self.remoteSDP = params.sdp;
		console.debug("inbound sdp: ", params.sdp);

		function onSuccess(stream) {
			self.localStream = stream;
			self.peer = RTCPeerConnection({
				type: self.type,
				attachStream: self.localStream,
				onICE: function (candidate) {
					return onICE(self, candidate);
				},
				onICEComplete: function () {
					return onICEComplete(self);
				},
				onRemoteStream: function (stream) {
					return onRemoteStream(self, stream);
				},
				onICESDP: function (sdp) {
					return onICESDP(self, sdp);
				},
				onChannelError: function (e) {
					return onChannelError(self, e);
				},
				constraints: self.constraints,
				iceServers: self.options.iceServers,
				offerSDP: {
					type: "offer",
					sdp: self.remoteSDP
				}
			});
			onStreamSuccess(self);
		}

		function onError(e) {
			onStreamError(self, e);
		}
		var mediaParams = getMediaParams(self);
		// if (debugVerto) console.log("Audio constraints", mediaParams.audio);
		// generateLog("Audio constraints" + mediaParams.audio);
		// if (debugVerto) console.log("Video constraints", mediaParams.video);
		// generateLog("Video constraints" + mediaParams.video);
		if (self.options.useVideo && self.options.localVideo) {
			getUserMedia({
				constraints: {
					audio: false,
					video: {
						mandatory: self.options.videoParams,
						optional: []
					},
				},
				localVideo: self.options.localVideo,
				onsuccess: function (e) {
					self.options.localVideoStream = e;
					// if (debugVerto) console.log("local video ready");
					// generateLog("local video ready");
				},
				onerror: function (e) {
					console.error("local video error!");
					// generateLog("local video error!");
				}
			});
		}
		getUserMedia({
			constraints: {
				audio: mediaParams.audio,
				video: mediaParams.video
			},
			video: mediaParams.useVideo,
			onsuccess: onSuccess,
			onerror: onError
		});
	};

	function getMediaParams(obj) {
		var audio;
		if (obj.options.useMic && obj.options.useMic === "none") {
			// if (debugVerto) console.log("Microphone Disabled");
			// generateLog("Microphone Disabled");
			audio = false;
		} else if (obj.options.videoParams && obj.options.screenShare) {
			// console.error("SCREEN SHARE");
			// generateLog("SCREEN SHARE");
			audio = false;
		} else {
			audio = {
				mandatory: {},
				optional: []
			};
			if (obj.options.useMic !== "any") {
				audio.optional = [{
					sourceId: obj.options.useMic
				}]
			}
			if (obj.options.audioParams) {
				for (var key in obj.options.audioParams) {
					var con = {};
					con[key] = obj.options.audioParams[key];
					audio.optional.push(con);
				}
			}
		}
		if (obj.options.useVideo && obj.options.localVideo) {
			getUserMedia({
				constraints: {
					audio: false,
					video: {
						mandatory: obj.options.videoParams,
						optional: []
					},
				},
				localVideo: obj.options.localVideo,
				onsuccess: function (e) {
					self.options.localVideoStream = e;
					// if (debugVerto) console.log("local video ready");
					// generateLog("local video ready");
				},
				onerror: function (e) {
					console.error("local video error!");
					// generateLog("local video error!");
				}
			});
		}
		var video = {};
		var bestFrameRate = obj.options.videoParams.vertoBestFrameRate;
		delete obj.options.videoParams.vertoBestFrameRate;
		video = {
			mandatory: obj.options.videoParams,
			optional: []
		}
		var useVideo = obj.options.useVideo;
		if (useVideo && obj.options.useCamera && obj.options.useCamera !== "none") {
			if (!video.optional) {
				video.optional = [];
			}
			if (obj.options.useCamera !== "any") {
				video.optional.push({
					sourceId: obj.options.useCamera
				});
			}
			if (bestFrameRate) {
				video.optional.push({
					minFrameRate: bestFrameRate
				});
				video.optional.push({
					maxFrameRate: bestFrameRate
				});
			}
		} else {
			// if (debugVerto) console.log("Camera Disabled");
			// generateLog("Camera Disabled");
			video = false;
			useVideo = false;
		}
		return {
			audio: audio,
			video: video,
			useVideo: useVideo
		};
	}
	$.FSRTC.prototype.call = function (profile) {
		checkCompat();
		var self = this;
		var screen = false;
		self.type = "offer";
		if (self.options.videoParams && self.options.screenShare) {
			screen = true;
		}

		function onSuccess(stream) {
			self.localStream = stream;
			if (screen) {
				if (moz) {
					self.constraints.OfferToReceiveVideo = false;
				} else {
					self.constraints.mandatory.OfferToReceiveVideo = false;
				}
			}
			self.peer = RTCPeerConnection({
				type: self.type,
				attachStream: self.localStream,
				onICE: function (candidate) {
					return onICE(self, candidate);
				},
				onICEComplete: function () {
					return onICEComplete(self);
				},
				onRemoteStream: screen ? function (stream) {} : function (stream) {
					return onRemoteStream(self, stream);
				},
				onOfferSDP: function (sdp) {
					return onOfferSDP(self, sdp);
				},
				onICESDP: function (sdp) {
					return onICESDP(self, sdp);
				},
				onChannelError: function (e) {
					return onChannelError(self, e);
				},
				constraints: self.constraints,
				iceServers: self.options.iceServers,
			});
			onStreamSuccess(self, stream);
		}

		function onError(e) {
			onStreamError(self, e);
		}
		var mediaParams = getMediaParams(self);
		// if (debugVerto) console.log("Audio constraints", mediaParams.audio);
		// generateLog("Audio constraints" + mediaParams.audio);
		// if (debugVerto) console.log("Video constraints", mediaParams.video);
		// generateLog("Video constraints" + mediaParams.video);
		if (mediaParams.audio || mediaParams.video) {
			getUserMedia({
				constraints: {
					audio: mediaParams.audio,
					video: mediaParams.video
				},
				video: mediaParams.useVideo,
				onsuccess: onSuccess,
				onerror: onError
			});
		} else {
			onSuccess(null);
		}
	};
	window.moz = !!navigator.mozGetUserMedia;

	function RTCPeerConnection(options) {
		var gathering = false,
			done = false;
		var w = window,
			PeerConnection = w.mozRTCPeerConnection || w.webkitRTCPeerConnection,
			SessionDescription = w.mozRTCSessionDescription || w.RTCSessionDescription,
			IceCandidate = w.mozRTCIceCandidate || w.RTCIceCandidate;
		var STUN = {
			url: !moz ? 'stun:stun.l.google.com:19302' : 'stun:23.21.150.121'
		};
		var iceServers = null;
		if (options.iceServers) {
			var tmp = options.iceServers;
			if (typeof (tmp) === "boolean") {
				tmp = null;
			}
			if (tmp && !(typeof (tmp) == "object" && tmp.constructor === Array)) {
				console.warn("iceServers must be an array, reverting to default ice servers");
				// generateLog("iceServers must be an array, reverting to default ice servers");
				tmp = null;
			}
			iceServers = {
				iceServers: tmp || [STUN]
			};
			if (!moz && !tmp) {
				iceServers.iceServers = [STUN];
			}
		}
		var optional = {
			optional: []
		};
		if (!moz) {
			optional.optional = [{
				DtlsSrtpKeyAgreement: true
			}, {
				RtpDataChannels: options.onChannelMessage ? true : false
			}];
		}
		var peer = new PeerConnection(iceServers, optional);
		openOffererChannel();
		var x = 0;

		function ice_handler() {
			done = true;
			gathering = null;
			if (options.onICEComplete) {
				options.onICEComplete();
			}
			if (options.type == "offer") {
				if ((!moz || (!options.sentICESDP && peer.localDescription.sdp.match(/a=candidate/)) && !x && options.onICESDP)) {
					options.onICESDP(peer.localDescription);
				}
			} else {
				if (!x && options.onICESDP) {
					options.onICESDP(peer.localDescription);
				}
			}
		}
		peer.onicecandidate = function (event) {
			if (done) {
				return;
			}
			if (!gathering) {
				gathering = setTimeout(ice_handler, 200); /* ALTERADO */
			}
			if (event) {
				if (event.candidate) {
					options.onICE(event.candidate);
				}
			} else {
				done = true;
				if (gathering) {
					clearTimeout(gathering);
					gathering = null;
				}
				ice_handler();
			}
		};
		if (options.attachStream)
			peer.addStream(options.attachStream);
		if (options.attachStreams && options.attachStream.length) {
			var streams = options.attachStreams;
			for (var i = 0; i < streams.length; i++) {
				peer.addStream(streams[i]);
			}
		}
		peer.onaddstream = function (event) {
			var remoteMediaStream = event.stream;
			remoteMediaStream.onended = function () {
				if (options.onRemoteStreamEnded)
					options.onRemoteStreamEnded(remoteMediaStream);
			};
			if (options.onRemoteStream)
				options.onRemoteStream(remoteMediaStream);
		};
		var constraints = options.constraints || {
			offerToReceiveAudio: true,
			offerToReceiveVideo: true
		};

		function createOffer() {
			if (!options.onOfferSDP)
				return;
			peer.createOffer(function (sessionDescription) {
				sessionDescription.sdp = serializeSdp(sessionDescription.sdp);
				peer.setLocalDescription(sessionDescription);
				options.onOfferSDP(sessionDescription);
				if (moz && options.onICESDP && sessionDescription.sdp.match(/a=candidate/)) {
					options.onICESDP(sessionDescription);
					options.sentICESDP = 1;
				}
			}, onSdpError, constraints);
		}

		function createAnswer() {
			if (options.type != "answer")
				return;
			peer.setRemoteDescription(new SessionDescription(options.offerSDP), onSdpSuccess, onSdpError);
			peer.createAnswer(function (sessionDescription) {
				sessionDescription.sdp = serializeSdp(sessionDescription.sdp);
				peer.setLocalDescription(sessionDescription);
				if (options.onAnswerSDP) {
					options.onAnswerSDP(sessionDescription);
				}
			}, onSdpError, constraints);
		}
		if ((options.onChannelMessage && !moz) || !options.onChannelMessage) {
			createOffer();
			createAnswer();
		}

		function setBandwidth(sdp) {
			sdp = sdp.replace(/b=AS([^\r\n]+\r\n)/g, '');
			sdp = sdp.replace(/a=mid:data\r\n/g, 'a=mid:data\r\nb=AS:1638400\r\n');
			return sdp;
		}

		function getInteropSDP(sdp) {
			var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
				extractedChars = '';

			function getChars() {
				extractedChars += chars[parseInt(Math.random() * 40)] || '';
				if (extractedChars.length < 40)
					getChars();
				return extractedChars;
			}
			if (options.onAnswerSDP)
				sdp = sdp.replace(/(a=crypto:0 AES_CM_128_HMAC_SHA1_32)(.*?)(\r\n)/g, '');
			var inline = getChars() + '\r\n' + (extractedChars = '');
			sdp = sdp.indexOf('a=crypto') == -1 ? sdp.replace(/c=IN/g, 'a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:' + inline + 'c=IN') : sdp;
			return sdp;
		}

		function serializeSdp(sdp) {
			return sdp;
		}
		var channel;

		function openOffererChannel() {
			if (!options.onChannelMessage || (moz && !options.onOfferSDP))
				return;
			_openOffererChannel();
			if (!moz)
				return;
			navigator.mozGetUserMedia({
				audio: true,
				fake: true
			}, function (stream) {
				peer.addStream(stream);
				createOffer();
			}, useless);
		}

		function _openOffererChannel() {
			channel = peer.createDataChannel(options.channel || 'RTCDataChannel', moz ? {} : {
				reliable: false
			});
			if (moz)
				channel.binaryType = 'blob';
			setChannelEvents();
		}

		function setChannelEvents() {
			channel.onmessage = function (event) {
				if (options.onChannelMessage)
					options.onChannelMessage(event);
			};
			channel.onopen = function () {
				if (options.onChannelOpened)
					options.onChannelOpened(channel);
			};
			channel.onclose = function (event) {
				if (options.onChannelClosed)
					options.onChannelClosed(event);
				console.warn('WebRTC DataChannel closed', event);
				// generateLog('WebRTC DataChannel closed' + event);
			};
			channel.onerror = function (event) {
				if (options.onChannelError)
					options.onChannelError(event);
				console.error('WebRTC DataChannel error', event);
				// generateLog('WebRTC DataChannel error' + event);
			};
		}
		if (options.onAnswerSDP && moz && options.onChannelMessage)
			openAnswererChannel();

		function openAnswererChannel() {
			peer.ondatachannel = function (event) {
				channel = event.channel;
				channel.binaryType = 'blob';
				setChannelEvents();
			};
			if (!moz)
				return;
			navigator.mozGetUserMedia({
				audio: true,
				fake: true
			}, function (stream) {
				peer.addStream(stream);
				createAnswer();
			}, useless);
		}

		function useless() {
			log('Error in fake:true');
		}

		function onSdpSuccess() {}

		function onSdpError(e) {
			if (options.onChannelError) {
				options.onChannelError(e);
			}
			console.error('sdp error:', e);
			// generateLog('sdp error:' + e);
		}
		return {
			addAnswerSDP: function (sdp, cbSuccess, cbError) {
				peer.setRemoteDescription(new SessionDescription(sdp), cbSuccess ? cbSuccess : onSdpSuccess, cbError ? cbError : onSdpError);
			},
			addICE: function (candidate) {
				peer.addIceCandidate(new IceCandidate({
					sdpMLineIndex: candidate.sdpMLineIndex,
					candidate: candidate.candidate
				}));
			},
			peer: peer,
			channel: channel,
			sendData: function (message) {
				if (channel) {
					channel.send(message);
				}
			},
			stop: function () {
				peer.close();
				if (options.attachStream) {
					if (typeof options.attachStream.stop == 'function') {
						options.attachStream.stop();
					} else {
						options.attachStream.active = false;
					}
				}
			}
		};
	}
	var video_constraints = {
		mandatory: {},
		optional: []
	};

	function getUserMedia(options) {
		var n = navigator,
			media;
		n.getMedia = n.webkitGetUserMedia || n.mozGetUserMedia;
		n.getMedia(options.constraints || {
			audio: true,
			video: video_constraints
		}, streaming, options.onerror || function (e) {
			console.error(e);
			// generateLog(e);
		});

		function streaming(stream) {
			if (options.localVideo) {
				options.localVideo[moz ? 'mozSrcObject' : 'src'] = moz ? stream : window.webkitURL.createObjectURL(stream);
				options.localVideo.style.display = 'block';
			}
			if (options.onsuccess) {
				options.onsuccess(stream);
			}
			media = stream;
		}
		return media;
	}
	$.FSRTC.resSupported = function (w, h) {
		for (var i in $.FSRTC.validRes) {
			if ($.FSRTC.validRes[i][0] == w && $.FSRTC.validRes[i][1] == h) {
				return true;
			}
		}
		return false;
	}
	$.FSRTC.bestResSupported = function () {
		var w = 0,
			h = 0;
		for (var i in $.FSRTC.validRes) {
			if ($.FSRTC.validRes[i][0] > w && $.FSRTC.validRes[i][1] > h) {
				w = $.FSRTC.validRes[i][0];
				h = $.FSRTC.validRes[i][1];
			}
		}
		return [w, h];
	}
	var resList = [
		[320, 180],
		[320, 240],
		[640, 360],
		[640, 480],
		[1280, 720],
		[1920, 1080]
	];
	var resI = 0;
	var ttl = 0;
	var checkRes = function (cam, func) {
		if (resI >= resList.length) {
			var res = {
				'validRes': $.FSRTC.validRes,
				'bestResSupported': $.FSRTC.bestResSupported()
			};
			chrome.storage.local.set("res_" + cam, $.toJSON(res));
			if (func)
				return func(res);
			return;
		}
		var video = {
			mandatory: {},
			optional: []
		}
		if (cam) {
			video.optional = [{
				sourceId: cam
			}];
		}
		w = resList[resI][0];
		h = resList[resI][1];
		resI++;
		video.mandatory = {
			"minWidth": w,
			"minHeight": h,
			"maxWidth": w,
			"maxHeight": h
		};
		getUserMedia({
			constraints: {
				audio: ttl++ == 0,
				video: video
			},
			onsuccess: function (e) {
				e.getTracks().forEach(function (track) {
					track.stop();
				});
				console.info(w + "x" + h + " supported.");
				$.FSRTC.validRes.push([w, h]);
				checkRes(cam, func);
			},
			onerror: function (e) {
				console.error(w + "x" + h + " not supported.");
				// generateLog(w + "x" + h + " not supported.");
				checkRes(cam, func);
			}
		});
	}
	$.FSRTC.getValidRes = function (cam, func) {
		var used = [];
		chrome.storage.local.get(function (itemStorage) {
			// if (debugVerto) console.log(itemStorage);
			// generateLog(itemStorage);
			//var cached = itemStorage[res_" + cam];
		});
		if (cached) {
			var cache = $.parseJSON(cached);
			if (cache) {
				$.FSRTC.validRes = cache.validRes;
				// if (debugVerto) console.log("CACHED RES FOR CAM " + cam, cache);
				// generateLog("CACHED RES FOR CAM " + cam, cache);
			} else {
				console.error("INVALID CACHE");
				// generateLog("INVALID CACHE");
			}
			return func ? func(cache) : null;
		}
		$.FSRTC.validRes = [];
		resI = 0;
		checkRes(cam, func);
	}
	$.FSRTC.checkPerms = function (runtime, check_audio, check_video) {
		getUserMedia({
			constraints: {
				audio: check_audio,
				video: check_video,
			},
			onsuccess: function (e) {
				e.getTracks().forEach(function (track) {
					track.stop();
				});
				console.info("media perm init complete");
				if (runtime) {
					setTimeout(runtime, 100, true);
				}
			},
			onerror: function (e) {
				if (check_video && check_audio) {
					console.error("error, retesting with audio params only");
					// generateLog("error, retesting with audio params only");
					return $.FSRTC.checkPerms(runtime, check_audio, false);
				}
				console.error("media perm init error");
				// generateLog("media perm init error");
				if (runtime) {
					runtime(false)
				}
			}
		});
	}
})(jQuery);
(function ($) {
	$.JsonRpcClient = function (options) {
		var self = this;
		this.options = $.extend({
			ajaxUrl: null,
			socketUrl: null,
			onmessage: null,
			login: null,
			passwd: null,
			sessid: null,
			loginParams: null,
			userVariables: null,
			getSocket: function (onmessage_cb) {
				return self._getSocket(onmessage_cb);
			}
		}, options);
		self.ws_cnt = 0;
		this.wsOnMessage = function (event) {
			self._wsOnMessage(event);
		};
	};
	$.JsonRpcClient.prototype._ws_socket = null;
	$.JsonRpcClient.prototype._ws_callbacks = {};
	$.JsonRpcClient.prototype._current_id = 1;
	$.JsonRpcClient.prototype.speedTest = function (bytes, cb) {
		var socket = this.options.getSocket(this.wsOnMessage);
		if (socket !== null) {
			this.speedCB = cb;
			this.speedBytes = bytes;
			socket.send("#SPU " + bytes);
			var loops = bytes / 1024;
			var rem = bytes % 1024;
			var i;
			var data = new Array(1024).join(".");
			for (i = 0; i < loops; i++) {
				socket.send("#SPB " + data);
			}
			if (rem) {
				socket.send("#SPB " + data);
			}
			socket.send("#SPE");
		}
	};
	$.JsonRpcClient.prototype.call = function (method, params, success_cb, error_cb) {
		if (!params) {
			params = {};
		}
		if (this.options.sessid) {
			params.sessid = this.options.sessid;
		}
		var request = {
			jsonrpc: '2.0',
			method: method,
			params: params,
			id: this._current_id++
		};
		if (!success_cb) {
			success_cb = function (e) {
				// if (debugVerto) console.log("Success: ", e);
				// generateLog("Success: " + e);
			};
		}
		if (!error_cb) {
			error_cb = function (e) {
				// if (debugVerto) console.log("Error: ", e);
				// generateLog("Error: " + e);
			};
		}
		var socket = this.options.getSocket(this.wsOnMessage);
		if (socket !== null) {
			this._wsCall(socket, request, success_cb, error_cb);
			return;
		}
		if (this.options.ajaxUrl === null) {
			throw "$.JsonRpcClient.call used with no websocket and no http endpoint.";
		}
		$.ajax({
			type: 'POST',
			url: this.options.ajaxUrl,
			data: $.toJSON(request),
			dataType: 'json',
			cache: false,
			success: function (data) {
				if ('error' in data)
					error_cb(data.error, this);
				success_cb(data.result, this);
			},
			error: function (jqXHR, textStatus, errorThrown) {
				try {
					var response = $.parseJSON(jqXHR.responseText);
					if ('console' in window)
						if (debugVerto) console.log(response);
					generateLog(response);
					error_cb(response.error, this);
				} catch (err) {
					error_cb({
						error: jqXHR.responseText
					}, this);
				}
			}
		});
	};
	$.JsonRpcClient.prototype.notify = function (method, params) {
		if (this.options.sessid) {
			params.sessid = this.options.sessid;
		}
		var request = {
			jsonrpc: '2.0',
			method: method,
			params: params
		};
		var socket = this.options.getSocket(this.wsOnMessage);
		if (socket !== null) {
			this._wsCall(socket, request);
			return;
		}
		if (this.options.ajaxUrl === null) {
			throw "$.JsonRpcClient.notify used with no websocket and no http endpoint.";
		}
		$.ajax({
			type: 'POST',
			url: this.options.ajaxUrl,
			data: $.toJSON(request),
			dataType: 'json',
			cache: false
		});
	};
	$.JsonRpcClient.prototype.batch = function (callback, all_done_cb, error_cb) {
		var batch = new $.JsonRpcClient._batchObject(this, all_done_cb, error_cb);
		callback(batch);
		batch._execute();
	};
	$.JsonRpcClient.prototype.socketReady = function () {
		if (this._ws_socket === null || this._ws_socket.readyState > 1) {
			return false;
		}
		return true;
	};
	$.JsonRpcClient.prototype.closeSocket = function () {
		var self = this;
		if (self.socketReady()) {
			self._ws_socket.onclose = function (w) {
				// if (debugVerto) console.log("Closing Socket");
				// generateLog("Closing Socket");
			};
			self._ws_socket.close();
		}
	};
	$.JsonRpcClient.prototype.loginData = function (params) {
		var self = this;
		self.options.login = params.login;
		self.options.passwd = params.passwd;
		self.options.loginParams = params.loginParams;
		self.options.userVariables = params.userVariables;
	};
	// WebSocket.prototype.setKeepAlive = function setKeepAlive(enable, initialDelay) { return this._socket.setKeepAlive(enable, initialDelay); };<<LINHA ADICIONADA>>
	$.JsonRpcClient.prototype.connectSocket = function (onmessage_cb) {
		var self = this;
		if (self.to) {
			clearTimeout(self.to);
		}
		if (!self.socketReady()) {
			self.authing = false;
			if (self._ws_socket) {
				delete self._ws_socket;
			}
			self._ws_socket = new WebSocket(self.options.socketUrl);
			if (self._ws_socket) {
				self._ws_socket.onmessage = onmessage_cb;
				self._ws_socket.onclose = function (w) {
					if (!self.ws_sleep) {
						self.ws_sleep = 1000;
					}
					if (self.options.onWSClose) {
						self.options.onWSClose(self);
					}
					console.error("Websocket Lost " + self.ws_cnt + " sleep: " + self.ws_sleep + "msec");
					// generateLog("Websocket Lost " + self.ws_cnt + " sleep: " + self.ws_sleep + "msec");
					self.to = setTimeout(function () {
						// if (debugVerto) console.log("Attempting Reconnection....");
						// generateLog("Attempting Reconnection....");
						self.connectSocket(onmessage_cb);
					}, self.ws_sleep);
					self.ws_cnt++;
					if (self.ws_sleep < 3000 && (self.ws_cnt % 10) === 0) {
						self.ws_sleep += 1000;
					}
				};
				self._ws_socket.onopen = function () {
					if (self.to) {
						clearTimeout(self.to);
					}
					self.ws_sleep = 1000;
					self.ws_cnt = 0;
					if (self.options.onWSConnect) {
						self.options.onWSConnect(self);
					}
					var req;
					while ((req = $.JsonRpcClient.q.pop())) {
						self._ws_socket.send(req);
					}
				};
				// self._ws_socket.setKeepAlive(true, 1);<<LINHA ADICIONADA>>
			}
		}
		return self._ws_socket ? true : false;
	};
	$.JsonRpcClient.prototype._getSocket = function (onmessage_cb) {
		if (this.options.socketUrl === null || !("WebSocket" in window))
			return null;
		this.connectSocket(onmessage_cb);
		return this._ws_socket;
	};
	$.JsonRpcClient.q = [];
	$.JsonRpcClient.prototype._wsCall = function (socket, request, success_cb, error_cb) {
		var request_json = $.toJSON(request);
		if (socket.readyState < 1) {
			self = this;
			$.JsonRpcClient.q.push(request_json);
		} else {
			socket.send(request_json);
		}
		if ('id' in request && typeof success_cb !== 'undefined') {
			this._ws_callbacks[request.id] = {
				request: request_json,
				request_obj: request,
				success_cb: success_cb,
				error_cb: error_cb
			};
		}
	};
	$.JsonRpcClient.prototype._wsOnMessage = function (event) {
		var response;
		if (event.data[0] == "#" && event.data[1] == "S" && event.data[2] == "P") {
			if (event.data[3] == "U") {
				this.up_dur = parseInt(event.data.substring(4));
			} else if (this.speedCB && event.data[3] == "D") {
				this.down_dur = parseInt(event.data.substring(4));
				var up_kps = (((this.speedBytes * 8) / (this.up_dur / 1000)) / 1024).toFixed(0);
				var down_kps = (((this.speedBytes * 8) / (this.down_dur / 1000)) / 1024).toFixed(0);
				console.info("Speed Test: Up: " + up_kps + " Down: " + down_kps);
				this.speedCB(event, {
					upDur: this.up_dur,
					downDur: this.down_dur,
					upKPS: up_kps,
					downKPS: down_kps
				});
				this.speedCB = null;
			}
			return;
		}
		try {
			response = $.parseJSON(event.data);
			if (typeof response === 'object' && 'jsonrpc' in response && response.jsonrpc === '2.0') {
				if ('result' in response && this._ws_callbacks[response.id]) {
					var success_cb = this._ws_callbacks[response.id].success_cb;
					delete this._ws_callbacks[response.id];
					success_cb(response.result, this);
					return;
				} else if ('error' in response && this._ws_callbacks[response.id]) {
					var error_cb = this._ws_callbacks[response.id].error_cb;
					var orig_req = this._ws_callbacks[response.id].request;
					if (!self.authing && response.error.code == -32000 && self.options.login && self.options.passwd) {
						self.authing = true;
						this.call("login", {
							login: self.options.login,
							passwd: self.options.passwd,
							loginParams: self.options.loginParams,
							userVariables: self.options.userVariables
						}, this._ws_callbacks[response.id].request_obj.method == "login" ? function (e) {
							self.authing = false;
							// if (debugVerto) console.log("logged in");
							// generateLog("logged in");
							delete self._ws_callbacks[response.id];
							if (self.options.onWSLogin) {
								self.options.onWSLogin(true, self);
							}
						} : function (e) {
							self.authing = false;
							// if (debugVerto) console.log("logged in, resending request id: " + response.id);
							// generateLog("logged in, resending request id: " + response.id);
							var socket = self.options.getSocket(self.wsOnMessage);
							if (socket !== null) {
								socket.send(orig_req);
							}
							if (self.options.onWSLogin) {
								self.options.onWSLogin(true, self);
							}
						}, function (e) {
							// if (debugVerto) console.log("error logging in, request id:", response.id);
							// generateLog("error logging in, request id:" + response.id);
							delete self._ws_callbacks[response.id];
							error_cb(response.error, this);
							if (self.options.onWSLogin) {
								self.options.onWSLogin(false, self);
							}
						});
						return;
					}
					delete this._ws_callbacks[response.id];
					error_cb(response.error, this);
					return;
				}
			}
		} catch (err) {
			// if (debugVerto) console.log("ERROR: " + err);
			// generateLog("ERROR: " + err);
			return;
		}
		if (typeof this.options.onmessage === 'function') {
			event.eventData = response;
			if (!event.eventData) {
				event.eventData = {};
			}
			var reply = this.options.onmessage(event);
			if (reply && typeof reply === "object" && event.eventData.id) {
				var msg = {
					jsonrpc: "2.0",
					id: event.eventData.id,
					result: reply
				};
				var socket = self.options.getSocket(self.wsOnMessage);
				if (socket !== null) {
					socket.send($.toJSON(msg));
				}
			}
		}
	};
	$.JsonRpcClient._batchObject = function (jsonrpcclient, all_done_cb, error_cb) {
		this._requests = [];
		this.jsonrpcclient = jsonrpcclient;
		this.all_done_cb = all_done_cb;
		this.error_cb = typeof error_cb === 'function' ? error_cb : function () {};
	};
	$.JsonRpcClient._batchObject.prototype.call = function (method, params, success_cb, error_cb) {
		if (!params) {
			params = {};
		}
		if (this.options.sessid) {
			params.sessid = this.options.sessid;
		}
		if (!success_cb) {
			success_cb = function (e) {
				// if (debugVerto) console.log("Success: ", e);
				// generateLog("Success: " + e);
			};
		}
		if (!error_cb) {
			error_cb = function (e) {
				// if (debugVerto) console.log("Error: ", e);
				// generateLog("Error: " + e);
			};
		}
		this._requests.push({
			request: {
				jsonrpc: '2.0',
				method: method,
				params: params,
				id: this.jsonrpcclient._current_id++
			},
			success_cb: success_cb,
			error_cb: error_cb
		});
	};
	$.JsonRpcClient._batchObject.prototype.notify = function (method, params) {
		if (this.options.sessid) {
			params.sessid = this.options.sessid;
		}
		this._requests.push({
			request: {
				jsonrpc: '2.0',
				method: method,
				params: params
			}
		});
	};
	$.JsonRpcClient._batchObject.prototype._execute = function () {
		var self = this;
		if (this._requests.length === 0)
			return;
		var batch_request = [];
		var handlers = {};
		var i = 0;
		var call;
		var success_cb;
		var error_cb;
		var socket = self.jsonrpcclient.options.getSocket(self.jsonrpcclient.wsOnMessage);
		if (socket !== null) {
			for (i = 0; i < this._requests.length; i++) {
				call = this._requests[i];
				success_cb = ('success_cb' in call) ? call.success_cb : undefined;
				error_cb = ('error_cb' in call) ? call.error_cb : undefined;
				self.jsonrpcclient._wsCall(socket, call.request, success_cb, error_cb);
			}
			if (typeof all_done_cb === 'function')
				all_done_cb(result);
			return;
		}
		for (i = 0; i < this._requests.length; i++) {
			call = this._requests[i];
			batch_request.push(call.request);
			if ('id' in call.request) {
				handlers[call.request.id] = {
					success_cb: call.success_cb,
					error_cb: call.error_cb
				};
			}
		}
		success_cb = function (data) {
			self._batchCb(data, handlers, self.all_done_cb);
		};
		if (self.jsonrpcclient.options.ajaxUrl === null) {
			throw "$.JsonRpcClient.batch used with no websocket and no http endpoint.";
		}
		$.ajax({
			url: self.jsonrpcclient.options.ajaxUrl,
			data: $.toJSON(batch_request),
			dataType: 'json',
			cache: false,
			type: 'POST',
			error: function (jqXHR, textStatus, errorThrown) {
				self.error_cb(jqXHR, textStatus, errorThrown);
			},
			success: success_cb
		});
	};
	$.JsonRpcClient._batchObject.prototype._batchCb = function (result, handlers, all_done_cb) {
		for (var i = 0; i < result.length; i++) {
			var response = result[i];
			if ('error' in response) {
				if (response.id === null || !(response.id in handlers)) {
					if ('console' in window)
						if (debugVerto) console.log(response);
					// generateLog(response);
				} else {
					handlers[response.id].error_cb(response.error, this);
				}
			} else {
				if (!(response.id in handlers) && 'console' in window) {
					// if (debugVerto) console.log(response);
					// generateLog(response);
				} else {
					handlers[response.id].success_cb(response.result, this);
				}
			}
		}
		if (typeof all_done_cb === 'function')
			all_done_cb(result);
	};
})(jQuery);