// Electron/Node modules
import { getWindow as mainWindow } from './window';

import * as db from "./db.js";

// Nut

const { mouse, Button, keyboard, Key } = require('@nut-tree/nut-js');
mouse.config.autoDelayMs = 1;
/** @type {number[]} */ const forcePacketLengths = [105, 133];

// Action type enums
const ACTION_TYPE = {
	PULL: "pull",
	RELEASE: "release",
};

function convert(str) {
	const newStr = [];

	for (let i = str.length - 2; i >= 0; i -= 2) {
		newStr.push(str.slice(i, i + 2))
	}

	return newStr.join("");
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
		clearInterval(this.baitTimeInterval);
		clearInterval(this.reelTimeInterval);
		clearInterval(this.inGameMinuteInterval)
	}
	
	async resetCast(interrupt) {
		if (interrupt) {
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
		}

		await mouse.releaseButton(Button.RIGHT);
		await mouse.releaseButton(Button.LEFT);
		// await notepad.mouse.click("left", 1000, 3000)
		await new Promise((res) => setTimeout(() => res(), 100))
		await mouse.pressButton(Button.LEFT);
		// await new Promise((res) => setTimeout(() => res(), Math.floor(Math.random() * 100)))
		await new Promise((res) => setTimeout(() => res(), this.throwForce))
		await mouse.releaseButton(Button.LEFT);
		console.log("\n")
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
			// console.log("pull");
			mainWindow().webContents.send("hp", this.fishHealth, this.pullCount);
			return ACTION_TYPE.PULL;
		} else if (this.fishIsPulling === true && (actionCharStart === "5b" || actionChar === "a")) {
			// console.log("release")
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
					if (this.breakTime === 0) console.log(this.reelTime); this.breakTime = this.reelTime;
					// if (this.breakTime > 0 && this.breakTime < 12) {
					// 	await this.resetCast(true);
					// 	return;
					// }
					this.holdingRightClick = true;
					await mouse.pressButton(Button.RIGHT);
				}
				this.pullCount++;
				this.consecutiveDamageCount = 0;
				this.fishIsPulling = true;
				break;
			case ACTION_TYPE.RELEASE:
				if (this.holdingRightClick === true) {
					this.holdingRightClick = false
					await mouse.releaseButton(Button.RIGHT);
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
			this.isFishing = true;
			mainWindow().webContents.send("fishing-state", this.isFishing);
			this.reset();
			const num1 = bufferHex.slice(402, 412)
			const num2 = bufferHex.slice(562, 572)
			const num3 = bufferHex.slice(594, 604)
			const num4 = bufferHex.slice(658, 668)
			// console.log(num1, num2, num3, num4)
			const num1a = convert(num1);
			const num2a = convert(num2);
			const num3a = convert(num3);
			const num4a = convert(num4);
			
			const num1i = parseInt(num1a, 16);
			const num2i = parseInt(num2a, 16);
			const num3i = parseInt(num3a, 16);
			const num4i = parseInt(num4a, 16);
			// console.log(bufferHex, "\n");
			// console.log(num1i);
			// console.log(num2i);
			// console.log(num3i);
			// console.log(num4i);
			// console.log(Math.abs((num1i - num2i) + (num2i - num3i) + (num3i - num4i)));
			// this.chance = parseInt(bufferHex.slice(530, 532), 16);
			this.chance = Math.abs((num1i - num2i) + (num2i - num3i) + (num3i - num4i))
			// console.log(bufferHex);
			console.log("huh", bufferHex.slice(1146, 1210));

			// console.log(bufferString);
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
			const totalIngameMinutes = this.serverTime / 6.41025416666667;
			const minutesMod = totalIngameMinutes % 1440;
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
			}, 6410.254166666666667);

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

		// if (isWater && this.fishingDepth >= this.waterDepth) {
		// 	this.resetCast(true);
		// }
	}

	async catch(fish) {
		console.log(this.fishStrength, fish)
		this.isFishing = false;
		mainWindow().webContents.send("fishing-state", this.isFishing);
		clearInterval(this.inGameMinuteInterval);
		clearInterval(this.reelTimeInterval);
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

	async handlePacket(bufferString, bufferHex, packetLength, dataLen) {
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
			await mouse.pressButton(Button.LEFT);
			mainWindow().webContents.send("bite", { startingFishHealth: this.startingFishHealth, fishHealth: this.fishHealth });	
			return;
		}
		// The good damage packet when the fish is on the hook
		if (
			packetLength === 77 &&
			this.isFishHooked === true &&
			bufferHex.slice(39, 40) === "e"
		) {
			// console.log("dmg")
			this.fishHealth = parseInt(bufferHex.slice(44, 46), 16)
			mainWindow().webContents.send("hp", this.fishHealth, this.pullCount)	
			this.damageCount++;
			this.consecutiveDamageCount++;
			if (this.maxConsecutiveDamageCount < this.consecutiveDamageCount) {
				this.maxConsecutiveDamageCount = this.consecutiveDamageCount;
			}
			return;
		}
		// Identify packet that has our fishes pulling strength
		if (
			packetLength === 77 &&
			this.isFishHooked === true &&
			["8"].includes(bufferHex.slice(39, 40))
		) {
			console.log(bufferHex)
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
			console.log(this.nibbleCount)
			this.prevBiteInter = this.baitTime;
			this.fishStrength = parseInt(bufferHex.slice(44, 46), 16)
			mainWindow().webContents.send("hp", this.fishStrength, this.nibbleCount);
			return;
		}

		//packet length 134/datalen 94 is a fishing rod equip
		if (dataLen === 94 && bufferHex.slice(52, 59) !== "fffffff") {
			this.isFishing = false;
			mainWindow().webContents.send("fishing-state", this.isFishing);
			return;
		}

		// Match and organize our possible catches (TODO: fish and catchMatches the same??)
		const fish = JSON.stringify(bufferString).match(/(?<=fish\.).+?(?=\\)/g);
		const catchMatches = bufferString.match(/Resources[a-zA-Z]*\b/g);
		const amuletMatches = bufferString.match(/Misc.Trinkets.Amulet[a-zA-Z]*\b/g);
		const ringMatches = bufferString.match(/Misc.Trinkets.Ring[a-zA-Z]*\b/g);

		if (this.isFishing === true && ringMatches) {
			const t1 = bufferString.match(/Tier 1[a-zA-Z]*\b/g);
			const t2 = bufferString.match(/Tier 2[a-zA-Z]*\b/g);
			const tier = t1 ?? t2;
			const ring = "Ring"+tier;
			db.storeCatch(ring);
			this.resetCast(false);
			return;
		}
		if (this.isFishing === true && amuletMatches) {
			const t1 = bufferString.match(/Tier 1[a-zA-Z]*\b/g);
			const t2 = bufferString.match(/Tier 2[a-zA-Z]*\b/g);
			const tier = t1 ?? t2;
			const amulet = "Amulet"+tier;
			db.storeCatch(amulet);
			this.resetCast(false);
			return;
		}
		// Catch detection
		if (this.isFishing === true && catchMatches && fish) {
			await this.catch(fish[0]);
			return;
		}
		// if (packetLength === 645 && bufferHex.slice(38, 40) === "34") {
		// 	console.log(bufferHex);
		// }
	}
}