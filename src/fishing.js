// Electron/Node modules
import { getWindow as mainWindow } from './window';

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

// Length of pull and release packets
/** @type {number[]} */ const forcePacketLengths = [105, 133];

// Action type enums
const ACTION_TYPE = {
	PULL: "pull",
	RELEASE: "release",
};

export class Fishing {

	constructor() {
		// Fishing times
		/** @type {number} */ this.castHour = 0;
		/** @type {number} */ this.castMinute = 0;
		/** @type {number} */ this.catchHour = 0;
		/** @type {number} */ this.catchMinute = 0;
		/** @type {number} */ this.baitTime = 0;
		/** @type {number} */ this.reelTime = 0;

		/** @type {typeof setInterval} */ this.inGameMinuteInterval;
		/** @type {typeof setInterval} */ this.baitTimeInterval;
		/** @type {typeof setInterval} */ this.reelTimeInterval;

		// Fisherman states
		/** @type {string} */ this.hook = "";
		/** @type {string} */ this.bait = "";

		// Fishing environment states
		/** @type {number} */ this.waterDepth = 0;
		/** @type {string} */ this.currentWater = "";
		/** @type {string} */ this.uuid = "";
		/** @type {number} */ this.fishingDepth = 0;

		// Fishing activity states
		/** @type {number}  */ this.fishStrength = 0;
		/** @type {number}  */ this.lineHp = 70;
		/** @type {number}  */ this.fishHealth = 0;
		/** @type {number}  */ this.startingFishHealth = 0;
		/** @type {boolean} */ this.isFishHooked = false;
		/** @type {boolean} */ this.fishIsPulling = false;
		/** @type {boolean} */ this.holdingRightClick = false;
		/** @type {number} 	*/ this.damageCount = 0;
		/** @type {number} 	*/ this.pullCount = 0;
		/** @type {number} 	*/ this.consecutivePullCount = 0;
		/** @type {number} 	*/ this.maxConsecutivePullCount = 0;
	}

	reset() {
		this.fishStrength = 0;
		this.lineHp = 70;
		this.startingFishHealth = 0;
		this.fishHealth = 0;
		this.isFishHooked = false;
		this.fishIsPulling = false;
		this.damageCount = 0;
		this.pullCount = 0;
		this.consecutivePullCount = 0;
		this.maxConsecutivePullCount = 0;
		this.waterDepth = 0;
		this.fishingDepth = 0;
		this.currentWater = "";
		this.uuid = "";
		this.holdingRightClick = false;
		this.baitTime = 0;
		this.reelTime = 0;
		clearInterval(this.baitTimeInterval);
		clearInterval(this.reelTimeInterval);
	}
	
