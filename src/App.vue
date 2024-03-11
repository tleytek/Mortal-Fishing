<script setup>
import { ref } from "vue";

let baitTimer = null;
const baitTime = ref(0);

let reelTimer = null;
const reelTime = ref(0);

const alwaysOnTop = ref(false);
const recordCatches = ref(false);

const hour = ref(23);
const minute = ref(59);
const castHour = ref(0);
const castMinute = ref(0);
const catchHour = ref(0);
const catchMinute = ref(0);

const hook = ref("");
const bait = ref("");
const throwForce = ref(50);

const fishingState = ref(false);
const waterType = ref("");
const waterDepth = ref("");
const fishingDepth = ref("");
const throwingDistance = ref("");
const uuid = ref("");
const chance = ref(0);
const pullCount = ref(0);

const startingFishHp = ref(0);
const fishHp = ref(0);
const fishStrength = ref(0);
const lineHp = ref(0);

const fishCatch = ref("");

setInterval(function() {
	minute.value++;
	if (minute.value === 60) {
		hour.value++;
		minute.value = 0;
	}
	if (hour.value == 24) {
		hour.value = 0;
	}
}, 6410.2541666667);

window.ipcRenderer.on("chance", (ipcChance) => {
  chance.value = ipcChance;
})

window.ipcRenderer.on("cast", (
  ipcWaterType,
  ipcWaterDepth,
  ipcFishingDepth,
  ipcCastHour,
  ipcCastMinute,
  ipcThrowingDistance,
  ipcUUID,
) => {
  hour.value = ipcCastHour;
  minute.value = ipcCastMinute;
  castHour.value = hour.value;
  castMinute.value = minute.value;

  waterType.value = ipcWaterType;
  waterDepth.value = ipcWaterDepth;
  fishingDepth.value = ipcFishingDepth;
  throwingDistance.value = ipcThrowingDistance;
  uuid.value = ipcUUID;

  clearInterval(baitTimer)
  clearInterval(reelTimer)
  baitTime.value = 0;
  baitTimer = setInterval(function() {
    baitTime.value++;
  }, 100)
})

window.ipcRenderer.on("bite", ({startingFishHealth, fishHealth}) => {
  clearInterval(baitTimer)
  startingFishHp.value = startingFishHealth;
  fishHp.value = fishHealth;
  reelTime.value = 0;
  reelTimer = setInterval(function() {
    reelTime.value++;
  }, 100)
})

window.ipcRenderer.on("hp", (health, ipcPullCount) => {
  fishHp.value = health;
  pullCount.value = ipcPullCount;
})

window.ipcRenderer.on("fish-strength", (ipcFishStrength) => {
  fishStrength.value = ipcFishStrength
})

window.ipcRenderer.on("catch", (ipcCatch) => {
  fishCatch.value = ipcCatch;
  catchHour.value = hour.value;
  catchMinute.value = minute.value;
  // Because the FE is holding the time values
  window.ipcRenderer.send("catch-time", {
    castHour: castHour.value,
    castMinute: castMinute.value,
    catchHour: catchHour.value,
    catchMinute: catchMinute.value
  })
  clearInterval(reelTimer)
})

window.ipcRenderer.on("line-hp", (_lineHp) => {
  lineHp.value = _lineHp
})

window.ipcRenderer.on("fishing-state", (ipcFishingState) => {
  fishingState.value = ipcFishingState;
})

function onSetWindowClick() {
  alwaysOnTop.value = !alwaysOnTop.value;
  window.ipcRenderer.send("set-window", alwaysOnTop.value);
}

function onRecordCatchesClick() {
  recordCatches.value = !recordCatches.value;
  window.ipcRenderer.send("set-record", recordCatches.value);
}

function onHookChange() {
  window.ipcRenderer.send("set-hook", hook.value);
}

function onBaitChange() {
  window.ipcRenderer.send("set-bait", bait.value);
}

function onThrowChange() {
  window.ipcRenderer.send("set-throw", throwForce.value);
}

</script>

<template>
  <div class="grid gap-4">
    <div class="text-2xl">Fishing state: {{ fishingState }}</div>

    <div class="grid divide-y gap-y-2">
      <div>
        <input type="checkbox" id="always-on-top" name="always-on-top" :checked="alwaysOnTop" @input="onSetWindowClick">
        <label for="always-on-top"> Window always on top</label>
      </div>
      <div class="grid gap-y-2 pt-2">
        <div>
          <label for="hook">Hook: </label>
          <input name="hook" v-model="hook" @input="onHookChange">
        </div>
        <div>
          <label for="bait">Bait: </label>
          <input name="bait" v-model="bait" @input="onBaitChange">
        </div>
        <div>
          <label for="throw">Throw: </label>
          <input type="number" name="throw" v-model="throwForce" @input="onThrowChange">
        </div>
        <!-- TODO: Disable or change the "record" checkbox to off if hook or bait is empty -->
        <div>
          <input type="checkbox" id="record-catches" name="record-catches" :checked="recordCatches" @input="onRecordCatchesClick">
          <label for="record-catches"> Recording catches</label>
        </div>
      </div>
      <div class="grid grid-cols-2 pt-2">
          <div>Cast at: [ {{ castHour }} : {{ castMinute }} ]</div>
          <div>Water: {{ waterType }}</div>
          <div>Water depth: {{ waterDepth }}</div>
          <div>Fishing depth: {{ fishingDepth }}</div>
          <div>Throwing distance: {{ throwingDistance }}</div>
          <div class="col-span-2">UUID: {{ uuid }}</div>
      </div>
      <div class="grid grid-cols-2 pt-2">
        <div>Caught at: [ {{ catchHour }} : {{ catchMinute }} ]</div>
        <div>Catch: {{ fishCatch }}</div>
      </div>
      <div>
        <div>bait time: {{ (baitTime / 10).toFixed(1) }}</div>
        <div>reel time: {{ (reelTime / 10).toFixed(1) }}</div>
      </div>
      <div>
        <div>FISH HP: {{ fishHp }} / {{ startingFishHp }}</div>
        <div>FISH STRENGTH: {{ fishStrength }}</div>
        <div>LINE HP: {{ lineHp }}</div>
        <div>CHANCE: {{ chance }}</div>
        <div>PULL COUNT: {{ pullCount }}</div>
      </div>
    </div>
  </div>
</template>
