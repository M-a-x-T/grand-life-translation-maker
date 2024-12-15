import './App.css';
import {Button, Checkbox, Col, Divider, Input as AntdInput, message, Row, Statistic, Table} from "antd";
import React, {useRef, useState} from "react";
import EditableCell from "./Components/EditableCell.tsx";
import EditableRow from "./Components/EditableRow.tsx";
import ProjectConfig from "./Configs/ProjectConfig.ts";
import DataSourceItem from "./Interfaces/DataSourceItem.ts";
import TableColumns from "./Components/TableColumns.tsx";
import FileData from "./Configs/FileData.ts";
import {CheckboxChangeEvent} from "antd/es/checkbox";
import SaveFileArgs from "./Interfaces/SaveFileArgs.ts";
import YoudaoTranslator from "./Utils/YoudaoTranslator.ts";

export default function App() {
    const [searchText, setSearchText] = useState("");
    const [searchComplete, setSearchComplete] = useState(false);
    const [searchIgnore, setSearchIgnore] = useState(false);
    const [selectedFile, setSelectedFile] = useState<string>("No file selected");
    const [projectConfig, setProjectConfig] = useState<ProjectConfig | null>(null);
    const [messageApi, contextHolder] = message.useMessage();
    const oriFilesRef = useRef<Map<string, string>>(new Map<string, string>());

    async function SaveProjectDatas(config: ProjectConfig, configPath: string) {
        const saveResult = await window.ipcRenderer.invoke('save-file', {
            data: {
                title: "Save Project Config",
                content: JSON.stringify(config, (_key, value) => {
                    if (value instanceof Map) {
                        return Object.fromEntries(value); // 将 Map 转为二维数组
                    }
                    return value;
                }, 2),
                displayChoosePathDialog: false,
                defaultPath: configPath,
            } as SaveFileArgs
        });

        if (saveResult.success) {
            console.log('File saved successfully at:', saveResult.path);
        } else {
            console.error('Failed to save file:', saveResult.error);
        }
    }

    async function GetProjectDatas(config: ProjectConfig, configPath: string) {
        const projectPath = config.GameFolder
        const translationPath = projectPath + "\\modsLanguages\\" + config.Language

        // send get file request to main process
        const result: {
            success: boolean,
            files: string[]
        } = await window.ipcRenderer.invoke('get-files-in-directory', {
            dirPath: translationPath + "\\data",
            recursive: true
        });

        if (!result.success) {
            console.log("Failed to get files")
            return
        }

        const files = result.files

        if (files.length <= 0) {
            console.error('Failed to get files');
            return
        }

        try {
            // load base translate
            const baseTranslatePath = translationPath + "\\baseTranslate.xml"
            const baseTranslateOriPath = projectPath + "\\modsLanguages\\en" + "\\baseTranslate.xml"
            const result = await window.ipcRenderer.invoke('read-file', baseTranslatePath) as {
                success: boolean,
                data: string
            };
            if (!result.success) {
                console.warn(`Failed to read file: ${baseTranslatePath}`);
                return;
            }
            const oriResult = await window.ipcRenderer.invoke('read-file', baseTranslateOriPath) as {
                success: boolean,
                data: string
            };
            if (!oriResult.success) {
                console.warn(`Failed to read file: ${baseTranslateOriPath}`);
                return;
            }

            const validFileDatas: Map<string, FileData> = new Map;
            validFileDatas.set(baseTranslatePath, new FileData(result.data, [oriResult.data], baseTranslatePath, true))

            // load data translate

            // wait for all files to be read
            const fileDatas: (FileData | null)[] = await Promise.all(
                files.map(async (file) => {
                    const result = await window.ipcRenderer.invoke('read-file', file) as {
                        success: boolean,
                        data: string
                    };
                    if (!result.success) {
                        console.warn(`Failed to read file: ${file}`);
                        return null;
                    }

                    const tmpPath = file.replace("\\modsLanguages\\" + config.Language, "")
                    const oriPath = tmpPath.substring(0, tmpPath.lastIndexOf("\\"))

                    const oriResult: {
                        success: boolean,
                        files: string[]
                    } = await window.ipcRenderer.invoke('get-files-in-directory', {
                        dirPath: oriPath,
                        recursive: true, // 确保递归获取文件
                    });

                    if (!oriResult.success) {
                        console.log("Failed to get files in directory:", translationPath + "\\data");
                        return null;
                    }

                    // 遍历获取到的所有文件
                    const allFileContents = await Promise.all(
                        oriResult.files.filter(target => target.substring(target.lastIndexOf(".") + 1) === "xml").map(async (innerFile) => {
                            const innerFileResult = await window.ipcRenderer.invoke('read-file', innerFile) as {
                                success: boolean,
                                data: string
                            };
                            if (!innerFileResult.success) {
                                console.warn(`Failed to read inner file: ${innerFile}`);
                                return null;
                            }
                            return innerFileResult.data;
                        })
                    );

                    // 过滤掉读取失败的文件
                    const validFiles = allFileContents.filter((f) => f !== null);

                    oriFilesRef.current.set(file, result.data);

                    return new FileData(result.data, validFiles, file, false);
                })
            );

            // todo: optional load mod translate

            // filter empty files then add to validFileDatas
            fileDatas.filter((data) => data !== null).map((data) => {
                validFileDatas.set(data.FilePath, data)
            });

            // update project config translation datas
            validFileDatas.forEach(
                (data) => {
                    if (data === null) {
                        return
                    }

                    // new data add to config directly
                    if (!config.Translations.has(data.FilePath)) {
                        config.Translations.set(data.FilePath, data)
                    }

                    // combine exist data
                    const existData = config.Translations.get(data.FilePath) as FileData
                    existData.Datas.forEach(
                        (item) => {
                            const existItem = data.Datas.get(item.key)
                            if (existItem === undefined) {
                                return
                            }

                            existItem.isComplete = item.isComplete
                            existItem.isIgnore = item.isIgnore
                            existItem.translateVersion = item.translateVersion
                            existItem.machineTranslate = item.machineTranslate
                        }
                    )

                    config.Translations.set(data.FilePath, data)
                }
            )

            // save parsed config
            await SaveProjectDatas(config, configPath)
        } catch (error) {
            console.error("Error processing files:", error);
        }
    }

    const handleSaveProject = async () => {
        if (projectConfig === null) {
            console.error("Project config is null")
            return
        }

        await SaveProjectDatas(projectConfig, selectedFile)
        messageApi.success(`Save project success: ${selectedFile}`,);
    }

    const handleExportTrans = async (toLocal: boolean) => {
        if (!projectConfig) {
            return;
        }

        // auto save project when export
        await handleSaveProject()

        await Promise.all(Array.from(projectConfig.Translations.values()).map(
            async (data) => {
                const relativePath = data.FilePath.substring(data.FilePath.lastIndexOf(projectConfig.Language) - 1);

                const exportPath = toLocal ? selectedFile.substring(0, selectedFile.lastIndexOf("\\")) + "\\exports" + relativePath : data.FilePath;

                return await window.ipcRenderer.invoke('save-file', {
                    data: {
                        title: "Save Translation",
                        content: data.GetExportData(oriFilesRef.current.get(data.FilePath) || ""),
                        displayChoosePathDialog: false,
                        defaultPath: exportPath,
                        filters: [
                            {name: 'XML Files', extensions: ['xml']},
                        ]
                    } as SaveFileArgs
                });
            }
        ))

        messageApi.success(`Export translation success`);
    }

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || !event.target.files[0]) {
            return
        }

        setSelectedFile(event.target.files[0].path);
        const result = await window.ipcRenderer.invoke('read-file', event.target.files[0].path);
        if (result.success) {
            try {
                // parse JSON object
                const jsonData = JSON.parse(result.data) as ProjectConfig;
                console.log("Data validation success:", jsonData);
                // validate data structure
                const projectConfig = new ProjectConfig(jsonData);
                await GetProjectDatas(projectConfig, event.target.files[0].path)
                setProjectConfig(projectConfig)
                messageApi.success(`Open project success: ${event.target.files[0].name}`,);
                return projectConfig;
            } catch (error) {
                console.error('Data validation error:', error);
                throw new Error('Invalid JSON structure.');
            } finally {
                event.target.value = '';
            }
        } else {
            console.error('Error reading JSON:', result.error);
            event.target.value = '';
            throw new Error(result.error);
        }
    };

    const handleNewProject = async () => {
        const defaultConfig = new ProjectConfig()

        const result = await window.ipcRenderer.invoke('save-file', {
            data: {
                title: "Save Project Config",
                content: JSON.stringify(defaultConfig, null, 2),
                displayChoosePathDialog: true,
                filters: [
                    {name: 'JSON Files', extensions: ['json']},
                ]
            } as SaveFileArgs
        });

        if (result.success) {
            console.log('File saved successfully at:', result.path);
        } else {
            console.error('Failed to save file:', result.error);
        }
    };

    const handleSave = (row: DataSourceItem) => {
        if (!projectConfig) {
            return;
        }

        const fileData = projectConfig.Translations.get(row.sourceFile) as FileData;
        if (!fileData) {
            return;
        }

        fileData.Datas.set(row.key, row);

        setProjectConfig({
            ...projectConfig,
        })
    };

    const handlePropertyCheckChange = (item: DataSourceItem, checked: boolean, propertyName: string) => {
        if (!projectConfig) {
            return;
        }

        const fileData = projectConfig.Translations.get(item.sourceFile) as FileData;
        if (!fileData) {
            return;
        }

        if (fileData.Datas.get(item.key)) {
            fileData.Datas.set(item.key, {
                ...item,
                [propertyName]: checked
            });
        } else {
            console.error("Failed to find item in file data")
        }
        setProjectConfig({
            ...projectConfig
        })
    };

    const handleTransOperationChange = async (item: DataSourceItem) => {
        if (!projectConfig) {
            return;
        }

        const fileData = projectConfig.Translations.get(item.sourceFile) as FileData;
        if (!fileData) {
            return;
        }

        let result = await window.ipcRenderer.invoke('get-env-config', {configName: "YOUDAO_APP_KEY"});
        if (result === undefined) {
            console.warn(`Failed to read file: YOUDAO_APP_KEY`);
            return;
        }

        const appKey = result;

        result = await window.ipcRenderer.invoke('get-env-config', {configName: "YOUDAO_APP_SECRET"});
        if (result === undefined) {
            console.warn(`Failed to read file: YOUDAO_APP_SECRET`);
            return;
        }

        const appSecret = result

        const translator = new YoudaoTranslator(appKey, appSecret);

        // get translation
        translator.translate(item.originVersion, "en", projectConfig.Language).then((res) => {
            fileData.Datas.set(item.key, {
                ...item,
                machineTranslate: res
            });

            // set translation
            setProjectConfig({
                ...projectConfig
            })
        })

    };

    const handleUseTransOperationChange = async (item: DataSourceItem) => {
        if (!projectConfig) {
            return;
        }

        const fileData = projectConfig.Translations.get(item.sourceFile) as FileData;
        if (!fileData) {
            return;
        }

        fileData.Datas.set(item.key, {
            ...item,
            translateVersion: item.machineTranslate
        });

        // set translation
        setProjectConfig({
            ...projectConfig
        })
    };

    const handleSearchOperationChange = async (item: DataSourceItem) => {
        if (!projectConfig) {
            return;
        }

        const fileData = projectConfig.Translations.get(item.sourceFile) as FileData;
        if (!fileData) {
            return;
        }

        setSearchText(item.originVersion)
    };

    const handleCompleteSearchChanged = (e: CheckboxChangeEvent) => {
        setSearchComplete(e.target.checked);
    };

    const handleIgnoreSearchChanged = (e: CheckboxChangeEvent) => {
        setSearchIgnore(e.target.checked);
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchText(e.target.value);
    };

    function GetDatas(): DataSourceItem[] {
        if (!projectConfig) {
            return []
        }

        const datas: DataSourceItem[] = []

        projectConfig.Translations.forEach((data) => {
            data.Datas.forEach((item) => datas.push(item))
        })

        return datas.sort((a, b) => {
            let aScore = a.isComplete ? 0 : 1000
            let bScore = b.isComplete ? 0 : 1000
            aScore += a.isIgnore ? 0 : 500
            bScore += b.isIgnore ? 0 : 500
            return aScore - bScore
        });
    }

    const filteredDataSource = GetDatas()

    const components = {
        body: {
            row: EditableRow,
            cell: EditableCell,
        },
    };

    const columns = TableColumns(
        (item, checked) => handlePropertyCheckChange(item, checked, "isComplete"),
        (item, checked) => handlePropertyCheckChange(item, checked, "isIgnore"),
        handleTransOperationChange,
        handleUseTransOperationChange,
        handleSearchOperationChange
    ).map((col) => {
        if (!col.editable) {
            return col;
        }
        return {
            ...col,
            onCell: (record: DataSourceItem) => ({
                record,
                editable: col.editable,
                dataIndex: col.dataIndex,
                title: col.title,
                handleSave,
            }),
        };
    });

    return (
        <div>
            {contextHolder}
            <div style={{marginBottom: 16}}>
                <p>Project options: </p>
                <Button onClick={handleNewProject} style={{marginRight: 8}}>New Project</Button>
                <input
                    type="file"
                    accept=".json"
                    id="file-input"
                    style={{display: "none"}}
                    onChange={handleFileSelect}
                />
                <Button onClick={() => document.getElementById("file-input")?.click()} style={{marginRight: 8}}>
                    Open Project
                </Button>
                <Button onClick={handleSaveProject}>Save Project</Button>
                <span>{selectedFile}</span>
            </div>
            <Divider/>
            <div>
                <p>Translation options: </p>
                <Button onClick={() => handleExportTrans(true)}>Export to Local</Button>
                <Button onClick={() => handleExportTrans(false)}>Export to Game</Button>
            </div>
            <Divider/>
            <Row gutter={24}>
                <Col span={8}>
                    <Statistic title="Need translate"
                               value={filteredDataSource.filter((item) => !item.isComplete).filter((item) => !item.isIgnore).length}/>
                </Col>
                <Col span={8}>
                    <Statistic title="Completed"
                               value={filteredDataSource.filter((item) => item.isComplete).length}
                               valueStyle={{color: "#52c41a"}}
                    />
                </Col>
                <Col span={8}>
                    <Statistic title="Ignored" value={filteredDataSource.filter((item) => item.isIgnore).length}/>
                </Col>
            </Row>
            <Divider/>
            <Checkbox onChange={handleCompleteSearchChanged}>Show Completed</Checkbox>
            <Checkbox onChange={handleIgnoreSearchChanged}>Show Ignored</Checkbox>
            <AntdInput
                placeholder="Search..."
                value={searchText}
                onChange={handleSearch}
                style={{marginBottom: 16}}
                allowClear
            />
            <Table
                components={components}
                rowClassName={() => 'editable-row'}
                bordered
                dataSource={filteredDataSource.filter(
                    (item) => ((
                            (searchComplete ? true : !item.isComplete))
                        && (searchIgnore ? true : !item.isIgnore)
                        && (
                            searchText === "" ||
                            item.key.toLowerCase().includes(searchText.toLowerCase()) || // 忽略大小写
                            (item.originVersion !== undefined && item.originVersion.toLowerCase().includes(searchText.toLowerCase())) || // 忽略大小写
                            (item.translateVersion !== undefined && item.translateVersion.toLowerCase().includes(searchText.toLowerCase())) // 忽略大小写
                        )
                    )
                )}
                columns={columns}
                sticky
                size={"large"}
            />
        </div>
    );
}
