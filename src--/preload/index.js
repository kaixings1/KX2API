var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../main/ipc/channels';
var proxyAPI = {
    start: function (port) {
        return ipcRenderer.invoke(IpcChannels.PROXY_START, port);
    },
    stop: function () {
        return ipcRenderer.invoke(IpcChannels.PROXY_STOP);
    },
    getStatus: function () {
        return ipcRenderer.invoke(IpcChannels.PROXY_GET_STATUS);
    },
    onStatusChanged: function (callback) {
        var handler = function (_event, status) { return callback(status); };
        ipcRenderer.on(IpcChannels.PROXY_STATUS_CHANGED, handler);
        return function () { return ipcRenderer.removeListener(IpcChannels.PROXY_STATUS_CHANGED, handler); };
    },
};
var storeAPI = {
    get: function (key) {
        return ipcRenderer.invoke(IpcChannels.STORE_GET, key);
    },
    set: function (key, value) {
        return ipcRenderer.invoke(IpcChannels.STORE_SET, key, value);
    },
    delete: function (key) {
        return ipcRenderer.invoke(IpcChannels.STORE_DELETE, key);
    },
    clearAll: function () {
        return ipcRenderer.invoke(IpcChannels.STORE_CLEAR_ALL);
    },
    onInitError: function (callback) {
        var handler = function (_event, error) { return callback(error); };
        ipcRenderer.on(IpcChannels.STORE_INIT_ERROR, handler);
        return function () { return ipcRenderer.removeListener(IpcChannels.STORE_INIT_ERROR, handler); };
    },
    retryInit: function () {
        return ipcRenderer.invoke(IpcChannels.STORE_RETRY_INIT);
    },
};
var providersAPI = {
    getAll: function () {
        return ipcRenderer.invoke(IpcChannels.PROVIDERS_GET_ALL);
    },
    getBuiltin: function () {
        return ipcRenderer.invoke(IpcChannels.PROVIDERS_GET_BUILTIN);
    },
    add: function (data) {
        return ipcRenderer.invoke(IpcChannels.PROVIDERS_ADD, data);
    },
    update: function (id, updates) {
        return ipcRenderer.invoke(IpcChannels.PROVIDERS_UPDATE, id, updates);
    },
    delete: function (id) {
        return ipcRenderer.invoke(IpcChannels.PROVIDERS_DELETE, id);
    },
    checkStatus: function (providerId) {
        return ipcRenderer.invoke(IpcChannels.PROVIDERS_CHECK_STATUS, providerId);
    },
    checkAllStatus: function () {
        return ipcRenderer.invoke(IpcChannels.PROVIDERS_CHECK_ALL_STATUS);
    },
    duplicate: function (id) {
        return ipcRenderer.invoke(IpcChannels.PROVIDERS_DUPLICATE, id);
    },
    export: function (id) {
        return ipcRenderer.invoke(IpcChannels.PROVIDERS_EXPORT, id);
    },
    import: function (jsonData) {
        return ipcRenderer.invoke(IpcChannels.PROVIDERS_IMPORT, jsonData);
    },
    updateModels: function (providerId) {
        return ipcRenderer.invoke(IpcChannels.PROVIDERS_UPDATE_MODELS, providerId);
    },
    getEffectiveModels: function (providerId) {
        return ipcRenderer.invoke(IpcChannels.PROVIDERS_GET_EFFECTIVE_MODELS, providerId);
    },
    addCustomModel: function (providerId, model) {
        return ipcRenderer.invoke(IpcChannels.PROVIDERS_ADD_CUSTOM_MODEL, providerId, model);
    },
    removeModel: function (providerId, modelName) {
        return ipcRenderer.invoke(IpcChannels.PROVIDERS_REMOVE_MODEL, providerId, modelName);
    },
    resetModels: function (providerId) {
        return ipcRenderer.invoke(IpcChannels.PROVIDERS_RESET_MODELS, providerId);
    },
};
var accountsAPI = {
    getAll: function (includeCredentials) {
        return ipcRenderer.invoke(IpcChannels.ACCOUNTS_GET_ALL, includeCredentials);
    },
    getById: function (id, includeCredentials) {
        return ipcRenderer.invoke(IpcChannels.ACCOUNTS_GET_BY_ID, id, includeCredentials);
    },
    getByProvider: function (providerId) {
        return ipcRenderer.invoke(IpcChannels.ACCOUNTS_GET_BY_PROVIDER, providerId);
    },
    add: function (data) {
        return ipcRenderer.invoke(IpcChannels.ACCOUNTS_ADD, data);
    },
    update: function (id, updates) {
        return ipcRenderer.invoke(IpcChannels.ACCOUNTS_UPDATE, id, updates);
    },
    delete: function (id) {
        return ipcRenderer.invoke(IpcChannels.ACCOUNTS_DELETE, id);
    },
    validate: function (accountId) {
        return ipcRenderer.invoke(IpcChannels.ACCOUNTS_VALIDATE, accountId);
    },
    validateToken: function (providerId, credentials) {
        return ipcRenderer.invoke(IpcChannels.ACCOUNTS_VALIDATE_TOKEN, providerId, credentials);
    },
    getCredits: function (accountId) {
        return ipcRenderer.invoke(IpcChannels.ACCOUNTS_GET_CREDITS, accountId);
    },
    clearChats: function (accountId) {
        return ipcRenderer.invoke(IpcChannels.ACCOUNTS_CLEAR_CHATS, accountId);
    },
};
var oauthAPI = {
    startLogin: function (providerId, providerType) {
        return ipcRenderer.invoke(IpcChannels.OAUTH_START_LOGIN, providerId, providerType);
    },
    cancelLogin: function () {
        return ipcRenderer.invoke(IpcChannels.OAUTH_CANCEL_LOGIN);
    },
    loginWithToken: function (providerId, providerType, token) {
        return ipcRenderer.invoke(IpcChannels.OAUTH_LOGIN_WITH_TOKEN, { providerId: providerId, providerType: providerType, token: token });
    },
    validateToken: function (providerId, providerType, credentials) {
        return ipcRenderer.invoke(IpcChannels.OAUTH_VALIDATE_TOKEN, { providerId: providerId, providerType: providerType, credentials: credentials });
    },
    refreshToken: function (providerId, providerType, credentials) {
        return ipcRenderer.invoke(IpcChannels.OAUTH_REFRESH_TOKEN, { providerId: providerId, providerType: providerType, credentials: credentials });
    },
    getStatus: function () {
        return ipcRenderer.invoke(IpcChannels.OAUTH_GET_STATUS);
    },
    startInAppLogin: function (providerId, providerType, timeout) {
        return ipcRenderer.invoke(IpcChannels.OAUTH_START_IN_APP_LOGIN, { providerId: providerId, providerType: providerType, timeout: timeout });
    },
    cancelInAppLogin: function () {
        return ipcRenderer.invoke(IpcChannels.OAUTH_CANCEL_IN_APP_LOGIN);
    },
    isInAppLoginOpen: function () {
        return ipcRenderer.invoke(IpcChannels.OAUTH_IN_APP_LOGIN_STATUS);
    },
    onCallback: function (callback) {
        var handler = function (_event, result) { return callback(result); };
        ipcRenderer.on(IpcChannels.OAUTH_CALLBACK, handler);
        return function () { return ipcRenderer.removeListener(IpcChannels.OAUTH_CALLBACK, handler); };
    },
    onProgress: function (callback) {
        var handler = function (_event, event) { return callback(event); };
        ipcRenderer.on(IpcChannels.OAUTH_PROGRESS, handler);
        return function () { return ipcRenderer.removeListener(IpcChannels.OAUTH_PROGRESS, handler); };
    },
};
var logsAPI = {
    get: function (filter) {
        return ipcRenderer.invoke(IpcChannels.LOGS_GET, filter);
    },
    getStats: function () {
        return ipcRenderer.invoke(IpcChannels.LOGS_GET_STATS);
    },
    getTrend: function (days) {
        return ipcRenderer.invoke(IpcChannels.LOGS_GET_TREND, days);
    },
    getAccountTrend: function (accountId, days) {
        return ipcRenderer.invoke(IpcChannels.LOGS_GET_ACCOUNT_TREND, accountId, days);
    },
    clear: function () {
        return ipcRenderer.invoke(IpcChannels.LOGS_CLEAR);
    },
    export: function (format) {
        return ipcRenderer.invoke(IpcChannels.LOGS_EXPORT, format);
    },
    getById: function (id) {
        return ipcRenderer.invoke(IpcChannels.LOGS_GET_BY_ID, id);
    },
    onNewLog: function (callback) {
        var handler = function (_event, log) { return callback(log); };
        ipcRenderer.on(IpcChannels.LOGS_NEW_LOG, handler);
        return function () { return ipcRenderer.removeListener(IpcChannels.LOGS_NEW_LOG, handler); };
    },
};
var requestLogsAPI = {
    get: function (filter) {
        return ipcRenderer.invoke(IpcChannels.REQUEST_LOGS_GET, filter);
    },
    getById: function (id) {
        return ipcRenderer.invoke(IpcChannels.REQUEST_LOGS_GET_BY_ID, id);
    },
    getStats: function () {
        return ipcRenderer.invoke(IpcChannels.REQUEST_LOGS_GET_STATS);
    },
    getTrend: function (days) {
        return ipcRenderer.invoke(IpcChannels.REQUEST_LOGS_GET_TREND, days);
    },
    clear: function () {
        return ipcRenderer.invoke(IpcChannels.REQUEST_LOGS_CLEAR);
    },
    onNewLog: function (callback) {
        var handler = function (_event, log) { return callback(log); };
        ipcRenderer.on(IpcChannels.REQUEST_LOGS_NEW, handler);
        return function () { return ipcRenderer.removeListener(IpcChannels.REQUEST_LOGS_NEW, handler); };
    },
};
var statisticsAPI = {
    get: function () {
        return ipcRenderer.invoke(IpcChannels.STATISTICS_GET);
    },
    getToday: function () {
        return ipcRenderer.invoke(IpcChannels.STATISTICS_GET_TODAY);
    },
};
var appAPI = {
    getVersion: function () {
        return ipcRenderer.invoke(IpcChannels.APP_GET_VERSION);
    },
    minimize: function () {
        return ipcRenderer.invoke(IpcChannels.APP_MINIMIZE);
    },
    maximize: function () {
        return ipcRenderer.invoke(IpcChannels.APP_MAXIMIZE);
    },
    close: function () {
        return ipcRenderer.invoke(IpcChannels.APP_CLOSE);
    },
    showWindow: function () {
        return ipcRenderer.invoke(IpcChannels.APP_SHOW_WINDOW);
    },
    hideWindow: function () {
        return ipcRenderer.invoke(IpcChannels.APP_HIDE_WINDOW);
    },
    openExternal: function (url) {
        return ipcRenderer.invoke(IpcChannels.APP_OPEN_EXTERNAL, url);
    },
    checkUpdate: function () {
        return ipcRenderer.invoke(IpcChannels.APP_CHECK_UPDATE);
    },
    downloadUpdate: function () {
        return ipcRenderer.invoke(IpcChannels.APP_DOWNLOAD_UPDATE);
    },
    installUpdate: function () {
        return ipcRenderer.invoke(IpcChannels.APP_INSTALL_UPDATE);
    },
    getUpdateStatus: function () {
        return ipcRenderer.invoke(IpcChannels.APP_GET_UPDATE_STATUS);
    },
    onUpdateChecking: function (callback) {
        var listener = function (_event) { return callback(); };
        ipcRenderer.on(IpcChannels.APP_UPDATE_CHECKING, listener);
        return function () { return ipcRenderer.removeListener(IpcChannels.APP_UPDATE_CHECKING, listener); };
    },
    onUpdateAvailable: function (callback) {
        var listener = function (_event, info) { return callback(info); };
        ipcRenderer.on(IpcChannels.APP_UPDATE_AVAILABLE, listener);
        return function () { return ipcRenderer.removeListener(IpcChannels.APP_UPDATE_AVAILABLE, listener); };
    },
    onUpdateNotAvailable: function (callback) {
        var listener = function (_event, info) { return callback(info); };
        ipcRenderer.on(IpcChannels.APP_UPDATE_NOT_AVAILABLE, listener);
        return function () { return ipcRenderer.removeListener(IpcChannels.APP_UPDATE_NOT_AVAILABLE, listener); };
    },
    onUpdateProgress: function (callback) {
        var listener = function (_event, progress) { return callback(progress); };
        ipcRenderer.on(IpcChannels.APP_UPDATE_PROGRESS, listener);
        return function () { return ipcRenderer.removeListener(IpcChannels.APP_UPDATE_PROGRESS, listener); };
    },
    onUpdateDownloaded: function (callback) {
        var listener = function (_event, info) { return callback(info); };
        ipcRenderer.on(IpcChannels.APP_UPDATE_DOWNLOADED, listener);
        return function () { return ipcRenderer.removeListener(IpcChannels.APP_UPDATE_DOWNLOADED, listener); };
    },
    onUpdateError: function (callback) {
        var listener = function (_event, error) { return callback(error); };
        ipcRenderer.on(IpcChannels.APP_UPDATE_ERROR, listener);
        return function () { return ipcRenderer.removeListener(IpcChannels.APP_UPDATE_ERROR, listener); };
    },
};
var configAPI = {
    get: function () {
        return ipcRenderer.invoke(IpcChannels.CONFIG_GET);
    },
    update: function (updates) {
        return ipcRenderer.invoke(IpcChannels.CONFIG_UPDATE, updates);
    },
    onConfigChanged: function (callback) {
        var handler = function (_event, config) { return callback(config); };
        ipcRenderer.on(IpcChannels.CONFIG_CHANGED, handler);
        return function () { return ipcRenderer.removeListener(IpcChannels.CONFIG_CHANGED, handler); };
    },
};
var promptsAPI = {
    getAll: function () {
        return ipcRenderer.invoke(IpcChannels.PROMPTS_GET_ALL);
    },
    getBuiltin: function () {
        return ipcRenderer.invoke(IpcChannels.PROMPTS_GET_BUILTIN);
    },
    getCustom: function () {
        return ipcRenderer.invoke(IpcChannels.PROMPTS_GET_CUSTOM);
    },
    getById: function (id) {
        return ipcRenderer.invoke(IpcChannels.PROMPTS_GET_BY_ID, id);
    },
    add: function (prompt) {
        return ipcRenderer.invoke(IpcChannels.PROMPTS_ADD, prompt);
    },
    update: function (id, updates) {
        return ipcRenderer.invoke(IpcChannels.PROMPTS_UPDATE, id, updates);
    },
    delete: function (id) {
        return ipcRenderer.invoke(IpcChannels.PROMPTS_DELETE, id);
    },
    getByType: function (type) {
        return ipcRenderer.invoke(IpcChannels.PROMPTS_GET_BY_TYPE, type);
    },
};
var sessionAPI = {
    getConfig: function () {
        return ipcRenderer.invoke(IpcChannels.SESSION_GET_CONFIG);
    },
    updateConfig: function (config) {
        return ipcRenderer.invoke(IpcChannels.SESSION_UPDATE_CONFIG, config);
    },
    getAll: function () {
        return ipcRenderer.invoke(IpcChannels.SESSION_GET_ALL);
    },
    getActive: function () {
        return ipcRenderer.invoke(IpcChannels.SESSION_GET_ACTIVE);
    },
    getById: function (id) {
        return ipcRenderer.invoke(IpcChannels.SESSION_GET_BY_ID, id);
    },
    getByAccount: function (accountId) {
        return ipcRenderer.invoke(IpcChannels.SESSION_GET_BY_ACCOUNT, accountId);
    },
    getByProvider: function (providerId) {
        return ipcRenderer.invoke(IpcChannels.SESSION_GET_BY_PROVIDER, providerId);
    },
    delete: function (id) {
        return ipcRenderer.invoke(IpcChannels.SESSION_DELETE, id);
    },
    clearAll: function () {
        return ipcRenderer.invoke(IpcChannels.SESSION_CLEAR_ALL);
    },
    cleanExpired: function () {
        return ipcRenderer.invoke(IpcChannels.SESSION_CLEAN_EXPIRED);
    },
};
var managementApiAPI = {
    getConfig: function () {
        return ipcRenderer.invoke(IpcChannels.MANAGEMENT_API_GET_CONFIG);
    },
    updateConfig: function (updates) {
        return ipcRenderer.invoke(IpcChannels.MANAGEMENT_API_UPDATE_CONFIG, updates);
    },
    generateSecret: function () {
        return ipcRenderer.invoke(IpcChannels.MANAGEMENT_API_GENERATE_SECRET);
    },
};
var contextManagementAPI = {
    getConfig: function () {
        return ipcRenderer.invoke(IpcChannels.CONTEXT_MANAGEMENT_GET_CONFIG);
    },
    updateConfig: function (updates) {
        return ipcRenderer.invoke(IpcChannels.CONTEXT_MANAGEMENT_UPDATE_CONFIG, updates);
    },
};
function resolveLocalManagementApiBaseUrl(config) {
    var configuredHost = config.proxyHost || '127.0.0.1';
    var host = configuredHost === '0.0.0.0' || configuredHost === '::' || configuredHost === '[::]'
        ? '127.0.0.1'
        : configuredHost;
    return "http://".concat(host, ":").concat(config.proxyPort, "/v0/management");
}
var toolCallingAPI = {
    getStatus: function () {
        return __awaiter(this, void 0, void 0, function () {
            var config, secret, response;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, configAPI.get()];
                    case 1:
                        config = _b.sent();
                        secret = (_a = config.managementApi) === null || _a === void 0 ? void 0 : _a.managementApiSecret;
                        if (!secret)
                            return [2 /*return*/, null];
                        return [4 /*yield*/, fetch("".concat(resolveLocalManagementApiBaseUrl(config), "/tool-calling/status"), {
                                headers: { Authorization: "Bearer ".concat(secret) },
                            })];
                    case 2:
                        response = _b.sent();
                        return [2 /*return*/, response.json()];
                }
            });
        });
    },
    runSmoke: function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var config, secret, response;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, configAPI.get()];
                    case 1:
                        config = _b.sent();
                        secret = (_a = config.managementApi) === null || _a === void 0 ? void 0 : _a.managementApiSecret;
                        if (!secret) {
                            return [2 /*return*/, { success: false, error: { message: 'Management API secret is not configured.' } }];
                        }
                        return [4 /*yield*/, fetch("".concat(resolveLocalManagementApiBaseUrl(config), "/tool-calling/smoke"), {
                                method: 'POST',
                                headers: {
                                    Authorization: "Bearer ".concat(secret),
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(input),
                            })];
                    case 2:
                        response = _b.sent();
                        return [2 /*return*/, response.json()];
                }
            });
        });
    },
};
var trayAPI = {
    openDashboard: function () {
        return ipcRenderer.send('tray:open-dashboard');
    },
    setHeight: function (height) {
        return ipcRenderer.send('tray:set-height', height);
    },
    quitApp: function () {
        return ipcRenderer.send('tray:quit-app');
    },
};
var electronAPI = {
    proxy: proxyAPI,
    store: storeAPI,
    providers: providersAPI,
    accounts: accountsAPI,
    oauth: oauthAPI,
    logs: logsAPI,
    requestLogs: requestLogsAPI,
    statistics: statisticsAPI,
    app: appAPI,
    config: configAPI,
    prompts: promptsAPI,
    session: sessionAPI,
    managementApi: managementApiAPI,
    contextManagement: contextManagementAPI,
    toolCalling: toolCallingAPI,
    tray: trayAPI,
    // Chat API — AI 对话功能
    chat: {
        sendMessage: function (text) {
            return ipcRenderer.invoke('chat:sendMessage', text);
        },
        onStreamChunk: function (callback) {
            var handler = function (_event, data) { return callback(data); };
            ipcRenderer.on(IpcChannels.CHAT_STREAM_CHUNK, handler);
            return function () { return ipcRenderer.removeListener(IpcChannels.CHAT_STREAM_CHUNK, handler); };
        },
        onStreamDone: function (callback) {
            var handler = function (_event, data) { return callback(data); };
            ipcRenderer.on(IpcChannels.CHAT_STREAM_DONE, handler);
            return function () { return ipcRenderer.removeListener(IpcChannels.CHAT_STREAM_DONE, handler); };
        },
        onStreamError: function (callback) {
            var handler = function (_event, data) { return callback(data); };
            ipcRenderer.on(IpcChannels.CHAT_STREAM_ERROR, handler);
            return function () { return ipcRenderer.removeListener(IpcChannels.CHAT_STREAM_ERROR, handler); };
        },
        getHistory: function () {
            return ipcRenderer.invoke('chat:getHistory');
        },
        clearHistory: function () {
            return ipcRenderer.invoke('chat:clearHistory');
        },
        getConfig: function () {
            return ipcRenderer.invoke('chat:getConfig');
        },
        setConfig: function (updates) {
            return ipcRenderer.invoke('chat:setConfig', updates);
        },
        executeCommand: function (name, args) {
            return ipcRenderer.invoke('chat:executeCommand', name, args);
        },
    },
    // Profiles API — 配置组管理
    profiles: {
        getAll: function () {
            return ipcRenderer.invoke('profiles:getAll');
        },
        getActive: function () {
            return ipcRenderer.invoke('profiles:getActive');
        },
        setActive: function (name) {
            console.log('[Preload] profiles.setActive invoked:', name);
            return ipcRenderer.invoke('profiles:setActive', name).then(function (r) {
                console.log('[Preload] profiles.setActive result:', r);
                return r;
            }).catch(function (e) {
                console.error('[Preload] profiles.setActive error:', e);
                return { success: false, error: e.message };
            });
        },
        upsert: function (profile) {
            return ipcRenderer.invoke('profiles:upsert', profile);
        },
        remove: function (name) {
            return ipcRenderer.invoke('profiles:remove', name);
        },
    },
    // .doge config file management
    dogeConfig: {
        listFiles: function () {
            return ipcRenderer.invoke('doge:listConfigFiles');
        },
        readFile: function (name) {
            return ipcRenderer.invoke('doge:readConfigFile', name);
        },
        deleteFile: function (name) {
            return ipcRenderer.invoke('doge:deleteConfigFile', name);
        },
    },
    // Team Task — 多角色协作任务
    team: {
        execute: function (description, customRoles) {
            return ipcRenderer.invoke('team:execute', description, customRoles);
        },
        getResult: function (planId) {
            return ipcRenderer.invoke('team:getResult', planId);
        },
        onPhaseChange: function (callback) {
            var handler = function (_event, event) { return callback(event); };
            ipcRenderer.on('team:streamPhase', handler);
            return function () { return ipcRenderer.removeListener('team:streamPhase', handler); };
        },
        onDiscussion: function (callback) {
            var handler = function (_event, event) { return callback(event); };
            ipcRenderer.on('team:streamDiscussion', handler);
            return function () { return ipcRenderer.removeListener('team:streamDiscussion', handler); };
        },
        onTaskEvent: function (callback) {
            var handler = function (_event, event) { return callback(event); };
            ipcRenderer.on('team:streamTask', handler);
            return function () { return ipcRenderer.removeListener('team:streamTask', handler); };
        },
        onDone: function (callback) {
            var handler = function (_event, event) { return callback(event); };
            ipcRenderer.on('team:streamDone', handler);
            return function () { return ipcRenderer.removeListener('team:streamDone', handler); };
        },
        onError: function (callback) {
            var handler = function (_event, event) { return callback(event); };
            ipcRenderer.on('team:streamError', handler);
            return function () { return ipcRenderer.removeListener('team:streamError', handler); };
        },
    },
    on: function (channel, callback) {
        var subscription = function (_event) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            return callback.apply(void 0, args);
        };
        ipcRenderer.on(channel, subscription);
        return function () { return ipcRenderer.removeListener(channel, subscription); };
    },
    send: function (channel) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        ipcRenderer.send.apply(ipcRenderer, __spreadArray([channel], args, false));
    },
    invoke: function (channel) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return ipcRenderer.invoke.apply(ipcRenderer, __spreadArray([channel], args, false));
    },
};
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
