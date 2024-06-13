// Electron/Node modules
import { getWindow as mainWindow } from './window';

import * as db from "./db.js";

// Nut
import { Virtual } from "keysender";

const mo2 = new Virtual(null, "UnrealWindow"); // find Notepad handle by className and set it as workwindow
// const pid = +process.argv[2];
// const mo2 = new Virtual(pid);

/** @type {number[]} */ const forcePacketLengths = [105, 133];

// Action type enums
const ACTION_TYPE = {
	PULL: "pull",
	RELEASE: "release",
};

function hex2a(hexx) {
    var hex = hexx.toString();//force conversion
    var str = '';
    for (var i = 0; i < hex.length; i += 2) {
			if (hex.substr(i, 2) === "00") {
				return str;
			}
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
		}
    return str;
}

export class Fishing {

	constructor() {

		/** @type {boolean} */ this.record = false;

		// Fishing times
		/** @type {number} */ this.castHour = 0;
		/** @type {number} */ this.castMinute = 0;
		/** @type {number} */ this.catchHour = 0;
		/** @type {number} */ this.catchMinute = 0;
		/** @type {number} */ this.baitTime = 0;
		/** @type {number} */ this.reelTime = 0;
		/** @type {number} */ this.breakTime = 0;
		/** @type {number} */ this.serverTime = 0;

		/** @type {typeof setInterval} */ this.inGameMinuteInterval;
		/** @type {typeof setInterval} */ this.baitTimeInterval;
		/** @type {typeof setInterval} */ this.reelTimeInterval;

		// Fisherman states
		/** @type {string} */ this.hook = "";
		/** @type {string} */ this.bait = "";
		/** @type {boolean} */ this.throwForce = 50;

		// Fishing environment states
		/** @type {number} */ this.waterDepth = 0;
		/** @type {string} */ this.water = "";
		/** @type {string} */ this.uuid = "";
		/** @type {number} */ this.fishingDepth = 0;
		/** @type {number} */ this.chance = 0;

		// Fishing activity states
		/** @type {boolean} */ this.isFishing = false;
		/** @type {number}  */ this.fishStrength = 0;
		/** @type {number}  */ this.lineHp = 70;
		/** @type {number}  */ this.fishHealth = 0;
		/** @type {number}  */ this.startingFishHealth = 0;
		/** @type {boolean} */ this.isFishHooked = false;
		/** @type {boolean} */ this.fishIsPulling = false;
		/** @type {boolean} */ this.holdingRightClick = false;
		/** @type {number} 	*/ this.damageCount = 0;
		/** @type {number} 	*/ this.consecutiveDamageCount = 0;
		/** @type {number} 	*/ this.maxConsecutiveDamageCount = 0;
		/** @type {number} 	*/ this.pullCount = 0;
		/** @type {number} 	*/ this.consecutivePullCount = 0;
		/** @type {number} 	*/ this.maxConsecutivePullCount = 0;
		/** @type {number} 	*/ this.releaseCount = 0;
		/** @type {number} 	*/ this.consecutiveResetCastCount = 0;

		this.waitBite = 0;
		this.prevBiteInter = 0;
		this.nibbleCount = 0;
		this.test = false;
	}

