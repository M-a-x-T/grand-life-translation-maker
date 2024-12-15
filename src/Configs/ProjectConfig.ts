import FileData from "./FileData.ts";

export default class ProjectConfig {
    GameFolder = "";
    Language = "zh_CN";
    Translations: Map<string, FileData> = new Map;

    constructor(data?: Partial<ProjectConfig>) {
        if (data) {
            this.GameFolder = data.GameFolder || this.GameFolder;
            this.Language = data.Language || this.Language;

            if (data.Translations) {
                this.Translations = new Map(Object.entries(data.Translations))
                this.Translations.forEach((value) => {
                    value.Datas = new Map(Object.entries(value.Datas));
                });
            }
        }
    }
}