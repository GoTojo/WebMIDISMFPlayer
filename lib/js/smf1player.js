	var filereader = new FileReader();
	var file = null;
	var progressbar = document.getElementById("progress");

	function PlayerInfo() {
		this.init = function() {
			this.buffer = 100; // millisecond
			this.timer = null;
			this.starttime = 0;
			this.nexttempo = -1;
			this.playing = false;
			this.tempo = [{time:0,tickcount:0,tempo:defaulttempo}];
			this.currenttick=0;
			this.nexteventtime = 0;
		};
	};
	var playerinfo=new PlayerInfo();
	function SMFInfo() {
		this.init = function() {
			this.isValid = false;
			this.smfType = 0;
			this.tracks = 0;
			this.TPQN = 120;
			this.tracksize = 0;
		};
	};
	var smfinfo=new SMFInfo();
	function TrackInfo() {
		this.init = function() {
			this.buf = 0;
			this.offsetTop = 4+4+6+4+4; // "MThd", sizeof headerchunk, headersize, trackchunksize, "MTrk"
			this.ptr = 0;
			this.tracksize = 0;
			this.status = 0;
			this.seqno = 0;
			this.metatext = ""
			this.copyright = "";
			this.seqname = "";
			this.instname = "";
			this.lyric = "";
			this.smpteoffset = {hour:0,min:0,sec:0,frame:0,subframe:0};
			this.timesig = {numerator:4,denominator:2,interval:24,sub:8};
			this.keysig = {signature:0,key:0};
			this.nexteventtime = 0;
			this.totaltick = 0;
			this.isend=false;
			this.currentdata = { deltatime:0, message:[], type:"none" };
		};
		this.init();
	};
	var trackinfo=[];
	var defaulttempo = 60000000/120; //BPM=120

	// file load
	function load() {
		smfinfo.init();
		trackinfo=[];
		if (file == null) { return false; }
		var extentions = file.name.split(".");
		if (extentions.length == 0) { return false; };
		var extention = extentions[extentions.length-1];
		if ((extention.toLowerCase() != "mid")) { return false; }
		filereader.addEventListener('load', this.onRead);
		filereader.addEventListener('error', this.onReadError);
		filereader.readAsArrayBuffer(file);
		return true;
	};
	function onRead() {
		smfinfo.buf = new Uint8Array(filereader.result);
		var ptr=0;
		var buf=smfinfo.buf;
		if (String.fromCharCode(buf[ptr++],buf[ptr++],buf[ptr++],buf[ptr++]) != "MThd") { alert("can't find MThd"); return; }
		ptr += 4; // skip MThd size (is fixed 6)
		smfinfo.smfType = (buf[ptr++]<<8)+buf[ptr++]; // 0:format0,1:format1
		smfinfo.tracks = (buf[ptr++]<<8)+buf[ptr++];
		smfinfo.TPQN = (buf[ptr++]<<8)+buf[ptr++];
		if (smfinfo.smfType >= 2) { isValid = false; alert("can't play format2"); return; } 
		trackinfo=[];
		for (var track=0;track<smfinfo.tracks;track++) {
			var info=new TrackInfo();
			if (String.fromCharCode(buf[ptr++],buf[ptr++],buf[ptr++],buf[ptr++]) != "MTrk") { alert("can't find MTrk at track"+track); return; }
			info.tracksize = (buf[ptr++]<<24)+(buf[ptr++]<<16)+(buf[ptr++]<<8)+buf[ptr++];
			if (info.tracksize>smfinfo.tracksize) smfinfo.tracksize=info.tracksize;
			info.offsetTop = ptr;
			info.ptr = ptr;
			trackinfo[track]=info;
			ptr=info.offsetTop+info.tracksize;
		}
		smfinfo.isValid = true;
		progressbar.max = smfinfo.tracksize;
		reset();
	};
	function onReadError() {
		alert("read error!");
	};
	function onSelectedFile(e) {
		file = document.getElementById("filedialog").files[0];
		if (!file.type.match("audio/mid")) alert("not audio/mid");
		if (!load()) alert("invalid smf");
	};
	// player
	function getVLQ(track){ // variable length quantity
		var value = 0;
		for (i=0;i<4;i++) {
			data = smfinfo.buf[trackinfo[track].ptr++];
			value += data&0x7f;
			if ((data&0x80)==0) {
				break;
			}
			value <<= 7;
		}
		return value;
	};
	function getMetaString(track) {
		var len = getVLQ(track);
		var str = "";
		for (i=0;i<len;i++) {
			str += smfinfo.buf[trackinfo[track].ptr++].toString();
		}
		return str;
	}
	function getMeta(track) {
		var info=trackinfo[track];
		var ptr=info.ptr;
		var metaType = smfinfo.buf[info.ptr++];
		var isEnd = false;
		var len=0;
		switch (metaType) {
		case 0x00:	// seqno
			type = "seqno";
			smfinfo.buf[info.ptr++];
			info.seqno = smfinfo.buf[info.ptr++] << 8;
			info.seqno += smfinfo.buf[info.ptr++];
			break;
		case 0x01:	// text
			type = "text";
			info.metatext = getMetaString(track);
			break;
		case 0x02:	// copyright
			type = "copyright";
			info.copyright = getMetaString(track);
			break;
		case 0x03:	// seq name
			type = "sequence name";
			info.seqname = getMetaString(track);
			break;
		case 0x04:	// inst name
			type = "instrument name";
			info.instname = getMetaString(track);
			break;
		case 0x05:	// lyric
			type = "lyric";
			info.lyric = getMetaString(track);
			break;
		case 0x06:	// marker
			type = "marker";
			getMetaString(track);
			break;
		case 0x07:	// cue
			type = "cue point";
			getMetaString(track);
			break;
		case 0x08:
		case 0x09:
		case 0x0A:
		case 0x0B:
		case 0x0C:
		case 0x0D:
		case 0x0E:
		case 0x0F:
			type = ("0"+metaType.toString(16)).split(-2);
			getMetaString(track);
			break;
		case 0x20:	// channel prefix
			type = "channel prefix";
			len = smfinfo.buf[info.ptr++];
			info.ptr += len;
			break;
		case 0x21:	// port
			type = "port";
			len = smfinfo.buf[info.ptr++];
			info.ptr += len;
			break;
		case 0x2F:	// end of track
			type = "end of track";
			len = smfinfo.buf[info.ptr++];
			isEnd = true;
			break;
		case 0x51:	// tempo
			type = "tempo";
			len = smfinfo.buf[info.ptr++];
			playerinfo.nexttempo = smfinfo.buf[info.ptr++]<<16;
			playerinfo.nexttempo += smfinfo.buf[info.ptr++]<<8;
			playerinfo.nexttempo += smfinfo.buf[info.ptr++];
			break;
		case 0x54:	// smpte offset
			type = "SMPTE offset";
			len = smfinfo.buf[info.ptr++];
			info.smpteoffset["hour"] = smfinfo.buf[info.ptr++];
			info.smpteoffset["min"] = smfinfo.buf[info.ptr++];
			info.smpteoffset["sec"] = smfinfo.buf[info.ptr++];
			info.smpteoffset["frame"] = smfinfo.buf[info.ptr++];
			info.smpteoffset["subframe"] = smfinfo.buf[info.ptr++];
			break;
		case 0x58:	// time signature
			type = "time signature";
			len = smfinfo.buf[info.ptr++];
			info.timesig["numerator"] = smfinfo.buf[info.ptr++];
			info.timesig["denominator"] = smfinfo.buf[info.ptr++];
			info.timesig["interval"] = smfinfo.buf[info.ptr++];
			info.timesig["sub"] = smfinfo.buf[info.ptr++];
			break;
		case 0x59:	// key signature
			type = "key signature";
			len = smfinfo.buf[info.ptr++];
			info.timesig["signature"] = smfinfo.buf[info.ptr++];
			info.timesig["key"] = smfinfo.buf[info.ptr++];
			break;
		case 0x7F:	// specific
			type = "specific";
			len = smfinfo.buf[info.ptr++];
			info.ptr += len;
			break;
		default:
			isEnd = true;
			type = "unknown metaevent:"+("0"+metaType.tostring(16)).split(-2);
			alert(type);
			break;
		}
		//console.log(type);
		var index=0;
		var data=[];
		data[index++]=0xFF;
		while (ptr<info.ptr) data[index++]=smfinfo.buf[ptr++];
		return {isEnd:isEnd,type:type,data:data};
	};
	function getNext(track) {
		var result = true;
		var deltatime = getVLQ(track);
		var message = [];
		var info = trackinfo[track];
		var data = smfinfo.buf[info.ptr];
		var index = 0;
		var statusbyte = 0;
		// procedure for running status
		if (data < 0x80) { // running status
			statusbyte = info.status&0xF0;
			message[index++] = info.status;
		} else if (data == 0xF0) { // sysex
			statusbyte = data;
			info.ptr++;
			message[index++] = data;
		} else if (data == 0xF7) { // sysex wo F0
			statusbyte = data;
			info.ptr++;
		} else if (data == 0xFF) { // meta
			statusbyte = data;
			info.ptr++;
			message[index++] = data;
		} else { // status
			info.status = data;
			statusbyte = info.status&0xF0;
			info.ptr++;
			message[index++] = data;
		}
		// parse data
		var len = 0;
		var datatype = "";
		switch (statusbyte) {
		case 0x80: // 3bytes
		case 0x90:
		case 0xA0:
		case 0xB0:
		case 0xE0:
			datatype="data";
			len = 2;
			break;
		case 0xC0: // 2bytes
		case 0xD0:
			datatype="data";
			len = 1;
			break;
		case 0xF0: // sysex (variable length)
		case 0xF7:
			datatype="data";
			len = getVLQ(track);
			break;
		case 0xFF: // meta (variable length)
			len = 0;
			datatype="meta";
			meta = getMeta(track);
			info.isend = !meta.isEnd;
			message = meta.data.concat();
			datatype="meta:"+meta.type;
			break;
		default: // unknown
			datatype="error";
			alert("data read error!");
			info.isend=true;
			break;
		}
		for (i=0;i<len;i++) message[index++]=smfinfo.buf[info.ptr++];
		info.currentdata = { deltatime:deltatime, message:message, type:datatype };
		return;
	}
	function showDetailData(track,message) {
		var info = trackinfo[track];
		var str = info.ptr+" deltatime:"+message.deltatime.toString(16)+" status:"+info.status.toString(16)+" message:"
		for (var i=0;i<message.message.length;i++) str += ("0"+message.message[i].toString(16)).slice(-2)+" ";
		console.log(str);		
	}
	function showData(timestamp,message) {
		var str = (timestamp-playerinfo.starttime)+" : ";
		for (var i=0;i<message.message.length;i++) str += ("0"+message.message[i].toString(16)).slice(-2)+" ";
		console.log(str);
	}
	function test() {
		reset();
		for (var track=0;track<smfinfo.tracks;track++) {
			var message = getNext(track);
			if (!message.result) continue;
			showDetailData(track,message);
		};
		console.log("end");
	}
	function allnoteoff() {
		var message = [0xB0,0x7B,0x00];
		for(ch=0;ch<16;ch++) {
			message[0]=0xB0|ch;
			if (output) output.send(message,window.performance.now()+300);
		}
	}
	function reset() {
		for (var track=0;track<smfinfo.tracks;track++) {
			trackinfo[track].ptr = trackinfo[track].offsetTop;
			playerinfo.init();
		}
		progressbar.value = 0;
	}
	function stop() {
		clearInterval(playerinfo.timer);
		reset();
		allnoteoff();
	}
	function pause() {
		clearInterval(playerinfo.timer);
		playerinfo.playing = false;
		for (var track=0;track<smfinfo.tracks;track++) {
			trackinfo[track].playing=false;
		}
		allnoteoff();
	}
	function play() {
		if (!smfinfo.isValid) return;
		playerinfo.starttime = window.performance.now();
		playerinfo.playing = true;
		for (var track=0;track<smfinfo.tracks;track++) {
			trackinfo[track].init();
			getNext(track);
		}
		doInterval();
		playerinfo.timer = setInterval('doInterval()',playerinfo.buffer);
	}
	function gettime(tick) {
		var lastindex = playerinfo.tempo.length-1;
		var starttick = playerinfo.tempo[lastindex].tickcount;
		var deltatime = (tick-starttick)*playerinfo.tempo[lastindex].tempo/smfinfo.TPQN/1000;
		return playerinfo.tempo[lastindex].time+deltatime;
	}
	function setTempo(tick,tempo) {
		if (tempo==playerinfo.tempo[playerinfo.tempo.length-1].tempo) return;
		playerinfo.tempo.push({time:gettime(tick),tickcount:tick,tempo:tempo});
	}
	function doInterval() {
		var currenttime = window.performance.now();
		var targettime = currenttime+playerinfo.buffer;
		while (1) {
			if (!playerinfo.playing) return;
			var track=0;
			var nexttick=0;
			while (1) {
				var info=trackinfo[track];
				if (info.isend) continue;
				if (info.currentdata.deltatime==0) {
					break;
				}
				if (info.currentdata.deltatime<nexttick) {
					
				}
				track++;
			}
			if (track)
			var currentdata=trackinfo[track].currentdata;

			var info = trackinfo[track];
			if (!message.result) {
				info.playing = false;
				if (track==smfinfo.tracks-1) {
					break;
				} else {
					continue;
				}
			};
			info.totaltick += message.deltatime;
			var timestamp = gettime(info.totaltick)+playerinfo.starttime;
			if (timestamp>targettime) {
				info.nexteventtime = timestamp;
				break;
			}
			if (message.type=="meta:tempo") {
				setTempo(info.totaltick,playerinfo.nexttempo);
				playerinfo.nexttempo = -1;
			}
			//showData(timestamp,message);
			if (message.type=="data") {
				if (output) {
					output.send(message.message,timestamp);
				}
			}
		}
		var curptr=0;
		var isplaying=false;
		for (var track=0;track<smfinfo.tracks;track++) if (trackinfo[track].ptr>curptr) {
			curptr=trackinfo[track].ptr;
			if (trackinfo[track].playing) isplaying=true;
		}
		if (!isplaying) pause();
		progressbar.value = curptr;
	}