	reset() {
		this.fishStrength = 0;
		this.lineHp = 70;
		this.startingFishHealth = 0;
		this.fishHealth = 0;
		this.isFishHooked = false;
		this.fishIsPulling = false;
		this.damageCount = 0;
		this.consecutiveDamageCount = 0;
		this.maxConsecutiveDamageCount = 0;
		this.pullCount = 0;
		this.consecutivePullCount = 0;
		this.maxConsecutivePullCount = 0;
		this.releaseCount = 0;
		this.nibbleCount = 0;
		this.waterDepth = 0;
		this.fishingDepth = 0;
		this.currentWater = "";
		this.uuid = "";
		this.holdingRightClick = false;
		this.baitTime = 0;
		this.reelTime = 0;
		this.breakTime = 0;
		this.chance = 0;
		this.waitBite = 0;
		this.prevBiteInter = 0;
		this.test = false;
		clearInterval(this.baitTimeInterval);
		clearInterval(this.reelTimeInterval);
		clearInterval(this.inGameMinuteInterval)
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
			mainWindow().webContents.send("hp", this.fishHealth, this.pullCount);
			return ACTION_TYPE.PULL;
		} else if (this.fishIsPulling === true && (actionCharStart === "5b" || actionChar === "a")) {
			mainWindow().webContents.send("hp", this.fishHealth, this.pullCount);
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
				if (this.maxConsecutiveDamageCount < this.consecutiveDamageCount) {
					this.maxConsecutiveDamageCount = this.consecutiveDamageCount;
				}
				if ((this.fishStrength * 2 + 5) < this.lineHp) {
					this.lineHp -= this.fishStrength;
					mainWindow().webContents.send("line-hp", this.lineHp);
				} else if ((this.fishStrength * 2 + 5) >= this.lineHp) {
					this.holdingRightClick = true;
					await mo2.keyboard.toggleKey("y", true);
				}
				this.pullCount++;
				this.consecutiveDamageCount = 0;
				this.fishIsPulling = true;
				break;
			case ACTION_TYPE.RELEASE:
				if (this.holdingRightClick === true) {
					this.holdingRightClick = false
					await mo2.keyboard.toggleKey("y", false);
				}
				mainWindow().webContents.send("line-hp", this.lineHp);
				this.releaseCount++;
				this.consecutivePullCount = 0;
				this.consecutiveDamageCount = 0;
				this.fishIsPulling = false;
				break;
		}
	}

	async cast(bufferString, bufferHex) {
		const isWater = new RegExp("(?<=Water\=).+?(?=\,)", "g").test(bufferString);
		if (isWater) {
			mo2.keyboard.sendKey("t", 1, 1);
			this.isFishing = true;
			mainWindow().webContents.send("fishing-state", this.isFishing);
			this.reset();
			mainWindow().webContents.send("chance", this.chance)
			// Lots of data from the cast packet
			this.baitTimeInterval = setInterval(() => {
				this.baitTime++
			}, 1000);
			this.water = bufferString.match(/(?<=Water\=).+?(?=\,)/g)[0].split("_")[1];
			this.waterDepth = +bufferString.match(/(?<=WaterDepth=).+?(?=\,)/g)[0];
			this.fishingDepth = +bufferString.match(/(?<=FishingDepth=).+?(?=\,)/g)[0];
			this.throwDistance = +bufferString.match(/(?<=ThrowDistance=).+?(?=\,)/g)[0];
			this.uuid = bufferString.match(/(?<=K=).+?(?=\,)/g)[0];
			this.serverTime = +bufferString.match(/(?<=Time=).+?(?=\.)/g)[0];

			// Time stuff
			const epochSeconds = Math.floor(Date.now() / 1000)
			// Every real word second is 9.36 Mortal seconds
			// Epoch seconds is how many seconds has passed since jan 1 1970
			// To find how many Mortal seconds that is, we multiply our value of 9.36 by the current epoch seconds (not milliseconds)
			// Then divide our total mortal seconds in epoch by 60 to get to total MORTAL minutes that has passed since jan 1 1970
			
			const totalIngameMinutes= Math.floor(((epochSeconds - 600) * 9.3600032760011) / 60);
			const minutesMod = (totalIngameMinutes) % 1440;
			this.castHour = Math.floor(minutesMod / 60);
			this.castMinute = Math.floor(minutesMod % 60);
			this.catchHour = this.castHour;
			this.catchMinute = this.castMinute;

			this.inGameMinuteInterval = setInterval(() => {
				this.catchMinute++;
				if (this.catchMinute === 60) {
					this.catchHour++;
					this.catchMinute = 0;
				}
				if (this.catchHour === 24) {
					this.catchHour = 0;
				}
			}, 6410.2541666666985812299267652052);

			mainWindow().webContents.send(
				"cast",
				this.water,
				this.waterDepth,
				this.fishingDepth,
				this.castHour,
				this.castMinute,
				this.throwDistance,
				this.uuid,
				this.chance,
			);
			mainWindow().webContents.send("line-hp", this.lineHp);
		}

		if (isWater && this.fishingDepth >= this.waterDepth) {
			await new Promise((res) => setTimeout(() => res(), 900))
			await this.resetCast(true);
		}
	}

	async catch(fish) {
		this.isFishing = false;
		mainWindow().webContents.send("fishing-state", this.isFishing);
		clearInterval(this.inGameMinuteInterval);
		if (this.record) {
			db.storeCatch({
				hook: this.hook,
				bait: this.bait,
				waterDepth: this.waterDepth,
				fishingDepth: this.fishingDepth,
				waterType: this.water,
				fish: fish,
				castTime: `${this.castHour}:${this.castMinute}:00`,
				catchTime: `${this.catchHour}:${this.catchMinute}:00`,
				fishStrength: this.fishStrength,
				uuid: this.uuid,
				damageCount: this.damageCount,
				maxConsecutiveDamageCount: this.maxConsecutiveDamageCount,
				pullCount: this.pullCount,
				maxConsecutivePullCount: this.maxConsecutivePullCount,
				consecutiveResetCastCount: this.consecutiveResetCastCount,
				startingFishHealth: this.startingFishHealth,
				serverTime: this.serverTime,
				baitTime: this.baitTime,
				reelTime: this.reelTime,
				breakTime: this.breakTime,
				consecutiveResetCastCount: this.consecutiveResetCastCount,
				chance: this.chance,
			});
		}
		mainWindow().webContents.send("catch", fish);
		this.resetCast(false);
		this.consecutiveResetCastCount = 0;
	}

	async resetCast(interrupt) {
		if (interrupt) {
			await new Promise((res) => setTimeout(() => res(), 750))
			await mo2.keyboard.toggleKey("t", true, 3000);
			await mo2.keyboard.toggleKey("t", false);
		}
		await mo2.keyboard.toggleKey("t", false, 100);
		await mo2.keyboard.toggleKey("t", true, this.throwForce);
		await mo2.keyboard.toggleKey("t", false);
	}

	async handlePacket(bufferString, bufferHex, packetLength, dataLen) {
		// Match and organize our possible catches (TODO: fish and catchMatches the same??)
		const fish = JSON.stringify(bufferString).match(/(?<=fish\.).+?(?=\\)/g);
		const catchMatches = bufferString.match(/Resources[a-zA-Z]*\b/g);
		const amuletMatches = bufferString.match(/Misc.Trinkets.Amulet[a-zA-Z]*\b/g);
		const ringMatches = bufferString.match(/Misc.Trinkets.Ring[a-zA-Z]*\b/g);

		if (ringMatches) {
			const t1 = bufferString.match(/Tier 1[a-zA-Z]*\b/g);
			const t2 = bufferString.match(/Tier 2[a-zA-Z]*\b/g);
			const tier = t1 ?? t2;
			const ring = "Ring"+tier;
			await this.catch(ring);
			return;
		}

		if (amuletMatches) {
			const t1 = bufferString.match(/Tier 1[a-zA-Z]*\b/g);
			const t2 = bufferString.match(/Tier 2[a-zA-Z]*\b/g);
			const tier = t1 ?? t2;
			const amulet = "Amulet"+tier;
			await this.catch(amulet)
			return;
		}

		// Catch detection
		if (catchMatches && fish) {
			await this.catch(fish[0]);
			return;
		}

		// The hook
		if (
			packetLength === 77 &&
			this.isFishHooked === false &&
			bufferHex.slice(39, 40) === "7" 
		) {
			clearInterval(this.baitTimeInterval)
			this.reelTimeInterval = setInterval(() => {
				this.reelTime++
			}, 1000);
			this.startingFishHealth = parseInt(bufferHex.slice(44, 46), 16);
			this.fishHealth = this.startingFishHealth;
			this.isFishHooked = true;
			await mo2.keyboard.toggleKey("t", true, 1)
			mainWindow().webContents.send("bite", { startingFishHealth: this.startingFishHealth, fishHealth: this.fishHealth });	
			return;
		}
		// The good damage packet when the fish is on the hook
		if (
			packetLength === 77 &&
			this.isFishHooked === true &&
			bufferHex.slice(39, 40) === "e"
		) {
			this.fishHealth = parseInt(bufferHex.slice(44, 46), 16)
			mainWindow().webContents.send("hp", this.fishHealth, this.pullCount)	
			this.damageCount++;
			this.consecutiveDamageCount++;
			if (this.maxConsecutiveDamageCount < this.consecutiveDamageCount) {
				this.maxConsecutiveDamageCount = this.consecutiveDamageCount;
			}
			return;
		}

		if (
			packetLength === 77 &&
			this.isFishHooked === true &&
			["8"].includes(bufferHex.slice(39, 40))
		) {
			this.fishStrength = parseInt(bufferHex.slice(44, 46), 16)
			mainWindow().webContents.send("fish-strength", this.fishStrength);
			return;
		}

		// Cast detection
		if (packetLength === 645 && bufferHex.slice(38, 40) === "2f") {
			await this.cast(bufferString, bufferHex);
			return;
		}

		if (packetLength === 645 && bufferHex.slice(38, 40) === "2c") {
			this.isFishing = false;
			mainWindow().webContents.send("fishing-state", this.isFishing);
			return;
		}
		if (packetLength === 645 && bufferHex.slice(38, 40) === "2d") {
			this.isFishing = false;
			mainWindow().webContents.send("fishing-state", this.isFishing);
			return;
		}
	
		if (packetLength === 645 && bufferHex.slice(38, 40) === "33") {
			this.isFishing = false;
			mainWindow().webContents.send("fishing-state", this.isFishing);
			return;
		}

		if (packetLength === 645 && bufferHex.slice(38, 40) === "34") {
			this.isFishing = false;
			mainWindow().webContents.send("fishing-state", this.isFishing);
			return;
		}

		if (packetLength === 645 && bufferHex.slice(38, 40) === "2e") {
			this.isFishing = false;
			mainWindow().webContents.send("fishing-state", this.isFishing);
			return;
		}

		if (packetLength === 645 && bufferHex.slice(38, 40) === "29") {
			const cut = bufferHex.slice(210);
			this.bait = hex2a(cut);
			mainWindow().webContents.send("bait", this.bait);
			return;
		}

		// Handle the pulls when the fish is on the hook
		if (forcePacketLengths.includes(packetLength)) {
			await this.handleForce(bufferHex);
			return;
		}

		// nibbles
		if (
			packetLength === 77 &&
			["6"].includes(bufferHex.slice(39, 40))
		) {
			this.nibbleCount++;
			this.prevBiteInter = this.baitTime;
			this.fishStrength = parseInt(bufferHex.slice(44, 46), 16)
			return;
		}

		//packet length 134/datalen 94 is a fishing rod equip
		if (dataLen === 94 && bufferHex.slice(52, 59) !== "fffffff") {
			this.isFishing = false;
			mainWindow().webContents.send("fishing-state", this.isFishing);
			return;
		}
	}
}