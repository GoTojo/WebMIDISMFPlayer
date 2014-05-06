	var filereader = new FileReader();
	var file = null;
	var progressbar = document.getElementById("progress");

	var playerinfo = function() {
		var buffer; // millisecond
		var timer;
		var starttime;
		var nexttempo;
		var playing;
		var tempo;
		var totaltick;
		var nexteventtime;
		var init;
	};
	playerinfo.init = function() {
		playerinfo.buffer = 100; // millisecond
		playerinfo.timer = null;
		playerinfo.starttime = 0;
		playerinfo.nexttempo = -1;
		playerinfo.playing = false;
		playerinfo.totaltick = 0;
		playerinfo.nexteventtime = 0;
		playerinfo.tempo = [{time:0,tickcount:0,tempo:defaulttempo}];
	};
	playerinfo.init();
	var smfinfo = function() {
		var isValid;
		var smfType;
		var tracks;
		var TPQN;
		var tracksize;
		var init;
	};
	smfinfo.init = function() {
		smfinfo.isValid = false;
		smfinfo.smfType = 0;
		smfinfo.tracks = 0;
		smfinfo.TPQN = 120;
		smfinfo.tracksize = 0;
	};
	var songinfo = function() {
		var buf;
		var offsetTop;
		var ptr;
		var status;
		var seqno;
		var metatext;
		var copyright;
		var seqname;
		var instname;
		var lyric;
		var smpteoffset;
		var timesig;
		var keysig;
		var init;
	};
	var defaulttempo = 60000000/120; //BPM=120
	songinfo.init = function() {
		songinfo.buf = 0;
		songinfo.offsetTop = 4+4+6+4+4; // "MThd", sizeof headerchunk, headersize, trackchunksize, "MTrk"
		songinfo.ptr = 0;
		songinfo.status = 0;
		songinfo.seqno = 0;
		songinfo.metatext = ""
		songinfo.copyright = "";
		songinfo.seqname = "";
		songinfo.instname = "";
		songinfo.lyric = "";
		songinfo.smpteoffset = {hour:0,min:0,sec:0,frame:0,subframe:0};
		songinfo.timesig = {numerator:4,denominator:2,interval:24,sub:8};
		songinfo.keysig = {signature:0,key:0};
	};

	// file load
	function load() {
		smfinfo.init();
		songinfo.init();
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
		songinfo.buf = new Uint8Array(filereader.result);
		//console.log(smfinfo.buf);
		var ptr=0;
		var buf=songinfo.buf;
		if (String.fromCharCode(buf[ptr++],buf[ptr++],buf[ptr++],buf[ptr++]) != "MThd") { alert("can't find MThd"); return; }
		ptr += 4; // skip MThd size (is fixed 6)
		smfinfo.smfType = (buf[ptr++]<<8)+buf[ptr++];
		smfinfo.tracks = (buf[ptr++]<<8)+buf[ptr++];
		smfinfo.TPQN = (buf[ptr++]<<8)+buf[ptr++];
		if (smfinfo.smfType != 0) { isValid = false; alert("can't play format1"); return; } // format0 only
		if (smfinfo.tracks != 1) { isValid = false; alert("can't play format1"); return; } // format0 only
		if (String.fromCharCode(buf[ptr++],buf[ptr++],buf[ptr++],buf[ptr++]) != "MTrk") { alert("can't find MTrk"); return; }
		smfinfo.tracksize = (buf[ptr++]<<24)+(buf[ptr++]<<16)+(buf[ptr++]<<8)+buf[ptr++];
		songinfo.ptr = ptr;
		smfinfo.isValid = true;
		//console.log("validSMF");
		//console.log("tracksize:"+smfinfo.tracksize);
		progressbar.max = smfinfo.tracksize;
		reset();
		//test();
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
	function getVLQ(){ // variable length quantity
		var value = 0;
		for (i=0;i<4;i++) {
			data = songinfo.buf[songinfo.ptr++];
			value += data&0x7f;
			if ((data&0x80)==0) {
				break;
			}
			value <<= 7;
		}
		return value;
	};
	function getMetaString() {
		var len = getVLQ();
		var str = "";
		for (i=0;i<len;i++) {
			str += songinfo.buf[songinfo.ptr++].toString();
		}
		return str;
	}
	function getMeta() {
		var ptr=songinfo.ptr;
		var metaType = songinfo.buf[songinfo.ptr++];
		var isEnd = false;
		var len=0;
		switch (metaType) {
		case 0x00:	// seqno
		type = "seqno";
		songinfo.buf[songinfo.ptr++];
		songinfo.seqno = songinfo.buf[songinfo.ptr++] << 8;
		songinfo.seqno += songinfo.buf[songinfo.ptr++];
		break;
		case 0x01:	// text
		type = "text";
		songinfo.metatext = getMetaString();
		break;
		case 0x02:	// copyright
		type = "copyright";
		songinfo.copyright = getMetaString();
		break;
		case 0x03:	// seq name
		type = "sequence name";
		songinfo.seqname = getMetaString();
		break;
		case 0x04:	// inst name
		type = "instrument name";
		songinfo.instname = getMetaString();
		break;
		case 0x05:	// lyric
		type = "lyric";
		songinfo.lyric = getMetaString();
		break;
		case 0x06:	// marker
		type = "marker";
		getMetaString();
		break;
		case 0x07:	// cue
		type = "cue point";
		getMetaString();
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
		getMetaString();
		break;
		case 0x20:	// channel prefix
		type = "channel prefix";
		len = songinfo.buf[songinfo.ptr++];
		songinfo.ptr += len;
		break;
		case 0x21:	// port
		type = "port";
		len = songinfo.buf[songinfo.ptr++];
		songinfo.ptr += len;
		break;
		case 0x2F:	// end of track
		type = "end of track";
		len = songinfo.buf[songinfo.ptr++];
		isEnd = true;
		break;
		case 0x51:	// tempo
		type = "tempo";
		len = songinfo.buf[songinfo.ptr++];
		playerinfo.nexttempo = songinfo.buf[songinfo.ptr++]<<16;
		playerinfo.nexttempo += songinfo.buf[songinfo.ptr++]<<8;
		playerinfo.nexttempo += songinfo.buf[songinfo.ptr++];
		break;
		case 0x54:	// smpte offset
		type = "SMPTE offset";
		len = songinfo.buf[songinfo.ptr++];
		songinfo.smpteoffset["hour"] = songinfo.buf[songinfo.ptr++];
		songinfo.smpteoffset["min"] = songinfo.buf[songinfo.ptr++];
		songinfo.smpteoffset["sec"] = songinfo.buf[songinfo.ptr++];
		songinfo.smpteoffset["frame"] = songinfo.buf[songinfo.ptr++];
		songinfo.smpteoffset["subframe"] = songinfo.buf[songinfo.ptr++];
		break;
		case 0x58:	// time signature
		type = "time signature";
		len = songinfo.buf[songinfo.ptr++];
		songinfo.timesig["numerator"] = songinfo.buf[songinfo.ptr++];
		songinfo.timesig["denominator"] = songinfo.buf[songinfo.ptr++];
		songinfo.timesig["interval"] = songinfo.buf[songinfo.ptr++];
		songinfo.timesig["sub"] = songinfo.buf[songinfo.ptr++];
		break;
		case 0x59:	// key signature
		type = "key signature";
		len = songinfo.buf[songinfo.ptr++];
		songinfo.timesig["signature"] = songinfo.buf[songinfo.ptr++];
		songinfo.timesig["key"] = songinfo.buf[songinfo.ptr++];
		break;
		case 0x7F:	// specific
		type = "specific";
		len = songinfo.buf[songinfo.ptr++];
		songinfo.ptr += len;
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
	while (ptr<songinfo.ptr) data[index++]=songinfo.buf[ptr++];
	return {isEnd:isEnd,type:type,data:data};
};
function getNext() {
	var result = true;
	var deltatime = getVLQ();
	var message = [];
	var data = songinfo.buf[songinfo.ptr];
	var index = 0;
	var statusbyte = 0;
		if (data < 0x80) { // running status
			statusbyte = songinfo.status&0xF0;
			message[index++] = songinfo.status;
		} else if (data == 0xF0) { // sysex
			statusbyte = data;
			songinfo.ptr++;
			message[index++] = data;
		} else if (data == 0xF7) { // sysex wo F0
			statusbyte = data;
			songinfo.ptr++;
		} else if (data == 0xFF) { // meta
			statusbyte = data;
			songinfo.ptr++;
			message[index++] = data;
		} else { // status
			songinfo.status = data;
			statusbyte = songinfo.status&0xF0;
			songinfo.ptr++;
			message[index++] = data;
		}
		var len = 0;
		var datatype = "";
		switch (statusbyte) {
			case 0x80:
			case 0x90:
			case 0xA0:
			case 0xB0:
			case 0xE0:
			datatype="data";
			len = 2;
			break;
			case 0xC0:
			case 0xD0:
			datatype="data";
			len = 1;
			break;
			case 0xF0:
			case 0xF7:
			datatype="data";
			len = getVLQ();
			break;
			case 0xFF:
			len = 0;
			datatype="meta";
			meta = getMeta();
			result = !meta.isEnd;
			message = meta.data.concat();
			datatype="meta:"+meta.type;
			break;
			default:
			datatype="error";
			alert("data read error!");
			result = false;
			break;
		}
		for (i=0;i<len;i++) message[index++]=songinfo.buf[songinfo.ptr++];
			return { result:result, deltatime:deltatime, message:message, type:datatype };
	}
	function showDetailData(message) {
		var str = songinfo.ptr+" deltatime:"+message.deltatime.toString(16)+" status:"+songinfo.status.toString(16)+" message:"
		for (i=0;i<message.message.length;i++) str += ("0"+message.message[i].toString(16)).slice(-2)+" ";
			console.log(str);		
	}
	function showData(timestamp,message) {
		//var str = timestamp+":"
		var str = "";
		for (i=0;i<message.message.length;i++) str += ("0"+message.message[i].toString(16)).slice(-2)+" ";
			console.log(str);
		//document.getElementById("disparea")disparea.innerHTML += str+"<br>";
	}
	function test() {
		reset();
		while (1) {
			var message = getNext();
			if (!message.result) break;
			showDetailData(message);
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
		songinfo.ptr = songinfo.offsetTop;
		playerinfo.init();
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
		allnoteoff();
	}
	function play() {
		if (!smfinfo.isValid) return;
		playerinfo.starttime = window.performance.now();
		playerinfo.playing = true;
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
		var targettime = currenttime+playerinfo.buffer*2;
		while (1) {
			if (!playerinfo.playing) return;
			if (songinfo.nexteventtime>=targettime) break;
			var message = getNext();
			progressbar.value = songinfo.ptr;
			if (!message.result) {
				playerinfo.playing = false;
				pause();
				break;
			};
			playerinfo.totaltick += message.deltatime;
			if (message.type=="meta:tempo") {
				setTempo(playerinfo.totaltick,playerinfo.nexttempo);
				playerinfo.nexttempo = -1;
			}
			var timestamp = gettime(playerinfo.totaltick)+playerinfo.starttime;
			//showData(timestamp,message);
			if (message.type=="data") {
				if (output) {
					output.send(message.message,timestamp);
				}
			}
			if (timestamp>targettime) {
				songinfo.nexteventtime = timestamp;
				break;
			}
		};
	}
