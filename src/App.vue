<script setup>
import { ref } from "vue";

let timer = null;
const time = ref(0);

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

const waterType = ref("");
const waterDepth = ref("");
const fishingDepth = ref("");

const startingFishHp = ref(0);
const fishHp = ref(0);
const weight = ref(0);
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

window.ipcRenderer.on("cast", (
  ipcWaterType,
  ipcWaterDepth,
  ipcFishingDepth
) => {
  castHour.value = hour.value;
  castMinute.value = minute.value;

  waterType.value = ipcWaterType;
  waterDepth.value = ipcWaterDepth;
  fishingDepth.value = ipcFishingDepth;

  catchHour.value = 0;
  catchMinute.value = 0;
  fishCatch.value = "";

  clearInterval(timer)
  time.value = 0;
  timer = setInterval(function() {
    time.value++;
  }, 100)
})

window.ipcRenderer.on("bite", ({startingFishHealth, fishHealth}) => {
  clearInterval(timer)
  startingFishHp.value = startingFishHealth;
  fishHp.value = fishHealth;
})

window.ipcRenderer.on("hp", (health) => {
  fishHp.value = health;
})

window.ipcRenderer.on("weight", (_weight) => {
  weight.value = _weight
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

  time.value = 0;
})

window.ipcRenderer.on("line-hp", (_lineHp) => {
  lineHp.value = _lineHp
})

function onSetWindowClick() {
  alwaysOnTop.value = !alwaysOnTop.value;
  window.ipcRenderer.send("set-window", alwaysOnTop.value);
}

function onRecordCatchesClick() {
  recordCatches.value = !recordCatches.value;
  window.ipcRenderer.send("set-record", recordCatches.value);
}

function debugCatch() {
  window.ipcRenderer.send(
    "debug-catch",
    {
      hook: hook.value,
      bait: bait.value,
      waterDepth: waterDepth.value,
      fishingDepth: fishingDepth.value,
      waterType: waterType.value,
      catch: fishCatch.value,

    }
  )
}

function onHookChange() {
  window.ipcRenderer.send("set-hook", hook.value);
}

function onBaitChange() {
  window.ipcRenderer.send("set-bait", bait.value);
}

</script>

<template>
  <div class="grid gap-4">
    <div class="text-2xl">In game time: {{ hour }}:{{ minute }}</div>

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
      </div>
      <div class="grid grid-cols-2 pt-2">
        <div>Caught at: [ {{ catchHour }} : {{ catchMinute }} ]</div>
        <div>Catch: {{ fishCatch }}</div>
      </div>
      <div>{{ (time / 10).toFixed(1) }}</div>
      <div>
        <div>FISH HP: {{ fishHp }} / {{ startingFishHp }}</div>
        <div>FISH STRENGTH: {{ weight }}</div>
        <div>LINE HP: {{ lineHp }}</div>
      </div>
    </div>
  </div>
</template>
