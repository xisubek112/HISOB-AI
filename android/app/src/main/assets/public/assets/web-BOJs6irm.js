import { r as WebPlugin } from "./index-B3UarFnd.js";
// node_modules/capacitor-native-settings/dist/esm/web.js
/**
* Web implementation of the NativeSettings plugin.
*
* @remarks
* This plugin is not supported on the web platform.
*/
var NativeSettingsWeb = class extends WebPlugin {
	async open() {
		return new Promise((_resolve, reject) => {
			reject(/* @__PURE__ */ new Error("Not implemented for web."));
		});
	}
	async openAndroid() {
		return new Promise((_resolve, reject) => {
			reject(/* @__PURE__ */ new Error("Not implemented for web."));
		});
	}
	async openIOS() {
		return new Promise((_resolve, reject) => {
			reject(/* @__PURE__ */ new Error("Not implemented for web."));
		});
	}
};
export { NativeSettingsWeb };
