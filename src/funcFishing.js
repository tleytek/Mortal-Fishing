// const mortalOnlineMapUrl = /** @type {string} */ "https://www.mortalonlinemap.info";

// Length of "reel in" packets
const forcePacketLengths = /** @type {number[]} */ [105, 133];

// Action type enums
const ACTION_TYPE = {
	PULL: "pull",
	RELEASE: "release",
};

// Bot stuff
// safe = /** @type {boolean} */ true;
// castLength = /** @type {number} */ 50;

let minute = /** @type {number} */ 0;
let hour = /** @type {number} */ 0;

// Fisher state
let hook = /** @type {string} */ "";
let line = /** @type {string} */ "";
let bait = /** @type {string} */ "";

// Fishing environment states
let waterDepth    = /** @type {string} */ "";
let currentWater  = /** @type {string} */ "";
let fishingDepth  = /** @type {string} */ "";

// Fishing activity states
let isFishHooked	= /** @type {boolean} */ false;
let fishIsPulling = /** @type {boolean} */ false;
let biteInterval 	= /** @type {number} */ 0;
let pullInterval 	= /** @type {number} */ 0;
let nibbleCount 	= /** @type {number} */ 0;
let pullCount 		= /** @type {number} */ 0;
let releaseCount 	= /** @type {number} */ 0;
let reelCount 		= /** @type {number} */ 0;


function reset() {
  let isFishHooked  = false;
  let fishIsPulling = false;
  let biteInterval 	= 0;
  let pullInterval 	= 0;
  let nibbleCount 	= 0;
  let pullCount 		= 0;
  let releaseCount 	= 0;
  let reelCount 		= 0;
  let waterDepth 		= "";
  let fishingDepth 	= "";
  let currentWater 	= "";
}

// Scraping pockets for initial time
function setTime() {
	({ hour, minute } = fetch("https://www.mortalonlinemap.info/location/-82,996658/116,053900/2,5")
		.then(function (response) {
			return response.text();
		})
		.then(function(html) {
			let hourIndex = html.indexOf("global_ingametime_hours")
			let hour = html.substring(hourIndex + 26, hourIndex + 28)
			let minuteIndex = html.indexOf("global_ingametime_minutes")
			let minute = html.substring(minuteIndex + 28, minuteIndex + 30)
			return { minute, hour };
		}));
}

setInterval(function() {
	biteInterval++
}, 1);

setInterval(function() {
	pullInterval++
}, 1);

// MO2 time
setInterval(function() {
	minute++;
	minute = minute.toLocaleString("en-US", {
		minimumIntegerDigits: 2,
		useGrouping: false,
	});
	if (minute == 60) {
		hour++;
		hour = hour.toLocaleString("en-US", {
			minimumIntegerDigits: 2,
			useGrouping: false,
		});
		minute = 0;
	}
	if (hour == 24) {
		hour = 0;
	}
}, 6410.2541666667);

/**
 * @param {string} bufferString 
 * @returns {ACTION_TYPE}
 */
function fishActionType(bufferString) {
	let newlines = bufferString.match(/(\n)/gm) || [];
	let bracketExists = bufferString.slice(0, 1) === "[";

	if (!fishIsPulling && newlines.length % 2 === 0) {
		return ACTION_TYPE.PULL;
	} else if (fishIsPulling && (newlines.length % 2 === 1) || bracketExists) {
		return ACTION_TYPE.RELEASE;
	}
}

/**
 * If the fish is on the line, determine if the fish is pulling or releasing the line.
 * @param {string} bufferString 
 * @returns {void}
 */
function handleForce(bufferString) {
	switch (fishActionType(bufferString)) {
		case ACTION_TYPE.PULL:
			isFishHooked = true;
			fishIsPulling = true;
			break;
		case ACTION_TYPE.RELEASE:
			fishIsPulling = false;
			break;
	}
}

const ip = require("ip");
const robot = require("robotjs");
robot.setMouseDelay(100);
const Cap = require('cap').Cap;
const decoders = require('cap').decoders;
const PROTOCOL = decoders.PROTOCOL;

let c = new Cap();
let device = Cap.findDevice(ip.address());
let bufSize = 10 * 1024 * 1024;
let buffer = Buffer.alloc(65535);
let linkType = c.open(device, "", bufSize, buffer);

c.setMinBytes && c.setMinBytes(0);

export const fishing = (mainWindow) => {
	c.on('packet', async function(_nbytes, _trunc) {
		console.log("shit");
		if (linkType !== 'ETHERNET') return;
		let ethret = decoders.Ethernet(buffer);

		if (ethret.info.type !== PROTOCOL.ETHERNET.IPV4) return;
		let ipret = decoders.IPV4(buffer, ethret.offset);

		if (
			!(
				ipret.info.protocol === PROTOCOL.IP.TCP && 
				(
					ipret.info.srcaddr === "198.244.200.228" ||
					ipret.info.dstaddr === "198.244.200.228"
				)
			)
		) return;

		// Clean up the packet
		let datalen = ipret.info.totallen - ipret.hdrlen;
		let tcpret = decoders.TCP(buffer, ipret.offset);
		datalen -= tcpret.hdrlen;

		// String up that packet
		const bufferString = buffer.toString('binary', tcpret.offset, tcpret.offset + datalen);

		// Match and organize our possible catches (TODO: fish and catchMatches the same??)
		const fish = JSON.stringify(bufferString).match(/(?<=fish\.).+?(?=\\)/g);
		const catchMatches = bufferString.match(/Resources[a-zA-Z]*\b/g);
		const amuletMatches = bufferString.match(/Misc.Trinkets.Amulet[a-zA-Z]*\b/g);
		const ringMatches = bufferString.match(/Misc.Trinkets.Ring[a-zA-Z]*\b/g);
		
		// Catches
		if ((catchMatches && fish) || amuletMatches || ringMatches) {
			// ipcMain.send("catch");
			reset();
		}

		// Initial cast detection
		if (ipret.info.totallen === 645) {
			const waterTypeMatches = bufferString.match(/(?<=Water\=).+?(?=\,)/g);
			let water = waterTypeMatches && waterTypeMatches.length && waterTypeMatches[0].split("_")[1];
			if (water) {
				reset();
				const waterDepthMatches = bufferString.match(/(?<=WaterDepth=).+?(?=\,)/g);
				const fishingDepthMatches = bufferString.match(/(?<=FishingDepth=).+?(?=\,)/g);
				waterDepth = waterDepthMatches && waterDepthMatches.length && waterDepthMatches[0].match(/\d/g).join("");
				fishingDepth = fishingDepthMatches && fishingDepthMatches.length && fishingDepthMatches[0].match(/\d/g).join("");
				ipcMain.send("cast", {})
			}
		}

		// Pull and release actions -B
		if (forcePacketLengths.includes(ipret.info.totallen)) {
			handleForce(bufferString);
		}

		// Bites -B
		if (ipret.info.totallen === 77 && isFishHooked === false && biteInterval > 0 && biteInterval < 300) {
			isFishHooked = true;
			biteInterval = 0;
		}

		// Nibbles -B
		if (ipret.info.totallen === 77 && isFishHooked === false) {
			nibbleCount++;
			biteInterval = 0;
		}
	});
}
