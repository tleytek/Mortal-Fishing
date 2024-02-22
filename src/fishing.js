// Electron/Node modules
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain } = require('electron');

// Nut
const { mouse, Button, keyboard, Key } = require('@nut-tree/nut-js');

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

		// Fishing times
		/** @type {number} */ this.castHour = 0;
		/** @type {number} */ this.castMinute = 0;
		/** @type {number} */ this.catchHour = 0;
		/** @type {number} */ this.catchMinute = 0;

		// Fisherman states
		/** @type {string} */ this.hook = "";
		/** @type {string} */ this.bait = "";

		// Fishing environment states
		/** @type {string} */ this.waterDepth = "";
		/** @type {string} */ this.currentWater = "";
		/** @type {string} */ this.fishingDepth = "";

		// Fishing activity states
		/** @type {number}  */ this.weight = 0;
		/** @type {number}  */ this.lineHp = 70;
		/** @type {number}  */ this.fishHealth = 0;
		/** @type {number}  */ this.startingFishHealth = 0;
		/** @type {boolean} */ this.isFishHooked = false;
		/** @type {boolean} */ this.fishIsPulling = false;
		/** @type {boolean} */ this.holdingRightClick = false;
		/** @type {number} 	*/ this.pullCount = 0;
		/** @type {number} 	*/ this.consecutivePullCount = 0;
		/** @type {number} 	*/ this.maxConsecutivePullCount = 0;
	}

	reset() {
		this.weight = 0;
		this.lineHp = 70;
		this.startingFishHealth = 0;
		this.fishHealth = 0;
		this.isFishHooked = false;
		this.fishIsPulling = false;
		this.pullCount = 0;
		this.consecutivePullCount = 0;
		this.maxConsecutivePullCount = 0;
		this.waterDepth = "";
		this.fishingDepth = "";
		this.currentWater = "";
		this.damageCount = -1;
		this.holdingRightClick = false;
	}
	
	async resetCast() {
		keyboard.config.autoDelayMs = 1000;
		await keyboard.type("1");
		await keyboard.type("1");

		keyboard.config.autoDelayMs = 4000;
		await keyboard.type("x");

		keyboard.config.autoDelayMs = 200;
		await keyboard.type("z");
		await keyboard.type("2");
		await keyboard.type("3");
		await keyboard.type("4");

		this.reset();

		mouse.config.autoDelayMs = 30;
		await mouse.pressButton(Button.LEFT);
		await mouse.releaseButton(Button.LEFT);
	}

	/**
	 * @param {string} bufferHex 
	 * @returns {ACTION_TYPE}
	 */
	fishActionType(bufferHex) {
		const actionCharStart = bufferHex.slice(0, 2);
		const actionChar = bufferHex.slice(95, 96);
		this.fishHealth = parseInt(bufferHex.slice(44, 46), 16);

		if (actionCharStart === "3f" && (actionChar === "9" || actionChar === "b")) {
			console.log("pull");
			this.mainWindow.webContents.send("hp", this.fishHealth);
			return ACTION_TYPE.PULL;
		} else if (actionCharStart === "5b" || actionChar === "a") {
			console.log("release")
			this.mainWindow.webContents.send("hp", this.fishHealth);
			return ACTION_TYPE.RELEASE;
		}
	}

	/**
	 * @param {string} bufferHex 
	 * @returns {void}
	 */
	async handleForce(bufferHex) {
		switch (this.fishActionType(bufferHex)) {
			case ACTION_TYPE.PULL:
				this.pullCount++;
				this.consecutivePullCount++;
				// if ((this.pullCount + 1) * this.weight >= 70) {
				if (this.weight * 2 > this.lineHp) {
					this.holdingRightClick = true;
					await mouse.pressButton(Button.RIGHT);
				} else {
					this.lineHp -= this.weight;
					this.mainWindow.webContents.send("line-hp", this.lineHp);
				}

				this.pullCount++;
				this.fishIsPulling = true;
				break;

			case ACTION_TYPE.RELEASE:
				if (this.maxConsecutivePullCount < this.consecutivePullCount) {
					this.maxConsecutivePullCount = this.consecutivePullCount;
				}

				// if ((this.pullCount + 1) * this.weight >= 70 && this.holdingRightClick === true) {
				if (this.weight * 2 > this.lineHp && this.holdingRightClick === true) {
					this.holdingRightClick = false
					await mouse.releaseButton(Button.RIGHT);
				}

				this.consecutivePullCount = 0;
				this.fishIsPulling = false;
				break;
			
			case ACTION_TYPE.FISH_RELEASE:
				this.fishIsPulling = false;
		}
	}

	isBitePacket(bufferHex) {
		if (bufferHex.slice(39, 40) === "7") {
			return true;
		} else {
			return false;
		}
	}

	isCastPacket(bufferString) {
		const waterTypeMatches = bufferString.match(/(?<=Water\=).+?(?=\,)/g);
		let water = waterTypeMatches &&
			waterTypeMatches.length &&
			waterTypeMatches[0].split("_")[1];
		if (water) {
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
			this.mainWindow.webContents.send("line-hp", this.lineHp);
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
		c.on('packet', async (_nbytes, _trunc) => {
			const ethret = decoders.Ethernet(buffer);
			const ipret = decoders.IPV4(buffer, ethret.offset);

			// Clean up the packet
			let datalen = ipret.info.totallen - ipret.hdrlen;
			const tcpret = decoders.TCP(buffer, ipret.offset);
			datalen -= tcpret.hdrlen;

			// String up that packet
			const bufferString = buffer.toString('binary', tcpret.offset, tcpret.offset + datalen);
			const bufferHex = buffer.toString('hex', tcpret.offset, tcpret.offset + datalen)

			// Match and organize our possible catches (TODO: fish and catchMatches the same??)
			const fish = JSON.stringify(bufferString).match(/(?<=fish\.).+?(?=\\)/g);
			const catchMatches = bufferString.match(/Resources[a-zA-Z]*\b/g);
			const amuletMatches = bufferString.match(/Misc.Trinkets.Amulet[a-zA-Z]*\b/g);
			const ringMatches = bufferString.match(/Misc.Trinkets.Ring[a-zA-Z]*\b/g);

			// Catch detection
			if ((catchMatches && fish) || amuletMatches || ringMatches) {
				this.mainWindow.webContents.send("catch", fish[0]);
				await mouse.releaseButton(Button.LEFT);
				await new Promise(function (res) {
					setTimeout(function () {
						res();
					}, 100);
				})
				mouse.config.autoDelayMs = 30;
				await mouse.pressButton(Button.LEFT);
				await mouse.releaseButton(Button.LEFT);
				console.log("\n")
			}

			// Cast detection
			if (ipret.info.totallen === 645) {
				this.isCastPacket(bufferString, bufferHex);
			}

			if (
				forcePacketLengths.includes(ipret.info.totallen) && 
				(this.fishHealth > this.startingFishHealth / 2) &&
				this.weight * 2 > this.lineHp	
			) {
				console.log("should reset");
				await this.resetCast();
			}
			// Pull and release actions -B
			if (forcePacketLengths.includes(ipret.info.totallen)) {
				await this.handleForce(bufferHex);
			}

			// Bites -B
			if (
				ipret.info.totallen === 77 &&
				this.isFishHooked === false &&
				this.isBitePacket(bufferHex)
			) {
				this.startingFishHealth = parseInt(bufferHex.slice(44, 46), 16);
				this.fishHealth = this.startingFishHealth;
				this.isFishHooked = true;
				await mouse.pressButton(Button.LEFT);
				this.mainWindow.webContents.send("bite", { startingFishHealth: this.startingFishHealth, fishHealth: this.fishHealth });	
			}

			if (ipret.info.totallen === 77 && this.isFishHooked === true && ["7", "e"].includes(bufferHex.slice(39, 40))) {
				console.log("dmg")
				this.fishHealth = parseInt(bufferHex.slice(44, 46), 16)
				this.mainWindow.webContents.send("hp", this.fishHealth)	
			}

			if (ipret.info.totallen === 77 && this.isFishHooked === true && ["8"].includes(bufferHex.slice(39, 40))) {
				this.weight = parseInt(bufferHex.slice(44, 46), 16)
				this.mainWindow.webContents.send("weight", this.weight);
			}
		});
	}
}