	async resetCast() {
		await keyboard.type(Key.Num1);
		await new Promise((res) => setTimeout(() => res(), 2000))
		await keyboard.type(Key.Num1);
		await new Promise((res) => setTimeout(() => res(), 500))
		await keyboard.type("x");
		await new Promise((res) => setTimeout(() => res(), 500))
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
			mainWindow().webContents.send("hp", this.fishHealth);
			return ACTION_TYPE.PULL;
		} else if (actionCharStart === "5b" || actionChar === "a") {
			console.log("release")
			mainWindow().webContents.send("hp", this.fishHealth);
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
				this.consecutivePullCount++;

				if (this.maxConsecutivePullCount < this.consecutivePullCount) {
					this.maxConsecutivePullCount = this.consecutivePullCount;
				}
	
				if (this.fishStrength * 2 > this.lineHp) {
					this.holdingRightClick = true;
					await mouse.pressButton(Button.RIGHT);
				} else {
					this.lineHp -= this.fishStrength;
					mainWindow().webContents.send("line-hp", this.lineHp);
				}

				this.pullCount++;
				this.fishIsPulling = true;
				break;

			case ACTION_TYPE.RELEASE:
				if (this.maxConsecutivePullCount < this.consecutivePullCount) {
					this.maxConsecutivePullCount = this.consecutivePullCount;
				}

				if (this.fishStrength * 2 > this.lineHp && this.holdingRightClick === true) {
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

	isCastPacket(bufferString) {
		const waterTypeMatches = bufferString.match(/(?<=Water\=).+?(?=\,)/g);
		let water = waterTypeMatches &&
			waterTypeMatches.length &&
			waterTypeMatches[0].split("_")[1];
		if (water) {
			this.reset();

			this.baitTimeInterval = setInterval(() => this.baitTime++, 1000);
			
			const waterDepthMatches = bufferString.match(/(?<=WaterDepth=).+?(?=\,)/g);
			const fishingDepthMatches = bufferString.match(/(?<=FishingDepth=).+?(?=\,)/g);
			const throwDistance = bufferString.match(/(?<=ThrowDistance=).+?(?=\,)/g)
			const uuid = bufferString.match(/(?<=K=).+?(?=\,)/g)
			const serverTime = bufferString.match(/(?<=Time=).+?(?=\.)/g)
			this.currentWater = water;
			this.waterDepth = +waterDepthMatches[0].match(/\d/g).join("");
			this.fishingDepth = +fishingDepthMatches[0].match(/\d/g).join("");
			this.throwDistance = +throwDistance[0].match(/\d/g).join("");
			this.uuid = uuid[0];

			// Time stuff
			this.serverTime = +serverTime[0].match(/\d/g).join("");
			let totalIngameMinutes = serverTime / 6.41025416666667 - 250;
			let minutesMod = totalIngameMinutes % 1440;
			this.castHour = Math.floor(minutesMod / 60);
			this.castMinute = Math.floor(minutesMod % 60);
			this.catchHour = this.castHour;
			this.catchMinute = this.castMinute;

			clearInterval(this.inGameMinuteInterval)
			this.inGameMinuteInterval = setInterval(function() {
				this.castMinute++;
				if (this.castMinute === 60) {
					this.castHour++;
					this.castMinute = 0;
				}
				if (this.castHour === 24) {
					this.castHour = 0;
				}
			}, 6410.254166666666667)

			mainWindow().webContents.send(
				"cast",
				this.currentWater,
				this.waterDepth,
				this.fishingDepth,
				this.castHour,
				this.castMinute,
				this.throwDistance,
				this.uuid,
			);
			mainWindow().webContents.send("line-hp", this.lineHp);
		}
	}

	async catch(fish) {
		clearInterval(this.inGameMinuteInterval);
		clearInterval(this.reelTimeInterval);
		mainWindow().webContents.send("catch", fish[0]);
		
		storeCatch()
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
				await this.catch(fish);
			}

			// Cast detection
			if (ipret.info.totallen === 645) {
				this.isCastPacket(bufferString, bufferHex);
			}

			if (
				forcePacketLengths.includes(ipret.info.totallen) && 
				(
					this.maxConsecutivePullCount >= 4 ||
					(
						(this.fishHealth > this.startingFishHealth / 2) &&
						this.fishStrength * 2 > this.lineHp
					)
				)
			) {
				await this.resetCast();
			}
			// Pull and release actions -B
			else if (forcePacketLengths.includes(ipret.info.totallen)) {
				await this.handleForce(bufferHex);
			}

			// Bites -B
			if (
				ipret.info.totallen === 77 &&
				this.isFishHooked === false &&
				bufferHex.slice(39, 40) === "7"
			) {
				clearInterval(this.baitTimeInterval)
				this.reelTimeInterval = setInterval(() => this.reelTime++, 1000);
				this.startingFishHealth = parseInt(bufferHex.slice(44, 46), 16);
				this.fishHealth = this.startingFishHealth;
				this.isFishHooked = true;
				await mouse.pressButton(Button.LEFT);
				mainWindow().webContents.send("bite", { startingFishHealth: this.startingFishHealth, fishHealth: this.fishHealth });	
			}

			if (
				ipret.info.totallen === 77 &&
				this.isFishHooked === true &&
				["7", "e"].includes(bufferHex.slice(39, 40))
			) {
				console.log("dmg")
				this.fishHealth = parseInt(bufferHex.slice(44, 46), 16)
				mainWindow().webContents.send("hp", this.fishHealth)	
				this.damageCount++
			}

			// Identify packet that has our fishes pulling strength
			if (
				ipret.info.totallen === 77 &&
				this.isFishHooked === true &&
				["8"].includes(bufferHex.slice(39, 40))
			) {
				this.fishStrength = parseInt(bufferHex.slice(44, 46), 16)
				mainWindow().webContents.send("fish-strength", this.fishStrength);
			}
		});
	}
}