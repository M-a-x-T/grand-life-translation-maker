export default interface DataSourceItem {
    key: string;
    category: string;
    originVersion: string;
    translateVersion: string;
    machineTranslate: string;
    isComplete: boolean;
    isIgnore: boolean;
    sourceFile: string;
    textPath?: string;
}