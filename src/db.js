const path = require("path");
const fs = require("fs");
const { app } = require("electron");
// TODO: Maybe get data.string from something constant?
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
	uuid												VARCHAR(32),
	hook												INT(1),
	bait												VARCHAR(25),
	water_depth									INT(2),
	fishing_depth								INT(2),
	water_type									VARCHAR(25),
	cast_time										TIME,
	bait_time										INT(2),
	starting_fish_health				INT(1),
	fish_strength 							INT(1),
	damage_count								INT(1),
	max_consecutive_damage_count INT(1),
	pull_count									INT(1),
	max_consecutive_pull_count	INT(1),
	break_time									INT(2),
	consecutive_reset_cast_count INT(1),
	reel_time										INT(2),
	catch_time									TIME,
	server_catch_time									INT(4),
	fish 												VARCHAR(25),
	chance		INT(1),
	created_at 									DATETIME DEFAULT CURRENT_TIMESTAMP
)
`)

export function storeCatch(data) {
	db.run(
		`
			INSERT INTO catch (
				uuid,
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
				consecutive_reset_cast_count,
				reel_time,
				catch_time,
				server_catch_time,
				fish,
				chance,
				break_time
			)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);
		`,
		[
			data.uuid,
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
			data.consecutiveResetCastCount,
			data.reelTime,
			data.catchTime,
			data.serverTime,
			data.fish,
			data.chance,
			data.breakTime
		]
	);
};