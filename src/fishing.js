// Electron/Node modules
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain } = require('electron');

// Packet modules
const ip = require("ip");
const Cap = require('cap').Cap;
const decoders = require('cap').decoders;

const c = new Cap();
const device = Cap.findDevice(ip.address());
const bufSize = 10 * 1024 * 1024;
const buffer = Buffer.alloc(65535);
c.open(
	device,
	"ip and tcp and (dst net 198.244.200.228 or src net 198.244.200.228)",
	bufSize,
	buffer
);
c.setMinBytes && c.setMinBytes(0);

// TODO: Maybe get this string from something constant?
const appName = 'Mortal Online 2 Fishing';

if (!fs.existsSync(path.join(app.getPath('appData'), appName))) {
	fs.mkdirSync(path.join(app.getPath('appData'), appName))
}


// DB init
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(app.getPath('appData'), appName, 'fishing.db');
const db = new sqlite3.Database(dbPath);

db.run(`
CREATE TABLE IF NOT EXISTS catch (
	hook 					INT(4),
	bait 					VARCHAR(25),
	water_depth		VARCHAR(25),
	fishing_depth	VARCHAR(25),
	water_type		VARCHAR(25),
	fish 					VARCHAR(25),
	cast_hour			INT(2),
	cast_minute		INT(2),
	catch_hour 		INT(2),
	catch_minute 	INT(2),
	created_at 		DATETIME DEFAULT CURRENT_TIMESTAMP
)
`)

ipcMain.on("debug-catch", (_event, data) => {
	db.run(`
		INSERT INTO catch (hook, bait, water_depth, fishing_depth, water_type, fish, cast_hour, cast_minute, catch_hour, catch_minute)
		VALUES (?,?,?,?,?,?,?,?,?,?);
	`,
	[
		data.hook,
		data.bait,
		data.waterDepth,
		data.fishingDepth,
		data.waterType,
		data.fishCatch,
		data.castHour,
		data.castMinute,
		data.catchHour,
		data.catchMinute
	]);
})

// Length of pull and release packets
/** @type {number[]} */ const forcePacketLengths = [105, 133];

// Action type enums
const ACTION_TYPE = {
	PULL: "pull",
	RELEASE: "release",
};

export class Fishing {

	/** @param {BrowserWindow} mainWindow */
	constructor(mainWindow) {

		/** @type {BrowserWindow} */ this.mainWindow = mainWindow;

		/** @type {number} */ this.pullIntervalId;
		/** @type {number} */ this.biteIntervalId;

		// Fishing times
		/** @type {number} */ this.castHour = 0;
		/** @type {number} */ this.castMinute = 0;
		/** @type {number} */ this.catchHour = 0;
		/** @type {number} */ this.catchMinute = 0;

		// Fisherman states
		/** @type {string} */ this.hook = "";
		/** @type {string} */ this.bait = "";

		// Fishing environment states
		/** @type {string} */ this.waterDepth 	= "";
		/** @type {string} */ this.currentWater = "";
		/** @type {string} */ this.fishingDepth = "";
		
		// Fishing activity states
		/** @type {boolean} */ this.isFishHooked	= false;
		/** @type {boolean} */ this.fishIsPulling = false;
		/** @type {number} 	*/ this.biteInterval 	= 0;
		/** @type {number} 	*/ this.pullInterval 	= 0;
		/** @type {number} 	*/ this.nibbleCount 	= 0;
		/** @type {number} 	*/ this.pullCount 		= 0;
		/** @type {number} 	*/ this.releaseCount 	= 0;
		/** @type {number} 	*/ this.reelCount 		= 0;

		// -1 Because the first tick after a catch tug
		/** @type {number} 	*/ this.damageCount = -1;
	}

	reset() {
		this.isFishHooked 	= false;
		this.fishIsPulling 	= false;
		this.biteInterval 	= 0;
		this.pullInterval 	= 0;
		this.nibbleCount 		= 0;
		this.pullCount 			= 0;
		this.releaseCount 	= 0;
		this.reelCount 			= 0;
		this.waterDepth 		= "";
		this.fishingDepth 	= "";
		this.currentWater 	= "";
		this.damageCount 		= -1;
	}

	/**
	 * @param {string} bufferString 
	 * @returns {ACTION_TYPE}
	 */
	fishActionType(bufferString) {
		let newlines = bufferString.match(/(\n)/gm) || [];
		let bracketExists = bufferString.slice(0, 1) === "[";

		if (!this.fishIsPulling && newlines.length % 2 === 0) {
			return ACTION_TYPE.PULL;
		} else if (this.fishIsPulling && (newlines.length % 2 === 1) || bracketExists) {
			return ACTION_TYPE.RELEASE;
		}
	}

