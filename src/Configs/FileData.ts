import {XMLBuilder, XMLParser} from 'fast-xml-parser';
import DataSourceItem from "../Interfaces/DataSourceItem.ts";

export default class FileData {
    FilePath = ""
    IsBaseTranslate = false;
    Datas: Map<string, DataSourceItem> = new Map;

    constructor(data: string, oriData: string[], fileName: string, isBase: boolean) {
        this.FilePath = fileName;
        this.IsBaseTranslate = isBase;
        this.Datas = new Map;

        const parser = new XMLParser({
            ignoreAttributes: false, // 不忽略属性
            attributeNamePrefix: "@_", // 属性的前缀
        });
        const jsonObject = parser.parse(data);

        if (isBase) {
            const oriJson = parser.parse(oriData[0]);
            Object.entries(jsonObject.xml).forEach(([category, items]) => {
                if (typeof items !== "object" || items === null) {
                    console.warn(`Invalid value for key: ${category}`);
                    return;
                }
                Object.entries(items).forEach(([key, value]) => {
                    if (typeof value !== "string") {
                        console.warn(`Invalid value for key: ${key}`);
                        return;
                    }
                    this.Datas.set(key, {
                        key: key,
                        category: category,
                        originVersion: oriJson.xml[category][key],
                        translateVersion: value,
                        machineTranslate: "No Translation",
                        isComplete: false,
                        isIgnore: false,
                        sourceFile: fileName
                    })
                })
            });
        } else {
            const oriJsons = oriData.map((ori): any => {
                return parser.parse(ori);
            });
            Object.entries(jsonObject.xml).forEach(([category, items]) => {
                if (typeof items !== "object" || items === null) {
                    console.warn(`Invalid value for key: ${category}`);
                    return;
                }
                Object.entries(items).forEach(([key, value]) => {
                    let oriItem: any = null
                    for (let i = 0; i < oriJsons.length; i++) {
                        if (oriJsons[i].xml === undefined && oriJsons[i].quests !== undefined) {
                            oriJsons[i].xml = oriJsons[i].quests
                        }

                        if (oriJsons[i].xml[category] === undefined) {
                            continue
                        }

                        for (let j = 0; j < oriJsons[i].xml[category].length; j++) {
                            if (oriJsons[i].xml[category][j].id == value.id) {
                                oriItem = oriJsons[i].xml[category][j]
                                break
                            }
                        }
                    }

                    if (value.desc !== undefined && value.desc["@_name"] !== undefined) {
                        const saveKey = (oriItem !== null && oriItem.desc !== undefined ? oriItem.desc["@_name"] : "Ori not found") + "@desc" + key
                        this.Datas.set(saveKey, {
                            key: saveKey,
                            category: category,
                            originVersion: oriItem !== null && oriItem.desc !== undefined ? oriItem.desc["@_name"] : "Ori not found",
                            translateVersion: value.desc["@_name"],
                            machineTranslate: "No Translation",
                            isComplete: false,
                            isIgnore: false,
                            sourceFile: fileName,
                            textPath: value.id + "\\desc\\@_name"
                        })

                    }

                    if (value.stats !== undefined) {
                        if (value.stats.tip !== undefined) {
                            const saveKey = ((oriItem !== null && oriItem.stats !== undefined && oriItem.stats.tip !== undefined) ? (typeof oriItem.stats.tip === "string" ? oriItem.stats.tip : oriItem.stats.tip["#text"]) : "Ori not found") + "@tip" + key
                            this.Datas.set(saveKey, {
                                key: saveKey,
                                category: category,
                                originVersion: ((oriItem !== null && oriItem.stats !== undefined && oriItem.stats.tip !== undefined) ? (typeof oriItem.stats.tip === "string" ? oriItem.stats.tip : oriItem.stats.tip["#text"]) : "Ori not found"),
                                translateVersion: value.stats.tip["#text"],
                                machineTranslate: "No Translation",
                                isComplete: false,
                                isIgnore: false,
                                sourceFile: fileName,
                                textPath: value.id + "\\stats\\tip"
                            })
                        }
                    }
                })
            })
        }
    }

    public GetExportData(transString: string): string {
        const builder = new XMLBuilder({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            format: true,
        });

        let tmpObj = {
            "?xml": {
                "@_version": "1.0",
                "@_encoding": "utf-8",
            }
        } as any
        let xml = ""
        if (this.IsBaseTranslate) {
            const tmpDatas = {} as any
            this.Datas.forEach((value) => {
                if (!tmpDatas[value.category]) {
                    tmpDatas[value.category] = {} as any
                }

                tmpDatas[value.category][value.key] = value.translateVersion
            })

            tmpObj = {
                ...tmpObj,
                xml: {
                    ...tmpDatas
                }
            }

            xml = builder.build(tmpObj) as string;
        } else {
            const parser = new XMLParser({
                ignoreAttributes: false, // 不忽略属性
                attributeNamePrefix: "@_", // 属性的前缀
            });
            const jsonObject = parser.parse(transString);

            this.Datas.forEach((value) => {
                if (jsonObject.xml === undefined) {
                    return
                }

                if (jsonObject.xml[value.category] === undefined) {
                    console.warn("Category not found: " + value.category)
                    return;
                }

                Object.entries(jsonObject.xml[value.category]).forEach(([key, item]) => {
                    if (value.textPath === undefined) {
                        console.warn("Text path not found: " + value.key)
                        return;
                    }
                    const path = value.textPath.split("\\")
                    if (path[0] === undefined || path[0] !== key) {
                        return
                    }

                    let pathIndex = 1
                    let curRoot = item as any
                    while (pathIndex < path.length - 1) {
                        if (curRoot[path[pathIndex]] === undefined) {
                            return
                        }
                        curRoot = curRoot[path[pathIndex]]
                        pathIndex++
                    }

                    curRoot[path[path.length - 1]] = value.translateVersion
                })
            })
            xml = builder.build(jsonObject) as string;
        }

        return xml
    }
}