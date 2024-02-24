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
	hook												INT(1),
	bait												VARCHAR(25),
	water_depth									INT(2),
	fishing_depth								INT(2),
	water_type									VARCHAR(25),
	fish 												VARCHAR(25),
	cast_hour										INT(1),
	cast_minute									INT(1),
	catch_hour 									INT(1),
	catch_minute 								INT(1),
	fish_strength 							INT(1),
	uuid												VARCHAR(32),
	damage_count								INT(1),
	pull_count									INT(1),
	max_consecutive_pull_count	INT(1),
	starting_fish_health				INT(1),
	created_at 									DATETIME DEFAULT CURRENT_TIMESTAMP
)
`)

export function storeCatch(data) {
	db.run(
		`
			INSERT INTO catch (
				hook,
				bait,
				water_depth,
				fishing_depth,
				water_type,
				fish,
				cast_hour,
				cast_minute,
				catch_hour,
				catch_minute,
				fish_strength,
				uuid,
				damage_count,
				pull_count,
				max_consecutive_pull_count,
				starting_fish_health
			)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);
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
			data.catchMinute,
			data.fishPullStrength,
			data.uuid,
			data.damageCount,
			data.pullCount,
			data.maxConsecutivePullCount,
			data.startingFishHealth
		]
	);
};