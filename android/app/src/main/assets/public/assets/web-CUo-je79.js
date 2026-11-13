import { n as BiometryType, r as WebPlugin, t as AuthenticationStrength } from "./index-B3UarFnd.js";
// node_modules/@capgo/capacitor-native-biometric/dist/esm/web.js
var NativeBiometricWeb = class extends WebPlugin {
	constructor() {
		super();
		/**
		* In-memory credential storage for browser development/testing.
		* Credentials are stored temporarily and cleared on page refresh.
		* This is NOT secure storage and should only be used for development purposes.
		*/
		this.credentialStore = /* @__PURE__ */ new Map();
		this.dataStore = /* @__PURE__ */ new Map();
	}
	isAvailable() {
		return Promise.resolve({
			isAvailable: true,
			authenticationStrength: AuthenticationStrength.STRONG,
			biometryType: BiometryType.TOUCH_ID,
			deviceIsSecure: true,
			strongBiometryIsAvailable: true
		});
	}
	async addListener(_eventName, _listener) {
		return { remove: async () => {} };
	}
	verifyIdentity(_options) {
		console.log("verifyIdentity (dummy implementation)");
		return Promise.resolve();
	}
	getCredentials(_options) {
		console.log("getCredentials (dummy implementation)", { server: _options.server });
		const credentials = this.credentialStore.get(_options.server);
		if (!credentials) throw new Error("No credentials found for the specified server");
		return Promise.resolve(credentials);
	}
	getSecureCredentials(_options) {
		console.log("getSecureCredentials (dummy implementation)", { server: _options.server });
		const credentials = this.credentialStore.get(_options.server);
		if (!credentials) throw new Error("No credentials found for the specified server");
		return Promise.resolve(credentials);
	}
	setCredentials(_options) {
		console.log("setCredentials (dummy implementation)", { server: _options.server });
		this.credentialStore.set(_options.server, {
			username: _options.username,
			password: _options.password
		});
		return Promise.resolve();
	}
	deleteCredentials(_options) {
		console.log("deleteCredentials (dummy implementation)", { server: _options.server });
		this.credentialStore.delete(_options.server);
		return Promise.resolve();
	}
	isCredentialsSaved(_options) {
		console.log("isCredentialsSaved (dummy implementation)", { server: _options.server });
		return Promise.resolve({ isSaved: this.credentialStore.has(_options.server) });
	}
	setData(_options) {
		console.log("setData (dummy implementation)", { key: _options.key });
		this.dataStore.set(_options.key, _options.value);
		return Promise.resolve();
	}
	getData(_options) {
		console.log("getData (dummy implementation)", { key: _options.key });
		const value = this.dataStore.get(_options.key);
		if (value === void 0) throw new Error("No data found for the specified key");
		return Promise.resolve({ value });
	}
	getSecureData(_options) {
		console.log("getSecureData (dummy implementation)", { key: _options.key });
		const value = this.dataStore.get(_options.key);
		if (value === void 0) throw new Error("No protected data found for the specified key");
		return Promise.resolve({ value });
	}
	deleteData(_options) {
		console.log("deleteData (dummy implementation)", { key: _options.key });
		this.dataStore.delete(_options.key);
		return Promise.resolve();
	}
	isDataSaved(_options) {
		console.log("isDataSaved (dummy implementation)", { key: _options.key });
		return Promise.resolve({ isSaved: this.dataStore.has(_options.key) });
	}
	async getPluginVersion() {
		return { version: "web" };
	}
};
export { NativeBiometricWeb };
