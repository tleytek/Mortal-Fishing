// Electron/Node modules
import { getWindow as mainWindow } from './window';

import * as db from "./db.js";

// Nut
const { mouse, Button, keyboard, Key } = require('@nut-tree/nut-js');

/** @type {number[]} */ const forcePacketLengths = [105, 133];

// Action type enums
const ACTION_TYPE = {
	PULL: "pull",
	RELEASE: "release",
};

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
		/** @type {number} */ this.serverTime = 0;

		/** @type {typeof setInterval} */ this.inGameMinuteInterval;
		/** @type {typeof setInterval} */ this.baitTimeInterval;
		/** @type {typeof setInterval} */ this.reelTimeInterval;

		// Fisherman states
		/** @type {string} */ this.hook = "";
		/** @type {string} */ this.bait = "";

		// Fishing environment states
		/** @type {number} */ this.waterDepth = 0;
		/** @type {string} */ this.water = "";
		/** @type {string} */ this.uuid = "";
		/** @type {number} */ this.fishingDepth = 0;
		/** @type {number} */ this.chance = 0;

		// Fishing activity states
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
		this.waterDepth = 0;
		this.fishingDepth = 0;
		this.currentWater = "";
		this.uuid = "";
		this.holdingRightClick = false;
		this.baitTime = 0;
		this.reelTime = 0;
		this.chance = 0;
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
		await new Promise((res) => setTimeout(() => res(), 100))
		await mouse.pressButton(Button.LEFT);
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
			mainWindow().webContents.send("hp", this.fishHealth);
			return ACTION_TYPE.PULL;
		} else if (this.fishIsPulling === true && (actionCharStart === "5b" || actionChar === "a")) {
			// console.log("release")
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

				// if (this.maxConsecutiveDamageCount < this.consecutiveDamageCount) {
				// 	this.maxConsecutiveDamageCount = this.consecutiveDamageCount;
				// }
	
				if (this.fishStrength * 2 > this.lineHp) {
					this.holdingRightClick = true;
					await mouse.pressButton(Button.RIGHT);
				} else {
					this.lineHp -= this.fishStrength;
					mainWindow().webContents.send("line-hp", this.lineHp);
				}

				this.pullCount++;
				this.consecutiveDamageCount = 0;
				this.fishIsPulling = true;
				break;

			case ACTION_TYPE.RELEASE:
				// if (this.maxConsecutivePullCount < this.consecutivePullCount) {
				// 	this.maxConsecutivePullCount = this.consecutivePullCount;
				// }
				// if (this.maxConsecutiveDamageCount < this.consecutiveDamageCount) {
				// 	this.maxConsecutiveDamageCount = this.consecutiveDamageCount;
				// }

				if (this.fishStrength * 2 > this.lineHp && this.holdingRightClick === true) {
					this.holdingRightClick = false
					await mouse.releaseButton(Button.RIGHT);
				}

				this.releaseCount++;
				this.consecutivePullCount = 0;
				this.consecutiveDamageCount = 0;
				this.fishIsPulling = false;
				break;
			
			case ACTION_TYPE.FISH_RELEASE:
				this.fishIsPulling = false;
		}
	}

	async resetCastTest() {
		await new Promise((res) => setTimeout(() => res(), 1000));
		await mouse.pressButton(Button.LEFT);
		await new Promise((res) => setTimeout(() => res(), 2500));
		await mouse.releaseButton(Button.LEFT);
		await this.resetCast(false)

	}
	async isCastPacket(bufferString, bufferHex) {
		const isWater = new RegExp("(?<=Water\=).+?(?=\,)", "g").test(bufferString);
		
		if (isWater) {
			this.reset();
			this.chance = parseInt(bufferHex.slice(530, 532), 16);
			mainWindow().webContents.send("chance", this.chance)
			console.log(this.chance);

			// Lots of data from the cast packet
			this.baitTimeInterval = setInterval(() => this.baitTime++, 1000);
			this.water = bufferString.match(/(?<=Water\=).+?(?=\,)/g)[0].split("_")[1];
			this.waterDepth = +bufferString.match(/(?<=WaterDepth=).+?(?=\,)/g)[0];
			this.fishingDepth = +bufferString.match(/(?<=FishingDepth=).+?(?=\,)/g)[0];
			this.throwDistance = +bufferString.match(/(?<=ThrowDistance=).+?(?=\,)/g)[0];
			this.uuid = bufferString.match(/(?<=K=).+?(?=\,)/g)[0];
			this.serverTime = +bufferString.match(/(?<=Time=).+?(?=\.)/g)[0];

			// Time stuff
			const totalIngameMinutes = this.serverTime / 6.41025416666667 - 250;
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

			// if (this.chance < 200) {
			// 	await this.resetCastTest();
			// 	return;
			// }
		}

		if (isWater && this.fishingDepth > this.waterDepth) {
			this.resetCast(true);
		}
	}

	async catch(fish) {
		console.log(fish[0])
		clearInterval(this.inGameMinuteInterval);
		clearInterval(this.reelTimeInterval);
		if (this.record) {
			db.storeCatch({
				hook: this.hook,
				bait: this.bait,
				waterDepth: this.waterDepth,
				fishingDepth: this.fishingDepth,
				waterType: this.water,
				fish: fish[0],
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
				consecutiveResetCastCount: this.consecutiveResetCastCount,
				chance: this.chance,
			});
		}
		mainWindow().webContents.send("catch", fish[0]);
		this.resetCast(false);
		this.consecutiveResetCastCount = 0;
	}

	async handlePacket(bufferString, bufferHex, packetLength, dataLen) {
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
		if (packetLength === 645) {
			await this.isCastPacket(bufferString, bufferHex);
		}

		// Handle the pulls when the fish is on the hook
		if (forcePacketLengths.includes(packetLength) && (
			// (
			// 	(this.damageCount + this.pullCount > 5 && this.damageCount + this.pullCount < 10) &&
			// 	this.pullCount > this.damageCount
			// ) ||
			this.fishHealth > (this.startingFishHealth / 2) && (this.fishStrength * 2) > this.lineHp
		)) {
			this.consecutiveResetCastCount++;
			await this.resetCast(true);
		} 
		else if (forcePacketLengths.includes(packetLength)) {
			await this.handleForce(bufferHex);
		}

		// The hook
		if (
			packetLength === 77 &&
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

		// Avoid twigs
		if (
			packetLength === 77 &&
			this.isFishHooked === true &&
			this.fishHealth > 3 && this.fishHealth < 8 && this.damageCount === this.maxConsecutiveDamageCount
		) {
			this.consecutiveResetCastCount++;
			await this.resetCast(true);
		}
		
		// The good damage packet when the fish is on the hook
		else if (
			packetLength === 77 &&
			this.isFishHooked === true &&
			["7", "e"].includes(bufferHex.slice(39, 40))
		) {
			// console.log("dmg")
			this.fishHealth = parseInt(bufferHex.slice(44, 46), 16)
			mainWindow().webContents.send("hp", this.fishHealth)	
			this.damageCount++;
			this.consecutiveDamageCount++;
			if (this.maxConsecutiveDamageCount < this.consecutiveDamageCount) {
				this.maxConsecutiveDamageCount = this.consecutiveDamageCount;
			}
		}

		// Identify packet that has our fishes pulling strength
		if (
			packetLength === 77 &&
			this.isFishHooked === true &&
			["8"].includes(bufferHex.slice(39, 40))
		) {
			this.fishStrength = parseInt(bufferHex.slice(44, 46), 16)
			mainWindow().webContents.send("fish-strength", this.fishStrength);
		}
		if (
			packetLength === 77 &&
			["6"].includes(bufferHex.slice(39, 40))
		) {
			this.fishStrength = parseInt(bufferHex.slice(44, 46), 16)
			mainWindow().webContents.send("fish-strength", this.fishStrength);
		}
		//packet length 134/datalen 94 is a fishing rod equip
		// if (packetLength === 134) {
		// 	console.log(bufferHex)
		// }
		// if (dataLen === 605) {
		// 	console.log(bufferHex, "\n")
		// }
	}
}