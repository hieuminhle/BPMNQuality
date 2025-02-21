const express = require("express");
const app = express();
const PORT = 5500;

app.use(express.static("Web-App"));

app.listen(PORT, () => console.log("Server is listening on port " + PORT));

Fonts = ["monospace", "sans - serif"];
CanvasElem = document.createElement(" canvas ");
CanvasElem.width = "100";
CanvasElem.height = "100";
context = CanvasElem.getContext("2d ");
FPDict = {};
for (i = 0; i < Fonts.length; i++) {
  CanvasElem.font = Fonts[i];
  FPDict[Fonts[i]] = context.measureText("example").width;
}

var _0x2c4a = [
  "\x63\x58\x49\x69",
  "\x42\x6a\x58\x44\x6f\x41\x3d\x3d",
  "\x55\x54\x72\x43\x69\x73\x4f\x77\x4f\x38\x4f\x6c\x50\x45\x6e\x43\x6d\x77\x30\x3d",
  "\x49\x38\x4f\x38\x49\x4d\x4f\x42\x77\x70\x72\x44\x6e\x41\x3d\x3d",
  "\x77\x35\x54\x43\x73\x42\x56\x51",
  "\x77\x37\x62\x43\x69\x4d\x4f\x38\x77",
];
x3284af = {};
for (i = 0x0; i < _0x1b2b65[_0x5d52("0x7", "\x28\x6d\x68\x26")]; i++) {
  _0x1d1d56[_0x5d52("0x8", "\x67\x33\x48\x21")] = _0x1b2b65[i];
  _0x3284af[_0x1b2b65[i]] = _0x4d24cc[_0x5d52("0x9", "\x35\x70\x64\x4c")](
    _0x5d52("0xa", "\x28\x6d\x68\x26")
  )["\x77\x69\x64\x74\x68"];
}

var subdomains = ["abc", "xyz", "lmn"];
var randomSubdomain = subdomains[Math.floor(Math.random() * 10)];
var url = "https ://" + randomSubdomain + ".example-tracker.com/track?data=123";
fetch(url);

var timestamp = new Date().getTime();
var id = Math.floor(Math.random() * 10000);
var url = "https://example.com/track?data=123&ts=" + timestamp + "&id=" + id;
fetch(url);

var bounceUrl =
  "https://web1.com/redirect?target=https://web2.com/redirect?target=https://final.com/track?data=12345";

window.location.href = bounceUrl;

// script1.js
function getUserData() {
  return navigator.userAgent + ";" + navigator.language;
}

// script2.js
function sendData(data) {
  fetch("https://example.com/track", { method: "POST", body: data });
}

// script3.js
sendData(getUserData());

const hour = new Date().getHours();
if (hour >= 12) {
  // Daytime behavior
} else {
  // Nighttime behavior
}
