export default interface SaveFileArgs {
    title: string,
    content: string,
    defaultPath?: string,
    displayChoosePathDialog?: boolean,
    filters?: { name: string, extensions: string[] }[]
}