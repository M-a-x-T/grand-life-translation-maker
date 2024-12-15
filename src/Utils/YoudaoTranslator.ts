import CryptoJS from "crypto-js";
import BaseTranslator from "./BaseTranslator.ts";

export default class YoudaoTranslator extends BaseTranslator {
    private readonly appKey: string;
    private readonly appSecret: string;

    constructor(appKey: string, appSecret: string) {
        super();
        this.appKey = appKey;
        this.appSecret = appSecret;
    }

    private truncate(q: string): string {
        const len = q.length;
        if (len <= 20) return q;
        return q.substring(0, 10) + len + q.substring(len - 10, len);
    }

    async translate(text: string, from: string, to: string): Promise<string> {
        this.validateParams(text, from, to);

        const salt = `${new Date().getTime()}`;
        const curtime = Math.round(new Date().getTime() / 1000);
        const signString = this.appKey + this.truncate(text) + salt + curtime + this.appSecret;
        const sign = CryptoJS.SHA256(signString).toString(CryptoJS.enc.Hex);

        const url = "https://openapi.youdao.com/api";
        const params = new URLSearchParams({
            q: text,
            appKey: this.appKey,
            salt,
            from: this._ConvertLanguage(from),
            to: this._ConvertLanguage(to),
            sign,
            signType: "v3",
            curtime: `${curtime}`,
            domain: "game",
            strict: "true",
        });

        const options = {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: params.toString()
        }
        const result = await window.ipcRenderer.invoke("fetch", {url, options});
        if (!result.success) {
            throw new Error(result.error);
        }

        const data = result.data;

        if (data.errorCode !== "0") {
            console.error(`Youdao API Error: ${data.errorCode}`);
            return "Fetch translation error"
        }

        return data.translation?.[0] || "";
    }

    private _ConvertLanguage(language: string): string {
        switch (language) {
            case "zh_CN":
                return "zh-CHS";
            default:
                return language;
        }
    }
}