	/**
	 * @param {string} bufferString 
	 * @returns {void}
	 */
	handleForce(bufferString) {
		switch (this.fishActionType(bufferString)) {
			case ACTION_TYPE.PULL:
				this.isFishHooked = true;
				this.fishIsPulling = true;
				break;
			case ACTION_TYPE.RELEASE:
				this.fishIsPulling = false;
				break;
		}
	}

	/** @returns @type {number} */
	setPullInterval() {
		this.pullIntervalId = setInterval(() => {
			this.pullInterval++;
			this.mainWindow.webContents.send("pull-interval", this.pullInterval);
		}, 1);
	}

	/** @returns @type {number} */
	setBiteInterval() {
		this.biteIntervalId = setInterval(() => {
			this.biteInterval++;
		}, 1);
	}

	isCastPacket(bufferString) {
		const waterTypeMatches = bufferString.match(/(?<=Water\=).+?(?=\,)/g);
		let water = waterTypeMatches &&
								waterTypeMatches.length &&
								waterTypeMatches[0].split("_")[1];
		if (water) {
			console.log(bufferString);
			let newlines = bufferString.match(/(\n)/gm) || [];
			console.log(newlines);
			this.reset();
			const waterDepthMatches = bufferString.match(/(?<=WaterDepth=).+?(?=\,)/g);
			const fishingDepthMatches = bufferString.match(/(?<=FishingDepth=).+?(?=\,)/g);
			this.currentWater = water;
			this.waterDepth = waterDepthMatches &&
												waterDepthMatches.length &&
												waterDepthMatches[0].match(/\d/g).join("");
			this.fishingDepth = fishingDepthMatches &&
													fishingDepthMatches.length &&
													fishingDepthMatches[0].match(/\d/g).join("");
			this.mainWindow.webContents.send(
				"cast",
				this.currentWater,
				this.waterDepth,
				this.fishingDepth
			);
		}
	}
	
	storeCatch() {
		db.run(
			`
				INSERT INTO catch (hook, bait, water_depth, fishing_depth, water_type, fish, cast_hour, cast_minute, catch_hour, catch_minute)
				VALUES (?,?,?,?,?,?,?,?,?,?);
			`,
			[
				this.hook,
				this.bait,
				this.waterDepth,
				this.fishingDepth,
				this.waterType,
				this.fishCatch,
				this.castHour,
				this.castMinute,
				this.catchHour,
				this.catchMinute
			]
		);
	}

	start() {
		this.setBiteInterval();
		this.setPullInterval();

		c.on('packet', async (_nbytes, _trunc) => {
			const ethret = decoders.Ethernet(buffer);

			const ipret = decoders.IPV4(buffer, ethret.offset);

			// Clean up the packet
			let datalen = ipret.info.totallen - ipret.hdrlen;
			const tcpret = decoders.TCP(buffer, ipret.offset);
			datalen -= tcpret.hdrlen;
		
			// String up that packet
			const bufferString = buffer.toString('binary', tcpret.offset, tcpret.offset + datalen);
		
			// Match and organize our possible catches (TODO: fish and catchMatches the same??)
			const fish = JSON.stringify(bufferString).match(/(?<=fish\.).+?(?=\\)/g);
			const catchMatches = bufferString.match(/Resources[a-zA-Z]*\b/g);
			const amuletMatches = bufferString.match(/Misc.Trinkets.Amulet[a-zA-Z]*\b/g);
			const ringMatches = bufferString.match(/Misc.Trinkets.Ring[a-zA-Z]*\b/g);
			
			// Catch detection
			if ((catchMatches && fish) || amuletMatches || ringMatches) {
				this.mainWindow.webContents.send("catch", fish[0]);
			}

			// Cast detection
			if (ipret.info.totallen === 645) {
				this.isCastPacket(bufferString);
			}
		
			// Pull and release actions -B
			if (forcePacketLengths.includes(ipret.info.totallen)) {
				this.handleForce(bufferString);
			}
		
			// Bites -B
			if (
				ipret.info.totallen === 77 &&
				this.isFishHooked === false &&
				this.biteInterval > 0 && 
				this.biteInterval < 180
			) {
				this.isFishHooked = true;
				this.biteInterval = 0;
			}
		
			// Nibbles -B
			if (ipret.info.totallen === 77 && this.isFishHooked === false) {
				this.nibbleCount++;
				this.biteInterval = 0;
			}

			if (ipret.info.totallen === 77 && this.isFishHooked === true) {
				this.damageCount++;
				console.log("test", bufferString)
				console.log("new count", this.damageCount);
			}

			if (ipret.info.totallen === 77 && this.isFishHooked === false && this.currentWater  !== "") {
				console.log(bufferString);
			}
		});
	}
}






