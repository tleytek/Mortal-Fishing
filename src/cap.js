// Starts packet capture
const { ipcMain } = require('electron');
import { Fishing } from "./fishing";

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

const fishing = new Fishing();

ipcMain.on("set-hook", (_event, hook) => {
  fishing.hook = hook;
});

ipcMain.on("set-bait", (_event, bait) => {
  fishing.bait = bait;
});

ipcMain.on("set-record", (_event, record) => {
  fishing.record = record;
});

export function start() {
  c.on("packet", async (_nbytes, _trunc) => {
		const ethret = decoders.Ethernet(buffer);
		const ipret = decoders.IPV4(buffer, ethret.offset);
		
		// Clean up the packet
		let datalen = ipret.info.totallen - ipret.hdrlen;
		const tcpret = decoders.TCP(buffer, ipret.offset);
		datalen -= tcpret.hdrlen;
		
		// String up that packet
		const bufferString = buffer.toString('binary', tcpret.offset, tcpret.offset + datalen);
		const bufferHex = buffer.toString('hex', tcpret.offset, tcpret.offset + datalen)
		// console.log(buffer.toString('hex', 0, 1));

    await fishing.handlePacket(bufferString, bufferHex, ipret.info.totallen, datalen)
  })
}