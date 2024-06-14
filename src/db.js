require('dotenv').config()
/**
const path = require("path");
const fs = require("fs");
const { app } = require("electron");
// TODO: Maybe get data.string from something constant?
const appName = 'Mortal Online 2 Fishing';
if (!fs.existsSync(path.join(app.getPath('appData'), appName))) {
	fs.mkdirSync(path.join(app.getPath('appData'), appName))
}
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.join(app.getPath('appData'), appName, 'fishing.db');
const db = new sqlite3.Database(dbPath);
db.run(`
CREATE TABLE IF NOT EXISTS catch (
	hook													INT(1),
	bait													VARCHAR(25),
	water_depth										INT(2),
	fishing_depth									INT(2),
	water_type										VARCHAR(25),
	cast_time											TIME,
	bait_time											INT(2),
	starting_fish_health					INT(1),
	fish_strength 								INT(1),
	damage_count									INT(1),
	max_consecutive_damage_count 	INT(1),
	pull_count										INT(1),
	max_consecutive_pull_count		INT(1),
	reel_time											INT(2),
	catch_time										TIME,
	fish 													VARCHAR(25),
	created_at 										DATETIME DEFAULT CURRENT_TIMESTAMP
)
`)
*/

import { createClient } from "@libsql/client";
// import { createClient } from "@libsql/client/web";

export const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function storeCatch(data) {
	try {
	await turso.execute({
		sql: `
			INSERT INTO catch (
				hook,
				bait,
				water_depth,
				fishing_depth,
				water_type,
				cast_time,
				bait_time,
				starting_fish_health,
				fish_strength,
				damage_count,
				max_consecutive_damage_count,
				pull_count,
				max_consecutive_pull_count,
				reel_time,
				catch_time,
				fish
			)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);
		`,
		args: [
			data.hook,
			data.bait,
			data.waterDepth,
			data.fishingDepth,
			data.waterType,
			data.castTime,
			data.baitTime,
			data.startingFishHealth,
			data.fishStrength,
			data.damageCount,
			data.maxConsecutiveDamageCount,
			data.pullCount,
			data.maxConsecutivePullCount,
			data.reelTime,
			data.catchTime,
			data.fish,
		]
	});
} catch(e) {
	console.log(e);
}
};